"""SDXL img2img 스타일 트랜스퍼 로컬 HTTP 서비스.

에디터(Vite dev 서버)의 /api/style 프록시가 이 서버를 가리킨다.
실행: python server.py  (style-service 폴더에서)

엔드포인트
  GET  /health          서비스 상태 + 디바이스 정보
  POST /style-transfer  multipart(content, style_prompt + alpha, content_size, preserve_size)
                        → 결과 PNG 바이트
  GET  /assets          프로젝트 src/games/my-sample-rpg/assets의 PNG 목록 (에디터 '게임 에셋' 선택용)
  POST /stylize-object  맵 오브젝트(타일 군집) 부분 변환 → 오브젝트 미리보기 + 패치된 타일셋
  POST /apply-asset     결과 PNG를 src/games/my-sample-rpg/assets의 기존 파일에 백업 후 덮어쓰기 (게임 즉시 반영)

동기 엔드포인트는 FastAPI가 스레드풀에서 실행하므로 추론 중에도
서버(및 health 체크)는 블로킹되지 않는다.
"""

import base64
import io
import json
from urllib.parse import urlparse

from fastapi import Body, FastAPI, File, Form, UploadFile
from fastapi.responses import JSONResponse, Response
from PIL import Image

import anchor_service
import asset_store
import external_assets
import inventory
import pipeline_run
import sdxl_service
import monster_stylize
import object_extract
import style_service_config
import style_spec
import tile_stylize

app = FastAPI(title="SDXL img2img style-transfer service")

# 드라이브-바이 방어: multipart POST는 CORS preflight 없이 어느 웹사이트에서든 127.0.0.1로
# 직접 보낼 수 있다(응답은 못 읽어도 쓰기는 성공). Origin 헤더가 있는 변조 요청은 로컬 출처
# (에디터 dev 서버 — Vite가 포트를 5174 등으로 옮겨도 허용)만 통과시킨다.
# Origin이 없는 요청(curl 등 비브라우저 도구)은 브라우저 위협 모델 밖이라 통과.
def _is_local_origin(origin: str) -> bool:
    host = urlparse(origin).hostname
    return host in ("localhost", "127.0.0.1", "::1")


@app.middleware("http")
async def reject_foreign_origins(request, call_next):
    origin = request.headers.get("origin")
    if request.method == "POST" and origin is not None and not _is_local_origin(origin):
        return JSONResponse(status_code=403, content={"error": f"허용되지 않은 출처입니다: {origin}"})
    return await call_next(request)


@app.get("/health")
def health() -> dict:
    config = style_service_config.get_config()
    missing = [] if config["sdxl_model"] else ["SDXL model"]
    return {
        "status": "ok" if not missing else "degraded",
        "missing": missing,
        "sdxl_model": str(config["sdxl_model"]),
    }

@app.post("/style-transfer")
def style_transfer(
    content: UploadFile = File(...),
    style_prompt: str = Form(...),
    alpha: float = Form(1.0),
    strength: float | None = Form(None),
    guidance_scale: float | None = Form(None),
    content_size: int = Form(512),
    alpha_erode: int = Form(0),
    preserve_size: int = Form(0),
):
    if not 0.0 <= alpha <= 1.0:
        return JSONResponse(status_code=422, content={"error": "alpha??0.0~1.0 ?ъ씠?ъ빞 ?⑸땲??"})
    if not 0 <= alpha_erode <= 3:
        return JSONResponse(status_code=422, content={"error": "alpha_erode??0~3 ?ъ씠?ъ빞 ?⑸땲??"})
    if not style_prompt.strip():
        return JSONResponse(status_code=422, content={"error": "style_prompt is required"})
    if content_size != 0 and not 64 <= content_size <= 2048:
        return JSONResponse(
            status_code=422,
            content={"error": "content_size??0(?먮낯 ?좎?) ?먮뒗 64~2048 ?ъ씠?ъ빞 ?⑸땲??"},
        )

    try:
        content_image = Image.open(io.BytesIO(content.file.read()))
        content_image.load()
    except OSError:
        return JSONResponse(status_code=422, content={"error": "?대?吏 ?뚯씪???댁꽍?????놁뒿?덈떎."})

    try:
        result = sdxl_service.style_transfer_image(
            content_image,
            style_prompt,
            alpha=alpha,
            content_size=content_size,
            alpha_erode=alpha_erode,
            preserve_size=bool(preserve_size),
            strength=strength,
            guidance_scale=guidance_scale,
        )
    except FileNotFoundError as error:
        return JSONResponse(status_code=503, content={"error": str(error)})
    buffer = io.BytesIO()
    result.save(buffer, format="PNG")
    return Response(content=buffer.getvalue(), media_type="image/png")

@app.get("/assets")
def list_assets() -> dict:
    return {"assets": asset_store.list_assets()}


def _png_bytes(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _png_b64(image: Image.Image) -> str:
    return base64.b64encode(_png_bytes(image)).decode("ascii")


@app.post("/stylize-object")
def stylize_object(
    style_prompt: str = Form(...),
    alpha: float = Form(1.0),
    tileset_path: str = Form(...),
    tile_width: int = Form(...),
    tile_height: int = Form(...),
    columns: int = Form(...),
    cells: str = Form(...),
    work_size: int = Form(tile_stylize.DEFAULT_WORK_SIZE),
    alpha_erode: int = Form(0),
):
    if not 0.0 <= alpha <= 1.0:
        return JSONResponse(status_code=422, content={"error": "alpha must be between 0.0 and 1.0"})
    if not 0 <= alpha_erode <= 3:
        return JSONResponse(status_code=422, content={"error": "alpha_erode must be between 0 and 3"})
    if not style_prompt.strip():
        return JSONResponse(status_code=422, content={"error": "style_prompt is required"})
    if not 1 <= tile_width <= 512 or not 1 <= tile_height <= 512 or columns < 1:
        return JSONResponse(status_code=422, content={"error": "invalid tile size or column count"})
    if work_size != 0 and not 64 <= work_size <= 2048:
        return JSONResponse(status_code=422, content={"error": "work_size must be 0 or between 64 and 2048"})

    try:
        cell_list = json.loads(cells)
        assert isinstance(cell_list, list) and 0 < len(cell_list) <= 2048
        for cell in cell_list:
            assert isinstance(cell["col"], int) and isinstance(cell["row"], int)
            assert isinstance(cell["tileId"], int) and cell["tileId"] >= 0
    except (AssertionError, KeyError, TypeError, json.JSONDecodeError):
        return JSONResponse(status_code=422, content={"error": "cells payload is invalid"})

    try:
        tileset_file = asset_store.resolve_asset_path(tileset_path)
    except ValueError as error:
        return JSONResponse(status_code=422, content={"error": str(error)})
    if not tileset_file.is_file():
        return JSONResponse(status_code=404, content={"error": f"tileset not found: {tileset_path}"})

    try:
        tileset_image = Image.open(tileset_file)
        tileset_image.load()
    except OSError:
        return JSONResponse(status_code=422, content={"error": "tileset image is invalid"})

    try:
        preview, patched = tile_stylize.stylize_tiles(
            tileset_image,
            cell_list,
            columns=columns,
            tile_width=tile_width,
            tile_height=tile_height,
            style_prompt=style_prompt,
            alpha=alpha,
            work_size=work_size,
            alpha_erode=alpha_erode,
        )
    except ValueError as error:
        return JSONResponse(status_code=422, content={"error": str(error)})
    except FileNotFoundError as error:
        return JSONResponse(status_code=503, content={"error": str(error)})

    return {"object_png": _png_b64(preview), "tileset_png": _png_b64(patched)}


@app.post("/stylize-monster")
def stylize_monster(
    style_prompt: str = Form(...),
    sheet_path: str = Form(...),
    monster_key: str = Form(...),
    alpha: float = Form(1.0),
    alpha_erode: int = Form(0),
):
    """Style monster sheets while preserving the background as much as possible."""
    if not 0.0 <= alpha <= 1.0:
        return JSONResponse(status_code=422, content={"error": "alpha must be between 0.0 and 1.0"})
    if not 0 <= alpha_erode <= 3:
        return JSONResponse(status_code=422, content={"error": "alpha_erode must be between 0 and 3"})
    if not style_prompt.strip():
        return JSONResponse(status_code=422, content={"error": "style_prompt is required"})
    if monster_key not in ("pig", "slime"):
        return JSONResponse(status_code=422, content={"error": f"unsupported monster key: {monster_key}"})

    try:
        sheet_bytes = asset_store.read_original_or_current(sheet_path)
    except ValueError as error:
        return JSONResponse(status_code=422, content={"error": str(error)})
    except FileNotFoundError as error:
        return JSONResponse(status_code=404, content={"error": str(error)})

    try:
        sheet_image = Image.open(io.BytesIO(sheet_bytes))
        sheet_image.load()
    except OSError:
        return JSONResponse(status_code=422, content={"error": "sheet image is invalid"})

    try:
        result = monster_stylize.stylize_monster_sheet(
            sheet_image, style_prompt, monster_key, alpha=alpha, alpha_erode=alpha_erode
        )
    except ValueError as error:
        return JSONResponse(status_code=422, content={"error": str(error)})
    except FileNotFoundError as error:
        return JSONResponse(status_code=503, content={"error": str(error)})

    buffer = io.BytesIO()
    result.save(buffer, format="PNG")
    return Response(content=buffer.getvalue(), media_type="image/png")


@app.post("/batch-apply")
def batch_apply(
    style_prompt: str = Form(...),
    targets: str = Form(...),
    alpha: float = Form(1.0),
    alpha_erode: int = Form(0),
):
    """Apply a prompt-based style transfer to many targets."""
    if not 0.0 <= alpha <= 1.0:
        return JSONResponse(status_code=422, content={"error": "alpha must be between 0.0 and 1.0"})
    if not 0 <= alpha_erode <= 3:
        return JSONResponse(status_code=422, content={"error": "alpha_erode must be between 0 and 3"})
    if not style_prompt.strip():
        return JSONResponse(status_code=422, content={"error": "style_prompt is required"})

    try:
        target_list = json.loads(targets)
        assert isinstance(target_list, list) and 0 < len(target_list) <= 256
    except (AssertionError, TypeError, json.JSONDecodeError):
        return JSONResponse(status_code=422, content={"error": "targets payload is invalid"})

    pending: dict[str, Image.Image] = {}

    def _working(path: str) -> Image.Image:
        if path not in pending:
            image = Image.open(asset_store.resolve_asset_path(path))
            image.load()
            pending[path] = image
        return pending[path]

    applied: list[str] = []
    failed: list[dict] = []
    for target in target_list:
        try:
            kind = target.get("kind")
            if kind == "asset":
                path = target["path"]
                source = Image.open(asset_store.resolve_asset_path(path))
                source.load()
                pending[path] = sdxl_service.style_transfer_image(
                    source,
                    style_prompt,
                    alpha=alpha,
                    alpha_erode=alpha_erode,
                    preserve_size=True,
                )
                applied.append(path)
            elif kind == "object":
                key = target["key"]
                meta = object_extract.read_meta(key)
                cutout = Image.open(io.BytesIO(object_extract.read_png(key)))
                cutout.load()
                styled = sdxl_service.style_transfer_image(
                    cutout,
                    style_prompt,
                    alpha=alpha,
                    alpha_erode=alpha_erode,
                )
                pending[meta["tilesetPath"]] = tile_stylize.patch_tileset_from_object(
                    _working(meta["tilesetPath"]),
                    styled,
                    meta["cells"],
                    columns=meta["columns"],
                    tile_width=meta["tileWidth"],
                    tile_height=meta["tileHeight"],
                )
                applied.append(key)
            elif kind == "monster":
                path = target["sheet_path"]
                sheet = Image.open(io.BytesIO(asset_store.read_original_or_current(path)))
                sheet.load()
                pending[path] = monster_stylize.stylize_monster_sheet(
                    sheet,
                    style_prompt,
                    target["monster_key"],
                    alpha=alpha,
                    alpha_erode=alpha_erode,
                )
                applied.append(path)
            else:
                failed.append({"target": str(target), "error": "unsupported target kind"})
        except (KeyError, TypeError, ValueError, FileNotFoundError, OSError) as error:
            failed.append({"target": str(target), "error": str(error)})

    for path, image in pending.items():
        try:
            asset_store.backup_and_write(path, _png_bytes(image))
        except (ValueError, FileNotFoundError, OSError) as error:
            failed.append({"target": path, "error": str(error)})
    return {"applied": applied, "failed": failed, "written": list(pending.keys())}


@app.get("/asset-status")
def asset_status(path: str):
    try:
        return asset_store.asset_status(path)
    except ValueError as error:
        return JSONResponse(status_code=422, content={"error": str(error)})


def _validate_cells(cell_list) -> bool:
    if not isinstance(cell_list, list) or not 0 < len(cell_list) <= 2048:
        return False
    for cell in cell_list:
        if not isinstance(cell, dict):
            return False
        if not all(isinstance(cell.get(field), int) for field in ("col", "row", "tileId")):
            return False
        if cell["tileId"] < 0:
            return False
    return True


@app.post("/extract-objects")
def extract_objects(payload: dict = Body(...)):
    """맵 인식 시점의 배치 누끼 추출. 이미 추출된 오브젝트는 건너뛴다."""
    tileset_path = payload.get("tileset_path")
    tile_width = payload.get("tile_width")
    tile_height = payload.get("tile_height")
    columns = payload.get("columns")
    objects = payload.get("objects")
    if (
        not isinstance(tileset_path, str)
        or not isinstance(tile_width, int)
        or not isinstance(tile_height, int)
        or not isinstance(columns, int)
        or not 1 <= tile_width <= 512
        or not 1 <= tile_height <= 512
        or columns < 1
        or not isinstance(objects, list)
        or not 0 < len(objects) <= 256
    ):
        return JSONResponse(status_code=422, content={"error": "추출 요청 형식이 올바르지 않습니다."})
    for entry in objects:
        if not isinstance(entry, dict) or "id" not in entry or not _validate_cells(entry.get("cells")):
            return JSONResponse(status_code=422, content={"error": "오브젝트 셀 형식이 올바르지 않습니다."})

    try:
        return object_extract.extract_objects(tileset_path, tile_width, tile_height, columns, objects)
    except ValueError as error:
        return JSONResponse(status_code=422, content={"error": str(error)})
    except FileNotFoundError as error:
        return JSONResponse(status_code=404, content={"error": str(error)})


@app.get("/extracted-objects")
def list_extracted_objects() -> dict:
    return {"objects": object_extract.list_objects()}


@app.get("/extracted-objects/{key}.png")
def extracted_object_png(key: str):
    try:
        return Response(content=object_extract.read_png(key), media_type="image/png")
    except ValueError as error:
        return JSONResponse(status_code=422, content={"error": str(error)})
    except FileNotFoundError as error:
        return JSONResponse(status_code=404, content={"error": str(error)})


@app.post("/apply-object")
def apply_object(file: UploadFile = File(...), object_key: str = Form(...)):
    """스타일 적용된 오브젝트 PNG를 타일셋에 역패치해 게임 에셋에 반영한다(백업 포함)."""
    data = file.file.read()
    try:
        probe = Image.open(io.BytesIO(data))
        probe.load()
    except OSError:
        return JSONResponse(status_code=422, content={"error": "PNG로 해석할 수 없는 데이터입니다."})

    try:
        return object_extract.apply_styled_object(object_key, data)
    except ValueError as error:
        return JSONResponse(status_code=422, content={"error": str(error)})
    except FileNotFoundError as error:
        return JSONResponse(status_code=404, content={"error": str(error)})


@app.post("/revert-asset")
def revert_asset(path: str = Form(...)):
    try:
        asset_store.revert_asset(path)
    except ValueError as error:
        return JSONResponse(status_code=422, content={"error": str(error)})
    except FileNotFoundError as error:
        return JSONResponse(status_code=404, content={"error": str(error)})
    return {"ok": True}


@app.get("/styled-assets")
def styled_assets() -> dict:
    return {"assets": asset_store.list_styled_assets()}


@app.post("/revert-assets")
def revert_assets(payload: dict = Body(...)):
    """여러 에셋을 한 요청으로 일괄 복원한다(전체/선택 되돌리기). 항목별 성공/실패를 모은다."""
    paths = payload.get("paths")
    if not isinstance(paths, list) or not 0 < len(paths) <= 1024:
        return JSONResponse(status_code=422, content={"error": "paths 형식이 올바르지 않습니다."})
    reverted: list[str] = []
    failed: list[dict] = []
    for path in paths:
        if not isinstance(path, str):
            failed.append({"path": str(path), "error": "경로가 문자열이 아닙니다."})
            continue
        try:
            asset_store.revert_asset(path)
            reverted.append(path)
        except (ValueError, FileNotFoundError) as error:
            failed.append({"path": path, "error": str(error)})
    return {"reverted": reverted, "failed": failed}


@app.post("/apply-asset")
def apply_asset(file: UploadFile = File(...), path: str = Form(...)):
    data = file.file.read()
    try:
        # 깨진 데이터로 게임 에셋을 덮어쓰지 않도록 먼저 PNG로 디코딩되는지 확인한다.
        probe = Image.open(io.BytesIO(data))
        probe.load()
    except OSError:
        return JSONResponse(status_code=422, content={"error": "PNG로 해석할 수 없는 데이터입니다."})

    try:
        backup = asset_store.backup_and_write(path, data)
    except ValueError as error:
        return JSONResponse(status_code=422, content={"error": str(error)})
    except FileNotFoundError as error:
        return JSONResponse(status_code=404, content={"error": str(error)})
    return {"ok": True, "backup": backup}


# ── 외부 게임 프로젝트(예: Love2D Legend of Lua) 스프라이트 직접 스타일 적용 ──
# my-sample-rpg 에셋과 분리된 external_assets 게이트(originals-ext/, backups-ext/)를 쓴다.
# 외부 폴더는 Vite 감시 밖이라 적용해도 에디터/게임 자동 리로드가 없다 — 게임을 다시
# 실행하면 반영된다(스프라이트는 시작 시 1회 로드).


def _ext_area_ok(image: Image.Image, content_size: int = 512) -> bool:
    short_edge = min(image.width, image.height)
    if short_edge == 0:
        return False
    scale = content_size / short_edge
    return image.width * scale * image.height * scale <= 4096 * 4096


@app.get("/ext/projects")
def ext_projects() -> dict:
    return {"projects": external_assets.get_projects()}


@app.get("/ext/assets")
def ext_assets(project: str):
    try:
        return {"assets": external_assets.list_assets(project)}
    except ValueError as error:
        return JSONResponse(status_code=404, content={"error": str(error)})


@app.get("/ext/asset")
def ext_asset(project: str, path: str):
    """외부 스프라이트 원시 PNG(썸네일/미리보기용). 외부 폴더는 Vite가 서빙하지 않으므로
    에디터는 이 엔드포인트로 이미지를 받는다."""
    try:
        return Response(content=external_assets.read_png(project, path), media_type="image/png")
    except ValueError as error:
        return JSONResponse(status_code=422, content={"error": str(error)})
    except FileNotFoundError as error:
        return JSONResponse(status_code=404, content={"error": str(error)})


@app.get("/ext/asset-status")
def ext_asset_status(project: str, path: str):
    try:
        return external_assets.asset_status(project, path)
    except ValueError as error:
        return JSONResponse(status_code=422, content={"error": str(error)})


@app.get("/ext/styled")
def ext_styled(project: str):
    try:
        return {"assets": external_assets.list_styled_assets(project)}
    except ValueError as error:
        return JSONResponse(status_code=404, content={"error": str(error)})


@app.post("/ext/apply")
def ext_apply(payload: dict = Body(...)):
    project = payload.get("project")
    path = payload.get("path")
    style_prompt = payload.get("style_prompt")
    alpha = payload.get("alpha", 1.0)
    alpha_erode = payload.get("alpha_erode", 0)
    if not isinstance(project, str) or not isinstance(path, str):
        return JSONResponse(status_code=422, content={"error": "project/path payload is invalid"})
    if not isinstance(style_prompt, str) or not style_prompt.strip():
        return JSONResponse(status_code=422, content={"error": "style_prompt is required"})
    if not isinstance(alpha, (int, float)) or not 0.0 <= float(alpha) <= 1.0:
        return JSONResponse(status_code=422, content={"error": "alpha must be between 0.0 and 1.0"})
    if not isinstance(alpha_erode, int) or not 0 <= alpha_erode <= 3:
        return JSONResponse(status_code=422, content={"error": "alpha_erode must be between 0 and 3"})

    try:
        source_bytes = external_assets.read_original_or_current(project, path)
    except ValueError as error:
        return JSONResponse(status_code=422, content={"error": str(error)})
    except FileNotFoundError as error:
        return JSONResponse(status_code=404, content={"error": str(error)})

    try:
        source = Image.open(io.BytesIO(source_bytes))
        source.load()
    except OSError:
        return JSONResponse(status_code=422, content={"error": "source image is invalid"})

    if not _ext_area_ok(source):
        return JSONResponse(status_code=422, content={"error": "source image is too large"})

    try:
        result = sdxl_service.style_transfer_image(
            source, style_prompt, alpha=float(alpha), alpha_erode=alpha_erode, preserve_size=True
        )
    except FileNotFoundError as error:
        return JSONResponse(status_code=503, content={"error": str(error)})

    buffer = io.BytesIO()
    result.save(buffer, format="PNG")
    try:
        backup = external_assets.backup_and_write(project, path, buffer.getvalue())
    except ValueError as error:
        return JSONResponse(status_code=422, content={"error": str(error)})
    except FileNotFoundError as error:
        return JSONResponse(status_code=404, content={"error": str(error)})
    return {"ok": True, "backup": backup}


@app.post("/ext/batch-apply")
def ext_batch_apply(
    style_prompt: str = Form(...),
    project: str = Form(...),
    paths: str = Form(...),
    alpha: float = Form(1.0),
    alpha_erode: int = Form(0),
):
    """Apply a prompt-based style transfer to many external project sprites."""
    if not 0.0 <= alpha <= 1.0:
        return JSONResponse(status_code=422, content={"error": "alpha must be between 0.0 and 1.0"})
    if not 0 <= alpha_erode <= 3:
        return JSONResponse(status_code=422, content={"error": "alpha_erode must be between 0 and 3"})
    if not style_prompt.strip():
        return JSONResponse(status_code=422, content={"error": "style_prompt is required"})
    try:
        path_list = json.loads(paths)
        assert isinstance(path_list, list) and 0 < len(path_list) <= 256
    except (json.JSONDecodeError, AssertionError):
        return JSONResponse(status_code=422, content={"error": "paths payload is invalid"})

    applied: list[str] = []
    failed: list[dict] = []
    for path in path_list:
        try:
            source = Image.open(io.BytesIO(external_assets.read_original_or_current(project, path)))
            source.load()
            if not _ext_area_ok(source):
                raise ValueError("source image is too large")
            result = sdxl_service.style_transfer_image(
                source, style_prompt, alpha=alpha, alpha_erode=alpha_erode, preserve_size=True
            )
            buffer = io.BytesIO()
            result.save(buffer, format="PNG")
            external_assets.backup_and_write(project, path, buffer.getvalue())
            applied.append(path)
        except (ValueError, FileNotFoundError, OSError) as error:
            failed.append({"path": str(path), "error": str(error)})
    return {"applied": applied, "failed": failed}


@app.post("/ext/revert")
def ext_revert(payload: dict = Body(...)):
    """외부 스프라이트를 최초 원본으로 일괄 복원한다(전체/선택 되돌리기)."""
    project = payload.get("project")
    paths = payload.get("paths")
    if not isinstance(project, str) or not isinstance(paths, list) or not 0 < len(paths) <= 1024:
        return JSONResponse(status_code=422, content={"error": "project/paths 형식이 올바르지 않습니다."})
    reverted: list[str] = []
    failed: list[dict] = []
    for path in paths:
        if not isinstance(path, str):
            failed.append({"path": str(path), "error": "경로가 문자열이 아닙니다."})
            continue
        try:
            external_assets.revert_asset(project, path)
            reverted.append(path)
        except (ValueError, FileNotFoundError) as error:
            failed.append({"path": path, "error": str(error)})
    return {"reverted": reverted, "failed": failed}


# ── SpecDriven Asset Restyling 파이프라인 (디벨롭 방향 8/6) ──
# Stage 1: 에디터 LLM이 만든 StyleSpec 저장/조회 (immutable은 서버가 강제)
# Stage 2: 스타일 앵커 생성·캐싱·승인 게이트
# Stage 0: 에셋 인벤토리 (카테고리 라우팅의 근거)
# Stage 3~5: 라우팅→변환→규격 스냅→QA→적용 (pipeline_run)


@app.post("/pipeline/spec")
def pipeline_save_spec(payload: dict = Body(...)):
    try:
        spec = style_spec.save_spec(payload)
    except ValueError as error:
        return JSONResponse(status_code=422, content={"error": str(error)})
    return {"ok": True, "spec": spec}


@app.get("/pipeline/specs")
def pipeline_list_specs() -> dict:
    return {"specs": style_spec.list_specs()}


@app.get("/pipeline/spec/{style_id}")
def pipeline_get_spec(style_id: str):
    try:
        return {"spec": style_spec.load_spec(style_id)}
    except ValueError as error:
        return JSONResponse(status_code=422, content={"error": str(error)})
    except FileNotFoundError as error:
        return JSONResponse(status_code=404, content={"error": str(error)})


@app.post("/pipeline/anchors/{style_id}")
def pipeline_generate_anchors(style_id: str, payload: dict = Body(default={})):
    force = bool(payload.get("force"))
    try:
        return anchor_service.generate_anchors(style_id, force=force)
    except ValueError as error:
        return JSONResponse(status_code=422, content={"error": str(error)})
    except FileNotFoundError as error:
        return JSONResponse(status_code=404, content={"error": str(error)})


@app.get("/pipeline/anchors/{style_id}")
def pipeline_list_anchors(style_id: str) -> dict:
    return {"style_id": style_id, "anchors": anchor_service.list_anchors(style_id)}


@app.get("/pipeline/anchors/{style_id}/{name}")
def pipeline_anchor_png(style_id: str, name: str):
    try:
        return Response(content=anchor_service.read_anchor(style_id, name), media_type="image/png")
    except ValueError as error:
        return JSONResponse(status_code=422, content={"error": str(error)})
    except FileNotFoundError as error:
        return JSONResponse(status_code=404, content={"error": str(error)})


@app.post("/pipeline/anchors/{style_id}/approve")
def pipeline_approve_anchors(style_id: str, payload: dict = Body(...)):
    approved = payload.get("approved")
    if not isinstance(approved, bool):
        return JSONResponse(status_code=422, content={"error": "approved(bool)가 필요합니다."})
    try:
        return anchor_service.approve_anchors(style_id, approved)
    except ValueError as error:
        return JSONResponse(status_code=422, content={"error": str(error)})
    except FileNotFoundError as error:
        return JSONResponse(status_code=404, content={"error": str(error)})


@app.get("/pipeline/original")
def pipeline_original(path: str):
    """변환 전 원본 PNG. 이미 적용된 에셋이라도 originals/에 시드된 최초 원본을 돌려주므로
    QA 리포트의 '전/후' 비교가 적용 여부와 무관하게 항상 올바른 쪽을 보여준다."""
    try:
        data = asset_store.read_original_or_current(path)
    except ValueError as error:
        return JSONResponse(status_code=422, content={"error": str(error)})
    except FileNotFoundError as error:
        return JSONResponse(status_code=404, content={"error": str(error)})
    return Response(content=data, media_type="image/png")


@app.get("/pipeline/object-original")
def pipeline_object_original(key: str):
    """묶인 오브젝트의 '변환 전' 캔버스.

    extracted-objects/<key>.png는 추출 시점의 '현재' 타일셋에서 뜬 것이라, 한 번
    스타일을 적용한 뒤 다시 추출되면 그게 원본처럼 보인다. 파이프라인은 항상
    originals/의 최초 타일셋에서 조립하므로, 전/후 비교도 같은 원본에서 떠야 맞다.
    """
    try:
        meta = object_extract.read_meta(key)
        tileset_image = Image.open(
            io.BytesIO(asset_store.read_original_or_current(meta["tilesetPath"]))
        )
        tileset_image.load()
        canvas, _, _ = tile_stylize.compose_object_canvas(
            tileset_image, meta["cells"], meta["columns"], meta["tileWidth"], meta["tileHeight"]
        )
    except ValueError as error:
        return JSONResponse(status_code=422, content={"error": str(error)})
    except (FileNotFoundError, KeyError) as error:
        return JSONResponse(status_code=404, content={"error": str(error)})
    return Response(content=_png_bytes(canvas), media_type="image/png")


@app.get("/pipeline/inventory")
def pipeline_inventory(rebuild: int = 0) -> dict:
    if rebuild:
        return inventory.build_inventory()
    return inventory.load_inventory()


@app.post("/pipeline/run")
def pipeline_execute(payload: dict = Body(...)):
    style_id = payload.get("style_id")
    targets = payload.get("targets")
    apply = bool(payload.get("apply"))
    alpha_erode = payload.get("alpha_erode", 0)
    if not isinstance(style_id, str) or not style_id:
        return JSONResponse(status_code=422, content={"error": "style_id가 필요합니다."})
    if not isinstance(targets, list) or not 0 < len(targets) <= 256:
        return JSONResponse(status_code=422, content={"error": "targets는 1~256개 목록이어야 합니다."})
    if not isinstance(alpha_erode, int) or not 0 <= alpha_erode <= 3:
        return JSONResponse(status_code=422, content={"error": "alpha_erode는 0~3이어야 합니다."})

    try:
        report = pipeline_run.run_pipeline(
            style_id, targets, apply=apply, alpha_erode=alpha_erode
        )
    except PermissionError as error:
        return JSONResponse(status_code=409, content={"error": str(error)})
    except ValueError as error:
        return JSONResponse(status_code=422, content={"error": str(error)})
    except FileNotFoundError as error:
        return JSONResponse(status_code=404, content={"error": str(error)})

    previews = report.pop("_previews", {})
    for entry in report["results"]:
        # 미리보기는 결과 id로 찾는다 — 묶인 오브젝트(분기 B)는 여러 오브젝트가 같은
        # tilesetPath를 공유해서 path로 키를 잡으면 서로 덮어쓴다.
        data = previews.get(entry.get("id"))
        if data is not None:
            entry["preview_png"] = base64.b64encode(data).decode("ascii")
    return report


if __name__ == "__main__":
    import uvicorn

    config = style_service_config.get_config()
    uvicorn.run(app, host=config["host"], port=config["port"])
