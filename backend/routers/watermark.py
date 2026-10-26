import base64
import io
import json

import fitz
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, ValidationError

from services.watermark import MAX_BYTES, WatermarkError, analyze, remove

router = APIRouter()


class RemovalOptions(BaseModel):
    fingerprint: str = Field(pattern=r'^[a-f0-9]{64}$')
    selected_ids: list[str] = Field(min_length=1, max_length=1000)


def read_upload(file):
    data = file.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "PDF vượt quá giới hạn 20 MB.")
    return data


def parse_options(options):
    try:
        return RemovalOptions.model_validate(json.loads(options))
    except (ValueError, ValidationError) as exc:
        raise HTTPException(422, "Lựa chọn không hợp lệ.") from exc


@router.post('/analyze')
def analyze_watermarks(file: UploadFile = File(...)):
    try:
        return analyze(read_upload(file))
    except WatermarkError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.post('/remove')
def remove_watermarks(file: UploadFile = File(...), options: str = Form(...)):
    selection = parse_options(options)
    try:
        output = remove(read_upload(file), selection.fingerprint, selection.selected_ids)
    except WatermarkError as exc:
        raise HTTPException(400, str(exc)) from exc
    return StreamingResponse(io.BytesIO(output), media_type='application/pdf',
        headers={'Content-Disposition': 'attachment; filename="watermark-removed.pdf"'})


@router.post('/preview')
def preview_watermark(file: UploadFile = File(...), options: str = Form(...)):
    selection = parse_options(options)
    if len(selection.selected_ids) != 1:
        raise HTTPException(422, "Chỉ xem một ứng viên mỗi lần.")
    data = read_upload(file)
    try:
        output = remove(data, selection.fingerprint, selection.selected_ids)
        page_index = int(selection.selected_ids[0].split(':')[0]) - 1
        images = {}
        for key, contents in [('before', data), ('after', output)]:
            with fitz.open(stream=contents, filetype='pdf') as doc:
                page = doc[page_index]
                width, height = page.rect.width, page.rect.height
                if width <= 0 or height <= 0:
                    raise WatermarkError("Kích thước trang không hợp lệ.")
                scale = min(600 / width, 800 / height, 1)
                pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
                images[key] = base64.b64encode(pix.tobytes('png')).decode('ascii')
        return images
    except WatermarkError as exc:
        raise HTTPException(400, str(exc)) from exc
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(400, "Không thể tạo bản xem trước của trang này.") from exc
