import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import PDFViewer from "../components/PDFViewer";
import Sidebar from "../components/Sidebar";
import HyperlinkPopup from "../components/HyperlinkPopup";
import ResultPreview from "../components/ResultPreview";
import { addHyperlink } from "../services/api";
import axios from "axios";

const API_BASE = import.meta.env.DEV
  ? "http://localhost:8000"
  : "https://pdf-editor-nvmf.onrender.com";
const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 600;

export default function Editor() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [selection, setSelection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fileUrl, setFileUrl] = useState(null);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [resultPreview, setResultPreview] = useState(null); // { blob, filename }
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const dragging = useRef(false);

  const { file, fileName } = state || {};

  useEffect(() => {
    if (!file) {
      navigate("/");
      return;
    }
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    axios.get(API_BASE).catch(() => {});
    return () => URL.revokeObjectURL(url);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!file) return null;

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (ev) => {
      if (!dragging.current) return;
      const newWidth = window.innerWidth - ev.clientX;
      setSidebarWidth(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, newWidth)));
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = fileName;
    a.click();
  };

  const handleTextSelect = ({ text, rect, pageNumber, pageRect, scale }) => {
    setSelection({ text, rect, pageNumber, pageRect, scale });
  };

  const handleHyperlinkConfirm = async (url) => {
    if (!url || !url.trim()) {
      alert("Vui lòng nhập URL");
      return;
    }
    if (!selection) return;
    setLoading(true);
    try {
      const { pageNumber, pageRect, scale, rect } = selection;

      if (!pageRect) {
        alert("Không xác định được trang. Hãy thử chọn lại văn bản.");
        return;
      }

      // pdfjs renders 1 PDF point = 1 CSS pixel at scale=1
      // → pdf_pts = screen_px / scale  (no DPI conversion needed)
      const relX = rect.left - pageRect.left;
      const relY = rect.top - pageRect.top;

      const pdfX = Math.max(0, relX / scale);
      const pdfW = Math.max(10, rect.width / scale);
      const pdfH = Math.max(8, rect.height / scale);
      const pdfPageH = pageRect.height / scale;
      const pdfY = Math.max(0, pdfPageH - relY / scale - pdfH);

      console.log("[Hyperlink] page:", pageNumber, "pdfX:", pdfX, "pdfY:", pdfY, "pdfW:", pdfW, "pdfH:", pdfH);

      const res = await addHyperlink(file, pageNumber, url.trim(), pdfX, pdfY, pdfW, pdfH);
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data]);
      setResultPreview({ blob, filename: "hyperlinked.pdf" });
    } catch (e) {
      console.error("[Hyperlink error]", e);
      const detail = e?.response?.data instanceof Blob
        ? await e.response.data.text()
        : e?.response?.data?.detail;
      alert("Lỗi khi chèn hyperlink: " + (detail || e?.message || "Không xác định"));
    } finally {
      setLoading(false);
      setSelection(null);
    }
  };

  return (
    <div className="editor-layout">
      <div className="editor-navbar">
        <button className="back-btn" onClick={() => navigate("/")}>
          ← Back
        </button>
        <span className="editor-title" style={{ cursor: "pointer" }} onClick={() => navigate("/")}>PDF Editor</span>
        <button className="download-btn" onClick={handleDownload} title="Tải file hiện tại">
          ⬇ Tải về
        </button>
        <button
          className="hamburger-btn"
          onClick={() => setSidebarOpen((o) => !o)}
          title="Công cụ"
        >
          <span /><span /><span />
        </button>
      </div>

      <div className="editor-body">
        <PDFViewer fileUrl={fileUrl} onTextSelect={handleTextSelect} />
        <div className="resize-handle" onMouseDown={handleMouseDown} />
        {sidebarOpen && (
          <div
            className="sidebar-overlay"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <Sidebar
          file={file}
          fileName={fileName}
          sidebarWidth={sidebarWidth}
          onResult={(blob, filename) => setResultPreview({ blob, filename })}
          mobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
        />
      </div>

      {resultPreview && (
        <ResultPreview
          blob={resultPreview.blob}
          filename={resultPreview.filename}
          onClose={() => setResultPreview(null)}
        />
      )}

      {selection && (
        <HyperlinkPopup
          rect={selection.rect}
          selectedText={selection.text}
          onConfirm={handleHyperlinkConfirm}
          onClose={() => setSelection(null)}
        />
      )}
    </div>
  );
}