package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface LobbyLayoutRepository extends JpaRepository<LobbyLayoutEntity, Long> {

    Optional<LobbyLayoutEntity> findByUserId(Long userId);

    void deleteAllByUserId(Long userId);
}
