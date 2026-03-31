package com.writeloop.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "prompt_topic_details")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PromptTopicDetailEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private PromptTopicCategoryEntity category;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    @Column(name = "is_active", nullable = false)
    private Boolean active;

    public PromptTopicDetailEntity(
            PromptTopicCategoryEntity category,
            String name,
            Integer displayOrder,
            Boolean active
    ) {
        update(category, name, displayOrder, active);
    }

    public void update(
            PromptTopicCategoryEntity category,
            String name,
            Integer displayOrder,
            Boolean active
    ) {
        this.category = category;
        this.name = normalize(name);
        this.displayOrder = displayOrder == null ? 0 : displayOrder;
        this.active = active == null || active;
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
