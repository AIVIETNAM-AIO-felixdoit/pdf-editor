from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import fitz  # PyMuPDF
import pypdf
import base64
import io
import os
import re
import PIL.Image

router = APIRouter()

_EXTRACT_AI_PROMPT = (
    "Bạn là công cụ OCR chuyên nghiệp cho tài liệu PDF. "
    "Trích xuất TOÀN BỘ văn bản xuất hiện trên ảnh trang này.\n\n"
    "Quy tắc bắt buộc:\n"
    "1. Giữ nguyên dấu tiếng Việt chính xác: ử ị ế ồ ơ ư ắ ặ ẹ ể ề ướ ườ ...\n"
    "2. KHÔNG dính chữ — mỗi từ phải cách nhau đúng khoảng trắng\n"
    "3. Giữ cấu trúc đoạn văn, xuống dòng tự nhiên khi có ngắt đoạn\n"
    "4. Công thức toán học inline: bao quanh bằng $...$\n"
    "5. Công thức toán học dạng khối/display: bao quanh bằng $$...$$\n"
    "6. Chỉ xuất văn bản thuần túy — KHÔNG thêm tiêu đề, markdown, hay giải thích\n"
    "7. Nếu trang không có văn bản, xuất chuỗi rỗng"
)

def _validate_pdf(contents: bytes):
    if not contents.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="File không hợp lệ, chỉ chấp nhận PDF")

def _remove_cjk(text: str) -> str:
    """Loại bỏ ký tự CJK (Hán, Hiragana, Katakana, v.v.)"""
    return re.sub(
        r"[\u2E80-\u2FFF\u3000-\u303F\u3040-\u30FF\u3100-\u312F"
        r"\u3200-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F]+",
        "",
        text,
    )

@router.post("/text")
async def extract_text(file: UploadFile = File(...)):
    contents = await file.read()
    _validate_pdf(contents)
    result = []

    doc = fitz.open(stream=contents, filetype="pdf")
    for i, page in enumerate(doc):
        text = page.get_text("text")
        text = _remove_cjk(text)
        result.append({
            "page": i + 1,
            "text": text or ""
        })
    doc.close()

    return JSONResponse(content={"pages": result})


@router.post("/images")
async def extract_images(file: UploadFile = File(...)):
    contents = await file.read()
    _validate_pdf(contents)
    images = []

    reader = pypdf.PdfReader(io.BytesIO(contents))
    for page_num, page in enumerate(reader.pages):
        for img_obj in page.images:
            try:
                pil_img = img_obj.image
                buf = io.BytesIO()
                pil_img.save(buf, format="PNG")
                b64 = base64.b64encode(buf.getvalue()).decode()
                images.append({
                    "page": page_num + 1,
                    "name": img_obj.name,
                    "width": pil_img.width,
                    "height": pil_img.height,
                    "data": b64,
                })
            except Exception:
                continue

    return JSONResponse(content={"images": images})


@router.post("/text-ai")
async def extract_text_ai(file: UploadFile = File(...)):
    """Trích xuất văn bản bằng Gemini Vision — hỗ trợ tiếng Việt và công thức toán."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="AI extraction chưa được cấu hình. Vui lòng thêm GEMINI_API_KEY vào biến môi trường.",
        )

    try:
        import google.generativeai as genai
    except ImportError:
        raise HTTPException(status_code=503, detail="Thư viện google-generativeai chưa được cài đặt.")

    contents = await file.read()
    _validate_pdf(contents)

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-1.5-flash")

    doc = fitz.open(stream=contents, filetype="pdf")
    result = []

    for i, page in enumerate(doc):
        # Render trang thành ảnh PNG ở ~108 DPI (scale 1.5)
        mat = fitz.Matrix(1.5, 1.5)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        img = PIL.Image.open(io.BytesIO(pix.tobytes("png")))

        try:
            response = model.generate_content([_EXTRACT_AI_PROMPT, img])
            text = (response.text or "").strip()
        except Exception as e:
            text = f"[Lỗi xử lý trang {i + 1}: {e}]"

        result.append({"page": i + 1, "text": text})

    doc.close()
    return JSONResponse(content={"pages": result, "source": "ai"})