"""Ninja Adventure(CC0) 에셋을 crypt-crawler 게임으로 들여온다.

crypt-crawler는 스타일 전이 연구의 실험 대상이라 **원본 화풍의 동질성이 요구사항**이다.
LoRA가 "게임 고유 화풍"을 담당하려면 학습할 단일 화풍이 있어야 하는데, DCSS 같은
다작가 누적 코퍼스는 그 전제를 깬다. Ninja Adventure는 작가 2인(Pixel-boy, AAA)이
그린 CC0 단일 화풍에 타일·캐릭터·몬스터·보스가 모두 들어 있어 이 조건을 만족한다.

산출물(멱등, PIL 필요):
  src/games/crypt-crawler/assets/tilesets/ninja-dungeon-16.png  아틀라스
  src/games/crypt-crawler/assets/tilesets/ninja-dungeon-16.tsx  Tiled 타일셋
  scripts/ninja-dungeon-atlas.json                              시트별 인덱스 매니페스트
  src/games/crypt-crawler/assets/actors/<Name>/*.png            액터 스프라이트
  licenses/assets/ninja-adventure/                              라이선스 + 출처 기록

원본 43MB 타르볼은 third_party/ninja-adventure/ 에 캐싱하고 git에서 제외한다
(이 스크립트로 언제든 재현 가능하다). 게임이 실제로 쓰는 산출물만 커밋한다.

스프라이트 시트 규약(4종 스프라이트에서 열2/열3이 오차 0.0의 정확한 거울상임을
확인해 확정): **열 = 방향 [0=DOWN 1=UP 2=LEFT 3=RIGHT], 행 = 애니 프레임.**
"""
import hashlib
import json
import os
import shutil
import tarfile
import urllib.request
from datetime import date

from PIL import Image

SOURCE_URL = 'https://codeload.github.com/winex01/RPG2D/tar.gz/refs/heads/master'
CACHE_DIR = 'third_party/ninja-adventure'
GAME_DIR = 'src/games/crypt-crawler'
TILESET_DIR = f'{GAME_DIR}/assets/tilesets'
ACTOR_DIR = f'{GAME_DIR}/assets/actors'
LICENSE_DIR = 'licenses/assets/ninja-adventure'
ATLAS_NAME = 'ninja-dungeon-16'
MANIFEST_PATH = 'scripts/ninja-dungeon-atlas.json'

TILE = 16
ATLAS_COLUMNS = 32

# 아틀라스에 넣을 소스 시트 — 던전에 쓰이는 것만 고른다. 순서가 곧 인덱스 순서이므로
# 새 시트는 반드시 뒤에만 덧붙일 것(기존 gid가 밀리면 생성된 맵이 전부 깨진다).
SHEETS = [
  ('dungeon', 'Backgrounds/Tilesets/TilesetDungeon.png'),
  ('wall', 'Backgrounds/Tilesets/Interior/TilesetWallSimple.png'),
  ('interior', 'Backgrounds/Tilesets/Interior/TilesetInterior.png'),
  ('interior_floor', 'Backgrounds/Tilesets/Interior/TilesetInteriorFloor.png'),
  ('elements', 'Backgrounds/Tilesets/Interior/Elements.png'),
  ('floor', 'Backgrounds/Tilesets/TilesetFloor.png'),
  ('floor_b', 'Backgrounds/Tilesets/TilesetFloorB.png'),
  ('floor_detail', 'Backgrounds/Tilesets/TilesetFloorDetail.png'),
  ('hole', 'Backgrounds/Tilesets/TilesetHole.png'),
  ('element', 'Backgrounds/Tilesets/TilesetElement.png'),
  ('relief', 'Backgrounds/Tilesets/TilesetRelief.png'),
  ('relief_detail', 'Backgrounds/Tilesets/TilesetReliefDetail.png'),
  ('ruins', 'Backgrounds/Tilesets/TilesetVillageAbandoned.png'),
  ('water', 'Backgrounds/Tilesets/TilesetWater.png'),
]

PLAYER = 'Boy'

# 던전에 어울리는 몬스터만 고른다(물고기·나비 등 야외 계열 제외).
MONSTERS = [
  'Skull', 'SkullBlue', 'Spirit', 'Spirit2',
  'Slime', 'Slime2', 'Slime3', 'Slime4',
  'Larva', 'Larva2', 'Eye', 'Eye2',
  'Cyclope', 'Cyclope2', 'Beast', 'Beast2',
  'Reptile', 'Reptile2', 'Lizard', 'Lizard2',
  'Snake', 'Snake2', 'Snake3', 'Snake4',
  'Mollusc', 'Mollusc2', 'Mushroom', 'Mushroom2',
  'Mole', 'Mole2', 'Octopus', 'Octopus2',
  'Flam', 'Flam2', 'Dragon', 'DragonYellow', 'Bamboo',
]

BOSSES = [
  'DemonCyclop', 'DemonCyclop2', 'GiantFlam',
  'GiantSpirit', 'GiantFrog', 'GiantRacoon',
]

# 대사를 할 사람들. 전부 38x38 초상(Faceset)을 가진다.
NPCS = [
  'Skeleton', 'Monk', 'Master', 'Inspector', 'OldMan', 'OldWoman',
  'Villager', 'Villager3', 'Child', 'MaskFrog', 'Greenman',
]

# 층별 BGM. 곡 제목이 층 성격에 그대로 맞는다.
MUSIC = {
  'ruins': '26 - Lost Village.ogg',
  'mushroom': '2 - The Cave.ogg',
  'water': '18 - Aquatic.ogg',
  'lava': '28 - Tension.ogg',
  'deep': '24 - Final Area.ogg',
  'boss': '17 - Fight.ogg',
}

# 효과음 — 게임이 실제로 쓰는 것만.
SOUNDS = {
  'swing': 'Sword.wav', 'hit': 'Hit1.wav', 'hit_heavy': 'Hit4.wav',
  'kill': 'Kill.wav', 'coin': 'Coin.wav', 'chest': 'Success1.wav',
  'potion': 'PowerUp1.wav', 'levelup': 'PowerUp2.wav',
  'player_hurt': 'Hit6.wav', 'death': 'GameOver.wav',
  'boss_slam': 'Explosion2.wav', 'boss_alert': 'Alert.wav',
}

# 베기 이펙트(128x32 = 32px 4프레임)와 소품 아이콘.
SLASH_FX = ['Slash', 'SlashCurved', 'Cut']
ITEM_DIRS = ['Potion', 'Treasure', 'Scroll']
HUD_FILES = [
  'Dialog/DialogBoxFaceset.png', 'Dialog/DialogBox.png', 'Dialog/ChoiceBox.png',
  'LifeBarMiniProgress.png', 'LifeBarMiniUnder.png', 'Heart.png',
]


def ensure_source():
  """원본 팩을 캐시에 준비하고 NinjaAdventure 디렉터리 경로를 돌려준다."""
  root = f'{CACHE_DIR}/NinjaAdventure'
  if os.path.isdir(root):
    return root

  os.makedirs(CACHE_DIR, exist_ok=True)
  archive = f'{CACHE_DIR}/source.tar.gz'
  if not os.path.exists(archive):
    print(f'내려받는 중: {SOURCE_URL}')
    urllib.request.urlretrieve(SOURCE_URL, archive)

  digest = hashlib.sha256(open(archive, 'rb').read()).hexdigest()
  size = os.path.getsize(archive)
  print(f'  {size} bytes  sha256={digest}')

  print('푸는 중...')
  with tarfile.open(archive) as tar:
    members = [m for m in tar.getmembers() if '/NinjaAdventure/' in m.name or m.name.endswith('/NinjaAdventure')]
    tar.extractall(CACHE_DIR, members=members)
  # 타르볼 최상위는 RPG2D-master/ 이므로 NinjaAdventure 를 캐시 루트로 끌어올린다.
  extracted = f'{CACHE_DIR}/RPG2D-master/NinjaAdventure'
  if os.path.isdir(extracted):
    shutil.move(extracted, root)
    shutil.rmtree(f'{CACHE_DIR}/RPG2D-master', ignore_errors=True)
  return root


def build_atlas(root):
  """선택한 시트들을 한 장의 아틀라스로 합치고 매니페스트를 만든다.

  각 시트는 아틀라스의 새 행에서 시작한다(행 정렬). 시트 안의 타일 (col,row)는
  manifest[name].start + row * manifest[name].columns + col 번째 아틀라스 타일이다.
  """
  blocks = []
  cursor = 0
  for name, relative in SHEETS:
    image = Image.open(f'{root}/{relative}').convert('RGBA')
    columns = image.width // TILE
    rows = image.height // TILE
    if columns == 0 or rows == 0:
      raise ValueError(f'{relative}: 타일 격자가 없습니다 ({image.size})')
    blocks.append({
      'name': name,
      'source': relative,
      'image': image,
      'columns': columns,
      'rows': rows,
      'start': cursor,
      'count': columns * rows,
    })
    # 다음 시트는 행 경계에서 시작한다.
    cursor += columns * rows
    cursor += (-cursor) % ATLAS_COLUMNS

  total = cursor
  atlas_rows = total // ATLAS_COLUMNS
  atlas = Image.new('RGBA', (ATLAS_COLUMNS * TILE, atlas_rows * TILE), (0, 0, 0, 0))

  for block in blocks:
    for row in range(block['rows']):
      for column in range(block['columns']):
        index = block['start'] + row * block['columns'] + column
        tile = block['image'].crop(
          (column * TILE, row * TILE, (column + 1) * TILE, (row + 1) * TILE)
        )
        atlas.paste(tile, ((index % ATLAS_COLUMNS) * TILE, (index // ATLAS_COLUMNS) * TILE))

  os.makedirs(TILESET_DIR, exist_ok=True)
  atlas.save(f'{TILESET_DIR}/{ATLAS_NAME}.png')

  tsx = (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<tileset\n'
    '  version="1.10"\n'
    '  tiledversion="1.12.1"\n'
    f'  name="{ATLAS_NAME}"\n'
    f'  tilewidth="{TILE}"\n'
    f'  tileheight="{TILE}"\n'
    f'  tilecount="{total}"\n'
    f'  columns="{ATLAS_COLUMNS}"\n'
    '>\n'
    f'  <image source="{ATLAS_NAME}.png"'
    f' width="{atlas.width}" height="{atlas.height}"/>\n'
    '</tileset>\n'
  )
  open(f'{TILESET_DIR}/{ATLAS_NAME}.tsx', 'w', encoding='utf-8', newline='\n').write(tsx)

  manifest = {
    'tile': TILE,
    'columns': ATLAS_COLUMNS,
    'tilecount': total,
    'imageWidth': atlas.width,
    'imageHeight': atlas.height,
    'sheets': {
      block['name']: {
        'source': block['source'],
        'start': block['start'],
        'columns': block['columns'],
        'rows': block['rows'],
        'count': block['count'],
      }
      for block in blocks
    },
  }
  open(MANIFEST_PATH, 'w', encoding='utf-8', newline='\n').write(
    json.dumps(manifest, ensure_ascii=False, indent=2) + '\n'
  )

  print(f'아틀라스: {atlas.width}x{atlas.height}px, {total}타일 ({len(blocks)}개 시트)')
  for block in blocks:
    print(f'  {block["name"]:15s} start={block["start"]:5d} {block["columns"]:2d}x{block["rows"]:<3d}')
  return manifest


def copy_actors(root):
  """플레이어/몬스터/보스 스프라이트를 게임 에셋으로 복사한다."""
  if os.path.isdir(ACTOR_DIR):
    shutil.rmtree(ACTOR_DIR)

  copied = {'player': [], 'monsters': [], 'bosses': []}

  player_src = f'{root}/Actor/Characters/{PLAYER}/SeparateAnim'
  player_dst = f'{ACTOR_DIR}/player'
  os.makedirs(player_dst, exist_ok=True)
  for name in ('Walk.png', 'Idle.png', 'Attack.png', 'Dead.png'):
    shutil.copy(f'{player_src}/{name}', f'{player_dst}/{name.lower()}')
    copied['player'].append(name)

  for group, names, subdir in (
    ('monsters', MONSTERS, 'Monsters'),
    ('bosses', BOSSES, 'Boss'),
  ):
    for name in names:
      src = f'{root}/Actor/{subdir}/{name}'
      if not os.path.isdir(src):
        raise ValueError(f'{src} 가 없습니다 — 원본 팩 구성이 바뀌었습니다.')
      dst = f'{ACTOR_DIR}/{group}/{name.lower()}'
      os.makedirs(dst, exist_ok=True)
      for file in sorted(os.listdir(src)):
        if not file.endswith('.png') or file == 'Faceset.png':
          continue
        image = Image.open(f'{src}/{file}')
        if group == 'monsters':
          # 원본 팩은 시트 이름이 제각각이다(SpriteSheet.png / Beast.png / Slime.png).
          # 64x64(4방향 x 4프레임) 한 장만 sprite.png 로 통일해 런타임이 종류명만으로 찾게 한다.
          if image.size != (64, 64):
            continue
          shutil.copy(f'{src}/{file}', f'{dst}/sprite.png')
        else:
          shutil.copy(f'{src}/{file}', f'{dst}/{file.lower()}')
      copied[group].append(name)

  print(f'액터: 플레이어 1, 몬스터 {len(copied["monsters"])}, 보스 {len(copied["bosses"])}')
  return copied


def copy_support_assets(root):
  """소리·이펙트·아이템·UI·NPC — 그림만 있고 소리와 타격감이 없으면 장르가 성립하지 않는다."""
  counts = {}

  # 소리
  for group, table, src in (
    ('music', MUSIC, 'Musics'),
    ('sfx', SOUNDS, 'Sounds/Game'),
  ):
    dst = f'{GAME_DIR}/assets/audio/{group}'
    os.makedirs(dst, exist_ok=True)
    for key, filename in table.items():
      source = f'{root}/{src}/{filename}'
      if not os.path.exists(source):
        raise ValueError(f'{source} 가 없습니다 — 원본 팩 구성이 바뀌었습니다.')
      shutil.copy(source, f'{dst}/{key}{os.path.splitext(filename)[1]}')
    counts[group] = len(table)

  # 베기 이펙트
  dst = f'{GAME_DIR}/assets/fx'
  os.makedirs(dst, exist_ok=True)
  for name in SLASH_FX:
    shutil.copy(f'{root}/FX/SlashFx/{name}/SpriteSheet.png', f'{dst}/{name.lower()}.png')
  counts['fx'] = len(SLASH_FX)

  # 아이템 아이콘
  dst = f'{GAME_DIR}/assets/items'
  os.makedirs(dst, exist_ok=True)
  items = 0
  for group in ITEM_DIRS:
    for filename in sorted(os.listdir(f'{root}/Items/{group}')):
      if filename.endswith('.png'):
        shutil.copy(f'{root}/Items/{group}/{filename}', f'{dst}/{filename.lower()}')
        items += 1
  # 무기는 Sprite.png(인벤토리 아이콘)와 SpriteInHand.png(든 모습) 두 장이다.
  weapon_dst = f'{GAME_DIR}/assets/items/weapons'
  os.makedirs(weapon_dst, exist_ok=True)
  for weapon in sorted(os.listdir(f'{root}/Items/Weapons')):
    source = f'{root}/Items/Weapons/{weapon}'
    if not os.path.isdir(source):
      continue
    key = weapon.lower().replace(' ', '_')
    for filename, suffix in (('Sprite.png', ''), ('SpriteInHand.png', '_hand')):
      if os.path.isfile(f'{source}/{filename}'):
        shutil.copy(f'{source}/{filename}', f'{weapon_dst}/{key}{suffix}.png')
        items += 1
  counts['items'] = items

  # UI
  dst = f'{GAME_DIR}/assets/hud'
  os.makedirs(dst, exist_ok=True)
  for relative in HUD_FILES:
    shutil.copy(f'{root}/HUD/{relative}', f'{dst}/{os.path.basename(relative).lower()}')
  counts['hud'] = len(HUD_FILES)

  # NPC — 스프라이트 + 초상. Greenman 만 초상 파일명이 Faceset1.png 다.
  dst_root = f'{ACTOR_DIR}/npc'
  for name in NPCS:
    source = f'{root}/Actor/Characters/{name}'
    dst = f'{dst_root}/{name.lower()}'
    os.makedirs(dst, exist_ok=True)
    shutil.copy(f'{source}/SpriteSheet.png', f'{dst}/sprite.png')
    face = f'{source}/Faceset.png'
    if not os.path.exists(face):
      face = f'{source}/Faceset1.png'
    shutil.copy(face, f'{dst}/face.png')
  counts['npc'] = len(NPCS)

  print('보조 에셋: ' + ', '.join(f'{k} {v}' for k, v in counts.items()))
  return counts


def write_license(root):
  """팩의 라이선스 원문과 출처를 기록한다 — 나중에 출처를 잃지 않기 위한 장치."""
  os.makedirs(LICENSE_DIR, exist_ok=True)
  for name in ('LICENSE.txt', 'README.md'):
    if os.path.exists(f'{root}/{name}'):
      shutil.copy(f'{root}/{name}', f'{LICENSE_DIR}/{name}')

  archive = f'{CACHE_DIR}/source.tar.gz'
  provenance = [
    'Ninja Adventure Asset Pack',
    'authors: Pixel-boy (https://pixel-boy.itch.io/) and AAA',
    'license: CC0 1.0 Universal (see LICENSE.txt) — attribution not required',
    f'source: {SOURCE_URL}',
  ]
  if os.path.exists(archive):
    provenance.append(f'bytes: {os.path.getsize(archive)}')
    provenance.append(
      'sha256: ' + hashlib.sha256(open(archive, 'rb').read()).hexdigest()
    )
  provenance.append(f'imported: {date.today().isoformat()}')
  provenance.append('reproduce: python3 scripts/import-ninja-adventure.py')
  open(f'{LICENSE_DIR}/SOURCE.txt', 'w', encoding='utf-8', newline='\n').write(
    '\n'.join(provenance) + '\n'
  )
  print(f'라이선스 기록: {LICENSE_DIR}/')


def main():
  root = ensure_source()
  build_atlas(root)
  copy_actors(root)
  copy_support_assets(root)
  write_license(root)


if __name__ == '__main__':
  main()
