# 결정: 시나리오 인터프리터는 TS-host에 둔다

- 상태: 확정
- 대상: 이벤트 시나리오 자동 생성(스키마 v2 노드 그래프)의 실행 계층
- 대체: 검토 보고서 §7의 "스파이크 ① Lua↔TS 선택 결과 역방향 콜백 채널 검증"

## 결정

시나리오 노드 그래프(`say` / `choice` / `branch` / `set_flag` / `reward` / `goto` / `end`)를
해석·실행하는 인터프리터는 **TypeScript 호스트에 둔다.** Lua는 기존 역할만 유지한다:

- 읽기: 호스트가 밀어넣는 평면 키 스냅샷(`engine.quest.*` / `inventory` / `player` / `scene`)
- 쓰기: 큐잉되는 액션 이벤트(대사, 아이템 요청, 씬 전환, 사운드)
- 트리거 발신: `interact`가 "이 캐릭터와 대화가 일어났다"를 호스트에 알린다

## 근거 — 스파이크로 답을 찾을 문제가 아니다

보고서는 이 항목을 최대 기술 리스크로 두고 반나절 스파이크를 배정했다. 그러나 **콜백 채널을
뚫는 데 성공하더라도 Lua 안에서는 시나리오를 실행할 수 없다.** 세 제약이 독립적으로 막는다.

### 1. Lua 컨트롤러는 자기 자신만 발화할 수 있다

`engine.ui.show_message`와 `engine.ui.show_dialogue`가 둘 다 화자를 현재 컨트롤러의
캐릭터로 고정한다.

- [createLuaCharacterControllerRuntime.ts:581](../src/games/my-sample-rpg/lua/createLuaCharacterControllerRuntime.ts#L581) — `character_id = require_current_character_id()`
- [createLuaCharacterControllerRuntime.ts:608](../src/games/my-sample-rpg/lua/createLuaCharacterControllerRuntime.ts#L608) — 같음

`say` 노드에 화자 필드가 있는 이상 다자 대화가 목표인데, 컨트롤러 API 계약이 이를 금지한다
([lua-controller-api.md](lua-controller-api.md): 컨트롤러는 다른 캐릭터를 직접 바꿀 수 없다).
계약을 넓히는 것은 Lua 컨트롤러 모델 자체를 바꾸는 일이라 "채널 하나 뚫기"의 범위가 아니다.

### 2. 선택 결과를 받을 재진입 훅이 없다

예약 메서드는 정확히 4종이다 — `register` / `unregister` / `step` / `interact`
([luaControllerApi.ts:7-10](../src/games/my-sample-rpg/lua/luaControllerApi.ts#L7-L10)).
"선택지를 띄우고 결과를 기다렸다가 이어서 실행"할 진입점이 없고, 새로 만들려면 컨트롤러
생명주기에 일시정지·재개 개념을 추가해야 한다. 매 프레임 이동 의도를 반환하는 현재 모델과
어긋난다.

### 3. 실행에 필요한 것이 전부 TS 쪽에 있다

선택지 UI, 카메라, 페이드/셰이크는 모두 Pixi/DOM 자산이다. 대화 오버레이는 이미
`onComplete` 콜백을 갖고 있어([createNpcDialogueOverlay.ts:30-35](../src/games/my-sample-rpg/rendering/createNpcDialogueOverlay.ts#L30-L35))
스텝 순차 실행의 이음매가 그쪽에 준비돼 있다. 여기에 `choices` / `onChoice`를 더하는 것이
Lua에 왕복 채널을 만드는 것보다 훨씬 짧다.

## 결과

- 보고서 §8 리스크 표의 "Lua↔TS 역방향 콜백 불가 판명" 행이 사라진다. 대응란에 적힌
  "실패 시 인터프리터를 TS-host로 이동"이 곧 이 결정이며, 선행 확인 없이 바로 채택한다.
- 스파이크 예산 반나절이 회수된다. 남는 스파이크는 ②(배포 vLLM guided_json) 하나이며
  [scripts/vllm-guided-json-smoke.mjs](../scripts/vllm-guided-json-smoke.mjs)로 실행한다.
- 플래그 저장소 위치 문제가 함께 해소된다. 인터프리터가 TS에 있으므로 플래그도 TS에만
  살면 되고, Lua 스냅샷에 플래그 키를 추가할 필요가 없다. (MVP는 인메모리, 영속은 이후 과제.)

## 남는 Lua 작업

Lua를 걷어내는 결정이 아니다. 시나리오 실행 중에도 Lua는 계속 필요하다.

- 트리거: `interact`가 호스트에 대화 발생을 알린다(MVP 트리거는 `talk` 하나).
- 조건 읽기: 시나리오가 퀘스트 상태를 참조하면 기존 스냅샷 채널을 그대로 쓴다.
  이 채널에는 최근까지 두 개의 결함이 있었다 — 폴백 표기 드리프트와 동적 퀘스트 누락.
  둘 다 수정됐고 회귀 테스트가 있다([buildLuaRuntimeSnapshot.test.ts](../src/games/my-sample-rpg/lua/buildLuaRuntimeSnapshot.test.ts)).
