---
status: accepted
date: 2026-10-23
decision-makers: gyuwon
---

# 가동 상태는 외부 감시로, 오류는 Sentry로 추적하고 학습자 입력은 보내지 않는다

## Context and Problem Statement

배포 때는 헬스체크로 실패를 잡지만(`deploy.sh`, `/health`), 배포 뒤에 서버가 멈추거나 오류가 쌓이면 알 방법이 없었다. 2026-10-22 메모리 부족 장애도 사용자가 알려 주기 전까지 몰랐다. 모바일 앱이 사용자 폰에서 죽거나 멈춘 기록은 아예 남지 않는다.

## Decision Drivers

* 1인 운영이라 설치·관리할 것이 적어야 한다.
* 서버가 통째로 멈춘 경우도 잡아야 하므로 가동 감시는 서버 밖에 있어야 한다.
* 학습자가 쓴 문장과 일기, 이메일 같은 개인정보는 외부 도구로 보내지 않는다.
* 모바일, 백엔드를 한곳에서 본다.

## Considered Options

* 외부 가동 감시(UptimeRobot) + Sentry
* Uptime Kuma, GlitchTip을 운영 서버에 직접 설치
* 서버 로그만 보고 필요할 때 확인

## Decision Outcome

Chosen option: "외부 가동 감시(UptimeRobot) + Sentry", because 무료 요금제로 충분하고 코드 수정이 적다. 직접 설치하면 운영 서버 메모리를 쓰고, 서버가 멈출 때 감시 도구도 같이 멈춘다.

* 가동 감시: `https://api.writeloop.kr/health`(DB·Redis까지 확인)와 `https://writeloop.kr/healthz`를 5분마다 확인한다. 코드 변경은 없고 계정에서 설정한다.
* 백엔드: `sentry-spring-boot-starter-jakarta`와 `sentry-logback`.
  * 처리하지 못한 예외와 ERROR 로그만 보낸다. 사용자 쪽 원인인 4xx는 보내지 않는다(`SentryConfig`).
  * `send-default-pii: false`, `max-request-body-size: none`: 요청 본문, IP, 쿠키, 사용자 정보를 보내지 않는다.
  * 배포 버전(`SENTRY_RELEASE`)은 CI가 커밋 SHA를 이미지에 넣는다.
* 모바일: `@sentry/react-native`.
  * 개발 중이거나 DSN이 없으면 보내지 않는다.
  * 화면 캡처, 화면 녹화(replay), 콘솔 출력, 주소의 쿼리 문자열(소셜 가입 토큰 등)을 보내지 않는다.
  * 스토어 빌드 때 소스맵을 올려 오류 위치를 원래 코드로 본다. 업로드에 실패해도 빌드는 계속한다(`SENTRY_ALLOW_FAILURE`).
* 웹은 아직 붙이지 않는다. 화면 대부분이 정적이고, 오류는 같은 API를 쓰는 백엔드에서 대부분 보인다.

### Consequences

* Good, because 서버가 멈추면 몇 분 안에 알림을 받고, 배포 뒤 처음 생긴 오류를 버전별로 본다.
* Good, because 앱이 사용자 폰에서 죽은 기록을 처음으로 볼 수 있다.
* Bad, because 오류 정보가 미국(Sentry)으로 나간다. 개인정보처리방침에 위탁·국외 이전 항목(5-1)을 넣었고, 스토어의 개인정보 항목(App Store 개인정보 보호, Google Play 데이터 보안)도 고쳐야 한다.
* Bad, because 모바일 JS 번들이 약 1.3MB(Hermes 바이트코드 기준) 커진다. 화면 녹화 코드는 빼서 줄였다.

### Confirmation

* `SentryConfigTest`가 4xx를 거르고 5xx와 예상하지 못한 예외는 보내는지 확인한다.
* 2026-10-23 로컬 확인: 가짜 Sentry 수신 서버로 백엔드를 띄워 4xx 세 건은 보내지 않고 502 한 건만 보냈다. 이벤트에 학습자 답변, 게스트 ID, IP가 없었다.
* 모바일 설정은 `apps/mobile/src/lib/sentry.ts` 한 곳에 둔다.

## More Information

* 계정에서 할 일과 스토어 설정은 README의 "모니터링"에 적었다.
* 웹 오류 추적, 성능 추적은 필요해지면 따로 정한다.
