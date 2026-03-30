package com.writeloop.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "prompt_hint_items")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PromptHintItemEntity {

    @Id
    @Column(nullable = false, length = 64)
    private String id;

    @Column(name = "hint_id", nullable = false, length = 64)
    private String hintId;

    @Column(name = "item_type", nullable = false, length = 20)
    private String itemType;

    @Column(nullable = false, length = 255)
    private String content;

    @Column(name = "meaning_ko", length = 255)
    private String meaningKo;

    @Column(name = "usage_tip_ko", length = 255)
    private String usageTipKo;

    @Column(name = "example_en", length = 255)
    private String exampleEn;

    @Column(name = "expression_family", length = 50)
    private String expressionFamily;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    @Column(name = "is_active", nullable = false)
    private Boolean active;

    public PromptHintItemEntity(
            String id,
            String hintId,
            String itemType,
            String content,
            String meaningKo,
            String usageTipKo,
            String exampleEn,
            String expressionFamily,
            Integer displayOrder,
            Boolean active
    ) {
        this.id = id;
        this.hintId = hintId;
        this.itemType = itemType;
        this.content = content;
        this.meaningKo = meaningKo;
        this.usageTipKo = usageTipKo;
        this.exampleEn = exampleEn;
        this.expressionFamily = expressionFamily;
        this.displayOrder = displayOrder;
        this.active = active;
    }
}
