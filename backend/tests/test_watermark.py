import io
import unittest

import fitz
import pikepdf
from fastapi.testclient import TestClient

from routers.watermark import router
from fastapi import FastAPI
from services.watermark import WatermarkError, analyze, remove


def sample_pdf():
    doc = fitz.open()
    pix = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, 8, 8), False)
    pix.clear_with(80)
    image = pix.tobytes('png')
    for index in range(2):
        page = doc.new_page(width=300, height=400)
        page.insert_text((30, 40), 'Keep this text')
        page.insert_image(fitz.Rect(60, 100, 160, 150), stream=image)
        # Reuse the same image on the same page and on another page.
        page.insert_image(fitz.Rect(180, 220, 260, 260), stream=image)
        page.insert_link({'kind': fitz.LINK_URI, 'from': fitz.Rect(30, 30, 120, 45), 'uri': 'https://example.com'})
        page.add_stamp_annot(fitz.Rect(20, 300, 180, 350))
        if index:
            page.set_rotation(90)
    data = doc.tobytes()
    doc.close()
    return data


class WatermarkTests(unittest.TestCase):
    def setUp(self):
        self.data = sample_pdf()
        self.result = analyze(self.data)

    def test_remove_only_selected_image_invocation_and_preserve_document(self):
        candidate = next(c for c in self.result['candidates'] if c['kind'] == 'image')
        output = remove(self.data, self.result['fingerprint'], [candidate['id']])
        remaining = analyze(output)['candidates']
        self.assertEqual(sum(c['kind'] == 'image' for c in remaining), 3)
        with fitz.open(stream=self.data, filetype='pdf') as before, fitz.open(stream=output, filetype='pdf') as after:
            self.assertEqual(len(after), 2)
            self.assertEqual(after[1].rotation, 90)
            self.assertEqual(before[1].get_pixmap().samples, after[1].get_pixmap().samples)
            self.assertNotEqual(before[0].get_pixmap().samples, after[0].get_pixmap().samples)
            for index in range(2):
                self.assertEqual(before[index].get_text(), after[index].get_text())
                self.assertEqual(before[index].rect, after[index].rect)
                self.assertEqual(len(after[index].get_links()), 1)
            # The second occurrence of the shared image remains unchanged.
            clip = fitz.Rect(180, 220, 260, 260)
            self.assertEqual(before[0].get_pixmap(clip=clip).samples, after[0].get_pixmap(clip=clip).samples)

    def test_remove_stamp_without_removing_links(self):
        candidate = next(c for c in self.result['candidates'] if c['kind'] == 'annotation')
        output = remove(self.data, self.result['fingerprint'], [candidate['id']])
        with fitz.open(stream=output, filetype='pdf') as doc:
            self.assertEqual(list(doc[0].annots() or []), [])
            self.assertEqual(len(list(doc[1].annots())), 1)
            self.assertEqual(len(doc[0].get_links()), 1)

    def test_shared_form_is_removed_only_from_selected_page(self):
        with pikepdf.Pdf.open(io.BytesIO(self.data)) as pdf:
            form = pdf.make_stream(b'0.8 g 0 0 20 20 re f')
            form['/Type'] = pikepdf.Name('/XObject')
            form['/Subtype'] = pikepdf.Name('/Form')
            form['/BBox'] = pikepdf.Array([0, 0, 20, 20])
            for page in pdf.pages:
                page.obj['/Resources']['/XObject']['/WM'] = form
                page.contents_add(b'q 1 0 0 1 100 100 cm /WM Do Q')
            stream = io.BytesIO()
            pdf.save(stream)
        data = stream.getvalue()
        result = analyze(data)
        selected = next(c for c in result['candidates'] if c['kind'] == 'form')
        output = remove(data, result['fingerprint'], [selected['id']])
        with fitz.open(stream=data, filetype='pdf') as before, fitz.open(stream=output, filetype='pdf') as after:
            self.assertNotEqual(before[0].get_pixmap().samples, after[0].get_pixmap().samples)
            self.assertEqual(before[1].get_pixmap().samples, after[1].get_pixmap().samples)

    def test_reject_stale_or_forged_selections(self):
        for digest, ids in [('0' * 64, ['1:paint:0']), (self.result['fingerprint'], ['1:paint:99999']), (self.result['fingerprint'], [])]:
            with self.assertRaises(WatermarkError):
                remove(self.data, digest, ids)

    def test_malformed_encrypted_and_page_limit(self):
        with self.assertRaises(WatermarkError):
            analyze(b'%PDF broken')
        with pikepdf.Pdf.open(io.BytesIO(self.data)) as pdf:
            out = io.BytesIO()
            pdf.save(out, encryption=pikepdf.Encryption(owner='owner', user='password'))
        with self.assertRaises(WatermarkError):
            analyze(out.getvalue())
        pdf = pikepdf.Pdf.new()
        for _ in range(101):
            pdf.add_blank_page()
        out = io.BytesIO()
        pdf.save(out)
        with self.assertRaises(WatermarkError):
            analyze(out.getvalue())

    def test_tilted_and_faint_text_removed_without_changing_body(self):
        with pikepdf.Pdf.open(io.BytesIO(self.data)) as pdf:
            for page in pdf.pages:
                page.contents_add(b'q 0.8 g BT /helv 28 Tf 0.707 0.707 -0.707 0.707 60 90 Tm (SCHOOL WATERMARK) Tj ET Q')
            out = io.BytesIO()
            pdf.save(out)
        data = out.getvalue()
        result = analyze(data)
        text = [c for c in result['candidates'] if c['kind'] == 'text']
        self.assertEqual(len(text), 2)
        self.assertIn('SCHOOL WATERMARK', text[0]['label'])
        output = remove(data, result['fingerprint'], [text[0]['id']])
        with fitz.open(stream=data, filetype='pdf') as before, fitz.open(stream=output, filetype='pdf') as after:
            self.assertIn('SCHOOL WATERMARK', before[0].get_text())
            self.assertNotIn('SCHOOL WATERMARK', after[0].get_text())
            self.assertIn('Keep this text', after[0].get_text())
            self.assertEqual(before[1].get_pixmap().samples, after[1].get_pixmap().samples)
        self.assertEqual(sum(c['kind'] == 'text' for c in analyze(output)['candidates']), 1)

    def test_mixed_text_object_and_clipping_text_are_not_candidates(self):
        with pikepdf.Pdf.open(io.BytesIO(self.data)) as pdf:
            pdf.pages[0].contents_add(b'BT /helv 12 Tf 1 0 0 1 20 20 Tm (Keep body) Tj 0.8 g 1 0 0 1 20 60 Tm (Pale text) Tj ET')
            pdf.pages[0].contents_add(b'q BT /helv 24 Tf 7 Tr 0.707 0.707 -0.707 0.707 20 90 Tm (CLIPPING) Tj ET Q')
            out = io.BytesIO()
            pdf.save(out)
        self.assertFalse(any(c['kind'] == 'text' for c in analyze(out.getvalue())['candidates']))

    def test_text_state_preserved_for_next_text_object(self):
        with pikepdf.Pdf.open(io.BytesIO(self.data)) as pdf:
            pdf.pages[0].contents_add(b'0.8 g BT /helv 18 Tf 1 0 0 1 30 90 Tm (REMOVE ME) Tj ET 0 g BT 1 0 0 1 30 70 Tm (KEEP NEXT) Tj ET')
            out = io.BytesIO()
            pdf.save(out)
        data = out.getvalue()
        result = analyze(data)
        candidate = next(c for c in result['candidates'] if c['kind'] == 'text')
        output = remove(data, result['fingerprint'], [candidate['id']])
        with fitz.open(stream=data, filetype='pdf') as before, fitz.open(stream=output, filetype='pdf') as after:
            self.assertNotIn('REMOVE ME', after[0].get_text())
            self.assertIn('KEEP NEXT', after[0].get_text())
            clip = fitz.Rect(0, 320, 300, 340)
            self.assertEqual(before[0].get_pixmap(clip=clip).samples, after[0].get_pixmap(clip=clip).samples)

    def test_outlined_watermark_keeps_text_in_same_artifact(self):
        with pikepdf.Pdf.open(io.BytesIO(self.data)) as pdf:
            # A header contains BOTH outlined glyphs and real text.
            # Replacing the entire artifact would destroy the header.
            curves = b' '.join([b'20 20 m 25 20 25 25 30 30 c 35 35 35 40 40 40 c 35 45 30 45 25 40 c 20 35 20 30 20 20 c h f*'] * 6)
            pdf.pages[0].contents_add(b'/Artifact BMC q 0.8 g ' + curves + b' 0 g BT /helv 12 Tf 1 0 0 1 30 80 Tm (KEEP HEADER) Tj ET Q EMC')
            out = io.BytesIO()
            pdf.save(out)
        data = out.getvalue()
        result = analyze(data)
        vectors = [c for c in result['candidates'] if c['kind'] == 'vector']
        self.assertEqual(len(vectors), 1)
        output = remove(data, result['fingerprint'], [vectors[0]['id']])
        self.assertFalse(any(c['kind'] == 'vector' for c in analyze(output)['candidates']))
        with fitz.open(stream=data, filetype='pdf') as before, fitz.open(stream=output, filetype='pdf') as after:
            self.assertEqual(before[0].get_text('dict'), after[0].get_text('dict'))
            self.assertIn('KEEP HEADER', after[0].get_text())
            self.assertNotEqual(before[0].get_pixmap().samples, after[0].get_pixmap().samples)
            self.assertEqual(before[1].get_pixmap().samples, after[1].get_pixmap().samples)

    def test_unmarked_or_opaque_vector_is_not_suggested(self):
        with pikepdf.Pdf.open(io.BytesIO(self.data)) as pdf:
            curves = b' '.join([b'20 20 m 25 20 25 25 30 30 c 35 35 35 40 40 40 c 35 45 30 45 25 40 c 20 35 20 30 20 20 c h f*'] * 6)
            pdf.pages[0].contents_add(b'q 0.8 g ' + curves + b' Q /Artifact BMC q 0 g ' + curves + b' Q EMC')
            out = io.BytesIO()
            pdf.save(out)
        self.assertFalse(any(c['kind'] == 'vector' for c in analyze(out.getvalue())['candidates']))

    def test_endpoints_and_preview(self):
        import json
        app = FastAPI()
        app.include_router(router, prefix='/api/watermark')
        client = TestClient(app)
        files = {'file': ('test.pdf', self.data, 'application/pdf')}
        response = client.post('/api/watermark/analyze', files=files)
        self.assertEqual(response.status_code, 200)
        result = response.json()
        options = json.dumps(dict(fingerprint=result['fingerprint'], selected_ids=[result['candidates'][0]['id']]))
        preview = client.post('/api/watermark/preview', files=files, data={'options': options})
        self.assertEqual(preview.status_code, 200, preview.text)
        self.assertNotEqual(preview.json()['before'], preview.json()['after'])
        response = client.post('/api/watermark/remove', files=files, data={'options': options})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['content-type'], 'application/pdf')
        self.assertEqual(client.post('/api/watermark/remove', files=files, data={'options': '{}'}).status_code, 422)
        self.assertEqual(client.post('/api/watermark/analyze', files={'file': ('bad.pdf', b'broken')}).status_code, 400)


if __name__ == '__main__':
    unittest.main()
