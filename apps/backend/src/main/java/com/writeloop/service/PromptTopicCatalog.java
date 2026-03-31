package com.writeloop.service;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public final class PromptTopicCatalog {

    public record CategoryEntry(String category, List<String> details) {
    }

    private static final Map<String, List<String>> TOPICS_BY_CATEGORY = createCatalog();

    private PromptTopicCatalog() {
    }

    public static List<String> categories() {
        return List.copyOf(TOPICS_BY_CATEGORY.keySet());
    }

    public static List<CategoryEntry> entries() {
        return TOPICS_BY_CATEGORY.entrySet().stream()
                .map(entry -> new CategoryEntry(entry.getKey(), entry.getValue()))
                .toList();
    }

    public static List<String> detailsForCategory(String category) {
        String normalizedCategory = normalize(category);
        return TOPICS_BY_CATEGORY.entrySet().stream()
                .filter(entry -> normalize(entry.getKey()).equals(normalizedCategory))
                .findFirst()
                .map(Map.Entry::getValue)
                .orElseGet(List::of);
    }

    public static boolean isAllowed(String category, String detail) {
        String normalizedCategory = normalize(category);
        String normalizedDetail = normalize(detail);

        if (normalizedCategory.isBlank() || normalizedDetail.isBlank()) {
            return false;
        }

        return TOPICS_BY_CATEGORY.entrySet().stream()
                .filter(entry -> normalize(entry.getKey()).equals(normalizedCategory))
                .flatMap(entry -> entry.getValue().stream())
                .anyMatch(allowedDetail -> normalize(allowedDetail).equals(normalizedDetail));
    }

    private static Map<String, List<String>> createCatalog() {
        Map<String, List<String>> catalog = new LinkedHashMap<>();
        catalog.put("Routine", List.of("After Dinner", "Weekend", "After-Work Evenings"));
        catalog.put("Preference", List.of("Favorite Food"));
        catalog.put("Problem Solving", List.of("Work or School Challenge"));
        catalog.put("Goal Plan", List.of("Travel Destination", "Habit Building", "Skill Growth"));
        catalog.put("Balanced Opinion", List.of("Technology and Relationships"));
        catalog.put("Opinion Reason", List.of("Corporate Responsibility"));
        catalog.put("Change Reflection", List.of("Personal Belief"));
        return Collections.unmodifiableMap(catalog);
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }
}
