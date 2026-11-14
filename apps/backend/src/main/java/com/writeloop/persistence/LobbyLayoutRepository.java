package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface LobbyLayoutRepository extends JpaRepository<LobbyLayoutEntity, Long> {

    Optional<LobbyLayoutEntity> findByUserId(Long userId);

    /** 계정의 배치를 넣거나 덮어쓴다. 같은 계정의 첫 저장이 거의 동시에 둘 와도 유일 키에 걸리지 않게 한 문장으로 한다. */
    @Modifying(clearAutomatically = true)
    @Query(value = """
            INSERT INTO lobby_layouts (user_id, shape_version, layout_json, created_at, updated_at)
            VALUES (:userId, :shapeVersion, :layoutJson, :now, :now)
            ON DUPLICATE KEY UPDATE
                shape_version = VALUES(shape_version),
                layout_json = VALUES(layout_json),
                updated_at = VALUES(updated_at)
            """, nativeQuery = true)
    void upsert(
            @Param("userId") Long userId,
            @Param("shapeVersion") int shapeVersion,
            @Param("layoutJson") String layoutJson,
            @Param("now") Instant now
    );

    void deleteAllByUserId(Long userId);
}
