package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PromptRepository extends JpaRepository<PromptEntity, String> {

    List<PromptEntity> findAllByActiveTrueOrderByDisplayOrderAsc();

    List<PromptEntity> findAllByOrderByDisplayOrderAsc();
}
