package com.writeloop.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpRequest;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class OpenAiStructuredOutputSupport {

    private OpenAiStructuredOutputSupport() {
    }

    static String buildResponsesRequestBody(
            ObjectMapper objectMapper,
            String model,
            String promptText,
            String schemaName,
            Map<String, Object> schema,
            String reasoningEffort
    ) throws IOException {
        Map<String, Object> normalizedSchema = normalizeSchema(schema);
        Map<String, Object> format = new LinkedHashMap<>();
        format.put("type", "json_schema");
        format.put("name", normalizeSchemaName(schemaName));
        format.put("schema", normalizedSchema);
        format.put("strict", true);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", model);
        payload.put("input", List.of(
                Map.of(
                        "role", "developer",
                        "content", List.of(
                                Map.of(
                                        "type", "input_text",
                                        "text", promptText
                                )
                        )
                )
        ));
        payload.put("text", Map.of("format", format));

        if (reasoningEffort != null && !reasoningEffort.isBlank()) {
            payload.put("reasoning", Map.of("effort", reasoningEffort.trim()));
        }

        return objectMapper.writeValueAsString(payload);
    }

    static HttpRequest buildResponsesRequest(
            String apiUrl,
            String apiKey,
            String requestBody,
            int requestTimeoutSeconds
    ) {
        return HttpRequest.newBuilder()
                .uri(resolveResponsesUri(apiUrl))
                .timeout(Duration.ofSeconds(requestTimeoutSeconds))
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
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
        if (output.isArray()) {
            StringBuilder builder = new StringBuilder();
            for (JsonNode item : output) {
                if (!"message".equals(item.path("type").asText(""))) {
                    continue;
                }
                JsonNode content = item.path("content");
                if (!content.isArray()) {
                    continue;
                }
                for (JsonNode part : content) {
                    if (!"output_text".equals(part.path("type").asText(""))) {
                        continue;
                    }
                    String text = part.path("text").asText("");
                    if (!text.isBlank()) {
                        if (builder.length() > 0) {
                            builder.append('\n');
                        }
                        builder.append(text);
                    }
                }
            }
            if (builder.length() > 0) {
                return builder.toString();
            }
        }

        throw new IllegalStateException("OpenAI response did not include structured text");
    }

    private static URI resolveResponsesUri(String apiUrl) {
        String trimmed = apiUrl == null ? "" : apiUrl.trim();
        if (trimmed.isBlank()) {
            trimmed = "https://api.openai.com/v1/responses";
        }
        return URI.create(trimmed);
    }

    private static String normalizeSchemaName(String schemaName) {
        String normalized = schemaName == null || schemaName.isBlank()
                ? "feedback_response"
                : schemaName.trim().replaceAll("[^A-Za-z0-9_-]", "_");
        if (normalized.length() <= 64) {
            return normalized;
        }
        return normalized.substring(0, 64);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> normalizeSchema(Map<String, Object> schema) {
        Map<String, Object> normalized = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : schema.entrySet()) {
            normalized.put(entry.getKey(), normalizeSchemaNode(entry.getValue()));
        }

        Object propertiesNode = normalized.get("properties");
        if (propertiesNode instanceof Map<?, ?> propertiesMap) {
            List<String> required = new java.util.ArrayList<>();
            for (Object key : propertiesMap.keySet()) {
                required.add(String.valueOf(key));
            }
            normalized.put("required", required);
        }

        return normalized;
    }

    @SuppressWarnings("unchecked")
    private static Object normalizeSchemaNode(Object node) {
        if (node instanceof Map<?, ?> mapNode) {
            return normalizeSchema((Map<String, Object>) mapNode);
        }
        if (node instanceof List<?> listNode) {
            List<Object> normalizedList = new java.util.ArrayList<>(listNode.size());
            for (Object item : listNode) {
                normalizedList.add(normalizeSchemaNode(item));
            }
            return normalizedList;
        }
        return node;
    }
}
