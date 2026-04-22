# WriteLoop 기술스택 구조도 입력 문서

이 문서는 **WriteLoop 프로젝트의 기술스택과 각 구성 요소의 관계를 구조도로 그릴 수 있도록** 정리한 입력용 문서다.
이미지 생성 LLM이 읽고 아키텍처 다이어그램을 그릴 수 있게, 단순 기술 목록이 아니라 **노드**, **역할**, **연결 관계**, **배치 제안** 중심으로 작성했다.

## 1. 한 줄 요약

WriteLoop는 **웹(Next.js)**, **모바일(Expo + React Native)**, **백엔드(Spring Boot)**, **데이터 저장소(MySQL + Redis)**, **외부 AI(OpenAI / Gemini)**, **외부 인증/메일 서비스(구글/네이버/카카오 OAuth, SMTP)**, **리버스 프록시(Nginx)** 로 구성된 영어 작문 학습 서비스다.

## 2. 구조도에서 가장 크게 봐야 할 계층

구조도는 아래 5개 층으로 나누어 그리면 가장 자연스럽다.

1. **클라이언트 층**
   - 웹 프론트엔드
   - 모바일 앱

2. **애플리케이션/API 층**
   - Spring Boot 백엔드

3. **데이터 층**
   - MySQL
   - Redis

4. **외부 서비스 층**
   - OpenAI
   - Gemini
   - Google OAuth
   - Naver OAuth
   - Kakao OAuth
   - SMTP 메일 서버

5. **인프라/트래픽 진입 층**
   - Nginx
   - Docker Compose

## 3. 전체 시스템 요약

- 사용자는 **웹 브라우저** 또는 **모바일 앱**으로 WriteLoop에 접속한다.
- 웹은 **Next.js 앱**이 UI를 렌더링하고, 백엔드 API와 통신한다.
- 모바일은 **Expo / React Native 앱**이 직접 백엔드 API와 통신한다.
- 백엔드는 작문 질문, 작문 기록, 저장 표현, 계정 정보, 인증, AI 피드백, AI 코치 기능을 담당한다.
- 백엔드는 데이터를 **MySQL**에 저장하고, 임시 상태와 빠른 키-값 저장은 **Redis**를 사용한다.
- AI 피드백과 AI 코치 기능은 **OpenAI** 또는 **Gemini** 중 설정된 provider를 호출한다.
- 소셜 로그인은 **Google / Naver / Kakao OAuth** 와 연동된다.
- 이메일 인증/비밀번호 재설정 메일은 **SMTP 메일 서버**를 통해 발송된다.
- 도커 환경에서는 **Nginx** 가 프론트엔드/백엔드 앞단에서 리버스 프록시 역할을 한다.

## 4. 주요 기술스택 요약

### 4-1. 모노레포 루트

- 저장소 형태: **Monorepo**
- 루트 경로:
  - `apps/frontend`
  - `apps/mobile`
  - `apps/backend`
  - `infra/mysql/schema`
  - `docker-compose.yml`
- 루트 스크립트: `package.json`
- 특징:
  - 웹은 npm workspace 기반으로 관리
  - 모바일은 `npm --prefix apps/mobile ...` 방식으로 별도 실행
  - 백엔드는 Gradle 기반으로 별도 빌드

### 4-2. 웹 프론트엔드

- 위치: `apps/frontend`
- 핵심 기술:
  - **Next.js 15**
  - **React 19**
  - **TypeScript**
  - **CSS Modules**
  - **motion**
  - **canvas-confetti**
- 추가 기술:
  - **Capacitor** 설정이 남아 있어 웹 빌드를 모바일 패키징에 재사용할 수 있는 경로도 존재
- 역할:
  - 메인 학습 UI
  - 질문 선택
  - 답안 작성 및 피드백 표시
  - 작문 기록 조회
  - 저장 표현 조회
  - 계정 설정
  - 관리자 질문 관리 화면
- API 통신 방식:
  - `fetch`
  - `credentials: "include"` 기반
  - 즉, **웹은 쿠키/세션 중심 인증 흐름**

### 4-3. 모바일 앱

- 위치: `apps/mobile`
- 핵심 기술:
  - **Expo 55**
  - **React Native 0.83**
  - **React 19**
  - **TypeScript**
  - **Expo Router**
  - **React Navigation**
- 주요 라이브러리:
  - `expo-router`
  - `expo-secure-store`
  - `expo-web-browser`
  - `expo-linking`
  - `expo-splash-screen`
  - `expo-image`
  - `expo-symbols`
  - `react-native-reanimated`
  - `react-native-gesture-handler`
  - `react-native-safe-area-context`
  - `react-native-screens`
- 역할:
  - iOS / Android 네이티브 학습 앱
  - 작문 루프 전체 수행
  - AI 코치 사용
  - 저장 표현 관리
  - 기록/내정보 화면 제공
- API 통신 방식:
  - `fetch`
  - **Access Token / Refresh Token 기반**
  - 토큰 저장소: `expo-secure-store`
  - API 호출 시 `Authorization: Bearer ...` 헤더 사용
- 모바일 소셜 로그인:
  - `expo-web-browser` + deep link
  - OAuth 시작 후 callback code를 백엔드에 교환 요청

### 4-4. 백엔드 API 서버

- 위치: `apps/backend`
- 핵심 기술:
  - **Java 21**
  - **Spring Boot 3.4.3**
  - **Spring Web**
  - **Spring Data JPA**
  - **Spring Data Redis**
  - **Spring Mail**
  - **Spring Security Core / Crypto**
  - **Lombok**
- 데이터베이스 드라이버:
  - **MySQL Connector/J**
- 빌드 도구:
  - **Gradle Kotlin DSL**
  - 파일: `apps/backend/build.gradle.kts`
- 역할:
  - 인증/회원가입/로그인/소셜 로그인
  - 질문 제공
  - 힌트 제공
  - 피드백 생성
  - AI 코치 응답 생성
  - 작문 기록 저장 및 조회
  - 저장 표현 CRUD
  - 드래프트 저장/조회
  - 관리자 질문 관리
  - 추천 질문 노출/클릭 집계

### 4-5. 데이터 저장소

#### MySQL

- 역할:
  - 사용자 계정
  - 질문(prompt) 메타데이터
  - 질문 힌트와 힌트 아이템
  - 답안 세션 및 시도 기록
  - 저장 표현
  - 이메일 인증 / 비밀번호 재설정 토큰
  - remember login 토큰
  - 피드백 진단 로그
  - 추천 질문 노출 집계용 테이블
- 스키마 마이그레이션 위치:
  - `infra/mysql/schema`
- 특징:
  - 질문/힌트 데이터가 서비스 품질에 직접 연결되는 핵심 저장소

#### Redis

- 역할:
  - 작문 드래프트 임시 저장
  - refresh token 저장
  - 모바일 소셜 로그인 code 교환용 임시 저장
  - rate limiting 카운터 저장
- 특징:
  - 빠른 읽기/쓰기와 TTL 기반 데이터에 사용
  - 일부 기능은 Redis 장애 시 fallback 로직을 두고 있음

## 5. 외부 서비스

### 5-1. AI / LLM

- 연결 대상:
  - **OpenAI**
  - **Gemini**
- 구성 방식:
  - 피드백 provider와 코치 provider를 분리 가능
  - 설정 키:
    - `llm.feedback-provider`
    - `llm.coach-provider`
- 현재 코드 기준 기본 예시:
  - Gemini feedback: `gemini-3-flash-preview`
  - Gemini coach: `gemini-3.1-flash-lite-preview`
  - OpenAI feedback: `gpt-5-mini`
  - OpenAI coach: `gpt-5-mini`
- 역할:
  - 피드백 JSON 생성
  - AI 코치 질문 응답 생성
  - 추천 표현/표현 태그/코칭 문장 생성

### 5-2. OAuth 제공자

- **Google**
- **Naver**
- **Kakao**

역할:

- 웹 소셜 로그인
- 모바일 소셜 로그인
- 모바일에서는 외부 인증 후 백엔드가 교환용 코드를 발급하고 앱이 다시 token exchange 수행

### 5-3. 메일 서버

- 방식: **SMTP**
- 역할:
  - 이메일 인증 코드 발송
  - 비밀번호 재설정 코드 발송

## 6. 인프라 / 배포 구성

### 6-1. Docker Compose

`docker-compose.yml` 기준 주요 서비스:

- `writeloop-nginx`
- `writeloop-frontend`
- `writeloop-backend`
- `writeloop-redis`

### 6-2. Nginx

- 역할:
  - 외부 진입점
  - 리버스 프록시
  - 프론트엔드와 백엔드 라우팅 분기
  - 운영 시 TLS 인증서 경로 연결

### 6-3. 운영/로컬 차이

- 로컬:
  - 주로 `localtest.me` 기반 도메인 사용
  - Docker + Nginx + 백엔드/프론트엔드/Redis 조합
- 운영:
  - 실제 도메인 기반
  - 프론트엔드/백엔드 URL 분리
  - MySQL은 도커 외부에서 운영될 수 있음

## 7. 핵심 노드 정의

아래 표는 구조도에서 박스로 그려야 할 대표 노드다.

| 노드 ID | 박스 이름 | 계층 | 핵심 스택 | 역할 |
|---|---|---|---|---|
| N1 | 사용자 브라우저 | 클라이언트 | Browser | 웹 서비스 사용 |
| N2 | 사용자 모바일 앱 | 클라이언트 | Expo, React Native, Expo Router | iOS/Android 앱 사용 |
| N3 | 웹 프론트엔드 | 프론트엔드 | Next.js 15, React 19, TypeScript | 웹 UI 렌더링, 백엔드 API 호출 |
| N4 | 모바일 앱 런타임 | 모바일 | Expo 55, React Native 0.83, SecureStore | 모바일 UI, 토큰 보관, API 호출 |
| N5 | Nginx | 인프라 | Nginx | 리버스 프록시, 진입점 |
| N6 | 백엔드 API 서버 | 서버 | Spring Boot 3.4, Java 21 | 인증, 질문, 기록, AI, 저장 표현 API |
| N7 | MySQL | 데이터 | MySQL | 영속 데이터 저장 |
| N8 | Redis | 데이터 | Redis | 임시 저장, 토큰, rate limit, draft |
| N9 | OpenAI | 외부 AI | Responses API | 피드백/코치 생성 |
| N10 | Gemini | 외부 AI | Gemini API | 피드백/코치 생성 |
| N11 | Google OAuth | 외부 인증 | OAuth 2.0 | 구글 로그인 |
| N12 | Naver OAuth | 외부 인증 | OAuth 2.0 | 네이버 로그인 |
| N13 | Kakao OAuth | 외부 인증 | OAuth 2.0 | 카카오 로그인 |
| N14 | SMTP 메일 서버 | 외부 메일 | SMTP | 인증 메일/비밀번호 재설정 메일 발송 |
| N15 | 관리자 화면 | 웹 내부 기능 | Next.js admin page | 질문/힌트/추천 성과 관리 |

## 8. 연결 관계 정의

구조도에서는 아래 방향으로 화살표를 그리면 된다.

| From | To | 관계 설명 |
|---|---|---|
| 사용자 브라우저 | 웹 프론트엔드 | 브라우저가 Next.js UI를 사용 |
| 사용자 모바일 앱 | 모바일 앱 런타임 | 사용자가 Expo/React Native 앱 UI를 사용 |
| 웹 프론트엔드 | Nginx | 웹 요청이 프록시로 진입 |
| 모바일 앱 런타임 | 백엔드 API 서버 | 모바일이 직접 API 호출 |
| Nginx | 웹 프론트엔드 | 정적/SSR 웹 트래픽 전달 |
| Nginx | 백엔드 API 서버 | `/api/*` 요청 전달 |
| 웹 프론트엔드 | 백엔드 API 서버 | 질문, 피드백, 인증, 기록 API 호출 |
| 관리자 화면 | 백엔드 API 서버 | 관리자용 질문/힌트/추천 메트릭 API 호출 |
| 백엔드 API 서버 | MySQL | 사용자, 질문, 기록, 저장 표현, 토큰, 로그 저장 |
| 백엔드 API 서버 | Redis | draft, refresh token, mobile social auth code, rate limit 저장 |
| 백엔드 API 서버 | OpenAI | 피드백/코치 생성 요청 |
| 백엔드 API 서버 | Gemini | 피드백/코치 생성 요청 |
| 백엔드 API 서버 | Google OAuth | 구글 로그인 인증 흐름 |
| 백엔드 API 서버 | Naver OAuth | 네이버 로그인 인증 흐름 |
| 백엔드 API 서버 | Kakao OAuth | 카카오 로그인 인증 흐름 |
| 백엔드 API 서버 | SMTP 메일 서버 | 인증 메일 / 비밀번호 재설정 메일 발송 |
| 모바일 앱 런타임 | Google OAuth / Naver OAuth / Kakao OAuth | 모바일 웹브라우저 기반 인증 시작 |
| 모바일 앱 런타임 | 백엔드 API 서버 | 소셜 로그인 교환 코드(token/social/exchange) 요청 |

## 9. 핵심 기능별 데이터 흐름

### 9-1. 질문 조회 흐름

1. 웹 또는 모바일이 질문 조회 요청
2. 백엔드 `PromptController` 가 처리
3. 백엔드가 MySQL의 prompt / hint 관련 데이터를 조회
4. 클라이언트가 질문, 힌트, 추천 질문을 렌더링

### 9-2. 피드백 생성 흐름

1. 사용자가 답안을 제출
2. 웹/모바일이 `/api/feedback` 호출
3. 백엔드 `FeedbackController` -> `FeedbackService`
4. `llm.feedback-provider` 설정에 따라 OpenAI 또는 Gemini 호출
5. LLM이 구조화된 JSON 형태의 피드백 결과 반환
6. 백엔드가 보정/검증 후 응답
7. 클라이언트가 교정, 표현 더하기, 모델 답안, 다시쓰기 UI를 표시
8. 결과는 답안 기록/세션과 함께 MySQL에 저장 가능

### 9-3. AI 코치 흐름

1. 사용자가 "표현 뜻", "첫 문장", "답변 아이디어" 같은 질문 입력
2. 웹/모바일이 `/api/coach/help` 호출
3. 백엔드 `CoachController` -> provider client 호출
4. OpenAI 또는 Gemini가 코치 답변과 표현 후보를 생성
5. 백엔드가 표현 목록, 예문, 태그 등을 구조화해 반환
6. 사용자는 표현을 저장하거나 실제 답안에 반영

### 9-4. 저장 표현 흐름

1. 사용자가 "내가 쓴 표현", "표현 더하기", "AI 코치 추천 표현"을 저장
2. 클라이언트가 `/api/saved-expressions` POST 호출
3. 백엔드 `SavedExpressionController` -> `SavedExpressionService`
4. MySQL `saved_expressions` 계열 데이터에 저장
5. 이후 기록 화면에서 검색, 태그 필터, 다시 써보기 기능으로 활용

### 9-5. 인증 흐름

#### 웹 인증

1. 웹 프론트엔드가 로그인/회원가입 API 호출
2. 백엔드가 인증 처리 후 세션/쿠키 기반 상태 유지
3. 웹 API 호출 시 `credentials: include` 사용

#### 모바일 인증

1. 모바일 앱이 로그인 API 호출
2. 백엔드가 access token / refresh token 발급
3. 모바일은 `expo-secure-store` 에 저장
4. 이후 API 호출 시 `Authorization: Bearer ...` 사용
5. 만료 시 `/api/auth/token/refresh` 로 갱신

#### 소셜 로그인

1. 웹 또는 모바일이 OAuth 시작
2. OAuth 제공자가 백엔드 callback 으로 응답
3. 모바일은 deep link 기반 code 교환 단계를 한 번 더 수행
4. 최종적으로 백엔드가 사용자 인증 상태를 생성

### 9-6. 드래프트 저장 흐름

1. 사용자가 답변 작성 중 임시 저장
2. `/api/drafts/{promptId}` 호출
3. 백엔드 `DraftService` 가 Redis에 저장
4. TTL 만료 전까지 재접속 시 복구 가능

### 9-7. 요청 제한(rate limit) 흐름

1. 클라이언트가 인증/메일/피드백/코치 API 호출
2. 백엔드 `RequestRateLimitFilter` 가 진입점에서 검사
3. `RequestRateLimiter` 가 Redis 기반 카운터 사용
4. Redis 불가 시 일부 메모리 fallback 동작

## 10. 구조도 배치 제안

이미지 생성 LLM이 그릴 때는 아래 배치를 추천한다.

### 배치안 A: 상하형

- 맨 위: 사용자 브라우저 / 사용자 모바일 앱
- 그 아래: 웹 프론트엔드 / 모바일 앱 런타임
- 그 아래 중앙: Nginx / 백엔드 API 서버
- 그 아래: MySQL / Redis
- 맨 아래: OpenAI / Gemini / Google OAuth / Naver OAuth / Kakao OAuth / SMTP

### 배치안 B: 좌우 분리형

- 왼쪽: 웹 클라이언트 흐름
  - 사용자 브라우저 -> 웹 프론트엔드
- 오른쪽: 모바일 클라이언트 흐름
  - 사용자 모바일 앱 -> 모바일 앱 런타임
- 중앙: 백엔드 API 서버
- 중앙 하단: MySQL, Redis
- 하단 외곽: OpenAI, Gemini, OAuth 3종, SMTP
- 상단 중앙 또는 앞단: Nginx

## 11. 구조도용 강조 포인트

그림에서 특히 강조해야 할 포인트는 아래와 같다.

1. **웹과 모바일이 같은 백엔드를 공유하지만 인증 방식이 다르다**
   - 웹: 쿠키/세션 기반
   - 모바일: access token / refresh token + SecureStore

2. **AI 기능이 백엔드 안에서 추상화되어 있다**
   - 피드백 provider와 코치 provider를 분리 가능
   - OpenAI와 Gemini가 교체 가능한 외부 AI 노드로 표현되면 좋다

3. **Redis는 보조 저장소가 아니라 실시간 기능에 중요하다**
   - 드래프트 저장
   - refresh token
   - 모바일 소셜 로그인 교환 코드
   - rate limiting

4. **MySQL은 핵심 도메인 데이터의 중심이다**
   - 질문(prompt)
   - 힌트(prompt hints)
   - 답안 기록(answer history)
   - 사용자(users)
   - 저장 표현(saved expressions)

5. **관리자 기능도 별도 하위 박스로 표시할 수 있다**
   - 웹 프론트엔드 안에 "관리자 페이지" 서브박스를 두고
   - 백엔드의 admin prompt API 와 연결

## 12. 구조도 생성용 짧은 설명문

아래 문장은 이미지 생성 LLM에 그대로 넣어도 되는 짧은 설명이다.

> WriteLoop is a monorepo-based English writing coaching service. It has a Next.js web frontend, an Expo React Native mobile app, and a Spring Boot backend API. The backend connects to MySQL for persistent domain data and Redis for drafts, refresh tokens, mobile social auth exchange codes, and rate limiting. The backend integrates with OpenAI and Gemini for feedback and coaching, and also connects to Google, Naver, and Kakao OAuth providers plus an SMTP mail server. Nginx sits in front of frontend and backend in Docker-based environments. The web app uses cookie/session-based auth, while the mobile app uses access token and refresh token auth stored in SecureStore.

## 13. 구조도 생성용 한국어 설명문

> WriteLoop는 모노레포 기반의 영어 작문 코칭 서비스다. 사용자 접점은 Next.js 웹 프론트엔드와 Expo 기반 React Native 모바일 앱으로 나뉘고, 두 클라이언트는 공통의 Spring Boot 백엔드 API를 사용한다. 백엔드는 MySQL에 사용자, 질문, 힌트, 답안 기록, 저장 표현 같은 핵심 데이터를 저장하고, Redis에는 드래프트, refresh token, 모바일 소셜 로그인 교환 코드, rate limit 카운터를 저장한다. AI 피드백과 AI 코치는 OpenAI 또는 Gemini를 호출해 생성하며, 로그인은 Google, Naver, Kakao OAuth와 연동된다. 이메일 인증과 비밀번호 재설정은 SMTP 메일 서버를 통해 처리된다. Docker 환경에서는 Nginx가 프론트엔드와 백엔드 앞단에서 리버스 프록시 역할을 한다. 웹은 쿠키/세션 기반 인증을 사용하고, 모바일은 SecureStore에 저장된 access token / refresh token 기반 인증을 사용한다.

## 14. 코드 기준 출처

- 루트 구성: `package.json`, `docker-compose.yml`, `README.md`
- 웹 스택: `apps/frontend/package.json`, `apps/frontend/lib/api.ts`
- 모바일 스택: `apps/mobile/package.json`, `apps/mobile/src/lib/api.ts`
- 백엔드 스택: `apps/backend/build.gradle.kts`, `apps/backend/src/main/resources/application.yml`
- API 구조: `apps/backend/src/main/java/com/writeloop/controller/*`
- DB 스키마 히스토리: `infra/mysql/schema/*`

