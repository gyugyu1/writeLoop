package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

public interface WardrobeOutfitRepository extends JpaRepository<WardrobeOutfitEntity, Long> {

    void deleteAllByUserId(Long userId);
}
