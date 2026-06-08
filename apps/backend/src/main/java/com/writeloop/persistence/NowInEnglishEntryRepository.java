package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface NowInEnglishEntryRepository extends JpaRepository<NowInEnglishEntryEntity, Long> {

    List<NowInEnglishEntryEntity> findTop120ByUserIdOrderByCreatedAtDesc(Long userId);

    List<NowInEnglishEntryEntity> findByUserIdAndEntryDateOrderByCreatedAtAsc(Long userId, LocalDate entryDate);

    Optional<NowInEnglishEntryEntity> findByUserIdAndEntryId(Long userId, String entryId);
}
