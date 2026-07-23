# Prompt Metadata Manual Review Guide

Review every question as an individual communication task. Do not classify rows with regular expressions, ID prefixes, bulk templates, or copy-forward assumptions. Similar-looking questions must still be read separately because small wording differences can change required slots.

## Output shape

Return one JSON object per input question, in the same order:

```json
{
  "promptId": "prompt-id",
  "answerMode": "ROUTINE",
  "requiredSlots": ["ACTION"],
  "optionalSlots": ["SPECIFIC_TIME", "PLACE", "REASON", "FEELING", "RESULT"],
  "minimumDepthSlots": 1,
  "rationale": "The question directly asks for a habitual action; one independent context detail keeps the answer from being a bare action."
}
```

## Answer modes

- `ROUTINE`: habitual, repeated, or typical action.
- `PREFERENCE`: favorite, preference, choice, like/dislike, or selection.
- `GOAL_PLAN`: desired future state, goal, intention, or preparation plan.
- `PROBLEM_SOLUTION`: challenge/problem plus handling, response, or solution.
- `BALANCED_OPINION`: explicitly requests both sides, advantages/disadvantages, positive/negative aspects, or a balanced judgment.
- `OPINION_REASON`: asks for a judgment, belief, recommendation, or position without requiring both sides.
- `CHANGE_REFLECTION`: contrasts past and present, asks how something changed, or asks what caused a change.
- `GENERAL_DESCRIPTION`: factual description, personal information, memory, feeling, event, place, or any task not better represented above.

Choose the mode from the structure the learner must produce, not from a topic word in the question. A hypothetical action such as “If you were invisible, what would you do?” is `GENERAL_DESCRIPTION`, not `PREFERENCE`. A focused desired time/place such as “What time do you want to go to bed?” is also usually `GENERAL_DESCRIPTION` unless the learner must state a broader goal or plan. A follow-up that asks only “Why?” is `GENERAL_DESCRIPTION` with `REASON`, not `OPINION_REASON`, unless the learner must also state an opinion.

## Canonical slots

- `ACTION`: an action or activity.
- `CHOICE`: a selected/preferred item or option.
- `GOAL`: desired outcome or intended future state.
- `PROBLEM`: challenge, obstacle, or difficulty.
- `OPINION`: judgment, belief, stance, or recommendation.
- `PLAN`: intended method, preparation, or future steps.
- `SOLUTION`: action used to handle or solve a problem.
- `ADVANTAGE`: positive side or benefit.
- `DISADVANTAGE`: negative side or drawback.
- `BEFORE_STATE`: earlier belief, behavior, condition, or situation.
- `NOW_STATE`: current belief, behavior, condition, or situation.
- `CHANGE_CAUSE`: cause or trigger of a change.
- `ADDITIONAL_ACTION`: another action in a sequence or routine.
- `SPECIFIC_TIME`: concrete time, day, frequency, or timing condition. Generic habit words alone do not count.
- `PLACE`: location or setting.
- `REASON`: why, motivation, or cause that explains a choice/action/opinion.
- `DETAIL`: concrete descriptive information not covered by another slot.
- `EXAMPLE`: a specific instance illustrating a general statement.
- `FEELING`: emotion or subjective feeling.
- `RESULT`: consequence, effect, benefit, or outcome.

## Required versus optional

- Mark a slot `required` only when the wording directly asks for it or the task cannot be answered without it.
- Required slots describe content the learner must actually write. Do not require the learner to restate a problem, goal, place, person, or situation already supplied by the question.
- Every separately requested clause must become required. “Explain both sides and give your opinion” requires `ADVANTAGE`, `DISADVANTAGE`, and `OPINION`.
- “Describe a problem and explain what you do about it” requires `PROBLEM` and `SOLUTION`.
- Do not hide literal question obligations in optional slots.
- Optional slots are useful independent additions the learner may provide. Order them by pedagogical usefulness for this exact question.
- Required and optional slots must not overlap.
- Do not use retired aliases: `MAIN_ANSWER`, `ACTIVITY`, `TIME_OR_PLACE`, `SITUATION`, `ADDITIONAL_ACTIVITY`.

## minimumDepthSlots

`minimumDepthSlots` is the number of optional slots that must be present in addition to every required slot.

- `0`: the required slots already form an adequate answer for the question and level.
- `1`: one independent supporting detail is needed to avoid a bare label or one-clause answer.
- `2`: reserve this for wording that genuinely calls for an extended, multi-angle response even after every explicit clause has been represented as a required slot.

Do not choose `2` merely because a question is difficulty `C`, covers a broad or socially important topic, names more than one audience, or could be answered from several perspectives. If one concrete reason, example, result, or other independent support can adequately ground the required answer, use `1`. If the wording explicitly requests two distinct ideas, represent those ideas as required slots instead of hiding them in the depth count.

Difficulty guidance, not a formula:

- `I`: use 0 for simple factual/personal questions; use 1 for broad routine or preference prompts where a bare noun/action would be too thin; never use 2.
- `A`: usually 0 or 1; use 1 when only one short required slot would otherwise complete the task.
- `B`: usually 1 when required slots alone permit a minimal answer; use 0 when several explicit required slots already create sufficient depth; use 2 only for an unusually broad task.
- `C`: usually 1 or 2 for analysis, balanced argument, or reflection; use 0 only when the question already requires enough independent semantic units.

Do not count fragments of the core answer as depth. A place name containing an adjective is still one `CHOICE`, not both `CHOICE` and `DETAIL`. Depth evidence must add an independent semantic unit.

## Review quality rules

- Read the complete English question before assigning metadata.
- Check whether each required slot belongs in the learner's answer rather than merely appearing in the question premise.
- Keep `rationale` specific to the wording. Mention the direct obligations and why the selected depth is appropriate.
- Do not mention regexes, IDs, inferred families, or neighboring rows in the rationale.
- Preserve input order and prompt IDs exactly.
- Produce valid UTF-8 JSON with no Markdown wrapper.
