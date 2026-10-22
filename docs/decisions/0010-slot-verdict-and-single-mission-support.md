---
status: accepted
date: 2026-10-22
decision-makers: gyuwon
---

# 슬롯은 판정 필드로 받고, 학습 지원 내용은 미션으로 보여 줄 슬롯 하나에만 생성한다

## Context and Problem Statement

예전 계약은 슬롯 상태를 "지원 내용의 유무"로 표현했다.

* 근거 있음 + 지원 없음 → 충족
* 근거 있음 + 지원 1개 → 막연함
* 근거 없음 + 지원 1개 → 없음

계약 문서에는 "slot 안에 status를 넣지 말라"는 규칙도 있었다. 그래서 LLM은 채워지지 않은 슬롯마다 완전한 지원 내용(제목, 이유, 지시문, 영·한 문장 틀, 표현 2~4개)을 써야 했다. 하지만 화면에는 미션 하나만 보인다. 150건을 측정한 결과는 이렇다.

* 응답당 지원 내용 4.9개를 생성했고, 실제로 보여 준 것은 10%였다.
* 화면에 쓰이지 않는 출력이 전체의 약 60%였다.
* 완성 답변도 지원 내용을 평균 3.1개 생성했다.
* 주제 이탈 답변은 6.6개를 생성했다.

## Decision Drivers

* 출력 토큰이 곧 응답 시간이고 비용이다.
* 미션 결정 권한은 계속 백엔드에 있어야 한다(ADR-0001).
* 상태와 근거가 어긋나는 출력은 계속 걸러야 한다.

## Considered Options

* 기존 유지(상태를 지원 유무로 표현)
* 1차 호출로 진단하고, 고른 슬롯의 지원 내용만 2차 호출로 생성
* 슬롯마다 `evidence`와 `verdict`만 받고, 지원 내용은 최상위 `missionSupport` 하나에만 받는다. 백엔드와 같은 선택 규칙을 프롬프트에 적는다.

## Decision Outcome

Chosen option: "`verdict` + `missionSupport` 하나", because 호출을 늘리지 않고 버려지던 출력을 없앨 수 있기 때문이다. 백엔드는 미션을 다시 계산하고, `missionSupport`가 비어 있거나 다른 슬롯을 가르치면 재시도 대상 계약 위반으로 처리한다. 이전의 "status 금지" 규칙은 이 결정으로 대체한다.

### Consequences

* Good, because 150건 회귀(gpt-6-luna, low) 결과가 이렇다.
  * 엄격 통과: 143/150 → 143/150
  * 계약 오류: 0 → 0. 모델이 선택 규칙을 150건 모두 맞게 적용했다.
  * 출력 토큰: 1,439 → 760
  * 버려지는 출력: 60% → 1.7%
* Good, because 슬롯 판정 분포는 거의 변하지 않았다. "판정이 쉬워져 더 엄격해질 것"이라는 우려는 측정으로 확인되지 않았다.
* Bad, because 백엔드의 미션 선택 규칙과 프롬프트의 선택 규칙을 항상 같이 바꿔야 한다.

### Confirmation

* `FeedbackLearningContractPolicyTest`: 다른 슬롯을 가르치는 지원 내용 거부, 지원 내용 누락 거부, 슬롯 미션이 아니면 지원 내용 무시
* `CanonicalFeedbackContractTest`, `LlmRequestDeterminismTest`

## More Information

* 커밋: `3c46a4b`
* 응답 시간은 OpenAI 쪽 속도 변화가 섞여 이번 측정으로 판단하지 못했다. 첫 6건은 7.5~8.7초였다.
