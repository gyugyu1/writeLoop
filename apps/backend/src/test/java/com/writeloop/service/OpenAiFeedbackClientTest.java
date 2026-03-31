package com.writeloop.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.CoachExpressionUsageDto;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.InlineFeedbackSegmentDto;
import com.writeloop.dto.PromptCoachProfileDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

class OpenAiFeedbackClientTest {

    @Test
    void buildPrompt_emphasizes_novel_structures_and_soft_profile_guidance() {
        OpenAiFeedbackClient client = new OpenAiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses"
        );
        PromptDto prompt = new PromptDto(
                "prompt-b-5",
                "Goal Plan - Skill Growth",
                "B",
                "What is one skill you want to improve this year, and how will you work on it?",
                "What skill do you want to improve this year, and how will you practice it?",
                "Explain both the goal and the action plan.",
                new PromptCoachProfileDto(
                        "GOAL_PLAN",
                        List.of("goal", "plan", "growth"),
                        List.of("goal", "plan", "process"),
                        List.of("generic_example_marker"),
                        "DIRECT",
                        "Prefer goal, plan, and process expressions."
                )
        );
        List<PromptHintDto> hints = List.of(
                new PromptHintDto("hint-1", prompt.id(), "STARTER", "I want to improve [skill] this year.", 1),
                new PromptHintDto("hint-2", prompt.id(), "STRUCTURE", "I plan to do this by [verb]ing [method].", 2)
        );

        String text = client.buildPrompt(prompt, "I want to improve my English this year.", hints);

        assertThat(text).contains("Korean fields: summary, strengths, corrections.issue, corrections.suggestion, rewriteChallenge, modelAnswerKo, grammarFeedback.reasonKo, and any refinementExpressions.guidanceKo, exampleKo, or meaningKo when present.");
        assertThat(text).contains("English fields: correctedAnswer, modelAnswer, inlineFeedback.originalText, inlineFeedback.revisedText, grammarFeedback.originalText, grammarFeedback.revisedText, refinementExpressions.expression, and refinementExpressions.exampleEn.");
        assertThat(text).contains("inlineFeedback is only for local sentence correction: grammar, word choice, agreement, article, determiner, preposition, capitalization, and punctuation.");
        assertThat(text).contains("inlineFeedback may be an empty array when the learner answer is already locally grammatical and natural enough.");
        assertThat(text).contains("Do not use inlineFeedback for new ideas, extra reasons, examples, plans, or broader content expansion.");
        assertThat(text).contains("Do not reinterpret the situation or swap time, place, activity, or other content words just to sound more natural.");
        assertThat(text).contains("If the only needed change is punctuation, correctedAnswer must keep the learner's words unchanged and modify punctuation only.");
        assertThat(text).contains("If the only needed change is punctuation, inlineFeedback should contain only punctuation edits.");
        assertThat(text).contains("Allowed inlineFeedback types: KEEP, REPLACE, ADD, REMOVE.");
        assertThat(text).contains("ADD should usually be a short local insertion such as an article, preposition, pronoun, auxiliary, connector, or punctuation mark, not a full new clause or sentence.");
        assertThat(text).contains("corrections should focus only on non-grammar coaching");
        assertThat(text).contains("Each corrections.issue and corrections.suggestion must contain Korean text, not English-only text.");
        assertThat(text).contains("Do not repeat grammar explanations in corrections when they are already covered in grammarFeedback.");
        assertThat(text).contains("If there is no meaningful non-grammar coaching point beyond grammarFeedback, corrections may be an empty array.");
        assertThat(text).contains("grammarFeedback should contain only real local grammar or mechanics issues");
        assertThat(text).contains("Each grammarFeedback item must include originalText, revisedText, and reasonKo.");
        assertThat(text).contains("Prefer short rule-based grammar explanations over generic comments.");
        assertThat(text).contains("instead of a vague comment about adding a determiner.");
        assertThat(text).contains("reasonKo must explain only the actual edit between originalText and revisedText.");
        assertThat(text).contains("Bad: mention an unrelated rule like \"There is\" vs \"There's\" when the actual edit is article, noun, preposition, or punctuation.");
        assertThat(text).contains("When several nearby edits come from the same grammar rule, you may group them into one broader grammarFeedback item");
        assertThat(text).contains("modelAnswerKo should be a natural Korean translation or paraphrase of modelAnswer");
        assertThat(text).contains("usedExpressions should contain 1 to 3 short English chunks that the learner already used naturally and correctly in the learner answer.");
        assertThat(text).contains("Each usedExpressions item must include expression and usageTip.");
        assertThat(text).contains("If modelAnswer contains several distinct reusable chunks, prefer returning 3 to 4 items instead of stopping at 2.");
        assertThat(text).contains("Each refinement item must include guidanceKo, exampleEn, exampleKo, and meaningKo.");
        assertThat(text).contains("guidanceKo must be one full Korean coaching sentence that explains when or how to use the expression, not just a gloss.");
        assertThat(text).contains("exampleEn must be a short clean English usage snippet or sentence, must be different from expression, and should place a word or short phrase inside a natural sentence.");
        assertThat(text).contains("exampleKo should be a natural Korean translation or paraphrase of exampleEn.");
        assertThat(text).contains("meaningKo should be a short Korean gloss or paraphrase that helps the learner understand the expression quickly.");
        assertThat(text).contains("Do not recommend the same wording, the same frame, or a simpler variant of what already appears in the learner answer.");
        assertThat(text).contains("At least 2 refinementExpressions should be content-bearing expansions tied to the learner's actual answer, not just generic discourse markers.");
        assertThat(text).contains("Use generic discourse markers such as \"On the positive side\", \"However\", or \"Overall\" only when they add clear value and do not let them dominate the list.");
        assertThat(text).contains("Use prompt hints as idea sources, not text to copy. Adapt or upgrade them to fit this learner, and avoid repeating a hint that overlaps with the learner answer.");
        assertThat(text).contains("Prompt coaching strategy:");
        assertThat(text).contains("Primary answer mode: GOAL_PLAN");
        assertThat(text).contains("Soft-prefer these expression families when they fit the learner answer: goal, plan, process.");
        assertThat(text).contains("- [STRUCTURE] I plan to do this by [verb]ing [method].");
    }

    @Test
    @SuppressWarnings("unchecked")
    void normalizeInlineFeedback_returns_empty_when_response_only_contains_keep_segments() {
        OpenAiFeedbackClient client = new OpenAiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses"
        );

        List<InlineFeedbackSegmentDto> result = (List<InlineFeedbackSegmentDto>) ReflectionTestUtils.invokeMethod(
                client,
                "normalizeInlineFeedback",
                "I like pizza.",
                "I like pizza.",
                List.of(new InlineFeedbackSegmentDto("KEEP", "I like pizza.", "I like pizza."))
        );

        assertThat(result).isEmpty();
    }

    @Test
    void parseResponse_reads_used_expressions_and_grammar_feedback_from_openai_payload() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        OpenAiFeedbackClient client = new OpenAiFeedbackClient(
                mapper,
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses"
        );

        String outputText = mapper.writeValueAsString(Map.ofEntries(
                Map.entry("score", 88),
                Map.entry("summary", "\uc694\uc57d"),
                Map.entry("strengths", List.of("\uac15\uc810")),
                Map.entry("corrections", List.of()),
                Map.entry("inlineFeedback", List.of()),
                Map.entry("grammarFeedback", List.of(Map.of(
                        "originalText", "i",
                        "revisedText", "I",
                        "reasonKo", "'I'\ub294 \ud56d\uc0c1 \ub300\ubb38\uc790\ub85c \uc368\uc57c \ud574\uc694."
                ))),
                Map.entry("correctedAnswer", "I want to speak English fluently."),
                Map.entry("usedExpressions", List.of(Map.of(
                        "expression", "I want to speak English fluently",
                        "usageTip", "\ubaa9\ud45c\ub97c \ubd84\uba85\ud558\uac8c \ub9d0\ud560 \ub54c \uc790\uc5f0\uc2a4\ub7fd\uac8c \uc4f4 \ud45c\ud604\uc774\uc5d0\uc694."
                ))),
                Map.entry("refinementExpressions", List.of()),
                Map.entry("modelAnswer", "I want to speak English fluently and practice every day."),
                Map.entry("modelAnswerKo", "\uc601\uc5b4\ub97c \uc720\ucc3d\ud558\uac8c \ub9d0\ud558\uace0 \uc2f6\uc5b4\uc11c \ub9e4\uc77c \uc5f0\uc2b5\ud558\uace0 \uc788\uc5b4\uc694."),
                Map.entry("rewriteChallenge", "\ub2e4\uc74c\uc5d0\ub294 \uc774\uc720\ub97c \ud55c \ubb38\uc7a5 \ub354 \ub36b\ubd99\uc5ec \ubcf4\uc138\uc694.")
        ));
        String body = mapper.writeValueAsString(Map.of("output_text", outputText));

        FeedbackResponseDto response = (FeedbackResponseDto) ReflectionTestUtils.invokeMethod(
                client,
                "parseResponse",
                "prompt-1",
                "I want to speak English fluently.",
                body
        );

        assertThat(response.usedExpressions())
                .extracting(CoachExpressionUsageDto::expression, CoachExpressionUsageDto::usageTip)
                .containsExactly(tuple(
                        "I want to speak English fluently",
                        "\ubaa9\ud45c\ub97c \ubd84\uba85\ud558\uac8c \ub9d0\ud560 \ub54c \uc790\uc5f0\uc2a4\ub7fd\uac8c \uc4f4 \ud45c\ud604\uc774\uc5d0\uc694."
                ));
        assertThat(response.usedExpressions())
                .extracting(CoachExpressionUsageDto::matchedText)
                .containsExactly((String) null);
        assertThat(response.modelAnswerKo()).isEqualTo("\uc601\uc5b4\ub97c \uc720\ucc3d\ud558\uac8c \ub9d0\ud558\uace0 \uc2f6\uc5b4\uc11c \ub9e4\uc77c \uc5f0\uc2b5\ud558\uace0 \uc788\uc5b4\uc694.");
        assertThat(response.grammarFeedback())
                .extracting(item -> item.originalText(), item -> item.revisedText(), item -> item.reasonKo())
                .containsExactly(tuple(
                        "i",
                        "I",
                        "'I'\ub294 \ud56d\uc0c1 \ub300\ubb38\uc790\ub85c \uc368\uc57c \ud574\uc694."
                ));
    }

    @Test
    void parseResponse_reads_refinement_example_translation_from_openai_payload() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        OpenAiFeedbackClient client = new OpenAiFeedbackClient(
                mapper,
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses"
        );

        String outputText = mapper.writeValueAsString(Map.ofEntries(
                Map.entry("score", 88),
                Map.entry("summary", "요약"),
                Map.entry("strengths", List.of("강점")),
                Map.entry("corrections", List.of()),
                Map.entry("inlineFeedback", List.of()),
                Map.entry("grammarFeedback", List.of()),
                Map.entry("correctedAnswer", "I usually rest after lunch."),
                Map.entry("usedExpressions", List.of()),
                Map.entry("refinementExpressions", List.of(Map.of(
                        "expression", "after lunch",
                        "guidanceKo", "시간 표현 뒤에 어떤 활동을 하는지 붙이면 문장이 더 또렷해집니다.",
                        "exampleEn", "I usually rest after lunch.",
                        "exampleKo", "저는 보통 점심 식사 후에 쉬어요.",
                        "meaningKo", "점심 식사 후에"
                ))),
                Map.entry("modelAnswer", "I usually rest after lunch."),
                Map.entry("modelAnswerKo", "저는 보통 점심 식사 후에 쉬어요."),
                Map.entry("rewriteChallenge", "다음에는 이유를 한 문장 더 붙여 보세요.")
        ));
        String body = mapper.writeValueAsString(Map.of("output_text", outputText));

        FeedbackResponseDto response = (FeedbackResponseDto) ReflectionTestUtils.invokeMethod(
                client,
                "parseResponse",
                "prompt-1",
                "I usually rest after lunch.",
                body
        );

        assertThat(response.refinementExpressions())
                .singleElement()
                .satisfies(expression -> {
                    assertThat(expression.exampleEn()).isEqualTo("I usually rest after lunch.");
                    assertThat(expression.exampleKo()).isEqualTo("저는 보통 점심 식사 후에 쉬어요.");
                });
    }
}
