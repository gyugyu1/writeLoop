package com.writeloop.service;

import com.writeloop.persistence.PromptEntity;

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
        return List.of(
                "MAIN_ANSWER",
                "REASON",
                "EXAMPLE",
                "FEELING",
                "ACTIVITY",
                "TIME_OR_PLACE"
        );
    }

    static TaskMetaEntry classify(PromptEntity prompt) {
        if (prompt == null) {
            return null;
        }
        return classify(prompt.getId(), prompt.getQuestionEn());
    }

    static TaskMetaEntry classify(String promptId, String questionEn) {
        String normalizedId = normalize(promptId);
        String normalizedQuestion = normalize(questionEn);

        TaskMetaEntry canonical = classifyCanonicalPrompt(normalizedId);
        if (canonical != null) {
            return canonical;
        }

        if (normalizedId.startsWith("prompt-routine-")) {
            return routine();
        }
        if (normalizedId.startsWith("prompt-preference-")) {
            return preference();
        }
        if (normalizedId.startsWith("prompt-goal-")) {
            return goalPlan(variantFromPromptId(normalizedId));
        }
        if (normalizedId.startsWith("prompt-problem-")) {
            return problemSolution();
        }
        if (normalizedId.startsWith("prompt-balance-")) {
            return balancedOpinion();
        }
        if (normalizedId.startsWith("prompt-opinion-")) {
            return opinionReason();
        }
        if (normalizedId.startsWith("prompt-reflection-")) {
            return changeReflection(variantFromPromptId(normalizedId));
        }
        if (normalizedId.startsWith("prompt-general-")) {
            return generalDescription();
        }

        return classifyByQuestion(normalizedQuestion);
    }

    private static TaskMetaEntry classifyCanonicalPrompt(String promptId) {
        return switch (promptId) {
            case "prompt-a-1" -> routine();
            case "prompt-a-2" -> preference();
            case "prompt-a-3" -> routine();
            case "prompt-a-4" -> new TaskMetaEntry("ROUTINE",
                    List.of("MAIN_ANSWER", "REASON"),
                    List.of("ACTIVITY", "TIME_OR_PLACE"));
            case "prompt-b-1" -> problemSolution();
            case "prompt-b-2" -> new TaskMetaEntry("GOAL_PLAN",
                    List.of("MAIN_ANSWER", "ACTIVITY"),
                    List.of("REASON", "TIME_OR_PLACE"));
            case "prompt-b-3" -> new TaskMetaEntry("GOAL_PLAN",
                    List.of("MAIN_ANSWER", "REASON"),
                    List.of("ACTIVITY", "TIME_OR_PLACE"));
            case "prompt-b-4", "prompt-b-5" -> new TaskMetaEntry("GOAL_PLAN",
                    List.of("MAIN_ANSWER", "ACTIVITY"),
                    List.of("REASON", "TIME_OR_PLACE"));
            case "prompt-c-1" -> new TaskMetaEntry("BALANCED_OPINION",
                    List.of("MAIN_ANSWER", "REASON"),
                    List.of("EXAMPLE", "FEELING"));
            case "prompt-c-2" -> opinionReason();
            case "prompt-c-3" -> new TaskMetaEntry("CHANGE_REFLECTION",
                    List.of("MAIN_ANSWER", "REASON"),
                    List.of("TIME_OR_PLACE", "FEELING"));
            default -> null;
        };
    }

    private static TaskMetaEntry classifyByQuestion(String questionEn) {
        if (questionEn.contains("favorite")
                || questionEn.contains("favourite")
                || questionEn.contains("appeals to you")
                || questionEn.contains("why do you like")) {
            return preference();
        }
        if (questionEn.contains("usually spend")
                || questionEn.contains("usually do")
                || questionEn.contains("describe your routine")
                || questionEn.contains("often do")
                || questionEn.contains("typically use")) {
            return routine();
        }
        if (questionEn.contains("how will you")
                || questionEn.contains("explain your plan")
                || questionEn.contains("make progress")
                || questionEn.contains("what steps will you take")
                || questionEn.contains("want to improve this year")
                || questionEn.contains("want to build this year")
                || questionEn.contains("want to reach this year")
                || questionEn.contains("want to work on this year")) {
            return goalPlan(1);
        }
        if (questionEn.contains("challenge")
                || questionEn.contains("how do you deal with it")
                || questionEn.contains("how you deal with it")
                || questionEn.contains("what you do about it")
                || questionEn.contains("how you try to solve it")) {
            return problemSolution();
        }
        if (questionEn.contains("benefits and drawbacks")
                || questionEn.contains("mostly positive")
                || questionEn.contains("mostly good")
                || questionEn.contains("what is your view")
                || questionEn.contains("overall opinion")) {
            return balancedOpinion();
        }
        if (questionEn.contains("changed over time")
                || questionEn.contains("changed your mind")
                || questionEn.contains("used to believe")
                || questionEn.contains("what caused that change")) {
            return changeReflection(1);
        }
        if (questionEn.contains("responsibility")
                || questionEn.contains("why or why not")
                || questionEn.contains("what kind of social responsibility")) {
            return opinionReason();
        }
        return generalDescription();
    }

    private static TaskMetaEntry routine() {
        return new TaskMetaEntry(
                "ROUTINE",
                List.of("MAIN_ANSWER", "ACTIVITY"),
                List.of("TIME_OR_PLACE", "FEELING")
        );
    }

    private static TaskMetaEntry preference() {
        return new TaskMetaEntry(
                "PREFERENCE",
                List.of("MAIN_ANSWER", "REASON"),
                List.of("FEELING", "EXAMPLE")
        );
    }

    private static TaskMetaEntry goalPlan(int variant) {
        if (variant == 5) {
            return new TaskMetaEntry(
                    "GOAL_PLAN",
                    List.of("MAIN_ANSWER", "REASON"),
                    List.of("ACTIVITY", "TIME_OR_PLACE")
            );
        }
        return new TaskMetaEntry(
                "GOAL_PLAN",
                List.of("MAIN_ANSWER", "ACTIVITY"),
                List.of("REASON", "TIME_OR_PLACE")
        );
    }

    private static TaskMetaEntry problemSolution() {
        return new TaskMetaEntry(
                "PROBLEM_SOLUTION",
                List.of("MAIN_ANSWER", "ACTIVITY"),
                List.of("REASON", "EXAMPLE")
        );
    }

    private static TaskMetaEntry balancedOpinion() {
        return new TaskMetaEntry(
                "BALANCED_OPINION",
                List.of("MAIN_ANSWER", "REASON"),
                List.of("EXAMPLE", "FEELING")
        );
    }

    private static TaskMetaEntry opinionReason() {
        return new TaskMetaEntry(
                "OPINION_REASON",
                List.of("MAIN_ANSWER", "REASON"),
                List.of("EXAMPLE")
        );
    }

    private static TaskMetaEntry changeReflection(int variant) {
        if (variant == 5) {
            return new TaskMetaEntry(
                    "CHANGE_REFLECTION",
                    List.of("MAIN_ANSWER"),
                    List.of("REASON", "FEELING")
            );
        }
        return new TaskMetaEntry(
                "CHANGE_REFLECTION",
                List.of("MAIN_ANSWER", "REASON"),
                List.of("TIME_OR_PLACE", "FEELING")
        );
    }

    private static TaskMetaEntry generalDescription() {
        return new TaskMetaEntry(
                "GENERAL_DESCRIPTION",
                List.of("MAIN_ANSWER", "REASON"),
                List.of("EXAMPLE", "FEELING")
        );
    }

    private static int variantFromPromptId(String promptId) {
        if (promptId == null || promptId.isBlank()) {
            return 0;
        }
        String trailing = promptId.substring(promptId.lastIndexOf('-') + 1);
        try {
            int index = Integer.parseInt(trailing);
            int mod = index % 5;
            return mod == 0 ? 5 : mod;
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    record TaskMetaEntry(
            String answerMode,
            List<String> requiredSlots,
            List<String> optionalSlots,
            String expectedTense,
            String expectedPov
    ) {
        TaskMetaEntry(
                String answerMode,
                List<String> requiredSlots,
                List<String> optionalSlots
        ) {
            this(
                    answerMode,
                    requiredSlots,
                    optionalSlots,
                    defaultExpectedTense(answerMode),
                    defaultExpectedPov(answerMode)
            );
        }

        TaskMetaEntry {
            requiredSlots = normalized(requiredSlots);
            optionalSlots = normalized(optionalSlots);
            expectedTense = normalizeCode(expectedTense);
            expectedPov = normalizeCode(expectedPov);
        }

        private static List<String> normalized(List<String> slotCodes) {
            if (slotCodes == null || slotCodes.isEmpty()) {
                return List.of();
            }
            Set<String> unique = new LinkedHashSet<>();
            for (String slotCode : slotCodes) {
                if (slotCode == null || slotCode.isBlank()) {
                    continue;
                }
                unique.add(slotCode.trim().toUpperCase(Locale.ROOT));
            }
            return List.copyOf(unique);
        }

        private static String defaultExpectedTense(String answerMode) {
            String normalizedAnswerMode = normalizeCode(answerMode);
            return switch (normalizedAnswerMode) {
                case "GOAL_PLAN" -> "FUTURE_PLAN";
                case "CHANGE_REFLECTION" -> "MIXED_PAST_PRESENT";
                default -> "PRESENT_SIMPLE";
            };
        }

        private static String defaultExpectedPov(String answerMode) {
            String normalizedAnswerMode = normalizeCode(answerMode);
            return switch (normalizedAnswerMode) {
                case "BALANCED_OPINION", "OPINION_REASON" -> "GENERAL_OR_FIRST_PERSON";
                default -> "FIRST_PERSON";
            };
        }

        private static String normalizeCode(String value) {
            return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        }
    }
}
