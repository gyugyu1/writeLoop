---
status: accepted
date: 2026-07-28
decision-makers: gyuwon
---

# 문장 피드백에서 LLM은 진단만 하고, 미션은 백엔드가 결정한다

## Context and Problem Statement

예전 피드백 계약은 LLM이 점수, 완료 여부, 미션 종류까지 정했다. 그래서 같은 답변에도 판정이 흔들렸고, 화면에 보이는 미션과 실제 진단이 어긋났다. 학습 루프는 "미션 하나 → 다시 쓰기"로 돌아가므로, 미션 선택 규칙이 예측 가능해야 했다.

## Decision Drivers

* 같은 진단이면 항상 같은 미션이 나와야 한다.
* 미션 우선순위(주제 이탈 → 조각 문장 → 이해를 막는 문법 → 필수 슬롯 → 가벼운 문법 → 깊이 슬롯 → 완성)를 코드로 고정하고 테스트할 수 있어야 한다.
* LLM 출력이 계약을 어기면 거르거나 재시도할 수 있어야 한다.

## Considered Options

* LLM이 진단과 미션을 모두 정한다.
* LLM은 진단(주제, 문장 구조, 누적 교정 단계, 슬롯 근거)만 하고, 백엔드가 규칙으로 미션을 정한다.

## Decision Outcome

Chosen option: "LLM은 진단, 백엔드가 미션 결정", because 미션 선택이 결정적이 되고, 계약 검증과 재시도를 백엔드 한곳에서 처리할 수 있기 때문이다.

### Consequences

* Good, because 미션 규칙이 `FeedbackLearningContractPolicy`에 모여 있어 단위 테스트로 고정된다.
* Good, because 점수, 완료 여부 같은 필드를 LLM 출력에서 없앴다.
* Bad, because LLM이 써야 할 진단 구조가 커지고, 계약 위반 처리 코드가 필요하다.

### Confirmation

* `FeedbackLearningContractPolicyTest`, `CanonicalFeedbackAssemblerTest`
* 150건 회귀 테스트(`scripts/feedback-quality`)

## More Information

* 커밋: `9779119` (피드백 교정 계약과 노출 이력 구조를 개편)
* 계약 문서: `.agents/skills/writeloop-feedback-logic/SKILL.md`, `references/feedback-schema.md`
* 이 문서는 2026-10-22에 사후 기록했다.
