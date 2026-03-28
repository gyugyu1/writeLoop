package com.writeloop.service;

import com.writeloop.dto.CorrectionDto;
import com.writeloop.dto.CoachExpressionUsageDto;
import com.writeloop.dto.FeedbackRequestDto;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.InlineFeedbackSegmentDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.RefinementExpressionDto;
import com.writeloop.exception.GuestLimitExceededException;
import com.writeloop.persistence.AnswerAttemptEntity;
import com.writeloop.persistence.AnswerAttemptRepository;
import com.writeloop.persistence.AnswerSessionEntity;
import com.writeloop.persistence.AnswerSessionRepository;
import com.writeloop.persistence.AttemptType;
import com.writeloop.persistence.SessionStatus;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class FeedbackService {
    private static final String LETTER_TOKEN = "[\\p{L}][\\p{L}'-]*";
    private static final String FEEDBACK_USED_EXPRESSION_SOURCE = "SELF_DISCOVERED";
    private static final String FEEDBACK_USED_EXPRESSION_MATCH_TYPE = "SELF_DISCOVERED";
    private static final String FEEDBACK_USED_EXPRESSION_USAGE_TIP = "답변 안에서 자연스럽게 살린 표현이에요.";
    private static final Set<String> PRONOUN_TOKENS = Set.of(
            "i", "you", "he", "she", "it", "we", "they"
    );
    private static final Set<String> BE_VERB_TOKENS = Set.of(
            "am", "is", "are", "was", "were"
    );
    private static final Set<String> ARTICLE_TOKENS = Set.of(
            "a", "an", "the"
    );
    private static final Set<String> PREPOSITION_TOKENS = Set.of(
            "to", "for", "of", "in", "on", "at", "with", "by", "from", "about"
    );
    private static final List<Pattern> MODEL_EXPRESSION_PATTERNS = List.of(
            Pattern.compile("\\bI want to [^,.!?;]+", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\bI would like to [^,.!?;]+", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\bI plan to [^,.!?;]+", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\bI usually [^,.!?;]+", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\bbecause [^,.!?;]+", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\bby [A-Za-z]+ing [^,.!?;]+", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\bso that [^,.!?;]+", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\bto [a-z]+ [^,.!?;]+", Pattern.CASE_INSENSITIVE)
    );
    private static final Pattern FEEDBACK_USED_CLAUSE_BREAK_PATTERN = Pattern.compile(
            "\\b(?:because|since|so|which|while|although)\\b",
            Pattern.CASE_INSENSITIVE
    );
    private static final List<Pattern> FEEDBACK_USED_EXPRESSION_PATTERNS = List.of(
            Pattern.compile("\\b(?:in my opinion|i think|one reason is that|this is because|for example|for instance|in the long run|as a result|at the same time|these days)\\b", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\b(?:i(?:'d| would)? like to|i would love to|i want to|i plan to|i hope to|i need to)(?: " + LETTER_TOKEN + "){1,4}\\b", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\b(?:i usually|i often|i sometimes|i always)(?: " + LETTER_TOKEN + "){1,5}\\b", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\b(?:work out|exercise)\\b", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\b(?:spend time with|keep in touch with|connect with|communicate with|meet|visit|explore|enjoy|care for|take responsibility for|provide|support)(?: " + LETTER_TOKEN + "){1,6}\\b", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\bbecause [^,.!?;]+", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\bby [A-Za-z]+ing [^,.!?;]+", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\bso that [^,.!?;]+", Pattern.CASE_INSENSITIVE)
    );
    private static final Set<String> TRAILING_WEAK_TOKENS = Set.of(
            "a", "an", "and", "are", "as", "at", "be", "because", "for", "from", "if",
            "in", "into", "is", "my", "of", "on", "or", "our", "that", "the", "their", "to", "with", "your", "his", "her"
    );

    private final PromptService promptService;
    private final OpenAiFeedbackClient openAiFeedbackClient;
    private final AnswerSessionRepository answerSessionRepository;
    private final AnswerAttemptRepository answerAttemptRepository;
    private final ObjectMapper objectMapper;

    public FeedbackResponseDto review(FeedbackRequestDto request, Long currentUserId) {
        PromptDto prompt = promptService.findById(request.promptId());
        String answer = request.answer() == null ? "" : request.answer().trim();
        AnswerSessionEntity session = resolveSession(request, prompt.id(), currentUserId);
        AttemptType attemptType = resolveAttemptType(request);

        FeedbackResponseDto feedback = openAiFeedbackClient.isConfigured()
                ? openAiFeedbackClient.review(prompt, answer)
                : buildLocalFeedback(prompt, answer);
        feedback = sanitizeFeedbackResponse(feedback, answer);

        if (feedback.loopComplete()) {
            session.setStatus(SessionStatus.COMPLETED);
            answerSessionRepository.save(session);
        }

        int attemptNo = answerAttemptRepository.countBySessionId(session.getId()) + 1;
        saveAttempt(session, attemptType, attemptNo, answer, feedback);

        return new FeedbackResponseDto(
                feedback.promptId(),
                session.getId(),
                attemptNo,
                feedback.score(),
                feedback.loopComplete(),
                feedback.completionMessage(),
                feedback.summary(),
                feedback.strengths(),
                feedback.corrections(),
                feedback.inlineFeedback(),
                feedback.correctedAnswer(),
                feedback.refinementExpressions(),
                feedback.modelAnswer(),
                feedback.rewriteChallenge(),
                feedback.usedExpressions()
        );
    }

    private AnswerSessionEntity resolveSession(FeedbackRequestDto request, String promptId, Long currentUserId) {
        if (request.sessionId() != null && !request.sessionId().isBlank()) {
            AnswerSessionEntity session = answerSessionRepository.findById(request.sessionId())
                    .orElseThrow(() -> new IllegalStateException("Answer session not found"));

            if (session.getUserId() != null) {
                if (currentUserId == null || !session.getUserId().equals(currentUserId)) {
                    throw new IllegalStateException("This answer session belongs to another user");
                }
                return session;
            }

            if (currentUserId != null) {
                session.assignToUser(currentUserId);
                return answerSessionRepository.save(session);
            }

            if (session.getGuestId() != null && answerAttemptRepository.countBySessionId(session.getId()) >= 2) {
                throw new GuestLimitExceededException();
            }
            return session;
        }

        if (currentUserId != null) {
            AnswerSessionEntity session = new AnswerSessionEntity(
                    UUID.randomUUID().toString(),
                    promptId,
                    null,
                    currentUserId,
                    SessionStatus.IN_PROGRESS
            );
            return answerSessionRepository.save(session);
        }

        String guestId = normalizeGuestId(request.guestId());
        if (guestId != null && answerSessionRepository.countByGuestId(guestId) >= 1) {
            throw new GuestLimitExceededException();
        }

        AnswerSessionEntity session = new AnswerSessionEntity(
                UUID.randomUUID().toString(),
                promptId,
                guestId,
                null,
                SessionStatus.IN_PROGRESS
        );
        return answerSessionRepository.save(session);
    }

    private AttemptType resolveAttemptType(FeedbackRequestDto request) {
        if (request.attemptType() == null || request.attemptType().isBlank()) {
            return AttemptType.INITIAL;
        }

        try {
            return AttemptType.valueOf(request.attemptType().trim().toUpperCase());
        } catch (IllegalArgumentException exception) {
            return AttemptType.INITIAL;
        }
    }

    private String normalizeGuestId(String guestId) {
        if (guestId == null) {
            return null;
        }

        String trimmed = guestId.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private void saveAttempt(
            AnswerSessionEntity session,
            AttemptType attemptType,
            int attemptNo,
            String answer,
            FeedbackResponseDto feedback
    ) {
        try {
            AnswerAttemptEntity attempt = new AnswerAttemptEntity(
                    session.getId(),
                    attemptNo,
                    attemptType,
                    answer,
                    feedback.score(),
                    feedback.summary(),
                    objectMapper.writeValueAsString(feedback.strengths()),
                    objectMapper.writeValueAsString(feedback.corrections()),
                    feedback.modelAnswer(),
                    feedback.rewriteChallenge(),
                    objectMapper.writeValueAsString(feedback)
            );
            answerAttemptRepository.save(attempt);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to serialize feedback for storage", exception);
        }
    }

    private FeedbackResponseDto buildLocalFeedback(PromptDto prompt, String answer) {
        List<String> strengths = new ArrayList<>();
        List<CorrectionDto> corrections = new ArrayList<>();

        if (answer.length() >= 50) {
            strengths.add("답변에 구체적인 내용이 충분히 들어 있어 이야기가 자연스럽게 이어집니다.");
        } else {
            corrections.add(new CorrectionDto(
                    "답변 길이가 조금 짧아요.",
                    "이유나 예시를 한 문장 더 추가해 보세요."
            ));
        }

        if (containsAny(answer, "because", "so", "and", "but")) {
            strengths.add("연결어를 사용해서 문장들이 따로 노는 느낌 없이 이어지고 있어요.");
        } else {
            corrections.add(new CorrectionDto(
                    "생각과 생각 사이의 연결이 조금 약해요.",
                    "because, so, and, but 같은 연결어를 넣어 보세요."
            ));
        }

        if (containsAny(answer, "i like", "i enjoy", "i want", "i usually", "i practice")) {
            strengths.add("자기 생각을 말할 때 자주 쓰는 기본 표현이 자연스럽게 들어가 있어요.");
        } else {
            corrections.add(new CorrectionDto(
                    "내 의견이나 습관이 더 분명하게 드러나면 좋아요.",
                    "I usually..., I want..., I enjoy... 같은 표현으로 시작해 보세요."
            ));
        }

        if (!answer.endsWith(".") && !answer.endsWith("!") && !answer.endsWith("?")) {
            corrections.add(new CorrectionDto(
                    "문장이 덜 끝난 느낌으로 보일 수 있어요.",
                    "마침표나 물음표 같은 문장부호를 넣어서 더 자연스럽게 마무리해 보세요."
            ));
        }

        int score = Math.max(62, 88 - corrections.size() * 7 + strengths.size() * 3);
        String summary = corrections.isEmpty()
                ? "답변이 자연스럽고 전달력도 좋아요. 다음 단계에서는 구체적인 예시를 하나 더 넣어 답변을 더 풍부하게 만들어 보세요."
                : "핵심 내용은 잘 전달됐지만, 문장 연결과 구체성을 조금 더 보완하면 훨씬 자연스러운 답변이 됩니다.";

        String correctedAnswer = buildCorrectedAnswer(answer);
        List<InlineFeedbackSegmentDto> inlineFeedback = buildInlineFeedback(answer, correctedAnswer);
        String modelAnswer = buildModelAnswer(prompt);
        List<RefinementExpressionDto> refinementExpressions = buildRefinementExpressions(answer, correctedAnswer, modelAnswer);
        String rewriteChallenge = buildRewriteChallenge(prompt, corrections.isEmpty());
        int finalScore = Math.min(score, 96);
        boolean loopComplete = shouldCompleteLoop(finalScore, corrections);
        String completionMessage = loopComplete
                ? "이 답변은 지금 단계에서 마무리해도 충분해요. 원하면 한 번 더 다시 써 보면서 연습할 수도 있어요."
                : null;

        return new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                finalScore,
                loopComplete,
                completionMessage,
                summary,
                strengths,
                corrections,
                inlineFeedback,
                correctedAnswer,
                refinementExpressions,
                modelAnswer,
                rewriteChallenge,
                List.of()
        );
    }

    private FeedbackResponseDto sanitizeFeedbackResponse(FeedbackResponseDto feedback, String learnerAnswer) {
        List<CorrectionDto> corrections = sanitizeCorrections(
                feedback.corrections(),
                feedback.inlineFeedback()
        );
        List<RefinementExpressionDto> refinementExpressions = sanitizeRefinementExpressions(
                feedback.refinementExpressions(),
                learnerAnswer,
                feedback.correctedAnswer(),
                feedback.modelAnswer()
        );
        List<CoachExpressionUsageDto> usedExpressions = sanitizeUsedExpressions(
                feedback.usedExpressions(),
                learnerAnswer,
                feedback.inlineFeedback()
        );

        return new FeedbackResponseDto(
                feedback.promptId(),
                feedback.sessionId(),
                feedback.attemptNo(),
                feedback.score(),
                feedback.loopComplete(),
                feedback.completionMessage(),
                feedback.summary(),
                feedback.strengths(),
                corrections,
                feedback.inlineFeedback(),
                feedback.correctedAnswer(),
                refinementExpressions,
                feedback.modelAnswer(),
                feedback.rewriteChallenge(),
                usedExpressions
        );
    }

    private List<CorrectionDto> sanitizeCorrections(
            List<CorrectionDto> corrections,
            List<InlineFeedbackSegmentDto> inlineFeedback
    ) {
        List<CorrectionDto> sanitized = new ArrayList<>();
        LinkedHashSet<String> seen = new LinkedHashSet<>();

        if (corrections != null) {
            for (CorrectionDto correction : corrections) {
                if (correction == null || correction.issue() == null || correction.suggestion() == null) {
                    continue;
                }

                String key = normalizeForComparison(correction.issue() + " " + correction.suggestion());
                if (key.isBlank() || !seen.add(key)) {
                    continue;
                }
                sanitized.add(correction);
            }
        }

        for (CorrectionDto supplemental : buildSupplementalCorrections(inlineFeedback, sanitized)) {
            String key = normalizeForComparison(supplemental.issue() + " " + supplemental.suggestion());
            if (key.isBlank() || !seen.add(key)) {
                continue;
            }
            sanitized.add(supplemental);
            if (sanitized.size() >= 5) {
                break;
            }
        }

        return sanitized;
    }

    private List<CoachExpressionUsageDto> sanitizeUsedExpressions(
            List<CoachExpressionUsageDto> usedExpressions,
            String learnerAnswer,
            List<InlineFeedbackSegmentDto> inlineFeedback
    ) {
        List<CoachExpressionUsageDto> extracted = new ArrayList<>();
        if (usedExpressions != null) {
            extracted.addAll(usedExpressions);
        }
        extracted.addAll(buildUsedExpressions(learnerAnswer, inlineFeedback));
        return deduplicateUsedExpressions(extracted).stream()
                .limit(3)
                .toList();
    }

    private List<CoachExpressionUsageDto> buildUsedExpressions(
            String learnerAnswer,
            List<InlineFeedbackSegmentDto> inlineFeedback
    ) {
        if (learnerAnswer == null || learnerAnswer.isBlank()) {
            return List.of();
        }

        List<String> preservedSegments = extractPreservedSegments(inlineFeedback);
        List<String> directCandidates = extractUsedExpressionCandidates(learnerAnswer);
        List<String> preservedCandidates = directCandidates.stream()
                .filter(candidate -> isPreservedCandidate(candidate, preservedSegments))
                .toList();

        LinkedHashSet<String> orderedCandidates = new LinkedHashSet<>();
        preservedCandidates.forEach(orderedCandidates::add);
        directCandidates.forEach(orderedCandidates::add);

        List<CoachExpressionUsageDto> expressions = new ArrayList<>();
        for (String candidate : orderedCandidates) {
            CoachExpressionUsageDto usage = createUsedExpression(candidate);
            if (usage != null) {
                expressions.add(usage);
            }
            if (expressions.size() >= 5) {
                break;
            }
        }

        return expressions;
    }

    private List<String> extractPreservedSegments(List<InlineFeedbackSegmentDto> inlineFeedback) {
        if (inlineFeedback == null || inlineFeedback.isEmpty()) {
            return List.of();
        }

        return inlineFeedback.stream()
                .filter(segment -> segment != null && "KEEP".equalsIgnoreCase(segment.type()))
                .map(InlineFeedbackSegmentDto::originalText)
                .map(text -> text == null ? "" : text.trim())
                .filter(text -> !text.isBlank())
                .toList();
    }

    private List<String> extractUsedExpressionCandidates(String learnerAnswer) {
        if (learnerAnswer == null || learnerAnswer.isBlank()) {
            return List.of();
        }

        LinkedHashSet<String> candidates = new LinkedHashSet<>();
        for (Pattern pattern : FEEDBACK_USED_EXPRESSION_PATTERNS) {
            Matcher matcher = pattern.matcher(learnerAnswer);
            while (matcher.find()) {
                String candidate = sanitizeExtractedExpression(matcher.group());
                if (isValidUsedExpressionCandidate(candidate)) {
                    candidates.add(candidate);
                }
            }
        }

        return List.copyOf(candidates);
    }

    private CoachExpressionUsageDto createUsedExpression(String candidate) {
        String sanitizedCandidate = sanitizeExtractedExpression(candidate);
        if (!isValidUsedExpressionCandidate(sanitizedCandidate)) {
            return null;
        }

        return new CoachExpressionUsageDto(
                sanitizedCandidate,
                true,
                FEEDBACK_USED_EXPRESSION_MATCH_TYPE,
                sanitizedCandidate,
                FEEDBACK_USED_EXPRESSION_SOURCE,
                buildUsedExpressionUsageTip(sanitizedCandidate)
        );
    }

    private boolean isPreservedCandidate(String candidate, List<String> preservedSegments) {
        if (preservedSegments.isEmpty()) {
            return true;
        }

        String normalizedCandidate = normalizeForComparison(candidate);
        if (normalizedCandidate.isBlank()) {
            return false;
        }

        for (String segment : preservedSegments) {
            if (normalizeForComparison(segment).contains(normalizedCandidate)) {
                return true;
            }
        }

        return false;
    }

    private List<CoachExpressionUsageDto> deduplicateUsedExpressions(List<CoachExpressionUsageDto> usedExpressions) {
        if (usedExpressions.size() < 2) {
            return usedExpressions;
        }

        List<CoachExpressionUsageDto> prioritized = new ArrayList<>(usedExpressions);
        prioritized.sort((left, right) -> Integer.compare(
                usedExpressionSpecificityScore(right),
                usedExpressionSpecificityScore(left)
        ));

        List<CoachExpressionUsageDto> selected = new ArrayList<>();
        for (CoachExpressionUsageDto candidate : prioritized) {
            boolean overlapsExisting = selected.stream()
                    .anyMatch(existing -> areOverlappingUsedExpressions(candidate, existing));
            if (!overlapsExisting) {
                selected.add(candidate);
            }
        }

        return usedExpressions.stream()
                .filter(selected::contains)
                .toList();
    }

    private boolean areOverlappingUsedExpressions(
            CoachExpressionUsageDto candidate,
            CoachExpressionUsageDto existing
    ) {
        String candidateCore = normalizeForComparison(candidate.expression());
        String existingCore = normalizeForComparison(existing.expression());
        if (candidateCore.isBlank() || existingCore.isBlank()) {
            return false;
        }

        if (candidateCore.equals(existingCore)) {
            return true;
        }

        if (!hasMeaningfulTokenOverlap(candidateCore, existingCore)) {
            return false;
        }

        return candidateCore.contains(existingCore) || existingCore.contains(candidateCore);
    }

    private boolean hasMeaningfulTokenOverlap(String left, String right) {
        Set<String> leftTokens = extractMeaningfulTokens(left);
        Set<String> rightTokens = extractMeaningfulTokens(right);
        if (leftTokens.isEmpty() || rightTokens.isEmpty()) {
            return false;
        }

        Set<String> intersection = new LinkedHashSet<>(leftTokens);
        intersection.retainAll(rightTokens);
        return intersection.size() >= Math.min(2, Math.min(leftTokens.size(), rightTokens.size()));
    }

    private int usedExpressionSpecificityScore(CoachExpressionUsageDto expression) {
        String normalized = normalizeForComparison(expression.expression());
        int meaningfulTokenCount = extractMeaningfulTokens(normalized).size();
        int totalTokenCount = normalized.isBlank() ? 0 : normalized.split("\\s+").length;
        return meaningfulTokenCount * 100 + totalTokenCount * 10 + normalized.length();
    }

    private List<CorrectionDto> buildSupplementalCorrections(
            List<InlineFeedbackSegmentDto> inlineFeedback,
            List<CorrectionDto> existingCorrections
    ) {
        if (inlineFeedback == null || inlineFeedback.isEmpty()) {
            return List.of();
        }

        List<CorrectionDto> supplemental = new ArrayList<>();
        for (InlineFeedbackSegmentDto segment : inlineFeedback) {
            if (segment == null || !"REPLACE".equalsIgnoreCase(segment.type())) {
                continue;
            }

            CorrectionDto correction = buildSupplementalCorrection(segment);
            if (correction == null || isCoveredByExistingCorrections(correction, existingCorrections)) {
                continue;
            }

            supplemental.add(correction);
        }
        return supplemental;
    }

    private CorrectionDto buildSupplementalCorrection(InlineFeedbackSegmentDto segment) {
        String original = cleanSegmentPhrase(segment.originalText());
        String revised = cleanSegmentPhrase(segment.revisedText());
        if (original.isBlank() || revised.isBlank()) {
            return null;
        }

        String normalizedOriginal = normalizeForComparison(original);
        String normalizedRevised = normalizeForComparison(revised);
        if (normalizedOriginal.isBlank() || normalizedOriginal.equals(normalizedRevised)) {
            return null;
        }

        List<String> originalTokens = tokenList(normalizedOriginal);
        List<String> revisedTokens = tokenList(normalizedRevised);
        if (originalTokens.size() > 4 || revisedTokens.size() > 4) {
            return null;
        }

        if (isPronounBeAgreementChange(originalTokens, revisedTokens)) {
            return new CorrectionDto(
                    "'" + original + "'보다 '" + revised + "'가 앞의 대상을 더 자연스럽게 가리킵니다.",
                    "주어에 맞게 대명사와 be동사를 함께 맞춰 주세요."
            );
        }

        if (isArticleCorrection(originalTokens, revisedTokens)) {
            return new CorrectionDto(
                    "관사를 문맥에 맞게 다듬으면 표현이 더 자연스럽습니다.",
                    "'" + revised + "'처럼 필요한 관사를 맞춰 써 주세요."
            );
        }

        if (isPrepositionCorrection(originalTokens, revisedTokens)) {
            return new CorrectionDto(
                    "전치사를 문맥에 맞게 보완하면 뜻이 더 정확해집니다.",
                    "'" + revised + "'처럼 맞는 전치사를 붙여 주세요."
            );
        }

        return null;
    }

    private boolean isCoveredByExistingCorrections(CorrectionDto candidate, List<CorrectionDto> existingCorrections) {
        if (existingCorrections == null || existingCorrections.isEmpty()) {
            return false;
        }

        String candidateIssue = normalizeForComparison(candidate.issue());
        String candidateSuggestion = normalizeForComparison(candidate.suggestion());

        for (CorrectionDto existing : existingCorrections) {
            String existingText = normalizeForComparison(existing.issue() + " " + existing.suggestion());
            boolean issueCovered = !candidateIssue.isBlank()
                    && candidateIssue.length() >= 8
                    && existingText.contains(candidateIssue);
            boolean suggestionCovered = !candidateSuggestion.isBlank()
                    && candidateSuggestion.split("\\s+").length >= 2
                    && existingText.contains(candidateSuggestion);

            if (issueCovered || suggestionCovered) {
                return true;
            }
        }

        return false;
    }

    private String cleanSegmentPhrase(String value) {
        if (value == null) {
            return "";
        }

        return value.replaceAll("\\s+", " ").trim();
    }

    private List<String> tokenList(String normalizedText) {
        if (normalizedText == null || normalizedText.isBlank()) {
            return List.of();
        }
        return Arrays.stream(normalizedText.split("\\s+"))
                .filter(token -> !token.isBlank())
                .toList();
    }

    private boolean isPronounBeAgreementChange(List<String> originalTokens, List<String> revisedTokens) {
        if (originalTokens.size() != 2 || revisedTokens.size() != 2) {
            return false;
        }

        return PRONOUN_TOKENS.contains(originalTokens.get(0))
                && PRONOUN_TOKENS.contains(revisedTokens.get(0))
                && BE_VERB_TOKENS.contains(originalTokens.get(1))
                && BE_VERB_TOKENS.contains(revisedTokens.get(1))
                && (!originalTokens.get(0).equals(revisedTokens.get(0))
                || !originalTokens.get(1).equals(revisedTokens.get(1)));
    }

    private boolean isArticleCorrection(List<String> originalTokens, List<String> revisedTokens) {
        return containsCategoryShift(originalTokens, revisedTokens, ARTICLE_TOKENS);
    }

    private boolean isPrepositionCorrection(List<String> originalTokens, List<String> revisedTokens) {
        return containsCategoryShift(originalTokens, revisedTokens, PREPOSITION_TOKENS);
    }

    private boolean containsCategoryShift(
            List<String> originalTokens,
            List<String> revisedTokens,
            Set<String> categoryTokens
    ) {
        boolean originalHasCategory = originalTokens.stream().anyMatch(categoryTokens::contains);
        boolean revisedHasCategory = revisedTokens.stream().anyMatch(categoryTokens::contains);

        if (originalHasCategory != revisedHasCategory) {
            return true;
        }

        if (!originalHasCategory) {
            return false;
        }

        return !String.join(" ", originalTokens).equals(String.join(" ", revisedTokens));
    }

    private List<RefinementExpressionDto> buildRefinementExpressions(
            String learnerAnswer,
            String correctedAnswer,
            String modelAnswer
    ) {
        if (modelAnswer == null || modelAnswer.isBlank()) {
            return List.of();
        }

        String normalizedLearnerAnswer = normalizeForComparison(learnerAnswer);
        String normalizedCorrectedAnswer = normalizeForComparison(correctedAnswer);
        LinkedHashSet<String> candidates = new LinkedHashSet<>();

        for (Pattern pattern : MODEL_EXPRESSION_PATTERNS) {
            Matcher matcher = pattern.matcher(modelAnswer);
            while (matcher.find()) {
                String rawCandidate = cleanExpressionCandidate(matcher.group());
                if (shouldRecommendExpressionCandidate(rawCandidate, normalizedLearnerAnswer, normalizedCorrectedAnswer)) {
                    String candidate = toReusableRefinementExpression(rawCandidate);
                    if (!candidate.isBlank()) {
                        candidates.add(candidate);
                    }
                }
            }
        }

        if (candidates.isEmpty()) {
            for (String clause : modelAnswer.split("[.!?]")) {
                String rawCandidate = cleanExpressionCandidate(clause);
                if (shouldRecommendExpressionCandidate(rawCandidate, normalizedLearnerAnswer, normalizedCorrectedAnswer)) {
                    String candidate = toReusableRefinementExpression(rawCandidate);
                    if (!candidate.isBlank()) {
                        candidates.add(candidate);
                    }
                }
                if (candidates.size() >= 3) {
                    break;
                }
            }
        }

        List<RefinementExpressionDto> expressions = new ArrayList<>();
        for (String candidate : candidates) {
            expressions.add(new RefinementExpressionDto(
                    candidate,
                    buildRecommendationGuidance(candidate),
                    buildRefinementExample(modelAnswer, candidate)
            ));
            if (expressions.size() >= 3) {
                break;
            }
        }

        return expressions;
    }

    private List<RefinementExpressionDto> sanitizeRefinementExpressions(
            List<RefinementExpressionDto> expressions,
            String learnerAnswer,
            String correctedAnswer,
            String modelAnswer
    ) {
        String normalizedLearnerAnswer = normalizeForComparison(learnerAnswer);
        String normalizedCorrectedAnswer = normalizeForComparison(correctedAnswer);
        List<RefinementExpressionDto> sanitized = new ArrayList<>();
        LinkedHashSet<String> seenExpressions = new LinkedHashSet<>();

        if (expressions != null) {
            for (RefinementExpressionDto expression : expressions) {
                if (expression == null) {
                    continue;
                }

                String rawCandidate = cleanExpressionCandidate(expression.expression());
                if (!shouldRecommendExpressionCandidate(rawCandidate, normalizedLearnerAnswer, normalizedCorrectedAnswer)) {
                    continue;
                }

                String candidate = toReusableRefinementExpression(rawCandidate);
                if (candidate.isBlank()) {
                    continue;
                }

                String normalizedCandidate = normalizeForComparison(candidate);
                if (!seenExpressions.add(normalizedCandidate)) {
                    continue;
                }

                String guidance = expression.guidance() == null || expression.guidance().isBlank()
                        ? buildRecommendationGuidance(candidate)
                        : expression.guidance().trim();
                String example = expression.example() == null || expression.example().isBlank()
                        ? buildRefinementExample(modelAnswer, candidate)
                        : expression.example().trim();
                if (normalizeForComparison(example).equals(normalizeForComparison(candidate))) {
                    example = buildRefinementExample(modelAnswer, candidate);
                }

                sanitized.add(new RefinementExpressionDto(candidate, guidance, example));
                if (sanitized.size() >= 3) {
                    return sanitized;
                }
            }
        }

        if (sanitized.size() >= 3) {
            return sanitized;
        }

        for (String candidate : extractAdditionalRefinementCandidates(
                modelAnswer,
                normalizedLearnerAnswer,
                normalizedCorrectedAnswer,
                seenExpressions
        )) {
            sanitized.add(new RefinementExpressionDto(
                    candidate,
                    buildRecommendationGuidance(candidate),
                    buildRefinementExample(modelAnswer, candidate)
            ));
            if (sanitized.size() >= 3) {
                break;
            }
        }

        return sanitized;
    }

    private List<String> extractAdditionalRefinementCandidates(
            String modelAnswer,
            String normalizedLearnerAnswer,
            String normalizedCorrectedAnswer,
            LinkedHashSet<String> seenExpressions
    ) {
        if (modelAnswer == null || modelAnswer.isBlank()) {
            return List.of();
        }

        LinkedHashSet<String> candidates = new LinkedHashSet<>();
        for (Pattern pattern : MODEL_EXPRESSION_PATTERNS) {
            Matcher matcher = pattern.matcher(modelAnswer);
            while (matcher.find()) {
                String rawCandidate = cleanExpressionCandidate(matcher.group());
                String candidate = toReusableRefinementExpression(rawCandidate);
                String normalizedCandidate = normalizeForComparison(candidate);
                if (seenExpressions.contains(normalizedCandidate)) {
                    continue;
                }
                if (!candidate.isBlank()
                        && shouldRecommendExpressionCandidate(rawCandidate, normalizedLearnerAnswer, normalizedCorrectedAnswer)) {
                    candidates.add(candidate);
                }
            }
        }

        return new ArrayList<>(candidates);
    }

    private String toReusableRefinementExpression(String candidate) {
        String cleaned = cleanExpressionCandidate(candidate);
        if (cleaned.isBlank()) {
            return "";
        }

        if (cleaned.contains("[") && cleaned.contains("]")) {
            return normalizeFramePunctuation(cleaned);
        }

        String lower = cleaned.toLowerCase(Locale.ROOT);

        if (lower.startsWith("my favorite ") && extractBecauseBeAdjectiveTail(cleaned) != null) {
            String adjectiveTail = extractBecauseBeAdjectiveTail(cleaned);
            return "My favorite [thing] is [item] because it is " + toAdjectiveFrame(adjectiveTail);
        }

        if ((lower.startsWith("i like ") || lower.startsWith("i love ") || lower.startsWith("i enjoy "))
                && extractBecauseBeAdjectiveTail(cleaned) != null) {
            String adjectiveTail = extractBecauseBeAdjectiveTail(cleaned);
            if (lower.startsWith("i like ")) {
                return "I like [thing] because it is " + toAdjectiveFrame(adjectiveTail);
            }
            if (lower.startsWith("i love ")) {
                return "I love [thing] because it is " + toAdjectiveFrame(adjectiveTail);
            }
            return "I enjoy [thing] because it is " + toAdjectiveFrame(adjectiveTail);
        }

        if (lower.startsWith("i want to ") && lower.contains(" so that i can ")) {
            return "I want to [verb] so that I can [result].";
        }

        if (lower.startsWith("i plan to ") && lower.contains(" by ")) {
            return "I plan to [verb] by [verb]ing [method].";
        }

        if (lower.startsWith("i would like to ")) {
            return "I would like to [verb].";
        }

        if (lower.startsWith("i want to ")) {
            return "I want to [verb].";
        }

        if (lower.startsWith("i usually ")) {
            return "I usually [activity].";
        }

        if (lower.startsWith("i am interested in ")) {
            return "I am interested in [topic].";
        }

        if (lower.startsWith("because ")) {
            return "because [reason]";
        }

        if (lower.startsWith("by ") && lower.contains("ing ")) {
            return "by [verb]ing [method]";
        }

        if (lower.startsWith("so that ")) {
            return "so that [result]";
        }

        if (lower.startsWith("one reason is that ")) {
            return "One reason is that [reason].";
        }

        if (lower.startsWith("this is because ")) {
            return "This is because [reason].";
        }

        if (lower.startsWith("for example")) {
            return "For example, [detail].";
        }

        return isReusableShortPhrase(cleaned) ? normalizeFramePunctuation(cleaned) : "";
    }

    private String extractBecauseBeAdjectiveTail(String candidate) {
        String lower = candidate.toLowerCase(Locale.ROOT);
        String[] markers = {" because it is ", " because it's "};
        for (String marker : markers) {
            int index = lower.indexOf(marker);
            if (index >= 0) {
                return candidate.substring(index + marker.length()).trim();
            }
        }
        return null;
    }

    private String toAdjectiveFrame(String adjectiveTail) {
        String normalizedTail = cleanExpressionCandidate(adjectiveTail);
        if (normalizedTail.isBlank()) {
            return "[adj].";
        }

        if (normalizedTail.toLowerCase(Locale.ROOT).contains(" and ")) {
            return "[adj] and [adj].";
        }

        return "[adj].";
    }

    private boolean isReusableShortPhrase(String candidate) {
        String normalized = normalizeForComparison(candidate);
        if (normalized.isBlank()) {
            return false;
        }

        int tokenCount = normalized.split("\\s+").length;
        return tokenCount >= 2 && tokenCount <= 6;
    }

    private String normalizeFramePunctuation(String value) {
        String cleaned = cleanExpressionCandidate(value);
        if (cleaned.isBlank()) {
            return "";
        }

        if (cleaned.endsWith(".") || cleaned.endsWith("!") || cleaned.endsWith("?")) {
            return cleaned;
        }

        String lower = cleaned.toLowerCase(Locale.ROOT);
        if (lower.startsWith("i ")
                || lower.startsWith("my ")
                || lower.startsWith("one reason")
                || lower.startsWith("this is because")
                || lower.startsWith("for example")) {
            return cleaned + ".";
        }

        return cleaned;
    }

    private String buildRecommendationGuidance(String expression) {
        String lower = expression.toLowerCase(Locale.ROOT);
        if (expression.contains("[") && expression.contains("]")) {
            if (lower.startsWith("because ")) {
                return "칸에 맞는 이유를 넣어서 근거를 자연스럽게 이어 보세요.";
            }
            if (lower.startsWith("by ")) {
                return "칸에 방법을 넣어 어떻게 실천하는지 구체적으로 써 보세요.";
            }
            if (lower.startsWith("so that ")) {
                return "칸에 기대 결과를 넣어 목적을 또렷하게 보여 주세요.";
            }
            return "칸에 내 내용에 맞는 단어를 넣어 바로 응용해 보세요.";
        }
        if (lower.startsWith("because ")) {
            return "이유를 더 자연스럽게 덧붙이고 싶을 때 써보세요.";
        }
        if (lower.startsWith("by ")) {
            return "방법이나 실천 방식을 더 구체적으로 보여줄 때 좋아요.";
        }
        if (lower.startsWith("i would like to ") || lower.startsWith("i want to ")) {
            return "하고 싶은 행동이나 계획을 더 자연스럽게 말할 때 유용해요.";
        }
        if (lower.startsWith("i plan to ")) {
            return "앞으로의 계획이나 실천 의지를 분명하게 보일 때 좋아요.";
        }
        if (lower.startsWith("i usually ")) {
            return "평소 습관이나 반복 행동을 더 자연스럽게 설명할 때 좋아요.";
        }
        if (lower.startsWith("so that ")) {
            return "목적이나 기대 효과를 조금 더 또렷하게 붙일 때 유용해요.";
        }
        return "다음 답변에서 써보면 더 자연스럽고 구체적으로 다듬는 데 도움이 돼요.";
    }

    private boolean shouldRecommendExpressionCandidate(
            String candidate,
            String normalizedLearnerAnswer,
            String normalizedCorrectedAnswer
    ) {
        if (candidate == null || candidate.isBlank()) {
            return false;
        }

        String normalizedCandidate = normalizeForComparison(candidate);
        if (normalizedCandidate.isBlank()) {
            return false;
        }

        String normalizedReusableCandidate = normalizeForComparison(toReusableRefinementExpression(candidate));
        String tokenSource = normalizedReusableCandidate.isBlank() ? normalizedCandidate : normalizedReusableCandidate;

        int tokenCount = tokenSource.split("\\s+").length;
        if (tokenCount < 2 || tokenCount > 14) {
            return false;
        }

        return !normalizedLearnerAnswer.contains(normalizedCandidate)
                && !normalizedCorrectedAnswer.contains(normalizedCandidate);
    }

    private String buildRefinementGuidance(String expression) {
        String lower = expression.toLowerCase(Locale.ROOT);
        if (lower.startsWith("because ")) {
            return "이유를 한 번 더 또렷하게 덧붙일 때 가져오면 좋아요.";
        }
        if (lower.startsWith("by ")) {
            return "어떻게 실천하는지 방법을 구체적으로 붙일 때 잘 어울려요.";
        }
        if (lower.startsWith("i would like to ") || lower.startsWith("i want to ")) {
            return "하고 싶은 행동이나 계획을 더 자연스럽게 말할 때 써볼 수 있어요.";
        }
        if (lower.startsWith("i plan to ")) {
            return "앞으로의 계획이나 실천 의지를 더 분명하게 보여줄 때 좋아요.";
        }
        if (lower.startsWith("i usually ")) {
            return "평소 습관이나 반복 행동을 더 자연스럽게 설명할 때 유용해요.";
        }
        if (lower.startsWith("so that ")) {
            return "목적이나 기대 효과를 조금 더 선명하게 붙일 때 좋아요.";
        }
        return "모범 답안에서 가져온 표현이라 답변을 조금 더 자연스럽고 구체적으로 다듬는 데 도움이 돼요.";
    }

    private String buildRefinementExample(String modelAnswer, String expression) {
        if (expression != null && expression.contains("[") && expression.contains("]")) {
            String frameMatch = findFrameExampleInModelAnswer(modelAnswer, expression);
            if (!frameMatch.isBlank()) {
                return frameMatch;
            }
            return materializeRefinementFrame(expression);
        }

        if (modelAnswer == null || modelAnswer.isBlank()) {
            return expression == null ? "" : expression;
        }

        String normalizedExpression = expression.toLowerCase(Locale.ROOT);
        for (String sentence : modelAnswer.split("(?<=[.!?])\\s+")) {
            if (sentence.toLowerCase(Locale.ROOT).contains(normalizedExpression)) {
                return sentence.trim();
            }
        }

        return expression;
    }

    private String findFrameExampleInModelAnswer(String modelAnswer, String frame) {
        if (modelAnswer == null || modelAnswer.isBlank() || frame == null || frame.isBlank()) {
            return "";
        }

        String normalizedFrame = normalizeForComparison(frame);
        for (String sentence : modelAnswer.split("(?<=[.!?])\\s+")) {
            String normalizedSentence = normalizeForComparison(sentence);
            if (matchesRefinementFrame(normalizedSentence, normalizedFrame)) {
                return sentence.trim();
            }
        }

        return "";
    }

    private boolean matchesRefinementFrame(String normalizedSentence, String normalizedFrame) {
        if (normalizedSentence.isBlank() || normalizedFrame.isBlank()) {
            return false;
        }

        if (normalizedFrame.startsWith("my favorite thing is item because it is")) {
            return normalizedSentence.startsWith("my favorite ")
                    && normalizedSentence.contains(" because it is ");
        }
        if (normalizedFrame.startsWith("i like thing because it is")) {
            return normalizedSentence.startsWith("i like ")
                    && normalizedSentence.contains(" because it is ");
        }
        if (normalizedFrame.startsWith("i love thing because it is")) {
            return normalizedSentence.startsWith("i love ")
                    && normalizedSentence.contains(" because it is ");
        }
        if (normalizedFrame.startsWith("i enjoy thing because it is")) {
            return normalizedSentence.startsWith("i enjoy ")
                    && normalizedSentence.contains(" because it is ");
        }
        if (normalizedFrame.startsWith("i want to verb so that i can result")) {
            return normalizedSentence.startsWith("i want to ")
                    && normalizedSentence.contains(" so that i can ");
        }
        if (normalizedFrame.startsWith("i plan to verb by verb ing method")) {
            return normalizedSentence.startsWith("i plan to ")
                    && normalizedSentence.contains(" by ");
        }
        if (normalizedFrame.startsWith("i would like to verb")) {
            return normalizedSentence.startsWith("i would like to ");
        }
        if (normalizedFrame.startsWith("i want to verb")) {
            return normalizedSentence.startsWith("i want to ");
        }
        if (normalizedFrame.startsWith("i usually activity")) {
            return normalizedSentence.startsWith("i usually ");
        }
        if (normalizedFrame.startsWith("i am interested in topic")) {
            return normalizedSentence.startsWith("i am interested in ");
        }
        if (normalizedFrame.startsWith("because reason")) {
            return normalizedSentence.contains(" because ");
        }
        if (normalizedFrame.startsWith("by verb ing method")) {
            return normalizedSentence.contains(" by ");
        }
        if (normalizedFrame.startsWith("so that result")) {
            return normalizedSentence.contains(" so that ");
        }
        if (normalizedFrame.startsWith("one reason is that reason")) {
            return normalizedSentence.startsWith("one reason is that ");
        }
        if (normalizedFrame.startsWith("this is because reason")) {
            return normalizedSentence.startsWith("this is because ");
        }
        if (normalizedFrame.startsWith("for example detail")) {
            return normalizedSentence.startsWith("for example");
        }

        return false;
    }

    private String materializeRefinementFrame(String expression) {
        String example = expression == null ? "" : expression;
        example = example.replace("[thing]", "skill");
        example = example.replace("[item]", "public speaking");
        example = example.replace("[adj]", "useful");
        example = example.replace("[verb]", "practice every day");
        example = example.replace("[result]", "improve steadily");
        example = example.replace("[activity]", "review my notes");
        example = example.replace("[topic]", "new learning methods");
        example = example.replace("[reason]", "it helps me stay focused");
        example = example.replace("[method]", "rewriting my answers");
        example = example.replace("[detail]", "I review my answer after class");
        example = example.replace("[place]", "the library");
        example = example.replace("[language]", "English");
        return example;
    }

    private boolean shouldKeepExpressionCandidate(String candidate, String normalizedLearnerAnswer) {
        if (candidate == null || candidate.isBlank()) {
            return false;
        }

        String normalizedCandidate = normalizeForComparison(candidate);
        if (normalizedCandidate.isBlank()) {
            return false;
        }

        int tokenCount = normalizedCandidate.split("\\s+").length;
        if (tokenCount < 3 || tokenCount > 10) {
            return false;
        }

        return !normalizedLearnerAnswer.contains(normalizedCandidate);
    }

    private String sanitizeExtractedExpression(String candidate) {
        if (candidate == null) {
            return "";
        }

        String sanitized = candidate.trim()
                .replaceAll("\\s+", " ")
                .replaceAll("^[^\\p{L}\\p{N}']+|[^\\p{L}\\p{N}']+$", "");
        Matcher clauseBreakMatcher = FEEDBACK_USED_CLAUSE_BREAK_PATTERN.matcher(sanitized);
        if (clauseBreakMatcher.find()) {
            String prefix = sanitized.substring(0, clauseBreakMatcher.start()).trim();
            if (extractMeaningfulTokens(normalizeForComparison(prefix)).size() >= 2) {
                sanitized = prefix;
            }
        }

        String[] tokens = sanitized.split("\\s+");
        int end = tokens.length;
        while (end > 0 && TRAILING_WEAK_TOKENS.contains(tokens[end - 1].toLowerCase(Locale.ROOT))) {
            end -= 1;
        }

        if (end <= 0) {
            return "";
        }

        return String.join(" ", Arrays.copyOf(tokens, end)).trim();
    }

    private boolean isValidUsedExpressionCandidate(String candidate) {
        String normalizedCandidate = normalizeForComparison(candidate);
        if (normalizedCandidate.isBlank()) {
            return false;
        }

        int meaningfulTokenCount = extractMeaningfulTokens(normalizedCandidate).size();
        int totalTokenCount = normalizedCandidate.split("\\s+").length;
        if (meaningfulTokenCount >= 2) {
            return totalTokenCount <= 10;
        }

        return meaningfulTokenCount >= 1 && totalTokenCount >= 2 && totalTokenCount <= 6;
    }

    private String buildUsedExpressionUsageTip(String expression) {
        String lower = expression.toLowerCase(Locale.ROOT);
        if (lower.startsWith("because ")) {
            return "이유를 자연스럽게 덧붙일 때 좋은 표현이에요.";
        }
        if (lower.startsWith("by ")) {
            return "방법을 구체적으로 설명할 때 좋아요.";
        }
        if (lower.startsWith("so that ")) {
            return "목적이나 기대 결과를 이어 붙일 때 좋아요.";
        }
        if (lower.startsWith("i want to ")
                || lower.startsWith("i would like to ")
                || lower.startsWith("i plan to ")
                || lower.startsWith("i hope to ")) {
            return "목표나 계획을 분명하게 말할 때 좋아요.";
        }
        if (lower.startsWith("i usually ") || lower.startsWith("i often ")) {
            return "평소 습관이나 자주 하는 행동을 말할 때 좋아요.";
        }
        return FEEDBACK_USED_EXPRESSION_USAGE_TIP;
    }

    private String cleanExpressionCandidate(String raw) {
        if (raw == null) {
            return "";
        }

        return raw
                .replaceAll("\\s+", " ")
                .replaceAll("^[,;:\\-\\s]+|[,;:\\-\\s]+$", "")
                .trim();
    }

    private String normalizeForComparison(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }

        return value.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9\\s']", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private Set<String> extractMeaningfulTokens(String value) {
        String normalized = normalizeForComparison(value);
        if (normalized.isBlank()) {
            return Set.of();
        }

        return Arrays.stream(normalized.split("\\s+"))
                .filter(token -> token.length() >= 3)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
    }

    private boolean shouldCompleteLoop(int score, List<CorrectionDto> corrections) {
        return score >= 85 || (score >= 80 && corrections.size() <= 2);
    }

    private boolean containsAny(String source, String... tokens) {
        String lower = source.toLowerCase();
        for (String token : tokens) {
            if (lower.contains(token)) {
                return true;
            }
        }
        return false;
    }

    private String buildModelAnswer(PromptDto prompt) {
        return switch (prompt.id()) {
            case "prompt-a-4" ->
                    "After work, I usually go for a walk and cook dinner at home because it helps me relax. I enjoy that time because I can clear my head and prepare for the next day.";
            case "prompt-b-4" ->
                    "I want to visit Vancouver because I love nature and calm cities. I would like to explore the parks, try local cafes, and spend time near the water.";
            case "prompt-b-5" ->
                    "One skill I want to improve this year is English speaking. I plan to practice every day by answering one question, reviewing the feedback, and rewriting my answer more clearly.";
            default ->
                    "I want to answer this question clearly and naturally. First, I will give my main idea, then I will add a reason and one specific example to support it.";
        };
    }

    private String buildCorrectedAnswer(String answer) {
        if (answer == null || answer.isBlank()) {
            return "";
        }

        String normalized = answer.trim().replaceAll("\\s+", " ");
        if (!normalized.isEmpty()) {
            normalized = Character.toUpperCase(normalized.charAt(0)) + normalized.substring(1);
        }

        if (!normalized.endsWith(".") && !normalized.endsWith("!") && !normalized.endsWith("?")) {
            normalized += ".";
        }

        return normalized;
    }

    private List<InlineFeedbackSegmentDto> buildInlineFeedback(String answer, String correctedAnswer) {
        if (answer == null || answer.isBlank()) {
            return List.of();
        }

        if (correctedAnswer == null || correctedAnswer.isBlank() || correctedAnswer.equals(answer)) {
            return List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer));
        }
        return openAiFeedbackClient.buildPreciseInlineFeedback(answer, correctedAnswer);
    }

    private String buildRewriteChallenge(PromptDto prompt, boolean alreadyStrong) {
        if (alreadyStrong) {
            return "답변에 구체적인 예시 1개와 감정을 드러내는 표현 1개를 넣어 더 생생하게 다시 써 보세요.";
        }
        return "\"" + prompt.topic() + "\" 주제에 맞춰 3~4문장으로 다시 써 보세요. 먼저 직접 답하고, 이유를 설명한 뒤, 관련된 구체적 예시를 하나 덧붙이면 좋아요.";
    }
}
