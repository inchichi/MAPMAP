"""Publish a validated visual-only Crypt overlay without modifying source assets."""
import hashlib, json, shutil, time
from PIL import Image
from run_records import record_event

def publish(repo, folder):
    status=json.loads((folder/'status.json').read_text(encoding='utf8'))
    if status['status']!='ready': raise ValueError('검수 완료된 Crypt 결과만 적용할 수 있습니다.')
    manifest=json.loads((folder/'crypt-manifest.json').read_text(encoding='utf8'))
    if manifest['mapId']!='floor-0-town' or manifest['id']!=folder.name:
        raise ValueError('Crypt 맵 계약 불일치')
    expected={'public/crypt-maps/floor-0-town.tmx','src/games/crypt-crawler/assets/tilesets/ninja-dungeon-16.tsx','src/games/crypt-crawler/assets/tilesets/ninja-dungeon-16.png'}
    if set(manifest['source_hashes'])!=expected: raise ValueError('원본 검증 목록 불일치')
    for name,digest in manifest['source_hashes'].items():
        if hashlib.sha256((repo/name).read_bytes()).hexdigest()!=digest: raise ValueError('원본 변경: '+name)
    with Image.open(folder/'decoration-map.png') as image:
        if image.mode!='RGBA' or image.size!=(manifest['width'],manifest['height']): raise ValueError('레이어 크기/투명도 불일치')
    if manifest['overlay']!=f'/theme-runs/{folder.name}/decoration-map.png': raise ValueError('레이어 경로 불일치')
    target=repo/'public/crypt-style';target.mkdir(exist_ok=True)
    active=target/'active.json'
    if active.exists(): shutil.copy2(active,folder/'previous-active.json')
    pending=target/'active.tmp';payload=json.dumps(manifest);pending.write_text(payload,encoding='utf8')
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
    return {'saved':True,'editorUrl':'/editor.html?game=crypt&map=floor-0-town'}
