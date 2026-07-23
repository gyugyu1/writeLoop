# WriteLoop 질문 맥락 상속 적용 후 150건 LLM 회귀 테스트 보고서

## 1. 결론

2026년 7월 23일, 질문 맥락 상속 규칙과 세 질문의 질문-슬롯 정렬을 반영한 개발 환경에서 150개 답변을 OpenAI `gpt-5.6-luna`에 실제로 전송했다.

엄격 자동 채점 결과는 **147/150, 98.0%**다. 직전 공식 결과인 **137/150, 91.3%**보다 **10건, 6.7%p 상승**했다.

다만 이번에는 질문과 정답표가 바뀐 케이스가 11건 있으므로 전체 점수만 직접 비교하면 변화가 과장될 수 있다. 입력과 정답표가 그대로인 139건만 비교해도 **130/139에서 137/139로 7건 개선**됐다. 따라서 상승분의 대부분은 단순한 정답표 변경이 아니라 실제 판정 개선으로 볼 수 있다.

가장 중요한 결과는 질문 맥락을 답변에서 불필요하게 반복하도록 요구했던 4건이 모두 정상화된 것이다.

- 직장·학교 문제의 막연한 해결책: `PROBLEM` 재요구에서 `SOLUTION` 구체화로 개선
- 직장·학교 문제의 문법 오류: `PROBLEM` 재요구에서 `GRAMMAR_FIX`로 개선
- 올해 만들 읽기 습관의 문법 오류: `GOAL` 재요구에서 `GRAMMAR_FIX`로 개선
- 장보기 후 행동의 막연한 이유: `ACTION` 재요구에서 `REASON` 구체화로 개선

남은 공식 실패는 3건이다.

- 원문 증거 계약 위반으로 재현되는 HTTP 502: 1건
- 명백한 오프토픽을 `SLOT`으로 처리: 1건
- 막연한 계획을 충족으로 인정해 조기 완료: 1건

배포 게이트 4개 중 문법 정확도와 스캐폴드 완전성은 통과했지만, 조기 완료 0건과 오프토픽 `TASK_RESET` 100% 기준은 통과하지 못했다. 품질은 크게 개선됐지만 현재 기준으로는 아직 배포 게이트 미통과다.

## 2. 테스트 조건

| 항목 | 값 |
|---|---|
| 실행 시각 | 2026-07-23 |
| 실제 호출 수 | 150건 |
| 공급자 | OpenAI |
| 모델 | `gpt-5.6-luna` |
| 추론 수준 | `low` |
| 동시성 | 2 |
| 요청 제한 시간 | 건당 120초 |
| 테스트 세트 | `cases.completion-gate-150-v3.json` |
| 실행 변형 | `question-context-inheritance-2026-07-23` |

150건은 다음 여섯 유형을 각 25건씩 포함한다.

| 유형 | 목적 |
|---|---|
| `OFF_TOPIC` | 질문과 무관한 답변을 `TASK_RESET`으로 판정하는지 확인 |
| `FRAGMENT` | 문장 조각을 `STRUCTURE_FIX`로 판정하는지 확인 |
| `MISSING_SLOT` | 빠진 필수 슬롯을 정확히 선택하는지 확인 |
| `GENERIC_CONTENT` | 슬롯을 형식적으로 언급했지만 내용이 막연한 답변을 구체화하는지 확인 |
| `GRAMMAR` | 실제 문법 오류를 근거 있는 `GRAMMAR_FIX`로 처리하는지 확인 |
| `COMPLETE` | 충분한 답변을 추가 미션 없이 완료하는지 확인 |

실행 전에 활성 `/api/prompts`와 테스트 질문을 대조했다. 백엔드를 재시작한 뒤에도 다음 계약이 유지되는 것을 확인했다.

- `prompt-a-1`: `ACTION + REASON`, `minimumDepthSlots=0`
- `prompt-a-3`: `ACTION + PLACE`, `minimumDepthSlots=0`
- `prompt-reflection-26`: `BEFORE_STATE + NOW_STATE + CHANGE_CAUSE`, `minimumDepthSlots=0`

## 3. 전체 결과

### 3.1 유형별 엄격 통과

| 유형 | 통과 | 통과율 |
|---|---:|---:|
| `OFF_TOPIC` | 24/25 | 96.0% |
| `FRAGMENT` | 25/25 | 100% |
| `MISSING_SLOT` | 25/25 | 100% |
| `GENERIC_CONTENT` | 24/25 | 96.0% |
| `GRAMMAR` | 24/25 | 96.0% |
| `COMPLETE` | 25/25 | 100% |
| **전체** | **147/150** | **98.0%** |

`FRAGMENT`, `MISSING_SLOT`, `COMPLETE`는 모두 통과했다. 특히 충분한 답변 25건을 모두 완료해, 자연스러운 답변에 불필요한 표현 미션을 강요하던 이전 문제가 이번 표본에서는 나타나지 않았다.

### 3.2 배포 게이트

| 게이트 | 목표 | 결과 | 판정 |
|---|---:|---:|---|
| 예상 미완료 답변의 조기 완료 | 0건 | 1/125, 0.8% | 실패 |
| 오프토픽 `TASK_RESET` | 100% | 24/25, 96.0% | 실패 |
| 문법 `GRAMMAR_FIX` | 95% 이상 | 24/25, 96.0% | 통과 |
| 내용 미션 스캐폴드 완전성 | 100% | 74/74, 100% | 통과 |

추가 지표는 다음과 같다.

- canonical `targetSlot` 일치: **74/75, 98.7%**
- 충분한 답변 완료: **25/25, 100%**
- 문장 조각 `STRUCTURE_FIX`: **25/25, 100%**
- 근거 있는 문법 교정: **24/25, 96.0%**
- 의도한 내용 미션과 완전한 스캐폴드 동시 충족: **49/50, 98.0%**

### 3.3 응답 시간

| 지표 | 직전 결과 | 이번 결과 | 변화 |
|---|---:|---:|---:|
| 평균 | 9.98초 | 11.44초 | +1.46초 |
| p50 | 9.65초 | 11.06초 | +1.41초 |
| p95 | 13.33초 | 16.57초 | +3.24초 |

정확도는 개선됐지만 평균과 상위 지연시간은 모두 늘었다. 기능 오류는 아니지만 운영 비용과 사용자 대기시간 관점에서 별도 관찰이 필요하다.

## 4. 질문 맥락 상속 효과

직전 테스트에서 실패했던 네 입력을 같은 답변으로 다시 테스트했다.

| 케이스 | 직전 판정 | 이번 판정 | 결과 |
|---|---|---|---|
| 직장·학교 문제 + 막연한 해결책 | `SLOT / PROBLEM` | `SLOT / SOLUTION` | 개선 |
| 직장·학교 문제 + 문법 오류 | `SLOT / PROBLEM` | `GRAMMAR_FIX` | 개선 |
| 올해 만들 읽기 습관 + 문법 오류 | `SLOT / GOAL` | `GRAMMAR_FIX` | 개선 |
| 장보기 후 행동 + 막연한 이유 | `SLOT / ACTION` | `SLOT / REASON` | 개선 |

예를 들어 질문이 이미 `at work or school`이라는 상황을 제공하면 답변의 `too many tasks`만으로도 그 상황에서 겪는 `PROBLEM`을 표현한 것으로 해석했다. 마찬가지로 질문이 `this year`를 제공하면 답변이 이를 반복하지 않아도 읽기 습관이라는 `GOAL`을 인정했다.

중요한 예외도 유지됐다. `Where do you live?`처럼 질문이 장소 자체를 묻는 경우에는 질문이 `PLACE` 값을 제공한 것이 아니므로 답변이 실제 장소를 말해야 한다. 해당 여섯 사례도 모두 기대대로 통과했다.

따라서 이번 규칙은 질문이 이미 제공한 고정 맥락만 상속하고, 질문이 요구하는 핵심 답까지 자동 충족시키지는 않았다.

## 5. 세 질문의 질문-슬롯 정렬 결과

질문 문구에 필수 슬롯을 직접 드러내도록 수정한 세 질문은 총 18건 중 17건이 통과했다.

| 질문 | 계약 | 결과 |
|---|---|---:|
| 저녁 식사 후 활동과 이유 | `ACTION + REASON` | 5/6 |
| 주말 활동과 장소 | `ACTION + PLACE` | 6/6 |
| 우정관의 과거·현재·변화 원인 | `BEFORE_STATE + NOW_STATE + CHANGE_CAUSE` | 6/6 |

저녁 질문의 1건은 문법 판정 오류가 아니라 아래에서 설명하는 증거 문자열 계약 오류로 502가 발생했다. 나머지 17건에서는 누락, 막연함, 문법, 완료가 모두 새 슬롯 계약에 맞게 판정됐다.

특히 다음 오판이 사라졌다.

- `because it is nice`를 충분한 `REASON`으로 인정하지 않고 `REASON` 구체화
- `somewhere`를 충분한 `PLACE`로 인정하지 않고 `PLACE` 구체화
- `because life changed`를 충분한 `CHANGE_CAUSE`로 인정하지 않고 `CHANGE_CAUSE` 구체화

## 6. 남은 실패 3건

### 6.1 문법 답변에서 원문 증거 계약 위반

질문:

```text
What do you usually do after dinner, and why do you do it?
```

답변:

```text
After dinner, I usually washes the dishes because it helps me reset.
```

기대 결과는 `GRAMMAR_FIX`지만 API가 502를 반환했다. 같은 입력을 한 번 더 단독 호출해도 동일하게 재현됐다.

백엔드 검증 오류는 다음과 같다.

```text
SATISFIED or GENERIC requires evidence from the learner answer: ACTION
```

`ACTION` 평가에는 비어 있지 않은 evidence가 있었지만, 그 값이 학습자 원문의 정확한 부분 문자열이 아니었다. 문법을 고치는 과정에서 `washes the dishes`를 `wash the dishes`처럼 수정한 표현을 슬롯 evidence에도 사용했을 가능성이 높다. 슬롯 evidence는 교정문이 아니라 반드시 원래 답변에서 그대로 인용해야 한다.

이는 일시적 통신 장애가 아니라 LLM 출력과 백엔드 계약의 재현 가능한 불일치다. 문법 오류가 포함된 슬롯에서도 evidence는 원문을 인용한다는 직접 반례가 필요하다.

후속 조치로 원문 evidence 반례를 프롬프트에 추가하고, 선언된 문법 교정쌍을 역적용했을 때 원문의 유일한 정확한 부분 문자열이 만들어지는 경우에만 백엔드가 evidence를 복원하도록 구현했다. 개발 백엔드 재빌드 후 동일 입력을 다시 실제 호출한 결과 `GRAMMAR_FIX`로 통과했다. 이 후속 단건 검증은 원래 150건 공식 점수에는 합산하지 않았다.

### 6.2 일반 진술을 오프토픽 대신 슬롯 누락으로 처리

질문:

```text
What do you usually do after work, and why do you enjoy it?
```

답변:

```text
Online shopping is convenient for many people.
```

기대 결과는 `TASK_RESET`이지만 실제 결과는 `SLOT / ACTION`이었다.

LLM은 `Online shopping`을 가능한 활동으로 보았지만, 답변에는 학습자가 퇴근 후 온라인 쇼핑을 한다는 관계가 없다. 현재 프롬프트의 “관련 정보가 있으면 ON_TOPIC”과 “한 가지 요청 정보만 더하면 고칠 수 있으면 ON_TOPIC” 사이에서 모델이 후자를 선택한 것으로 보인다.

엄격한 제품 정책에서는 개인의 퇴근 후 행동을 묻는 질문에 일반적인 장점만 말했으므로 `OFF_TOPIC`이 타당하다. 다만 `After work, I usually ...`라는 관계만 보충하면 재사용할 수 있다는 관점에서는 `SLOT`도 교육적으로 완전히 무의미한 판정은 아니다. 배포 전에 이 경계를 제품 정책으로 명시할 필요가 있다.

### 6.3 `exercise more`를 구체적인 계획으로 인정해 조기 완료

질문:

```text
What is one health goal you want to reach this year, and how will you work toward it?
```

답변:

```text
I want to improve my stamina, so I will exercise more.
```

기대 결과는 `SLOT / PLAN`이지만 실제 결과는 `COMPLETE`였다.

`improve my stamina`는 구체적인 `GOAL`이다. 반면 `exercise more`는 운동 종류, 빈도, 시간, 방법이 없어 현재 정답표에서는 막연한 `PLAN`이다. 전역 프롬프트가 `more`를 GENERIC 예시로 이미 제시하고 있는데도 모델이 이 사례에서는 충분한 계획으로 인정했다.

이 문제는 백엔드가 슬롯 evidence의 의미적 구체성을 다시 판정하지 않고 LLM 진단을 신뢰하기 때문에 그대로 완료로 이어졌다. `PLAN` 전용 반례를 추가하는 것이 가장 직접적인 개선책이다.

```text
"I will exercise more." -> GENERIC PLAN
"I will run for 30 minutes three times a week." -> SATISFIED PLAN
```

## 7. 우선 개선안

1. **문법과 슬롯 evidence의 원문 경계를 강화한다.** 문법 교정 대상이 슬롯 evidence와 겹쳐도 evidence에는 수정 전 원문을 그대로 인용하도록 예시를 추가한다.
2. **개인 답변과 일반 진술의 주제 경계를 명시한다.** 개인 행동·상태를 묻는 질문에서 일반적인 사실만 말하고 학습자와의 관계가 전혀 없으면 `OFF_TOPIC`으로 판정할지 제품 정책을 먼저 확정한다.
3. **`PLAN` 막연함 반례를 직접 추가한다.** `exercise more`, `practice more`, `try harder`, `do it regularly`처럼 방법이 식별되지 않는 계획을 GENERIC으로 명시한다.
4. **세 실패 유형만 먼저 소규모 적대 테스트한다.** 각 유형 10건씩 30건을 통과시킨 뒤 전체 150건을 다시 실행하면 비용을 줄이면서 회귀를 빠르게 확인할 수 있다.

## 8. 최종 판단

질문 맥락 상속은 의도대로 작동했다. 질문이 이미 제공한 상황과 시간 프레임을 답변에서 다시 쓰게 하던 네 오판이 모두 사라졌고, 질문이 실제로 요구하는 값까지 잘못 상속하는 부작용은 이번 표본에서 발견되지 않았다.

질문-슬롯 정렬도 효과가 컸다. 수정된 주말 질문과 우정 변화 질문은 각각 6/6을 통과했고, 저녁 질문도 의미 판정은 모두 정확했다.

현재의 핵심 위험은 구조 자체보다 세 경계 사례다. 원문 evidence 계약 오류는 안정성 문제라 우선 수정해야 하고, `exercise more` 조기 완료는 명확한 품질 문제다. 일반 진술을 `TASK_RESET`과 `SLOT` 중 어디로 보낼지는 제품 정책 결정이 선행돼야 한다.

원시 결과:

- `.codex_logs/feedback-question-context-inheritance-150-2026-07-23/latest.json`
- `.codex_logs/feedback-question-context-inheritance-150-2026-07-23/comparison-vs-active-review.json`
- `.codex_logs/feedback-question-context-inheritance-150-2026-07-23/retry-case-005/latest.json`
