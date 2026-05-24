import { extractText, extractImages, compressPdf, splitPdf, mergePdfs } from "../services/api";
import { useState } from "react";

const PAGE_SIZES = ["A2", "A3", "A4", "A5", "Letter", "Legal"];

export default function Sidebar({ file, fileName }) {
  const [activeTab, setActiveTab] = useState("tools");
  const [extractedText, setExtractedText] = useState(null);
  const [extractedImages, setExtractedImages] = useState(null);
  const [splitStart, setSplitStart] = useState(1);
  const [splitEnd, setSplitEnd] = useState("");
  const [mergeFiles, setMergeFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  const downloadBlob = (data, name) => {
    const blob = data instanceof Blob ? data : new Blob([data]);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExtractText = async () => {
    setLoading(true);
    try {
      const res = await extractText(file);
      setExtractedText(res.data.pages);
      setActiveTab("result-text");
    } catch {
      alert("Lỗi khi trích xuất văn bản");
    } finally {
      setLoading(false);
    }
  };

  const handleExtractImages = async () => {
    setLoading(true);
    try {
      const res = await extractImages(file);
      setExtractedImages(res.data.images);
      setActiveTab("result-images");
    } catch {
      alert("Lỗi khi trích xuất hình ảnh");
    } finally {
      setLoading(false);
    }
  };

  const handleCompress = async () => {
    setLoading(true);
    try {
      const res = await compressPdf(file);
      downloadBlob(res.data, "compressed.pdf");
    } catch {
      alert("Lỗi khi nén file");
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = async () => {
    if (mergeFiles.length === 0) {
      alert("Vui lòng chọn ít nhất một file PDF để merge");
      return;
    }
    setLoading(true);
    try {
      const allFiles = [file, ...mergeFiles];
      const res = await mergePdfs(allFiles);
      downloadBlob(res.data, "merged.pdf");
    } catch {
      alert("Lỗi khi merge file");
    } finally {
      setLoading(false);
    }
  };

  const handleSplit = async () => {
    setLoading(true);
    try {
      const res = await splitPdf(file, splitStart, splitEnd || undefined);
      downloadBlob(res.data, "split.pdf");
    } catch {
      alert("Lỗi khi split file");
    } finally {
      setLoading(false);
    }
  };

  const handlePageSize = async (size) => {
    alert(`Tính năng đổi cỡ trang ${size} đang phát triển`);
  };

  return (
    <div className="sidebar">
      {loading && (
        <div className="sidebar-loading">
          <span className="sidebar-loading-spinner" />
          <span>Đang xử lý...</span>
        </div>
      )}
      <div className="sidebar-header">
        <p className="sidebar-filename">📄 {fileName}</p>
      </div>

      <div className="sidebar-tabs">
        <button
          className={activeTab === "tools" ? "tab active" : "tab"}
          onClick={() => setActiveTab("tools")}
        >
          Tools
        </button>
        <button
          className={activeTab === "result-text" ? "tab active" : "tab"}
          onClick={() => setActiveTab("result-text")}
          disabled={!extractedText}
        >
          Text
        </button>
        <button
          className={activeTab === "result-images" ? "tab active" : "tab"}
          onClick={() => setActiveTab("result-images")}
          disabled={!extractedImages}
        >
          Images
        </button>
      </div>

      {activeTab === "tools" && (
        <div className="sidebar-tools">
          <div className="tool-section">
            <p className="tool-label">Trích xuất</p>
            <button className="tool-btn" onClick={handleExtractText} disabled={loading}>
              Trích xuất văn bản
            </button>
            <button className="tool-btn" onClick={handleExtractImages} disabled={loading}>
              Trích xuất hình ảnh
            </button>
          </div>

          <div className="tool-section">
            <p className="tool-label">Merge PDF</p>
            <input
              type="file"
              accept=".pdf"
              multiple
              onChange={(e) => setMergeFiles(Array.from(e.target.files))}
              style={{ fontSize: 12, marginBottom: 6 }}
            />
            {mergeFiles.length > 0 && (
              <p style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>
                +{mergeFiles.length} file đã chọn
              </p>
            )}
            <button className="tool-btn" onClick={handleMerge} disabled={loading}>
              Merge PDF
            </button>
          </div>

          <div className="tool-section">
            <p className="tool-label">Split trang</p>
            <div className="split-inputs">
              <input
                type="number"
                min={1}
                value={splitStart}
                onChange={(e) => setSplitStart(e.target.value)}
                placeholder="Từ trang"
              />
              <input
                type="number"
                min={1}
                value={splitEnd}
                onChange={(e) => setSplitEnd(e.target.value)}
                placeholder="Đến trang"
              />
            </div>
            <button className="tool-btn" onClick={handleSplit} disabled={loading}>
              Split PDF
            </button>
          </div>

          <div className="tool-section">
            <p className="tool-label">Nén file</p>
            <button className="tool-btn" onClick={handleCompress} disabled={loading}>
              Nén PDF
            </button>
          </div>

          <div className="tool-section">
            <p className="tool-label">Cỡ trang</p>
            <div className="page-size-grid">
              {PAGE_SIZES.map((size) => (
                <button
                  key={size}
                  className="size-btn"
                  onClick={() => handlePageSize(size)}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "result-text" && extractedText && (
        <div className="sidebar-result">
          {extractedText.map((p) => (
            <div key={p.page} className="result-page">
              <p className="result-page-label">Trang {p.page}</p>
              <p className="result-page-text">{p.text || "Không có văn bản"}</p>
            </div>
          ))}
        </div>
      )}

      {activeTab === "result-images" && extractedImages && (
        <div className="sidebar-result">
          <p className="result-page-label">
            Tìm thấy {extractedImages.length} hình ảnh
          </p>
          {extractedImages.map((img, i) => (
            <div key={i} className="image-card">
              <p>Trang {img.page} — {img.width}x{img.height}px</p>
              {img.data && (
                <img
                  src={`data:image/png;base64,${img.data}`}
                  alt={img.name || `img-${i}`}
                  style={{ maxWidth: "100%", borderRadius: 4 }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}