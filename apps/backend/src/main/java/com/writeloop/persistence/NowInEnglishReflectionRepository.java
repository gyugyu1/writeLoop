package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;

public interface NowInEnglishReflectionRepository extends JpaRepository<NowInEnglishReflectionEntity, Long> {

    Optional<NowInEnglishReflectionEntity> findByUserIdAndReflectionDate(Long userId, LocalDate reflectionDate);
}
