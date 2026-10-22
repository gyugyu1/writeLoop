---
status: accepted
date: 2026-10-22
decision-makers: gyuwon
---

# 결정 기록은 MADR 형식의 ADR로 docs/decisions에 남긴다

## Context and Problem Statement

중요한 결정의 이유가 커밋 메시지, 날짜별 보고서, 대화 기록에 흩어져 있었다. 그래서 같은 논의를 반복하거나, 이유를 모른 채 결정을 되돌릴 위험이 있었다. 예: "슬롯 판정 안에 status를 넣지 말라"는 규칙을 바꿀 때, 원래 이유를 다시 추론해야 했다. Claude Code로 개발하므로 AI도 결정의 이유를 찾아 읽을 수 있어야 한다.

## Decision Drivers

* 널리 쓰이는 표준 형식을 따른다.
* 결정 하나를 한 파일로, 번호 순서로 찾을 수 있어야 한다.
* 결정이 바뀌어도 예전 결정과 그 이유가 남아야 한다.

## Considered Options

* MADR(Markdown Architectural Decision Records) 형식, `docs/decisions/`
* Michael Nygard 형식, `doc/adr/`
* 결정을 한 파일(`docs/decisions.ko.md`)에 날짜순으로 추가

## Decision Outcome

Chosen option: "MADR 형식, `docs/decisions/`", because 가장 널리 쓰는 ADR 템플릿이고, 검토한 선택지와 결과(장단점)를 남기는 구조가 정해져 있기 때문이다.

### Consequences

* Good, because 결정마다 배경·선택지·결과가 같은 구조로 남는다.
* Good, because 결정이 바뀌면 새 ADR을 쓰고 예전 ADR의 status를 `superseded by ADR-NNNN`으로 바꿔 이력이 이어진다.
* Bad, because 결정할 때마다 파일을 하나 써야 한다.

### Confirmation

채택한 ADR은 내용을 고치지 않는다. 바꿀 수 있는 것은 status뿐이다.

## More Information

* 형식: MADR 4.0 (<https://adr.github.io/madr/>)
* 새 ADR은 `adr-template.md`를 복사해 만든다. 섹션 제목은 MADR 원문대로 두고 본문은 한국어로 쓴다.
* `0001`~`0011`은 2026-10-22에 기존 결정을 사후 기록한 것이다.
