package com.writeloop.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

/** 계정이 부위별로 입은 착용 아이템(입지 않은 부위는 null). 계정마다 한 줄이다. */
@Entity
@Table(name = "wardrobe_outfits")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class WardrobeOutfitEntity {

    @Id
    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "hat_item", length = 40)
    private String hatItem;

    @Column(name = "top_item", length = 40)
    private String topItem;

    @Column(name = "bottom_item", length = 40)
    private String bottomItem;

    @Column(name = "shoes_item", length = 40)
    private String shoesItem;

    @Column(name = "face_item", length = 40)
    private String faceItem;

    @Column(name = "back_item", length = 40)
    private String backItem;

    @Column(name = "accessory_item", length = 40)
    private String accessoryItem;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public WardrobeOutfitEntity(Long userId) {
        this.userId = userId;
        this.updatedAt = Instant.now();
    }

    /** 부위별 입은 아이템을 한꺼번에 바꾼다(값은 서비스가 검사한 것). */
    public void wear(String hat, String top, String bottom, String shoes, String face, String back, String accessory, Instant now) {
        this.hatItem = hat;
        this.topItem = top;
        this.bottomItem = bottom;
        this.shoesItem = shoes;
        this.faceItem = face;
        this.backItem = back;
        this.accessoryItem = accessory;
        this.updatedAt = now;
    }
}
