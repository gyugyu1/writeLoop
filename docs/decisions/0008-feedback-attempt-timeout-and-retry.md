---
status: accepted
date: 2026-10-22
decision-makers: gyuwon
---

# 문장 피드백 OpenAI 호출은 한 번에 40초로 끊고, 시간 초과는 한 번 재시도한다

## Context and Problem Statement

운영에서 2차 답변이 오류로 끝났다(2026-10-21). OpenAI가 120초 동안 응답하지 않았기 때문이다. 앱은 90초에 요청을 끊어 오류를 보여 줬는데, 서버는 120초까지 기다린 뒤 실패로 기록했다. 시간 초과는 재시도 대상도 아니었다. 정상 응답은 보통 13~19초, 길어도 25초 정도다.

## Decision Drivers

* 서버가 앱보다 먼저 결과나 오류를 돌려줘야 한다.
* 가끔 멈추는 호출은 재시도로 살릴 수 있어야 한다.
* 코치와 영어일기의 시간 제한은 이번 변경으로 바뀌지 않아야 한다.

## Considered Options

* 120초 유지
* 앱 시간 제한을 늘린다.
* 호출당 제한을 줄이고, 시간 초과를 일시적 게이트웨이 오류(504)와 같은 경로로 한 번 재시도한다.

## Decision Outcome

Chosen option: "호출당 40초 + 시간 초과 1회 재시도", because 흔한 경우(멈춤 1회)를 약 80초 안에 처리해 앱 제한 90초 안에 들어오기 때문이다. 설정은 새 변수 `OPENAI_FEEDBACK_ATTEMPT_TIMEOUT_SECONDS`(기본 40)로 분리해, 이 값을 물려받는 다른 기능에 영향을 주지 않았다.

### Consequences

* Good, because 로컬 회귀에서 OpenAI가 멈춘 3건(150건 중)을 재시도로 모두 살렸다.
* Bad, because 시간 초과 뒤 재시도에서 계약 위반 재시도까지 겹치면 최악 약 120초가 걸린다. 요청 전체의 마감 시간은 후속 과제다.
* Bad, because 코치·영어일기·Now in English는 여전히 서버 120초, 앱 45초나 90초다.

### Confirmation

`OpenAiFeedbackClientTest.retriesOnceWhenTheProviderDoesNotAnswerBeforeTheAttemptTimeout`

## More Information

* 커밋: `6f968c2`
* 후속 과제: [개선점 조사 요약](../reports/project/writeloop-improvement-review-2026-10-22.ko.md) 2.1(기능별 전체 시간 예산, nginx 85초)
