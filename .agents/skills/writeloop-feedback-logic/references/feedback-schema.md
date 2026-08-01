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

Question-answer diagnosis is stateless. The LLM input contains the current
`learnerAnswer`, question metadata, slot contract, and prompt hints only. It
must not contain `previousAnswer`, `previousCoachingSummary`, or `attemptIndex`.
The backend may continue storing `previous_answer` in
`feedback_diagnosis_logs` for operational analysis, but that value is never an
LLM diagnosis input.

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
  - This object does not carry repair text. The full revision lives only in `languageAssessment`.
- `languageAssessment`
  - `revisionSteps` contains zero to 25 cumulative full-answer correction steps.
  - Each step contains only `kind`, `answerAfter`, and `reasonKo`.
  - `answerAfter` is the complete learner answer after applying that step, never a fragment, patch, example, or model answer.
  - `kind` is `STRUCTURE`, `GRAMMAR_BLOCKING`, or `GRAMMAR_LOCAL`.
  - The first step starts from the untouched learner answer. Every later step starts from the prior `answerAfter` and preserves every earlier correction exactly.
  - Steps are ordered by `STRUCTURE`, `GRAMMAR_BLOCKING`, and `GRAMMAR_LOCAL`, then left to right within the same kind.
  - One step may contain multiple low-level diff spans only when they form one local construction with one teaching explanation. The backend exposes their smallest contiguous envelope as one correction card.
  - Unrelated corrections require separate cumulative steps. Overlapping corrections are merged into the earlier, higher-priority step.
  - If more than 25 correction groups are possible, apply and explain only the first 25 and leave unselected errors unchanged.
  - If no language correction is needed, return an empty `revisionSteps` array.
  - Grammatically acceptable wording must not be revised merely because another version is more natural, common, concise, or specific.
- `slotAssessments`
  - A fixed-key object with exactly one property for every canonical slot in the question contract.
  - Each slot value contains only `evidence` and a `support` array; the nested value does not repeat the slot code or return a status.
  - Evidence must quote the untouched learner answer. If a language correction overlaps the evidence, keep the learner's original wording here; corrected text belongs only in `languageAssessment.revisionSteps`.
  - Non-empty learner-answer evidence and zero support items -> the backend derives `SATISFIED`.
  - Non-empty learner-answer evidence and exactly one support item -> the backend derives `GENERIC`.
  - Empty evidence and exactly one support item -> the backend derives `MISSING`.
  - Any other evidence/support shape is invalid and must be rejected.
  - Each support includes `title`, `whyKo`, `instructionKo`, `skeletonEn`, and `skeletonKo`.
  - `suggestedPhrases` contains 2-4 usable English phrases with Korean meanings.
- `strengths`
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
2. `FRAGMENT` utterance form -> `LANGUAGE_FIX`
3. `BLOCKING` grammar -> `LANGUAGE_FIX`
4. unresolved required slot -> `SLOT`
5. `LOCAL` grammar -> `LANGUAGE_FIX`
6. unresolved required depth slot -> `SLOT`
7. otherwise -> `COMPLETE`

Optional naturalness alternatives belong only in `refinementExpressions` and do not block completion.
The LLM must still return at least two items, with no arbitrary maximum: include one
vocabulary/collocation expression and one sentence-frame/connector expression, then add other
genuinely distinct useful options. All must preserve the learner's stated facts and meaning,
must not duplicate wording already used by the learner, and must not be near-duplicates of each other.

Only backend-derived `SATISFIED` counts as present. Backend-derived `GENERIC` remains unresolved, and the backend selects that same slot rather than inventing a different target.

The backend then derives:

- `chosenSlot`
- `presentSlots` and `missingSlots`
- `coachMission`
- `coachMove` and `coachMove.targetSlot`
- `coachMove.languageCorrections`
- `revisedAnswer`
- `rewriteWorkspace`
- `loopComplete`

If slot evidence differs from the learner answer only because it quotes text from a cumulative revision step, the backend may walk the validated steps backward and restore it only when one unambiguous original span results. It never uses fuzzy matching or invents evidence. Slot/support violations remain eligible for one whole-response contract retry. Invalid language-step ordering, overlap, preservation, or completeness is rejected immediately without retry or backend-authored teaching content.

## Diagnosis Persistence

`feedback_diagnosis_logs` is the single authority for both successful and failed
LLM feedback executions.

- `execution_status` is `SUCCESS` or `FAILED`.
- `input_fingerprint` identifies repeated runs of the same prompt and learner answer.
- Initial and one retry output are stored separately in
  `diagnosis_response_body_json` and `regeneration_response_body_json`.
- Contract detection, retry outcome, original error, final error, provider
  configuration, and elapsed time are stored on the same row.
- Provider-reported input, cached-input, output, reasoning, and total tokens
  are stored on the same row. When one contract retry occurs, each value is
  the sum of the initial and retry calls; unavailable provider fields stay null.
- A successful row can reference `answer_attempt_id`; a failed row has no answer
  attempt because no user-visible feedback was created.
- Failed rows are saved in an independent transaction so the calling feedback
  transaction can roll back without erasing the diagnostic evidence.
- Raw internal diagnostic output has no automatic expiration policy.

Do not recreate `feedback_contract_execution_logs` or split execution outcomes
across another authority table.

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
- `LANGUAGE_FIX` shows the complete learner answer as `before` and the validated full `revisedAnswer` as `after`.
- `coachMove.languageCorrections` contains every validated correction row, up to 25.
- The backend compares each cumulative `answerAfter` with the preceding full answer and derives one positioned correction row per validated revision step.
- When one step has several low-level diff spans, the row uses the smallest contiguous source/revised envelope covering them all.
- Mobile and web show the first four correction rows initially. Any remaining rows stay stored and are available through an expand/collapse control.
- `revisedAnswer` applies exactly the listed corrections and no hidden fixes. Errors outside the 25-item technical cap remain untouched and are diagnosed again on the learner's next submission.
- `refinementExpressions` contain at least two generated add-ons, with no arbitrary maximum, for grammatically acceptable alternative wording.
  Their use is optional for the learner even though their presence is required in the LLM output.
- `modelAnswer` and `modelAnswerKo` are visible reference content, not completion authorities.
- Question-answer feedback does not expose a numeric score.

Retired diagnosis columns were removed from the operational table. Historical
JSON payloads may still contain older fields, but new requests must not write or
publish them.
