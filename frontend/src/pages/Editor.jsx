import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import PDFViewer from "../components/PDFViewer";
import Sidebar from "../components/Sidebar";
import HyperlinkPopup from "../components/HyperlinkPopup";
import { addHyperlink } from "../services/api";
import axios from "axios";

const API_BASE = "https://pdf-editor-nvmf.onrender.com";
const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 600;

export default function Editor() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [selection, setSelection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fileUrl, setFileUrl] = useState(null);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const dragging = useRef(false);

  if (!state?.file) {
    navigate("/");
    return null;
  }

  const { file, fileName } = state;

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    axios.get(API_BASE).catch(() => {});
    return () => URL.revokeObjectURL(url);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleTextSelect = ({ text, rect }) => {
    setSelection({ text, rect });
  };

  const handleHyperlinkConfirm = async (url) => {
    setLoading(true);
    try {
      const res = await addHyperlink(
        file, 1, url,
        selection.rect.x, selection.rect.y,
        selection.rect.width, selection.rect.height
      );
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data]);
      const dlUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = "hyperlinked.pdf";
      a.click();
      window.URL.revokeObjectURL(dlUrl);
      alert("Đã chèn hyperlink và tải file về");
    } catch {
      alert("Lỗi khi chèn hyperlink");
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
        <span className="editor-title">PDF Editor</span>
        <button className="download-btn" onClick={handleDownload} title="Tải file hiện tại">
          ⬇ Tải về
        </button>
      </div>

      <div className="editor-body">
        <PDFViewer fileUrl={fileUrl} onTextSelect={handleTextSelect} />
        <div className="resize-handle" onMouseDown={handleMouseDown} />
        <Sidebar file={file} fileName={fileName} sidebarWidth={sidebarWidth} />
      </div>

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