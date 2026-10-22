---
status: accepted
date: 2026-10-22
decision-makers: gyuwon
---

# 모든 소셜 로그인은 제공자가 인증한 이메일만 계정 이메일로 쓴다

## Context and Problem Statement

ADR-0004에서 Apple 로그인은 서명된 토큰의 인증된 이메일만 쓰도록 했다. Kakao와 Google 로그인은 제공자 응답의 이메일을 인증 여부와 관계없이 새 계정의 이메일로 쓰고, 인증된 것으로 표시했다. 관리자 판정이 이메일 허용 목록 기준이라, 아직 가입하지 않은 주소를 선점하는 경로가 될 수 있었다. 기존 계정은 제공자 사용자 ID로 찾으므로 이미 가입한 계정을 빼앗을 수는 없었다.

## Decision Drivers

* 계정 이메일은 제공자가 소유를 확인한 것이어야 한다.
* 모든 소셜 제공자에 같은 기준을 적용한다.

## Considered Options

* 제공자 이메일을 그대로 쓴다.
* 제공자가 인증했다고 응답한 이메일만 쓰고, 아니면 제공자 사용자 ID 기반의 대체 이메일로 가입시킨다.

## Decision Outcome

Chosen option: "인증된 이메일만 사용", because Apple과 같은 기준으로 이메일 선점 경로를 막을 수 있기 때문이다.

* Kakao: `is_email_valid`와 `is_email_verified`가 모두 참일 때만 쓴다.
* Google: `email_verified`가 참일 때만 쓴다. 불리언과 문자열 응답을 모두 처리한다.

### Consequences

* Good, because 남의 이메일로 계정을 만들 수 없다.
* Bad, because 제공자 이메일이 인증되지 않은 사용자는 대체 이메일로 가입된다.

### Confirmation

`SocialProviderEmailTest`

## More Information

* ADR-0004를 Kakao·Google로 넓힌 결정이다.
* 같은 날 인증 코드 무차별 대입 방지(코드당 5번 실패 시 무효화, 새 코드 발급 시 이전 코드 무효화, 완료 단계 API의 IP 제한)와 `X-Forwarded-For` 위조 방지도 적용했다.
