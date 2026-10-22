---
status: accepted
date: 2026-10-22
decision-makers: gyuwon
---

# 운영 서버·DB 접근을 권한 모드와 관계없이 허용한다

## Context and Problem Statement

2026-10-20에 Claude Code 훅(`.claude/hooks/writeloop_guard.py`의 `pre-shell`)을 추가했다.

* 운영 주소(`api.writeloop.kr`, RDS 주소, `was-key.pem`)와 변경 패턴(SQL 변경 구문, `docker`, `git pull` 등)이 함께 들어간 명령을 찾는다.
* 기본 모드에서는 승인 창을 띄우고, auto 모드에서는 실행을 막는다.

그런데 패턴이 넓어서 읽기 전용 작업도 자주 막혔다.

* `docker exec ... printenv`로 설정 이름을 확인하는 명령
* 대화 기록에서 배포 명령을 검색하는 `grep`

그때마다 사용자가 기본 모드로 바꾸고 다시 요청해야 해서 작업 흐름이 자주 끊겼다.

## Decision Drivers

* 운영 상태 확인(로그, 설정 이름, DB 구조 조회)은 자주 필요하고 위험이 낮다.
* 운영을 바꾸는 작업은 어차피 사용자가 요청할 때만 한다.

## Considered Options

* 훅 유지(기본 모드에서만 운영 접근)
* 읽기 전용 명령만 허용하도록 패턴을 좁힌다.
* 운영 명령 훅을 없애고, 운영 변경은 CLAUDE.md의 작업 규칙(요청 시에만, DB 변경 전 백업)으로 관리한다.

## Decision Outcome

Chosen option: "운영 명령 훅 제거", because 사용자가 모드 전환의 불편이 더 크다고 판단했기 때문이다. 셸 명령만 보고 읽기와 변경을 정확히 가르기도 어려웠다.

### Consequences

* Good, because auto 모드에서도 운영 로그·설정·DB 구조를 바로 확인할 수 있다.
* Bad, because 운영을 바꾸는 명령도 훅이 더는 막지 않는다. 운영 변경은 CLAUDE.md 규칙과 Claude Code 자체 권한 검사에 맡긴다.
* Bad, because auto 모드에서는 Claude Code 자체 검사가 원격 실행이나 배포 같은 명령을 여전히 막을 수 있다. 이 검사는 프로젝트 설정 밖의 장치다.

### Confirmation

* `.claude/settings.json`의 `PreToolUse` 훅에 `Bash|PowerShell` 항목이 없다.
* 마이그레이션 보호(`pre-edit`)와 종료 시 마이그레이션 누락 검사(`stop`)는 그대로 동작한다.

## More Information

* 훅 추가: `52961f5`. 이 결정으로 `pre-shell` 검사를 제거했다.
* 비밀 파일(`env_files/`, `.env`, `*.pem`) 읽기 차단은 별도 과제로 남아 있다(`docs/writeloop-improvement-review-2026-10-22.ko.md` 1.5).
