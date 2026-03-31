package com.writeloop.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
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
@Table(name = "prompt_task_profile_slots")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PromptTaskProfileSlotEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "prompt_id",
            nullable = false,
            foreignKey = @ForeignKey(name = "fk_prompt_task_profile_slots_profile")
    )
    private PromptTaskProfileEntity profile;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(
            name = "slot_id",
            nullable = false,
            foreignKey = @ForeignKey(name = "fk_prompt_task_profile_slots_slot")
    )
    private PromptTaskSlotEntity slot;

    @Column(name = "slot_role", nullable = false, length = 16)
    private String slotRole;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    @Column(name = "is_active", nullable = false)
    private Boolean active;

    public PromptTaskProfileSlotEntity(
            PromptTaskProfileEntity profile,
            PromptTaskSlotEntity slot,
            String slotRole,
            Integer displayOrder,
            Boolean active
    ) {
        attachProfile(profile);
        this.slot = slot;
        this.slotRole = slotRole;
        this.displayOrder = displayOrder;
        this.active = active;
    }

    public void attachProfile(PromptTaskProfileEntity profile) {
        this.profile = profile;
    }

    public void update(
            PromptTaskSlotEntity slot,
            String slotRole,
            Integer displayOrder,
            Boolean active
    ) {
        this.slot = slot;
        this.slotRole = slotRole;
        this.displayOrder = displayOrder;
        this.active = active;
    }
}
