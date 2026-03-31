package com.writeloop.service;

import com.writeloop.dto.CorrectionDto;
import com.writeloop.dto.CoachExpressionUsageDto;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.GrammarFeedbackItemDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.RefinementExampleSource;
import com.writeloop.dto.RefinementExpressionDto;
import com.writeloop.dto.RefinementExpressionSource;
import com.writeloop.dto.RefinementExpressionType;
import com.writeloop.dto.RefinementMeaningType;

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
    private static final Pattern PREPOSITION_GERUND_PATTERN = Pattern.compile("\\bby\\s+[a-z]+ing\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern STRUGGLE_TO_PATTERN = Pattern.compile("\\bstruggle\\s+to\\s+[a-z]", Pattern.CASE_INSENSITIVE);
    private static final Pattern STRUGGLE_WITH_BARE_VERB_PATTERN = Pattern.compile("\\bstruggle\\s+with\\s+[a-z]+\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern BROKEN_CONNECTOR_PATTERN = Pattern.compile("(?:^|[,;])\\s*(?:to address|to solve|to handle)\\s+i\\b", Pattern.CASE_INSENSITIVE);
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
        String grammarBlockingCorrection = resolveGrammarBlockingMinimalCorrection(learnerAnswer, feedback, answerProfile);

        List<String> strengths = buildStrengthSection(feedback, answerProfile, policy);
        List<GrammarFeedbackItemDto> grammar = buildGrammarSection(
                learnerAnswer,
                feedback,
                answerProfile,
                policy,
                grammarBlockingCorrection
        );
        List<CorrectionDto> corrections = buildImprovementSection(
                feedback,
                answerProfile,
                policy,
                grammar,
                grammarBlockingCorrection
        );
        List<RefinementExpressionDto> refinement = buildRefinementSection(
                feedback,
                learnerAnswer,
                answerProfile,
                policy,
                grammarBlockingCorrection
        );
        FeedbackSectionValidators.ModelAnswerContent modelAnswerContent =
                buildModelAnswerSection(prompt, learnerAnswer, feedback, answerProfile, policy, grammarBlockingCorrection);
        String rewriteGuide = buildRewriteGuideSection(
                feedback,
                answerProfile,
                policy,
                modelAnswerContent,
                grammarBlockingCorrection
        );
        String summary = buildSummarySection(feedback.summary(), answerProfile, corrections, rewriteGuide, policy);
        List<CoachExpressionUsageDto> usedExpressions = buildUsedExpressionSection(feedback, learnerAnswer, answerProfile);
        String correctedAnswer = isGrammarBlocking(answerProfile) && grammarBlockingCorrection != null
                ? grammarBlockingCorrection
                : feedback.correctedAnswer();

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
                correctedAnswer,
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
            return limit(buildMeaningBasedStrengthsV2(answerProfile), policy.maxStrengthCount());
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
            SectionPolicy policy,
            String grammarBlockingCorrection
    ) {
        int effectiveLimit = Math.max(1, policy.maxGrammarIssueCount());
        if (isGrammarBlocking(answerProfile)) {
            List<GrammarFeedbackItemDto> grammar = validators.validateGrammarSectionFormat(
                    buildGrammarBlockingSection(learnerAnswer, feedback, answerProfile, grammarBlockingCorrection)
            );
            if (grammar.isEmpty() && answerProfile != null && answerProfile.grammar() != null) {
                grammar = validators.validateGrammarSectionFormat(fromGrammarIssues(answerProfile.grammar().issues()));
            }
            if (grammar.isEmpty()) {
                grammar = validators.validateGrammarSectionFormat(feedback.grammarFeedback());
            }
            return limit(grammar, effectiveLimit);
        }
        if (isTooShortFragment(answerProfile)) {
            List<GrammarFeedbackItemDto> grammar = validators.validateGrammarSectionFormat(
                    buildTooShortGrammarSection(learnerAnswer, feedback, answerProfile)
            );
            if (!policy.showGrammar()) {
                return List.of();
            }
            return limit(grammar, effectiveLimit);
        }

        List<GrammarFeedbackItemDto> grammar = validators.validateGrammarSectionFormat(feedback.grammarFeedback());
        if (grammar.isEmpty() && answerProfile != null && answerProfile.grammar() != null) {
            grammar = validators.validateGrammarSectionFormat(fromGrammarIssues(answerProfile.grammar().issues()));
        }
        grammar = validators.filterLowValueGrammarItems(grammar);
        if (!policy.showGrammar()) {
            return List.of();
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
        return isGrammarBlocking(answerProfile) ? limit(filtered, 1) : List.copyOf(filtered);
    }

    private List<CorrectionDto> buildImprovementSection(
            FeedbackResponseDto feedback,
            AnswerProfile answerProfile,
            SectionPolicy policy,
            List<GrammarFeedbackItemDto> grammarFeedback,
            String grammarBlockingCorrection
    ) {
        if (!policy.showImprovement()) {
            return List.of();
        }
        if (isGrammarBlocking(answerProfile)) {
            CorrectionDto grammarBlockingImprovement = buildGrammarBlockingImprovement(answerProfile, grammarBlockingCorrection);
            if (grammarBlockingImprovement != null) {
                return List.of(grammarBlockingImprovement);
            }
        }

        List<CorrectionDto> corrections = validators.reduceDuplicateCorrections(feedback.corrections(), grammarFeedback);
        if (!corrections.isEmpty()) {
            CorrectionDto selected = selectCorrection(corrections, answerProfile);
            return selected == null ? List.of() : List.of(selected);
        }
        CorrectionDto selected = fallbackCorrection(answerProfile);
        return selected == null ? List.of() : List.of(selected);
    }

    private List<RefinementExpressionDto> buildRefinementSection(
            FeedbackResponseDto feedback,
            String learnerAnswer,
            AnswerProfile answerProfile,
            SectionPolicy policy,
            String grammarBlockingCorrection
    ) {
        if (!policy.showRefinement()) {
            return List.of();
        }
        List<RefinementExpressionDto> refinementExpressions = validators.validateRefinementCards(feedback.refinementExpressions());
        if (isGrammarBlocking(answerProfile)) {
            List<RefinementExpressionDto> immediateRepairExpressions = buildGrammarBlockingRepairRefinements(grammarBlockingCorrection);
            refinementExpressions = mergeGrammarBlockingRefinements(
                    immediateRepairExpressions,
                    refinementExpressions.stream()
                    .filter(expression -> !shouldDropRefinementForGrammarBlocking(expression, answerProfile, feedback))
                    .map(this::toDirectGrammarBlockingRefinement)
                    .toList(),
                    learnerAnswer,
                    answerProfile
            );
        }
        refinementExpressions = refinementExpressions.stream()
                .sorted(Comparator
                        .comparingInt((RefinementExpressionDto expression) -> refinementScore(expression, policy.refinementFocus(), answerProfile))
                        .reversed()
                        .thenComparing(expression -> expression.expression() == null ? "" : expression.expression(), String.CASE_INSENSITIVE_ORDER))
                .toList();
        return limit(refinementExpressions, policy.maxRefinementCount());
    }

    private String buildSummarySection(
            String summary,
            AnswerProfile answerProfile,
            List<CorrectionDto> corrections,
            String rewriteGuide,
            SectionPolicy policy
    ) {
        if (!policy.showSummary()) {
            return null;
        }
        if (isGrammarBlocking(answerProfile)) {
            return buildGrammarBlockingSummaryV2();
        }
        if (summary == null || summary.isBlank()) {
            return null;
        }
        int sentenceLimit = policy.modelAnswerMode() == ModelAnswerMode.TASK_RESET ? 1 : 2;
        return validators.reduceSummaryDuplication(trimToSentenceCount(summary, sentenceLimit), corrections, rewriteGuide);
    }

    private String buildRewriteGuideSection(
            FeedbackResponseDto feedback,
            AnswerProfile answerProfile,
            SectionPolicy policy,
            FeedbackSectionValidators.ModelAnswerContent modelAnswerContent,
            String grammarBlockingCorrection
    ) {
        if (!policy.showRewriteGuide()) {
            return null;
        }
        AnswerBand answerBand = answerProfile == null || answerProfile.task() == null || answerProfile.task().answerBand() == null
                ? AnswerBand.SHORT_BUT_VALID
                : answerProfile.task().answerBand();
        String rewriteGuide = feedback.rewriteChallenge();
        if (isGrammarBlocking(answerProfile)) {
            rewriteGuide = buildGrammarBlockingRewriteGuideV2(answerProfile, grammarBlockingCorrection);
        } else if (answerBand == AnswerBand.TOO_SHORT_FRAGMENT) {
            rewriteGuide = buildTooShortRewriteGuide(answerProfile, feedback);
        }
        if (answerBand == AnswerBand.TOO_SHORT_FRAGMENT) {
            return rewriteGuide;
        }
        return validators.reduceRewriteGuideModelAnswerDuplication(
                rewriteGuide,
                modelAnswerContent == null ? null : modelAnswerContent.modelAnswer(),
                isGrammarBlocking(answerProfile)
        );
    }

    private FeedbackSectionValidators.ModelAnswerContent buildModelAnswerSection(
            PromptDto prompt,
            String learnerAnswer,
            FeedbackResponseDto feedback,
            AnswerProfile answerProfile,
            SectionPolicy policy,
            String grammarBlockingCorrection
    ) {
        String modelAnswer = feedback.modelAnswer();
        String modelAnswerKo = feedback.modelAnswerKo();
        ModelAnswerMode effectiveMode = policy.modelAnswerMode();
        AnswerBand answerBand = answerProfile == null || answerProfile.task() == null
                ? AnswerBand.SHORT_BUT_VALID
                : answerProfile.task().answerBand();
        if (isGrammarBlocking(answerProfile) && grammarBlockingCorrection != null) {
            modelAnswer = buildGrammarBlockingOneStepUpModelAnswer(grammarBlockingCorrection, feedback.modelAnswer());
            modelAnswerKo = null;
            if (modelAnswer != null && !normalize(modelAnswer).equals(normalize(grammarBlockingCorrection))) {
                effectiveMode = ModelAnswerMode.ONE_STEP_UP;
            }
        } else if (answerBand == AnswerBand.TOO_SHORT_FRAGMENT) {
            modelAnswer = buildTooShortModelAnswer(prompt, learnerAnswer, feedback, answerProfile);
            modelAnswerKo = null;
        } else if (policy.modelAnswerMode() == ModelAnswerMode.MINIMAL_CORRECTION
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
                effectiveMode
        );
        String modelAnswerAnchor = firstNonBlank(
                grammarBlockingCorrection,
                answerProfile == null || answerProfile.grammar() == null ? null : answerProfile.grammar().minimalCorrection(),
                answerProfile == null || answerProfile.rewrite() == null || answerProfile.rewrite().target() == null
                        ? null
                        : answerProfile.rewrite().target().skeleton(),
                feedback.correctedAnswer()
        );
        String nonRegressiveModelAnswer = validators.preventModelAnswerRegression(
                learnerAnswer,
                guarded.modelAnswer(),
                modelAnswerAnchor,
                answerBand,
                effectiveMode
        );
        if (effectiveMode == ModelAnswerMode.ONE_STEP_UP
                && validators.isNearDuplicateText(nonRegressiveModelAnswer, modelAnswerAnchor)) {
            if (answerBand == AnswerBand.GRAMMAR_BLOCKING && grammarBlockingCorrection != null) {
                nonRegressiveModelAnswer = buildGrammarBlockingOneStepUpModelAnswer(grammarBlockingCorrection, feedback.modelAnswer());
            } else if (answerBand == AnswerBand.TOO_SHORT_FRAGMENT) {
                nonRegressiveModelAnswer = buildTooShortModelAnswer(prompt, learnerAnswer, feedback, answerProfile);
            } else if (answerBand == AnswerBand.NATURAL_BUT_BASIC) {
                nonRegressiveModelAnswer = null;
            }
        }
        guarded = new FeedbackSectionValidators.ModelAnswerContent(
                nonRegressiveModelAnswer,
                nonRegressiveModelAnswer == null ? null : guarded.modelAnswerKo()
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

    private String buildGrammarBlockingSummary(
            AnswerProfile answerProfile,
            List<CorrectionDto> corrections
    ) {
        String strengthClause = buildMeaningBasedStrengths(answerProfile).stream()
                .findFirst()
                .orElse("문제와 해결 방향을 함께 말하려는 흐름은 좋습니다.");
        String normalizedStrength = strengthClause.endsWith(".")
                ? strengthClause.substring(0, strengthClause.length() - 1)
                : strengthClause;

        String issueClause = "문장을 막는 핵심 문법을 먼저 바로잡아야 해요.";
        return normalizedStrength + " 다만 " + issueClause;
    }

    private String buildGrammarBlockingRewriteGuide(AnswerProfile answerProfile, String grammarBlockingCorrection) {
        if (answerProfile == null || answerProfile.rewrite() == null) {
            return null;
        }
        String base = firstNonBlank(
                grammarBlockingCorrection,
                answerProfile.grammar() == null ? null : answerProfile.grammar().minimalCorrection(),
                answerProfile.rewrite().target() == null ? null : answerProfile.rewrite().target().skeleton()
        );
        if (base == null) {
            return null;
        }

        String secondaryIssueCode = answerProfile.rewrite().secondaryIssueCode();
        String nextStep = switch (secondaryIssueCode == null ? "" : secondaryIssueCode) {
            case "ADD_REASON" -> "여기에 왜 이 방법을 쓰는지 한 가지 이유를 더 붙여 보세요.";
            case "ADD_EXAMPLE" -> "여기에 짧은 예시 한 문장을 더 붙여 보세요.";
            case "ADD_DETAIL", "MAKE_IT_MORE_SPECIFIC" -> "여기에 이 방법이 어떻게 도움이 되는지 한 가지를 더 붙여 보세요.";
            default -> "이 수정문을 기준으로 다시 써 보세요.";
        };
        return "\"" + base + "\" " + nextStep;
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
            AnswerProfile answerProfile,
            String grammarBlockingCorrection
    ) {
        if (answerProfile == null || answerProfile.grammar() == null) {
            return List.of();
        }

        List<GrammarFeedbackItemDto> grammar = new ArrayList<>();
        String revisedSentence = firstNonBlank(
                grammarBlockingCorrection,
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
                    buildGrammarBlockingReasonV2(answerProfile, learnerAnswer, revisedSentence)
            ));
        }
        return grammar;
    }

    private List<GrammarFeedbackItemDto> buildTooShortGrammarSection(
            String learnerAnswer,
            FeedbackResponseDto feedback,
            AnswerProfile answerProfile
    ) {
        String revisedSentence = resolveTooShortMinimalCorrection(answerProfile, feedback);
        if (revisedSentence == null || normalize(learnerAnswer).equals(normalize(revisedSentence))) {
            return List.of();
        }

        String reason = firstNonBlank(
                feedback == null || feedback.grammarFeedback() == null || feedback.grammarFeedback().isEmpty()
                        ? null
                        : feedback.grammarFeedback().get(0).reasonKo(),
                "먼저 문장이 되도록 주어와 동사 형태를 바로잡아 보세요."
        );
        return List.of(new GrammarFeedbackItemDto(
                learnerAnswer == null ? "" : learnerAnswer.trim(),
                revisedSentence,
                reason
        ));
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

    private String buildGrammarBlockingReason(
            AnswerProfile answerProfile,
            String learnerAnswer,
            String revisedSentence
    ) {
        List<String> reasons = new ArrayList<>();
        String normalizedAnswer = normalize(learnerAnswer);
        String normalizedRevised = normalize(revisedSentence);

        if (STRUGGLE_WITH_BARE_VERB_PATTERN.matcher(normalizedAnswer).find()
                && (STRUGGLE_TO_PATTERN.matcher(normalizedRevised).find() || normalizedRevised.contains("with meeting"))) {
            reasons.add("struggle 뒤에는 to meet 또는 with meeting처럼 자연스러운 동사 형태를 써 주세요.");
        }
        if (normalizedAnswer.contains(" by ")
                && PREPOSITION_GERUND_PATTERN.matcher(normalizedRevised).find()) {
            reasons.add("by 뒤에는 writing처럼 -ing 형태가 와야 자연스러워요.");
        }
        if (BROKEN_CONNECTOR_PATTERN.matcher(normalizedAnswer).find()
                && (normalizedRevised.contains(" so ") || normalizedRevised.contains("to address this") || normalizedRevised.contains("to solve this"))) {
            reasons.add("to address를 단독으로 잇기보다 so 또는 To address this처럼 연결하면 더 자연스러워요.");
        }

        if (answerProfile != null && answerProfile.grammar() != null) {
            for (GrammarIssue issue : answerProfile.grammar().issues()) {
                if (issue == null) {
                    continue;
                }
                String reason = grammarReasonForCode(issue.code());
                if (reason != null && !reason.isBlank() && !reasons.contains(reason)) {
                    reasons.add(reason);
                }
                if (reasons.size() >= 3) {
                    break;
                }
            }
        }

        if (reasons.isEmpty()) {
            reasons.add("문장을 막는 핵심 문법을 먼저 바로잡으면 뜻이 한 번에 더 잘 읽혀요.");
        }
        return String.join("\n", reasons.stream().limit(3).toList());
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
                if (expression.type() != null && expression.type().name().equals("LEXICAL")) score += 4;
                if (expression.type() != null && expression.type().name().equals("FRAME")) score -= 2;
                score += overlapWithSafeRewrite(normalizedExpression, answerProfile) * 2;
                if (STRUGGLE_TO_PATTERN.matcher(normalizedExpression).find()) score += 4;
                if (PREPOSITION_GERUND_PATTERN.matcher(normalizedExpression).find()) score += 4;
                if (normalizedExpression.contains("stay on track")) score += 2;
                if (normalizedExpression.contains("deadline")) score += 2;
                if (normalizedExpression.contains("to do list")) score += 2;
                if (isGenericTransitionConnector(normalizedExpression)) score -= 6;
                if (requiresLargeReframeForGrammarBlocking(normalizedExpression, expression)) score -= 6;
                if (countWords(normalizedExpression) > 6) score -= 3;
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

    private boolean shouldDropRefinementForGrammarBlocking(
            RefinementExpressionDto expression,
            AnswerProfile answerProfile,
            FeedbackResponseDto feedback
    ) {
        if (expression == null || expression.expression() == null || expression.expression().isBlank()) {
            return true;
        }
        String normalizedExpression = normalize(expression.expression());
        if (isGenericTransitionConnector(normalizedExpression)) {
            return true;
        }
        if (requiresLargeReframeForGrammarBlocking(normalizedExpression, expression)) {
            return true;
        }
        if (overlapsGrammarIssueSpan(
                normalizedExpression,
                answerProfile == null || answerProfile.grammar() == null ? List.of() : answerProfile.grammar().issues()
        ) && overlapWithSafeRewrite(normalizedExpression, answerProfile) == 0) {
            return true;
        }
        return false;
    }

    private boolean requiresLargeReframeForGrammarBlocking(
            String normalizedExpression,
            RefinementExpressionDto expression
    ) {
        if (normalizedExpression == null || normalizedExpression.isBlank()) {
            return false;
        }
        if (normalizedExpression.equals("as a result")
                || normalizedExpression.equals("therefore")
                || normalizedExpression.equals("one challenge i often face is")) {
            return true;
        }
        return expression != null
                && expression.type() == com.writeloop.dto.RefinementExpressionType.FRAME
                && countWords(normalizedExpression) >= 5
                && !STRUGGLE_TO_PATTERN.matcher(normalizedExpression).find()
                && !PREPOSITION_GERUND_PATTERN.matcher(normalizedExpression).find();
    }

    private int overlapWithSafeRewrite(String normalizedExpression, AnswerProfile answerProfile) {
        if (normalizedExpression == null || normalizedExpression.isBlank() || answerProfile == null) {
            return 0;
        }
        Set<String> expressionTokens = extractMeaningfulTokens(normalizedExpression);
        if (expressionTokens.isEmpty()) {
            return 0;
        }

        Set<String> safeTokens = new LinkedHashSet<>();
        if (answerProfile.grammar() != null && answerProfile.grammar().minimalCorrection() != null) {
            safeTokens.addAll(extractMeaningfulTokens(answerProfile.grammar().minimalCorrection()));
        }
        if (answerProfile.rewrite() != null
                && answerProfile.rewrite().target() != null
                && answerProfile.rewrite().target().skeleton() != null) {
            safeTokens.addAll(extractMeaningfulTokens(answerProfile.rewrite().target().skeleton()));
        }
        if (safeTokens.isEmpty()) {
            return 0;
        }

        Set<String> overlap = new LinkedHashSet<>(expressionTokens);
        overlap.retainAll(safeTokens);
        return overlap.size();
    }

    private boolean isGenericTransitionConnector(String normalizedExpression) {
        return "to address this".equals(normalizedExpression)
                || "to solve this".equals(normalizedExpression)
                || "to handle this".equals(normalizedExpression)
                || "as a result".equals(normalizedExpression)
                || "therefore".equals(normalizedExpression);
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

    private boolean isTooShortFragment(AnswerProfile answerProfile) {
        return answerProfile != null
                && answerProfile.task() != null
                && answerProfile.task().answerBand() == AnswerBand.TOO_SHORT_FRAGMENT;
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

    private List<String> buildMeaningBasedStrengthsV2(AnswerProfile answerProfile) {
        if (answerProfile == null || answerProfile.content() == null || answerProfile.content().signals() == null) {
            return List.of();
        }

        ContentSignals signals = answerProfile.content().signals();
        List<String> strengths = new ArrayList<>();
        if (signals.hasMainAnswer() && signals.hasActivity()) {
            strengths.add("문제와 해결 방법을 함께 제시하려는 흐름이 좋아요.");
        }
        if (signals.hasMainAnswer() && signals.hasReason()) {
            strengths.add("핵심 답과 이유를 함께 담으려는 점이 좋아요.");
        }
        if (signals.hasActivity()) {
            strengths.add("실제 해결 행동을 함께 말해서 답이 살아 있어요.");
        }
        if (strengths.isEmpty() && signals.hasMainAnswer()) {
            strengths.add("질문에 맞는 핵심 답을 분명하게 말했어요.");
        }
        return validators.dedupeStrengths(strengths);
    }

    private String resolveGrammarBlockingMinimalCorrection(
            String learnerAnswer,
            FeedbackResponseDto feedback,
            AnswerProfile answerProfile
    ) {
        if (!isGrammarBlocking(answerProfile)) {
            return null;
        }

        String candidate = firstNonBlank(
                answerProfile == null || answerProfile.grammar() == null ? null : answerProfile.grammar().minimalCorrection(),
                answerProfile == null || answerProfile.rewrite() == null || answerProfile.rewrite().target() == null
                        ? null
                        : answerProfile.rewrite().target().skeleton(),
                feedback == null ? null : feedback.correctedAnswer(),
                feedback == null ? null : trimToSentenceCount(feedback.modelAnswer(), 1),
                learnerAnswer
        );
        return normalizeGrammarBlockingCorrection(learnerAnswer, candidate);
    }

    private String normalizeGrammarBlockingCorrection(String learnerAnswer, String candidate) {
        String revised = validators.sanitizeCorrectedSentence(candidate);
        if (revised == null) {
            return null;
        }

        revised = revised
                .replaceAll("(?i)\\bstruggle with meet the deadline\\b", "struggle to meet deadlines")
                .replaceAll("(?i)\\bstruggle with meet deadlines\\b", "struggle to meet deadlines")
                .replaceAll("(?i)\\bstruggle with meeting the deadline\\b", "struggle to meet deadlines")
                .replaceAll("(?i)\\bstruggle with meeting deadlines\\b", "struggle to meet deadlines")
                .replaceAll("(?i)\\bto meet the deadline\\b", "to meet deadlines")
                .replaceAll("(?i)\\bby write\\b", "by writing")
                .replaceAll("(?i),?\\s*to address this,?\\s+i\\b", ", so I")
                .replaceAll("(?i),?\\s*to address\\s+i\\b", ", so I")
                .replaceAll("(?i),?\\s*to solve this,?\\s+i\\b", ", so I")
                .replaceAll("(?i),?\\s*to solve\\s+i\\b", ", so I")
                .replaceAll("\\s+,", ",")
                .replaceAll("\\.\\s*,\\s*so\\b", ", so")
                .replaceAll("\\.\\s+so\\b", ", so")
                .replaceAll(",(?=\\S)", ", ")
                .replaceAll("\\s+", " ")
                .trim();

        if (!revised.endsWith(".") && !revised.endsWith("!") && !revised.endsWith("?")) {
            revised = revised + ".";
        }
        if (!revised.isEmpty()) {
            revised = Character.toUpperCase(revised.charAt(0)) + revised.substring(1);
        }
        return validators.sanitizeCorrectedSentence(revised);
    }

    private CorrectionDto buildGrammarBlockingImprovement(
            AnswerProfile answerProfile,
            String grammarBlockingCorrection
    ) {
        if (!isGrammarBlocking(answerProfile)) {
            return null;
        }
        String normalizedCorrection = normalize(grammarBlockingCorrection);
        if (normalizedCorrection.contains("to do list") || normalizedCorrection.contains("to-do list")) {
            return new CorrectionDto(
                    "to-do list가 어떻게 도움이 되는지 한 가지 더 구체적으로 써 보세요.",
                    "예: 해야 할 일을 더 잘 정리할 수 있다고 한 문장만 덧붙여 보세요."
            );
        }
        return new CorrectionDto(
                "이 방법이 어떻게 도움이 되는지 한 가지 더 구체적으로 써 보세요.",
                "효과를 보여 주는 짧은 문장 한 개만 더 붙여 보세요."
        );
    }

    private List<RefinementExpressionDto> buildGrammarBlockingRepairRefinements(String grammarBlockingCorrection) {
        if (grammarBlockingCorrection == null || grammarBlockingCorrection.isBlank()) {
            return List.of();
        }

        String normalized = normalize(grammarBlockingCorrection);
        List<RefinementExpressionDto> refinements = new ArrayList<>();
        if (normalized.contains("struggle to meet deadlines")) {
            refinements.add(grammarBlockingRefinement(
                    "struggle to meet deadlines",
                    "마감일을 맞추는 데 어려움을 겪다",
                    "자주 겪는 어려움을 말할 때 쓸 수 있어요.",
                    "I often struggle to meet deadlines.",
                    "저는 자주 마감일을 맞추는 데 어려움을 겪어요."
            ));
        }
        if (normalized.contains("by writing a to-do list")) {
            refinements.add(grammarBlockingRefinement(
                    "by writing a to-do list",
                    "할 일 목록을 써서",
                    "해결 방법을 설명할 때 자연스럽게 이어 쓸 수 있어요.",
                    "I stay organized by writing a to-do list.",
                    "저는 할 일 목록을 써서 정리를 유지해요."
            ));
        }
        if (normalized.contains("stay on track")) {
            refinements.add(grammarBlockingRefinement(
                    "stay on track",
                    "계획대로 해 나가다",
                    "계획을 유지하는 느낌을 짧게 말할 때 좋아요.",
                    "A clear plan helps me stay on track.",
                    "분명한 계획은 제가 계획대로 가도록 도와줘요."
            ));
        }
        return List.copyOf(refinements);
    }

    private RefinementExpressionDto toDirectGrammarBlockingRefinement(RefinementExpressionDto expression) {
        if (expression == null || expression.expression() == null) {
            return expression;
        }
        String normalizedExpression = normalize(expression.expression());
        if (normalizedExpression.contains("struggle to meet deadlines")) {
            return grammarBlockingRefinement(
                    "struggle to meet deadlines",
                    "마감일을 맞추는 데 어려움을 겪다",
                    "자주 겪는 어려움을 말할 때 쓸 수 있어요.",
                    "I often struggle to meet deadlines.",
                    "저는 자주 마감일을 맞추는 데 어려움을 겪어요."
            );
        }
        if (normalizedExpression.contains("by writing a to-do list")) {
            return grammarBlockingRefinement(
                    "by writing a to-do list",
                    "할 일 목록을 써서",
                    "해결 방법을 설명할 때 자연스럽게 이어 쓸 수 있어요.",
                    "I stay organized by writing a to-do list.",
                    "저는 할 일 목록을 써서 정리를 유지해요."
            );
        }
        if (normalizedExpression.contains("stay on track")) {
            return grammarBlockingRefinement(
                    "stay on track",
                    "계획대로 해 나가다",
                    "계획을 유지하는 느낌을 짧게 말할 때 좋아요.",
                    "A clear plan helps me stay on track.",
                    "분명한 계획은 제가 계획대로 가도록 도와줘요."
            );
        }
        return expression;
    }

    private List<RefinementExpressionDto> mergeGrammarBlockingRefinements(
            List<RefinementExpressionDto> immediateRepairExpressions,
            List<RefinementExpressionDto> fallbackExpressions,
            String learnerAnswer,
            AnswerProfile answerProfile
    ) {
        List<RefinementExpressionDto> merged = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (RefinementExpressionDto expression : immediateRepairExpressions) {
            if (expression == null || expression.expression() == null) {
                continue;
            }
            String key = normalize(expression.expression());
            if (seen.add(key)) {
                merged.add(expression);
            }
        }
        for (RefinementExpressionDto expression : fallbackExpressions) {
            if (expression == null || expression.expression() == null) {
                continue;
            }
            String key = normalize(expression.expression());
            if (!seen.add(key)) {
                continue;
            }
            if (requiresLargeReframeForGrammarBlocking(normalize(expression.expression()), expression)) {
                continue;
            }
            if (overlapsGrammarIssueSpan(normalize(expression.expression()),
                    answerProfile == null || answerProfile.grammar() == null ? List.of() : answerProfile.grammar().issues())
                    && overlapWithSafeRewrite(normalize(expression.expression()), answerProfile) == 0) {
                continue;
            }
            merged.add(expression);
        }
        return List.copyOf(merged);
    }

    private RefinementExpressionDto grammarBlockingRefinement(
            String expression,
            String meaningKo,
            String guidanceKo,
            String exampleEn,
            String exampleKo
    ) {
        return new RefinementExpressionDto(
                expression,
                RefinementExpressionType.LEXICAL,
                RefinementExpressionSource.GENERATED,
                meaningKo,
                RefinementMeaningType.GLOSS,
                guidanceKo,
                exampleEn,
                exampleKo,
                RefinementExampleSource.GENERATED,
                true,
                List.of()
        );
    }

    private String buildGrammarBlockingSummaryV2() {
        return "문제와 해결 방법을 함께 제시한 점은 좋지만, 먼저 핵심 문법을 바로잡아야 해요.";
    }

    private String buildGrammarBlockingRewriteGuideV2(AnswerProfile answerProfile, String grammarBlockingCorrection) {
        if (answerProfile == null || answerProfile.rewrite() == null) {
            return null;
        }
        String base = firstNonBlank(
                grammarBlockingCorrection,
                answerProfile.grammar() == null ? null : answerProfile.grammar().minimalCorrection(),
                answerProfile.rewrite().target() == null ? null : answerProfile.rewrite().target().skeleton()
        );
        if (base == null) {
            return null;
        }

        String secondaryIssueCode = answerProfile.rewrite().secondaryIssueCode();
        String nextStep = switch (secondaryIssueCode == null ? "" : secondaryIssueCode) {
            case "ADD_REASON" -> "여기에 왜 이 방법이 도움이 되는지 한 가지 이유를 더 붙여 보세요.";
            case "ADD_EXAMPLE" -> "여기에 짧은 예시 한 문장을 더 붙여 보세요.";
            case "ADD_DETAIL", "MAKE_IT_MORE_SPECIFIC" -> "여기에 이 방법이 어떻게 도움이 되는지 한 가지를 더 덧붙여 보세요.";
            default -> "이 문장을 기준으로 핵심 문법을 유지한 채 다시 써 보세요.";
        };
        return "\"" + base + "\" " + nextStep;
    }

    private String buildTooShortRewriteGuide(AnswerProfile answerProfile, FeedbackResponseDto feedback) {
        String minimalCorrection = resolveTooShortMinimalCorrection(answerProfile, feedback);
        String skeleton = answerProfile == null || answerProfile.rewrite() == null || answerProfile.rewrite().target() == null
                ? null
                : answerProfile.rewrite().target().skeleton();
        String action = answerProfile == null || answerProfile.rewrite() == null || answerProfile.rewrite().target() == null
                ? null
                : answerProfile.rewrite().target().action();
        String nextStep = switch (action == null ? "" : action) {
            case "ADD_REASON" -> "이유를 짧게 덧붙여 다시 써 보세요.";
            case "ADD_EXAMPLE" -> "짧은 예시를 한 문장 덧붙여 보세요.";
            case "ADD_DETAIL" -> "한 가지 구체적인 정보를 더 붙여 보세요.";
            default -> null;
        };
        if (minimalCorrection != null && skeleton != null) {
            String guide = "\"" + minimalCorrection + "\"처럼 먼저 문장을 성립시키고, 그다음 \"" + skeleton + "\" 틀로 다시 써 보세요.";
            return nextStep == null ? guide : guide + " " + nextStep;
        }
        if (skeleton != null) {
            String guide = "\"" + skeleton + "\" 틀에 맞춰 한 문장으로 다시 써 보세요.";
            return nextStep == null ? guide : guide + " " + nextStep;
        }
        if (minimalCorrection != null) {
            String guide = "\"" + minimalCorrection + "\"처럼 먼저 문장을 완성해 보세요.";
            return nextStep == null ? guide : guide + " " + nextStep;
        }
        return null;
    }

    private String buildTooShortModelAnswer(
            PromptDto prompt,
            String learnerAnswer,
            FeedbackResponseDto feedback,
            AnswerProfile answerProfile
    ) {
        String minimalCorrection = resolveTooShortMinimalCorrection(answerProfile, feedback);
        String skeleton = answerProfile == null || answerProfile.rewrite() == null || answerProfile.rewrite().target() == null
                ? null
                : answerProfile.rewrite().target().skeleton();
        String predicate = extractPredicateFromSentence(minimalCorrection);
        if (skeleton != null && predicate != null && skeleton.contains("...")) {
            String expanded = validators.sanitizeCorrectedSentence(skeleton.replace("...", predicate));
            if (expanded != null && !validators.isNearDuplicateText(expanded, minimalCorrection)) {
                return expanded;
            }
        }
        if (minimalCorrection != null) {
            return minimalCorrection;
        }
        return trimToSentenceCount(feedback == null ? null : feedback.modelAnswer(), 1);
    }

    private String resolveTooShortMinimalCorrection(AnswerProfile answerProfile, FeedbackResponseDto feedback) {
        return validators.sanitizeCorrectedSentence(firstNonBlank(
                answerProfile == null || answerProfile.grammar() == null ? null : answerProfile.grammar().minimalCorrection(),
                feedback == null ? null : feedback.correctedAnswer(),
                answerProfile == null || answerProfile.rewrite() == null || answerProfile.rewrite().target() == null
                        ? null
                        : answerProfile.rewrite().target().skeleton()
        ));
    }

    private String extractPredicateFromSentence(String sentence) {
        String sanitized = validators.sanitizeCorrectedSentence(sentence);
        if (sanitized == null) {
            return null;
        }
        String withoutEnding = sanitized.replaceAll("[.!?]+$", "").trim();
        Matcher matcher = Pattern.compile("^(?:i|we|he|she|they)\\s+(?:usually\\s+)?(.+)$", Pattern.CASE_INSENSITIVE)
                .matcher(withoutEnding);
        if (!matcher.find()) {
            return null;
        }
        String predicate = matcher.group(1) == null ? null : matcher.group(1).trim();
        return predicate == null || predicate.isBlank() ? null : predicate;
    }

    private String buildGrammarBlockingReasonV2(
            AnswerProfile answerProfile,
            String learnerAnswer,
            String revisedSentence
    ) {
        List<String> reasons = new ArrayList<>();
        String normalizedAnswer = normalize(learnerAnswer);
        String normalizedRevised = normalize(revisedSentence);

        if (STRUGGLE_WITH_BARE_VERB_PATTERN.matcher(normalizedAnswer).find()
                && STRUGGLE_TO_PATTERN.matcher(normalizedRevised).find()) {
            reasons.add("struggle 뒤에는 to meet가 자연스럽습니다.");
        }
        if (normalizedAnswer.contains(" by ")
                && PREPOSITION_GERUND_PATTERN.matcher(normalizedRevised).find()) {
            reasons.add("by 뒤에는 writing처럼 -ing 형태가 와야 자연스럽습니다.");
        }
        if ((BROKEN_CONNECTOR_PATTERN.matcher(normalizedAnswer).find() || normalizedAnswer.contains("to address this"))
                && normalizedRevised.contains(" so ")) {
            reasons.add("so로 연결하면 문장이 더 자연스럽습니다.");
        }

        if (reasons.isEmpty()) {
            reasons.add("문장을 막는 핵심 문법을 먼저 바로잡으면 뜻이 더 자연스럽게 읽힙니다.");
        }
        return String.join("\n", reasons.stream().limit(3).toList());
    }

    private String buildGrammarBlockingOneStepUpModelAnswer(String grammarBlockingCorrection, String fallbackModelAnswer) {
        String base = firstNonBlank(grammarBlockingCorrection, trimToSentenceCount(fallbackModelAnswer, 1));
        if (base == null) {
            return null;
        }

        String detailSentence = extractHelpfulDetailSentence(fallbackModelAnswer, base);
        if (detailSentence == null) {
            detailSentence = inferHelpfulDetailSentence(base);
        }
        return detailSentence == null ? base : base + " " + detailSentence;
    }

    private String extractHelpfulDetailSentence(String modelAnswer, String baseSentence) {
        if (modelAnswer == null || modelAnswer.isBlank()) {
            return null;
        }
        String[] sentences = modelAnswer.trim().split("(?<=[.!?])\\s+");
        if (sentences.length < 2) {
            return null;
        }
        String normalizedBase = normalize(baseSentence);
        for (String sentence : sentences) {
            String trimmed = sentence == null ? null : sentence.trim();
            if (trimmed == null || trimmed.isBlank()) {
                continue;
            }
            if (normalize(trimmed).equals(normalizedBase)) {
                continue;
            }
            if (countWords(trimmed) >= 4) {
                return validators.sanitizeCorrectedSentence(trimmed);
            }
        }
        return null;
    }

    private String inferHelpfulDetailSentence(String baseSentence) {
        String normalized = normalize(baseSentence);
        if (normalized.contains("to do list") || normalized.contains("to-do list")) {
            return "This helps me organize my tasks better.";
        }
        if (normalized.contains("stay on track")) {
            return "This helps me keep my schedule under control.";
        }
        if (normalized.contains("plan")) {
            return "This helps me manage my tasks more clearly.";
        }
        return "This helps me handle the problem more clearly.";
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
