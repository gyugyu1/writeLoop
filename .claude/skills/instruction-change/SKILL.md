---
name: instruction-change
description: WriteLoop 작업 지침(.claude/CLAUDE.md, .claude/agents/*.md, .claude/skills/*/SKILL.md)을 바꿀 때 읽는다. 지금은 검토 없이 바로 반영한다(2026-10-28 사용자 결정). 사용자가 검토를 요청하면 같은 폴더의 review.md(instruction-reviewer 검토 절차)를 읽는다.
---

# 작업 지침 변경

- **지금은 검토 없이 바로 반영한다(2026-10-28 사용자 결정: 빠르게 진행).** 메인 세션이 고치고 바로 커밋한다. 작업 폴더, 변경분, `instruction-reviewer` 검토는 하지 않는다.
- 작업 지침 변경은 `work-process` 스킬의 공정을 따르지 않는다.
- 그대로 지키는 것:
  - 사용자와 정한 내용(`work-folder` 스킬의 정의)을 바꾸는 변경은 먼저 묻는다.
  - 지침에 새 명령을 적었으면 그 명령을 한 번 실제로 돌려 본다. 비용이 드는 명령(OpenAI 호출)은 `--dry-run`까지만 하고, 실제 실행은 사용자 승인 뒤에 한다.
  - 지침이 가리키는 안내 파일(`private/README.md`, `private/.gitignore`, `docs/README.md`처럼 지침 규칙을 설명하거나 따르는 파일)을 함께 고쳐야 하면 같은 변경에서 고친다.
- 사용자가 검토를 요청하면 `.claude/skills/instruction-change/review.md`를 읽고 그 절차(`instruction-reviewer` 검토, 보고 칸별 처리, 추천 고르기, 검토 자료 남기기)를 따른다.
