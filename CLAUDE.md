# WriteLoop 작업 안내

영어 쓰기 연습 앱이다. 질문에 영어로 답하면 LLM이 진단하고, 백엔드가 미션 하나를 골라 다시 쓰게 하는 루프가 핵심이다.

## 대화 규칙

- 사용자에게는 항상 한국어로 답한다. 도구 출력이나 하위 에이전트 보고가 영어여도 마찬가지다.
- 커밋과 푸시는 사용자가 요청할 때만 한다. 커밋 메시지는 한국어로 쓰고, 기존 형식(`fix:`, `feat:`, `refactor:`, `chore:`)을 따르며, 논리 단위로 나눈다.
- main에 push하면 CI가 통과한 뒤 운영에 자동 배포된다(ADR-0015). 운영에 내보내지 않을 작업은 브랜치에 push한다.

## 구조

| 경로 | 내용 |
|---|---|
| `apps/backend` | Spring Boot 3.4, Java 21, JPA, MySQL 8, Redis. LLM 호출(OpenAI 기본, Gemini 대체)이 여기 있다 |
| `apps/frontend` | Next.js 정적 웹(`@english-learning/frontend`). 주 화면은 `app/answer-loop.tsx` |
| `apps/mobile` | Expo / React Native 앱(`@writeloop/mobile`). 피드백 화면은 `src/app/practice/feedback.tsx` |
| `apps/backend/src/main/resources/db/migration` | Flyway 마이그레이션(`V번호__설명.sql`). 백엔드가 시작할 때 자동 적용 |
| `infra/mysql/schema` | Flyway 도입 전 마이그레이션 001~107. 동결, 기록용 |
| `infra/nginx` | 운영·개발 nginx 설정 |
| `.github/workflows` | CI(`ci.yml`: 테스트·이미지 빌드)와 운영 배포(`deploy.yml`) |
| `scripts/ops` | 운영 서버에서 실행하는 배포(`deploy.sh`)와 운영 DB 접속(`prod-db.sh`) 스크립트 |
| `scripts/feedback-quality` | 문장 피드백 회귀 테스트 케이스와 채점 규칙 |
| `.agents/skills/writeloop-feedback-logic` | 문장 피드백 계약과 품질 기준 문서 |
| `docs/` | 날짜가 붙은 조사·회귀 보고서 |

## 확인 명령 (Windows)

- 백엔드 테스트: `apps/backend`에서 `.\gradlew.bat test`
- 모바일 타입 검사: `apps/mobile`에서 `npm.cmd run typecheck`
- 웹 빌드: 저장소 루트에서 `npm.cmd run build --workspace @english-learning/frontend`
- 채점 규칙 테스트: `node --test scripts/feedback-quality/rules.test.mjs`
- 문장 피드백 회귀: 로컬 백엔드를 띄운 뒤
  `node scripts/run-feedback-quality-check.mjs --cases scripts/feedback-quality/cases.completion-gate-150-v3.json --base-url http://localhost:8080 --concurrency 2`
  - OpenAI를 실제로 호출하므로 비용이 든다. 돌리기 전에 사용자에게 알린다.
  - 리포트는 `completion` 필드를 줄여서 저장한다. 완성 화면 데이터는 DB의 `feedback_diagnosis_logs`나 API 응답으로 직접 확인한다.

## 작업 규칙

### DB

- 스키마 변경은 Flyway로 한다. `apps/backend/src/main/resources/db/migration`에 다음 버전의 `V번호__설명.sql`을 추가한다(ADR-0013).
- 이미 푸시한 마이그레이션은 고치지 않는다. Flyway 체크섬이 어긋나 기동이 막히고, Claude 훅도 수정을 막는다.
- `infra/mysql/schema`는 107번에서 동결했다. 새 파일을 넣지 않는다.
- JPA는 `ddl-auto: validate`다. Flyway가 먼저 마이그레이션을 적용한 뒤 엔티티와 DB 구조를 검사하고, 다르면 서버가 뜨지 않는다. 엔티티를 바꾸면 마이그레이션을 같은 커밋에 만든다.
- 운영에서 마이그레이션은 배포 후 첫 기동 때 자동 적용되므로, 배포 전에 백업한다.
- 컬럼 삭제처럼 이전 코드와 호환되지 않는 변경은 두 번의 배포로 나눈다.
- 마이그레이션을 추가하면 빈 DB(`V107__baseline.sql`부터)와 기존 DB(기준선 107) 양쪽에서 백엔드가 기동하는지 확인한다.

### LLM 요청

- 구조화 출력은 스키마의 키 순서대로 생성된다. 순서는 동작에 영향을 주므로, 순서를 바꿀 때는 회귀 테스트를 함께 돌린다.
- LLM 스키마와 프롬프트는 `OrderedMaps`나 `LinkedHashMap`으로 만든다. `Map.of`, `Map.ofEntries`, `Map.copyOf`, `Set.of`는 JVM을 시작할 때마다 순서가 바뀐다. `LlmRequestDeterminismTest`가 검사한다.
- 화면에 쓰지 않는 내용을 LLM에 생성시키지 않는다. 출력 토큰이 곧 응답 시간이고 비용이다.
- 서버 시간 제한은 앱 시간 제한보다 짧아야 한다. 앱은 피드백·일기 90초, 코치·Now in English 45초에서 끊는다.
- 문장 피드백(`CanonicalFeedbackContract`, `FeedbackLearningContractPolicy`, `CanonicalFeedbackAssembler`)을 바꾸기 전에 `.agents/skills/writeloop-feedback-logic/SKILL.md`와 `references/feedback-schema.md`를 읽고, 바꾼 뒤에는 두 문서를 함께 갱신한다.

### 설정

- 새 환경 변수는 `docker-compose.yml`의 `environment:`에도 추가한다. 이 파일은 `env_file`을 쓰지 않아서, 목록에 없는 변수는 컨테이너에 전달되지 않는다.

### 웹과 모바일

- 응답 구조를 바꾸면 웹(`apps/frontend/lib/types.ts`)과 모바일(`apps/mobile/src/lib/types.ts`) 타입을 함께 바꾼다.
- 기능은 두 화면에 맞춰 넣는다.

## 운영과 비밀 정보

- 운영 서버 접속과 운영 DB 조회는 권한 모드와 관계없이 할 수 있다(2026-10-22, ADR-0012).
- 배포, 마이그레이션 적용, 설정 변경처럼 운영을 바꾸는 작업은 사용자가 요청했을 때 하고, DB를 바꾸기 전에는 백업한다.
- `env_files/`, `.env`, `*.pem`, 서비스 계정 JSON 같은 비밀 파일은 내용을 출력하지도, 읽지도 않는다. 필요하면 변수 이름만 확인한다.
- 배포(ADR-0015):
  - main push → GitHub Actions가 테스트하고 이미지를 GHCR에 올린 뒤, `deploy.yml`이 서버에서 `scripts/ops/deploy.sh`를 실행한다.
  - `deploy.sh`가 DB 백업, 이미지 받기, 재시작, 기동 확인을 한다. Flyway 마이그레이션은 백엔드가 기동할 때 적용된다.
  - 재배포·롤백은 Actions의 `Deploy` 워크플로를 커밋 SHA로 직접 실행한다. CI가 이미지를 올린 커밋만 된다.
  - 운영 서버에서 `docker compose build`나 `up --build`를 하지 않는다. 메모리가 모자라 서버가 멈춘다(2026-10-22 장애).
  - `deploy.sh`는 Redis를 다시 만들지 않는다. 모바일 로그인 유지 토큰이 Redis에만 있으니 Redis 볼륨을 지우지 않고, Redis 설정 변경은 README 절차로 직접 적용한다.
  - 운영 DB 조회는 서버에서 `bash scripts/ops/prod-db.sh mysql writeloop -e "..."`로 한다.
- 모바일 앱은 서버 배포와 별도로 스토어에 배포해야 반영된다. 스토어 빌드 전 버전 규칙은 피드백 로직 스킬 문서의 "Mobile Store Build Guardrail"을 따른다.

## 참고 문서

- 결정 기록(ADR, MADR 형식): `docs/decisions/`.
  - 기존 결정을 뒤집기 전에 해당 ADR의 이유를 먼저 읽는다.
  - 새로 중요한 결정을 하면 `adr-template.md`로 새 ADR을 쓰고 `README.md` 목록에 추가한다.
- 문장 피드백 회귀 결과와 과거 판단: `docs/writeloop-feedback-*` 보고서
