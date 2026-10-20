package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface DiaryAttemptRepository extends JpaRepository<DiaryAttemptEntity, Long> {

    int countByEntryId(String entryId);

    Optional<DiaryAttemptEntity> findByEntryIdAndAttemptNo(String entryId, Integer attemptNo);

    List<DiaryAttemptEntity> findByEntryIdInOrderByCreatedAtAsc(List<String> entryIds);

    List<DiaryAttemptEntity> findByEntryIdOrderByCreatedAtAsc(String entryId);

    @Modifying
    @Query("""
            delete from DiaryAttemptEntity a
            where a.entryId in (
                select e.id
                from DiaryEntryEntity e
                where e.userId = :userId
            )
            """)
    int purgeByUserId(@Param("userId") Long userId);
}
