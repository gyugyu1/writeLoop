package com.writeloop.service;

import com.writeloop.dto.AdminPromptTopicCatalogDto;
import com.writeloop.persistence.PromptTopicCategoryEntity;
import com.writeloop.persistence.PromptTopicCategoryRepository;
import com.writeloop.persistence.PromptTopicDetailEntity;
import com.writeloop.persistence.PromptTopicDetailRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class PromptTopicSupport {

    private final PromptTopicCategoryRepository promptTopicCategoryRepository;
    private final PromptTopicDetailRepository promptTopicDetailRepository;

    public void ensureCatalogSeeded() {
        List<PromptTopicCatalog.CategoryEntry> entries = PromptTopicCatalog.entries();
        for (int categoryIndex = 0; categoryIndex < entries.size(); categoryIndex++) {
            PromptTopicCatalog.CategoryEntry categoryEntry = entries.get(categoryIndex);
            int categoryDisplayOrder = categoryIndex + 1;
            PromptTopicCategoryEntity categoryEntity = promptTopicCategoryRepository.findByNameIgnoreCase(categoryEntry.category())
                    .orElseGet(() -> new PromptTopicCategoryEntity(
                            categoryEntry.category(),
                            categoryDisplayOrder,
                            true
                    ));
            categoryEntity.update(categoryEntry.category(), categoryDisplayOrder, true);
            categoryEntity = promptTopicCategoryRepository.save(categoryEntity);
            PromptTopicCategoryEntity resolvedCategoryEntity = categoryEntity;

            List<String> details = categoryEntry.details();
            for (int detailIndex = 0; detailIndex < details.size(); detailIndex++) {
                String detailName = details.get(detailIndex);
                int detailDisplayOrder = detailIndex + 1;
                PromptTopicDetailEntity detailEntity = promptTopicDetailRepository.findByCategoryIdAndDetailNameIgnoreCase(
                                resolvedCategoryEntity.getId(),
                                detailName
                        )
                        .orElseGet(() -> new PromptTopicDetailEntity(
                                resolvedCategoryEntity,
                                detailName,
                                detailDisplayOrder,
                                true
                        ));
                detailEntity.update(resolvedCategoryEntity, detailName, detailDisplayOrder, true);
                promptTopicDetailRepository.save(detailEntity);
            }
        }
    }

    public Optional<PromptTopicDetailEntity> findTopicDetail(String categoryName, String detailName) {
        if (categoryName == null || categoryName.isBlank() || detailName == null || detailName.isBlank()) {
            return Optional.empty();
        }
        return promptTopicDetailRepository.findByCategoryNameAndDetailNameIgnoreCase(categoryName.trim(), detailName.trim());
    }

    public PromptTopicDetailEntity requireTopicDetail(String categoryName, String detailName) {
        return findTopicDetail(categoryName, detailName)
                .orElseThrow(() -> new IllegalArgumentException("Unsupported topic category/detail combination."));
    }

    public List<AdminPromptTopicCatalogDto> findTopicCatalog() {
        Map<String, List<String>> detailsByCategory = new LinkedHashMap<>();
        for (PromptTopicDetailEntity detail : promptTopicDetailRepository.findActiveCatalogEntries()) {
            detailsByCategory.computeIfAbsent(detail.getCategory().getName(), ignored -> new ArrayList<>())
                    .add(detail.getName());
        }

        List<AdminPromptTopicCatalogDto> catalog = new ArrayList<>();
        for (PromptTopicCategoryEntity category : promptTopicCategoryRepository.findAllByActiveTrueOrderByDisplayOrderAscNameAsc()) {
            List<String> details = detailsByCategory.get(category.getName());
            if (details == null || details.isEmpty()) {
                continue;
            }
            catalog.add(new AdminPromptTopicCatalogDto(category.getName(), List.copyOf(details)));
        }
        return List.copyOf(catalog);
    }
}
