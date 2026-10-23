# WriteLoop 백엔드 보안 배포 체크리스트

## 이번에 적용한 항목

- 요청 수 제한 `rate limiting`
  - 로그인 API
  - 이메일 인증/비밀번호 재설정 코드 API
  - AI 피드백 API
  - AI 코치 API
- 보안 헤더 기본값
  - `Strict-Transport-Security`
  - `Content-Security-Policy`
  - `X-Content-Type-Options`
  - `X-Frame-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`
- 운영 환경 설정 검증 강화
  - 보안 헤더 비활성화 금지
  - rate limit 비활성화 금지
  - HSTS max-age, CSP 공란 방지

## 현재 기본 제한값

- 로그인: 5분에 10회
- 인증/재설정 코드 관련 요청: 10분에 5회
- 피드백 생성: 1분에 6회
- 코치 도움말: 1분에 20회
- 코치 사용 검사: 1분에 60회

로컬 프로필에서는 개발 편의를 위해 더 느슨한 값으로 완화되어 있습니다.

## 환경 변수

### 보안 헤더

- `APP_SECURITY_HEADERS_ENABLED=true`
- `APP_SECURITY_HEADERS_HSTS_MAX_AGE_SECONDS=31536000`
- `APP_SECURITY_HEADERS_CONTENT_SECURITY_POLICY=default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`
- `APP_SECURITY_HEADERS_REFERRER_POLICY=no-referrer`
- `APP_SECURITY_HEADERS_PERMISSIONS_POLICY=camera=(), microphone=(), geolocation=()`

### Rate limiting

- `APP_SECURITY_RATE_LIMIT_ENABLED=true`
- `APP_SECURITY_RATE_LIMIT_CLEANUP_INTERVAL_MS=600000`
- `APP_SECURITY_RATE_LIMIT_STALE_BUCKET_SECONDS=7200`
- `APP_SECURITY_RATE_LIMIT_AUTH_WINDOW_SECONDS=300`
- `APP_SECURITY_RATE_LIMIT_AUTH_MAX_REQUESTS=10`
- `APP_SECURITY_RATE_LIMIT_EMAIL_WINDOW_SECONDS=600`
- `APP_SECURITY_RATE_LIMIT_EMAIL_MAX_REQUESTS=5`
- `APP_SECURITY_RATE_LIMIT_FEEDBACK_WINDOW_SECONDS=60`
- `APP_SECURITY_RATE_LIMIT_FEEDBACK_MAX_REQUESTS=6`
- `APP_SECURITY_RATE_LIMIT_COACH_HELP_WINDOW_SECONDS=60`
- `APP_SECURITY_RATE_LIMIT_COACH_HELP_MAX_REQUESTS=20`
- `APP_SECURITY_RATE_LIMIT_COACH_USAGE_WINDOW_SECONDS=60`
- `APP_SECURITY_RATE_LIMIT_COACH_USAGE_MAX_REQUESTS=60`

## 배포 전 체크

- `APP_SESSION_COOKIE_SECURE=true` 인지 확인
- `APP_AUTH_TOKEN_SECRET` 가 기본값이 아닌지 확인
- `APP_FRONTEND_BASE_URL` 이 실제 운영용 `https` 주소인지 확인
- `APP_CORS_ALLOWED_ORIGINS` 가 실제 운영 origin 만 포함하는지 확인
- OAuth redirect URI 가 모두 운영 `https` 주소인지 확인
- 앱 redirect prefix 에 `exp://`, `http://`, `https://` 가 섞이지 않았는지 확인
- `APP_SECURITY_HEADERS_ENABLED=true` 인지 확인
- `APP_SECURITY_RATE_LIMIT_ENABLED=true` 인지 확인

## 배포 후 점검

- 응답 헤더에 아래 값이 붙는지 확인
  - `Content-Security-Policy`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: no-referrer`
  - `Permissions-Policy`
- `https` 요청에서만 `Strict-Transport-Security` 가 내려오는지 확인
- 로그인 API 를 짧은 시간에 반복 호출했을 때 `429 Too Many Requests` 가 내려오는지 확인
- 피드백/코치 API 를 과도하게 호출했을 때 `429` 와 `Retry-After` 헤더가 내려오는지 확인
- 정상 사용자 흐름에서 너무 이르게 rate limit 이 걸리지 않는지 확인

## 운영상 주의

- 현재 rate limiter 는 백엔드 인스턴스 메모리 기반입니다.
- 백엔드가 여러 대로 수평 확장되면 인스턴스 간 카운터가 공유되지 않습니다.
- 여러 인스턴스로 확장할 계획이 있으면 Redis 기반 limiter 로 옮기는 것이 다음 단계입니다.
