package com.writeloop.service;

import com.writeloop.dto.InlineFeedbackSegmentDto;

import java.util.List;

final class FeedbackInlineDiffSupport {

    private FeedbackInlineDiffSupport() {
    }

    static List<InlineFeedbackSegmentDto> diff(String original, String revised) {
        return FeedbackRevisionDiffSupport.compare(original, revised).inlineSegments();
    }
}
