# 모델 출처

| 파일 | 출처 | 라이선스 |
|---|---|---|
| `lobby-furniture.glb` | [Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit) 2.0의 가구(책상, 의자, 책장, 닫힌 책장, 러그, 책, 미닫이 창, 둥근 탁상 스탠드, 1인 침대, 협탁, 둥근 바닥 스탠드, 화분, 작은 화분)를 `scripts/lobby3d/build-furniture.py`로 골라 크기·모서리를 다듬고 한 파일로 묶었다. 앱에 넣지 않는 원본이고, `scripts/lobby3d/split-furniture.py`가 가구마다 나눠 처음 방 일곱은 `furniture/`(앱)에, 열넷 모두는 서버 아이템 목록 파일 폴더에 둔다. 게시판·창틀·액자는 같은 모양새로 새로 만들었다 | CC0 1.0(출처 표기 의무 없음) |
| `lobby-village.glb` | [Kenney Fantasy Town Kit](https://kenney.nl/assets/fantasy-town-kit) 2.0의 분수, 가로등, 노점, 벤치, 바위, 길, 생울타리, 나무 울타리, 풍차를 `scripts/lobby3d/build-village.py`로 골라 배치하고 한 파일로 묶었다. 밤 불빛 판은 새로 만들었다. 건물 셋(라룹이 집, 가구점, 옷집)은 WriteLoop이 Tripo 웹으로 만든 모델을 다듬어(라룹이 집: 각진 벽돌집의 굴뚝·벽을 다듬고 나무 프레임·굴뚝 구멍을 넣음, 가구점: 통유리판과 진열 자리를 넣음, 옷집: 옥상 방수페인트·실내를 정리함) 면 수·텍스처를 줄인 뒤 같은 스크립트로 넣었다 | Kenney 부품은 CC0 1.0(출처 표기 의무 없음), 건물 셋은 저장소와 같다 |
| `lobby-room.glb` | WriteLoop이 `scripts/lobby3d/bake-room.py`로 만들었다 | 저장소와 같다 |
| `lobby-wearables.glb` | 옛 라룹이 몸(고글이 그려진 몸) 때의 캐릭터 꾸미기 착용 원본: 야구모자는 WriteLoop이 Tripo로 만든 모델(`C:\WriteLoop-asset\캡모자`)을, 상의·하의 껍질과 신발은 WriteLoop이 그때의 라룹이 모델에서 만들었다. 지금은 쓰지 않는다(새 몸의 착용 모델은 `scripts/lobby3d/build-wearables.py`가 모델마다 바로 만들어 서버 아이템 목록에 둔다) | 저장소와 같다 |
| `writeloop.glb` | WriteLoop 캐릭터 모델(라룹이). 고글 없는 몸을 WriteLoop이 Tripo 웹으로 만들고 뼈대를 붙였으며, 꼬리 자리·얼굴(눈·코 크기와 색)·동작 클립·외곽선을 손보고 이마의 앞머리를 지워 매끈한 이마로 만들었다 | 저장소와 같다 |
| `wear-goggles.glb` | 라룹이 고글(얼굴장식, 모두 처음부터 가짐). WriteLoop이 Tripo 웹으로 만든 고글을 `scripts/lobby3d/build-goggles.py`로 줄이고 라룹이 머리에 맞춘 뒤, `scripts/lobby3d/fit-goggles-to-head.py`로 렌즈 판은 모양 그대로 이마에 더 붙이고 띠는 머리를 따라 감기게 새로 만들었다 | 저장소와 같다 |
| `village-flowers.glb` | 마을 땅의 3D 꽃 무리(흰·노랑·분홍·빨강)·클로버·풀 포기. WriteLoop이 Blender 스크립트로 만들었다(꼭짓점 색, 텍스처 없음) | 저장소와 같다 |
