# 모델 출처

| 파일 | 출처 | 라이선스 |
|---|---|---|
| `lobby-furniture.glb` | [Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit) 2.0의 가구(책상, 의자, 책장, 닫힌 책장, 러그, 책, 미닫이 창, 둥근 탁상 스탠드, 1인 침대, 협탁, 둥근 바닥 스탠드, 화분, 작은 화분)를 `scripts/lobby3d/build-furniture.py`로 골라 크기·모서리를 다듬고 한 파일로 묶었다. 앱에 넣지 않는 원본이고, `scripts/lobby3d/split-furniture.py`가 가구마다 나눠 처음 방 일곱은 `furniture/`(앱)에, 열넷 모두는 서버 아이템 목록 파일 폴더에 둔다. 게시판·창틀·액자는 같은 모양새로 새로 만들었다 | CC0 1.0(출처 표기 의무 없음) |
| `lobby-village.glb` | [Kenney Fantasy Town Kit](https://kenney.nl/assets/fantasy-town-kit) 2.0의 바위, 길을 `scripts/lobby3d/build-village.py`로 골라 배치하고 한 파일로 묶었다. 밤 불빛 판은 새로 만들었다. 벤치는 WriteLoop 제작 모델(등받이 있는 나무 벤치)을 같은 스크립트로 넣었다. 건물 셋(라룹이 집, 가구점, 옷집)은 WriteLoop이 Tripo 웹으로 만든 모델을 다듬어(라룹이 집: 각진 벽돌집의 굴뚝·벽을 다듬고 나무 프레임·굴뚝 구멍을 넣음, 가구점: 통유리판과 진열 자리를 넣음, 옷집: 옥상 방수페인트·실내를 정리함) 면 수·텍스처를 줄인 뒤 같은 스크립트로 넣었다 | Kenney 부품은 CC0 1.0(출처 표기 의무 없음), 건물 셋은 저장소와 같다 |
| `lobby-room.glb` | WriteLoop이 `scripts/lobby3d/bake-room.py`로 만들었다 | 저장소와 같다 |
| `lobby-wearables.glb` | 옛 라룹이 몸(고글이 그려진 몸) 때의 캐릭터 꾸미기 착용 원본: 야구모자는 WriteLoop이 Tripo로 만든 모델(`C:\WriteLoop-asset\캡모자`)을, 상의·하의 껍질과 신발은 WriteLoop이 그때의 라룹이 모델에서 만들었다. 지금은 쓰지 않는다(새 몸의 착용 모델은 `scripts/lobby3d/build-wearables.py`가 모델마다 바로 만들어 서버 아이템 목록에 둔다) | 저장소와 같다 |
| `player-human.glb` | 메인 플레이어(사람형, 키 1.0·발바닥 원점·T포즈 쉬는 자세, 뼈 18개, 몸·머리·얼굴과 기본 착장(흰 포켓 티셔츠·차콜 반바지·양말·운동화 두 짝) 메시 11개, 공용 그림 1장, 동작 클립 22개와 표정 모프 셋). 가구점 주인 버들을 기준으로 비율을 맞춰 WriteLoop이 Tripo로 만든 뒤 Blender로 다듬었다 | 저장소와 같다 |
| `writeloop.glb` | WriteLoop 캐릭터 모델(라룹이. 지금은 플레이어로 쓰지 않고 영어 조언 캐릭터용으로 남겨 둔다). 고글 없는 몸을 WriteLoop이 Tripo 웹으로 만들고 뼈대를 붙였으며, 꼬리 자리·얼굴(눈·코 크기와 색)·동작 클립·외곽선을 손보고 이마의 앞머리를 지워 매끈한 이마로 만들었다 | 저장소와 같다 |
| `wear-goggles.glb` | 라룹이 고글(얼굴장식, 모두 처음부터 가짐). WriteLoop이 Tripo 웹으로 만든 고글을 `scripts/lobby3d/build-goggles.py`로 줄이고 라룹이 머리에 맞춘 뒤, `scripts/lobby3d/fit-goggles-to-head.py`로 렌즈 판은 모양 그대로 이마에 더 붙이고 띠는 머리를 따라 감기게 새로 만들었다 | 저장소와 같다 |
| `wear-goggles-human.glb` | 사람형 플레이어의 라룹이 고글(얼굴장식, 모두 처음부터 가짐. 기본으로 씌우지 않는다). 라룹이 고글을 바탕으로 렌즈와 밴드를 사람형 이마·옆머리·뒤통수 곡면에 맞췄다. WriteLoop이 Blender로 만들었다 | 저장소와 같다 |
| `village-flowers.glb` | 마을 땅의 3D 꽃 무리(흰·노랑·분홍·빨강)·클로버·풀 포기. WriteLoop이 Blender 스크립트로 만들었다(꼭짓점 색, 텍스처 없음) | 저장소와 같다 |
| `village-fountain.glb` | 마을 광장 분수(석재 받침·윗그릇과, 윗그릇 가장자리에서 아래 수조로 졸졸 흐르는 물. 물은 모프 타깃 셋을 움직이는 약 2초 고리 클립 `Fountain_Flow`). WriteLoop 제작 | 저장소와 같다 |
| `village-streetlamp.glb` | 마을 광장 가로등(나무 기둥·석재 받침·네 면 유리창 등갓. 색 그림과 유리창만 빛나는 발광 그림). WriteLoop 제작 | 저장소와 같다 |
| `trees/WriteLoop_Tree_A_LOD1.glb`, `trees/WriteLoop_Tree_A_LOD2.glb`, `trees/WriteLoop_Tree_Pine_LOD1.glb`, `trees/WriteLoop_Tree_Pine_LOD2.glb`(A·Pine × LOD1·LOD2) | 마을과 방 창밖의 나무(A 둥근 활엽수: 겨울에 잎이 져 맨가지, Pine 소나무: 겨울에도 눈 덮인 잎). WriteLoop 제작: 나무 모델링 지시서 기반으로 만들었다(잎 2×2 계절 그림 칸, 줄기 평소·눈 2칸, 잎·줄기 두 메시). 앱은 마을 안에 LOD1, 둘레 숲과 창밖에 LOD2를 쓴다 | 저장소와 같다 |
| `shop/furniture-shop-interior.glb` | 마을 가구점 실내(생활 쇼룸, 16.9 × 14.7m: 오른쪽 초록 문, 통유리 틀, 낮과 밤의 방·침실·식물 서재, 원형 진열대 여섯과 그 앞 명패 받침·새겨진 글자(양옆 넷은 카메라 쪽을 본다), 별도 장면 `ShopNameplateTemplates`의 품절 안내판 `ShopDisplay_SoldOutBoard`, 계산대, 벽 선반과 자리 노드 `PlayerSpawn`·`ExitTrigger`·`CheckoutNPC`·`CheckoutInteract`·`DisplaySlot_01~06`). 배치 값은 함께 나온 `src/lib/lobby3d/shop-layout.json`에 있다. WriteLoop이 Blender로 만들었다. 진열 상품과 명패 그림은 앱에 들어 있지 않고 서버 아이템 목록에서 받는다 | 저장소와 같다 |
| `shop/beodeul.glb` | 가구점 주인 버들(비버 목공 장인, 19개 본으로 리깅한 기본 자세, 내장 그림 1장). WriteLoop 제작 | 저장소와 같다 |
| `clothing-shop/clothing-shop-interior-1f.glb` | 마을 옷집 실내 1층(16.9 × 14.7m: 오른쪽 출입문, 오른쪽 벽을 따라 2층으로 오르는 계단과 그 왼편 계산대, 계산대 입구 쪽 끝의 선글라스 진열대, 피팅룸과 커튼·옆 행거, 진열대·마네킹·뒷벽 옷걸이와 빈 예비 자리, 자리 노드 `F1_EntranceSpawn`·`F1_ExitApproach`·`F1_ExitTrigger`·`F1_StairsUp`·`F1_FromUpper` 등). 배치 값은 함께 나온 `src/lib/lobby3d/clothing-shop-layout.json`에 있다. WriteLoop이 Blender로 만들었다 | 저장소와 같다 |
| `clothing-shop/clothing-shop-interior-2f.glb` | 마을 옷집 실내 2층(1층과 같은 크기: 계단 개구부, 창가 진열대 둘과 행거, 마네킹·모자 받침·소품 진열대·뒷벽 옷걸이와 빈 예비 자리, 피팅룸과 커튼, 자리 노드 `F2_StairsDown`·`F2_FromLower` 등). 배치 값은 1층과 같은 JSON에 있다. WriteLoop이 Blender로 만들었다 | 저장소와 같다 |
| `clothing-shop/clothing-display-samples.glb` | 마을 옷집 진열 상품 22종의 정적 진열 메시(`Stock_<상품 ID>`, 뿌리 `ClothingDisplaySamples`). 꾸미기 옷 원본의 메시와 재질로 만들었다. 상품 목록은 함께 나온 `src/lib/lobby3d/clothing-shop-stock.json`에 있다. WriteLoop이 Blender로 만들었다 | 저장소와 같다 |
