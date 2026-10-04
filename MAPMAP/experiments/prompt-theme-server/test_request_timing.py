import io,json,tempfile,unittest
from pathlib import Path
from unittest.mock import Mock,patch
from PIL import Image
from object_decorations import request_image

class RequestTimingTests(unittest.TestCase):
    def test_success_records_request_duration(self):
        image=Image.new('RGB',(4,4));buffer=io.BytesIO();image.save(buffer,format='PNG')
        response=Mock(content=buffer.getvalue())
        with tempfile.TemporaryDirectory() as temp,patch('object_decorations.requests.post',return_value=response):
            folder=Path(temp);request_image(folder,image,'test','http://unused',1)
            timing=json.loads((folder/'request-timing.json').read_text(encoding='utf8'))
            self.assertGreaterEqual(timing['generation_seconds'],0)
            self.assertGreaterEqual(timing['finished_at'],timing['started_at'])

    def test_failure_still_records_duration(self):
        with tempfile.TemporaryDirectory() as temp,patch('object_decorations.requests.post',side_effect=RuntimeError('test failure')):
            folder=Path(temp)
            with self.assertRaises(RuntimeError):request_image(folder,Image.new('RGB',(4,4)),'test','http://unused',1)
            self.assertTrue((folder/'request-timing.json').exists())

if __name__=='__main__':unittest.main()
