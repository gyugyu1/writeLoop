---
status: accepted
date: 2026-10-22
decision-makers: gyuwon
---

# DB 마이그레이션을 Flyway로 관리하고, 운영 DB 덤프를 기준선(V107)으로 삼는다

## Context and Problem Statement

스키마 변경은 `infra/mysql/schema`의 번호 SQL을 사람이 순서대로 적용해 왔다(ADR-0002). 어떤 파일이 어느 환경에 적용됐는지는 기록이 없었다. 2026-10-22에 확인한 결과는 이렇다.

* `064`에 정의된 인덱스 4개가 운영 DB에 없었다. `064`가 운영에 적용되지 않은 것으로 보인다.
* 빈 MySQL 8.4(운영과 같은 버전·sql_mode·정렬 규칙)에 001~107을 순서대로 실행하면 운영과 같은 DB가 나오지 않았다.
  * 실패하는 파일이 11개였다.
    * 적용 뒤 수정된 파일: `002`·`005`, `014`, `077`(SQL 오류)
    * 앱 시작 시 `PromptSeedConfig`가 만드는 데이터에 의존: `035`, `038`, `043`~`046`
    * 연쇄 실패: `078`, `087`
  * 코드가 쓰는 컬럼 `answer_attempts.used_coach_expressions_json`이 빠졌다.
  * 타입이 다른 컬럼이 생겼다(`char(64)` 대 `varchar(64)` 등). 이 DB로는 백엔드가 기동하지 못했다.
* 운영 DB와 로컬 DB는 구조가 완전히 같았다(528개 항목 비교).

## Decision Drivers

* 환경마다 어떤 마이그레이션이 적용됐는지 자동으로 기록되어야 한다.
* 마이그레이션을 빠뜨리거나 순서를 어기거나, 적용된 파일을 고치는 실수를 도구가 막아야 한다.
* 새 환경(CI 테스트 DB, 새 개발 PC, 복구용 DB)을 저장소만으로 운영과 같게 만들 수 있어야 한다.
* 기존 운영 DB는 구조를 건드리지 않고 편입해야 한다.

## Considered Options

* 지금처럼 손으로 적용하고, 문서로 적용 이력을 관리한다.
* Flyway 도입, 기존 DB는 107로 기준선 표시, 새 환경은 001~107을 처음부터 실행
* Flyway 도입, 기존 DB는 107로 기준선 표시, 새 환경은 운영 DB 덤프(`V107__baseline.sql`)부터 실행
* Liquibase 도입

## Decision Outcome

Chosen option: "Flyway + 운영 덤프 기준선", because 001~107은 처음부터 재현되지 않고, 고치려면 이미 적용한 파일을 수정해야 하기 때문이다. Spring Boot가 Flyway를 기본 지원하고, 우리 마이그레이션은 SQL 파일 중심이라 Liquibase의 변경 세트 기능은 필요 없다.

* 위치: `apps/backend/src/main/resources/db/migration`
* 설정: `baseline-on-migrate: true`, `baseline-version: 107`. 백엔드가 시작할 때 JPA 검증보다 먼저 적용한다.
* `V107__baseline.sql`의 내용:
  * 2026-10-22 운영 DB의 전체 구조
  * 기준 데이터 테이블 12개(질문, 힌트, 주제, 과제 메타데이터, 코치 프로필, 앱 버전 설정, 데이터 마이그레이션 기록)의 데이터
  * 사용자 데이터는 넣지 않았다.
  * `AUTO_INCREMENT` 값과 뷰의 `DEFINER`는 지웠다.
* `V108`: 운영에 빠져 있던 `064`의 인덱스 4개를 추가한다. 이미 있으면 건너뛴다.
* `infra/mysql/schema`는 107에서 동결한다. Claude 훅이 이 폴더의 추가·수정과, 푸시된 Flyway 파일 수정을 막는다.

### Consequences

* Good, because 환경별 적용 이력이 `flyway_schema_history`에 남는다.
* Good, because 적용된 파일을 고치면 체크섬 검사로 기동이 막힌다.
* Good, because 빈 DB에서 V107 → V108 적용 후 운영과 구조가 같고(V108 인덱스와 이력 테이블만 추가), 백엔드가 기동했다(2026-10-22 확인).
* Good, because 기존 DB(로컬)에서는 기준선 107 표시 후 V108만 적용되고 기동했다. 운영도 다음 배포 후 첫 기동 때 같은 과정을 거친다.
* Bad, because 기준선 파일이 약 14.6MB로 크다.
* Bad, because 운영 마이그레이션이 배포 후 기동 시점에 자동 적용된다. 배포 전에 백업해야 하고, 이전 코드와 호환되지 않는 변경은 두 번의 배포로 나눠야 한다.
* Bad, because Spring Boot 3.4.3이 관리하는 Flyway 10.20은 MySQL 8.4를 공식 지원 목록에 올리지 않았다. 동작은 정상이고 경고만 나온다. Spring Boot를 올릴 때 함께 해소한다.

### Confirmation

* 빈 MySQL 8.4 DB와 기존 로컬 DB에서 백엔드 기동 확인(2026-10-22)
* Claude 훅 `pre-edit`: 동결 폴더와 푸시된 Flyway 파일 수정 차단
* Claude 훅 `stop`: 엔티티 변경 시 새 마이그레이션 누락과 버전 중복 검사

## More Information

* 이 결정은 ADR-0002의 "번호 SQL을 손으로 적용" 부분을 대체한다. 모든 환경을 `ddl-auto: validate`로 두는 결정은 그대로다.
* 기준선 생성에 쓴 덤프 옵션은 `V107__baseline.sql` 머리말에 적어 두었다.
* 개선점 보고서 5.2(마이그레이션 적용 기록 없음)를 해결한다.
