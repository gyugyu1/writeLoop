# WriteLoop 통합 진단 계약 150건 LLM 회귀 테스트 보고서

## 1. 결론

2026년 7월 17일, 최신 개발 백엔드에 다음 통합 계약을 적용한 뒤 OpenAI `gpt-5.6-luna`에 150개 답변을 실제로 전송했다.

- 문장 형태와 교정문을 `structureAssessment` 하나로 통합
- 슬롯 상태, 증거, 보강 자료를 고정 키 `slotAssessments` 객체로 통합
- 문법 영향도와 교정 근거를 `grammarIssues` 항목 단위로 통합
- 백엔드가 미션 우선순위와 최종 `targetSlot`을 결정

자동 채점 결과는 **139/150, 92.7%**다. 직전 실행의 **129/150, 86.0%**보다 **10건, 6.7%p 상승**했다.

가장 큰 성과는 응답 계약 안정성과 문장 조각 처리다.

- 사용자에게 피드백을 반환한 요청: **132/150 -> 144/150**
- 계약 위반으로 발생한 HTTP 502: **18건 -> 6건**
- 문장 조각 `STRUCTURE_FIX`: **16/25 -> 25/25**
- 필수 슬롯 누락 처리: **23/25 -> 25/25**
- 구조 교정문 조립 오류: 현재 규칙 재채점 기준 **3건 -> 0건**

반면 아직 바로 배포하기에는 두 가지 문제가 남아 있다.

- 막연한 답변 3건을 충분한 답변으로 보고 조기 완료했다.
- 충분한 답변 또는 문법 답변 6건은 슬롯 내부 계약 위반 때문에 HTTP 502가 됐다.

따라서 **통합 방향은 효과가 확인됐지만, 현재 버전은 배포 게이트를 통과하지 못했다.**

## 2. 테스트 조건

| 항목 | 값 |
|---|---|
| 실행 시간 | 2026-07-17 01:59:16~02:12:11 KST |
| 총 실행 시간 | 약 12분 55초 |
| 케이스 | `cases.completion-gate-150-v2.json` |
| 구성 | 6개 유형별 25건, 총 150건 |
| LLM 공급자 | OpenAI |
| 모델 | `gpt-5.6-luna` |
| reasoning effort | `low` |
| 동시 요청 | 2 |
| 케이스별 제한 시간 | 180초 |
| 백엔드 OpenAI 제한 시간 | 120초 |
| API | 최신 소스로 재빌드한 개발 백엔드 `http://localhost/api/feedback` |
| variant | `unified-assessments-2026-07-17` |

비교 대상은 2026년 7월 16일의 `structure-fix-2026-07-16` 실행이다. 모델, reasoning effort, 동시 요청 수, 테스트 케이스를 동일하게 유지했다.

LLM 응답은 확률적이므로 이 결과는 한 번의 표본 실행이다. 다만 같은 150개 입력을 사용했기 때문에 계약 구조 변경 전후의 큰 차이를 확인하는 회귀 테스트로는 의미가 있다.

## 3. 전체 결과 비교

| 지표 | 직전 | 현재 | 변화 |
|---|---:|---:|---:|
| 자동 채점 통과 | 129/150, 86.0% | **139/150, 92.7%** | **+10건, +6.7%p** |
| 정상 응답 | 132/150, 88.0% | **144/150, 96.0%** | **+12건, +8.0%p** |
| HTTP 502 | 18건 | **6건** | **-12건, 66.7% 감소** |
| 평균 지연 | 11,394ms | **10,265ms** | **-1,129ms** |
| p50 지연 | 10,624ms | **10,342ms** | **-282ms** |
| p95 지연 | 14,802ms | **13,306ms** | **-1,496ms** |
| canonical 슬롯 일치 | 68/75, 90.7% | **71/75, 94.7%** | **+3건, +4.0%p** |
| 내용 미션 종단 간 성공 | 43/50, 86.0% | **46/50, 92.0%** | **+3건, +6.0%p** |

### 동일한 현재 규칙으로 다시 비교한 결과

직전 보고서의 129건에는 현재 검사기가 새로 잡는 구조 교정문 불일치 3건이 포함돼 있다. 저장된 직전 응답을 현재 규칙으로 다시 평가하면 직전 엄격 통과는 126건이다.

쌍별 비교 결과는 다음과 같다.

| 결과 | 건수 |
|---|---:|
| 개선 | 17건 |
| 동일 | 127건 |
| 회귀 | 6건 |

즉, 단순히 채점 규칙이 느슨해져 점수가 오른 것이 아니다. 현재의 더 엄격한 규칙에서도 개선 사례가 회귀 사례보다 많다.

## 4. 유형별 결과

| 유형 | 직전 | 현재 | 해석 |
|---|---:|---:|---|
| `OFF_TOPIC` | 25/25, 100% | **25/25, 100%** | 유지 |
| `FRAGMENT` | 16/25, 64% | **25/25, 100%** | 크게 개선 |
| `MISSING_SLOT` | 23/25, 92% | **25/25, 100%** | 개선 |
| `GENERIC_CONTENT` | 20/25, 80% | **21/25, 84%** | 소폭 개선, 조기 완료 문제 남음 |
| `GRAMMAR` | 23/25, 92% | **23/25, 92%** | 동일, 2건은 슬롯 계약 502 |
| `COMPLETE` | 22/25, 88% | **20/25, 80%** | 회귀 |

### 오프토픽

25건 모두 `TASK_RESET`으로 처리했다. 질문과 무관한 답변을 기존 문장 보강으로 잘못 이어 가는 문제는 이번 실행에서 발생하지 않았다.

### 문장 조각

25건 모두 `STRUCTURE_FIX`로 처리했다. `structureAssessment`가 문장 형태와 하나의 전체 교정문을 함께 반환하도록 통합한 효과가 가장 분명하게 나타났다.

대표 결과는 다음과 같다.

| 입력 | 전체 교정문 |
|---|---|
| `Dishes and TV after dinner.` | `I wash the dishes and watch TV after dinner.` |
| `After work, maybe noodles.` | `After work, I usually choose noodles for a quick meal at home.` |
| `Gym after work, relaxing.` | `I go to the gym after work because it is relaxing.` |
| `Because travel and new people.` | `I am learning English because I want to travel and meet new people.` |

25개 전체 교정문을 추가 점검한 결과 `.,`, `..`, 중복 문장처럼 여러 부분 교정문을 합치면서 생기던 조립 오류는 0건이었다. 백엔드가 부분 문장을 조립하지 않고 LLM의 권위 있는 전체 교정문 하나를 그대로 사용하도록 바꾼 효과다.

### 필수 슬롯 누락

25건 모두 기대한 canonical 슬롯을 선택했다. 특히 과거에 혼동했던 슬롯 쌍도 정확하게 처리했다.

- 장단점 질문에서 `DISADVANTAGE` 누락을 `SPECIFIC_TIME`으로 바꾸지 않음
- 변화 질문에서 `NOW_STATE`와 `CHANGE_CAUSE`를 구분함
- 목표 질문에서 `PLAN` 누락을 일반 `DETAIL`로 바꾸지 않음

### 스캐폴드

실제로 사용자에게 반환된 내용 미션 72건은 모두 다음 묶음을 갖췄다.

- 영어 골격 `skeletonEn`
- 한국어 골격 `skeletonKo`
- 한국어 뜻이 포함된 표현 선택지 2개 이상

따라서 스캐폴드 계약은 **72/72, 100%**다.

## 5. 남은 HTTP 502 6건

6건 모두 OpenAI 호출 자체의 장애나 시간 초과가 아니었다. LLM이 반환한 `slotAssessments` 한 항목이 백엔드의 내부 규칙과 맞지 않아 거부됐다.

| 번호 | 유형 | 답변 요약 | 백엔드가 거부한 이유 |
|---:|---|---|---|
| 41 | 문법 | `I will practices ... every evening.` | `SPECIFIC_TIME=MISSING`인데 증거·지원 규칙이 맞지 않음 |
| 64 | 막연한 내용 | `because that is better` | `REASON=GENERIC`인데 완전한 support 1개 규칙을 지키지 않음 |
| 78 | 충분한 답변 | `blue ... ocean ... calm` | `DETAIL=MISSING`인데 완전한 support 1개 규칙을 지키지 않음 |
| 96 | 충분한 답변 | `jog for thirty minutes three times a week ...` | `SPECIFIC_TIME=MISSING`인데 증거·지원 규칙이 맞지 않음 |
| 120 | 충분한 답변 | 오픈형 사무실의 장단점과 조건 제시 | `DETAIL`의 evidence가 학습자 원문과 정확히 일치하지 않음 |
| 125 | 문법 | `I likes ... flavor make ...` | `DETAIL=SATISFIED`인데 불필요한 support가 함께 들어옴 |

현재 규칙은 다음과 같다.

| 슬롯 상태 | evidence | support |
|---|---|---|
| `SATISFIED` | 반드시 있음 | 0개 |
| `GENERIC` | 반드시 있음 | 정확히 1개 |
| `MISSING` | 반드시 없음 | 정확히 1개 |

객체 통합은 같은 슬롯이 여러 배열에 중복되거나 상태와 지원 목록이 서로 어긋나는 문제를 크게 줄였다. 그러나 `status`, `evidence`, `support` 사이의 조건을 LLM이 여전히 각각 판단하므로 한 객체 안에서도 불가능한 조합을 만들 수 있다.

또한 백엔드는 최종 미션에 사용되지 않는 선택 슬롯까지 모두 검증한다. 41번처럼 최종적으로는 문법 교정을 보여주면 되는 경우에도 선택 슬롯 하나가 잘못되면 전체 피드백이 502가 된다.

## 6. 정상 응답 중 품질 오판 5건

### 1. 자연스러운 표현을 문법 오류로 과잉 교정

```text
I want to improve my English speaking, so I will practice a five-minute conversation with a friend every evening.
```

LLM은 `practice a five-minute conversation`을 `practice having a five-minute conversation`으로 고치며 `GRAMMAR_FIX`를 선택했다. 원문도 문법적으로 허용되므로 필수 교정이 아니라 선택적 표현 다듬기에 가깝다. 충분한 답변을 완료하지 못하게 만든 과잉 교정이다.

### 2. 막연한 내용 3건을 조기 완료

| 답변 | 실제 부족한 점 |
|---|---|
| `People used to meet differently, but now they use technology ...` | 과거 방식인 `BEFORE_STATE`가 구체적이지 않음 |
| `My favorite color is blue because it is nice.` | `nice`가 이유를 설명하지 못함 |
| `I live in a nice area.` | 실제 거주 장소 `PLACE`가 제시되지 않음 |

문장 형태와 문법은 정상이어도 슬롯에 학습 가능한 정보가 들어 있는지는 별도 문제다. 이번 세 사례는 단어가 슬롯처럼 보인다는 이유로 `SATISFIED` 처리한 것으로 해석된다.

### 3. 충분한 답변에 예시를 추가로 강요

```text
Successful companies should provide safe working conditions, reduce pollution,
and report their impact honestly because their decisions affect employees and local communities.
```

답변은 주장, 책임 세 가지, 이유까지 담고 있지만 `EXAMPLE`을 추가하라는 `SLOT` 미션이 열렸다.

이 사례는 LLM만의 문제가 아니라 질문 메타데이터와 정답표의 정책 충돌도 있다.

- DB의 `prompt-c-2.minimumDepthSlots`는 2다.
- 현재 optional 슬롯은 `REASON`, `EXAMPLE`, `RESULT`, `ADVANTAGE`, `DISADVANTAGE`다.
- 정답표는 이 답변을 이미 충분하다고 본다.

답변에서 `REASON`만 선택 깊이 슬롯으로 인정되면 백엔드는 두 번째 깊이 슬롯을 채우기 위해 `EXAMPLE`을 요구한다. 제품 의도가 현재 정답표와 같다면 이 질문의 `minimumDepthSlots`를 1로 낮추거나, 책임의 구체적인 나열을 인정할 슬롯 정책을 조정해야 한다.

## 7. 배포 게이트

| 배포 기준 | 목표 | 현재 | 판정 |
|---|---:|---:|---|
| 조기 완료 | 0건 | 3건 | **실패** |
| 오프토픽 `TASK_RESET` | 100% | 25/25, 100% | 통과 |
| 문법 오류 종단 간 성공 | 95% 이상 | 23/25, 92% | **실패** |
| 열린 내용 미션 스캐폴드 | 100% | 72/72, 100% | 통과 |
| 문장 조각 `STRUCTURE_FIX` | 95% 이상 권장 | 25/25, 100% | 통과 |
| 요청 성공률 | 99% 이상 권장 | 144/150, 96% | **실패** |
| 구조 교정문 조립 안정성 | 100% 권장 | 25/25, 100% | 통과 |

문법 테스트의 2건 실패는 문법 분류 오판이 아니라 슬롯 계약 위반 502다. 그래도 사용자는 피드백을 받지 못하므로 종단 간 배포 기준에서는 실패로 계산하는 것이 맞다.

## 8. 다음 개선 우선순위

### 1순위. 슬롯 내부에서 불가능한 조합을 만들지 못하게 한다

현재 가장 큰 기술적 실패 원인은 `slotAssessments` 안에서 `status`, `evidence`, `support`가 서로 맞지 않는 것이다.

우선 검토할 방향은 다음과 같다.

- `status`를 별도 생성하지 않고 evidence/support 형태로부터 백엔드가 계산해 중복 판단을 제거한다.
- 상태별로 허용되는 evidence/support 모양을 출력 스키마에서 더 강하게 제한한다.
- 계약 오류가 발생하면 오류 사유를 포함해 한 번만 재호출하고, 그래도 실패하면 현재처럼 unavailable을 반환한다.

객체 통합을 되돌릴 이유는 없다. 남은 문제는 통합 객체 내부의 조건부 규칙을 더 단순하게 만드는 것이다.

### 2순위. 막연함 판정 예시를 구체화한다

다음 표현은 슬롯의 존재가 아니라 `GENERIC` 또는 `MISSING`으로 판단하도록 예시를 추가할 필요가 있다.

- `nice`, `good`, `better`
- `differently`, `somehow`, `some problems`
- 장소를 묻는 질문의 `a nice area`

특히 `PLACE`는 단순히 `area`, `place`, `somewhere`라는 명사가 있다는 것만으로 충족하지 않고, 사용자가 어디에 사는지 식별할 수 있는 장소 정보가 있어야 한다.

### 3순위. 문법과 표현 다듬기의 경계를 강화한다

`practice a conversation`처럼 문법적으로 허용되는 문장을 더 자연스러운 대안이 있다는 이유만으로 `GRAMMAR_FIX`로 올리지 않아야 한다. 의미 전달과 문법이 정상이라면 선택 표현은 `refinementExpressions`에만 두고 완료를 막지 않는 편이 적절하다.

### 4순위. 질문 메타데이터와 정답표를 맞춘다

`prompt-c-2`처럼 `minimumDepthSlots=2`가 충분한 답변에도 추가 미션을 강제하는 질문은 제품 의도를 다시 확인해야 한다. 현재 정답표를 유지한다면 메타데이터를 조정하는 것이 맞다.

## 9. 최종 판단

이번 통합은 성공적인 방향 전환이다.

- 구조 진단과 전체 교정문을 하나로 묶어 FRAGMENT와 교정문 조립 문제를 해결했다.
- 슬롯 진단을 고정 키 객체로 묶어 요청 실패를 18건에서 6건으로 줄였다.
- 문법 영향도를 이슈 안에 넣어 문법 상태와 근거가 서로 어긋나는 계약 오류를 제거했다.

다만 통합만으로 모든 불일치가 사라지는 것은 아니다. 슬롯 상태와 evidence/support의 관계가 여전히 조건부 규칙으로 남아 있고, 막연함 판단과 완료 경계도 모델 판단에 의존한다.

따라서 다음 작업은 새 필드를 더 추가하는 것이 아니라 다음 두 가지에 집중하는 것이 적절하다.

1. `slotAssessments` 내부의 중복 판단을 더 줄여 502를 제거한다.
2. 막연한 슬롯과 충분한 답변의 경계를 질문 메타데이터 및 예시로 명확히 한다.

## 10. 산출물

- 현재 전체 응답: `.codex_logs/feedback-completion-gate-150-unified-assessments-2026-07-17/latest.json`
- 현재 집계: `.codex_logs/feedback-completion-gate-150-unified-assessments-2026-07-17/summary.json`
- 직전 대비 쌍별 비교: `.codex_logs/feedback-completion-gate-150-unified-assessments-2026-07-17/comparison.json`
- 직전 전체 응답: `.codex_logs/feedback-completion-gate-150-structure-fix-2026-07-16/latest.json`
- 테스트 케이스: `scripts/feedback-quality/cases.completion-gate-150-v2.json`

실행 명령은 다음과 같다.

```powershell
$env:WRITELOOP_FEEDBACK_PROVIDER='openai'
$env:WRITELOOP_FEEDBACK_MODEL='gpt-5.6-luna'
$env:WRITELOOP_FEEDBACK_REASONING_EFFORT='low'
$env:WRITELOOP_FEEDBACK_VARIANT='unified-assessments-2026-07-17'

node scripts/run-feedback-quality-check.mjs `
  --cases scripts/feedback-quality/cases.completion-gate-150-v2.json `
  --base-url http://localhost `
  --report-dir .codex_logs/feedback-completion-gate-150-unified-assessments-2026-07-17 `
  --concurrency 2 `
  --timeout-ms 180000 `
  --include-pass-payloads
```
