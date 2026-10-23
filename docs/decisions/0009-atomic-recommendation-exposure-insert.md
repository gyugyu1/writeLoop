---
status: accepted
date: 2026-10-22
decision-makers: gyuwon
---

# 추천 노출 기록은 원자적 INSERT와 사용자별 이름 잠금으로 저장한다

## Context and Problem Statement

같은 사용자의 추천 요청이 동시에 들어왔다. 예: 홈 화면이 여러 추천 API를 한꺼번에 호출할 때. 이때 각 요청이 "노출 행 없음"을 보고 같은 행을 넣으려 했고, 진 쪽이 유니크 키 `uk_prompt_reco_daily_viewer_prompt` 위반으로 500이 났다(운영 2026-10-21 19:17, 3건). 예외를 잡아 같은 트랜잭션 안에서 복구하는 코드가 있었다. 하지만 한 번 실패한 Hibernate 세션은 다시 쓸 수 없어서("don't flush the Session after an exception occurs") 복구도 실패했다.

## Decision Drivers

* 동시 요청이 와도 500이 나지 않아야 한다.
* 사용자·날짜·질문마다 노출 행은 하나여야 한다.
* 노출 기록은 분석용이라, 메타데이터 병합은 최선 노력으로 충분하다.

## Considered Options

* 같은 세션 안에서 예외를 잡아 복구한다(기존, 동작하지 않음).
* `INSERT ... ON DUPLICATE KEY UPDATE`만 쓴다.
* 원자적 INSERT + 같은 사용자의 노출 쓰기를 MySQL `GET_LOCK`으로 직렬화한다.
* 노출 쓰기를 별도 트랜잭션(`REQUIRES_NEW`)으로 분리하고 실패를 무시한다.

## Decision Outcome

Chosen option: "원자적 INSERT + 사용자별 이름 잠금", because 실제 MySQL에서 검증한 결과 이 조합만 동시 요청을 모두 처리했기 때문이다.

* INSERT만 썼을 때는 같은 키를 기다리던 트랜잭션끼리 잠금을 올리다가 교착 상태(1213)가 났다.
* 잠금을 더한 뒤에는 동시 요청 60건이 모두 200이었고, 질문마다 행이 하나씩만 생겼다.

### Consequences

* Good, because 동시 요청이 직렬화되어 중복 키와 교착 상태가 사라졌다.
* Bad, because 이름 잠금은 DB 연결(세션) 단위라 같은 트랜잭션 안에서 반드시 풀어야 한다.
* Bad, because 다른 트랜잭션이 막 커밋한 행은 현재 트랜잭션의 읽기 스냅숏에 보이지 않을 수 있다. 그때는 메타데이터 병합을 건너뛴다.

### Confirmation

* `TodayQuestionRecommendationServiceTest.recommend_keeps_exposure_that_a_concurrent_request_already_inserted`
* 로컬 MySQL 동시 요청 검증(10개 동시 × 6회)

## More Information

* 커밋: `58b7634`
* 남은 문제: 게스트 기록을 사용자 기록으로 합치는 경로(`claimAuthenticatedUser`)는 아직 같은 종류의 500 위험이 있다. [개선점 조사 요약](../reports/project/writeloop-improvement-review-2026-10-22.ko.md) 3.2
