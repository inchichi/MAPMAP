"""Restore bundled results; use --apply to select them for the local editor."""
import argparse,hashlib,json,shutil,zipfile
from pathlib import Path

repo=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--apply',action='store_true')
args=parser.parse_args()
archive=repo/'public/experiments/crypt-winter-20260910/results.zip'
with zipfile.ZipFile(archive) as bundle:
    metadata=json.loads(bundle.read('bundle.json'))
    actual={}
    for name,expected in metadata['canonical_source_hashes'].items():
        path=(repo/name).resolve()
        if not path.is_relative_to(repo):raise ValueError('Invalid source path')
        data=path.read_bytes();actual[name]=hashlib.sha256(data).hexdigest()
        canonical=data.replace(b'\r\n',b'\n') if name.endswith(('.tmx','.tsx')) else data
        if hashlib.sha256(canonical).hexdigest()!=expected:raise ValueError('Source content changed: '+name)
    writes=[]
    for member in bundle.infolist():
        if not member.filename.startswith('runs/') or member.is_dir():continue
        relative=Path(member.filename).relative_to('runs')
        if relative.parts[0] not in metadata['runs']:raise ValueError('Unknown run')
        target=(repo/'public/theme-runs'/relative).resolve()
        if not target.is_relative_to(repo/'public/theme-runs'):raise ValueError('Invalid archive path')
        data=bundle.read(member)
        if target.exists() and target.read_bytes()!=data:
            raise ValueError('Existing experiment differs; refusing to overwrite: '+str(relative))
        writes.append((target,data))
    for target,data in writes:
        target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
    # Git normalizes XML line endings. Only verified line-ending differences
    # are permitted; retain archived metadata and adapt the runtime manifest.
    for run_id in metadata['runs']:
        path=repo/'public/theme-runs'/run_id/'crypt-manifest.json'
        manifest=json.loads(path.read_text(encoding='utf8'))
        manifest['source_hashes']=actual
        path.write_text(json.dumps(manifest),encoding='utf8')
    if args.apply:
        active=repo/'public/crypt-style/active.json';active.parent.mkdir(parents=True,exist_ok=True)
        backup=active.with_name('before-bundle-restore.json')
        if active.exists():
            if backup.exists():raise ValueError('Selection backup exists; refusing to overwrite it')
            shutil.copy2(active,backup)
        selected=repo/'public/theme-runs'/metadata['selected_run']/'crypt-manifest.json'
        active.write_bytes(selected.read_bytes())
print('Restored results. Open /editor.html?game=crypt&map=floor-0-town after starting Vite and theme:dev.')
