# WriteLoop 계약 재호출·medium 추론 적용 후 150건 LLM 회귀 테스트 보고서

## 1. 결론

2026년 7월 24일, 계약 오류 사유를 전달하는 1회 재호출과 실행 이력 저장 기능을 개발 백엔드에 반영한 상태에서 기존과 동일한 150건을 OpenAI `gpt-5.6-luna`에 실제로 요청했다. 추론 수준은 현재 운영 후보 설정인 `medium`을 사용했다.

공식 자동 채점 결과는 **147/150, 98.0%**다. 직전 동일 정답표 실행의 **146/150, 97.3%**보다 1건, 0.7%p 높다.

다만 실패 3건은 서로 성격이 다르다.

- 94번은 `exercise more`를 구체적인 `PLAN`으로 인정해 조기 완료했지만, 동일 입력 진단 재실행에서는 정상 `SLOT/PLAN`으로 통과했다.
- 119번은 `GRAMMAR_FIX` 정답표와 달리 `SLOT/OPINION`을 두 번 연속 선택했다. 현재 질문 계약과 미션 우선순위에 따르면 모델보다 정답표를 수정하는 편이 타당하다.
- 130번은 모델 출력 계약 오류가 아니라 OpenAI 응답 제한시간 120초를 넘긴 공급자 타임아웃이다. 동일 입력 재실행에서는 정상 `SLOT/CHANGE_CAUSE`로 통과했다.

따라서 공식 점수는 147/150으로 유지해야 하지만, 반복 가능한 실질적 불일치는 119번 1건이다. 이 1건도 현재 제품 정책을 기준으로 보면 모델 결함보다는 정답표 충돌에 가깝다.

이번 실행에서는 **LLM 계약 오류 0건, 계약 재호출 0건**이었다. 새 재호출 기능이 실패한 것이 아니라, 재호출 조건에 해당하는 잘못된 구조화 출력이 발생하지 않은 것이다.

## 2. 테스트 조건

| 항목 | 값 |
|---|---|
| 실행일 | 2026-07-24 |
| 실행 시각 | 20:41:23~20:57:32 KST |
| 총 실행 시간 | 약 16분 9초 |
| 테스트 수 | 150건 |
| 테스트 파일 | `scripts/feedback-quality/cases.completion-gate-150-v3.json` |
| 공급자 | OpenAI |
| 모델 | `gpt-5.6-luna` |
| 추론 수준 | `medium` |
| 동시 실행 수 | 2 |
| 러너 건별 제한 시간 | 180초 |
| 백엔드 OpenAI 제한 시간 | 120초 |
| 실행 변형 | `contract-retry-credited-2026-07-24` |
| API | 개발 백엔드 `http://localhost` |

테스트 중 개발 서버의 일반 사용자용 피드백 요청 제한만 임시로 해제했다. 테스트 종료 후 요청 제한은 기본값인 활성 상태로 복구했다.

150건은 다음 여섯 유형을 각각 25건씩 포함한다.

| 유형 | 검사 목적 |
|---|---|
| `OFF_TOPIC` | 질문과 무관한 답변을 `TASK_RESET`으로 보내는지 검사 |
| `FRAGMENT` | 문장 조각을 `STRUCTURE_FIX`로 보내는지 검사 |
| `MISSING_SLOT` | 누락된 필수 슬롯을 정확히 선택하는지 검사 |
| `GENERIC_CONTENT` | 형식만 존재하는 막연한 슬롯을 구체화하도록 하는지 검사 |
| `GRAMMAR` | 실제 문법 오류를 근거 있는 `GRAMMAR_FIX`로 보내는지 검사 |
| `COMPLETE` | 충분한 답변을 불필요한 미션 없이 완료하는지 검사 |

## 3. 전체 결과

### 3.1 유형별 통과 결과

| 유형 | 통과 | 통과율 |
|---|---:|---:|
| `OFF_TOPIC` | 25/25 | 100% |
| `FRAGMENT` | 25/25 | 100% |
| `MISSING_SLOT` | 25/25 | 100% |
| `GENERIC_CONTENT` | 23/25 | 92% |
| `GRAMMAR` | 24/25 | 96% |
| `COMPLETE` | 25/25 | 100% |
| **전체** | **147/150** | **98.0%** |

`OFF_TOPIC`, `FRAGMENT`, `MISSING_SLOT`, `COMPLETE`가 모두 통과했다. 특히 문장 조각 25건과 충분한 답변 25건이 전부 통과해 구조 판정과 불필요한 추가 미션 억제는 안정적이었다.

`GENERIC_CONTENT`의 실패 2건 중 하나는 조기 완료였고, 다른 하나는 공급자 타임아웃이었다. 따라서 실제로 모델 응답을 받은 막연한 내용 사례의 판정 실패는 1건이다.

### 3.2 주요 품질 지표

| 지표 | 결과 |
|---|---:|
| 엄격 자동 채점 | 147/150, 98.0% |
| 모델 응답 성공 | 149/150, 99.3% |
| 성공 응답 중 자동 채점 통과 | 147/149, 98.7% |
| 오프토픽 `TASK_RESET` | 25/25, 100% |
| 문장 조각 `STRUCTURE_FIX` | 25/25, 100% |
| 문법 `GRAMMAR_FIX` | 24/25, 96% |
| 충분한 답변 완료 | 25/25, 100% |
| 실제 내용 미션 스캐폴드 완전성 | 74/74, 100% |
| 기대 슬롯이 있는 성공 응답의 슬롯 일치 | 73/74, 98.6% |
| 미완료 답변 조기 완료 | 1/125, 0.8% |

### 3.3 배포 게이트

| 게이트 | 목표 | 결과 | 판정 |
|---|---:|---:|---|
| 미완료 답변 조기 완료 | 0건 | 1건 | 실패 |
| 오프토픽 `TASK_RESET` | 100% | 25/25, 100% | 통과 |
| 문법 `GRAMMAR_FIX` | 95% 이상 | 24/25, 96% | 통과 |
| 내용 미션 스캐폴드 완전성 | 100% | 74/74, 100% | 통과 |

엄격 배포 게이트에서는 94번 조기 완료 때문에 아직 실패다. 다만 해당 입력은 진단 재실행에서 정상 통과했으므로, 단일 실행 점수만으로 고정적인 정책 결함이라고 단정하기보다 반복 안정성 문제로 보는 것이 정확하다.

## 4. 응답 시간

| 지표 | 직전 `low` 실행 | 이번 `medium` 실행 | 변화 |
|---|---:|---:|---:|
| 평균 | 10.66초 | 12.92초 | +2.26초, +21.2% |
| p50 | 10.53초 | 11.82초 | +1.29초, +12.2% |
| p95 | 14.93초 | 17.10초 | +2.17초, +14.6% |

`medium` 실행은 직전 `low` 실행보다 느렸다. 정확도는 0.7%p 높아졌지만, 실행 사이에 백엔드 계약 처리 변경도 있었고 LLM 출력 자체가 비결정적이므로 정확도 상승을 추론 수준 하나의 효과로 단정할 수는 없다.

이번 표본에서 확인할 수 있는 것은 다음 정도다.

- `medium`에서도 전체 품질은 98% 수준으로 유지됐다.
- 구조, 오프토픽, 필수 슬롯, 완료 판정의 주요 축은 안정적이었다.
- 평균 지연 시간은 약 2.3초 증가했다.
- 품질 상승 폭은 한 건에 불과해 지연 증가를 정당화하는지는 추가 반복 측정이 필요하다.

## 5. 직전 150건과 비교

직전 비교 대상은 `docs/writeloop-feedback-grammar-evidence-restoration-150-report-2026-07-23.ko.md`의 146/150 결과다. 두 실행은 같은 `cases.completion-gate-150-v3.json`을 사용했다.

| 비교 결과 | 건수 |
|---|---:|
| 실패에서 통과로 개선 | 2 |
| 통과에서 실패로 변경 | 1 |
| 통과·실패 상태 동일 | 147 |

상태가 바뀐 세 사례는 다음과 같다.

| 케이스 | 직전 | 이번 | 해석 |
|---|---|---|---|
| 65번, 장보기 후 루틴 문법 | 요청 실패 | `GRAMMAR_FIX` 통과 | 문법 근거 인용 경로가 정상 작동 |
| 128번, 성공관 변화 문장 조각 | `SLOT/BEFORE_STATE` | `STRUCTURE_FIX` 통과 | 이번 실행에서는 구조 판정 정상 |
| 130번, 성공관 변화의 막연한 이유 | `SLOT/CHANGE_CAUSE` 통과 | 120초 타임아웃 | 진단 재실행 통과, 일시적 공급자 실패 |

94번 조기 완료와 119번 `SLOT/OPINION`은 직전 실행에서도 실패였고 이번에도 공식 실행에서 실패했다.

## 6. 실패 사례 상세 분석

### 6.1 94번: 막연한 계획을 완료로 인정

질문:

> What is one health goal you want to reach this year, and how will you work toward it?

답변:

> I want to improve my stamina, so I will exercise more.

기대 결과는 `SLOT/PLAN`이다. `exercise more`에는 행동 방향은 있지만 어떤 운동을 얼마나 자주, 어떤 방식으로 할지 식별할 수 있는 실행 계획이 없다.

공식 실행에서 모델은 다음과 같이 판단했다.

- `missionKind=COMPLETE`
- `loopComplete=true`
- 요약: 지구력 향상이라는 목표와 운동이라는 실천 방법을 명확히 연결했다고 평가

문제는 `exercise more`의 **존재**와 **구체성**을 구분하지 못했다는 점이다. `PLAN` 슬롯에 문구가 들어 있다는 이유로 충분하다고 본 것이다.

그러나 동일 입력 진단 재실행에서는 정상적으로 다음 결과가 나왔다.

- `missionKind=SLOT`
- `targetSlot=PLAN`
- 자동 채점 통과

따라서 중앙 정의가 완전히 잘못됐다기보다 경계 표현에서 판정이 흔들리는 비결정적 문제다. `exercise more`, `practice more`, `try harder`를 여러 번 반복 측정해 안정성을 확인하는 것이 우선이다.

### 6.2 119번: 문법 정답표와 필수 슬롯 우선순위 충돌

질문:

> Do you think open-plan offices are more helpful or harmful overall? Explain both sides and give your opinion.

답변:

> Open-plan offices makes teamwork easier, but noise hurt concentration, so I thinks quiet rooms are necessary.

정답표는 `GRAMMAR_FIX`를 기대한다. 실제로 다음 문법 오류가 있다.

- `offices makes` -> `offices make`
- `noise hurt` -> `noise hurts`
- `I thinks` -> `I think`

하지만 질문은 개방형 사무실이 **전체적으로 더 도움이 되는지 해로운지** 직접 판단하도록 요구한다. 답변은 장점과 단점을 말하고 조용한 방이 필요하다는 조건을 제시했지만, 전체적인 우열은 직접 밝히지 않았다.

백엔드의 현재 우선순위는 다음과 같다.

> 필수 슬롯 누락 -> LOCAL 문법 오류

따라서 백엔드가 `SLOT/OPINION`을 선택한 것은 현재 설계와 일치한다. 모델은 `correctedAnswer`에서 문법 교정도 정상 제공했지만, 사용자에게 먼저 보여 줄 한 가지 미션으로는 `OPINION` 보강을 선택했다.

동일 입력 진단 재실행에서도 다시 `SLOT/OPINION`이 나왔다. 두 실행 모두 다음 요소를 완전하게 제공했다.

- `targetSlot=OPINION`
- 영어·한국어 골격
- 표현 선택지 2개
- 전체적인 의견을 직접 말하도록 하는 지침

이 사례는 모델 판정을 바꾸기보다 정답표를 `SLOT/OPINION`으로 수정하는 편이 타당하다. 정답표의 비교문 요구도 함께 제거하면 같은 공식 결과는 148/150, 98.7%로 재계산된다.

### 6.3 130번: 공급자 타임아웃

질문:

> Describe how your idea of success has changed over time and explain why.

답변:

> I used to value money, but now I value balance because life changed.

기대 결과는 막연한 `life changed`를 구체화하는 `SLOT/CHANGE_CAUSE`다.

공식 실행에서는 OpenAI 응답이 백엔드 제한 시간인 120초 안에 끝나지 않아 `502 FEEDBACK_GENERATION_UNAVAILABLE`이 반환됐다. 이 요청은 모델 응답을 받지 못했으므로 슬롯 판정 품질 실패가 아니다.

동일 입력 진단 재실행에서는 약 13.6초 만에 다음 결과로 통과했다.

- `missionKind=SLOT`
- `targetSlot=CHANGE_CAUSE`
- 자동 채점 통과

따라서 이 사례는 일시적 공급자 지연이다. 계약 오류 재호출과 공급자 타임아웃 재호출은 서로 다른 정책으로 관리해야 한다.

## 7. 계약 재호출 관측 결과

공식 실행 시간 범위의 `feedback_contract_execution_logs`를 조회한 결과는 다음과 같다.

| 항목 | 결과 |
|---|---:|
| 전체 실행 기록 | 150 |
| 최초 요청 성공 | 149 |
| 계약 위반 감지 | 0 |
| 계약 재호출 | 0 |
| 재호출 복구 | 0 |
| 최종 실패 | 1 |
| 최종 실패 원인 | `request timed out` |

이번 실행에서 계약 재호출이 0건인 이유는 150건의 모델 출력 중 계약 검증을 위반한 응답이 없었기 때문이다. 130번은 계약 검증 전에 모델 응답 자체가 끝나지 않았으므로 계약 재호출 대상이 아니다.

이번 결과로 확인된 내용은 다음과 같다.

- 정상 응답을 계약 오류로 잘못 판단해 불필요하게 재호출하지 않았다.
- 공급자 타임아웃을 계약 오류 실패율에 섞지 않았다.
- 계약 오류가 자연 발생하지 않아 실제 LLM 재호출 복구율은 아직 측정 표본이 없다.

계약 재호출의 실효성을 측정하려면 계약 경계 입력을 동일 조건으로 여러 번 실행하거나, 자연 발생 계약 오류를 운영 로그에서 누적 관찰해야 한다.

## 8. 진단 재실행

공식 실패 세 건을 같은 모델과 `medium` 설정으로 한 번씩 다시 실행했다. 진단 결과는 공식 점수에 합산하지 않았다.

| 케이스 | 공식 실행 | 진단 재실행 | 반복성 판단 |
|---|---|---|---|
| 94번 | `COMPLETE`, 실패 | `SLOT/PLAN`, 통과 | 비결정적 슬롯 구체성 판정 |
| 119번 | `SLOT/OPINION`, 실패 | `SLOT/OPINION`, 실패 | 반복 가능한 정답표 충돌 |
| 130번 | 120초 타임아웃 | `SLOT/CHANGE_CAUSE`, 통과 | 일시적 공급자 실패 |

진단 재실행 기준으로 모델이 반복해서 잘못된 결과를 만든 사례는 없다. 119번은 자동 정답표와 제품 정책이 충돌해 실패로 집계된 사례다.

## 9. 권장 조치

### 9.1 정답표 119번 수정

119번의 기대 미션을 `GRAMMAR_FIX`에서 `SLOT/OPINION`으로 바꾸는 것이 현재 우선순위와 질문 계약에 맞다. 문법 교정은 `correctedAnswer`에 보존되므로 학습 정보가 사라지지 않는다.

### 9.2 `PLAN` 경계 입력 반복 측정

94번 한 번의 조기 완료만 보고 중앙 정의를 다시 크게 늘리는 것은 이르다. 다음 표현을 각각 여러 번 실행해 반복 실패율을 먼저 측정하는 편이 안전하다.

- `exercise more`
- `practice more`
- `try harder`
- `study regularly`
- `work on it`

반복 실행에서도 조기 완료가 일정 비율 이상 발생하면 `PLAN`의 구체성 정의와 반례를 추가로 강화한다.

### 9.3 공급자 타임아웃 정책 분리

계약 오류 1회 재호출은 현재 설계대로 유지한다. 공급자 타임아웃은 별도 정책으로 검토해야 한다.

타임아웃 재호출은 일시적 실패를 줄일 수 있지만 응답 시간과 비용을 늘린다. 적용한다면 다음처럼 제한하는 편이 안전하다.

- 네트워크 오류 또는 타임아웃에만 1회 적용
- 짧은 지수 백오프 적용
- 최초 요청과 재호출의 비용·지연을 별도 기록
- 계약 오류 재호출 통계와 분리

### 9.4 `medium` 유지 여부는 반복 비교 후 결정

이번 한 번의 실행에서는 `medium`이 0.7%p 높은 점수를 냈지만 평균 지연은 21.2% 증가했다. 동일 코드와 동일 입력을 `low`와 `medium`으로 여러 번 교차 실행해야 품질 향상이 지연 증가를 정당화하는지 판단할 수 있다.

## 10. 최종 판단

현재 피드백 시스템은 150건 공식 기준 **98.0%**를 기록했고, 핵심 축 네 가지가 모두 100%였다.

- 오프토픽 판정
- 문장 조각 판정
- 누락 필수 슬롯 판정
- 충분한 답변 완료

남은 공식 실패 중 반복 가능한 모델 판정 오류는 확인되지 않았다. 가장 명확한 후속 조치는 119번 정답표를 현재 제품 우선순위와 맞추는 것이다.

다만 94번 조기 완료가 공식 배포 게이트를 위반했으므로, `PLAN` 경계 입력의 반복 안정성을 확인하기 전까지 “조기 완료 0건” 기준을 통과했다고 볼 수는 없다.

## 11. 결과 파일

- 공식 원본: `.codex_logs/feedback-contract-retry-150-credited-2026-07-24/latest.json`
- 실패 3건 진단 재실행: `.codex_logs/feedback-contract-retry-150-credited-2026-07-24/diagnostic-failures/latest.json`
- 진단 입력: `.codex_logs/feedback-contract-retry-150-credited-2026-07-24/diagnostic-failures/cases.json`
- 테스트 세트: `scripts/feedback-quality/cases.completion-gate-150-v3.json`
- 직전 비교 보고서: `docs/writeloop-feedback-grammar-evidence-restoration-150-report-2026-07-23.ko.md`

재현 명령은 다음과 같다.

```powershell
$env:WRITELOOP_FEEDBACK_PROVIDER='openai'
$env:WRITELOOP_FEEDBACK_MODEL='gpt-5.6-luna'
$env:WRITELOOP_FEEDBACK_REASONING_EFFORT='medium'
$env:WRITELOOP_FEEDBACK_VARIANT='contract-retry-credited-2026-07-24'

node scripts/run-feedback-quality-check.mjs `
  --cases scripts/feedback-quality/cases.completion-gate-150-v3.json `
  --base-url http://localhost `
  --concurrency 2 `
  --timeout-ms 180000 `
  --report-dir .codex_logs/feedback-contract-retry-150-credited-2026-07-24 `
  --include-pass-payloads
```

개발 서버의 일반 요청 제한이 활성화된 상태에서는 대량 테스트가 차단될 수 있다. 테스트 동안에만 요청 제한을 해제하고, 실행 후 반드시 다시 활성화해야 한다.
