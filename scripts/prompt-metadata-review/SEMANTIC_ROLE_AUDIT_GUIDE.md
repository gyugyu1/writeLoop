# Independent Question-Specific Slot Contract Audit

This is an independent second review. Read the original English question, the
existing learning metadata, and the primary semantic review for every prompt.
Do not assume the primary review is correct.

Do not use regexes, prompt-ID families, copied templates, or a script to make
audit decisions. Similar prompts must be checked separately.

## Output

Write one audit object for every prompt in the assigned part:

```json
{
  "promptId": "prompt-a-1",
  "verdict": "PASS",
  "auditReasonKo": "저녁 식사 후의 습관 행동이라는 관계와 각 선택 슬롯의 보강 역할이 원문 질문에 맞는다."
}
```

When a change is needed:

```json
{
  "promptId": "prompt-id",
  "verdict": "CHANGE",
  "auditReasonKo": "PLACE가 단순 장소 언급이 아니라 학습자의 거주지 관계를 요구해야 한다.",
  "replacementSlotContracts": {
    "PLACE": {
      "semanticRoleEn": "The learner's current place of residence.",
      "satisfiedWhenEn": "The answer explicitly states or clearly conveys a recognizable location where the learner currently lives. Merely mentioning or describing a place without connecting it to the learner's residence does not satisfy the role.",
      "semanticRoleKo": "학습자가 현재 거주하는 장소",
      "satisfiedWhenKo": "답변이 학습자가 현재 사는 곳으로 식별 가능한 장소를 명시하거나 분명히 드러내면 충족된다. 장소를 거주 관계 없이 언급하거나 묘사하는 것만으로는 충족되지 않는다."
    }
  }
}
```

`replacementSlotContracts` contains only slots that must change, but each
replacement contains all four fields. If answer mode, required/optional slots,
or depth must change, also include a complete `reviewOverride` with
`answerMode`, `requiredSlots`, `optionalSlots`, `minimumDepthSlots`,
`rationale`, and `rationaleKo`.

## Audit Questions

For every prompt:

1. Does `semanticRoleEn` describe this question's exact subject, object,
   context, and relationship rather than only renaming the slot?
2. Does `satisfiedWhenEn` accept natural paraphrases while rejecting keyword
   mentions that do not express the required relationship?
3. Is the criterion no stricter than the original question?
4. Can it distinguish SATISFIED, relevant-but-generic, and missing content?
5. Would the smallest exact evidence span prove the relationship?
6. Are required and optional slots appropriate for what the learner must say?
7. Is `minimumDepthSlots` still appropriate?
8. Are the Korean fields faithful and specific?

Pay special attention to:

- `PLACE`: residence, destination, event setting, origin, or other location
  relations must not collapse into generic place mention.
- `SPECIFIC_TIME`: broad but meaningful expressions such as `in the morning`
  can be concrete. Do not require a clock time unless the question does.
- `REASON`: circular praise such as `because it is nice` remains generic.
- `BEFORE_STATE` and `NOW_STATE`: each must identify the relevant earlier or
  current state, not merely say that something changed.
- Optional depth slots: they must add an independent semantic unit rather than
  repeat the required answer.

`auditReasonKo` is required for both PASS and CHANGE. A PASS reason must name
the main question relationship or the most important audit conclusion; do not
use an uninformative repeated phrase such as "문제없음".

The parent reviewer records the final ACCEPTED or REJECTED decision for every
CHANGE in `semantic-audits/resolutions.json`. The aggregate validator checks
that every CHANGE is resolved and every accepted replacement is present in the
primary semantic review.
