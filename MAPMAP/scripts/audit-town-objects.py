"""Inspect TMX object bounds against extraction profiles and actual tile families."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'experiments/prompt-theme-server'))
from theme_pipeline import catalog,sources
from profile_decorations import profiles
from town_attached_materials import isolate
from PIL import Image,ImageDraw

out=Path(__file__).resolve().parents[1]/'output/town-object-audit'
out.mkdir(parents=True,exist_ok=True)
objects=catalog();settings=profiles()
sheet=Image.new('RGB',(1000,((len(objects)+4)//5)*220),'#30343d');draw=ImageDraw.Draw(sheet)
for i,obj in enumerate(objects):
    try:image=isolate(obj)
    except ValueError as error:
        print('EMPTY',str(error));image=Image.new('RGBA',(32,32))
    image.thumbnail((184,178),Image.Resampling.NEAREST)
    x=(i%5)*200;y=(i//5)*220
    sheet.paste(image,(x,y+25),image);draw.text((x+2,y+2),obj['id'],fill='white')
    if obj['id'] in settings and settings[obj['id']]['box']!=obj['box']:
        print('MISMATCH',obj['id'],obj['box'],settings[obj['id']]['box'])
    print(obj['id'],obj['category'],obj['box'])
sheet.save(out/'objects.png')
