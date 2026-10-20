package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Optional;

public interface NowInEnglishReflectionRepository extends JpaRepository<NowInEnglishReflectionEntity, Long> {

    Optional<NowInEnglishReflectionEntity> findByUserIdAndReflectionDate(Long userId, LocalDate reflectionDate);

    @Modifying
    @Query("delete from NowInEnglishReflectionEntity e where e.userId = :userId")
    int purgeByUserId(@Param("userId") Long userId);
}
