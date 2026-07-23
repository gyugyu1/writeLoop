# 완료 판정 150건 v2 정답표 검토 기록

## 목적

기존 정답표는 `GENERIC_CONTENT` 답변에 대해 `DETAIL`, `FEELING`, `EXAMPLE`처럼 새로운 깊이 슬롯을 추가하는 행동을 넓게 정답으로 인정했다. 현재 피드백 계약은 슬롯을 `SATISFIED`, `GENERIC`, `MISSING`으로 구분하고, 이미 언급됐지만 막연한 슬롯은 다른 슬롯을 열기 전에 **같은 슬롯을 구체화**하도록 한다.

이 문서는 그 정책 변화가 실제로 학습적으로 타당한 사례만 선별해 만든 v2 정답표의 변경 근거를 기록한다.

## 파일과 원칙

- 기존 정답표: `scripts/feedback-quality/cases.completion-gate-150.json`
- v2 정답표: `scripts/feedback-quality/cases.completion-gate-150-v2.json`
- 생성 스크립트: `scripts/feedback-quality/generate-completion-gate-150-v2-oracle.mjs`
- 기존 150건은 수정하지 않고 보존했다.
- 총 150건 중 `GENERIC_CONTENT` 22건만 변경했다.
- 모델이 실제로 반환한 값이 아니라 질문 메타데이터, 필수 슬롯, 답변의 구체성을 기준으로 사람이 다시 판정했다.
- 변경된 각 테스트에는 `oracleRevision`과 `oracleRationale`을 넣어 사유를 정답표 안에서도 확인할 수 있게 했다.

## 변경하지 않은 GENERIC_CONTENT 3건

| 사례 | 답변 | 유지 이유 |
|---|---|---|
| `completion-gate-004` | `I usually relax after dinner.` | `ACTION=relax`은 하나의 실제 행동이다. `minimumDepthSlots=1`을 채울 추가 행동·시간·장소·이유가 필요하다. |
| `completion-gate-016` | `I usually take a nap on weekends.` | `ACTION=take a nap`은 구체적이다. 같은 행동을 다시 고치기보다 루틴의 깊이 슬롯을 하나 더 붙이는 것이 낫다. |
| `completion-gate-070` | `I drink coffee every morning.` | `ACTION=drink coffee`는 구체적이다. 질문 표현을 반복한 `every morning` 외에 추가 행동·구체적 시간·장소·이유·결과가 필요하다. |

## 변경한 22건

| 사례 | 핵심 답변 표현 | v2 `targetSlot` | 검토 사유 |
|---|---|---|---|
| `010` | `something easy` | `CHOICE` | 무엇을 선택했는지 아직 이름을 말하지 않았다. |
| `022` | `because it is nice` | `REASON` | 이유가 있다는 형식만 있고 실제 이유는 없다. |
| `028` | `deal with the problem somehow` | `SOLUTION` | 해결했다고만 했을 뿐 어떤 행동인지 없다. |
| `034` | `because it is good for me` | `REASON` | 왜 좋은지 설명되지 않았다. |
| `040` | `practice somehow` | `PLAN` | 연습 방법이 비어 있다. |
| `046` | `used to meet differently` | `BEFORE_STATE` | 과거에 어떻게 만났는지 구체적인 상태가 없다. |
| `052` | `because it is important` | `REASON` | 의견은 분명하지만 중요하다고 생각하는 이유가 비어 있다. |
| `058` | `because of an experience` | `CHANGE_CAUSE` | 어떤 경험이 변화를 만들었는지 없다. |
| `064` | `because that is better` | `REASON` | 무엇이 어떻게 더 나은지 설명되지 않았다. |
| `076` | `because it is nice` | `REASON` | 색을 좋아하는 실제 이유가 없다. |
| `082` | `somewhere nice` | `CHOICE` | 좋아하는 장소의 이름이나 종류가 없다. |
| `088` | `something delicious` | `CHOICE` | 좋아하는 음식이 무엇인지 특정하지 않았다. |
| `094` | `exercise more` | `PLAN` | 목표를 위한 방법·종류·일정이 구체적이지 않다. |
| `100` | `handle it somehow` | `SOLUTION` | 시간 낭비를 줄이기 위한 실제 조치가 없다. |
| `106` | `do something about it` | `SOLUTION` | 버스 지연에 어떻게 대응하는지 없다. |
| `112` | `some problems` | `DISADVANTAGE` | 단점이 있다는 말만 있고 실제 단점이 없다. |
| `118` | `can also be bad` | `DISADVANTAGE` | 무엇이 나쁜지 설명하지 않았다. |
| `124` | `because it is good` | `REASON` | 매운 음식을 좋아하는 구체적인 이유가 없다. |
| `130` | `because life changed` | `CHANGE_CAUSE` | 어떤 사건이나 경험이 가치관을 바꿨는지 없다. |
| `136` | 원인 없음 | `CHANGE_CAUSE` | 과거와 현재 상태는 있지만 설정된 깊이 슬롯 하나가 부족하며, 우선순위상 변화 원인이 먼저다. |
| `142` | `a nice area` | `PLACE` | 장소 질문에 실제 지역이나 위치를 제시하지 않았다. |
| `148` | `because it is useful` | `REASON` | 영어가 어디에 유용한지 실제 이유가 없다. |

## 저장된 응답 재채점

2026-07-13에 생성한 동일한 150건 LLM 응답을 다시 호출하지 않고 v2 정답표로 재채점했다.

| 기준 | 엄격 통과 |
|---|---:|
| 기존 정답표 | 100/150, 66.7% |
| v2 정답표 | 110/150, 73.3% |

- `실패 -> 통과`: 10건
- 기존부터 통과한 변경 사례: 8건
- 여전히 실패: 4건
- `통과 -> 실패`: 0건

이 증가는 모델 성능 향상이 아니다. 새 슬롯 계약과 과거 정답표가 충돌해서 실패하던 10건을 올바른 제품 기준으로 다시 판정한 결과다.

## 정답표를 바꾸지 않고 남긴 실제 문제

1. `010`, `082`, `088`: 백엔드가 `CHOICE`를 올바른 `targetSlot`으로 계산했지만 `focusType=TASK_RESET`으로 표시했다. `TASK_RESET`은 오프토픽·무의미 답변에만 사용해야 하므로 v2에서도 실패로 남겼다.
2. `094`: `exercise more`라는 막연한 `PLAN`을 충분하다고 보고 조기 완료했다. v2에서도 실패다.
3. 완성 답변의 동일한 전후 문장, 오프토픽 오판, 스캐폴드 누락 등은 이번 정답표 개편 범위가 아니므로 기존 실패를 유지했다.

## 재생성 및 검증

```powershell
node scripts/feedback-quality/generate-completion-gate-150-v2-oracle.mjs
node scripts/run-feedback-quality-check.mjs --cases scripts/feedback-quality/cases.completion-gate-150-v2.json --dry-run
```

새로운 실제 LLM 회귀 테스트에서는 `--cases scripts/feedback-quality/cases.completion-gate-150-v2.json`을 사용한다.

## 2026-07-16 canonical 미션 정답표 수정

canonical 피드백 계약에서는 질문과 관련 있는 답변에 필수 슬롯이 빠진 경우 `TASK_RESET`이 아니라 `SLOT`을 사용한다. `TASK_RESET`은 오프토픽, 무의미 답변, 비영어 답변처럼 기존 답변을 이어서 고칠 수 없는 경우에만 사용한다.

기존 생성기는 `ACTION`, `CHOICE`, `GOAL`, `PROBLEM`, `OPINION` 슬롯을 누락하면 legacy `TASK_RESET`으로 변환했다. 이 규칙을 제거하고 다음 7건의 기대 미션을 canonical `SLOT`으로 수정했다.

- `completion-gate-003`: `ACTION`
- `completion-gate-009`: `CHOICE`
- `completion-gate-015`: `ACTION`
- `completion-gate-045`: `OPINION`
- `completion-gate-069`: `ACTION`
- `completion-gate-081`: `CHOICE`
- `completion-gate-087`: `CHOICE`

생성 파일도 legacy `expectedFocusTypes` 대신 `expectedMissionKinds`를 권위값으로 사용한다. 수정 후 동일한 150개 저장 응답을 재채점한 결과는 다음과 같다.

| 기준 | 엄격 통과 |
|---|---:|
| 수정 전 정답표 | 121/150, 80.7% |
| canonical 정답표 | 128/150, 85.3% |

`MISSING_SLOT` 유형은 18/25에서 25/25로 바뀌었다. LLM 응답이나 백엔드 코드를 바꿔 얻은 상승이 아니라, 테스트 정답을 이미 적용 중인 제품 정책과 일치시킨 결과다.
