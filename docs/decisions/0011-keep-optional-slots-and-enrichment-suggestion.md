---
status: accepted
date: 2026-10-22
decision-makers: gyuwon
---

# 선택 슬롯 판정을 유지하고, 완성 답변에 "더 풍부하게 써 보기" 제안을 붙인다

## Context and Problem Statement

활성 질문 675개 중 661개(98%)가 `minimumDepthSlots = 0`이다. 이 질문들의 선택 슬롯은 미션이 될 수 없어서, 판정 결과가 미션에도 화면에도 쓰이지 않았다. 처음에는 LLM 요청에서 선택 슬롯을 빼서 토큰을 줄이는 안을 검토했다. 하지만 선택 슬롯은 앞으로 쓸 계획이 있었다. 완성된 답변에도 "다음에 넣으면 좋은 내용"을 제안하고 싶다는 요구도 있었다.

## Decision Drivers

* 선택 슬롯 데이터는 앞으로 쓸 기능을 위해 계속 만들어져야 한다.
* 제안은 완료를 막으면 안 된다.
* ADR-0010처럼, 지원 내용은 실제로 보여 줄 하나에만 생성한다.

## Considered Options

* 선택 슬롯을 LLM 요청에서 뺀다(입력 약 300~400토큰, 출력 약 60토큰 절감).
* 선택 슬롯 판정을 유지하고, 완성 답변일 때만 미충족 선택 슬롯 하나에 대한 선택 제안(`enrichmentSupport`)을 생성한다.

## Decision Outcome

Chosen option: "판정 유지 + 완성 답변 제안", because 선택 슬롯을 쓰는 기능을 지금 바로 만들 수 있고, 추가 출력은 완성 답변에 한해 제안 하나뿐이기 때문이다.

* 백엔드는 완성 판정이고, 그 슬롯이 미충족 선택 슬롯이며, 내용이 완전할 때만 `completion.enrichment`로 내보낸다.
* 조건에 맞지 않으면 재시도 없이 버린다.
* 웹·모바일 완성 화면에 카드로 보여 준다.

### Consequences

* Good, because 완성 답변 25건에서 모델이 26번 중 24번 제안을 썼고, 백엔드가 모두 통과시켰다. 예: "공원의 구체적인 특징을 더해 보세요", "지연이 생기는 때를 덧붙여 보세요".
* Bad, because 선택 슬롯 판정 비용(요청당 출력 약 60토큰)은 계속 든다.
* Bad, because 모바일 카드는 스토어 배포 후에야 보인다. 완료한 루프를 다시 열면 다시쓰기 버튼이 보이고 409가 나는 문제를 먼저 고쳐야 한다(`docs/writeloop-improvement-review-2026-10-22.ko.md` 4.3).

### Confirmation

* `FeedbackLearningContractPolicyTest`: 미충족 선택 슬롯의 제안만 유지
* `CanonicalFeedbackAssemblerTest`: 완성 응답에 제안 포함

## More Information

* 커밋: `6aad70a`. 같은 커밋에서 난이도 코드 설명과 promptHints 용도를 프롬프트에 추가하고, 힌트 전송 내용을 줄였다.
