package com.writeloop.service;

import com.writeloop.dto.CorrectionDto;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.PromptDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class OpenAiFeedbackClient {

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String apiKey;
    private final String model;
    private final String apiUrl;

    public OpenAiFeedbackClient(
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

    public FeedbackResponseDto review(PromptDto prompt, String answer) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(apiUrl))
                    .timeout(Duration.ofSeconds(60))
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .POST(HttpRequest.BodyPublishers.ofString(buildRequestBody(prompt, answer)))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 400) {
                throw new IllegalStateException("OpenAI API request failed with status " + response.statusCode());
            }

            return parseResponse(prompt.id(), response.body());
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new IllegalStateException("OpenAI API request failed", exception);
        }
    }

    private String buildRequestBody(PromptDto prompt, String answer) throws IOException {
        Map<String, Object> schema = Map.of(
                "type", "object",
                "additionalProperties", false,
                "properties", Map.of(
                        "score", Map.of("type", "integer"),
                        "summary", Map.of("type", "string"),
                        "strengths", Map.of(
                                "type", "array",
                                "items", Map.of("type", "string")
                        ),
                        "corrections", Map.of(
                                "type", "array",
                                "items", Map.of(
                                        "type", "object",
                                        "additionalProperties", false,
                                        "properties", Map.of(
                                                "issue", Map.of("type", "string"),
                                                "suggestion", Map.of("type", "string")
                                        ),
                                        "required", List.of("issue", "suggestion")
                                )
                        ),
                        "modelAnswer", Map.of("type", "string"),
                        "rewriteChallenge", Map.of("type", "string")
                ),
                "required", List.of(
                        "score",
                        "summary",
                        "strengths",
                        "corrections",
                        "modelAnswer",
                        "rewriteChallenge"
                )
        );

        Map<String, Object> payload = Map.of(
                "model", model,
                "input", buildPrompt(prompt, answer),
                "text", Map.of(
                        "format", Map.of(
                                "type", "json_schema",
                                "name", "english_answer_feedback",
                                "schema", schema,
                                "strict", true
                        )
                )
        );

        return objectMapper.writeValueAsString(payload);
    }

    private String buildPrompt(PromptDto prompt, String answer) {
        return """
                You are an English speaking coach for Korean learners.
                Evaluate the learner answer and return feedback in valid JSON only.

                Rules:
                - Score from 0 to 100.
                - Keep the tone encouraging, specific, and actionable.
                - summary, strengths, corrections.issue, corrections.suggestion, and rewriteChallenge must be written in Korean.
                - Never write English sentences in summary, strengths, corrections.issue, corrections.suggestion, or rewriteChallenge.
                - If you need to mention an English expression, quote only the expression itself and explain it in Korean.
                - modelAnswer must be written in English.
                - strengths should have 2 to 3 concise bullets in Korean.
                - corrections should focus on natural English, grammar, clarity, and expansion.
                - modelAnswer should sound natural for the learner's level.
                - rewriteChallenge should tell the learner how to improve in the next attempt in Korean.

                Prompt topic: %s
                Difficulty: %s
                Question in English: %s
                Question in Korean: %s
                Speaking tip: %s

                Learner answer:
                %s
                """.formatted(
                prompt.topic(),
                prompt.difficulty(),
                prompt.questionEn(),
                prompt.questionKo(),
                prompt.tip(),
                answer
        );
    }

    private FeedbackResponseDto parseResponse(String promptId, String body) throws IOException {
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
            throw new IllegalStateException("OpenAI response did not include structured feedback text");
        }

        JsonNode feedbackNode = objectMapper.readTree(outputText);
        List<String> strengths = new ArrayList<>();
        feedbackNode.path("strengths").forEach(node -> strengths.add(node.asText()));

        List<CorrectionDto> corrections = new ArrayList<>();
        feedbackNode.path("corrections").forEach(node -> corrections.add(
                new CorrectionDto(
                        node.path("issue").asText(),
                        node.path("suggestion").asText()
                )
        ));

        int rawScore = feedbackNode.path("score").asInt();
        String modelAnswer = feedbackNode.path("modelAnswer").asText();
        boolean loopComplete = isLoopComplete(rawScore, corrections);
        String completionMessage = buildCompletionMessage(rawScore, corrections);

        return new FeedbackResponseDto(
                promptId,
                null,
                0,
                rawScore,
                loopComplete,
                completionMessage,
                feedbackNode.path("summary").asText(),
                strengths,
                corrections,
                modelAnswer,
                feedbackNode.path("rewriteChallenge").asText()
        );
    }

    private boolean isLoopComplete(int score, List<CorrectionDto> corrections) {
        return score >= 85 || (score >= 80 && corrections.size() <= 2);
    }

    private String buildCompletionMessage(int score, List<CorrectionDto> corrections) {
        if (!isLoopComplete(score, corrections)) {
            return null;
        }
        return "이 답변은 지금 단계에서 마무리해도 충분해요. 원하면 한 번 더 다시 써 보면서 연습할 수 있어요.";
    }
}
