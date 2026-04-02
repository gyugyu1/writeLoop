package com.writeloop.service;

import com.writeloop.dto.FeedbackFocusCardDto;
import com.writeloop.dto.FeedbackLoopStatusDto;
import com.writeloop.dto.FeedbackMicroTipDto;
import com.writeloop.dto.FeedbackPrimaryFixDto;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.FeedbackRewritePracticeDto;
import com.writeloop.dto.FeedbackScreenPolicyDto;
import com.writeloop.dto.FeedbackUiDto;
import com.writeloop.dto.GrammarFeedbackItemDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.RefinementExpressionDto;

import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

final class FeedbackUiComposer {
    private static final String START_REWRITE_CTA_LABEL = "이 문장으로 시작해서 다시 쓰기";
    private static final Pattern MULTI_SPACE_PATTERN = Pattern.compile("\\s+");
    private static final Pattern PUNCTUATION_ONLY_PATTERN = Pattern.compile("^[\\p{Punct}]+$");
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
        FeedbackSectionAvailability availability = buildAvailability(prompt, learnerAnswer, feedback, answerProfile);
        CompletionState completionState = completionStateSelector.select(answerProfile, availability);
        FeedbackScreenPolicy screenPolicy = screenPolicySelector.select(
                answerProfile,
                completionState,
                availability,
                feedback == null ? 1 : Math.max(1, feedback.attemptNo())
        );

        FeedbackFocusCardDto focusCard = applyDynamicSupportText(
                buildFocusCard(prompt, answerProfile, completionState),
                feedback
        );

        return new FeedbackUiDto(
                focusCard,
                buildPrimaryFix(prompt, learnerAnswer, feedback, answerProfile, screenPolicy.fixFirstDisplayMode(), screenPolicy.fixFirstMode()),
                buildMicroTip(learnerAnswer, feedback, screenPolicy.fixFirstMode()),
                buildRewritePractice(prompt, learnerAnswer, feedback, answerProfile, screenPolicy.rewriteGuideMode(), completionState == CompletionState.OPTIONAL_POLISH),
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
                || answerBand(answerProfile) == AnswerBand.OFF_TOPIC
                || taskCompletion(answerProfile) != TaskCompletion.FULL
                || isDetailPromptIssue(primaryIssueCode(answerProfile));

        boolean hasRewriteGuide = normalizeNullable(
                deriveStarter(prompt, learnerAnswer, feedback, answerProfile, null)
        ) != null;
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
            CompletionState completionState
    ) {
        String primaryIssueCode = primaryIssueCode(answerProfile);
        AnswerBand answerBand = answerBand(answerProfile);

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

        if (answerBand == AnswerBand.OFF_TOPIC
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

        if (answerBand == AnswerBand.GRAMMAR_BLOCKING
                || "FIX_BLOCKING_GRAMMAR".equals(primaryIssueCode)
                || "FIX_LOCAL_GRAMMAR".equals(primaryIssueCode)) {
            return new FeedbackFocusCardDto(
                    "이번 답변의 수정 목표",
                    "핵심 문법 먼저 고치기",
                    "이번에는 내용을 더 붙이기보다, 먼저 문장 구조를 안정적으로 바로잡는 것이 중요해요."
            );
        }

        if ("ADD_REASON".equals(primaryIssueCode)) {
            return new FeedbackFocusCardDto(
                    "이번 답변의 수정 목표",
                    "이유를 한 가지 더 구체적으로 쓰기",
                    "왜 그런지 한 문장만 더 또렷하게 적으면 답이 훨씬 설득력 있어져요."
            );
        }

        if ("ADD_EXAMPLE".equals(primaryIssueCode)) {
            return new FeedbackFocusCardDto(
                    "이번 답변의 수정 목표",
                    "짧은 예시를 한 문장 더 붙이기",
                    "지금 방향은 좋아요. 짧은 예시를 하나만 더 보태면 답이 더 선명해져요."
            );
        }

        if ("ADD_DETAIL".equals(primaryIssueCode) || "MAKE_IT_MORE_SPECIFIC".equals(primaryIssueCode)) {
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

    private FeedbackFocusCardDto applyDynamicSupportText(FeedbackFocusCardDto focusCard, FeedbackResponseDto feedback) {
        if (focusCard == null) {
            return null;
        }
        String dynamicSupportText = resolveFocusSupportText(feedback);
        if (dynamicSupportText == null) {
            return focusCard;
        }
        if (sameMeaning(dynamicSupportText, focusCard.headline()) || sameMeaning(dynamicSupportText, focusCard.supportText())) {
            return focusCard;
        }
        return new FeedbackFocusCardDto(
                focusCard.title(),
                focusCard.headline(),
                dynamicSupportText
        );
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
            instruction = "왜 그런지 한 문장으로 이유를 더 써 보세요.";
        } else if ("ADD_EXAMPLE".equals(primaryIssueCode)) {
            instruction = "짧은 예시를 한 문장 더 붙여 보세요.";
        } else if ("ADD_DETAIL".equals(primaryIssueCode) || "MAKE_IT_MORE_SPECIFIC".equals(primaryIssueCode)) {
            instruction = detailInstruction(prompt);
        } else {
            instruction = "지금 답을 더 또렷하게 만드는 정보 한 가지를 추가해 보세요.";
        }
        return new FeedbackPrimaryFixDto("한 가지 더 추가하면 좋아요", instruction, null, null, null);
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

    private FeedbackRewritePracticeDto buildRewritePractice(
            PromptDto prompt,
            String learnerAnswer,
            FeedbackResponseDto feedback,
            AnswerProfile answerProfile,
            RewriteGuideMode rewriteGuideMode,
            boolean optionalTone
    ) {
        RewriteTarget target = answerProfile == null || answerProfile.rewrite() == null
                ? null
                : answerProfile.rewrite().target();

        String starter = normalizeStarter(
                deriveStarter(prompt, learnerAnswer, feedback, answerProfile, rewriteGuideMode),
                prompt,
                answerProfile,
                rewriteGuideMode
        );

        return new FeedbackRewritePracticeDto(
                optionalTone ? "원하면 한 번 더 다듬어 보세요" : "한번 더 써보기",
                starter,
                buildRewriteInstruction(prompt, answerProfile, target, starter, rewriteGuideMode, optionalTone),
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
                    "루프 완료 가능",
                    firstNonBlank(completionMessage, "지금도 충분히 좋아요."),
                    "원하면 한 번 더 다듬어 볼 수 있지만, 지금 단계에서 마무리해도 괜찮아요.",
                    "한 번 더 다듬기",
                    screenPolicy.showFinishCta() ? "오늘 루프 완료하고 도장 받기" : null,
                    screenPolicy.showCancelCta() ? "답변 취소" : null
            );
            case CAN_FINISH -> new FeedbackLoopStatusDto(
                    "루프 완료 가능",
                    firstNonBlank(completionMessage, "지금 단계에서는 마무리 가능해요."),
                    "원하면 한 번 더 다듬어 보거나, 지금 여기서 마무리할 수도 있어요.",
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
            RewriteGuideMode rewriteGuideMode
    ) {
        RewriteTarget target = answerProfile == null || answerProfile.rewrite() == null
                ? null
                : answerProfile.rewrite().target();
        String action = target == null ? "" : target.action();
        String correctedBase = firstNonBlank(
                answerProfile == null || answerProfile.grammar() == null ? null : answerProfile.grammar().minimalCorrection(),
                feedback == null ? null : feedback.correctedAnswer(),
                learnerAnswer
        );

        if (rewriteGuideMode == null) {
            return firstNonBlank(target == null ? null : target.skeleton(), correctedBase, promptBasedStarter(prompt, action));
        }

        return switch (rewriteGuideMode) {
            case FRAGMENT_SCAFFOLD, TASK_RESET -> promptBasedStarter(prompt, action);
            case CORRECTED_SKELETON -> firstNonBlank(target == null ? null : target.skeleton(), correctedBase, promptBasedStarter(prompt, action));
            case OPTIONAL_POLISH -> optionalPolishStarter(prompt, correctedBase);
            case DETAIL_SCAFFOLD -> detailStarter(prompt, correctedBase, target, action);
        };
    }

    private String detailStarter(PromptDto prompt, String correctedBase, RewriteTarget target, String action) {
        if ("ADD_REASON".equals(action)) {
            return appendBlankReason(correctedBase);
        }
        if ("ADD_EXAMPLE".equals(action)) {
            return appendBlankExample(correctedBase);
        }
        if ("ADD_DETAIL".equals(action) || "MAKE_IT_MORE_SPECIFIC".equals(action)) {
            return firstNonBlank(promptAwareDetailStarter(prompt, correctedBase), target == null ? null : target.skeleton(), correctedBase);
        }
        if ("MAKE_ON_TOPIC".equals(action) || "STATE_MAIN_ANSWER".equals(action)) {
            return promptBasedStarter(prompt, action);
        }
        return firstNonBlank(target == null ? null : target.skeleton(), correctedBase, promptAwareDetailStarter(prompt, correctedBase));
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

        candidate = candidate
                .replace("...", "______")
                .replaceAll("\\s+", " ")
                .trim();

        if (!candidate.contains("______")
                && rewriteGuideMode != RewriteGuideMode.CORRECTED_SKELETON
                && rewriteGuideMode != RewriteGuideMode.TASK_RESET) {
            candidate = rewriteGuideMode == RewriteGuideMode.OPTIONAL_POLISH
                    ? appendSentence(candidate, "Also, ______.")
                    : appendBlankReason(candidate);
        }

        return ensureSentence(candidate);
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

    private String resolveFocusSupportText(FeedbackResponseDto feedback) {
        if (feedback == null) {
            return null;
        }
        return normalizeNullable(feedback.summary());
    }

    private boolean sameMeaning(String left, String right) {
        String normalizedLeft = normalize(left);
        String normalizedRight = normalize(right);
        return !normalizedLeft.isBlank() && normalizedLeft.equals(normalizedRight);
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
}
