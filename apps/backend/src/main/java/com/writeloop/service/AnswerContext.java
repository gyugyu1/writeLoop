package com.writeloop.service;

import com.writeloop.dto.PromptTaskMetaDto;

import java.util.List;

public record AnswerContext(
        String promptText,
        String difficulty,
        int attemptIndex,
        String learnerAnswer,
        String previousAnswer,
        List<PromptHintRef> promptHints,
        PromptTaskMetaDto promptTaskMeta,
        String promptTopicCategory,
        String promptTopicDetail
) {
    public AnswerContext(
            String promptText,
            String difficulty,
            int attemptIndex,
            String learnerAnswer,
            String previousAnswer,
            List<PromptHintRef> promptHints
    ) {
        this(promptText, difficulty, attemptIndex, learnerAnswer, previousAnswer, promptHints, null, null, null);
    }

    public AnswerContext(
            String promptText,
            String difficulty,
            int attemptIndex,
            String learnerAnswer,
            String previousAnswer,
            String ignoredModelAnswer,
            List<PromptHintRef> promptHints
    ) {
        this(promptText, difficulty, attemptIndex, learnerAnswer, previousAnswer, promptHints, null, null, null);
    }

    public AnswerContext {
        promptText = promptText == null ? "" : promptText.trim();
        difficulty = difficulty == null ? "" : difficulty.trim();
        learnerAnswer = learnerAnswer == null ? "" : learnerAnswer.trim();
        previousAnswer = previousAnswer == null ? null : previousAnswer.trim();
        promptHints = promptHints == null ? List.of() : List.copyOf(promptHints);
        promptTopicCategory = promptTopicCategory == null ? "" : promptTopicCategory.trim();
        promptTopicDetail = promptTopicDetail == null ? "" : promptTopicDetail.trim();
    }

    public AnswerContext(
            String promptText,
            String difficulty,
            int attemptIndex,
            String learnerAnswer,
            String previousAnswer,
            List<PromptHintRef> promptHints,
            PromptTaskMetaDto promptTaskMeta
    ) {
        this(promptText, difficulty, attemptIndex, learnerAnswer, previousAnswer, promptHints, promptTaskMeta, null, null);
    }

    public AnswerContext(
            String promptText,
            String difficulty,
            int attemptIndex,
            String learnerAnswer,
            String previousAnswer,
            String ignoredModelAnswer,
            List<PromptHintRef> promptHints,
            PromptTaskMetaDto promptTaskMeta,
            String promptTopicCategory,
            String promptTopicDetail
    ) {
        this(
                promptText,
                difficulty,
                attemptIndex,
                learnerAnswer,
                previousAnswer,
                promptHints,
                promptTaskMeta,
                promptTopicCategory,
                promptTopicDetail
        );
    }
}

record PromptHintRef(
        String hintType,
        List<String> items
) {
    PromptHintRef {
        hintType = hintType == null ? "" : hintType.trim();
        items = items == null ? List.of() : List.copyOf(items);
    }
}
