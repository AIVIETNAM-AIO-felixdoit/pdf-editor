from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
import pypdf
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
    reader = pypdf.PdfReader(io.BytesIO(contents))
    writer = pypdf.PdfWriter()

    for p in reader.pages:
        writer.add_page(p)

    target_page = writer.pages[page - 1]

    writer.add_uri(
        pagenum=page - 1,
        uri=url,
        rect=pypdf.generic.RectangleObject([x, y, x + width, y + height])
    )

    output = io.BytesIO()
    writer.write(output)
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=hyperlinked.pdf"}
    )