# 느티골 이야기 · My Sample RPG

LPC 그림체로 만든 **탑다운 2D 액션 RPG**입니다. 브라우저에서 PixiJS로 돌아가고, 게임 규칙은 Lua(WebAssembly)로 실행됩니다.
직업 없이 **손에 든 무기가 싸우는 법을 정하고**, 장마다 새 마을·사냥터·던전·보스가 열리는 이야기형 RPG를 목표로 합니다.
최종 목표는 10시간 이상 플레이할 수 있는 RPG입니다 ([로드맵](docs/game-roadmap-10h.md)).

> 예전 README에 있던 에디터·스타일 변환 파이프라인 인수인계 기록은 [docs/style-pipeline-history.md](docs/style-pipeline-history.md)로 옮겼습니다.

## 빠른 시작

> 요구사항: **Node.js 20.19+ / 22.12+** (Vite 7), npm

```bash
npm install
npm run dev
```

| 주소 | 내용 |
|---|---|
| <http://localhost:5173/> | 게임 |
| <http://localhost:5173/?tester> | **테스트 모드** — 최고 레벨, 모든 스킬 최대, 무기 계열마다 최고 등급 무기, 3등급 방어구, 상급 포션. 퀘스트로 잠긴 포탈과 귀환 표지석이 모두 열려 있고 세계 지도의 안개도 걷혀 있어 진행 없이 모든 지역을 다닐 수 있습니다(NPC·퀘스트는 원래 진행 그대로). 저장하지 않으므로 원래 진행은 그대로 남습니다 |
| <http://localhost:5173/boss-sim.html> | 시험 보스 전투 시뮬레이터 뷰어 (규칙 보스 vs RL 보스 비교) |
| <http://localhost:5173/editor.html> | LLM 콘텐츠 에디터 |

## 조작

| 키 | 동작 | 키 | 동작 |
|---|---|---|---|
| 방향키 | 이동 | `A` | 공격 |
| `Enter` / `Space` | 대화·상호작용 | `↑` (포탈 위에서) / `F` | 포탈 입장 |
| `Q` `W` `E` `R` | 스킬 슬롯 | `1`~`6` | 소비 퀵슬롯 |
| `I` | 가방 | `U` | 장비 |
| `K` | 스킬 | `S` | 스탯 |
| `B` | 퀘스트 | `M` | 세계 지도 |
| `Esc` | 설정 메뉴 (단축키 변경, 음량, 크레딧) | | |

- 스킬은 `K` 창의 **강화** 버튼으로 배우고 올립니다. 스킬 줄을 **더블클릭하면 그 스킬을 한 번 사용**하고, 아래 `Q`·`W`·`E`·`R` 칸으로 **끌어다 놓으면 장착**합니다. HUD 칸을 우클릭하면 해제됩니다.
- 소비 아이템은 가방에서 `1`~`6` 퀵슬롯으로 끌어다 놓고, 장비는 가방에서 장비창으로 끌거나 더블클릭해서 장착합니다.
- 왼쪽 위 **미니맵**은 지금 맵 전체를 보여 주고, 메이플스토리처럼 `+`/`−` 버튼으로 창 크기를 바꿉니다(끝까지 줄이면 이름 줄만 남게 접힘). `M`을 누르면 모든 지역이 나오는 **세계 지도**가 열리고, 아직 가 보지 않은 지역은 안개로 가려집니다.
- 모든 키는 `Esc` → 단축키 설정에서 바꿀 수 있습니다.

## 이야기와 지역

| 장 | 지역 | 상태 |
|---|---|---|
| **1장 느티골 — 무기의 길** | 느티골, 말캉이 숲, 어스름 굴, 잊힌 수정 광산, 물레골 | 완료 ([설계](docs/game-design-30min.md)) |
| **2장 잠긴숲과 고대 유적** | 윗물길, 갈대골(+우물 속), 잠긴숲, 물밑 신전 외곽, 물밑 신전 1층, 봉인의 방 | 메인·곁가지 완료 ([설계](docs/chapter2-sunken-forest.md)) |
| **3장 얼어붙은 북쪽** | 된바람재, 서리목, 거울못, 서리굴, 얼음 제단 | 메인·곁가지 구현, 플레이 확인 중 ([설계](docs/chapter3-frozen-north.md)) |
| 4장 이후 | 남쪽 불의 산 (3장 끝에 고리) | 계획 |

- 맵 18개(Tiled TMX), 퀘스트 50여 개(메인 + 곁가지).
- **귀환 표지석** — 한 번 찾은 표지석끼리 빠르게 이동합니다 (느티골·물레골·갈대골·신전 외곽 야영지·서리목).
- **지역 장치** — 2장 독안개, 3장 눈보라 등 지역마다 고유한 위험이 있습니다.
- **시험장** — RL로 학습한 시험 보스와 싸우는 별도 맵입니다.

## 전투와 성장

### 무기가 싸우는 법을 정한다

시작 직업이 없습니다. 장착한 무기 계열에 따라 공격 동작과 쓸 수 있는 스킬이 바뀝니다.

| 계열 | 기본 공격 | 1장 (Lv1) | 2장 (Lv15) | 3장 (Lv38) |
|---|---|---|---|---|
| 검 | 베기 | 베기 — 앞으로 검기 | 십자 베기 — 네 방향 검기 | 섬광 일섬 — 4칸 돌진, 경로 2회 타격, 돌진 중 무적 |
| 도끼 | 넓게 내려찍기 | 회오리 베기 — 주변 3회 | 대지 가르기 — 5칸 직선, 밀쳐내기 | 처형 — 체력 30% 이하 적에게 2배 |
| 활 | 조준 화살 | 멀티샷 · 관통 화살 · 독화살 | 화살비 — 4번 연속 일제 사격 | 폭풍 화살 — 부채꼴 관통 5발 |
| 지팡이 | 조준 에너지볼트 | 아이스 볼트 · 파이어볼 · 체인 라이트닝 | 눈보라 — 4회 타격 + 빙결 | 메테오 — 지연 대폭발 + 화상 |

- 균형 원칙은 **"위험을 감수하면 보상"** 입니다. 느리거나 가까이 붙어야 하는 무기일수록 한 방이 큽니다 ([무기 밸런스](docs/weapon-balance.md)).
- 공통 스킬(방어 자세, 돌진, 집중)과 방향 구르기(회피)가 있습니다.
- 공격 연출은 LPC 스프라이트 동작으로만 표현합니다.

### 성장

- 레벨업마다 스탯 포인트(힘·민첩·지력·행운)와 스킬 포인트를 얻습니다. 레벨 상한은 100입니다.
- 장비는 무기·옷·모자·신발·장신구·보조 장비 6칸, 장마다 한 등급씩 올라갑니다.
- 물약 상점과 대장간(구매·판매), 몬스터 장비 드롭, 등급별 포션이 있습니다.
- 공식과 레벨대는 [게임 밸런스](docs/game-balance.md)에 정리되어 있습니다.

### 보스와 강화학습

- 장마다 중간 보스와 최종 보스가 있습니다.
- **시험 보스**는 7가지 패턴을 가지고, 강화학습(MaskablePPO)으로 "언제 어떤 패턴을 쓸지"를 배웁니다. 목표는 이기는 보스가 아니라 **1~2분의 아슬아슬한 재미있는 싸움**입니다.
- 학습은 게임 규칙을 그대로 재사용하는 헤드리스 TS 시뮬레이터(`bossTraining/`)와 초보·보통·숙련 3단계 플레이어 봇으로 합니다. 학습한 정책은 JSON 가중치로 내보내 게임 안에서 바로 실행합니다.
- 결정 기록: [docs/boss-rl-design.md](docs/boss-rl-design.md)

```bash
npm run rl:build   # 시뮬레이터를 Python 학습 환경용으로 번들
npm run rl:pull    # 원격 서버에서 학습한 보스 정책 가져오기
```

### UI

- 하단 HUD(정보·체력/마나/경험치·스킬 Q/W/E/R·퀵슬롯), 퀘스트 추적기, 상태 이상 표시, 보스 체력바, 월드 지도.
- 가방·장비·스킬 창은 게임에 쓰는 Kenney Pixel Adventure 에셋의 **나무 액자 + 철 모서리** 픽셀 창 스타일입니다.
- 창은 화면을 막지 않아서 여러 창을 함께 열어 두고 끌어다 놓을 수 있습니다.

## Lua 게임 로직

게임의 순수·결정적 로직(전투, 보상, 성장, 인벤토리, 장비, 스킬, 상점, 퀘스트, 세이브 직렬화 등)은 **Lua 5.3.6(WebAssembly)** 로 실행됩니다.

- `lua/luaGameLogic.ts`가 원래 TS와 같은 시그니처로 함수를 내보내고, Lua를 쓸 수 없으면 TS 구현으로 돌아갑니다.
- 각 모듈의 `*Lua.bridge.spec.ts`가 실제 WASM VM에서 **Lua 결과 == TS 결과**를 확인합니다.
- 렌더링(PixiJS), DOM, 입력, 오디오, 그리고 가변 횟수 난수를 쓰는 로직은 TS(호스트)에 남습니다.
- NPC 행동은 Lua 컨트롤러 스크립트로 작성합니다 ([Lua 컨트롤러 API](docs/lua-controller-api.md)).

```bash
npx vitest run --config vitest.lua-logic.config.ts   # 게임 로직 Lua↔TS 동등성 스펙
npm run lua:build                                    # Lua WASM 재빌드 (fetch까지: npm run lua:sync)
```

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | Vite 개발 서버 (게임 + 에디터 + 보스 시뮬레이터) |
| `npm run build` | `tsc --noEmit` 후 멀티 페이지 빌드 |
| `npm run check` | `tsc --noEmit && vitest run` |
| `npm test` / `npm run test:run` | Vitest 감시 / 1회 실행 (`*.test.ts`) |
| `npm run lua:build` / `lua:sync` / `lua:test` | Lua WASM 빌드 / 소스 받기+빌드 / Lua 테스트 |
| `npm run rl:build` / `rl:pull` | 보스 RL 시뮬레이터 번들 / 학습 정책 가져오기 |

## 폴더 구조

```
├─ index.html / boss-sim.html / editor.html
├─ src/
│  ├─ games/my-sample-rpg/
│  │  ├─ main.ts            # 게임 진입 (부팅·세이브·테스트 모드)
│  │  ├─ *.ts               # 순수 게임 규칙 (전투·성장·스킬·장비·퀘스트·밸런스) + *.test.ts
│  │  ├─ rendering/         # PixiJS 렌더링, HUD·창 UI, mapView/ (전투·무기 모션·보스·이펙트)
│  │  ├─ lua/               # Lua 호스트·퍼사드 + *.bridge.spec.ts
│  │  ├─ bossTraining/      # 헤드리스 보스 전투 시뮬레이터, 플레이어 봇, RL 환경
│  │  ├─ bossSimViewer/     # boss-sim.html 뷰어
│  │  ├─ scenario/          # 시나리오·컷신 실행
│  │  ├─ tiled/             # TMX/TSX 파서
│  │  └─ assets/            # maps(18개 TMX), lua, 스프라이트, 폰트, 보스 정책
│  └─ editor/               # LLM 콘텐츠 에디터
├─ rl/                      # 보스 강화학습 (Python, stable-baselines3)
├─ style-service/           # SDXL 스타일 변환 서비스 (에디터용)
├─ scripts/                 # 맵 생성, Lua 빌드, 밸런스 리포트 등
├─ docs/                    # 설계·규칙 문서
└─ third_party/ · public/vendor/lua/   # Lua 소스와 WASM 빌드 결과
```

## 기술 스택

TypeScript 5.9 · Vite 7 · PixiJS 8 (`@pixi/tilemap`) · Tiled TMX · Lua 5.3.6 (WASM, Emscripten) · Tailwind CSS 4 · Vitest 3 · Python 3.12 + stable-baselines3/sb3-contrib (보스 RL, 오프라인).

## 에디터와 스타일 변환 (부가 도구)

- **에디터** (`/editor.html`): 실행 중인 게임을 보면서 자연어로 NPC·퀘스트·이벤트를 만들고 배치하는 LLM 저작 도구입니다. 생성 → 검증(dry-run) → 적용 순서로 반영합니다.
- **스타일 변환 서비스** (`style-service/`): 타일·스프라이트에 SDXL/FLUX 스타일 변환을 적용하는 로컬 Python 서비스입니다. GPU와 PyTorch가 필요합니다 ([style-transfer.md](docs/style-transfer.md), [style-pipeline.md](docs/style-pipeline.md)).
- 개발 서버 프록시: `/api/llm`, `/api/openai`, `/api/anthropic`, `/api/style → 127.0.0.1:8765`.
- 지난 작업 기록: [docs/style-pipeline-history.md](docs/style-pipeline-history.md)

## 문서

| 문서 | 내용 |
|---|---|
| [game-roadmap-10h.md](docs/game-roadmap-10h.md) | 10시간 로드맵, 장 구성 |
| [game-design-30min.md](docs/game-design-30min.md) · [chapter2](docs/chapter2-sunken-forest.md) · [chapter3](docs/chapter3-frozen-north.md) | 장별 설계와 진행 기록 |
| [game-balance.md](docs/game-balance.md) · [weapon-balance.md](docs/weapon-balance.md) | 성장 공식, 레벨대, 무기·스킬 밸런스 |
| [boss-rl-design.md](docs/boss-rl-design.md) | 보스 강화학습 결정 기록 |
| [architecture.md](docs/architecture.md) · [feature-modules.md](docs/feature-modules.md) | 모듈 경계, 새 기능을 모듈로 만드는 법 |
| [coding-standards.md](docs/coding-standards.md) · [testing-strategy.md](docs/testing-strategy.md) · [git-rules.md](docs/git-rules.md) | 개발 규칙 |
| [lua-controller-api.md](docs/lua-controller-api.md) · [scenario-interpreter-decision.md](docs/scenario-interpreter-decision.md) | Lua 컨트롤러 계약, 시나리오 실행 구조 |

## 라이선스

게임 그래픽은 LPC(Liberated Pixel Cup) 계열 에셋과 Kenney(CC0) 에셋을 씁니다. 에셋별 라이선스와 저작자 표시는 `licenses/`와 게임 안 `Esc` → 크레딧에 있습니다.
