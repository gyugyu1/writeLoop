package com.writeloop.service;

import com.writeloop.dto.PromptCoachProfileDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;

import java.util.List;
import java.util.StringJoiner;

final class PromptOpenAiContextFormatter {

    private PromptOpenAiContextFormatter() {
    }

    static String formatCoachProfile(PromptDto prompt) {
        PromptCoachProfileDto profile = prompt == null ? null : prompt.coachProfile();
        if (profile == null) {
            return "- none";
        }

        return String.join("\n",
                "- primaryCategory: " + valueOrNone(profile.primaryCategory()),
                "- secondaryCategories: " + formatList(profile.secondaryCategories()),
                "- preferredExpressionFamilies: " + formatList(profile.preferredExpressionFamilies()),
                "- avoidFamilies: " + formatList(profile.avoidFamilies()),
                "- starterStyle: " + valueOrNone(profile.starterStyle()),
                "- notes: " + valueOrNone(profile.notes())
        );
    }

    static String formatPromptHints(List<PromptHintDto> hints) {
        if (hints == null || hints.isEmpty()) {
            return "- none";
        }

        StringJoiner joiner = new StringJoiner("\n");
        for (PromptHintDto hint : hints) {
            if (hint == null) {
                continue;
            }

            joiner.add("- ["
                    + valueOrNone(hint.hintType())
                    + "] "
                    + valueOrNone(hint.content()));
        }

        String text = joiner.toString();
        return text.isBlank() ? "- none" : text;
    }

    private static String formatList(List<String> values) {
        if (values == null || values.isEmpty()) {
            return "none";
        }

        StringJoiner joiner = new StringJoiner(", ");
        for (String value : values) {
            String normalized = normalize(value);
            if (!normalized.isBlank()) {
                joiner.add(normalized);
            }
        }

        String text = joiner.toString();
        return text.isBlank() ? "none" : text;
    }

    private static String valueOrNone(String value) {
        String normalized = normalize(value);
        return normalized.isBlank() ? "none" : normalized;
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
