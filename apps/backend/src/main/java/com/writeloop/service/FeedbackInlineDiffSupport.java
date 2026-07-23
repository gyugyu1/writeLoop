package com.writeloop.service;

import com.writeloop.dto.InlineFeedbackSegmentDto;

import java.util.ArrayList;
import java.util.List;

final class FeedbackInlineDiffSupport {

    private FeedbackInlineDiffSupport() {
    }

    static List<InlineFeedbackSegmentDto> diff(String original, String revised) {
        String before = original == null ? "" : original;
        String after = revised == null ? "" : revised;
        if (before.equals(after)) {
            return before.isEmpty()
                    ? List.of()
                    : List.of(new InlineFeedbackSegmentDto("KEEP", before, before));
        }

        int prefix = commonPrefix(before, after);
        int suffix = commonSuffix(before, after, prefix);
        List<InlineFeedbackSegmentDto> segments = new ArrayList<>();
        if (prefix > 0) {
            String text = before.substring(0, prefix);
            segments.add(new InlineFeedbackSegmentDto("KEEP", text, text));
        }
        String removed = before.substring(prefix, before.length() - suffix);
        String added = after.substring(prefix, after.length() - suffix);
        if (!removed.isEmpty() && !added.isEmpty()) {
            segments.add(new InlineFeedbackSegmentDto("REPLACE", removed, added));
        } else if (!removed.isEmpty()) {
            segments.add(new InlineFeedbackSegmentDto("REMOVE", removed, ""));
        } else if (!added.isEmpty()) {
            segments.add(new InlineFeedbackSegmentDto("ADD", "", added));
        }
        if (suffix > 0) {
            String text = before.substring(before.length() - suffix);
            segments.add(new InlineFeedbackSegmentDto("KEEP", text, text));
        }
        return List.copyOf(segments);
    }

    private static int commonPrefix(String left, String right) {
        int limit = Math.min(left.length(), right.length());
        int index = 0;
        while (index < limit && left.charAt(index) == right.charAt(index)) {
            index++;
        }
        return index;
    }

    private static int commonSuffix(String left, String right, int prefix) {
        int max = Math.min(left.length(), right.length()) - prefix;
        int count = 0;
        while (count < max
                && left.charAt(left.length() - 1 - count) == right.charAt(right.length() - 1 - count)) {
            count++;
        }
        return count;
    }
}
