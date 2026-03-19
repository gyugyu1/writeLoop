package com.writeloop.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "prompts")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PromptEntity {

    @Id
    @Column(nullable = false, length = 64)
    private String id;

    @Column(nullable = false, length = 120)
    private String topic;

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
        this.id = id;
        this.topic = topic;
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
        this.topic = topic;
        this.difficulty = difficulty;
        this.questionEn = questionEn;
        this.questionKo = questionKo;
        this.tip = tip;
        this.displayOrder = displayOrder;
        this.active = active;
    }

}
