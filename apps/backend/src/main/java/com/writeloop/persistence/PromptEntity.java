package com.writeloop.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "prompts")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PromptEntity {

    public record TopicParts(String category, String detail) {
        public String combined() {
            return combineTopic(category, detail);
        }
    }

    @Id
    @Column(nullable = false, length = 64)
    private String id;

    @Transient
    private String topicCategory;

    @Transient
    private String topicDetail;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "topic_detail_id")
    private PromptTopicDetailEntity topicDetailRef;

    @Column(nullable = false, length = 16)
    private String difficulty;

    @Column(name = "question_en", nullable = false, columnDefinition = "TEXT")
    private String questionEn;

    @Column(name = "question_ko", nullable = false, columnDefinition = "TEXT")
    private String questionKo;

    @Column(name = "tip", nullable = false, columnDefinition = "TEXT")
    private String tip;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    @Column(name = "is_active", nullable = false)
    private Boolean active;

    @OneToOne(mappedBy = "prompt", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    private PromptCoachProfileEntity coachProfile;

    @OneToOne(mappedBy = "prompt", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    private PromptTaskProfileEntity taskProfile;

    public PromptEntity(
            String id,
            String topicCategory,
            String topicDetail,
            String difficulty,
            String questionEn,
            String questionKo,
            String tip,
            Integer displayOrder,
            Boolean active
    ) {
        this.id = id;
        setTopicParts(topicCategory, topicDetail);
        this.difficulty = difficulty;
        this.questionEn = questionEn;
        this.questionKo = questionKo;
        this.tip = tip;
        this.displayOrder = displayOrder;
        this.active = active;
    }

    public PromptEntity(
            String id,
            String topic,
            String difficulty,
            String questionEn,
            String questionKo,
            String tip,
            Integer displayOrder,
            Boolean active
    ) {
        this(
                id,
                splitTopic(topic).category(),
                splitTopic(topic).detail(),
                difficulty,
                questionEn,
                questionKo,
                tip,
                displayOrder,
                active
        );
    }

    public void update(
            String topicCategory,
            String topicDetail,
            String difficulty,
            String questionEn,
            String questionKo,
            String tip,
            Integer displayOrder,
            Boolean active
    ) {
        setTopicParts(topicCategory, topicDetail);
        this.difficulty = difficulty;
        this.questionEn = questionEn;
        this.questionKo = questionKo;
        this.tip = tip;
        this.displayOrder = displayOrder;
        this.active = active;
    }

    public void update(
            String topic,
            String difficulty,
            String questionEn,
            String questionKo,
            String tip,
            Integer displayOrder,
            Boolean active
    ) {
        TopicParts parts = splitTopic(topic);
        update(
                parts.category(),
                parts.detail(),
                difficulty,
                questionEn,
                questionKo,
                tip,
                displayOrder,
                active
        );
    }

    public void updateTopicParts(String topicCategory, String topicDetail) {
        setTopicParts(topicCategory, topicDetail);
    }

    public void assignTopicDetail(PromptTopicDetailEntity topicDetailRef) {
        this.topicDetailRef = topicDetailRef;
        syncTopicPartsFromReference();
    }

    public String getTopicCategory() {
        syncTopicPartsFromReference();
        return normalizeTopicPart(topicCategory);
    }

    public String getTopicDetail() {
        syncTopicPartsFromReference();
        return normalizeTopicPart(topicDetail);
    }

    public String getTopic() {
        return combineTopic(getTopicCategory(), getTopicDetail());
    }

    public void upsertCoachProfile(PromptCoachProfileEntity coachProfile) {
        if (coachProfile == null) {
            this.coachProfile = null;
            return;
        }

        coachProfile.attachPrompt(this);
        this.coachProfile = coachProfile;
    }

    public void upsertTaskProfile(PromptTaskProfileEntity taskProfile) {
        if (taskProfile == null) {
            this.taskProfile = null;
            return;
        }

        taskProfile.attachPrompt(this);
        this.taskProfile = taskProfile;
    }

    public static TopicParts splitTopic(String topic) {
        String normalized = normalizeTopicPart(topic);
        if (normalized.isBlank()) {
            return new TopicParts("", "");
        }

        String[] parts = normalized.split("\\s+-\\s+", 2);
        if (parts.length < 2) {
            return new TopicParts(normalized, "");
        }
        return new TopicParts(normalizeTopicPart(parts[0]), normalizeTopicPart(parts[1]));
    }

    public static String combineTopic(String topicCategory, String topicDetail) {
        String normalizedCategory = normalizeTopicPart(topicCategory);
        String normalizedDetail = normalizeTopicPart(topicDetail);

        if (normalizedCategory.isBlank()) {
            return normalizedDetail;
        }
        if (normalizedDetail.isBlank() || normalizedCategory.equalsIgnoreCase(normalizedDetail)) {
            return normalizedCategory;
        }
        return normalizedCategory + " - " + normalizedDetail;
    }

    private void setTopicParts(String topicCategory, String topicDetail) {
        this.topicCategory = normalizeTopicPart(topicCategory);
        this.topicDetail = normalizeTopicPart(topicDetail);
    }

    private void syncTopicPartsFromReference() {
        if (topicDetailRef == null) {
            return;
        }

        this.topicDetail = normalizeTopicPart(topicDetailRef.getName());
        this.topicCategory = topicDetailRef.getCategory() == null
                ? normalizeTopicPart(this.topicCategory)
                : normalizeTopicPart(topicDetailRef.getCategory().getName());
    }

    private static String normalizeTopicPart(String value) {
        return value == null ? "" : value.trim();
    }
}
