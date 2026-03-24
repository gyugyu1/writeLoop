import type { FeedbackInlineSegment } from "./types";

export type RenderedInlineFeedbackSegment =
  | { kind: "equal"; text: string }
  | { kind: "replace"; removed: string; added: string }
  | { kind: "add"; text: string }
  | { kind: "remove"; text: string };

type DiffOperation =
  | { kind: "equal"; text: string }
  | { kind: "add"; text: string }
  | { kind: "remove"; text: string };

function tokenize(text: string): string[] {
  const tokens = text.match(/\S+\s*/g);
  return tokens ?? (text ? [text] : []);
}

function buildDiffOperations(original: string[], corrected: string[]): DiffOperation[] {
  const dp = Array.from({ length: original.length + 1 }, () =>
    Array<number>(corrected.length + 1).fill(0)
  );

  for (let originalIndex = original.length - 1; originalIndex >= 0; originalIndex -= 1) {
    for (let correctedIndex = corrected.length - 1; correctedIndex >= 0; correctedIndex -= 1) {
      dp[originalIndex][correctedIndex] =
        original[originalIndex] === corrected[correctedIndex]
          ? dp[originalIndex + 1][correctedIndex + 1] + 1
          : Math.max(dp[originalIndex + 1][correctedIndex], dp[originalIndex][correctedIndex + 1]);
    }
  }

  const operations: DiffOperation[] = [];
  let originalIndex = 0;
  let correctedIndex = 0;

  while (originalIndex < original.length && correctedIndex < corrected.length) {
    if (original[originalIndex] === corrected[correctedIndex]) {
      operations.push({ kind: "equal", text: original[originalIndex] });
      originalIndex += 1;
      correctedIndex += 1;
      continue;
    }

    if (dp[originalIndex + 1][correctedIndex] >= dp[originalIndex][correctedIndex + 1]) {
      operations.push({ kind: "remove", text: original[originalIndex] });
      originalIndex += 1;
    } else {
      operations.push({ kind: "add", text: corrected[correctedIndex] });
      correctedIndex += 1;
    }
  }

  while (originalIndex < original.length) {
    operations.push({ kind: "remove", text: original[originalIndex] });
    originalIndex += 1;
  }

  while (correctedIndex < corrected.length) {
    operations.push({ kind: "add", text: corrected[correctedIndex] });
    correctedIndex += 1;
  }

  return operations;
}

function appendEqualSegment(segments: RenderedInlineFeedbackSegment[], text: string) {
  const previous = segments.at(-1);
  if (previous?.kind === "equal") {
    previous.text += text;
    return;
  }
  segments.push({ kind: "equal", text });
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ");
}

function normalizeSuggestionText(text: string): string {
  return collapseWhitespace(text).trim();
}

function canInsertReadableSpace(previousText: string, nextText: string): boolean {
  if (!previousText || !nextText) {
    return false;
  }

  if (/\s$/.test(previousText) || /^\s/.test(nextText)) {
    return false;
  }

  return /[A-Za-z0-9]$/.test(previousText) && /^[A-Za-z0-9]/.test(nextText);
}

function getLeadingText(segment: RenderedInlineFeedbackSegment): string {
  switch (segment.kind) {
    case "equal":
    case "add":
    case "remove":
      return segment.text;
    case "replace":
      return segment.removed || segment.added;
    default:
      return "";
  }
}

function getTrailingText(segment: RenderedInlineFeedbackSegment): string {
  switch (segment.kind) {
    case "equal":
    case "add":
    case "remove":
      return segment.text;
    case "replace":
      return segment.added || segment.removed;
    default:
      return "";
  }
}

function prependSpace(segment: RenderedInlineFeedbackSegment) {
  switch (segment.kind) {
    case "equal":
    case "add":
    case "remove":
      segment.text = ` ${segment.text}`;
      break;
    case "replace":
      if (segment.removed) {
        segment.removed = ` ${segment.removed}`;
      } else if (segment.added) {
        segment.added = ` ${segment.added}`;
      }
      break;
    default:
      break;
  }
}

function ensureReadableBoundaries(
  segments: RenderedInlineFeedbackSegment[]
): RenderedInlineFeedbackSegment[] {
  const normalizedSegments = segments.map((segment) => ({ ...segment }));

  for (let index = 1; index < normalizedSegments.length; index += 1) {
    const previous = normalizedSegments[index - 1];
    const current = normalizedSegments[index];

    if (!previous || !current) {
      continue;
    }

    if (canInsertReadableSpace(getTrailingText(previous), getLeadingText(current))) {
      prependSpace(current);
    }
  }

  return normalizedSegments;
}

function findOriginalSlice(
  originalAnswer: string,
  cursor: number,
  sourceText: string
): { start: number; end: number } | null {
  if (!sourceText) {
    return null;
  }

  if (originalAnswer.startsWith(sourceText, cursor)) {
    return { start: cursor, end: cursor + sourceText.length };
  }

  const trimmedSourceText = sourceText.trim();
  if (!trimmedSourceText) {
    return null;
  }

  const trimmedMatchIndex = originalAnswer.indexOf(trimmedSourceText, cursor);
  if (trimmedMatchIndex === -1) {
    return null;
  }

  const skippedText = originalAnswer.slice(cursor, trimmedMatchIndex);
  if (skippedText.trim()) {
    return null;
  }

  return {
    start: trimmedMatchIndex,
    end: trimmedMatchIndex + trimmedSourceText.length
  };
}

function buildSegmentsFromDiff(
  originalAnswer: string,
  correctedAnswer: string | null | undefined
): RenderedInlineFeedbackSegment[] {
  if (!originalAnswer.trim()) {
    return [];
  }

  const safeCorrectedAnswer =
    correctedAnswer && correctedAnswer.trim() ? correctedAnswer : originalAnswer;

  if (originalAnswer === safeCorrectedAnswer) {
    return [{ kind: "equal", text: originalAnswer }];
  }

  const operations = buildDiffOperations(tokenize(originalAnswer), tokenize(safeCorrectedAnswer));
  const segments: RenderedInlineFeedbackSegment[] = [];

  for (let index = 0; index < operations.length; ) {
    const current = operations[index];

    if (current.kind === "equal") {
      appendEqualSegment(segments, current.text);
      index += 1;
      continue;
    }

    if (current.kind === "remove") {
      let removed = "";
      while (index < operations.length && operations[index]?.kind === "remove") {
        removed += operations[index].text;
        index += 1;
      }

      let added = "";
      while (index < operations.length && operations[index]?.kind === "add") {
        added += operations[index].text;
        index += 1;
      }

      if (added.trim()) {
        segments.push({
          kind: "replace",
          removed,
          added: collapseWhitespace(added)
        });
      } else if (removed.trim()) {
        segments.push({ kind: "remove", text: removed });
      }

      continue;
    }

    let added = "";
    while (index < operations.length && operations[index]?.kind === "add") {
      added += operations[index].text;
      index += 1;
    }

    if (added.trim()) {
      segments.push({ kind: "add", text: collapseWhitespace(added) });
    }
  }

  return ensureReadableBoundaries(segments);
}

function buildSegmentsFromModel(
  originalAnswer: string,
  inlineFeedback: FeedbackInlineSegment[] | null | undefined
): RenderedInlineFeedbackSegment[] {
  if (!inlineFeedback || inlineFeedback.length === 0) {
    return [];
  }

  const segments: RenderedInlineFeedbackSegment[] = [];
  let cursor = 0;

  for (const segment of inlineFeedback) {
    switch (segment.type) {
      case "KEEP": {
        const match = findOriginalSlice(originalAnswer, cursor, segment.originalText);
        if (!match) {
          return [];
        }

        if (match.start > cursor) {
          appendEqualSegment(segments, originalAnswer.slice(cursor, match.start));
        }

        appendEqualSegment(segments, originalAnswer.slice(match.start, match.end));
        cursor = match.end;
        break;
      }
      case "REPLACE": {
        const match = findOriginalSlice(originalAnswer, cursor, segment.originalText);
        if (!match) {
          return [];
        }

        if (match.start > cursor) {
          appendEqualSegment(segments, originalAnswer.slice(cursor, match.start));
        }

        if (!segment.originalText && !segment.revisedText) {
          break;
        }
        segments.push({
          kind: "replace",
          removed: originalAnswer.slice(match.start, match.end),
          added: normalizeSuggestionText(segment.revisedText)
        });
        cursor = match.end;
        break;
      }
      case "ADD":
        if (segment.revisedText?.trim()) {
          segments.push({ kind: "add", text: normalizeSuggestionText(segment.revisedText) });
        }
        break;
      case "REMOVE": {
        const match = findOriginalSlice(originalAnswer, cursor, segment.originalText);
        if (!match) {
          return [];
        }

        if (match.start > cursor) {
          appendEqualSegment(segments, originalAnswer.slice(cursor, match.start));
        }

        segments.push({ kind: "remove", text: originalAnswer.slice(match.start, match.end) });
        cursor = match.end;
        break;
      }
      default:
        break;
    }
  }

  if (cursor < originalAnswer.length) {
    appendEqualSegment(segments, originalAnswer.slice(cursor));
  }

  return ensureReadableBoundaries(segments);
}

export function buildInlineFeedbackSegments(
  originalAnswer: string,
  correctedAnswer: string | null | undefined,
  inlineFeedback?: FeedbackInlineSegment[] | null
): RenderedInlineFeedbackSegment[] {
  const modelSegments = buildSegmentsFromModel(originalAnswer, inlineFeedback);
  if (modelSegments.length > 0) {
    return modelSegments;
  }

  return buildSegmentsFromDiff(originalAnswer, correctedAnswer);
}
