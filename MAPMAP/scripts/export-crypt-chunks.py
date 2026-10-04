"""층별 crypt TMX 전체 맵 렌더 + 청크 분할 — continuity 실험의 입력을 만드는 오프라인 도구.

캡스톤의 연구 문제는 "거대한 맵을 청크로 쪼개 스타일 전이하면 청크 간 색조 불일치와
이음새가 생긴다"이므로, 여기서 나오는 청크와 매니페스트가 곧 실험의 측정 대상이다.
그래서 속도보다 픽셀 산술의 정확성이 우선이고, 마지막에 기록한 청크를 **다시 읽어**
전체 맵과 정확히 일치하는지 확인한 뒤에야 성공으로 끝난다.

계약(notes/crypt-crawler-contract.md 1절, 2026-09-09 개정)에서 가져오는 것:

- 입력은 한 장이 아니라 **층별 TMX 5장**이고 `public/crypt-maps/*.tmx` 에 있다.
  청크 격자는 층마다 따로 성립한다(층당 144청크, 5층 720청크).
- 레이어는 ground → ground_deco → shadow → wall → wall_deco → prop 순으로만 합성하고
  (shadow 는 TMX 의 opacity 0.35 를 그대로 반영한다)
  collision 은 절대 그리지 않는다. collision 은 충돌의 유일한 출처이지 그림이 아니다.
- 배율은 2x 정수 nearest. 384x384 타일 * 16px * 2 = 12288x12288 px.
- 벽 덩어리 내부에는 타일이 없고 맵 배경색(#2a2431)이 그대로 보인다. 즉 "배경 =
  그리지 않은 곳"이 정의이며, 이 스크립트의 구조 마스크도 같은 정의를 쓴다.
- 청크는 항상 1024px(SDXL base 1.0 학습 해상도)이고 stride 만 바뀐다.
  12288 - 1024 = 11264 = 2^10 * 11 이라 stride 는 **1024 / 512 / 256 / 128** 네 가지만
  자투리 없이 나눠떨어진다(8192px 시절의 896/448/224 는 11264 를 나누지 못한다).
  나눠떨어지지 않는 stride 는 조용히 잘라내지 않고 즉시 실패한다.

12288x12288 RGBA 한 장이 0.56GB다. 층은 반드시 **한 장씩** 읽고 내보내고 놓는다
(`run_floor` 가 그 경계다) — 5장을 동시에 들면 3GB 가까이 잡는다.

청크마다 _mask.png 를 함께 내보내는 이유: style-service/qa_gate.py 의
silhouette_iou() 는 원본 모드가 RGBA/LA/PA(또는 투명도 있는 P)가 아니면 "실루엣 개념이
없다"고 보고 계산 없이 1.0 을 돌려준다. 불투명한 맵 렌더를 그대로 넣으면 구조 보존
점수가 영원히 만점으로 찍힌다. 마스크는 배경이 아닌 모든 픽셀을 알파에 담은 LA
이미지라 qa_gate 에 original 인자로 그대로 넣을 수 있다.
"""
from __future__ import annotations

import argparse
import json
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MAPS = ROOT / 'public/crypt-maps'   # 번들 인라인 금지 — 런타임도 여기서 fetch 한다
DEFAULT_OUT = ROOT / 'notes/crypt-chunks'   # notes/* 는 .gitignore — 수 GB 산출물이 커밋되지 않는다

RENDER_LAYERS = ('ground', 'ground_deco', 'shadow', 'wall', 'wall_deco', 'prop')
COLLISION_LAYER = 'collision'
CHUNK = 1024                                    # SDXL base 1.0 학습 해상도 — 계약상 고정
STRIDE_LADDER = (1024, 512, 256, 128)

FLIP_H, FLIP_V, FLIP_D = 0x80000000, 0x40000000, 0x20000000
FLIP_MASK = FLIP_H | FLIP_V | FLIP_D


def repo_path(path: Path) -> str:
    return str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path)


def read_map(tmx_path: Path) -> dict:
    """TMX 를 렌더에 필요한 만큼만 읽는다. 계약 위반은 여기서 전부 걸러 낸다."""
    root = ET.parse(tmx_path).getroot()
    tile = int(root.get('tilewidth'))
    problems = []
    if tile != int(root.get('tileheight')):
        problems.append('정사각 타일이 아니다')
    if root.get('infinite') != '0':
        problems.append('infinite 맵은 지원하지 않는다')

    tilesets = root.findall('tileset')
    if len(tilesets) != 1 or tilesets[0].get('source') is None:
        raise SystemExit(f'{tmx_path}: 외부 타일셋 참조가 정확히 하나여야 한다(계약 3절)')
    first_gid = int(tilesets[0].get('firstgid'))
    tsx_path = (tmx_path.parent / tilesets[0].get('source')).resolve()
    atlas_path = (tsx_path.parent / ET.parse(tsx_path).getroot().find('image').get('source')).resolve()

    width, height = int(root.get('width')), int(root.get('height'))
    layers = {}
    opacities = {}
    for layer in root.findall('layer'):
        name = layer.get('name')
        if name not in RENDER_LAYERS and name != COLLISION_LAYER:
            problems.append(f'알 수 없는 레이어 {name!r} — 렌더 순서가 계약에 없다')
        data = layer.find('data')
        if data.get('encoding') != 'csv':
            problems.append(f'{name}: csv 인코딩이 아니다')
            continue
        gids = [int(value) for value in data.text.split(',') if value.strip()]
        if len(gids) != width * height:
            problems.append(f'{name}: 셀 {len(gids)}개, {width * height}개여야 한다')
        layers[name] = gids
        opacities[name] = float(layer.get('opacity', 1))
    missing = [name for name in RENDER_LAYERS if name not in layers]
    if missing:
        problems.append(f'렌더 레이어 없음: {missing}')

    if problems:
        raise SystemExit(f'{tmx_path} 계약 위반:\n' + '\n'.join(f'  - {p}' for p in problems))
    return {
        'path': tmx_path, 'floor': tmx_path.stem,
        'width': width, 'height': height, 'tile': tile,
        'background': parse_color(root.get('backgroundcolor', '#2a2431')),
        'first_gid': first_gid, 'atlas': atlas_path,
        'layers': layers, 'opacities': opacities, 'zones': read_zones(root, tmx_path),
    }


def parse_color(text: str) -> tuple[int, int, int]:
    """Tiled 배경색은 #RRGGBB 또는 #AARRGGBB. 렌더는 불투명 배경 위에 얹으므로 알파는 버린다."""
    digits = text.lstrip('#')
    if len(digits) == 8:
        digits = digits[2:]
    return tuple(int(digits[i:i + 2], 16) for i in (0, 2, 4))


def read_zones(root: ET.Element, tmx_path: Path) -> list[dict]:
    """objectgroup 'zones' → 타일 단위 사각형. 청크가 어느 존을 걸치는지의 유일한 출처다."""
    group = root.find("objectgroup[@name='zones']")
    if group is None:
        raise SystemExit(f'{tmx_path}: objectgroup "zones" 가 없다 — 매니페스트의 zone 필드를 채울 수 없다')
    tile = int(root.get('tilewidth'))
    zones = []
    for obj in group.findall('object'):
        props = {p.get('name'): p.get('value') for p in obj.findall('properties/property')}
        left, top = round(float(obj.get('x'))), round(float(obj.get('y')))
        zones.append({
            'id': int(props['zoneId']),
            'name': props.get('name', obj.get('name', '')),
            'level': int(props['level']),
            'tiles': {'x': left // tile, 'y': top // tile,
                      'width': round(float(obj.get('width'))) // tile,
                      'height': round(float(obj.get('height'))) // tile},
        })
    if not zones:
        raise SystemExit(f'{tmx_path}: zones 레이어가 비어 있다')
    return sorted(zones, key=lambda zone: zone['id'])


def render_structure(crypt: dict, scale: int) -> Image.Image:
    """렌더 레이어만 투명 캔버스에 아래에서 위로 합성한다.

    투명 캔버스에 그리는 것이 핵심이다 — 그린 곳/안 그린 곳이 알파로 남아 그대로
    구조 마스크가 되고, 배경색은 마지막에 한 번만 깔면 된다. prop 의 y정렬은 런타임
    개념이라 오프라인 렌더에는 의미가 없다(타일 레이어는 셀당 한 장이다).
    """
    tile, width, height = crypt['tile'], crypt['width'], crypt['height']
    atlas = Image.open(crypt['atlas']).convert('RGBA')
    columns = atlas.width // tile
    tile_count = columns * (atlas.height // tile)
    cache: dict[int, Image.Image] = {}

    def tile_image(raw: int) -> Image.Image:
        if raw in cache:
            return cache[raw]
        index = (raw & ~FLIP_MASK) - crypt['first_gid']
        left, top = (index % columns) * tile, (index // columns) * tile
        image = atlas.crop((left, top, left + tile, top + tile))
        if raw & FLIP_D:
            image = image.transpose(Image.TRANSPOSE)
        if raw & FLIP_H:
            image = image.transpose(Image.FLIP_LEFT_RIGHT)
        if raw & FLIP_V:
            image = image.transpose(Image.FLIP_TOP_BOTTOM)
        cache[raw] = image
        return image

    structure = Image.new('RGBA', (width * tile, height * tile))
    for name in RENDER_LAYERS:
        gids = crypt['layers'][name]
        last_gid = crypt['first_gid'] + tile_count
        bad = sorted({g & ~FLIP_MASK for g in gids
                      if g and not crypt['first_gid'] <= (g & ~FLIP_MASK) < last_gid})
        if bad:
            raise SystemExit(f'{crypt["floor"]}/{name}: 아틀라스 밖 gid {bad[:8]} (타일 {tile_count}장)')
        layer = Image.new('RGBA', structure.size)
        for cell, raw in enumerate(gids):
            if raw:
                # 한 레이어 안에서 셀은 서로 겹치지 않으므로 마스크 없는 paste 가 알파까지 정확하다.
                layer.paste(tile_image(raw), ((cell % width) * tile, (cell // width) * tile))
        # 레이어 불투명도(shadow=0.35)는 런타임 렌더러가 타일별 alpha 로 반영한다.
        # 오프라인 렌더도 같은 그림이 나와야 청크가 화면과 일치한다.
        opacity = crypt['opacities'].get(name, 1.0)
        if opacity < 1:
            layer.putalpha(layer.getchannel('A').point(lambda a: round(a * opacity)))
        structure = Image.alpha_composite(structure, layer)
    return structure.resize((structure.width * scale, structure.height * scale), Image.NEAREST)


def chunk_grid(size: int, stride: int) -> int:
    """자투리 없이 격자가 떨어지는지 확인하고 축당 청크 개수를 돌려준다."""
    if stride > CHUNK:
        raise SystemExit(f'stride {stride} 가 청크 {CHUNK}px 보다 크다 — 청크 사이에 빈 띠가 생긴다')
    if size < CHUNK:
        raise SystemExit(f'맵이 {size}px 라 {CHUNK}px 청크 한 장도 나오지 않는다')
    if (size - CHUNK) % stride:
        raise SystemExit(
            f'stride {stride} 는 {size}px 를 {CHUNK}px 청크로 정확히 덮지 못한다'
            f'(자투리 {(size - CHUNK) % stride}px). 계약 사다리: {list(STRIDE_LADDER)}')
    return (size - CHUNK) // stride + 1


def zones_at(crypt: dict, scale: int, box: tuple[int, int, int, int]) -> list[int]:
    step = crypt['tile'] * scale
    covered = []
    for zone in crypt['zones']:
        rect = zone['tiles']
        left, top = rect['x'] * step, rect['y'] * step
        if left < box[2] and box[0] < left + rect['width'] * step \
                and top < box[3] and box[1] < top + rect['height'] * step:
            covered.append(zone['id'])
    return covered


def export(crypt: dict, floor_dir: Path, stride: int, scale: int) -> dict:
    step = crypt['tile'] * scale
    if CHUNK % step:
        raise SystemExit(f'청크 {CHUNK}px 가 타일 {step}px 의 배수가 아니다 — 타일 범위를 적을 수 없다')
    structure = render_structure(crypt, scale)
    size = structure.width
    columns = chunk_grid(size, stride)
    rows = chunk_grid(structure.height, stride)

    fullmap = Image.new('RGB', structure.size, crypt['background'])
    fullmap.paste(structure, (0, 0), structure)   # 불투명 배경 위 straight-alpha over
    mask_band = structure.getchannel('A').point(lambda alpha: 255 if alpha else 0)
    mask = Image.merge('LA', (mask_band, mask_band))
    del structure

    floor_dir.mkdir(parents=True, exist_ok=True)
    fullmap.save(floor_dir / 'fullmap.png')
    chunk_dir = floor_dir / 'chunks' / str(stride)
    chunk_dir.mkdir(parents=True, exist_ok=True)

    chunks = []
    for cy in range(rows):
        for cx in range(columns):
            left, top = cx * stride, cy * stride
            box = (left, top, left + CHUNK, top + CHUNK)
            name = f'{cx}_{cy}'
            fullmap.crop(box).save(chunk_dir / f'{name}.png')
            chunk_mask = mask.crop(box)
            chunk_mask.save(chunk_dir / f'{name}_mask.png')
            structure_pixels = chunk_mask.getchannel('A').histogram()[255]
            chunks.append({
                'cx': cx, 'cy': cy,
                'file': f'chunks/{stride}/{name}.png',
                'mask': f'chunks/{stride}/{name}_mask.png',
                'origin': [left, top],
                'size': [CHUNK, CHUNK],
                'stride': stride,
                'tiles': {'x': left // step, 'y': top // step,
                          'width': CHUNK // step, 'height': CHUNK // step},
                'zones': zones_at(crypt, scale, box),
                'structureRatio': round(structure_pixels / (CHUNK * CHUNK), 6),
            })

    manifest = {
        'floor': crypt['floor'],
        'source': {
            'tmx': repo_path(crypt['path']),
            'atlas': repo_path(crypt['atlas']),
            'renderedLayers': list(RENDER_LAYERS),
            'excludedLayer': COLLISION_LAYER,
        },
        'map': {'tilesWide': crypt['width'], 'tilesHigh': crypt['height'], 'tileSize': crypt['tile'],
                'backgroundColor': '#%02x%02x%02x' % crypt['background']},
        'render': {'scale': scale, 'resample': 'nearest', 'fullmap': 'fullmap.png',
                   'pixelWidth': fullmap.width, 'pixelHeight': fullmap.height,
                   'bytes': (floor_dir / 'fullmap.png').stat().st_size},
        'chunking': {'size': CHUNK, 'stride': stride, 'overlap': CHUNK - stride,
                     'columns': columns, 'rows': rows, 'count': len(chunks),
                     'tilesPerChunk': CHUNK // step, 'strideLadder': list(STRIDE_LADDER),
                     'bytes': sum(path.stat().st_size for path in chunk_dir.glob('*.png'))},
        'zones': crypt['zones'],
        'chunks': chunks,
    }
    (floor_dir / 'chunks.json').write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    verify_reassembly(fullmap, chunk_dir, chunks)
    return manifest


def verify_reassembly(fullmap: Image.Image, chunk_dir: Path, chunks: list[dict]) -> None:
    """기록한 PNG 를 다시 읽어 붙였을 때 전체 맵과 픽셀 단위로 같은지 확인한다.

    청크가 실험의 입력이므로 "저장까지 무손실"이 이 도구의 유일한 성공 조건이다.
    겹치는 stride 에서도 겹친 부분은 같은 픽셀이라 그대로 성립한다.
    """
    rebuilt = Image.new('RGB', fullmap.size)
    for chunk in chunks:
        rebuilt.paste(Image.open(chunk_dir / Path(chunk['file']).name), tuple(chunk['origin']))
    difference = max(high for _, high in ImageChops.difference(fullmap, rebuilt).getextrema())
    if difference:
        raise SystemExit(f'재조립 불일치: 최대 픽셀 차 {difference}')
    print(f'  재조립 검증: {len(chunks)}청크 → 최대 픽셀 차 {difference}')


def find_floors(maps_dir: Path, only: str) -> list[Path]:
    """처리할 TMX 목록. --floor 는 파일 stem 과 정확히 일치해야 한다."""
    if not maps_dir.is_dir():
        raise SystemExit(f'{maps_dir} 가 없다 — scripts/generate-crypt.py 를 먼저 돌릴 것')
    found = sorted(maps_dir.glob('*.tmx'))
    if not found:
        raise SystemExit(f'{maps_dir} 에 TMX 가 없다 — scripts/generate-crypt.py 를 먼저 돌릴 것')
    if not only:
        return found
    picked = [path for path in found if path.stem == only]
    if not picked:
        raise SystemExit(f'--floor {only!r} 이 없다. 있는 층: {[path.stem for path in found]}')
    return picked


def run_floor(tmx_path: Path, out_dir: Path, stride: int, scale: int) -> None:
    """층 하나를 읽고 내보내고 놓는다. 12288² 이미지가 이 함수 밖으로 새지 않게 여기서 끝낸다."""
    crypt = read_map(tmx_path)
    background = '#%02x%02x%02x' % crypt['background']
    print(f'{crypt["floor"]}: {crypt["width"]}x{crypt["height"]} 타일, {crypt["tile"]}px, '
          f'존 {len(crypt["zones"])}개, 배경 {background}')
    manifest = export(crypt, out_dir / crypt['floor'], stride, scale)

    render, chunking = manifest['render'], manifest['chunking']
    mib = 1024 * 1024
    print(f'  전체 맵 {render["pixelWidth"]}x{render["pixelHeight"]}px @{render["scale"]}x nearest '
          f'({render["bytes"] / mib:.1f} MiB)')
    print(f'  청크 {chunking["columns"]}x{chunking["rows"]} = {chunking["count"]}개 '
          f'(size {CHUNK}, stride {chunking["stride"]}, overlap {chunking["overlap"]}, '
          f'{chunking["bytes"] / mib:.1f} MiB)')


def write_index(out_dir: Path) -> dict:
    """층별 chunks.json 을 다시 읽어 index.json 을 통째로 다시 쓴다.

    --floor 로 한 층만 돌려도 나머지 층의 매니페스트는 디스크에 그대로 있으므로,
    색인은 항상 "이번 실행"이 아니라 "지금 산출물 전체"를 가리킨다.
    """
    floors = []
    for manifest_path in sorted(out_dir.glob('*/chunks.json')):
        manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
        render, chunking = manifest['render'], manifest['chunking']
        floors.append({
            'floor': manifest['floor'],
            'tmx': manifest['source']['tmx'],
            'manifest': f'{manifest_path.parent.name}/chunks.json',
            'tiles': [manifest['map']['tilesWide'], manifest['map']['tilesHigh']],
            'pixels': [render['pixelWidth'], render['pixelHeight']],
            'stride': chunking['stride'],
            'grid': [chunking['columns'], chunking['rows']],
            'chunks': chunking['count'],
            'zones': [zone['id'] for zone in manifest['zones']],
            'bytes': render['bytes'] + chunking['bytes'],
        })
    index = {
        'chunk': {'size': CHUNK, 'strideLadder': list(STRIDE_LADDER)},
        'floors': floors,
        'totals': {'floors': len(floors),
                   'chunks': sum(floor['chunks'] for floor in floors),
                   'bytes': sum(floor['bytes'] for floor in floors)},
    }
    (out_dir / 'index.json').write_text(
        json.dumps(index, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return index


def main() -> None:
    parser = argparse.ArgumentParser(
        description='층별 crypt TMX 를 전체 맵 PNG 와 스타일 전이용 청크로 내보낸다')
    parser.add_argument('--maps', type=Path, default=DEFAULT_MAPS, help='TMX 디렉터리 (기본: %(default)s)')
    parser.add_argument('--floor', default='', help='층 하나만 처리한다(파일 stem, 예: floor-2-mushroom). 기본은 전부')
    parser.add_argument('--out', type=Path, default=DEFAULT_OUT, help='출력 디렉터리 (기본: %(default)s)')
    parser.add_argument('--stride', type=int, default=CHUNK,
                        help=f'청크 간격 px. {CHUNK}px 청크는 고정 (기본: %(default)s, 사용 가능: {list(STRIDE_LADDER)})')
    parser.add_argument('--scale', type=int, default=2, help='정수 nearest 배율 (기본: %(default)s)')
    args = parser.parse_args()
    if args.scale < 1:
        raise SystemExit('--scale 은 1 이상의 정수여야 한다')

    floors = find_floors(args.maps, args.floor)
    args.out.mkdir(parents=True, exist_ok=True)
    for tmx_path in floors:
        run_floor(tmx_path.resolve(), args.out, args.stride, args.scale)

    index = write_index(args.out)
    totals = index['totals']
    print(f'색인 {totals["floors"]}층 / {totals["chunks"]}청크 / '
          f'{totals["bytes"] / (1024 * 1024):.1f} MiB → {args.out}')


if __name__ == '__main__':
    main()
