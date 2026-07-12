# Mission Quality Rubric

Use this rubric when reviewing generated feedback or changing prompts.

## Good Mission

A good mission is:

- One action only.
- Immediately rewriteable.
- Matched to the prompt.
- More useful than minor polish.
- Concrete enough that the learner knows what to write next.
- Supported by `fixPoints`, `refinementExpressions`, `modelAnswer`, and rewrite UI.

## Mission Selection

Prefer content missions when:

- The answer is understandable but thin.
- The learner answered the task but lacks reason, detail, example, feeling, situation, or result.
- Grammar errors are minor and do not block meaning.

Prefer grammar or expression missions when:

- Meaning is hard to understand.
- One local error blocks the rewrite.
- The answer is a broken fragment sequence such as `home go. dinner eat`.

Use `TASK_RESET` when:

- The answer is non-English.
- The answer is romanized Korean.
- The answer is meaningless.
- The answer is off-topic or does not answer the prompt.

## Required Example Behavior

If the mission asks the learner to add content, the feedback should provide a concrete example sentence.

Examples:

- Detail mission: `I put the groceries away as soon as I get home.`
- Reason mission: `I rest because carrying groceries makes me tired.`
- Feeling mission: `I feel relieved after I finish shopping.`
- Result mission: `After that, I can relax and cook dinner.`

## Fail Cases

Treat these as quality failures:

- Mission says "add detail" but gives no example.
- Top mission and detailed feedback teach different things.
- Mission asks for wording polish when the real issue is missing content.
- `coachMission.originalText` and `revisedText` are identical.
- `fixPoints` repeats `coachMission` without adding explanation.
- `refinementExpressions` repeats a correction already shown in `fixPoints`.
- `modelAnswer` introduces unsupported content that changes the learner's meaning.
