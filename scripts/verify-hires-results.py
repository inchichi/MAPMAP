"""Read-only checks for completed high-resolution Crypt manifests."""
import hashlib,json,sys
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
for rid in sys.argv[1:]:
    folder=root/'public/theme-runs'/rid
    status=json.loads((folder/'status.json').read_text(encoding='utf8'))
    assert status['status']=='ready' and status['completed_objects']==status['total_objects']
    m=json.loads((folder/'crypt-manifest.json').read_text(encoding='utf8'))
    assert all(hashlib.sha256((root/p).read_bytes()).hexdigest()==h for p,h in m['source_hashes'].items())
    for item in m['hires']:
        im=Image.open(folder/item['asset']/'decoration.png')
        assert im.mode=='RGBA' and im.size==(item['width']*item['textureScale'],item['height']*item['textureScale'])
        assert all(x<m['width'] and y<m['height'] and x+item['width']>0 and y+item['height']>0 for x,y in item['positions'])
    print(rid, len(m['hires']), 'source hashes / RGBA / texture scale / map intersection: OK')
