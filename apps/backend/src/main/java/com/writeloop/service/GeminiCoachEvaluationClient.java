package com.writeloop.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.persistence.CoachEvaluationStatus;
import com.writeloop.persistence.CoachInteractionEntity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

@Service
public class GeminiCoachEvaluationClient {

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String apiKey;
    private final String model;
    private final String apiUrl;

    public GeminiCoachEvaluationClient(
            ObjectMapper objectMapper,
            @Value("${gemini.api-key:}") String apiKey,
            @Value("${gemini.model:gemini-2.5-flash}") String model,
            @Value("${gemini.api-url:https://generativelanguage.googleapis.com/v1beta/models}") String apiUrl
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
            HttpRequest request = GeminiStructuredOutputSupport.buildGenerateContentRequest(
                    apiUrl,
                    apiKey,
                    model,
                    buildRequestBody(interaction)
            );

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 400) {
                throw new IllegalStateException("Gemini coach evaluation request failed with status " + response.statusCode());
            }

            return parseResponse(response.body());
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new IllegalStateException("Gemini coach evaluation request failed", exception);
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

        return GeminiStructuredOutputSupport.buildGenerateContentRequestBody(
                objectMapper,
                buildPrompt(interaction),
                schema
        );
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
        String outputText = GeminiStructuredOutputSupport.extractStructuredOutputText(objectMapper, body);

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
