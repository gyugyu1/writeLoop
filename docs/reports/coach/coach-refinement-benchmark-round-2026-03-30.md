# Coach Refinement Benchmark Report

Date: 2026-03-30  
Scope: refinementExpressions quality, novelty filtering, hint fallback, and model-supplement behavior

## Goal

The goal of this round was to improve the quality of `refinementExpressions` shown to the learner after feedback.

We focused on three questions:

1. Is the main bottleneck the OpenAI prompt or backend post-processing?
2. Are we overusing raw `prompt_hints` as fallback?
3. Can we preserve personalization while reducing low-quality expressions such as:
   - Hangul mixed into English expressions
   - fragment-like chunks
   - ellipsis/starter-like items
   - comma-heavy list-like items

## Files Involved

- `apps/backend/src/main/java/com/writeloop/service/FeedbackService.java`
- `apps/backend/src/main/java/com/writeloop/service/OpenAiFeedbackClient.java`
- `apps/backend/src/test/java/com/writeloop/service/FeedbackServiceTest.java`
- `apps/backend/src/test/java/com/writeloop/service/OpenAiFeedbackClientTest.java`
- `scripts/feedback_refinement_benchmark.py`

## Benchmark Tool

We added a reusable benchmark runner:

- `scripts/feedback_refinement_benchmark.py`

What it does:

- fetches prompts from `/api/prompts`
- generates category-aligned synthetic learner answers
- calls `/api/feedback`
- parses backend refinement diagnostics from Docker logs
- aggregates expression quality signals and fallback behavior

## Diagnostic Logging Added

We added backend refinement diagnostics to `FeedbackService` so each problematic sanitization pass can show:

- `rawInput`
- `rawAccepted`
- `modelSupplement`
- `hintFallback`
- `rejected[recommendation, blank, duplicate, novelty]`
- final expression sources

This made it possible to separate:

- OpenAI generation quality
- backend novelty filtering
- hint fallback pressure

## 1000-Sample Audit

We first ran a large benchmark with 1000 generated requests.

High-level result:

- Requests: `1000`
- Success: `531`
- Failure: `469`

Important note:

- Most failures were not content-quality failures.
- They were OpenAI rate-limit failures surfaced as backend `502` with upstream `429`.

Among the 531 successful cases:

- logged issue rate: `88.14%`
- hint fallback used: `326`
- zero raw accepted: `175`
- average raw accepted when logged: `0.94`
- average hint fallback when logged: `1.25`
- average rejected novelty when logged: `1.82`

Key conclusion from the 1000-sample audit:

- The main bottleneck was not only the OpenAI prompt.
- The bigger problem was backend post-processing in `FeedbackService`, especially:
  - aggressive novelty rejection
  - frequent raw hint fallback

## 100-Sample Controlled Comparison

To make before/after comparisons deterministic, we ran repeated 100-sample benchmarks with:

- `seed=42`
- `workers=3`

### Baseline

Report:

- `C:\\Users\\lwd33\\AppData\\Local\\Temp\\feedback_refinement_benchmark_before_100.json`

Result:

- Requests: `100`
- Success: `92`
- Failure: `8`
- Average score: `74.33`
- Expressions per success: `2.99`
- Hangul in expression: `100 / 275`
- Generic discourse markers: `7 / 275`
- Fragment-like: `57 / 275`
- Ellipsis/starter-like: `52 / 275`
- Comma-heavy list-like: `49 / 275`
- Logged issue rate: `0.8478`
- Hint fallback: `54`
- Zero raw accepted: `30`

Interpretation:

- Too many expressions were being replaced by fallback.
- Quality was noisy.
- Raw hint-based outputs were still leaking into final results too often.

### Round V1: Relax novelty and restrict hint fallback

Changes:

- frame expressions were no longer rejected too aggressively by token overlap
- overlap threshold was tightened to reduce false-positive novelty rejection
- hint fallback was changed to run only when the final list became empty

Report:

- `C:\\Users\\lwd33\\AppData\\Local\\Temp\\feedback_refinement_benchmark_after_100.json`

Result:

- Requests: `100`
- Success: `91`
- Failure: `9`
- Average score: `78.71`
- Expressions per success: `2.15`
- Hangul in expression: `51 / 196`
- Generic discourse markers: `11 / 196`
- Fragment-like: `39 / 196`
- Ellipsis/starter-like: `14 / 196`
- Comma-heavy list-like: `35 / 196`
- Logged issue rate: `0.7582`
- Hint fallback: `19`
- Zero raw accepted: `43`

Interpretation:

- Quality improved.
- Raw hint fallback pressure dropped sharply.
- But expression count dropped too much.
- We improved precision, but lost too much coverage.

### Round V2: Strengthen model/corrected-answer supplement

Changes:

- expanded supplement extraction patterns in `FeedbackService`
- model supplement now extracts frames such as:
  - `One challenge I often face with [noun] is [issue].`
  - `What I like most about [thing] is that [detail].`
  - `It helps me [verb] and [verb].`
  - `This makes it easier to [verb].`
  - `When I want to [verb], I [action].`
- supplement extraction now also scans `correctedAnswer`
- clause-level extraction was added as a secondary supplement path

Report:

- `C:\\Users\\lwd33\\AppData\\Local\\Temp\\feedback_refinement_benchmark_after_100_v2.json`

Result:

- Requests: `100`
- Success: `89`
- Failure: `11`
- Average score: `81.24`
- Expressions per success: `2.69`
- Hangul in expression: `6 / 239`
- Generic discourse markers: `15 / 239`
- Fragment-like: `35 / 239`
- Ellipsis/starter-like: `4 / 239`
- Comma-heavy list-like: `5 / 239`
- Logged issue rate: `0.4045`
- Hint fallback: `2`
- Zero raw accepted: `2`
- Average raw accepted when logged: `1.58`

Interpretation:

- This was the best overall version.
- We recovered expression count without bringing raw hint fallback back.
- OpenAI + model supplement combination became much stronger.
- Hint fallback was almost eliminated.

## Generic Discourse Marker Experiment

We then tried to further reduce generic discourse markers such as:

- `On the positive side`
- `However`
- `Overall`

The assumption was that these might be overrepresented, especially outside balanced-opinion prompts.

### What We Learned

The data showed that generic markers were already concentrated almost entirely in `BALANCED_OPINION`.

They were not the main issue in:

- `PREFERENCE`
- `OPINION_REASON`
- `GENERAL`
- `GOAL_PLAN`

### Round V3 and V4

Reports:

- `C:\\Users\\lwd33\\AppData\\Local\\Temp\\feedback_refinement_benchmark_after_100_v3.json`
- `C:\\Users\\lwd33\\AppData\\Local\\Temp\\feedback_refinement_benchmark_after_100_v4.json`

These attempts tried stronger generic-marker suppression through prompt constraints and/or backend filtering.

Representative outcomes:

- V3 average score: `76.11`
- V4 average score: `72.85`

Both were worse than V2.

Interpretation:

- This line of tuning was too aggressive.
- It reduced flexibility and hurt overall quality more than it helped.
- The system got worse even though generic markers moved a little.

## Final Decision

We reverted the over-aggressive generic-marker experiment and kept the stronger V2 direction.

Current preferred approach:

1. keep the relaxed novelty logic
2. keep hint fallback as near-last-resort only
3. keep strong model/corrected-answer supplement extraction
4. do not add broad category-wide generic marker suppression for now

## Current Best State

The best observed state in this round is represented by the V2 benchmark result:

- average score `81.24`
- hint fallback `2`
- zero raw accepted `2`
- issue rate `0.4045`
- very low Hangul/noisy expression contamination

This is the version we should use as the reference point for future refinement work.

## Tests Added / Updated

We added or updated tests to protect the new behavior:

- `FeedbackServiceTest`
  - viable OpenAI refinements should not be topped up by raw hints
  - additional reusable frames should be extractable from `modelAnswer`
- `OpenAiFeedbackClientTest`
  - prompt instructions remain explicit about novelty, non-copying of hints, and content-bearing expansions

## Recommended Next Steps

The next improvement target should not be raw hint fallback anymore.

Recommended focus:

1. Improve OpenAI first-pass consistency for low-performing prompt families.
2. Improve `modelAnswer` generation so it naturally contains 2 to 4 extractable reusable chunks more reliably.
3. Add category-specific benchmark slices for:
   - `PREFERENCE`
   - `GOAL_PLAN`
   - `ROUTINE`
4. Keep using 100-sample fixed-seed comparisons before any larger 1000-sample audit.

## Summary

This round established three important conclusions:

1. The original main bottleneck was backend novelty filtering plus raw hint fallback pressure.
2. The biggest successful improvement came from preserving OpenAI output better and strengthening supplement extraction from `modelAnswer` and `correctedAnswer`.
3. Additional generic-marker suppression looked promising at first, but was not worth the regression and should not be kept.
