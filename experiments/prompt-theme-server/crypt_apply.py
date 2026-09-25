"""Publish a validated visual-only Crypt overlay without modifying source assets."""
import hashlib, json, shutil, time
from PIL import Image
from run_records import record_event

def publish(repo, folder):
    status=json.loads((folder/'status.json').read_text(encoding='utf8'))
    if status['status']!='ready': raise ValueError('검수 완료된 Crypt 결과만 적용할 수 있습니다.')
    manifest=json.loads((folder/'crypt-manifest.json').read_text(encoding='utf8'))
    map_id=manifest['mapId']
    if map_id not in {'floor-0-town','floor-1-ruins'} or manifest['id']!=folder.name:
        raise ValueError('Crypt 맵 계약 불일치')
    if status.get('pipeline') == 'crypt-ruins-plan-v1':
        from contracts import check_folder
        report = check_folder(folder)
        if len(report) < 6 or any(report.values()): raise ValueError('통합 계약 검증 실패')
        validation = json.loads((folder/'validation.json').read_text(encoding='utf8'))
        if validation.get('all_variant_alpha_preserved') is not True: raise ValueError('알파 검증 실패')
        current = json.loads((repo/f'public/crypt-style/active-{map_id}.json').read_text(encoding='utf8'))
        if current['id'] not in (manifest['parent_run_id'], manifest['id']):
            raise ValueError('생성 이후 적용 맵이 바뀌었습니다. 최신 결과에서 다시 시작해주세요.')
    expected={f'public/crypt-maps/{map_id}.tmx','src/games/crypt-crawler/assets/tilesets/ninja-dungeon-16.tsx','src/games/crypt-crawler/assets/tilesets/ninja-dungeon-16.png'}
    if set(manifest['source_hashes'])!=expected: raise ValueError('원본 검증 목록 불일치')
    for name,digest in manifest['source_hashes'].items():
        if hashlib.sha256((repo/name).read_bytes()).hexdigest()!=digest: raise ValueError('원본 변경: '+name)
    with Image.open(folder/'decoration-map.png') as image:
        if image.mode!='RGBA' or image.size!=(manifest['width'],manifest['height']): raise ValueError('레이어 크기/투명도 불일치')
    if manifest['overlay']!=f'/theme-runs/{folder.name}/decoration-map.png': raise ValueError('레이어 경로 불일치')
    target=repo/'public/crypt-style';target.mkdir(exist_ok=True)
    active=target/('active.json' if map_id=='floor-0-town' else f'active-{map_id}.json')
    if active.exists(): shutil.copy2(active,folder/'previous-active.json')
    pending=active.with_suffix('.tmp');payload=json.dumps(manifest);pending.write_text(payload,encoding='utf8')
    for attempt in range(20):
        try:
            pending.replace(active)
            break
        except PermissionError:
            if attempt<19:
                time.sleep(.1)
                continue
            # Windows dev-server watchers may deny replacing an open file.
            # Previous selection is backed up; readers retain their last valid
            # layer if a concurrent read sees incomplete JSON, then retry.
            active.write_text(payload,encoding='utf8')
            record_event(folder,'selection_write_fallback',reason='Windows replace lock')
    record_event(folder,'crypt_project_applied',map_id=manifest['mapId'],instances=manifest['instances'],manifest_sha256=hashlib.sha256((folder/'crypt-manifest.json').read_bytes()).hexdigest())
    return {'saved':True,'editorUrl':f'/editor.html?game=crypt&map={map_id}'}
