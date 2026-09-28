import hashlib,json,tempfile,unittest
from unittest.mock import patch
from pathlib import Path
import numpy as np
from PIL import Image,ImageFilter
from crypt_full_style import extract_material
from crypt_apply import publish
from crypt_ruins_style import winter_surface, layer_tile

class CryptStyleTest(unittest.TestCase):
    def test_shadow_layer_keeps_tmx_opacity(self):
        source=Image.new('RGBA',(16,16),(0,0,0,255))
        shadow=layer_tile(source,.18)
        self.assertEqual(shadow.getpixel((0,0))[3],46)
        self.assertEqual(source.getpixel((0,0))[3],255)
        base=Image.new('RGBA',(16,16),(220,230,240,255))
        self.assertGreater(Image.alpha_composite(base,shadow).getpixel((0,0))[0],175)

    def test_ruins_materials_keep_size_alpha_and_original_shading(self):
        source=Image.new('RGBA',(16,16),(150,120,80,255))
        source.putpixel((0,0),(0,0,0,0))
        source.putpixel((1,1),(20,20,20,255))
        for kind in ['ground','wall','ground_deco']:
            result=winter_surface(source,Image.new('RGB',(96,96),'white'),kind)
            self.assertEqual(result.size,source.size)
            self.assertTrue(np.array_equal(np.array(result)[:,:,3],np.array(source)[:,:,3]))
            self.assertLess(sum(result.getpixel((1,1))[:3]),sum(result.getpixel((2,2))[:3]))

    def test_ruins_selection_does_not_replace_town(self):
        with tempfile.TemporaryDirectory() as directory:
            repo=Path(directory);folder=repo/('b'*32);folder.mkdir()
            target=repo/'public/crypt-style';target.mkdir(parents=True)
            town=target/'active.json';town.write_text('{"id":"town-preserved"}')
            names=['public/crypt-maps/floor-1-ruins.tmx','src/games/crypt-crawler/assets/tilesets/ninja-dungeon-16.tsx','src/games/crypt-crawler/assets/tilesets/ninja-dungeon-16.png']
            hashes={}
            for name in names:
                path=repo/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(b'original');hashes[name]=hashlib.sha256(b'original').hexdigest()
            manifest={'id':folder.name,'mapId':'floor-1-ruins','source_hashes':hashes,'width':16,'height':16,'overlay':f'/theme-runs/{folder.name}/decoration-map.png','instances':1}
            (folder/'crypt-manifest.json').write_text(json.dumps(manifest))
            (folder/'status.json').write_text(json.dumps({'status':'ready'}))
            Image.new('RGBA',(16,16)).save(folder/'decoration-map.png')
            result=publish(repo,folder)
            self.assertEqual(result['editorUrl'],'/editor.html?game=crypt&map=floor-1-ruins')
            self.assertEqual(json.loads(town.read_text())['id'],'town-preserved')
            self.assertEqual(json.loads((target/'active-floor-1-ruins.json').read_text())['id'],folder.name)
            with self.assertRaisesRegex(ValueError,'다른 결과'):
                publish(repo,folder,expected_active_id='outdated')
            publish(repo,folder,expected_active_id=folder.name)
            self.assertEqual(len(list((target/'selection-history').glob('*.json'))),1)
            manifest['mapId']='../../outside'
            (folder/'crypt-manifest.json').write_text(json.dumps(manifest))
            with self.assertRaises(ValueError):publish(repo,folder)

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
            manifest['source_hashes']={name.replace('/','\\'):digest for name,digest in hashes.items()}
            (folder/'crypt-manifest.json').write_text(json.dumps(manifest))
            self.assertTrue(publish(repo,folder)['saved'])
            applied=json.loads((repo/'public/crypt-style/active.json').read_text())
            self.assertEqual(applied['source_hashes'],hashes)
            with patch('pathlib.Path.replace',side_effect=PermissionError('simulated watcher lock')),patch('crypt_apply.time.sleep'):
                self.assertTrue(publish(repo,folder)['saved'])
            self.assertEqual(json.loads((repo/'public/crypt-style/active.json').read_text())['id'],folder.name)
            (repo/names[0]).write_bytes(b'changed')
            with self.assertRaises(ValueError):publish(repo,folder)

if __name__=='__main__':unittest.main()
