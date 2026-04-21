package com.writeloop.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.CoachHelpResponseDto;
import com.writeloop.dto.PromptDto;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class GeminiCoachClientTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void buildRequestBody_requires_tags_in_expression_schema() throws Exception {
        GeminiCoachClient client = new GeminiCoachClient(
                objectMapper,
                new CoachQueryAnalyzer(),
                "test-key",
                "gemini-3.1-flash-lite-preview",
                "https://generativelanguage.googleapis.com/v1beta/models"
        );

        String requestBody = ReflectionTestUtils.invokeMethod(
                client,
                "buildRequestBody",
                samplePrompt(),
                "친구랑 자주 연락한다고 영어로 말하고 싶어",
                List.of()
        );

        JsonNode request = objectMapper.readTree(requestBody);
        JsonNode expressionProperties = request.path("generationConfig")
                .path("responseJsonSchema")
                .path("properties")
                .path("expressions")
                .path("items")
                .path("properties");
        String promptText = request.path("contents").get(0).path("parts").get(0).path("text").asText("");

        assertThat(expressionProperties.path("tags").isMissingNode()).isFalse();
        assertThat(promptText)
                .contains("expressions.tags must contain 2 to 6 tags")
                .contains("coach_recommendation");
    }

    @Test
    void parseResponse_reads_and_normalizes_tags() throws Exception {
        GeminiCoachClient client = new GeminiCoachClient(
                objectMapper,
                new CoachQueryAnalyzer(),
                "test-key",
                "gemini-3.1-flash-lite-preview",
                "https://generativelanguage.googleapis.com/v1beta/models"
        );

        String outputText = objectMapper.writeValueAsString(Map.of(
                "coachReply", "이 표현들이 자연스럽게 잘 맞아요.",
                "expressions", List.of(Map.of(
                        "expression", "keep in touch",
                        "meaningKo", "연락을 계속하다",
                        "usageTip", "친구나 지인과 연락을 이어 갈 때 좋아요.",
                        "example", "I try to keep in touch with my close friends.",
                        "sourceHintType", "COACH",
                        "tags", List.of("coach", "relationship")
                ))
        ));
        String body = objectMapper.writeValueAsString(Map.of("output_text", outputText));

        CoachHelpResponseDto response = (CoachHelpResponseDto) ReflectionTestUtils.invokeMethod(
                client,
                "parseResponse",
                "prompt-1",
                "친구랑 자주 연락한다고 영어로 말하고 싶어",
                body
        );

        assertThat(response.expressions()).singleElement().satisfies(expression -> {
            assertThat(expression.expression()).isEqualTo("keep in touch");
            assertThat(expression.tags()).containsExactly("coach_recommendation", "relationship");
        });
    }

    private PromptDto samplePrompt() {
        return new PromptDto(
                "prompt-1",
                "Relationship",
                "EASY",
                "How do you stay in touch with your friends?",
                "친구들과 어떻게 연락을 이어 가나요?",
                "Mention one or two habits."
        );
    }
}
