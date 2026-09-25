import json,tempfile,unittest
from pathlib import Path
from PIL import Image
from ruins_composition import compose


class CompositionTests(unittest.TestCase):
    def test_replace_margin_without_stacking_and_clip_map_edges(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);base='a'*32;first='b'*32;second='c'*32
            (root/base).mkdir()
            Image.new('RGBA',(8,8),(20,30,40,255)).save(root/base/'decoration-map.png')
            (root/base/'crypt-manifest.json').write_text(json.dumps({'bulbs':[[7,7]]}))
            for run,color,size,offset in [(first,(255,255,255,255),(8,8),-3),(second,(255,0,0,255),(2,2),0)]:
                folder=root/run/'prop-00';folder.mkdir(parents=True)
                Image.new('RGBA',size,color).save(folder/'composite.png')
                (folder/'placement.json').write_text(json.dumps({'x':offset,'y':offset,'twinkle':False}))
            spec={'instances':[{'asset':'prop-00','x':0,'y':0}]}
            old,_,_=compose(root,{'id':base},spec,{'prop-00':first})
            self.assertEqual(old.getpixel((4,4)),(229,229,229,255))
            current,bulbs,_=compose(root,{'id':first,'composition_base_id':base},spec,{'prop-00':second})
            self.assertEqual(current.getpixel((4,4)),(20,30,40,255))
            self.assertEqual(current.getpixel((0,0)),(229,0,0,255))
            self.assertEqual(bulbs,[[7,7]])


if __name__=='__main__':unittest.main()
