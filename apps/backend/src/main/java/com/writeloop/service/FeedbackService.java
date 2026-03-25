package com.writeloop.service;

import com.writeloop.dto.CorrectionDto;
import com.writeloop.dto.FeedbackRequestDto;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.InlineFeedbackSegmentDto;
import com.writeloop.dto.PromptDto;
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
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FeedbackService {

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
                feedback.modelAnswer(),
                feedback.rewriteChallenge()
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
                modelAnswer,
                rewriteChallenge
        );
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

        if (correctedAnswer.startsWith(answer) && correctedAnswer.length() > answer.length()) {
            return List.of(
                    new InlineFeedbackSegmentDto("KEEP", answer, answer),
                    new InlineFeedbackSegmentDto("ADD", "", correctedAnswer.substring(answer.length()))
            );
        }

        if (correctedAnswer.endsWith(answer) && correctedAnswer.length() > answer.length()) {
            return List.of(
                    new InlineFeedbackSegmentDto("ADD", "", correctedAnswer.substring(0, correctedAnswer.length() - answer.length())),
                    new InlineFeedbackSegmentDto("KEEP", answer, answer)
            );
        }

        return List.of(new InlineFeedbackSegmentDto("REPLACE", answer, correctedAnswer));
    }

    private String buildRewriteChallenge(PromptDto prompt, boolean alreadyStrong) {
        if (alreadyStrong) {
            return "답변에 구체적인 예시 1개와 감정을 드러내는 표현 1개를 넣어 더 생생하게 다시 써 보세요.";
        }
        return "\"" + prompt.topic() + "\" 주제에 맞춰 3~4문장으로 다시 써 보세요. 먼저 직접 답하고, 이유를 설명한 뒤, 관련된 구체적 예시를 하나 덧붙이면 좋아요.";
    }
}
