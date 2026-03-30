package com.writeloop.service;

import com.writeloop.dto.CorrectionDto;
import com.writeloop.dto.CoachExpressionUsageDto;
import com.writeloop.dto.FeedbackRequestDto;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.GrammarFeedbackItemDto;
import com.writeloop.dto.InlineFeedbackSegmentDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;
import com.writeloop.dto.PromptHintItemDto;
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
import lombok.extern.slf4j.Slf4j;
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
@Slf4j
@RequiredArgsConstructor
public class FeedbackService {
    private static final String LETTER_TOKEN = "[\\p{L}][\\p{L}'-]*";
    private static final String FEEDBACK_USED_EXPRESSION_SOURCE = "SELF_DISCOVERED";
    private static final String FEEDBACK_USED_EXPRESSION_MATCH_TYPE = "SELF_DISCOVERED";
    private static final String FEEDBACK_USED_EXPRESSION_USAGE_TIP = "\ub2f5\ubcc0 \uc548\uc5d0\uc11c \uc790\uc5f0\uc2a4\ub7fd\uac8c \uc0b4\ub9b0 \ud45c\ud604\uc774\uc5d0\uc694.";
    private static final Set<String> PRONOUN_TOKENS = Set.of(
            "i", "you", "he", "she", "it", "we", "they"
    );
    private static final Set<String> BE_VERB_TOKENS = Set.of(
            "am", "is", "are", "was", "were"
    );
    private static final Set<String> ARTICLE_TOKENS = Set.of(
            "a", "an", "the"
    );
    private static final Set<String> DETERMINER_TOKENS = Set.of(
            "a", "an", "the", "this", "that", "these", "those",
            "my", "your", "his", "her", "our", "their"
    );
    private static final Set<String> PREPOSITION_TOKENS = Set.of(
            "to", "for", "of", "in", "on", "at", "with", "by", "from", "about"
    );
    private static final List<Pattern> MODEL_EXPRESSION_PATTERNS = List.of(
            Pattern.compile("\\bI want to [^,.!?;]+", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\bI would like to [^,.!?;]+", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\bI plan to [^,.!?;]+", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\bI usually [^,.!?;]+", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\bOne challenge I often face with [^,.!?;]+ is [^,.!?;]+", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\bWhat I like most about [^,.!?;]+ is that [^,.!?;]+", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\bIt helps me [^,.!?;]+(?: and [^,.!?;]+)?", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\bThis makes it easier to [^,.!?;]+", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\bWhen I want to [^,.!?;]+, I [^,.!?;]+", Pattern.CASE_INSENSITIVE),
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
    private static final Set<String> REFINEMENT_OVERLAP_STOP_TOKENS = Set.of(
            "a", "an", "and", "are", "as", "at", "be", "because", "by", "can", "for", "from",
            "i", "if", "in", "into", "is", "it", "its", "my", "of", "on", "one", "or", "our",
            "reason", "so", "that", "the", "their", "this", "to", "when", "with", "your", "his", "her"
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
        boolean openAiConfigured = openAiFeedbackClient.isConfigured();
        List<PromptHintDto> hints = promptService.findHintsByPromptId(prompt.id());

        FeedbackResponseDto feedback = openAiConfigured
                ? openAiFeedbackClient.review(prompt, answer, hints)
                : buildLocalFeedback(prompt, answer);
        feedback = sanitizeFeedbackResponse(feedback, answer, hints);

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
                feedback.grammarFeedback(),
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
            strengths.add("\ub2f5\ubcc0 \uae38\uc774\uac00 \ucda9\ubd84\ud574\uc11c \uc0dd\uac01\uc744 \uc870\uae08 \ub354 \ud3bc\uccd0 \ubcf4\uc778 \uc810\uc774 \uc88b\uc544\uc694.");
        } else {
            corrections.add(new CorrectionDto(
                    "\ub2f5\ubcc0\uc774 \uc870\uae08 \uc9e7\uc544\uc11c \uc0dd\uac01\uc774 \ucda9\ubd84\ud788 \ub4dc\ub7ec\ub098\uc9c0 \uc54a\uc558\uc5b4\uc694.",
                    "\ud55c\ub450 \ubb38\uc7a5\uc744 \ub354 \ub367\ubd99\uc5ec \uc774\uc720\ub098 \uc608\uc2dc\ub97c \ud568\uaed8 \ub9d0\ud574 \ubcf4\uc138\uc694."
            ));
        }

        if (containsAny(answer, "because", "so", "and", "but")) {
            strengths.add("\uc5f0\uacb0 \ud45c\ud604\uc744 \uc0ac\uc6a9\ud574\uc11c \ubb38\uc7a5 \ud750\ub984\uc744 \uc790\uc5f0\uc2a4\ub7fd\uac8c \uc774\uc5b4 \uac04 \uc810\uc774 \uc88b\uc544\uc694.");
        } else {
            corrections.add(new CorrectionDto(
                    "\ubb38\uc7a5 \uc0ac\uc774\ub97c \uc774\uc5b4 \uc8fc\ub294 \uc5f0\uacb0 \ud45c\ud604\uc774 \ub354 \uc788\uc73c\uba74 \uc88b\uc544\uc694.",
                    "\"because\", \"so\", \"and\", \"but\" \uac19\uc740 \uc5f0\uacb0\uc5b4\ub97c \ud65c\uc6a9\ud574 \uc0dd\uac01\uc758 \ud750\ub984\uc744 \ubcf4\uc5ec \uc8fc\uc138\uc694."
            ));
        }

        if (containsAny(answer, "i like", "i enjoy", "i want", "i usually", "i practice")) {
            strengths.add("\uc790\uc2e0\uc758 \uc0dd\uac01\uc774\ub098 \uc2b5\uad00\uc744 \uc9c1\uc811\uc801\uc73c\ub85c \ud45c\ud604\ud55c \uc810\uc774 \uc88b\uc544\uc694.");
        } else {
            corrections.add(new CorrectionDto(
                    "\uc790\uc2e0\uc758 \uc758\uacac\uc774\ub098 \uc2b5\uad00\uc744 \ubcf4\uc5ec \uc8fc\ub294 \ud45c\ud604\uc774 \uc870\uae08 \ub354 \uc788\uc73c\uba74 \uc88b\uc544\uc694.",
                    "\"I usually...\", \"I want...\", \"I enjoy...\" \uac19\uc740 \ud45c\ud604\uc73c\ub85c \ub0b4\uc6a9\uc744 \ub354 \ubd84\uba85\ud558\uac8c \uc368 \ubcf4\uc138\uc694."
            ));
        }

        if (!answer.endsWith(".") && !answer.endsWith("!") && !answer.endsWith("?")) {
            corrections.add(new CorrectionDto(
                    "\ubb38\uc7a5 \ub05d \ubb38\uc7a5\ubd80\ud638\uac00 \ube60\uc838 \uc788\uc5b4\uc694.",
                    "\ubb38\uc7a5\uc774 \ub05d\ub0a0 \ub54c\ub294 \ub9c8\uce68\ud45c\ub098 \ubb3c\uc74c\ud45c\ub97c \ubd99\uc5ec \ubb38\uc7a5\uc744 \ubd84\uba85\ud558\uac8c \ub9c8\ubb34\ub9ac\ud574 \ubcf4\uc138\uc694."
            ));
        }

        int score = Math.max(62, 88 - corrections.size() * 7 + strengths.size() * 3);
        String summary = corrections.isEmpty()
                ? "\ud575\uc2ec \uc0dd\uac01\uc774 \ube44\uad50\uc801 \uc798 \ub4dc\ub7ec\ub0ac\uc5b4\uc694. \ub2e4\uc74c \ub2f5\ubcc0\uc5d0\uc11c\ub294 \uc774\uc720\ub098 \uc608\uc2dc\ub97c \uc870\uae08\ub9cc \ub354 \ubcf4\ud0dc\uba74 \ub354 \uc644\uc131\ub3c4 \ub192\uc740 \ub2f5\ubcc0\uc774 \ub420 \uc218 \uc788\uc5b4\uc694."
                : "\uae30\ubcf8 \uc758\ubbf8\ub294 \uc798 \uc804\ub2ec\ub418\uc9c0\ub9cc \ubb38\uc7a5 \uc5f0\uacb0\uacfc \uad6c\uccb4\uc131\uc774 \uc870\uae08 \ub354 \ubcf4\uac15\ub418\uba74 \ub354 \uc790\uc5f0\uc2a4\ub7ec\uc6b4 \ub2f5\ubcc0\uc774 \ub420 \uc218 \uc788\uc5b4\uc694.";

        String correctedAnswer = buildCorrectedAnswer(answer);
        List<InlineFeedbackSegmentDto> inlineFeedback = buildInlineFeedback(answer, correctedAnswer);
        List<GrammarFeedbackItemDto> grammarFeedback = sanitizeGrammarFeedback(List.of(), inlineFeedback);
        String modelAnswer = buildModelAnswer(prompt);
        List<RefinementExpressionDto> refinementExpressions = buildRefinementExpressions(answer, correctedAnswer, modelAnswer);
        String rewriteChallenge = buildRewriteChallenge(prompt, corrections.isEmpty());
        int finalScore = Math.min(score, 96);
        boolean loopComplete = shouldCompleteLoop(finalScore, corrections, grammarFeedback);
        String completionMessage = loopComplete
                ? "\uc88b\uc544\uc694. \uc774\ubc88 \ub2f5\ubcc0\uc740 \uae30\ubcf8 \ubb38\uc7a5 \ud750\ub984\uc774 \uc548\uc815\uc801\uc774\uc5d0\uc694. \ub2e4\uc74c\uc5d0\ub294 \uc774\uc720\ub098 \uc608\uc2dc\ub97c \uc870\uae08 \ub354 \ubcf4\ud0dc\uc11c \ub2f5\ubcc0\uc744 \ub354 \ud48d\ubd80\ud558\uac8c \ub9cc\ub4e4\uc5b4 \ubcf4\uc138\uc694."
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
                grammarFeedback,
                correctedAnswer,
                refinementExpressions,
                modelAnswer,
                rewriteChallenge,
                List.of()
        );
    }

    private FeedbackResponseDto sanitizeFeedbackResponse(
            FeedbackResponseDto feedback,
            String learnerAnswer,
            List<PromptHintDto> hints
    ) {
        List<InlineFeedbackSegmentDto> inlineFeedback = rebuildInlineFeedback(
                learnerAnswer,
                feedback.correctedAnswer(),
                feedback.inlineFeedback()
        );
        List<GrammarFeedbackItemDto> grammarFeedback = sanitizeGrammarFeedback(
                feedback.grammarFeedback(),
                inlineFeedback
        );
        List<CorrectionDto> corrections = sanitizeCorrections(
                feedback.corrections(),
                grammarFeedback
        );
        List<RefinementExpressionDto> refinementExpressions = sanitizeRefinementExpressions(
                feedback.promptId(),
                feedback.refinementExpressions(),
                learnerAnswer,
                feedback.correctedAnswer(),
                feedback.modelAnswer(),
                hints
        );
        List<CoachExpressionUsageDto> usedExpressions = sanitizeUsedExpressions(
                feedback.usedExpressions(),
                learnerAnswer,
                inlineFeedback
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
                inlineFeedback,
                grammarFeedback,
                feedback.correctedAnswer(),
                refinementExpressions,
                feedback.modelAnswer(),
                feedback.rewriteChallenge(),
                usedExpressions
        );
    }

    private List<InlineFeedbackSegmentDto> rebuildInlineFeedback(
            String learnerAnswer,
            String correctedAnswer,
            List<InlineFeedbackSegmentDto> existingInlineFeedback
    ) {
        if (correctedAnswer != null && !correctedAnswer.isBlank()) {
            return openAiFeedbackClient.buildInlineFeedbackFromCorrectedAnswer(learnerAnswer, correctedAnswer);
        }

        if (existingInlineFeedback == null || existingInlineFeedback.isEmpty()) {
            return List.of();
        }

        return existingInlineFeedback;
    }

    private List<CorrectionDto> sanitizeCorrections(
            List<CorrectionDto> corrections,
            List<GrammarFeedbackItemDto> grammarFeedback
    ) {
        List<CorrectionDto> sanitized = new ArrayList<>();
        LinkedHashSet<String> seen = new LinkedHashSet<>();

        if (corrections != null) {
            for (CorrectionDto correction : corrections) {
                if (correction == null || correction.issue() == null || correction.suggestion() == null) {
                    continue;
                }

                if (isGrammarCorrection(correction, grammarFeedback)) {
                    continue;
                }

                CorrectionDto localizedCorrection = sanitizeCorrectionLanguage(correction);
                if (localizedCorrection == null) {
                    continue;
                }

                String key = normalizeLooseText(localizedCorrection.issue() + " " + localizedCorrection.suggestion());
                if (key.isBlank() || !seen.add(key)) {
                    continue;
                }
                sanitized.add(localizedCorrection);
            }
        }

        return sanitized;
    }

    private CorrectionDto sanitizeCorrectionLanguage(CorrectionDto correction) {
        if (correction == null) {
            return null;
        }

        String issue = correction.issue() == null ? "" : correction.issue().trim();
        String suggestion = correction.suggestion() == null ? "" : correction.suggestion().trim();
        if (issue.isBlank() || suggestion.isBlank()) {
            return null;
        }
        if (!containsHangul(issue) || !containsHangul(suggestion)) {
            return null;
        }

        return new CorrectionDto(issue, suggestion);
    }

    private List<GrammarFeedbackItemDto> sanitizeGrammarFeedback(
            List<GrammarFeedbackItemDto> grammarFeedback,
            List<InlineFeedbackSegmentDto> inlineFeedback
    ) {
        List<GrammarFeedbackItemDto> provided = new ArrayList<>();
        if (grammarFeedback != null) {
            for (GrammarFeedbackItemDto item : grammarFeedback) {
                GrammarFeedbackItemDto sanitizedItem = sanitizeGrammarFeedbackItem(item);
                if (sanitizedItem == null) {
                    continue;
                }
                provided.add(sanitizedItem);
            }
        }

        if (inlineFeedback == null || inlineFeedback.isEmpty()) {
            return List.of();
        }

        if (!provided.isEmpty()) {
            List<GrammarFeedbackItemDto> preserved = new ArrayList<>();
            LinkedHashSet<String> seenProvided = new LinkedHashSet<>();
            for (GrammarFeedbackItemDto item : provided) {
                if (seenProvided.add(buildGrammarFeedbackKey(item))) {
                    preserved.add(item);
                }
            }
            return preserved;
        }

        List<GrammarFeedbackItemDto> synchronizedItems = new ArrayList<>();
        LinkedHashSet<String> seen = new LinkedHashSet<>();
        for (InlineFeedbackSegmentDto segment : inlineFeedback) {
            GrammarFeedbackItemDto fallback = buildFallbackGrammarFeedback(segment);
            if (fallback == null || !seen.add(buildGrammarFeedbackKey(fallback))) {
                continue;
            }

            GrammarFeedbackItemDto matched = findMatchingGrammarFeedback(
                    provided,
                    fallback,
                    segment.type()
            );
            if (matched != null
                    && matched.reasonKo() != null
                    && !matched.reasonKo().isBlank()
                    && isCompatibleGrammarReason(segment, matched.reasonKo())) {
                synchronizedItems.add(new GrammarFeedbackItemDto(
                        fallback.originalText(),
                        fallback.revisedText(),
                        matched.reasonKo()
                ));
                continue;
            }

            synchronizedItems.add(fallback);
        }

        return synchronizedItems;
    }

    private GrammarFeedbackItemDto sanitizeGrammarFeedbackItem(GrammarFeedbackItemDto item) {
        if (item == null) {
            return null;
        }

        String originalText = cleanSegmentPhrase(item.originalText());
        String revisedText = cleanSegmentPhrase(item.revisedText());
        if (!isValidGrammarFeedbackSpan(originalText, revisedText)) {
            return null;
        }

        String reasonKo = item.reasonKo() == null ? "" : item.reasonKo().trim();
        if (reasonKo.isBlank()) {
            reasonKo = buildGenericGrammarReason(originalText, revisedText);
        }
        if (reasonKo.isBlank()) {
            return null;
        }

        return new GrammarFeedbackItemDto(originalText, revisedText, reasonKo);
    }

    private boolean isValidGrammarFeedbackSpan(String originalText, String revisedText) {
        if (originalText.isBlank() && revisedText.isBlank()) {
            return false;
        }

        List<String> originalTokens = tokenList(normalizeForComparison(originalText));
        List<String> revisedTokens = tokenList(normalizeForComparison(revisedText));

        if (originalText.isBlank()) {
            return isPunctuationOnly(revisedText) || revisedTokens.size() <= 3;
        }

        if (revisedText.isBlank()) {
            return isPunctuationOnly(originalText) || originalTokens.size() <= 3;
        }

        return originalTokens.size() <= 6 && revisedTokens.size() <= 6;
    }

    private GrammarFeedbackItemDto buildFallbackGrammarFeedback(InlineFeedbackSegmentDto segment) {
        if (segment == null) {
            return null;
        }

        String type = segment.type() == null ? "" : segment.type().trim().toUpperCase(Locale.ROOT);
        if ("KEEP".equals(type)) {
            return null;
        }

        String originalText = cleanSegmentPhrase(segment.originalText());
        String revisedText = cleanSegmentPhrase(segment.revisedText());
        if (!isValidGrammarFeedbackSpan(originalText, revisedText)) {
            return null;
        }
        if (!isGrammarMechanicsSegment(type, originalText, revisedText, segment)) {
            return null;
        }

        String reasonKo = buildFallbackGrammarReason(segment, originalText, revisedText);
        if (reasonKo.isBlank()) {
            return null;
        }

        return new GrammarFeedbackItemDto(originalText, revisedText, reasonKo);
    }

    private GrammarFeedbackItemDto findMatchingGrammarFeedback(
            List<GrammarFeedbackItemDto> provided,
            GrammarFeedbackItemDto fallback,
            String fallbackType
    ) {
        if (provided == null || provided.isEmpty() || fallback == null) {
            return null;
        }

        String normalizedFallbackType = normalizeGrammarFeedbackEditType(
                fallbackType,
                fallback.originalText(),
                fallback.revisedText()
        );
        GrammarFeedbackItemDto bestMatch = null;
        int bestScore = 0;
        for (GrammarFeedbackItemDto item : provided) {
            int score = scoreGrammarFeedbackMatch(item, fallback, normalizedFallbackType);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = item;
            }
        }

        return bestMatch;
    }

    private int scoreGrammarFeedbackMatch(
            GrammarFeedbackItemDto item,
            GrammarFeedbackItemDto fallback,
            String fallbackEditType
    ) {
        if (item == null || fallback == null) {
            return 0;
        }

        String itemEditType = normalizeGrammarFeedbackEditType(null, item.originalText(), item.revisedText());
        if (!itemEditType.equals(fallbackEditType)) {
            return 0;
        }

        if (spansExactlyMatch(item, fallback)) {
            return 400;
        }
        if (spansMatchAfterLooseNormalization(item, fallback)) {
            return 300;
        }
        if (spansMatchByNormalizedTokens(item, fallback)) {
            return 200;
        }
        if (spansMatchByConstrainedOverlap(item, fallback)) {
            return 100;
        }

        return 0;
    }

    private String normalizeGrammarFeedbackEditType(
            String declaredType,
            String originalText,
            String revisedText
    ) {
        if (declaredType != null && !declaredType.isBlank()) {
            String normalizedType = declaredType.trim().toUpperCase(Locale.ROOT);
            if ("ADD".equals(normalizedType) || "REMOVE".equals(normalizedType) || "REPLACE".equals(normalizedType)) {
                return normalizedType;
            }
        }

        if ((originalText == null || originalText.isBlank()) && revisedText != null && !revisedText.isBlank()) {
            return "ADD";
        }
        if (originalText != null && !originalText.isBlank() && (revisedText == null || revisedText.isBlank())) {
            return "REMOVE";
        }
        return "REPLACE";
    }

    private boolean spansExactlyMatch(GrammarFeedbackItemDto item, GrammarFeedbackItemDto fallback) {
        return safeEquals(item.originalText(), fallback.originalText())
                && safeEquals(item.revisedText(), fallback.revisedText());
    }

    private boolean spansMatchAfterLooseNormalization(GrammarFeedbackItemDto item, GrammarFeedbackItemDto fallback) {
        return normalizeLooseText(item.originalText()).equals(normalizeLooseText(fallback.originalText()))
                && normalizeLooseText(item.revisedText()).equals(normalizeLooseText(fallback.revisedText()));
    }

    private boolean spansMatchByNormalizedTokens(GrammarFeedbackItemDto item, GrammarFeedbackItemDto fallback) {
        return normalizedTokenSignature(item.originalText()).equals(normalizedTokenSignature(fallback.originalText()))
                && normalizedTokenSignature(item.revisedText()).equals(normalizedTokenSignature(fallback.revisedText()));
    }

    private boolean spansMatchByConstrainedOverlap(GrammarFeedbackItemDto item, GrammarFeedbackItemDto fallback) {
        String itemOriginal = normalizeLooseText(item.originalText());
        String itemRevised = normalizeLooseText(item.revisedText());
        String fallbackOriginal = normalizeLooseText(fallback.originalText());
        String fallbackRevised = normalizeLooseText(fallback.revisedText());

        if (itemOriginal.isBlank() || itemRevised.isBlank() || fallbackOriginal.isBlank() || fallbackRevised.isBlank()) {
            return false;
        }

        return overlapInBothDirections(itemOriginal, fallbackOriginal)
                && overlapInBothDirections(itemRevised, fallbackRevised);
    }

    private boolean overlapInBothDirections(String left, String right) {
        return left.contains(right) || right.contains(left);
    }

    private String normalizedTokenSignature(String value) {
        return String.join(" ", tokenList(normalizeForComparison(value)));
    }

    private boolean safeEquals(String left, String right) {
        return (left == null ? "" : left).equals(right == null ? "" : right);
    }

    private String buildFallbackGrammarReason(
            InlineFeedbackSegmentDto segment,
            String originalText,
            String revisedText
    ) {
        CorrectionDto correction = buildSupplementalCorrectionCandidate(segment);
        if (correction != null && correction.issue() != null && !correction.issue().isBlank()) {
            return correction.issue();
        }

        String type = segment.type() == null ? "" : segment.type().trim().toUpperCase(Locale.ROOT);
        if ("ADD".equals(type) && isPunctuationOnly(revisedText)) {
            return "\ubb38\uc7a5 \ub05d\uc5d0\ub294 \ubb38\uc7a5\ubd80\ud638\uac00 \uc788\uc5b4\uc57c \ubb38\uc7a5\uc774 \ubd84\uba85\ud574\uc694.";
        }
        if ("REMOVE".equals(type)) {
            return "\uc774 \ubd80\ubd84\uc740 \ube7c\ub294 \uac83\uc774 \ubb38\ubc95\uc801\uc73c\ub85c \ub354 \uc790\uc5f0\uc2a4\ub7ec\uc6cc\uc694.";
        }

        return buildGenericGrammarReason(originalText, revisedText);
    }

    private boolean isCompatibleGrammarReason(InlineFeedbackSegmentDto segment, String reasonKo) {
        if (segment == null || reasonKo == null || reasonKo.isBlank()) {
            return false;
        }

        String original = cleanSegmentPhrase(segment.originalText());
        String revised = cleanSegmentPhrase(segment.revisedText());
        List<String> originalTokens = tokenList(normalizeForComparison(original));
        List<String> revisedTokens = tokenList(normalizeForComparison(revised));

        if (isCapitalizationOnlyChange(original, revised)) {
            return containsGrammarReasonCue(reasonKo, "\ub300\ubb38\uc790", "capital");
        }
        if (isPluralizationChange(originalTokens, revisedTokens)) {
            return containsGrammarReasonCue(reasonKo, "\ubcf5\uc218", "\ub2e8\uc218", "plural", "singular");
        }
        if (isPronounBeAgreementChange(originalTokens, revisedTokens)) {
            return containsGrammarReasonCue(reasonKo, "\ub300\uba85\uc0ac", "\uc77c\uce58", "\uc8fc\uc5b4", "agreement", "pronoun");
        }
        if (isArticleCorrection(originalTokens, revisedTokens) || isDeterminerInsertionOrRemoval(segment, revisedTokens, originalTokens)) {
            return containsGrammarReasonCue(reasonKo, "\uad00\uc0ac", "\ud55c\uc815\uc5b4", "\uba85\uc0ac \uc55e", "article", "determiner");
        }
        if (isPrepositionCorrection(originalTokens, revisedTokens) || isPrepositionInsertionOrRemoval(segment, revisedTokens, originalTokens)) {
            return containsGrammarReasonCue(reasonKo, "\uc804\uce58\uc0ac", "preposition");
        }
        if (isPunctuationOnly(revised) || isPunctuationOnly(original)) {
            return containsGrammarReasonCue(reasonKo, "\ubb38\uc7a5\ubd80\ud638", "\ub9c8\uce68\ud45c", "\uc270\ud45c", "punctuation");
        }

        return true;
    }

    private boolean isDeterminerInsertionOrRemoval(
            InlineFeedbackSegmentDto segment,
            List<String> revisedTokens,
            List<String> originalTokens
    ) {
        String type = segment.type() == null ? "" : segment.type().trim().toUpperCase(Locale.ROOT);
        return ("ADD".equals(type) && revisedTokens.size() == 1 && DETERMINER_TOKENS.contains(revisedTokens.get(0)))
                || ("REMOVE".equals(type) && originalTokens.size() == 1 && DETERMINER_TOKENS.contains(originalTokens.get(0)));
    }

    private boolean isPrepositionInsertionOrRemoval(
            InlineFeedbackSegmentDto segment,
            List<String> revisedTokens,
            List<String> originalTokens
    ) {
        String type = segment.type() == null ? "" : segment.type().trim().toUpperCase(Locale.ROOT);
        return ("ADD".equals(type) && revisedTokens.size() == 1 && PREPOSITION_TOKENS.contains(revisedTokens.get(0)))
                || ("REMOVE".equals(type) && originalTokens.size() == 1 && PREPOSITION_TOKENS.contains(originalTokens.get(0)));
    }

    private boolean containsGrammarReasonCue(String reasonKo, String... cues) {
        String lowered = reasonKo.toLowerCase(Locale.ROOT);
        for (String cue : cues) {
            if (lowered.contains(cue.toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }

    private boolean isGrammarMechanicsSegment(
            String type,
            String originalText,
            String revisedText,
            InlineFeedbackSegmentDto segment
    ) {
        if ("ADD".equals(type) && isPunctuationOnly(revisedText)) {
            return true;
        }
        if ("REMOVE".equals(type) && isPunctuationOnly(originalText)) {
            return true;
        }
        if (buildSupplementalCorrectionCandidate(segment) != null) {
            return true;
        }

        List<String> originalTokens = tokenList(normalizeForComparison(originalText));
        List<String> revisedTokens = tokenList(normalizeForComparison(revisedText));
        if ("ADD".equals(type) && revisedTokens.size() == 1) {
            String token = revisedTokens.get(0);
            return DETERMINER_TOKENS.contains(token)
                    || PREPOSITION_TOKENS.contains(token)
                    || PRONOUN_TOKENS.contains(token)
                    || BE_VERB_TOKENS.contains(token);
        }
        if ("REMOVE".equals(type) && originalTokens.size() == 1) {
            String token = originalTokens.get(0);
            return DETERMINER_TOKENS.contains(token)
                    || PREPOSITION_TOKENS.contains(token)
                    || ARTICLE_TOKENS.contains(token);
        }
        if ("REPLACE".equals(type) && originalTokens.size() == 1 && revisedTokens.size() == 1) {
            String originalToken = originalTokens.get(0);
            String revisedToken = revisedTokens.get(0);
            return ARTICLE_TOKENS.contains(originalToken)
                    || ARTICLE_TOKENS.contains(revisedToken)
                    || DETERMINER_TOKENS.contains(originalToken)
                    || DETERMINER_TOKENS.contains(revisedToken)
                    || PREPOSITION_TOKENS.contains(originalToken)
                    || PREPOSITION_TOKENS.contains(revisedToken)
                    || PRONOUN_TOKENS.contains(originalToken)
                    || PRONOUN_TOKENS.contains(revisedToken)
                    || BE_VERB_TOKENS.contains(originalToken)
                    || BE_VERB_TOKENS.contains(revisedToken);
        }

        return false;
    }

    private String buildGenericGrammarReason(String originalText, String revisedText) {
        if (originalText.isBlank() && !revisedText.isBlank()) {
            return "\uc774 \ubd80\ubd84\uc740 \ubb38\uc7a5\uc744 \ubb38\ubc95\uc801\uc73c\ub85c \uc644\uc131\ud558\uae30 \uc704\ud574 \ubcf4\uc644\ud55c \ud45c\ud604\uc774\uc5d0\uc694.";
        }
        if (!originalText.isBlank() && revisedText.isBlank()) {
            return "\uc774 \ubd80\ubd84\uc740 \ube7c\ub294 \uac83\uc774 \uc601\uc5b4 \ubb38\uc7a5\uc5d0\uc11c \ub354 \uc790\uc5f0\uc2a4\ub7ec\uc6cc\uc694.";
        }
        return "\uc774 \ubd80\ubd84\uc740 \uc601\uc5b4 \ubb38\ubc95\uacfc \uc790\uc5f0\uc2a4\ub7ec\uc6b4 \ud45c\ud604\uc5d0 \ub9de\uac8c \uace0\uccd0\uc57c \ud574\uc694.";
    }

    private boolean isGrammarCorrection(
            CorrectionDto correction,
            List<GrammarFeedbackItemDto> grammarFeedback
    ) {
        if (correction == null) {
            return false;
        }

        if (grammarFeedback != null) {
            for (GrammarFeedbackItemDto item : grammarFeedback) {
                if (item != null && overlapsGrammarFeedback(correction, item)) {
                    return true;
                }
            }
        }

        String combined = ((correction.issue() == null ? "" : correction.issue()) + " "
                + (correction.suggestion() == null ? "" : correction.suggestion()))
                .toLowerCase(Locale.ROOT);
        return combined.contains("grammar")
                || combined.contains("capital")
                || combined.contains("plural")
                || combined.contains("singular")
                || combined.contains("article")
                || combined.contains("determiner")
                || combined.contains("pronoun")
                || combined.contains("preposition")
                || combined.contains("punctuation")
                || combined.contains("verb form")
                || combined.contains("\ubb38\ubc95")
                || combined.contains("\ub300\ubb38\uc790")
                || combined.contains("\ubcf5\uc218")
                || combined.contains("\ub2e8\uc218")
                || combined.contains("\uad00\uc0ac")
                || combined.contains("\ud55c\uc815\uc5b4")
                || combined.contains("\ub300\uba85\uc0ac")
                || combined.contains("\uc804\uce58\uc0ac")
                || combined.contains("\ubb38\uc7a5\ubd80\ud638")
                || combined.contains("\ub3d9\uc0ac \ud615\ud0dc");
    }

    private boolean overlapsGrammarFeedback(CorrectionDto correction, GrammarFeedbackItemDto item) {
        String correctionText = normalizeLooseText(
                (correction.issue() == null ? "" : correction.issue()) + " "
                        + (correction.suggestion() == null ? "" : correction.suggestion())
        );
        String originalText = normalizeLooseText(item.originalText());
        String revisedText = normalizeLooseText(item.revisedText());
        return (!originalText.isBlank() && correctionText.contains(originalText))
                || (!revisedText.isBlank() && correctionText.contains(revisedText));
    }

    private String buildGrammarFeedbackKey(GrammarFeedbackItemDto item) {
        return normalizeLooseText(item.originalText()) + "|"
                + normalizeLooseText(item.revisedText());
    }

    private String normalizeLooseText(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }

        return value.toLowerCase(Locale.ROOT)
                .replaceAll("\\s+", " ")
                .trim();
    }

    private boolean containsHangul(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }

        return value.codePoints()
                .anyMatch(codePoint -> Character.UnicodeScript.of(codePoint) == Character.UnicodeScript.HANGUL);
    }

    private List<CoachExpressionUsageDto> sanitizeUsedExpressions(
            List<CoachExpressionUsageDto> usedExpressions,
            String learnerAnswer,
            List<InlineFeedbackSegmentDto> inlineFeedback
    ) {
        List<CoachExpressionUsageDto> extracted = new ArrayList<>();
        if (usedExpressions != null) {
            for (CoachExpressionUsageDto usage : usedExpressions) {
                CoachExpressionUsageDto sanitized = sanitizeUsedExpression(usage, learnerAnswer);
                if (sanitized != null) {
                    extracted.add(sanitized);
                }
            }
        }
        if (extracted.size() < 3) {
            extracted.addAll(buildUsedExpressions(learnerAnswer, inlineFeedback));
        }
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
                null,
                FEEDBACK_USED_EXPRESSION_SOURCE,
                buildUsedExpressionUsageTip(sanitizedCandidate)
        );
    }

    private CoachExpressionUsageDto sanitizeUsedExpression(
            CoachExpressionUsageDto usage,
            String learnerAnswer
    ) {
        if (usage == null) {
            return null;
        }

        String sanitizedExpression = sanitizeExtractedExpression(usage.expression());
        if (!isValidUsedExpressionCandidate(sanitizedExpression)) {
            return null;
        }

        String normalizedLearnerAnswer = normalizeForComparison(learnerAnswer);
        String normalizedExpression = normalizeForComparison(sanitizedExpression);
        if (normalizedLearnerAnswer.isBlank()
                || normalizedExpression.isBlank()
                || !normalizedLearnerAnswer.contains(normalizedExpression)) {
            return null;
        }

        String usageTip = usage.usageTip() == null || usage.usageTip().isBlank()
                ? buildUsedExpressionUsageTip(sanitizedExpression)
                : usage.usageTip().trim();

        return new CoachExpressionUsageDto(
                sanitizedExpression,
                true,
                FEEDBACK_USED_EXPRESSION_MATCH_TYPE,
                sanitizeMatchedUsedExpressionText(usage.matchedText(), sanitizedExpression, learnerAnswer),
                FEEDBACK_USED_EXPRESSION_SOURCE,
                usageTip
        );
    }

    private String sanitizeMatchedUsedExpressionText(
            String matchedText,
            String expression,
            String learnerAnswer
    ) {
        if (matchedText == null || matchedText.isBlank()) {
            return null;
        }

        String sanitizedMatchedText = matchedText.trim().replaceAll("\\s+", " ");
        String normalizedMatchedText = normalizeForComparison(sanitizedMatchedText);
        String normalizedExpression = normalizeForComparison(expression);
        String normalizedLearnerAnswer = normalizeForComparison(learnerAnswer);

        if (normalizedMatchedText.isBlank()
                || normalizedMatchedText.equals(normalizedExpression)
                || normalizedLearnerAnswer.isBlank()
                || !normalizedLearnerAnswer.contains(normalizedMatchedText)) {
            return null;
        }

        return sanitizedMatchedText;
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
            if (segment == null) {
                continue;
            }

            CorrectionDto correction = buildSupplementalCorrectionCandidate(segment);
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
                    "'" + original + "'\uBCF4\uB2E4 '" + revised + "'\uCC98\uB7FC \uB9DE\uCD94\uBA74 \uBB38\uC7A5 \uC5F0\uACB0\uC774 \uB354 \uC790\uC5F0\uC2A4\uB7EC\uC6CC\uC9D1\uB2C8\uB2E4.",
                    "\uB300\uBA85\uC0AC\uC640 be\uB3D9\uC0AC\uB97C \uD568\uAED8 \uB9DE\uCDB0\uC11C \uC368 \uBCF4\uC138\uC694."
            );
        }

        if (isArticleCorrection(originalTokens, revisedTokens)) {
            return new CorrectionDto(
                    "\uAD00\uC0AC\uB97C \uBCF4\uC644\uD558\uBA74 \uD45C\uD604\uC774 \uB354 \uC790\uC5F0\uC2A4\uB7FD\uACE0 \uC815\uD655\uD574\uC9D1\uB2C8\uB2E4.",
                    "'" + revised + "'\uCC98\uB7FC \uC54C\uB9DE\uC740 \uAD00\uC0AC\uB97C \uD568\uAED8 \uC368 \uBCF4\uC138\uC694."
            );
        }

        if (isPrepositionCorrection(originalTokens, revisedTokens)) {
            return new CorrectionDto(
                    "\uC804\uCE58\uC0AC\uB97C \uC54C\uB9DE\uAC8C \uBC14\uAFB8\uBA74 \uBB38\uC7A5 \uAD00\uACC4\uAC00 \uB354 \uBD84\uBA85\uD574\uC9D1\uB2C8\uB2E4.",
                    "'" + revised + "'\uCC98\uB7FC \uC790\uC5F0\uC2A4\uB7EC\uC6B4 \uC804\uCE58\uC0AC\uB97C \uC368 \uBCF4\uC138\uC694."
            );
        }

        return null;
    }

    private CorrectionDto buildSupplementalCorrectionCandidate(InlineFeedbackSegmentDto segment) {
        String type = segment.type() == null ? "" : segment.type().trim().toUpperCase(Locale.ROOT);
        return switch (type) {
            case "REPLACE" -> buildSupplementalReplacementCorrection(segment);
            case "ADD" -> buildSupplementalAdditionCorrection(segment);
            default -> null;
        };
    }

    private CorrectionDto buildSupplementalReplacementCorrection(InlineFeedbackSegmentDto segment) {
        String original = cleanSegmentPhrase(segment.originalText());
        String revised = cleanSegmentPhrase(segment.revisedText());
        if (original.isBlank() || revised.isBlank()) {
            return null;
        }

        if (isCapitalizationOnlyChange(original, revised)) {
            return new CorrectionDto(
                    "'"
                            + original
                            + "'\uC740 \uB300\uBB38\uC790 \uD45C\uAE30\uB97C \uB9DE\uCD94\uBA74 \uD6E8\uC52C \uC790\uC5F0\uC2A4\uB7FD\uC2B5\uB2C8\uB2E4.",
                    "'"
                            + revised
                            + "'\uCC98\uB7FC \uB300\uBB38\uC790\uB97C \uC54C\uB9DE\uAC8C \uC368 \uC8FC\uC138\uC694."
            );
        }

        CorrectionDto specificCorrection = buildSupplementalCorrection(segment);
        if (specificCorrection != null) {
            return specificCorrection;
        }

        List<String> originalTokens = tokenList(normalizeForComparison(original));
        List<String> revisedTokens = tokenList(normalizeForComparison(revised));
        if (isPluralizationChange(originalTokens, revisedTokens)) {
            return new CorrectionDto(
                    "'"
                            + original
                            + "'\uBCF4\uB2E4 '"
                            + revised
                            + "'\uCC98\uB7FC \uC218\uB97C \uB9DE\uCD94\uBA74 \uB354 \uC790\uC5F0\uC2A4\uB7FD\uC2B5\uB2C8\uB2E4.",
                    "\uD55C \uBA85\uC774 \uC544\uB2CC \uC5EC\uB7EC \uB300\uC0C1\uC744 \uB9D0\uD560 \uB54C\uB294 '"
                            + revised
                            + "'\uCC98\uB7FC \uBCF5\uC218\uD615\uC744 \uC368 \uBCF4\uC138\uC694."
            );
        }

        if (originalTokens.size() > 3 || revisedTokens.size() > 3) {
            return null;
        }

        return new CorrectionDto(
                "'"
                        + original
                        + "'\uBCF4\uB2E4 '"
                        + revised
                        + "'\uAC00 \uBB38\uB9E5\uC5D0 \uB354 \uC790\uC5F0\uC2A4\uB7FD\uC2B5\uB2C8\uB2E4.",
                "\uBE44\uC2B7\uD55C \uB73B\uC744 \uB9D0\uD560 \uB54C\uB294 '"
                        + revised
                        + "'\uCC98\uB7FC \uC790\uC5F0\uC2A4\uB7EC\uC6B4 \uD615\uD0DC\uB85C \uB2E4\uB4EC\uC5B4 \uBCF4\uC138\uC694."
        );
    }

    private CorrectionDto buildSupplementalAdditionCorrection(InlineFeedbackSegmentDto segment) {
        String addedText = cleanSegmentPhrase(segment.revisedText());
        if (addedText.isBlank() || isPunctuationOnly(addedText)) {
            return null;
        }

        List<String> addedTokens = tokenList(normalizeForComparison(addedText));
        if (addedTokens.size() == 1 && DETERMINER_TOKENS.contains(addedTokens.get(0))) {
            return new CorrectionDto(
                    "\uBA85\uC0AC \uC55E\uC5D0 \uD544\uC694\uD55C \uD55C\uC815\uC5B4\uB97C \uB123\uC73C\uBA74 \uB73B\uC774 \uB354 \uBD84\uBA85\uD574\uC9D1\uB2C8\uB2E4.",
                    "'"
                            + addedText
                            + "' \uAC19\uC740 \uD45C\uD604\uC744 \uD568\uAED8 \uC368\uC11C \uB204\uAD6C\uB098 \uBB34\uC5C7\uC778\uC9C0 \uB354 \uC120\uBA85\uD558\uAC8C \uB9D0\uD574 \uBCF4\uC138\uC694."
            );
        }
        if (addedTokens.size() == 1 && PREPOSITION_TOKENS.contains(addedTokens.get(0))) {
            return new CorrectionDto(
                    "\uC804\uCE58\uC0AC\uB97C \uBCF4\uC644\uD558\uBA74 \uBB38\uC7A5 \uAD00\uACC4\uAC00 \uB354 \uBD84\uBA85\uD574\uC9D1\uB2C8\uB2E4.",
                    "'"
                            + addedText
                            + "'\uCC98\uB7FC \uC790\uC5F0\uC2A4\uB7EC\uC6B4 \uC804\uCE58\uC0AC\uB97C \uD568\uAED8 \uB123\uC5B4 \uBCF4\uC138\uC694."
            );
        }

        if (addedTokens.size() > 3) {
            return null;
        }

        return new CorrectionDto(
                "\uD544\uC694\uD55C \uD45C\uD604\uC744 \uD55C \uB369\uC5B4\uB9AC \uB354 \uCD94\uAC00\uD558\uBA74 \uBB38\uC7A5 \uD750\uB984\uC774 \uC790\uC5F0\uC2A4\uB7EC\uC6CC\uC9D1\uB2C8\uB2E4.",
                "'"
                        + addedText
                        + "'\uCC98\uB7FC \uD544\uC694\uD55C \uB9D0\uC744 \uB36E\uBD99\uC5EC \uB73B\uC744 \uB354 \uBD84\uBA85\uD558\uAC8C \uD574 \uBCF4\uC138\uC694."
        );
    }

    private boolean isCapitalizationOnlyChange(String original, String revised) {
        return original != null
                && revised != null
                && !original.equals(revised)
                && original.equalsIgnoreCase(revised);
    }

    private boolean isPluralizationChange(List<String> originalTokens, List<String> revisedTokens) {
        if (originalTokens.size() != 1 || revisedTokens.size() != 1) {
            return false;
        }

        String originalToken = originalTokens.get(0);
        String revisedToken = revisedTokens.get(0);
        return !originalToken.equals(revisedToken)
                && singularizeToken(originalToken).equals(singularizeToken(revisedToken));
    }

    private String singularizeToken(String token) {
        if (token == null || token.isBlank()) {
            return "";
        }

        String normalized = token.trim().toLowerCase(Locale.ROOT);
        if (normalized.endsWith("ies") && normalized.length() > 3) {
            return normalized.substring(0, normalized.length() - 3) + "y";
        }
        if (normalized.endsWith("es") && normalized.length() > 2) {
            return normalized.substring(0, normalized.length() - 2);
        }
        if (normalized.endsWith("s") && normalized.length() > 1 && !normalized.endsWith("ss")) {
            return normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    private boolean isPunctuationOnly(String value) {
        return value != null && value.replaceAll("[\\p{Punct}\\s]+", "").isBlank();
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
                    String example = buildRefinementExample(modelAnswer, candidate);
                    if (!candidate.isBlank()
                            && isNovelRefinementSuggestion(
                            rawCandidate,
                            candidate,
                            example,
                            normalizedLearnerAnswer,
                            normalizedCorrectedAnswer
                    )) {
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
                    String example = buildRefinementExample(modelAnswer, candidate);
                    if (!candidate.isBlank()
                            && isNovelRefinementSuggestion(
                            rawCandidate,
                            candidate,
                            example,
                            normalizedLearnerAnswer,
                            normalizedCorrectedAnswer
                    )) {
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
                    buildReadableRecommendationGuidance(candidate),
                    buildRefinementExample(modelAnswer, candidate)
            ));
            if (expressions.size() >= 3) {
                break;
            }
        }

        return expressions;
    }

    private List<RefinementExpressionDto> sanitizeRefinementExpressions(
            String promptId,
            List<RefinementExpressionDto> expressions,
            String learnerAnswer,
            String correctedAnswer,
            String modelAnswer,
            List<PromptHintDto> hints
    ) {
        String normalizedLearnerAnswer = normalizeForComparison(learnerAnswer);
        String normalizedCorrectedAnswer = normalizeForComparison(correctedAnswer);
        List<RefinementExpressionDto> sanitized = new ArrayList<>();
        LinkedHashSet<String> seenExpressions = new LinkedHashSet<>();
        RefinementSanitizationDiagnostics diagnostics = new RefinementSanitizationDiagnostics();

        if (expressions != null) {
            diagnostics.rawInputCount = expressions.size();
            for (RefinementExpressionDto expression : expressions) {
                if (expression == null) {
                    continue;
                }

                String rawCandidate = cleanExpressionCandidate(expression.expression());
                diagnostics.rawExpressions.add(rawCandidate);
                if (!shouldRecommendExpressionCandidate(rawCandidate, normalizedLearnerAnswer, normalizedCorrectedAnswer)) {
                    diagnostics.rejectedByRecommendation++;
                    continue;
                }

                String candidate = toReusableRefinementExpression(rawCandidate);
                if (candidate.isBlank()) {
                    diagnostics.rejectedBlank++;
                    continue;
                }

                String normalizedCandidate = normalizeForComparison(candidate);
                if (!seenExpressions.add(normalizedCandidate)) {
                    diagnostics.rejectedDuplicate++;
                    continue;
                }

                String guidance = expression.guidance() == null || expression.guidance().isBlank()
                        ? buildReadableRecommendationGuidance(candidate)
                        : expression.guidance().trim();
                String example = expression.example() == null || expression.example().isBlank()
                        ? buildRefinementExample(modelAnswer, candidate)
                        : expression.example().trim();
                if (normalizeForComparison(example).equals(normalizeForComparison(candidate))) {
                    example = buildRefinementExample(modelAnswer, candidate);
                }
                if (!isNovelRefinementSuggestion(
                        rawCandidate,
                        candidate,
                        example,
                        normalizedLearnerAnswer,
                        normalizedCorrectedAnswer
                )) {
                    diagnostics.rejectedByNovelty++;
                    continue;
                }

                sanitized.add(new RefinementExpressionDto(
                        candidate,
                        guidance,
                        example,
                        resolveRefinementMeaning(candidate, expression.meaningKo(), hints)
                ));
                diagnostics.rawAcceptedCount++;
                diagnostics.recordFinal("openai_raw", candidate);
                if (sanitized.size() >= 3) {
                    logRefinementDiagnostics(promptId, learnerAnswer, diagnostics);
                    return sanitized;
                }
            }
        }

        if (sanitized.size() >= 3) {
            logRefinementDiagnostics(promptId, learnerAnswer, diagnostics);
            return sanitized;
        }

        for (String candidate : extractAdditionalRefinementCandidates(
                modelAnswer,
                correctedAnswer,
                normalizedLearnerAnswer,
                normalizedCorrectedAnswer,
                seenExpressions
        )) {
            sanitized.add(new RefinementExpressionDto(
                    candidate,
                    buildReadableRecommendationGuidance(candidate),
                    buildRefinementExample(modelAnswer, candidate),
                    resolveRefinementMeaning(candidate, null, hints)
            ));
            diagnostics.modelSupplementCount++;
            diagnostics.recordFinal("model_supplement", candidate);
            if (sanitized.size() >= 3) {
                break;
            }
        }

        if (sanitized.isEmpty()) {
            for (RefinementExpressionDto fallback : buildHintBasedRefinementExpressions(
                    hints,
                    modelAnswer,
                    normalizedLearnerAnswer,
                    normalizedCorrectedAnswer,
                    seenExpressions
            )) {
                sanitized.add(fallback);
                diagnostics.hintFallbackCount++;
                diagnostics.recordFinal("hint_fallback", fallback.expression());
                if (sanitized.size() >= 3) {
                    break;
                }
            }
        }

        logRefinementDiagnostics(promptId, learnerAnswer, diagnostics);
        return sanitized;
    }

    private void logRefinementDiagnostics(
            String promptId,
            String learnerAnswer,
            RefinementSanitizationDiagnostics diagnostics
    ) {
        if (diagnostics == null) {
            return;
        }

        boolean shouldLogAtInfo = diagnostics.hintFallbackCount > 0
                || diagnostics.rawAcceptedCount == 0
                || diagnostics.rejectedByRecommendation > 0
                || diagnostics.rejectedByNovelty > 0;

        if (!shouldLogAtInfo && !log.isDebugEnabled()) {
            return;
        }

        String message = "Refinement diagnostics promptId={} rawInput={} rawAccepted={} modelSupplement={} hintFallback={} "
                + "rejected[recommendation={}, blank={}, duplicate={}, novelty={}] finalSources={} rawExpressions={} finalExpressions={} learnerPreview={}";

        Object[] arguments = new Object[]{
                promptId,
                diagnostics.rawInputCount,
                diagnostics.rawAcceptedCount,
                diagnostics.modelSupplementCount,
                diagnostics.hintFallbackCount,
                diagnostics.rejectedByRecommendation,
                diagnostics.rejectedBlank,
                diagnostics.rejectedDuplicate,
                diagnostics.rejectedByNovelty,
                joinForLog(diagnostics.finalSources),
                joinForLog(diagnostics.rawExpressions),
                joinForLog(diagnostics.finalExpressions),
                abbreviateForLog(learnerAnswer, 160)
        };

        if (shouldLogAtInfo) {
            log.info(message, arguments);
            return;
        }

        log.debug(message, arguments);
    }

    private String joinForLog(List<String> values) {
        if (values == null || values.isEmpty()) {
            return "[]";
        }

        return values.stream()
                .map(value -> value == null ? "" : value.replaceAll("\\s+", " ").trim())
                .filter(value -> !value.isBlank())
                .reduce((left, right) -> left + " || " + right)
                .orElse("[]");
    }

    private String abbreviateForLog(String value, int maxLength) {
        if (value == null) {
            return "";
        }

        String normalized = value.replaceAll("\\s+", " ").trim();
        if (normalized.length() <= maxLength) {
            return normalized;
        }

        return normalized.substring(0, Math.max(0, maxLength - 3)) + "...";
    }

    private static final class RefinementSanitizationDiagnostics {
        private int rawInputCount;
        private int rawAcceptedCount;
        private int modelSupplementCount;
        private int hintFallbackCount;
        private int rejectedByRecommendation;
        private int rejectedBlank;
        private int rejectedDuplicate;
        private int rejectedByNovelty;
        private final List<String> rawExpressions = new ArrayList<>();
        private final List<String> finalExpressions = new ArrayList<>();
        private final List<String> finalSources = new ArrayList<>();

        private void recordFinal(String source, String expression) {
            finalSources.add(source);
            finalExpressions.add(expression);
        }
    }

    private List<String> extractAdditionalRefinementCandidates(
            String modelAnswer,
            String correctedAnswer,
            String normalizedLearnerAnswer,
            String normalizedCorrectedAnswer,
            LinkedHashSet<String> seenExpressions
    ) {
        List<String> sourceTexts = new ArrayList<>();
        if (modelAnswer != null && !modelAnswer.isBlank()) {
            sourceTexts.add(modelAnswer);
        }
        if (correctedAnswer != null
                && !correctedAnswer.isBlank()
                && !normalizeForComparison(correctedAnswer).equals(normalizeForComparison(modelAnswer))) {
            sourceTexts.add(correctedAnswer);
        }

        if (sourceTexts.isEmpty()) {
            return List.of();
        }

        LinkedHashSet<String> candidates = new LinkedHashSet<>();
        for (String sourceText : sourceTexts) {
            for (Pattern pattern : MODEL_EXPRESSION_PATTERNS) {
                Matcher matcher = pattern.matcher(sourceText);
                while (matcher.find()) {
                    String rawCandidate = cleanExpressionCandidate(matcher.group());
                    String candidate = toReusableRefinementExpression(rawCandidate);
                    String normalizedCandidate = normalizeForComparison(candidate);
                    if (seenExpressions.contains(normalizedCandidate)) {
                        continue;
                    }
                    String example = buildSupplementRefinementExample(modelAnswer, sourceText, candidate);
                    if (!candidate.isBlank()
                            && shouldRecommendExpressionCandidate(rawCandidate, normalizedLearnerAnswer, normalizedCorrectedAnswer)
                            && isNovelRefinementSuggestion(
                            rawCandidate,
                            candidate,
                            example,
                            normalizedLearnerAnswer,
                            normalizedCorrectedAnswer
                    )) {
                        candidates.add(candidate);
                    }
                }
            }
        }

        if (candidates.size() >= 3) {
            return new ArrayList<>(candidates);
        }

        for (String sourceText : sourceTexts) {
            for (String clause : sourceText.split("[.!?]")) {
                String rawCandidate = cleanExpressionCandidate(clause);
                String candidate = toReusableRefinementExpression(rawCandidate);
                String normalizedCandidate = normalizeForComparison(candidate);
                if (candidate.isBlank() || seenExpressions.contains(normalizedCandidate)) {
                    continue;
                }

                String example = buildSupplementRefinementExample(modelAnswer, sourceText, candidate);
                if (shouldRecommendExpressionCandidate(rawCandidate, normalizedLearnerAnswer, normalizedCorrectedAnswer)
                        && isNovelRefinementSuggestion(
                        rawCandidate,
                        candidate,
                        example,
                        normalizedLearnerAnswer,
                        normalizedCorrectedAnswer
                )) {
                    candidates.add(candidate);
                }

                if (candidates.size() >= 3) {
                    return new ArrayList<>(candidates);
                }
            }
        }

        return new ArrayList<>(candidates);
    }

    private String buildSupplementRefinementExample(
            String preferredSource,
            String fallbackSource,
            String candidate
    ) {
        String example = buildRefinementExample(preferredSource, candidate);
        if (!example.isBlank() && !normalizeForComparison(example).equals(normalizeForComparison(candidate))) {
            return example;
        }

        if (fallbackSource == null || fallbackSource.isBlank()) {
            return example;
        }

        return buildRefinementExample(fallbackSource, candidate);
    }

    private List<RefinementExpressionDto> buildHintBasedRefinementExpressions(
            List<PromptHintDto> hints,
            String modelAnswer,
            String normalizedLearnerAnswer,
            String normalizedCorrectedAnswer,
            LinkedHashSet<String> seenExpressions
    ) {
        if (hints == null || hints.isEmpty()) {
            return List.of();
        }

        List<RefinementExpressionDto> fallbacks = new ArrayList<>();
        for (PromptHintDto hint : hints) {
            if (hint == null) {
                continue;
            }

            for (String rawCandidate : getHintRefinementCandidates(hint)) {
                String candidate = cleanExpressionCandidate(rawCandidate);
                if (candidate.isBlank()) {
                    continue;
                }

                String normalizedCandidate = normalizeForComparison(candidate);
                if (normalizedCandidate.isBlank() || seenExpressions.contains(normalizedCandidate)) {
                    continue;
                }

                if (!isUsefulHintRefinementCandidate(candidate, normalizedLearnerAnswer, normalizedCorrectedAnswer)) {
                    continue;
                }

                seenExpressions.add(normalizedCandidate);
                fallbacks.add(new RefinementExpressionDto(
                        candidate,
                        buildReadableHintRefinementGuidance(hint.hintType()),
                        buildHintRefinementExample(candidate, modelAnswer),
                        resolveRefinementMeaning(candidate, null, List.of(hint))
                ));
                if (fallbacks.size() >= 3) {
                    return fallbacks;
                }
            }
        }

        return fallbacks;
    }

    private List<String> getHintRefinementCandidates(PromptHintDto hint) {
        if (hint.items() == null || hint.items().isEmpty()) {
            return List.of();
        }

        return hint.items().stream()
                .map(item -> item == null ? "" : item.content())
                .filter(candidate -> candidate != null && !candidate.isBlank())
                .toList();
    }

    private boolean isUsefulHintRefinementCandidate(
            String candidate,
            String normalizedLearnerAnswer,
            String normalizedCorrectedAnswer
    ) {
        return !isDirectlyAlreadyExpressedInAnswer(candidate, normalizedLearnerAnswer, normalizedCorrectedAnswer)
                && !hasComparableStructureOverlap(candidate, normalizedLearnerAnswer, normalizedCorrectedAnswer);
    }

    private String buildReadableHintRefinementGuidance(String hintType) {
        String normalizedHintType = hintType == null ? "" : hintType.trim().toUpperCase(Locale.ROOT);
        return switch (normalizedHintType) {
            case "" -> "\ub2e4\uc74c \ub2f5\ubcc0\uc5d0\uc11c \uc790\uc5f0\uc2a4\ub7fd\uac8c \ub123\uc5b4 \ubcf4\uba74 \uc88b\uc740 \ud45c\ud604\uc774\uc5d0\uc694.";
            case "STARTER" -> "\ub2f5\ubcc0\uc744 \uc790\uc5f0\uc2a4\ub7fd\uac8c \uc2dc\uc791\ud560 \ub54c \uc4f8 \uc218 \uc788\uc5b4\uc694.";
            case "VOCAB_WORD" -> "\uc8fc\uc81c\uc5d0 \ub9de\ub294 \ud575\uc2ec \ub2e8\uc5b4\ub97c \ub123\uc5b4 \ubb38\uc7a5\uc744 \ub354 \ub610\ub837\ud558\uac8c \ub9cc\ub4e4 \uc218 \uc788\uc5b4\uc694.";
            case "VOCAB_PHRASE" -> "\uc774 \ud45c\ud604\uc744 \ubb38\uc7a5\uc5d0 \ub123\uc73c\uba74 \ub354 \uc790\uc5f0\uc2a4\ub7fd\uac8c \ub9d0\ud560 \uc218 \uc788\uc5b4\uc694.";
            case "STRUCTURE" -> "\uc774 \ud2c0\uc744 \uc4f0\uba74 \uc774\uc720\ub098 \ubc29\ubc95\uc744 \ub354 \uad6c\uccb4\uc801\uc73c\ub85c \uc124\uba85\ud560 \uc218 \uc788\uc5b4\uc694.";
            case "LINKER" -> "\ubb38\uc7a5\uacfc \ubb38\uc7a5\uc744 \uc790\uc5f0\uc2a4\ub7fd\uac8c \uc774\uc5b4 \uc904 \ub54c \uc4f8 \uc218 \uc788\uc5b4\uc694.";
            case "DETAIL" -> "\uad6c\uccb4\uc801\uc778 \uc815\ubcf4\ub098 \uc608\uc2dc\ub97c \ub367\ubd99\uc77c \ub54c \uc4f8 \uc218 \uc788\uc5b4\uc694.";
            case "BALANCE" -> "\uc7a5\uc810\uacfc \ud55c\uacc4\ub97c \ud568\uaed8 \ub9d0\ud558\uba70 \uade0\ud615 \uc788\uac8c \ub2f5\ud560 \ub54c \uc4f8 \uc218 \uc788\uc5b4\uc694.";
            default -> "\ub2e4\uc74c \ub2f5\ubcc0\uc5d0\uc11c \uc790\uc5f0\uc2a4\ub7fd\uac8c \ub123\uc5b4 \ubcf4\uba74 \uc88b\uc740 \ud45c\ud604\uc774\uc5d0\uc694.";
        };
    }

    private String buildHintRefinementGuidance(String hintType) {
        return buildReadableHintRefinementGuidance(hintType);
    }

    private String normalizedHintRefinementGuidance(String hintType) {
        return buildReadableHintRefinementGuidance(hintType);
    }

    private String cleanHintRefinementGuidance(String hintType) {
        return buildReadableHintRefinementGuidance(hintType);
    }

    private String buildHintRefinementExample(String candidate, String modelAnswer) {
        String example = buildRefinementExample(modelAnswer, candidate);
        if (example == null || example.isBlank()) {
            return candidate;
        }
        return example;
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

        if (lower.startsWith("one challenge i often face with ")) {
            return "One challenge I often face with [noun] is [issue].";
        }

        if (lower.startsWith("what i like most about ") && lower.contains(" is that ")) {
            return "What I like most about [thing] is that [detail].";
        }

        if (lower.startsWith("it helps me ") && lower.contains(" and ")) {
            return "It helps me [verb] and [verb].";
        }

        if (lower.startsWith("it helps me ")) {
            return "It helps me [verb].";
        }

        if (lower.startsWith("this makes it easier to ")) {
            return "This makes it easier to [verb].";
        }

        if (lower.startsWith("when i want to ") && lower.contains(", i ")) {
            return "When I want to [verb], I [action].";
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

    private String buildReadableRecommendationGuidance(String expression) {
        String lower = expression.toLowerCase(Locale.ROOT);
        if (expression.contains("[") && expression.contains("]")) {
            if (lower.startsWith("because ")) {
                return "\uc774\uc720\ub97c \uc870\uae08 \ub354 \uad6c\uccb4\uc801\uc73c\ub85c \uc124\uba85\ud558\uace0 \uc2f6\uc744 \ub54c \uc4f0\uae30 \uc88b\uc544\uc694.";
            }
            if (lower.startsWith("one challenge i often face with ")) {
                return "\uacaa\uace0 \uc788\ub294 \ubb38\uc81c\ub97c \uc790\uc5f0\uc2a4\ub7fd\uac8c \uc18c\uac1c\ud560 \ub54c \uc4f8 \uc218 \uc788\uc5b4\uc694.";
            }
            if (lower.startsWith("what i like most about ")) {
                return "\uc88b\uc544\ud558\ub294 \uc810\uc744 \ubd84\uba85\ud558\uac8c \uac15\uc870\ud560 \ub54c \uc4f8 \uc218 \uc788\uc5b4\uc694.";
            }
            if (lower.startsWith("it helps me ")) {
                return "\ud589\ub3d9\uc758 \ud6a8\uacfc\ub97c \uc124\uba85\ud560 \ub54c \uc4f0\uae30 \uc88b\uc544\uc694.";
            }
            if (lower.startsWith("this makes it easier to ")) {
                return "\uc5b4\ub5a4 \ubcc0\ud654\ub098 \uacb0\uacfc\ub97c \uc790\uc5f0\uc2a4\ub7fd\uac8c \uc774\uc5b4 \ub9d0\ud560 \ub54c \uc4f8 \uc218 \uc788\uc5b4\uc694.";
            }
            if (lower.startsWith("when i want to ")) {
                return "\uc0c1\ud669\uc5d0 \ub530\ub77c \uc5b4\ub5bb\uac8c \ud589\ub3d9\ud558\ub294\uc9c0 \uc124\uba85\ud560 \ub54c \uc4f8 \uc218 \uc788\uc5b4\uc694.";
            }
            if (lower.startsWith("by ")) {
                return "\ubc29\ubc95\uc774\ub098 \uc2e4\ucc9c \uacfc\uc815\uc744 \uad6c\uccb4\uc801\uc73c\ub85c \ub9d0\ud560 \ub54c \uc4f8 \uc218 \uc788\uc5b4\uc694.";
            }
            if (lower.startsWith("so that ")) {
                return "\ubaa9\uc801\uc774\ub098 \uae30\ub300\ud558\ub294 \uacb0\uacfc\ub97c \uc774\uc5b4\uc11c \ub9d0\ud560 \ub54c \uc4f8 \uc218 \uc788\uc5b4\uc694.";
            }
            return "\ub2e4\uc74c \ub2f5\ubcc0\uc5d0\uc11c \uc790\uc5f0\uc2a4\ub7fd\uac8c \ud655\uc7a5\ud574 \ubcfc \ub9cc\ud55c \ud45c\ud604\uc774\uc5d0\uc694.";
        }
        if (lower.startsWith("because ")) {
            return "\uc774\uc720\ub97c \ubd84\uba85\ud558\uac8c \ub367\ubd99\uc77c \ub54c \uc4f8 \uc218 \uc788\uc5b4\uc694.";
        }
        if (lower.startsWith("by ")) {
            return "\uc5b4\ub5a4 \ubc29\ubc95\uc73c\ub85c \uc2e4\ucc9c\ud558\ub294\uc9c0 \ub9d0\ud560 \ub54c \uc4f8 \uc218 \uc788\uc5b4\uc694.";
        }
        if (lower.startsWith("i would like to ") || lower.startsWith("i want to ")) {
            return "\ud558\uace0 \uc2f6\uc740 \ubaa9\ud45c\ub098 \ubc14\ub78c\uc744 \uc790\uc5f0\uc2a4\ub7fd\uac8c \ub9d0\ud560 \ub54c \uc4f8 \uc218 \uc788\uc5b4\uc694.";
        }
        if (lower.startsWith("i plan to ")) {
            return "\uad6c\uccb4\uc801\uc778 \uacc4\ud68d\uc774\ub098 \uc2e4\ucc9c \ubc29\ubc95\uc744 \uc18c\uac1c\ud560 \ub54c \uc4f8 \uc218 \uc788\uc5b4\uc694.";
        }
        if (lower.startsWith("i usually ")) {
            return "\ud3c9\uc18c \uc2b5\uad00\uc774\ub098 \uc77c\uc0c1\uc744 \uc124\uba85\ud560 \ub54c \uc790\uc5f0\uc2a4\ub7fd\uac8c \uc4f8 \uc218 \uc788\uc5b4\uc694.";
        }
        if (lower.startsWith("so that ")) {
            return "\ubaa9\uc801\uc774\ub098 \uae30\ub300\ud558\ub294 \uacb0\uacfc\ub97c \ub354 \ubd84\uba85\ud558\uac8c \ubcf4\uc5ec \uc904 \uc218 \uc788\uc5b4\uc694.";
        }
        return "\ub2e4\uc74c \ub2f5\ubcc0\uc5d0\uc11c \uc790\uc5f0\uc2a4\ub7fd\uac8c \ub123\uc5b4 \ubcf4\uba74 \uc88b\uc740 \ud45c\ud604\uc774\uc5d0\uc694.";
    }

    private String buildRecommendationGuidance(String expression) {
        return buildReadableRecommendationGuidance(expression);
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

    private boolean isNovelRefinementSuggestion(
            String rawCandidate,
            String reusableCandidate,
            String example,
            String normalizedLearnerAnswer,
            String normalizedCorrectedAnswer
    ) {
        return !isAlreadyExpressedInAnswer(rawCandidate, normalizedLearnerAnswer, normalizedCorrectedAnswer)
                && !isAlreadyExpressedInAnswer(reusableCandidate, normalizedLearnerAnswer, normalizedCorrectedAnswer)
                && !isAlreadyExpressedInAnswer(example, normalizedLearnerAnswer, normalizedCorrectedAnswer);
    }

    private boolean isAlreadyExpressedInAnswer(
            String expression,
            String normalizedLearnerAnswer,
            String normalizedCorrectedAnswer
    ) {
        return isDirectlyAlreadyExpressedInAnswer(expression, normalizedLearnerAnswer, normalizedCorrectedAnswer)
                || hasComparableStructureOverlap(expression, normalizedLearnerAnswer, normalizedCorrectedAnswer)
                || hasStrongAnswerTokenOverlap(expression, normalizedLearnerAnswer, normalizedCorrectedAnswer);
    }

    private boolean isDirectlyAlreadyExpressedInAnswer(
            String expression,
            String normalizedLearnerAnswer,
            String normalizedCorrectedAnswer
    ) {
        String cleanedExpression = cleanExpressionCandidate(expression);
        if (cleanedExpression.isBlank()) {
            return false;
        }

        String normalizedExpression = normalizeForComparison(cleanedExpression);
        if (!normalizedExpression.isBlank()
                && (normalizedLearnerAnswer.contains(normalizedExpression)
                || normalizedCorrectedAnswer.contains(normalizedExpression))) {
            return true;
        }

        if (!cleanedExpression.contains("[") || !cleanedExpression.contains("]")) {
            return false;
        }

        return frameAppearsInAnswer(cleanedExpression, normalizedLearnerAnswer)
                || frameAppearsInAnswer(cleanedExpression, normalizedCorrectedAnswer);
    }

    private boolean frameAppearsInAnswer(String expressionFrame, String normalizedAnswer) {
        if (normalizedAnswer == null || normalizedAnswer.isBlank()) {
            return false;
        }

        String normalizedFrame = normalizeFrameForMatching(expressionFrame);
        if (normalizedFrame.isBlank() || !normalizedFrame.contains("[")) {
            return false;
        }

        String[] tokens = normalizedFrame.split("\\s+");
        StringBuilder patternBuilder = new StringBuilder("(^|\\s)");
        boolean hasLiteralToken = false;
        for (int index = 0; index < tokens.length; index++) {
            if (index > 0) {
                patternBuilder.append("\\s+");
            }

            String token = tokens[index];
            if (token.startsWith("[") && token.endsWith("]")) {
                patternBuilder.append("[a-z0-9']+(?:\\s+[a-z0-9']+){0,4}");
            } else {
                hasLiteralToken = true;
                patternBuilder.append(Pattern.quote(token));
            }
        }
        patternBuilder.append("(\\s|$)");

        if (!hasLiteralToken) {
            return false;
        }

        return Pattern.compile(patternBuilder.toString(), Pattern.CASE_INSENSITIVE)
                .matcher(normalizedAnswer)
                .find();
    }

    private boolean hasStrongAnswerTokenOverlap(
            String expression,
            String normalizedLearnerAnswer,
            String normalizedCorrectedAnswer
    ) {
        if (expression != null && expression.contains("[") && expression.contains("]")) {
            return false;
        }

        LinkedHashSet<String> expressionTokens = extractRefinementOverlapTokens(expression);
        if (expressionTokens.isEmpty()) {
            return false;
        }

        return hasStrongTokenOverlap(expressionTokens, extractRefinementOverlapTokens(normalizedLearnerAnswer))
                || hasStrongTokenOverlap(expressionTokens, extractRefinementOverlapTokens(normalizedCorrectedAnswer));
    }

    private boolean hasComparableStructureOverlap(
            String expression,
            String normalizedLearnerAnswer,
            String normalizedCorrectedAnswer
    ) {
        RefinementStructureProfile expressionProfile = detectRefinementStructureProfile(expression);
        if (expressionProfile.isNone()) {
            return false;
        }

        return hasComparableStructureOverlap(expressionProfile, normalizedLearnerAnswer)
                || hasComparableStructureOverlap(expressionProfile, normalizedCorrectedAnswer);
    }

    private boolean hasComparableStructureOverlap(
            RefinementStructureProfile expressionProfile,
            String normalizedAnswer
    ) {
        if (normalizedAnswer == null || normalizedAnswer.isBlank()) {
            return false;
        }

        int answerComplexity = detectStructureComplexity(normalizedAnswer, expressionProfile.family());
        return answerComplexity >= expressionProfile.complexity();
    }

    private boolean hasStrongTokenOverlap(Set<String> expressionTokens, Set<String> answerTokens) {
        if (expressionTokens.isEmpty() || answerTokens.isEmpty()) {
            return false;
        }

        LinkedHashSet<String> intersection = new LinkedHashSet<>(expressionTokens);
        intersection.retainAll(answerTokens);
        return intersection.size() >= requiredRefinementOverlapCount(expressionTokens.size());
    }

    private int requiredRefinementOverlapCount(int tokenCount) {
        if (tokenCount <= 1) {
            return 1;
        }
        if (tokenCount == 2) {
            return 2;
        }
        if (tokenCount == 3) {
            return 3;
        }
        if (tokenCount == 4) {
            return 3;
        }
        return Math.max(4, (int) Math.ceil(tokenCount * 0.75));
    }

    private LinkedHashSet<String> extractRefinementOverlapTokens(String value) {
        LinkedHashSet<String> tokens = new LinkedHashSet<>();
        String normalized = normalizeFrameForMatching(value);
        if (normalized.isBlank()) {
            return tokens;
        }

        for (String token : normalized.split("\\s+")) {
            if (token.isBlank() || (token.startsWith("[") && token.endsWith("]"))) {
                continue;
            }

            String normalizedToken = normalizeOverlapToken(token);
            if (normalizedToken.length() >= 3 && !REFINEMENT_OVERLAP_STOP_TOKENS.contains(normalizedToken)) {
                tokens.add(normalizedToken);
            }
        }

        return tokens;
    }

    private String normalizeOverlapToken(String token) {
        String normalized = token == null ? "" : token.trim().toLowerCase(Locale.ROOT);
        if (normalized.isBlank()) {
            return "";
        }

        if (normalized.endsWith("'s") && normalized.length() > 3) {
            normalized = normalized.substring(0, normalized.length() - 2);
        }

        if (normalized.endsWith("ies") && normalized.length() > 4) {
            normalized = normalized.substring(0, normalized.length() - 3) + "y";
        } else if (normalized.endsWith("ing") && normalized.length() > 5) {
            normalized = normalized.substring(0, normalized.length() - 3);
        } else if (normalized.endsWith("ed") && normalized.length() > 4) {
            normalized = normalized.substring(0, normalized.length() - 2);
        } else if (normalized.endsWith("es") && normalized.length() > 4) {
            normalized = normalized.substring(0, normalized.length() - 2);
        } else if (normalized.endsWith("s") && normalized.length() > 3 && !normalized.endsWith("ss")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }

        if (normalized.endsWith("nn")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }

        return normalized;
    }

    private RefinementStructureProfile detectRefinementStructureProfile(String value) {
        String normalized = normalizeFrameForMatching(value);
        if (normalized.isBlank()) {
            return RefinementStructureProfile.none();
        }

        if ((normalized.startsWith("my favorite ") || normalized.startsWith("i like ")
                || normalized.startsWith("i love ") || normalized.startsWith("i enjoy "))
                && normalized.contains(" because ")) {
            return RefinementStructureProfile.none();
        }

        int becauseComplexity = detectStructureComplexity(normalized, "because");
        if (becauseComplexity > 0) {
            return new RefinementStructureProfile("because", becauseComplexity);
        }

        int soThatComplexity = detectStructureComplexity(normalized, "so_that");
        if (soThatComplexity > 0) {
            return new RefinementStructureProfile("so_that", soThatComplexity);
        }

        int whenComplexity = detectStructureComplexity(normalized, "when");
        if (whenComplexity > 0) {
            return new RefinementStructureProfile("when", whenComplexity);
        }

        int byComplexity = detectStructureComplexity(normalized, "by");
        if (byComplexity > 0) {
            return new RefinementStructureProfile("by", byComplexity);
        }

        return RefinementStructureProfile.none();
    }

    private int detectStructureComplexity(String value, String family) {
        String normalized = normalizeFrameForMatching(value);
        if (normalized.isBlank()) {
            return 0;
        }

        return switch (family) {
            case "because" -> {
                if (normalized.contains("because it's the ")
                        || normalized.contains("because it s the ")
                        || normalized.contains("because it is the ")) {
                    if (normalized.contains(" when ")) {
                        yield 3;
                    }
                    yield 2;
                }
                if (normalized.startsWith("this is because ") || normalized.startsWith("one reason is that ")) {
                    yield 2;
                }
                if (normalized.startsWith("because ") || normalized.contains(" because ")) {
                    yield 1;
                }
                yield 0;
            }
            case "so_that" -> {
                if (normalized.contains(" so that i can ") || normalized.startsWith("so that i can ")) {
                    yield 2;
                }
                if (normalized.contains(" so that ") || normalized.startsWith("so that ")) {
                    yield 1;
                }
                yield 0;
            }
            case "when" -> (normalized.contains(" when ") || normalized.startsWith("when ")) ? 1 : 0;
            case "by" -> {
                if ((normalized.contains(" by ") || normalized.startsWith("by ")) && normalized.contains("ing ")) {
                    yield normalized.startsWith("i plan to ") ? 2 : 1;
                }
                yield 0;
            }
            default -> 0;
        };
    }

    private record RefinementStructureProfile(String family, int complexity) {
        private static RefinementStructureProfile none() {
            return new RefinementStructureProfile("", 0);
        }

        private boolean isNone() {
            return family == null || family.isBlank() || complexity <= 0;
        }
    }

    private String normalizeFrameForMatching(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }

        return value.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9\\s'\\[\\]]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private String buildRefinementGuidance(String expression) {
        return buildReadableRecommendationGuidance(expression);
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
        if (normalizedFrame.startsWith("one challenge i often face with noun is issue")) {
            return normalizedSentence.startsWith("one challenge i often face with ")
                    && normalizedSentence.contains(" is ");
        }
        if (normalizedFrame.startsWith("what i like most about thing is that detail")) {
            return normalizedSentence.startsWith("what i like most about ")
                    && normalizedSentence.contains(" is that ");
        }
        if (normalizedFrame.startsWith("it helps me verb and verb")) {
            return normalizedSentence.startsWith("it helps me ")
                    && normalizedSentence.contains(" and ");
        }
        if (normalizedFrame.startsWith("it helps me verb")) {
            return normalizedSentence.startsWith("it helps me ");
        }
        if (normalizedFrame.startsWith("this makes it easier to verb")) {
            return normalizedSentence.startsWith("this makes it easier to ");
        }
        if (normalizedFrame.startsWith("when i want to verb i action")) {
            return normalizedSentence.startsWith("when i want to ")
                    && normalizedSentence.contains(" i ");
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
        example = example.replace("[noun]", "time management");
        example = example.replace("[issue]", "staying consistent");
        example = example.replace("[detail]", "it feels calm and refreshing");
        example = example.replace("[action]", "take a short walk");
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
        return cleanUsedExpressionUsageTip(expression);
    }

    private String normalizedUsedExpressionUsageTip(String expression) {
        return cleanUsedExpressionUsageTip(expression);
    }

    private String cleanUsedExpressionUsageTip(String expression) {
        String lower = expression == null ? "" : expression.toLowerCase(Locale.ROOT);
        if (lower.startsWith("because ")) {
            return "\uc774\uc720\ub97c \uc790\uc5f0\uc2a4\ub7fd\uac8c \ub367\ubd99\uc77c \ub54c \uc4f0\uae30 \uc88b\uc740 \ud45c\ud604\uc774\uc5d0\uc694.";
        }
        if (lower.startsWith("by ")) {
            return "\ubc29\ubc95\uc774\ub098 \uc2e4\ucc9c \uacfc\uc815\uc744 \uad6c\uccb4\uc801\uc73c\ub85c \ub9d0\ud560 \ub54c \uc4f8 \uc218 \uc788\uc5b4\uc694.";
        }
        if (lower.startsWith("so that ")) {
            return "\ubaa9\uc801\uc774\ub098 \uae30\ub300\ud558\ub294 \uacb0\uacfc\ub97c \uc774\uc5b4\uc11c \ub9d0\ud560 \ub54c \uc4f8 \uc218 \uc788\uc5b4\uc694.";
        }
        if (lower.startsWith("i want to ")
                || lower.startsWith("i would like to ")
                || lower.startsWith("i plan to ")
                || lower.startsWith("i hope to ")) {
            return "\ubaa9\ud45c\ub098 \uacc4\ud68d\uc744 \ubd84\uba85\ud558\uac8c \ub9d0\ud560 \ub54c \uc790\uc5f0\uc2a4\ub7fd\uac8c \uc4f8 \uc218 \uc788\uc5b4\uc694.";
        }
        if (lower.startsWith("i usually ") || lower.startsWith("i often ")) {
            return "\ud3c9\uc18c \uc2b5\uad00\uc774\ub098 \ubc18\ubcf5\ub418\ub294 \ud589\ub3d9\uc744 \uc124\uba85\ud560 \ub54c \uc790\uc8fc \uc4f0\ub294 \ud45c\ud604\uc774\uc5d0\uc694.";
        }
        return FEEDBACK_USED_EXPRESSION_USAGE_TIP;
    }

    private String resolveRefinementMeaning(
            String candidate,
            String explicitMeaningKo,
            List<PromptHintDto> hints
    ) {
        if (explicitMeaningKo != null && !explicitMeaningKo.isBlank()) {
            return explicitMeaningKo.trim();
        }
        if (candidate == null || candidate.isBlank() || hints == null || hints.isEmpty()) {
            return null;
        }

        String normalizedCandidate = normalizeForComparison(candidate);
        if (normalizedCandidate.isBlank()) {
            return null;
        }

        for (PromptHintDto hint : hints) {
            if (hint == null || hint.items() == null) {
                continue;
            }
            for (PromptHintItemDto item : hint.items()) {
                if (item == null || item.content() == null || item.content().isBlank()) {
                    continue;
                }

                String normalizedItem = normalizeForComparison(item.content());
                String normalizedReusableItem = normalizeForComparison(toReusableRefinementExpression(item.content()));
                boolean matches = normalizedCandidate.equals(normalizedItem)
                        || normalizedCandidate.equals(normalizedReusableItem)
                        || normalizedItem.contains(normalizedCandidate)
                        || normalizedReusableItem.contains(normalizedCandidate)
                        || normalizedCandidate.contains(normalizedItem);
                if (!matches) {
                    continue;
                }

                if (item.meaningKo() != null && !item.meaningKo().isBlank()) {
                    return item.meaningKo().trim();
                }
            }
        }

        return null;
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

    private boolean shouldCompleteLoop(
            int score,
            List<CorrectionDto> corrections,
            List<GrammarFeedbackItemDto> grammarFeedback
    ) {
        int issueCount = (corrections == null ? 0 : corrections.size())
                + (grammarFeedback == null ? 0 : grammarFeedback.size());
        return score >= 85 || (score >= 80 && issueCount <= 2);
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
            return "\uc9c0\uae08 \ub2f5\ubcc0\uc744 \ubc14\ud0d5\uc73c\ub85c \ubb38\uc7a5\uc744 1~2\uac1c\ub9cc \ub354 \ub367\ubd99\uc5ec \uc774\uc720\ub098 \uc608\uc2dc\ub97c \ucd94\uac00\ud574 \ubcf4\uc138\uc694.";
        }
        return "\"" + prompt.topic() + "\"\uc5d0 \ub300\ud574 3~4\ubb38\uc7a5\uc73c\ub85c \ub2e4\uc2dc \ub2f5\ud574 \ubcf4\uc138\uc694. \uccab \ubb38\uc7a5\uc5d0\uc11c \ud575\uc2ec \uc0dd\uac01\uc744 \ub9d0\ud558\uace0, \ub4a4 \ubb38\uc7a5\uc5d0\uc11c \uc774\uc720\ub098 \uc608\uc2dc\ub97c \ub367\ubd99\uc774\uba74 \ub354 \uc88b\uc544\uc694.";
    }
}




