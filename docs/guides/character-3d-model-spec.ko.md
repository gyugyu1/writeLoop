# 라이트루프 3D 모델 규격

모바일 로비(라이트루프의 방)에서 쓸 라이트루프 3D 모델을 만들 때 지킬 규격이다. 이미지→3D 생성 도구(Tripo, Meshy 등)로 초안을 만들고 다듬는 방식을 기준으로 쓴다. 모델러에게 맡길 때도 같은 규격을 준다.

- 움직임 기준: 도형으로 만든 3D 시험본(2026-11-05 사용자 승인). 앱이 위치 이동, 360도 회전, 가속·감속, 카메라를 맡고, 모델은 제자리 동작만 담는다.
- 그림체: 앱에서 툰 셰이딩(3단 명암)과 갈색 외곽선(`#3D1B0F`)을 입힌다. 모델에는 그림자나 외곽선을 그려 넣지 않는다.

## 1. 기준 그림

캐릭터 자료 폴더 `C:\WriteLoop_video\Workspace\01_캐릭터_자료\assets\character`의 승인된 마스터를 쓴다.

| 용도 | 파일 |
|---|---|
| 생성 도구 입력(여러 방향) | `master/png/upscaled_1024/front.png`, `left.png`, `right.png`, `back.png` |
| 한 장만 받는 도구 | `master/png/upscaled_1024/front.png` |
| 색과 비율 확인 | `parts/rig_ready/front_vector_v3_20261104/WriteLoop_front_vector_rig_v3.svg` |

지켜야 할 외형:

- 흰 몸, 짙은 갈색 외곽선, 머리가 몸보다 큰 2등신.
- 귀 안쪽·볼은 분홍(`#FF9894`, `#FF9F9C`), 코는 짙은 갈색, 열린 입과 분홍 혀.
- 이마의 수경식 고글: 검은 띠, **정면에서 볼 때 화면 왼쪽 렌즈가 파랑(`#007BED`), 오른쪽이 주황(`#FF8000`)**. 좌우를 뒤집어 만들지 않는다.
- 짧은 팔다리, 엄지 없는 둥근 손끝(v3 기준), 몸 뒤 오른쪽의 짧고 복슬한 꼬리.

생성 도구에 설명 문구를 넣을 수 있으면 아래를 쓴다.

```
Cute chibi white puppy mascot standing upright, oversized round head, pointed ears with pink inner,
small round dark-brown eyes, small brown nose, open smiling mouth with pink tongue, pink blush cheeks,
swim goggles on the forehead with black strap, left lens blue and right lens orange (viewer's view),
short stubby arms and legs, rounded hands without thumbs, short fluffy tail. Clean smooth stylized shapes,
flat colors, no texture noise. A-pose or arms slightly away from body.
```

## 2. 파일 규격

| 항목 | 규격 |
|---|---|
| 형식 | glTF 바이너리(`.glb`) 한 파일. 동작 클립을 함께 담는다 |
| 축 | Y가 위, 캐릭터 앞쪽이 +Z |
| 원점 | 두 발바닥 사이 바닥(원점 아래로 메시가 내려가지 않게) |
| 크기 | 귀 끝까지 키 1.0. 앱에서 키운다 |
| 삼각형 수 | 15,000개 이하(목표 8,000~12,000) |
| 재질 | 부위별 단색(흰 몸, 분홍, 갈색, 파랑, 주황, 검정). 질감 그림은 없거나 1024px 이하 한 장 |
| 이름 | 메시·재질·뼈·클립 이름은 영어 소문자와 `_` |

## 3. 뼈대(리그)

동작이 이 뼈를 움직인다. 이름을 그대로 쓴다.

| 뼈 | 부모 | 용도 |
|---|---|---|
| `root` | - | 바닥 원점. 동작에서 움직이지 않는다 |
| `hips` | `root` | 몸 전체 위아래(통통 튐, 점프) |
| `spine` | `hips` | 몸 기울기, 숨쉬기 |
| `head` | `spine` | 고개 돌리기·갸웃 |
| `ear_l`, `ear_r` | `head` | 귀 흔들림 |
| `arm_l`, `arm_r` → `hand_l`, `hand_r` | `spine` / `arm_*` | 손 흔들기, 가리키기 |
| `leg_l`, `leg_r` → `foot_l`, `foot_r` | `hips` / `leg_*` | 걷기 |
| `tail_1` → `tail_2` → `tail_3` | `hips` | 꼬리 흔들기 |

`_l`·`_r`은 캐릭터 자신의 왼쪽·오른쪽이다(정면에서 볼 때 화면 오른쪽이 `_l`).

## 4. 표정(모양 키)

| 이름 | 내용 |
|---|---|
| `blink` | 두 눈 감기(0 = 뜸, 1 = 감음) |
| `mouth_closed` | 입 다물고 웃는 모양 |
| `happy_eyes` | 웃는 눈(^ ^) |

모양 키를 못 만들면 눈과 입을 따로 메시로 두어 앱이 바꿔 끼울 수 있게 한다.

## 5. 동작 클립

모든 클립은 제자리 동작이다(뿌리 이동 없음). 초당 30프레임. 이름은 아래를 그대로 쓴다.

| 클립 | 길이 | 반복 | 내용 |
|---|---|---|---|
| `idle` | 2~3초 | 예 | 숨쉬기, 꼬리 살랑, 귀 살짝 |
| `walk` | 0.8초(두 걸음) | 예 | 팔다리 교차, 몸 통통 튐, 살짝 앞으로 기울기 |
| `wave` | 2초 | 아니오 | 한 손 들어 흔들기 |
| `jump` | 1.2초 | 아니오 | 두 팔 들고 신나게 점프(오늘 완료) |
| `hop` | 1.5초 | 아니오 | 제자리 깡충깡충(연속 기록) |
| `point` | 1.5초 | 아니오 | 앞쪽을 가리키기(이어 쓰기) |
| `look_around` | 2.5초 | 아니오 | 두리번 |
| `poke` | 0.8초 | 아니오 | 눌렸을 때 깜짝·간지러워하는 반응 |
| `sit_down`, `sit_idle`, `stand_up` | 0.6초 / 2초 / 0.6초 | 아니오 / 예 / 아니오 | 오래 두면 앉기 |
| `sleep` | 3초 | 예 | (나중) 침대·쿠션에서 졸기 |

걷기는 앱이 걷는 속도에 맞춰 재생 속도를 바꾼다. 발이 바닥에 닿는 프레임이 0.0초와 0.4초 근처에 오게 만든다.

## 6. 넘기기 전 검사

- [ ] `.glb` 한 파일이 three.js 편집기나 glTF 뷰어에서 열린다.
- [ ] 키 1.0, 원점이 발바닥, 앞쪽이 +Z다.
- [ ] 삼각형 15,000개 이하다.
- [ ] 정면에서 볼 때 고글 왼쪽 렌즈가 파랑, 오른쪽이 주황이다.
- [ ] 위 표의 뼈 이름과 클립 이름이 그대로다.
- [ ] 클립에 뿌리 이동이 없고, `walk`를 반복해도 발이 미끄러져 보이지 않는다.
- [ ] 흰 몸이 질감 얼룩 없이 고른 단색이다.

## 7. 넘길 곳

결과물은 캐릭터 자료 폴더의 `model3d/` 아래에 날짜 폴더로 둔다(예: `model3d/20261105_tripo_draft/writeloop.glb`). 생성 도구 이름, 넣은 그림, 설명 문구, 손본 내용을 같은 폴더의 `README.md`에 적는다. 앱 저장소에는 검사를 통과한 최종본만 옮긴다.
