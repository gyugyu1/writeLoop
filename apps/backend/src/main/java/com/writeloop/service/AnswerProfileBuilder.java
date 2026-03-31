package com.writeloop.service;

import com.writeloop.dto.PromptTaskMetaDto;
import com.writeloop.dto.GrammarFeedbackItemDto;
import com.writeloop.dto.InlineFeedbackSegmentDto;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class AnswerProfileBuilder {
    private static final Set<String> PROMPT_STOPWORDS = Set.of(
            "a", "an", "and", "are", "be", "by", "can", "could", "do", "does", "for", "from",
            "give", "how", "i", "if", "in", "is", "it", "me", "my", "of", "on", "or", "please",
            "the", "this", "to", "what", "when", "where", "which", "who", "why", "with", "would",
            "you", "your"
    );
    private static final Set<String> SEASON_TOKENS = Set.of("spring", "summer", "fall", "autumn", "winter");
    private static final Set<String> ACTIVITY_VERBS = Set.of(
            "build", "cook", "do", "drink", "eat", "enjoy", "exercise", "go", "help", "jog", "learn",
            "listen", "meet", "plan", "play", "practice", "read", "relax", "run", "sleep", "study",
            "take", "talk", "visit", "walk", "watch", "work", "workout", "write"
    );
    private static final Pattern WORD_PATTERN = Pattern.compile("[\\p{L}][\\p{L}'-]*");
    private static final Pattern REASON_PATTERN = Pattern.compile("\\b(?:because|since|so that|that is why|it helps me|it makes me)\\b[^.!?]*", Pattern.CASE_INSENSITIVE);
    private static final Pattern EXAMPLE_PATTERN = Pattern.compile("\\b(?:for example|for instance|such as)\\b[^.!?]*", Pattern.CASE_INSENSITIVE);
    private static final Pattern FEELING_PATTERN = Pattern.compile("\\b(?:like|love|enjoy|prefer|feel|favorite|favourite)\\b[^.!?]*", Pattern.CASE_INSENSITIVE);
    private static final Pattern TIME_OR_PLACE_PATTERN = Pattern.compile("\\b(?:in the morning|in the evening|at night|on weekends?|after school|after work|after dinner|after lunch|before bed|at home|at school|today|tomorrow|this year|these days|usually|often|always|sometimes|never)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern PERSONAL_PROMPT_PATTERN = Pattern.compile("\\b(?:do you|your|favorite|favourite|what kind|what habit|what goal|what skill|what food|what season|what do you|which)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern PROMPT_REASON_PATTERN = Pattern.compile("\\bwhy\\b|\\breason\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern PROMPT_EXAMPLE_PATTERN = Pattern.compile("\\bexample\\b|\\bfor instance\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern PROMPT_SEASON_PATTERN = Pattern.compile("\\bseason\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern FIRST_PERSON_PATTERN = Pattern.compile("\\b(?:i|i'm|i've|i'd|i'll|me|my|mine|we|we're|our|ours|us)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern GENERAL_SUBJECT_PATTERN = Pattern.compile("\\b(?:people|students|many people|most people|everyone|companies|technology|social media|online shopping|public transportation|volunteering)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern FUTURE_PLAN_PATTERN = Pattern.compile("\\b(?:will|going to|plan to|want to|hope to|aim to|would like to|this year|next year)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern PAST_REFERENCE_PATTERN = Pattern.compile("\\b(?:yesterday|last\\s+(?:year|month|week|night)|ago|used to|was|were|did|had|previously|back then|in the past|when i was)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern PAST_VERB_PATTERN = Pattern.compile("\\b[\\p{L}]{4,}ed\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern PRESENT_REFERENCE_PATTERN = Pattern.compile("\\b(?:usually|often|always|sometimes|every|now|these days|currently|today|is|are|do|does|have|has|like|love|enjoy|prefer)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern BROKEN_SOLUTION_CONNECTOR_PATTERN = Pattern.compile("(?:^|[,;])\\s*(?:to address|to solve|to handle)\\s+i\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern PREPOSITION_BARE_VERB_PATTERN = Pattern.compile(
            "\\b(?:with|by|about|after|before|without)\\s+(?:build|cook|do|drink|eat|enjoy|exercise|go|help|jog|learn|listen|meet|plan|play|practice|read|relax|run|sleep|study|take|talk|visit|walk|watch|work|write)\\b",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern SHORT_GERUND_FRAGMENT_PATTERN = Pattern.compile(
            "^\\s*(i|we|they|he|she)\\s+([a-z]+ing)(?:\\s+(.+?))?[.!?]?\\s*$",
            Pattern.CASE_INSENSITIVE
    );

    AnswerProfile build(
            AnswerContext context,
            String correctedAnswer,
            List<InlineFeedbackSegmentDto> inlineFeedback,
            List<GrammarFeedbackItemDto> grammarFeedback
    ) {
        List<InlineFeedbackSegmentDto> safeInline = inlineFeedback == null ? List.of() : inlineFeedback;
        List<GrammarFeedbackItemDto> safeGrammar = grammarFeedback == null ? List.of() : grammarFeedback;

        PromptRubric rubric = PromptRubric.from(
                context.promptText(),
                context.promptTaskMeta(),
                context.promptTopicCategory(),
                context.promptTopicDetail()
        );
        ContentSignals signals = extractContentSignals(context.learnerAnswer());

        ContentProfile content = new ContentProfile(
                determineSpecificity(context.learnerAnswer(), signals, rubric),
                signals,
                buildStrengthSignals(context.learnerAnswer(), signals, rubric)
        );
        GrammarProfile grammar = buildGrammarProfile(context.learnerAnswer(), correctedAnswer, safeInline, safeGrammar, rubric, signals);
        TaskProfile task = buildTaskProfile(context, rubric, signals, content, grammar);
        ProgressDelta progressDelta = buildProgressDelta(context, rubric);
        RewriteProfile rewrite = buildRewriteProfile(context, rubric, task, grammar, content, progressDelta);
        return new AnswerProfile(task, grammar, content, rewrite);
    }

    private ContentSignals extractContentSignals(String answer) {
        String normalizedAnswer = normalize(answer);
        return new ContentSignals(
                countWords(answer) >= 3,
                REASON_PATTERN.matcher(normalizedAnswer).find(),
                EXAMPLE_PATTERN.matcher(normalizedAnswer).find(),
                FEELING_PATTERN.matcher(normalizedAnswer).find(),
                containsActivity(answer),
                TIME_OR_PLACE_PATTERN.matcher(normalizedAnswer).find() || containsSeasonToken(answer)
        );
    }

    private ContentLevel determineSpecificity(String answer, ContentSignals signals, PromptRubric rubric) {
        List<String> requiredSupportSlots = rubric.requiredSupportSlots();
        List<String> optionalSupportSlots = rubric.optionalSupportSlots();
        if (requiredSupportSlots.isEmpty() && optionalSupportSlots.isEmpty()) {
            return determineGenericSpecificity(answer, signals);
        }

        int score = 0;
        boolean missingRequiredSupport = false;
        for (String slotCode : requiredSupportSlots) {
            if (matchesSlot(slotCode, signals)) {
                score += 2;
            } else {
                missingRequiredSupport = true;
            }
        }
        for (String slotCode : optionalSupportSlots) {
            if (matchesSlot(slotCode, signals)) {
                score += 1;
            }
        }
        if (containsNumber(answer)) score++;
        if (countWords(answer) >= 18) score++;
        if (countWords(answer) >= 28) score++;
        if (score >= 5 && !missingRequiredSupport) return ContentLevel.HIGH;
        if (score >= 2) return ContentLevel.MEDIUM;
        return ContentLevel.LOW;
    }

    private ContentLevel determineGenericSpecificity(String answer, ContentSignals signals) {
        int score = 0;
        if (signals.hasReason()) score++;
        if (signals.hasExample()) score += 2;
        if (signals.hasFeeling()) score++;
        if (signals.hasActivity()) score++;
        if (signals.hasTimeOrPlace()) score++;
        if (containsNumber(answer)) score++;
        if (countWords(answer) >= 18) score++;
        if (score >= 4) return ContentLevel.HIGH;
        if (score >= 2) return ContentLevel.MEDIUM;
        return ContentLevel.LOW;
    }

    private List<StrengthSignal> buildStrengthSignals(String answer, ContentSignals signals, PromptRubric rubric) {
        List<StrengthSignal> strengths = new ArrayList<>();
        for (String slotCode : rubric.prioritizedStrengthSlots()) {
            if (!matchesSlot(slotCode, signals)) {
                continue;
            }
            StrengthSignal strength = strengthSignalForSlot(slotCode, answer);
            if (strength != null && strengths.stream().noneMatch(existing -> existing.code().equals(strength.code()))) {
                strengths.add(strength);
            }
            if (strengths.size() >= 3) {
                return List.copyOf(strengths);
            }
        }
        if (strengths.isEmpty() && signals.hasMainAnswer()) {
            strengths.add(new StrengthSignal("CLEAR_MAIN_ANSWER", firstSentence(answer)));
        }
        return strengths.size() > 3 ? List.copyOf(strengths.subList(0, 3)) : List.copyOf(strengths);
    }

    private StrengthSignal strengthSignalForSlot(String slotCode, String answer) {
        return switch (slotCode) {
            case "MAIN_ANSWER" -> new StrengthSignal("CLEAR_MAIN_ANSWER", firstSentence(answer));
            case "REASON" -> new StrengthSignal("HAS_REASON", matchedOrFirst(answer, REASON_PATTERN));
            case "EXAMPLE" -> new StrengthSignal("HAS_EXAMPLE", matchedOrFirst(answer, EXAMPLE_PATTERN));
            case "FEELING" -> new StrengthSignal("EXPRESSES_PERSONAL_RESPONSE", matchedOrFirst(answer, FEELING_PATTERN));
            case "ACTIVITY" -> new StrengthSignal("DESCRIBES_ACTIVITY", firstSentenceWithActivity(answer));
            case "TIME_OR_PLACE" -> new StrengthSignal("USES_TIME_OR_PLACE", matchedOrFirst(answer, TIME_OR_PLACE_PATTERN));
            default -> null;
        };
    }

    private GrammarProfile buildGrammarProfile(
            String learnerAnswer,
            String correctedAnswer,
            List<InlineFeedbackSegmentDto> inlineFeedback,
            List<GrammarFeedbackItemDto> grammarFeedback,
            PromptRubric rubric,
            ContentSignals signals
    ) {
        List<GrammarIssue> issues = new ArrayList<>();
        for (GrammarFeedbackItemDto item : grammarFeedback) {
            if (item == null) continue;
            String span = trim(item.originalText());
            String correction = trim(item.revisedText());
            if (span.isBlank() || correction.isBlank() || normalize(span).equals(normalize(correction))) continue;
            boolean blocksMeaning = Math.abs(countWords(span) - countWords(correction)) >= 4;
            issues.add(new GrammarIssue(
                    classifyGrammarIssue(item.reasonKo(), span, correction),
                    span,
                    correction,
                    blocksMeaning,
                    blocksMeaning ? GrammarSeverity.MAJOR : (countWords(span) + countWords(correction) >= 5 ? GrammarSeverity.MODERATE : GrammarSeverity.MINOR)
            ));
        }
        if (issues.isEmpty()) {
            for (InlineFeedbackSegmentDto segment : inlineFeedback) {
                if (segment == null || !"REPLACE".equalsIgnoreCase(segment.type())) continue;
                String span = trim(segment.originalText());
                String correction = trim(segment.revisedText());
                if (span.isBlank() || correction.isBlank() || normalize(span).equals(normalize(correction))) continue;
                issues.add(new GrammarIssue(classifyGrammarIssue("", span, correction), span, correction, false, GrammarSeverity.MINOR));
            }
        }
        appendMetaGuidedGrammarIssues(issues, learnerAnswer, rubric, signals);

        GrammarSeverity severity = GrammarSeverity.NONE;
        for (GrammarIssue issue : issues) {
            if (issue.severity().ordinal() > severity.ordinal()) severity = issue.severity();
        }
        if (severity == GrammarSeverity.MINOR && issues.size() >= 3) severity = GrammarSeverity.MODERATE;

        return new GrammarProfile(severity, issues, buildMinimalCorrection(learnerAnswer, correctedAnswer, inlineFeedback));
    }

    private TaskProfile buildTaskProfile(
            AnswerContext context,
            PromptRubric rubric,
            ContentSignals signals,
            ContentProfile content,
            GrammarProfile grammar
    ) {
        boolean onTopic = determineOnTopic(context, rubric, signals);
        TaskCompletion taskCompletion = determineTaskCompletion(onTopic, rubric, signals);
        AnswerBand answerBand = determineAnswerBand(context.learnerAnswer(), onTopic, taskCompletion, grammar.severity(), content.specificity());
        return new TaskProfile(onTopic, taskCompletion, answerBand);
    }

    private RewriteProfile buildRewriteProfile(
            AnswerContext context,
            PromptRubric rubric,
            TaskProfile task,
            GrammarProfile grammar,
            ContentProfile content,
            ProgressDelta progressDelta
    ) {
        String primaryIssueCode = determinePrimaryIssueCode(task, rubric, grammar, content);
        String secondaryIssueCode = determineSecondaryIssueCode(primaryIssueCode, task, rubric, grammar, content);
        RewriteTarget target = buildRewriteTarget(context.learnerAnswer(), context.promptText(), task, grammar, primaryIssueCode, rubric, content);
        return new RewriteProfile(primaryIssueCode, secondaryIssueCode, target, progressDelta);
    }

    private ProgressDelta buildProgressDelta(AnswerContext context, PromptRubric rubric) {
        if (context.previousAnswer() == null || context.previousAnswer().isBlank()) {
            return null;
        }
        ContentSignals previousSignals = extractContentSignals(context.previousAnswer());
        ContentSignals currentSignals = extractContentSignals(context.learnerAnswer());

        List<String> improvedAreas = new ArrayList<>();
        for (String slotCode : rubric.trackedContentSlots()) {
            if (!matchesSlot(slotCode, previousSignals) && matchesSlot(slotCode, currentSignals)) {
                improvedAreas.add(progressCodeForSlot(slotCode));
            }
        }
        if (determineSpecificity(context.previousAnswer(), previousSignals, rubric).ordinal()
                < determineSpecificity(context.learnerAnswer(), currentSignals, rubric).ordinal()) {
            improvedAreas.add("SPECIFICITY");
        }

        List<String> remainingAreas = new ArrayList<>();
        for (String slotCode : rubric.requiredSupportSlots()) {
            if (!matchesSlot(slotCode, currentSignals)) {
                remainingAreas.add(progressCodeForSlot(slotCode));
            }
        }
        if (determineSpecificity(context.learnerAnswer(), currentSignals, rubric) == ContentLevel.LOW) remainingAreas.add("SPECIFICITY");
        return new ProgressDelta(improvedAreas, remainingAreas);
    }

    private boolean determineOnTopic(AnswerContext context, PromptRubric rubric, ContentSignals signals) {
        if (!signals.hasMainAnswer()) {
            return false;
        }
        Set<String> answerTokens = extractTokens(context.learnerAnswer());
        if (hasTokenOverlap(answerTokens, rubric.topicAnchors())) {
            return true;
        }

        Set<String> promptTokens = new LinkedHashSet<>(extractTokens(context.promptText()));
        promptTokens.addAll(extractTokens(context.modelAnswer()));
        for (PromptHintRef hint : context.promptHints()) {
            if (hint == null) continue;
            for (String item : hint.items()) {
                promptTokens.addAll(extractTokens(item));
            }
        }
        promptTokens.removeAll(PROMPT_STOPWORDS);
        if (hasTokenOverlap(answerTokens, promptTokens)) {
            return true;
        }
        if (rubric.matchesAnswerModeShape(signals, answerTokens)) {
            return true;
        }
        return rubric.expectsSeason() && containsSeasonToken(context.learnerAnswer());
    }

    private TaskCompletion determineTaskCompletion(boolean onTopic, PromptRubric rubric, ContentSignals signals) {
        if (!onTopic || !signals.hasMainAnswer()) return TaskCompletion.MISS;
        int expected = 0;
        int satisfied = 0;
        for (String slotCode : rubric.requiredSlots()) {
            expected++;
            if (matchesSlot(slotCode, signals)) satisfied++;
        }
        if (expected == 0) {
            expected = 1;
            satisfied = signals.hasMainAnswer() ? 1 : 0;
        }
        return satisfied >= expected ? TaskCompletion.FULL : TaskCompletion.PARTIAL;
    }

    private AnswerBand determineAnswerBand(
            String answer,
            boolean onTopic,
            TaskCompletion taskCompletion,
            GrammarSeverity grammarSeverity,
            ContentLevel specificity
    ) {
        int wordCount = countWords(answer);
        if (!onTopic) return AnswerBand.OFF_TOPIC;
        if (wordCount < 4) return AnswerBand.TOO_SHORT_FRAGMENT;
        if (grammarSeverity == GrammarSeverity.MAJOR || looksGrammarBlocking(answer)) return AnswerBand.GRAMMAR_BLOCKING;
        if (wordCount < 10) return AnswerBand.SHORT_BUT_VALID;
        if (taskCompletion != TaskCompletion.FULL || specificity == ContentLevel.LOW) return AnswerBand.CONTENT_THIN;
        return AnswerBand.NATURAL_BUT_BASIC;
    }

    private String determinePrimaryIssueCode(
            TaskProfile task,
            PromptRubric rubric,
            GrammarProfile grammar,
            ContentProfile content
    ) {
        if (!task.onTopic()) return "OFF_TOPIC_RESPONSE";
        if (task.taskCompletion() == TaskCompletion.MISS) return "MISSING_MAIN_TASK";
        if (task.answerBand() == AnswerBand.GRAMMAR_BLOCKING
                || grammar.severity() == GrammarSeverity.MAJOR
                || grammar.issues().stream().anyMatch(GrammarIssue::blocksMeaning)) {
            return "FIX_BLOCKING_GRAMMAR";
        }
        if (task.taskCompletion() == TaskCompletion.PARTIAL && !content.signals().hasMainAnswer()) return "STATE_MAIN_ANSWER";
        if (task.taskCompletion() == TaskCompletion.PARTIAL) {
            String missingRequiredSlot = firstMissingRequiredSupportSlot(rubric, content.signals());
            if (missingRequiredSlot != null) {
                return issueCodeForMissingSlot(missingRequiredSlot);
            }
        }
        if (content.specificity() == ContentLevel.LOW && !content.signals().hasTimeOrPlace()) return "ADD_DETAIL";
        if (content.specificity() == ContentLevel.LOW) return "MAKE_IT_MORE_SPECIFIC";
        if (grammar.severity() == GrammarSeverity.MODERATE || grammar.severity() == GrammarSeverity.MINOR) return "FIX_LOCAL_GRAMMAR";
        return "IMPROVE_NATURALNESS";
    }

    private String determineSecondaryIssueCode(
            String primaryIssueCode,
            TaskProfile task,
            PromptRubric rubric,
            GrammarProfile grammar,
            ContentProfile content
    ) {
        List<String> candidates = new ArrayList<>();
        if (grammar.severity() == GrammarSeverity.MODERATE || grammar.severity() == GrammarSeverity.MINOR) candidates.add("FIX_LOCAL_GRAMMAR");
        String missingRequiredSlot = firstMissingRequiredSupportSlot(rubric, content.signals());
        if (missingRequiredSlot != null) candidates.add(issueCodeForMissingSlot(missingRequiredSlot));
        if (content.specificity() == ContentLevel.LOW) candidates.add("MAKE_IT_MORE_SPECIFIC");
        if (task.answerBand() == AnswerBand.NATURAL_BUT_BASIC) candidates.add("IMPROVE_NATURALNESS");
        for (String candidate : candidates) {
            if (!candidate.equals(primaryIssueCode)) return candidate;
        }
        return null;
    }

    private RewriteTarget buildRewriteTarget(
            String learnerAnswer,
            String promptText,
            TaskProfile task,
            GrammarProfile grammar,
            String primaryIssueCode,
            PromptRubric rubric,
            ContentProfile content
    ) {
        String action = switch (primaryIssueCode) {
            case "OFF_TOPIC_RESPONSE" -> "MAKE_ON_TOPIC";
            case "MISSING_MAIN_TASK", "STATE_MAIN_ANSWER" -> "STATE_MAIN_ANSWER";
            case "FIX_BLOCKING_GRAMMAR" -> "FIX_BLOCKING_GRAMMAR";
            case "FIX_LOCAL_GRAMMAR" -> "FIX_LOCAL_GRAMMAR";
            case "ADD_REASON" -> "ADD_REASON";
            case "ADD_EXAMPLE" -> "ADD_EXAMPLE";
            case "ADD_DETAIL", "MAKE_IT_MORE_SPECIFIC" -> "ADD_DETAIL";
            default -> "IMPROVE_NATURALNESS";
        };
        String skeleton = switch (action) {
            case "FIX_BLOCKING_GRAMMAR", "FIX_LOCAL_GRAMMAR" -> grammar.minimalCorrection();
            case "STATE_MAIN_ANSWER" -> trimSentenceEnding(firstSentence(learnerAnswer));
            case "ADD_REASON" -> appendSkeleton(learnerAnswer, " because ...");
            case "ADD_EXAMPLE" -> appendSkeleton(learnerAnswer, " For example, ...");
            case "ADD_DETAIL" -> appendSkeleton(learnerAnswer, detailSkeletonSuffix(firstMissingRequiredSupportSlot(rubric, content.signals()), promptText));
            case "MAKE_ON_TOPIC" -> normalize(promptText).contains("why") ? "I think ... because ..." : "My answer is ...";
            default -> appendSkeleton(learnerAnswer, " and ...");
        };
        int maxNewSentenceCount = switch (action) {
            case "FIX_BLOCKING_GRAMMAR", "FIX_LOCAL_GRAMMAR" -> 0;
            case "ADD_REASON", "ADD_EXAMPLE", "ADD_DETAIL", "IMPROVE_NATURALNESS" -> 1;
            default -> task.answerBand() == AnswerBand.TOO_SHORT_FRAGMENT ? 2 : 1;
        };
        return new RewriteTarget(action, skeleton, maxNewSentenceCount);
    }

    private String detailSkeletonSuffix(String missingSlotCode, String promptText) {
        if ("TIME_OR_PLACE".equals(missingSlotCode)) {
            return " in/at ...";
        }
        if ("FEELING".equals(missingSlotCode)) {
            return " because I feel ...";
        }
        if ("ACTIVITY".equals(missingSlotCode)) {
            return normalize(promptText).contains("plan") || normalize(promptText).contains("will")
                    ? " I plan to ..."
                    : " I usually ...";
        }
        return " I usually ...";
    }

    private void appendMetaGuidedGrammarIssues(
            List<GrammarIssue> issues,
            String learnerAnswer,
            PromptRubric rubric,
            ContentSignals signals
    ) {
        if (countWords(learnerAnswer) < 4) {
            return;
        }

        GrammarIssue tenseIssue = buildExpectedTenseIssue(learnerAnswer, rubric);
        if (tenseIssue != null
                && issues.stream().noneMatch(issue -> "TENSE".equals(issue.code()) || "TENSE_ALIGNMENT".equals(issue.code()))) {
            issues.add(tenseIssue);
        }

        GrammarIssue povIssue = buildExpectedPovIssue(learnerAnswer, rubric, signals);
        if (povIssue != null
                && issues.stream().noneMatch(issue -> "POINT_OF_VIEW_ALIGNMENT".equals(issue.code()))) {
            issues.add(povIssue);
        }
    }

    private GrammarIssue buildExpectedTenseIssue(String learnerAnswer, PromptRubric rubric) {
        String normalizedAnswer = normalize(learnerAnswer);
        return switch (rubric.expectedTense()) {
            case "PRESENT_SIMPLE" -> looksPastFocused(normalizedAnswer) && !looksPresentOrHabitFocused(normalizedAnswer)
                    ? new GrammarIssue(
                    "TENSE_ALIGNMENT",
                    matchedOrFirst(learnerAnswer, PAST_REFERENCE_PATTERN),
                    "Use a present-time form that matches the question.",
                    false,
                    GrammarSeverity.MINOR
            )
                    : null;
            case "FUTURE_PLAN" -> looksPastFocused(normalizedAnswer) && !looksFuturePlanFocused(normalizedAnswer)
                    ? new GrammarIssue(
                    "TENSE_ALIGNMENT",
                    matchedOrFirst(learnerAnswer, PAST_REFERENCE_PATTERN),
                    "Use a future or plan form such as \"I will ...\" or \"I plan to ...\".",
                    false,
                    GrammarSeverity.MINOR
            )
                    : null;
            default -> null;
        };
    }

    private GrammarIssue buildExpectedPovIssue(
            String learnerAnswer,
            PromptRubric rubric,
            ContentSignals signals
    ) {
        if (!"FIRST_PERSON".equals(rubric.expectedPov())) {
            return null;
        }
        String normalizedAnswer = normalize(learnerAnswer);
        if (FIRST_PERSON_PATTERN.matcher(normalizedAnswer).find()) {
            return null;
        }
        if (!GENERAL_SUBJECT_PATTERN.matcher(normalizedAnswer).find()) {
            return null;
        }
        if (signals.hasFeeling()) {
            return null;
        }
        return new GrammarIssue(
                "POINT_OF_VIEW_ALIGNMENT",
                matchedOrFirst(learnerAnswer, GENERAL_SUBJECT_PATTERN),
                "Use a first-person answer (I / my / we).",
                false,
                GrammarSeverity.MINOR
        );
    }

    private String buildMinimalCorrection(String learnerAnswer, String correctedAnswer, List<InlineFeedbackSegmentDto> inlineFeedback) {
        String correctedCandidate = sanitizeMinimalCorrectionCandidate(correctedAnswer);
        String inlineCandidate = sanitizeMinimalCorrectionCandidate(
                inlineFeedback == null ? null : reconstructFromInline(inlineFeedback)
        );
        String heuristicCandidate = inferHeuristicMinimalCorrection(learnerAnswer);
        if (isMinimalCorrectionCandidate(learnerAnswer, correctedCandidate)) return correctedCandidate;
        if (isMinimalCorrectionCandidate(learnerAnswer, inlineCandidate)) return inlineCandidate;
        if (isMinimalCorrectionCandidate(learnerAnswer, heuristicCandidate)) return heuristicCandidate;
        return null;
    }

    private String reconstructFromInline(List<InlineFeedbackSegmentDto> inlineFeedback) {
        StringBuilder builder = new StringBuilder();
        for (InlineFeedbackSegmentDto segment : inlineFeedback) {
            if (segment != null) builder.append(segment.revisedText() == null ? "" : segment.revisedText());
        }
        String candidate = builder.toString().trim();
        return candidate.isEmpty() ? null : candidate;
    }

    private boolean isMinimalCorrectionCandidate(String learnerAnswer, String candidate) {
        if (candidate == null || candidate.isBlank()) return false;
        String learner = normalize(learnerAnswer);
        String corrected = normalize(candidate);
        if (learner.isBlank() || learner.equals(corrected)) return false;
        if (Math.abs(countWords(learner) - countWords(corrected)) > Math.max(3, countWords(learner) / 2)) return false;
        Set<String> learnerTokens = extractTokens(learner);
        Set<String> correctedTokens = extractTokens(corrected);
        if (learnerTokens.isEmpty() || correctedTokens.isEmpty()) return false;
        int overlap = 0;
        for (String token : correctedTokens) {
            if (learnerTokens.contains(token)) overlap++;
        }
        return ((double) overlap / (double) correctedTokens.size()) >= 0.6d;
    }

    private String sanitizeMinimalCorrectionCandidate(String candidate) {
        if (candidate == null || candidate.isBlank()) {
            return null;
        }
        String sanitized = candidate
                .replaceAll("\\s+", " ")
                .replaceAll("\\s+([,.!?])", "$1")
                .replaceAll("([,.!?])(\\p{L})", "$1 $2")
                .trim();
        if (sanitized.isBlank()) {
            return null;
        }
        if (!sanitized.endsWith(".") && !sanitized.endsWith("!") && !sanitized.endsWith("?")) {
            sanitized = sanitized + ".";
        }
        if (!sanitized.isEmpty()) {
            sanitized = Character.toUpperCase(sanitized.charAt(0)) + sanitized.substring(1);
        }
        return sanitized;
    }

    private String inferHeuristicMinimalCorrection(String learnerAnswer) {
        if (learnerAnswer == null || learnerAnswer.isBlank()) {
            return null;
        }
        String normalizedAnswer = trim(learnerAnswer);
        if (looksGrammarBlocking(learnerAnswer)) {
            return sanitizeMinimalCorrectionCandidate(normalizedAnswer
                    .replaceAll("(?i)\\bstruggle with meet the deadline\\b", "struggle to meet deadlines")
                    .replaceAll("(?i)\\bstruggle with meet deadlines\\b", "struggle to meet deadlines")
                    .replaceAll("(?i)\\bstruggle with meeting the deadline\\b", "struggle to meet deadlines")
                    .replaceAll("(?i)\\bstruggle with meeting deadlines\\b", "struggle to meet deadlines")
                    .replaceAll("(?i)\\bto meet the deadline\\b", "to meet deadlines")
                    .replaceAll("(?i)\\bby write\\b", "by writing")
                    .replaceAll("(?i),?\\s*to address this,?\\s+i\\b", ", so I")
                    .replaceAll("(?i),?\\s*to address\\s+i\\b", ", so I")
                    .replaceAll("(?i),?\\s*to solve this,?\\s+i\\b", ", so I")
                    .replaceAll("(?i),?\\s*to solve\\s+i\\b", ", so I"));
        }

        Matcher shortGerundFragment = SHORT_GERUND_FRAGMENT_PATTERN.matcher(normalizedAnswer);
        if (countWords(learnerAnswer) <= 4 && shortGerundFragment.matches()) {
            String subject = shortGerundFragment.group(1);
            String verbIng = shortGerundFragment.group(2);
            String remainder = shortGerundFragment.group(3);
            String baseVerb = toBaseVerb(verbIng);
            String candidate = subject + " " + baseVerb + (remainder == null ? "" : " " + remainder.trim());
            return sanitizeMinimalCorrectionCandidate(candidate);
        }
        return null;
    }

    private String toBaseVerb(String verbIng) {
        String lower = verbIng == null ? "" : verbIng.toLowerCase(Locale.ROOT);
        return switch (lower) {
            case "doing" -> "do";
            case "going" -> "go";
            case "being" -> "be";
            case "having" -> "have";
            default -> {
                if (lower.endsWith("ying") && lower.length() > 5) {
                    yield lower.substring(0, lower.length() - 4) + "ie";
                }
                if (lower.endsWith("ing") && lower.length() > 4) {
                    String stem = lower.substring(0, lower.length() - 3);
                    if (stem.length() >= 2 && stem.charAt(stem.length() - 1) == stem.charAt(stem.length() - 2)) {
                        stem = stem.substring(0, stem.length() - 1);
                    }
                    if (stem.endsWith("v")) {
                        yield stem + "e";
                    }
                    yield stem;
                }
                yield lower;
            }
        };
    }

    private String classifyGrammarIssue(String reasonKo, String span, String correction) {
        String reason = normalize(reasonKo);
        if (reason.contains("subject") && reason.contains("verb")) return "SUBJECT_VERB_AGREEMENT";
        if (reason.contains("article") || startsWithArticleDifference(span, correction)) return "ARTICLE";
        if (reason.contains("tense")) return "TENSE";
        if (reason.contains("preposition")) return "PREPOSITION";
        if (reason.contains("plural")) return "NUMBER_AGREEMENT";
        if (reason.contains("spelling")) return "SPELLING";
        if (changesBeVerb(span, correction)) return "SUBJECT_VERB_AGREEMENT";
        return "LOCAL_GRAMMAR";
    }

    private boolean startsWithArticleDifference(String span, String correction) {
        List<String> spanTokens = new ArrayList<>(extractTokens(span));
        List<String> correctionTokens = new ArrayList<>(extractTokens(correction));
        if (spanTokens.isEmpty() || correctionTokens.isEmpty()) return false;
        return (!spanTokens.get(0).equals(correctionTokens.get(0)) && Set.of("a", "an", "the").contains(spanTokens.get(0)))
                || Set.of("a", "an", "the").contains(correctionTokens.get(0));
    }

    private boolean changesBeVerb(String span, String correction) {
        String normalizedSpan = normalize(span);
        String normalizedCorrection = normalize(correction);
        return normalizedSpan.matches(".*\\b(?:am|is|are|was|were)\\b.*")
                || normalizedCorrection.matches(".*\\b(?:am|is|are|was|were)\\b.*");
    }

    private boolean containsActivity(String answer) {
        for (String token : extractTokens(answer)) {
            if (ACTIVITY_VERBS.contains(token) || ACTIVITY_VERBS.contains(toBaseVerb(token))) {
                return true;
            }
        }
        return false;
    }

    private boolean containsSeasonToken(String answer) {
        for (String token : extractTokens(answer)) if (SEASON_TOKENS.contains(token)) return true;
        return false;
    }

    private boolean containsNumber(String answer) {
        String normalized = normalize(answer);
        for (int i = 0; i < normalized.length(); i++) if (Character.isDigit(normalized.charAt(i))) return true;
        return false;
    }

    private boolean looksFuturePlanFocused(String normalizedAnswer) {
        return FUTURE_PLAN_PATTERN.matcher(normalizedAnswer).find();
    }

    private boolean looksPastFocused(String normalizedAnswer) {
        return PAST_REFERENCE_PATTERN.matcher(normalizedAnswer).find()
                || PAST_VERB_PATTERN.matcher(normalizedAnswer).find();
    }

    private boolean looksPresentOrHabitFocused(String normalizedAnswer) {
        return PRESENT_REFERENCE_PATTERN.matcher(normalizedAnswer).find();
    }

    private boolean looksGrammarBlocking(String answer) {
        String normalizedAnswer = normalize(answer);
        if (normalizedAnswer.isBlank()) {
            return false;
        }
        int score = 0;
        if (BROKEN_SOLUTION_CONNECTOR_PATTERN.matcher(normalizedAnswer).find()) {
            score += 2;
        }
        Matcher prepositionMatcher = PREPOSITION_BARE_VERB_PATTERN.matcher(normalizedAnswer);
        while (prepositionMatcher.find()) {
            score += 1;
        }
        return score >= 2;
    }

    private String matchedOrFirst(String answer, Pattern pattern) {
        Matcher matcher = pattern.matcher(trim(answer));
        return matcher.find() ? matcher.group().trim() : firstSentence(answer);
    }

    private String firstSentenceWithActivity(String answer) {
        String normalized = trim(answer);
        if (normalized.isBlank()) {
            return "";
        }
        String[] sentences = normalized.split("(?<=[.!?])\\s+");
        for (String sentence : sentences) {
            if (containsActivity(sentence)) {
                return sentence.trim();
            }
        }
        return firstSentence(answer);
    }

    private String appendSkeleton(String answer, String suffix) {
        String base = trimSentenceEnding(firstSentence(answer));
        return base.isBlank() ? null : base + suffix;
    }

    private String trimSentenceEnding(String text) {
        String trimmed = trim(text);
        while (!trimmed.isEmpty() && ".!?".indexOf(trimmed.charAt(trimmed.length() - 1)) >= 0) {
            trimmed = trimmed.substring(0, trimmed.length() - 1).trim();
        }
        return trimmed;
    }

    private String firstSentence(String answer) {
        String normalized = trim(answer);
        if (normalized.isBlank()) return "";
        String[] split = normalized.split("(?<=[.!?])\\s+");
        return split.length == 0 ? normalized : split[0].trim();
    }

    private Set<String> extractTokens(String text) {
        Set<String> tokens = new LinkedHashSet<>();
        Matcher matcher = WORD_PATTERN.matcher(normalize(text));
        while (matcher.find()) {
            String token = matcher.group().toLowerCase(Locale.ROOT);
            if (token.length() >= 3) tokens.add(token);
        }
        return tokens;
    }

    private int countWords(String text) {
        Matcher matcher = WORD_PATTERN.matcher(normalize(text));
        int count = 0;
        while (matcher.find()) count++;
        return count;
    }

    private boolean hasTokenOverlap(Set<String> answerTokens, Set<String> anchorTokens) {
        for (String token : answerTokens) {
            if (anchorTokens.contains(token)) {
                return true;
            }
        }
        return false;
    }

    private String normalize(String text) {
        return text == null ? "" : text.trim().toLowerCase(Locale.ROOT);
    }

    private String trim(String text) {
        return text == null ? "" : text.trim();
    }

    private boolean matchesSlot(String slotCode, ContentSignals signals) {
        return switch (slotCode) {
            case "MAIN_ANSWER" -> signals.hasMainAnswer();
            case "REASON" -> signals.hasReason();
            case "EXAMPLE" -> signals.hasExample();
            case "FEELING" -> signals.hasFeeling();
            case "ACTIVITY" -> signals.hasActivity();
            case "TIME_OR_PLACE" -> signals.hasTimeOrPlace();
            default -> false;
        };
    }

    private String firstMissingRequiredSupportSlot(PromptRubric rubric, ContentSignals signals) {
        for (String slotCode : rubric.requiredSupportSlots()) {
            if (!matchesSlot(slotCode, signals)) {
                return slotCode;
            }
        }
        return null;
    }

    private String issueCodeForMissingSlot(String slotCode) {
        return switch (slotCode) {
            case "REASON" -> "ADD_REASON";
            case "EXAMPLE" -> "ADD_EXAMPLE";
            default -> "ADD_DETAIL";
        };
    }

    private String progressCodeForSlot(String slotCode) {
        return switch (slotCode) {
            case "MAIN_ANSWER" -> "HAS_MAIN_ANSWER";
            case "REASON" -> "HAS_REASON";
            case "EXAMPLE" -> "HAS_EXAMPLE";
            case "FEELING" -> "HAS_FEELING";
            case "ACTIVITY" -> "HAS_ACTIVITY";
            case "TIME_OR_PLACE" -> "TIME_OR_PLACE";
            default -> slotCode;
        };
    }

    private record PromptRubric(
            String answerMode,
            boolean expectsReason,
            boolean expectsExample,
            boolean expectsSeason,
            boolean personalPrompt,
            Set<String> requiredSlots,
            Set<String> optionalSlots,
            Set<String> topicAnchors,
            String expectedTense,
            String expectedPov
    ) {
        List<String> requiredSupportSlots() {
            return requiredSlots.stream()
                    .filter(slotCode -> !"MAIN_ANSWER".equals(slotCode))
                    .toList();
        }

        List<String> optionalSupportSlots() {
            return optionalSlots.stream()
                    .filter(slotCode -> !"MAIN_ANSWER".equals(slotCode))
                    .toList();
        }

        List<String> prioritizedStrengthSlots() {
            List<String> ordered = new ArrayList<>();
            ordered.add("MAIN_ANSWER");
            ordered.addAll(requiredSupportSlots());
            for (String slotCode : optionalSupportSlots()) {
                if (!ordered.contains(slotCode)) {
                    ordered.add(slotCode);
                }
            }
            return List.copyOf(ordered);
        }

        List<String> trackedContentSlots() {
            List<String> tracked = new ArrayList<>(requiredSlots);
            for (String slotCode : optionalSlots) {
                if (!tracked.contains(slotCode)) {
                    tracked.add(slotCode);
                }
            }
            return List.copyOf(tracked);
        }

        boolean matchesAnswerModeShape(ContentSignals signals, Set<String> answerTokens) {
            return switch (answerMode) {
                case "ROUTINE" -> signals.hasActivity() || signals.hasTimeOrPlace();
                case "PREFERENCE" -> (signals.hasReason() || signals.hasFeeling())
                        && countMatchingTokens(answerTokens, Set.of("food", "movie", "genre", "season", "music", "place", "relax")) >= 1
                        || signals.hasFeeling();
                case "GOAL_PLAN" -> signals.hasActivity() || containsAny(answerTokens, Set.of("goal", "plan", "improve", "practice", "build", "habit", "skill", "visit"));
                case "PROBLEM_SOLUTION" -> signals.hasReason() || containsAny(answerTokens, Set.of("problem", "challenge", "deal", "solve", "handle"));
                case "BALANCED_OPINION" -> signals.hasReason() || containsAny(answerTokens, Set.of("positive", "negative", "benefit", "drawback", "opinion", "view"));
                case "OPINION_REASON" -> signals.hasReason() || containsAny(answerTokens, Set.of("should", "responsibility", "important", "role", "society"));
                case "CHANGE_REFLECTION" -> signals.hasReason() || containsAny(answerTokens, Set.of("changed", "before", "now", "used", "realized", "realise"));
                case "GENERAL_DESCRIPTION" -> signals.hasReason() || signals.hasExample() || signals.hasFeeling();
                default -> personalPrompt && (signals.hasReason() || signals.hasFeeling() || signals.hasActivity());
            };
        }

        static PromptRubric from(
                String promptText,
                PromptTaskMetaDto taskMeta,
                String promptTopicCategory,
                String promptTopicDetail
        ) {
            String answerMode = taskMeta == null || taskMeta.answerMode() == null
                    ? ""
                    : taskMeta.answerMode().trim().toUpperCase(Locale.ROOT);
            if (taskMeta != null) {
                Set<String> required = normalizedCodes(taskMeta.requiredSlots());
                Set<String> optional = normalizedCodes(taskMeta.optionalSlots());
                Set<String> all = new LinkedHashSet<>(required);
                all.addAll(optional);
                return new PromptRubric(
                        answerMode,
                        all.contains("REASON"),
                        all.contains("EXAMPLE"),
                        all.contains("TIME_OR_PLACE") || all.contains("ACTIVITY") && PROMPT_SEASON_PATTERN.matcher(promptText == null ? "" : promptText).find(),
                        PERSONAL_PROMPT_PATTERN.matcher(promptText == null ? "" : promptText).find(),
                        required,
                        optional,
                        buildTopicAnchors(promptTopicCategory, promptTopicDetail, promptText, answerMode),
                        resolveExpectedTense(answerMode, taskMeta.expectedTense()),
                        resolveExpectedPov(answerMode, taskMeta.expectedPov())
                );
            }
            String inferredAnswerMode = inferAnswerMode(promptText);
            return new PromptRubric(
                    inferredAnswerMode,
                    PROMPT_REASON_PATTERN.matcher(promptText == null ? "" : promptText).find(),
                    PROMPT_EXAMPLE_PATTERN.matcher(promptText == null ? "" : promptText).find(),
                    PROMPT_SEASON_PATTERN.matcher(promptText == null ? "" : promptText).find(),
                    PERSONAL_PROMPT_PATTERN.matcher(promptText == null ? "" : promptText).find(),
                    defaultRequiredSlots(promptText),
                    Set.of(),
                    buildTopicAnchors(promptTopicCategory, promptTopicDetail, promptText, inferredAnswerMode),
                    defaultExpectedTense(inferredAnswerMode),
                    defaultExpectedPov(inferredAnswerMode)
            );
        }

        private static Set<String> defaultRequiredSlots(String promptText) {
            Set<String> required = new LinkedHashSet<>();
            required.add("MAIN_ANSWER");
            if (PROMPT_REASON_PATTERN.matcher(promptText == null ? "" : promptText).find()) {
                required.add("REASON");
            }
            if (PROMPT_EXAMPLE_PATTERN.matcher(promptText == null ? "" : promptText).find()) {
                required.add("EXAMPLE");
            }
            return required;
        }

        private static Set<String> normalizedCodes(List<String> codes) {
            Set<String> normalized = new LinkedHashSet<>();
            if (codes == null) {
                return normalized;
            }
            for (String code : codes) {
                if (code == null || code.isBlank()) {
                    continue;
                }
                normalized.add(code.trim().toUpperCase(Locale.ROOT));
            }
            return normalized;
        }

        private static String inferAnswerMode(String promptText) {
            String normalizedPrompt = promptText == null ? "" : promptText.trim().toLowerCase(Locale.ROOT);
            if (normalizedPrompt.matches(".*(favorite|favourite|appeals to you|why do you like).*")) return "PREFERENCE";
            if (normalizedPrompt.matches(".*(usually spend|usually do|describe your routine|often do|typically use).*")) return "ROUTINE";
            if (normalizedPrompt.matches(".*(how will you|explain your plan|make progress|what steps will you take|want to improve this year|want to build this year|want to reach this year|want to work on this year).*")) return "GOAL_PLAN";
            if (normalizedPrompt.matches(".*(challenge|how do you deal with it|how you deal with it|what you do about it|how you try to solve it).*")) return "PROBLEM_SOLUTION";
            if (normalizedPrompt.matches(".*(benefits and drawbacks|mostly positive|mostly good|what is your view|overall opinion).*")) return "BALANCED_OPINION";
            if (normalizedPrompt.matches(".*(changed over time|changed your mind|used to believe|what caused that change).*")) return "CHANGE_REFLECTION";
            if (normalizedPrompt.matches(".*(responsibility|why or why not|what kind of social responsibility).*")) return "OPINION_REASON";
            return "GENERAL_DESCRIPTION";
        }

        private static String resolveExpectedTense(String answerMode, String configuredExpectedTense) {
            if (configuredExpectedTense != null && !configuredExpectedTense.isBlank()) {
                return configuredExpectedTense.trim().toUpperCase(Locale.ROOT);
            }
            return defaultExpectedTense(answerMode);
        }

        private static String resolveExpectedPov(String answerMode, String configuredExpectedPov) {
            if (configuredExpectedPov != null && !configuredExpectedPov.isBlank()) {
                return configuredExpectedPov.trim().toUpperCase(Locale.ROOT);
            }
            return defaultExpectedPov(answerMode);
        }

        private static String defaultExpectedTense(String answerMode) {
            String normalizedAnswerMode = answerMode == null ? "" : answerMode.trim().toUpperCase(Locale.ROOT);
            return switch (normalizedAnswerMode) {
                case "GOAL_PLAN" -> "FUTURE_PLAN";
                case "CHANGE_REFLECTION" -> "MIXED_PAST_PRESENT";
                default -> "PRESENT_SIMPLE";
            };
        }

        private static String defaultExpectedPov(String answerMode) {
            String normalizedAnswerMode = answerMode == null ? "" : answerMode.trim().toUpperCase(Locale.ROOT);
            return switch (normalizedAnswerMode) {
                case "BALANCED_OPINION", "OPINION_REASON" -> "GENERAL_OR_FIRST_PERSON";
                default -> "FIRST_PERSON";
            };
        }

        private static Set<String> buildTopicAnchors(
                String topicCategory,
                String topicDetail,
                String promptText,
                String answerMode
        ) {
            Set<String> anchors = new LinkedHashSet<>();
            anchors.addAll(tokenizeAnchorSource(topicCategory));
            anchors.addAll(tokenizeAnchorSource(topicDetail));
            anchors.addAll(tokenizeAnchorSource(promptText));
            anchors.addAll(answerModeAnchors(answerMode));
            anchors.addAll(detailExpansionAnchors(topicCategory, topicDetail));
            anchors.removeAll(PROMPT_STOPWORDS);
            return Set.copyOf(anchors);
        }

        private static Set<String> tokenizeAnchorSource(String value) {
            Set<String> tokens = new LinkedHashSet<>();
            if (value == null || value.isBlank()) {
                return tokens;
            }
            Matcher matcher = WORD_PATTERN.matcher(value.toLowerCase(Locale.ROOT));
            while (matcher.find()) {
                String token = matcher.group();
                if (token.length() >= 3) {
                    tokens.add(token);
                }
            }
            return tokens;
        }

        private static Set<String> answerModeAnchors(String answerMode) {
            return switch (answerMode) {
                case "ROUTINE" -> Set.of("usually", "routine", "daily", "weekday", "weekend", "morning", "evening", "after", "before");
                case "PREFERENCE" -> Set.of("favorite", "favourite", "like", "love", "enjoy", "prefer");
                case "GOAL_PLAN" -> Set.of("goal", "plan", "improve", "practice", "build", "habit", "skill", "visit", "progress");
                case "PROBLEM_SOLUTION" -> Set.of("challenge", "problem", "deal", "handle", "solve", "solution");
                case "BALANCED_OPINION" -> Set.of("positive", "negative", "benefit", "drawback", "view", "opinion", "overall");
                case "OPINION_REASON" -> Set.of("responsibility", "role", "society", "important", "should");
                case "CHANGE_REFLECTION" -> Set.of("change", "changed", "before", "after", "now", "used", "believe");
                case "GENERAL_DESCRIPTION" -> Set.of("meaningful", "special", "recommend", "remember", "describe");
                default -> Set.of();
            };
        }

        private static Set<String> detailExpansionAnchors(String topicCategory, String topicDetail) {
            String normalizedCategory = topicCategory == null ? "" : topicCategory.trim().toLowerCase(Locale.ROOT);
            String normalizedDetail = topicDetail == null ? "" : topicDetail.trim().toLowerCase(Locale.ROOT);
            String combined = normalizedCategory + " " + normalizedDetail;
            Set<String> anchors = new LinkedHashSet<>();

            if (combined.contains("food")) anchors.addAll(Set.of("eat", "meal", "dish", "taste", "delicious", "spicy", "sweet", "savory"));
            if (combined.contains("season")) anchors.addAll(Set.of("spring", "summer", "fall", "autumn", "winter", "weather", "warm", "cold"));
            if (combined.contains("music")) anchors.addAll(Set.of("song", "songs", "listen", "melody", "beat", "singer"));
            if (combined.contains("movie")) anchors.addAll(Set.of("movie", "film", "watch", "genre", "scene", "actor"));
            if (combined.contains("place") || combined.contains("city") || combined.contains("destination")) anchors.addAll(Set.of("visit", "travel", "there", "museum", "landmark", "town"));
            if (combined.contains("habit")) anchors.addAll(Set.of("habit", "routine", "daily", "every", "consistency"));
            if (combined.contains("skill")) anchors.addAll(Set.of("skill", "improve", "practice", "better", "confidence", "learn"));
            if (combined.contains("health")) anchors.addAll(Set.of("health", "exercise", "sleep", "diet", "healthy", "energy"));
            if (combined.contains("language")) anchors.addAll(Set.of("language", "english", "speaking", "writing", "vocabulary", "grammar"));
            if (combined.contains("confidence")) anchors.addAll(Set.of("confidence", "brave", "speak", "improve", "nervous"));
            if (combined.contains("time management")) anchors.addAll(Set.of("time", "schedule", "deadline", "late", "plan"));
            if (combined.contains("motivat")) anchors.addAll(Set.of("motivation", "motivated", "focus", "energy", "routine"));
            if (combined.contains("speaking in front of people")) anchors.addAll(Set.of("speak", "presentation", "audience", "nervous", "confidence"));
            if (combined.contains("balancing work and rest")) anchors.addAll(Set.of("work", "rest", "break", "balance", "tired"));
            if (combined.contains("working in a team")) anchors.addAll(Set.of("team", "coworker", "together", "communication", "conflict"));
            if (combined.contains("online shopping")) anchors.addAll(Set.of("online", "shopping", "order", "delivery", "buy", "website"));
            if (combined.contains("social media")) anchors.addAll(Set.of("social", "media", "platform", "post", "connect", "online"));
            if (combined.contains("remote work")) anchors.addAll(Set.of("remote", "work", "home", "office", "online"));
            if (combined.contains("artificial intelligence")) anchors.addAll(Set.of("artificial", "intelligence", "ai", "education", "learning", "school"));
            if (combined.contains("smartphone")) anchors.addAll(Set.of("smartphone", "phone", "mobile", "screen", "app"));
            if (combined.contains("company")) anchors.addAll(Set.of("company", "companies", "business", "employee", "society", "community"));
            if (combined.contains("public transportation")) anchors.addAll(Set.of("transportation", "bus", "subway", "train", "city", "commute"));
            if (combined.contains("financial")) anchors.addAll(Set.of("financial", "money", "school", "students", "skills"));
            if (combined.contains("volunteering")) anchors.addAll(Set.of("volunteer", "community", "local", "help", "support"));
            if (combined.contains("success")) anchors.addAll(Set.of("success", "goal", "career", "achievement"));
            if (combined.contains("study habits")) anchors.addAll(Set.of("study", "habit", "learn", "class", "exam"));
            if (combined.contains("money")) anchors.addAll(Set.of("money", "spend", "save", "financial"));
            if (combined.contains("leadership")) anchors.addAll(Set.of("leader", "leadership", "team", "guide", "responsibility"));
            if (combined.contains("useful app")) anchors.addAll(Set.of("app", "application", "phone", "use", "tool"));
            if (combined.contains("town")) anchors.addAll(Set.of("town", "neighborhood", "neighbourhood", "city", "place"));
            if (combined.contains("teacher") || combined.contains("mentor")) anchors.addAll(Set.of("teacher", "mentor", "class", "lesson", "advice"));
            if (combined.contains("hobby")) anchors.addAll(Set.of("hobby", "activity", "enjoy", "fun", "recommend"));
            if (combined.contains("memory")) anchors.addAll(Set.of("memory", "remember", "experience", "moment"));

            return anchors;
        }

        private static boolean containsAny(Set<String> answerTokens, Set<String> anchors) {
            for (String token : answerTokens) {
                if (anchors.contains(token)) {
                    return true;
                }
            }
            return false;
        }

        private static int countMatchingTokens(Set<String> answerTokens, Set<String> anchors) {
            int count = 0;
            for (String token : answerTokens) {
                if (anchors.contains(token)) {
                    count++;
                }
            }
            return count;
        }
    }
}
