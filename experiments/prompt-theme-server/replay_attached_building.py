"""Replay the recorded building-only FLUX input before manual material placement."""
import hashlib, json, sys, time, uuid
from pathlib import Path
import numpy as np
from PIL import Image
from theme_pipeline import ROOT, FLUX, layers, save_status
from object_decorations import request_image

PROMPT='Add Christmas bulb strings along roof edges, a wreath above the door, and snow caps on roof and window ledges. Keep every door, window, building shape and position unchanged. Pixel art, gray background, no cast shadows.'


def main(reference):
    folder=ROOT/uuid.uuid4().hex;folder.mkdir()
    original=Image.open(reference/'original.png').convert('RGBA')
    world,_,_,hashes=layers({'gain':[1,1,1],'bias':[0,0,0]})
    ref=np.array(original);crop=np.array(world.crop((544,32,1056,512)))
    assert original.size==(512,480)
    assert np.array_equal(ref[ref[:,:,3]>0],crop[ref[:,:,3]>0]),'Reference no longer matches TMX source pixels'
    original.save(folder/'building-original.png');world.save(folder/'original-map.png')
    source=Image.new('RGB',original.size,'#808080');source.paste(original,mask=original.getchannel('A'))
    data={'id':folder.name,'status':'running','stage':4,'created':time.time(),'prompt':PROMPT,
          'pipeline':'attached-material-placement-v1','current_object':'town_hall','completed_objects':0,'total_objects':1}
    save_status(folder,data);print('RUN '+folder.name,flush=True)
    (folder/'source.json').write_text(json.dumps({'reference':str(reference),'input_rgba_sha256':hashlib.sha256(original.tobytes()).hexdigest(),
        'source_hashes':hashes,'box':[544,32,512,480],'source_pixels_verified':True},indent=2),encoding='utf8')
    Image.open(reference/'flux-attached.png').save(folder/'previous-flux.png')
    try:
        request_image(folder,source,PROMPT,FLUX,1.0,pipeline=data['pipeline'])
        data.update(status='awaiting_review',stage=5)
    except Exception as e:data.update(status='failed',error=str(e))
    save_status(folder,data);print(json.dumps(data),flush=True)


if __name__=='__main__':main(Path(sys.argv[1]))
