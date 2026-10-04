"""Recover an interrupted batch into a new run, preserving all old artifacts.

The operator must first verify the old worker is stopped and archive its stale lock.
"""
import hashlib
import re
import shutil
import sys
from PIL import Image
from crypt_plan_style import ROOT, baseline, prepare_data, read, run, write
from run_records import record_event


def recover(source_id, confirmed_stopped=False):
    if not re.fullmatch('[a-f0-9]{32}', source_id):
        raise ValueError('Invalid run ID')
    if (ROOT / '.batch.lock').exists():
        raise ValueError('Worker lock exists; verify worker state before recovery')
    source = ROOT / source_id
    status = read(source, 'status.json')
    if status['status'] != 'failed' and not (confirmed_stopped and status['status'] == 'running'):
        raise ValueError('Only interrupted/failed runs can be recovered')
    parent, _, spec = baseline()
    if parent.name != status['parent_run_id'] or spec['hashes'] != read(source, 'sources.json')['hashes']:
        raise ValueError('Original parent or sources changed')
    rows = read(source, 'plan.json')
    reusable = []
    for row in rows:
        name = row['asset']
        if status['object_results'].get(name, {}).get('status') != 'ready':
            continue
        folder = source / name
        for file in ['flux-raw.png', 'generation.json', 'request-timing.json']:
            if not (folder / file).is_file():
                raise ValueError('Missing completed artifact: ' + name + '/' + file)
        with Image.open(folder / 'flux-raw.png') as image:
            image.verify()
        if read(folder, 'generation.json')['prompt'] != row['prompt']:
            raise ValueError('Saved prompt differs')
        if (source / f'{name}-original.png').read_bytes() != (parent / f'{name}-original.png').read_bytes():
            raise ValueError('Saved original differs')
        reusable.append(name)
    run_id = prepare_data(read(source, 'dsl.json'), rows)
    target = ROOT / run_id
    hashes = {}
    for name in reusable:
        shutil.copytree(source / name, target / name)
        hashes[name] = hashlib.sha256((target / name / 'flux-raw.png').read_bytes()).hexdigest()
    write(target, 'recovery.json', {'source_run_id': source_id, 'reused_assets': reusable, 'raw_sha256': hashes,
                                   'operator_confirmed_stopped': confirmed_stopped})
    record_event(target, 'interrupted_batch_recovered', source_run_id=source_id, reused_assets=reusable)
    print(run_id, flush=True)
    run(run_id)


if __name__ == '__main__':
    recover(sys.argv[1], confirmed_stopped='--confirmed-stopped' in sys.argv[2:])
