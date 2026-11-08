package com.writeloop.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

/** 모바일 홈 로비의 가구 배치. 계정마다 하나다. */
@Entity
@Table(name = "lobby_layouts")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class LobbyLayoutEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    @Column(name = "shape_version", nullable = false)
    private Integer shapeVersion;

    @Column(name = "layout_json", nullable = false, columnDefinition = "JSON")
    private String layoutJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public LobbyLayoutEntity(Long userId, Integer shapeVersion, String layoutJson) {
        this.userId = userId;
        this.shapeVersion = shapeVersion;
        this.layoutJson = layoutJson;
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public void replace(Integer shapeVersion, String layoutJson) {
        this.shapeVersion = shapeVersion;
        this.layoutJson = layoutJson;
    }
}
