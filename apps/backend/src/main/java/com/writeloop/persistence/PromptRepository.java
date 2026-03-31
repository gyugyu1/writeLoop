package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PromptRepository extends JpaRepository<PromptEntity, String> {

    @Query("""
            select distinct p
            from PromptEntity p
            left join fetch p.coachProfile
            left join fetch p.taskProfile tp
            left join fetch tp.answerMode
            left join fetch tp.slotAssignments tsa
            left join fetch tsa.slot
            where p.active = true
            order by p.displayOrder asc
            """)
    List<PromptEntity> findAllByActiveTrueOrderByDisplayOrderAsc();

    @Query("""
            select distinct p
            from PromptEntity p
            left join fetch p.coachProfile
            left join fetch p.taskProfile tp
            left join fetch tp.answerMode
            left join fetch tp.slotAssignments tsa
            left join fetch tsa.slot
            order by p.displayOrder asc
            """)
    List<PromptEntity> findAllByOrderByDisplayOrderAsc();

    @Query("""
            select distinct p
            from PromptEntity p
            left join fetch p.coachProfile
            left join fetch p.taskProfile tp
            left join fetch tp.answerMode
            left join fetch tp.slotAssignments tsa
            left join fetch tsa.slot
            where p.id = :promptId
            """)
    Optional<PromptEntity> findByIdWithCoachProfile(@Param("promptId") String promptId);
}
