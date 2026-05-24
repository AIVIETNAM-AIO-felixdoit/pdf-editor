import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

export default function PDFViewer({ fileUrl, onTextSelect }) {
  const [numPages, setNumPages] = useState(null);
  const [scale, setScale] = useState(1.2);

  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const text = selection.toString().trim();
    if (!text) return;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Dùng canvas element để lấy tọa độ chính xác của trang PDF
    const canvases = document.querySelectorAll(".react-pdf__Page__canvas");
    let pageNumber = 1;
    let pageRect = null;
    for (let i = 0; i < canvases.length; i++) {
      const cr = canvases[i].getBoundingClientRect();
      if (rect.top >= cr.top - 10 && rect.bottom <= cr.bottom + 10) {
        pageNumber = i + 1;
        pageRect = cr;
        break;
      }
    }
    // fallback: lấy canvas gần nhất
    if (!pageRect && canvases.length > 0) {
      pageRect = canvases[0].getBoundingClientRect();
    }

    onTextSelect && onTextSelect({ text, rect, pageNumber, pageRect, scale });
  };

  return (
    <div className="pdf-viewer-wrap">
      <div className="pdf-zoom-controls">
        <button onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}>−</button>
        <span>{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale((s) => Math.min(3, s + 0.1))}>+</button>
      </div>

      <div className="pdf-pages" onMouseUp={handleMouseUp}>
        <Document
          file={fileUrl}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        >
          {Array.from({ length: numPages || 0 }, (_, i) => (
            <div key={i} className="pdf-page-wrapper">
              <p className="pdf-page-label">Trang {i + 1}</p>
              <Page pageNumber={i + 1} scale={scale} />
            </div>
          ))}
        </Document>
      </div>
    </div>
  );
}