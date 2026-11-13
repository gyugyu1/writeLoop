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

import java.time.Instant;

/** 계정이 가진 착용 아이템 하나(종류마다 하나). */
@Entity
@Table(name = "wardrobe_items")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class WardrobeItemEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "item_type", nullable = false, length = 40)
    private String itemType;

    @Column(name = "acquired_at", nullable = false)
    private Instant acquiredAt;

    public WardrobeItemEntity(Long userId, String itemType, Instant acquiredAt) {
        this.userId = userId;
        this.itemType = itemType;
        this.acquiredAt = acquiredAt;
    }
}
