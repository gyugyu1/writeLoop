package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetTokenEntity, Long> {

    Optional<PasswordResetTokenEntity> findFirstByEmailAndResetCodeAndUsedAtIsNullOrderByCreatedAtDesc(
            String email,
            String resetCode
    );

    List<PasswordResetTokenEntity> findAllByEmailAndUsedAtIsNull(String email);

    void deleteAllByUserId(Long userId);
}
