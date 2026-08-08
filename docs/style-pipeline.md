# SpecDriven Asset Restyling 파이프라인

8/6 「디벨롭 방향」 문서의 파이프라인 구현. 핵심 원칙: **정형화 vs 자유는 택일이 아니라 서로 다른 층이다.**

- **자유도**는 텍스트 층(시나리오 → LLM → StyleSpec)에만 준다.
- **일관성**은 승인된 스타일 앵커 + 제한 팔레트가 담당한다.
- **불변성**(실루엣·타일 격자·충돌)은 파이프라인 앞뒤의 결정론적 코드가 강제한다.

코드 트랙의 `자연어 → EventSpec(JSON) → Lua`와 대칭 구조: `시나리오 → StyleSpec(JSON) → 렌더링`.

## 전체 흐름

```
시나리오 텍스트
  → [Stage 1] LLM이 StyleSpec(JSON) 생성        (에디터, styleSpecGenerator.ts)
  → [스펙 저장] 서버 검증 + immutable 강제       (style_spec.py)
  → [Stage 2] 스타일 앵커 3~5장 생성·캐싱        (anchor_service.py, SDXL txt2img)
  → [승인 게이트] 사람이 앵커 확인 후 승인       (미승인이면 실행 차단, HTTP 409)
  → [Stage 0] 에셋 인벤토리 카테고리 라우팅      (inventory.py, .tsx 파싱)
  → [Stage 3] 카테고리별 분기 변환               (pipeline_run.py)
  → [Stage 4] 규격 스냅 (결정론적 후처리)        (postprocess.py)
  → [Stage 5] 자동 QA 게이트                     (qa_gate.py)
  → QA 통과분만 게임 에셋에 적용(백업 포함)
```

## 스테이지별 구현

### Stage 1 — StyleSpec (자유도 담당)

- 에디터 `styleSpec.ts` / `styleSpecGenerator.ts`: 시나리오 → 구조화 LLM 출력(기존 `generateJson` 재사용, Claude/GPT 겸용).
- **immutable(실루엣·타일 격자·충돌·앵커·알파 마스크)은 LLM 스키마에 아예 없다** — 클라이언트 `normalizeStyleSpec`과 서버 `style_spec.validate_spec` 양쪽에서 상수로 강제 주입한다.
- 팔레트(`n_colors` + hex `anchors`)가 곧 일관성 장치. `style_strength`는 단일 노브(0.1~0.9).
- 저장: `style-service/specs/<style_id>.json`. 스펙을 다시 저장하면 앵커 승인이 리셋된다.

### Stage 2 — 스타일 앵커 (스타일당 1회, 캐싱)

- `anchor_service.py`: 지형×2·오브젝트·캐릭처 대표 4장을 SDXL txt2img로 생성(고정 시드 파생 → 같은 스펙이면 항상 같은 앵커), 스펙 팔레트로 스냅 후 `anchors/<style_id>/`에 캐싱.
- txt2img 파이프라인은 img2img와 가중치를 공유한다(`from_pipe`) — VRAM 이중 적재 없음.
- **승인 게이트**: `anchors_approved`가 true가 되기 전에는 `/pipeline/run`이 409로 거부된다.
- StyleAligned(배치 어텐션 공유)·IP-Adapter 참조 주입은 SDXL 브랜치 검증 후 끼울 훅.

### Stage 0 — 에셋 인벤토리

- `inventory.py`: 에셋 폴더 스캔 + `.tsx` 파싱(타일 크기·columns·타일 타입 수) → `inventory.json`.
- 폴더 규칙으로 카테고리 태깅: `tilesets→terrain_tile`, `monsters/spritesheets/boss→character_sprite`, `portraits/fonts/skills→ui`, 그 외 `object`.
- `immutableRegions`(길 보호 등)·SAM 분할은 후속 훅 — 묶인 오브젝트는 현행 에디터 셀 선택+`object_extract` 흐름이 담당.

### Stage 3 — 카테고리 라우터

| 분기 | strength 배율 | 추가 처리 |
|---|---|---|
| terrain_tile (A) | ×0.7 (구조 우선) | **circular padding 몽키패치**(UNet/VAE Conv2d) — 이음새 1단계 |
| object — 단일 파일 | ×1.0 | — |
| **object — 묶인 오브젝트 (B)** | ×1.0 | **셀 조립 → 한 장으로 변환 → 타일셋 역패치** (아래 참조) |
| character_sprite (C) | ×0.85 | 실루엣 하드 제약(Stage 4 알파 재적용). pig/slime 시트는 기존 배경 보존 경로(`monster_stylize`) 재사용 |

#### 분기 B — 묶인 오브젝트 (타일 군집)

나무·건물처럼 **타일셋 안 여러 타일로 그려진 오브젝트**를 위한 경로다. 타일셋 PNG를 통째로
변환하면 오브젝트 하나가 수백 타일 중 일부로 섞여 형태가 무너진다(7/29 "타일이 단체로
합쳐져 있으면 안 바뀜"). 대신 변환 단위를 **파일이 아니라 오브젝트**로 바꾼다.

1. 사이드카 메타(`extracted-objects/<key>.json`)의 셀 목록으로 오브젝트를 **맵 배치 그대로 한 장에 조립**
   (`tile_stylize.compose_object_canvas`). 타일 원본이 알파를 가져 결과가 곧 누끼 RGBA다.
2. 정수배 NEAREST 업스케일 → 변환 → BOX 다운스케일 (`stylize_tiles`, 픽셀아트 타일은 원본이
   너무 작아 그대로는 스타일 통계가 빈약하다)
3. Stage 4 규격 스냅 → Stage 5 QA. **타일 격자를 알고 있으므로 이음새 축까지 평가**된다.
4. QA 통과 시 `object_extract.apply_styled_object`가 결과를 타일별로 잘라 **원래 타일 좌표에 역패치**.
   백업·원본 시드는 기존 `asset_store` 경로를 그대로 탄다.

조립 원본은 항상 `originals/`의 최초 타일셋에서 뜬다 — 여러 번 돌려도 색이 누적되지 않는다.
같은 타일을 공유하는 다른 오브젝트가 있으면 함께 바뀌므로, 목록에 `공유 타일 N` 배지로 표시한다.

실행 요청의 타깃은 두 형태를 받는다:

```json
{"path": "src/games/my-sample-rpg/assets/tilesets/town-32.png"}   // 단일 파일 (A/C)
{"kind": "extracted-object", "key": "tree_1"}                      // 묶인 오브젝트 (B)
```

"타일은 낮게, 컨셉은 높게"(denoising strength 카테고리 분리)가 여기 구현되어 있다.

### Stage 4 — 규격 스냅 (`postprocess.py`, 결정론)

AI 출력을 그대로 쓰지 않는다:

1. NN 다운스케일로 원본 크기 정합(픽셀 그리드 정렬)
2. 스펙 팔레트로 양자화(팔레트 스냅) — 색 일관성이 하드 제약
3. 원본 알파 마스크 재적용 — 실루엣 1픽셀도 불변

### Stage 5 — 자동 QA (`qa_gate.py`)

| 축 | 지표 | 임계값 |
|---|---|---|
| 구조 보존 | 실루엣 IoU | ≥ 0.995 |
| 스타일 일관성 | 팔레트 준수율 | ≥ 0.999 |
| 이음새 | 경계 패치 LPIPS (미설치 시 그래디언트 근사 폴백) | 점수 ≥ 0.55 |

`pip install lpips`로 지각 거리 기반 이음새 정량화가 켜진다. QA 실패분은 적용되지 않고 리포트에만 남는다(사람 검수 큐).

## API (style-service, `/api/style` 프록시 경유)

| 메서드 | 경로 | 역할 |
|---|---|---|
| POST | `/pipeline/spec` | StyleSpec 저장(검증+immutable 강제) |
| GET | `/pipeline/specs` · `/pipeline/spec/{id}` | 스펙 목록/조회 |
| POST | `/pipeline/anchors/{id}` | 앵커 생성(캐싱, `{"force":true}`로 재생성) |
| GET | `/pipeline/anchors/{id}` · `/{id}/{name}` | 앵커 목록/PNG |
| POST | `/pipeline/anchors/{id}/approve` | 승인 게이트 (`{"approved":bool}`) |
| GET | `/pipeline/inventory` | 인벤토리(`?rebuild=1` 재빌드) |
| GET | `/pipeline/original?path=` | 변환 전 원본 PNG(적용 후에도 최초 원본) — 결과 확대 비교용 |
| POST | `/pipeline/run` | 실행: `{style_id, targets:[{path}], apply, alpha_erode}` → 결과+QA 리포트+미리보기 |

## 에디터 사용법

에디터 첫 화면의 **"스타일 파이프라인"** 카드(또는 `createStylePipelinePanel`의 열기 버튼):

1. 시나리오 입력 → **StyleSpec 생성** (API 키는 에디터 설정 키 자동 사용)
2. 스펙 JSON 검토·수정 → **스펙 저장**
3. **앵커 생성** → 4장 확인 → **승인** (반려하면 재생성)
4. 카테고리별 대상 체크 → **파이프라인 실행** → QA 리포트 확인
5. "QA 통과분 즉시 적용" 체크 시 게임 에셋에 반영(기존 백업/되돌리기 체계 그대로)

리포트의 결과 카드를 **클릭하면 변환 전/후를 나란히 확대 비교**한다. 픽셀 그리드가 뭉개지지
않도록 NEAREST로 렌더하고 1×/2×/4×/8× 정수배 확대를 지원하며, 체커보드 배경으로 알파(투명)
영역을 확인할 수 있다. 'PNG 저장'으로 결과만 따로 내려받을 수도 있다.

## 테스트

- TS: `npx vitest run src/editor/styleSpec.test.ts` (immutable 강제·스키마 차단 포함)
- Python 결정론 층: GPU 없이 검증 가능 — 팔레트 스냅·알파 재적용·QA 축·인벤토리·스펙 라운드트립.

## 남은 트랙 (문서 Week 2~3)

- Lightning LoRA + GGUF 양자화(속도), 카테고리별 분리 LoRA 학습
- StyleAligned/IP-Adapter 앵커 참조 주입(SDXL 브랜치 검증 → Qwen 이식)
- latent rolling 하이브리드·WFC 배치(이음새 2·3단계)
- CSD/DreamSim/CMMD 지표 추가, Good/Bad 라벨 판별기 학습
