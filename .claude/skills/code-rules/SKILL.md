---
name: code-rules
description: WriteLoop 코드 규칙. 백엔드(DB 스키마·Flyway, LLM 요청·프롬프트·스키마, 설정·환경 변수)나 웹·모바일(API 응답 구조, 옛 앱 호환)을 바꾸거나 그 변경을 검증할 때 읽는다.
---

# 코드 규칙

## DB

- 스키마 변경은 Flyway로 한다. `apps/backend/src/main/resources/db/migration`에 다음 버전의 `V번호__설명.sql`을 추가한다(ADR-0013).
- 이미 푸시한 마이그레이션은 고치지 않는다. Flyway 체크섬이 어긋나 기동이 막히고, Claude 훅도 수정을 막는다.
- `infra/mysql/schema`는 107번에서 동결했다. 새 파일을 넣지 않는다.
- JPA는 `ddl-auto: validate`다. Flyway가 먼저 마이그레이션을 적용한 뒤 엔티티와 DB 구조를 검사하고, 다르면 서버가 뜨지 않는다. 엔티티를 바꾸면 마이그레이션을 같은 커밋에 만든다.
- 운영에서 마이그레이션은 배포 후 첫 기동 때 자동 적용되므로, 배포 전에 백업한다.
- 컬럼 삭제처럼 이전 코드와 호환되지 않는 변경은 두 번의 배포로 나눈다.
- 열을 지우거나 이름을 바꾸기 전에 그 열을 쓰는 뷰가 있는지 확인한다. MySQL에는 뷰가 쓰는 열 목록이 없으니 `information_schema.VIEWS`의 `VIEW_DEFINITION`과 마이그레이션 파일의 `VIEW` 정의에서 열 이름을 찾는다. 깨진 뷰가 있으면 배포 전 DB 백업(mysqldump)이 실패해 배포가 멈춘다(2026-10-24, V111).
- 마이그레이션을 추가하면 `scripts/dev/check-db-migrations.sh`로 확인한다. 임시 컨테이너에서 빈 DB(`V107__baseline.sql`부터)와 기존 DB(기준선 107) 양쪽으로 백엔드를 띄우고, 뷰가 조회되는지와 운영 배포와 같은 방식의 백업(mysqldump)이 성공하는지 본다.
  - 백업까지 보는 이유: 운영 배포는 마이그레이션 전에 백업하므로, 마이그레이션이 뷰를 깨뜨려도 그 배포는 통과하고 다음 배포의 백업에서야 드러난다(2026-10-24, V111).

## LLM 요청

- 구조화 출력은 스키마의 키 순서대로 생성된다. 순서는 동작에 영향을 주므로, 순서를 바꿀 때는 회귀 테스트를 함께 돌린다.
- LLM 스키마와 프롬프트는 `OrderedMaps`나 `LinkedHashMap`으로 만든다. `Map.of`, `Map.ofEntries`, `Map.copyOf`, `Set.of`는 JVM을 시작할 때마다 순서가 바뀐다. `LlmRequestDeterminismTest`가 검사한다.
- 화면에 쓰지 않는 내용을 LLM에 생성시키지 않는다. 출력 토큰이 곧 응답 시간이고 비용이다.
- LLM이 실패했을 때 학습자 입력과 무관한 고정 문구를 AI 결과처럼 보여 주거나 저장하지 않는다. 솔직한 안내 오류를 돌려준다. 질문의 힌트처럼 그 상황에 맞는 데이터로 만든 대체 응답(코치 도움)은 괜찮다.
- 서버 시간 제한은 앱 시간 제한보다 짧아야 한다. 앱은 피드백·일기 90초, 코치·Now in English 45초에서 끊고, nginx는 85초에서 끊는다.
- LLM 호출은 요청 단위 마감(`LlmRequestDeadline.within`) 안에서, DB 트랜잭션 밖에서 한다(ADR-0016). OpenAI 호출은 `OpenAiStructuredOutputSupport.buildResponsesRequest`를 거쳐야 마감을 따른다.
- 문장 피드백(`CanonicalFeedbackContract`, `FeedbackLearningContractPolicy`, `CanonicalFeedbackAssembler`)을 바꾸기 전에 `.agents/skills/writeloop-feedback-logic/SKILL.md`와 `references/feedback-schema.md`를 읽는다.
  - 사용자가 이 두 문서를 새로 쓰기로 해서, 그때까지는 읽기만 하고 갱신하지 않는다(2026-10-25 사용자 결정).
  - 코드와 문서가 달라진 곳은 보고에 적고, backlog의 6건 회귀 채점 규칙 정리 항목(피드백 로직 스킬 문서를 새로 쓸 때 함께 하는 일)에 덧붙인다. 문서와 확인받은 명세가 다르면 명세를 따른다.
  - 문서의 검증 절차(Verification 절, `references/regression-workflow.md`) 대신 `work-process` 스킬의 작업 방식을 따른다. 6건 회귀는 `work-process` 스킬의 "변경 종류별로 더 할 것"의 조건(문장 피드백 LLM을 바꿀 때)에만 돌린다.

## 설정

- 새 환경 변수는 `docker-compose.yml`의 `environment:`에도 추가한다. 이 파일은 `env_file`을 쓰지 않아서, 목록에 없는 변수는 컨테이너에 전달되지 않는다.

## 웹과 모바일

- 응답 구조를 바꾸면 웹(`apps/frontend/lib/types.ts`)과 모바일(`apps/mobile/src/lib/types.ts`) 타입을 함께 바꾼다.
- 기능은 두 화면에 맞춰 넣는다.
- API 요청·응답은 스토어에 나가 있는 모바일 버전과 호환되게 바꾼다. 서버는 push하면 바로 바뀌지만, 사용자 폰의 옛 앱은 업데이트할 때까지 그대로다.
  - 응답 필드는 추가만 한다. 옛 앱은 모르는 필드를 무시한다.
  - 요청 필드는 선택으로만 추가하고 서버에 기본값을 둔다. 옛 앱은 새 필드를 보내지 않는다.
  - 응답의 enum 값(미션 종류 등)을 추가하면, 옛 앱이 모르는 값을 받았을 때 어떻게 되는지 확인한다. 모르는 필드와 달리 화면이 깨질 수 있다.
  - 필드를 지우거나 이름·의미를 바꾸는 일은, 새 필드를 쓰는 앱을 스토어에 내보내고 최소 지원 버전(`APP_VERSION_*_MINIMUM_SUPPORTED`)을 올린 뒤의 배포에서 한다. 열 삭제를 배포 두 번으로 나누는 것과 같다.

