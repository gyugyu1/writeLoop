package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DiaryAttemptRepository extends JpaRepository<DiaryAttemptEntity, Long> {

    int countByEntryId(String entryId);

    Optional<DiaryAttemptEntity> findByEntryIdAndAttemptNo(String entryId, Integer attemptNo);

    List<DiaryAttemptEntity> findByEntryIdInOrderByCreatedAtAsc(List<String> entryIds);

    List<DiaryAttemptEntity> findByEntryIdOrderByCreatedAtAsc(String entryId);
}
