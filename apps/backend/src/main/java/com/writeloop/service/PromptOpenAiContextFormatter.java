package com.writeloop.service;

import com.writeloop.dto.PromptCoachProfileDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;
import com.writeloop.dto.PromptHintItemDto;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
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
                    + valueOrNone(formatHintContent(hint)));
        }

        String text = joiner.toString();
        return text.isBlank() ? "- none" : text;
    }

    static String formatCoachProfileInstructions(PromptDto prompt) {
        PromptCoachProfileDto profile = prompt == null ? null : prompt.coachProfile();
        if (profile == null) {
            return "- none";
        }

        List<String> lines = new ArrayList<>();
        String primaryCategory = normalize(profile.primaryCategory());
        String secondaryCategories = formatList(profile.secondaryCategories());
        String preferredFamilies = formatList(profile.preferredExpressionFamilies());
        String avoidFamilies = formatList(profile.avoidFamilies());
        String starterStyle = normalize(profile.starterStyle());
        String notes = normalize(profile.notes());

        if (!primaryCategory.isBlank()) {
            lines.add("- Primary answer mode: " + primaryCategory + ". Keep the answer shape and reusable expressions aligned with this mode.");
        }
        if (!"none".equals(secondaryCategories)) {
            lines.add("- Secondary topical angles to keep in mind: " + secondaryCategories + ".");
        }
        if (!"none".equals(preferredFamilies)) {
            lines.add("- Soft-prefer these expression families when they fit the learner answer: " + preferredFamilies + ".");
        }
        if (!"none".equals(avoidFamilies)) {
            lines.add("- Avoid these expression families unless they are clearly necessary for a natural improvement: " + avoidFamilies + ".");
        }
        if (!starterStyle.isBlank()) {
            lines.add("- Starter style bias: " + starterStyle + starterStyleGuidance(starterStyle));
        }
        if (!notes.isBlank()) {
            lines.add("- Extra coaching note: " + notes);
        }

        return lines.isEmpty() ? "- none" : String.join("\n", lines);
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

    private static String formatHintContent(PromptHintDto hint) {
        if (hint.items() != null && !hint.items().isEmpty()) {
            StringJoiner joiner = new StringJoiner(" | ");
            for (PromptHintItemDto item : hint.items()) {
                if (item == null) {
                    continue;
                }
                String normalized = normalize(item.content());
                if (!normalized.isBlank()) {
                    joiner.add(normalized);
                }
            }
            String text = joiner.toString();
            if (!text.isBlank()) {
                return text;
            }
        }
        return hint.content();
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private static String starterStyleGuidance(String starterStyle) {
        return switch (starterStyle.toUpperCase(Locale.ROOT)) {
            case "DIRECT" -> " -> prefer concise and direct framing over reflective setup.";
            case "REFLECTIVE" -> " -> prefer reflection, change, cause, or realization frames when they fit.";
            case "BALANCED" -> " -> prefer qualification, contrast, or balanced pros-and-cons framing when they fit.";
            default -> ".";
        };
    }
}
