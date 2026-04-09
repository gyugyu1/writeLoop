package com.writeloop.service;

import com.writeloop.dto.FeedbackFocusCardDto;
import com.writeloop.dto.FeedbackLoopStatusDto;
import com.writeloop.dto.FeedbackMicroTipDto;
import com.writeloop.dto.FeedbackPrimaryFixDto;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.FeedbackNextStepPracticeDto;
import com.writeloop.dto.FeedbackRewriteSuggestionDto;
import com.writeloop.dto.FeedbackSecondaryLearningPointDto;
import com.writeloop.dto.FeedbackScreenPolicyDto;
import com.writeloop.dto.FeedbackUiDto;
import com.writeloop.dto.GrammarFeedbackItemDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.CorrectionDto;
import com.writeloop.dto.RefinementExpressionDto;
import com.writeloop.dto.RefinementExpressionType;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

final class FeedbackUiComposer {
    private static final Pattern ENGLISH_ANCHOR_PATTERN = Pattern.compile("[A-Za-z][A-Za-z' -]{2,}");
    private static final String START_REWRITE_CTA_LABEL = "이 문장으로 시작해서 다시 쓰기";
    private static final Pattern MULTI_SPACE_PATTERN = Pattern.compile("\\s+");
    private static final Pattern PUNCTUATION_ONLY_PATTERN = Pattern.compile("^[\\p{Punct}]+$");
    private static final Pattern BRACKET_PLACEHOLDER_PATTERN = Pattern.compile("\\[[^\\]]+\\]");
    private static final Pattern QUOTED_ANCHOR_PATTERN = Pattern.compile("['\"“”‘’]([^'\"“”‘’]{3,80})['\"“”‘’]");
    private static final Set<String> SHORT_GRAMMAR_ANCHORS = Set.of(
            "and", "because", "so", "also", "to", "in", "on", "at", "my", "they", "it", "is", "are"
    );
    private static final Set<String> GRAMMAR_OVERLAP_CUES = Set.of(
            "문장", "연결", "전치사", "대명사", "복수", "단수", "동사", "철자", "시제",
            "connector", "connect", "grammar", "pronoun", "plural", "singular", "preposition", "spelling"
    );
    private static final List<String> DEFAULT_SECTION_ORDER = List.of(
            FeedbackScreenSectionId.QUESTION_ANSWER.name(),
            FeedbackScreenSectionId.TOP_STATUS.name(),
            FeedbackScreenSectionId.KEEP_WHAT_WORKS.name(),
            FeedbackScreenSectionId.FIX_FIRST.name(),
            FeedbackScreenSectionId.REWRITE_GUIDE.name(),
            FeedbackScreenSectionId.MODEL_ANSWER.name(),
            FeedbackScreenSectionId.REFINEMENT.name(),
            FeedbackScreenSectionId.CTA.name()
    );

    private final CompletionStateSelector completionStateSelector = new CompletionStateSelector();
    private final FeedbackScreenPolicySelector screenPolicySelector = new FeedbackScreenPolicySelector();

    FeedbackUiDto compose(
            PromptDto prompt,
            String learnerAnswer,
            FeedbackResponseDto feedback,
            AnswerProfile answerProfile
    ) {
        FeedbackUiDto llmUi = feedback == null ? null : feedback.ui();
        FeedbackSectionAvailability availability = buildAvailability(prompt, learnerAnswer, feedback, answerProfile);
        CompletionState completionState = completionStateSelector.select(answerProfile, availability);
        FeedbackScreenPolicy screenPolicy = screenPolicySelector.select(
                answerProfile,
                completionState,
                availability,
                feedback == null ? 1 : Math.max(1, feedback.attemptNo())
        );

        List<ImprovementCandidate> rankedCandidates = rankImprovementCandidates(
                prompt,
                learnerAnswer,
                feedback,
                answerProfile,
                screenPolicy.fixFirstMode()
        );
        ImprovementCandidate primaryCandidate = selectPrimaryFixCandidate(
                rankedCandidates,
                screenPolicy.fixFirstDisplayMode(),
                screenPolicy.fixFirstMode()
        );
        FeedbackPrimaryFixDto primaryFix = resolvePrimaryFix(
                llmUi,
                primaryCandidate,
                screenPolicy.fixFirstDisplayMode(),
                screenPolicy.fixFirstMode(),
                learnerAnswer,
                feedback
        );
        FeedbackFocusCardDto focusCard = resolveFocusCard(
                llmUi,
                prompt,
                answerProfile,
                screenPolicy,
                completionState,
                feedback
        );
        FeedbackNextStepPracticeDto nextStepPractice = resolveRewritePractice(
                llmUi,
                prompt,
                learnerAnswer,
                feedback,
                answerProfile,
                screenPolicy.fixFirstMode(),
                screenPolicy.rewriteGuideMode(),
                primaryFix,
                completionState == CompletionState.OPTIONAL_POLISH
        );
        List<FeedbackSecondaryLearningPointDto> secondaryLearningPoints = resolveSecondaryLearningPoints(
                llmUi,
                primaryFix,
                rankedCandidates
        );
        List<FeedbackSecondaryLearningPointDto> fixPoints = buildFixPoints(primaryFix, secondaryLearningPoints);
        List<FeedbackRewriteSuggestionDto> rewriteSuggestions = resolveRewriteSuggestions(
                llmUi,
                nextStepPractice
        );

        return new FeedbackUiDto(
                focusCard,
                primaryFix,
                buildMicroTip(learnerAnswer, feedback, screenPolicy.fixFirstMode()),
                secondaryLearningPoints,
                fixPoints,
                nextStepPractice,
                rewriteSuggestions,
                toDto(screenPolicy),
                buildLoopStatus(feedback, completionState, screenPolicy)
        );
    }

    private FeedbackSectionAvailability buildAvailability(
            PromptDto prompt,
            String learnerAnswer,
            FeedbackResponseDto feedback,
            AnswerProfile answerProfile
    ) {
        boolean hasKeepWhatWorks = feedback != null
                && ((feedback.strengths() != null && !feedback.strengths().isEmpty())
                || (feedback.usedExpressions() != null && !feedback.usedExpressions().isEmpty()));

        GrammarFeedbackItemDto grammarCard = primaryGrammarItem(learnerAnswer, feedback);
        boolean hasGrammarCard = grammarCard != null
                && normalizeNullable(grammarCard.originalText()) != null
                && normalizeNullable(grammarCard.revisedText()) != null
                && normalizeNullable(grammarCard.reasonKo()) != null;

        boolean hasPrimaryFix = hasGrammarCard
                || (feedback != null && feedback.ui() != null && uiPrimaryFix(feedback.ui()) != null)
                || answerBand(answerProfile) == AnswerBand.OFF_TOPIC
                || taskCompletion(answerProfile) != TaskCompletion.FULL
                || isDetailPromptIssue(primaryIssueCode(answerProfile));

        boolean hasRewriteGuide = (feedback != null
                && feedback.ui() != null
                && hasMeaningfulNextStepPractice(feedback.ui().nextStepPractice()))
                || (shouldBuildFallbackNextStepPractice(answerProfile, FixFirstMode.HIDE)
                && normalizeNullable(
                deriveStarter(prompt, learnerAnswer, feedback, answerProfile, FixFirstMode.HIDE, null, null)
        ) != null);
        boolean hasModelAnswer = feedback != null && normalizeNullable(feedback.modelAnswer()) != null;
        boolean hasDisplayableRefinement = hasDisplayableRefinement(feedback == null ? null : feedback.refinementExpressions());

        return new FeedbackSectionAvailability(
                hasKeepWhatWorks,
                hasPrimaryFix,
                hasGrammarCard,
                hasRewriteGuide,
                hasModelAnswer,
                hasDisplayableRefinement,
                hasHighValueCorrection(answerProfile, hasGrammarCard)
        );
    }

    private FeedbackFocusCardDto buildFocusCard(
            PromptDto prompt,
            AnswerProfile answerProfile,
            FeedbackScreenPolicy screenPolicy,
            CompletionState completionState
    ) {
        String primaryIssueCode = primaryIssueCode(answerProfile);
        AnswerBand answerBand = answerBand(answerProfile);
        FixFirstMode fixFirstMode = screenPolicy == null ? FixFirstMode.HIDE : screenPolicy.fixFirstMode();

        if (completionState == CompletionState.OPTIONAL_POLISH) {
            return new FeedbackFocusCardDto(
                    "지금도 충분히 좋아요",
                    optionalPolishHeadline(prompt, primaryIssueCode),
                    "이미 질문에는 잘 답했어요. 지금은 선택적으로 흐름이나 연결 표현만 가볍게 다듬으면 충분해요."
            );
        }

        if (completionState == CompletionState.CAN_FINISH) {
            return new FeedbackFocusCardDto(
                    "지금 단계에서는 마무리 가능해요",
                    canFinishHeadline(prompt, primaryIssueCode, answerBand),
                    "지금 답으로도 충분하지만, 원하면 한 가지 디테일이나 이유를 더 보태며 연습해 볼 수 있어요."
            );
        }

        if (fixFirstMode == FixFirstMode.TASK_RESET_CARD
                || answerBand == AnswerBand.OFF_TOPIC
                || "OFF_TOPIC_RESPONSE".equals(primaryIssueCode)
                || "MISSING_MAIN_TASK".equals(primaryIssueCode)
                || "STATE_MAIN_ANSWER".equals(primaryIssueCode)) {
            return new FeedbackFocusCardDto(
                    "이번 답변의 수정 목표",
                    "질문에 맞는 핵심 답 먼저 쓰기",
                    "먼저 질문이 묻는 대상과 이유를 바로 말하는 한 문장부터 써 보세요."
            );
        }

        if (answerBand == AnswerBand.TOO_SHORT_FRAGMENT) {
            return new FeedbackFocusCardDto(
                    "이번 답변의 수정 목표",
                    "핵심 문장부터 완성하기",
                    "지금은 내용을 더 늘리기보다, 먼저 한 문장을 자연스럽게 완성하는 것이 중요해요."
            );
        }

        if (fixFirstMode == FixFirstMode.GRAMMAR_CARD
                || answerBand == AnswerBand.GRAMMAR_BLOCKING
                || "FIX_BLOCKING_GRAMMAR".equals(primaryIssueCode)
                || "FIX_LOCAL_GRAMMAR".equals(primaryIssueCode)) {
            return new FeedbackFocusCardDto(
                    "이번 답변의 수정 목표",
                    "핵심 문법 먼저 고치기",
                    "이번에는 내용을 더 붙이기보다, 먼저 문장 구조를 안정적으로 바로잡는 것이 중요해요."
            );
        }

        if (fixFirstMode == FixFirstMode.DETAIL_PROMPT_CARD && "ADD_REASON".equals(primaryIssueCode)) {
            return new FeedbackFocusCardDto(
                    "이번 답변의 수정 목표",
                    "이유를 한 가지 더 구체적으로 쓰기",
                    "왜 그런지 한 문장만 더 또렷하게 적으면 답이 훨씬 설득력 있어져요."
            );
        }

        if (fixFirstMode == FixFirstMode.DETAIL_PROMPT_CARD && "ADD_EXAMPLE".equals(primaryIssueCode)) {
            return new FeedbackFocusCardDto(
                    "이번 답변의 수정 목표",
                    "짧은 예시를 한 문장 더 붙이기",
                    "지금 방향은 좋아요. 짧은 예시를 하나만 더 보태면 답이 더 선명해져요."
            );
        }

        if (fixFirstMode == FixFirstMode.DETAIL_PROMPT_CARD
                && ("ADD_DETAIL".equals(primaryIssueCode) || "MAKE_IT_MORE_SPECIFIC".equals(primaryIssueCode))) {
            return new FeedbackFocusCardDto(
                    "이번 답변의 수정 목표",
                    "한 가지 디테일 더 추가하기",
                    detailSupportText(prompt)
            );
        }

        return new FeedbackFocusCardDto(
                "이번 답변의 수정 목표",
                "표현을 조금 더 자연스럽게 다듬기",
                isRoutinePrompt(prompt)
                        ? "루틴의 흐름은 이미 보여요. 지금은 연결 표현이나 시간 순서만 조금 더 자연스럽게 다듬으면 돼요."
                        : "답의 방향은 좋아요. 표현을 한 군데만 더 자연스럽게 바꾸면 훨씬 매끄러워져요."
        );
    }

    private FeedbackFocusCardDto resolveFocusCard(
            FeedbackUiDto llmUi,
            PromptDto prompt,
            AnswerProfile answerProfile,
            FeedbackScreenPolicy screenPolicy,
            CompletionState completionState,
            FeedbackResponseDto feedback
    ) {
        FeedbackFocusCardDto llmFocusCard = sanitizeLlmFocusCard(llmUi == null ? null : llmUi.focusCard());
        if (llmFocusCard != null) {
            return llmFocusCard;
        }
        return buildFocusCard(prompt, answerProfile, screenPolicy, completionState);
    }

    private FeedbackFocusCardDto sanitizeLlmFocusCard(FeedbackFocusCardDto focusCard) {
        if (focusCard == null) {
            return null;
        }
        String title = normalizeNullable(focusCard.title());
        String headline = normalizeNullable(focusCard.headline());
        String supportText = normalizeNullable(focusCard.supportText());
        if (title == null || headline == null) {
            return null;
        }
        return new FeedbackFocusCardDto(title, headline, supportText);
    }

    private FeedbackPrimaryFixDto buildPrimaryFix(
            PromptDto prompt,
            String learnerAnswer,
            FeedbackResponseDto feedback,
            AnswerProfile answerProfile,
            SectionDisplayMode displayMode,
            FixFirstMode fixFirstMode
    ) {
        if (displayMode == SectionDisplayMode.HIDE || fixFirstMode == FixFirstMode.HIDE) {
            return null;
        }

        FeedbackPrimaryFixDto llmPrimaryFix = feedback == null || feedback.ui() == null
                ? null
                : feedback.ui().primaryFix();
        FeedbackPrimaryFixDto alignedPrimaryFix = alignPrimaryFixWithMode(llmPrimaryFix, fixFirstMode);
        if (alignedPrimaryFix != null) {
            return alignedPrimaryFix;
        }

        if (fixFirstMode == FixFirstMode.GRAMMAR_CARD) {
            GrammarFeedbackItemDto primaryGrammarItem = primaryGrammarItem(learnerAnswer, feedback);
            if (primaryGrammarItem == null) {
                return null;
            }
            return new FeedbackPrimaryFixDto(
                    "먼저 고칠 부분",
                    "이 한 군데만 먼저 고치면 문장 흐름이 훨씬 안정돼요.",
                    primaryGrammarItem.originalText(),
                    primaryGrammarItem.revisedText(),
                    primaryGrammarItem.reasonKo()
            );
        }

        if (fixFirstMode == FixFirstMode.TASK_RESET_CARD) {
            return new FeedbackPrimaryFixDto(
                    "먼저 고칠 부분",
                    "질문이 묻는 대상과 이유를 바로 말하는 한 문장부터 써 보세요.",
                    null,
                    null,
                    null
            );
        }

        String primaryIssueCode = primaryIssueCode(answerProfile);
        String instruction;
        if ("ADD_REASON".equals(primaryIssueCode)) {
            instruction = "because를 사용해 왜 그런지 한 문장으로 이유를 더 써 보세요.";
        } else if ("ADD_EXAMPLE".equals(primaryIssueCode)) {
            instruction = "짧은 예시를 한 문장 더 붙여 보세요.";
        } else if ("ADD_DETAIL".equals(primaryIssueCode) || "MAKE_IT_MORE_SPECIFIC".equals(primaryIssueCode)) {
            instruction = detailInstruction(prompt);
        } else {
            instruction = "지금 답을 더 또렷하게 만드는 정보 한 가지를 추가해 보세요.";
        }
        return new FeedbackPrimaryFixDto("한 가지 더 추가하면 좋아요", instruction, null, null, null);
    }

    private ImprovementCandidate selectPrimaryFixCandidate(
            List<ImprovementCandidate> rankedCandidates,
            SectionDisplayMode displayMode,
            FixFirstMode fixFirstMode
    ) {
        if (displayMode == SectionDisplayMode.HIDE
                || fixFirstMode == FixFirstMode.HIDE
                || rankedCandidates == null
                || rankedCandidates.isEmpty()) {
            return null;
        }

        for (ImprovementCandidate candidate : rankedCandidates) {
            if (candidate.primaryFix() != null && candidate.fixFirstMode() == fixFirstMode) {
                return candidate;
            }
        }
        return null;
    }

    private List<ImprovementCandidate> rankImprovementCandidates(
            PromptDto prompt,
            String learnerAnswer,
            FeedbackResponseDto feedback,
            AnswerProfile answerProfile,
            FixFirstMode fixFirstMode
    ) {
        if (feedback == null) {
            return List.of();
        }

        List<ImprovementCandidate> candidates = new ArrayList<>();
        LinkedHashSet<String> seen = new LinkedHashSet<>();
        int order = 0;

        FeedbackPrimaryFixDto llmPrimaryFix = feedback.ui() == null ? null : uiPrimaryFix(feedback.ui());
        FeedbackPrimaryFixDto alignedPrimaryFix = alignPrimaryFixWithMode(llmPrimaryFix, fixFirstMode);
        if (alignedPrimaryFix != null) {
            addImprovementCandidate(
                    candidates,
                    seen,
                    new ImprovementCandidate(
                            candidateKey(
                                    "PRIMARY_FIX",
                                    alignedPrimaryFix.title(),
                                    alignedPrimaryFix.instruction(),
                                    alignedPrimaryFix.originalText(),
                                    alignedPrimaryFix.revisedText()
                            ),
                            ImprovementCandidateKind.PRIMARY_FIX,
                            fixFirstMode,
                            scorePrimaryFixCandidate(alignedPrimaryFix, fixFirstMode, answerProfile, true),
                            order++,
                            alignedPrimaryFix,
                            null
                    )
            );
        }

        FeedbackPrimaryFixDto fallbackPrimaryFix = buildFallbackPrimaryFix(
                prompt,
                learnerAnswer,
                feedback,
                answerProfile,
                fixFirstMode
        );
        if (fallbackPrimaryFix != null) {
            addImprovementCandidate(
                    candidates,
                    seen,
                    new ImprovementCandidate(
                            candidateKey(
                                    "PRIMARY_FIX_FALLBACK",
                                    fallbackPrimaryFix.title(),
                                    fallbackPrimaryFix.instruction(),
                                    fallbackPrimaryFix.originalText(),
                                    fallbackPrimaryFix.revisedText()
                            ),
                            ImprovementCandidateKind.PRIMARY_FIX,
                            fixFirstMode,
                            scorePrimaryFixCandidate(fallbackPrimaryFix, fixFirstMode, answerProfile, false),
                            order++,
                            fallbackPrimaryFix,
                            null
                    )
            );
        }

        if (feedback.grammarFeedback() != null) {
            for (GrammarFeedbackItemDto grammarItem : feedback.grammarFeedback()) {
                FeedbackSecondaryLearningPointDto secondaryPoint = toGrammarSecondaryPoint(grammarItem);
                if (secondaryPoint == null) {
                    continue;
                }
                addImprovementCandidate(
                        candidates,
                        seen,
                        new ImprovementCandidate(
                                candidateKey("GRAMMAR", grammarItem.originalText(), grammarItem.revisedText(), grammarItem.reasonKo()),
                                ImprovementCandidateKind.GRAMMAR,
                                FixFirstMode.GRAMMAR_CARD,
                                scoreGrammarCandidate(grammarItem, answerProfile),
                                order++,
                                new FeedbackPrimaryFixDto(
                                        "먼저 고칠 부분",
                                        "이 한 군데만 먼저 고치면 문장 흐름이 훨씬 안정돼요.",
                                        grammarItem.originalText(),
                                        grammarItem.revisedText(),
                                        grammarItem.reasonKo()
                                ),
                                secondaryPoint
                        )
                );
            }
        }

        if (feedback.corrections() != null) {
            for (CorrectionDto correction : feedback.corrections()) {
                FeedbackSecondaryLearningPointDto secondaryPoint = toCorrectionSecondaryPoint(correction);
                if (secondaryPoint == null) {
                    continue;
                }
                addImprovementCandidate(
                        candidates,
                        seen,
                        new ImprovementCandidate(
                                candidateKey("CORRECTION", correction.issue(), correction.suggestion()),
                                ImprovementCandidateKind.CORRECTION,
                                FixFirstMode.HIDE,
                                scoreCorrectionCandidate(correction, answerProfile),
                                order++,
                                null,
                                secondaryPoint
                        )
                );
            }
        }

        if (feedback.refinementExpressions() != null) {
            for (RefinementExpressionDto expression : feedback.refinementExpressions()) {
                FeedbackSecondaryLearningPointDto secondaryPoint = toRefinementSecondaryPoint(expression);
                if (secondaryPoint == null) {
                    continue;
                }
                addImprovementCandidate(
                        candidates,
                        seen,
                        new ImprovementCandidate(
                                candidateKey("EXPRESSION", expression.expression(), expression.guidanceKo(), expression.exampleEn()),
                                ImprovementCandidateKind.EXPRESSION,
                                FixFirstMode.HIDE,
                                scoreExpressionCandidate(expression, answerProfile),
                                order++,
                                null,
                                secondaryPoint
                        )
                );
            }
        }

        candidates.sort((left, right) -> {
            int scoreCompare = Integer.compare(right.score(), left.score());
            if (scoreCompare != 0) {
                return scoreCompare;
            }
            int kindCompare = Integer.compare(kindPriority(left.kind()), kindPriority(right.kind()));
            if (kindCompare != 0) {
                return kindCompare;
            }
            return Integer.compare(left.order(), right.order());
        });
        return List.copyOf(candidates);
    }

    private FeedbackPrimaryFixDto buildFallbackPrimaryFix(
            PromptDto prompt,
            String learnerAnswer,
            FeedbackResponseDto feedback,
            AnswerProfile answerProfile,
            FixFirstMode fixFirstMode
    ) {
        if (fixFirstMode == FixFirstMode.HIDE) {
            return null;
        }

        if (fixFirstMode == FixFirstMode.GRAMMAR_CARD) {
            GrammarFeedbackItemDto primaryGrammarItem = primaryGrammarItem(learnerAnswer, feedback);
            if (primaryGrammarItem == null) {
                return null;
            }
            return new FeedbackPrimaryFixDto(
                    "먼저 고칠 부분",
                    "이 한 군데만 먼저 고치면 문장 흐름이 훨씬 안정돼요.",
                    primaryGrammarItem.originalText(),
                    primaryGrammarItem.revisedText(),
                    primaryGrammarItem.reasonKo()
            );
        }

        if (fixFirstMode == FixFirstMode.TASK_RESET_CARD) {
            return new FeedbackPrimaryFixDto(
                    "먼저 고칠 부분",
                    "질문이 묻는 대상과 이유를 바로 말하는 한 문장부터 써 보세요.",
                    null,
                    null,
                    null
            );
        }

        String primaryIssueCode = primaryIssueCode(answerProfile);
        String instruction;
        if ("ADD_REASON".equals(primaryIssueCode)) {
            instruction = "because를 사용해서 왜 그런지 한 문장으로 이유를 직접 써 보세요.";
        } else if ("ADD_EXAMPLE".equals(primaryIssueCode)) {
            instruction = "짧은 예시를 한 문장 더 붙여 보세요.";
        } else if ("ADD_DETAIL".equals(primaryIssueCode) || "MAKE_IT_MORE_SPECIFIC".equals(primaryIssueCode)) {
            instruction = detailInstruction(prompt);
        } else {
            instruction = "지금 답을 더 선명하게 만들어 줄 정보 한 가지를 추가해 보세요.";
        }
        return new FeedbackPrimaryFixDto("한 가지 더 추가하면 좋아요", instruction, null, null, null);
    }

    private FeedbackPrimaryFixDto alignPrimaryFixWithMode(
            FeedbackPrimaryFixDto primaryFix,
            FixFirstMode fixFirstMode
    ) {
        if (primaryFix == null || fixFirstMode == null || fixFirstMode == FixFirstMode.HIDE) {
            return null;
        }

        String title = firstNonBlank(primaryFix.title(), defaultPrimaryFixTitle(fixFirstMode));
        String instruction = normalizeNullable(primaryFix.instruction());
        String originalText = normalizeNullable(primaryFix.originalText());
        String revisedText = normalizeNullable(primaryFix.revisedText());
        String reasonKo = normalizeNullable(primaryFix.reasonKo());

        if (fixFirstMode == FixFirstMode.GRAMMAR_CARD) {
            if (originalText == null || revisedText == null || reasonKo == null) {
                return null;
            }
            return new FeedbackPrimaryFixDto(title, instruction, originalText, revisedText, reasonKo);
        }

        boolean hasGrammarPair = originalText != null && revisedText != null && reasonKo != null;
        if (instruction == null && !hasGrammarPair) {
            return null;
        }
        if (!hasGrammarPair) {
            FeedbackPrimaryFixDto instructionOnlyPrimaryFix = new FeedbackPrimaryFixDto(title, instruction, null, null, null);
            if (!isConcreteInstructionOnlyPrimaryFix(instructionOnlyPrimaryFix)) {
                return null;
            }
        }

        return new FeedbackPrimaryFixDto(
                title,
                instruction,
                hasGrammarPair ? originalText : null,
                hasGrammarPair ? revisedText : null,
                hasGrammarPair ? reasonKo : null
        );
    }

    private FeedbackPrimaryFixDto uiPrimaryFix(FeedbackUiDto ui) {
        if (ui == null) {
            return null;
        }
        if (ui.fixPoints() != null) {
            for (FeedbackSecondaryLearningPointDto point : ui.fixPoints()) {
                FeedbackPrimaryFixDto derived = toPrimaryFix(point);
                if (derived != null) {
                    return derived;
                }
            }
        }
        return ui.primaryFix();
    }

    private FeedbackPrimaryFixDto toPrimaryFix(FeedbackSecondaryLearningPointDto point) {
        if (point == null || "EXPRESSION".equals(normalizeNullable(point.kind()))) {
            return null;
        }

        String title = normalizeNullable(point.title());
        String headline = normalizeNullable(point.headline());
        String supportText = normalizeNullable(point.supportText());
        String originalText = normalizeNullable(point.originalText());
        String revisedText = normalizeNullable(point.revisedText());
        if (title == null
                && headline == null
                && supportText == null
                && originalText == null
                && revisedText == null) {
            return null;
        }

        return new FeedbackPrimaryFixDto(
                title,
                headline,
                originalText,
                revisedText,
                supportText
        );
    }

    private FeedbackPrimaryFixDto resolvePrimaryFix(
            FeedbackUiDto llmUi,
            ImprovementCandidate primaryCandidate,
            SectionDisplayMode displayMode,
            FixFirstMode fixFirstMode,
            String learnerAnswer,
            FeedbackResponseDto feedback
    ) {
        if (displayMode == SectionDisplayMode.HIDE || fixFirstMode == FixFirstMode.HIDE) {
            return null;
        }
        FeedbackPrimaryFixDto llmPrimaryFix = llmUi == null ? null : alignPrimaryFixWithMode(uiPrimaryFix(llmUi), fixFirstMode);
        if (llmPrimaryFix != null) {
            FeedbackPrimaryFixDto augmentedPrimaryFix = augmentPrimaryFixWithSupportingGrammar(llmPrimaryFix, learnerAnswer, feedback, fixFirstMode);
            return isConcreteInstructionOnlyPrimaryFix(augmentedPrimaryFix) ? augmentedPrimaryFix : null;
        }
        FeedbackPrimaryFixDto fallbackPrimaryFix = primaryCandidate == null ? null : primaryCandidate.primaryFix();
        FeedbackPrimaryFixDto augmentedFallbackPrimaryFix = augmentPrimaryFixWithSupportingGrammar(fallbackPrimaryFix, learnerAnswer, feedback, fixFirstMode);
        return isConcreteInstructionOnlyPrimaryFix(augmentedFallbackPrimaryFix) ? augmentedFallbackPrimaryFix : null;
    }

    private FeedbackPrimaryFixDto augmentPrimaryFixWithSupportingGrammar(
            FeedbackPrimaryFixDto primaryFix,
            String learnerAnswer,
            FeedbackResponseDto feedback,
            FixFirstMode fixFirstMode
    ) {
        if (primaryFix == null || fixFirstMode == null || fixFirstMode == FixFirstMode.HIDE || fixFirstMode == FixFirstMode.GRAMMAR_CARD) {
            return primaryFix;
        }
        if (fixFirstMode != FixFirstMode.DETAIL_PROMPT_CARD) {
            return primaryFix;
        }
        if (normalizeNullable(primaryFix.originalText()) != null
                && normalizeNullable(primaryFix.revisedText()) != null
                && normalizeNullable(primaryFix.reasonKo()) != null) {
            return primaryFix;
        }

        GrammarFeedbackItemDto grammarItem = primaryGrammarItem(learnerAnswer, feedback);
        if (grammarItem == null
                || normalizeNullable(grammarItem.originalText()) == null
                || normalizeNullable(grammarItem.revisedText()) == null
                || normalizeNullable(grammarItem.reasonKo()) == null) {
            return primaryFix;
        }

        return new FeedbackPrimaryFixDto(
                primaryFix.title(),
                primaryFix.instruction(),
                grammarItem.originalText(),
                grammarItem.revisedText(),
                grammarItem.reasonKo()
        );
    }

    private FeedbackNextStepPracticeDto resolveRewritePractice(
            FeedbackUiDto llmUi,
            PromptDto prompt,
            String learnerAnswer,
            FeedbackResponseDto feedback,
            AnswerProfile answerProfile,
            FixFirstMode fixFirstMode,
            RewriteGuideMode rewriteGuideMode,
            FeedbackPrimaryFixDto primaryFix,
            boolean optionalTone
    ) {
        FeedbackNextStepPracticeDto llmRewritePractice = sanitizeLlmNextStepPractice(
                llmUi == null ? null : llmUi.nextStepPractice(),
                prompt,
                answerProfile,
                rewriteGuideMode,
                optionalTone
        );
        if (llmRewritePractice != null) {
            return llmRewritePractice;
        }
        return buildNextStepPractice(
                prompt,
                learnerAnswer,
                feedback,
                answerProfile,
                fixFirstMode,
                rewriteGuideMode,
                primaryFix,
                optionalTone
        );
    }

    private List<FeedbackRewriteSuggestionDto> resolveRewriteSuggestions(
            FeedbackUiDto llmUi,
            FeedbackNextStepPracticeDto nextStepPractice
    ) {
        if (llmUi == null || nextStepPractice == null) {
            return List.of();
        }
        if (llmUi.rewriteSuggestions() == null || llmUi.rewriteSuggestions().isEmpty()) {
            return List.of();
        }

        List<FeedbackRewriteSuggestionDto> suggestions = new ArrayList<>();
        LinkedHashSet<String> seen = new LinkedHashSet<>();
        String practiceHeadline = normalizeNullable(nextStepPractice.headline());
        String practiceExample = normalizeNullable(nextStepPractice.exampleEn());
        String practiceRevised = normalizeNullable(nextStepPractice.revisedText());
        for (FeedbackRewriteSuggestionDto suggestion : llmUi.rewriteSuggestions()) {
            if (suggestion == null) {
                continue;
            }
            String english = normalizeNullable(suggestion.english());
            if (english == null
                    || sameMeaning(english, practiceHeadline)
                    || sameMeaning(english, practiceExample)
                    || sameMeaning(english, practiceRevised)) {
                continue;
            }
            String key = normalizeNullable(english.toLowerCase(Locale.ROOT));
            if (key == null || !seen.add(key)) {
                continue;
            }
            suggestions.add(new FeedbackRewriteSuggestionDto(
                    english,
                    normalizeNullable(suggestion.meaningKo()),
                    normalizeNullable(suggestion.noteKo())
            ));
        }
        return List.copyOf(suggestions);
    }

    private FeedbackNextStepPracticeDto sanitizeLlmNextStepPractice(
            FeedbackNextStepPracticeDto nextStepPractice,
            PromptDto prompt,
            AnswerProfile answerProfile,
            RewriteGuideMode rewriteGuideMode,
            boolean optionalTone
    ) {
        if (nextStepPractice == null) {
            return null;
        }
        String title = normalizeNullable(nextStepPractice.title());
        if (title == null) {
            title = optionalTone ? "\uCD94\uAC00\uD558\uBA74 \uC88B\uC744 \uC810" : "\uB2E4\uC74C\uC5D0 \uB354\uD574 \uBCFC \uC810";
        }
        String headline = normalizeNextStepHeadline(
                firstNonBlank(
                        nextStepPractice.headline(),
                        nextStepPractice.revisedText(),
                        nextStepPractice.exampleEn()
                ),
                prompt,
                answerProfile,
                rewriteGuideMode
        );
        String supportText = firstNonBlank(
                normalizeNullable(nextStepPractice.supportText()),
                normalizeNullable(nextStepPractice.guidanceKo())
        );
        String originalText = normalizeNullable(nextStepPractice.originalText());
        String revisedText = normalizeNullable(nextStepPractice.revisedText());
        if (originalText == null || revisedText == null) {
            originalText = null;
            revisedText = null;
        }
        String meaningKo = normalizeNullable(nextStepPractice.meaningKo());
        String guidanceKo = normalizeNullable(nextStepPractice.guidanceKo());
        String exampleEn = normalizeNextStepBaseHeadline(nextStepPractice.exampleEn());
        String exampleKo = normalizeNullable(nextStepPractice.exampleKo());
        if (headline == null && supportText == null && revisedText == null && exampleEn == null) {
            return null;
        }
        if (supportText == null) {
            supportText = buildNextStepSupportText(prompt, answerProfile, rewriteGuideMode, optionalTone);
        }
        return new FeedbackNextStepPracticeDto(
                normalizeNullable(nextStepPractice.kind()),
                title,
                headline,
                supportText,
                originalText,
                revisedText,
                meaningKo,
                guidanceKo,
                exampleEn,
                exampleKo,
                normalizeNullable(nextStepPractice.ctaLabel()),
                optionalTone || nextStepPractice.optionalTone()
        );
    }

    private String defaultPrimaryFixTitle(FixFirstMode fixFirstMode) {
        return switch (fixFirstMode) {
            case GRAMMAR_CARD, TASK_RESET_CARD -> "癒쇱? 怨좎튌 遺遺?";
            case DETAIL_PROMPT_CARD -> "??媛吏 ??異붽??섎㈃ 醫뗭븘??";
            case HIDE -> "癒쇱? 怨좎튌 遺遺?";
        };
    }

    private FeedbackMicroTipDto buildMicroTip(
            String learnerAnswer,
            FeedbackResponseDto feedback,
            FixFirstMode fixFirstMode
    ) {
        if (fixFirstMode == FixFirstMode.GRAMMAR_CARD) {
            return null;
        }

        GrammarFeedbackItemDto grammarItem = primaryGrammarItem(learnerAnswer, feedback);
        if (grammarItem == null) {
            return null;
        }

        if (normalizeNullable(grammarItem.originalText()) == null
                || normalizeNullable(grammarItem.revisedText()) == null
                || normalizeNullable(grammarItem.reasonKo()) == null) {
            return null;
        }

        return new FeedbackMicroTipDto(
                "작은 표현 다듬기",
                grammarItem.originalText(),
                grammarItem.revisedText(),
                grammarItem.reasonKo()
        );
    }

    private List<FeedbackSecondaryLearningPointDto> buildSecondaryLearningPoints(
            String learnerAnswer,
            FeedbackResponseDto feedback,
            FeedbackPrimaryFixDto primaryFix,
            FixFirstMode fixFirstMode
    ) {
        if (feedback == null) {
            return List.of();
        }

        List<FeedbackSecondaryLearningPointDto> points = new ArrayList<>();
        LinkedHashSet<String> seen = new LinkedHashSet<>();
        GrammarFeedbackItemDto mainGrammarItem = primaryGrammarItem(learnerAnswer, feedback);
        boolean primaryFixUsesGrammar = fixFirstMode == FixFirstMode.GRAMMAR_CARD
                && primaryFix != null
                && normalizeNullable(primaryFix.originalText()) != null
                && normalizeNullable(primaryFix.revisedText()) != null;

        if (!primaryFixUsesGrammar && mainGrammarItem != null) {
            addSecondaryGrammarPoint(points, seen, mainGrammarItem);
        }

        if (feedback.grammarFeedback() != null) {
            for (GrammarFeedbackItemDto grammarItem : feedback.grammarFeedback()) {
                if (grammarItem == null) {
                    continue;
                }
                if (mainGrammarItem != null
                        && sameMeaning(grammarItem.originalText(), mainGrammarItem.originalText())
                        && sameMeaning(grammarItem.revisedText(), mainGrammarItem.revisedText())) {
                    continue;
                }
                addSecondaryGrammarPoint(points, seen, grammarItem);
            }
        }

        if (feedback.corrections() != null) {
            for (CorrectionDto correction : feedback.corrections()) {
                addSecondaryCorrectionPoint(points, seen, correction);
            }
        }

        if (feedback.refinementExpressions() != null) {
            for (RefinementExpressionDto expression : feedback.refinementExpressions()) {
                addSecondaryRefinementPoint(points, seen, expression);
            }
        }

        return List.copyOf(points);
    }

    private void addSecondaryGrammarPoint(
            List<FeedbackSecondaryLearningPointDto> points,
            LinkedHashSet<String> seen,
            GrammarFeedbackItemDto grammarItem
    ) {
        if (grammarItem == null) {
            return;
        }
        String originalText = normalizeNullable(grammarItem.originalText());
        String revisedText = normalizeNullable(grammarItem.revisedText());
        String reasonKo = normalizeNullable(grammarItem.reasonKo());
        if (originalText == null || revisedText == null || reasonKo == null) {
            return;
        }
        addSecondaryPoint(
                points,
                seen,
                new FeedbackSecondaryLearningPointDto(
                        "GRAMMAR",
                        "작은 표현 다듬기",
                        null,
                        reasonKo,
                        originalText,
                        revisedText,
                        null,
                        null,
                        null,
                        null
                )
        );
    }

    private void addSecondaryCorrectionPoint(
            List<FeedbackSecondaryLearningPointDto> points,
            LinkedHashSet<String> seen,
            CorrectionDto correction
    ) {
        if (correction == null) {
            return;
        }
        String issue = normalizeNullable(correction.issue());
        String suggestion = normalizeNullable(correction.suggestion());
        if (issue == null || suggestion == null) {
            return;
        }
        addSecondaryPoint(
                points,
                seen,
                new FeedbackSecondaryLearningPointDto(
                        "CORRECTION",
                        "보조 학습 포인트",
                        issue,
                        suggestion,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null
                )
        );
    }

    private void addSecondaryRefinementPoint(
            List<FeedbackSecondaryLearningPointDto> points,
            LinkedHashSet<String> seen,
            RefinementExpressionDto expression
    ) {
        if (!isDisplayableRefinement(expression)) {
            return;
        }
        String headline = normalizeNullable(expression.expression());
        if (headline == null) {
            return;
        }
        addSecondaryPoint(
                points,
                seen,
                new FeedbackSecondaryLearningPointDto(
                        "EXPRESSION",
                        "써보면 좋은 표현",
                        headline,
                        null,
                        null,
                        null,
                        normalizeNullable(expression.meaningKo()),
                        normalizeNullable(expression.guidanceKo()),
                        normalizeNullable(expression.exampleEn()),
                        normalizeNullable(expression.exampleKo())
                )
        );
    }

    private void addSecondaryPoint(
            List<FeedbackSecondaryLearningPointDto> points,
            LinkedHashSet<String> seen,
            FeedbackSecondaryLearningPointDto point
    ) {
        if (point == null) {
            return;
        }
        String key = normalize(
                firstNonBlank(point.kind(), "")
                        + "|" + firstNonBlank(point.headline(), "")
                        + "|" + firstNonBlank(point.supportText(), "")
                        + "|" + firstNonBlank(point.originalText(), "")
                        + "|" + firstNonBlank(point.revisedText(), "")
                        + "|" + firstNonBlank(point.exampleEn(), "")
        );
        if (key.isBlank() || !seen.add(key)) {
            return;
        }
        points.add(point);
    }

    private List<FeedbackSecondaryLearningPointDto> resolveSecondaryLearningPoints(
            FeedbackUiDto llmUi,
            FeedbackPrimaryFixDto primaryFix,
            List<ImprovementCandidate> rankedCandidates
    ) {
        List<FeedbackSecondaryLearningPointDto> llmPoints = sanitizeLlmSecondaryLearningPoints(
                llmUi == null ? null : llmUi.secondaryLearningPoints(),
                primaryFix
        );
        if (!llmPoints.isEmpty()) {
            return llmPoints;
        }
        return buildSecondaryLearningPoints(primaryFix, rankedCandidates);
    }

    private List<FeedbackSecondaryLearningPointDto> buildFixPoints(
            FeedbackPrimaryFixDto primaryFix,
            List<FeedbackSecondaryLearningPointDto> secondaryLearningPoints
    ) {
        List<FeedbackSecondaryLearningPointDto> points = new ArrayList<>();
        LinkedHashSet<String> seen = new LinkedHashSet<>();

        FeedbackSecondaryLearningPointDto primaryFixPoint = toFixPoint(primaryFix);
        if (primaryFixPoint != null) {
            addSecondaryPoint(points, seen, primaryFixPoint);
        }

        if (secondaryLearningPoints != null) {
            for (FeedbackSecondaryLearningPointDto point : secondaryLearningPoints) {
                if (point == null || "EXPRESSION".equals(normalizeNullable(point.kind()))) {
                    continue;
                }
                addSecondaryPoint(points, seen, point);
            }
        }

        return List.copyOf(points);
    }

    private FeedbackSecondaryLearningPointDto toFixPoint(FeedbackPrimaryFixDto primaryFix) {
        if (primaryFix == null) {
            return null;
        }

        String title = normalizeNullable(primaryFix.title());
        String instruction = normalizeNullable(primaryFix.instruction());
        String originalText = normalizeNullable(primaryFix.originalText());
        String revisedText = normalizeNullable(primaryFix.revisedText());
        String reasonKo = normalizeNullable(primaryFix.reasonKo());

        if (title == null
                && instruction == null
                && originalText == null
                && revisedText == null
                && reasonKo == null) {
            return null;
        }

        String kind = originalText != null && revisedText != null ? "GRAMMAR" : "CORRECTION";
        return new FeedbackSecondaryLearningPointDto(
                kind,
                title,
                instruction,
                reasonKo,
                originalText,
                revisedText,
                null,
                null,
                null,
                null
        );
    }

    private List<FeedbackSecondaryLearningPointDto> sanitizeLlmSecondaryLearningPoints(
            List<FeedbackSecondaryLearningPointDto> points,
            FeedbackPrimaryFixDto primaryFix
    ) {
        if (points == null || points.isEmpty()) {
            return List.of();
        }
        List<FeedbackSecondaryLearningPointDto> sanitized = new ArrayList<>();
        LinkedHashSet<String> seen = new LinkedHashSet<>();
        for (FeedbackSecondaryLearningPointDto point : points) {
            if (point == null) {
                continue;
            }
            FeedbackSecondaryLearningPointDto cleaned = new FeedbackSecondaryLearningPointDto(
                    normalizeNullable(point.kind()),
                    normalizeNullable(point.title()),
                    normalizeNullable(point.headline()),
                    normalizeNullable(point.supportText()),
                    normalizeNullable(point.originalText()),
                    normalizeNullable(point.revisedText()),
                    normalizeNullable(point.meaningKo()),
                    normalizeNullable(point.guidanceKo()),
                    normalizeNullable(point.exampleEn()),
                    normalizeNullable(point.exampleKo())
            );
            if (firstNonBlank(
                    cleaned.headline(),
                    cleaned.supportText(),
                    cleaned.originalText(),
                    cleaned.revisedText(),
                    cleaned.exampleEn()
            ) == null) {
                continue;
            }
            if (isSecondaryPointCoveredByPrimaryFix(cleaned, primaryFix)) {
                continue;
            }
            addSecondaryPoint(sanitized, seen, cleaned);
        }
        return List.copyOf(sanitized);
    }

    private List<FeedbackSecondaryLearningPointDto> buildSecondaryLearningPoints(
            FeedbackPrimaryFixDto primaryFix,
            List<ImprovementCandidate> rankedCandidates
    ) {
        if (rankedCandidates == null || rankedCandidates.isEmpty()) {
            return List.of();
        }

        List<FeedbackSecondaryLearningPointDto> points = new ArrayList<>();
        LinkedHashSet<String> seen = new LinkedHashSet<>();
        for (ImprovementCandidate candidate : rankedCandidates) {
            FeedbackSecondaryLearningPointDto point = candidate.secondaryPoint();
            if (point == null) {
                continue;
            }
            if (isSecondaryPointCoveredByPrimaryFix(point, primaryFix)) {
                continue;
            }
            addSecondaryPoint(points, seen, point);
        }
        return List.copyOf(points);
    }

    private FeedbackSecondaryLearningPointDto toGrammarSecondaryPoint(GrammarFeedbackItemDto grammarItem) {
        if (grammarItem == null) {
            return null;
        }
        String originalText = normalizeNullable(grammarItem.originalText());
        String revisedText = normalizeNullable(grammarItem.revisedText());
        String reasonKo = normalizeNullable(grammarItem.reasonKo());
        if (originalText == null || revisedText == null || reasonKo == null) {
            return null;
        }
        return new FeedbackSecondaryLearningPointDto(
                "GRAMMAR",
                "작은 표현 다듬기",
                null,
                reasonKo,
                originalText,
                revisedText,
                null,
                null,
                null,
                null
        );
    }

    private FeedbackSecondaryLearningPointDto toCorrectionSecondaryPoint(CorrectionDto correction) {
        if (correction == null) {
            return null;
        }
        String issue = normalizeNullable(correction.issue());
        String suggestion = normalizeNullable(correction.suggestion());
        if (issue == null || suggestion == null) {
            return null;
        }
        return new FeedbackSecondaryLearningPointDto(
                "CORRECTION",
                "보조 학습 포인트",
                issue,
                suggestion,
                null,
                null,
                null,
                null,
                null,
                null
        );
    }

    private FeedbackSecondaryLearningPointDto toRefinementSecondaryPoint(RefinementExpressionDto expression) {
        if (!isDisplayableRefinement(expression)) {
            return null;
        }
        String headline = normalizeNullable(expression.expression());
        if (headline == null) {
            return null;
        }
        return new FeedbackSecondaryLearningPointDto(
                "EXPRESSION",
                "써보면 좋은 표현",
                headline,
                null,
                null,
                null,
                normalizeNullable(expression.meaningKo()),
                normalizeNullable(expression.guidanceKo()),
                normalizeNullable(expression.exampleEn()),
                normalizeNullable(expression.exampleKo())
        );
    }

    private void addImprovementCandidate(
            List<ImprovementCandidate> candidates,
            LinkedHashSet<String> seen,
            ImprovementCandidate candidate
    ) {
        if (candidate == null || candidate.key().isBlank() || !seen.add(candidate.key())) {
            return;
        }
        candidates.add(candidate);
    }

    private int scorePrimaryFixCandidate(
            FeedbackPrimaryFixDto primaryFix,
            FixFirstMode fixFirstMode,
            AnswerProfile answerProfile,
            boolean llmSupplied
    ) {
        int blockingImpact = switch (fixFirstMode) {
            case GRAMMAR_CARD -> 5;
            case TASK_RESET_CARD -> 4;
            case DETAIL_PROMPT_CARD -> 3;
            case HIDE -> 0;
        };
        int taskCoverageGain = switch (primaryIssueCode(answerProfile)) {
            case "ADD_REASON", "ADD_EXAMPLE", "ADD_DETAIL", "MAKE_IT_MORE_SPECIFIC", "STATE_MAIN_ANSWER", "MAKE_ON_TOPIC" -> 4;
            default -> taskCompletion(answerProfile) == TaskCompletion.FULL ? 1 : 3;
        };
        int rewriteLeverage = fixFirstMode == FixFirstMode.GRAMMAR_CARD ? 4 : 3;
        int naturalnessGain = fixFirstMode == FixFirstMode.DETAIL_PROMPT_CARD ? 1 : 0;
        int locality = countTokens(firstNonBlank(primaryFix.originalText(), primaryFix.instruction())) <= 8 ? 2 : 1;
        int llmBonus = llmSupplied ? 2 : 0;
        return 4 * blockingImpact
                + 3 * taskCoverageGain
                + 3 * rewriteLeverage
                + 2 * naturalnessGain
                + locality
                + llmBonus;
    }

    private int scoreGrammarCandidate(GrammarFeedbackItemDto grammarItem, AnswerProfile answerProfile) {
        int blockingImpact = switch (grammarSeverity(answerProfile)) {
            case MAJOR -> 5;
            case MODERATE -> 4;
            case MINOR -> 2;
            case NONE -> 1;
        };
        if (answerBand(answerProfile) == AnswerBand.GRAMMAR_BLOCKING) {
            blockingImpact += 1;
        }
        int taskCoverageGain = taskCompletion(answerProfile) == TaskCompletion.FULL ? 0 : 1;
        int rewriteLeverage = 4;
        int naturalnessGain = 1;
        int locality = countTokens(grammarItem.originalText()) <= 6 ? 2 : 1;
        return 4 * blockingImpact
                + 3 * taskCoverageGain
                + 3 * rewriteLeverage
                + 2 * naturalnessGain
                + locality;
    }

    private int scoreCorrectionCandidate(CorrectionDto correction, AnswerProfile answerProfile) {
        int taskCoverageGain = taskCoverageSignal(
                primaryIssueCode(answerProfile),
                firstNonBlank(correction.issue(), correction.suggestion())
        );
        int rewriteLeverage = rewriteLeverageSignal(correction.suggestion());
        int naturalnessGain = 3;
        int locality = countTokens(correction.issue()) <= 8 ? 2 : 1;
        return 3 * taskCoverageGain
                + 3 * rewriteLeverage
                + 2 * naturalnessGain
                + locality;
    }

    private int scoreExpressionCandidate(RefinementExpressionDto expression, AnswerProfile answerProfile) {
        int taskCoverageGain = taskCoverageSignal(
                primaryIssueCode(answerProfile),
                firstNonBlank(expression.guidanceKo(), expression.exampleEn(), expression.expression())
        );
        int rewriteLeverage = expression.type() == RefinementExpressionType.FRAME ? 2 : 1;
        int naturalnessGain = 2;
        return 3 * taskCoverageGain
                + 3 * rewriteLeverage
                + 2 * naturalnessGain
                + 1;
    }

    private boolean isSecondaryPointCoveredByPrimaryFix(
            FeedbackSecondaryLearningPointDto point,
            FeedbackPrimaryFixDto primaryFix
    ) {
        if (point == null || primaryFix == null) {
            return false;
        }

        String primaryOriginal = normalizeNullable(primaryFix.originalText());
        String primaryRevised = normalizeNullable(primaryFix.revisedText());

        if ("GRAMMAR".equals(point.kind())
                && primaryOriginal != null
                && primaryRevised != null) {
            return isCoveredTextPair(point.originalText(), point.revisedText(), primaryOriginal, primaryRevised);
        }

        return hasAnchorLevelOverlap(point, primaryFix);
    }

    private boolean hasAnchorLevelOverlap(
            FeedbackSecondaryLearningPointDto point,
            FeedbackPrimaryFixDto primaryFix
    ) {
        LinkedHashSet<String> anchors = extractPrimaryFixAnchors(primaryFix);
        if (anchors.isEmpty()) {
            return hasAddedTokenOverlap(point, primaryFix);
        }
        return pointMentionsAnyAnchor(point, anchors) || hasAddedTokenOverlap(point, primaryFix);
    }

    private LinkedHashSet<String> extractPrimaryFixAnchors(FeedbackPrimaryFixDto primaryFix) {
        LinkedHashSet<String> anchors = new LinkedHashSet<>();
        addQuotedAnchors(anchors, primaryFix.title());
        addQuotedAnchors(anchors, primaryFix.instruction());
        addEnglishAnchors(anchors, primaryFix.title());
        addEnglishAnchors(anchors, primaryFix.instruction());
        addAnchorIfUseful(anchors, primaryFix.originalText());
        addAnchorIfUseful(anchors, primaryFix.revisedText());
        return anchors;
    }

    private void addQuotedAnchors(LinkedHashSet<String> anchors, String text) {
        String value = normalizeNullable(text);
        if (value == null) {
            return;
        }
        var matcher = QUOTED_ANCHOR_PATTERN.matcher(value);
        while (matcher.find()) {
            addAnchorIfUseful(anchors, matcher.group(1));
        }
    }

    private void addEnglishAnchors(LinkedHashSet<String> anchors, String text) {
        String value = normalizeNullable(text);
        if (value == null) {
            return;
        }
        var matcher = ENGLISH_ANCHOR_PATTERN.matcher(value);
        while (matcher.find()) {
            addAnchorIfUseful(anchors, matcher.group());
        }
    }

    private void addAnchorIfUseful(LinkedHashSet<String> anchors, String candidate) {
        String normalized = normalizeForSpanCompare(candidate);
        if (normalized.isBlank()) {
            return;
        }
        boolean hasLetters = normalized.chars().anyMatch(Character::isLetter);
        boolean multiToken = normalized.contains(" ");
        if (hasLetters && (multiToken || normalized.length() >= 10 || SHORT_GRAMMAR_ANCHORS.contains(normalized))) {
            anchors.add(normalized);
        }
    }

    private boolean pointMentionsAnyAnchor(
            FeedbackSecondaryLearningPointDto point,
            LinkedHashSet<String> anchors
    ) {
        if (point == null || anchors == null || anchors.isEmpty()) {
            return false;
        }
        List<String> candidateTexts = new ArrayList<>();
        candidateTexts.add(normalizeNullable(point.headline()));
        candidateTexts.add(normalizeNullable(point.supportText()));
        candidateTexts.add(normalizeNullable(point.originalText()));
        candidateTexts.add(normalizeNullable(point.revisedText()));
        candidateTexts.add(normalizeNullable(point.guidanceKo()));
        candidateTexts.add(normalizeNullable(point.exampleEn()));
        for (String candidate : candidateTexts) {
            String normalizedCandidate = normalizeForSpanCompare(candidate);
            if (normalizedCandidate.isBlank()) {
                continue;
            }
            for (String anchor : anchors) {
                if (normalizedCandidate.contains(anchor)) {
                    return true;
                }
            }
        }
        return false;
    }

    private boolean hasAddedTokenOverlap(
            FeedbackSecondaryLearningPointDto point,
            FeedbackPrimaryFixDto primaryFix
    ) {
        if (point == null || primaryFix == null) {
            return false;
        }
        String primaryOriginal = normalizeNullable(primaryFix.originalText());
        String primaryRevised = normalizeNullable(primaryFix.revisedText());
        if (primaryOriginal == null || primaryRevised == null) {
            return false;
        }

        LinkedHashSet<String> addedTokens = extractAddedTokens(primaryOriginal, primaryRevised);
        if (addedTokens.isEmpty()) {
            return false;
        }

        String pointText = normalizeForSpanCompare(String.join(" ",
                firstNonBlank(point.title(), ""),
                firstNonBlank(point.headline(), ""),
                firstNonBlank(point.supportText(), ""),
                firstNonBlank(point.guidanceKo(), ""),
                firstNonBlank(point.exampleEn(), "")
        ));
        if (pointText.isBlank() || !containsAnyToken(pointText, addedTokens)) {
            return false;
        }

        return containsAnyCue(pointText, GRAMMAR_OVERLAP_CUES);
    }

    private LinkedHashSet<String> extractAddedTokens(String originalText, String revisedText) {
        LinkedHashSet<String> added = new LinkedHashSet<>();
        LinkedHashSet<String> originalTokens = new LinkedHashSet<>(Arrays.asList(normalizeForSpanCompare(originalText).split(" ")));
        LinkedHashSet<String> revisedTokens = new LinkedHashSet<>(Arrays.asList(normalizeForSpanCompare(revisedText).split(" ")));
        for (String token : revisedTokens) {
            if (token == null || token.isBlank() || originalTokens.contains(token)) {
                continue;
            }
            if (token.length() >= 4 || SHORT_GRAMMAR_ANCHORS.contains(token)) {
                added.add(token);
            }
        }
        return added;
    }

    private boolean containsAnyToken(String text, Set<String> tokens) {
        if (text == null || text.isBlank() || tokens == null || tokens.isEmpty()) {
            return false;
        }
        for (String token : tokens) {
            if (token != null && !token.isBlank() && text.contains(token)) {
                return true;
            }
        }
        return false;
    }

    private boolean containsAnyCue(String text, Set<String> cues) {
        if (text == null || text.isBlank() || cues == null || cues.isEmpty()) {
            return false;
        }
        for (String cue : cues) {
            if (cue != null && !cue.isBlank() && text.contains(normalizeForSpanCompare(cue))) {
                return true;
            }
        }
        return false;
    }

    private boolean isConcreteInstructionOnlyPrimaryFix(FeedbackPrimaryFixDto primaryFix) {
        if (primaryFix == null) {
            return false;
        }
        if (normalizeNullable(primaryFix.originalText()) != null
                && normalizeNullable(primaryFix.revisedText()) != null
                && normalizeNullable(primaryFix.reasonKo()) != null) {
            return true;
        }

        String instruction = normalizeNullable(primaryFix.instruction());
        if (instruction == null || isGenericPrimaryFixInstruction(instruction)) {
            return false;
        }
        return !extractPrimaryFixAnchors(primaryFix).isEmpty();
    }

    private boolean isGenericPrimaryFixInstruction(String instruction) {
        String normalizedInstruction = normalizeForSpanCompare(instruction);
        if (normalizedInstruction.isBlank()) {
            return true;
        }
        return normalizedInstruction.contains("이 한 군데만 먼저 고치면")
                || normalizedInstruction.contains("문장 흐름이 훨씬 안정돼요")
                || normalizedInstruction.contains("한 가지를 더 추가하면 좋아요")
                || normalizedInstruction.contains("정보 한 가지를 추가해 보세요")
                || normalizedInstruction.contains("문장 하나를 더 써 보세요")
                || normalizedInstruction.contains("먼저 고칠 부분");
    }

    private boolean isCoveredTextPair(
            String candidateOriginal,
            String candidateRevised,
            String primaryOriginal,
            String primaryRevised
    ) {
        return !normalizeForSpanCompare(candidateOriginal).isBlank()
                && !normalizeForSpanCompare(candidateRevised).isBlank()
                && (sameMeaning(candidateOriginal, primaryOriginal)
                || containsNormalizedSpan(primaryOriginal, candidateOriginal))
                && (sameMeaning(candidateRevised, primaryRevised)
                || containsNormalizedSpan(primaryRevised, candidateRevised));
    }

    private boolean containsNormalizedSpan(String container, String fragment) {
        String normalizedContainer = normalizeForSpanCompare(container);
        String normalizedFragment = normalizeForSpanCompare(fragment);
        return !normalizedContainer.isBlank()
                && !normalizedFragment.isBlank()
                && normalizedContainer.contains(normalizedFragment);
    }

    private int taskCoverageSignal(String primaryIssueCode, String text) {
        String normalizedIssue = normalize(primaryIssueCode);
        String normalizedText = normalize(text);
        if ("add_reason".equals(normalizedIssue) || normalizedText.contains("because")) {
            return 4;
        }
        if ("add_example".equals(normalizedIssue) || normalizedText.contains("for example")) {
            return 3;
        }
        if ("add_detail".equals(normalizedIssue) || "make_it_more_specific".equals(normalizedIssue)) {
            return 3;
        }
        if ("make_on_topic".equals(normalizedIssue) || "state_main_answer".equals(normalizedIssue)) {
            return 4;
        }
        return 1;
    }

    private int rewriteLeverageSignal(String text) {
        String normalizedText = normalize(text);
        if (normalizedText.contains("because")
                || normalizedText.contains("for example")
                || normalizedText.contains("i ")
                || normalizedText.contains("my ")
                || normalizedText.contains("you ")) {
            return 3;
        }
        return 2;
    }

    private int kindPriority(ImprovementCandidateKind kind) {
        return switch (kind) {
            case PRIMARY_FIX -> 0;
            case GRAMMAR -> 1;
            case CORRECTION -> 2;
            case EXPRESSION -> 3;
        };
    }

    private String candidateKey(String prefix, String... values) {
        return prefix + "|" + normalize(firstNonBlank(values));
    }

    private int countTokens(String value) {
        String normalized = normalizeNullable(value);
        if (normalized == null) {
            return 0;
        }
        return normalized.split("\\s+").length;
    }

    private FeedbackNextStepPracticeDto buildNextStepPractice(
            PromptDto prompt,
            String learnerAnswer,
            FeedbackResponseDto feedback,
            AnswerProfile answerProfile,
            FixFirstMode fixFirstMode,
            RewriteGuideMode rewriteGuideMode,
            FeedbackPrimaryFixDto primaryFix,
            boolean optionalTone
    ) {
        RewriteTarget target = answerProfile == null || answerProfile.rewrite() == null
                ? null
                : answerProfile.rewrite().target();

        String correctedBase = firstNonBlank(
                primaryFix == null ? null : primaryFix.revisedText(),
                answerProfile == null || answerProfile.grammar() == null ? null : answerProfile.grammar().minimalCorrection(),
                feedback == null ? null : feedback.correctedAnswer(),
                learnerAnswer
        );
        String derivedHeadline = normalizeNextStepHeadline(
                deriveStarter(prompt, learnerAnswer, feedback, answerProfile, fixFirstMode, rewriteGuideMode, primaryFix),
                prompt,
                answerProfile,
                rewriteGuideMode
        );
        String exampleEn = derivedHeadline == null
                ? normalizeNextStepBaseHeadline(firstNonBlank(target == null ? null : target.skeleton(), correctedBase))
                : null;

        if (derivedHeadline == null && exampleEn == null && !shouldBuildFallbackNextStepPractice(answerProfile, fixFirstMode)) {
            return null;
        }

        return new FeedbackNextStepPracticeDto(
                "NEXT_STEP",
                optionalTone ? "\uCD94\uAC00\uD558\uBA74 \uC88B\uC744 \uC810" : "\uB2E4\uC74C\uC5D0 \uB354\uD574 \uBCFC \uC810",
                derivedHeadline,
                buildNextStepSupportText(prompt, answerProfile, rewriteGuideMode, optionalTone),
                null,
                null,
                null,
                null,
                exampleEn,
                null,
                START_REWRITE_CTA_LABEL,
                optionalTone
        );
    }

    private FeedbackLoopStatusDto buildLoopStatus(
            FeedbackResponseDto feedback,
            CompletionState completionState,
            FeedbackScreenPolicy screenPolicy
    ) {
        String completionMessage = feedback == null ? null : normalizeNullable(feedback.completionMessage());
        return switch (completionState) {
            case OPTIONAL_POLISH -> new FeedbackLoopStatusDto(
                    null,
                    sanitizeLoopStatusHeadline(completionMessage, "지금도 충분히 좋아요."),
                    null,
                    "한 번 더 다듬기",
                    screenPolicy.showFinishCta() ? "오늘 루프 완료하고 도장 받기" : null,
                    screenPolicy.showCancelCta() ? "답변 취소" : null
            );
            case CAN_FINISH -> new FeedbackLoopStatusDto(
                    null,
                    sanitizeLoopStatusHeadline(completionMessage, "지금 단계에서는 마무리 가능해요."),
                    null,
                    "다시 써보기",
                    screenPolicy.showFinishCta() ? "오늘 루프 완료하고 도장 받기" : null,
                    screenPolicy.showCancelCta() ? "답변 취소" : null
            );
            case NEEDS_REVISION -> new FeedbackLoopStatusDto(
                    "다시 써보기 추천",
                    "지금은 한 가지만 먼저 고쳐서 다시 써 보세요.",
                    "위 starter를 바탕으로 바로 다시 써 볼 수 있어요.",
                    "다시 써보기",
                    null,
                    screenPolicy.showCancelCta() ? "답변 취소" : null
            );
        };
    }

    private String sanitizeLoopStatusHeadline(String completionMessage, String fallbackHeadline) {
        String normalized = normalizeNullable(completionMessage);
        if (normalized == null) {
            return fallbackHeadline;
        }

        String[] sentences = normalized.split("(?<=[.!?])\\s+");
        for (String sentence : sentences) {
            String candidate = normalizeNullable(sentence);
            if (candidate == null) {
                continue;
            }
            if (candidate.contains("원하면") || candidate.contains("다듬")) {
                continue;
            }
            return candidate;
        }

        return fallbackHeadline;
    }

    private FeedbackScreenPolicyDto toDto(FeedbackScreenPolicy screenPolicy) {
        if (screenPolicy == null) {
            return new FeedbackScreenPolicyDto(
                    CompletionState.NEEDS_REVISION.name(),
                    DEFAULT_SECTION_ORDER,
                    SectionDisplayMode.HIDE.name(),
                    SectionDisplayMode.HIDE.name(),
                    SectionDisplayMode.SHOW_EXPANDED.name(),
                    RewriteGuideMode.DETAIL_SCAFFOLD.name(),
                    ModelAnswerDisplayMode.HIDE.name(),
                    RefinementDisplayMode.HIDE.name(),
                    1,
                    2,
                    0,
                    false,
                    true,
                    true
            );
        }

        return new FeedbackScreenPolicyDto(
                screenPolicy.completionState().name(),
                screenPolicy.sectionOrder().stream().map(Enum::name).toList(),
                screenPolicy.keepWhatWorksDisplayMode().name(),
                screenPolicy.fixFirstDisplayMode().name(),
                screenPolicy.rewriteGuideDisplayMode().name(),
                screenPolicy.rewriteGuideMode().name(),
                screenPolicy.modelAnswerDisplayMode().name(),
                screenPolicy.refinementDisplayMode().name(),
                screenPolicy.keepWhatWorksMaxItems(),
                screenPolicy.keepExpressionChipMaxItems(),
                screenPolicy.refinementMaxCards(),
                screenPolicy.showFinishCta(),
                screenPolicy.showRewriteCta(),
                screenPolicy.showCancelCta()
        );
    }

    private GrammarFeedbackItemDto primaryGrammarItem(String learnerAnswer, FeedbackResponseDto feedback) {
        if (feedback == null || feedback.grammarFeedback() == null || feedback.grammarFeedback().isEmpty()) {
            return null;
        }
        GrammarFeedbackItemDto item = feedback.grammarFeedback().get(0);
        if (item == null) {
            return null;
        }
        if (isPunctuationOnlyEdit(item)) {
            return new GrammarFeedbackItemDto(
                    normalizeSentence(learnerAnswer),
                    normalizeSentence(firstNonBlank(feedback.correctedAnswer(), learnerAnswer)),
                    item.reasonKo()
            );
        }
        return item;
    }

    private boolean isPunctuationOnlyEdit(GrammarFeedbackItemDto item) {
        String original = normalizeNullable(item.originalText());
        String revised = normalizeNullable(item.revisedText());
        return (original == null && revised != null && PUNCTUATION_ONLY_PATTERN.matcher(revised).matches())
                || (revised == null && original != null && PUNCTUATION_ONLY_PATTERN.matcher(original).matches());
    }

    private String deriveStarter(
            PromptDto prompt,
            String learnerAnswer,
            FeedbackResponseDto feedback,
            AnswerProfile answerProfile,
            FixFirstMode fixFirstMode,
            RewriteGuideMode rewriteGuideMode,
            FeedbackPrimaryFixDto primaryFix
    ) {
        RewriteTarget target = answerProfile == null || answerProfile.rewrite() == null
                ? null
                : answerProfile.rewrite().target();
        String action = target == null ? "" : target.action();
        String correctedBase = firstNonBlank(
                primaryFix == null ? null : primaryFix.revisedText(),
                answerProfile == null || answerProfile.grammar() == null ? null : answerProfile.grammar().minimalCorrection(),
                feedback == null ? null : feedback.correctedAnswer(),
                learnerAnswer
        );

        if (fixFirstMode == FixFirstMode.GRAMMAR_CARD && rewriteGuideMode != RewriteGuideMode.OPTIONAL_POLISH) {
            return grammarFirstStarter(prompt, correctedBase, target, action);
        }

        if (rewriteGuideMode == null) {
            return firstNonBlank(target == null ? null : target.skeleton(), correctedBase, promptBasedStarter(prompt, action));
        }

        return switch (rewriteGuideMode) {
            case FRAGMENT_SCAFFOLD, TASK_RESET -> promptBasedStarter(prompt, action);
            case CORRECTED_SKELETON -> correctedScaffoldStarter(prompt, correctedBase, target, action);
            case OPTIONAL_POLISH -> optionalPolishStarter(prompt, correctedBase);
            case DETAIL_SCAFFOLD -> detailStarter(prompt, correctedBase, target, action);
        };
    }

    private String grammarFirstStarter(PromptDto prompt, String correctedBase, RewriteTarget target, String action) {
        String anchoredSkeleton = anchorGrammarStarterToCorrectedBase(prompt, correctedBase, target, action);
        return switch (action) {
            case "ADD_REASON" -> firstNonBlank(anchoredSkeleton, appendBlankReason(correctedBase), promptBasedStarter(prompt, action));
            case "ADD_EXAMPLE" -> firstNonBlank(anchoredSkeleton, appendBlankExample(correctedBase), promptBasedStarter(prompt, action));
            case "ADD_DETAIL", "MAKE_IT_MORE_SPECIFIC" -> firstNonBlank(
                    anchoredSkeleton,
                    promptAwareBlankStarter(prompt, correctedBase, action),
                    promptBasedStarter(prompt, action)
            );
            default -> firstNonBlank(anchoredSkeleton, promptAwareBlankStarter(prompt, correctedBase, action), promptBasedStarter(prompt, action));
        };
    }

    private String anchorGrammarStarterToCorrectedBase(PromptDto prompt, String correctedBase, RewriteTarget target, String action) {
        String skeleton = target == null ? null : normalizeNullable(target.skeleton());
        String corrected = normalizeNullable(correctedBase);
        if (skeleton == null || corrected == null) {
            return skeleton == null ? promptAwareBlankStarter(prompt, corrected, action) : skeleton;
        }
        String normalizedSkeleton = normalize(trimSentenceEnding(skeleton));
        String normalizedSkeletonAnchor = normalize(trimSentenceEnding(skeleton.replace("______", " ")));
        String normalizedCorrected = normalize(trimSentenceEnding(corrected));
        if (normalizedCorrected.isBlank()
                || normalizedSkeleton.contains(normalizedCorrected)
                || (!normalizedSkeletonAnchor.isBlank() && normalizedCorrected.contains(normalizedSkeletonAnchor))) {
            return skeleton;
        }
        return switch (action) {
            case "ADD_REASON" -> appendBlankReason(corrected);
            case "ADD_EXAMPLE" -> appendBlankExample(corrected);
            case "ADD_DETAIL", "MAKE_IT_MORE_SPECIFIC" -> promptAwareBlankStarter(prompt, corrected, action);
            default -> promptAwareBlankStarter(prompt, corrected, action);
        };
    }

    private String detailStarter(PromptDto prompt, String correctedBase, RewriteTarget target, String action) {
        String targetSkeleton = blankTargetSkeleton(target);
        if ("ADD_REASON".equals(action)) {
            return firstNonBlank(targetSkeleton, appendBlankReason(correctedBase), promptBasedStarter(prompt, action));
        }
        if ("ADD_EXAMPLE".equals(action)) {
            return firstNonBlank(targetSkeleton, appendBlankExample(correctedBase), promptBasedStarter(prompt, action));
        }
        if ("ADD_DETAIL".equals(action) || "MAKE_IT_MORE_SPECIFIC".equals(action)) {
            return firstNonBlank(targetSkeleton, promptAwareDetailStarter(prompt, correctedBase), promptAwareBlankStarter(prompt, correctedBase, action));
        }
        if ("MAKE_ON_TOPIC".equals(action) || "STATE_MAIN_ANSWER".equals(action)) {
            return firstNonBlank(targetSkeleton, promptBasedStarter(prompt, action), promptAwareBlankStarter(prompt, correctedBase, action));
        }
        return firstNonBlank(targetSkeleton, promptAwareBlankStarter(prompt, correctedBase, action), promptBasedStarter(prompt, action));
    }

    private String optionalPolishStarter(PromptDto prompt, String correctedBase) {
        String normalizedQuestion = normalize(prompt == null ? null : prompt.questionEn());
        if (containsAny(normalizedQuestion, "weekday morning", "routine", "sunday afternoon", "usually spend")) {
            return appendSentence(correctedBase, "After that, I ______.");
        }
        if (containsAny(normalizedQuestion, "favorite place", "relax", "favorite food")) {
            return appendSentence(correctedBase, "I especially like ______.");
        }
        return appendSentence(correctedBase, "Also, ______.");
    }

    private String normalizeStarter(
            String starter,
            PromptDto prompt,
            AnswerProfile answerProfile,
            RewriteGuideMode rewriteGuideMode
    ) {
        String candidate = normalizeNullable(starter);
        if (candidate == null) {
            candidate = promptBasedStarter(prompt, primaryIssueCode(answerProfile));
        }
        if (candidate == null) {
            candidate = "My answer is ______.";
        }

        candidate = BRACKET_PLACEHOLDER_PATTERN.matcher(candidate).replaceAll("______");
        candidate = candidate
                .replace("...", "______")
                .replaceAll("\\s+", " ")
                .trim();

        if (!candidate.contains("______")) {
            candidate = forceBlankStarter(candidate, prompt, answerProfile, rewriteGuideMode);
        }

        return ensureSentence(candidate);
    }

    private String correctedScaffoldStarter(PromptDto prompt, String correctedBase, RewriteTarget target, String action) {
        return firstNonBlank(
                blankTargetSkeleton(target),
                promptAwareBlankStarter(prompt, correctedBase, action),
                promptBasedStarter(prompt, action)
        );
    }

    private String blankTargetSkeleton(RewriteTarget target) {
        String skeleton = target == null ? null : normalizeNullable(target.skeleton());
        if (skeleton == null) {
            return null;
        }
        String normalizedSkeleton = BRACKET_PLACEHOLDER_PATTERN.matcher(skeleton).replaceAll("______")
                .replace("...", "______")
                .replaceAll("\\s+", " ")
                .trim();
        return normalizedSkeleton.contains("______") ? normalizedSkeleton : null;
    }

    private String promptAwareBlankStarter(PromptDto prompt, String correctedBase, String action) {
        if ("ADD_REASON".equals(action)) {
            return appendBlankReason(correctedBase);
        }
        if ("ADD_EXAMPLE".equals(action)) {
            return appendBlankExample(correctedBase);
        }
        String promptAware = promptAwareDetailStarter(prompt, correctedBase);
        if (promptAware != null && promptAware.contains("______")) {
            return promptAware;
        }
        String base = firstNonBlank(correctedBase, "My answer is");
        return appendSentence(trimSentenceEnding(base), "______.");
    }

    private String forceBlankStarter(
            String candidate,
            PromptDto prompt,
            AnswerProfile answerProfile,
            RewriteGuideMode rewriteGuideMode
    ) {
        String action = primaryIssueCode(answerProfile);
        return switch (rewriteGuideMode) {
            case OPTIONAL_POLISH -> appendSentence(candidate, "Also, ______.");
            case TASK_RESET, FRAGMENT_SCAFFOLD -> firstNonBlank(promptBasedStarter(prompt, action), promptAwareBlankStarter(prompt, candidate, action));
            case CORRECTED_SKELETON, DETAIL_SCAFFOLD -> promptAwareBlankStarter(prompt, candidate, action);
        };
    }

    private boolean hasMeaningfulNextStepPractice(FeedbackNextStepPracticeDto nextStepPractice) {
        if (nextStepPractice == null) {
            return false;
        }
        return firstNonBlank(
                normalizeNullable(nextStepPractice.title()),
                normalizeNullable(nextStepPractice.headline()),
                normalizeNullable(nextStepPractice.supportText()),
                normalizeNullable(nextStepPractice.originalText()),
                normalizeNullable(nextStepPractice.revisedText()),
                normalizeNullable(nextStepPractice.exampleEn())
        ) != null;
    }

    private boolean shouldBuildFallbackNextStepPractice(AnswerProfile answerProfile, FixFirstMode fixFirstMode) {
        if (answerProfile == null || fixFirstMode == FixFirstMode.TASK_RESET_CARD) {
            return false;
        }
        AnswerBand band = answerBand(answerProfile);
        if (band == AnswerBand.OFF_TOPIC || band == AnswerBand.TOO_SHORT_FRAGMENT || band == AnswerBand.GRAMMAR_BLOCKING) {
            return false;
        }
        String issueCode = primaryIssueCode(answerProfile);
        return switch (issueCode) {
            case "ADD_REASON", "ADD_EXAMPLE", "ADD_DETAIL", "MAKE_IT_MORE_SPECIFIC", "IMPROVE_NATURALNESS" -> true;
            default -> band == AnswerBand.NATURAL_BUT_BASIC || band == AnswerBand.SHORT_BUT_VALID;
        };
    }

    private String normalizeNextStepHeadline(
            String headline,
            PromptDto prompt,
            AnswerProfile answerProfile,
            RewriteGuideMode rewriteGuideMode
    ) {
        String candidate = normalizeNextStepBaseHeadline(headline);
        if (candidate != null) {
            return candidate;
        }
        if (rewriteGuideMode == RewriteGuideMode.TASK_RESET) {
            return null;
        }
        return normalizeNextStepBaseHeadline(promptBasedStarter(prompt, primaryIssueCode(answerProfile)));
    }

    private String normalizeNextStepBaseHeadline(String value) {
        String candidate = normalizeNullable(value);
        if (candidate == null) {
            return null;
        }
        candidate = BRACKET_PLACEHOLDER_PATTERN.matcher(candidate).replaceAll(" ");
        candidate = candidate
                .replace("______", " ")
                .replace("...", " ");
        candidate = MULTI_SPACE_PATTERN.matcher(candidate).replaceAll(" ").trim();
        candidate = candidate.replaceAll("\\s+([,.!?;:])", "$1");
        if (!isUsableNextStepHeadline(candidate)) {
            return null;
        }
        return ensureSentence(candidate);
    }

    private boolean isUsableNextStepHeadline(String candidate) {
        String normalized = normalizeNullable(candidate);
        if (normalized == null || normalized.contains("______") || normalized.contains("[") || normalized.contains("]")) {
            return false;
        }
        String trimmed = trimSentenceEnding(normalized).toLowerCase(Locale.ROOT);
        if (countTokens(trimmed) < 3) {
            return false;
        }
        return !trimmed.endsWith("because")
                && !trimmed.endsWith("and")
                && !trimmed.endsWith("or")
                && !trimmed.endsWith("to")
                && !trimmed.endsWith("so")
                && !trimmed.endsWith("then")
                && !trimmed.endsWith("usually")
                && !trimmed.endsWith("also")
                && !trimmed.endsWith("my")
                && !trimmed.endsWith("the")
                && !trimmed.endsWith("a");
    }

    private String buildNextStepSupportText(
            PromptDto prompt,
            AnswerProfile answerProfile,
            RewriteGuideMode rewriteGuideMode,
            boolean optionalTone
    ) {
        String action = primaryIssueCode(answerProfile);
        if (rewriteGuideMode == RewriteGuideMode.OPTIONAL_POLISH || optionalTone) {
            return "\uC9C0\uAE08 \uB2F5\uB3C4 \uCDA9\uBD84\uD788 \uC88B\uC544\uC694. \uC6D0\uD558\uBA74 \uD55C \uAC00\uC9C0 \uB514\uD14C\uC77C\uC774\uB098 \uD45C\uD604\uC744 \uB354\uD574 \uB354 \uD48D\uC131\uD558\uAC8C \uB9CC\uB4E4 \uC218 \uC788\uC5B4\uC694.";
        }
        if (rewriteGuideMode == RewriteGuideMode.TASK_RESET) {
            return "\uC9C0\uAE08\uC740 \uBA3C\uC800 \uC9C8\uBB38\uC5D0 \uB9DE\uB294 \uD575\uC2EC \uB2F5\uC744 \uD55C \uBB38\uC7A5\uC73C\uB85C \uB610\uB837\uD558\uAC8C \uB9D0\uD574 \uBCF4\uC138\uC694.";
        }
        if ("ADD_REASON".equals(action)) {
            return "\uC9E7\uC740 \uC774\uC720\uB97C \uD55C \uAC00\uC9C0 \uB354 \uBCF4\uD0DC\uBA74 \uB2F5\uC774 \uB354 \uC124\uB4DD\uB825 \uC788\uAC8C \uB4E4\uB824\uC694.";
        }
        if ("ADD_EXAMPLE".equals(action)) {
            return "\uC9E7\uC740 \uC608\uC2DC\uB97C \uB354\uD558\uBA74 \uB2F5\uC774 \uB354 \uC0DD\uC0DD\uD558\uACE0 \uAD6C\uCCB4\uC801\uC73C\uB85C \uB4E4\uB824\uC694.";
        }
        if ("ADD_DETAIL".equals(action) || "MAKE_IT_MORE_SPECIFIC".equals(action)) {
            return isRoutinePrompt(prompt)
                    ? "\uB8E8\uD2F4\uC758 \uB2E4\uC74C \uD65C\uB3D9\uC774\uB098 \uC2DC\uAC04 \uC815\uBCF4\uB97C \uD55C \uAC00\uC9C0 \uB354 \uB367\uBD99\uC774\uBA74 \uB2F5\uC774 \uB354 \uC790\uC5F0\uC2A4\uB7EC\uC6CC\uC838\uC694."
                    : "\uC0C1\uD669\uC774\uB098 \uB514\uD14C\uC77C\uC744 \uD55C \uAC00\uC9C0 \uB354 \uB123\uC73C\uBA74 \uB2F5\uC774 \uB354 \uB610\uB837\uD558\uACE0 \uD48D\uC131\uD574\uC838\uC694.";
        }
        if ("IMPROVE_NATURALNESS".equals(action)) {
            return "\uB73B\uC740 \uB9DE\uC73C\uB2C8, \uD45C\uD604 \uD558\uB098\uB9CC \uB354 \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uB2E4\uB4EC\uC5B4 \uBCF4\uBA74 \uD6E8\uC52C \uB9E4\uB054\uD574\uC838\uC694.";
        }
        return "\uC9C0\uAE08 \uB2F5\uC744 \uBC14\uD0D5\uC73C\uB85C \uC9E7\uC740 \uC815\uBCF4 \uD558\uB098\uB97C \uB354\uD574 \uB2F5\uC744 \uC870\uAE08 \uB354 \uD48D\uC131\uD558\uAC8C \uB9CC\uB4E4\uC5B4 \uBCF4\uC138\uC694.";
    }

    private String buildRewriteInstruction(
            PromptDto prompt,
            AnswerProfile answerProfile,
            RewriteTarget target,
            String starter,
            RewriteGuideMode rewriteGuideMode,
            boolean optionalTone
    ) {
        String action = target == null ? "" : target.action();
        boolean hasBlank = starter != null && starter.contains("______");

        if (rewriteGuideMode == RewriteGuideMode.OPTIONAL_POLISH || optionalTone) {
            return hasBlank
                    ? "원하면 빈칸에 짧은 연결 표현이나 한 가지 디테일을 넣어 조금 더 매끄럽게 다듬어 보세요."
                    : "원하면 이 문장을 바탕으로 한 군데만 가볍게 다듬어 보세요.";
        }
        if (rewriteGuideMode == RewriteGuideMode.FRAGMENT_SCAFFOLD) {
            return hasBlank
                    ? "빈칸에 실제로 하는 행동을 넣어 한 문장으로 완성해 보세요."
                    : "이 문장 틀을 따라 한 문장으로 먼저 완성해 보세요.";
        }
        if (rewriteGuideMode == RewriteGuideMode.CORRECTED_SKELETON) {
            return hasBlank
                    ? "빈칸에 필요한 내용만 채우고, 먼저 문장 구조를 바르게 맞춰 보세요."
                    : "이 수정문 구조를 그대로 따라 써 보세요.";
        }
        if (rewriteGuideMode == RewriteGuideMode.TASK_RESET) {
            return "질문이 묻는 핵심 답을 먼저 채워 보세요.";
        }
        if ("ADD_REASON".equals(action)) {
            return "빈칸에 왜 그런지 한 가지 이유를 넣어 보세요.";
        }
        if ("ADD_EXAMPLE".equals(action)) {
            return "빈칸에 짧은 예시를 넣어 답을 더 또렷하게 만들어 보세요.";
        }
        if ("ADD_DETAIL".equals(action) || "MAKE_IT_MORE_SPECIFIC".equals(action)) {
            return isRoutinePrompt(prompt)
                    ? "빈칸에 루틴에서 하는 다른 활동이나 시간 순서를 넣어 보세요."
                    : "빈칸에 답을 더 구체적으로 만드는 디테일 한 가지를 넣어 보세요.";
        }
        if ("MAKE_ON_TOPIC".equals(action) || "STATE_MAIN_ANSWER".equals(action)) {
            return "질문에 맞는 핵심 답부터 먼저 써 보세요.";
        }
        return hasBlank
                ? "빈칸에 한 가지 디테일을 넣어 다시 써 보세요."
                : "이 문장을 바탕으로 다시 써 보세요.";
    }

    private String canFinishHeadline(PromptDto prompt, String primaryIssueCode, AnswerBand answerBand) {
        if ("ADD_REASON".equals(primaryIssueCode)) {
            return "원하면 이유를 한 가지 더 구체적으로 써 보세요.";
        }
        if ("ADD_EXAMPLE".equals(primaryIssueCode)) {
            return "원하면 짧은 예시를 한 문장 더 붙여 보세요.";
        }
        if ("ADD_DETAIL".equals(primaryIssueCode) || "MAKE_IT_MORE_SPECIFIC".equals(primaryIssueCode)) {
            return isRoutinePrompt(prompt)
                    ? "원하면 루틴에서 하는 다른 활동을 한 가지 더 보태 보세요."
                    : "원하면 디테일을 한 가지 더 보태서 답을 더 또렷하게 만들어 보세요.";
        }
        if (answerBand == AnswerBand.NATURAL_BUT_BASIC) {
            return "원하면 연결 표현만 하나 더 다듬어 보세요.";
        }
        return "지금도 충분하지만, 원하면 한 가지 더 보태며 연습해 볼 수 있어요.";
    }

    private String optionalPolishHeadline(PromptDto prompt, String primaryIssueCode) {
        if ("IMPROVE_NATURALNESS".equals(primaryIssueCode)) {
            return "원하면 연결 표현만 하나 더 다듬어 보세요.";
        }
        if (isRoutinePrompt(prompt)) {
            return "원하면 흐름을 더 자연스럽게 잇는 표현만 하나 더 보태 보세요.";
        }
        return "원하면 표현 한 군데만 더 자연스럽게 다듬어 보세요.";
    }

    private String detailSupportText(PromptDto prompt) {
        return isRoutinePrompt(prompt)
                ? "문법보다 내용의 구체성이 더 중요해요. 이번에는 루틴을 더 또렷하게 만드는 디테일 한 가지를 직접 써 보세요."
                : "문법보다 내용의 구체성이 더 중요해요. 이번에는 답을 더 선명하게 만드는 이유나 디테일 한 가지를 직접 써 보세요.";
    }

    private String detailInstruction(PromptDto prompt) {
        String normalizedQuestion = normalize(prompt == null ? null : prompt.questionEn());
        if (containsAny(normalizedQuestion, "routine", "weekday morning", "sunday afternoon", "usually spend")) {
            return "아침 루틴이나 오후 활동에서 하는 다른 행동을 한 문장 더 써 보세요.";
        }
        if (containsAny(normalizedQuestion, "favorite place", "relax")) {
            return "그 장소가 왜 편한지, 어떤 점이 좋은지 한 문장 더 써 보세요.";
        }
        if (containsAny(normalizedQuestion, "favorite food")) {
            return "왜 좋아하는지 한 문장만 더 구체적으로 써 보세요.";
        }
        return "지금 답을 더 또렷하게 만드는 정보 한 가지를 한 문장 더 써 보세요.";
    }

    private String promptAwareDetailStarter(PromptDto prompt, String correctedBase) {
        String normalizedQuestion = normalize(prompt == null ? null : prompt.questionEn());
        if (containsAny(normalizedQuestion, "weekday morning")) {
            return appendSentence(correctedBase, "After that, I ______.");
        }
        if (containsAny(normalizedQuestion, "sunday afternoon", "usually spend")) {
            return appendSentence(correctedBase, "After that, I ______.");
        }
        if (containsAny(normalizedQuestion, "favorite place", "relax")) {
            return firstNonBlank(
                    "My favorite place to relax is ______ because ______.",
                    appendSentence(correctedBase, "I like the ______ there.")
            );
        }
        if (containsAny(normalizedQuestion, "favorite food")) {
            return firstNonBlank(
                    "My favorite food is ______ because ______.",
                    appendSentence(correctedBase, "I especially like ______.")
            );
        }
        return appendSentence(correctedBase, "I ______.");
    }

    private String promptBasedStarter(PromptDto prompt, String action) {
        String normalizedQuestion = normalize(prompt == null ? null : prompt.questionEn());
        if (containsAny(normalizedQuestion, "weekday morning")) {
            return "On weekday mornings, I usually ______.";
        }
        if (containsAny(normalizedQuestion, "sunday afternoon", "usually spend")) {
            return "On Sunday afternoons, I usually ______.";
        }
        if (containsAny(normalizedQuestion, "favorite place", "relax")) {
            return "My favorite place to relax is ______ because ______.";
        }
        if (containsAny(normalizedQuestion, "favorite food")) {
            return "My favorite food is ______ because ______.";
        }
        if ("ADD_REASON".equals(action)) {
            return "I like ______ because ______.";
        }
        return "My answer is ______.";
    }

    private String appendBlankReason(String base) {
        String sentence = trimSentenceEnding(firstNonBlank(base, "I like ______"));
        if (sentence == null) {
            return "I like ______ because ______.";
        }
        String normalizedSentence = normalize(sentence);
        if (normalizedSentence.contains("because ______")) {
            return ensureSentence(sentence);
        }
        int becauseIndex = normalizedSentence.indexOf(" because ");
        if (becauseIndex >= 0) {
            int originalBecauseIndex = sentence.toLowerCase(Locale.ROOT).indexOf(" because ");
            if (originalBecauseIndex >= 0) {
                return ensureSentence(sentence.substring(0, originalBecauseIndex) + " because ______");
            }
        }
        return sentence + " because ______.";
    }

    private String appendSentence(String base, String addition) {
        String trimmedBase = normalizeNullable(base);
        String trimmedAddition = normalizeNullable(addition);
        if (trimmedAddition == null) {
            return trimmedBase;
        }
        if (trimmedBase == null) {
            return trimmedAddition;
        }
        return ensureSentence(trimmedBase) + " " + trimmedAddition.trim();
    }

    private String appendBlankExample(String base) {
        String sentence = ensureSentence(firstNonBlank(base, "I think ______."));
        return trimSentenceEnding(sentence) + ". For example, ______.";
    }

    private boolean hasDisplayableRefinement(List<RefinementExpressionDto> refinementExpressions) {
        if (refinementExpressions == null || refinementExpressions.isEmpty()) {
            return false;
        }
        return refinementExpressions.stream().anyMatch(this::isDisplayableRefinement);
    }

    private boolean isDisplayableRefinement(RefinementExpressionDto expression) {
        if (expression == null) {
            return false;
        }
        if (expression.displayable() != null && !expression.displayable()) {
            return false;
        }
        return normalizeNullable(expression.guidanceKo()) != null
                || normalizeNullable(expression.exampleEn()) != null
                || normalizeNullable(expression.exampleKo()) != null
                || normalizeNullable(expression.meaningKo()) != null;
    }

    private boolean hasHighValueCorrection(AnswerProfile answerProfile, boolean hasGrammarCard) {
        AnswerBand answerBand = answerBand(answerProfile);
        if (answerBand == AnswerBand.GRAMMAR_BLOCKING || answerBand == AnswerBand.OFF_TOPIC) {
            return true;
        }
        if (taskCompletion(answerProfile) != TaskCompletion.FULL) {
            return true;
        }
        if (grammarSeverity(answerProfile).ordinal() >= GrammarSeverity.MODERATE.ordinal()) {
            return true;
        }
        return hasGrammarCard && answerBand != AnswerBand.NATURAL_BUT_BASIC;
    }

    private boolean isDetailPromptIssue(String primaryIssueCode) {
        return "ADD_REASON".equals(primaryIssueCode)
                || "ADD_EXAMPLE".equals(primaryIssueCode)
                || "ADD_DETAIL".equals(primaryIssueCode)
                || "MAKE_IT_MORE_SPECIFIC".equals(primaryIssueCode);
    }

    private AnswerBand answerBand(AnswerProfile answerProfile) {
        if (answerProfile == null || answerProfile.task() == null || answerProfile.task().answerBand() == null) {
            return AnswerBand.SHORT_BUT_VALID;
        }
        return answerProfile.task().answerBand();
    }

    private TaskCompletion taskCompletion(AnswerProfile answerProfile) {
        if (answerProfile == null || answerProfile.task() == null || answerProfile.task().taskCompletion() == null) {
            return TaskCompletion.PARTIAL;
        }
        return answerProfile.task().taskCompletion();
    }

    private GrammarSeverity grammarSeverity(AnswerProfile answerProfile) {
        if (answerProfile == null || answerProfile.grammar() == null || answerProfile.grammar().severity() == null) {
            return GrammarSeverity.NONE;
        }
        return answerProfile.grammar().severity();
    }

    private String primaryIssueCode(AnswerProfile answerProfile) {
        if (answerProfile == null || answerProfile.rewrite() == null) {
            return "";
        }
        return answerProfile.rewrite().primaryIssueCode();
    }

    private boolean isRoutinePrompt(PromptDto prompt) {
        String normalizedQuestion = normalize(prompt == null ? null : prompt.questionEn());
        return containsAny(normalizedQuestion, "routine", "weekday morning", "sunday afternoon", "usually spend");
    }

    private boolean containsAny(String source, String... tokens) {
        if (source == null || source.isBlank()) {
            return false;
        }
        for (String token : tokens) {
            if (source.contains(token)) {
                return true;
            }
        }
        return false;
    }

    private boolean sameMeaning(String left, String right) {
        String normalizedLeft = normalize(left);
        String normalizedRight = normalize(right);
        return !normalizedLeft.isBlank() && normalizedLeft.equals(normalizedRight);
    }

    private String normalizeForSpanCompare(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return value.toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}]+", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private String normalize(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return value.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
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

    private String normalizeNullable(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = MULTI_SPACE_PATTERN.matcher(value).replaceAll(" ").trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String trimSentenceEnding(String value) {
        String normalized = normalizeNullable(value);
        if (normalized == null) {
            return null;
        }
        return normalized.replaceAll("[.!?]+$", "").trim();
    }

    private String ensureSentence(String value) {
        String normalized = normalizeNullable(value);
        if (normalized == null) {
            return "";
        }
        if (normalized.endsWith(".") || normalized.endsWith("!") || normalized.endsWith("?")) {
            return normalized;
        }
        return normalized + ".";
    }

    private String normalizeSentence(String value) {
        return ensureSentence(firstNonBlank(value, ""));
    }

    private record ImprovementCandidate(
            String key,
            ImprovementCandidateKind kind,
            FixFirstMode fixFirstMode,
            int score,
            int order,
            FeedbackPrimaryFixDto primaryFix,
            FeedbackSecondaryLearningPointDto secondaryPoint
    ) {
    }

    private enum ImprovementCandidateKind {
        PRIMARY_FIX,
        GRAMMAR,
        CORRECTION,
        EXPRESSION
    }
}
