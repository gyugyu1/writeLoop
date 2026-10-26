# WriteLoop 작업 안내

영어 쓰기 연습 앱이다. 질문에 영어로 답하면 LLM이 진단하고, 백엔드가 미션 하나를 골라 다시 쓰게 하는 루프가 핵심이다.

## 대화 규칙

- 사용자에게는 항상 한국어로 답한다. 도구 출력이나 하위 에이전트 보고가 영어여도 마찬가지다.
- 작업을 마치면 커밋까지만 한다. push는 사용자가 "푸시해"라고 할 때만, 쌓인 커밋을 한꺼번에 한다(2026-10-23). `private` 저장소도 같다.
  - main에 push하면 CI가 통과한 뒤 운영에 자동 배포된다(ADR-0015). 그래서 push 시점은 사용자가 정한다.
  - 작업을 보고할 때 push하지 않은 커밋 목록을 두 저장소 모두 알린다. 공개 저장소는 `git log origin/main..HEAD`, 비공개 저장소는 `git -C private log origin/main..HEAD`. 비공개 저장소를 push해야 작업 기록이 다른 컴퓨터로 옮겨진다.
- 커밋 메시지는 한국어로 쓰고, 기존 형식(`fix:`, `feat:`, `refactor:`, `test:`, `chore:`, `docs:`)을 따르며, 논리 단위로 나눈다.

## 구조

| 경로 | 내용 |
|---|---|
| `apps/backend` | Spring Boot 3.4, Java 21, JPA, MySQL 8, Redis. LLM은 OpenAI만 쓴다(ADR-0017) |
| `apps/frontend` | Next.js 정적 웹(`@english-learning/frontend`). 주 화면은 `app/answer-loop.tsx` |
| `apps/mobile` | Expo / React Native 앱(`@writeloop/mobile`). 피드백 화면은 `src/app/practice/feedback.tsx` |
| `apps/backend/src/main/resources/db/migration` | Flyway 마이그레이션(`V번호__설명.sql`). 백엔드가 시작할 때 자동 적용 |
| `infra/mysql/schema` | Flyway 도입 전 마이그레이션 001~107. 동결, 기록용 |
| `infra/nginx` | 운영·개발 nginx 설정 |
| `.github/workflows` | CI(`ci.yml`: 테스트·이미지 빌드)와 운영 배포(`deploy.yml`) |
| `scripts/ops` | 운영 서버에서 실행하는 배포(`deploy.sh`)와 운영 DB 접속(`prod-db.sh`) 스크립트 |
| `scripts/feedback-quality` | 문장 피드백 회귀 테스트 케이스와 채점 규칙 |
| `.agents/skills/writeloop-feedback-logic` | 문장 피드백 계약과 품질 기준 문서 |
| `docs/` | `decisions/`(ADR), `guides/`(구조·동작 설명), `reports/<주제>/`(날짜가 붙은 실험·회귀·점검 보고서). 규칙은 `docs/README.md` |
| `private/` | 비공개 저장소의 clone(작업 목록, 비공개 보고서, 작업 폴더). 공개 저장소는 `.gitignore`로 무시한다. 구조는 `private/README.md` |

## 확인 명령 (Windows)

- 백엔드 테스트: `apps/backend`에서 `.\gradlew.bat test`
- 모바일 타입 검사: `apps/mobile`에서 `npm.cmd run typecheck`
- 웹 빌드: 저장소 루트에서 `npm.cmd run build --workspace @english-learning/frontend`
- 채점 규칙 테스트: `node --test scripts/feedback-quality/rules.test.mjs`
- 마이그레이션 확인(Docker 필요): `bash scripts/dev/check-db-migrations.sh --out <결과 폴더>`(저장소 밖이나 git이 무시하는 폴더. 작업 중에는 작업 폴더 아래)
- 문장 피드백 회귀(6건, Docker 필요): `bash scripts/dev/run-llm-smoke.sh --out <결과 폴더> [--cases <겨냥 케이스 파일>]`(결과 폴더 조건은 바로 위 마이그레이션 확인과 같다)
  - 임시 DB로 백엔드를 띄우고 `cases.smoke.json`을 실제 OpenAI로 돌린다. 키는 스크립트가 `.env`에서 꺼내 백엔드에만 넘긴다.
  - OpenAI를 실제로 호출하므로 비용이 든다. 돌리기 전에 `--dry-run`으로 요청 수를 보고, "요청 수(요청당 OpenAI 1~3회, 재시도 포함)"로 사용자에게 알려 승인받는다.
  - 리포트는 케이스 파일마다 `reports/<케이스 파일 이름>/latest.json`에 남는다. `completion` 필드는 줄여서 저장하므로, 스크립트가 피드백 원문(`feedback_diagnosis_logs`)을 결과 폴더에 따로 남긴다.

## 작업 규칙

세부 규칙은 스킬(`.claude/skills/`)에 있다. 아래 때가 되면 그 스킬을 먼저 읽는다.

| 때 | 스킬 |
|---|---|
| 질문·설명·조사가 아닌 변경 작업을 시작할 때(작업 지침 변경, 장애 수정 포함) | `task-triage`. 다음에 읽을 스킬은 여기서 고른다 |
| "푸시해"를 받았을 때, 재배포·롤백, 운영 장애 조사, 스토어 빌드 | `deploy-ops` |

- 질문, 설명, 조사만 할 때는 `task-triage`부터 이어지는 작업 공정과 backlog 확인을 따르지 않는다. 답하다가 고칠 것을 찾으면 고치기 전에 묻는다.

## 운영과 비밀 정보

- 운영 서버 접속과 운영 DB 조회는 메인 세션이 권한 모드와 관계없이 할 수 있다(2026-10-22, ADR-0012). 하위 에이전트는 운영에 접속하지 않는다.
- 배포, 마이그레이션 적용, 설정 변경처럼 운영을 바꾸는 작업은 사용자가 요청했을 때 하고, DB를 바꾸기 전에는 백업한다.
- `env_files/`, `.env`, `*.pem`, 서비스 계정 JSON 같은 비밀 파일은 내용을 출력하지도, 읽지도 않는다. 필요하면 변수 이름만 확인한다.
- 운영 서버에서 `docker compose build`나 `up --build`를 하지 않는다. 메모리가 모자라 서버가 멈춘다(2026-10-22 장애).

## 참고 문서

- 작업 목록: `private/backlog.md`.
  - 저장소 루트의 `private/`는 비공개 저장소 `gyugyu1/writeloop-private`의 clone이다. 이 공개 저장소는 `.gitignore`로 무시한다.
  - 폴더가 없으면 저장소 루트에서 `git clone https://github.com/gyugyu1/writeloop-private.git private`로 받는다.
  - 이 폴더의 내용은 공개되는 파일(ADR, README, 이 저장소의 커밋 메시지)에 옮겨 적지 않는다.
  - 작업을 시작하기 전에 `private`에서 `git pull`하고 읽는다. 항목을 끝내면 체크하고 날짜와 커밋을 적어 "최근 완료"로 옮긴 뒤, 그 폴더에서 커밋한다(push는 위 규칙대로 요청받았을 때).
  - 작업 중 새로 발견한 문제나 남은 일은 우선순위에 맞춰 추가한다.
  - 항목마다 번호를 붙인다. 번호 모양, 분류표, 규칙은 `backlog.md` 머리말을 따른다(2026-10-26 사용자 결정).
  - 개선점 보고서(`private/reports/project/writeloop-improvement-review-2026-10-22.ko.md`)에 항목별 근거가 있다.
- 결정 기록(ADR, MADR 형식): `docs/decisions/`.
  - 기존 결정을 뒤집기 전에 해당 ADR의 이유를 먼저 읽는다.
  - 새로 중요한 결정을 하면 `adr-template.md`로 새 ADR을 쓰고 `README.md` 목록에 추가한다.
- 문장 피드백 회귀 결과와 과거 판단: `docs/reports/feedback/`
- 새 보고서는 `docs/reports/<주제>/`에 날짜를 붙여, 설명서는 `docs/guides/`에 넣는다(`docs/README.md`).
