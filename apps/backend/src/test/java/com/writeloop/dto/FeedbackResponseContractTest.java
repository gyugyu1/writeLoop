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
                        "그 후에",
                        "그 후에"
                )),
                "I went home and rested.",
                "집에 가서 쉬었어요.",
                "Try one focused rewrite.",
                List.of(),
                new FeedbackUiDto(
                        new FeedbackFocusCardDto("legacy", "legacy headline", "legacy support"),
                        new FeedbackPrimaryFixDto("legacy", "legacy", "old", "new", "why"),
                        null,
                        List.of(new FeedbackSecondaryLearningPointDto(
                                "EXPRESSION",
                                "Hidden secondary point",
                                "after that",
                                "Hidden support",
                                null,
                                null,
                                "그 후에",
                                "Use it for sequence.",
                                "After that, I rested.",
                                null
                        )),
                        List.of(new FeedbackSecondaryLearningPointDto(
                                "GRAMMAR",
                                "Fix past tense",
                                null,
                                "Past events need past tense.",
                                "I go home",
                                "I went home",
                                null,
                                null,
                                null,
                                null
                        )),
                        null,
                        List.of(),
                        List.of(new FeedbackModelAnswerVariantDto(
                                "NATURAL_POLISH",
                                "I went home and got some rest.",
                                "집에 가서 조금 쉬었어요.",
                                "Smoother version."
                        )),
                        null,
                        null
                ),
                null,
                new FeedbackCoachMoveDto(
                        "Past tense",
                        "GRAMMAR_FIX",
                        "The event already happened.",
                        "I go home",
                        "I went home",
                        "Use past tense for yesterday.",
                        "The verb is in past tense."
                ),
                new FeedbackRewriteWorkspaceDto("I go home.", "I went ____.", "Change the verb.", true),
                null,
                null
        );

        JsonNode root = objectMapper.readTree(objectMapper.writeValueAsString(response));

        assertThat(root.has("summary")).isTrue();
        assertThat(root.has("inlineFeedback")).isTrue();
        assertThat(root.has("refinementExpressions")).isTrue();
        assertThat(root.has("coachMove")).isTrue();
        assertThat(root.has("rewriteWorkspace")).isTrue();
        assertThat(root.has("score")).isFalse();
        assertThat(root.has("corrections")).isFalse();
        assertThat(root.has("grammarFeedback")).isFalse();

        JsonNode ui = root.path("ui");
        assertThat(ui.has("fixPoints")).isTrue();
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

        assertThat(response.ui().fixPoints()).singleElement().satisfies(point -> {
            assertThat(point.kind()).isEqualTo("GRAMMAR");
            assertThat(point.originalText()).isEqualTo("I go home");
            assertThat(point.revisedText()).isEqualTo("I went home");
        });
        assertThat(root.path("ui").has("fixPoints")).isTrue();
        assertThat(root.path("ui").has("secondaryLearningPoints")).isFalse();
        assertThat(root.path("ui").has("modelAnswerVariants")).isFalse();
    }
}
