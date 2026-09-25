# 마을 이야기 공방 · My Sample RPG

## 현재 인수인계 · 2026-09-25

최신 진행: 3px 장식 여백을 `crypt_plan_style.py`의 일반 decorate 경로에 연결했습니다. 원본 알파 검증은 베이스 스프라이트에 적용하며 장식 알파는 독립적입니다. `composition_base_id` + `asset_revisions`로 기준 오버레이부터 재합성하므로 재생성 시 이전 여백이 누적되지 않습니다. `reprocess_ruins_plan.py`로 저장된 FLUX 원본을 재사용한 실행 `f3d2dfa8a0524ba1a5151458924c14a3`을 만들고 실제 에디터 적용·장식 토글·새로고침 유지와 0층 상태 불변을 확인했습니다. 이전 선택은 해당 실행의 `previous-active.json`에 백업됐습니다. 이번 검증은 모델 재호출 없이 추출/합성/적용 경로를 검증한 것입니다. 모든 126개 배치의 주변 가림을 사람이 전수 검수한 것은 아닙니다. 아래 이전 실험의 미적용 기록과 구분합니다.

현재 통합 대상은 **Crypt 1층 폐허마을 (`floor-1-ruins`)**입니다. 아래의 과거 town 실험과 구분합니다. 기존 맵과 검수 결과를 유지하면서 스타일 편집 기능을 연결하는 중이며, 통합이 모두 완료된 상태는 아닙니다.

### 기본 원리

TMX 원본·배치 좌표 → 오브젝트 그룹 구성 → DSL/Plan으로 대상과 동작 지정 → 원본 색·명암 보정 또는 FLUX 장식 생성 → RGBA 추출·원래 좌표에 합성 → 검수 후 적용.

원본의 형태·크기·문·창문·투명도·충돌 좌표는 유지합니다. 생성 이미지 전체로 원본을 교체하지 않고 장식과 색 보정을 별도 렌더링 계층에 반영합니다. 장식 스위치를 끄면 원본으로 돌아갑니다. 현재 분류는 TMX/연결 요소·규칙 기반이며 SAM이나 의미 분류 모델이 자동으로 모든 종류를 판별하는 방식은 아닙니다.

### 지금까지 완료한 작업

- 에디터 ↔ 스타일 변환 페이지 이동 시 게임·맵 정보를 전달하도록 수정했습니다. 대상 없는 스타일 페이지는 폐허마을을 기본으로 사용하며 `town` 실험은 명시적으로 선택해야 합니다.
- 폐허마을의 기존 적용 결과를 불러오고, 변경 목록·원본/결과/장식 비교·읽기 전용 Visual DSL을 연결했습니다. 기존 기록에 DSL/Plan이 없으면 추정 기록임을 표시합니다.
- 수동 DSL + Plan 계약을 검증하여 선택한 prop 그룹만 새 실행으로 처리하는 경로를 추가했습니다. 기존 결과의 원본 크롭·배치 좌표·소스 해시를 사용하고 선택하지 않은 결과는 유지합니다.
- 화면의 맵과 DSL 대상이 다르면 거부하며, 소스/알파/계약 검증 및 적용 시 부모 결과 변경 여부를 검사합니다. 검수·승인 전에는 현재 맵을 바꾸지 않습니다.
- 실행별 계약·이미지·시간·이벤트 로그를 별도 보관합니다. 기존 실험, 왼쪽 자산 사이드바, 다른 층의 적용 상태는 유지했습니다.
- 관련 Python/TypeScript 테스트와 프로덕션 빌드 통과, 브라우저에서 폐허마을 표시·기존 결과 로드·왕복 링크를 확인했습니다. **이번 연결 수정 후 새 FLUX 생성부터 승인까지의 실측 검증은 아직 하지 않았습니다.**

### 실행 방법

Node.js 20.19+ 또는 22.12+, Python, Git LFS가 필요합니다. 저장소 루트에서 실행합니다.

```powershell
git lfs install
git lfs pull
npm ci
python -m pip install fastapi uvicorn pillow numpy requests
# 기존 FLUX /style-transfer 서비스 또는 SSH 터널 주소
$env:THEME_FLUX_URL = 'http://127.0.0.1:18765'
npm run theme:dev
```

별도 터미널:

```powershell
npm run dev -- --host 127.0.0.1 --port 15174 --strictPort
```

- 에디터: <http://127.0.0.1:15174/editor.html?game=crypt&map=floor-1-ruins>
- 스타일 페이지: <http://127.0.0.1:15174/editor.html?workspace=style&game=crypt&map=floor-1-ruins>
- 현재 흐름: **프롬프트 해석 → 소품 그룹 선택 → 생성 → 비교 → 승인·적용**. `dsl.py`와 `planner.py`의 자체 규칙 기반 구현을 사용합니다. 고급 DSL/Plan 수동 입력도 유지합니다. 현재 자동 경로는 크리스마스/겨울의 눈·전구·고정 겨울 팔레트 보정과 기존 시간대 유지만 지원하며, 다른 테마/시간대·추가·삭제는 오류로 안내합니다. 기본 선택은 2종입니다. Crypt의 종류는 미분류 소품으로 표시하며 의미 분류 모델은 아직 없습니다.

FLUX 서버는 별도로 준비해야 하며 저장소를 복제하는 것만으로 서버 접속이나 GPU가 설정되지는 않습니다. 인증 정보는 포함하지 않습니다.

**새 PC에서 복원:** `public/theme-runs/`와 `public/crypt-style/active*.json`은 로컬 실행 상태라 Git에서 제외됩니다. `git lfs pull` 후 `python scripts/restore-crypt-ruins.py --apply`를 실행하면 기존 폐허마을 실행 `66d2311cc35045f9a32af7129994b055`과 보관 실험을 복원하고 1층에 선택합니다. `--apply`를 생략하면 이미지·기록만 복원합니다. 원본 해시와 레이어를 먼저 검증하고 기존에 다른 내용이 있으면 덮어쓰지 않고 중단합니다. Git 줄바꿈 차이만 허용하며 조정 전 메타데이터도 보관합니다. 기존 1층 선택은 백업하고 0층은 변경하지 않습니다. `scripts/restore-crypt-winter.py`는 **0층 전용**입니다.

복원 회귀 테스트: `python -m unittest discover -s scripts -p test_restore_crypt_ruins.py`. 실제 보관 ZIP과 원본 파일을 별도 임시 환경에서 검증합니다. 현재 실행 중인 에디터의 선택 상태는 테스트에서 수정하지 않습니다.

### 실험 보존 및 장식 여백 실험

모든 시도의 입력·프롬프트·생성 원본·추출·미리보기·시간·검수 기록은 실행별 폴더에 유지합니다. 후처리 재시도는 새 ID를 만들고 원본 실행 ID를 기록합니다. 사용자가 실패로 지정한 경우에만 별도 축소 보관 정책을 적용하며 원본을 임의 삭제하지 않습니다.

전체 로컬 실험/적용 상태의 무손실 백업: `python scripts/archive-theme-runs.py --output <백업폴더>`. 생성 중에는 거부하며, ZIP 안의 파일별 SHA-256과 원본을 비교합니다. 이는 수동 시점 백업이며 원격 서버 자동 백업 기능은 아닙니다.

`replay_ruins_margin.py <완료된 폐허마을 plan 실행 ID>`는 기존 FLUX 원본을 새 실행 폴더로 복사해 장식 여백을 재추출합니다. 원본 16×16은 유지하고 별도 22×22 장식에 (-3,-3) 좌표 보정을 사용합니다. 실제 후처리 실험 `ae6211249ccc42eb905c30a8ed385c64`는 `af808aca4ca148c59d5cfaeab276637b`를 재사용했고 모델 재호출은 없었습니다. 원본 밖 장식 픽셀 90/21개가 보존됐으며 현재 `awaiting_review`로 게임 미적용입니다. 일반 생성 경로에는 아직 기본 적용하지 않았습니다. 주변 오브젝트 가림·그림자 잔여물·실제 게임 배치는 추가 검수가 필요합니다.

### 앞으로 해야 할 작업

1. **복원 후 실행 검증:** 1층 복원 명령과 격리 환경 회귀 테스트 구현 완료. 새 PC의 전체 clone에서 의존성 설치부터 브라우저 실행까지 추가 확인.
2. **실제 모델 검증:** `af808aca4ca148c59d5cfaeab276637b`에서 prop-00/01을 실제 FLUX로 생성(각 HTTP 요청 약 203/204초). 16×16 크기·알파 일치, 선택한 126곳 밖 변경 픽셀 0개 확인. 작은 눈과 실루엣 밖 전구의 추출 손실로 적용은 보류했습니다. 별도 장식 여백/표면 마스크 개선 후 승인·새로고침·장식 토글·다른 층 비영향 검증이 남았습니다. 원본·생성·검수 기록은 로컬 실행 폴더에 보존하며 사용자 지정 실패본으로 분류하지 않았습니다.
3. **DSL·Planner 확장:** 세리팀 설계를 참고한 자체 규칙 기반 모듈을 구현하고 UI에 연결했습니다. `ae60917036954007807994cd59421578`에서 프롬프트→계획→2종 색 보정 완료를 검증했습니다(게임 미적용). 자유로운 자연어/세부 색상 해석과 의미 분류, 다양한 테마 지원은 후속 작업입니다.
4. **지원 범위 확장:** 현재 수정 경로는 기존 크리스마스 조명을 유지한 prop 그룹 대상입니다. 바닥·벽 재테마, 다른 테마/시간대, add/cover, 후보 선택·seed 제어는 지원 여부를 명시하며 별도 구현·검증해야 합니다.
5. **품질/검수 개선:** 작은 전구·눈의 잘림, 잔여 배경·그림자, 그룹별 맞춤 마스크와 배치 프로필 개선. 신규 부분 실행의 결과 목록에서 상속 결과와 새 생성 결과 구분.
6. **실패 기록 정책:** 사용자가 실패라고 지정한 이미지에 한해서 작은 압축본을 서버의 지정 위치에 모으는 기능 추가. 자동 실패 판정으로 원본을 삭제하거나 임의 압축하지 않습니다.

구현 상세: [통합 경로와 제한](docs/prompt-theme-integration.md), [Crypt 맵/겨울 변환](docs/crypt-map-import.md). 아래는 이전 실험 및 프로젝트 전체 설명입니다.

## 1층 폐허마을 겨울 결과 (2026-09-10)

6144×6144 맵의 오브젝트 45종 / 1,193곳과 바닥·벽·식물 타일 43종을 겨울 테마로 변환했습니다. 원본 구조·투명도·충돌·TMX 그림자 투명도를 유지하고, 현수막 전구와 반짝임을 추가했습니다. 작은 가지 4종은 눈 장식 미검출로 서리 색 보정만 적용했습니다. 0층과 1층의 적용 상태는 별도로 보존합니다.

- [전체 맵 이미지](public/experiments/crypt-ruins-winter-20260910/preview.png)
- [88종 결과·원본·FLUX 프롬프트·시간·시행착오 ZIP](public/experiments/crypt-ruins-winter-20260910/results.zip) — Git LFS, 약 60MB. PNG는 바로 열 수 있으며 review.html은 개발 서버가 필요합니다.
- [생성·적용 구조](docs/crypt-map-import.md#floor-1-winter-pass)

## Crypt 마을 겨울 결과 (2026-09-10)

Crypt 마을의 집·울타리·나무·소품 9종을 1,786곳에 재사용하고, 눈 바닥과 얼음 질감 꽃·풀 78곳을 추가했습니다. 원본 TMX·충돌은 유지하며 장식 버튼으로 전체 효과를 끌 수 있습니다.

- [전체 맵 미리보기](public/experiments/crypt-winter-20260910/preview.png)
- [이미지·프롬프트·생성 시간·검증 로그 ZIP](public/experiments/crypt-winter-20260910/results.zip) — Git LFS 파일입니다.
- [구현·실행 설명](docs/crypt-map-import.md)

저장된 결과 실행: `git lfs pull` → `python scripts/restore-crypt-winter.py --apply` → 별도 터미널에서 `npm run theme:dev`와 `npm run dev -- --port 15174` 실행 → `http://127.0.0.1:15174/editor.html?game=crypt&map=floor-0-town`. 저장 결과 재생에는 GPU가 필요하지 않으며, 새 생성에는 FLUX 서버가 필요합니다. 복원은 기존의 다른 실험 파일을 덮어쓰지 않습니다.

장식 실험: [생성 과정·시행착오·데모 실행 방법](docs/decoration-generation-history.md). 에디터 상단의 **첫 결과 복원 · 크리스마스**로 원본 맵을 유지한 눈·전구·밤·반짝임 효과를 적용합니다. 현재 결과는 새 생성이 아니라 최초 검수한 FLUX 장식 재사용입니다. [복원 미리보기](public/experiments/restored-first-quality/preview.png) · [서버 실험 코드와 한계](experiments/prompt-theme-server/README.md).

## 원본 보존형 스타일 변환 논리

**FLUX만 사용**하며, [오브젝트별 맞춤 프로필](docs/object-profile-workflow.md)로 생성 조건·장식 영역·보호 영역·배치 좌표를 관리합니다. FLUX가 RGB 그림을 만들고 코드가 장식을 RGBA로 추출합니다. Qwen-Image-Layered는 도입하지 않았습니다. 왼쪽은 이전 접이식 목록 사이드바로 복원했고, 상단 **스타일 변환**에서 새 생성·미리보기·승인·저장을 실행합니다. [실행 방법](docs/prompt-theme-integration.md).

**프롬프트 해석 → TMX 원본 추출 → 색·명암 보정 → 오브젝트별 FLUX 장식 생성 → 표면별 추출·정렬 → 밤·반짝임 → 미리보기·승인·저장**

- 원본 타일을 TMX 좌표로 합쳐 오브젝트를 구성하고, 형태·크기·문·창문·투명도·충돌을 유지한 채 색과 명암만 보정한다.
- 건물·나무·분수는 각각 원본을 FLUX에 입력한다. 생성된 오브젝트 전체를 덮어씌우지 않고, 건물의 지붕·처마, 나무의 잎, 분수의 테두리에 해당하는 장식만 추출한다. 건물 전구는 생성된 전구를 원본 처마에 맞춰 배치한다.
- 천막만 눈 띠·전구줄을 따로 생성해 원본 천막 끝에 정렬한다. 동일한 장식 띠를 모든 오브젝트에 반복 적용하지 않는다.
- 새 장식과 밤·반짝임은 별도 데코레이션 레이어에 두며, 원본 색 보정도 같은 스위치에 연동한다. 끄면 원본 모습으로 돌아간다.
- 미리보기 승인 후 적용·저장한다. 생성 원본과 마스크, 정렬 보정 결과, 이전 적용 상태를 보존한다.

현재 프롬프트 해석과 표면 추출은 규칙·색상·좌표 기반이므로 수동 검수가 필요하다. 자동 생성은 `npm run theme:dev`와 FLUX 서버가 필요하며, GPU 없이 저장된 결과만 볼 때는 **첫 결과 복원 · 크리스마스**를 사용한다. 적용 상태는 현재 브라우저에 저장하며 원격 에디터의 상태를 덮어쓰지 않는다.

타일맵 기반 2D 웹 RPG와, 그 게임의 콘텐츠를 자연어로 만드는 **LLM 시나리오 에디터**, 그리고 스프라이트를 신경망으로 다시 칠하는 **스타일 변환 서비스**를 한 저장소에 담은 캡스톤 프로젝트입니다.

특징은 게임의 **순수 규칙/로직을 Lua(WebAssembly)로 전환**해, 엔진/렌더(TypeScript·PixiJS)와 게임 규칙(Lua)을 분리한 점입니다.

세 가지 축으로 구성됩니다.

| 축 | 위치 | 역할 |
|---|---|---|
| 🎮 **게임** | `src/games/my-sample-rpg` | PixiJS v8로 렌더하는 탑다운 액션 RPG (Tiled 맵) |
| 🛠 **에디터** | `src/editor` (`/editor.html`) | NPC 대사·퀘스트·배치·스타일을 자연어로 만드는 LLM 저작 도구 |
| 🎨 **스타일 서비스** | `style-service` (Python) | SDXL img2img 스타일 변환 + 오브젝트 누끼 추출 |

---

## 빠른 시작

> 요구사항: **Node.js 20.19+ / 22.12+** (Vite 7), npm. (스타일 변환을 쓰려면 Python 3 + PyTorch 추가 — 아래 참고)

```bash
cd chichi
npm install
npm run dev
```

- 게임: <http://localhost:5173/>
- 에디터: <http://localhost:5173/editor.html>

> 하나의 Vite dev 서버가 두 페이지를 함께 서빙합니다(별도 라우터 없이 파일 기반). 포트를 따로 지정하지 않아 Vite 7 기본값 **5173**을 씁니다.

---

## 🎮 게임 (`src/games/my-sample-rpg`)

PixiJS v8로 렌더하는 **탑다운 2D 액션 RPG**. 맵은 직교(orthogonal) **Tiled TMX**(50×50, 32px)이고 외부 `.tsx` 타일셋을 참조합니다.

- **3개 씬** — `town` / `hunting-ground` / `cave`, 각 씬 진입 시 인트로 타이틀 표시
- **NPC 대화/상호작용** — Tiled 이벤트 레이어에서 스폰, 일부 NPC는 Lua 컨트롤러 스크립트(`reply-with-message`, `wander-near-home`)로 동작
- **실시간 전투** — HP 기반 몬스터 전투(레벨 스케일), 처치 시 경험치·골드·스킬포인트·장비 드롭
- **성장/인벤토리** — 레벨업(XP 곡선), 5종 장비 슬롯, 슬롯형 인벤토리, 스킬(`smash`·`protect`, Q/W/E/R), 소비 퀵슬롯 6칸(1–6)
- **상점** — 물약 상점 / 대장간(구매·판매)
- **퀘스트** — 다단계 퀘스트 체인(q001–q008), 목표 타입(처치/사용/상점/씬진입/대화)과 퀘스트 진행 상태
- **조작/세이브** — 재바인딩 가능한 키 설정, 플레이어 상태(프로필·장비·인벤·퀵슬롯·스킬슬롯)를 `localStorage`에 버전드 포맷으로 저장/복원
- **회피/스킬 모션** — 방향 구르기(대시), 검 잔상 스매시

> 게임은 단독 실행되지만, 에디터가 `<iframe>`으로 임베드하면 이를 감지(`window.self !== window.top`)해 오디오를 강제 음소거하고, 에디터의 씬 전환·배치·이벤트 초안 메시지를 받습니다. (참고: 코드상 BGM은 기본 비활성 — SFX만 재생)

---

## 🛠 에디터 (`src/editor` · `/editor.html`)

비개발자가 **자연어로 게임 콘텐츠를 만드는** LLM 저작 도구("마을 이야기 공방"). 임베드된 라이브 게임을 보면서 작업합니다.

- **라이브 미리보기** — 게임을 iframe으로 띄우고 `postMessage`로 통신(에디터는 게임 런타임 코드를 직접 import하지 않음)
- **LLM 생성** — 고정된 로컬 vLLM 서버(`100.115.43.82:8000`)의 `qwen36-27b-int4-best`를 사용한다. 브라우저 호출은 Vite 프록시(`/api/llm`)를 경유한다
- **자연어 에디터 동작 라우팅** — 같은 LLM이 요청을 `create_npc`/`delete_npc`/`create_quest`/`switch_scene`/`generate_content` 도구 중 하나로 판별하고, 기존 생성·적용 파이프라인을 실행한다
- **생성 → 검증(dry-run) → 적용** 파이프라인, 퀘스트는 후보 생성 → 선택 → 이벤트 JSON 생성의 2단계
- **현재 맵 에셋 트리** — 현재 맵의 NPC·건물·오브젝트 목록(검색·전체 맵 토글)
- **배치 팔레트** — 타일/오브젝트/NPC를 마우스로 맵에 배치, 맵별 `localStorage` 영속, NPC 수기 추가(외형·이름·대사)
- **스타일 변환 UI** — SDXL 스타일 변환 모달 + 원본 복원 + 외부 게임 스프라이트 변환
- **스타일 파이프라인(이번 추가)** — 시나리오 → StyleSpec(LLM) → 앵커 승인 게이트 → 카테고리 라우팅 일괄 변환 → 규격 스냅 → 자동 QA. 자세한 내용은 [docs/style-pipeline.md](docs/style-pipeline.md)
- **평가/지표** — 생성 결과 수용/거부 평가, 세션 생성·검증 통과율 집계
- **에디터 편의(이번 추가)** — 하단 입력창(컴포저) **드래그 높이 조절**, 트리·팔레트 항목 **마우스 호버 시 확대 미리보기 툴팁**

> 타일 스타일 변환·NPC 팔레트·타일셋 미리보기는 현재 맵이 my-sample-rpg 에셋일 때만 활성화됩니다. 에디터 LLM 호출은 dev 서버 프록시와 `100.115.43.82:8000` 서버가 필요하고, 스타일 변환은 아래 Python 서비스가 떠 있어야 합니다.

---

## 🎨 스타일 변환 서비스 (`style-service`)

게임 스프라이트/타일/타일셋에 **SDXL img2img 스타일 변환**을 적용하는 로컬 Python(FastAPI/uvicorn) 서비스. `stabilityai/stable-diffusion-xl-base-1.0`을 사용하며, Vite 프록시 `/api/style → 127.0.0.1:8765`로 에디터와 연결됩니다.

```bash
cd chichi/style-service
pip install -r requirements.txt   # 최초 1회 (fastapi, uvicorn, python-multipart)
python server.py                  # 127.0.0.1:8765
```

- **전체/부분 스타일 변환** — 알파 보존, 변환 크기 제한, 경계 침식 옵션
- **오브젝트 누끼 추출** — 타일셋의 알파 타일을 합성해 투명 PNG로 추출(에디터가 맵 인식 시 자동 호출). *신경망 세그먼테이션이 아니라 타일 알파 합성 방식*
- **원본/백업/되돌리기** — 에셋별 원본 1회 시드 + 타임스탬프 백업, 항상 원본에서 다시 칠해 색 누적 방지
- **몬스터 시트** — 배경 보존 + 전경만 변환(프레임 슬라이싱 유지)
- **외부 게임** — `config.json`의 `lol`(Legend of Lua, Love2D) 에셋을 별도 네임스페이스로 변환
- **SpecDriven 파이프라인** — StyleSpec 저장(immutable 강제) → 앵커 생성·승인 → 인벤토리 기반 카테고리 라우팅(지형은 circular padding 이음새 모드) → 팔레트 스냅·알파 재적용 → QA 게이트(실루엣 IoU·팔레트 준수·이음새) 통과분만 적용 ([docs/style-pipeline.md](docs/style-pipeline.md))

> ⚠️ **PyTorch(`torch`)와 Diffusers가 필요**합니다. SDXL 모델은 최초 실행 시 다운로드되며, GPU와 충분한 VRAM이 필요합니다. 자세한 내용은 [docs/style-transfer.md](docs/style-transfer.md).

---

## ⚙️ Lua 아키텍처 (게임 로직의 WASM 전환)

게임의 **순수·결정적 로직**은 **Lua 5.3.6(WebAssembly)** 로 전환되어, `luaLogicHost.ts`가 만드는 **하나의 공유 Lua VM** 안에서 실행됩니다.

- **퍼사드** `lua/luaGameLogic.ts` 가 원본 TS와 **동일한 시그니처**로 함수를 내보내, 게임 호출부는 import 출처만 바꾸면 됩니다. `initLuaGameLogic()` 이전(또는 실패 시)에는 **TS 구현으로 폴백**합니다.
- **동등성 검증** — 각 모듈의 `*Lua.bridge.spec.ts`가 Node에서 실제 WASM VM을 띄워 **Lua 출력 == TS 출력**을 다양한 입력으로 확인합니다.
- **Lua인 것** — 몬스터(보상·전투·표시명·드롭 인덱스), 플레이어(스탯·성장·경험치·인벤·장비·소비·장착·스킬·스킬슬롯·퀵슬롯), 상점(물약·대장간), 퀘스트, 컨트롤/이동/구르기/스매시, 세이브 직렬화, 씬 인트로, 이벤트 검증/초안 등 (`assets/lua/*.lua`, 27개 래퍼).
- **TS(호스트)로 남는 것** — 렌더(PixiJS)·DOM·입력·오디오·네트워크는 본래 호스트 계층. 그 외 **동등성 검증이 불가능한** 것: 브라우저/번들러 API, 비결정적 LLM/네트워크, 그리고 **가변 횟수 난수**(`monsterPatrol.stepMonsterPatrol` — JS `Math.random` 시퀀스를 Lua에서 재현 불가). 정적 상수/데이터도 TS 소유로 직접 re-export.

```bash
# 게임 로직 Lua↔TS 동등성 스펙 실행 (전용 config)
npx vitest run --config vitest.lua-logic.config.ts

# Lua WASM 재빌드 (Emscripten)
npm run lua:build      # 또는 fetch+build: npm run lua:sync
```

> 주의: `npm run lua:bridge:test`는 `vitest.lua-bridge.config.ts`를 써서 **캐릭터 컨트롤러 런타임 스펙 하나만** 실행합니다. 게임 로직 동등성 스펙은 위 `vitest.lua-logic.config.ts`로 직접 실행하세요. 기본 `npm test`/`test:run`은 `*.test.ts`만 포함하고 `*.bridge.spec.ts`는 제외합니다.

---

## 📂 폴더 구조

```
chichi/
├─ index.html              # 게임 진입 (#app → src/games/my-sample-rpg/main.ts)
├─ editor.html             # 에디터 진입 (#editor-root → src/editor/editorPage.ts)
├─ vite.config.ts          # 멀티 페이지 빌드 + /api 프록시(llm·openai·anthropic·style)
├─ vitest.lua-logic.config.ts   # 게임 로직 Lua 브리지 스펙용
├─ vitest.lua-bridge.config.ts  # 캐릭터 컨트롤러 런타임 브리지 스펙용
├─ src/
│  ├─ games/my-sample-rpg/
│  │  ├─ main.ts                 # 게임 엔트리(부팅·세이브·에디터 브리지·오디오)
│  │  ├─ rendering/              # PixiJS v8 렌더러·게임 루프·HUD/오버레이
│  │  ├─ tiled/                  # Tiled TMX/TSX 파서
│  │  ├─ interaction/ · events/  # 상호작용·이벤트
│  │  ├─ lua/                    # Lua 호스트·퍼사드·래퍼 + *.bridge.spec.ts
│  │  └─ assets/
│  │     ├─ maps/                # town.tmx · hunting-ground.tmx · cave.tmx
│  │     └─ lua/                 # 변환된 Lua 로직 스크립트(*.lua) + json-codec.lua
│  ├─ editor/                    # LLM 시나리오 에디터(생성·검증·배치·스타일)
│  └─ games/legend-of-lua/       # (빈 자리표시자 — 실제 빌드는 public/legend-of-lua)
├─ style-service/          # Python SDXL 스타일 변환 서비스(server.py 등)
├─ public/
│  ├─ vendor/lua/          # 런타임 Lua WASM (lua-5.3.6.mjs / .wasm)
│  └─ legend-of-lua/       # Love2D love.js 사전 빌드(외부 게임)
├─ third_party/            # Lua 5.3.6 C 소스 + 공식 테스트 스위트(빌드 원본)
├─ scripts/                # Lua WASM fetch/build/test (.mjs)
├─ docs/                   # 설계·규칙·연동 문서(.md)
└─ licenses/ · notes/      # 라이선스 / (git 무시) 작업 노트
```

---

## 📜 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | Vite dev 서버(게임+에디터, `/api` 프록시) |
| `npm run build` | `tsc --noEmit` 후 멀티 페이지 빌드 |
| `npm run preview` | 프로덕션 빌드 미리보기 |
| `npm test` / `npm run test:run` | Vitest 감시 / 1회 실행(`*.test.ts`) |
| `npm run check` | `tsc --noEmit && vitest run` (통합 게이트) |
| `npm run lua:build` / `lua:sync` | Lua WASM 빌드 / 소스 fetch+빌드 |
| `npm run lua:test` | Node 기반 Lua WASM 테스트 하니스 |

프록시(개발 서버): `/api/llm → 100.115.43.82:8000`, `/api/openai → api.openai.com`, `/api/anthropic → api.anthropic.com`, `/api/style → 127.0.0.1:8765`.

---

## 🧰 기술 스택

TypeScript 5.9 · Vite 7 · PixiJS 8(`@pixi/tilemap`) · Tailwind CSS 4 · Vitest 3 · `@xmldom/xmldom`(TMX 파싱) · Lua 5.3.6(WASM, Emscripten) · Python(FastAPI/uvicorn) + PyTorch/Diffusers(SDXL).

## 📚 문서 (`docs/`)

`architecture.md`(모듈 경계) · `tech-stack.md` · `coding-standards.md` · `git-rules.md` · `testing-strategy.md` · `ai-setup.md` · `style-transfer.md`(SDXL 연동) · `lua-controller-api.md`(Lua 캐릭터 컨트롤러 계약) · `legend-of-lua-love-js.md` · `legend-of-lua-bridge-protocol.md`(외부 Love2D 게임 라이브 브리지).
