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
@Table(name = "prompt_task_slots")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PromptTaskSlotEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String code;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    @Column(name = "is_active", nullable = false)
    private Boolean active;

    public PromptTaskSlotEntity(String code, Integer displayOrder, Boolean active) {
        this.code = code;
        this.displayOrder = displayOrder;
        this.active = active;
    }

    public void update(String code, Integer displayOrder, Boolean active) {
        this.code = code;
        this.displayOrder = displayOrder;
        this.active = active;
    }
}
