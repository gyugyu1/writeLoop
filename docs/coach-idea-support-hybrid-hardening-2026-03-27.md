# Coach IDEA_SUPPORT / Hybrid Hardening

- Date: 2026-03-27
- Scope: `IDEA_SUPPORT` compact question handling, `hybrid` secondary-intent injection

## Why This Round Was Needed

The coach engine had two recurring weaknesses.

1. Compact idea-support questions were being misread.
   - Examples:
     - `이 질문 이유 아이디어`
     - `사례 뭐 넣지`
   - These should be treated as `IDEA_SUPPORT`, but they were often interpreted as generic writing support or fell through to starter-like fallback behavior.

2. Hybrid meaning-support questions were under-injecting the secondary support intent.
   - Examples:
     - `친구 만난다고 말하고 싶어 예시도 같이 알려줘`
     - `메이드카페에 가보고 싶다고 하고 싶은데 첫 문장도 추천해줘`
     - `온라인 관계가 더 자연스럽다고 말하고 싶은데 반대 의견 표현도 있으면 좋겠어`
   - The engine was usually getting the meaning part right, but the secondary support intent (`example`, `structure`, `balance`) was often too weak or missing in the final expression list.

## What Changed

### 1. Expanded compact `IDEA_SUPPORT` detection

File:
- [CoachQueryAnalyzer.java](/C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/CoachQueryAnalyzer.java)

Changes:
- Switched `detectLookup(...)` to use expanded helpers:
  - `hasExpandedStructureCue(...)`
  - `hasExpandedIdeaSupportCue(...)`
  - `hasExpandedHybridCompanionCue(...)`
- Added broader compact-question detection for idea requests:
  - `이 질문 이유 아이디어`
  - `사례 뭐 넣지`
  - `근거가 뭐`
  - `포인트가 뭐`
  - `뭐 넣지`
  - `뭐 넣을까`
- Added stronger context cues:
  - `이 질문`
  - `답에`
  - `넣을`
  - `붙일`
  - `쓸 만한`
- Added request-verb cues:
  - `알려줘`
  - `추천`
  - `정리`
  - `뽑아`
  - `brainstorm`

### 2. Added phrase-support guardrails

File:
- [CoachQueryAnalyzer.java](/C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/CoachQueryAnalyzer.java)

Changes:
- Added `looksLikeExpandedPhraseSupportRequest(...)`
- Added `looksLikeSupportActionQuestion(...)`

Purpose:
- Prevent phrase-support questions from being incorrectly pulled into `IDEA_SUPPORT`
- Examples this is meant to protect:
  - `예시 하나 붙일 때 표현 알려줘`
  - `쓸 때 표현 알려줘`
  - `연결 표현 알려줘`
  - `첫 문장 표현 알려줘`

### 3. Expanded structure cue handling

File:
- [CoachQueryAnalyzer.java](/C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/CoachQueryAnalyzer.java)

Changes:
- Added `구성`, `틀`, `무엇부터`, `framework`, `outline`
- Added compact structure patterns such as:
  - `순서알려`
  - `구조알려`
  - `가이드줘`

Purpose:
- Keep structure questions in `WRITING_SUPPORT`
- Avoid misclassifying `의견 이유 예시 순서 알려줘` as idea-support

### 4. Made hybrid support injection more intentional

File:
- [CoachService.java](/C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/CoachService.java)

Changes:
- Replaced simple hybrid support merge with:
  - `buildFocusedHybridSupportExpressions(...)`
  - `resolveHybridSupportPriority(...)`
- Secondary support intents are now prioritized explicitly from the user question:
  - `example`
  - `structure`
  - `balance`
  - `comparison`
  - `detail`
  - `reason`
  - `opinion`

Important implementation detail:
- Hybrid support candidates are no longer appended in large blocks.
- The engine now injects one expression per prioritized support category first, using:
  - `appendExpressionsUpTo(..., 1)`

This prevents one support category from consuming all available slots before another intended support category appears.

## Behavior After the Change

### Compact idea-support

Expected now:
- `이 질문 이유 아이디어`
  - classified as `IDEA_SUPPORT`
- `사례 뭐 넣지`
  - classified as `IDEA_SUPPORT`

### Hybrid support injection

Expected now:
- `친구 만난다고 말하고 싶어 예시도 같이 알려줘`
  - meaning expressions like `meet my friends`
  - plus example-support expressions like `For example, ...` or `For instance, ...`

- `메이드카페에 가보고 싶다고 하고 싶은데 첫 문장도 추천해줘`
  - meaning expressions like `I want to visit maid cafe.`
  - plus structure-support expressions like `First, ...`

- `온라인 관계가 더 자연스럽다고 말하고 싶은데 반대 의견 표현도 있으면 좋겠어`
  - state-change meaning expressions with `more natural`
  - plus balance/comparison expressions like:
    - `On the one hand, ...`
    - `On the other hand, ...`
    - `Overall, ...`
    - `In contrast, ...`

## Tests Added / Updated

Files:
- [CoachQueryAnalyzerTest.java](/C:/WriteLoop/apps/backend/src/test/java/com/writeloop/service/CoachQueryAnalyzerTest.java)
- [CoachServiceTest.java](/C:/WriteLoop/apps/backend/src/test/java/com/writeloop/service/CoachServiceTest.java)

Added or updated coverage for:
- compact reason idea label
- compact case question
- structure question containing `reason/example` words
- hybrid example injection
- hybrid structure injection
- hybrid balance injection

## Verification

Commands run:

```powershell
cmd /c gradlew.bat test --tests com.writeloop.service.CoachQueryAnalyzerTest --tests com.writeloop.service.CoachServiceTest
cmd /c gradlew.bat test --tests com.writeloop.service.CoachBatchAuditTest
```

Result:
- test suite passed
- batch audit passed

## Audit Result Snapshot

Source:
- [summary.md](/C:/WriteLoop/apps/backend/build/reports/coach-batch-audit/summary.md)

Current result:
- Total cases: `1000`
- Suspicious cases: `36`
- Suspicious rate: `3.6%`

Strongly improved buckets:
- `reason_idea_support`: `0.0%`
- `example_idea_support`: `0.0%`
- `growth_lookup`: `0.0%`
- `state_change_lookup`: `0.0%`

Still remaining:
- `example_support`: `20.0%`
- `structure_support`: `10.0%`
- `balance_support`: `20.0%`
- `hybrid_ambiguous`: `13.3%`

## Remaining Improvement Opportunities

1. `example_support`
- Some phrase-support questions still drift into idea-support.
- Next fix should narrow `IDEA_SUPPORT` when the user clearly asks for phrasing around attaching examples.

2. `structure_support`
- Some structure questions still return weak generic support expressions.
- Next fix should inject stronger structure-specific starters earlier.

3. `balance_support`
- Some balance questions are still being interpreted as meaning lookup.
- Next fix should strengthen balance-first support detection for `균형`, `찬반`, `장단점` style wording.

4. `hybrid_ambiguous`
- The engine now blends support much better, but mixed requests still need more precise subtype steering.
- Good next step:
  - stronger prompt-level support subtype selection
  - per-subtype quota in hybrid results

## Files Changed In This Round

- [CoachQueryAnalyzer.java](/C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/CoachQueryAnalyzer.java)
- [CoachService.java](/C:/WriteLoop/apps/backend/src/main/java/com/writeloop/service/CoachService.java)
- [CoachQueryAnalyzerTest.java](/C:/WriteLoop/apps/backend/src/test/java/com/writeloop/service/CoachQueryAnalyzerTest.java)
- [CoachServiceTest.java](/C:/WriteLoop/apps/backend/src/test/java/com/writeloop/service/CoachServiceTest.java)

