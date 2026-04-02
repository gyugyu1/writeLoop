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
import java.util.Map;
import java.text.Normalizer;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

@Service
public class GeminiCoachClient {

    private static final Pattern NON_WORD_PATTERN = Pattern.compile("[^\\p{L}\\p{N}\\s']");

    private final ObjectMapper objectMapper;
    private final CoachQueryAnalyzer coachQueryAnalyzer;
    private final HttpClient httpClient;
    private final String apiKey;
    private final String model;
    private final String apiUrl;

    public GeminiCoachClient(
            ObjectMapper objectMapper,
            CoachQueryAnalyzer coachQueryAnalyzer,
            @Value("${gemini.api-key:}") String apiKey,
            @Value("${gemini.model:gemini-2.5-flash}") String model,
            @Value("${gemini.api-url:https://generativelanguage.googleapis.com/v1beta/models}") String apiUrl
    ) {
        this.objectMapper = objectMapper;
        this.coachQueryAnalyzer = coachQueryAnalyzer;
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

    public CoachHelpResponseDto help(PromptDto prompt, String userQuestion, List<PromptHintDto> hints) {
        try {
            String responseBody = sendResponsesRequest(buildRequestBody(prompt, userQuestion, hints));
            return parseResponse(prompt.id(), userQuestion, responseBody);
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new IllegalStateException("Gemini coach API request failed", exception);
        }
    }

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

        return GeminiStructuredOutputSupport.buildGenerateContentRequestBody(
                objectMapper,
                buildPrompt(prompt, userQuestion, hints),
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

        return GeminiStructuredOutputSupport.buildGenerateContentRequestBody(
                objectMapper,
                promptText,
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

        return GeminiStructuredOutputSupport.buildGenerateContentRequestBody(
                objectMapper,
                promptText,
                schema
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
                "\uC601\uC5B4\uB85C", "\uB9D0\uD558\uACE0 \uC2F6", "\uC5B4\uB5BB\uAC8C \uB9D0",
                "\uBB50\uB77C\uACE0", "\uB77C\uACE0 \uB9D0", "\uB77C\uACE0 \uD558\uACE0", "\uB2E8\uC5B4",
                "how do i say", "want to say")) {
            return true;
        }

        if (containsAny(
                normalized,
                "\uB73B", "\uC758\uBBF8", "\uBB34\uC2A8 \uB73B", "\uB73B\uC774 \uBB50\uC57C", "\uB73B\uC774 \uBB54\uC9C0",
                "meaning", "what does", "means", "mean")) {
            return true;
        }

        if (containsAny(normalized, "\uD45C\uD604", "\uB2E8\uC5B4", "expression", "phrase", "word")
                && inferCategories(userQuestion).isEmpty()) {
            return true;
        }

        if (containsAny(
                normalized,
                "\uAD6C\uC870", "\uD750\uB984", "\uC21C\uC11C", "\uBB50\uBD80\uD130", "\uC2DC\uC791",
                "structure", "flow", "order", "how should i start", "what to write first")) {
            return false;
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
                .replace("\uB73B\uC774 \uBB50\uC57C", " ")
                .replace("\uB73B\uC774 \uBB54\uC9C0", " ")
                .replace("\uBB34\uC2A8 \uB73B", " ")
                .replace("\uB73B", " ")
                .replace("\uC758\uBBF8", " ")
                .replace("what is the meaning of", " ")
                .replace("what does", " ")
                .replace("meaning", " ")
                .replace("means", " ")
                .replaceAll("\\s+", " ")
                .trim();

        extracted = extracted.replaceAll("\\bmean\\b", " ").replaceAll("\\s+", " ").trim();
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

        if (containsAny(normalized,
                "\uC65C", "\uC774\uC720", "\uB54C\uBB38", "\uADF8\uB798\uC11C",
                "why", "reason", "because")) {
            categories.add("reason");
        }
        if (containsAny(normalized,
                "\uC608\uC2DC", "\uC608\uB97C \uB4E4\uC5B4", "\uC0AC\uB840", "\uACBD\uD5D8",
                "example", "for example", "for instance", "case", "sample")) {
            categories.add("example");
        }
        if (containsAny(normalized,
                "\uAC1C\uC778\uC801\uC73C\uB85C", "\uB0B4 \uC0DD\uAC01", "\uC81C \uC0DD\uAC01",
                "personally", "from my perspective", "in my opinion", "i think", "opinion")) {
            categories.add("opinion");
        }
        if (containsAny(normalized,
                "\uBE44\uAD50", "\uCC28\uC774", "\uBC18\uBA74", "\uBC18\uB300\uB85C",
                "compare", "difference", "similar", "on the other hand", "whereas")) {
            categories.add("comparison");
        }
        if (containsAny(normalized,
                "\uC2B5\uAD00", "\uB8E8\uD2F4", "\uC77C\uC0C1", "\uB9E4\uC77C", "\uC790\uC8FC",
                "habit", "routine", "usually", "every day", "often")) {
            categories.add("habit");
        }
        if (containsAny(normalized,
                "\uACC4\uD68D", "\uBAA9\uD45C", "\uC55E\uC73C\uB85C", "\uC62C\uD574", "\uC7A5\uAE30\uC801",
                "future", "plan", "goal", "long run", "in the long run", "this year")) {
            categories.add("future");
        }
        if (containsAny(normalized,
                "\uAD6C\uCCB4", "\uC790\uC138\uD788", "\uC124\uBA85", "\uD55C \uBC88 \uB354", "\uB354 \uAD6C\uCCB4",
                "detail", "specific", "specifically", "more clearly", "explain")) {
            categories.add("detail");
        }
        if (containsAny(normalized,
                "\uAD6C\uC870", "\uD750\uB984", "\uC815\uB9AC", "\uBB50\uBD80\uD130", "\uC21C\uC11C",
                "structure", "flow", "organize", "order", "what to write first")) {
            categories.add("structure");
        }
        if (containsAny(normalized,
                "\uC7A5\uB2E8\uC810", "\uCC2C\uBC18", "\uD55C\uD3B8", "\uB2E4\uB978 \uD55C\uD3B8",
                "pros and cons", "advantage", "disadvantage", "on the one hand", "overall")) {
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

    private String sendResponsesRequest(String requestBody) throws IOException, InterruptedException {
        HttpRequest request = GeminiStructuredOutputSupport.buildGenerateContentRequest(apiUrl, apiKey, model, requestBody);

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 400) {
            throw new IllegalStateException("Gemini coach API request failed with status " + response.statusCode());
        }
        return response.body();
    }

    private String extractStructuredOutputText(String body) throws IOException {
        return GeminiStructuredOutputSupport.extractStructuredOutputText(objectMapper, body);
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
