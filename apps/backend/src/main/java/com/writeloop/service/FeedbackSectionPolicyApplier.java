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
    private final FeedbackDeterministicSectionGenerator deterministicSectionGenerator = new FeedbackDeterministicSectionGenerator();
    private final FeedbackDeterministicCorrectionResolver deterministicCorrectionResolver = new FeedbackDeterministicCorrectionResolver();

    FeedbackResponseDto apply(
            PromptDto prompt,
            String learnerAnswer,
            FeedbackResponseDto feedback,
            AnswerProfile answerProfile,
            int attemptIndex
    ) {
        SectionPolicy policy = sectionPolicySelector.select(answerProfile, attemptIndex);
        String grammarBlockingCorrection = resolveGrammarBlockingMinimalCorrection(prompt, learnerAnswer, feedback, answerProfile);
        String alignedCorrection = resolveAlignedMinimalCorrection(prompt, learnerAnswer, feedback, answerProfile);

        List<String> strengths = buildStrengthSection(feedback, answerProfile, policy);
        List<GrammarFeedbackItemDto> grammar = buildGrammarSection(
                learnerAnswer,
                feedback,
                answerProfile,
                policy,
                grammarBlockingCorrection,
                alignedCorrection
        );
        List<CorrectionDto> corrections = buildImprovementSection(
                prompt,
                feedback,
                answerProfile,
                policy,
                grammar,
                grammarBlockingCorrection,
                alignedCorrection
        );
        List<RefinementExpressionDto> refinement = buildRefinementSection(
                feedback,
                learnerAnswer,
                answerProfile,
                policy,
                grammarBlockingCorrection
        );
        FeedbackSectionValidators.ModelAnswerContent modelAnswerContent =
                buildModelAnswerSection(
                        prompt,
                        learnerAnswer,
                        feedback,
                        answerProfile,
                        policy,
                        grammarBlockingCorrection,
                        alignedCorrection
                );
        String rewriteGuide = buildRewriteGuideSection(
                prompt,
                learnerAnswer,
                feedback,
                answerProfile,
                policy,
                modelAnswerContent,
                grammarBlockingCorrection,
                alignedCorrection
        );
        String summary = buildSummarySection(feedback.summary(), answerProfile, corrections, rewriteGuide, policy);
        List<CoachExpressionUsageDto> usedExpressions = buildUsedExpressionSection(feedback, learnerAnswer, answerProfile);
        String correctedAnswer = firstNonBlank(
                isGrammarBlocking(answerProfile) ? grammarBlockingCorrection : null,
                shouldUseAlignedExpansionGuide(answerProfile, alignedCorrection) ? alignedCorrection : null,
                feedback.correctedAnswer()
        );

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
            int effectiveLimit = policy.maxStrengthCount();
            if (answerProfile != null
                    && answerProfile.grammar() != null
                    && answerProfile.grammar().severity().ordinal() >= GrammarSeverity.MODERATE.ordinal()) {
                effectiveLimit = Math.min(effectiveLimit, 1);
            }
            return limit(buildMeaningBasedStrengthsV2(answerProfile), effectiveLimit);
        }

        List<String> strengths = new ArrayList<>();
        List<String> deterministicStrengths = buildMeaningBasedStrengthsV2(answerProfile);
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
            strengths.addAll(deterministicStrengths);
        }
        if (strengths.isEmpty()) {
            strengths.addAll(validators.filterKoreanStrengths(feedback.strengths() == null ? List.of() : feedback.strengths()));
        }
        if (strengths.isEmpty() && answerProfile != null && answerProfile.content() != null) {
            strengths.addAll(buildMeaningBasedStrengths(answerProfile));
        }
        strengths = validators.dedupeStrengths(strengths);
        return limit(strengths, policy.maxStrengthCount());
    }

    private String resolveGrammarBlockingMinimalCorrection(
            PromptDto prompt,
            String learnerAnswer,
            FeedbackResponseDto feedback,
            AnswerProfile answerProfile
    ) {
        if (!isGrammarBlocking(answerProfile)) {
            return null;
        }
        return deterministicCorrectionResolver.resolveMinimalCorrection(
                prompt,
                learnerAnswer,
                answerProfile,
                feedback == null ? null : feedback.correctedAnswer()
        );
    }

    private String resolveAlignedMinimalCorrection(
            PromptDto prompt,
            String learnerAnswer,
            FeedbackResponseDto feedback,
            AnswerProfile answerProfile
    ) {
        if (!shouldUseAlignedExpansionSummary(answerProfile)) {
            return null;
        }
        return deterministicCorrectionResolver.resolveMinimalCorrection(
                prompt,
                learnerAnswer,
                answerProfile,
                feedback == null ? null : feedback.correctedAnswer()
        );
    }

    private RefinementExpressionDto toDirectGrammarBlockingRefinement(RefinementExpressionDto expression) {
        return expression;
    }

    private List<GrammarFeedbackItemDto> buildGrammarSection(
            String learnerAnswer,
            FeedbackResponseDto feedback,
            AnswerProfile answerProfile,
            SectionPolicy policy,
            String grammarBlockingCorrection,
            String alignedCorrection
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
        if (policy.showGrammar() && shouldBuildAlignedLocalGrammarSection(answerProfile, learnerAnswer, alignedCorrection)) {
            List<GrammarFeedbackItemDto> grammar = validators.validateGrammarSectionFormat(
                    buildAlignedLocalGrammarSection(learnerAnswer, answerProfile, alignedCorrection)
            );
            if (!grammar.isEmpty()) {
                return limit(grammar, effectiveLimit);
            }
        }

        List<GrammarFeedbackItemDto> grammar = validators.validateGrammarSectionFormat(feedback.grammarFeedback());
        if (grammar.isEmpty() && answerProfile != null && answerProfile.grammar() != null) {
            grammar = validators.validateGrammarSectionFormat(fromGrammarIssues(answerProfile.grammar().issues()));
        }
        grammar = shouldHideLowValueGrammarForExpansion(answerProfile)
                ? validators.filterLowValueGrammarItems(grammar)
                : grammar;
        if (!policy.showGrammar()) {
            return List.of();
        }
        if (policy.attemptOverlayPolicy().suppressResolvedGrammar()
                && answerProfile != null
                && answerProfile.rewrite() != null
                && !"FIX_BLOCKING_GRAMMAR".equals(answerProfile.rewrite().primaryIssueCode())
                && !"FIX_LOCAL_GRAMMAR".equals(answerProfile.rewrite().primaryIssueCode())) {
            grammar = grammar.stream()
                    .filter(item -> normalize(item.reasonKo()).contains("grammar") || normalize(item.reasonKo()).contains("correction"))
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
            PromptDto prompt,
            FeedbackResponseDto feedback,
            AnswerProfile answerProfile,
            SectionPolicy policy,
            List<GrammarFeedbackItemDto> grammarFeedback,
            String grammarBlockingCorrection,
            String alignedCorrection
    ) {
        if (!policy.showImprovement()) {
            return List.of();
        }
        AnswerBand answerBand = answerProfile == null || answerProfile.task() == null
                ? AnswerBand.SHORT_BUT_VALID
                : answerProfile.task().answerBand();
        String correctedBase = firstNonBlank(
                grammarBlockingCorrection,
                alignedCorrection,
                answerProfile == null || answerProfile.grammar() == null ? null : answerProfile.grammar().minimalCorrection(),
                feedback.correctedAnswer()
        );
        if (isGrammarBlocking(answerProfile) || shouldUseAlignedExpansionGuide(answerProfile, alignedCorrection)) {
            CorrectionDto deterministicImprovement = deterministicSectionGenerator.buildSingleImprovement(
                    prompt,
                    answerProfile,
                    answerBand,
                    correctedBase
            );
            if (deterministicImprovement != null) {
                return List.of(deterministicImprovement);
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
            List<RefinementExpressionDto> immediateRepairExpressions = validators.validateRefinementCardsDomain(
                    deterministicSectionGenerator.buildRepairRefinements(
                            grammarBlockingCorrection,
                            policy.maxRefinementCount()
                    )
            ).stream().map(RefinementCard::toDto).toList();
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

    private List<RefinementExpressionDto> mergeGrammarBlockingRefinements(
            List<RefinementExpressionDto> primary,
            List<RefinementExpressionDto> secondary,
            String learnerAnswer,
            AnswerProfile answerProfile
    ) {
        List<RefinementExpressionDto> merged = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();

        List<RefinementExpressionDto> primaryExpressions = primary == null ? List.of() : primary;
        List<RefinementExpressionDto> secondaryExpressions = secondary == null ? List.of() : secondary;

        for (RefinementExpressionDto expression : primaryExpressions) {
            if (expression == null || expression.expression() == null || expression.expression().isBlank()) {
                continue;
            }
            if (seen.add(normalize(expression.expression()))) {
                merged.add(expression);
            }
        }

        for (RefinementExpressionDto expression : secondaryExpressions) {
            if (expression == null || expression.expression() == null || expression.expression().isBlank()) {
                continue;
            }
            String normalizedExpression = normalize(expression.expression());
            if (seen.contains(normalizedExpression)) {
                continue;
            }
            if (overlapsGrammarIssueSpan(
                    normalizedExpression,
                    answerProfile == null || answerProfile.grammar() == null ? List.of() : answerProfile.grammar().issues()
            ) && overlapWithSafeRewrite(normalizedExpression, answerProfile) == 0) {
                continue;
            }
            seen.add(normalizedExpression);
            merged.add(expression);
        }

        return validators.validateRefinementCards(merged);
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
        AnswerBand answerBand = answerProfile == null || answerProfile.task() == null
                ? AnswerBand.SHORT_BUT_VALID
                : answerProfile.task().answerBand();
        if (isGrammarBlocking(answerProfile) || shouldUseAlignedExpansionSummary(answerProfile)) {
            String summaryCandidate = validators.reduceSummaryDuplication(
                    deterministicSectionGenerator.buildSummary(
                            answerProfile,
                            buildMeaningBasedStrengthsV2(answerProfile),
                            corrections,
                            answerBand
                    ),
                    corrections,
                    rewriteGuide
            );
            if (summaryCandidate == null && shouldUseAlignedExpansionSummary(answerProfile)) {
                String alignedSummary = buildAlignedExpansionSummary(answerProfile);
                summaryCandidate = validators.reduceSummaryDuplication(
                        alignedSummary,
                        corrections,
                        rewriteGuide
                );
                if (summaryCandidate == null) {
                    summaryCandidate = alignedSummary;
                }
            }
            return summaryCandidate;
        }
        if (summary == null || summary.isBlank()) {
            return null;
        }
        int sentenceLimit = policy.modelAnswerMode() == ModelAnswerMode.TASK_RESET ? 1 : 2;
        return validators.reduceSummaryDuplication(trimToSentenceCount(summary, sentenceLimit), corrections, rewriteGuide);
    }

    private String buildRewriteGuideSection(
            PromptDto prompt,
            String learnerAnswer,
            FeedbackResponseDto feedback,
            AnswerProfile answerProfile,
            SectionPolicy policy,
            FeedbackSectionValidators.ModelAnswerContent modelAnswerContent,
            String grammarBlockingCorrection,
            String alignedCorrection
    ) {
        if (!policy.showRewriteGuide()) {
            return null;
        }
        AnswerBand answerBand = answerProfile == null || answerProfile.task() == null || answerProfile.task().answerBand() == null
                ? AnswerBand.SHORT_BUT_VALID
                : answerProfile.task().answerBand();
        String rewriteGuide = feedback.rewriteChallenge();
        if (isGrammarBlocking(answerProfile)) {
            rewriteGuide = deterministicSectionGenerator.buildRewriteGuide(
                    prompt,
                    answerProfile,
                    answerBand,
                    grammarBlockingCorrection,
                    answerProfile == null || answerProfile.grammar() == null ? null : answerProfile.grammar().minimalCorrection(),
                    answerProfile == null || answerProfile.rewrite() == null || answerProfile.rewrite().target() == null
                            ? null
                            : answerProfile.rewrite().target().skeleton()
            );
        } else if (answerBand == AnswerBand.TOO_SHORT_FRAGMENT) {
            rewriteGuide = deterministicSectionGenerator.buildRewriteGuide(
                    prompt,
                    answerProfile,
                    answerBand,
                    resolveTooShortMinimalCorrection(answerProfile, feedback),
                    resolveTooShortMinimalCorrection(answerProfile, feedback),
                    answerProfile == null || answerProfile.rewrite() == null || answerProfile.rewrite().target() == null
                            ? null
                            : answerProfile.rewrite().target().skeleton()
            );
        } else if (shouldUseAlignedExpansionGuide(answerProfile, alignedCorrection)) {
            rewriteGuide = deterministicSectionGenerator.buildRewriteGuide(
                    prompt,
                    answerProfile,
                    answerBand,
                    alignedCorrection,
                    answerProfile == null || answerProfile.grammar() == null ? null : answerProfile.grammar().minimalCorrection(),
                    answerProfile == null || answerProfile.rewrite() == null || answerProfile.rewrite().target() == null
                            ? null
                            : answerProfile.rewrite().target().skeleton()
            );
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
            String grammarBlockingCorrection,
            String alignedCorrection
    ) {
        if (!policy.showModelAnswer()) {
            return new FeedbackSectionValidators.ModelAnswerContent(null, null);
        }
        String modelAnswer = feedback.modelAnswer();
        String modelAnswerKo = feedback.modelAnswerKo();
        ModelAnswerMode effectiveMode = policy.modelAnswerMode();
        AnswerBand answerBand = answerProfile == null || answerProfile.task() == null
                ? AnswerBand.SHORT_BUT_VALID
                : answerProfile.task().answerBand();
        String oneStepUpBase = (answerBand == AnswerBand.SHORT_BUT_VALID || answerBand == AnswerBand.CONTENT_THIN)
                ? firstNonBlank(
                alignedCorrection,
                feedback.correctedAnswer(),
                answerProfile == null || answerProfile.grammar() == null ? null : answerProfile.grammar().minimalCorrection(),
                learnerAnswer
        )
                : alignedCorrection;
        if (isGrammarBlocking(answerProfile) && grammarBlockingCorrection != null) {
            modelAnswer = deterministicSectionGenerator.buildOneStepUpModelAnswer(
                    prompt,
                    answerProfile,
                    answerBand,
                    grammarBlockingCorrection,
                    feedback.modelAnswer()
            );
            modelAnswerKo = null;
            if (modelAnswer != null && !normalize(modelAnswer).equals(normalize(grammarBlockingCorrection))) {
                effectiveMode = ModelAnswerMode.ONE_STEP_UP;
            }
        } else if (answerBand == AnswerBand.TOO_SHORT_FRAGMENT) {
            modelAnswer = buildTooShortModelAnswer(prompt, learnerAnswer, feedback, answerProfile);
            modelAnswerKo = null;
        } else if ((answerBand == AnswerBand.SHORT_BUT_VALID || answerBand == AnswerBand.CONTENT_THIN)
                && oneStepUpBase != null) {
            modelAnswer = deterministicSectionGenerator.buildOneStepUpModelAnswer(
                    prompt,
                    answerProfile,
                    answerBand,
                    oneStepUpBase,
                    feedback.modelAnswer()
            );
            modelAnswerKo = null;
            effectiveMode = ModelAnswerMode.ONE_STEP_UP;
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
                oneStepUpBase,
                answerProfile == null || answerProfile.grammar() == null ? null : answerProfile.grammar().minimalCorrection(),
                feedback.correctedAnswer(),
                answerProfile == null || answerProfile.rewrite() == null || answerProfile.rewrite().target() == null
                        ? null
                        : answerProfile.rewrite().target().skeleton()
        );
        String nonRegressiveModelAnswer = validators.preventModelAnswerRegression(
                learnerAnswer,
                guarded.modelAnswer(),
                modelAnswerAnchor,
                answerBand,
                effectiveMode
        );
        if (nonRegressiveModelAnswer == null) {
            if (answerBand == AnswerBand.GRAMMAR_BLOCKING && grammarBlockingCorrection != null) {
                nonRegressiveModelAnswer = validators.preventModelAnswerRegression(
                        learnerAnswer,
                        deterministicSectionGenerator.buildOneStepUpModelAnswer(
                                prompt,
                                answerProfile,
                                answerBand,
                                grammarBlockingCorrection,
                                feedback.modelAnswer()
                        ),
                        modelAnswerAnchor,
                        answerBand,
                        effectiveMode
                );
            } else if ((answerBand == AnswerBand.SHORT_BUT_VALID || answerBand == AnswerBand.CONTENT_THIN)
                    && oneStepUpBase != null) {
                nonRegressiveModelAnswer = validators.preventModelAnswerRegression(
                        learnerAnswer,
                        deterministicSectionGenerator.buildOneStepUpModelAnswer(
                                prompt,
                                answerProfile,
                                answerBand,
                                oneStepUpBase,
                                null
                        ),
                        modelAnswerAnchor,
                        answerBand,
                        effectiveMode
                );
            }
        }
        if (effectiveMode == ModelAnswerMode.ONE_STEP_UP
                && validators.isNearDuplicateText(nonRegressiveModelAnswer, modelAnswerAnchor)
                && !isClearlyExtendedOneStepUp(nonRegressiveModelAnswer, modelAnswerAnchor)) {
            if (answerBand == AnswerBand.GRAMMAR_BLOCKING && grammarBlockingCorrection != null) {
                nonRegressiveModelAnswer = deterministicSectionGenerator.buildOneStepUpModelAnswer(
                        prompt,
                        answerProfile,
                        answerBand,
                        grammarBlockingCorrection,
                        feedback.modelAnswer()
                );
            } else if (answerBand == AnswerBand.TOO_SHORT_FRAGMENT) {
                nonRegressiveModelAnswer = buildTooShortModelAnswer(prompt, learnerAnswer, feedback, answerProfile);
            } else if ((answerBand == AnswerBand.SHORT_BUT_VALID || answerBand == AnswerBand.CONTENT_THIN)
                    && oneStepUpBase != null) {
                nonRegressiveModelAnswer = deterministicSectionGenerator.buildOneStepUpModelAnswer(
                        prompt,
                        answerProfile,
                        answerBand,
                        oneStepUpBase,
                        null
                );
            } else if (answerBand == AnswerBand.NATURAL_BUT_BASIC) {
                nonRegressiveModelAnswer = null;
            }
        }
        if (effectiveMode == ModelAnswerMode.ONE_STEP_UP
                && answerBand != AnswerBand.TOO_SHORT_FRAGMENT
                && !hasNovelOneStepUpDetail(nonRegressiveModelAnswer, modelAnswerAnchor)) {
            nonRegressiveModelAnswer = null;
        }
        if (nonRegressiveModelAnswer == null
                && effectiveMode == ModelAnswerMode.ONE_STEP_UP
                && (answerBand == AnswerBand.SHORT_BUT_VALID || answerBand == AnswerBand.CONTENT_THIN)
                && oneStepUpBase != null) {
            String alignedOneStepUp = deterministicSectionGenerator.buildOneStepUpModelAnswer(
                    prompt,
                    answerProfile,
                    answerBand,
                    oneStepUpBase,
                    null
            );
            if (hasNovelOneStepUpDetail(alignedOneStepUp, modelAnswerAnchor)) {
                nonRegressiveModelAnswer = alignedOneStepUp;
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
            case "HAS_EXAMPLE" -> "\"" + signal.evidence() + "\"처럼 짧은 예시를 넣어 답을 더 구체적으로 만들었어요.";
            case "EXPRESSES_PERSONAL_RESPONSE" -> "\"" + signal.evidence() + "\"처럼 자신의 생각이나 느낌을 분명하게 드러냈어요.";
            case "DESCRIBES_ACTIVITY" -> "\"" + signal.evidence() + "\"처럼 실제로 하는 활동을 구체적으로 써서 답이 더 살아 있어요.";
            case "USES_TIME_OR_PLACE" -> "\"" + signal.evidence() + "\"처럼 시간이나 장소를 넣어 장면이 더 잘 그려져요.";
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

    private boolean shouldBuildAlignedLocalGrammarSection(
            AnswerProfile answerProfile,
            String learnerAnswer,
            String alignedCorrection
    ) {
        if (answerProfile == null || answerProfile.grammar() == null) {
            return false;
        }
        if (answerProfile.grammar().severity().ordinal() < GrammarSeverity.MODERATE.ordinal()) {
            return false;
        }
        AnswerBand answerBand = answerProfile.task() == null || answerProfile.task().answerBand() == null
                ? AnswerBand.SHORT_BUT_VALID
                : answerProfile.task().answerBand();
        if (answerBand != AnswerBand.SHORT_BUT_VALID && answerBand != AnswerBand.CONTENT_THIN) {
            return false;
        }
        if (alignedCorrection == null || alignedCorrection.isBlank()) {
            return false;
        }
        if (normalize(learnerAnswer).equals(normalize(alignedCorrection))) {
            return false;
        }
        boolean hasNonArticleIssue = answerProfile.grammar().issues().stream()
                .filter(issue -> issue != null)
                .anyMatch(issue -> !"ARTICLE".equals(issue.code()));
        return hasNonArticleIssue && shouldPreferAlignedSentenceGrammar(learnerAnswer, alignedCorrection);
    }

    private boolean shouldPreferAlignedSentenceGrammar(String learnerAnswer, String alignedCorrection) {
        String normalizedLearner = normalize(learnerAnswer);
        String normalizedCorrection = normalize(alignedCorrection);
        Set<String> learnerTokens = extractMeaningfulTokens(normalizedLearner);
        Set<String> correctedTokens = extractMeaningfulTokens(normalizedCorrection);
        Set<String> symmetricDiff = new LinkedHashSet<>(learnerTokens);
        symmetricDiff.addAll(correctedTokens);
        Set<String> overlap = new LinkedHashSet<>(learnerTokens);
        overlap.retainAll(correctedTokens);
        symmetricDiff.removeAll(overlap);
        boolean introducesReasonConnector = normalizedLearner.contains(" for me to ") && normalizedCorrection.contains(" because ");
        boolean repairsAwkwardFrame = normalizedLearner.contains(" this is to ") && normalizedCorrection.contains(" this year is to ");
        return symmetricDiff.size() >= 2 || introducesReasonConnector || repairsAwkwardFrame;
    }

    private List<GrammarFeedbackItemDto> buildAlignedLocalGrammarSection(
            String learnerAnswer,
            AnswerProfile answerProfile,
            String alignedCorrection
    ) {
        if (alignedCorrection == null || alignedCorrection.isBlank()) {
            return List.of();
        }
        String reason = buildAlignedLocalGrammarReason(learnerAnswer, alignedCorrection, answerProfile);
        if (reason == null || reason.isBlank()) {
            return List.of();
        }
        return List.of(new GrammarFeedbackItemDto(
                learnerAnswer == null ? "" : learnerAnswer.trim(),
                alignedCorrection,
                reason
        ));
    }

    private List<GrammarFeedbackItemDto> buildGrammarBlockingSection(
            String learnerAnswer,
            FeedbackResponseDto feedback,
            AnswerProfile answerProfile,
            String grammarBlockingCorrection
    ) {
        String revisedSentence = firstNonBlank(
                grammarBlockingCorrection,
                answerProfile == null || answerProfile.grammar() == null ? null : answerProfile.grammar().minimalCorrection(),
                feedback == null ? null : feedback.correctedAnswer()
        );
        revisedSentence = validators.sanitizeCorrectedSentence(revisedSentence);
        if (revisedSentence == null || revisedSentence.isBlank()) {
            return List.of();
        }
        if (normalize(learnerAnswer).equals(normalize(revisedSentence))) {
            return List.of();
        }
        String reason = buildGrammarBlockingReason(answerProfile, learnerAnswer, revisedSentence);
        if (reason == null || reason.isBlank()) {
            reason = grammarBlockingReason(answerProfile);
        }
        return List.of(new GrammarFeedbackItemDto(
                learnerAnswer == null ? "" : learnerAnswer.trim(),
                revisedSentence,
                reason
        ));
    }

    private List<GrammarFeedbackItemDto> buildTooShortGrammarSection(
            String learnerAnswer,
            FeedbackResponseDto feedback,
            AnswerProfile answerProfile
    ) {
        String revisedSentence = validators.sanitizeCorrectedSentence(resolveTooShortMinimalCorrection(answerProfile, feedback));
        if (revisedSentence == null || revisedSentence.isBlank()) {
            return List.of();
        }
        if (normalize(learnerAnswer).equals(normalize(revisedSentence))) {
            return List.of();
        }
        return List.of(new GrammarFeedbackItemDto(
                learnerAnswer == null ? "" : learnerAnswer.trim(),
                revisedSentence,
                "First, turn the fragment into one complete sentence with a clear subject and verb."
        ));
    }

    private String buildAlignedLocalGrammarReason(
            String learnerAnswer,
            String revisedSentence,
            AnswerProfile answerProfile
    ) {
        List<String> reasons = new ArrayList<>();
        String normalizedAnswer = normalize(learnerAnswer);
        String normalizedRevised = normalize(revisedSentence);
        if (normalizedAnswer.contains(" this is to") && normalizedRevised.contains(" this year is to")) {
            reasons.add("this year를 넣어 목표 시점을 더 자연스럽게 보여 주세요.");
        }
        if (normalizedAnswer.contains(" for me to") && normalizedRevised.contains(" because ")) {
            reasons.add("\"It's important for me to ...\"보다 \"It's important to me because ...\"처럼 연결하면 더 자연스러워요.");
        }
        if (reasons.isEmpty() && answerProfile != null && answerProfile.grammar() != null) {
            for (GrammarIssue issue : answerProfile.grammar().issues()) {
                if (issue == null) {
                    continue;
                }
                String reason = grammarReasonForCode(issue.code());
                if (reason != null && !reason.isBlank() && !reasons.contains(reason)) {
                    reasons.add(reason);
                }
                if (reasons.size() >= 2) {
                    break;
                }
            }
        }
        if (reasons.isEmpty()) {
            reasons.add("표현을 조금 더 자연스럽게 고치면 문장이 훨씬 읽기 쉬워져요.");
        }
        return String.join("\n", reasons.stream().limit(2).toList());
    }
    private String grammarReasonForCodeReadable(String code) {
        return switch (code) {
            case "SUBJECT_VERB_AGREEMENT" -> "주어와 동사를 맞추면 문장이 더 자연스럽고 정확해져요.";
            case "ARTICLE" -> "관사를 자연스럽게 고치면 표현이 더 정확해져요.";
            case "TENSE", "TENSE_ALIGNMENT" -> "시제를 맞추면 문장의 시간 흐름이 더 분명해져요.";
            case "POINT_OF_VIEW_ALIGNMENT" -> "시점을 일관되게 맞추면 문장이 더 자연스러워요.";
            case "PREPOSITION" -> "전치사를 자연스럽게 고치면 뜻이 더 정확하게 전달돼요.";
            case "NUMBER_AGREEMENT" -> "단수와 복수를 맞추면 문장이 더 정확해져요.";
            default -> "표현을 조금 더 자연스럽게 고치면 문장이 더 읽기 쉬워져요.";
        };
    }

    private String grammarReasonForCode(String code) {
        return switch (code) {
            case "SUBJECT_VERB_AGREEMENT" -> "주어와 동사 수를 맞추면 문장이 더 자연스럽고 정확해져요.";
            case "ARTICLE" -> "관사 위치를 다듬으면 표현이 더 자연스럽고 정확해져요.";
            case "TENSE", "TENSE_ALIGNMENT" -> "시제를 맞추면 문장의 시간 흐름이 더 또렷해져요.";
            case "POINT_OF_VIEW_ALIGNMENT" -> "I / my 같은 시점을 일관되게 맞추면 문장이 더 자연스러워요.";
            case "PREPOSITION" -> "전치사를 자연스럽게 고치면 뜻이 더 정확하게 전달돼요.";
            case "NUMBER_AGREEMENT" -> "단수와 복수를 맞추면 문장이 더 정확하고 자연스러워져요.";
            default -> "표현을 조금 더 자연스럽게 고치면 문장이 훨씬 읽기 쉬워져요.";
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
            reasons.add("struggle 뒤에는 to meet 같은 형태가 자연스러워요.");
        }
        if (normalizedAnswer.contains(" by ") && PREPOSITION_GERUND_PATTERN.matcher(normalizedRevised).find()) {
            reasons.add("by 뒤에는 writing처럼 -ing 형태가 와야 해요.");
        }
        if (BROKEN_CONNECTOR_PATTERN.matcher(normalizedAnswer).find()
                && (normalizedRevised.contains(" so ") || normalizedRevised.contains("to address this") || normalizedRevised.contains("to solve this"))) {
            reasons.add("so로 연결하면 문장이 더 자연스러워요.");
        }
        if (reasons.isEmpty()) {
            reasons.add("문장을 막는 핵심 문법을 먼저 바로잡아야 해요.");
        }
        return String.join("\n", reasons.stream().limit(2).toList());
    }
    private String grammarBlockingReason(AnswerProfile answerProfile) {
        if (answerProfile != null) {
            if (answerProfile.grammar() == null) {
                return "뜻을 막는 핵심 문법을 먼저 고치면 문장이 더 분명하게 전달돼요.";
            }
            return answerProfile.grammar().issues().stream()
                    .filter(issue -> issue != null && issue.blocksMeaning())
                    .map(GrammarIssue::code)
                    .findFirst()
                    .map(this::grammarReasonForCodeReadable)
                    .orElse("뜻을 막는 핵심 문법을 먼저 고치면 문장이 더 분명하게 전달돼요.");
        }
        if (answerProfile == null || answerProfile.grammar() == null) {
            return "핵심 문법을 먼저 고치면 뜻이 더 분명하게 전달돼요.";
        }
        return answerProfile.grammar().issues().stream()
                .filter(issue -> issue != null && issue.blocksMeaning())
                .map(GrammarIssue::code)
                .findFirst()
                .map(this::grammarReasonForCode)
                .orElse("핵심 문법을 먼저 고치면 뜻이 더 분명하게 전달돼요.");
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
            case "OFF_TOPIC_RESPONSE", "MISSING_MAIN_TASK", "STATE_MAIN_ANSWER" -> combined.contains("question") || combined.contains("main") ? 0 : 1;
            case "ADD_REASON" -> combined.contains("reason") || combined.contains("because") ? 0 : 1;
            case "ADD_EXAMPLE" -> combined.contains("example") || combined.contains("for example") ? 0 : 1;
            case "ADD_DETAIL", "MAKE_IT_MORE_SPECIFIC" -> combined.contains("detail") || combined.contains("time") || combined.contains("situation") || combined.contains("feeling") ? 0 : 1;
            case "FIX_BLOCKING_GRAMMAR", "FIX_LOCAL_GRAMMAR" -> combined.contains("grammar") || combined.contains("tense") || combined.contains("preposition") ? 0 : 1;
            default -> 1;
        };
    }

    private CorrectionDto fallbackCorrection(AnswerProfile answerProfile) {
        if (answerProfile == null || answerProfile.rewrite() == null) {
            return null;
        }
        String skeleton = answerProfile.rewrite().target() == null ? null : answerProfile.rewrite().target().skeleton();
        return switch (answerProfile.rewrite().primaryIssueCode()) {
            case "OFF_TOPIC_RESPONSE", "MISSING_MAIN_TASK", "STATE_MAIN_ANSWER" ->
                    new CorrectionDto(
                            "질문에 맞는 핵심 답을 먼저 분명하게 써 보세요.",
                            "질문에 맞는 핵심 문장을 먼저 쓰고, 그다음 짧게 덧붙여 보세요." + formatHintSuffix(skeleton)
                    );
            case "ADD_REASON" ->
                    new CorrectionDto(
                            "이 답이 왜 중요한지 이유를 한 가지 더 붙여 보세요.",
                            "because로 이유를 한 문장 더 덧붙여 보세요." + formatHintSuffix(skeleton)
                    );
            case "ADD_EXAMPLE" ->
                    new CorrectionDto(
                            "짧은 예시를 넣으면 답이 더 구체적으로 들려요.",
                            "For example 뒤에 짧은 예시 한 문장을 더 붙여 보세요." + formatHintSuffix(skeleton)
                    );
            case "ADD_DETAIL", "MAKE_IT_MORE_SPECIFIC" ->
                    new CorrectionDto(
                            "답을 조금 더 구체적으로 만들 디테일을 한 가지 더 붙여 보세요.",
                            "한 가지 방법이나 디테일을 더 구체적으로 써 보세요." + formatHintSuffix(skeleton)
                    );
            case "FIX_BLOCKING_GRAMMAR" ->
                    new CorrectionDto(
                            "문장을 막는 핵심 문법을 먼저 바로잡아 보세요.",
                            "수정문을 기준으로 다시 쓰고, 그다음 한 가지를 더 덧붙여 보세요." + formatHintSuffix(skeleton)
                    );
            case "FIX_LOCAL_GRAMMAR" ->
                    new CorrectionDto(
                            "표현을 조금 더 자연스럽게 고쳐 보세요.",
                            "수정문을 기준으로 다시 쓰며 문장을 더 자연스럽게 다듬어 보세요." + formatHintSuffix(skeleton)
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
                if (isGenericTransitionConnector(normalizedExpression)) score -= 6;
                if (requiresLargeReframeForGrammarBlocking(normalizedExpression, expression)) score -= 6;
                if (countWords(normalizedExpression) > 6) score -= 3;
            }
            case DETAIL_BUILDING -> {
                if (normalizedExpression.contains("because") || normalizedExpression.contains("for example")) score += 3;
                if (normalizedExpression.contains("feel") || normalizedExpression.contains("after") || normalizedExpression.contains("during")) score += 2;
                if (normalizedGuidance.contains("detail") || normalizedGuidance.contains("reason") || normalizedGuidance.contains("example")) score += 1;
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
        if (answerProfile == null || answerProfile.task() == null) {
            return false;
        }
        if (hasElevatedGrammar(answerProfile)) {
            return true;
        }
        return answerProfile.task().answerBand() == AnswerBand.SHORT_BUT_VALID
                || answerProfile.task().answerBand() == AnswerBand.CONTENT_THIN;
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

    private boolean shouldUseAlignedExpansionSummary(AnswerProfile answerProfile) {
        return answerProfile != null
                && answerProfile.task() != null
                && (answerProfile.task().answerBand() == AnswerBand.SHORT_BUT_VALID
                || answerProfile.task().answerBand() == AnswerBand.CONTENT_THIN);
    }

    private List<String> buildMeaningBasedStrengths(AnswerProfile answerProfile) {
        if (answerProfile == null || answerProfile.content() == null || answerProfile.content().signals() == null) {
            return List.of();
        }
        ContentSignals signals = answerProfile.content().signals();
        List<String> strengths = new ArrayList<>();
        if (signals.hasMainAnswer() && signals.hasActivity()) {
            strengths.add("답의 핵심과 실제 행동을 함께 말한 점이 좋아요.");
        }
        if (signals.hasMainAnswer() && signals.hasReason()) {
            strengths.add("답의 핵심과 이유를 함께 제시한 점이 좋아요.");
        }
        if (signals.hasActivity()) {
            strengths.add("실제로 하는 행동을 넣어 답이 더 살아 있어요.");
        }
        if (signals.hasExample()) {
            strengths.add("짧은 예시를 넣어 답이 더 구체적으로 들려요.");
        }
        if (signals.hasFeeling()) {
            strengths.add("느낌이나 생각을 함께 말해 답이 더 자연스럽게 들려요.");
        }
        if (signals.hasTimeOrPlace()) {
            strengths.add("시간이나 장소를 넣어 장면이 더 선명해졌어요.");
        }
        if (strengths.isEmpty() && signals.hasMainAnswer()) {
            strengths.add("질문에 맞는 핵심 답을 분명하게 말했어요.");
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
            strengths.add("답의 핵심과 실제 행동을 함께 말한 점이 좋아요.");
        }
        if (signals.hasMainAnswer() && signals.hasReason()) {
            strengths.add("답의 핵심과 이유를 함께 제시한 점이 좋아요.");
        }
        if (signals.hasActivity()) {
            strengths.add("실제로 하는 행동을 넣어 답이 더 살아 있어요.");
        }
        if (strengths.isEmpty() && signals.hasMainAnswer()) {
            strengths.add("질문에 맞는 핵심 답을 분명하게 말했어요.");
        }
        return validators.dedupeStrengths(strengths);
    }
    private String buildAlignedExpansionSummary(AnswerProfile answerProfile) {
        if (answerProfile == null || answerProfile.content() == null || answerProfile.content().signals() == null) {
            return null;
        }
        ContentSignals signals = answerProfile.content().signals();
        String strengthClause = signals.hasMainAnswer() && signals.hasReason()
                ? "목표와 이유를 함께 답한 점은 좋아요."
                : "질문에 맞는 핵심 답을 분명하게 말한 점은 좋아요.";
        String nextClause = answerProfile.grammar() != null
                && answerProfile.grammar().severity().ordinal() >= GrammarSeverity.MINOR.ordinal()
                ? "표현을 조금 더 자연스럽게 고치고 한 가지 방법이나 이유를 더 붙여 보세요."
                : "한 가지 방법이나 이유를 더 구체적으로 붙여 보세요.";
        return strengthClause + " " + nextClause;
    }
    private boolean shouldUseAlignedExpansionGuide(AnswerProfile answerProfile, String alignedCorrection) {
        if (alignedCorrection == null || alignedCorrection.isBlank() || answerProfile == null || answerProfile.task() == null) {
            return false;
        }
        AnswerBand answerBand = answerProfile.task().answerBand();
        return answerBand == AnswerBand.SHORT_BUT_VALID || answerBand == AnswerBand.CONTENT_THIN;
    }

    private boolean shouldHideLowValueGrammarForExpansion(AnswerProfile answerProfile) {
        if (answerProfile == null || answerProfile.task() == null) {
            return false;
        }
        AnswerBand answerBand = answerProfile.task().answerBand();
        return answerBand == AnswerBand.SHORT_BUT_VALID || answerBand == AnswerBand.CONTENT_THIN;
    }

    private String buildAlignedExpansionRewriteGuide(AnswerProfile answerProfile, String alignedCorrection) {
        if (alignedCorrection == null || alignedCorrection.isBlank()) {
            return null;
        }
        return "\"" + alignedCorrection + "\" " + detailInstructionForRewrite(answerProfile, alignedCorrection);
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
            case "ADD_REASON" -> "여기에 이유를 짧게 덧붙여 보세요.";
            case "ADD_EXAMPLE" -> "여기에 짧은 예시 한 문장을 더 붙여 보세요.";
            case "ADD_DETAIL", "MAKE_IT_MORE_SPECIFIC" -> "여기에 한 가지 구체적인 정보를 더 붙여 보세요.";
            default -> null;
        };
        if (minimalCorrection != null && skeleton != null) {
            String guide = "\"" + minimalCorrection + "\"처럼 먼저 문장을 완성하고, 그다음 \"" + skeleton + "\" 틀로 다시 써 보세요.";
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
    private String detailInstructionForRewrite(AnswerProfile answerProfile, String alignedCorrection) {
        String normalizedCorrection = normalize(alignedCorrection);
        String primaryIssueCode = answerProfile == null || answerProfile.rewrite() == null
                ? ""
                : answerProfile.rewrite().primaryIssueCode();
        String secondaryIssueCode = answerProfile == null || answerProfile.rewrite() == null
                ? ""
                : firstNonBlank(answerProfile.rewrite().secondaryIssueCode(), "");
        String targetIssueCode = "FIX_LOCAL_GRAMMAR".equals(primaryIssueCode) && !secondaryIssueCode.isBlank()
                ? secondaryIssueCode
                : primaryIssueCode;

        if (normalizedCorrection.contains("health goal")
                || normalizedCorrection.contains("healthy")
                || normalizedCorrection.contains("diet")) {
            return "여기에 건강을 위해 실제로 하려는 습관 한 가지를 더 붙여 보세요.";
        }
        return switch (targetIssueCode) {
            case "ADD_REASON" -> "여기에 why it matters를 더 보여 주는 이유 한 가지를 덧붙여 보세요.";
            case "ADD_EXAMPLE" -> "여기에 짧은 예시 한 문장을 더 붙여 보세요.";
            case "ADD_DETAIL", "MAKE_IT_MORE_SPECIFIC" -> "여기에 한 가지 방법이나 디테일을 더 구체적으로 붙여 보세요.";
            default -> "여기에 답을 더 자연스럽게 만드는 디테일 한 가지를 더 붙여 보세요.";
        };
    }
    private boolean isClearlyExtendedOneStepUp(String modelAnswer, String anchorText) {
        if (modelAnswer == null || modelAnswer.isBlank() || anchorText == null || anchorText.isBlank()) {
            return false;
        }
        String sanitizedModel = validators.sanitizeCorrectedSentence(modelAnswer);
        String sanitizedAnchor = validators.sanitizeCorrectedSentence(trimToSentenceCount(anchorText, 1));
        if (sanitizedModel == null || sanitizedAnchor == null) {
            return false;
        }
        if (normalize(sanitizedModel).startsWith(normalize(sanitizedAnchor))
                && countWords(sanitizedModel) >= countWords(sanitizedAnchor) + 3) {
            return true;
        }
        return hasNovelOneStepUpDetail(sanitizedModel, sanitizedAnchor);
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
            reasons.add("struggle 뒤에는 to meet 형태가 자연스러워요.");
        }
        if (normalizedAnswer.contains(" by ") && PREPOSITION_GERUND_PATTERN.matcher(normalizedRevised).find()) {
            reasons.add("by 뒤에는 writing처럼 -ing 형태가 와야 해요.");
        }
        if ((BROKEN_CONNECTOR_PATTERN.matcher(normalizedAnswer).find() || normalizedAnswer.contains("to address this"))
                && normalizedRevised.contains(" so ")) {
            reasons.add("so로 연결하면 문장이 더 자연스러워요.");
        }
        if (reasons.isEmpty()) {
            reasons.add("문장을 막는 핵심 문법을 먼저 바로잡아야 해요.");
        }
        return String.join("\n", reasons.stream().limit(3).toList());
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

    private boolean hasNovelOneStepUpDetail(String candidateText, String anchorText) {
        if (candidateText == null || candidateText.isBlank() || anchorText == null || anchorText.isBlank()) {
            return false;
        }
        List<String> candidateSentences = splitSentences(candidateText);
        List<String> anchorSentences = splitSentences(anchorText);
        if (candidateSentences.isEmpty() || anchorSentences.isEmpty()) {
            return false;
        }
        if (candidateSentences.size() > anchorSentences.size()) {
            for (String candidateSentence : candidateSentences) {
                if (!containsEquivalentSentence(anchorText, candidateSentence) && countWords(candidateSentence) >= 4) {
                    return true;
                }
            }
        }
        int comparableCount = Math.min(candidateSentences.size(), anchorSentences.size());
        for (int index = 0; index < comparableCount; index++) {
            String candidateSentence = candidateSentences.get(index);
            String anchorSentence = anchorSentences.get(index);
            if (areEquivalentSentences(candidateSentence, anchorSentence)) {
                continue;
            }
            if (extendsSentence(candidateSentence, anchorSentence)) {
                return true;
            }
        }
        return false;
    }


    private boolean containsEquivalentSentence(String text, String sentence) {
        if (text == null || text.isBlank() || sentence == null || sentence.isBlank()) {
            return false;
        }
        for (String existingSentence : splitSentences(text)) {
            if (areEquivalentSentences(existingSentence, sentence)) {
                return true;
            }
        }
        return false;
    }

    private boolean areEquivalentSentences(String left, String right) {
        return normalizeSentenceBody(left).equals(normalizeSentenceBody(right));
    }

    private boolean extendsSentence(String candidateSentence, String anchorSentence) {
        String normalizedCandidate = normalizeSentenceBody(candidateSentence);
        String normalizedAnchor = normalizeSentenceBody(anchorSentence);
        return !normalizedCandidate.isBlank()
                && !normalizedAnchor.isBlank()
                && normalizedCandidate.startsWith(normalizedAnchor)
                && countWords(normalizedCandidate) >= countWords(normalizedAnchor) + 3;
    }

    private String firstSentence(String text) {
        List<String> sentences = splitSentences(text);
        return sentences.isEmpty() ? null : sentences.get(0);
    }
    private List<String> splitSentences(String text) {
        if (text == null || text.isBlank()) {
            return List.of();
        }
        List<String> sentences = new ArrayList<>();
        for (String sentence : text.trim().split("(?<=[.!?])\\s+")) {
            String sanitized = validators.sanitizeCorrectedSentence(sentence);
            if (sanitized != null && !sanitized.isBlank()) {
                sentences.add(sanitized);
            }
        }
        return List.copyOf(sentences);
    }

    private String normalizeSentenceBody(String text) {
        return normalize(text).replaceAll("[.!?]+$", "").trim();
    }

    private String formatHintSuffix(String skeleton) {
        if (skeleton == null || skeleton.isBlank()) {
            return "";
        }
        return " hint: \"" + skeleton.trim() + "\"";
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

