# Question-Specific Slot Contract Review Guide

Review every prompt and every assigned slot manually. Do not generate semantic
roles with regexes, prompt-ID families, copied templates, or a script. Similar
questions must still be read separately.

The source question text is in:

`.codex_logs/prompt-metadata-review/input/prompts-all.json`

The existing answer mode, required slots, optional slots, depth, and rationale
are in:

`scripts/prompt-metadata-review/reviews/part-XX.json`

## Review Output

Write one object for every assigned prompt:

```json
{
  "promptId": "prompt-a-1",
  "slotContracts": {
    "ACTION": {
      "semanticRoleEn": "The learner's usual action after dinner.",
      "satisfiedWhenEn": "The answer states an action that the learner usually performs after dinner.",
      "semanticRoleKo": "학습자가 저녁 식사 후에 평소 하는 행동",
      "satisfiedWhenKo": "답변이 학습자가 저녁 식사 후에 평소 하는 행동을 제시하면 충족된다."
    }
  }
}
```

`slotContracts` must contain exactly the union of `requiredSlots` and
`optionalSlots`. If the manual review finds that a slot assignment or
`minimumDepthSlots` is wrong, include a complete `reviewOverride` in the
semantic review and write contracts for the corrected slot set. The parent
reviewer decides whether to apply that proposal to the authoritative
`part-XX.json` review and its matching Korean rationale.

The English fields are authoritative and are sent to the LLM. The Korean
fields are faithful reviewer references and are never used to make runtime
decisions.

## Field Meaning

- `semanticRoleEn`: the meaning this slot has in this exact question.
- `satisfiedWhenEn`: a semantic, paraphrase-tolerant test for whether the
  learner answer fulfills that role.
- `semanticRoleKo`: a faithful Korean rendering of `semanticRoleEn`.
- `satisfiedWhenKo`: a faithful Korean rendering of `satisfiedWhenEn`.

Do not define a slot only by restating its global name. For example, PLACE
must say whether the question needs a residence, destination, event setting,
origin, or another location relation.

## Contract Rules

1. Read the complete English question before writing any contract.
2. Describe the relationship the learner must express, not just a keyword or
   entity that may appear in the answer.
3. Make `satisfiedWhenEn` tolerant of natural paraphrases. Do not require one
   literal phrase, grammar pattern, or regex-like wording.
4. Do not make the condition stricter than the question. A concise but real
   answer can satisfy a slot.
   For `SPECIFIC_TIME`, broad but meaningful expressions such as `in the
   morning` can be concrete; do not require a clock time unless the question
   itself calls for that precision.
5. Do not treat generic placeholders as sufficient when they leave the
   requested information unidentified, such as `something`, `somewhere`,
   `somehow`, `some problems`, `a nice area`, or `things changed`.
6. Distinguish a relevant attempt from satisfaction. A relevant sentence can
   be ON_TOPIC while a required slot remains generic or missing.
7. For an optional slot, describe the independent information it contributes
   to the core answer. Do not merely repeat another assigned slot.
8. A slot should not demand the learner to restate information already given
   by the question unless the question explicitly asks the learner to state
   or relate that information.
9. Do not force an open factor into ACTION merely because an action could be
   one possible answer. Questions such as `What helps you sleep well?` may
   validly be answered by a habit, product, object, environment, or condition.
   Use an inclusive required slot such as DETAIL and leave ACTION optional
   when the question does not specifically ask what the learner does.
10. Keep each English field concise, normally one sentence. Keep each Korean
   field equally specific.
11. Never mention prompt IDs, neighboring rows, implementation details, or
    the review process in a semantic contract.

## Evidence Design

The LLM will later return the smallest exact learner-answer span that proves
the semantic relation. Write the contract so that this evidence can be
checked meaningfully.

For `Where do you live?`:

- `semanticRoleEn`: `The learner's current place of residence.`
- `satisfiedWhenEn`: `The answer explicitly states or clearly conveys a
  recognizable location where the learner currently lives. Merely mentioning
  or describing a place without connecting it to the learner's residence
  does not satisfy the role.`
- `I live in Seoul.` can satisfy the role.
- `Seoul is quiet.` is related to a place but does not establish residence.
- `My neighborhood is quiet.` is related to the question but leaves the place
  unidentified.

For `Why do you study English?`:

- `semanticRoleEn`: `The learner's reason for studying English.`
- `satisfiedWhenEn`: `The answer gives a concrete motivation or intended
  benefit that explains why the learner studies English.`
- `Because it is good.` is a generic attempt, not a satisfied reason.

## Manual Review Checklist

For every prompt:

- Confirm the question text was read.
- Recheck `answerMode`.
- Recheck every required slot.
- Recheck every optional slot.
- Recheck `minimumDepthSlots`.
- Write all four contract fields for every assigned slot.
- Confirm contract keys exactly match the final required and optional slots.
- Confirm English and Korean fields have the same meaning.
- Confirm the criterion tests a semantic relation rather than keyword
  presence.
- Confirm generic, relevant-but-unresolved, and satisfied answers can be
  distinguished.
