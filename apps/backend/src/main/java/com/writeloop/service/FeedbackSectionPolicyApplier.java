package com.writeloop.service;

import com.writeloop.dto.CorrectionDto;
import com.writeloop.dto.CoachExpressionUsageDto;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.GrammarFeedbackItemDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.RefinementExpressionDto;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class FeedbackSectionPolicyApplier {
    private static final Pattern WORD_PATTERN = Pattern.compile("[\\p{L}][\\p{L}'-]*");
    private static final Set<String> STRENGTH_STOPWORDS = Set.of(
            "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "i", "in", "is",
            "it", "my", "of", "on", "or", "so", "that", "the", "this", "to", "with"
    );

    private final SectionPolicySelector sectionPolicySelector = new SectionPolicySelector();
    private final FeedbackSectionValidators validators = new FeedbackSectionValidators();

    FeedbackResponseDto apply(
            PromptDto prompt,
            String learnerAnswer,
            FeedbackResponseDto feedback,
            AnswerProfile answerProfile,
            int attemptIndex
    ) {
        SectionPolicy policy = sectionPolicySelector.select(answerProfile, attemptIndex);

        List<String> strengths = buildStrengthSection(feedback, answerProfile, policy);
        List<GrammarFeedbackItemDto> grammar = buildGrammarSection(learnerAnswer, feedback, answerProfile, policy);
        List<CorrectionDto> corrections = buildImprovementSection(feedback, answerProfile, policy, grammar);
        List<RefinementExpressionDto> refinement = buildRefinementSection(feedback, answerProfile, policy);
        String summary = buildSummarySection(feedback.summary(), policy);
        String rewriteGuide = policy.showRewriteGuide() ? feedback.rewriteChallenge() : null;
        FeedbackSectionValidators.ModelAnswerContent modelAnswerContent =
                buildModelAnswerSection(prompt, learnerAnswer, feedback, answerProfile, policy);
        List<CoachExpressionUsageDto> usedExpressions = buildUsedExpressionSection(feedback, learnerAnswer, answerProfile);

        return new FeedbackResponseDto(
                feedback.promptId(),
                feedback.sessionId(),
                feedback.attemptNo(),
                feedback.score(),
                feedback.loopComplete(),
                feedback.completionMessage(),
                summary,
                strengths,
                corrections,
                feedback.inlineFeedback(),
                grammar,
                feedback.correctedAnswer(),
                refinement,
                modelAnswerContent.modelAnswer(),
                modelAnswerContent.modelAnswerKo(),
                rewriteGuide,
                usedExpressions
        );
    }

    private List<String> buildStrengthSection(
            FeedbackResponseDto feedback,
            AnswerProfile answerProfile,
            SectionPolicy policy
    ) {
        if (!policy.showStrengths()) {
            return List.of();
        }

        if (shouldUseMeaningBasedStrengths(answerProfile)) {
            return limit(buildMeaningBasedStrengths(answerProfile), policy.maxStrengthCount());
        }

        List<String> strengths = new ArrayList<>();
        if (answerProfile != null && answerProfile.content() != null) {
            List<StrengthSignal> signals = new ArrayList<>(answerProfile.content().strengths());
            prioritizeStrengthSignalsForOverlay(signals, answerProfile.rewrite() == null ? null : answerProfile.rewrite().progressDelta(), policy);
            for (StrengthSignal signal : signals) {
                String message = toStrengthMessage(signal);
                if (message != null && !message.isBlank()) {
                    strengths.add(message);
                }
            }
        }
        if (strengths.isEmpty()) {
            strengths.addAll(feedback.strengths() == null ? List.of() : feedback.strengths());
        }
        strengths = validators.dedupeStrengths(strengths);
        return limit(strengths, policy.maxStrengthCount());
    }

    private List<GrammarFeedbackItemDto> buildGrammarSection(
            String learnerAnswer,
            FeedbackResponseDto feedback,
            AnswerProfile answerProfile,
            SectionPolicy policy
    ) {
        int effectiveLimit = Math.max(2, policy.maxGrammarIssueCount());
        if (isGrammarBlocking(answerProfile)) {
            List<GrammarFeedbackItemDto> grammar = validators.validateGrammarSectionFormat(
                    buildGrammarBlockingSection(learnerAnswer, feedback, answerProfile)
            );
            if (grammar.isEmpty() && answerProfile != null && answerProfile.grammar() != null) {
                grammar = validators.validateGrammarSectionFormat(fromGrammarIssues(answerProfile.grammar().issues()));
            }
            if (grammar.isEmpty()) {
                grammar = validators.validateGrammarSectionFormat(feedback.grammarFeedback());
            }
            return limit(grammar, effectiveLimit);
        }

        List<GrammarFeedbackItemDto> grammar = validators.validateGrammarSectionFormat(feedback.grammarFeedback());
        if (grammar.isEmpty() && answerProfile != null && answerProfile.grammar() != null) {
            grammar = validators.validateGrammarSectionFormat(fromGrammarIssues(answerProfile.grammar().issues()));
        }
        if (!policy.showGrammar()) {
            return limit(grammar, effectiveLimit);
        }
        if (policy.attemptOverlayPolicy().suppressResolvedGrammar()
                && answerProfile != null
                && answerProfile.rewrite() != null
                && !"FIX_BLOCKING_GRAMMAR".equals(answerProfile.rewrite().primaryIssueCode())
                && !"FIX_LOCAL_GRAMMAR".equals(answerProfile.rewrite().primaryIssueCode())) {
            grammar = grammar.stream()
                    .filter(item -> normalize(item.reasonKo()).contains("의미") || normalize(item.reasonKo()).contains("핵심"))
                    .toList();
        }
        return limit(grammar, effectiveLimit);
    }

    private List<CoachExpressionUsageDto> buildUsedExpressionSection(
            FeedbackResponseDto feedback,
            String learnerAnswer,
            AnswerProfile answerProfile
    ) {
        List<CoachExpressionUsageDto> usedExpressions = feedback.usedExpressions() == null
                ? List.of()
                : feedback.usedExpressions();
        if (!hasElevatedGrammar(answerProfile) || usedExpressions.isEmpty()) {
            return usedExpressions;
        }

        List<CoachExpressionUsageDto> filtered = new ArrayList<>();
        for (CoachExpressionUsageDto usage : usedExpressions) {
            if (usage == null || shouldDropUsedExpressionForElevatedGrammar(usage, learnerAnswer, answerProfile, feedback.modelAnswer())) {
                continue;
            }
            filtered.add(usage);
        }
        return List.copyOf(filtered);
    }

    private List<CorrectionDto> buildImprovementSection(
            FeedbackResponseDto feedback,
            AnswerProfile answerProfile,
            SectionPolicy policy,
            List<GrammarFeedbackItemDto> grammarFeedback
    ) {
        if (!policy.showImprovement()) {
            return List.of();
        }

        List<CorrectionDto> corrections = validators.reduceDuplicateCorrections(feedback.corrections(), grammarFeedback);
        if (!corrections.isEmpty()) {
            return List.copyOf(corrections);
        }
        CorrectionDto selected = fallbackCorrection(answerProfile);
        return selected == null ? List.of() : List.of(selected);
    }

    private List<RefinementExpressionDto> buildRefinementSection(
            FeedbackResponseDto feedback,
            AnswerProfile answerProfile,
            SectionPolicy policy
    ) {
        if (!policy.showRefinement()) {
            return List.of();
        }
        List<RefinementExpressionDto> refinementExpressions = validators.validateRefinementCards(feedback.refinementExpressions());
        refinementExpressions = refinementExpressions.stream()
                .sorted(Comparator
                        .comparingInt((RefinementExpressionDto expression) -> refinementScore(expression, policy.refinementFocus(), answerProfile))
                        .reversed()
                        .thenComparing(expression -> expression.expression() == null ? "" : expression.expression(), String.CASE_INSENSITIVE_ORDER))
                .toList();
        return limit(refinementExpressions, Math.max(policy.maxRefinementCount(), Math.min(4, refinementExpressions.size())));
    }

    private String buildSummarySection(String summary, SectionPolicy policy) {
        if (summary == null || summary.isBlank()) {
            return null;
        }
        int sentenceLimit = policy.modelAnswerMode() == ModelAnswerMode.TASK_RESET ? 1 : 2;
        return trimToSentenceCount(summary, sentenceLimit);
    }

    private FeedbackSectionValidators.ModelAnswerContent buildModelAnswerSection(
            PromptDto prompt,
            String learnerAnswer,
            FeedbackResponseDto feedback,
            AnswerProfile answerProfile,
            SectionPolicy policy
    ) {
        String modelAnswer = feedback.modelAnswer();
        String modelAnswerKo = feedback.modelAnswerKo();
        if (policy.modelAnswerMode() == ModelAnswerMode.MINIMAL_CORRECTION
                && answerProfile != null
                && answerProfile.grammar() != null
                && answerProfile.grammar().minimalCorrection() != null) {
            modelAnswer = answerProfile.grammar().minimalCorrection();
            modelAnswerKo = null;
        } else if (policy.modelAnswerMode() == ModelAnswerMode.TASK_RESET
                && (modelAnswer == null || modelAnswer.isBlank())
                && answerProfile != null
                && answerProfile.rewrite() != null
                && answerProfile.rewrite().target() != null) {
            modelAnswer = answerProfile.rewrite().target().skeleton();
            modelAnswerKo = null;
        }

        FeedbackSectionValidators.ModelAnswerContent guarded = validators.guardModelAnswer(
                learnerAnswer,
                modelAnswer,
                modelAnswerKo,
                policy.maxModelAnswerSentences(),
                policy.modelAnswerMode()
        );
        if ((guarded.modelAnswer() == null || guarded.modelAnswer().isBlank())
                && prompt != null
                && policy.modelAnswerMode() == ModelAnswerMode.TASK_RESET
                && answerProfile != null
                && answerProfile.rewrite() != null
                && answerProfile.rewrite().target() != null) {
            return validators.guardModelAnswer(
                    learnerAnswer,
                    answerProfile.rewrite().target().skeleton(),
                    null,
                    policy.maxModelAnswerSentences(),
                    policy.modelAnswerMode()
            );
        }
        return guarded;
    }

    private void prioritizeStrengthSignalsForOverlay(
            List<StrengthSignal> strengthSignals,
            ProgressDelta progressDelta,
            SectionPolicy policy
    ) {
        if (!policy.attemptOverlayPolicy().progressAwareStrengths() || progressDelta == null || progressDelta.improvedAreas().isEmpty()) {
            return;
        }
        Set<String> preferredCodes = new LinkedHashSet<>();
        for (String improvedArea : progressDelta.improvedAreas()) {
            switch (improvedArea) {
                case "HAS_REASON" -> preferredCodes.add("HAS_REASON");
                case "HAS_EXAMPLE" -> preferredCodes.add("HAS_EXAMPLE");
                case "HAS_FEELING" -> preferredCodes.add("EXPRESSES_PERSONAL_RESPONSE");
                case "HAS_ACTIVITY" -> preferredCodes.add("DESCRIBES_ACTIVITY");
                case "TIME_OR_PLACE" -> preferredCodes.add("USES_TIME_OR_PLACE");
                case "HAS_MAIN_ANSWER" -> preferredCodes.add("CLEAR_MAIN_ANSWER");
                case "SPECIFICITY" -> preferredCodes.add("HAS_EXAMPLE");
                default -> {
                }
            }
        }
        strengthSignals.sort(Comparator.comparingInt(signal -> preferredCodes.contains(signal.code()) ? 0 : 1));
    }

    private String toStrengthMessage(StrengthSignal signal) {
        if (signal == null || signal.evidence() == null || signal.evidence().isBlank()) {
            return null;
        }
        return switch (signal.code()) {
            case "CLEAR_MAIN_ANSWER" -> "\"" + signal.evidence() + "\"처럼 답의 핵심을 분명하게 밝혔어요.";
            case "HAS_REASON" -> "\"" + signal.evidence() + "\"처럼 이유를 붙여 답을 뒷받침한 점이 좋아요.";
            case "HAS_EXAMPLE" -> "\"" + signal.evidence() + "\"처럼 예시를 넣어 더 구체적으로 말했어요.";
            case "EXPRESSES_PERSONAL_RESPONSE" -> "\"" + signal.evidence() + "\"처럼 자신의 느낌이나 선호를 드러낸 점이 좋아요.";
            case "DESCRIBES_ACTIVITY" -> "\"" + signal.evidence() + "\"처럼 실제 활동을 넣어 답이 살아 있어요.";
            case "USES_TIME_OR_PLACE" -> "\"" + signal.evidence() + "\"처럼 시간이나 상황 정보를 넣어 더 또렷해졌어요.";
            default -> null;
        };
    }

    private List<GrammarFeedbackItemDto> fromGrammarIssues(List<GrammarIssue> issues) {
        if (issues == null || issues.isEmpty()) {
            return List.of();
        }
        List<GrammarFeedbackItemDto> converted = new ArrayList<>();
        for (GrammarIssue issue : issues) {
            if (issue == null) {
                continue;
            }
            converted.add(new GrammarFeedbackItemDto(
                    issue.span(),
                    issue.correction(),
                    grammarReasonForCode(issue.code())
            ));
        }
        return List.copyOf(converted);
    }

    private List<GrammarFeedbackItemDto> buildGrammarBlockingSection(
            String learnerAnswer,
            FeedbackResponseDto feedback,
            AnswerProfile answerProfile
    ) {
        if (answerProfile == null || answerProfile.grammar() == null) {
            return List.of();
        }

        List<GrammarFeedbackItemDto> grammar = new ArrayList<>();
        String revisedSentence = firstNonBlank(
                answerProfile.grammar().minimalCorrection(),
                answerProfile.rewrite() == null || answerProfile.rewrite().target() == null
                        ? null
                        : answerProfile.rewrite().target().skeleton(),
                trimToSentenceCount(feedback.modelAnswer(), 1)
        );
        if (revisedSentence != null && !normalize(learnerAnswer).equals(normalize(revisedSentence))) {
            grammar.add(new GrammarFeedbackItemDto(
                    learnerAnswer == null ? "" : learnerAnswer.trim(),
                    revisedSentence,
                    grammarBlockingReason(answerProfile)
            ));
        }
        grammar.addAll(fromGrammarIssues(answerProfile.grammar().issues()));
        return grammar;
    }

    private String grammarReasonForCode(String code) {
        return switch (code) {
            case "SUBJECT_VERB_AGREEMENT" -> "주어와 동사 형태를 맞춰 주세요.";
            case "ARTICLE" -> "관사 사용을 자연스럽게 맞춰 주세요.";
            case "TENSE", "TENSE_ALIGNMENT" -> "질문 흐름에 맞는 시제를 써 주세요.";
            case "POINT_OF_VIEW_ALIGNMENT" -> "질문이 요구하는 시점(I / my 등)에 맞춰 주세요.";
            case "PREPOSITION" -> "전치사 선택을 자연스럽게 맞춰 주세요.";
            case "NUMBER_AGREEMENT" -> "단수/복수 형태를 맞춰 주세요.";
            default -> "원문을 유지하면서 이 부분만 자연스럽게 고쳐 주세요.";
        };
    }

    private String grammarBlockingReason(AnswerProfile answerProfile) {
        if (answerProfile == null || answerProfile.grammar() == null) {
            return "먼저 문장 전체의 핵심 문법을 바로잡아 뜻이 자연스럽게 읽히게 해 보세요.";
        }
        return answerProfile.grammar().issues().stream()
                .filter(issue -> issue != null && issue.blocksMeaning())
                .map(GrammarIssue::code)
                .findFirst()
                .map(this::grammarReasonForCode)
                .orElse("먼저 문장 전체의 핵심 문법을 바로잡아 뜻이 자연스럽게 읽히게 해 보세요.");
    }

    private CorrectionDto selectCorrection(List<CorrectionDto> corrections, AnswerProfile answerProfile) {
        if (corrections == null || corrections.isEmpty()) {
            return null;
        }
        if (answerProfile == null || answerProfile.rewrite() == null || answerProfile.rewrite().primaryIssueCode() == null) {
            return corrections.get(0);
        }
        String primaryIssueCode = answerProfile.rewrite().primaryIssueCode();
        return corrections.stream()
                .sorted(Comparator.comparingInt(correction -> correctionPriority(primaryIssueCode, correction)))
                .findFirst()
                .orElse(corrections.get(0));
    }

    private int correctionPriority(String primaryIssueCode, CorrectionDto correction) {
        String combined = normalize(correction.issue()) + " " + normalize(correction.suggestion());
        return switch (primaryIssueCode) {
            case "OFF_TOPIC_RESPONSE", "MISSING_MAIN_TASK", "STATE_MAIN_ANSWER" ->
                    combined.contains("질문") || combined.contains("핵심") ? 0 : 1;
            case "ADD_REASON" -> combined.contains("이유") || combined.contains("because") ? 0 : 1;
            case "ADD_EXAMPLE" -> combined.contains("예시") || combined.contains("for example") ? 0 : 1;
            case "ADD_DETAIL", "MAKE_IT_MORE_SPECIFIC" ->
                    combined.contains("구체") || combined.contains("시간") || combined.contains("상황") || combined.contains("디테일") ? 0 : 1;
            case "FIX_BLOCKING_GRAMMAR", "FIX_LOCAL_GRAMMAR" ->
                    combined.contains("문법") || combined.contains("시제") || combined.contains("표현") ? 0 : 1;
            default -> 1;
        };
    }

    private CorrectionDto fallbackCorrection(AnswerProfile answerProfile) {
        if (answerProfile == null || answerProfile.rewrite() == null) {
            return null;
        }
        String skeleton = answerProfile.rewrite().target() == null ? null : answerProfile.rewrite().target().skeleton();
        return switch (answerProfile.rewrite().primaryIssueCode()) {
            case "OFF_TOPIC_RESPONSE", "MISSING_MAIN_TASK", "STATE_MAIN_ANSWER" -> new CorrectionDto(
                    "질문에 대한 직접 답이 먼저 보여야 해요.",
                    "첫 문장에서 질문에 대한 핵심 답을 분명히 쓰고, 가능하면 이유를 한 문장만 덧붙여 보세요." + formatHintSuffix(skeleton)
            );
            case "ADD_REASON" -> new CorrectionDto(
                    "이유가 빠져 있어서 답이 조금 얇게 들려요.",
                    "because로 시작하는 이유 문장 1개만 덧붙여 보세요." + formatHintSuffix(skeleton)
            );
            case "ADD_EXAMPLE" -> new CorrectionDto(
                    "예시가 없어서 답이 덜 구체적으로 들려요.",
                    "For example으로 시작하는 예시 문장 1개만 추가해 보세요." + formatHintSuffix(skeleton)
            );
            case "ADD_DETAIL", "MAKE_IT_MORE_SPECIFIC" -> new CorrectionDto(
                    "답의 핵심은 보이지만 디테일이 더 필요해요.",
                    "시간, 느낌, 활동 중 하나만 골라 한 문장 더 붙여 보세요." + formatHintSuffix(skeleton)
            );
            case "FIX_BLOCKING_GRAMMAR" -> new CorrectionDto(
                    "뜻을 막는 문법부터 먼저 정리하는 게 좋아요.",
                    "지금 문장의 핵심 뜻은 유지하고 문법이 흔들리는 부분만 최소 수정해 보세요." + formatHintSuffix(skeleton)
            );
            case "FIX_LOCAL_GRAMMAR" -> new CorrectionDto(
                    "내용은 괜찮으니 문법 1곳만 더 다듬어 보세요.",
                    "원문을 유지하면서 가장 눈에 띄는 문법 표현 하나만 고쳐 보세요." + formatHintSuffix(skeleton)
            );
            default -> null;
        };
    }

    private int refinementScore(
            RefinementExpressionDto expression,
            RefinementFocus refinementFocus,
            AnswerProfile answerProfile
    ) {
        int score = 0;
        String normalizedExpression = normalize(expression.expression());
        String normalizedGuidance = normalize(expression.guidanceKo());

        switch (refinementFocus) {
            case EASY_REUSABLE -> {
                if (expression.type() != null && expression.type().name().equals("LEXICAL")) score += 2;
                if (countWords(expression.expression()) <= 4) score += 2;
                if (normalizedExpression.startsWith("i ") || normalizedExpression.startsWith("because")) score += 1;
            }
            case GRAMMAR_PATTERN -> {
                if (expression.type() != null && expression.type().name().equals("FRAME")) score += 3;
                if (normalizedExpression.contains("because") || normalizedExpression.contains("one reason") || normalizedExpression.contains("i want to")) score += 2;
            }
            case DETAIL_BUILDING -> {
                if (normalizedExpression.contains("because") || normalizedExpression.contains("for example")) score += 3;
                if (normalizedExpression.contains("feel") || normalizedExpression.contains("after") || normalizedExpression.contains("during")) score += 2;
                if (normalizedGuidance.contains("구체") || normalizedGuidance.contains("이유") || normalizedGuidance.contains("시간")) score += 1;
            }
            case NATURALNESS -> {
                if (normalizedExpression.contains("what i like most") || normalizedExpression.contains("one of")) score += 3;
                if (normalizedExpression.contains("during") || normalizedExpression.contains("that is why") || normalizedExpression.contains("helps me")) score += 2;
            }
            case TASK_COMPLETION -> {
                if (matchesTaskCompletionNeed(normalizedExpression, answerProfile)) score += 4;
                if (normalizedExpression.startsWith("my ") || normalizedExpression.startsWith("i ")) score += 1;
            }
        }
        score -= expression.qualityFlags() == null ? 0 : expression.qualityFlags().size();
        return score;
    }

    private boolean matchesTaskCompletionNeed(String normalizedExpression, AnswerProfile answerProfile) {
        if (answerProfile == null || answerProfile.rewrite() == null || answerProfile.rewrite().primaryIssueCode() == null) {
            return false;
        }
        return switch (answerProfile.rewrite().primaryIssueCode()) {
            case "ADD_REASON" -> normalizedExpression.contains("because") || normalizedExpression.contains("one reason");
            case "ADD_EXAMPLE" -> normalizedExpression.contains("for example") || normalizedExpression.contains("for instance");
            case "ADD_DETAIL", "MAKE_IT_MORE_SPECIFIC" -> normalizedExpression.contains("feel")
                    || normalizedExpression.contains("after")
                    || normalizedExpression.contains("during")
                    || normalizedExpression.contains("usually");
            case "STATE_MAIN_ANSWER", "MISSING_MAIN_TASK", "OFF_TOPIC_RESPONSE" -> normalizedExpression.startsWith("my ")
                    || normalizedExpression.startsWith("i ");
            default -> false;
        };
    }

    private int countWords(String text) {
        if (text == null || text.isBlank()) {
            return 0;
        }
        return text.trim().split("\\s+").length;
    }

    private boolean shouldUseMeaningBasedStrengths(AnswerProfile answerProfile) {
        return hasElevatedGrammar(answerProfile);
    }

    private boolean hasElevatedGrammar(AnswerProfile answerProfile) {
        return answerProfile != null
                && ((answerProfile.grammar() != null
                && answerProfile.grammar().severity().ordinal() >= GrammarSeverity.MODERATE.ordinal())
                || (answerProfile.task() != null
                && answerProfile.task().answerBand() == AnswerBand.GRAMMAR_BLOCKING));
    }

    private boolean isGrammarBlocking(AnswerProfile answerProfile) {
        return answerProfile != null
                && answerProfile.task() != null
                && answerProfile.task().answerBand() == AnswerBand.GRAMMAR_BLOCKING;
    }

    private List<String> buildMeaningBasedStrengths(AnswerProfile answerProfile) {
        if (answerProfile == null || answerProfile.content() == null || answerProfile.content().signals() == null) {
            return List.of();
        }

        ContentSignals signals = answerProfile.content().signals();
        List<String> strengths = new ArrayList<>();
        if (signals.hasMainAnswer() && signals.hasActivity()) {
            strengths.add("문제와 해결 방법을 함께 제시하려는 흐름이 좋습니다.");
        }
        if (signals.hasMainAnswer() && signals.hasReason()) {
            strengths.add("핵심 답과 이유를 함께 담으려는 점이 좋습니다.");
        }
        if (signals.hasActivity()) {
            strengths.add("실제 행동이나 해결 방법을 넣어 답을 살리려는 점이 좋습니다.");
        }
        if (signals.hasExample()) {
            strengths.add("예시를 넣어 설명을 구체화하려는 점이 좋습니다.");
        }
        if (signals.hasFeeling()) {
            strengths.add("개인적인 생각이나 느낌을 담으려는 점이 좋습니다.");
        }
        if (signals.hasTimeOrPlace()) {
            strengths.add("상황이나 맥락을 함께 넣으려는 점이 좋습니다.");
        }
        if (strengths.isEmpty() && signals.hasMainAnswer()) {
            strengths.add("질문에 답하려는 핵심 의도는 분명합니다.");
        }
        return validators.dedupeStrengths(strengths);
    }

    private boolean shouldDropUsedExpressionForElevatedGrammar(
            CoachExpressionUsageDto usage,
            String learnerAnswer,
            AnswerProfile answerProfile,
            String modelAnswer
    ) {
        String normalizedExpression = normalize(usage.expression());
        String normalizedLearnerAnswer = normalize(learnerAnswer);
        if (normalizedExpression.isBlank()) {
            return true;
        }
        if (normalizedExpression.equals(normalizedLearnerAnswer)) {
            return true;
        }
        if (isLongBrokenRawClause(normalizedExpression, normalizedLearnerAnswer, usage.expression())) {
            return true;
        }
        if (overlapsGrammarIssueSpan(
                normalizedExpression,
                answerProfile == null || answerProfile.grammar() == null ? List.of() : answerProfile.grammar().issues()
        )) {
            return true;
        }
        return countWords(normalizedExpression) >= 5
                && !isAnchoredInSafeRewriteText(
                normalizedExpression,
                answerProfile == null || answerProfile.grammar() == null ? null : answerProfile.grammar().minimalCorrection(),
                answerProfile == null || answerProfile.rewrite() == null || answerProfile.rewrite().target() == null
                        ? null
                        : answerProfile.rewrite().target().skeleton(),
                modelAnswer
        );
    }

    private boolean isLongBrokenRawClause(String normalizedExpression, String normalizedLearnerAnswer, String rawExpression) {
        int tokenCount = countWords(normalizedExpression);
        if (tokenCount < 5) {
            return false;
        }
        if (normalizedLearnerAnswer.contains(normalizedExpression) && tokenCount >= 6) {
            return true;
        }
        return rawExpression != null
                && rawExpression.contains(",")
                && tokenCount >= 5
                && normalizedLearnerAnswer.contains(normalizedExpression);
    }

    private boolean overlapsGrammarIssueSpan(String normalizedExpression, List<GrammarIssue> issues) {
        if (issues == null || issues.isEmpty()) {
            return false;
        }
        Set<String> expressionTokens = extractMeaningfulTokens(normalizedExpression);
        for (GrammarIssue issue : issues) {
            if (issue == null) {
                continue;
            }
            String normalizedSpan = normalize(issue.span());
            if (normalizedSpan.isBlank()) {
                continue;
            }
            if (normalizedExpression.contains(normalizedSpan) || normalizedSpan.contains(normalizedExpression)) {
                return true;
            }
            Set<String> spanTokens = extractMeaningfulTokens(normalizedSpan);
            if (!expressionTokens.isEmpty() && !spanTokens.isEmpty()) {
                Set<String> overlap = new LinkedHashSet<>(expressionTokens);
                overlap.retainAll(spanTokens);
                if (overlap.size() >= Math.min(2, Math.min(expressionTokens.size(), spanTokens.size()))) {
                    return true;
                }
            }
        }
        return false;
    }

    private boolean isAnchoredInSafeRewriteText(String normalizedExpression, String... safeTexts) {
        Set<String> expressionTokens = extractMeaningfulTokens(normalizedExpression);
        for (String safeText : safeTexts) {
            String normalizedSafeText = normalize(safeText);
            if (normalizedSafeText.isBlank()) {
                continue;
            }
            if (normalizedSafeText.contains(normalizedExpression)) {
                return true;
            }
            Set<String> safeTokens = extractMeaningfulTokens(normalizedSafeText);
            if (expressionTokens.isEmpty() || safeTokens.isEmpty()) {
                continue;
            }
            Set<String> overlap = new LinkedHashSet<>(expressionTokens);
            overlap.retainAll(safeTokens);
            if (overlap.size() >= Math.min(2, Math.min(expressionTokens.size(), safeTokens.size()))) {
                return true;
            }
        }
        return false;
    }

    private Set<String> extractMeaningfulTokens(String text) {
        Set<String> tokens = new LinkedHashSet<>();
        Matcher matcher = WORD_PATTERN.matcher(normalize(text));
        while (matcher.find()) {
            String token = matcher.group().toLowerCase(Locale.ROOT);
            if (token.length() >= 3 && !STRENGTH_STOPWORDS.contains(token)) {
                tokens.add(token);
            }
        }
        return tokens;
    }

    private String trimToSentenceCount(String text, int maxSentences) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String[] sentences = text.trim().split("(?<=[.!?])\\s+");
        if (sentences.length <= maxSentences) {
            return text.trim();
        }
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < maxSentences; i++) {
            if (i > 0) {
                builder.append(' ');
            }
            builder.append(sentences[i].trim());
        }
        return builder.toString().trim();
    }

    private String formatHintSuffix(String skeleton) {
        if (skeleton == null || skeleton.isBlank()) {
            return "";
        }
        return " 예: \"" + skeleton.trim() + "\"";
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private <T> List<T> limit(List<T> items, int maxCount) {
        if (items == null || items.isEmpty() || maxCount <= 0) {
            return List.of();
        }
        return List.copyOf(items.subList(0, Math.min(items.size(), maxCount)));
    }

    private String normalize(String text) {
        return text == null ? "" : text.trim().toLowerCase(Locale.ROOT);
    }
}
