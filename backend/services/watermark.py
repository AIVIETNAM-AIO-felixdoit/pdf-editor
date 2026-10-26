"""Conservative removal of selected page-level paint operations and stamps."""
import hashlib
import io

import pikepdf

MAX_BYTES = 20 * 1024 * 1024
MAX_PAGES = 100
MAX_CANDIDATES = 1000


class WatermarkError(ValueError):
    pass


def open_pdf(data):
    if len(data) > MAX_BYTES:
        raise WatermarkError("PDF vượt quá giới hạn 20 MB.")
    try:
        pdf = pikepdf.Pdf.open(io.BytesIO(data))
    except pikepdf.PasswordError as exc:
        raise WatermarkError("Hãy mở khóa PDF trước khi xử lý.") from exc
    except pikepdf.PdfError as exc:
        raise WatermarkError("Không đọc được PDF hoặc file bị hỏng.") from exc
    if pdf.is_encrypted or not 1 <= len(pdf.pages) <= MAX_PAGES:
        pdf.close()
        raise WatermarkError("Chỉ hỗ trợ PDF không mã hóa, từ 1 đến 100 trang.")
    return pdf


def fingerprint(data):
    return hashlib.sha256(data).hexdigest()



def text_candidates(instructions, resources):
    """Select whole text objects only when every visible run looks like a watermark.

    Keep positioning/font/color operators during removal: they may be inherited by
    subsequent text objects. Never remove clipping text or a mixed-content object.
    """
    import math
    state = dict(matrix=(1., 0., 0., 1., 0., 0.), alpha=1., gray=0., mode=0)
    stack = []
    block = None
    matrix = (1., 0., 0., 1., 0., 0.)
    for index, instruction in enumerate(instructions):
        op, args = str(instruction.operator), instruction.operands
        if op == 'q':
            stack.append(state.copy())
        elif op == 'Q' and stack:
            state = stack.pop()
        elif op == 'cm' and len(args) == 6:
            a,b,c,d,e,f = map(float, args)
            A,B,C,D,E,F = state['matrix']
            state['matrix'] = (a*A+b*C, a*B+b*D, c*A+d*C, c*B+d*D, e*A+f*C+E, e*B+f*D+F)
        elif op == 'gs' and args:
            gs = resources.get('/ExtGState', {}).get(args[0], {})
            state['alpha'] = float(gs.get('/ca', state['alpha']))
        elif op == 'g' and args:
            state['gray'] = float(args[0])
        elif op == 'rg' and len(args) == 3:
            rgb = list(map(float, args))
            state['gray'] = min(rgb) if max(rgb)-min(rgb) < .15 else 0.
        elif op == 'k':
            state['gray'] = 0.
        elif op == 'Tr' and args:
            state['mode'] = int(args[0])
        elif op == 'BT':
            block = dict(start=index, shows=[], eligible=True, labels=[])
            matrix = (1., 0., 0., 1., 0., 0.)
        elif op == 'Tm' and len(args) == 6:
            matrix = tuple(map(float, args))
        elif op in ('Tj', 'TJ', "'", '"') and block is not None:
            a,b = matrix[:2]
            A,B,C,D,_,_ = state['matrix']
            x,y = a*A+b*C, a*B+b*D
            tilted = abs(y) > .05 * max(math.hypot(x,y), .0001)
            suspicious = tilted or state['alpha'] <= .6 or state['gray'] >= .65
            block['eligible'] &= suspicious and state['mode'] in (0, 1, 2)
            block['shows'].append(index)
            # A display label only; never use decoded text to identify operators.
            values = args[0] if op == 'TJ' else [args[-1]]
            for value in values:
                if isinstance(value, pikepdf.String):
                    raw = bytes(value)
                    if raw and all(32 <= byte < 127 for byte in raw):
                        block['labels'].append(raw.decode('ascii'))
        elif op == 'ET' and block is not None:
            if block['eligible'] and block['shows']:
                yield dict(start=block['start'], shows=block['shows'],
                    label=''.join(block['labels']).strip()[:100] or 'Khối chữ nghiêng/mờ')
            block = None



def vector_candidates(instructions, resources):
    """Group faint curved fills inside marked artifacts, preserving header text."""
    state = dict(alpha=1., gray=0.)
    saved = []
    marked = []
    groups = {}
    curves = 0
    clipping = False
    for index, instruction in enumerate(instructions):
        op, args = str(instruction.operator), instruction.operands
        if op in ('BMC', 'BDC'):
            marked.append(index if args and str(args[0]) == '/Artifact' else None)
        elif op == 'EMC':
            if marked:
                marked.pop()
        elif op == 'q':
            saved.append(state.copy())
        elif op == 'Q' and saved:
            state = saved.pop()
        elif op == 'gs' and args:
            gs = resources.get('/ExtGState', {}).get(args[0], {})
            state['alpha'] = float(gs.get('/ca', state['alpha']))
        elif op == 'g' and args:
            state['gray'] = float(args[0])
        elif op == 'rg' and len(args) == 3:
            rgb = list(map(float, args))
            state['gray'] = min(rgb) if max(rgb) - min(rgb) < .15 else 0.
        elif op == 'k':
            state['gray'] = 0.
        elif op in ('c', 'v', 'y'):
            curves += 1
        elif op in ('W', 'W*'):
            clipping = True
        elif op in ('f', 'f*', 'F', 'S', 's', 'B', 'B*', 'b', 'b*', 'n'):
            artifacts = [start for start in marked if start is not None]
            if (artifacts and op in ('f', 'f*', 'F') and curves and not clipping
                    and (state['alpha'] <= .6 or state['gray'] >= .65)):
                start = artifacts[-1]
                group = groups.setdefault(start, dict(start=start, paints=[], curves=0))
                group['paints'].append(index)
                group['curves'] += curves
            curves = 0
            clipping = False
    for group in groups.values():
        # Outlined lettering normally consists of many curved, filled glyphs.
        if len(group['paints']) >= 5 and group['curves'] >= 20:
            yield group


def scan(pdf):
    candidates = []
    for page_no, page in enumerate(pdf.pages, 1):
        for index, annot in enumerate(page.obj.get('/Annots', [])):
            subtype = str(annot.get('/Subtype', ''))
            if subtype in ('/Watermark', '/Stamp'):
                candidates.append(dict(id=f"{page_no}:annot:{index}", page=page_no,
                    kind='annotation', label=str(annot.get('/Contents', '')).strip()[:120] or subtype[1:]))
        page_resources = page.obj.get('/Resources', {})
        resources = page_resources.get('/XObject', {})
        try:
            instructions = pikepdf.parse_content_stream(page)
        except pikepdf.PdfError as exc:
            raise WatermarkError(f"Không phân tích được trang {page_no}.") from exc
        for group in vector_candidates(instructions, page_resources):
            candidates.append(dict(id=f"{page_no}:vector:{group['start']}", page=page_no,
                kind='vector', label=f"Watermark vector mờ ({len(group['paints'])} nét tô)"))
        for block in text_candidates(instructions, page_resources):
            candidates.append(dict(id=f"{page_no}:text:{block['start']}", page=page_no,
                kind='text', label=f"Chữ: {block['label']}"))
        for index, instruction in enumerate(instructions):
            if str(instruction.operator) != 'Do' or len(instruction.operands) != 1:
                continue
            name = instruction.operands[0]
            obj = resources.get(name)
            if obj is None:
                continue
            subtype = str(obj.get('/Subtype', ''))
            if subtype in ('/Image', '/Form'):
                candidates.append(dict(id=f"{page_no}:paint:{index}", page=page_no,
                    kind='image' if subtype == '/Image' else 'form',
                    label=f"{subtype[1:]} {name} · lần vẽ {index}"))
        if len(candidates) > MAX_CANDIDATES:
            raise WatermarkError("PDF có quá nhiều đối tượng; hãy tách thành tài liệu nhỏ hơn.")
    return candidates


def analyze(data):
    with open_pdf(data) as pdf:
        return dict(fingerprint=fingerprint(data), page_count=len(pdf.pages), candidates=scan(pdf))


def remove(data, expected_fingerprint, selected_ids):
    if fingerprint(data) != expected_fingerprint:
        raise WatermarkError("Tài liệu đã thay đổi. Hãy phân tích lại.")
    if not selected_ids or len(selected_ids) > MAX_CANDIDATES:
        raise WatermarkError("Hãy chọn ít nhất một đối tượng hợp lệ.")
    with open_pdf(data) as pdf:
        valid = {c['id'] for c in scan(pdf)}
        selected = set(selected_ids)
        if not selected <= valid:
            raise WatermarkError("Lựa chọn không còn hợp lệ. Hãy phân tích lại.")
        for page_no, page in enumerate(pdf.pages, 1):
            paint = {int(i.split(':')[2]) for i in selected if i.startswith(f'{page_no}:paint:')}
            annots = {int(i.split(':')[2]) for i in selected if i.startswith(f'{page_no}:annot:')}
            text = {int(i.split(':')[2]) for i in selected if i.startswith(f'{page_no}:text:')}
            vector = {int(i.split(':')[2]) for i in selected if i.startswith(f'{page_no}:vector:')}
            if paint or text or vector:
                instructions = pikepdf.parse_content_stream(page)
                # Remove only this invocation, never mutate a shared XObject resource.
                text_shows = set()
                for block in text_candidates(instructions, page.obj.get('/Resources', {})):
                    if block['start'] in text:
                        text_shows.update(block['shows'])
                vector_paints = set()
                for group in vector_candidates(instructions, page.obj.get('/Resources', {})):
                    if group['start'] in vector:
                        vector_paints.update(group['paints'])
                kept = []
                for index, op in enumerate(instructions):
                    if index in vector_paints:
                        # Discard the path without painting. Keep graphics state,
                        # clipping, marked-content boundaries and all header text.
                        kept.append(pikepdf.ContentStreamInstruction([], pikepdf.Operator('n')))
                        continue
                    if index in paint:
                        continue
                    if index not in text_shows:
                        kept.append(op)
                    elif str(op.operator) == "'":
                        kept.append(pikepdf.ContentStreamInstruction([], pikepdf.Operator('T*')))
                    elif str(op.operator) == '"':
                        # The quote operator also sets spacing; preserve that state.
                        kept.extend([
                            pikepdf.ContentStreamInstruction([op.operands[0]], pikepdf.Operator('Tw')),
                            pikepdf.ContentStreamInstruction([op.operands[1]], pikepdf.Operator('Tc')),
                            pikepdf.ContentStreamInstruction([], pikepdf.Operator('T*')),
                        ])
                page.obj['/Contents'] = pdf.make_stream(pikepdf.unparse_content_stream(kept))
            if annots:
                page.obj['/Annots'] = pikepdf.Array([
                    a for index, a in enumerate(page.obj.get('/Annots', [])) if index not in annots
                ])
        pdf.remove_unreferenced_resources()
        output = io.BytesIO()
        pdf.save(output)
        return output.getvalue()
