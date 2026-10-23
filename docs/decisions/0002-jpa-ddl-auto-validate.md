---
status: accepted
date: 2026-10-20
decision-makers: gyuwon
---

# 모든 환경에서 JPA ddl-auto를 validate로 두고, 스키마는 SQL 마이그레이션으로만 바꾼다

## Context and Problem Statement

`ddl-auto: update`가 엔티티를 보고 테이블과 컬럼을 몰래 만들거나 되살렸다. 그 결과 다음과 같은 일이 있었다.

* 운영 DB에 SQL 파일에는 없는 구조가 생겼다. 예: 마이그레이션 `010`의 인덱스가 Hibernate가 만든 테이블에 빠졌다.
* 로컬 DB는 운영과 컬럼 타입, 정렬 규칙, UNIQUE 제약, 외래 키가 크게 달랐다.
* 컬럼을 삭제한 뒤, 예전 로컬 백엔드 이미지가 그 컬럼을 다시 만들어 저장할 때 오류가 났다.

## Decision Drivers

* 운영, 개발, 로컬 DB 구조가 같아야 한다.
* 스키마 변경은 검토 가능한 SQL 파일로 남아야 한다.
* 엔티티와 DB가 어긋나면 조용히 맞추지 말고 바로 드러나야 한다.

## Considered Options

* `update` 유지
* 운영만 `validate`, 로컬은 `update`
* 모든 환경 `validate` + 번호 붙은 SQL 마이그레이션
* Flyway 같은 마이그레이션 도구 도입

## Decision Outcome

Chosen option: "모든 환경 validate + 번호 붙은 SQL 마이그레이션", because 기존 마이그레이션 방식을 그대로 쓰면서 자동 DDL로 생기는 차이를 바로 막을 수 있기 때문이다.

### Consequences

* Good, because 엔티티와 DB 구조가 다르면 서버가 뜨지 않아서 차이가 배포 전에 드러난다.
* Good, because 로컬 DB도 운영 구조로 재구성했다.
* Bad, because 엔티티를 바꿀 때마다 마이그레이션을 같이 써야 한다.
* Bad, because 마이그레이션 적용 순서를 사람이 지켜야 한다(예: `106`은 배포 전, `107`은 배포 후). 어떤 파일이 어느 환경에 적용됐는지 기록하는 장치는 아직 없다.

### Confirmation

* `application.yml`의 `ddl-auto: ${SPRING_JPA_HIBERNATE_DDL_AUTO:validate}`
* Claude 훅(`.claude/hooks/writeloop_guard.py`)이 설정 파일의 `update`/`create`, 배포된 마이그레이션 수정, 엔티티 변경 시 마이그레이션 누락을 막거나 경고한다.

## More Information

* 커밋: `c7a1f1a`(104~107 마이그레이션과 기본값 변경), `536066f`(로컬도 validate)
* 후속 과제: 적용 이력 관리(Flyway 검토). [개선점 조사 요약](../reports/project/writeloop-improvement-review-2026-10-22.ko.md) 5.2
