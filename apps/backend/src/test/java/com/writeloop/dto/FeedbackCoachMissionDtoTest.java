package com.writeloop.dto;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class FeedbackCoachMissionDtoTest {

    @Test
    void coachMoveKeepsTheCanonicalTargetSlotForTheUi() {
        FeedbackCoachMissionDto mission = new FeedbackCoachMissionDto(
                "DETAIL",
                "반대쪽도 붙여보기",
                null,
                null,
                "장점만 있어서 반대쪽도 필요해요.",
                "아쉬운 점을 하나 붙여 보세요.",
                "One drawback is ____.",
                "한 가지 아쉬운 점은 ____예요.",
                List.of(),
                "One drawback is ____.",
                null,
                List.of()
        );

        FeedbackCoachMoveDto coachMove = mission.toCoachMove("DISADVANTAGE");

        assertThat(coachMove.focusType()).isEqualTo("DETAIL");
        assertThat(coachMove.targetSlot()).isEqualTo("DISADVANTAGE");
    }
}
