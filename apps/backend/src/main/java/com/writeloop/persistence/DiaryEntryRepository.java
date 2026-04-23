package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DiaryEntryRepository extends JpaRepository<DiaryEntryEntity, String> {

    List<DiaryEntryEntity> findByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<DiaryEntryEntity> findByIdAndUserId(String id, Long userId);
}
