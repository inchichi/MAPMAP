"""Town-specific additions; split TMX labels are owned by their parent sprite."""
from copy import deepcopy

PARTS = {'lamp_1':'tree_1','lamp_2':'clock_tower','lamp_4':'tree_2','lamp_14':'tree_3',
         'prop_1':'tree_1','prop_6':'clock_tower','prop_7':'clock_tower','prop_9':'tree_3'}


def extend_town_profiles(result):
    for name,base,box in [
        ('tree_2','tree_1',[480,1120,96,128]),('tree_3','tree_1',[0,1280,96,128]),
        ('fountain_2','fountain_1',[928,416,96,96]),
        ('market_tent','blacksmith_stall',[992,1024,192,160])]:
        p=deepcopy(result[base]);p.update(box=box,label=name)
        if name=='market_tent':
            p.update(canvas=[512,384],offset=[64,32],snow_rect=[0,0,192,10],wire_rect=[0,87,192,108],protected_rects=[[0,110,192,160]])
        result[name]=p
    for name,box,kind in [
        ('southwest_house',[416,960,160,288],'building'),('clock_tower',[832,1024,96,160],'building'),
        ('lamp_3',[640,1088,96,96],'lamp'),
        *[(f'lamp_{i}',[128+(i-5)*160,1312,64,96],'lamp') for i in range(5,14)],
        ('flower_1',[736,320,32,32],'flower box'),('flower_2',[832,320,32,32],'flower box'),
        ('flower_3',[448,1120,32,32],'flower box'),('flower_4',[1568,1376,32,32],'flower pot'),
        ('prop_2',[544,416,32,96],'flower pots'),('prop_3',[672,416,32,96],'flower pots'),
        ('prop_4',[1024,416,32,96],'flower pots'),('prop_5',[896,480,32,32],'flower pot'),
        ('prop_8',[416,1216,32,32],'flower pot')]:
        w,h=box[2:];scale=2 if h>160 else 3
        canvas=[max(320,w*scale+64),max(320,h*scale+64)]
        result[name]={'box':box,'kind':kind,'label':name,'mode':'attached','surface_profile':True,
            'canvas':canvas,'scale':scale,'offset':[(canvas[0]-w*scale)//2,(canvas[1]-h*scale)//2],
            'strength':.5,'protected_rects':[], 'supported':['snow','lights','garland'],
            'placement_prompt':'thin snow caps and small warm bulb strings on the roof or upper surfaces only. Keep all doors, windows, clock face, stems and supports unchanged'}
    return result
