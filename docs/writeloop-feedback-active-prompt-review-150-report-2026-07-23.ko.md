# WriteLoop 활성 질문 수동 개편 후 150건 LLM 회귀 테스트 보고서

## 1. 결론

2026년 7월 23일, 활성 질문 675개를 수동 검토해 220개의 문구·번역·슬롯 계약을 수정한 개발 환경에서 기존과 동일한 150개 답변을 OpenAI `gpt-5.6-luna`에 실제로 전송했다.

엄격 자동 채점 결과는 **137/150, 91.3%**다. 질문별 의미 계약을 처음 적용한 7월 19일 결과 **133/150, 88.7%**보다 **4건, 2.6%p 상승**했다.

이번 질문 개편과 직접 겹치는 네 질문의 24개 답변은 **20/24에서 24/24로 개선**됐다.

- 빠른 식사 질문: 6/6 유지
- 아침 루틴 질문: 5/6 → 6/6
- 시간 관리 문제 질문: 6/6 유지
- 통근 지연 질문: 3/6 → 6/6

특히 통근 지연 질문은 질문 문구와 `PROBLEM` 계약을 함께 수정한 뒤 누락 해결책, 막연한 해결책, 문법 오류 사례가 모두 올바른 미션으로 바뀌었다. 질문 문구와 슬롯 계약을 함께 정렬한 방향은 실제 효과가 있었다.

다만 공식 실패 13건이 남아 배포 게이트는 통과하지 못했다. 수동 검토 결과는 다음과 같다.

| 원인 | 건수 |
|---|---:|
| 실제 LLM 판정 오류 | 2 |
| 한국어 스캐폴드 출력 오류 | 3 |
| 질문 문구와 메타데이터·계약 불일치 | 7 |
| 현재 우선순위와 기존 정답표 충돌 | 1 |
| 합계 | 13 |

즉, 13건 모두를 프롬프트 성능 문제로 보는 것은 정확하지 않다. 다음 개선은 질문·계약 정렬 7건을 먼저 해결하고, 문장 조각 및 막연한 계획 반례와 한국어 스캐폴드 검증을 보강하는 순서가 적절하다.

## 2. 테스트 조건

| 항목 | 값 |
|---|---|
| 실행 시각 | 2026-07-23 20:28:03~20:40:35 KST |
| 실행 시간 | 약 12분 32초 |
| 테스트 세트 | `scripts/feedback-quality/cases.completion-gate-150-v2.json` |
| 구성 | 6개 유형별 25건, 총 150건 |
| LLM 공급자 | OpenAI |
| 모델 | `gpt-5.6-luna` |
| reasoning effort | `low` |
| 동시 요청 | 2 |
| 케이스 제한 시간 | 180초 |
| 백엔드 OpenAI 제한 시간 | 120초 |
| API | 현재 소스로 재빌드한 개발 Docker 백엔드 `http://localhost/api/feedback` |
| variant | `active-prompt-manual-review-2026-07-23` |

실행 전 다음을 확인했다.

- 150개 케이스 형식 검증 통과
- 150개 질문 ID 및 질문 식별 문자열 사전검사 통과
- 활성 질문 수 675개 유지
- `OpenAI / gpt-5.6-luna / low` 설정 확인
- 현재 워크트리로 백엔드 Docker 이미지 재빌드
- 별도의 1건 연결 확인 성공

현재 통근 지연 질문과 사전검사 문구를 일치시키기 위해 `prompt-problem-1108`의 6개 케이스에서 질문 식별 문자열만 `commuting delays`에서 `commuting delay`로 바꿨다. 학습자 답변, 기대 미션, 기대 슬롯과 채점 기준은 변경하지 않았다.

연결 확인 1건은 공식 150건 통계에 포함하지 않았다. 이번 결과는 확률적 LLM을 한 번 실행한 표본이다.

## 3. 직전 결과와 비교

### 3.1 유형별 엄격 통과

| 유형 | 7월 19일 | 7월 23일 | 변화 |
|---|---:|---:|---:|
| `OFF_TOPIC` | 25/25 | 24/25 | -1 |
| `FRAGMENT` | 25/25 | 24/25 | -1 |
| `MISSING_SLOT` | 24/25 | 24/25 | 유지 |
| `GENERIC_CONTENT` | 16/25 | 18/25 | +2 |
| `GRAMMAR` | 20/25 | 22/25 | +2 |
| `COMPLETE` | 23/25 | 25/25 | +2 |
| **전체** | **133/150, 88.7%** | **137/150, 91.3%** | **+4건, +2.6%p** |

충분한 답변 25건은 모두 완료됐고, 요청 실패와 HTTP 502는 한 건도 없었다. 반면 막연한 내용 판정은 18/25로 여전히 가장 약한 영역이다.

### 3.2 동일 케이스 쌍별 변화

직전에는 실패했지만 이번에 통과한 사례는 10건이고, 직전에는 통과했지만 이번에 실패한 사례는 6건이다. 순증가는 4건이다.

주요 개선은 다음과 같다.

- 충분한 목표 답변 2건이 불필요한 `SLOT` 대신 `COMPLETE`
- 목표·계획 문법 답변 3건이 누락 슬롯 대신 `GRAMMAR_FIX`
- 아침 루틴의 단일 행동 답변이 새 질문의 두 번째 필수 행동 `ADDITIONAL_ACTION`을 정확히 선택
- 통근 지연의 누락·막연 해결책이 모두 `SOLUTION`
- 통근 지연 문법 오류가 `GRAMMAR_FIX`

주요 회귀는 다음과 같다.

- 문장 조각 1건이 `STRUCTURE_FIX` 대신 `SLOT`
- 질문 맥락을 반복하도록 요구하는 계약 때문에 문법 미션 1건이 슬롯 미션으로 변경
- 한국어 스캐폴드 누락 3건
- 장보기 루틴에서 막연한 이유 대신 행동을 다시 요구한 1건

평균 응답 시간은 8.88초에서 9.98초로 약 1.10초 늘었다. p95는 12.25초에서 13.33초로 늘었다.

## 4. 배포 게이트

| 게이트 | 목표 | 결과 | 판정 |
|---|---:|---:|---|
| 예상 미완료 답변의 조기 완료 | 0건 | 4/125 | 실패 |
| 오프토픽 `TASK_RESET` | 100% | 25/25, 100% | 통과 |
| 문법 `GRAMMAR_FIX` | 95% 이상 | 22/25, 88% | 실패 |
| 실제 내용 미션 스캐폴드 | 100% | 72/75, 96% | 실패 |
| 문장 조각 `STRUCTURE_FIX` | 참고 | 24/25, 96% | 미달 |
| canonical 대상 슬롯 일치 | 참고 | 69/75, 92% | 미달 |
| 충분한 답변 완료 | 참고 | 25/25, 100% | 통과 |

자동 실패 코드의 `missing_content_scaffold`는 7회지만, 이 중 4회는 잘못 완료돼 애초에 내용 미션이 없었던 사례다. 실제 `SLOT` 또는 `TASK_RESET` 미션에서 스캐폴드가 불완전했던 것은 3건이다.

## 5. 이번 질문 개편의 직접 효과

### 5.1 빠른 식사

질문을 다음처럼 바꿨다.

```text
When do you usually make a quick meal at home, and what meal do you make?
```

시간과 음식이라는 두 요구가 분명해졌으며 6개 유형이 모두 통과했다. 막연한 `something easy`는 `SLOT / CHOICE`, 음식이 빠진 답변도 `SLOT / CHOICE`로 처리됐다.

### 5.2 아침 루틴

질문을 한 행동이 아니라 두 행동을 직접 요구하도록 바꿨다.

```text
What are two things you usually do in the morning?
```

`I drink coffee every morning.`은 시간 표현이 부족한 답변이 아니라 두 번째 행동이 빠진 답변으로 해석돼 `SLOT / ADDITIONAL_ACTION`을 반환했다. 직전 조기 완료가 이번에는 올바른 내용 미션으로 바뀌었다.

### 5.3 통근 지연

질문과 계약을 다음 관계로 정리했다.

```text
What commuting delay do you sometimes experience, and what do you do when it happens?
```

- `My bus is often delayed during the morning commute.` → `SLOT / SOLUTION`
- `My bus is often delayed, so I do something about it.` → `SLOT / SOLUTION`
- `When my bus is delayed, I checks ...` → `GRAMMAR_FIX`
- 구체적인 지연과 대처가 있는 답변 → `COMPLETE`

직전에는 지연 자체를 `PROBLEM`으로 인정하지 않아 3건이 실패했지만 이번에는 6/6을 통과했다.

## 6. 공식 실패 13건 상세 분석

### 6.1 실제 LLM 판정 오류 2건

#### A. 문장 조각을 내용 미션으로 처리

```text
Nap on weekend.
```

`structureAssessment`가 문장 조각으로 판정해야 하지만 `SLOT / ACTION`이 선택됐다. 최종 `correctedAnswer`도 `Nap on weekends.`로 주어와 동사가 없는 조각이었다. `Nap on weekends`, `Coffee every morning`, `Study after dinner`처럼 명사·동사구만 있는 반례를 문장 구조 프롬프트에 추가할 필요가 있다.

#### B. 막연한 계획을 완료

```text
I want to improve my stamina, so I will exercise more.
```

질문은 목표와 실천 계획을 요구한다. `exercise more`는 운동 종류, 빈도, 시간, 기간이 없는 막연한 계획이므로 `PLAN=GENERIC`이어야 한다. 그러나 완료됐다. `exercise more`, `study more`, `practice more`, `try harder`를 `PLAN`의 구체성 반례로 강화해야 한다.

### 6.2 한국어 스캐폴드 출력 오류 3건

미션과 대상 슬롯은 모두 정확했지만 `skeletonKo`가 영어로 반환됐다.

| 번호 | 미션 | 잘못된 `skeletonKo` |
|---:|---|---|
| 25 | `TASK_RESET / PROBLEM` | `One challenge I often face at work or school is ___.` |
| 93 | `SLOT / PLAN` | `I will ___ to improve my stamina.` |
| 148 | `SLOT / REASON` | `I am learning English because I need it for ___.` |

출력 스키마는 문자열 존재만 보장할 뿐 한국어 여부는 보장하지 못한다. 프롬프트의 한국어 예시를 강화하고, 백엔드에서 `skeletonKo`의 한글 포함 여부를 검증해 계약 오류로 한 번만 재호출하는 방식이 적절하다. 누락된 내용을 서버가 임의 번역해 채우는 fallback은 사용하지 않는 편이 기존 원칙과 일치한다.

### 6.3 질문 문구에 없는 깊이를 요구하는 메타데이터 3건

다음 질문은 사용자에게 한 가지 핵심 답만 요구하지만 `minimumDepthSlots=1`로 추가 내용을 요구한다.

| 질문 | 답변 | 충돌 |
|---|---|---|
| `What do you usually do after dinner?` | `I usually relax after dinner.` | 질문은 행동 하나만 요구하지만 추가 깊이 필요 |
| `How do you usually spend your weekend?` | `I usually take a nap on weekends.` | 질문은 주말 활동 하나만 요구하지만 추가 깊이 필요 |
| `Describe how your view of friendship has changed over time.` | 과거에는 많은 친구, 지금은 적은 친구 선호 | 질문은 전후 변화만 요구하지만 `CHANGE_CAUSE`까지 필요 |

세 답변을 완료한 LLM 판단은 질문 문구만 보면 자연스럽다. 제품 의도가 추가 내용을 반드시 받는 것이라면 질문에 두 번째 요구를 직접 써야 한다.

- 저녁 질문: 추가 행동·이유·결과 중 하나를 질문에 명시
- 주말 질문: 두 활동 또는 활동과 이유를 질문에 명시
- 우정 변화 질문: 변화 원인까지 질문에 명시

반대로 짧은 직접 답변을 허용하려면 `minimumDepthSlots`를 0으로 낮춰야 한다. 현재처럼 질문과 메타데이터가 다른 요구를 하면 프롬프트만으로 안정적으로 해결하기 어렵다.

### 6.4 질문 맥락을 다시 쓰게 하는 계약 4건

#### A. 직장·학교 문제 2건

질문:

```text
What is one challenge you often face at work or school, and how do you deal with it?
```

답변은 `too many tasks`라는 문제를 제시했지만 `at work` 또는 `at school`을 반복하지 않았다는 이유로 `PROBLEM`을 미충족 처리했다.

- 막연한 해결책 답변은 `SOLUTION` 대신 `PROBLEM`
- 문법 오류 답변은 `GRAMMAR_FIX` 대신 `PROBLEM`

원래 질문이 직장·학교 맥락을 이미 제공하므로 답변에서 같은 배경을 반복하도록 강제하지 않아야 한다.

#### B. 올해 만들 습관 1건

```text
I want build a reading habit because it help me focus.
```

구체적인 읽기 습관과 이유가 있지만 `this year`를 다시 쓰지 않았다는 이유로 `GOAL`을 미충족 처리했다. 그 결과 명백한 문법 오류보다 슬롯 미션이 우선됐다. 질문에 있는 올해라는 시간 프레임은 답변에서 반복하지 않아도 상속하도록 계약을 완화해야 한다.

#### C. 장보기 후 행동 1건

```text
I put the food away because that is better.
```

행동은 구체적이고 이유가 막연하므로 `REASON`이 대상이어야 한다. 그러나 `After grocery shopping`을 답변에서 다시 쓰지 않았다는 이유로 `ACTION`을 선택했다. 이 역시 질문이 제공한 시간 관계를 답변이 반복하도록 강제한 계약 문제다.

### 6.5 기존 정답표와 현재 우선순위 충돌 1건

```text
Open-plan offices makes teamwork easier, but noise hurt concentration,
so I thinks quiet rooms are necessary.
```

기존 정답표는 `GRAMMAR_FIX`를 기대한다. 하지만 질문은 개방형 사무실이 전체적으로 더 유익한지 해로운지에 대한 `OPINION`을 필수로 요구하며, 답변은 조용한 공간이 필요하다고만 했을 뿐 전체 판단을 직접 밝히지 않았다.

현재 우선순위인 `필수 슬롯 → LOCAL 문법`에 따르면 실제 `SLOT / OPINION`이 맞다. 이 케이스는 모델을 고치기보다 정답표를 `SLOT / OPINION`으로 변경해야 한다. 공식 점수는 직전과의 비교를 위해 기존 정답표 기준으로 유지했다.

## 7. 개선 우선순위

### 1순위. 질문과 메타데이터·계약 7건 정렬

프롬프트를 더 길게 만들기 전에 다음을 수정해야 한다.

- `prompt-a-1`, `prompt-a-3`, `prompt-reflection-26`: 질문에 두 번째 요구를 명시하거나 깊이를 0으로 조정
- `prompt-b-1`: 직장·학교 맥락 반복 요구 제거
- `prompt-b-3`: `this year` 반복 요구 제거
- `prompt-routine-1103`: 장보기 후라는 시간 관계 반복 요구 제거

질문 자체가 제공한 배경은 답변의 생략 가능한 문맥으로 취급해야 한다.

### 2순위. 정답표 1건 갱신

개방형 사무실 문법 사례는 현재 미션 우선순위에 맞게 `SLOT / OPINION`으로 수정한다. 이렇게 해야 이후 테스트가 올바른 제품 정책을 평가한다.

### 3순위. 문장 조각과 막연한 계획 반례 보강

- 문장 조각: `Nap on weekends.`, `Coffee every morning.`
- 막연한 계획: `exercise more`, `study more`, `practice more`, `try harder`

단순 단어 목록이 아니라 왜 완전한 문장 또는 구체적인 실행 계획이 아닌지 판정 기준과 함께 제공해야 한다.

### 4순위. 한국어 스캐폴드 검증

`skeletonKo`에 실제 한글이 포함됐는지 백엔드 계약 검증을 추가하고, 실패 시 오류 이유를 포함해 한 번만 재호출한다. 이번에는 3/75, 4%의 실제 내용 미션에서 언어 계약이 깨졌다.

## 8. 종합 판단

활성 질문 수동 개편은 직접 영향을 받은 24개 사례를 모두 통과시키며 효과를 입증했다. 특히 질문과 슬롯의 관계를 함께 고친 통근 지연 문항의 개선이 뚜렷하다.

그러나 이번 테스트는 전수 검토 후에도 일부 질문에 숨은 깊이 요구와 과도한 문맥 반복 계약이 남아 있음을 보여 줬다. 현재 가장 큰 개선 여지는 모델 교체나 추론 수준 상향이 아니라 **질문 문구와 질문별 계약을 다시 일치시키는 것**이다.

공식 배포 판단은 보류가 적절하다. 위 메타데이터 7건과 정답표 1건을 먼저 정리한 뒤 같은 150건을 다시 실행하면 프롬프트 고유 오류와 데이터 계약 오류를 더 정확히 분리할 수 있다.

## 9. 산출물과 재현 명령

- 전체 응답: `.codex_logs/feedback-active-prompt-review-150-2026-07-23/latest.json`
- 자동 집계: `.codex_logs/feedback-active-prompt-review-150-2026-07-23/summary.json`
- 7월 19일 대비 비교: `.codex_logs/feedback-active-prompt-review-150-2026-07-23/comparison-vs-2026-07-19.json`
- 테스트 세트: `scripts/feedback-quality/cases.completion-gate-150-v2.json`

```powershell
$env:WRITELOOP_FEEDBACK_PROVIDER='openai'
$env:WRITELOOP_FEEDBACK_MODEL='gpt-5.6-luna'
$env:WRITELOOP_FEEDBACK_REASONING_EFFORT='low'
$env:WRITELOOP_FEEDBACK_VARIANT='active-prompt-manual-review-2026-07-23'

node scripts/run-feedback-quality-check.mjs `
  --cases scripts/feedback-quality/cases.completion-gate-150-v2.json `
  --base-url http://localhost `
  --concurrency 2 `
  --timeout-ms 180000 `
  --report-dir .codex_logs/feedback-active-prompt-review-150-2026-07-23 `
  --include-pass-payloads
```
