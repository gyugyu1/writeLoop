package com.writeloop.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.persistence.CoachEvaluationStatus;
import com.writeloop.persistence.CoachInteractionEntity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

@Service
public class OpenAiCoachEvaluationClient {

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String apiKey;
    private final String model;
    private final String apiUrl;

    public OpenAiCoachEvaluationClient(
            ObjectMapper objectMapper,
            @Value("${openai.api-key:}") String apiKey,
            @Value("${openai.model:gpt-4o}") String model,
            @Value("${openai.api-url:https://api.openai.com/v1/responses}") String apiUrl
    ) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .build();
        this.apiKey = apiKey;
        this.model = model;
        this.apiUrl = apiUrl;
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    public String configuredModel() {
        return model;
    }

    public CoachEvaluationResult evaluate(CoachInteractionEntity interaction) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(apiUrl))
                    .timeout(Duration.ofSeconds(60))
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .POST(HttpRequest.BodyPublishers.ofString(buildRequestBody(interaction)))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 400) {
                throw new IllegalStateException("OpenAI coach evaluation request failed with status " + response.statusCode());
            }

            return parseResponse(response.body());
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new IllegalStateException("OpenAI coach evaluation request failed", exception);
        }
    }

    private String buildRequestBody(CoachInteractionEntity interaction) throws IOException {
        Map<String, Object> schema = Map.of(
                "type", "object",
                "additionalProperties", false,
                "properties", Map.of(
                        "evaluationStatus", Map.of(
                                "type", "string",
                                "enum", List.of("APPROPRIATE", "INAPPROPRIATE", "NEEDS_REVIEW")
                        ),
                        "score", Map.of("type", "integer"),
                        "verdict", Map.of(
                                "type", "string",
                                "enum", List.of(
                                        "MEANING_MATCH",
                                        "WRITING_SUPPORT_MATCH",
                                        "PARTIAL_MATCH",
                                        "GENERIC_FALLBACK",
                                        "OFF_TARGET",
                                        "AMBIGUOUS_REQUEST",
                                        "INSUFFICIENT_CONTEXT"
                                )
                        ),
                        "summary", Map.of("type", "string"),
                        "issues", Map.of(
                                "type", "array",
                                "items", Map.of("type", "string")
                        ),
                        "improvementAction", Map.of("type", "string")
                ),
                "required", List.of("evaluationStatus", "score", "verdict", "summary", "issues", "improvementAction")
        );

        Map<String, Object> payload = Map.of(
                "model", model,
                "input", buildPrompt(interaction),
                "text", Map.of(
                        "format", Map.of(
                                "type", "json_schema",
                                "name", "coach_answer_evaluation",
                                "schema", schema,
                                "strict", true
                        )
                )
        );

        return objectMapper.writeValueAsString(payload);
    }

    private String buildPrompt(CoachInteractionEntity interaction) {
        return """
                You are reviewing an AI English expression coach response.
                Decide whether the coach answer was appropriate for the learner's actual request.
                Return valid JSON only.

                Evaluation rules:
                - APPROPRIATE: the coach answer clearly matches the learner request and gives useful expressions.
                - INAPPROPRIATE: the coach answer is off-target, generic in the wrong way, or solves a different task.
                - NEEDS_REVIEW: the request is genuinely ambiguous or the answer is only partially aligned.
                - summary, issues, and improvementAction must be written in Korean.
                - score is 0 to 100.
                - verdict should identify the main failure/success pattern.
                - issues should be concise and actionable.

                Prompt topic: %s
                Prompt difficulty: %s
                Prompt question (EN): %s
                Prompt question (KO): %s
                Prompt tip: %s

                Learner question: %s
                Normalized learner question: %s
                Query mode: %s
                Meaning family: %s
                Analysis payload JSON: %s

                Coach reply: %s
                Suggested expressions JSON: %s
                Response source: %s
                Answer snapshot when asking coach: %s
                Usage payload JSON: %s

                Judge whether the coach answer was appropriate for the learner question itself, not just whether the expressions are grammatically fine.
                """.formatted(
                interaction.getPromptTopic(),
                interaction.getPromptDifficulty(),
                interaction.getPromptQuestionEn(),
                interaction.getPromptQuestionKo(),
                interaction.getPromptTip(),
                interaction.getUserQuestion(),
                interaction.getNormalizedQuestion(),
                interaction.getQueryMode(),
                interaction.getMeaningFamily() == null ? "NONE" : interaction.getMeaningFamily(),
                interaction.getAnalysisPayloadJson(),
                interaction.getCoachReply(),
                interaction.getExpressionsJson(),
                interaction.getResponseSource().name(),
                interaction.getAnswerSnapshot() == null ? "" : interaction.getAnswerSnapshot(),
                interaction.getUsagePayloadJson() == null ? "{}" : interaction.getUsagePayloadJson()
        );
    }

    private CoachEvaluationResult parseResponse(String body) throws IOException {
        JsonNode root = objectMapper.readTree(body);
        String outputText = root.path("output_text").asText("");

        if (outputText.isBlank()) {
            JsonNode output = root.path("output");
            if (output.isArray() && !output.isEmpty()) {
                JsonNode content = output.get(0).path("content");
                if (content.isArray() && !content.isEmpty()) {
                    outputText = content.get(0).path("text").asText("");
                }
            }
        }

        if (outputText.isBlank()) {
            throw new IllegalStateException("OpenAI coach evaluation response did not include structured text");
        }

        JsonNode node = objectMapper.readTree(outputText);
        return new CoachEvaluationResult(
                CoachEvaluationStatus.valueOf(node.path("evaluationStatus").asText("NEEDS_REVIEW")),
                node.path("score").asInt(0),
                node.path("verdict").asText("INSUFFICIENT_CONTEXT"),
                node.path("summary").asText("평가 요약을 생성하지 못했습니다."),
                outputText
        );
    }

    public record CoachEvaluationResult(
            CoachEvaluationStatus evaluationStatus,
            int score,
            String verdict,
            String summary,
            String payloadJson
    ) {
    }
}
