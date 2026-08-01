# Feedback Regression Workflow

Use this workflow when changing OpenAI prompts, mission selection, schema, or feedback UI.

## 1. Static Checks

Run:

```powershell
scripts/run-feedback-checks.ps1 -RepoRoot C:\WriteLoop
```

Or manually run the commands from `SKILL.md`.

## 2. Schema Search

Search for accidental legacy reintroduction:

```powershell
rg -n "secondaryLearningPoints|modelAnswerVariants|nextStepPractice" apps/backend/src/main/java/com/writeloop/service/OpenAiFeedbackClient.java apps/mobile/src apps/frontend/lib apps/frontend/app
```

Expected result: no matches for OpenAI/mobile/web public paths.

## 3. Quality Sample Set

For LLM behavior changes, test a mixed set:

- Thin but valid answers.
- Minor grammar errors with enough content.
- Broken fragments.
- Off-topic answers.
- Non-English or romanized Korean.
- Strong complete answers.
- Answers with `That is all`.
- Answers with generic reasons such as `because it is delicious`.

## 4. Review Questions

For each sample, ask:

- Did `coachMission.missionType` match the real learner need?
- Is the top mission immediately rewriteable?
- Does a content mission include matching English/Korean skeletons and usable phrase choices?
- Do the visible correction rows support the same language mission?
- Are optional expressions useful and non-duplicative?
- Is `modelAnswer` consistent with the mission?

## 5. Iterate

Prefer prompt/schema changes over backend guardrails when the issue is conceptual mission selection.

Use backend guardrails for:

- Safety.
- Invalid schema.
- Duplicated fields.
- Identical before/after pairs.
- Non-English or meaningless answer resets.
