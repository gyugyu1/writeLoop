package com.writeloop.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "prompt_coach_profiles")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PromptCoachProfileEntity {

    @Id
    @Column(name = "prompt_id", nullable = false, length = 64)
    private String promptId;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prompt_id", nullable = false)
    private PromptEntity prompt;

    @Column(name = "primary_category", nullable = false, length = 64)
    private String primaryCategory;

    @Column(name = "secondary_categories_json", nullable = false, columnDefinition = "TEXT")
    private String secondaryCategoriesJson;

    @Column(name = "preferred_expression_families_json", nullable = false, columnDefinition = "TEXT")
    private String preferredExpressionFamiliesJson;

    @Column(name = "avoid_families_json", nullable = false, columnDefinition = "TEXT")
    private String avoidFamiliesJson;

    @Column(name = "starter_style", nullable = false, length = 64)
    private String starterStyle;

    @Column(name = "notes", nullable = false, columnDefinition = "TEXT")
    private String notes;

    public PromptCoachProfileEntity(
            PromptEntity prompt,
            String primaryCategory,
            String secondaryCategoriesJson,
            String preferredExpressionFamiliesJson,
            String avoidFamiliesJson,
            String starterStyle,
            String notes
    ) {
        attachPrompt(prompt);
        this.primaryCategory = primaryCategory;
        this.secondaryCategoriesJson = secondaryCategoriesJson;
        this.preferredExpressionFamiliesJson = preferredExpressionFamiliesJson;
        this.avoidFamiliesJson = avoidFamiliesJson;
        this.starterStyle = starterStyle;
        this.notes = notes;
    }

    public void attachPrompt(PromptEntity prompt) {
        this.prompt = prompt;
        this.promptId = prompt == null ? null : prompt.getId();
    }

    public void update(
            String primaryCategory,
            String secondaryCategoriesJson,
            String preferredExpressionFamiliesJson,
            String avoidFamiliesJson,
            String starterStyle,
            String notes
    ) {
        this.primaryCategory = primaryCategory;
        this.secondaryCategoriesJson = secondaryCategoriesJson;
        this.preferredExpressionFamiliesJson = preferredExpressionFamiliesJson;
        this.avoidFamiliesJson = avoidFamiliesJson;
        this.starterStyle = starterStyle;
        this.notes = notes;
    }
}
