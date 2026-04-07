package com.writeloop.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.CoachExpressionDto;
import com.writeloop.dto.CoachHelpResponseDto;
import com.writeloop.dto.CoachSelfDiscoveredCandidateDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class OpenAiCoachClient implements CoachLlmEngine {

    private final ObjectMapper objectMapper;
    private final CoachQueryAnalyzer coachQueryAnalyzer;
    private final HttpClient httpClient;
    private final String apiKey;
    private final String model;
    private final String apiUrl;
    private final String reasoningEffort;
    private final int requestTimeoutSeconds;

    public OpenAiCoachClient(
            ObjectMapper objectMapper,
            CoachQueryAnalyzer coachQueryAnalyzer,
            @Value("${openai.api-key:}") String apiKey,
            @Value("${openai.coach-model:${OPENAI_COACH_MODEL:${OPENAI_FEEDBACK_MODEL:${OPENAI_MODEL:gpt-5-mini}}}}") String model,
            @Value("${openai.api-url:https://api.openai.com/v1/responses}") String apiUrl,
            @Value("${openai.coach-reasoning-effort:${OPENAI_COACH_REASONING_EFFORT:${OPENAI_FEEDBACK_REASONING_EFFORT:}}}") String reasoningEffort,
            @Value("${openai.coach-request-timeout-seconds:${OPENAI_COACH_REQUEST_TIMEOUT_SECONDS:${OPENAI_FEEDBACK_REQUEST_TIMEOUT_SECONDS:120}}}") int requestTimeoutSeconds
    ) {
        this.objectMapper = objectMapper;
        this.coachQueryAnalyzer = coachQueryAnalyzer;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .build();
        this.apiKey = apiKey;
        this.model = model;
        this.apiUrl = apiUrl;
        this.reasoningEffort = reasoningEffort;
        this.requestTimeoutSeconds = requestTimeoutSeconds;
    }

    @Override
    public String provider() {
        return "openai";
    }

    @Override
    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    @Override
    public String configuredModel() {
        return model;
    }

    @Override
    public CoachHelpResponseDto help(PromptDto prompt, String userQuestion, List<PromptHintDto> hints) {
        try {
            String responseBody = sendResponsesRequest(buildRequestBody(prompt, userQuestion, hints));
            return parseResponse(prompt.id(), userQuestion, responseBody);
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new IllegalStateException("OpenAI coach API request failed", exception);
        }
    }

    @Override
    public String translateMeaningSlot(
            PromptDto prompt,
            String userQuestion,
            CoachQueryAnalyzer.ActionFamily family,
            CoachQueryAnalyzer.MeaningSlot slot,
            String sourceText
    ) {
        if (!isConfigured() || sourceText == null || sourceText.isBlank()) {
            return "";
        }

        try {
            String responseBody = sendResponsesRequest(
                    buildSlotTranslationRequestBody(prompt, userQuestion, family, slot, sourceText)
            );
            return parseSlotTranslationResponse(responseBody);
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            return "";
        } catch (RuntimeException exception) {
            return "";
        }
    }

    @Override
    public List<CoachSelfDiscoveredCandidateDto> extractSelfDiscoveredExpressions(
            PromptDto prompt,
            String answer,
            List<String> recommendedExpressions,
            List<String> preservedSegments
    ) {
        if (!isConfigured() || answer == null || answer.isBlank()) {
            return List.of();
        }

        try {
            String responseBody = sendResponsesRequest(
                    buildSelfDiscoveredExtractionRequestBody(prompt, answer, recommendedExpressions, preservedSegments)
            );
            return parseSelfDiscoveredExtractionResponse(responseBody);
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            return List.of();
        } catch (RuntimeException exception) {
            return List.of();
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

        return buildStructuredRequestBody(
                buildPrompt(prompt, userQuestion, hints),
                "english_expression_coach",
                schema
        );
    }

    private String buildPrompt(PromptDto prompt, String userQuestion, List<PromptHintDto> hints) {
        CoachQueryAnalyzer.CoachQueryAnalysis analysis = coachQueryAnalyzer.analyze(prompt, userQuestion);
        String intentCategories = String.join(", ", analysis.intents().stream().map(CoachQueryAnalyzer.IntentCategory::key).toList());
        CoachQueryAnalyzer.QueryMode queryMode = analysis.queryMode();
        boolean starterIntent = analysis.intents().contains(CoachQueryAnalyzer.IntentCategory.STARTER);
        String targetMeaning = analysis.lookup()
                .map(spec -> spec.frame().surfaceMeaning())
                .orElse("");
        String coachProfileText = PromptOpenAiContextFormatter.formatCoachProfile(prompt);
        String hintText = PromptOpenAiContextFormatter.formatPromptHints(hints);

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
                - Treat the prompt coaching profile as supporting context for category, tone, starter style, and preferred expression families.
                - If the learner request is short or ambiguous, use the prompt coaching profile to choose more fitting expressions.
                - Avoid expression families listed in the prompt coaching profile unless the learner explicitly asks for them or they are necessary for a correct answer.
                - If the learner is asking how to say a Korean meaning in English, infer the exact target meaning first.
                - For meaning-lookup questions, recommend close, natural English expressions around that meaning.
                - For meaning-lookup questions, do not switch to generic topic starters unless they directly express the requested meaning.
                - For meaning-lookup questions, make the expressions distinct in nuance, not repetitive.
                - For idea-support questions, recommend concrete answer ideas the learner can adapt for this prompt.
                - For idea-support questions, do not answer with only generic starters like "One reason is that ..." or "For example, ...".
                - For idea-support questions, each expression should contain an actual content point, reason, example, or claim tied to the prompt topic.
                %s
                - Prefer short, reusable chunks over long sentences.
                - sourceHintType should be the hint type name if the expression comes from a hint, otherwise "COACH".
                - Keep the tone encouraging and practical.

                Prompt topic: %s
                Difficulty: %s
                Question in English: %s
                Question in Korean: %s
                Prompt tip: %s
                Prompt coaching profile:
                %s
                Learner question: %s
                Learner query mode: %s
                Core meaning to express: %s
                Detected learner intent categories: %s
                Prompt hints:
                %s
                """.formatted(
                starterIntent
                        ? "- If the learner asks for a first-sentence starter, recommend only opener expressions or opener sentences for the very first sentence. Exclude conclusion phrases, contrast markers, example linkers, detail markers, and body-paragraph transitions."
                        : "",
                prompt.topic(),
                prompt.difficulty(),
                prompt.questionEn(),
                prompt.questionKo(),
                prompt.tip(),
                coachProfileText,
                userQuestion == null ? "" : userQuestion,
                queryMode.name().toLowerCase(Locale.ROOT),
                targetMeaning.isBlank() ? "none" : targetMeaning,
                intentCategories.isBlank() ? "none" : intentCategories,
                hintText
        );
    }

    private String buildSlotTranslationRequestBody(
            PromptDto prompt,
            String userQuestion,
            CoachQueryAnalyzer.ActionFamily family,
            CoachQueryAnalyzer.MeaningSlot slot,
            String sourceText
    ) throws IOException {
        Map<String, Object> schema = Map.of(
                "type", "object",
                "additionalProperties", false,
                "properties", Map.of(
                        "englishText", Map.of("type", "string")
                ),
                "required", List.of("englishText")
        );

        String promptText = """
                You are helping a Korean learner express one specific meaning in English.
                Translate only the requested slot into concise, natural English.

                Rules:
                - Return valid JSON only.
                - The value must be short and reusable.
                - Do not explain anything.
                - Do not return a full sentence unless the slot itself is a sentence-like topic.
                - Keep noun targets as noun phrases or canonical labels when possible.
                - Keep topic slots as natural English chunks that can be inserted into a sentence.
                - Keep qualifier slots as a short adjective or short descriptive phrase.
                - Use the prompt coaching profile only as supporting context when the slot meaning is ambiguous.

                Prompt topic: %s
                Prompt question: %s
                Prompt coaching profile:
                %s
                Learner question: %s
                Meaning family: %s
                Slot type: %s
                Source text: %s
                """.formatted(
                prompt.topic(),
                prompt.questionEn(),
                PromptOpenAiContextFormatter.formatCoachProfile(prompt),
                userQuestion == null ? "" : userQuestion,
                family.name().toLowerCase(Locale.ROOT),
                slot.name().toLowerCase(Locale.ROOT),
                sourceText
        );

        return buildStructuredRequestBody(
                promptText,
                "english_slot_translation",
                schema
        );
    }

    private String buildSelfDiscoveredExtractionRequestBody(
            PromptDto prompt,
            String answer,
            List<String> recommendedExpressions,
            List<String> preservedSegments
    ) throws IOException {
        Map<String, Object> schema = Map.of(
                "type", "object",
                "additionalProperties", false,
                "properties", Map.of(
                        "candidates", Map.of(
                                "type", "array",
                                "maxItems", 3,
                                "items", Map.of(
                                        "type", "object",
                                        "additionalProperties", false,
                                        "properties", Map.of(
                                                "matchedSpan", Map.of("type", "string"),
                                                "usageTip", Map.of("type", "string"),
                                                "confidence", Map.of(
                                                        "type", "string",
                                                        "enum", List.of("HIGH", "MEDIUM", "LOW")
                                                )
                                        ),
                                        "required", List.of("matchedSpan", "usageTip", "confidence")
                                )
                        )
                ),
                "required", List.of("candidates")
        );

        String promptText = """
                You are reviewing an English learner's submitted answer.
                Find short English expressions that the learner used well on their own.
                Return valid JSON only.

                Rules:
                - Return at most 3 candidates.
                - Each matchedSpan must be an exact span copied from the learner answer.
                - Do not invent or paraphrase a new expression.
                - Prefer reusable chunks, not a full long sentence.
                - Exclude any span that is the same as a recommended expression or only a trivial variation of it.
                - If no good self-discovered expression exists, return an empty array.
                - usageTip must be written in Korean.
                - confidence should reflect how clearly this is a reusable, well-used expression.

                Prompt topic: %s
                Prompt difficulty: %s
                Prompt question (EN): %s
                Prompt question (KO): %s
                Prompt tip: %s

                Recommended expressions:
                %s

                Feedback KEEP segments:
                %s

                Learner answer:
                %s
                """.formatted(
                prompt.topic(),
                prompt.difficulty(),
                prompt.questionEn(),
                prompt.questionKo(),
                prompt.tip(),
                recommendedExpressions == null || recommendedExpressions.isEmpty()
                        ? "- none"
                        : recommendedExpressions.stream().map(expression -> "- " + expression).reduce((a, b) -> a + "\n" + b).orElse("- none"),
                preservedSegments == null || preservedSegments.isEmpty()
                        ? "- none"
                        : preservedSegments.stream().map(segment -> "- " + segment).reduce((a, b) -> a + "\n" + b).orElse("- none"),
                answer
        );

        return buildStructuredRequestBody(
                promptText,
                "english_self_discovered_expressions",
                schema
        );
    }

    private String buildStructuredRequestBody(String promptText, String schemaName, Map<String, Object> schema) throws IOException {
        return OpenAiStructuredOutputSupport.buildResponsesRequestBody(
                objectMapper,
                model,
                promptText,
                schemaName,
                schema,
                reasoningEffort
        );
    }

    private String sendResponsesRequest(String requestBody) throws IOException, InterruptedException {
        HttpRequest request = OpenAiStructuredOutputSupport.buildResponsesRequest(
                apiUrl,
                apiKey,
                requestBody,
                requestTimeoutSeconds
        );

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 400) {
            throw new IllegalStateException("OpenAI coach API request failed with status " + response.statusCode());
        }
        return response.body();
    }

    private String extractStructuredOutputText(String body) throws IOException {
        return OpenAiStructuredOutputSupport.extractStructuredOutputText(objectMapper, body);
    }

    private String parseSlotTranslationResponse(String body) throws IOException {
        JsonNode node = objectMapper.readTree(extractStructuredOutputText(body));
        return normalizeSlotTranslation(node.path("englishText").asText(""));
    }

    private List<CoachSelfDiscoveredCandidateDto> parseSelfDiscoveredExtractionResponse(String body) throws IOException {
        JsonNode node = objectMapper.readTree(extractStructuredOutputText(body));
        List<CoachSelfDiscoveredCandidateDto> candidates = new ArrayList<>();
        node.path("candidates").forEach(candidate -> candidates.add(
                new CoachSelfDiscoveredCandidateDto(
                        normalizeSlotTranslation(candidate.path("matchedSpan").asText("")),
                        candidate.path("usageTip").asText(""),
                        candidate.path("confidence").asText("LOW")
                )
        ));
        return candidates;
    }

    private String normalizeSlotTranslation(String value) {
        String normalized = value == null ? "" : value.trim();
        normalized = normalized.replaceAll("^[\"']+|[\"']+$", "");
        normalized = normalized.replaceAll("\\s+", " ").trim();
        normalized = normalized.replaceAll("[.?!]+$", "");
        return normalized;
    }

    private CoachHelpResponseDto parseResponse(String promptId, String userQuestion, String body) throws IOException {
        JsonNode coachNode = objectMapper.readTree(extractStructuredOutputText(body));
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
