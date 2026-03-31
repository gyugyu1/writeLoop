package com.writeloop.persistence;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Entity
@Table(name = "prompt_task_profiles")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PromptTaskProfileEntity {

    @Id
    @Column(
            name = "prompt_id",
            nullable = false,
            length = 64,
            columnDefinition = "VARCHAR(64) COLLATE utf8mb4_unicode_ci"
    )
    private String promptId;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(
            name = "prompt_id",
            nullable = false,
            columnDefinition = "VARCHAR(64) COLLATE utf8mb4_unicode_ci",
            foreignKey = @ForeignKey(name = "fk_prompt_task_profiles_prompt")
    )
    private PromptEntity prompt;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(
            name = "answer_mode_id",
            nullable = false,
            foreignKey = @ForeignKey(name = "fk_prompt_task_profiles_answer_mode")
    )
    private PromptAnswerModeEntity answerMode;

    @Column(
            name = "expected_tense",
            nullable = false,
            length = 40,
            columnDefinition = "VARCHAR(40) COLLATE utf8mb4_unicode_ci"
    )
    private String expectedTense;

    @Column(
            name = "expected_pov",
            nullable = false,
            length = 40,
            columnDefinition = "VARCHAR(40) COLLATE utf8mb4_unicode_ci"
    )
    private String expectedPov;

    @Column(name = "is_active", nullable = false)
    private Boolean active;

    @OneToMany(mappedBy = "profile", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("displayOrder ASC, id ASC")
    private final List<PromptTaskProfileSlotEntity> slotAssignments = new ArrayList<>();

    public PromptTaskProfileEntity(
            PromptEntity prompt,
            PromptAnswerModeEntity answerMode,
            String expectedTense,
            String expectedPov,
            Boolean active
    ) {
        attachPrompt(prompt);
        this.answerMode = answerMode;
        this.expectedTense = normalizeMetaCode(expectedTense);
        this.expectedPov = normalizeMetaCode(expectedPov);
        this.active = active;
    }

    public void attachPrompt(PromptEntity prompt) {
        this.prompt = prompt;
        this.promptId = prompt == null ? null : prompt.getId();
    }

    public void update(
            PromptAnswerModeEntity answerMode,
            String expectedTense,
            String expectedPov,
            Boolean active
    ) {
        this.answerMode = answerMode;
        this.expectedTense = normalizeMetaCode(expectedTense);
        this.expectedPov = normalizeMetaCode(expectedPov);
        this.active = active;
    }

    public void replaceSlotAssignments(List<PromptTaskProfileSlotEntity> assignments) {
        if (assignments == null) {
            this.slotAssignments.clear();
            return;
        }

        Map<String, PromptTaskProfileSlotEntity> desiredByKey = new LinkedHashMap<>();
        for (PromptTaskProfileSlotEntity assignment : assignments) {
            if (assignment == null) {
                continue;
            }
            String key = assignmentKey(assignment.getSlot(), assignment.getSlotRole());
            if (key.isBlank()) {
                continue;
            }
            desiredByKey.put(key, assignment);
        }

        this.slotAssignments.removeIf(existing -> !desiredByKey.containsKey(assignmentKey(existing.getSlot(), existing.getSlotRole())));

        Map<String, PromptTaskProfileSlotEntity> existingByKey = new LinkedHashMap<>();
        for (PromptTaskProfileSlotEntity existing : this.slotAssignments) {
            existingByKey.put(assignmentKey(existing.getSlot(), existing.getSlotRole()), existing);
        }

        for (PromptTaskProfileSlotEntity assignment : desiredByKey.values()) {
            String key = assignmentKey(assignment.getSlot(), assignment.getSlotRole());
            PromptTaskProfileSlotEntity existing = existingByKey.get(key);
            if (existing != null) {
                existing.update(
                        assignment.getSlot(),
                        assignment.getSlotRole(),
                        assignment.getDisplayOrder(),
                        assignment.getActive()
                );
                continue;
            }
            assignment.attachProfile(this);
            this.slotAssignments.add(assignment);
        }

        this.slotAssignments.sort(Comparator.comparing(PromptTaskProfileSlotEntity::getDisplayOrder));
    }

    private String normalizeMetaCode(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private String assignmentKey(PromptTaskSlotEntity slot, String slotRole) {
        if (slot == null || slot.getCode() == null || slotRole == null) {
            return "";
        }
        return normalizeMetaCode(slot.getCode()) + "|" + normalizeMetaCode(slotRole);
    }
}
