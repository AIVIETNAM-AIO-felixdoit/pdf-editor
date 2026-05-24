import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import PDFViewer from "../components/PDFViewer";
import Sidebar from "../components/Sidebar";
import HyperlinkPopup from "../components/HyperlinkPopup";
import { addHyperlink } from "../services/api";
import axios from "axios";

const API_BASE = "https://pdf-editor-nvmf.onrender.com";

export default function Editor() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [selection, setSelection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fileUrl, setFileUrl] = useState(null);

  if (!state?.file) {
    navigate("/");
    return null;
  }

  const { file, fileName } = state;

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    // Ping backend để wake up Render free tier
    axios.get(API_BASE).catch(() => {});
    return () => URL.revokeObjectURL(url);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        <Sidebar file={file} fileName={fileName} />
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