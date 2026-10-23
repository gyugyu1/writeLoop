# 슬롯 구체성 강화 및 LLM 회귀 테스트 보고서

## 1. 작업 목적

직전 150건 테스트에서는 막연한 답변 3건을 충분한 답변으로 판단해 조기 완료했다.

| 슬롯 | 막연한 답변 | 실제 부족한 점 |
|---|---|---|
| `BEFORE_STATE` | `People used to meet differently ...` | 과거에 어떻게 만났는지 알 수 없음 |
| `REASON` | `because it is nice` | 왜 좋은지 설명하지 않음 |
| `PLACE` | `I live in a nice area.` | 실제 거주 위치를 식별할 수 없음 |

공통 원인은 슬롯 이름은 존재하지만, 각 슬롯을 어느 정도 구체적으로 채워야 하는지에 대한 중앙 기준과 반례가 부족했던 것이다.

## 2. 구현한 개선

### 중앙 슬롯 정의

`FeedbackSlotCatalog`의 정의를 강화했다. DB에는 계속 질문별 슬롯 코드만 저장하고, 백엔드가 해당 질문에 필요한 정의만 골라 `questionContract.slotDefinitions`로 LLM에 전달한다.

- `BEFORE_STATE`: 실제 과거 상태·습관·방법·의견을 요구한다. `differently`, `things were different`만으로는 `GENERIC`이다.
- `REASON`: 구체적인 원인·동기·효과·개인적 연상을 요구한다. `nice`, `good`, `I like it`처럼 결론을 반복하는 표현은 `GENERIC`이다.
- `PLACE`: 인식 가능한 지역·장소·기준점을 요구한다. `a nice area`, `a good place`, `somewhere nearby`는 `GENERIC`이다.

### 프롬프트 대조 반례

문장이 문법적으로 완전하거나 슬롯처럼 보이는 단어가 있다는 이유만으로 `SATISFIED` 처리하지 않도록 명시했다. 동시에 짧지만 구체적인 답변을 과잉 보강하지 않도록 다음 양방향 예시를 넣었다.

| 슬롯 | `GENERIC` | `SATISFIED` |
|---|---|---|
| `REASON` | `because it is nice` | `because blue reminds me of the ocean` |
| `PLACE` | `a nice area` | `western Seoul near a park` |
| `BEFORE_STATE` | `used to meet differently` | `used to meet in person` |

막연하게라도 슬롯을 시도했다면 `MISSING`이 아니라 `GENERIC`으로 진단하도록 경계도 명시했다.

## 3. 실제 LLM 회귀 조합

새 회귀 파일은 `scripts/feedback-quality/cases.slot-specificity-30.json`이다.

| 슬롯 | 막연한 답변 | 구체적인 답변 | 합계 |
|---|---:|---:|---:|
| `BEFORE_STATE` | 5 | 5 | 10 |
| `REASON` | 5 | 5 | 10 |
| `PLACE` | 5 | 5 | 10 |
| 합계 | 15 | 15 | 30 |

한 번의 우연한 결과를 피하기 위해 동일한 30건을 독립적으로 3회 실행한다. 총 실제 LLM 호출은 90건이다.

검증 기준은 다음과 같다.

- 막연한 답변 45회: 모두 `SLOT`, 정확한 `targetSlot`, 루프 미완료, 완전한 스캐폴드
- 구체적인 답변 45회: 모두 `COMPLETE`, 불필요한 보강 미션 없음
- 요청 실패: 0건
- 반복 일관성: 각 사례가 세 회차에서 같은 미션·슬롯·완료 결과를 반환

`scripts/feedback-quality/analyze-slot-specificity-runs.mjs`는 회차별 성공률, 막연한 답의 조기 완료 수, 구체 답의 과잉 보강 수, 슬롯별 성능과 반복 일관성을 자동 집계한다.

## 4. 검증 결과

### 코드 및 정적 검증

- 30개 회귀 케이스 형식 검증: 통과
- 중앙 슬롯 정의 및 반례 단위 테스트: 통과
- 전체 백엔드 테스트: 통과
- Docker 백엔드·프론트엔드 빌드: 통과

### 실제 LLM 실행

2026-07-17에 `gpt-5.6-luna`, reasoning effort `low`, 동시성 2로 첫 회차를 실행했다. 30건 모두 OpenAI 응답 생성 전에 HTTP 429로 종료됐다. 별도의 최소 진단 요청에서 다음 원인을 확인했다.

```text
type: insufficient_quota
code: insufficient_quota
```

따라서 이번 30건은 품질 실패가 아니라 **평가 불가**다.

| 항목 | 결과 |
|---|---:|
| 실제 요청 | 30 |
| API 한도 실패 | 30 |
| 평가 가능한 LLM 응답 | 0 |
| 품질 성공·실패로 계산한 건수 | 0 |

같은 원인으로 실패할 것이 명확해 2·3회차는 불필요한 요청을 보내지 않았다. OpenAI API 결제 한도 또는 크레딧이 복구된 뒤 3회 실행해야 최종 품질 판정을 내릴 수 있다.

## 5. 재실행 명령

```powershell
$env:WRITELOOP_FEEDBACK_PROVIDER='openai'
$env:WRITELOOP_FEEDBACK_MODEL='gpt-5.6-luna'
$env:WRITELOOP_FEEDBACK_REASONING_EFFORT='low'

1..3 | ForEach-Object {
  $env:WRITELOOP_FEEDBACK_VARIANT="slot-specificity-central-definitions-run-$_"
  node scripts/run-feedback-quality-check.mjs `
    --cases scripts/feedback-quality/cases.slot-specificity-30.json `
    --base-url http://localhost `
    --report-dir ".codex_logs/feedback-slot-specificity-30-2026-07-17/run-$_" `
    --concurrency 2 `
    --timeout-ms 180000 `
    --include-pass-payloads
}

node scripts/feedback-quality/analyze-slot-specificity-runs.mjs `
  --runs 3 `
  --output .codex_logs/feedback-slot-specificity-30-2026-07-17/summary.json
```

## 6. 현재 판단

구현 방향은 기존 구조와 잘 맞는다. 새 필드나 백엔드 의미 휴리스틱을 추가하지 않고, 질문 메타데이터가 이미 가진 슬롯 코드에 중앙 정의를 결합해 LLM의 판정 기준만 명확하게 만들었다. 또한 막연한 사례와 구체적인 사례를 같은 수로 묶어 조기 완료 개선과 과잉 보강 회귀를 동시에 감시한다.

다만 실제 배포 효과는 아직 확인되지 않았다. 최종 판단은 API 한도 복구 후 90건 실측 결과를 기준으로 해야 한다.
