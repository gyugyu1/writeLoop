---
status: accepted
date: 2026-10-20
decision-makers: gyuwon
---

# 회원 탈퇴 시 사용자 데이터는 애플리케이션이 명시적으로 모두 삭제한다

## Context and Problem Statement

예전 탈퇴 처리는 답변, 코치, 저장 표현, 토큰만 지웠다. 그래서 다음 데이터가 남았다.

* 피드백 진단 로그의 답변 원문
* 의견 보내기의 연락처 이메일
* 추천·타이밍 로그
* 임시저장 초안

일기와 Now in English는 DB의 CASCADE에만 의존했다. 이미 탈퇴한 사용자의 데이터도 운영 DB에 남아 있었다.

## Decision Drivers

* 탈퇴한 사용자의 개인정보가 남으면 안 된다.
* 새 사용자 데이터 테이블이 생겨도 삭제 대상에서 빠지지 않아야 한다.
* 외래 키 CASCADE만 믿으면, 외래 키가 없는 테이블과 Redis 데이터가 남는다.

## Considered Options

* DB 외래 키 CASCADE에 맡긴다.
* 삭제 전용 서비스가 `user_id`가 있는 모든 테이블과 Redis를 명시적으로 지운다.

## Decision Outcome

Chosen option: "삭제 전용 서비스가 명시적으로 삭제", because 외래 키가 없는 로그 테이블과 Redis 초안, refresh token까지 한곳에서 확실히 지울 수 있기 때문이다.

### Consequences

* Good, because `AccountDataPurgeService` 한곳에 삭제 순서와 대상이 모여 있다.
* Good, because 빠진 테이블이 있으면 테스트가 실패한다.
* Bad, because 새 사용자 데이터 엔티티를 추가하면 삭제 대상에도 직접 넣어야 한다.

### Confirmation

* `AccountDataPurgeServiceTest`가 `user_id` 컬럼이 있는 엔티티를 검사해, 삭제 대상에서 빠진 것이 있으면 실패한다.
* `scripts/db/check-deleted-user-data.sql`로 남은 데이터를 점검한다(읽기 전용).

## More Information

* 커밋: `cbaf93c`. 이미 탈퇴한 사용자 데이터 정리는 마이그레이션 `103`.
* 알려진 문제: 모바일(토큰 인증)에서는 탈퇴 요청이 401로 실패한다. `docs/writeloop-improvement-review-2026-10-22.ko.md` 1.1
