from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
import pypdf
import io

router = APIRouter()

def _validate_pdf(contents: bytes):
    if not contents.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="File không hợp lệ, chỉ chấp nhận PDF")

@router.post("/")
async def compress_pdf(file: UploadFile = File(...)):
    contents = await file.read()
    _validate_pdf(contents)
    reader = pypdf.PdfReader(io.BytesIO(contents))
    writer = pypdf.PdfWriter()

    for page in reader.pages:
        page.compress_content_streams()
        writer.add_page(page)

    writer.compress_identical_objects(remove_identicals=True, remove_orphans=True)

    output = io.BytesIO()
    writer.write(output)
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=compressed.pdf"}
    )