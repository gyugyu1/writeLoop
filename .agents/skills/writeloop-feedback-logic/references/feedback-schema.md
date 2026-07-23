# Current Feedback Schema

This document describes the canonical question-answer feedback contract shared by OpenAI and Gemini.

## Authority Boundary

The LLM diagnoses and supplies grounded teaching material. It does not decide the final mission or completion.

## Question Input Contract

The original English question is always sent together with
`questionContract.slotContracts`. Each configured slot is a fixed key whose
value contains:

- `definition`: the shared canonical slot definition.
- `semanticRole`: the meaning and relationship that slot has in this exact
  question.
- `satisfiedWhen`: a paraphrase-tolerant semantic condition for fulfillment.

The English question-specific fields stored as `semantic_role_en` and
`satisfied_when_en` are authoritative. Korean counterparts are retained in the
database for human review but are not sent as decision criteria to the LLM.

The LLM must evaluate the original question, common definition, semantic role,
and satisfaction condition together. Evidence must be the smallest exact
learner-answer span that proves the full relationship, not merely a matching
keyword or entity. If any configured slot lacks complete question-specific
metadata, feedback generation is unavailable; the backend must not fall back
to the common definition alone.

The LLM output has exactly these top-level fields:

- `topicAssessment`
  - `status`: `ON_TOPIC` or `OFF_TOPIC`
  - `reasonKo`: concise evidence for the topic judgment
- `structureAssessment`
  - `status` is `COMPLETE` when every answer-bearing segment forms an independent sentence, otherwise `FRAGMENT`.
  - `repair` contains 0-1 atomic structure repairs.
  - `COMPLETE` and every `OFF_TOPIC` answer require an empty `repair` array.
  - An `ON_TOPIC` `FRAGMENT` requires exactly one repair with `originalText`, `correctedAnswer`, `reasonKo`, and `instructionKo`.
  - `originalText` must equal the complete learner answer exactly, preserving case and punctuation.
  - `correctedAnswer` is the one authoritative, minimally corrected full answer and preserves the learner's meaning and facts.
- `grammarIssues`
  - `impact`, `code`, `originalText`, `revisedText`, `reasonKo`, `instructionKo`
  - `impact` is `LOCAL` or `BLOCKING` for that exact correction.
  - An empty list means no correction is needed; the backend derives the aggregate impact as `NONE`.
  - For multiple issues, the backend derives the strongest impact in this order: `BLOCKING`, `LOCAL`.
  - `originalText` must be an exact, case-sensitive learner-answer substring.
  - `revisedText` is the direct replacement for that substring.
  - Grammatically acceptable wording must not appear here merely because another version is more natural, common, concise, or specific.
- `slotAssessments`
  - A fixed-key object with exactly one property for every canonical slot in the question contract.
  - Each slot value contains only `evidence` and a `support` array; the nested value does not repeat the slot code or return a status.
  - Evidence must quote the untouched learner answer. If a grammar correction overlaps the evidence, keep the learner's original wording here and put the revised wording only in `grammarIssues`.
  - Non-empty learner-answer evidence and zero support items -> the backend derives `SATISFIED`.
  - Non-empty learner-answer evidence and exactly one support item -> the backend derives `GENERIC`.
  - Empty evidence and exactly one support item -> the backend derives `MISSING`.
  - Any other evidence/support shape is invalid and must be rejected.
  - Each support includes `title`, `whyKo`, `instructionKo`, `exampleEn`, `skeletonEn`, `skeletonKo`, `targetHintKo`.
  - `suggestedPhrases` contains 2-4 usable English phrases with Korean meanings.
- `strengths`
- `usedExpressions`
- `refinementExpressions`
- `modelAnswer`
- `modelAnswerKo`

Do not add LLM fields for backend decisions or duplicate diagnoses:

- `score`
- `answerBand`
- `taskCompletion`
- `finishable`
- `meaningClarity`
- `grammarSeverity`
- `grammarImpact`
- `utteranceForm`
- standalone `correctedAnswer`
- `structureIssues`
- `minimalCorrection`
- `correctionSupport`
- `missionDecision`
- `chosenType`
- `actionType`
- `chosenSlot`
- `presentSlots`
- `missingSlots`
- `fixPoints`
- `slotAssessments.<slot>.status`

## Backend Decision

The backend validates the mechanical contract, computes present/missing slots from DB metadata, and derives one `missionKind` in this order:

1. `OFF_TOPIC` -> `TASK_RESET`
2. `FRAGMENT` utterance form -> `STRUCTURE_FIX`
3. `BLOCKING` grammar -> `GRAMMAR_FIX`
4. unresolved required slot -> `SLOT`
5. `LOCAL` grammar -> `GRAMMAR_FIX`
6. unresolved required depth slot -> `SLOT`
7. otherwise -> `COMPLETE`

Optional naturalness alternatives belong only in `refinementExpressions` and do not block completion.

Only backend-derived `SATISFIED` counts as present. Backend-derived `GENERIC` remains unresolved, and the backend selects that same slot rather than inventing a different target.

The backend then derives:

- `chosenSlot`
- `presentSlots` and `missingSlots`
- `coachMission`
- `coachMove` and `coachMove.targetSlot`
- `fixPoints`
- `rewriteWorkspace`
- `loopComplete`

If slot evidence differs from the learner answer only by one or more declared grammar correction pairs, the backend may reverse those corrections only when they produce one unambiguous exact original span. It never uses fuzzy matching or invents evidence. All other evidence/support violations, missing bilingual skeletons, missing phrase choices, unusable structure repairs, and unusable grammar evidence are rejected without backend-authored teaching content.

## Canonical Slots

DB task metadata, the LLM schema, and backend policy use the same codes:

- `ACTION`
- `CHOICE`
- `GOAL`
- `PROBLEM`
- `OPINION`
- `PLAN`
- `SOLUTION`
- `ADVANTAGE`
- `DISADVANTAGE`
- `BEFORE_STATE`
- `NOW_STATE`
- `CHANGE_CAUSE`
- `ADDITIONAL_ACTION`
- `SPECIFIC_TIME`
- `PLACE`
- `REASON`
- `DETAIL`
- `EXAMPLE`
- `FEELING`
- `RESULT`

Do not write new metadata with `MAIN_ANSWER`, `ACTIVITY`, `TIME_OR_PLACE`, or `SITUATION`. They remain read-only migration aliases.

## UI Contract

- `coachMove.focusType` carries backend `missionKind`, not an LLM-selected category.
- `coachMove.targetSlot` preserves the exact canonical content slot for `SLOT` and `TASK_RESET`.
- `STRUCTURE_FIX` uses `structureAssessment.repair.originalText` as the before value and the same repair's `correctedAnswer` as the after value. It exposes no separate grammar correction in that attempt.
- `fixPoints` are backend-derived from the selected slot support, grounded structure issues, or grounded grammar issues.
- `refinementExpressions` remain optional add-ons for grammatically acceptable alternative wording.
- `modelAnswer` and `modelAnswerKo` are visible reference content, not completion authorities.
- Question-answer feedback does not expose a numeric score.

Historical DB columns and stored JSON may still contain retired fields during migration. New requests must not write or publish them.
