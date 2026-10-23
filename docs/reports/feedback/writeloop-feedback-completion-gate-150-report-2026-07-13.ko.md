# WriteLoop 완료 판정 회귀 테스트 150건 보고서

## 1. 테스트 개요

- 실행일: 2026-07-13
- 대상 API: 개발 환경 `/api/feedback`
- 실제 모델: `gpt-5.6-luna`
- reasoning effort: `low`
- 실행 방식: 실제 OpenAI API 호출 150회, 동시성 2
- 질문 수: 현재 개발 API에서 활성화된 25개 질문
- 답변 수: 질문마다 6개 유형, 유형별 25건
- 요청 성공: 150/150, 타임아웃 0건

답변 유형은 다음과 같이 균등하게 구성했다.

| 유형 | 건수 | 검증 목적 |
|---|---:|---|
| `OFF_TOPIC` | 25 | 질문과 무관한 답변을 `TASK_RESET`으로 되돌리는지 |
| `FRAGMENT` | 25 | 문장 조각을 완료하지 않고 복구 또는 재시작시키는지 |
| `MISSING_SLOT` | 25 | 명시적으로 빠진 필수 슬롯을 정확히 고르는지 |
| `GENERIC_CONTENT` | 25 | `good`, `somehow`, `something easy` 같은 막연한 답변을 조기 완료하지 않는지 |
| `GRAMMAR` | 25 | 명백한 문법 오류를 `GRAMMAR_FIX`로 고르는지 |
| `COMPLETE` | 25 | 충분한 답변을 추가 미션 없이 완료하는지 |

`MISSING_SLOT`, `GENERIC_CONTENT`, `OFF_TOPIC`에는 coarse `focusType`뿐 아니라 canonical `targetSlot` 기대값도 지정했다. 내용 미션의 스캐폴드는 `skeletonEn`, 한글이 포함된 `skeletonKo`, 한국어 뜻이 있는 표현 선택지 2개 이상 또는 사용 가능한 `rewriteWorkspace.starterText`를 기준으로 검사했다.

## 2. 전체 결과

| 지표 | 결과 |
|---|---:|
| 자동 품질 규칙 통과 | 94/150, 62.7% |
| 자동 품질 규칙 실패 | 56/150, 37.3% |
| 평균 응답 시간 | 6,678ms |
| p50 응답 시간 | 6,489ms |
| p95 응답 시간 | 9,195ms |
| canonical `targetSlot` 일치 | 46/75, 61.3% |
| 충분한 답변 완료 | 21/25, 84.0% |
| 문법 판정과 비교문까지 모두 충족 | 21/25, 84.0% |

요청 실패와 스키마 파싱 실패는 없었다. 현재 병목은 API 안정성이 아니라 완료 판정, 슬롯 선택, 내용 미션 출력의 품질이다.

### 유형별 결과

| 유형 | 자동 통과 | 핵심 관찰 |
|---|---:|---|
| `COMPLETE` | 21/25 | 4건이 완료 대신 추가 수정 미션으로 이어짐 |
| `FRAGMENT` | 14/25 | 11건이 재시작/문법 복구 대신 곧바로 내용 확장 미션으로 이동 |
| `GENERIC_CONTENT` | 5/25 | 13건 조기 완료, target 일치 9/25, 완전한 스캐폴드 5/25 |
| `GRAMMAR` | 21/25 | 분류는 22/25, 1건은 비교 근거가 원문과 일치하지 않음 |
| `MISSING_SLOT` | 17/25 | target 일치 17/25, 1건 조기 완료 |
| `OFF_TOPIC` | 16/25 | `TASK_RESET` 18/25, target 일치 20/25, 완전한 스캐폴드 16/25 |

## 3. 배포 게이트 판정

선정한 네 가지 배포 기준은 모두 미달했다.

| 게이트 | 목표 | 실제 | 판정 |
|---|---:|---:|---|
| 조기 완료 | 0건 | 14/125, 11.2% | 실패 |
| 명백한 오프토픽 `TASK_RESET` | 100% | 18/25, 72.0% | 실패 |
| 명백한 문법 오류 분류 | 95% 이상 | 22/25, 88.0% | 실패 |
| 실제 내용 미션의 완전한 스캐폴드 | 100% | 46/74, 62.2% | 실패 |

따라서 현재 상태는 이 회귀 기준으로 배포 가능한 상태가 아니다.

내용 미션 스캐폴드 46/74는 실제로 `REASON`, `DETAIL`, `SITUATION`, `EXAMPLE`, `FEELING`, `RESULT`, `TASK_RESET` 중 하나가 선택된 열린 루프만 분모로 삼았다. 조기 완료까지 포함한 의도된 내용 보강 50건의 종단 간 성공은 22/50, 44.0%였다.

## 4. 핵심 발견

### A. 막연한 답변을 슬롯 충족으로 인정해 조기 완료한다

조기 완료 14건 중 13건이 `GENERIC_CONTENT`였다. 대표 예시는 다음과 같다.

- `After work, I usually choose something easy.`
- `I often have too many tasks, so I deal with the problem somehow.`
- `I want to improve my stamina, so I will exercise more.`
- `They reduce waiting time, but they also have some problems. Overall, I support them.`
- `I used to value money, but now I value balance because life changed.`

문장 표면에는 `CHOICE`, `SOLUTION`, `PLAN`, `DISADVANTAGE`, `CHANGE_CAUSE`처럼 보이는 표현이 있지만, 실제 정보는 `something`, `somehow`, `more`, `some problems`, `life changed`처럼 비어 있다. 현재 판정은 슬롯의 존재와 슬롯의 학습 가능한 구체성을 충분히 구분하지 못한다.

`My neighborhood is quiet and convenient.`도 `Where do you live?`의 `PLACE`를 제시하지 않았는데 완료됐다. 이는 명시적 필수 슬롯 누락에서도 조기 완료가 발생할 수 있음을 보여준다.

### B. 오프토픽 복구가 복합 질문에서 약하다

오프토픽 25건 중 7건이 `TASK_RESET`이 아니었다. 다음과 같은 무관한 답변을 기존 문장 보강 대상으로 취급했다.

- 신념 변화 질문에 `I enjoy watching baseball with my brother.` -> `SITUATION / SPECIFIC_TIME`
- 셀프 계산대 질문에 `I usually read a book before bed.` -> `REASON / REASON`
- 오픈형 사무실 질문에 `I want to learn how to bake bread.` -> `SITUATION / SPECIFIC_TIME`
- 성공관 변화 질문에 `I usually play games after dinner.` -> `REASON / CHANGE_CAUSE`
- 영어 학습 이유 질문에 `My favorite bag is a small backpack.` -> `SITUATION / SPECIFIC_TIME`

특히 `CHANGE_REFLECTION`, `BALANCED_OPINION`, `GENERAL_DESCRIPTION`에서 기존 답변의 단어를 억지로 optional slot에 연결하는 경향이 확인됐다.

### C. canonical 슬롯이 응답까지 보존돼도 선택 자체가 부정확하다

canonical `targetSlot`을 기대한 75건 중 46건만 일치했다. 대표 혼동은 다음과 같다.

- 빠진 `DISADVANTAGE` 대신 `SPECIFIC_TIME`: 2건
- 빠진 `NOW_STATE` 대신 `CHANGE_CAUSE`
- 빠진 `OPINION` 대신 `REASON`
- 빠진 `PLAN` 대신 일반 `DETAIL`
- 조기 완료로 `targetSlot` 자체가 사라짐

UI가 canonical 슬롯을 정확히 표현하도록 개선한 것은 필요했지만, 이번 결과는 UI 이전 단계인 LLM의 `chosenSlot` 선택 정확도가 현재 병목임을 보여준다.

### D. 스캐폴드 계약이 미션 유형마다 일관되지 않다

전체 실패 코드 중 `missing_content_scaffold`가 44회로 가장 많았다. 실제 열린 내용 미션만 보면 74건 중 28건이 완전한 스캐폴드를 제공하지 못했다.

| 실제 `focusType` | 완전한 스캐폴드 |
|---|---:|
| `TASK_RESET` | 21/23, 91.3% |
| `DETAIL` | 12/18, 66.7% |
| `REASON` | 10/16, 62.5% |
| `SITUATION` | 0/14, 0.0% |
| `EXAMPLE` | 3/3, 100% |

`SITUATION` 14건은 모두 `skeletonKo` 또는 표현 선택지 2개 이상이 빠졌다. `DETAIL`과 `REASON`에서도 영어 골격 하나만 제공하고 한국어 골격이나 선택지가 없는 응답이 반복됐다. 이는 슬롯 선택 오류와 별개의 출력 계약 문제다.

### E. 문법 판정은 가장 안정적이지만 목표치에는 못 미친다

명백한 문법 오류 25건 중 22건이 `GRAMMAR_FIX`로 분류됐다. 놓친 3건은 다음과 같다.

- `Companies should protects workers ...` -> `EXAMPLE`
- `... now I prefers a few people ...` -> `REASON / CHANGE_CAUSE`
- `I am live in western Seoul ...` -> `REASON`

또한 문법으로 분류된 1건은 `coachMove.before`가 실제 학습자 답변에 그대로 존재하지 않아 비교 근거 검증에 실패했다. 따라서 분류 정확도는 88.0%, 비교까지 포함한 종단 간 성공은 84.0%다.

### F. 충분한 답변 4건이 루프를 끝내지 못했다

완성 답변 25건 중 21건이 완료됐다. 나머지 4건은 `EXPRESSION_POLISH`, `GRAMMAR_FIX`, `EXAMPLE` 미션으로 이어졌다.

일부 수정은 언어적으로 유효할 수 있다. 예를 들어 `release stress from the day`를 더 자연스럽게 다듬는 제안이나 `before I become late`를 고치는 제안은 참고 가치가 있다. 다만 현재 제품 정책에서는 질문 요구와 필수 슬롯을 충분히 충족한 답변의 루프를 막지 말고, 선택적 팁으로 내려야 한다. 이 네 건은 모델 오류라기보다 완료 정책과 교정 정책의 우선순위 충돌도 포함한다.

## 5. 실패 코드

한 테스트가 여러 규칙을 동시에 어길 수 있으므로 합계는 실패 케이스 56건보다 크다.

| 실패 코드 | 횟수 |
|---|---:|
| `missing_content_scaffold` | 44 |
| `wrong_focus_type` | 32 |
| `wrong_target_slot` | 15 |
| `empty_fix_points` | 14 |
| `loop_completed_too_early` | 14 |
| `loop_not_complete` | 4 |
| `missing_comparison` | 3 |
| `ungrounded_comparison` | 1 |

## 6. 개선 우선순위

1. **LLM 슬롯 증거 기준을 강화한다.** 백엔드가 슬롯 의미를 다시 판정하게 하지 않고, LLM이 `presentSlots`를 선언할 때 반드시 원문의 구체적 증거를 함께 내도록 한다. `something`, `somehow`, `good`, `nice`, `useful`, `an experience` 같은 빈 표현은 필수 슬롯 또는 depth slot 충족으로 인정하지 않는 규칙을 명시한다.
2. **필수 슬롯 우선 선택을 강제한다.** `missingSlots`에 required slot이 하나라도 있으면 optional slot을 `chosenSlot`으로 고르지 못하게 한다. 오프토픽이면 `TASK_RESET`과 질문의 첫 필수 슬롯만 선택하게 한다.
3. **완료와 선택적 교정을 분리한다.** 필수 슬롯과 `minimumDepthSlots`가 충족된 답변의 작은 자연스러움 개선은 `loopComplete=true`를 유지한 채 선택적 표현 팁으로 제공한다. 교정이 실제 의미 전달을 막을 때만 루프를 연다.
4. **스캐폴드 출력을 구조적으로 보장한다.** 내용 미션에서는 `skeletonEn`, 한글 `skeletonKo`, 한국어 뜻이 있는 표현 2개 이상을 JSON Schema의 필수 조건으로 둔다. 특히 `SITUATION` 전용 스캐폴드 규칙을 추가한다.
5. **canonical target 정확도를 새 배포 게이트로 추가한다.** 현재 61.3%인 `targetSlot` 일치율을 최소 95% 이상으로 올린 뒤 UI별 문구 품질을 평가한다.
6. **같은 150건을 수정 전후 A/B로 반복한다.** 프롬프트를 바꾼 뒤 동일 케이스, 모델, reasoning effort, 동시성으로 재실행해 조기 완료와 슬롯 혼동이 실제로 줄었는지 비교한다.

## 7. 해석상의 주의점

- 각 답변은 1회씩 호출한 결과이므로 모델 변동성까지 측정한 반복 실험은 아니다.
- `FRAGMENT` 중 일부는 문법 복구보다 내용 확장이 학습적으로 허용될 수 있어, 56.0%라는 수치를 핵심 배포 게이트로 직접 사용하지 않았다.
- `COMPLETE` 4건의 추가 교정 중 일부는 언어적으로 타당하지만, 이번 테스트는 충분한 답변의 루프를 막지 않는 제품 정책을 기준으로 판정했다.
- 합성 답변 중심이며 한국어 혼용, 장문 답변, 공격적 입력은 별도 보안/강건성 스위트가 필요하다.

## 8. 산출물

- 150건 생성기: `scripts/feedback-quality/generate-completion-gate-150.mjs`
- 150건 케이스: `scripts/feedback-quality/cases.completion-gate-150.json`
- 품질 규칙: `scripts/feedback-quality/rules.mjs`
- 집계 스크립트: `scripts/feedback-quality/analyze-completion-gate-150.mjs`
- 전체 원시 결과: `.codex_logs/feedback-completion-gate-150/latest.json`
- 집계 결과: `.codex_logs/feedback-completion-gate-150/summary.json`

## 9. 결론

실제 LLM 150건 호출은 안정적으로 완료됐지만, 네 가지 배포 게이트는 모두 실패했다. 가장 큰 문제는 막연한 표현을 충분한 슬롯으로 간주하는 조기 완료, 복합 질문에서의 오프토픽 복구 실패, canonical `targetSlot` 오선택, 내용 미션 스캐폴드 누락이다. 다음 개선은 UI 추가보다 LLM의 슬롯 증거 규칙과 스캐폴드 구조 계약을 먼저 강화하는 방향이 적절하다.
