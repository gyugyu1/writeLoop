package com.writeloop.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpRequest;
import java.time.Duration;
import java.util.List;
import java.util.Map;

final class GeminiStructuredOutputSupport {

    private GeminiStructuredOutputSupport() {
    }

    static String buildGenerateContentRequestBody(
            ObjectMapper objectMapper,
            String promptText,
            Map<String, Object> schema
    ) throws IOException {
        Map<String, Object> payload = Map.of(
                "contents", List.of(
                        Map.of(
                                "parts", List.of(
                                        Map.of("text", promptText)
                                )
                        )
                ),
                "generationConfig", Map.of(
                        "responseMimeType", "application/json",
                        "responseJsonSchema", schema
                )
        );
        return objectMapper.writeValueAsString(payload);
    }

    static HttpRequest buildGenerateContentRequest(
            String apiUrl,
            String apiKey,
            String model,
            String requestBody
    ) {
        return HttpRequest.newBuilder()
                .uri(resolveGenerateContentUri(apiUrl, model))
                .timeout(Duration.ofSeconds(60))
                .header("x-goog-api-key", apiKey)
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();
    }

    static String extractStructuredOutputText(ObjectMapper objectMapper, String body) throws IOException {
        JsonNode root = objectMapper.readTree(body);

        String outputText = root.path("output_text").asText("");
        if (!outputText.isBlank()) {
            return outputText;
        }

        JsonNode output = root.path("output");
        if (output.isArray() && !output.isEmpty()) {
            JsonNode content = output.get(0).path("content");
            if (content.isArray() && !content.isEmpty()) {
                String legacyText = content.get(0).path("text").asText("");
                if (!legacyText.isBlank()) {
                    return legacyText;
                }
            }
        }

        JsonNode candidates = root.path("candidates");
        if (candidates.isArray() && !candidates.isEmpty()) {
            JsonNode parts = candidates.get(0).path("content").path("parts");
            if (parts.isArray()) {
                for (JsonNode part : parts) {
                    String text = part.path("text").asText("");
                    if (!text.isBlank()) {
                        return text;
                    }
                }
            }
        }

        throw new IllegalStateException("Gemini response did not include structured text");
    }

    private static URI resolveGenerateContentUri(String apiUrl, String model) {
        String trimmed = apiUrl == null ? "" : apiUrl.trim();
        if (trimmed.isBlank()) {
            trimmed = "https://generativelanguage.googleapis.com/v1beta/models";
        }
        if (trimmed.contains("%s")) {
            return URI.create(String.format(trimmed, model));
        }
        if (trimmed.contains("{model}")) {
            return URI.create(trimmed.replace("{model}", model));
        }
        String normalized = trimmed.endsWith("/") ? trimmed.substring(0, trimmed.length() - 1) : trimmed;
        if (normalized.endsWith(":generateContent")) {
            return URI.create(normalized);
        }
        if (normalized.endsWith("/models")) {
            return URI.create(normalized + "/" + model + ":generateContent");
        }
        if (normalized.contains("/models/")) {
            if (normalized.endsWith(model)) {
                return URI.create(normalized + ":generateContent");
            }
            return URI.create(normalized);
        }
        return URI.create(normalized + "/" + model + ":generateContent");
    }
}
