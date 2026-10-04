"""Lossless snapshot of every local run and selection; never delete originals."""
import argparse, hashlib, json, time, uuid, zipfile
from pathlib import Path

repo=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args()
root=repo/'public/theme-runs'
if (root/'.batch.lock').exists():raise SystemExit('Generation is running; archive after completion.')
files=sorted(p for base in [root,repo/'public/crypt-style'] for p in base.rglob('*') if p.is_file())
for path in files:
    if path.name=='status.json' and json.loads(path.read_text(encoding='utf8')).get('status') in ('queued','running'):
        raise SystemExit('Unfinished run: '+str(path.parent))
args.output.mkdir(parents=True,exist_ok=True)
archive=args.output/(time.strftime('theme-runs-%Y%m%d-%H%M%S-')+uuid.uuid4().hex[:8]+'.zip')
index={}
with zipfile.ZipFile(archive,'x',compression=zipfile.ZIP_DEFLATED) as bundle:
    for path in files:
        data=path.read_bytes();name=path.relative_to(repo).as_posix()
        index[name]={'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)}
        bundle.writestr(name,data)
    bundle.writestr('archive-index.json',json.dumps(index,ensure_ascii=False,indent=2))
with zipfile.ZipFile(archive) as bundle:
    for name,entry in index.items():
        if hashlib.sha256(bundle.read(name)).hexdigest()!=entry['sha256']:raise RuntimeError('Archive verification failed')
        if hashlib.sha256((repo/name).read_bytes()).hexdigest()!=entry['sha256']:raise RuntimeError('Source changed during archive; retry')
print(json.dumps({'archive':str(archive),'files':len(files),'bytes':archive.stat().st_size,'verified':True}))
