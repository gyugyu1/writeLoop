# 모델 출처

| 파일 | 출처 | 라이선스 |
|---|---|---|
| `lobby-furniture.glb` | [Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit) 2.0의 가구(책상, 의자, 책장, 닫힌 책장, 러그, 책, 미닫이 창, 둥근 탁상 스탠드, 1인 침대, 협탁, 둥근 바닥 스탠드, 화분, 작은 화분)를 `scripts/lobby3d/build-furniture.py`로 골라 크기·모서리를 다듬고 한 파일로 묶었다. 앱에 넣지 않는 원본이고, `scripts/lobby3d/split-furniture.py`가 가구마다 나눠 처음 방 일곱은 `furniture/`(앱)에, 열넷 모두는 서버 아이템 목록 파일 폴더에 둔다. 게시판·창틀·액자는 같은 모양새로 새로 만들었다 | CC0 1.0(출처 표기 의무 없음) |
| `lobby-village.glb` | [Kenney Fantasy Town Kit](https://kenney.nl/assets/fantasy-town-kit) 2.0의 벽·문·창·지붕(건물 넷으로 조립), 분수, 가로등, 노점, 벤치, 바위, 길, 생울타리, 나무 울타리를 `scripts/lobby3d/build-village.py`로 골라 배치하고 한 파일로 묶었다(색 그림의 회벽·벽 아래 띠 색을 바꿨다). 밤 불빛 판은 새로 만들었다 | CC0 1.0(출처 표기 의무 없음) |
| `lobby-room.glb` | WriteLoop이 `scripts/lobby3d/bake-room.py`로 만들었다 | 저장소와 같다 |
| `lobby-wearables.glb` | 캐릭터 꾸미기 착용 시험: 야구모자는 WriteLoop이 Tripo로 만든 모델(`C:\WriteLoop-asset\캡모자`)을, 상의·하의 껍질과 신발은 WriteLoop이 라룹이 모델에서 `scripts/lobby3d/build-wearables.py`로 만들었다 | 저장소와 같다 |
| `writeloop.glb` | WriteLoop 캐릭터 모델 | 저장소와 같다 |
