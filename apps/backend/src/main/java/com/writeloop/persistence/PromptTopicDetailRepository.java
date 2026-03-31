package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PromptTopicDetailRepository extends JpaRepository<PromptTopicDetailEntity, Long> {

    @Query("""
            select detail
            from PromptTopicDetailEntity detail
            join fetch detail.category category
            where detail.active = true
              and category.active = true
            order by category.displayOrder asc, category.name asc, detail.displayOrder asc, detail.name asc
            """)
    List<PromptTopicDetailEntity> findActiveCatalogEntries();

    @Query("""
            select detail
            from PromptTopicDetailEntity detail
            join fetch detail.category category
            where lower(category.name) = lower(:categoryName)
              and lower(detail.name) = lower(:detailName)
            """)
    Optional<PromptTopicDetailEntity> findByCategoryNameAndDetailNameIgnoreCase(
            @Param("categoryName") String categoryName,
            @Param("detailName") String detailName
    );

    @Query("""
            select detail
            from PromptTopicDetailEntity detail
            join fetch detail.category category
            where category.id = :categoryId
              and lower(detail.name) = lower(:detailName)
            """)
    Optional<PromptTopicDetailEntity> findByCategoryIdAndDetailNameIgnoreCase(
            @Param("categoryId") Long categoryId,
            @Param("detailName") String detailName
    );
}
