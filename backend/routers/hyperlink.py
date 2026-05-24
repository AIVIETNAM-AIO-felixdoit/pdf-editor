from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
import pypdf
from pypdf.generic import (
    RectangleObject, DictionaryObject, NameObject, NumberObject, ArrayObject
)
import io

router = APIRouter()

def _validate_pdf(contents: bytes):
    if not contents.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="File không hợp lệ, chỉ chấp nhận PDF")

@router.post("/add")
async def add_hyperlink(
    file: UploadFile = File(...),
    page: int = Form(...),
    url: str = Form(...),
    x: float = Form(...),
    y: float = Form(...),
    width: float = Form(...),
    height: float = Form(...),
):
    contents = await file.read()
    _validate_pdf(contents)
    if not url or not url.strip():
        raise HTTPException(status_code=400, detail="URL không được để trống")
    reader = pypdf.PdfReader(io.BytesIO(contents))
    writer = pypdf.PdfWriter()

    for p in reader.pages:
        writer.add_page(p)

    writer.add_uri(
        page_number=page - 1,
        uri=url.strip(),
        rect=RectangleObject([x, y, x + width, y + height]),
        border=ArrayObject([NumberObject(0), NumberObject(0), NumberObject(0)]),
    )

    # Thay border box bằng underline style
    page_obj = writer.pages[page - 1]
    annots = page_obj.get("/Annots")
    if annots is not None and len(annots) > 0:
        last_ref = annots[-1]
        last_annot = last_ref.get_object() if hasattr(last_ref, "get_object") else last_ref
        last_annot[NameObject("/BS")] = DictionaryObject({
            NameObject("/S"): NameObject("/U"),   # Underline
            NameObject("/W"): NumberObject(1),
        })
        last_annot[NameObject("/C")] = ArrayObject([
            NumberObject(0), NumberObject(0.4), NumberObject(0.8),  # blue
        ])

    output = io.BytesIO()
    writer.write(output)
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=hyperlinked.pdf"}
    )