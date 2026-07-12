# WriteLoop Feedback File Map

Use this map to rebuild context quickly before editing feedback behavior.

## Backend: OpenAI Feedback

- `apps/backend/src/main/java/com/writeloop/service/OpenAiFeedbackClient.java`
  - OpenAI request schema.
  - Prompt instructions.
  - LLM response parsing.
  - Mission selection guardrails.
  - `fixPoints`, `refinementExpressions`, `coachMission` alignment.

- `apps/backend/src/main/java/com/writeloop/service/FeedbackGenerationModels.java`
  - Shared internal records used by feedback providers.
  - Some legacy provider compatibility may remain here; do not assume fields are public contract.

- `apps/backend/src/main/java/com/writeloop/service/FeedbackService.java`
  - Attaches loop experience.
  - Converts mission/fix data into `coachMove`, `rewriteWorkspace`, completion, and reveal-later UI.

- `apps/backend/src/main/java/com/writeloop/service/FeedbackUiComposer.java`
  - Deterministic UI composition and fallback logic.
  - Useful when feedback UI behaves differently from raw OpenAI output.

## Backend: DTO Contract

- `apps/backend/src/main/java/com/writeloop/dto/FeedbackResponseDto.java`
  - Public feedback response.

- `apps/backend/src/main/java/com/writeloop/dto/FeedbackUiDto.java`
  - Public `ui` payload. Current public detailed feedback field is `fixPoints`.

- `apps/backend/src/main/java/com/writeloop/dto/FeedbackCoachMissionDto.java`
  - Raw mission returned by OpenAI.

- `apps/backend/src/main/java/com/writeloop/dto/FeedbackCoachMoveDto.java`
  - Public top-card mission displayed by apps.

## Mobile UI

- `apps/mobile/src/app/practice/feedback.tsx`
  - Standalone feedback page.
  - Top mission card, rewrite section, detailed feedback toggle.

- `apps/mobile/src/components/practice-feedback-content.tsx`
  - Embedded feedback content component.

- `apps/mobile/src/lib/types.ts`
  - Mobile feedback response contract.

## Web UI

- `apps/frontend/app/answer-loop.tsx`
  - Web answer loop and feedback rendering.

- `apps/frontend/lib/types.ts`
  - Web feedback response contract.

## Tests

- `apps/backend/src/test/java/com/writeloop/dto/FeedbackResponseContractTest.java`
  - Public response contract and legacy-field serialization guard.

- `apps/backend/src/test/java/com/writeloop/service/FeedbackUiComposerTest.java`
  - UI composer behavior and fallback checks.
