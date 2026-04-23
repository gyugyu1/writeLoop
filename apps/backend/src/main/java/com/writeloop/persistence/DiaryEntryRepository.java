package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface DiaryEntryRepository extends JpaRepository<DiaryEntryEntity, String> {

    List<DiaryEntryEntity> findByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<DiaryEntryEntity> findByIdAndUserId(String id, Long userId);

    long countByUserId(Long userId);

    @Query("""
            select e.id as id, e.entryDate as entryDate, e.createdAt as createdAt
            from DiaryEntryEntity e
            where e.userId = :userId
            order by e.entryDate desc, e.createdAt desc
            """)
    List<DiaryCalendarEntryProjection> findCalendarEntriesByUserId(@Param("userId") Long userId);
}
