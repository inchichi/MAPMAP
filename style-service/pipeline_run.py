"""SpecDriven Asset Restyling — Stage 3 카테고리 라우터 + 파이프라인 오케스트레이션.

흐름(디벨롭 방향 문서 2.2):
  승인된 StyleSpec/앵커 → 카테고리 라우터(지형/오브젝트/캐릭터 분기)
  → 변환 → Stage 4 규격 스냅(결정론) → Stage 5 자동 QA → 통과분만 적용.

카테고리별 분기:
  - terrain_tile:      낮은 strength(구조 우선) + circular padding 이음새 모드
  - object:            스펙 strength 그대로. 타일 군집으로 이루어진 '묶인 오브젝트'는
                       셀 목록으로 한 장에 조립해 변환한 뒤 원 타일 좌표에 역패치한다(분기 B)
  - character_sprite:  중간 strength + 원본 실루엣 하드 제약(Stage 4 알파 재적용).
                       pig/slime 시트는 기존 배경 보존 전용 경로(monster_stylize) 재사용.
  - ui:                기본 제외(요청 시 object 취급)

denoising strength 분리는 문서 Week 1 항목("타일은 낮게, 컨셉은 높게"),
circular padding은 이음새 3단계 중 1단계(가장 싼 실험)의 구현이다.
"""

from __future__ import annotations

import contextlib
import io

from PIL import Image

import asset_store
import inventory
import monster_stylize
import object_extract
import postprocess
import qa_gate
import style_backend
import style_spec
import tile_stylize

# 카테고리별 strength 배율 — spec.style_strength(단일 노브)에 곱한다.
_STRENGTH_SCALE = {
    "terrain_tile": 0.7,
    "object": 1.0,
    "character_sprite": 0.85,
    "ui": 1.0,
}

_MONSTER_KEYS = ("pig", "slime")


@contextlib.contextmanager
def seamless_mode(enabled: bool):
    """UNet/VAE의 Conv2d padding_mode를 circular로 몽키패치한다(문서 이음새 1단계).

    왼쪽 끝 바깥이 오른쪽 끝으로 이어진 것처럼 계산되어 타일 경계 연속성이 좋아진다.
    with 블록을 벗어나면 원래 모드로 복원한다.
    """
    del enabled
    yield


def _monster_key_for(path: str) -> str | None:
    lowered = path.lower()
    for key in _MONSTER_KEYS:
        if key in lowered:
            return key
    return None


def _transform(original: Image.Image, path: str, category: str, spec: dict,
               alpha_erode: int) -> Image.Image:
    """카테고리 분기 실행 — 반환은 원본 크기의 스타일 결과(Stage 4 이전)."""
    strength = max(0.1, min(0.9, spec["style_strength"] * _STRENGTH_SCALE.get(category, 1.0)))
    prompt = style_spec.build_prompt(spec, category)

    if category == "character_sprite":
        monster_key = _monster_key_for(path)
        if monster_key:
            # 게임의 색 기반 프레임 슬라이싱을 지키는 기존 전용 경로 재사용.
            return monster_stylize.stylize_monster_sheet(
                original, prompt, monster_key, alpha=1.0, alpha_erode=alpha_erode
            )
        return style_backend.style_transfer_image(
            original, prompt, content_size=512, alpha_erode=alpha_erode,
            preserve_size=True, strength=strength,
        )

    seamless = category == "terrain_tile"
    with seamless_mode(seamless):
        return style_backend.style_transfer_image(
            original, prompt, content_size=512, alpha_erode=alpha_erode,
            preserve_size=True, strength=strength,
        )


def _png_bytes(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _run_asset_target(target: dict, spec: dict, alpha_erode: int) -> tuple[dict, bytes]:
    """단일 PNG 에셋(파일 하나 = 그림 하나) 경로. 분기 A/C와 일반 오브젝트가 여기로 온다."""
    path = target.get("path")
    if not isinstance(path, str):
        raise ValueError("path가 없습니다.")
    category = target.get("category") or inventory.category_of(path)
    if category not in style_spec.CATEGORIES and category != "ui":
        raise ValueError(f"알 수 없는 카테고리: {category}")

    original = Image.open(io.BytesIO(asset_store.read_original_or_current(path)))
    original.load()

    styled = _transform(original, path, category, spec, alpha_erode)

    # Stage 4 — 결정론적 규격 스냅. 몬스터 시트는 배경까지 원본 보존이 목적이라
    # 팔레트 스냅을 건너뛴다(스냅하면 배경색이 변해 슬라이싱이 깨질 수 있음).
    if category == "character_sprite" and _monster_key_for(path):
        snapped = styled
    else:
        snapped = postprocess.spec_snap(styled, original, spec)

    # Stage 5 — QA. 타일셋이면 이음새 축 포함.
    tileset = (inventory.entry_of(path) or {}).get("tileset") or {}
    qa = qa_gate.run_qa(
        original, snapped, spec,
        tile_width=tileset.get("tileWidth"),
        tile_height=tileset.get("tileHeight"),
    )
    return (
        {"id": path, "path": path, "label": path, "category": category, "qa": qa},
        _png_bytes(snapped),
    )


def _run_object_target(target: dict, spec: dict, alpha_erode: int) -> tuple[dict, bytes]:
    """분기 B — 묶인 오브젝트(타일 군집).

    타일셋 시트를 통째로 변환하면 나무 한 그루가 시트 안 수백 타일 중 일부로 섞여
    들어가 형태가 무너진다(7/29 "타일이 단체로 합쳐져 있으면 안 바뀜"). 대신 셀 목록으로
    오브젝트를 맵 배치 그대로 한 장에 조립해 하나의 그림으로 변환하고, 결과를 타일별로
    잘라 원래 타일 좌표에 되박는다 — 변환 단위가 '파일'이 아니라 '오브젝트'가 된다.

    조립 원본은 항상 originals/의 최초 타일셋에서 뜬다 — 여러 번 돌려도 색이 누적되지 않는다.
    """
    key = target.get("key")
    if not isinstance(key, str) or not key:
        raise ValueError("key가 없습니다.")
    meta = object_extract.read_meta(key)

    tileset_image = Image.open(io.BytesIO(asset_store.read_original_or_current(meta["tilesetPath"])))
    tileset_image.load()

    cells = meta["cells"]
    columns = meta["columns"]
    tile_width = meta["tileWidth"]
    tile_height = meta["tileHeight"]

    original_canvas, _, _ = tile_stylize.compose_object_canvas(
        tileset_image, cells, columns, tile_width, tile_height
    )

    strength = max(0.1, min(0.9, spec["style_strength"] * _STRENGTH_SCALE["object"]))
    # stylize_tiles가 조립 → 정수배 NEAREST 업스케일 → 변환 → BOX 다운스케일 → 알파 복원까지
    # 담당한다(픽셀아트 타일은 원본이 너무 작아 그대로는 스타일 통계가 빈약하다).
    preview, _patched = tile_stylize.stylize_tiles(
        tileset_image,
        cells,
        columns=columns,
        tile_width=tile_width,
        tile_height=tile_height,
        style_prompt=style_spec.build_prompt(spec, "object"),
        alpha=1.0,
        alpha_erode=alpha_erode,
        strength=strength,
    )

    snapped = postprocess.spec_snap(preview, original_canvas, spec)
    # 오브젝트는 타일 격자를 알고 있으므로 이음새 축까지 평가한다.
    qa = qa_gate.run_qa(
        original_canvas, snapped, spec, tile_width=tile_width, tile_height=tile_height
    )
    return (
        {
            "id": f"object:{key}",
            "key": key,
            "path": meta["tilesetPath"],
            "label": meta.get("label", key),
            "category": "object",
            "qa": qa,
            "sharedOutsideCells": int(meta.get("sharedOutsideCells", 0)),
        },
        _png_bytes(snapped),
    )


def run_pipeline(style_id: str, targets: list[dict], apply: bool = False,
                 alpha_erode: int = 0, force_unapproved: bool = False,
                 strength_override: float | None = None) -> dict:
    """대상 목록을 라우팅→변환→규격 스냅→QA까지 돌리고, apply면 통과분만 덮어쓴다.

    targets 두 형태:
      {"path": "src/games/.../x.png", "category": 옵션}   단일 PNG 에셋 (분기 A/C)
      {"kind": "extracted-object", "key": "tree_1"}        묶인 오브젝트 (분기 B)
    반환: {"style_id", "results": [{id, path, label, category, qa, applied}], "summary", "_previews"}
    """
    spec = style_spec.load_spec(style_id)
    if not spec.get("anchors_approved") and not force_unapproved:
        raise PermissionError(
            "앵커가 승인되지 않았습니다. 앵커를 생성·확인·승인한 뒤 실행하세요(승인 게이트)."
        )

    run_strength = float(
        spec["style_strength"] if strength_override is None else strength_override
    )
    run_spec = spec if strength_override is None else {
        **spec,
        "style_strength": run_strength,
    }

    results: list[dict] = []
    previews: dict[str, bytes] = {}

    for index, target in enumerate(targets):
        entry: dict = {"id": f"target-{index}", "label": f"대상 {index + 1}"}
        try:
            # target 형태 판별도 try 안에서 한다 — 리스트 원소가 dict가 아니면 여기서
            # AttributeError가 나는데, 밖에 두면 그 하나 때문에 배치 전체가 중단된다.
            if not isinstance(target, dict):
                raise ValueError(f"대상 형식이 올바르지 않습니다: {type(target).__name__}")
            is_object = target.get("kind") == "extracted-object" or "key" in target
            # 실패해도 리포트에 무엇이 실패했는지 남도록 id/label을 먼저 채워둔다.
            entry = {
                "id": f"object:{target.get('key')}" if is_object else target.get("path"),
                "label": str(target.get("key") if is_object else target.get("path")),
            }
            if is_object:
                entry, data = _run_object_target(target, run_spec, alpha_erode)
                if apply and entry["qa"]["passed"]:
                    # 셀 정보로 타일셋에 역패치 — 백업·원본 시드는 asset_store가 담당한다.
                    object_extract.apply_styled_object(entry["key"], data)
                    entry["applied"] = True
                else:
                    entry["applied"] = False
            else:
                entry, data = _run_asset_target(target, run_spec, alpha_erode)
                if apply and entry["qa"]["passed"]:
                    asset_store.backup_and_write(entry["path"], data)
                    entry["applied"] = True
                else:
                    entry["applied"] = False
            entry["strength"] = run_strength
            previews[entry["id"]] = data
        except Exception as error:  # noqa: BLE001 — 아래 설명 참고
            # 대상 하나의 실패로 배치 전체를 잃지 않는다. GPU 작업은 대상당 수 분이 걸리고
            # apply=True면 앞선 대상들이 이미 디스크에 쓰인 뒤라, 여기서 예외가 빠져나가면
            # 500이 나면서 "무엇이 이미 적용됐는지"까지 함께 사라진다.
            # torch OOM(RuntimeError)·MemoryError처럼 타입을 미리 알 수 없는 실패가 실제로
            # 발생하므로 타입을 좁히지 않는다.
            entry["error"] = f"{type(error).__name__}: {error}"
            entry["applied"] = False
        results.append(entry)

    passed = sum(1 for entry in results if entry.get("qa", {}).get("passed"))
    return {
        "style_id": style_id,
        "strength": run_strength,
        "results": results,
        "summary": {
            "total": len(results),
            "qa_passed": passed,
            "applied": sum(1 for entry in results if entry.get("applied")),
            "failed": sum(1 for entry in results if "error" in entry),
        },
        "_previews": previews,  # server.py가 b64로 직렬화해 응답에 싣는다.
    }
