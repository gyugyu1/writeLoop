---
status: accepted
date: 2026-10-20
decision-makers: gyuwon
---

# Apple 로그인은 서명된 identityToken의 인증된 이메일만 계정 이메일로 쓴다

## Context and Problem Statement

Apple 로그인은 앱이 요청 본문에 이메일을 함께 보낸다. 토큰에 이메일이 없으면 이 값을 인증된 계정 이메일로 저장하고 있었다. 요청 본문은 위조할 수 있다. 그런데 관리자 판정이 이메일 허용 목록 기준이라, 아직 가입하지 않은 관리자 이메일을 선점하는 경로가 됐다.

## Decision Drivers

* 계정 이메일은 위조할 수 없는 출처에서만 받아야 한다.
* 관리자 판정이 이메일 기준인 동안에는 특히 엄격해야 한다.

## Considered Options

* 요청 본문 이메일을 대체값으로 계속 쓴다.
* 서명을 검증한 identityToken의 `email` claim만 쓰고, `email_verified=false`면 쓰지 않는다.

## Decision Outcome

Chosen option: "서명된 토큰의 인증된 이메일만 사용", because Apple 공개키로 서명을 검증한 값만 믿을 수 있기 때문이다. 토큰에 이메일이 없으면 Apple 사용자 ID 기반의 대체 이메일로 가입시킨다.

### Consequences

* Good, because 이메일 위조로 다른 계정이나 관리자 이메일을 선점할 수 없다.
* Bad, because 토큰에 이메일이 없는 사용자는 실제 이메일 대신 대체 이메일로 가입된다.

### Confirmation

`AppleIdentityTokenServiceTest`

## More Information

* 커밋: `0b85076`
