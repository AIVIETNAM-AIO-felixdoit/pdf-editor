import { useState } from "react";

export default function HyperlinkPopup({ rect, selectedText, onConfirm, onClose }) {
  const [url, setUrl] = useState("https://");

  if (!rect) return null;

  const style = {
    position: "fixed",
    top: rect.bottom + window.scrollY + 8,
    left: rect.left + window.scrollX,
    zIndex: 1000,
  };

  return (
    <div className="hyperlink-popup" style={style}>
      <p className="popup-title">🔗 Chèn Hyperlink</p>
      <p className="popup-selected">"{selectedText}"</p>
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://..."
        autoFocus
      />
      <div className="popup-actions">
        <button className="btn" onClick={() => onConfirm(url)}>
          Xác nhận
        </button>
        <button className="btn btn-cancel" onClick={onClose}>
          Hủy
        </button>
      </div>
    </div>
  );
}