# WriteLoop 피드백 우선순위 개선 후 150건 LLM 회귀 테스트 보고서

## 1. 결론

2026년 7월 17일, 다음 네 가지 개선을 반영한 최신 개발 백엔드에 동일한 150개 답변을 실제로 전송했다.

1. `slotAssessments.status`를 없애고 백엔드가 `evidence/support` 모양으로 상태를 계산
2. 막연한 슬롯 표현에 대한 중앙 정의와 프롬프트 반례 강화
3. 문법 오류와 선택적 표현 다듬기의 경계 강화
4. 과도한 `minimumDepthSlots=2` 질문을 재검토해 `1`로 조정

자동 채점 결과는 **142/150, 94.7%**다. 직전 실행의 **139/150, 92.7%**보다 **3건, 2.0%p 상승**했다.

가장 큰 개선은 응답 가용성이다.

- 정상 응답: **144/150, 96.0% -> 150/150, 100%**
- HTTP 502 및 계약 오류: **6건 -> 0건**
- 문법 오류 답변: **23/25 -> 25/25**
- 충분한 답변 완료: **20/25 -> 24/25**
- canonical 슬롯 일치: **71/75 -> 73/75**

엄격 채점에서 실패한 8건은 다음 두 종류로 나뉜다.

- 실제 의미 판정 오류: **3건**
- 미션과 슬롯은 맞지만 한국어 골격이 영어로 생성된 스캐폴드 오류: **5건**

따라서 이번 변경은 **슬롯 계약 안정성, 막연함 판정, 충분한 답변 완료에서 분명한 개선 효과가 있다.** 다만 조기 완료 2건과 한국어 스캐폴드 오류 5건이 남아 있어 현재 배포 게이트는 통과하지 못했다.

## 2. 테스트 조건

| 항목 | 값 |
|---|---|
| 실행 시각 | 2026-07-17 12:03:15~12:14:40 KST |
| 실행 시간 | 약 11분 25초 |
| 테스트 세트 | `scripts/feedback-quality/cases.completion-gate-150-v2.json` |
| 구성 | 6개 유형별 25건, 총 150건 |
| LLM 공급자 | OpenAI |
| 모델 | `gpt-5.6-luna` |
| reasoning effort | `low` |
| 동시 요청 | 2 |
| 케이스 제한 시간 | 180초 |
| 백엔드 OpenAI 제한 시간 | 120초 |
| API | 최신 개발 백엔드 `http://localhost/api/feedback` |
| variant | `post-priorities-2026-07-17` |

테스트 전 다음 사항을 확인했다.

- 150개 케이스 형식 검증 통과
- canonical 계약, 조립기, 정책, 슬롯 정의 관련 백엔드 테스트 통과
- 컨테이너 설정이 `OpenAI / gpt-5.6-luna / low`인지 확인
- 별도의 1건 연결 확인 성공

연결 확인 1건은 아래 150건 통계에 포함하지 않았다. LLM 응답은 확률적이므로 이번 결과는 한 번의 표본 실행이다.

## 3. 직전 결과와 비교

| 지표 | 직전 | 현재 | 변화 |
|---|---:|---:|---:|
| 엄격 자동 통과 | 139/150, 92.7% | **142/150, 94.7%** | **+3건, +2.0%p** |
| 정상 응답 | 144/150, 96.0% | **150/150, 100%** | **+6건, +4.0%p** |
| 허용 가능한 미션 | 139/150, 92.7% | **147/150, 98.0%** | **+8건, +5.3%p** |
| 조기 완료 | 3건 | **2건** | **-1건** |
| canonical 슬롯 일치 | 71/75, 94.7% | **73/75, 97.3%** | **+2건, +2.6%p** |
| 충분한 답변 완료 | 20/25, 80.0% | **24/25, 96.0%** | **+4건, +16.0%p** |
| 문장 조각 구조 교정 | 25/25, 100% | **25/25, 100%** | 유지 |
| 문법 오류 답변 성공 | 23/25, 92.0% | **25/25, 100%** | **+2건, +8.0%p** |
| 실제 내용 미션 스캐폴드 | 72/72, 100% | **68/73, 93.2%** | **-6.8%p** |
| 평균 응답 시간 | 약 10.3초 | **약 9.1초** | 약 1.2초 단축 |

저장 응답을 동일한 현재 규칙으로 쌍별 비교한 결과는 다음과 같다.

| 결과 | 건수 |
|---|---:|
| 개선 | 11 |
| 동일 | 131 |
| 회귀 | 8 |

개선 11건 중 6건은 직전의 계약 오류가 정상 응답으로 바뀐 경우다. 나머지 주요 개선은 막연한 답변을 올바른 슬롯 미션으로 전환하거나 충분한 답변을 완료한 경우다.

## 4. 유형별 결과

| 유형 | 직전 | 현재 | 해석 |
|---|---:|---:|---|
| `OFF_TOPIC` | 25/25 | **23/25** | 25건 모두 `TASK_RESET`이지만 2건의 한국어 골격이 영어여서 엄격 실패 |
| `FRAGMENT` | 25/25 | **25/25** | 완전 통과 유지 |
| `MISSING_SLOT` | 25/25 | **22/25** | 슬롯 판정 오류 1건, 한국어 골격 오류 2건 |
| `GENERIC_CONTENT` | 21/25 | **23/25** | 막연함 판정 개선, 조기 완료 1건과 한국어 골격 오류 1건 |
| `GRAMMAR` | 23/25 | **25/25** | 계약 오류 없이 전부 성공 |
| `COMPLETE` | 20/25 | **24/25** | 불필요한 추가 미션이 크게 감소, 문법 과잉 교정 1건 |

`OFF_TOPIC`의 엄격 점수 하락은 주제 판정 실패가 아니다. 25건 모두 `TASK_RESET`과 올바른 대상 슬롯을 선택했지만, 두 응답에서 `skeletonKo`가 실제 한국어가 아니어서 실패했다.

## 5. 네 가지 개선사항의 실제 효과

### 5.1 슬롯 내부 불가능 조합 제거

이번 실행에서는 **150건 모두 정상 응답**했다. 직전 테스트에서 발생했던 슬롯 상태·증거·지원 불일치에 따른 6개 HTTP 502가 모두 사라졌다.

`status`를 LLM이 별도로 생성하지 않고 백엔드가 다음 모양으로 계산하게 한 방향은 효과가 있었다.

| 계산 상태 | evidence | support |
|---|---|---|
| `SATISFIED` | 있음 | 0개 |
| `GENERIC` | 있음 | 1개 |
| `MISSING` | 없음 | 1개 |

다만 출력 스키마가 잘못된 조합 자체를 완전히 표현 불가능하게 만든 것은 아니다. 백엔드 검증과 계약 오류 1회 재호출도 아직 별도 과제로 남아 있다. 이번에는 LLM이 유효한 조합만 반환해 재호출이 필요하지 않았다.

### 5.2 막연함 판정 반례 강화

핵심 반례가 포함된 13개 막연한 답변은 모두 올바른 슬롯을 미해결 상태로 판정했다. 12건은 엄격 통과했고, 1건은 슬롯 판정은 맞지만 한국어 골격 문제로 실패했다.

대표 결과는 다음과 같다.

| 답변의 막연한 표현 | 최종 미션 |
|---|---|
| `because it is nice` | `SLOT / REASON` |
| `deal with the problem somehow` | `SLOT / SOLUTION` |
| `practice somehow` | `SLOT / PLAN` |
| `used to meet differently` | `SLOT / BEFORE_STATE` |
| `because that is better` | `SLOT / REASON` |
| `some problems` | `SLOT / DISADVANTAGE` |
| `I live in a nice area` | `SLOT / PLACE` |

특히 직전 테스트에서 조기 완료했던 `differently`, `nice`, `a nice area`가 이번에는 모두 올바르게 미해결 슬롯으로 처리됐다.

### 5.3 문법과 표현 다듬기의 경계

직전 과잉 교정 사례였던 다음 답변은 이번에 정상 완료됐다.

```text
I want to improve my English speaking, so I will practice a five-minute conversation with a friend every evening.
```

`practice a five-minute conversation`을 문법 오류로 올리지 않았고, `practice having a five-minute conversation`은 선택적인 `refinementExpressions`에만 배치했다. 따라서 표현 추천이 완료를 막지 않았다.

문법 오류로 설계한 25건도 전부 `GRAMMAR_FIX`와 근거 있는 비교문을 반환했다. 다만 충분한 답변 1건에서 새로운 경계 오류가 발생했다.

```text
before I become late
-> before I am late
```

`am late`가 더 자연스럽지만 `become late`를 반드시 고쳐야 하는 문법 오류로 볼지는 논쟁의 여지가 있다. 현재 제품 정책에서는 의미가 통하고 문법적으로 허용되는 표현이므로 선택적 다듬기로 보내는 편이 일관적이다.

### 5.4 질문 메타데이터와 정답표 정렬

`minimumDepthSlots=2`에서 `1`로 조정한 대표 질문 `prompt-c-2`의 충분한 답변은 직전 `SLOT`에서 이번 `COMPLETE`로 바뀌었다.

```text
Successful companies should provide safe working conditions, reduce pollution,
and report their impact honestly because their decisions affect employees and local communities.
```

구체적인 의견과 이유를 이미 제시한 답변에 예시를 하나 더 강요하지 않게 된 것이다. 이번 150개 세트가 조정된 21개 질문을 모두 포함하지는 않으므로, 전체 21건의 실제 LLM 효과는 별도 메타데이터 전용 회귀 세트로 확인해야 한다.

## 6. 실제 판정 오류 3건

### 6.1 질문에 이미 들어 있는 시간 표현을 깊이 슬롯으로 인정

질문:

```text
What do you usually do in the morning?
```

답변:

```text
I drink coffee every morning.
```

LLM은 `ACTION=SATISFIED`에 더해 `SPECIFIC_TIME`의 증거로 `every morning`을 인정했다. 백엔드는 필수 행동과 깊이 슬롯 하나가 충족됐다고 계산해 `COMPLETE`로 종료했다.

그러나 `every morning`은 질문의 `in the morning`을 사실상 반복할 뿐 새로운 시간 정보를 주지 않는다. 이 질문에서는 `at 7 a.m.`, `before work`, `on weekdays`처럼 질문에 없던 시간이 추가돼야 `SPECIFIC_TIME` 깊이로 인정하는 편이 타당하다.

### 6.2 장소를 묻는 질문에서 `My neighborhood`를 구체적 장소로 인정

질문:

```text
Where do you live?
```

답변:

```text
My neighborhood is quiet and convenient.
```

LLM은 `PLACE`의 증거를 `My neighborhood`로 반환했다. 하지만 이는 사는 곳의 특징만 설명할 뿐 어느 도시, 지역, 마을에 사는지 식별할 수 없다.

`a nice area` 반례는 정상 작동했지만 `my neighborhood`, `my area`, `where I live` 같은 유사한 자리표시 표현은 중앙 정의에 더 명시할 필요가 있다.

### 6.3 자연스러움 차이를 문법 오류로 승격

답변:

```text
When my bus is delayed, I check the subway route and message my team before I become late.
```

LLM은 `become late -> am late`를 `LOCAL` 문법 오류로 반환했다. 더 일반적인 표현을 추천하는 것은 유용하지만, 이 차이가 답변 완료를 막을 정도의 문법 오류인지는 불분명하다.

`practice a five-minute conversation` 반례는 해결됐으므로 같은 원칙을 상태 변화 동사와 관용적 선호 표현에도 확장해야 한다.

## 7. 한국어 스캐폴드 오류 5건

다음 5건은 미션과 슬롯 선택은 정확했다.

| 번호 | 유형 | 최종 미션 | 문제 |
|---:|---|---|---|
| 52 | 막연한 이유 | `SLOT / REASON` | `skeletonKo`가 영어 문장 |
| 67 | 오프토픽 | `TASK_RESET / ACTION` | `skeletonKo`가 영어 문장 |
| 85 | 오프토픽 | `TASK_RESET / CHOICE` | `skeletonKo`가 영어 문장 |
| 87 | 선택 누락 | `SLOT / CHOICE` | `skeletonKo`가 영어 문장 |
| 93 | 계획 누락 | `SLOT / PLAN` | `skeletonKo`가 영어 문장 |

예를 들어 93번은 다음처럼 반환됐다.

```text
skeletonEn: I will ___ to improve my stamina.
skeletonKo: I will ___ to improve my stamina.
```

표현 선택지 두 개와 각각의 한국어 뜻은 정상이다. 실패 원인은 `skeletonKo`에 한글이 하나도 없다는 점이다.

현재 출력 스키마와 백엔드 계약은 `skeletonKo` 필드의 존재와 비어 있지 않음까지만 검사한다. 프롬프트는 한국어를 요구하지만 백엔드는 실제 한국어인지 검증하지 않으므로 영어 문장이 그대로 UI까지 통과할 수 있다.

자동 실패 코드 `missing_content_scaffold`는 총 7회지만, 실제 잘못 생성된 스캐폴드는 5건이다. 나머지 2회는 조기 완료로 내용 미션 자체가 사라진 70번과 141번에 함께 기록된 파생 실패다.

## 8. 배포 게이트

| 배포 기준 | 목표 | 현재 | 판정 |
|---|---:|---:|---|
| 조기 완료 | 0건 | 2건 | **실패** |
| 오프토픽 `TASK_RESET` | 100% | 25/25, 100% | 통과 |
| 문법 오류 미션 성공 | 95% 이상 | 25/25, 100% | 통과 |
| 문장 조각 `STRUCTURE_FIX` | 95% 이상 권장 | 25/25, 100% | 통과 |
| 실제 내용 미션 스캐폴드 | 100% | 68/73, 93.2% | **실패** |
| 요청 성공률 | 99% 이상 권장 | 150/150, 100% | 통과 |
| canonical 슬롯 일치 | 관찰 지표 | 73/75, 97.3% | 개선 |
| 충분한 답변 완료 | 관찰 지표 | 24/25, 96.0% | 개선 |

## 9. 다음 개선 우선순위

### 1순위. 한국어 스캐폴드를 백엔드 계약으로 검증

`skeletonKo`에 한글이 포함됐는지 검증해야 한다. 검증 실패 시 영어 골격을 백엔드가 임의 번역하거나 보완하지 않고 계약 오류로 처리하는 것이 현재 설계 원칙과 맞다.

다만 즉시 `unavailable`만 반환하면 가용성이 다시 낮아질 수 있으므로, 다음 작업인 계약 오류 1회 재호출과 함께 적용하는 편이 안전하다.

### 2순위. 질문 프레임 반복을 깊이로 인정하지 않는 반례 추가

`SPECIFIC_TIME`에는 다음 반례를 추가할 필요가 있다.

```text
Question: What do you usually do in the morning?
Answer: I drink coffee every morning.
Decision: "every morning" repeats the question frame and does not count as a new depth slot.
```

질문의 시간·장소 표현을 그대로 반복하는 것과 새로운 구체 정보를 구분하도록 중앙 슬롯 정의를 강화해야 한다.

### 3순위. `PLACE` 자리표시 표현 확대

다음 표현은 장소 명사가 있어도 위치를 식별하지 못하므로 `GENERIC` 또는 `MISSING`으로 판정해야 한다.

- `my neighborhood`
- `my area`
- `where I live`
- `somewhere nearby`

### 4순위. 문법과 자연스러움의 추가 경계 사례

`become late -> am late`처럼 문법 오류보다는 관용적 선호에 가까운 사례를 추가해야 한다. 문법적으로 허용되고 의미가 명확하면 `grammarIssues`가 아니라 `refinementExpressions`로 보내야 한다.

### 5순위. 계약 오류 1회 재호출

이번에는 계약 오류가 0건이었지만, 한국어 스캐폴드 검증을 강화하면 기존에 통과하던 응답이 계약 오류가 될 수 있다. 오류 사유를 포함해 한 번만 재호출하고, 두 번째도 실패하면 `FEEDBACK_GENERATION_UNAVAILABLE`을 반환하는 구조가 필요하다.

## 10. 최종 판단

이번 개선은 전체적으로 성공적이다.

- 슬롯 상태 중복 제거 후 계약 오류가 0건이 됐다.
- 막연함 반례는 핵심 사례에서 의도대로 작동했다.
- 문법 오류 세트는 100% 성공했고 충분한 답변 완료도 크게 개선됐다.
- `minimumDepthSlots` 조정은 대표 질문에서 불필요한 예시 강요를 제거했다.

그러나 엄격 배포 기준으로는 아직 통과하지 못했다. 남은 문제는 새 스키마를 다시 크게 설계하는 것이 아니라 다음 세 경계를 좁히는 작업이다.

1. 한국어 골격의 실제 언어 검증
2. 질문 문구 반복과 새로운 깊이 정보의 구분
3. 문법 오류와 자연스러운 대안의 구분

## 11. 산출물

- 현재 전체 응답: `.codex_logs/feedback-completion-gate-150-post-priorities-2026-07-17/latest.json`
- 현재 집계: `.codex_logs/feedback-completion-gate-150-post-priorities-2026-07-17/summary.json`
- 직전 대비 쌍별 비교: `.codex_logs/feedback-completion-gate-150-post-priorities-2026-07-17/comparison.json`
- 직전 전체 응답: `.codex_logs/feedback-completion-gate-150-unified-assessments-2026-07-17/latest.json`
- 테스트 케이스: `scripts/feedback-quality/cases.completion-gate-150-v2.json`

재현 명령은 다음과 같다.

```powershell
$env:WRITELOOP_FEEDBACK_PROVIDER='openai'
$env:WRITELOOP_FEEDBACK_MODEL='gpt-5.6-luna'
$env:WRITELOOP_FEEDBACK_REASONING_EFFORT='low'
$env:WRITELOOP_FEEDBACK_VARIANT='post-priorities-2026-07-17'

node scripts/run-feedback-quality-check.mjs `
  --cases scripts/feedback-quality/cases.completion-gate-150-v2.json `
  --base-url http://localhost `
  --report-dir .codex_logs/feedback-completion-gate-150-post-priorities-2026-07-17 `
  --concurrency 2 `
  --timeout-ms 180000 `
  --include-pass-payloads
```
