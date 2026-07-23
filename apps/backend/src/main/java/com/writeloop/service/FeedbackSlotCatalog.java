package com.writeloop.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

final class FeedbackSlotCatalog {

    private static final List<String> CANONICAL_SLOTS = List.of(
            "ACTION",
            "CHOICE",
            "GOAL",
            "PROBLEM",
            "OPINION",
            "PLAN",
            "SOLUTION",
            "ADVANTAGE",
            "DISADVANTAGE",
            "BEFORE_STATE",
            "NOW_STATE",
            "CHANGE_CAUSE",
            "ADDITIONAL_ACTION",
            "SPECIFIC_TIME",
            "PLACE",
            "REASON",
            "DETAIL",
            "EXAMPLE",
            "FEELING",
            "RESULT"
    );

    private static final Set<String> CORE_SLOTS = Set.of(
            "ACTION",
            "CHOICE",
            "GOAL",
            "PROBLEM",
            "OPINION",
            "BEFORE_STATE",
            "NOW_STATE"
    );

    private FeedbackSlotCatalog() {
    }

    static List<String> canonicalSlots() {
        return CANONICAL_SLOTS;
    }

    static boolean isCanonical(String slot) {
        return CANONICAL_SLOTS.contains(normalizeCode(slot));
    }

    static boolean isCore(String slot) {
        return CORE_SLOTS.contains(normalizeCode(slot));
    }

    static String normalizeSlot(String slot, String answerMode) {
        String normalized = normalizeCode(slot);
        if (CANONICAL_SLOTS.contains(normalized)) {
            return normalized;
        }
        return switch (normalized) {
            case "MAIN_ANSWER" -> primarySlotForAnswerMode(answerMode);
            case "ACTIVITY" -> activitySlotForAnswerMode(answerMode);
            case "ADDITIONAL_ACTIVITY" -> "ADDITIONAL_ACTION";
            case "TIME", "SITUATION", "TIME_OR_PLACE" -> "SPECIFIC_TIME";
            case "CONTEXT" -> "DETAIL";
            default -> null;
        };
    }

    static String targetSlotForUi(MissionDecision decision) {
        if (decision == null
                || (decision.missionKind() != MissionKind.SLOT
                && decision.missionKind() != MissionKind.TASK_RESET)) {
            return null;
        }

        String chosenSlot = normalizeCode(decision.chosenSlot());
        if (CANONICAL_SLOTS.contains(chosenSlot)) {
            return chosenSlot;
        }

        if (decision.missingSlots() == null) {
            return null;
        }
        return decision.missingSlots().stream()
                .map(FeedbackSlotCatalog::normalizeCode)
                .filter(CANONICAL_SLOTS::contains)
                .findFirst()
                .orElse(null);
    }

    static Map<String, String> glossary() {
        Map<String, String> definitions = new LinkedHashMap<>();
        definitions.put("ACTION", "the action or routine that directly answers what the learner does");
        definitions.put("CHOICE", "the selected person, thing, place, or preference");
        definitions.put("GOAL", "the outcome, skill, or habit the learner wants");
        definitions.put("PROBLEM", "the challenge or difficulty being described");
        definitions.put("OPINION", "the learner's position or judgment");
        definitions.put("PLAN", "a concrete method, step, or intended action toward a goal");
        definitions.put("SOLUTION", "what the learner does or would do to handle a problem");
        definitions.put("ADVANTAGE", "one positive side or benefit");
        definitions.put("DISADVANTAGE", "one negative side or drawback");
        definitions.put("BEFORE_STATE",
                "the learner's actual earlier state, habit, method, or opinion; generic change wording such as "
                        + "\"used to meet differently\" or \"things were different before\" is GENERIC unless it says what was different");
        definitions.put("NOW_STATE", "the learner's current state, habit, or opinion");
        definitions.put("CHANGE_CAUSE", "what caused a change between the earlier and current state");
        definitions.put("ADDITIONAL_ACTION", "a separate second action beyond the main action");
        definitions.put(
                "SPECIFIC_TIME",
                "a meaningful time, day, frequency, stage, or timing condition; a broad but real expression such as "
                        + "\"in the morning\" may be concrete when it fulfills the question-specific timing role"
        );
        definitions.put("PLACE",
                "a recognizable location, area, or place reference; evaluative placeholders such as \"a nice area\", "
                        + "\"a good place\", or \"somewhere nearby\" are GENERIC because they do not identify where");
        definitions.put("REASON",
                "a concrete cause, motivation, benefit, effect, or personal association explaining why; circular evaluations such as "
                        + "\"because it is nice\", \"because it is good\", or \"because I like it\" are GENERIC because they do not explain why");
        definitions.put("DETAIL", "a concrete modifier or fact that makes an existing point more specific");
        definitions.put("EXAMPLE", "a specific instance that illustrates an existing point");
        definitions.put("FEELING", "the learner's emotion or personal reaction");
        definitions.put("RESULT", "an outcome, effect, or consequence");
        return Map.copyOf(definitions);
    }

    private static String primarySlotForAnswerMode(String answerMode) {
        return switch (normalizeCode(answerMode)) {
            case "PREFERENCE" -> "CHOICE";
            case "GOAL_PLAN" -> "GOAL";
            case "PROBLEM_SOLUTION" -> "PROBLEM";
            case "BALANCED_OPINION", "OPINION_REASON" -> "OPINION";
            case "CHANGE_REFLECTION" -> "NOW_STATE";
            case "GENERAL_DESCRIPTION" -> "DETAIL";
            default -> "ACTION";
        };
    }

    private static String activitySlotForAnswerMode(String answerMode) {
        return switch (normalizeCode(answerMode)) {
            case "GOAL_PLAN" -> "PLAN";
            case "PROBLEM_SOLUTION" -> "SOLUTION";
            default -> "ACTION";
        };
    }

    private static String normalizeCode(String value) {
        return value == null
                ? ""
                : value.trim().toUpperCase(Locale.ROOT).replace('-', '_').replaceAll("\\s+", "_");
    }
}
