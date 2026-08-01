package com.writeloop.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class FeedbackResponseContractTest {
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void serializesOnlyCurrentPublicFeedbackContract() throws Exception {
        FeedbackResponseDto response = new FeedbackResponseDto(
                "prompt-1",
                "session-1",
                1,
                false,
                "Keep going.",
                "Readable public summary",
                List.of("Clear main idea"),
                List.of(new CorrectionDto("internal issue", "internal suggestion")),
                List.of(new InlineFeedbackSegmentDto("replace", "I go", "I went")),
                List.of(new GrammarFeedbackItemDto("I go", "I went", "Past event needs past tense.")),
                "I went home.",
                List.of(new RefinementExpressionDto(
                        "after that",
                        "Use this to connect the next action.",
                        "After that, I rested.",
                        "그 후에"
                )),
                "I went home and rested.",
                "집에 가서 쉬었어요.",
                "Try one focused rewrite.",
                new FeedbackUiDto(
                        null,
                        List.of(),
                        null,
                        null
                ),
                null,
                new FeedbackCoachMoveDto(
                        "Past tense",
                        "LANGUAGE_FIX",
                        "The event already happened.",
                        "I go home",
                        "I went home",
                        "Use past tense for yesterday.",
                        null,
                        null,
                        List.of(),
                        "The verb is in past tense.",
                        null,
                        List.of(new FeedbackLanguageCorrectionDto(
                                "GRAMMAR_LOCAL",
                                "세부 교정",
                                "go",
                                "went",
                                "Use past tense for a finished event."
                        ))
                ),
                new FeedbackRewriteWorkspaceDto("I go home.", "I went ____.", true),
                null,
                null
        );

        JsonNode root = objectMapper.readTree(objectMapper.writeValueAsString(response));

        assertThat(root.has("summary")).isTrue();
        assertThat(root.has("inlineFeedback")).isTrue();
        assertThat(root.path("revisedAnswer").asText()).isEqualTo("I went home.");
        assertThat(root.has("correctedAnswer")).isFalse();
        assertThat(root.has("refinementExpressions")).isTrue();
        assertThat(root.has("coachMove")).isTrue();
        assertThat(root.path("coachMove").path("focusType").asText()).isEqualTo("LANGUAGE_FIX");
        assertThat(root.path("coachMove").path("languageCorrections").size()).isEqualTo(1);
        assertThat(root.has("rewriteWorkspace")).isTrue();
        assertThat(root.has("score")).isFalse();
        assertThat(root.has("corrections")).isFalse();
        assertThat(root.has("grammarFeedback")).isFalse();
        assertThat(root.has("usedExpressions")).isFalse();
        assertThat(root.path("coachMove").has("exampleEn")).isFalse();
        assertThat(root.path("rewriteWorkspace").has("targetTextHint")).isFalse();

        JsonNode ui = root.path("ui");
        assertThat(ui.has("fixPoints")).isFalse();
        assertThat(ui.has("secondaryLearningPoints")).isFalse();
        assertThat(ui.has("modelAnswerVariants")).isFalse();
        assertThat(ui.has("focusCard")).isFalse();
        assertThat(ui.has("primaryFix")).isFalse();
    }

    @Test
    void acceptsLegacyUiFieldsWithoutRepublishingThem() throws Exception {
        String legacyJson = """
                {
                  "promptId": "prompt-1",
                  "sessionId": "session-1",
                  "attemptNo": 1,
                  "score": 80,
                  "loopComplete": false,
                  "completionMessage": null,
                  "summary": "summary",
                  "strengths": [],
                  "corrections": [],
                  "inlineFeedback": [],
                  "grammarFeedback": [],
                  "correctedAnswer": "I went home.",
                  "refinementExpressions": [],
                  "modelAnswer": "I went home.",
                  "modelAnswerKo": null,
                  "rewriteChallenge": "",
                  "usedExpressions": [],
                  "ui": {
                    "secondaryLearningPoints": [
                      {
                        "kind": "EXPRESSION",
                        "headline": "after that"
                      }
                    ],
                    "modelAnswerVariants": [
                      {
                        "kind": "NATURAL_POLISH",
                        "answer": "I went home and rested."
                      }
                    ],
                    "fixPoints": [
                      {
                        "kind": "GRAMMAR",
                        "originalText": "I go home",
                        "revisedText": "I went home"
                      }
                    ]
                  }
                }
                """;

        FeedbackResponseDto response = objectMapper.readValue(legacyJson, FeedbackResponseDto.class);
        JsonNode root = objectMapper.readTree(objectMapper.writeValueAsString(response));

        assertThat(response.ui()).isNotNull();
        assertThat(response.revisedAnswer()).isEqualTo("I went home.");
        assertThat(root.path("revisedAnswer").asText()).isEqualTo("I went home.");
        assertThat(root.has("correctedAnswer")).isFalse();
        assertThat(root.path("ui").has("fixPoints")).isFalse();
        assertThat(root.path("ui").has("secondaryLearningPoints")).isFalse();
        assertThat(root.path("ui").has("modelAnswerVariants")).isFalse();
    }
}
