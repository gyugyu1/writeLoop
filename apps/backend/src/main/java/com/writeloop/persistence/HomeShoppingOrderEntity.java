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

/** 라룹 홈쇼핑에서 산 가구 한 개. */
@Entity
@Table(name = "home_shopping_orders")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class HomeShoppingOrderEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "furniture_type", nullable = false, length = 40)
    private String furnitureType;

    @Column(name = "price", nullable = false)
    private Integer price;

    @Column(name = "item_id", nullable = false, length = 40)
    private String itemId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public HomeShoppingOrderEntity(Long userId, String furnitureType, int price, String itemId, Instant createdAt) {
        this.userId = userId;
        this.furnitureType = furnitureType;
        this.price = price;
        this.itemId = itemId;
        this.createdAt = createdAt;
    }
}
