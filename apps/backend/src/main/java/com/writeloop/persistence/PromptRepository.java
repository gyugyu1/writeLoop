package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PromptRepository extends JpaRepository<PromptEntity, String> {

    @Query("""
            select p
            from PromptEntity p
            left join fetch p.coachProfile
            where p.active = true
            order by p.displayOrder asc
            """)
    List<PromptEntity> findAllByActiveTrueOrderByDisplayOrderAsc();

    @Query("""
            select p
            from PromptEntity p
            left join fetch p.coachProfile
            order by p.displayOrder asc
            """)
    List<PromptEntity> findAllByOrderByDisplayOrderAsc();

    @Query("""
            select p
            from PromptEntity p
            left join fetch p.coachProfile
            where p.id = :promptId
            """)
    Optional<PromptEntity> findByIdWithCoachProfile(@Param("promptId") String promptId);
}
