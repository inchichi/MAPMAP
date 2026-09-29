"""Map-local building annotations and complete reusable tree tile stamps."""
import json
import re
from theme_pipeline import sources,REPO


def catalog(map_id):
    m,_,_,_=sources(map_id)
    w=int(m.get('width'));tw=int(m.get('tilewidth'));th=int(m.get('tileheight'))
    objects=[{'id':o.get('name'),'category':'building','mapId':map_id,
              'box':[int(float(o.get(k,0))) for k in ('x','y','width','height')]}
             for o in m.findall('.//object') if o.get('type')=='building']
    stamps={'town_tree':[[326,327,328],[334,335,336],[342,343,344],[350,351,352]]}
    gids=json.loads((REPO/'scripts/lpc-cave-gids.json').read_text(encoding='utf8'))
    groups={}
    for name,gid in gids.items():
        match=re.fullmatch(r'(town_prop_tree_\w+)_r(\d+)c(\d+)',name)
        if match:groups.setdefault(match[1],{})[(int(match[3]),int(match[2]))]=gid
    for name,cells in groups.items():
        stamps[name]=[[cells[(x,y)] for x in range(max(p[0] for p in cells)+1)] for y in range(max(p[1] for p in cells)+1)]
    layers={l.get('name'):[int(v) for v in l.find('data').text.replace('\n','').split(',') if v.strip()] for l in m.findall('layer')}
    for name,grid in stamps.items():
        offsets={g:(x,y) for y,row in enumerate(grid) for x,g in enumerate(row)}
        origins={(i%w-offsets[g][0],i//w-offsets[g][1]) for layer in ('object','object_upper') for i,g in enumerate(layers[layer]) if g in offsets}
        for x,y in sorted(origins):
            complete=all(0<=x+dx<w and 0<=y+dy<int(m.get('height')) and
                       layers['object' if dy==len(grid)-1 else 'object_upper'][(y+dy)*w+x+dx]==gid
                       for dy,row in enumerate(grid) for dx,gid in enumerate(row))
            objects.append({'id':f'{name}-{x}-{y}','category':'tree','mapId':map_id,
                            'box':[x*tw,y*th,len(grid[0])*tw,len(grid)*th],'tile_gids':list(offsets),'complete_stamp':complete})
    return objects
