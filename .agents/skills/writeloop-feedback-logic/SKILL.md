---
name: writeloop-feedback-logic
description: Use when working on WriteLoop question-answer feedback logic, mission-centered feedback, OpenAI feedback schema, coachMission/languageCorrections/refinementExpressions, feedback quality regression, mobile/web feedback UI alignment, or WriteLoop mobile App Store/Play Store build and release versioning guardrails.
---

# WriteLoop Feedback Logic

Use this skill to modify, debug, or evaluate the WriteLoop question-answer feedback system.

## Core Principle

Treat `topicAssessment.status` as the sole topic-relevance authority and the backend-confirmed canonical `targetSlot` as the source of truth for content feedback. The LLM returns one fixed-key `slotAssessments` object whose canonical slot keys contain only `evidence` and `support`; it does not choose slot status, the target, or completion. The backend derives `SATISFIED` from evidence plus no support, `GENERIC` from evidence plus one support item, and `MISSING` from no evidence plus one support item. Only derived `SATISFIED` slots count as present. Never encode off-topic state again in `answerBand`, `taskCompletion`, or a separate `onTopic` field.

Judge each slot from the original question plus `questionContract.slotContracts`: the shared `definition`, question-specific `semanticRole`, and question-specific `satisfiedWhen`. The English question-specific metadata is authoritative. Never fall back to only the shared definition when a question-specific contract is missing.

Every visible section must support that one mission:
- `coachMission`: one immediate action assembled by the backend for the confirmed target.
- `coachMove`: mobile/web top mission card derived from `coachMission`.
- `coachMove.languageCorrections`: all validated explained changes for a `LANGUAGE_FIX`, capped at 25.
- `refinementExpressions`: optional expression add-ons.
- `rewriteWorkspace`: rewrite input seeded from the mission.
- `modelAnswer`: quiet reference only, not the teaching plan.
- `visibleFeedback`: the exact exposed snapshot retained for answer history.

## First Files To Inspect

Read these before changing behavior:
- `apps/backend/src/main/java/com/writeloop/service/CanonicalFeedbackContract.java`
- `apps/backend/src/main/java/com/writeloop/service/FeedbackLearningContractPolicy.java`
- `apps/backend/src/main/java/com/writeloop/service/CanonicalFeedbackAssembler.java`
- `apps/backend/src/main/java/com/writeloop/service/OpenAiFeedbackClient.java`
- `apps/backend/src/main/java/com/writeloop/service/GeminiFeedbackClient.java`
- `apps/backend/src/main/java/com/writeloop/dto/FeedbackCoachMissionDto.java`
- `apps/backend/src/main/java/com/writeloop/dto/FeedbackCoachMoveDto.java`
- `apps/backend/src/main/java/com/writeloop/dto/FeedbackLanguageCorrectionDto.java`
- `apps/backend/src/main/java/com/writeloop/dto/FeedbackUiDto.java`
- `apps/mobile/src/app/practice/feedback.tsx`
- `apps/mobile/src/lib/types.ts`

Use `references/file-map.md` for a fuller map.

## Current Schema

Use `references/feedback-schema.md` when touching DTOs, OpenAI schema, parsers, or UI types.

Legacy schema guardrail: do not reintroduce these OpenAI output fields unless the feedback contract is intentionally redesigned:
- `score`
- `answerBand`
- `taskCompletion`
- `finishable`
- `meaningClarity`
- `grammarSeverity`
- `grammarImpact`
- `utteranceForm` as a standalone top-level field
- `correctedAnswer` as a standalone LLM diagnosis field
- `structureIssues`
- `correctionSupport`
- `missionDecision`
- `chosenType`
- `actionType`
- `fixPoints`
- `secondaryLearningPoints`
- `modelAnswerVariants`
- `nextStepPractice`

Current replacements:
- Use `languageAssessment.revisionSteps` as the LLM's sole language-revision authority.
- Each step carries one cumulative full `answerAfter` plus one explanation. The backend derives the final `revisedAnswer` and positioned correction row from the validated steps.
- Use `coachMove.languageCorrections` for all validated structure/grammar changes, capped at 25.
- Use `coachMission` / `coachMove` for the one-action rewrite mission.
- Use `refinementExpressions` for optional expression add-ons.

## Editing Rules

When changing feedback logic:
1. Update the common canonical schema and parser together; OpenAI and Gemini must use the same contract.
2. Keep LLM authority limited to topic relevance, `structureAssessment.status`, cumulative full-answer `languageAssessment.revisionSteps`,
   canonical `slotAssessments`, and reference content.
3. Keep the backend decision, `coachMission`, `coachMove`, `languageCorrections`, `revisedAnswer`, and rewrite UI aligned.
4. For content missions, require complete support for the exact target slot: English/Korean skeletons and at least two phrase choices.
5. Diff each cumulative `answerAfter` against the previous complete answer; never ask the LLM to identify a change by an ambiguous source substring.
6. Require steps in structure, blocking grammar, local grammar order, then left to right. Later steps must preserve earlier corrections, and overlapping repairs must be merged into the earlier step.
7. Allow at most 25 validated correction spans. Store all of them, show the first four by default, and place the remainder behind an expand/collapse control.
8. The public `revisedAnswer` may apply only changes represented by those correction rows. Do not silently fix additional errors.
9. Do not invent fallback teaching content when the LLM contract is incomplete. Language-step violations are unavailable without retry; retryable whole-response or slot-contract violations may be retried once.
10. Keep reusable phrases and optional starters in `refinementExpressions`.
   Grammar issues are reserved for actual `LOCAL` or `BLOCKING` errors; route optional naturalness alternatives exclusively to `refinementExpressions`.
11. Do not hide or rewrite `modelAnswer`; expose it as a quiet reference and evaluate quality through regression tests.

## Quality Rubric

Use `references/mission-quality-rubric.md` when judging whether feedback is good.

The short version:
- Derive exactly one `missionKind`: `TASK_RESET`, `LANGUAGE_FIX`, `SLOT`, or `COMPLETE`.
- Apply priority in this order: off-topic, fragment structure, blocking grammar, required slot, local grammar, depth slot, complete. Fragment and either grammar level are exposed as `LANGUAGE_FIX`.
- Treat `structureAssessment.status=FRAGMENT` as a structure problem only; complete but short or content-thin sentences stay `COMPLETE` and use slot feedback.
- Treat backend-derived `GENERIC` as unresolved and teach the same slot instead of selecting another detail slot.
- Never add `status` inside an LLM `slotAssessments` value; status is derived exclusively from the validated `evidence/support` shape.
- Never classify grammatically acceptable wording as a grammar issue merely because another expression is more idiomatic, common, concise, or specific.
- Use `TASK_RESET` for non-English, romanized Korean, meaningless, or off-topic answers.
- Always provide an example, bilingual skeleton, and at least two phrases when the learner is asked to add content.

## Question Prompt Quality Guardrail

When creating or revising WriteLoop question prompts:
- Do not make questions overly microscopic, such as repeatedly asking only for a color, shape, flavor, or tiny object preference.
- Prefer a learner-relevant situation, routine, choice, or reason that can produce a meaningful sentence in daily life.
- It is okay to keep beginner questions simple, but avoid templates where only one noun changes across many cards.
- If several prompts share a category, vary the communicative goal: habit, situation, reason, comparison, planning, memory, comfort, or problem-solving.
- Korean translations must match the English question directly and should not fall back to broad generic text.

## Mobile Store Build Guardrail

When preparing a WriteLoop mobile build, App Store upload, or Play Store AAB:
1. Bump the app version unless the user explicitly says not to.
2. Update `apps/mobile/app.json` `expo.version` for the user-facing version.
3. Increment iOS `expo.ios.buildNumber` for every App Store build.
4. Increment Android `versionCode` in `apps/mobile/android/app/build.gradle` for every Play Store upload.
5. Confirm the build command/profile is production (`eas build --profile production` or an equivalent release Gradle task), not a debug/dev run.
6. Confirm release builds point to production API, not local API. For EAS, check `apps/mobile/eas.json` `production.env`.
7. Confirm Android release uses `applicationId 'kr.writeloop'` without the debug-only `.dev` suffix from `applicationIdSuffix ".dev"`.
8. Before any production build, revert or disable dev/test-only flags and shortcuts, especially hardcoded test toggles such as `USE_TODAY_FOR_REFLECTION_TEST = true`.
9. After the store version is actually available to users, update server env `APP_VERSION_IOS_LATEST` or `APP_VERSION_ANDROID_LATEST` to the same user-facing version.
10. Raise `APP_VERSION_IOS_MINIMUM_SUPPORTED` or `APP_VERSION_ANDROID_MINIMUM_SUPPORTED` only when a forced update is intentional.
11. Report the final version, build number/versionCode, artifact path or EAS build ID, and whether the latest-version server env still needs deployment.

## Verification

For code changes, run:

```powershell
scripts/run-feedback-checks.ps1 -RepoRoot C:\WriteLoop
```

If the script is not available or needs manual execution, run:

```powershell
cd apps/backend
.\gradlew.bat compileJava
.\gradlew.bat test --tests com.writeloop.dto.FeedbackResponseContractTest --tests com.writeloop.service.CanonicalFeedbackContractTest --tests com.writeloop.service.CanonicalFeedbackAssemblerTest --tests com.writeloop.service.FeedbackLearningContractPolicyTest

cd ..\mobile
npm.cmd run typecheck

cd ..\..
npm.cmd run build --workspace @english-learning/frontend
```

For LLM quality changes, also follow `references/regression-workflow.md`.
