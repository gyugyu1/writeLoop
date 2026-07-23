# WriteLoop `STRUCTURE_FIX` 적용 후 150건 LLM 테스트 보고서

## 1. 결론

2026년 7월 16일, 최신 개발 백엔드에 `utteranceForm`, `structureIssues`, `STRUCTURE_FIX`를 적용하고 OpenAI `gpt-5.6-luna`에 150개 답변을 실제로 전송했다.

자동 채점 결과는 **129/150, 86.0%**다. 이전 실행 당시의 자동 점수 `121/150, 80.7%`보다 **8건, 5.3%p 상승**했다.

그러나 이번 결과는 두 축으로 나눠 봐야 한다.

| 관점 | 결과 | 의미 |
|---|---:|---|
| 전체 요청 기준 자동 통과 | 129/150, 86.0% | 사용자가 실제로 성공 응답을 받는 경우까지 포함한 결과 |
| 정상 응답 가용성 | 132/150, 88.0% | 18건은 HTTP 502로 피드백을 받지 못함 |
| 정상 응답 중 품질 통과 | 129/132, 97.7% | 응답이 계약 검증을 통과하면 대부분 의도한 미션을 제공함 |
| 문장 조각의 `STRUCTURE_FIX` | 16/25, 64.0% | 9건은 오판이 아니라 HTTP 502로 결과가 없음 |
| 응답이 생성된 문장 조각 | 16/16, 100% | 결과가 생성된 문장 조각은 모두 `STRUCTURE_FIX`로 분류됨 |
| 깨끗하게 합성된 구조 교정문 | 14/16, 87.5% | 2건은 여러 교정을 합치는 과정에서 문장 부호가 깨짐 |

핵심 판단은 다음과 같다.

- `utteranceForm`을 독립 축으로 둔 설계는 효과가 있었다.
- 정상 응답에서는 문장 조각을 `GRAMMAR_FIX`, `SLOT`, `COMPLETE`로 흩뜨리지 않고 모두 `STRUCTURE_FIX`로 모았다.
- 반면 LLM 출력과 백엔드 계약의 교차 필드 불일치가 17건 발생해 사용자에게 502를 반환했다.
- 여러 `structureIssues`를 단순 문자열 치환으로 합치면서 최종 교정문이 깨지는 결함도 발견됐다.
- 따라서 **구조 판정 방향은 유지하되, 현재 상태는 배포 보류가 적절하다.**

## 2. 테스트 조건

| 항목 | 값 |
|---|---|
| 실행 시간 | 2026-07-16 23:06:50~23:21:08 KST |
| 총 실행 시간 | 약 14분 18초 |
| 케이스 | `cases.completion-gate-150-v2.json` |
| 구성 | 6개 유형별 25건, 총 150건 |
| LLM 공급자 | OpenAI |
| 모델 | `gpt-5.6-luna` |
| reasoning effort | `low` |
| 동시 요청 | 2 |
| 테스트 클라이언트 제한 시간 | 180초 |
| 백엔드 OpenAI 제한 시간 | 120초 |
| API | 개발 백엔드 `http://localhost/api/feedback` |
| variant | `structure-fix-2026-07-16` |

테스트 전 다음 작업을 수행했다.

- 개발 DB에 `091-add-feedback-utterance-form.sql`을 적용했다.
- 최신 작업 트리로 백엔드 Docker 이미지를 다시 빌드했다.
- `/api/prompts` 응답이 HTTP 200인지 확인했다.
- 백엔드 전체 테스트, 모바일 타입 검사, 웹 프로덕션 빌드를 통과한 상태에서 실행했다.

이전 실행과 비교할 때 150건 중 144건의 입력은 동일하다. 과거 정답표에서 실제로 완전한 문장이었던 6개 `FRAGMENT` 입력만 명확한 문장 조각으로 수정됐다.

## 3. 유형별 결과

| 유형 | 이전 자동 결과 | 현재 결과 | 정상 응답 중 결과 | 해석 |
|---|---:|---:|---:|---|
| `OFF_TOPIC` | 25/25 | **25/25** | 25/25 | 유지 |
| `FRAGMENT` | 8/25 | **16/25** | **16/16** | 구조 미션은 개선, 가용성 문제 큼 |
| `MISSING_SLOT` | 18/25 | **23/25** | **23/23** | 개선 |
| `GENERIC_CONTENT` | 23/25 | 20/25 | 20/21 | 4건 502, 1건 조기 완료 |
| `GRAMMAR` | 24/25 | 23/25 | **23/23** | 2건 502로 원시 점수 하락 |
| `COMPLETE` | 23/25 | 22/25 | 22/24 | 1건 502, 2건 과잉 피드백 |
| 합계 | 121/150 | **129/150** | **129/132** | 자동 점수는 상승했지만 가용성 악화 |

이전 결과를 현재 정답 규칙으로 다시 채점하면 `120/150`이다. 이 기준으로는 현재 결과가 **9건, 6.0%p 상승**했다. 다만 6개 문장 조각 입력이 수정됐으므로 완전히 동일한 입력의 순수 A/B 테스트는 아니다.

## 4. `STRUCTURE_FIX` 평가

### 개선된 점

정상 응답이 생성된 문장 조각 16건은 모두 `STRUCTURE_FIX`를 선택했다. 이전에는 같은 유형이 다음처럼 흩어졌다.

| 이전 미션 분포 | 건수 |
|---|---:|
| `GRAMMAR_FIX` | 8 |
| `SLOT` | 12 |
| `COMPLETE` | 5 |

현재 정상 응답의 분포는 다음과 같다.

| 현재 미션 분포 | 건수 |
|---|---:|
| `STRUCTURE_FIX` | 16 |
| HTTP 502로 미션 없음 | 9 |

대표적으로 다음 교정이 생성됐다.

| 학습자 답변 | 구조 교정 |
|---|---|
| `Dishes and TV after dinner.` | `After dinner, I usually wash the dishes and watch TV.` |
| `Nap on weekend.` | `I nap on weekends.` |
| `Reading every day for focus.` | `One habit I want to build this year is reading every day for focus.` |
| `Helping society and workers.` | `Successful companies should help society and workers.` |
| `Wake up and coffee.` | `I wake up and drink coffee.` |
| `Because travel and new people.` | `I am learning English because of travel and meeting new people.` |

이는 문장 조각을 내용 부족이나 일반 문법 문제로 처리하지 않고, 먼저 주어·동사를 갖춘 문장으로 완성한다는 제품 의도가 실제 응답에 반영됐다는 뜻이다.

### 새로 발견된 합성 결함

16건 중 2건은 개별 `structureIssue`는 유효했지만, 백엔드가 여러 수정안을 원문에 차례로 치환하면서 최종 `correctedAnswer`가 깨졌다.

```text
After work, maybe noodles.
-> After work, I usually make a quick meal., I usually choose noodles..
```

```text
Gym after work, relaxing.
-> I go to the gym after work., I relax.
```

현재 `applyStructureIssues()`는 각 `originalText`를 `revisedText`로 단순 교체한다. LLM이 부분 구문마다 완전한 문장을 반환하면 원래 쉼표와 마침표가 남아 `.,` 또는 `..`가 생긴다.

자동 규칙은 `coachMove.before/after`가 원문에 근거했는지만 검사해 이 문제를 통과시켰다. 따라서 자동 점수 `129/150`에서 이 2건을 보수적으로 제외하면 사람이 바로 사용할 수 있는 결과는 최소 **127/150, 84.7%**다.

## 5. HTTP 502 분석

총 18건이 `FEEDBACK_GENERATION_UNAVAILABLE`로 실패했다.

| 원인 | 건수 | 설명 |
|---|---:|---|
| 슬롯 상태와 `slotSupport` 불일치·중복 | 10 | `SATISFIED` 슬롯에도 지원을 생성하거나 같은 슬롯 지원을 두 번 반환함 |
| `grammarImpact`와 `grammarIssues` 불일치 | 5 | 문법 영향은 `POLISH/LOCAL/BLOCKING`인데 실제 교정 근거가 비어 있음 |
| 슬롯 증거가 원문과 정확히 일치하지 않음 | 2 | `evidence`가 학습자 답변의 정확한 부분 문자열이 아님 |
| OpenAI 요청 120초 초과 | 1 | 실제 네트워크·모델 타임아웃 |
| 합계 | **18** | 계약 거부 17건, 타임아웃 1건 |

프롬프트에는 이미 다음 규칙이 명시돼 있다.

- `GENERIC` 또는 `MISSING` 슬롯에만 지원을 생성한다.
- `SATISFIED` 슬롯에는 지원을 생성하지 않는다.
- `grammarImpact`가 `NONE`이 아니면 교정 근거를 제공한다.
- 슬롯 증거와 교정 전 문구는 학습자 답변의 정확한 부분 문자열이어야 한다.

따라서 이번 17건은 규칙이 없어서 생긴 문제라기보다, 한 번의 큰 구조화 출력 안에서 여러 배열의 교차 일관성을 모델이 항상 지키지 못해서 생긴 문제다. 현재 백엔드는 이 중 하나만 어긋나도 전체 응답을 폐기하므로 작은 진단 불일치가 사용자 관점의 완전한 서비스 실패로 확대된다.

이전 실행의 요청 성공은 `149/150, 99.3%`였지만 현재는 `132/150, 88.0%`다. **가용성이 11.3%p 하락한 것이 이번 테스트의 가장 큰 회귀다.**

## 6. 정상 응답에서 발견된 품질 오류 3건

### 1. 충분한 답변에 선택 슬롯을 강요함

질문은 기업의 사회적 책임에 관한 것이고, 답변은 안전한 근무 환경, 오염 감소, 영향 공개와 그 이유까지 제시했다.

```text
Successful companies should provide safe working conditions, reduce pollution,
and report their impact honestly because their decisions affect employees and local communities.
```

그러나 백엔드는 선택 깊이 슬롯 `EXAMPLE`이 남았다는 이유로 `SLOT/EXAMPLE`을 열었다. 필수 답과 충분한 구체성이 이미 있다면 선택 슬롯이 항상 추가 미션이 되어서는 안 된다.

### 2. 막연한 이유를 구체적인 이유로 인정함

```text
My favorite color is blue because it is nice.
```

`nice`는 이유의 형태는 있지만 학습 가능한 구체적 정보가 없다. `REASON=GENERIC`으로 보고 같은 이유를 구체화해야 하지만 `COMPLETE`로 조기 종료했다.

### 3. 자연스러움 개선을 필수 문법 교정으로 처리함

```text
When my bus is delayed, I check the subway route and message my team before I become late.
```

모델은 `become late -> be late`를 `GRAMMAR_FIX`로 선택했다. 이는 답변 전체를 막는 오류가 아니며, 단순 치환 결과도 `before I be late`가 되어 오히려 문맥상 부자연스러워졌다. 이 경우 완료하거나 선택적인 표현 다듬기로 처리하는 편이 낫다.

## 7. 지연 시간

| 지표 | 이전 | 현재 전체 | 현재 정상 응답만 |
|---|---:|---:|---:|
| 평균 | 12,875ms | 11,394ms | 10,675ms |
| p50 | 10,881ms | 10,624ms | 10,624ms |
| p95 | 19,967ms | 14,802ms | 14,495ms |

응답 속도는 중앙값과 꼬리 지연 모두 좋아졌다. 다만 120초 타임아웃 1건과 계약 거부 17건이 있으므로 속도 개선만으로 사용자 경험이 좋아졌다고 판단할 수는 없다.

## 8. 배포 게이트

| 배포 기준 | 목표 | 현재 | 판정 |
|---|---:|---:|---|
| 조기 완료 | 0건 | 1건 | **실패** |
| 오프토픽 `TASK_RESET` | 100% | 25/25, 100% | 통과 |
| 문법 오류 분류 | 95% 이상 | 23/25, 92% | **실패** |
| 생성된 내용 미션 스캐폴드 | 100% | 69/69, 100% | 통과 |
| 요청 성공률 | 99% 이상 권장 | 132/150, 88% | **실패** |
| 문장 조각의 깨끗한 구조 교정 | 95% 이상 권장 | 14/25, 56% | **실패** |

문법 오류 2건은 분류 오판이 아니라 502다. 정상 응답만 보면 `23/23`이 `GRAMMAR_FIX`였지만 실제 사용자는 피드백을 받지 못하므로 전체 요청 기준 배포 게이트에서는 실패로 계산하는 것이 맞다.

## 9. 개선 우선순위

1. **계약 불일치가 전체 502가 되지 않게 한다.** 선택되지 않은 슬롯의 불필요한 지원 데이터는 제거하거나 무시하고, 최종 목표 슬롯에 필요한 지원만 엄격히 검증하는 방향이 적절하다.
2. **복구 가능한 계약 실패에 1회 재시도를 둔다.** `slotSupport` 불일치, 문법 근거 누락, 원문 증거 불일치는 같은 프롬프트를 무한 재호출하지 말고 오류 이유를 포함해 한 번만 다시 생성하도록 한다.
3. **구조 교정 전체 문장을 안전하게 조립한다.** 여러 부분 교정을 단순 문자열 치환하지 말고, 하나의 완성된 구조 교정문을 권위값으로 받거나 전체 적용 후 문장 부호를 검증해야 한다.
4. **자동 테스트가 최종 `correctedAnswer`도 검사하게 한다.** `.,`, `..`, 중복 문장, 교정 후 비문을 별도 실패 코드로 잡아야 한다.
5. **막연한 이유 판정을 보강한다.** `nice`, `good`, `interesting`, `easy`처럼 질문의 이유를 실질적으로 설명하지 않는 형용사는 문맥에 따라 `GENERIC`으로 보도록 예시를 추가한다.
6. **선택 깊이 슬롯의 종료 기준을 조정한다.** 필수 슬롯이 모두 구체적이고 답변 자체에 충분한 근거와 세부 정보가 있으면 `EXAMPLE` 같은 선택 슬롯을 강제하지 않는다.

가장 먼저 고칠 것은 프롬프트 문구가 아니라 **계약 불일치가 502로 확대되는 경로와 구조 교정문 조립 방식**이다. 프롬프트 규칙은 이미 비교적 명확하며, 같은 모델이 132건에서는 잘 지켰지만 17건에서 교차 일관성을 놓쳤다.

## 10. 최종 판단

`utteranceForm`과 `STRUCTURE_FIX`는 유지할 가치가 충분하다. 정상 응답 기준으로 문장 조각 판정은 `16/16`이었고, 이전의 `GRAMMAR_FIX/SLOT/COMPLETE` 혼선을 제거했다.

하지만 현재 구현은 진단 계약이 조금만 어긋나도 사용자에게 피드백을 전혀 주지 못하고, 여러 구조 교정을 합칠 때 최종 문장을 망가뜨릴 수 있다. **다음 개발 단계는 분류 축을 다시 바꾸는 것이 아니라, 계약 복구와 교정문 조립을 안정화하는 것**이어야 한다.

## 11. 산출물

- 전체 실제 응답: `.codex_logs/feedback-completion-gate-150-structure-fix-2026-07-16/latest.json`
- 집계 결과: `.codex_logs/feedback-completion-gate-150-structure-fix-2026-07-16/summary.json`
- 이전·현재 재채점 비교: `.codex_logs/feedback-completion-gate-150-structure-fix-2026-07-16/comparison.json`
- 테스트 케이스: `scripts/feedback-quality/cases.completion-gate-150-v2.json`
- 이전 실제 결과: `.codex_logs/feedback-completion-gate-150-canonical-2026-07-15/latest.json`

실행 명령은 다음과 같다.

```powershell
$env:WRITELOOP_FEEDBACK_PROVIDER='openai'
$env:WRITELOOP_FEEDBACK_MODEL='gpt-5.6-luna'
$env:WRITELOOP_FEEDBACK_REASONING_EFFORT='low'
$env:WRITELOOP_FEEDBACK_VARIANT='structure-fix-2026-07-16'

node scripts/run-feedback-quality-check.mjs `
  --cases scripts/feedback-quality/cases.completion-gate-150-v2.json `
  --base-url http://localhost `
  --report-dir .codex_logs/feedback-completion-gate-150-structure-fix-2026-07-16 `
  --concurrency 2 `
  --timeout-ms 180000 `
  --include-pass-payloads
```
