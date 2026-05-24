import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    navigate("/editor", { state: { file, fileName: file.name } });
  };

  return (
    <div className="home-wrapper">
      <div className="home-center">
        <h1>PDF Editor</h1>
        <p>Upload file PDF để bắt đầu chỉnh sửa</p>
        <label className="upload-box">
          <input type="file" accept=".pdf" onChange={handleFile} />
          <span className="upload-icon"><img src="/iso.jpg" alt="upload" className="upload-icon-img" /></span>
          <span>Click hoặc kéo thả file PDF vào đây</span>
          <span className="upload-hint">Hỗ trợ file .pdf</span>
        </label>
        <button className="bmc-link" onClick={() => navigate("/buy-me-coffee")}>
          ☕ Buy me a coffee
        </button>
        <button className="bmc-link" onClick={() => navigate("/feedback")}>
          💬 Feedback & Liên hệ
        </button>
      </div>
    </div>
  );
}