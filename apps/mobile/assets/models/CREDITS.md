# 모델 출처

| 파일 | 출처 | 라이선스 |
|---|---|---|
| `lobby-furniture.glb` | [Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit) 2.0의 가구(책상, 의자, 책장, 닫힌 책장, 러그, 책, 미닫이 창, 둥근 탁상 스탠드, 1인 침대, 협탁, 둥근 바닥 스탠드, 화분, 작은 화분)를 `scripts/lobby3d/build-furniture.py`로 골라 크기·모서리를 다듬고 한 파일로 묶었다. 앱에 넣지 않는 원본이고, `scripts/lobby3d/split-furniture.py`가 가구마다 나눠 처음 방 일곱은 `furniture/`(앱)에, 열넷 모두는 서버 아이템 목록 파일 폴더에 둔다. 게시판·창틀·액자는 같은 모양새로 새로 만들었다 | CC0 1.0(출처 표기 의무 없음) |
| `lobby-village.glb` | [Kenney Fantasy Town Kit](https://kenney.nl/assets/fantasy-town-kit) 2.0의 벽·문·창·지붕(건물 넷으로 조립), 분수, 가로등, 노점, 벤치, 바위, 길, 생울타리, 나무 울타리를 `scripts/lobby3d/build-village.py`로 골라 배치하고 한 파일로 묶었다(색 그림의 회벽·벽 아래 띠 색을 바꿨다). 밤 불빛 판은 새로 만들었다 | CC0 1.0(출처 표기 의무 없음) |
| `lobby-room.glb` | WriteLoop이 `scripts/lobby3d/bake-room.py`로 만들었다 | 저장소와 같다 |
| `lobby-wearables.glb` | 옛 라룹이 몸(고글이 그려진 몸) 때의 캐릭터 꾸미기 착용 원본: 야구모자는 WriteLoop이 Tripo로 만든 모델(`C:\WriteLoop-asset\캡모자`)을, 상의·하의 껍질과 신발은 WriteLoop이 그때의 라룹이 모델에서 만들었다. 지금은 쓰지 않는다(새 몸의 착용 모델은 `scripts/lobby3d/build-wearables.py`가 모델마다 바로 만들어 서버 아이템 목록에 둔다) | 저장소와 같다 |
| `writeloop.glb` | WriteLoop 캐릭터 모델(라룹이). 고글 없는 몸을 WriteLoop이 Tripo 웹으로 만들고 뼈대를 붙였으며, 꼬리 자리·얼굴(눈·코 크기와 색)·동작 클립·외곽선을 손봤다 | 저장소와 같다 |
| `wear-goggles.glb` | 라룹이 고글(얼굴장식, 모두 처음부터 가짐). WriteLoop이 Tripo 웹으로 만든 고글을 `scripts/lobby3d/build-goggles.py`로 줄이고 라룹이 머리에 맞췄다 | 저장소와 같다 |
