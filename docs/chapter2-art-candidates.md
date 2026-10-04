# 2장 그림 후보 (2026-10-04 조사)

`docs/chapter2-sunken-forest.md` 의 "필요한 그림"을 채울 후보. 모두 OpenGameArt.org.
각 페이지의 라이선스·저작자를 읽고, 미리보기 그림을 직접 열어 그림체를 확인했다.
**다운로드는 사용자 승인 후**에 하고, 받은 뒤 실제 게임 화면에 놓아 다시 확인한다.

## 추천 (LPC 그림체)

| # | 묶음 | 쓰임 | 라이선스 | 저작자 표시 | 크기 | 확인 결과 |
|---|---|---|---|---|---|---|
| 1 | [[LPC] Monsters](https://opengameart.org/content/lpc-monsters) | 식인 꽃, 큰 벌레(늪 거머리), 벌(독벌), 박쥐 | CC-BY-SA 3.0+ / GPL 3.0+ (박쥐 OGA-BY 3.0) | Charles Sanchez (CharlesGabriel), bagzie, bluecarrot16 | zip 78KB | 지금 말캉이를 가져온 묶음. 그림체 같음. 공격 동작 포함 |
| 2 | [LPC Frogman](https://opengameart.org/content/lpc-frogman) | 늪개구리 전사(삼지창 든 사람형 개구리), 왕관 변형은 중간 보스 후보 | CC-BY 3.0 / OGA-BY 3.0 | Evert, Stephen "Redshrike" Challener, Puffolotti + 페이지 링크 | png 20~26KB | 4방향·공격·죽음. **초록이 LPC보다 쨍함**(저자도 언급) → 탁한 늪색으로 색 보정 필요 |
| 3 | [[LPC] Trees](https://opengameart.org/content/lpc-trees) | 잎 없는 고목(죽은 나무) | CC-BY-SA 3.0 | bluecarrot16 외 (CREDITS 파일 전체) + 페이지 링크 | zip 884KB | 이미 일부를 쓰는 묶음(`CREDITS-trees.txt`). 고목 변형은 아직 안 가져옴 |
| 4 | [[LPC] Flowers / Plants / Fungi / Wood](https://opengameart.org/content/lpc-flowers-plants-fungi-wood) | 쓰러진 통나무, 그루터기, 버섯 | CC-BY-SA 3.0 | bluecarrot16 외 (CREDITS 파일 전체) + 페이지 링크 | zip 110KB | 이미 일부를 쓰는 묶음(`CREDITS-plants.txt`). 갈대·연잎은 없음(갈대는 이미 `town_prop_cattail` 있음) |
| 5 | [LPC style wood bridges](https://opengameart.org/content/lpc-style-wood-bridges-and-steel-flooring) | 늪 위 나무다리, 난간 | CC-BY-SA 3.0 / GPL 2.0·3.0 | Xenodora | png 5개, 합계 약 10KB | LPC 기본 줄다리 스타일을 따른 판자 다리. 갈대골·숲 둑길 |
| 6 | [[LPC] Thatched-roof Cottage](https://opengameart.org/content/lpc-thatched-roof-cottage) | 갈대골 초가(갈대 지붕 집) | CC-BY-SA 3.0 / GPL 3.0+ | bluecarrot16 (원작 Sharm, HughSpectrum, Casper Nilsson) | png 2개, 108KB | 목골조 벽 + 초가 지붕. 다리·말뚝과 합쳐 수상 가옥 느낌을 낸다. 창·문은 LPC Windows/Doors 묶음이 따로 필요할 수 있음 |
| 7 | [LPC Beetle](https://opengameart.org/content/lpc-beetle) | 독 딱정벌레(`beetle_poison`) — 선택 | CC-BY 3.0 / CC-BY-SA 3.0 / GPL 2.0 / OGA-BY 3.0 | Stephen "Redshrike" Challener + 링크 | png 약 7KB | 4방향 걷기·공격·죽음, 독 색 변형이 이미 있음 |

사람형 적(해골병, 물에 빠진 자, 늪의 사제, 새 NPC 4명)은 **새로 받지 않고** 이미 쓰는 Universal LPC 생성기 원본으로 만든다(`scripts/build-lpc-characters.py`). 생성기의 해골·좀비 몸 레이어를 빌드 때 확인한다.

## 쓰지 않기로 한 것

| 묶음 | 이유 |
|---|---|
| [Dead Swamp Tileset](https://opengameart.org/content/dead-swamp-tileset) (Sevarihk, CC-BY 4.0) | 주제는 꼭 맞다(말뚝 위 초가, 고목, 나무다리). 하지만 RPG Maker XP 그림체라 LPC보다 어둡고 질감이 달라 섞으면 티가 난다. 수상 가옥 배치의 **참고 자료**로만 쓴다 |
| [Lazy Mosquito](https://opengameart.org/content/lazy-mosquito) (bevouliin, CC-BY 4.0) | 옆에서 본 플래피버드용 그림. 위에서 보는 LPC와 시점이 다르다 |

## 몬스터 구성 변경 (후보에 맞춰)

| 설계안 | 바꾼 안 | 그림 |
|---|---|---|
| 늪개구리 | 늪개구리 전사 | #2 Frogman (색 보정) |
| 독모기 떼 | 독벌 떼 | #1 벌 (또는 #7 독 딱정벌레) |
| (새) | 식인 꽃 — 늪가에 박혀 다가오면 문다(움직이지 않는 함정형) | #1 |
| (새) | 늪 거머리 — 진흙에서 솟아 문다 | #1 큰 벌레 |
| 물에 빠진 자, 유적 해골병, 늪의 사제 | 그대로 | Universal LPC 생성기 |
| 이끼 골렘 | 그대로 | 기존 골렘 색 변형 |
| 늪지기 거대개구리 (중간 보스) | 개구리 왕(왕관 Frogman 확대) | #2 crown |

## 저작자 표시

받은 묶음마다 `assets/.../CREDITS*.txt` 에 위 표의 저작자·라이선스·페이지 링크를 적고, `scripts/build-credits.py` 로 게임 안 크레딧 화면을 다시 만든다. CC-BY-SA 묶음을 고쳐 쓴 그림(색 보정 등)은 같은 라이선스로 둔다.

## 다운로드 결과 (2026-10-04)

7개 묶음을 모두 받아 저장소 밖 `C:\Users\ms990\capstone\art-src\ch2\` 에 두었다(출처·라이선스는 그 폴더의 `SOURCES.txt`). 56개 파일, 모두 정상 PNG.

- [LPC] Monsters 묶음에는 페이지 미리보기에 없던 **뱀(snake)** 과 **유령(ghost)** 도 들어 있다. 뱀은 늪, 유령(창백한 녹백색)은 신전 1층 후보로 쓴다.
- `trees-dead.png`: 잎 없는 고목 20여 종(굽은 줄기, 뿌리 드러난 고목 포함) — 가라앉은 숲에 바로 쓸 수 있다.
- 식인 꽃·큰 벌레·벌·뱀·유령 모두 4방향 시트.
- `beetle5.PNG` 는 배경이 투명이 아니라(RGB) 넣을 때 배경색을 빼야 한다.
