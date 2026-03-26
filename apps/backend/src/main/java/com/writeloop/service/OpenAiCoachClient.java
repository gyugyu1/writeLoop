package com.writeloop.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.CoachExpressionDto;
import com.writeloop.dto.CoachHelpResponseDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;
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
import java.text.Normalizer;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

@Service
public class OpenAiCoachClient {

    private static final Pattern NON_WORD_PATTERN = Pattern.compile("[^\\p{L}\\p{N}\\s']");

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String apiKey;
    private final String model;
    private final String apiUrl;

    public OpenAiCoachClient(
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

    public CoachHelpResponseDto help(PromptDto prompt, String userQuestion, List<PromptHintDto> hints) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(apiUrl))
                    .timeout(Duration.ofSeconds(60))
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .POST(HttpRequest.BodyPublishers.ofString(buildRequestBody(prompt, userQuestion, hints)))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 400) {
                throw new IllegalStateException("OpenAI coach API request failed with status " + response.statusCode());
            }

            return parseResponse(prompt.id(), userQuestion, response.body());
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new IllegalStateException("OpenAI coach API request failed", exception);
        }
    }

    private String buildRequestBody(PromptDto prompt, String userQuestion, List<PromptHintDto> hints)
            throws IOException {
        Map<String, Object> schema = Map.of(
                "type", "object",
                "additionalProperties", false,
                "properties", Map.of(
                        "coachReply", Map.of("type", "string"),
                        "expressions", Map.of(
                                "type", "array",
                                "minItems", 3,
                                "maxItems", 5,
                                "items", Map.of(
                                        "type", "object",
                                        "additionalProperties", false,
                                        "properties", Map.of(
                                                "expression", Map.of("type", "string"),
                                                "meaningKo", Map.of("type", "string"),
                                                "usageTip", Map.of("type", "string"),
                                                "example", Map.of("type", "string"),
                                                "sourceHintType", Map.of("type", "string")
                                        ),
                                        "required", List.of(
                                                "expression",
                                                "meaningKo",
                                                "usageTip",
                                                "example",
                                                "sourceHintType"
                                        )
                                )
                        )
                ),
                "required", List.of("coachReply", "expressions")
        );

        Map<String, Object> payload = Map.of(
                "model", model,
                "input", buildPrompt(prompt, userQuestion, hints),
                "text", Map.of(
                        "format", Map.of(
                                "type", "json_schema",
                                "name", "english_expression_coach",
                                "schema", schema,
                                "strict", true
                        )
                )
        );

        return objectMapper.writeValueAsString(payload);
    }

    private String buildPrompt(PromptDto prompt, String userQuestion, List<PromptHintDto> hints) {
        String intentCategories = String.join(", ", inferLearnerIntentCategories(prompt, userQuestion));
        boolean expressionLookup = isExpressionLookupQuestion(userQuestion);
        String targetMeaning = expressionLookup ? extractExpressionLookupTarget(userQuestion) : "";
        StringBuilder hintText = new StringBuilder();
        for (PromptHintDto hint : hints) {
            hintText.append("- [")
                    .append(hint.hintType())
                    .append("] ")
                    .append(hint.content())
                    .append('\n');
        }

        return """
                You are a helpful English expression coach for Korean learners.
                Return valid JSON only.

                Rules:
                - coachReply, meaningKo, usageTip must be written in Korean.
                - expression and example must be written in English.
                - Recommend 3 to 5 expressions that the learner can realistically use right now.
                - Prioritize the learner's explicit intent over prompt hints.
                - Only reuse a prompt hint if it matches the detected learner intent.
                - If the learner intent is unclear, prompt hints may be used as support.
                - If the learner is asking how to say a Korean meaning in English, infer the exact target meaning first.
                - For meaning-lookup questions, recommend close, natural English expressions around that meaning.
                - For meaning-lookup questions, do not switch to generic topic starters unless they directly express the requested meaning.
                - For meaning-lookup questions, make the expressions distinct in nuance, not repetitive.
                - Prefer short, reusable chunks over long sentences.
                - sourceHintType should be the hint type name if the expression comes from a hint, otherwise "COACH".
                - Keep the tone encouraging and practical.

                Prompt topic: %s
                Difficulty: %s
                Question in English: %s
                Question in Korean: %s
                Prompt tip: %s
                Learner question: %s
                Learner query mode: %s
                Core meaning to express: %s
                Detected learner intent categories: %s
                Prompt hints:
                %s
                """.formatted(
                prompt.topic(),
                prompt.difficulty(),
                prompt.questionEn(),
                prompt.questionKo(),
                prompt.tip(),
                userQuestion == null ? "" : userQuestion,
                expressionLookup ? "meaning_lookup" : "writing_support",
                targetMeaning.isBlank() ? "none" : targetMeaning,
                intentCategories.isBlank() ? "none" : intentCategories,
                hintText
        );
    }

    private List<String> inferLearnerIntentCategories(PromptDto prompt, String userQuestion) {
        List<String> userCategories = inferCategories(userQuestion);
        if (!userCategories.isEmpty()) {
            return userCategories;
        }

        return inferCategories(prompt.questionEn() + " " + prompt.questionKo() + " " + prompt.tip());
    }

    private boolean isExpressionLookupQuestion(String userQuestion) {
        String normalized = normalizeText(userQuestion);
        if (normalized.isBlank()) {
            return false;
        }

        if (containsAny(
                normalized,
                "\uC601\uC5B4\uB85C", "\uD45C\uD604", "\uB9D0\uD558\uACE0 \uC2F6", "\uC5B4\uB5BB\uAC8C \uB9D0",
                "\uBB50\uB77C\uACE0", "\uB77C\uACE0 \uB9D0", "\uB77C\uACE0 \uD558\uACE0", "\uB2E8\uC5B4",
                "how do i say", "want to say", "expression", "phrase", "word")) {
            return true;
        }

        return normalized.split("\\s+").length <= 2;
    }

    private String extractExpressionLookupTarget(String userQuestion) {
        String normalized = normalizeText(userQuestion);
        if (normalized.isBlank()) {
            return "";
        }

        String extracted = normalized
                .replace("\uC601\uC5B4\uB85C", " ")
                .replace("\uD45C\uD604", " ")
                .replace("\uB9D0\uD558\uACE0 \uC2F6\uC5B4", " ")
                .replace("\uB9D0\uD558\uACE0 \uC2F6", " ")
                .replace("\uC5B4\uB5BB\uAC8C \uB9D0", " ")
                .replace("\uBB50\uB77C\uACE0", " ")
                .replace("\uB77C\uACE0 \uB9D0", " ")
                .replace("\uB77C\uACE0 \uD558\uACE0", " ")
                .replace("\uB2E8\uC5B4", " ")
                .replace("how do i say", " ")
                .replace("want to say", " ")
                .replace("expression", " ")
                .replace("phrase", " ")
                .replace("word", " ")
                .replaceAll("\\s+", " ")
                .trim();

        return extracted.isBlank() ? normalized : extracted;
    }

    private List<String> inferCategories(String text) {
        String normalized = normalizeText(text);
        List<String> categories = new ArrayList<>();

        if (containsAny(normalized,
                "why", "reason", "because", "since", "so that", "one reason is that",
                "이유", "왜", "왜냐하면", "때문", "근거")) {
            categories.add("reason");
        }
        if (containsAny(normalized,
                "example", "for instance", "for example", "such as", "specifically",
                "예시", "예를 들어", "예를들어", "예로", "경험")) {
            categories.add("example");
        }
        if (containsAny(normalized,
                "think", "opinion", "believe", "i feel", "in my opinion", "i think",
                "의견", "생각", "입장", "주장")) {
            categories.add("opinion");
        }
        if (containsAny(normalized,
                "compare", "different", "similar", "on the other hand", "whereas",
                "비교", "차이", "반면", "반대로")) {
            categories.add("comparison");
        }
        if (containsAny(normalized,
                "usually", "every day", "habit", "routine", "often",
                "습관", "루틴", "평소", "주말", "보통", "자주", "매일")) {
            categories.add("habit");
        }
        if (containsAny(normalized,
                "future", "plan", "goal", "long run", "in the long run", "this year",
                "계획", "목표", "앞으로", "장기", "장기적")) {
            categories.add("future");
        }
        if (containsAny(normalized,
                "detail", "specific", "specifically", "more clearly", "explain",
                "구체", "자세히", "설명", "풀어서")) {
            categories.add("detail");
        }
        if (containsAny(normalized,
                "balance", "on the one hand", "on the other hand", "overall",
                "균형", "한편", "다른 한편", "전체적으로", "종합")) {
            categories.add("balance");
        }

        return categories;
    }

    private boolean containsAny(String source, String... tokens) {
        for (String token : tokens) {
            if (source.contains(token)) {
                return true;
            }
        }
        return false;
    }

    private String normalizeText(String value) {
        if (value == null) {
            return "";
        }

        String normalized = Normalizer.normalize(value, Normalizer.Form.NFKC);
        normalized = normalized.toLowerCase(Locale.ROOT);
        normalized = NON_WORD_PATTERN.matcher(normalized).replaceAll(" ");
        normalized = normalized.replaceAll("\\s+", " ").trim();
        return normalized;
    }

    private CoachHelpResponseDto parseResponse(String promptId, String userQuestion, String body) throws IOException {
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
            throw new IllegalStateException("OpenAI coach response did not include structured text");
        }

        JsonNode coachNode = objectMapper.readTree(outputText);
        List<CoachExpressionDto> expressions = new ArrayList<>();
        coachNode.path("expressions").forEach(node -> expressions.add(
                new CoachExpressionDto(
                        node.path("expression").asText(),
                        node.path("meaningKo").asText(),
                        node.path("usageTip").asText(),
                        node.path("example").asText(),
                        node.path("sourceHintType").asText("COACH")
                )
        ));

        return new CoachHelpResponseDto(
                promptId,
                userQuestion,
                coachNode.path("coachReply").asText(),
                expressions
        );
    }
}
