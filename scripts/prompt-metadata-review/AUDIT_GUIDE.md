# Independent Prompt Metadata Audit Guide

Audit every assigned question against its proposed review. Read the complete question and the complete metadata object. Do not assume a row is correct because neighboring questions look similar.

## Check every row for

- `answerMode` describes the response structure the learner must produce, not merely a topic word.
- Every separately requested idea is in `requiredSlots`.
- No required slot merely restates context already supplied by the question.
- Required and optional slots use the canonical definitions in `REVIEW_GUIDE.md`.
- Optional slots are relevant to this exact question and ordered by usefulness.
- `minimumDepthSlots` is 0, 1, or 2 and is appropriate for the wording, breadth, required-slot count, and difficulty.
- The rationale accurately explains the actual decision.

Pay special attention to:

- `both sides`, advantages/disadvantages, positive/negative, compare/contrast.
- problem plus handling/response/solution.
- goal plus plan/preparation/steps.
- before/now/change cause.
- questions that ask only for a time, place, reason, feeling, action, or example.
- hypothetical actions mistakenly classified as preferences.
- question premises mistakenly required in the learner answer.
- B/C questions left at depth 0 despite allowing a one-clause minimal answer.
- I/A questions overburdened with depth 2.

## Output

Write one JSON object that records coverage and contains only the issues found. Use this shape:

```json
{
  "auditedParts": ["01", "02"],
  "auditedCount": 241,
  "issues": [
    {
      "promptId": "prompt-id",
      "severity": "ERROR",
      "fields": ["answerMode", "requiredSlots"],
      "recommended": {
        "answerMode": "GENERAL_DESCRIPTION",
        "requiredSlots": ["ACTION"],
        "optionalSlots": ["REASON", "PLACE", "FEELING", "RESULT"],
        "minimumDepthSlots": 1
      },
      "reason": "The learner produces a hypothetical action, not a preference or choice between options."
    }
  ]
}
```

Use `ERROR` for behavior-changing mistakes and `WARNING` for a defensible but questionable choice. If a row is correct, do not include it. Preserve canonical slot names. Produce valid UTF-8 JSON without a Markdown wrapper.

`auditedCount` must equal the number of source questions in the assigned parts, including rows with no issue. Do not report a part as audited unless every question in that part was read individually.
