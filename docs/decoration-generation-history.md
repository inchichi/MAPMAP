# 장식 생성 실험 및 구현 기록

## 현재 반영 범위

이 브랜치는 develop-chich를 병합하고, 해당 브랜치의 에디터와 스타일 파이프라인을 기준으로 장식 데모를 이식했다. 기존 서버 전체를 덮어쓰지 않았다. 원본 타일셋은 변경하지 않는다. 현재 결과는 **원본 맵 + 별도 장식 PNG + 코드 기반 밤/전구 효과**다.

에디터 상단의 **크리스마스 데모 적용**을 누르고 마을을 선택한다. 건물·나무·분수·천막 장식이 저장되고, **장식 켜기/끄기**로 장식과 밤/반짝임을 함께 전환한다. 저장은 해당 브라우저 origin의 localStorage를 사용한다. 기존 서버의 공유 상태 API에 의존하지 않는다. 다른 PC에서는 데모 버튼을 다시 눌러야 한다. 반복 적용은 같은 데모 그룹만 교체하며 수동 배치 항목은 보존한다.

## 지금까지의 실험 흐름

1. **개별 오브젝트 스타일 변환:** 원본에서 오브젝트를 추출해 Qwen-Image-Edit와 FLUX.1-Kontext-dev에 입력했다. 모델이 원본 구조까지 바꾸는 문제가 있었다.
2. **전체 맵 스타일 변환:** 전체 맵 이미지를 모델에 입력해 크리스마스 등의 테마로 변환했다. 분위기는 통일되지만 건물 위치·구조가 원본 충돌과 어긋날 수 있었다.
3. **전체 맵 변환 → GroundingDINO + SAM 분리 → 재배치:** 탐지 박스와 마스크로 오브젝트를 추출했다. 저해상도, 그림자 잔존, 경계와 충돌 불일치가 발생했다.
4. **분리 오브젝트 재생성:** 해상도를 높이려 했지만 문·창문 위치가 바뀌고 건물 벽에 다른 건물 그림을 붙인 듯한 결과가 나타났다.
5. **현재 채택 방식:** 원본 타일과 구조를 유지하고 FLUX 결과에서 눈·전구 등 장식만 추출해 별도 레이어에 올렸다. 장식 분리와 정렬에는 수동으로 조정한 색상 마스크·영역·좌표를 사용한다. 이 단계가 완전 자동 SAM 처리인 것은 아니다.

앞 네 단계는 시행착오 기록이다. 모든 과거 전체 맵 결과 및 서버 캐시를 이 저장소에 넣은 것은 아니다. 이번 커밋에는 현재 데모, 개별 오브젝트 Qwen/FLUX 비교 입력·결과, 마스크 가공 코드를 포함한다.

## 실제 장식 생성 방법

### 원본 구성

타일 크기는 32×32다. 큰 건물은 TMX의 타일을 원래 좌표에 합쳐 RGBA 오브젝트로 만들었다. 마을 좌표 기준 큰 건물은 (544,32), 크기 512×480, 천막은 (352,416), 크기 96×96이다. 데모는 이 좌표를 기준으로 만들어졌으므로 다른 맵에 그대로 적용할 수 없다.

### 모델 비교

`experiments/decoration-generation/objects/run.py`에 실제 프롬프트가 있다. 입력은 원본을 회색 캔버스에 올린 320×320 이미지다. `/style-transfer`에 multipart `content`와 `prompt`, `steps=28`, `alpha=0.5`, `geometry_lock=false`를 보냈다. 당시 Qwen은 8766, FLUX는 8765 서비스였다. 이는 실행 중인 외부 서비스의 주소이며 GitHub가 모델을 제공하지 않는다. seed는 서비스에서 고정하지 않아 재실행 결과가 달라질 수 있다.

Qwen 결과에서 구조 변화가 관찰되어 현재 데모에는 FLUX 장식만 사용했다. 이는 제한된 사례 비교이며 모델 전체 성능 순위를 뜻하지 않는다. `*-original.png`, `*-input.png`, `*-qwen.png`, `*-flux.png`로 결과를 비교할 수 있다.

### 투명 장식으로 가공

- 나무: 원본 잎 영역을 기준으로 눈과 전구 색상 픽셀을 추출.
- 분수: 생성 결과 크기를 맞춘 후 원본 돌 테두리·상단 영역만 사용. 물과 기둥 본체를 교체하지 않음.
- 건물: 지붕의 눈과 지정 영역의 화환을 마스킹. 생성된 전구 하나를 원본 처마 좌표에 반복 배치.
- 천막 v3: 천막 전체를 다시 생성하지 않고 독립된 눈 띠와 연결 전구줄을 생성. 마젠타 배경을 제거하고 원본 96px 폭에 맞춰 축소·정렬.

천막 v3 실제 프롬프트:

> Replace the stall with two separate pixel-art decoration strips. Top: thin uneven settled snow with tiny overhangs. Bottom: a sagging dark cable connecting eight warm golden bulbs. Solid magenta background. No stall, no cloth, no shadows, no text.

`steps=28`, `alpha=1.0`, `geometry_lock=false`. 생성된 두 눈 띠 중 아래 띠를 사용했다. 최종 눈은 96×8, 전구줄은 96×19로 조정했다. 따라서 최종 결과는 **FLUX 생성 + 프로그램 마스크/리사이즈 + 수동 정렬**의 조합이다. 내장 이미지 생성 도구는 사용하지 않았다.

## 코드 위치와 레이어

- `src/editor/placementStore.ts`: `renderLayer`, `anchor`, `displayScale`, `sourceGroup`, `visible` 및 데모 설치/표시 상태 저장.
- `src/editor/createEditorApp.ts`: 데모 적용과 장식 전환 버튼.
- `src/games/my-sample-rpg/rendering/createPixiTiledMapView.ts`: `layer:generated-decorations` 컨테이너, 원본 위에 장식 표시, 밤 오버레이와 밝기 애니메이션.
- `public/experiments/flux-decorations-20260909/placements.json`: 현재 사용한 이미지 경로·배치 좌표.

밤은 원본 이미지 재생성이 아니라 청색 반투명 사각형으로 맵 전체를 덮는 렌더링 효과다. 장식 PNG에서 불투명하고 밝은 황색 픽셀을 8px 격자로 묶어 전구 위치를 추정하고, 작은 빛 원의 alpha를 서로 다른 위상의 사인 곡선으로 변경한다. 물리 기반 조명이나 학습 기반 광원 검출은 아니다. 노란 장식이 광원으로 오인되거나 같은 전구가 두 격자로 나뉠 수 있다.

원본 이미지·타일 좌표·문 위치·충돌은 변경하지 않는다. 장식을 끄면 밤 오버레이와 빛도 사라진다. UI는 밤 오버레이의 영향을 받지 않는다. 현재 밤 효과는 마을의 표시된 장식이 있을 때만 활성화된다.

## 실행 및 재현

```sh
git lfs install
git lfs pull
npm ci
npm run dev
```

`/editor.html`에서 마을을 열고 데모 버튼을 누른다. 미리 생성한 데모 확인에는 GPU가 필요 없다. 그림 파일은 Git LFS로 보관하므로 LFS 파일을 내려받아야 한다.

마스크 결과만 재현하려면 Python 환경에 `pillow numpy requests`를 설치하고 아래를 실행한다. 제공된 입력 파일을 사용하며 모델 서버가 필요 없다.

```sh
python experiments/decoration-generation/objects/build_decoration_only.py
python experiments/decoration-generation/building/build_building_decoration.py
python experiments/decoration-generation/stall-v3/prepare.py
```

새 모델 출력이 필요할 때만 해당 `run.py`를 실행한다. 외부 서비스의 모델 가중치·GPU·라이선스·API 환경은 별도로 준비해야 한다. 이 스크립트의 포트는 당시 환경 기준이며 최신 develop-chich 서비스와 파라미터 호환성을 확인해야 한다. 과거 결과를 보존하려면 실험 폴더를 복사한 뒤 실행한다.

## 아직 구현하지 않은 부분

프롬프트 하나를 받아 테마 해석 → 원본 색/명암 조정 → 장식 생성 → 정렬 → 효과 설정을 자동 수행하는 통합 흐름은 계획이다. 현재 데모 버튼은 저장된 이미지를 적용하며 새 이미지를 생성하지 않는다. 색/명암만 계산한 실험은 사용자가 되돌려 현재 활성화하지 않았다. 색/명암 보정본을 장식 스위치와 연동하는 기능도 아직 없다.

원본 구조를 보존하면서 다양한 테마의 장식을 자동 생성·분리하는 품질 검증, 재시도, 사용자 승인 및 광원 위치 메타데이터가 다음 작업이다.

## 병합본 검증

- TypeScript 검사 및 프로덕션 빌드 통과.
- 전체 Vitest 106개 파일, 599개 테스트 통과 후 추가된 장식 테스트를 포함한 placementStore 7개 테스트 통과.
- 별도 로컬 포트에서 데모 적용, 천막/나무/분수 위치 및 장식 off 시 낮 원본 복원 확인.
- 이번 검증에서 GPU 모델을 재실행하지는 않았다. 기존 생성 PNG를 사용했다.
- 의존성 설치 시 npm audit 취약점 7개가 보고되었다. 이번 작업에서 무관한 의존성 업데이트는 수행하지 않았다. 빌드에는 기존 CSS import 순서 및 큰 번들 경고가 있다.
