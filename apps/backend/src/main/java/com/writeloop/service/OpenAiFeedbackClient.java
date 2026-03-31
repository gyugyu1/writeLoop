package com.writeloop.service;

import com.writeloop.dto.CorrectionDto;
import com.writeloop.dto.CoachExpressionUsageDto;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.GrammarFeedbackItemDto;
import com.writeloop.dto.InlineFeedbackSegmentDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;
import com.writeloop.dto.RefinementExpressionDto;
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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class OpenAiFeedbackClient {
    private static final Pattern INLINE_TOKEN_PATTERN = Pattern.compile("[A-Za-z0-9']+|[^\\sA-Za-z0-9']+|\\s+");

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
        return review(prompt, answer, List.of());
    }

    public FeedbackResponseDto review(PromptDto prompt, String answer, List<PromptHintDto> hints) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(apiUrl))
                    .timeout(Duration.ofSeconds(60))
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .POST(HttpRequest.BodyPublishers.ofString(buildRequestBody(prompt, answer, hints)))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 400) {
                throw new IllegalStateException("OpenAI API request failed with status " + response.statusCode());
            }

            return parseResponse(prompt.id(), answer, response.body());
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new IllegalStateException("OpenAI API request failed", exception);
        }
    }

    List<InlineFeedbackSegmentDto> buildPreciseInlineFeedback(String originalText, String revisedText) {
        String safeOriginalText = originalText == null ? "" : originalText;
        String safeRevisedText = revisedText == null ? "" : revisedText;

        if (safeOriginalText.isBlank() && safeRevisedText.isBlank()) {
            return List.of();
        }

        if (safeOriginalText.isBlank()) {
            return List.of(new InlineFeedbackSegmentDto("ADD", "", safeRevisedText));
        }

        if (safeRevisedText.isBlank()) {
            return List.of(new InlineFeedbackSegmentDto("REMOVE", safeOriginalText, ""));
        }

        if (safeOriginalText.equals(safeRevisedText)) {
            return List.of(new InlineFeedbackSegmentDto("KEEP", safeOriginalText, safeOriginalText));
        }

        List<InlineFeedbackSegmentDto> expanded = expandReplaceSegment(safeOriginalText, safeRevisedText);
        if (expanded != null && !expanded.isEmpty()) {
            return mergeSegments(expanded);
        }

        return List.of(new InlineFeedbackSegmentDto("REPLACE", safeOriginalText, safeRevisedText));
    }

    private String buildRequestBody(PromptDto prompt, String answer, List<PromptHintDto> hints) throws IOException {
        Map<String, Object> schema = Map.of(
                "type", "object",
                "additionalProperties", false,
                "properties", Map.ofEntries(
                        Map.entry("score", Map.of("type", "integer")),
                        Map.entry("summary", Map.of("type", "string")),
                        Map.entry("strengths", Map.of(
                                "type", "array",
                                "items", Map.of("type", "string")
                        )),
                        Map.entry("corrections", Map.of(
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
                        )),
                        Map.entry("inlineFeedback", Map.of(
                                "type", "array",
                                "items", Map.of(
                                        "type", "object",
                                        "additionalProperties", false,
                                        "properties", Map.of(
                                                "type", Map.of("type", "string", "enum", List.of("KEEP", "REPLACE", "ADD", "REMOVE")),
                                                "originalText", Map.of("type", "string"),
                                                "revisedText", Map.of("type", "string")
                                        ),
                                        "required", List.of("type", "originalText", "revisedText")
                                )
                        )),
                        Map.entry("grammarFeedback", Map.of(
                                "type", "array",
                                "items", Map.of(
                                        "type", "object",
                                        "additionalProperties", false,
                                        "properties", Map.of(
                                                "originalText", Map.of("type", "string"),
                                                "revisedText", Map.of("type", "string"),
                                                "reasonKo", Map.of("type", "string")
                                        ),
                                        "required", List.of("originalText", "revisedText", "reasonKo")
                                )
                        )),
                        Map.entry("correctedAnswer", Map.of("type", "string")),
                        Map.entry("usedExpressions", Map.of(
                                "type", "array",
                                "items", Map.of(
                                        "type", "object",
                                        "additionalProperties", false,
                                        "properties", Map.of(
                                                "expression", Map.of("type", "string"),
                                                "usageTip", Map.of("type", "string")
                                        ),
                                        "required", List.of("expression", "usageTip")
                                )
                        )),
                        Map.entry("refinementExpressions", Map.of(
                                "type", "array",
                                "items", Map.of(
                                        "type", "object",
                                        "additionalProperties", false,
                                        "properties", Map.of(
                                                "expression", Map.of("type", "string"),
                                                "guidanceKo", Map.of("type", "string"),
                                                "exampleEn", Map.of("type", "string"),
                                                "exampleKo", Map.of("type", List.of("string", "null")),
                                                "meaningKo", Map.of("type", List.of("string", "null"))
                                        ),
                                        "required", List.of("expression", "guidanceKo", "exampleEn", "exampleKo", "meaningKo")
                                )
                        )),
                        Map.entry("modelAnswer", Map.of("type", "string")),
                        Map.entry("modelAnswerKo", Map.of("type", "string")),
                        Map.entry("rewriteChallenge", Map.of("type", "string"))
                ),
                "required", List.of(
                        "score",
                        "summary",
                        "strengths",
                        "corrections",
                        "inlineFeedback",
                        "grammarFeedback",
                        "correctedAnswer",
                        "usedExpressions",
                        "refinementExpressions",
                        "modelAnswer",
                        "modelAnswerKo",
                        "rewriteChallenge"
                )
        );

        Map<String, Object> payload = Map.of(
                "model", model,
                "input", buildPrompt(prompt, answer, hints),
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

    String buildPrompt(PromptDto prompt, String answer, List<PromptHintDto> hints) {
        String coachProfileText = PromptOpenAiContextFormatter.formatCoachProfile(prompt);
        String coachProfileGuidance = PromptOpenAiContextFormatter.formatCoachProfileInstructions(prompt);
        String hintText = PromptOpenAiContextFormatter.formatPromptHints(hints);

        return """
                You are an English speaking coach for Korean learners.
                Evaluate the learner answer and return feedback in valid JSON only.

                Rules:
                - Score from 0 to 100.
                - Keep the tone encouraging, specific, and actionable.
                - Korean fields: summary, strengths, corrections.issue, corrections.suggestion, rewriteChallenge, modelAnswerKo, grammarFeedback.reasonKo, and any refinementExpressions.guidanceKo, exampleKo, or meaningKo when present.
                - English fields: correctedAnswer, modelAnswer, inlineFeedback.originalText, inlineFeedback.revisedText, grammarFeedback.originalText, grammarFeedback.revisedText, refinementExpressions.expression, and refinementExpressions.exampleEn.
                - Do not write full English sentences in Korean fields. If you mention an English expression there, quote only the expression and explain it in Korean.
                - strengths should have 2 to 3 concise bullets.
                - corrections should focus only on non-grammar coaching such as clarity, detail, support, specificity, logical flow, organization, or broader naturalness beyond local sentence mechanics.
                - Each corrections.issue and corrections.suggestion must contain Korean text, not English-only text.
                - Do not repeat grammar explanations in corrections when they are already covered in grammarFeedback.
                - If the answer is short, generic, or underdeveloped, include at least 1 correction about how to expand, support, or clarify the answer when relevant.
                - If there is no meaningful non-grammar coaching point beyond grammarFeedback, corrections may be an empty array.
                - correctedAnswer should be a minimal local revision that preserves the learner's meaning and structure while fixing grammar, usage, capitalization, article or determiner choice, preposition choice, and punctuation only.
                - Do not use correctedAnswer to add new ideas, examples, supporting details, or broader sentence rewrites beyond local correction.
                - Do not reinterpret the situation or swap time, place, activity, or other content words just to sound more natural. For example, do not change "morning" to "evening" or "in the afternoon" to "after work" unless the learner meaning itself is wrong.
                - If the only needed change is punctuation, correctedAnswer must keep the learner's words unchanged and modify punctuation only. Do not replace vocabulary, paraphrase wording, or add lexical material.
                - inlineFeedback is only for local sentence correction: grammar, word choice, agreement, article, determiner, preposition, capitalization, and punctuation.
                - inlineFeedback may be an empty array when the learner answer is already locally grammatical and natural enough.
                - Do not use inlineFeedback for new ideas, extra reasons, examples, plans, or broader content expansion. Put those in modelAnswer, refinementExpressions, corrections, or rewriteChallenge instead.
                - If the only needed change is punctuation, inlineFeedback should contain only punctuation edits.
                - inlineFeedback must reconstruct the learner answer in reading order with no skips or overlaps and use the smallest natural edit possible.
                - Allowed inlineFeedback types: KEEP, REPLACE, ADD, REMOVE. For KEEP, REPLACE, and REMOVE, originalText must copy the learner answer exactly, including spaces and punctuation.
                - KEEP means unchanged text. REPLACE means wrong or unnatural learner text replaced with better text. ADD inserts text without consuming learner text and must use originalText = "". REMOVE deletes learner text and must use revisedText = "".
                - ADD should usually be a short local insertion such as an article, preposition, pronoun, auxiliary, connector, or punctuation mark, not a full new clause or sentence.
                - grammarFeedback should contain only real local grammar or mechanics issues already reflected by the sentence correction, such as agreement, verb form, article, determiner, pronoun, preposition, pluralization, capitalization, or punctuation.
                - Each grammarFeedback item must include originalText, revisedText, and reasonKo. reasonKo must be one full Korean sentence explaining why the learner form is wrong or less natural.
                - Prefer short rule-based grammar explanations over generic comments. For article or determiner edits, say whether a singular countable noun needs an article or why a possessive already works as the determiner, instead of a vague comment about adding a determiner. For preposition edits, name the idiomatic preposition in that phrase. For punctuation edits, name the actual punctuation rule.
                - reasonKo must explain only the actual edit between originalText and revisedText. Do not mention a grammar rule or wording that is not directly reflected in that change.
                - Bad: mention an unrelated rule like "There is" vs "There's" when the actual edit is article, noun, preposition, or punctuation. Good: explain the real edit, such as why "an" is needed before a singular countable noun, why "on" fits "course on [topic]", or why a comma follows an opening time phrase.
                - When several nearby edits come from the same grammar rule, you may group them into one broader grammarFeedback item instead of splitting them into tiny unrelated notes.
                - Do not put content expansion, idea development, examples, or structure advice in grammarFeedback.
                - modelAnswer should sound natural for the learner's level and show a clear next-step answer, not just a corrected version of the same wording. Let it naturally contain 2 to 4 reusable chunks.
                - modelAnswerKo should be a natural Korean translation or paraphrase of modelAnswer so the learner can quickly understand the full sample answer.
                - usedExpressions should contain 1 to 3 short English chunks that the learner already used naturally and correctly in the learner answer. Do not return a full sentence or a weak single function word.
                - Each usedExpressions item must include expression and usageTip. expression should usually be copied from the learner answer rather than rewritten. usageTip should be one Korean sentence explaining why the expression worked well. If nothing clearly stands out, return an empty array.
                - refinementExpressions should contain 2 to 4 useful reusable frames or vocabulary items drawn from modelAnswer. If modelAnswer contains several distinct reusable chunks, prefer returning 3 to 4 items instead of stopping at 2.
                - refinementExpressions.expression must be a reusable frame, pattern, or vocabulary item, not a full sentence. Prefer slot-style frames such as "[thing]", "[adj]", "[verb]", or "[reason]" when useful, and avoid fully filled-out sentences or dangling fragments.
                - Each refinement item must include guidanceKo, exampleEn, exampleKo, and meaningKo. guidanceKo must be one full Korean coaching sentence that explains when or how to use the expression, not just a gloss. exampleEn must be a short clean English usage snippet or sentence, must be different from expression, and should place a word or short phrase inside a natural sentence. exampleKo should be a natural Korean translation or paraphrase of exampleEn. meaningKo should be a short Korean gloss or paraphrase that helps the learner understand the expression quickly.
                - Do not recommend the same wording, the same frame, or a simpler variant of what already appears in the learner answer. A richer same-family frame is allowed only if it clearly adds value.
                - refinementExpressions should feel like the learner's natural next step. Prefer frames that improve clarity, detail, reason, example, vocabulary, flow, contrast, result, process, or sequence.
                - At least 2 refinementExpressions should be content-bearing expansions tied to the learner's actual answer, not just generic discourse markers. Diversify their functions when possible.
                - Use generic discourse markers such as "On the positive side", "However", or "Overall" only when they add clear value and do not let them dominate the list. For balanced-opinion prompts, prefer a mix such as a concrete positive elaboration, a concern or limitation, and a qualified overall judgment when possible.
                - rewriteChallenge should tell the learner how to improve in the next attempt in Korean.
                - Treat the prompt coaching profile and prompt hints as soft supporting context for tone, starter style, and expression families.
                - Follow preferred or avoid families only when they fit the learner answer naturally. Never let the profile or hints override the learner's explicit meaning.
                - Use prompt hints as idea sources, not text to copy. Adapt or upgrade them to fit this learner, and avoid repeating a hint that overlaps with the learner answer.

                Prompt topic: %s
                Difficulty: %s
                Question in English: %s
                Question in Korean: %s
                Speaking tip: %s
                Prompt coaching profile:
                %s
                Prompt coaching strategy:
                %s
                Prompt hints:
                %s

                Learner answer:
                %s
                """.formatted(
                 prompt.topic(),
                 prompt.difficulty(),
                 prompt.questionEn(),
                 prompt.questionKo(),
                 prompt.tip(),
                 coachProfileText,
                 coachProfileGuidance,
                 hintText,
                 answer
        );
    }

    private FeedbackResponseDto parseResponse(String promptId, String answer, String body) throws IOException {
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
        String correctedAnswer = feedbackNode.path("correctedAnswer").asText();
        List<InlineFeedbackSegmentDto> inlineFeedback = buildInlineFeedbackFromCorrectedAnswer(answer, correctedAnswer);
        List<GrammarFeedbackItemDto> grammarFeedback = new ArrayList<>();
        feedbackNode.path("grammarFeedback").forEach(node -> grammarFeedback.add(
                new GrammarFeedbackItemDto(
                        node.path("originalText").asText(),
                        node.path("revisedText").asText(),
                        node.path("reasonKo").asText()
                )
        ));
        List<CoachExpressionUsageDto> usedExpressions = new ArrayList<>();
        feedbackNode.path("usedExpressions").forEach(node -> usedExpressions.add(
                new CoachExpressionUsageDto(
                        node.path("expression").asText(),
                        true,
                        "SELF_DISCOVERED",
                        null,
                        "SELF_DISCOVERED",
                        node.path("usageTip").asText()
                )
        ));
        String modelAnswer = feedbackNode.path("modelAnswer").asText();
        List<RefinementExpressionDto> refinementExpressions = new ArrayList<>();
        feedbackNode.path("refinementExpressions").forEach(node -> refinementExpressions.add(
                new RefinementExpressionDto(
                        node.path("expression").asText(),
                        node.path("guidanceKo").isMissingNode()
                                ? node.path("guidance").asText()
                                : node.path("guidanceKo").asText(),
                        node.path("exampleEn").isMissingNode()
                                ? node.path("example").asText()
                                : node.path("exampleEn").asText(),
                        node.path("exampleKo").isMissingNode() || node.path("exampleKo").isNull()
                                ? null
                                : node.path("exampleKo").asText(),
                        node.path("meaningKo").isMissingNode() || node.path("meaningKo").isNull()
                                ? null
                                : node.path("meaningKo").asText()
                )
        ));
        String modelAnswerKo = feedbackNode.path("modelAnswerKo").asText("");
        boolean loopComplete = isLoopComplete(rawScore, corrections, grammarFeedback);
        String completionMessage = buildReadableCompletionMessage(rawScore, corrections, grammarFeedback);

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
                inlineFeedback,
                grammarFeedback,
                correctedAnswer,
                refinementExpressions,
                modelAnswer,
                modelAnswerKo,
                feedbackNode.path("rewriteChallenge").asText(),
                usedExpressions
        );
    }

    List<InlineFeedbackSegmentDto> buildInlineFeedbackFromCorrectedAnswer(String originalAnswer, String correctedAnswer) {
        if (originalAnswer == null || originalAnswer.isBlank()) {
            return List.of();
        }

        List<InlineFeedbackSegmentDto> segments = buildPreciseInlineFeedback(originalAnswer, correctedAnswer);
        if (segments.isEmpty() || segments.stream().noneMatch(segment -> !"KEEP".equals(segment.type()))) {
            return List.of();
        }

        return segments;
    }

    private String buildReadableCompletionMessage(
            int score,
            List<CorrectionDto> corrections,
            List<GrammarFeedbackItemDto> grammarFeedback
    ) {
        if (!isLoopComplete(score, corrections, grammarFeedback)) {
            return null;
        }
        return "\uc88b\uc544\uc694. \uc9c0\uae08 \ub2e8\uacc4\uc5d0\uc11c \ub9c8\ubb34\ub9ac\ud574\ub3c4 \ucda9\ubd84\ud574\uc694. \uc6d0\ud558\uba74 \ud55c \ubc88 \ub354 \ub2e4\ub4ec\uc73c\uba74\uc11c \uc5f0\uc2b5\ud574 \ubcfc \uc218 \uc788\uc5b4\uc694.";
    }

    private List<InlineFeedbackSegmentDto> normalizeInlineFeedback(
            String originalAnswer,
            String correctedAnswer,
            List<InlineFeedbackSegmentDto> rawInlineFeedback
    ) {
        if (rawInlineFeedback == null || rawInlineFeedback.isEmpty()) {
            return List.of();
        }

        List<InlineFeedbackSegmentDto> normalized = new ArrayList<>();
        for (InlineFeedbackSegmentDto segment : rawInlineFeedback) {
            List<InlineFeedbackSegmentDto> expanded = normalizeSegment(segment);
            if (expanded == null) {
                return List.of();
            }
            normalized.addAll(expanded);
        }

        List<InlineFeedbackSegmentDto> merged = mergeSegments(normalized);
        if (!coversOriginalAnswer(originalAnswer, merged)) {
            return List.of();
        }

        if (!matchesCorrectedAnswer(correctedAnswer, merged)) {
            return List.of();
        }

        if (merged.stream().noneMatch(segment -> !"KEEP".equals(segment.type()))) {
            return List.of();
        }

        return merged;
    }

    private List<InlineFeedbackSegmentDto> normalizeSegment(InlineFeedbackSegmentDto segment) {
        String type = segment.type();
        String originalText = segment.originalText();
        String revisedText = segment.revisedText();

        if (originalText.isBlank() && revisedText.isBlank()) {
            return List.of();
        }

        return switch (type) {
            case "KEEP" -> {
                if (originalText.isBlank()) {
                    yield null;
                }
                yield List.of(new InlineFeedbackSegmentDto("KEEP", originalText, originalText));
            }
            case "ADD" -> {
                if (revisedText.isBlank() || !originalText.isBlank()) {
                    yield null;
                }
                yield List.of(new InlineFeedbackSegmentDto("ADD", "", revisedText));
            }
            case "REMOVE" -> {
                if (originalText.isBlank()) {
                    yield null;
                }
                yield List.of(new InlineFeedbackSegmentDto("REMOVE", originalText, ""));
            }
            case "REPLACE" -> {
                if (originalText.isBlank() && revisedText.isBlank()) {
                    yield List.of();
                }
                if (originalText.isBlank()) {
                    yield List.of(new InlineFeedbackSegmentDto("ADD", "", revisedText));
                }
                if (revisedText.isBlank()) {
                    yield List.of(new InlineFeedbackSegmentDto("REMOVE", originalText, ""));
                }
                if (originalText.equals(revisedText)) {
                    yield List.of(new InlineFeedbackSegmentDto("KEEP", originalText, originalText));
                }
                yield buildPreciseInlineFeedback(originalText, revisedText);
            }
            default -> null;
        };
    }

    private List<InlineFeedbackSegmentDto> expandReplaceSegment(String originalText, String revisedText) {
        int matchIndex = revisedText.indexOf(originalText);
        if (matchIndex >= 0) {
            if (!isSafeBoundary(revisedText, matchIndex) ||
                    !isSafeBoundary(revisedText, matchIndex + originalText.length())) {
                return null;
            }

            String prefix = revisedText.substring(0, matchIndex);
            String suffix = revisedText.substring(matchIndex + originalText.length());
            if (prefix.isEmpty() && suffix.isEmpty()) {
                return null;
            }

            List<InlineFeedbackSegmentDto> expanded = new ArrayList<>();
            if (!prefix.isEmpty()) {
                expanded.add(new InlineFeedbackSegmentDto("ADD", "", prefix));
            }
            expanded.add(new InlineFeedbackSegmentDto("KEEP", originalText, originalText));
            if (!suffix.isEmpty()) {
                expanded.add(new InlineFeedbackSegmentDto("ADD", "", suffix));
            }
            return expanded;
        }

        List<TokenDiffOperation> operations = buildTokenDiffOperations(
                tokenizeForInlineDiff(originalText),
                tokenizeForInlineDiff(revisedText)
        );
        List<InlineFeedbackSegmentDto> expanded = new ArrayList<>();
        StringBuilder removedBuffer = new StringBuilder();
        StringBuilder addedBuffer = new StringBuilder();
        boolean hasEqual = false;

        for (TokenDiffOperation operation : operations) {
            if (operation.kind().equals("equal")) {
                hasEqual = true;
                flushInlineChange(expanded, removedBuffer, addedBuffer);
                appendMergedSegment(expanded, new InlineFeedbackSegmentDto("KEEP", operation.text(), operation.text()));
                continue;
            }

            if (operation.kind().equals("remove")) {
                removedBuffer.append(operation.text());
                continue;
            }

            if (operation.kind().equals("add")) {
                addedBuffer.append(operation.text());
            }
        }

        flushInlineChange(expanded, removedBuffer, addedBuffer);
        return hasEqual ? expanded : null;
    }

    private boolean isSafeBoundary(String text, int boundaryIndex) {
        if (boundaryIndex <= 0 || boundaryIndex >= text.length()) {
            return true;
        }

        char previous = text.charAt(boundaryIndex - 1);
        char next = text.charAt(boundaryIndex);
        return !Character.isLetterOrDigit(previous) || !Character.isLetterOrDigit(next);
    }

    private List<String> tokenizeForInlineDiff(String text) {
        List<String> tokens = new ArrayList<>();
        Matcher matcher = INLINE_TOKEN_PATTERN.matcher(text);
        while (matcher.find()) {
            tokens.add(matcher.group());
        }

        if (tokens.isEmpty() && !text.isEmpty()) {
            tokens.add(text);
        }
        return tokens;
    }

    private List<TokenDiffOperation> buildTokenDiffOperations(List<String> originalTokens, List<String> revisedTokens) {
        int[][] dp = new int[originalTokens.size() + 1][revisedTokens.size() + 1];

        for (int originalIndex = originalTokens.size() - 1; originalIndex >= 0; originalIndex--) {
            for (int revisedIndex = revisedTokens.size() - 1; revisedIndex >= 0; revisedIndex--) {
                dp[originalIndex][revisedIndex] =
                        originalTokens.get(originalIndex).equals(revisedTokens.get(revisedIndex))
                                ? dp[originalIndex + 1][revisedIndex + 1] + 1
                                : Math.max(dp[originalIndex + 1][revisedIndex], dp[originalIndex][revisedIndex + 1]);
            }
        }

        List<TokenDiffOperation> operations = new ArrayList<>();
        int originalIndex = 0;
        int revisedIndex = 0;

        while (originalIndex < originalTokens.size() && revisedIndex < revisedTokens.size()) {
            if (originalTokens.get(originalIndex).equals(revisedTokens.get(revisedIndex))) {
                operations.add(new TokenDiffOperation("equal", originalTokens.get(originalIndex)));
                originalIndex += 1;
                revisedIndex += 1;
                continue;
            }

            if (dp[originalIndex + 1][revisedIndex] >= dp[originalIndex][revisedIndex + 1]) {
                operations.add(new TokenDiffOperation("remove", originalTokens.get(originalIndex)));
                originalIndex += 1;
            } else {
                operations.add(new TokenDiffOperation("add", revisedTokens.get(revisedIndex)));
                revisedIndex += 1;
            }
        }

        while (originalIndex < originalTokens.size()) {
            operations.add(new TokenDiffOperation("remove", originalTokens.get(originalIndex)));
            originalIndex += 1;
        }

        while (revisedIndex < revisedTokens.size()) {
            operations.add(new TokenDiffOperation("add", revisedTokens.get(revisedIndex)));
            revisedIndex += 1;
        }

        return operations;
    }

    private void appendMergedSegment(List<InlineFeedbackSegmentDto> segments, InlineFeedbackSegmentDto segment) {
        if (segments.isEmpty()) {
            segments.add(segment);
            return;
        }

        InlineFeedbackSegmentDto previous = segments.get(segments.size() - 1);
        if (!previous.type().equals(segment.type())) {
            segments.add(segment);
            return;
        }

        segments.set(segments.size() - 1, switch (segment.type()) {
            case "KEEP" -> new InlineFeedbackSegmentDto(
                    "KEEP",
                    previous.originalText() + segment.originalText(),
                    previous.revisedText() + segment.revisedText()
            );
            case "ADD" -> new InlineFeedbackSegmentDto(
                    "ADD",
                    "",
                    previous.revisedText() + segment.revisedText()
            );
            case "REMOVE" -> new InlineFeedbackSegmentDto(
                    "REMOVE",
                    previous.originalText() + segment.originalText(),
                    ""
            );
            default -> segment;
        });
    }

    private void flushInlineChange(
            List<InlineFeedbackSegmentDto> segments,
            StringBuilder removedBuffer,
            StringBuilder addedBuffer
    ) {
        if (removedBuffer.isEmpty() && addedBuffer.isEmpty()) {
            return;
        }

        if (!removedBuffer.isEmpty() && !addedBuffer.isEmpty()) {
            appendMergedSegment(segments, new InlineFeedbackSegmentDto(
                    "REPLACE",
                    removedBuffer.toString(),
                    addedBuffer.toString()
            ));
        } else if (!removedBuffer.isEmpty()) {
            appendMergedSegment(segments, new InlineFeedbackSegmentDto(
                    "REMOVE",
                    removedBuffer.toString(),
                    ""
            ));
        } else {
            appendMergedSegment(segments, new InlineFeedbackSegmentDto(
                    "ADD",
                    "",
                    addedBuffer.toString()
            ));
        }

        removedBuffer.setLength(0);
        addedBuffer.setLength(0);
    }

    private record TokenDiffOperation(String kind, String text) {
    }

    private List<InlineFeedbackSegmentDto> mergeSegments(List<InlineFeedbackSegmentDto> segments) {
        if (segments.isEmpty()) {
            return List.of();
        }

        List<InlineFeedbackSegmentDto> merged = new ArrayList<>();
        for (InlineFeedbackSegmentDto segment : segments) {
            if (segment.type().equals("KEEP") && segment.originalText().isBlank()) {
                continue;
            }
            if (segment.type().equals("ADD") && segment.revisedText().isBlank()) {
                continue;
            }
            if (segment.type().equals("REMOVE") && segment.originalText().isBlank()) {
                continue;
            }

            InlineFeedbackSegmentDto previous = merged.isEmpty() ? null : merged.get(merged.size() - 1);
            if (previous != null && previous.type().equals(segment.type())) {
                if ("KEEP".equals(segment.type())) {
                    merged.set(merged.size() - 1, new InlineFeedbackSegmentDto(
                            "KEEP",
                            previous.originalText() + segment.originalText(),
                            previous.revisedText() + segment.revisedText()
                    ));
                    continue;
                }

                if ("ADD".equals(segment.type())) {
                    merged.set(merged.size() - 1, new InlineFeedbackSegmentDto(
                            "ADD",
                            "",
                            previous.revisedText() + segment.revisedText()
                    ));
                    continue;
                }

                if ("REMOVE".equals(segment.type())) {
                    merged.set(merged.size() - 1, new InlineFeedbackSegmentDto(
                            "REMOVE",
                            previous.originalText() + segment.originalText(),
                            ""
                    ));
                    continue;
                }
            }

            merged.add(segment);
        }

        return merged;
    }

    private boolean coversOriginalAnswer(String originalAnswer, List<InlineFeedbackSegmentDto> segments) {
        int cursor = 0;

        for (InlineFeedbackSegmentDto segment : segments) {
            switch (segment.type()) {
                case "KEEP", "REPLACE", "REMOVE" -> {
                    String originalText = segment.originalText();
                    if (!originalAnswer.startsWith(originalText, cursor)) {
                        return false;
                    }
                    cursor += originalText.length();
                }
                case "ADD" -> {
                    // ADD segments do not consume original characters.
                }
                default -> {
                    return false;
                }
            }
        }

        return cursor == originalAnswer.length();
    }

    private boolean matchesCorrectedAnswer(String correctedAnswer, List<InlineFeedbackSegmentDto> segments) {
        StringBuilder reconstructed = new StringBuilder();
        for (InlineFeedbackSegmentDto segment : segments) {
            switch (segment.type()) {
                case "KEEP" -> reconstructed.append(segment.originalText());
                case "REPLACE", "ADD" -> reconstructed.append(segment.revisedText());
                case "REMOVE" -> {
                    // Skip removed text.
                }
                default -> {
                    return false;
                }
            }
        }

        return normalizeForComparison(correctedAnswer).equals(normalizeForComparison(reconstructed.toString()));
    }

    private String normalizeForComparison(String value) {
        return value == null ? "" : value.replaceAll("\\s+", " ").trim();
    }

    private boolean isLoopComplete(
            int score,
            List<CorrectionDto> corrections,
            List<GrammarFeedbackItemDto> grammarFeedback
    ) {
        int issueCount = (corrections == null ? 0 : corrections.size())
                + (grammarFeedback == null ? 0 : grammarFeedback.size());
        return score >= 85 || (score >= 80 && issueCount <= 2);
    }

    private String buildCompletionMessage(
            int score,
            List<CorrectionDto> corrections,
            List<GrammarFeedbackItemDto> grammarFeedback
    ) {
        if (!isLoopComplete(score, corrections, grammarFeedback)) {
            return null;
        }
        return "이 답변은 지금 단계에서 마무리해도 충분해요. 원하면 한 번 더 다시 써 보면서 연습할 수 있어요.";
    }
}
