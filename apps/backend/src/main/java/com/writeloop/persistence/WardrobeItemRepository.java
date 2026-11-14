package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WardrobeItemRepository extends JpaRepository<WardrobeItemEntity, Long> {

    /** 계정이 가진 아이템을 얻은 순서로. */
    List<WardrobeItemEntity> findAllByUserIdOrderByAcquiredAtAscIdAsc(Long userId);

    void deleteAllByUserId(Long userId);
}
