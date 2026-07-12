# Current Feedback Schema

This document describes the preferred mission-centered feedback contract.

## OpenAI Output Fields

Prefer these fields:

- `missionDecision`
  - Internal decision trace for choosing the mission.
  - Must match `coachMission.missionType`.

- `coachMission`
  - The single next action.
  - Source for the top feedback card and rewrite workspace.

- `fixPoints`
  - Detailed feedback cards.
  - First item should support the same action as `coachMission`.

- `refinementExpressions`
  - Optional reusable phrases, sentence starters, and add-on expressions.
  - Should not repeat a repair already taught by `fixPoints`.

- `modelAnswer`
  - Quiet reference.
  - Must include the mission change when the mission is a correction.
  - Should not introduce a different plan from `coachMission`.

- `modelAnswerKo`
  - Korean translation/reference for `modelAnswer` when needed.

- `summary`, `strengths`, `corrections`, `grammarFeedback`
  - Supporting feedback data.

## Legacy Schema Guardrail

Do not reintroduce these OpenAI output fields unless intentionally redesigning the feedback contract:

- `secondaryLearningPoints`
- `modelAnswerVariants`
- `nextStepPractice`

Current replacements:

- `secondaryLearningPoints` -> `fixPoints`
- `modelAnswerVariants` -> no replacement; use one `modelAnswer` as a quiet reference
- `nextStepPractice` -> `coachMission` plus `rewriteWorkspace`

## `coachMission` Rules

For correction missions:
- `missionType` should be `GRAMMAR_FIX` or `EXPRESSION_POLISH`.
- `originalText` and `revisedText` must be short, aligned, and replaceable.
- `originalText` and `revisedText` must not be identical.

For add-on missions:
- `missionType` may be `REASON`, `DETAIL`, `SITUATION`, `EXAMPLE`, `FEELING`, `RESULT`, or `TASK_RESET`.
- `originalText` and `revisedText` should be null.
- `exampleEn` should show one concrete sentence the learner can imitate.

For `TASK_RESET`:
- The mission must name the actual prompt topic.
- The instruction must ask the learner to answer the prompt from scratch.

## UI Mapping

- `coachMission.toCoachMove()` feeds the top mission card.
- `coachMission.toRewriteWorkspace(seedText)` feeds rewrite input state.
- `FeedbackUiDto.fixPoints` feeds detailed feedback.
- `refinementExpressions` feeds the expression add-on area.
