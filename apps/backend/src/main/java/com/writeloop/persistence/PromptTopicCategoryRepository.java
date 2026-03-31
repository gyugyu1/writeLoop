package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PromptTopicCategoryRepository extends JpaRepository<PromptTopicCategoryEntity, Long> {

    List<PromptTopicCategoryEntity> findAllByActiveTrueOrderByDisplayOrderAscNameAsc();

    @Query("""
            select category
            from PromptTopicCategoryEntity category
            where lower(category.name) = lower(:name)
            """)
    Optional<PromptTopicCategoryEntity> findByNameIgnoreCase(@Param("name") String name);
}
