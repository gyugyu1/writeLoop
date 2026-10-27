---
name: task-triage
description: WriteLoop에서 질문·설명·조사가 아닌 변경 작업(코드, 설정, 스키마, 프롬프트, 검사 도구, 문서, 작업 지침, 장애 수정)을 시작할 때와 그 작업을 이어서 할 때(새 세션, 대화 요약 뒤) 가장 먼저 읽는다. 작업 지침 변경인지, 작업 종류(새 기능, 버그 수정, 리팩터링)와 규모(작은 수정, 중간, 큰 작업)가 무엇인지 정하고, 다음에 읽을 스킬을 고른다.
---

# 작업 분류

변경 작업을 시작하면 아래 순서로 정하고, 다음에 읽을 스킬을 읽는다.

이어서 할 때는 1~3을 처음부터 다시 정하지 않고, 작업 폴더에 적힌 분류(`01-main-spec.md`, 그 뒤 결정 파일에서 다시 정했으면 그 분류. 지침 변경은 폴더 이름과 `01-main-purpose.md`)와 지금까지 바뀐 경로로 4의 표에서 스킬을 고른다. 이어서 하다가 바뀌는 곳이 늘면 3의 마지막 줄을 따른다.

## 1. 작업 지침 변경인지

- 작업 지침(`.claude/CLAUDE.md`, `.claude/agents/*.md`, `.claude/skills/*/SKILL.md`)을 바꾸면 작업 지침 변경이다. 아래 2·3을 정하지 않고 `instruction-change`를 따른다.
- 작업 지침과 다른 파일을 함께 바꾸면 두 작업으로 나눈다. 작업 지침은 작업 지침 변경으로, 나머지는 아래 2·3으로 정한다.
  - 다만 지침이 가리키는 안내 파일(`private/README.md`, `private/.gitignore`, `docs/README.md`처럼 지침 규칙을 설명하거나 따르는 파일)을 지침과 함께 고칠 때는 지침 변경에 넣어 한 번에 검토한다.
  - `private/backlog.md`의 항목 추가·정리와 작업 폴더(`private/work/`)의 파일은 다른 파일로 치지 않는다.

## 2. 작업 종류

- 새 기능
- 버그 수정. 장애 수정도 버그 수정이다.
- 리팩터링(동작은 그대로). 의존성 올리기도 리팩터링으로 다룬다.

종류별 순서는 `work-process`에 있다.

## 3. 규모

규모는 줄 수가 아니라 바뀌는 곳으로 정하고, 시작할 때 사용자에게 확인받는다. 애매하면 중간으로 한다.

- 작은 수정: 화면 문구, 문서, 주석만 바꾼다.
- 중간: 다음 중 하나라도 바뀐다.
  - 백엔드 동작 코드, 웹·모바일 동작 코드(화면 문구만 바꾸는 것은 제외)
  - LLM 프롬프트·스키마·모델(문구 한 줄이라도)
  - DB 스키마
  - API 요청·응답
  - 운영 설정(`infra/nginx`, `docker-compose*.yml`, `.github/workflows`, `scripts/ops`, `application*.yml`)
  - 의존성
  - 채점 규칙과 검사 도구(`scripts/feedback-quality`, `scripts/run-feedback-quality-check.mjs`, `scripts/dev`), Claude 설정(`.claude/hooks`, `.claude/settings.json`)
- 큰 작업(여러 화면에 걸친 기능, 큰 리팩터링): 테스트를 `test-writer`에 맡길지 사용자에게 먼저 묻는다. 에이전트를 더 쓰면 비용이 든다. 구현은 규모와 관계없이 메인 세션이 한다(2026-10-28 사용자 결정).
- 작업 중에 바뀌는 곳이 늘어 규모나 종류가 달라지면, 다시 정하고 사용자에게 다시 확인받는다.

## 4. 다음에 읽을 스킬

| 분류 | 읽을 스킬 |
|---|---|
| 작업 지침 변경 | `instruction-change`(검토를 요청받아 작업 폴더를 쓸 때만 `work-folder`도) |
| 작은 수정 | 없음. 혼자 하고 커밋한다 |
| 중간, 큰 작업 | `work-process`, `work-folder` |
| 중간·큰 작업 중 `apps/` 아래나 운영 설정(`docker-compose*.yml`, `application*.yml`, `infra/nginx`)이 바뀌면 | `code-rules`도 |
