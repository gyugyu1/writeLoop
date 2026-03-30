# 코치 Refinement 벤치마크 리포트

작성일: 2026-03-30  
범위: `refinementExpressions` 품질, novelty 필터링, hint fallback, model supplement 동작

## 목적

이번 라운드의 목적은 피드백 이후 학습자에게 보여주는 `refinementExpressions`의 품질을 높이는 것이었습니다.

중점적으로 확인한 질문은 다음 세 가지입니다.

1. 주된 병목이 OpenAI 프롬프트인지, 백엔드 후처리인지
2. raw `prompt_hints` fallback을 너무 많이 쓰고 있지는 않은지
3. 다음과 같은 저품질 표현을 줄이면서 개인화를 유지할 수 있는지
   - 영어 표현 안에 한글이 섞이는 경우
   - fragment-like 표현
   - ellipsis/starter-like 표현
   - comma-heavy list-like 표현

## 관련 파일

- `apps/backend/src/main/java/com/writeloop/service/FeedbackService.java`
- `apps/backend/src/main/java/com/writeloop/service/OpenAiFeedbackClient.java`
- `apps/backend/src/test/java/com/writeloop/service/FeedbackServiceTest.java`
- `apps/backend/src/test/java/com/writeloop/service/OpenAiFeedbackClientTest.java`
- `scripts/feedback_refinement_benchmark.py`

## 벤치마크 도구

재사용 가능한 벤치마크 실행 스크립트를 추가했습니다.

- `scripts/feedback_refinement_benchmark.py`

이 스크립트가 하는 일:

- `/api/prompts`에서 프롬프트를 조회
- 카테고리에 맞는 synthetic learner answer 생성
- `/api/feedback` 호출
- Docker 로그에서 refinement diagnostics 파싱
- 표현 품질 신호와 fallback 동작 집계

## 진단 로그 추가

`FeedbackService`에 refinement diagnostics 로그를 추가해서, 문제가 있는 sanitization pass마다 아래 항목을 볼 수 있게 했습니다.

- `rawInput`
- `rawAccepted`
- `modelSupplement`
- `hintFallback`
- `rejected[recommendation, blank, duplicate, novelty]`
- 최종 표현 source

이 로그 덕분에 다음을 분리해서 볼 수 있게 됐습니다.

- OpenAI 1차 생성 품질
- 백엔드 novelty 필터링 영향
- hint fallback 압력

## 1000개 샘플 감사

먼저 1000개의 생성 질문으로 큰 벤치마크를 돌렸습니다.

요약 결과:

- 총 요청: `1000`
- 성공: `531`
- 실패: `469`

중요한 점:

- 실패 469건은 대부분 품질 문제라기보다 OpenAI rate limit 문제였습니다.
- 백엔드에서는 `502`처럼 보였지만 실제 upstream 원인은 `429`였습니다.

성공 531건 기준 주요 수치:

- logged issue rate: `88.14%`
- hint fallback 사용: `326`
- rawAccepted가 0인 경우: `175`
- logged case 기준 평균 raw accepted: `0.94`
- logged case 기준 평균 hint fallback: `1.25`
- logged case 기준 평균 rejected novelty: `1.82`

1000개 샘플 감사의 핵심 결론:

- 문제는 OpenAI 프롬프트 하나만이 아니었습니다.
- 더 큰 병목은 `FeedbackService`의 백엔드 후처리였고, 특히 아래 두 가지가 컸습니다.
  - 공격적인 novelty rejection
  - 잦은 raw hint fallback

## 100개 고정 샘플 비교

전후 비교를 재현 가능하게 만들기 위해 아래 조건으로 100개 샘플 벤치마크를 반복했습니다.

- `seed=42`
- `workers=3`

## Baseline

리포트:

- `C:\\Users\\lwd33\\AppData\\Local\\Temp\\feedback_refinement_benchmark_before_100.json`

결과:

- 요청: `100`
- 성공: `92`
- 실패: `8`
- 평균 점수: `74.33`
- 성공 1건당 표현 수: `2.99`
- Hangul in expression: `100 / 275`
- Generic discourse markers: `7 / 275`
- Fragment-like: `57 / 275`
- Ellipsis/starter-like: `52 / 275`
- Comma-heavy list-like: `49 / 275`
- Logged issue rate: `0.8478`
- Hint fallback: `54`
- Zero raw accepted: `30`

해석:

- 너무 많은 표현이 fallback으로 대체되고 있었습니다.
- 품질 노이즈가 컸습니다.
- raw hint 기반 출력이 최종 결과에 너무 자주 섞이고 있었습니다.

## Round V1: novelty 완화 + hint fallback 축소

변경 내용:

- frame 표현이 token overlap 때문에 너무 쉽게 탈락하지 않도록 완화
- novelty overlap 기준을 조정해서 false-positive rejection 감소
- hint fallback은 최종 리스트가 비었을 때만 동작하도록 변경

리포트:

- `C:\\Users\\lwd33\\AppData\\Local\\Temp\\feedback_refinement_benchmark_after_100.json`

결과:

- 요청: `100`
- 성공: `91`
- 실패: `9`
- 평균 점수: `78.71`
- 성공 1건당 표현 수: `2.15`
- Hangul in expression: `51 / 196`
- Generic discourse markers: `11 / 196`
- Fragment-like: `39 / 196`
- Ellipsis/starter-like: `14 / 196`
- Comma-heavy list-like: `35 / 196`
- Logged issue rate: `0.7582`
- Hint fallback: `19`
- Zero raw accepted: `43`

해석:

- 품질은 좋아졌습니다.
- raw hint fallback 압력은 크게 줄었습니다.
- 하지만 표현 개수가 너무 많이 줄었습니다.
- 정밀도는 높아졌지만 coverage를 너무 잃었습니다.

## Round V2: model/corrected-answer supplement 강화

변경 내용:

- `FeedbackService`에서 supplement extraction 패턴을 확장
- 다음과 같은 frame을 더 잘 추출하도록 강화
  - `One challenge I often face with [noun] is [issue].`
  - `What I like most about [thing] is that [detail].`
  - `It helps me [verb] and [verb].`
  - `This makes it easier to [verb].`
  - `When I want to [verb], I [action].`
- `modelAnswer`뿐 아니라 `correctedAnswer`도 supplement source로 활용
- 패턴 매칭이 부족할 때 clause 단위 보강 추출 추가

리포트:

- `C:\\Users\\lwd33\\AppData\\Local\\Temp\\feedback_refinement_benchmark_after_100_v2.json`

결과:

- 요청: `100`
- 성공: `89`
- 실패: `11`
- 평균 점수: `81.24`
- 성공 1건당 표현 수: `2.69`
- Hangul in expression: `6 / 239`
- Generic discourse markers: `15 / 239`
- Fragment-like: `35 / 239`
- Ellipsis/starter-like: `4 / 239`
- Comma-heavy list-like: `5 / 239`
- Logged issue rate: `0.4045`
- Hint fallback: `2`
- Zero raw accepted: `2`
- Logged case 기준 평균 raw accepted: `1.58`

해석:

- 이 라운드가 전체적으로 가장 좋았습니다.
- raw hint fallback을 다시 늘리지 않고도 표현 수를 회복했습니다.
- OpenAI + model supplement 조합이 훨씬 강해졌습니다.
- hint fallback은 거의 사라졌습니다.

## Generic discourse marker 억제 실험

그 다음에는 아래와 같은 generic marker를 더 줄여보는 실험을 했습니다.

- `On the positive side`
- `However`
- `Overall`

초기 가정은, 이런 표현이 특히 balanced-opinion 이외의 프롬프트에도 과하게 나올 수 있다는 것이었습니다.

## 실험에서 확인한 점

실제 데이터를 보니 generic marker는 거의 `BALANCED_OPINION`에만 몰려 있었습니다.

즉 아래 카테고리에서 큰 문제는 아니었습니다.

- `PREFERENCE`
- `OPINION_REASON`
- `GENERAL`
- `GOAL_PLAN`

## Round V3, V4

리포트:

- `C:\\Users\\lwd33\\AppData\\Local\\Temp\\feedback_refinement_benchmark_after_100_v3.json`
- `C:\\Users\\lwd33\\AppData\\Local\\Temp\\feedback_refinement_benchmark_after_100_v4.json`

이 실험에서는 프롬프트 제약과 백엔드 필터를 통해 generic marker를 더 강하게 억제해봤습니다.

대표 결과:

- V3 평균 점수: `76.11`
- V4 평균 점수: `72.85`

둘 다 V2보다 나빴습니다.

해석:

- 이 방향은 제약이 너무 강했습니다.
- generic marker를 조금 줄이는 대신 전체 품질과 유연성을 더 많이 잃었습니다.
- 즉 개선처럼 보였지만 실제로는 regression에 가까웠습니다.

## 최종 결정

generic marker를 과하게 억제하는 실험은 되돌리고, V2 방향을 유지하기로 했습니다.

현재 유지할 기준 방향:

1. novelty 로직 완화 유지
2. hint fallback은 거의 최후 수단으로만 사용
3. `modelAnswer`와 `correctedAnswer` 기반 supplement 강화 유지
4. generic marker에 대한 광범위한 카테고리별 제약은 당분간 도입하지 않음

## 현재 가장 좋은 상태

이번 라운드에서 가장 좋은 상태는 V2 벤치마크 결과로 판단했습니다.

- 평균 점수 `81.24`
- hint fallback `2`
- zero raw accepted `2`
- issue rate `0.4045`
- 한글/노이즈 표현이 매우 낮은 수준

앞으로의 refinement 개선은 이 버전을 기준점으로 삼는 것이 좋습니다.

## 추가/수정된 테스트

이번 라운드에서 아래 테스트를 추가하거나 강화했습니다.

- `FeedbackServiceTest`
  - viable한 OpenAI refinement가 남아 있으면 raw hint로 채우지 않아야 함
  - `modelAnswer`에서 추가 reusable frame을 잘 뽑아야 함
- `OpenAiFeedbackClientTest`
  - novelty, non-copying of hints, content-bearing expansions 관련 지시가 유지되는지 검증

## 다음 권장 단계

이제 다음 개선 타깃은 raw hint fallback이 아닙니다.

권장 우선순위:

1. 저성능 카테고리에서 OpenAI 1차 생성 일관성 개선
2. `modelAnswer` 안에 2~4개의 extractable reusable chunk가 자연스럽게 들어가도록 더 안정화
3. 카테고리별 벤치마크를 더 세분화해서 보기
   - `PREFERENCE`
   - `GOAL_PLAN`
   - `ROUTINE`
4. 큰 1000개 감사 전에, 항상 100개 fixed-seed 비교로 먼저 변화 확인

## 요약

이번 라운드에서 확인한 핵심은 세 가지입니다.

1. 초기 병목은 OpenAI 자체보다 backend novelty filtering + raw hint fallback 압력이 더 컸습니다.
2. 가장 성공적인 개선은 OpenAI 원본을 더 살리고, `modelAnswer`/`correctedAnswer` 기반 supplement를 강화한 것이었습니다.
3. generic marker 추가 억제는 겉보기와 달리 효율이 낮았고, 유지하지 않는 것이 맞았습니다.
