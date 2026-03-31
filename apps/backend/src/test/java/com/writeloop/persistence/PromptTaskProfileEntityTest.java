package com.writeloop.persistence;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

class PromptTaskProfileEntityTest {

    @Test
    void replaceSlotAssignments_reuses_existing_assignment_for_same_slot_role_key() {
        PromptEntity prompt = new PromptEntity(
                "prompt-a-1",
                "Routine",
                "After Dinner",
                "A",
                "What do you usually do after dinner?",
                "저녁을 먹고 나서 보통 무엇을 하나요?",
                "시간 순서와 자주 하는 활동을 함께 말해 보세요.",
                1,
                true
        );
        PromptAnswerModeEntity answerMode = new PromptAnswerModeEntity("ROUTINE", 1, true);
        PromptTaskProfileEntity profile = new PromptTaskProfileEntity(prompt, answerMode, "PRESENT_SIMPLE", "FIRST_PERSON", true);

        PromptTaskSlotEntity mainAnswer = new PromptTaskSlotEntity("MAIN_ANSWER", 1, true);
        PromptTaskSlotEntity activity = new PromptTaskSlotEntity("ACTIVITY", 2, true);

        profile.replaceSlotAssignments(List.of(
                new PromptTaskProfileSlotEntity(profile, mainAnswer, "REQUIRED", 1, true),
                new PromptTaskProfileSlotEntity(profile, activity, "REQUIRED", 2, true)
        ));

        PromptTaskProfileSlotEntity originalMainAnswerAssignment = profile.getSlotAssignments().get(0);

        profile.replaceSlotAssignments(List.of(
                new PromptTaskProfileSlotEntity(profile, mainAnswer, "REQUIRED", 1, true),
                new PromptTaskProfileSlotEntity(profile, activity, "REQUIRED", 2, true)
        ));

        assertThat(profile.getSlotAssignments()).hasSize(2);
        assertThat(profile.getSlotAssignments().get(0)).isSameAs(originalMainAnswerAssignment);
        assertThat(profile.getSlotAssignments())
                .extracting(assignment -> assignment.getSlot().getCode(), PromptTaskProfileSlotEntity::getSlotRole)
                .containsExactly(
                        tuple("MAIN_ANSWER", "REQUIRED"),
                        tuple("ACTIVITY", "REQUIRED")
                );
    }
}
