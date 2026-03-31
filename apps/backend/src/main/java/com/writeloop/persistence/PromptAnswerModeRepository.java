package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PromptAnswerModeRepository extends JpaRepository<PromptAnswerModeEntity, Long> {

    Optional<PromptAnswerModeEntity> findByCodeIgnoreCase(String code);

    List<PromptAnswerModeEntity> findAllByActiveTrueOrderByDisplayOrderAscCodeAsc();
}
