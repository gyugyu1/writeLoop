package com.writeloop.service;

import com.writeloop.dto.PromptHintItemDto;
import com.writeloop.persistence.PromptHintEntity;
import com.writeloop.persistence.PromptHintItemEntity;
import com.writeloop.persistence.PromptHintItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class PromptHintItemSupport {

    private static final Pattern QUOTED_HINT_ITEM_PATTERN = Pattern.compile("\"([^\"]+)\"");

    public static final String HINT_TYPE_STARTER = "STARTER";
    public static final String HINT_TYPE_VOCAB_WORD = "VOCAB_WORD";
    public static final String HINT_TYPE_VOCAB_PHRASE = "VOCAB_PHRASE";
    public static final String HINT_TYPE_STRUCTURE = "STRUCTURE";
    public static final String HINT_TYPE_DETAIL = "DETAIL";
    public static final String HINT_TYPE_LINKER = "LINKER";

    private final PromptHintItemRepository promptHintItemRepository;

    public List<PromptHintItemDto> resolveItems(List<PromptHintItemEntity> persistedItems) {
        if (persistedItems == null || persistedItems.isEmpty()) {
            return List.of();
        }

        return persistedItems.stream()
                .map(this::toDto)
                .toList();
    }

    public String resolveTitle(PromptHintEntity hint) {
        if (hint == null) {
            return "";
        }
        return resolveTitle(hint.getTitle(), hint.getHintType(), hint.getContent());
    }

    public String resolveTitle(String title, String hintType) {
        return resolveTitle(title, hintType, null);
    }

    public String resolveTitle(String title, String hintType, String legacyContent) {
        String normalizedTitle = normalizeHintItemContent(title);
        if (!normalizedTitle.isBlank()) {
            return normalizedTitle;
        }

        String extracted = extractTitleFromContent(legacyContent);
        if (!extracted.isBlank()) {
            return extracted;
        }
        return defaultTitleForHintType(hintType);
    }

    public List<PromptHintItemDto> deriveDtos(PromptHintEntity hint) {
        return deriveEntities(hint).stream()
                .map(this::toDto)
                .toList();
    }

    public String normalizeHintType(String hintType, String title, List<String> itemContents) {
        String normalizedType = normalizeHintItemContent(hintType).toUpperCase(Locale.ROOT);
        String normalizedTitle = normalizeHintItemContent(title);
        List<String> normalizedItems = normalizeItemContents(itemContents);

        if ("VOCAB".equals(normalizedType) || "PHRASE".equals(normalizedType) || "EXPRESSION".equals(normalizedType)) {
            if (looksLikePhraseBank(normalizedTitle, normalizedItems)) {
                return HINT_TYPE_VOCAB_PHRASE;
            }
            return HINT_TYPE_VOCAB_WORD;
        }

        return switch (normalizedType) {
            case HINT_TYPE_STARTER,
                    HINT_TYPE_VOCAB_WORD,
                    HINT_TYPE_VOCAB_PHRASE,
                    HINT_TYPE_STRUCTURE,
                    HINT_TYPE_DETAIL,
                    HINT_TYPE_LINKER -> normalizedType;
            default -> normalizedType;
        };
    }

    public List<String> normalizeItemContents(List<String> values) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }

        LinkedHashSet<String> deduped = new LinkedHashSet<>();
        for (String value : values) {
            String normalized = normalizeHintItemContent(value);
            if (!normalized.isBlank()) {
                deduped.add(normalized);
            }
        }
        return List.copyOf(deduped);
    }

    public void syncHintItems(PromptHintEntity hint, List<String> itemContents) {
        promptHintItemRepository.deleteAllByHintId(hint.getId());

        List<String> normalizedItems = normalizeItemContents(itemContents);
        if (normalizedItems.isEmpty()) {
            if (hint.getContent() == null || hint.getContent().isBlank()) {
                return;
            }
            normalizedItems = deriveDtos(hint).stream()
                    .map(PromptHintItemDto::content)
                    .toList();
        }

        if (normalizedItems.isEmpty()) {
            return;
        }

        List<PromptHintItemEntity> items = buildEntitiesFromContents(
                hint,
                normalizedItems,
                normalizeHintType(hint.getHintType(), hint.getTitle(), normalizedItems)
        );
        if (!items.isEmpty()) {
            promptHintItemRepository.saveAll(items);
        }
    }

    public void deleteHintItems(String hintId) {
        promptHintItemRepository.deleteAllByHintId(hintId);
    }

    public void backfillMissingItems(List<PromptHintEntity> hints) {
        for (PromptHintEntity hint : hints) {
            if (hint == null || promptHintItemRepository.countByHintId(hint.getId()) > 0) {
                continue;
            }
            syncHintItems(hint, List.of());
        }
    }

    public boolean isWordHintType(String hintType) {
        return HINT_TYPE_VOCAB_WORD.equals(normalizeHintTypeValue(hintType));
    }

    public boolean isPhraseHintType(String hintType) {
        String normalized = normalizeHintTypeValue(hintType);
        return HINT_TYPE_VOCAB_PHRASE.equals(normalized) || HINT_TYPE_LINKER.equals(normalized);
    }

    public boolean isStarterLikeHintType(String hintType) {
        String normalized = normalizeHintTypeValue(hintType);
        return HINT_TYPE_STARTER.equals(normalized)
                || HINT_TYPE_STRUCTURE.equals(normalized)
                || HINT_TYPE_DETAIL.equals(normalized);
    }

    public String defaultTitleForHintType(String hintType) {
        return switch (normalizeHintTypeValue(hintType)) {
            case HINT_TYPE_STARTER -> "첫 문장 스타터";
            case HINT_TYPE_VOCAB_WORD -> "활용 단어";
            case HINT_TYPE_VOCAB_PHRASE -> "활용 표현";
            case HINT_TYPE_STRUCTURE -> "답변 구조";
            case HINT_TYPE_DETAIL -> "추가 설명";
            case HINT_TYPE_LINKER -> "연결 표현";
            default -> "힌트";
        };
    }

    public String defaultItemType(String hintType) {
        return switch (normalizeHintTypeValue(hintType)) {
            case HINT_TYPE_VOCAB_WORD -> "WORD";
            case HINT_TYPE_VOCAB_PHRASE, HINT_TYPE_LINKER -> "PHRASE";
            default -> "FRAME";
        };
    }

    private List<PromptHintItemEntity> deriveEntities(PromptHintEntity hint) {
        String content = normalizeHintItemContent(hint.getContent());
        if (content.isBlank()) {
            return List.of();
        }

        String normalizedHintType = normalizeHintType(
                hint.getHintType(),
                resolveTitle(hint.getTitle(), hint.getHintType(), content),
                List.of(content)
        );

        List<String> candidates = new ArrayList<>();
        Matcher quotedMatcher = QUOTED_HINT_ITEM_PATTERN.matcher(content);
        while (quotedMatcher.find()) {
            String candidate = normalizeHintItemContent(quotedMatcher.group(1));
            if (!candidate.isBlank()) {
                candidates.add(candidate);
            }
        }

        if (candidates.isEmpty() && (isWordHintType(normalizedHintType) || isPhraseHintType(normalizedHintType))) {
            String hintText = content.replaceFirst("^[^:]*:\\s*", "");
            for (String part : hintText.split(",")) {
                String candidate = normalizeHintItemContent(part);
                if (!candidate.isBlank()) {
                    candidates.add(candidate);
                }
            }
        }

        if (candidates.isEmpty()) {
            candidates.add(content);
        }

        return buildEntitiesFromContents(hint, normalizeItemContents(candidates), normalizedHintType);
    }

    private PromptHintItemDto toDto(PromptHintItemEntity item) {
        return new PromptHintItemDto(
                item.getId(),
                item.getHintId(),
                item.getItemType(),
                item.getContent(),
                item.getMeaningKo(),
                item.getUsageTipKo(),
                item.getExampleEn(),
                item.getExpressionFamily(),
                item.getDisplayOrder()
        );
    }

    private List<PromptHintItemEntity> buildEntitiesFromContents(
            PromptHintEntity hint,
            List<String> candidates,
            String normalizedHintType
    ) {
        List<PromptHintItemEntity> items = new ArrayList<>();
        int displayOrder = 1;

        for (String candidate : candidates) {
            items.add(new PromptHintItemEntity(
                    hint.getId() + "-item-" + displayOrder,
                    hint.getId(),
                    defaultItemType(normalizedHintType),
                    candidate,
                    null,
                    null,
                    null,
                    null,
                    displayOrder,
                    Boolean.TRUE.equals(hint.getActive())
            ));
            displayOrder += 1;
        }

        return items;
    }

    private boolean looksLikePhraseBank(String title, List<String> itemContents) {
        String normalizedTitle = title.toLowerCase(Locale.ROOT);
        if (normalizedTitle.contains("표현") || normalizedTitle.contains("phrase") || normalizedTitle.contains("expression")) {
            return true;
        }

        long spacedItems = itemContents.stream()
                .filter(item -> item.contains(" "))
                .count();
        return spacedItems > 0;
    }

    private String normalizeHintTypeValue(String hintType) {
        return normalizeHintItemContent(hintType).toUpperCase(Locale.ROOT);
    }

    private String normalizeHintItemContent(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }

    private String extractTitleFromContent(String content) {
        String normalized = normalizeHintItemContent(content);
        if (normalized.isBlank()) {
            return "";
        }

        int colonIndex = normalized.indexOf(':');
        if (colonIndex <= 0) {
            return "";
        }

        String prefix = normalizeHintItemContent(normalized.substring(0, colonIndex));
        if (prefix.isBlank() || prefix.length() > 40 || prefix.contains("\"")) {
            return "";
        }
        return prefix;
    }
}
