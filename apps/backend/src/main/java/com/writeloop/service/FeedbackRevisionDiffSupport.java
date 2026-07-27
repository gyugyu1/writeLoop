package com.writeloop.service;

import com.writeloop.dto.InlineFeedbackSegmentDto;

import java.util.ArrayList;
import java.util.List;

final class FeedbackRevisionDiffSupport {

    private FeedbackRevisionDiffSupport() {
    }

    static FeedbackRevisionDiff compare(String original, String revised) {
        String before = original == null ? "" : original;
        String after = revised == null ? "" : revised;
        if (before.equals(after)) {
            List<InlineFeedbackSegmentDto> segments = before.isEmpty()
                    ? List.of()
                    : List.of(new InlineFeedbackSegmentDto("KEEP", before, before));
            return new FeedbackRevisionDiff(List.of(), segments);
        }

        List<RevisionToken> beforeTokens = tokenize(before);
        List<RevisionToken> afterTokens = tokenize(after);
        int[][] distances = editDistances(beforeTokens, afterTokens);
        List<DiffOperation> operations = operations(beforeTokens, afterTokens, distances);
        return assemble(operations);
    }

    static LanguageRevisionEdit enclosingEdit(
            String original,
            String revised,
            FeedbackRevisionDiff diff
    ) {
        String before = original == null ? "" : original;
        String after = revised == null ? "" : revised;
        if (diff == null || diff.edits().isEmpty()) {
            return null;
        }

        LanguageRevisionEdit first = diff.edits().get(0);
        LanguageRevisionEdit last = diff.edits().get(diff.edits().size() - 1);
        return new LanguageRevisionEdit(
                first.sourceStart(),
                last.sourceEnd(),
                first.revisedStart(),
                last.revisedEnd(),
                before.substring(first.sourceStart(), last.sourceEnd()),
                after.substring(first.revisedStart(), last.revisedEnd())
        );
    }

    private static List<RevisionToken> tokenize(String value) {
        if (value.isEmpty()) {
            return List.of();
        }

        List<RevisionToken> tokens = new ArrayList<>();
        int index = 0;
        while (index < value.length()) {
            int start = index;
            if (Character.isWhitespace(value.charAt(index))) {
                while (index < value.length() && Character.isWhitespace(value.charAt(index))) {
                    index++;
                }
            } else {
                while (index < value.length() && !Character.isWhitespace(value.charAt(index))) {
                    index++;
                }
                while (index < value.length() && Character.isWhitespace(value.charAt(index))) {
                    index++;
                }
            }
            tokens.add(new RevisionToken(value.substring(start, index), start, index));
        }
        return List.copyOf(tokens);
    }

    private static int[][] editDistances(
            List<RevisionToken> beforeTokens,
            List<RevisionToken> afterTokens
    ) {
        int[][] distances = new int[beforeTokens.size() + 1][afterTokens.size() + 1];
        for (int beforeIndex = 0; beforeIndex <= beforeTokens.size(); beforeIndex++) {
            distances[beforeIndex][afterTokens.size()] = beforeTokens.size() - beforeIndex;
        }
        for (int afterIndex = 0; afterIndex <= afterTokens.size(); afterIndex++) {
            distances[beforeTokens.size()][afterIndex] = afterTokens.size() - afterIndex;
        }
        for (int beforeIndex = beforeTokens.size() - 1; beforeIndex >= 0; beforeIndex--) {
            for (int afterIndex = afterTokens.size() - 1; afterIndex >= 0; afterIndex--) {
                if (beforeTokens.get(beforeIndex).text().equals(afterTokens.get(afterIndex).text())) {
                    distances[beforeIndex][afterIndex] = distances[beforeIndex + 1][afterIndex + 1];
                } else {
                    distances[beforeIndex][afterIndex] = 1 + Math.min(
                            distances[beforeIndex + 1][afterIndex + 1],
                            Math.min(
                                    distances[beforeIndex + 1][afterIndex],
                                    distances[beforeIndex][afterIndex + 1]
                            )
                    );
                }
            }
        }
        return distances;
    }

    private static List<DiffOperation> operations(
            List<RevisionToken> beforeTokens,
            List<RevisionToken> afterTokens,
            int[][] distances
    ) {
        List<DiffOperation> operations = new ArrayList<>();
        int beforeIndex = 0;
        int afterIndex = 0;
        while (beforeIndex < beforeTokens.size() || afterIndex < afterTokens.size()) {
            if (beforeIndex < beforeTokens.size()
                    && afterIndex < afterTokens.size()
                    && beforeTokens.get(beforeIndex).text().equals(afterTokens.get(afterIndex).text())
                    && distances[beforeIndex][afterIndex]
                    == distances[beforeIndex + 1][afterIndex + 1]) {
                operations.add(new DiffOperation(
                        DiffOperationType.KEEP,
                        beforeTokens.get(beforeIndex++),
                        afterTokens.get(afterIndex++)
                ));
                continue;
            }
            int currentDistance = distances[beforeIndex][afterIndex];
            if (beforeIndex < beforeTokens.size()
                    && afterIndex < afterTokens.size()
                    && currentDistance == distances[beforeIndex + 1][afterIndex + 1] + 1) {
                operations.add(new DiffOperation(
                        DiffOperationType.DELETE,
                        beforeTokens.get(beforeIndex++),
                        null
                ));
                operations.add(new DiffOperation(
                        DiffOperationType.INSERT,
                        null,
                        afterTokens.get(afterIndex++)
                ));
            } else if (beforeIndex < beforeTokens.size()
                    && currentDistance == distances[beforeIndex + 1][afterIndex] + 1) {
                operations.add(new DiffOperation(
                        DiffOperationType.DELETE,
                        beforeTokens.get(beforeIndex++),
                        null
                ));
            } else {
                operations.add(new DiffOperation(
                        DiffOperationType.INSERT,
                        null,
                        afterTokens.get(afterIndex++)
                ));
            }
        }
        return List.copyOf(operations);
    }

    private static FeedbackRevisionDiff assemble(List<DiffOperation> operations) {
        List<LanguageRevisionEdit> edits = new ArrayList<>();
        List<InlineFeedbackSegmentDto> segments = new ArrayList<>();
        int sourcePosition = 0;
        int revisedPosition = 0;
        PendingEdit pending = null;

        for (DiffOperation operation : operations) {
            if (operation.type() == DiffOperationType.KEEP) {
                if (pending != null) {
                    edits.add(pending.finish(sourcePosition, revisedPosition));
                    appendChangeSegment(segments, pending.beforeText(), pending.afterText());
                    pending = null;
                }
                String kept = operation.beforeToken().text();
                appendKeepSegment(segments, kept);
                sourcePosition += kept.length();
                revisedPosition += operation.afterToken().text().length();
                continue;
            }

            if (pending == null) {
                pending = new PendingEdit(sourcePosition, revisedPosition);
            }
            if (operation.type() == DiffOperationType.DELETE) {
                String removed = operation.beforeToken().text();
                pending.appendBefore(removed);
                sourcePosition += removed.length();
            } else {
                String added = operation.afterToken().text();
                pending.appendAfter(added);
                revisedPosition += added.length();
            }
        }

        if (pending != null) {
            edits.add(pending.finish(sourcePosition, revisedPosition));
            appendChangeSegment(segments, pending.beforeText(), pending.afterText());
        }
        return new FeedbackRevisionDiff(List.copyOf(edits), List.copyOf(segments));
    }

    private static void appendKeepSegment(List<InlineFeedbackSegmentDto> segments, String text) {
        if (text.isEmpty()) {
            return;
        }
        if (!segments.isEmpty() && "KEEP".equals(segments.get(segments.size() - 1).type())) {
            InlineFeedbackSegmentDto previous = segments.remove(segments.size() - 1);
            String merged = previous.originalText() + text;
            segments.add(new InlineFeedbackSegmentDto("KEEP", merged, merged));
            return;
        }
        segments.add(new InlineFeedbackSegmentDto("KEEP", text, text));
    }

    private static void appendChangeSegment(
            List<InlineFeedbackSegmentDto> segments,
            String before,
            String after
    ) {
        String type;
        if (!before.isEmpty() && !after.isEmpty()) {
            type = "REPLACE";
        } else if (!before.isEmpty()) {
            type = "REMOVE";
        } else {
            type = "ADD";
        }
        segments.add(new InlineFeedbackSegmentDto(type, before, after));
    }

    private enum DiffOperationType {
        KEEP,
        DELETE,
        INSERT
    }

    private record RevisionToken(
            String text,
            int start,
            int end
    ) {
    }

    private record DiffOperation(
            DiffOperationType type,
            RevisionToken beforeToken,
            RevisionToken afterToken
    ) {
    }

    private static final class PendingEdit {
        private final int sourceStart;
        private final int revisedStart;
        private final StringBuilder before = new StringBuilder();
        private final StringBuilder after = new StringBuilder();

        private PendingEdit(int sourceStart, int revisedStart) {
            this.sourceStart = sourceStart;
            this.revisedStart = revisedStart;
        }

        private void appendBefore(String value) {
            before.append(value);
        }

        private void appendAfter(String value) {
            after.append(value);
        }

        private String beforeText() {
            return before.toString();
        }

        private String afterText() {
            return after.toString();
        }

        private LanguageRevisionEdit finish(int sourceEnd, int revisedEnd) {
            return new LanguageRevisionEdit(
                    sourceStart,
                    sourceEnd,
                    revisedStart,
                    revisedEnd,
                    before.toString(),
                    after.toString()
            );
        }
    }
}

record FeedbackRevisionDiff(
        List<LanguageRevisionEdit> edits,
        List<InlineFeedbackSegmentDto> inlineSegments
) {
}

record LanguageRevisionEdit(
        int sourceStart,
        int sourceEnd,
        int revisedStart,
        int revisedEnd,
        String originalText,
        String revisedText
) {
    String displayOriginalText() {
        return originalText == null ? "" : originalText.trim();
    }

    String displayRevisedText() {
        return revisedText == null ? "" : revisedText.trim();
    }
}
