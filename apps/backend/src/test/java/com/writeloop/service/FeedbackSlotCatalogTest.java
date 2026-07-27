package com.writeloop.service;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class FeedbackSlotCatalogTest {

    @Test
    void canonicalSlotsAreSharedWithoutLegacyCodes() {
        assertThat(FeedbackSlotCatalog.canonicalSlots())
                .contains("ACTION", "CHOICE", "GOAL", "PLAN", "SPECIFIC_TIME", "PLACE", "RESULT")
                .doesNotContain("MAIN_ANSWER", "ACTIVITY", "TIME_OR_PLACE", "SITUATION");
    }

    @Test
    void legacySlotsRemainReadableDuringRollingDeployment() {
        assertThat(FeedbackSlotCatalog.normalizeSlot("MAIN_ANSWER", "PREFERENCE")).isEqualTo("CHOICE");
        assertThat(FeedbackSlotCatalog.normalizeSlot("ACTIVITY", "GOAL_PLAN")).isEqualTo("PLAN");
        assertThat(FeedbackSlotCatalog.normalizeSlot("TIME_OR_PLACE", "ROUTINE")).isEqualTo("SPECIFIC_TIME");
    }

    @Test
    void glossaryDefinesConcreteAndGenericBoundariesForRegressionSlots() {
        Map<String, String> glossary = FeedbackSlotCatalog.glossary();

        assertThat(glossary.get("BEFORE_STATE"))
                .contains("actual earlier state")
                .contains("used to meet differently")
                .contains("GENERIC");
        assertThat(glossary.get("REASON"))
                .contains("concrete cause")
                .contains("because it is nice")
                .contains("GENERIC");
        assertThat(glossary.get("PLACE"))
                .contains("recognizable location")
                .contains("a nice area")
                .contains("GENERIC");
        assertThat(glossary.get("SPECIFIC_TIME"))
                .contains("in the morning")
                .contains("question-specific timing role");
    }

    @Test
    void uiKeepsTheCanonicalSlotBehindACoarseMissionType() {
        MissionDecision decision = decision(MissionKind.SLOT, List.of("DISADVANTAGE"), "DISADVANTAGE");

        assertThat(FeedbackSlotCatalog.targetSlotForUi(decision)).isEqualTo("DISADVANTAGE");
    }

    @Test
    void taskResetUsesItsFirstMissingCoreSlotAsTheUiTarget() {
        MissionDecision decision = decision(MissionKind.TASK_RESET, List.of("CHOICE", "REASON"), null);

        assertThat(FeedbackSlotCatalog.targetSlotForUi(decision)).isEqualTo("CHOICE");
    }

    @Test
    void correctionMissionsDoNotExposeAContentSlot() {
        MissionDecision decision = decision(MissionKind.LANGUAGE_FIX, List.of("REASON"), "REASON");

        assertThat(FeedbackSlotCatalog.targetSlotForUi(decision)).isNull();
    }

    private MissionDecision decision(MissionKind missionKind, List<String> missingSlots, String chosenSlot) {
        return new MissionDecision(
                missionKind,
                List.of(),
                missingSlots,
                chosenSlot,
                Map.of()
        );
    }
}
