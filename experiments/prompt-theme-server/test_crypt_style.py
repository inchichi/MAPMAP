import hashlib,json,tempfile,unittest
from unittest.mock import patch
from pathlib import Path
import numpy as np
from PIL import Image,ImageFilter
from crypt_full_style import extract_material
from crypt_apply import publish

class CryptStyleTest(unittest.TestCase):
    def test_material_extracted_without_changing_footprint_or_door(self):
        source=Image.new('RGBA',(64,48),(80,60,50,255))
        generated=Image.new('RGB',(384,288),(235,235,235))
        result=extract_material(source,generated,'house')
        self.assertEqual(result.size,source.size)
        self.assertGreater(np.array(result)[:20,:,3].sum(),0)
        self.assertEqual(np.array(result)[29:,:,3].sum(),0)

    def test_empty_source_cannot_receive_background(self):
        source=Image.new('RGBA',(32,32),(0,0,0,0))
        result=extract_material(source,Image.new('RGB',(192,192),'white'),'tree')
        self.assertIsNone(result.getbbox())

    def test_snow_cap_is_bounded_to_two_pixels_and_same_canvas(self):
        source=Image.new('RGBA',(32,32));source.paste((30,90,20,255),(8,8,24,24))
        result=extract_material(source,Image.new('RGB',(192,192),'white'),'tree')
        alpha=np.array(result)[:,:,3]
        self.assertEqual(result.size,source.size)
        self.assertTrue(np.all(alpha<=np.array(source.getchannel('A').filter(ImageFilter.MaxFilter(5)))))
        self.assertGreater(alpha[6:8].sum(),0)

    def test_publish_blocks_unreviewed_and_changed_source(self):
        with tempfile.TemporaryDirectory() as directory:
            repo=Path(directory);folder=repo/('a'*32);folder.mkdir()
            status=folder/'status.json';status.write_text(json.dumps({'status':'running'}))
            with self.assertRaises(ValueError):publish(repo,folder)
            status.write_text(json.dumps({'status':'ready'}))
            names=['public/crypt-maps/floor-0-town.tmx','src/games/crypt-crawler/assets/tilesets/ninja-dungeon-16.tsx','src/games/crypt-crawler/assets/tilesets/ninja-dungeon-16.png']
            hashes={}
            for name in names:
                path=repo/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(b'original');hashes[name]=hashlib.sha256(b'original').hexdigest()
            manifest={'id':folder.name,'mapId':'floor-0-town','source_hashes':hashes,'width':16,'height':16,'overlay':f'/theme-runs/{folder.name}/decoration-map.png','instances':1}
            (folder/'crypt-manifest.json').write_text(json.dumps(manifest))
            Image.new('RGBA',(16,16)).save(folder/'decoration-map.png')
            self.assertTrue(publish(repo,folder)['saved'])
            with patch('pathlib.Path.replace',side_effect=PermissionError('simulated watcher lock')),patch('crypt_apply.time.sleep'):
                self.assertTrue(publish(repo,folder)['saved'])
            self.assertEqual(json.loads((repo/'public/crypt-style/active.json').read_text())['id'],folder.name)
            (repo/names[0]).write_bytes(b'changed')
            with self.assertRaises(ValueError):publish(repo,folder)

if __name__=='__main__':unittest.main()
