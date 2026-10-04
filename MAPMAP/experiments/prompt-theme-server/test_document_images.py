import base64
import io
import json
import unittest
import zipfile
from PIL import Image
from document_images import analyze_images
from document_planner import extract_document, validate_requirements


def fixture(external=False):
    png=io.BytesIO();Image.new('RGB',(4,4),'orange').save(png,format='PNG')
    stream=io.BytesIO()
    with zipfile.ZipFile(stream,'w') as z:
        z.writestr('word/document.xml','''<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:p><w:r><w:t>Map exterior reference</w:t></w:r></w:p><w:p><w:r><a:blip r:embed="rId1"/></w:r></w:p><w:p><w:r><w:t>No candy baskets</w:t></w:r></w:p></w:body></w:document>''')
        mode=' TargetMode="External"' if external else ''
        z.writestr('word/_rels/document.xml.rels',f'<Relationships><Relationship Id="rId1" Target="media/p.png"{mode}/></Relationships>')
        z.writestr('word/media/p.png',png.getvalue())
    return base64.b64encode(stream.getvalue())


class ImageTests(unittest.TestCase):
    def test_context_and_bytes_extracted(self):
        doc=extract_document(fixture())
        self.assertEqual(doc['image_count'],1)
        self.assertEqual(doc['images'][0]['context_ids'],['p1','p2'])
        self.assertTrue(doc['images'][0]['data_base64'])

    def test_external_image_is_not_fetched(self):
        with self.assertRaises(ValueError):extract_document(fixture(True))

    def test_truncated_json_retries_same_image_once(self):
        calls=[]
        def infer(prompt,image,max_tokens):
            calls.append(image.size)
            if len(calls)==1:raise json.JSONDecodeError('truncated','{',1)
            return dict(scope='map',map_reference=True,observations='Pumpkin',map_observations='Pumpkin',reason='Reference',uncertainties=None), 'raw'
        result=analyze_images(infer,extract_document(fixture()),lambda *a:None)
        self.assertEqual(calls,[(4,4),(4,4)])
        self.assertTrue(result['image_analysis_complete'])

    def test_image_reaches_vision_and_only_map_evidence_reaches_planner(self):
        for scope in ('map','ui','mixed','unknown'):
            seen=[]
            def infer(prompt,image,max_tokens):
                seen.append(image.size)
                self.assertIn('No candy baskets',prompt)
                return dict(scope=scope,map_reference=True,observations='Pumpkin',map_observations='One pumpkin',reason='Map reference',uncertainties=''), 'raw'
            doc=analyze_images(infer,extract_document(fixture()),lambda *a:None)
            self.assertEqual(seen,[(4,4)])
            self.assertNotIn('images',doc)
            self.assertEqual(len(doc['blocks']),3 if scope=='map' else 2)
            self.assertTrue(doc['image_analysis_complete'])

    def test_image_only_evidence_requires_context(self):
        doc={'blocks':[{'id':'p1','text':'Map reference'},{'id':'img1','type':'visual-evidence','context_ids':['p1'],'text':'Pumpkin'}]}
        r={'evidence':['img1'],'text':'Add pumpkin','targets':['prop'],'operation':'decoration'}
        with self.assertRaises(ValueError):validate_requirements(doc,[r])
        r['evidence'].append('p1');validate_requirements(doc,[r])

if __name__=='__main__':unittest.main()
