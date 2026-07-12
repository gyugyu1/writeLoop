---
name: writeloop-feedback-logic
description: Use when working on WriteLoop question-answer feedback logic, mission-centered feedback, OpenAI feedback schema, coachMission/fixPoints/refinementExpressions, feedback quality regression, mobile/web feedback UI alignment, or WriteLoop mobile App Store/Play Store build and release versioning guardrails.
---

# WriteLoop Feedback Logic

Use this skill to modify, debug, or evaluate the WriteLoop question-answer feedback system.

## Core Principle

Treat `coachMission` as the single source of truth for the learner's next action.

Every visible section must support that one mission:
- `coachMission`: one immediate action chosen by the LLM.
- `coachMove`: mobile/web top mission card derived from `coachMission`.
- `fixPoints`: detailed feedback and correction cards.
- `refinementExpressions`: optional expression add-ons.
- `rewriteWorkspace`: rewrite input seeded from the mission.
- `modelAnswer`: quiet reference only, not the teaching plan.

## First Files To Inspect

Read these before changing behavior:
- `apps/backend/src/main/java/com/writeloop/service/OpenAiFeedbackClient.java`
- `apps/backend/src/main/java/com/writeloop/dto/FeedbackCoachMissionDto.java`
- `apps/backend/src/main/java/com/writeloop/dto/FeedbackCoachMoveDto.java`
- `apps/backend/src/main/java/com/writeloop/dto/FeedbackUiDto.java`
- `apps/mobile/src/app/practice/feedback.tsx`
- `apps/mobile/src/lib/types.ts`

Use `references/file-map.md` for a fuller map.

## Current Schema

Use `references/feedback-schema.md` when touching DTOs, OpenAI schema, parsers, or UI types.

Legacy schema guardrail: do not reintroduce these OpenAI output fields unless the feedback contract is intentionally redesigned:
- `secondaryLearningPoints`
- `modelAnswerVariants`
- `nextStepPractice`

Current replacements:
- Use `fixPoints` for detailed feedback.
- Use `coachMission` / `coachMove` for the one-action rewrite mission.
- Use `refinementExpressions` for optional expression add-ons.

## Editing Rules

When changing feedback logic:
1. Update OpenAI schema and parser together.
2. Keep `missionDecision`, `coachMission`, the first `fixPoint`, and rewrite UI aligned.
3. For add-on missions, do not force a before/after comparison.
4. For grammar or expression correction missions, require short aligned `originalText` and `revisedText`.
5. Keep detailed explanations in `fixPoints`.
6. Keep reusable phrases and optional starters in `refinementExpressions`.
7. Do not make `modelAnswer` the primary plan.
8. Prefer OpenAI-focused changes; do not expand Gemini unless the task explicitly asks for provider parity.

## Quality Rubric

Use `references/mission-quality-rubric.md` when judging whether feedback is good.

The short version:
- Pick one actionable mission.
- Prefer content/detail/reason missions for understandable but thin answers.
- Prefer grammar missions only when meaning or rewrite success is blocked.
- Use `TASK_RESET` for non-English, romanized Korean, meaningless, or off-topic answers.
- Always provide an example sentence when the learner is asked to add content.

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
.\gradlew.bat test --tests com.writeloop.dto.FeedbackResponseContractTest --tests com.writeloop.service.FeedbackUiComposerTest

cd ..\mobile
npm.cmd run typecheck

cd ..\..
npm.cmd run build --workspace @english-learning/frontend
```

For LLM quality changes, also follow `references/regression-workflow.md`.
