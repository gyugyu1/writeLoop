---
status: accepted
date: 2026-10-21
decision-makers: gyuwon
---

# 문장 피드백 스키마는 "진단 → 학습 자료" 순서로 생성시킨다

## Context and Problem Statement

프롬프트는 "모범답안을 먼저 쓰고, 그와 비교해 추천 표현을 고르라"고 지시했다. 그런데 스키마에서는 추천 표현이 모범답안보다 앞에 있었고, 주제 판정도 이유보다 상태(`status`)를 먼저 쓰게 되어 있었다. 구조화 출력은 스키마 순서대로 생성되므로 지시를 지킬 수 없었다. 측정해 보니 추천 표현이 모범답안에 실제로 들어 있는 비율이 17.4%였다.

## Decision Drivers

* 각 필드는 앞에서 이미 쓴 내용에만 기댈 수 있다.
* 근거를 먼저 쓰고 판정한다.
* 진단을 마친 뒤 학습 자료를 쓴다.

## Considered Options

* 기존 선언 순서 유지
* `topicAssessment(reasonKo → status)` → 구조 → 언어 교정 → 슬롯 → 모범답안 → 추천 표현 → 잘한 점

## Decision Outcome

Chosen option: "진단 → 학습 자료 순서", because 같은 150건 회귀에서 정확도는 그대로이면서 추천 표현과 모범답안의 일치도가 두 배 이상 올랐기 때문이다.

### Consequences

* Good, because 150건 회귀(gpt-6-luna, low) 결과가 이렇다.
  * 엄격 통과: 142/149 → 143/150
  * 계약 오류: 0 → 0
  * 추천 표현의 모범답안 포함률: 17.4% → 38.3%
  * 평균 응답 시간: 14.5초 → 12.8초
* Bad, because 순서를 바꾸면 모델 동작이 달라지므로, 이후 순서 변경마다 회귀 측정이 필요하다.

### Confirmation

* `LlmRequestDeterminismTest`가 최상위 필드 순서를 검사한다.
* 계약 문서 `references/feedback-schema.md`에 순서를 적어 두었다.

## More Information

* 커밋: `e1b930e`
* 이후 `missionSupport`, `enrichmentSupport`가 슬롯 판정과 모범답안 사이에 추가됐다(ADR-0010, ADR-0011).
