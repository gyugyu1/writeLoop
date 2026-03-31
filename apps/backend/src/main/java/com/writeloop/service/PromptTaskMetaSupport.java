package com.writeloop.service;

import com.writeloop.dto.PromptTaskMetaDto;
import com.writeloop.persistence.PromptAnswerModeEntity;
import com.writeloop.persistence.PromptAnswerModeRepository;
import com.writeloop.persistence.PromptEntity;
import com.writeloop.persistence.PromptTaskProfileEntity;
import com.writeloop.persistence.PromptTaskProfileRepository;
import com.writeloop.persistence.PromptTaskProfileSlotEntity;
import com.writeloop.persistence.PromptTaskSlotEntity;
import com.writeloop.persistence.PromptTaskSlotRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PromptTaskMetaSupport {

    private static final String REQUIRED = "REQUIRED";
    private static final String OPTIONAL = "OPTIONAL";

    private final PromptAnswerModeRepository promptAnswerModeRepository;
    private final PromptTaskSlotRepository promptTaskSlotRepository;
    private final PromptTaskProfileRepository promptTaskProfileRepository;

    public void ensureCatalogSeeded() {
        List<String> modes = PromptTaskMetaCatalog.answerModes();
        for (int i = 0; i < modes.size(); i++) {
            String code = modes.get(i);
            int displayOrder = i + 1;
            PromptAnswerModeEntity entity = promptAnswerModeRepository.findByCodeIgnoreCase(code)
                    .orElseGet(() -> new PromptAnswerModeEntity(code, displayOrder, true));
            entity.update(code, displayOrder, true);
            promptAnswerModeRepository.save(entity);
        }

        List<String> slots = PromptTaskMetaCatalog.taskSlots();
        for (int i = 0; i < slots.size(); i++) {
            String code = slots.get(i);
            int displayOrder = i + 1;
            PromptTaskSlotEntity entity = promptTaskSlotRepository.findByCodeIgnoreCase(code)
                    .orElseGet(() -> new PromptTaskSlotEntity(code, displayOrder, true));
            entity.update(code, displayOrder, true);
            promptTaskSlotRepository.save(entity);
        }
    }

    public PromptTaskMetaCatalog.TaskMetaEntry defaultMetaForPrompt(PromptEntity prompt) {
        if (prompt == null) {
            return null;
        }
        return PromptTaskMetaCatalog.classify(prompt);
    }

    public void syncProfiles(Iterable<PromptEntity> prompts) {
        if (prompts == null) {
            return;
        }
        for (PromptEntity prompt : prompts) {
            upsertProfile(prompt, defaultMetaForPrompt(prompt));
        }
    }

    public void upsertProfile(PromptEntity prompt, PromptTaskMetaCatalog.TaskMetaEntry entry) {
        if (prompt == null || entry == null) {
            return;
        }

        PromptAnswerModeEntity answerMode = promptAnswerModeRepository.findByCodeIgnoreCase(entry.answerMode())
                .orElseThrow(() -> new IllegalArgumentException("Unsupported answer mode: " + entry.answerMode()));

        PromptTaskProfileEntity profile = prompt.getTaskProfile();
        if (profile == null) {
            profile = promptTaskProfileRepository.findById(prompt.getId())
                    .orElseGet(() -> new PromptTaskProfileEntity(
                            prompt,
                            answerMode,
                            entry.expectedTense(),
                            entry.expectedPov(),
                            true
                    ));
            prompt.upsertTaskProfile(profile);
        }
        profile.update(answerMode, entry.expectedTense(), entry.expectedPov(), true);
        profile.replaceSlotAssignments(buildAssignments(profile, entry));
        promptTaskProfileRepository.save(profile);
    }

    public PromptTaskMetaDto toDto(PromptEntity prompt) {
        if (prompt == null || prompt.getTaskProfile() == null || prompt.getTaskProfile().getAnswerMode() == null) {
            return null;
        }

        List<String> requiredSlots = new ArrayList<>();
        List<String> optionalSlots = new ArrayList<>();
        for (PromptTaskProfileSlotEntity assignment : prompt.getTaskProfile().getSlotAssignments()) {
            if (assignment == null || assignment.getSlot() == null || !Boolean.TRUE.equals(assignment.getActive())) {
                continue;
            }
            String slotCode = assignment.getSlot().getCode();
            if (REQUIRED.equalsIgnoreCase(assignment.getSlotRole())) {
                requiredSlots.add(slotCode);
            } else {
                optionalSlots.add(slotCode);
            }
        }
        return new PromptTaskMetaDto(
                prompt.getTaskProfile().getAnswerMode().getCode(),
                requiredSlots,
                optionalSlots,
                prompt.getTaskProfile().getExpectedTense(),
                prompt.getTaskProfile().getExpectedPov()
        );
    }

    private List<PromptTaskProfileSlotEntity> buildAssignments(
            PromptTaskProfileEntity profile,
            PromptTaskMetaCatalog.TaskMetaEntry entry
    ) {
        List<PromptTaskProfileSlotEntity> assignments = new ArrayList<>();
        int displayOrder = 1;
        for (String slotCode : entry.requiredSlots()) {
            assignments.add(new PromptTaskProfileSlotEntity(
                    profile,
                    requireSlot(slotCode),
                    REQUIRED,
                    displayOrder++,
                    true
            ));
        }
        for (String slotCode : entry.optionalSlots()) {
            assignments.add(new PromptTaskProfileSlotEntity(
                    profile,
                    requireSlot(slotCode),
                    OPTIONAL,
                    displayOrder++,
                    true
            ));
        }
        return assignments;
    }

    private PromptTaskSlotEntity requireSlot(String slotCode) {
        return promptTaskSlotRepository.findByCodeIgnoreCase(slotCode)
                .orElseThrow(() -> new IllegalArgumentException("Unsupported task slot: " + slotCode));
    }
}
