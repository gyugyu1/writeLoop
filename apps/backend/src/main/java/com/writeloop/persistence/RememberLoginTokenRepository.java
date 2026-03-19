package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RememberLoginTokenRepository extends JpaRepository<RememberLoginTokenEntity, Long> {

    Optional<RememberLoginTokenEntity> findFirstByTokenHashAndRevokedAtIsNull(String tokenHash);
}
