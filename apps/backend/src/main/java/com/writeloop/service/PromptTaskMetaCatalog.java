package com.writeloop.service;

import com.writeloop.persistence.PromptEntity;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

final class PromptTaskMetaCatalog {

    private PromptTaskMetaCatalog() {
    }

    static List<String> answerModes() {
        return List.of(
                "ROUTINE",
                "PREFERENCE",
                "GOAL_PLAN",
                "PROBLEM_SOLUTION",
                "BALANCED_OPINION",
                "OPINION_REASON",
                "CHANGE_REFLECTION",
                "GENERAL_DESCRIPTION"
        );
    }

    static List<String> taskSlots() {
        return FeedbackSlotCatalog.canonicalSlots();
    }

    static TaskMetaEntry classify(PromptEntity prompt) {
        if (prompt == null) {
            return null;
        }
        String configuredMode = prompt.getTaskProfile() == null
                || prompt.getTaskProfile().getAnswerMode() == null
                ? null
                : prompt.getTaskProfile().getAnswerMode().getCode();
        return classify(prompt.getId(), prompt.getQuestionEn(), configuredMode);
    }

    static TaskMetaEntry classify(String promptId, String questionEn) {
        return classify(promptId, questionEn, null);
    }

    static TaskMetaEntry classify(String promptId, String questionEn, String configuredMode) {
        String normalizedId = normalize(promptId);
        String normalizedQuestion = normalize(questionEn);
        String answerMode = answerModeFromPromptId(normalizedId);
        if (answerMode == null) {
            answerMode = answerModeFromQuestion(normalizedQuestion);
        }
        String normalizedConfiguredMode = normalizeCode(configuredMode);
        if (answerMode == null
                && normalizedConfiguredMode != null
                && answerModes().contains(normalizedConfiguredMode)) {
            answerMode = normalizedConfiguredMode;
        }
        if (answerMode == null) {
            answerMode = "GENERAL_DESCRIPTION";
        }
        return entryFor(answerMode, normalizedQuestion);
    }

    private static String answerModeFromPromptId(String promptId) {
        if (promptId == null || promptId.isBlank()) {
            return null;
        }
        return switch (promptId) {
            case "prompt-a-1", "prompt-a-3", "prompt-a-4" -> "ROUTINE";
            case "prompt-a-2" -> "PREFERENCE";
            case "prompt-b-1" -> "PROBLEM_SOLUTION";
            case "prompt-b-2", "prompt-b-3", "prompt-b-4", "prompt-b-5" -> "GOAL_PLAN";
            case "prompt-c-1" -> "BALANCED_OPINION";
            case "prompt-c-2" -> "OPINION_REASON";
            case "prompt-c-3" -> "CHANGE_REFLECTION";
            default -> familyAnswerMode(promptId);
        };
    }

    private static String familyAnswerMode(String promptId) {
        if (promptId.startsWith("prompt-routine-")) return "ROUTINE";
        if (promptId.startsWith("prompt-preference-")) return "PREFERENCE";
        if (promptId.startsWith("prompt-goal-")) return "GOAL_PLAN";
        if (promptId.startsWith("prompt-problem-")) return "PROBLEM_SOLUTION";
        if (promptId.startsWith("prompt-balance-")) return "BALANCED_OPINION";
        if (promptId.startsWith("prompt-opinion-")) return "OPINION_REASON";
        if (promptId.startsWith("prompt-reflection-")) return "CHANGE_REFLECTION";
        if (promptId.startsWith("prompt-general-")) return "GENERAL_DESCRIPTION";
        return null;
    }

    private static String answerModeFromQuestion(String question) {
        if (containsAny(question,
                "changed over time", "changed your mind", "used to believe", "before and now",
                "what caused that change", "how has your", "how have your")) {
            return "CHANGE_REFLECTION";
        }
        if (containsAny(question,
                "benefits and drawbacks", "advantages and disadvantages", "pros and cons",
                "positive and negative", "mostly positive", "overall opinion", "what is your view")) {
            return "BALANCED_OPINION";
        }
        if (containsAny(question,
                "challenge", "problem", "deal with it", "handle it", "solve it", "what do you do when")) {
            return "PROBLEM_SOLUTION";
        }
        if (containsAny(question,
                "one goal", "your goal", "want to learn", "want to improve", "want to build",
                "want to reach", "want to work on", "how will you", "what steps will you take",
                "explain your plan")) {
            return "GOAL_PLAN";
        }
        if (containsAny(question,
                "usually", "every day", "each day", "often do", "typically", "your routine")) {
            return "ROUTINE";
        }
        if (containsAny(question,
                "favorite", "favourite", "do you like", "which do you prefer", "would you choose",
                "appeals to you", "what do you like about")) {
            return "PREFERENCE";
        }
        if (containsAny(question,
                "do you think", "should ", "why or why not", "your opinion", "what is your view",
                "what kind of social responsibility")) {
            return "OPINION_REASON";
        }
        return null;
    }

    private static TaskMetaEntry entryFor(String answerMode, String question) {
        List<String> required = new ArrayList<>();
        List<String> optional = new ArrayList<>();
        int minimumDepthSlots = 0;

        switch (answerMode) {
            case "ROUTINE" -> {
                required.add("ACTION");
                addLiteralQuestionRequirements(required, question);
                optional.addAll(List.of(
                        "ADDITIONAL_ACTION", "SPECIFIC_TIME", "PLACE", "REASON",
                        "DETAIL", "FEELING", "RESULT"
                ));
                minimumDepthSlots = required.size() == 1 ? 1 : 0;
            }
            case "PREFERENCE" -> {
                required.add("CHOICE");
                if (asksWhy(question)) required.add("REASON");
                optional.addAll(List.of("REASON", "DETAIL", "EXAMPLE", "FEELING", "RESULT"));
                minimumDepthSlots = required.size() == 1 ? 1 : 0;
            }
            case "GOAL_PLAN" -> {
                required.add("GOAL");
                if (asksForPlan(question)) required.add("PLAN");
                if (asksWhy(question)) required.add("REASON");
                optional.addAll(List.of("PLAN", "REASON", "SPECIFIC_TIME", "DETAIL", "RESULT"));
            }
            case "PROBLEM_SOLUTION" -> {
                required.add("PROBLEM");
                if (asksForSolution(question)) required.add("SOLUTION");
                if (asksWhy(question)) required.add("REASON");
                optional.addAll(List.of("SOLUTION", "REASON", "EXAMPLE", "FEELING", "RESULT"));
            }
            case "BALANCED_OPINION" -> {
                required.add("OPINION");
                if (asksForBothSides(question)) {
                    required.add("ADVANTAGE");
                    required.add("DISADVANTAGE");
                } else if (asksWhy(question)) {
                    required.add("REASON");
                }
                optional.addAll(List.of("ADVANTAGE", "DISADVANTAGE", "REASON", "EXAMPLE", "DETAIL"));
            }
            case "OPINION_REASON" -> {
                required.add("OPINION");
                if (asksWhy(question)) required.add("REASON");
                optional.addAll(List.of("REASON", "EXAMPLE", "DETAIL", "RESULT"));
            }
            case "CHANGE_REFLECTION" -> {
                required.add("BEFORE_STATE");
                required.add("NOW_STATE");
                if (asksWhy(question) || containsAny(question, "caused", "led to the change")) {
                    required.add("CHANGE_CAUSE");
                }
                optional.addAll(List.of("CHANGE_CAUSE", "EXAMPLE", "FEELING", "RESULT"));
            }
            default -> {
                addGeneralRequiredSlots(required, question);
                optional.addAll(List.of(
                        "DETAIL", "REASON", "EXAMPLE", "FEELING", "RESULT",
                        "SPECIFIC_TIME", "PLACE", "ACTION"
                ));
            }
        }
        return new TaskMetaEntry(
                answerMode,
                required,
                optional,
                defaultExpectedTense(answerMode),
                defaultExpectedPov(answerMode),
                minimumDepthSlots
        );
    }

    private static void addLiteralQuestionRequirements(List<String> required, String question) {
        if (asksWhy(question)) required.add("REASON");
        if (asksForSpecificTime(question)) required.add("SPECIFIC_TIME");
        if (asksForPlace(question)) required.add("PLACE");
    }

    private static void addGeneralRequiredSlots(List<String> required, String question) {
        if (question.startsWith("why ")) {
            required.add("REASON");
            return;
        }
        if (containsAny(question, "how do you feel", "how did you feel", "how would you feel")) {
            required.add("FEELING");
        } else if (asksForSpecificTime(question)) {
            required.add("SPECIFIC_TIME");
        } else if (asksForPlace(question)) {
            required.add("PLACE");
        } else if (asksForAction(question)) {
            required.add("ACTION");
        } else {
            required.add("DETAIL");
        }
        if (asksWhy(question)) required.add("REASON");
    }

    private static boolean asksWhy(String question) {
        return question.matches(".*\\bwhy\\b.*") || question.contains("reason");
    }

    private static boolean asksForPlan(String question) {
        return containsAny(question,
                "how will you", "how would you", "how do you plan", "what steps",
                "what will you do", "your plan", "make progress", "work toward");
    }

    private static boolean asksForSolution(String question) {
        return containsAny(question,
                "deal with", "handle", "solve", "what do you do about", "what would you do",
                "how do you respond", "how you try");
    }

    private static boolean asksForBothSides(String question) {
        return containsAny(question,
                "benefits and drawbacks", "advantages and disadvantages", "pros and cons",
                "positive and negative");
    }

    private static boolean asksForSpecificTime(String question) {
        return question.startsWith("when ") || question.contains("what time");
    }

    private static boolean asksForPlace(String question) {
        return question.startsWith("where ")
                || containsAny(question, "what place", "which place", "where would", "where do", "where did");
    }

    private static boolean asksForAction(String question) {
        return question.matches(".*\\bwhat (?:do|did|will|would|can) you do\\b.*")
                || question.matches(".*\\bhow (?:do|did|will|would|can) you\\b.*")
                || containsAny(question, "what do you say", "what did you do", "what would you buy");
    }

    private static boolean containsAny(String value, String... candidates) {
        if (value == null || candidates == null) {
            return false;
        }
        for (String candidate : candidates) {
            if (candidate != null && value.contains(candidate)) {
                return true;
            }
        }
        return false;
    }

    private static String defaultExpectedTense(String answerMode) {
        return switch (normalizeCode(answerMode)) {
            case "GOAL_PLAN" -> "FUTURE_PLAN";
            case "CHANGE_REFLECTION" -> "MIXED_PAST_PRESENT";
            default -> "PRESENT_SIMPLE";
        };
    }

    private static String defaultExpectedPov(String answerMode) {
        return switch (normalizeCode(answerMode)) {
            case "BALANCED_OPINION", "OPINION_REASON" -> "GENERAL_OR_FIRST_PERSON";
            default -> "FIRST_PERSON";
        };
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private static String normalizeCode(String value) {
        return value == null || value.isBlank() ? null : value.trim().toUpperCase(Locale.ROOT);
    }

    record TaskMetaEntry(
            String answerMode,
            List<String> requiredSlots,
            List<String> optionalSlots,
            String expectedTense,
            String expectedPov,
            int minimumDepthSlots
    ) {
        TaskMetaEntry(String answerMode, List<String> requiredSlots, List<String> optionalSlots) {
            this(answerMode, requiredSlots, optionalSlots, defaultExpectedTense(answerMode), defaultExpectedPov(answerMode), 0);
        }

        TaskMetaEntry(String answerMode, List<String> requiredSlots, List<String> optionalSlots, int minimumDepthSlots) {
            this(answerMode, requiredSlots, optionalSlots, defaultExpectedTense(answerMode), defaultExpectedPov(answerMode), minimumDepthSlots);
        }

        TaskMetaEntry(String answerMode, List<String> requiredSlots, List<String> optionalSlots, String expectedTense, String expectedPov) {
            this(answerMode, requiredSlots, optionalSlots, expectedTense, expectedPov, 0);
        }

        TaskMetaEntry {
            answerMode = normalizeCode(answerMode);
            requiredSlots = normalized(requiredSlots);
            Set<String> requiredSet = new LinkedHashSet<>(requiredSlots);
            optionalSlots = normalized(optionalSlots).stream()
                    .filter(slot -> !requiredSet.contains(slot))
                    .toList();
            expectedTense = normalizeCode(expectedTense);
            expectedPov = normalizeCode(expectedPov);
            minimumDepthSlots = Math.max(0, Math.min(minimumDepthSlots, optionalSlots.size()));
        }

        private static List<String> normalized(List<String> slotCodes) {
            if (slotCodes == null || slotCodes.isEmpty()) {
                return List.of();
            }
            Set<String> unique = new LinkedHashSet<>();
            for (String slotCode : slotCodes) {
                String normalized = normalizeCode(slotCode);
                if (FeedbackSlotCatalog.isCanonical(normalized)) {
                    unique.add(normalized);
                }
            }
            return List.copyOf(unique);
        }
    }
}
