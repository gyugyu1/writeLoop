package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface PromptHintItemRepository extends JpaRepository<PromptHintItemEntity, String> {

    List<PromptHintItemEntity> findAllByHintIdInAndActiveTrueOrderByDisplayOrderAsc(Collection<String> hintIds);

    List<PromptHintItemEntity> findAllByHintIdInOrderByDisplayOrderAsc(Collection<String> hintIds);

    long countByHintIdAndActiveTrue(String hintId);

    long countByHintId(String hintId);

    void deleteAllByHintId(String hintId);
}
