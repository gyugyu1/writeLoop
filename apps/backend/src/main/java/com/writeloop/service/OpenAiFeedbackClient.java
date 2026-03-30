package com.writeloop.service;

import com.writeloop.dto.CorrectionDto;
import com.writeloop.dto.FeedbackResponseDto;
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
                        "inlineFeedback", Map.of(
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
                        ),
                        "correctedAnswer", Map.of("type", "string"),
                        "refinementExpressions", Map.of(
                                "type", "array",
                                "items", Map.of(
                                        "type", "object",
                                        "additionalProperties", false,
                                        "properties", Map.of(
                                                "expression", Map.of("type", "string"),
                                                "guidance", Map.of("type", "string"),
                                                "example", Map.of("type", "string")
                                        ),
                                        "required", List.of("expression", "guidance", "example")
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
                        "inlineFeedback",
                        "correctedAnswer",
                        "refinementExpressions",
                        "modelAnswer",
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
                - summary, strengths, corrections.issue, corrections.suggestion, and rewriteChallenge must be written in Korean.
                - Never write English sentences in summary, strengths, corrections.issue, corrections.suggestion, or rewriteChallenge.
                - If you need to mention an English expression, quote only the expression itself and explain it in Korean.
                - correctedAnswer, modelAnswer, and inlineFeedback.originalText/revisedText must be written in English.
                - refinementExpressions.expression and refinementExpressions.example must be written in English.
                - strengths should have 2 to 3 concise bullets in Korean.
                - corrections should focus on natural English, grammar, clarity, and expansion.
                - corrections should summarize the most useful improvement points, not just the biggest errors.
                - If inlineFeedback contains clear local edits, reflect the important ones in corrections as Korean coaching points.
                - Include correction guidance for small but meaningful edits such as capitalization, singular/plural, article use, determiner insertion, pronoun choice, preposition choice, and missing punctuation when they improve the sentence.
                - If there are several concrete edits, prefer giving 2 to 5 corrections that mix sentence-level fixes and content-level improvement when relevant.
                - Do not leave corrections effectively empty when the learner answer still has clear edit-worthy issues.
                - refinementExpressions.guidance must be written in Korean.
                - correctedAnswer should minimally revise the learner answer. Preserve the learner's meaning and structure as much as possible while fixing grammar and natural phrasing.
                - inlineFeedback must cover the learner answer in reading order using these types only: KEEP, REPLACE, ADD, REMOVE.
                - inlineFeedback must reconstruct the learner answer exactly in order. Do not skip or overlap original text.
                - ADD segments do not consume original characters. They only insert extra text at the current reading position.
                - For KEEP, REPLACE, and REMOVE, originalText must copy the learner answer exactly, including spaces and punctuation.
                - KEEP: valid text that stays as-is. originalText and revisedText should be the same.
                - REPLACE: text that should be changed. originalText is the learner text, revisedText is the improved text.
                - ADD: extra text that should be added without marking the nearby original text as wrong. originalText should be "" and revisedText should contain only the added text.
                - REMOVE: text that should be deleted. originalText should contain the learner text and revisedText should be "".
                - For ADD, include any spaces or punctuation needed so the inserted text fits naturally at that position.
                - Prefer ADD instead of REPLACE when the learner text is grammatically acceptable and you are only appending detail, reason, example, connector, or emphasis.
                - Use REPLACE only when the learner text itself is wrong, unnatural, misleading, or must be rewritten.
                - Use REMOVE only when text should disappear without replacement because it is unnecessary or duplicated.
                - Example 1: original "tasty", revised "tasty and has many flavors" -> KEEP "tasty", ADD " and has many flavors".
                - Example 2: original "I go school" -> KEEP "I ", REPLACE "go school", "go to school".
                - Example 3: original "I like pizza", revised "I like pizza." -> KEEP "I like pizza", ADD ".".
                - Do not rewrite the whole answer as one REPLACE unless the whole answer is actually wrong. Use the smallest natural segment possible.
                - modelAnswer should sound natural for the learner's level.
                - modelAnswer should demonstrate the learner's next-step answer quality, not just a corrected version of the same wording.
                - Let modelAnswer naturally contain 2 to 4 reusable chunks that are worth extracting for refinementExpressions.
                - refinementExpressions should list 2 to 4 useful reusable expression frames or vocabulary items from modelAnswer that the learner can try in the next revision.
                - refinementExpressions.expression must be a reusable frame, pattern, or vocabulary item, not a full sentence.
                - Prefer slot-style frames such as "[thing]", "[adj]", "[verb]", "[reason]" when useful.
                - Good examples: "I want to [verb] so that I can [result].", "because it is [adj] and [adj]", "by [verb]ing [method]".
                - Avoid returning a fully filled-out sentence like "My favorite food is pizza because it is delicious."
                - Avoid dangling fragments such as "to daily life", "to issues like cheating", or any incomplete chunk that cannot stand alone as a reusable expression.
                - Unless the item is clearly a vocabulary word, refinementExpressions.expression should usually be at least 3 words long and structurally complete enough to reuse.
                - refinementExpressions.example should show a short snippet from modelAnswer using that frame or word.
                - refinementExpressions.example must be clean natural English only. Do not include Korean, broken characters, or quoted meta-instructions.
                - Before writing refinementExpressions, inspect which sentence structures, linkers, and expression families already appear in the learner answer.
                - Do not include expressions that already appear clearly in the learner answer.
                - Do not include expressions that merely repeat the learner's current wording with only a tiny grammar fix.
                - Do not recommend the same frame, the same wording, or a simpler version of a structure the learner already used.
                - If the learner already used a simple frame in a family, you may recommend a clearly richer or more specific frame in that same family when it adds new value.
                - refinementExpressions should feel like the learner's natural next step, not a generic list for this prompt.
                - Prefer frames that improve clarity, detail, reason, example, vocabulary, or natural flow.
                - Prefer recommendations that add a new move such as a clearer reason, stronger detail, better example, contrast, result, process, or sequence.
                - At least 2 refinementExpressions should be content-bearing expansions tied to the learner's actual answer, not just generic discourse markers.
                - Do not let all refinementExpressions play the same role. Diversify them across functions such as detail, reason, example, qualification, result, contrast, or process when possible.
                - Use generic discourse-organizing frames such as "On the positive side", "However", or "Overall" only when they add clear value, and do not let them dominate the whole list.
                - If the prompt is a balanced-opinion style question, prefer a mix such as one concrete positive elaboration, one concern or limitation, and one qualified overall judgment when possible.
                - Prefer expressions that attach directly to the learner's current ideas, nouns, claims, or examples over broad topic-level templates.
                - rewriteChallenge should tell the learner how to improve in the next attempt in Korean.
                - Treat the prompt coaching profile and prompt hints as supporting context for modelAnswer and refinementExpressions.
                - Use the prompt coaching strategy below as a soft bias for tone, starter style, and preferred expression families.
                - If the prompt coaching profile lists preferred expression families, prefer those families when they fit the learner answer and this prompt.
                - If the prompt coaching profile lists avoid families, avoid those families unless they are necessary for a natural correction.
                - Never let the prompt coaching profile or prompt hints override the learner's explicit meaning.
                - Use prompt hints as idea sources, not as text to copy.
                - Do not copy a prompt hint verbatim unless it is still clearly novel and useful for this learner.
                - Rewrite, upgrade, or adapt prompt hints so they fit the learner answer, this prompt, and the learner's likely next revision.
                - If a prompt hint overlaps with the learner answer, prefer a different or more specific expression instead of repeating it.

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

        List<InlineFeedbackSegmentDto> rawInlineFeedback = new ArrayList<>();
        feedbackNode.path("inlineFeedback").forEach(node -> rawInlineFeedback.add(
                new InlineFeedbackSegmentDto(
                        node.path("type").asText(),
                        node.path("originalText").asText(),
                        node.path("revisedText").asText()
                )
        ));

        int rawScore = feedbackNode.path("score").asInt();
        String correctedAnswer = feedbackNode.path("correctedAnswer").asText();
        List<InlineFeedbackSegmentDto> inlineFeedback = normalizeInlineFeedback(answer, correctedAnswer, rawInlineFeedback);
        List<RefinementExpressionDto> refinementExpressions = new ArrayList<>();
        feedbackNode.path("refinementExpressions").forEach(node -> refinementExpressions.add(
                new RefinementExpressionDto(
                        node.path("expression").asText(),
                        node.path("guidance").asText(),
                        node.path("example").asText()
                )
        ));
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
                inlineFeedback,
                correctedAnswer,
                refinementExpressions,
                modelAnswer,
                feedbackNode.path("rewriteChallenge").asText()
        );
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
