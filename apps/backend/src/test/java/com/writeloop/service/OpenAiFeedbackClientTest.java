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

        assertThat(text).contains("Korean fields: summary, strengths, corrections.issue, corrections.suggestion, rewriteChallenge, grammarFeedback.reasonKo, and any refinementExpressions.guidance or meaningKo when present.");
        assertThat(text).contains("English fields: correctedAnswer, modelAnswer, inlineFeedback.originalText, inlineFeedback.revisedText, grammarFeedback.originalText, grammarFeedback.revisedText, refinementExpressions.expression, and refinementExpressions.example.");
        assertThat(text).contains("inlineFeedback is only for local sentence correction: grammar, word choice, agreement, article, determiner, preposition, capitalization, and punctuation.");
        assertThat(text).contains("inlineFeedback may be an empty array when the learner answer is already locally grammatical and natural enough.");
        assertThat(text).contains("Do not use inlineFeedback for new ideas, extra reasons, examples, plans, or broader content expansion.");
        assertThat(text).contains("Allowed inlineFeedback types: KEEP, REPLACE, ADD, REMOVE.");
        assertThat(text).contains("ADD should usually be a short local insertion such as an article, preposition, pronoun, auxiliary, connector, or punctuation mark, not a full new clause or sentence.");
        assertThat(text).contains("corrections should focus only on non-grammar coaching");
        assertThat(text).contains("Each corrections.issue and corrections.suggestion must contain Korean text, not English-only text.");
        assertThat(text).contains("Do not repeat grammar explanations in corrections when they are already covered in grammarFeedback.");
        assertThat(text).contains("If there is no meaningful non-grammar coaching point beyond grammarFeedback, corrections may be an empty array.");
        assertThat(text).contains("grammarFeedback should contain only real local grammar or mechanics issues");
        assertThat(text).contains("Each grammarFeedback item must include originalText, revisedText, and reasonKo.");
        assertThat(text).contains("usedExpressions should contain 1 to 3 short English chunks that the learner already used naturally and correctly in the learner answer.");
        assertThat(text).contains("Each usedExpressions item must include expression and usageTip.");
        assertThat(text).contains("Each refinement item must include guidance and example.");
        assertThat(text).contains("guidance must be one full Korean coaching sentence that explains when or how to use the expression, not just a gloss.");
        assertThat(text).contains("example must be a short clean English usage snippet or sentence, must be different from expression, and should place a word or short phrase inside a natural sentence.");
        assertThat(text).contains("meaningKo should be a short Korean gloss only for a single word or short lexical phrase; otherwise it may be null.");
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
    @SuppressWarnings("unchecked")
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
                Map.entry("summary", "요약"),
                Map.entry("strengths", List.of("강점")),
                Map.entry("corrections", List.of()),
                Map.entry("inlineFeedback", List.of()),
                Map.entry("grammarFeedback", List.of(Map.of(
                        "originalText", "i",
                        "revisedText", "I",
                        "reasonKo", "'I'는 항상 대문자로 써야 해요."
                ))),
                Map.entry("correctedAnswer", "I want to speak English fluently."),
                Map.entry("usedExpressions", List.of(Map.of(
                        "expression", "I want to speak English fluently",
                        "usageTip", "목표를 분명하게 말할 때 자연스럽게 쓸 수 있어요."
                ))),
                Map.entry("refinementExpressions", List.of()),
                Map.entry("modelAnswer", "I want to speak English fluently and practice every day."),
                Map.entry("rewriteChallenge", "다음에는 이유를 한 문장 더 덧붙여 보세요.")
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
                        "목표를 분명하게 말할 때 자연스럽게 쓸 수 있어요."
                ));
        assertThat(response.usedExpressions())
                .extracting(CoachExpressionUsageDto::matchedText)
                .containsExactly((String) null);
        assertThat(response.grammarFeedback())
                .extracting(item -> item.originalText(), item -> item.revisedText(), item -> item.reasonKo())
                .containsExactly(tuple(
                        "i",
                        "I",
                        "'I'는 항상 대문자로 써야 해요."
                ));
    }
}
