from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import fitz  # PyMuPDF
import pypdf
import base64
import io
import os
import re

router = APIRouter()

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