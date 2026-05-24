from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from typing import List
import pypdf
import io

router = APIRouter()

def _validate_pdf(contents: bytes):
    if not contents.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="File không hợp lệ, chỉ chấp nhận PDF")

@router.post("/merge")
async def merge_pdfs(files: List[UploadFile] = File(...)):
    writer = pypdf.PdfWriter()

    for file in files:
        contents = await file.read()
        _validate_pdf(contents)
        reader = pypdf.PdfReader(io.BytesIO(contents))
        for page in reader.pages:
            writer.add_page(page)

    output = io.BytesIO()
    writer.write(output)
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=merged.pdf"}
    )


@router.post("/split")
async def split_pdf(
    file: UploadFile = File(...),
    start: int = 1,
    end: int = None
):
    contents = await file.read()
    _validate_pdf(contents)
    reader = pypdf.PdfReader(io.BytesIO(contents))
    writer = pypdf.PdfWriter()

    total = len(reader.pages)
    end = end or total

    for i in range(start - 1, min(end, total)):
        writer.add_page(reader.pages[i])

    output = io.BytesIO()
    writer.write(output)
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=split_{start}_{end}.pdf"}
    )