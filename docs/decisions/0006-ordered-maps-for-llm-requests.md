---
status: accepted
date: 2026-10-21
decision-makers: gyuwon
---

# LLM 요청의 스키마와 프롬프트는 순서를 보장하는 맵으로만 만든다

## Context and Problem Statement

Java의 `Map.of`, `Map.ofEntries`, `Map.copyOf`(그리고 `Set.of`)는 JVM을 시작할 때마다 순회 순서가 바뀐다. LLM 요청의 JSON 스키마와 프롬프트가 이 순서대로 직렬화됐다. 구조화 출력은 스키마의 키 순서대로 답을 생성하므로, 배포할 때마다 모델이 판단하는 순서가 달라지고 있었다. 실제 JVM 여러 번 실행으로 순서가 바뀌는 것을 확인했다.

## Decision Drivers

* 같은 코드라면 배포할 때마다 같은 요청을 보내야 한다.
* 필드 순서는 생성 순서이므로, 순서를 바꾸는 일은 의도한 변경이어야 한다.

## Considered Options

* 필요한 곳만 `LinkedHashMap`으로 바꾼다.
* 넣은 순서를 유지하는 `OrderedMaps` 유틸리티를 만들어 모든 LLM 요청 빌더에 적용하고, 테스트로 재도입을 막는다.

## Decision Outcome

Chosen option: "`OrderedMaps` + 테스트 가드", because 누가 다시 `Map.of`를 쓰더라도 테스트가 바로 잡아내기 때문이다.

### Consequences

* Good, because 스키마·프롬프트·요청 본문의 키 순서가 코드에 선언한 순서로 고정된다.
* Bad, because 테스트가 검사하는 파일 목록 밖에서는 여전히 실수할 수 있다. 예: `util/ExpressionTagSupport`가 코치 스키마에 `Map.of`를 쓴다([개선점 조사 요약](../reports/project/writeloop-improvement-review-2026-10-22.ko.md) 2.6).

### Confirmation

`LlmRequestDeterminismTest`가 스키마·프롬프트·요청 본문의 키 순서, 무작위 순서 맵 혼입, 소스의 `Map.of` 재도입을 검사한다.

## More Information

* 커밋: `bf23e90`
* 순서를 개선한 결정은 ADR-0007이다.
