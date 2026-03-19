package com.writeloop.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "prompt_hints")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PromptHintEntity {

    @Id
    @Column(nullable = false, length = 64)
    private String id;

    @Column(name = "prompt_id", nullable = false, length = 64)
    private String promptId;

    @Column(name = "hint_type", nullable = false, length = 40)
    private String hintType;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    @Column(name = "is_active", nullable = false)
    private Boolean active;

    public PromptHintEntity(
            String id,
            String promptId,
            String hintType,
            String content,
            Integer displayOrder,
            Boolean active
    ) {
        this.id = id;
        this.promptId = promptId;
        this.hintType = hintType;
        this.content = content;
        this.displayOrder = displayOrder;
        this.active = active;
    }

    public void update(
            String hintType,
            String content,
            Integer displayOrder,
            Boolean active
    ) {
        this.hintType = hintType;
        this.content = content;
        this.displayOrder = displayOrder;
        this.active = active;
    }
}
