# 라이트루프 (WriteLoop)

라이트루프는 영어 문장을 한 번 쓰고 끝내는 앱이 아니라, **짧게 쓰고 → 피드백을 받고 → 다시 쓰고 → 학습 기록을 남기는 과정**을 반복하도록 돕는 영어 작문 학습 서비스입니다.

이 문서는 라이트루프를 처음 접하는 기획자, 디자이너, 개발자가 다음 내용을 한 번에 이해할 수 있도록 작성되었습니다.

- 라이트루프가 어떤 문제를 해결하는지
- 사용자가 어떤 학습 흐름을 경험하는지
- 모바일, 웹, 백엔드, 데이터베이스와 LLM이 어떻게 연결되는지
- 로컬에서 프로젝트를 실행하는 방법
- 환경변수, DB 마이그레이션, 테스트와 배포 시 주의할 점

> 현재 제품의 중심 클라이언트는 Expo 기반 모바일 앱입니다. Next.js 웹 앱도 같은 백엔드 API를 사용하는 별도 클라이언트로 유지되고 있습니다.

## 목차

1. [제품 이해하기](#제품-이해하기)
2. [주요 기능](#주요-기능)
3. [AI 피드백이 만들어지는 과정](#ai-피드백이-만들어지는-과정)
4. [기술 구조](#기술-구조)
5. [저장소 구조](#저장소-구조)
6. [처음 실행하기](#처음-실행하기)
7. [서비스별 개별 실행](#서비스별-개별-실행)
8. [환경변수](#환경변수)
9. [데이터베이스와 마이그레이션](#데이터베이스와-마이그레이션)
10. [테스트와 품질 검증](#테스트와-품질-검증)
11. [주요 API](#주요-api)
12. [개발할 때 자주 찾는 위치](#개발할-때-자주-찾는-위치)
13. [문제 해결](#문제-해결)
14. [배포 전 확인사항](#배포-전-확인사항)
15. [추가 문서](#추가-문서)

## 제품 이해하기

영어 작문을 공부할 때 학습자는 보통 다음 세 지점에서 막힙니다.

- 무엇을 써야 할지 떠오르지 않는다.
- 문법은 맞는 것 같지만 질문에 충분히 답했는지 알기 어렵다.
- 피드백을 읽어도 다음 문장을 실제로 어떻게 고쳐야 할지 모르겠다.

라이트루프는 이를 하나의 학습 루프로 해결합니다.

```text
질문 또는 상황 선택
    ↓
영어 답변 작성
    ↓
AI가 주제·문장 형태·문법·내용 슬롯을 진단
    ↓
지금 가장 중요한 피드백을 화면에 표시
    ↓
학습자가 다시 작성
    ↓
완료된 답변과 실제로 노출된 피드백을 기록
```

여기서 **슬롯(slot)**은 질문에 답하기 위해 필요한 의미 단위입니다. 예를 들어 “셀프 계산대의 장점과 단점은 무엇인가요?”라는 질문은 `ADVANTAGE`와 `DISADVANTAGE` 슬롯을 요구합니다. 학습자가 장점만 썼다면 라이트루프는 단순히 문법을 고치는 데 그치지 않고, 빠진 단점을 다음 학습 미션으로 제안합니다.

## 주요 기능

### 지금 영어로

그 순간 떠오른 생각을 짧은 영어 문장으로 남기는 연습입니다.

- 부담 없이 한 문장부터 작성
- 원하는 시간에 연습 알림 설정
- 작성 기록 동기화
- 하루 표현을 돌아보는 리플렉션
- 문장을 확장하거나 다듬는 AI 코치 피드백

### 질문 답변

질문에 맞는 영어 답변을 만들고 여러 차례 고쳐 쓰는 핵심 학습 흐름입니다.

- 오늘의 추천 질문
- 난이도 `I(입문)`, `A(쉬움)`, `B(보통)`, `C(도전)`
- 질문 해석, 단어와 표현 힌트
- 질문별 필수 슬롯과 깊이 슬롯 진단
- 문장 구조와 문법 교정
- 빠진 내용을 채우기 위한 문장 골격과 추천 표현
- 완료 시 모범답안과 누적 피드백 확인

### 영어일기

하루의 경험을 자유롭게 작성하고 글 전체 관점의 피드백을 받습니다.

- 일기 작성과 임시 저장
- 날짜별 기록과 달력 조회
- 문법, 흐름, 표현에 대한 AI 피드백
- 수정한 일기 저장과 다시 보기

### 학습 기록과 보조 기능

- 답변 시도와 차수별 피드백 타임라인
- 월별 작성 현황과 연속 학습 기록
- 저장한 영어 표현
- 자주 발생한 실수
- 이메일 및 소셜 로그인
- 앱 업데이트 안내
- 앱 안에서 의견과 오류 제보 전송
- 홈 화면 기능 소개 튜토리얼

## AI 피드백이 만들어지는 과정

라이트루프의 피드백은 LLM 응답을 그대로 화면에 보여주는 구조가 아닙니다.

### 1. 질문 메타데이터를 읽습니다

백엔드는 원래 질문과 함께 다음 정보를 읽습니다.

- 답변 유형과 예상 시제·시점
- 필수 슬롯과 선택·깊이 슬롯
- 질문별 슬롯의 의미 역할
- 슬롯이 충족됐다고 볼 수 있는 기준
- 최소 깊이 슬롯 수

### 2. LLM이 답변을 구조화해 진단합니다

선택된 LLM 제공자는 원래 질문과 학습자 답변을 함께 보고 다음 축을 진단합니다.

- 질문 주제와 관련 있는가
- 완전한 문장인가, 문장 조각인가
- 의미 전달을 막는 문법 오류가 있는가
- 각 슬롯을 어떤 원문 증거가 충족하는가
- 충족되지 않았거나 막연한 슬롯은 무엇인가
- 어떤 문장 교정과 보강 표현이 필요한가

### 3. 백엔드가 계약을 검증합니다

LLM 출력은 정해진 JSON 계약을 통과해야 합니다.

- 슬롯 증거가 학습자 원문의 정확한 부분 문자열인지 확인
- 문법 교정 전·후 문자열이 실제 답변과 연결되는지 확인
- 슬롯 상태와 evidence/support 조합이 모순되지 않는지 확인
- 교정된 전체 답변과 개별 교정 항목이 일치하는지 확인
- 계약 오류를 제한적으로 복원하고, 필요한 경우 오류 사유와 함께 한 번 재요청

### 4. 서버가 이번 차수의 미션을 결정합니다

현재의 큰 우선순위는 다음과 같습니다.

```text
주제 이탈
→ 문장 구조 문제
→ 의미 전달을 막는 언어 오류
→ 누락된 필수 내용
→ 가벼운 언어 오류
→ 선택·깊이 내용
→ 완료
```

사용자에게는 이 순서에 따라 지금 가장 먼저 해결할 미션과 관련 피드백이 표시됩니다. 문법 교정이 여러 개라면 한 차수에서 함께 보여줄 수 있으며, 화면은 일부를 먼저 보여주고 나머지를 접고 펼치는 방식으로 제공합니다.

### 5. 실제 노출 결과를 저장합니다

화면에 보여준 피드백 스냅샷을 답변 차수와 함께 저장합니다. 따라서 기록 화면에서도 당시 사용자가 실제로 본 피드백을 다시 확인할 수 있습니다.

AI 요청의 성공·실패, 계약 재시도, 제공자 재시도, 입력·출력 토큰, 처리시간은 `feedback_diagnosis_logs`에서 관측합니다.

## 기술 구조

```text
┌─────────────────────────────────────────────────────┐
│ 클라이언트                                           │
│ Expo / React Native 모바일 앱 · Next.js 웹 앱       │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS / JSON
┌──────────────────────▼──────────────────────────────┐
│ Nginx                                                │
│ 웹·API 라우팅, TLS 종료, 타임아웃                    │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│ Spring Boot 3 / Java 21                             │
│ 인증, 질문, 피드백, 일기, 기록, 관리자 API          │
├──────────────────────┬──────────────────────────────┤
│ MySQL 8             │ Redis 7                      │
│ 영속 데이터          │ 요청 제한과 단기 상태        │
└──────────────────────┴──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│ LLM 제공자                                           │
│ Gemini 또는 OpenAI, 환경변수로 기능별 선택           │
└─────────────────────────────────────────────────────┘
```

| 영역 | 기술 | 역할 |
|---|---|---|
| 모바일 | Expo SDK 55, React Native 0.83, React 19, Expo Router | iOS·Android 사용자 앱 |
| 웹 | Next.js 15, React 19, TypeScript | 웹 클라이언트와 관리자 화면 |
| 백엔드 | Java 21, Spring Boot 3.4, Spring Data JPA | REST API와 도메인 정책 |
| 데이터 | MySQL 8 | 사용자, 질문, 답변, 피드백, 일기 영속화 |
| 단기 상태 | Redis 7 | 분산 요청 제한과 임시 상태 |
| AI | Gemini API, OpenAI Responses API | 작문·일기·코치 피드백 |
| 인프라 | Docker Compose, Nginx, EAS | 로컬 통합 실행, 프록시, 모바일 빌드·제출 |

라이트루프는 현재 LangChain이나 별도 RAG 프레임워크를 사용하지 않습니다. 백엔드의 전용 LLM 클라이언트가 구조화 출력 계약과 검증 정책을 직접 관리합니다.

## 저장소 구조

```text
WriteLoop/
├─ apps/
│  ├─ backend/                 # Spring Boot REST API
│  │  ├─ src/main/java/com/writeloop/
│  │  │  ├─ config/            # 보안, CORS, 시드, 필터 설정
│  │  │  ├─ controller/        # HTTP API 진입점
│  │  │  ├─ dto/               # API 및 LLM 계약 DTO
│  │  │  ├─ persistence/       # JPA Entity와 Repository
│  │  │  └─ service/           # 도메인·피드백·인증 로직
│  │  └─ src/test/             # 백엔드 단위·통합 테스트
│  ├─ mobile/                  # Expo / React Native 앱
│  │  ├─ src/app/              # Expo Router 화면
│  │  ├─ src/components/       # 공통 UI 컴포넌트
│  │  ├─ src/lib/              # API, 타입, 세션, 상태 유틸리티
│  │  └─ assets/               # 아이콘, 폰트, 이미지
│  └─ frontend/                # Next.js 웹 앱
├─ infra/
│  ├─ mysql/schema/            # 번호순 SQL 스키마·데이터 마이그레이션
│  └─ nginx/                   # 개발·운영 Nginx 설정
├─ scripts/
│  ├─ feedback-quality/        # LLM 회귀 테스트 케이스와 판정 규칙
│  ├─ prompt-metadata-review/  # 질문 메타데이터 검토 도구
│  └─ test-*.ps1               # MySQL 마이그레이션 검증
├─ docs/                       # 설계, 실험, 품질 보고서
├─ docker-compose.yml
├─ package.json                # 루트와 웹 명령
└─ README.md
```

`artifacts/`, `.codex_logs/`, `reports/`, `test-results/`는 실행 중 생성되는 결과물입니다. 애플리케이션 소스와 혼동하거나 무심코 커밋하지 않도록 주의합니다.

## 처음 실행하기

### 준비물

| 도구 | 권장 버전 또는 용도 |
|---|---|
| Git | 저장소 내려받기 |
| Node.js | 20 LTS 이상 권장 |
| npm | Node.js에 포함된 버전 |
| Java JDK | 21 |
| MySQL | 8.x |
| Docker Desktop | Redis, 백엔드, 웹, Nginx 통합 실행 |
| Android Studio | Android 에뮬레이터와 SDK |
| Xcode | iOS 개발 시 필요, macOS 전용 |

### 1. 저장소를 내려받습니다

```powershell
git clone https://github.com/gyugyu1/writeLoop.git
Set-Location WriteLoop
```

### 2. 환경변수 파일을 준비합니다

```powershell
Copy-Item .env.dev.example .env
```

`.env`에서 최소한 다음 값을 자신의 환경에 맞게 수정합니다.

```dotenv
SPRING_DATASOURCE_URL=jdbc:mysql://host.docker.internal:3306/writeloop?useSSL=false&allowPublicKeyRetrieval=true&connectionTimeZone=Asia/Seoul&forceConnectionTimeZoneToSession=true
SPRING_DATASOURCE_USERNAME=writeloop_user
SPRING_DATASOURCE_PASSWORD=로컬_DB_비밀번호

LLM_FEEDBACK_PROVIDER=gemini
LLM_COACH_PROVIDER=gemini
GEMINI_API_KEY=발급받은_API_키
```

OpenAI를 사용하려면 제공자와 키를 바꿉니다.

```dotenv
LLM_FEEDBACK_PROVIDER=openai
LLM_COACH_PROVIDER=openai
OPENAI_API_KEY=발급받은_API_키
```

별도의 일기 제공자를 지정하지 않으면 일기 피드백도 `LLM_FEEDBACK_PROVIDER` 값을 상속합니다.

API 키가 없어도 서버의 일부 기능은 실행할 수 있지만, 선택한 제공자가 필요한 AI 피드백은 사용할 수 없거나 제한된 로컬 대체 응답으로 동작할 수 있습니다.

### 3. 로컬 MySQL을 준비합니다

Docker Compose에는 MySQL이 포함되어 있지 않습니다. MySQL 8을 별도로 실행한 뒤 개발용 DB와 사용자를 만듭니다.

```sql
CREATE DATABASE IF NOT EXISTS writeloop
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'writeloop_user'@'%'
  IDENTIFIED BY '로컬_DB_비밀번호';

GRANT ALL PRIVILEGES ON writeloop.* TO 'writeloop_user'@'%';
FLUSH PRIVILEGES;
```

`'%'` 호스트 권한은 Docker 컨테이너에서 호스트 MySQL로 접속하기 위한 **로컬 개발 예시**입니다. 운영 DB에서는 실제 애플리케이션 호스트만 허용해야 합니다.

새 DB에는 `infra/mysql/schema`의 SQL을 파일명 순서대로 적용합니다. MySQL CLI가 설치된 PowerShell 예시는 다음과 같습니다.

```powershell
$env:MYSQL_PWD = "로컬_DB_비밀번호"
Get-ChildItem .\infra\mysql\schema\*.sql |
  Sort-Object Name |
  ForEach-Object { Get-Content -Raw -Encoding UTF8 $_.FullName } |
  mysql --default-character-set=utf8mb4 -h 127.0.0.1 -u writeloop_user writeloop
Remove-Item Env:MYSQL_PWD
```

이 명령은 **비어 있는 로컬 DB를 처음 구성할 때** 사용합니다. 이미 데이터가 있는 DB에는 적용되지 않은 번호의 SQL만 백업 후 반영해야 합니다.

### 4. Docker 통합 환경을 실행합니다

Docker Desktop을 먼저 실행한 뒤 다음 명령을 사용합니다.

```powershell
docker compose up -d --build
docker compose ps
```

기본 개발 주소는 다음과 같습니다.

| 대상 | 주소 |
|---|---|
| 웹 앱 | `http://writeloop.localtest.me` |
| 백엔드 API | `http://api.localtest.me` |
| 헬스 체크 | `http://api.localtest.me/health` |

정상 응답 예시입니다.

```json
{
  "status": "ok",
  "service": "english-learning-backend",
  "timestamp": "2026-08-14T00:00:00Z"
}
```

로그와 종료 명령은 다음과 같습니다.

```powershell
docker compose logs -f writeloop-backend
docker compose down
```

### 5. Android 모바일 앱을 실행합니다

모바일 앱은 루트 npm workspace와 별도의 의존성 파일을 사용합니다.

```powershell
Set-Location apps/mobile
npm install
```

처음 한 번은 Android 에뮬레이터를 켜고 개발용 네이티브 앱을 빌드·설치합니다.

```powershell
npm run android
```

이후 Docker/Nginx 백엔드를 바라보며 실행할 때는 저장소 루트에서 다음 명령을 사용할 수 있습니다.

```powershell
npm run start:android-studio
```

Android 에뮬레이터에서 호스트 PC의 `localhost`는 에뮬레이터 자신을 뜻합니다. 라이트루프는 로컬 Nginx에 접근할 때 `http://10.0.2.2`를 사용하도록 실행 스크립트에서 자동 설정합니다.

## 서비스별 개별 실행

Docker 전체 구성을 사용하지 않고 각 서비스를 따로 실행할 때 참고합니다.

### 백엔드만 실행

MySQL과 Redis를 먼저 실행한 뒤 환경변수를 현재 터미널에 설정합니다.

```powershell
$env:SPRING_PROFILES_ACTIVE = "local"
$env:SPRING_DATASOURCE_URL = "jdbc:mysql://localhost:3306/writeloop?useSSL=false&allowPublicKeyRetrieval=true&connectionTimeZone=Asia/Seoul&forceConnectionTimeZoneToSession=true"
$env:SPRING_DATASOURCE_USERNAME = "writeloop_user"
$env:SPRING_DATASOURCE_PASSWORD = "로컬_DB_비밀번호"
$env:SPRING_DATA_REDIS_HOST = "localhost"
$env:SPRING_DATA_REDIS_PORT = "6379"
$env:GEMINI_API_KEY = "발급받은_API_키"

Set-Location apps/backend
.\gradlew.bat bootRun
```

백엔드는 `http://localhost:8080`에서 실행됩니다.

루트 `.env` 파일은 Docker Compose가 자동으로 읽지만, `gradlew bootRun`은 루트 `.env`를 자동으로 읽지 않습니다. 직접 실행할 때는 IDE 실행 구성 또는 셸 환경변수로 값을 전달해야 합니다.

### 웹 앱만 실행

```powershell
# 저장소 루트에서 실행
npm install
$env:NEXT_PUBLIC_API_BASE_URL = "http://localhost:8080"
npm run dev:frontend
```

기본 주소는 `http://localhost:3000`입니다.

### 모바일 앱의 API 모드

`apps/mobile/scripts/start-with-api-env.js`가 실행 환경에 맞는 API 주소와 ADB 포트 연결을 설정합니다.

| 명령 | API 대상 |
|---|---|
| `npm run start:android-studio` | Android 에뮬레이터 → 로컬 Nginx 80 포트 |
| `npm --prefix apps/mobile run start:android-studio:backend` | Android 에뮬레이터 → 로컬 Spring Boot 8080 포트 |
| `npm --prefix apps/mobile run start:android-device:nginx` | USB Android 기기 → 로컬 Nginx |
| `npm --prefix apps/mobile run start:android-studio:prod` | 개발 앱 → 운영 API |
| `npm run mobile:rn:web` | Expo 웹 실행 |

운영 API를 바라보는 명령은 실제 운영 데이터에 영향을 줄 수 있으므로 테스트 계정과 요청 내용을 반드시 확인합니다.

## 환경변수

전체 예시는 다음 파일이 권위값입니다.

- 로컬 Docker: `.env.dev.example`
- 운영 Docker: `.env.prod.example`
- 모바일 로컬: `apps/mobile/.env.example`
- 모바일 운영: `apps/mobile/.env.production.example`
- 백엔드 기본값: `apps/backend/src/main/resources/application.yml`

### 데이터와 서버

| 변수 | 설명 |
|---|---|
| `SPRING_PROFILES_ACTIVE` | 로컬에서는 `local`, 운영에서는 운영 정책에 맞는 프로필 |
| `SPRING_DATASOURCE_URL` | MySQL JDBC 주소 |
| `SPRING_DATASOURCE_USERNAME` | DB 사용자 |
| `SPRING_DATASOURCE_PASSWORD` | DB 비밀번호 |
| `SPRING_DATA_REDIS_HOST` | Redis 호스트 |
| `SPRING_DATA_REDIS_PORT` | Redis 포트, 기본 `6379` |
| `APP_CORS_ALLOWED_ORIGINS` | 브라우저 요청을 허용할 출처 목록 |
| `APP_FRONTEND_BASE_URL` | 인증 완료 후 돌아갈 웹 주소 |
| `APP_AUTH_TOKEN_SECRET` | 액세스·리프레시 토큰 서명 비밀값 |

### AI 제공자

| 변수 | 설명 |
|---|---|
| `LLM_FEEDBACK_PROVIDER` | 질문 답변 피드백 제공자, `gemini` 또는 `openai` |
| `LLM_DIARY_FEEDBACK_PROVIDER` | 영어일기 피드백 제공자 |
| `LLM_COACH_PROVIDER` | AI 코치 제공자 |
| `GEMINI_API_KEY` | Gemini API 키 |
| `GEMINI_FEEDBACK_MODEL` | 질문 답변 피드백 모델 |
| `GEMINI_DIARY_MODEL` | 일기 피드백 모델 |
| `GEMINI_COACH_MODEL` | 코치 모델 |
| `OPENAI_API_KEY` | OpenAI API 키 |
| `OPENAI_FEEDBACK_MODEL` | 질문 답변 피드백 모델 |
| `OPENAI_DIARY_MODEL` | 일기 피드백 모델 |
| `OPENAI_COACH_MODEL` | 코치 모델 |
| `*_REQUEST_TIMEOUT_SECONDS` | 기능별 LLM 요청 제한시간 |

모델 이름과 추론 설정은 배포 환경변수로 바뀔 수 있습니다. 특정 모델이 운영에 사용된다고 코드 기본값만 보고 단정하지 말고, 실제 배포 환경을 함께 확인합니다.

### 모바일과 웹

| 변수 | 설명 |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Next.js가 호출할 API 주소 |
| `EXPO_PUBLIC_API_BASE_URL` | Expo 공통 API 주소 |
| `EXPO_PUBLIC_API_BASE_URL_ANDROID` | Android 전용 API 주소 |
| `EXPO_PUBLIC_API_BASE_URL_IOS` | iOS 전용 API 주소 |

### 선택 기능

메일 발송과 Google·Kakao·Naver·Apple 로그인은 관련 환경변수가 있을 때 활성화됩니다. 로컬에서 해당 기능을 사용하지 않는다면 값을 비워 둘 수 있습니다.

운영 비밀값은 `.env`, `eas.json`, 소스 코드 또는 문서에 직접 넣지 않습니다. 저장소의 `.gitignore`는 `.env*`를 제외하며 예제 파일만 추적합니다.

## 데이터베이스와 마이그레이션

### 기본 원칙

- SQL 파일은 `infra/mysql/schema`에 `001-...sql` 형식으로 추가합니다.
- 번호는 기존 마지막 번호 다음을 사용합니다.
- 운영 반영 전 DB 백업을 확보합니다.
- 가능하면 재실행해도 결과가 같은 멱등 마이그레이션으로 작성합니다.
- 스키마 변경과 이를 사용하는 백엔드는 배포 순서를 함께 검토합니다.
- MySQL 세션 시간대는 `+09:00`, 애플리케이션 시간대는 `Asia/Seoul`을 사용합니다.

### JPA와 SQL의 관계

개발 설정에는 `spring.jpa.hibernate.ddl-auto=update`가 있지만, 이것만으로 질문 데이터, 슬롯 계약, 운영 보정 이력을 완전하게 만들 수는 없습니다. **정식 스키마와 데이터 변경의 권위값은 번호가 붙은 SQL 파일**입니다.

백엔드 시작 시 `PromptSeedConfig`가 기본 카탈로그와 일부 시드 질문을 보정하지만, 전체 활성 질문과 수동 검토 메타데이터는 SQL 마이그레이션에 의존합니다.

### 기존 DB에 반영할 때

예를 들어 운영 DB가 `099`까지 반영되어 있다면 `100`, `101`, `102`만 순서대로 적용합니다. 이미 데이터가 있는 DB에 전체 SQL을 처음부터 다시 실행하지 않습니다.

현재 적용 상태는 배포 이력과 실제 테이블·컬럼을 함께 확인해야 합니다. 일부 오래된 마이그레이션은 별도의 마이그레이션 이력 테이블이 없으므로 파일 번호만으로 자동 판정되지 않습니다.

## 테스트와 품질 검증

### 백엔드 테스트

```powershell
Set-Location apps/backend
.\gradlew.bat test
```

### 모바일 정적 검사

```powershell
Set-Location apps/mobile
npm run lint
npm run typecheck
```

### 웹 검사와 빌드

```powershell
# 저장소 루트에서 실행
npm run lint:frontend
npm run build:frontend
```

### DB 마이그레이션 검사

다음 PowerShell 스크립트는 Docker의 MySQL 8 컨테이너를 사용합니다. Docker Desktop이 실행 중이어야 합니다.

```powershell
.\scripts\test-prompt-slot-migration.ps1
.\scripts\test-manual-prompt-metadata-migration.ps1
.\scripts\test-feedback-canonical-migrations.ps1
.\scripts\test-korea-database-time-migration.ps1
```

### LLM 피드백 회귀 테스트

테스트 케이스 문법만 확인하면 외부 API를 호출하지 않습니다.

```powershell
npm run feedback:quality -- --suite smoke --dry-run
```

실제 실행 중인 로컬 백엔드에 smoke suite를 보냅니다.

```powershell
npm run feedback:quality -- --suite smoke --base-url http://localhost:8080
```

실제 LLM 회귀 테스트는 API 비용과 시간이 발생하며 DB에 진단 로그가 남습니다. 대량 케이스를 실행하기 전에 다음을 확인합니다.

- 올바른 API 환경인지
- 테스트용 사용자 또는 guest ID를 사용하는지
- 동시 실행 수와 요청 제한이 적절한지
- 선택한 모델과 추론 레벨이 맞는지
- 결과 보고서 저장 위치가 맞는지

회귀 테스트 케이스는 `scripts/feedback-quality`, 실행 보고서는 기본적으로 `reports/feedback-quality`에 생성됩니다.

## 주요 API

| 영역 | 대표 API | 역할 |
|---|---|---|
| 상태 | `GET /health` | 백엔드 생존 확인 |
| 질문 | `GET /api/prompts` | 활성 질문 목록 |
| 추천 | `GET /api/prompts/daily/featured` | 오늘의 추천 질문 |
| 피드백 | `POST /api/feedback` | 답변 차수 피드백 생성 |
| 완료 | `POST /api/feedback/{sessionId}/complete` | 학습 루프 완료 |
| 코치 | `POST /api/coach/help` | 작성 아이디어와 표현 도움 |
| 일기 | `/api/diary/entries` | 일기 작성·조회·피드백 |
| 지금 영어로 | `/api/now-in-english/*` | 짧은 기록, 리플렉션, 코치 피드백 |
| 기록 | `/api/history/*` | 답변 기록과 학습 현황 |
| 인증 | `/api/auth/*` | 회원가입, 로그인, 토큰, 소셜 인증 |
| 표현 | `/api/saved-expressions` | 저장 표현 관리 |
| 의견 | `POST /api/user-feedback` | 사용자 의견과 오류 제보 |
| 관리자 | `/api/admin/*` | 질문, 앱 버전, 평가 관리 |

상세 요청·응답 계약은 `apps/backend/src/main/java/com/writeloop/controller`, `dto`와 각 클라이언트의 `lib/api.ts`, `lib/types.ts`를 함께 확인하는 것이 가장 정확합니다.

## 개발할 때 자주 찾는 위치

| 변경하려는 것 | 먼저 볼 위치 |
|---|---|
| 모바일 화면 | `apps/mobile/src/app` |
| 모바일 공통 UI | `apps/mobile/src/components` |
| 모바일 API와 타입 | `apps/mobile/src/lib/api.ts`, `apps/mobile/src/lib/types.ts` |
| 웹 화면 | `apps/frontend/app`, `apps/frontend/components` |
| 웹 API와 타입 | `apps/frontend/lib/api.ts`, `apps/frontend/lib/types.ts` |
| REST 엔드포인트 | `apps/backend/src/main/java/com/writeloop/controller` |
| 피드백 우선순위와 저장 | `FeedbackService.java` |
| OpenAI 계약과 프롬프트 | `OpenAiFeedbackClient.java` |
| Gemini 계약과 프롬프트 | `GeminiFeedbackClient.java` |
| canonical 출력 검증 | `CanonicalFeedbackContract.java` |
| 질문 슬롯 메타데이터 | `PromptTaskMetaSupport.java`, `infra/mysql/schema` |
| 일기 피드백 | `DiaryService.java`, LLM diary client·engine 파일 |
| 지금 영어로 | `NowInEnglishController.java`, 관련 service/client 파일 |
| 인증과 토큰 | `AuthController.java`, `AuthService.java`, token service 파일 |
| DB 엔티티 | `apps/backend/src/main/java/com/writeloop/persistence` |
| Nginx | `infra/nginx` |

새 기능을 만들 때는 모바일 화면만 수정하지 말고 다음 연결을 함께 확인합니다.

```text
클라이언트 타입
↔ API 요청·응답 DTO
↔ Service 정책
↔ Entity/SQL
↔ 기록 화면과 회귀 테스트
```

## 문제 해결

### Docker가 시작되지 않습니다

```powershell
docker version
docker compose ps
```

`dockerDesktopLinuxEngine` 파이프를 찾을 수 없다는 메시지가 나오면 Docker Desktop 엔진이 아직 실행되지 않은 상태입니다.

### 백엔드는 켜졌지만 DB 연결에 실패합니다

- MySQL 8이 실행 중인지 확인합니다.
- Docker에서 호스트 MySQL에 접근할 때 JDBC 호스트가 `host.docker.internal`인지 확인합니다.
- MySQL 사용자가 컨테이너 접속을 허용하는지 확인합니다.
- `.env`의 사용자명과 비밀번호가 실제 DB와 같은지 확인합니다.
- `docker compose logs -f writeloop-backend`에서 최초 원인을 확인합니다.

### Android 에뮬레이터가 API에 연결되지 않습니다

- 에뮬레이터에서 PC의 로컬 주소는 `10.0.2.2`입니다.
- Docker/Nginx 사용 시 `npm run start:android-studio`를 사용합니다.
- 백엔드 직접 실행 시 `npm --prefix apps/mobile run start:android-studio:backend`를 사용합니다.
- 이전 번들 캐시가 남았다면 `npm run mobile:rn:start:android-studio:clear`를 사용합니다.

### 모바일 앱이 검은 화면에서 멈춥니다

- Metro 터미널의 JavaScript 오류를 먼저 확인합니다.
- `adb logcat`에서 네이티브 크래시를 확인합니다.
- 백엔드와 앱 업데이트 확인 API가 응답하는지 확인합니다.
- 개발 클라이언트와 Expo SDK 네이티브 모듈 버전이 맞지 않으면 `npm run android`로 다시 빌드합니다.

### 피드백을 생성할 수 없다고 표시됩니다

- 선택한 LLM 제공자와 API 키가 맞는지 확인합니다.
- 기능별 모델 이름이 실제 계정에서 사용 가능한지 확인합니다.
- Nginx, 백엔드, LLM 요청 제한시간이 서로 맞는지 확인합니다.
- `feedback_diagnosis_logs`에서 `success`, 오류 단계, 계약 오류 사유, 제공자 재시도, 토큰과 처리시간을 확인합니다.
- 같은 답변을 무작정 반복 호출하기 전에 실패 원문 계약과 백엔드 검증 사유를 비교합니다.

### `api.localtest.me`가 열리지 않습니다

`localtest.me` 계열 도메인은 일반적으로 `127.0.0.1`로 해석됩니다. 회사 네트워크, VPN 또는 보안 DNS가 이를 막는다면 `localhost` 직접 실행 구성을 사용하거나 DNS 설정을 확인합니다.

## 배포 전 확인사항

### 공통

- 필요한 SQL 마이그레이션을 DB에 먼저 적용했는가
- 운영 환경변수와 비밀값이 배포 서버에 설정됐는가
- 백엔드 테스트와 모바일 lint/typecheck가 통과했는가
- LLM smoke 회귀 테스트가 목표 제공자·모델에서 통과했는가
- 운영 헬스 체크와 주요 API 응답을 확인했는가

### 모바일

모바일 앱의 식별자는 iOS와 Android 모두 `kr.writeloop`입니다. 버전 정보는 `apps/mobile/app.json`, 빌드·제출 프로필은 `apps/mobile/eas.json`에서 관리합니다.

```powershell
Set-Location apps/mobile

# Android 운영 빌드와 제출
npx eas-cli build --platform android --profile production
npx eas-cli submit --platform android --profile production

# iOS 운영 빌드와 제출
npm run eas:build:ios
npm run eas:submit:ios
```

스토어 제출 전에 사용자 버전과 빌드 번호, 운영 API 주소, 앱 서명 계정, Google Play 서비스 계정 또는 App Store Connect 권한을 확인합니다.

## 추가 문서

| 문서 | 내용 |
|---|---|
| [`writeloop-project-onboarding-guide-2026-04-02.ko.md`](docs/writeloop-project-onboarding-guide-2026-04-02.ko.md) | 코드 중심의 상세 온보딩 가이드 |
| [`writeloop-tech-stack-architecture-for-diagram-2026-04-22.ko.md`](docs/writeloop-tech-stack-architecture-for-diagram-2026-04-22.ko.md) | 기술 스택과 배포 구조 |
| [`answer-loop-explained.md`](docs/answer-loop-explained.md) | 답변 루프 개념 |
| [`english-feedback-flow.md`](docs/english-feedback-flow.md) | 영어 피드백 처리 흐름 |
| [`diary-feedback-logic-report-2026-04-23.ko.md`](docs/diary-feedback-logic-report-2026-04-23.ko.md) | 일기 피드백 로직 |
| [`writeloop-feedback-contract-retry-150-report-2026-07-24.ko.md`](docs/writeloop-feedback-contract-retry-150-report-2026-07-24.ko.md) | canonical 계약과 재시도 회귀 결과 |
| [`writeloop-active-prompt-manual-review-2026-07-23.ko.md`](docs/writeloop-active-prompt-manual-review-2026-07-23.ko.md) | 활성 질문 수동 검토 결과 |
| [`backend-security-deployment-checklist-2026-04-15.ko.md`](docs/backend-security-deployment-checklist-2026-04-15.ko.md) | 백엔드 보안·배포 체크리스트 |

문서는 특정 시점의 설계와 실험 결과를 기록합니다. README와 문서가 현재 코드와 다르면 실행 코드, `application.yml`, 최신 번호의 SQL, 최신 회귀 보고서를 우선 확인하고 문서도 함께 갱신해 주세요.
