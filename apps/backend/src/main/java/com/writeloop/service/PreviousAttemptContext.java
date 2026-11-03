package com.writeloop.service;

import java.util.List;

// 다시 쓴 답을 진단할 때 LLM과 미션 선택에 넘기는 바로 앞 시도의 답·미션·슬롯 판정.
record PreviousAttemptContext(
        String answer,
        MissionKind missionKind,
        String targetSlot,
        List<SlotVerdict> slotAssessments
) {
    PreviousAttemptContext {
        slotAssessments = slotAssessments == null ? List.of() : List.copyOf(slotAssessments);
    }

    record SlotVerdict(String slot, SlotAssessmentStatus verdict, String evidence) {
    }
}
