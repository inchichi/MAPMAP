"""Restore the archived first-floor result without overwriting experiments."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import tempfile
import uuid
import zipfile

from PIL import Image

MAP = 'floor-1-ruins'
ARCHIVE = 'public/experiments/crypt-ruins-winter-20260910/results.zip'
SOURCES = {f'public/crypt-maps/{MAP}.tmx',
           'src/games/crypt-crawler/assets/tilesets/ninja-dungeon-16.tsx',
           'src/games/crypt-crawler/assets/tilesets/ninja-dungeon-16.png'}


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf8')


def verified_hashes(repo, expected):
    if set(expected) != SOURCES:
        raise ValueError('Unexpected source list')
    actual = {}
    for name, digest in expected.items():
        path = (repo / name).resolve()
        if not path.is_relative_to(repo):
            raise ValueError('Source escapes repository')
        data = path.read_bytes()
        variants = [data]
        if path.suffix in {'.tmx', '.tsx'}:
            lf = data.replace(b'\r\n', b'\n')
            variants += [lf, lf.replace(b'\n', b'\r\n')]
        if not any(hashlib.sha256(v).hexdigest() == digest for v in variants):
            raise ValueError('Source content changed: ' + name)
        actual[name] = hashlib.sha256(data).hexdigest()
    return actual


def restore(repo, archive, apply=False):
    repo = repo.resolve()
    root = repo / 'public/theme-runs'
    selection = repo / f'public/crypt-style/active-{MAP}.json'
    if not root.resolve().is_relative_to(repo) or not selection.resolve().is_relative_to(repo):
        raise ValueError('Runtime paths escape repository')
    if not zipfile.is_zipfile(archive):
        raise ValueError('Results ZIP unavailable. Run git lfs pull first.')
    # Validate and stage everything before changing any saved run or selection.
    with tempfile.TemporaryDirectory(prefix='crypt-ruins-restore-') as temporary:
        stage = Path(temporary)
        with zipfile.ZipFile(archive) as bundle:
            selected = json.loads(bundle.read('selected-manifest.json'))
            if selected['mapId'] != MAP or not re.fullmatch('[a-f0-9]{32}', selected['id']):
                raise ValueError('Invalid selected map/run')
            actual = verified_hashes(repo, selected['source_hashes'])
            runs, seen = set(), set()
            for member in bundle.infolist():
                if not member.filename.startswith('runs/') or member.is_dir():
                    continue
                relative = PurePosixPath(member.filename).parts[1:]
                if (len(relative) < 2 or not re.fullmatch('[a-f0-9]{32}', relative[0])
                        or any(p in {'.', '..'} or ':' in p or '\\' in p for p in relative)):
                    raise ValueError('Unsafe archive path')
                if member.filename in seen:
                    raise ValueError('Duplicate archive entry')
                seen.add(member.filename)
                runs.add(relative[0])
                path = stage.joinpath(*relative)
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(bundle.read(member))
            if selected['id'] not in runs:
                raise ValueError('Selected run missing')
            for run in runs:
                folder = stage / run
                manifest = json.loads((folder / 'crypt-manifest.json').read_bytes())
                sources = json.loads((folder / 'sources.json').read_bytes())
                status = json.loads((folder / 'status.json').read_bytes())
                if (manifest['id'] != run or manifest['mapId'] != MAP or sources['mapId'] != MAP
                        or sources['hashes'] != manifest['source_hashes'] or status['status'] != 'ready'
                        or manifest['source_hashes'] != selected['source_hashes']
                        or manifest['overlay'] != f'/theme-runs/{run}/decoration-map.png'):
                    raise ValueError('Run contract mismatch: ' + run)
                if run == selected['id'] and manifest != selected:
                    raise ValueError('Selection differs from archived manifest')
                with Image.open(folder / 'decoration-map.png') as image:
                    if image.mode != 'RGBA' or image.size != (manifest['width'], manifest['height']):
                        raise ValueError('Overlay dimensions/alpha mismatch')
                    image.verify()
                if (sources['width'] * sources['tile_size'], sources['height'] * sources['tile_size']) != (manifest['width'], manifest['height']):
                    raise ValueError('Source dimensions mismatch')
                # Retain archive metadata when adapting only Git line endings.
                if actual != manifest['source_hashes']:
                    for filename in ('crypt-manifest.json', 'sources.json'):
                        shutil.copyfile(folder / filename, folder / ('archived-' + filename))
                    manifest['source_hashes'] = actual
                    sources['hashes'] = actual
                    (folder / 'crypt-manifest.json').write_bytes(encoded(manifest))
                    (folder / 'sources.json').write_bytes(encoded(sources))
            for path in stage.rglob('*'):
                if not path.is_file():
                    continue
                target = root / path.relative_to(stage)
                if not target.resolve().is_relative_to(root.resolve()):
                    raise ValueError('Destination escapes run directory')
                if target.exists() and target.read_bytes() != path.read_bytes():
                    raise ValueError('Existing experiment differs; refusing overwrite: ' + str(target))
            for path in stage.rglob('*'):
                if path.is_file():
                    target = root / path.relative_to(stage)
                    if not target.exists():
                        target.parent.mkdir(parents=True, exist_ok=True)
                        with target.open('xb') as output:
                            output.write(path.read_bytes())
            if apply:
                payload = (root / selected['id'] / 'crypt-manifest.json').read_bytes()
                selection.parent.mkdir(parents=True, exist_ok=True)
                if not selection.exists() or selection.read_bytes() != payload:
                    if selection.exists():
                        backup = selection.with_name(f'before-ruins-restore-{uuid.uuid4().hex}.json')
                        shutil.copyfile(selection, backup)
                    pending = selection.with_name(f'active-{MAP}-{uuid.uuid4().hex}.tmp')
                    pending.write_bytes(payload)
                    pending.replace(selection)
    return selected['id']


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='Select restored result for the first floor only')
    args = parser.parse_args()
    repository = Path(__file__).resolve().parents[1]
    run_id = restore(repository, repository / ARCHIVE, args.apply)
    print(f'Restored {run_id}; selected={args.apply}')
    print('Open /editor.html?game=crypt&map=floor-1-ruins with Vite and theme:dev running.')
