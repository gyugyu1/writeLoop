package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PromptTaskSlotRepository extends JpaRepository<PromptTaskSlotEntity, Long> {

    Optional<PromptTaskSlotEntity> findByCodeIgnoreCase(String code);

    List<PromptTaskSlotEntity> findAllByActiveTrueOrderByDisplayOrderAscCodeAsc();
}
