package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PromptHintRepository extends JpaRepository<PromptHintEntity, String> {

    List<PromptHintEntity> findAllByPromptIdAndActiveTrueOrderByDisplayOrderAsc(String promptId);

    List<PromptHintEntity> findAllByPromptIdOrderByDisplayOrderAsc(String promptId);

    List<PromptHintEntity> findAllByActiveTrueOrderByPromptIdAscDisplayOrderAscIdAsc();

    List<PromptHintEntity> findAllByOrderByPromptIdAscDisplayOrderAscIdAsc();
}
