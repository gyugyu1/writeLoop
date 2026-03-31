package com.writeloop.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "prompt_topic_categories")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PromptTopicCategoryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 80, unique = true)
    private String name;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    @Column(name = "is_active", nullable = false)
    private Boolean active;

    public PromptTopicCategoryEntity(String name, Integer displayOrder, Boolean active) {
        update(name, displayOrder, active);
    }

    public void update(String name, Integer displayOrder, Boolean active) {
        this.name = normalize(name);
        this.displayOrder = displayOrder == null ? 0 : displayOrder;
        this.active = active == null || active;
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
