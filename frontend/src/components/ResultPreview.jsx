import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

export default function ResultPreview({ blob, filename, onClose }) {
  const [url, setUrl] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  // Watch for annotation links added by react-pdf and force open in new tab
  useEffect(() => {
    const observer = new MutationObserver(() => {
      containerRef.current
        ?.querySelectorAll("a[href]:not([data-newtab])")
        .forEach((a) => {
          a.setAttribute("data-newtab", "1");
          a.addEventListener("click", (e) => {
            e.preventDefault();
            window.open(a.href, "_blank", "noopener,noreferrer");
          });
        });
    });
    if (containerRef.current) {
      observer.observe(containerRef.current, { childList: true, subtree: true });
    }
    return () => observer.disconnect();
  }, []);

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  };

  return (
    <div className="result-preview-overlay">
      <div className="result-preview-modal">
        <div className="result-preview-header">
          <span className="result-preview-name">📄 {filename}</span>
          <div className="result-preview-actions">
            <button className="rp-btn-download" onClick={handleDownload}>
              ⬇ Tải về
            </button>
            <button className="rp-btn-close" onClick={onClose}>
              ✕ Đóng
            </button>
          </div>
        </div>
        <div className="result-preview-frame" ref={containerRef}>
          {url && (
            <Document
              file={url}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            >
              {Array.from({ length: numPages || 0 }, (_, i) => (
                <Page key={i} pageNumber={i + 1} />
              ))}
            </Document>
          )}
        </div>
      </div>
    </div>
  );
}
