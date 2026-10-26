import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { analyzeWatermarks, processWatermarks } from "../services/api";

async function errorMessage(error) {
  let data = error?.response?.data;
  if (data instanceof Blob) {
    try { data = JSON.parse(await data.text()); } catch { data = null; }
  }
  return typeof data?.detail === "string" ? data.detail : "Không thể xử lý PDF. Hãy thử lại.";
}

export default function WatermarkPanel({ file, onResult }) {
  const [analysis, setAnalysis] = useState(null);
  const [selected, setSelected] = useState([]);
  const [pageRange, setPageRange] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);

  useEffect(() => {
    if (!preview) return;
    const onKey = event => { if (event.key === "Escape") setPreview(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [preview]);

  const normalizedRange = pageRange.trim().toLocaleLowerCase("vi");
  const allPages = ["", "tất cả", "tat ca", "all", "*"].includes(normalizedRange);
  const pages = new Set();
  let rangeError = "";
  if (!allPages && analysis) {
    for (const part of pageRange.split(",")) {
      const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
      const start = Number(match?.[1]);
      const end = Number(match?.[2] ?? start);
      if (!match || start < 1 || end < start || end > analysis.page_count) {
        rangeError = "Nhập trang hợp lệ, ví dụ: 1, 3-5.";
        break;
      }
      for (let page = start; page <= end; page++) pages.add(page);
    }
  }
  const visible = (analysis?.candidates || []).filter(c => allPages || pages.has(c.page));
  const chosen = visible.filter(c => selected.includes(c.id)).map(c => c.id);

  const perform = async (task) => {
    if (controller.current) controller.current.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setError("");
    try { await task(request.signal); }
    catch (err) { if (!request.signal.aborted) setError(await errorMessage(err)); }
    finally { if (!request.signal.aborted) setBusy(false); }
  };

  return (
    <section className="tool-section watermark-panel" aria-label="Xóa watermark">
      <p className="tool-label">Xóa watermark</p>
      <p className="tool-hint">Hỗ trợ watermark vector mờ, khối chữ nghiêng/mờ, stamp, annotation watermark, ảnh và nhóm đồ họa riêng biệt. Tối đa 20 MB / 100 trang.</p>
      <p className="tool-hint">Danh sách có thể chứa nội dung hợp lệ. Hãy xem trước từng ứng viên. Chỉ hỗ trợ khối chữ tách riêng; chưa hỗ trợ watermark hòa vào ảnh scan.</p>
      <button className="tool-btn" disabled={busy} onClick={() => perform(async signal => {
        const res = await analyzeWatermarks(file, signal);
        setAnalysis(res.data); setSelected([]); setPreview(null);
      })}>{busy ? "Đang xử lý…" : "Phân tích PDF"}</button>
      {analysis && <>
        <label className="watermark-range">Phạm vi trang
          <input value={pageRange} disabled={busy} placeholder="Tất cả; hoặc 1, 3-5" onChange={e => setPageRange(e.target.value)} />
        </label>
        <p className="tool-hint">{analysis.page_count} trang · {analysis.candidates.length} ứng viên · {chosen.length} đã chọn trong phạm vi.</p>
        {rangeError && <p role="alert" className="watermark-error">{rangeError}</p>}
        {analysis.candidates.length === 0 && <p>Không tìm thấy đối tượng được hỗ trợ. Watermark có thể dùng chung khối với nội dung, nằm trong nhóm đồ họa hoặc đã hòa vào ảnh scan.</p>}
        <div className="watermark-candidates">
          {visible.map(c => <div className="watermark-candidate" key={c.id}>
            <label><input type="checkbox" disabled={busy || !!rangeError} checked={selected.includes(c.id)} onChange={() => setSelected(ids => ids.includes(c.id) ? ids.filter(id => id !== c.id) : [...ids, c.id])} />
              <span>Trang {c.page} — {c.label}</span>
            </label>
            <button className="tool-btn" disabled={busy || !!rangeError} onClick={() => perform(async signal => {
              const res = await processWatermarks(file, { fingerprint: analysis.fingerprint, selected_ids: [c.id] }, true, signal);
              setPreview({ ...res.data, label: c.label, page: c.page });
            })}>Xem trước ứng viên</button>
          </div>)}
        </div>
        <button className="tool-btn" disabled={busy || !!rangeError || chosen.length === 0} onClick={() => perform(async signal => {
          const res = await processWatermarks(file, { fingerprint: analysis.fingerprint, selected_ids: chosen }, false, signal);
          onResult(res.data, "watermark-removed.pdf");
        })}>Tạo PDF đã xóa ({chosen.length})</button>
      </>}
      {busy && <p role="status">Đang xử lý PDF…</p>}
      {error && <p role="alert" className="watermark-error">{error}</p>}
      {preview && createPortal(<div className="result-preview-overlay" role="dialog" aria-modal="true" aria-label="So sánh ứng viên watermark">
        <div className="result-preview-modal">
          <div className="result-preview-header"><span>Trang {preview.page} — {preview.label}</span><button className="rp-btn-close" onClick={() => setPreview(null)} autoFocus>Đóng</button></div>
          <p className="watermark-notice">So sánh trước và sau khi bỏ riêng ứng viên này. Nếu mất nội dung cần giữ, hãy bỏ chọn ứng viên.</p>
          <div className="watermark-comparison">
            <figure><figcaption>Trước</figcaption><img src={"data:image/png;base64," + preview.before} alt="Trang gốc" /></figure>
            <figure><figcaption>Sau</figcaption><img src={"data:image/png;base64," + preview.after} alt="Trang sau khi bỏ ứng viên" /></figure>
          </div>
        </div>
      </div>, document.body)}
    </section>
  );
}
