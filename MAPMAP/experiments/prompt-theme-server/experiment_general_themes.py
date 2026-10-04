"""Nine fixed-condition edits; preserve outputs and never apply to the game."""
import json
import time
import uuid
from pathlib import Path
from dsl_general import parse
from planner import build
from crypt_plan_style import baseline, prepare_data, run


def main():
    root=Path(__file__).resolve().parents[2]/'public/theme-runs'
    if (root/'.batch.lock').exists(): raise RuntimeError('Another generation owns the lock')
    parent,manifest,sources=baseline()
    folder=root/('benchmark-'+uuid.uuid4().hex)
    folder.mkdir()
    prompts={
        'christmas':'Christmas: add small snow caps and tiny warm decorative bulbs. Preserve original colors and structure.',
        'halloween':'Halloween: add tiny attached pumpkin ornaments and fine cobwebs. Preserve original colors and structure.',
        'underwater':'Underwater: add tiny attached purple coral and blue barnacle ornaments. Preserve original colors and structure.'}
    assets=['prop-00','prop-15','prop-24']
    record={'id':folder.name,'parent':parent.name,'assets':assets,'status':'running','runs':[],
            'seed_control':'Service-selected; not a controlled seed comparison',
            'scope':'Three source groups, three themes, same model/settings/postprocessor; no automatic application'}
    def save(): (folder/'experiment.json').write_text(json.dumps(record,indent=2),encoding='utf8')
    save()
    print(str(folder),flush=True)
    try:
        for theme,prompt in prompts.items():
            dsl=parse(prompt,'floor-1-ruins')
            rows=[row for row in build(dsl,sources) if row['asset'] in assets]
            if len(rows)!=len(assets): raise ValueError('Missing comparison source')
            run_id=prepare_data(dsl,rows)
            entry={'theme':theme,'id':run_id,'started':time.time(),'status':'running'}
            record['runs'].append(entry);save();print(json.dumps(entry),flush=True)
            run(run_id)
            entry.update(status='ready',seconds=time.time()-entry['started']);save()
        record['status']='ready'
    except Exception as error:
        record.update(status='failed',error=str(error))
        raise
    finally: save()


if __name__=='__main__': main()
