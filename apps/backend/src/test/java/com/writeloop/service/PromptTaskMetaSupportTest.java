package com.writeloop.service;

import com.writeloop.persistence.PromptAnswerModeRepository;
import com.writeloop.persistence.PromptEntity;
import com.writeloop.persistence.PromptTaskProfileEntity;
import com.writeloop.persistence.PromptTaskProfileRepository;
import com.writeloop.persistence.PromptTaskProfileSlotEntity;
import com.writeloop.persistence.PromptTaskSlotEntity;
import com.writeloop.persistence.PromptTaskSlotRepository;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class PromptTaskMetaSupportTest {

    private final PromptAnswerModeRepository answerModeRepository = mock(PromptAnswerModeRepository.class);
    private final PromptTaskSlotRepository slotRepository = mock(PromptTaskSlotRepository.class);
    private final PromptTaskProfileRepository profileRepository = mock(PromptTaskProfileRepository.class);
    private final PromptTaskMetaSupport support = new PromptTaskMetaSupport(
            answerModeRepository,
            slotRepository,
            profileRepository
    );

    @Test
    void backfillPreservesProfileAlreadyLoadedFromDatabase() {
        PromptEntity prompt = mock(PromptEntity.class);
        when(prompt.getTaskProfile()).thenReturn(mock(PromptTaskProfileEntity.class));

        support.backfillMissingProfiles(List.of(prompt));

        verifyNoInteractions(answerModeRepository, slotRepository, profileRepository);
    }

    @Test
    void backfillPreservesDetachedProfileFoundByRepository() {
        PromptEntity prompt = mock(PromptEntity.class);
        when(prompt.getId()).thenReturn("prompt-reviewed");
        when(prompt.getTaskProfile()).thenReturn(null);
        when(profileRepository.existsById("prompt-reviewed")).thenReturn(true);

        support.backfillMissingProfiles(List.of(prompt));

        verify(profileRepository).existsById("prompt-reviewed");
        verify(profileRepository, never()).save(any());
        verifyNoInteractions(answerModeRepository, slotRepository);
    }

    @Test
    void startupValidationRejectsAnActiveSlotWithMissingQuestionSpecificMetadata() {
        PromptEntity prompt = mock(PromptEntity.class);
        PromptTaskProfileEntity profile = mock(PromptTaskProfileEntity.class);
        PromptTaskProfileSlotEntity assignment = mock(PromptTaskProfileSlotEntity.class);
        PromptTaskSlotEntity slot = mock(PromptTaskSlotEntity.class);
        when(prompt.getId()).thenReturn("prompt-incomplete");
        when(prompt.getTaskProfile()).thenReturn(profile);
        when(profile.getSlotAssignments()).thenReturn(List.of(assignment));
        when(assignment.getActive()).thenReturn(true);
        when(assignment.getSlot()).thenReturn(slot);
        when(slot.getCode()).thenReturn("PLACE");
        when(assignment.getSemanticRoleEn()).thenReturn("The learner's residence.");
        when(assignment.getSatisfiedWhenEn()).thenReturn(null);
        when(assignment.getSemanticRoleKo()).thenReturn("Korean role");
        when(assignment.getSatisfiedWhenKo()).thenReturn("Korean criterion");

        assertThatThrownBy(() -> support.validateCompleteSlotContracts(List.of(prompt)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("prompt-incomplete/PLACE");
    }
}
