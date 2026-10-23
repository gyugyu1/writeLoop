# WriteLoop 문법 교정 중 슬롯 증거 복원 적용 후 150건 LLM 회귀 테스트 보고서

## 1. 결론

문법 교정과 겹친 슬롯 `evidence`를 원문 기준으로 복원하는 변경을 개발 백엔드에 반영한 뒤, 기존과 같은 150건을 OpenAI `gpt-5.6-luna`에 실제로 요청했다.

공식 자동 채점 결과는 **146/150, 97.3%**다. 직전 질문 맥락 상속 테스트의 **147/150, 98.0%**보다 1건, 0.7%p 낮다.

다만 결과를 개별 검토하면 다음과 같이 해석해야 한다.

- 이번 변경의 직접 대상이었던 5번 문법 케이스는 이전 `502`에서 정상 `GRAMMAR_FIX`로 개선됐다.
- 65번의 새 `502`는 슬롯 `evidence`가 아니라 `grammarIssues.originalText` 인용 오류였다. 동일 입력 재실행에서는 정상 통과했다.
- 119번 `SLOT/OPINION`은 자동 정답표에는 실패지만, 현재 질문 계약과 우선순위에는 오히려 부합한다.
- 128번 문장 조각 오판은 동일 입력 재실행에서 정상 `STRUCTURE_FIX`로 돌아왔다.
- 94번 `exercise more` 조기 완료만 동일 입력 재실행에서도 반복됐다.

따라서 이번 변경을 되돌릴 근거는 없다. 목표 결함은 실제로 해결됐고, 새 실패 중 두 건은 비결정적 출력 흔들림이며 한 건은 정답표 충돌이다. 그러나 공식 배포 게이트는 조기 완료와 문법 정확도 기준을 통과하지 못했으므로 현재 결과만으로 배포 적합 판정을 내릴 수는 없다.

## 2. 테스트 조건

| 항목 | 값 |
|---|---|
| 실행일 | 2026-07-23 |
| 테스트 수 | 150건 |
| 테스트 파일 | `scripts/feedback-quality/cases.completion-gate-150-v3.json` |
| 공급자 | OpenAI |
| 모델 | `gpt-5.6-luna` |
| 추론 수준 | `low` |
| 동시 실행 수 | 2 |
| 건별 제한 시간 | 120초 |
| 실행 변형 | `grammar-evidence-restoration-2026-07-23` |
| API | 개발 백엔드 `http://localhost` |

테스트는 다음 여섯 유형을 각각 25건씩 포함한다.

| 유형 | 검사 목적 |
|---|---|
| `OFF_TOPIC` | 무관한 답변을 `TASK_RESET`으로 보내는지 검사 |
| `FRAGMENT` | 문장 조각을 `STRUCTURE_FIX`로 보내는지 검사 |
| `MISSING_SLOT` | 빠진 필수 슬롯을 정확히 선택하는지 검사 |
| `GENERIC_CONTENT` | 막연하게 채운 슬롯을 구체화하도록 하는지 검사 |
| `GRAMMAR` | 실제 문법 오류를 근거 있는 `GRAMMAR_FIX`로 보내는지 검사 |
| `COMPLETE` | 충분한 답변을 추가 미션 없이 완료하는지 검사 |

## 3. 전체 결과

### 3.1 유형별 통과 결과

| 유형 | 통과 | 통과율 |
|---|---:|---:|
| `OFF_TOPIC` | 25/25 | 100% |
| `FRAGMENT` | 24/25 | 96% |
| `MISSING_SLOT` | 25/25 | 100% |
| `GENERIC_CONTENT` | 24/25 | 96% |
| `GRAMMAR` | 23/25 | 92% |
| `COMPLETE` | 25/25 | 100% |
| **전체** | **146/150** | **97.3%** |

긍정적인 부분은 `OFF_TOPIC`, `MISSING_SLOT`, `COMPLETE`가 모두 통과했다는 점이다. 특히 충분한 답변 25건을 모두 완료해 불필요한 표현 미션을 강요하던 과거 회귀는 발생하지 않았다.

### 3.2 배포 게이트

| 게이트 | 목표 | 결과 | 판정 |
|---|---:|---:|---|
| 미완료 답변 조기 완료 | 0건 | 1/125 | 실패 |
| 오프토픽 `TASK_RESET` | 100% | 25/25, 100% | 통과 |
| 문법 `GRAMMAR_FIX` | 95% 이상 | 23/25, 92% | 실패 |
| 내용 미션 스캐폴드 완전성 | 100% | 76/76, 100% | 통과 |

추가 지표는 다음과 같다.

| 지표 | 결과 |
|---|---:|
| canonical `targetSlot` 일치 | 74/75, 98.7% |
| 충분한 답변 완료 | 25/25, 100% |
| 문장 조각 `STRUCTURE_FIX` | 24/25, 96% |
| 근거 있는 문법 교정 | 23/25, 92% |
| 의도한 내용 미션과 완전한 스캐폴드 동시 충족 | 49/50, 98% |

### 3.3 응답 시간

| 지표 | 직전 150건 | 이번 150건 | 변화 |
|---|---:|---:|---:|
| 평균 | 11.45초 | 10.67초 | -0.78초 |
| p50 | 11.17초 | 10.53초 | -0.64초 |
| p95 | 16.57초 | 14.93초 | -1.64초 |

이번 실행에서는 정확도가 0.7%p 낮아졌지만 응답 시간은 전반적으로 짧아졌다. 다만 LLM 실행 시간은 외부 상태에 따라 달라질 수 있으므로 이번 변경의 직접 효과로 단정할 수는 없다.

## 4. 직전 150건과의 직접 비교

같은 150개 정답표를 기준으로 항목별 결과를 비교했다.

| 비교 결과 | 건수 |
|---|---:|
| 개선 | 2 |
| 동일 | 145 |
| 회귀 | 3 |

개선된 항목은 다음과 같다.

| 케이스 | 직전 | 이번 | 해석 |
|---|---|---|---|
| 5번, 저녁 식사 후 루틴 문법 | `502` | `GRAMMAR_FIX` | 이번 증거 복원 변경의 직접 목표가 해결됨 |
| 19번, 퇴근 후 루틴 오프토픽 | `SLOT/ACTION` | `TASK_RESET` | 주제 판정 개선이지만 이번 변경과 직접 인과는 불명확 |

회귀로 집계된 항목은 다음과 같다.

| 케이스 | 직전 | 이번 | 해석 |
|---|---|---|---|
| 65번, 장보기 후 루틴 문법 | `GRAMMAR_FIX` | `502` | 문법 근거 인용 오류, 재실행 통과 |
| 119번, 개방형 사무실 문법 | `GRAMMAR_FIX` | `SLOT/OPINION` | 현재 계약상 `OPINION` 누락이므로 정답표 충돌 가능성 큼 |
| 128번, 성공관 변화 문장 조각 | `STRUCTURE_FIX` | `SLOT/BEFORE_STATE` | 구조 판정 흔들림, 재실행 통과 |

94번 건강 계획 조기 완료는 직전과 이번 실행에서 모두 실패해 변화가 없었다.

## 5. 이번 변경의 목표 달성 여부

직전 실행의 5번은 다음 답변에서 슬롯 `ACTION`의 증거를 교정된 문장 기준으로 만들면서 계약 오류가 발생했다.

```text
After dinner, I usually washes the dishes because it helps me reset.
```

이번 실행에서는 같은 입력이 정상적으로 `GRAMMAR_FIX`를 반환했다. 이는 프롬프트 반례와 제한적 백엔드 복원을 합친 방어 경로가 전체 LLM 테스트에서 기존 실패를 재발시키지 않았음을 보여 준다.

다만 최종 API 응답에는 복원 실행 여부가 노출되지 않으므로, 이 한 건만으로 LLM이 잘못된 증거를 냈고 백엔드 복원이 실제 발동했다고 단정할 수는 없다. 복원 로직 자체는 별도 백엔드 단위 테스트에서 성공, 후보 불일치, 중복 후보, `GENERIC` support 보존 조건을 검증했다.

복원은 다음 조건을 모두 만족할 때만 수행된다.

- LLM이 선언한 `revisedText -> originalText` 문법 교정쌍만 역으로 적용한다.
- 복원 결과가 학습자 원문에 정확히 존재해야 한다.
- 가능한 복원 후보가 하나뿐이어야 한다.
- 원문에서 해당 후보가 한 번만 나타나야 한다.
- 퍼지 매칭이나 임의 추측은 하지 않는다.

따라서 잘못된 증거를 넓게 허용한 것이 아니라, 문법 교정 때문에 생긴 명확한 변형만 원문으로 복원한 것이다.

## 6. 실패 4건 상세 분석

### 6.1 65번: 문법 교정 근거의 원문 인용 실패

답변:

```text
After grocery shopping, I goes home and put the cold food away because it need refrigeration.
```

기대 결과는 `GRAMMAR_FIX`였지만 API가 `502 FEEDBACK_GENERATION_UNAVAILABLE`을 반환했다. 백엔드 로그의 직접 원인은 다음과 같다.

```text
Every grammar issue must quote an exact learner-answer span
```

이번에 추가한 복원은 `slotAssessments.evidence`에만 적용된다. 65번은 LLM이 `grammarIssues.originalText`에 학습자 원문과 정확히 일치하지 않는 표현을 넣었기 때문에 다른 검증 단계에서 거부됐다.

동일 입력을 한 번 더 실행했을 때는 8.28초 만에 정상 `GRAMMAR_FIX`가 나왔다.

```text
goes -> go
need -> needs
```

결론적으로 재현되는 조립 로직 결함은 아니지만, 단 한 번의 잘못된 LLM 인용도 사용자에게 `502`로 보이는 운영 안정성 문제는 남아 있다.

### 6.2 94번: `exercise more`를 구체적인 계획으로 인정해 조기 완료

질문:

```text
What is one health goal you want to reach this year, and how will you work toward it?
```

답변:

```text
I want to improve my stamina, so I will exercise more.
```

`improve my stamina`는 `GOAL`을 충족한다. 그러나 `exercise more`는 운동 종류, 빈도, 일정, 방법이 없어 제품 정답표에서는 막연한 `PLAN`이다. 기대 결과는 `SLOT/PLAN`이지만 LLM은 `COMPLETE`로 판정했다.

이 실패는 진단 재실행에서도 똑같이 반복됐다. 공통 프롬프트에 `more`를 막연한 표현으로 이미 명시했지만, LLM이 `exercise`라는 행동 명사를 보고 전체 표현을 충분한 미래 행동으로 인정한 것으로 보인다.

이는 이번 증거 복원 변경과 무관한 기존 잔여 결함이다. 다음과 같은 `PLAN` 전용 대비가 필요하다.

```text
I will exercise more. -> GENERIC PLAN
I will run for 30 minutes three times a week. -> SATISFIED PLAN
```

질문별 계약의 `satisfiedWhen`도 단순 행동 이름이 아니라 실행 방법, 일정, 빈도 중 적어도 하나를 식별할 수 있어야 한다고 더 명확히 할 수 있다.

### 6.3 119번: 자동 정답표와 현재 필수 슬롯 우선순위의 충돌

질문:

```text
Do you think open-plan offices are more helpful or harmful overall?
Explain both sides and give your opinion.
```

답변:

```text
Open-plan offices makes teamwork easier, but noise hurt concentration,
so I thinks quiet rooms are necessary.
```

답변에는 실제 문법 오류가 있다. 그러나 질문별 계약은 `ADVANTAGE`, `DISADVANTAGE`, `OPINION`을 모두 필수로 요구한다.

- `teamwork easier`는 `ADVANTAGE`를 충족한다.
- `noise hurt concentration`은 `DISADVANTAGE`를 충족한다.
- `quiet rooms are necessary`는 조건을 말하지만, 개방형 사무실이 전체적으로 더 도움이 되는지 더 해로운지를 선택하지 않는다.

현재 우선순위는 `필수 슬롯 -> LOCAL 문법`이다. 따라서 LLM이 `OPINION`을 누락으로 보고 백엔드가 `SLOT/OPINION`을 선택한 것은 현재 제품 정책에 맞다. 진단 재실행에서도 같은 결과가 나왔다.

이 케이스는 프롬프트 실패보다 정답표 충돌로 보는 편이 객관적이다. 정답표를 `SLOT/OPINION`으로 바꾸면 공식 점수는 **147/150, 98.0%**가 된다. 반대로 문법을 먼저 고치려면 전역 우선순위를 다시 바꿔야 하지만, 현재 합의한 정책과 충돌한다.

### 6.4 128번: 명백한 명사구를 완전한 문장으로 오판

답변:

```text
A different meaning of success now.
```

이 표현은 주어와 서술어가 없는 명사구이므로 `STRUCTURE_FIX`가 맞다. 그러나 해당 실행에서 LLM은 구조를 완전하다고 보고, 그 다음 단계에서 `BEFORE_STATE` 누락을 선택했다.

동일 입력 재실행에서는 정상적으로 `STRUCTURE_FIX`를 반환했다. 따라서 구조 정의가 전혀 없는 문제라기보다 경계 입력에서 판정이 흔들리는 비결정적 오류다. 이 문장을 명시적 반례로 추가하거나, 소수 핵심 경계 케이스를 여러 번 반복해 안정성을 측정하는 것이 적절하다.

## 7. 진단 재실행 결과

공식 150건 점수에는 포함하지 않고 실패 원인 확인용으로만 재실행했다.

| 케이스 | 공식 실행 | 진단 재실행 | 반복성 판단 |
|---|---|---|---|
| 65번 문법 근거 인용 | `502` | `GRAMMAR_FIX` 통과 | 비결정적 계약 오류 |
| 94번 막연한 계획 | `COMPLETE` | `COMPLETE` | 반복 가능한 판정 결함 |
| 119번 필수 의견 | `SLOT/OPINION` | `SLOT/OPINION` | 현재 계약과 일관, 정답표 충돌 |
| 128번 문장 조각 | `SLOT/BEFORE_STATE` | `STRUCTURE_FIX` 통과 | 비결정적 구조 오판 |

재실행 통과를 공식 점수에 합산하지 않았다. 공식 결과는 계속 **146/150**이다.

## 8. 권장 조치

1. **94번 `PLAN` 판정을 먼저 수정한다.** `exercise more`, `practice more`, `try harder`처럼 행동 범주만 있고 실행 방법이 없는 표현을 `GENERIC`으로 명시하는 `PLAN` 전용 반례를 추가한다.
2. **119번 정답표를 `SLOT/OPINION`으로 수정한다.** 현재 질문 계약과 `필수 슬롯 -> LOCAL 문법` 우선순위에 맞추는 것이 일관적이다.
3. **65번과 같은 계약 오류의 운영 처리를 별도로 검토한다.** 정확한 원문 인용 계약은 유지하되, 계약 오류 시 동일 요청을 한 번만 재시도하면 비결정적 `502` 노출을 줄일 수 있다.
4. **128번을 구조 판정 반례에 추가한다.** `A different meaning of success now.` 같은 명사구는 내용 슬롯보다 먼저 `FRAGMENT`로 판정하도록 예시를 보강한다.
5. **수정 후 경계 케이스를 반복 실행한다.** 5, 65, 94, 119, 128번을 각각 여러 번 검증한 뒤 전체 150건을 다시 실행해야 우연한 통과와 안정적인 개선을 구분할 수 있다.

## 9. 최종 판단

이번 변경은 목표로 삼은 “문법 교정 때문에 슬롯 증거가 원문에서 벗어나 `502`가 되는 문제”를 해결했다. 제한적 복원 조건도 보수적이어서 잘못된 슬롯을 임의로 인정할 위험은 낮다.

전체 자동 점수가 1건 낮아졌지만, 이를 변경 자체의 회귀로 보기는 어렵다. 새 회귀 세 건 중 하나는 재실행에서 사라진 문법 인용 오류, 하나는 현재 정책에 맞는 `SLOT/OPINION`, 하나는 재실행에서 사라진 구조 오판이었다.

현재 가장 분명하고 반복 가능한 품질 문제는 `exercise more`를 구체적인 `PLAN`으로 인정하는 조기 완료다. 이 문제를 고치고 119번 정답표를 정책과 맞춘 뒤 다시 평가하는 것이 다음 순서로 적절하다.

## 10. 결과 파일

- 공식 원본: `.codex_logs/feedback-grammar-evidence-restoration-150-2026-07-23/latest.json`
- 분석 요약: `.codex_logs/feedback-grammar-evidence-restoration-150-2026-07-23/summary.json`
- 직전 결과 비교: `.codex_logs/feedback-grammar-evidence-restoration-150-2026-07-23/comparison-vs-context-inheritance.json`
- 65번 진단 재실행: `.codex_logs/feedback-grammar-evidence-restoration-150-2026-07-23/diagnostic-case-065/latest.json`
- 94·119·128번 진단 재실행: `.codex_logs/feedback-grammar-evidence-restoration-150-2026-07-23/diagnostic-semantic-cases/latest.json`
