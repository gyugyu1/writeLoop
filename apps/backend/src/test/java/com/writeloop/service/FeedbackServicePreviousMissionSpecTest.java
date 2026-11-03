package com.writeloop.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.writeloop.dto.FeedbackCoachMoveDto;
import com.writeloop.dto.FeedbackCompletionDto;
import com.writeloop.dto.FeedbackLanguageCorrectionDto;
import com.writeloop.dto.FeedbackRequestDto;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.PreviousMissionResultDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;
import com.writeloop.dto.PromptTaskMetaDto;
import com.writeloop.persistence.AnswerAttemptEntity;
import com.writeloop.persistence.AnswerAttemptRepository;
import com.writeloop.persistence.AnswerSessionEntity;
import com.writeloop.persistence.AnswerSessionRepository;
import com.writeloop.persistence.AttemptType;
import com.writeloop.persistence.FeedbackDiagnosisLogEntity;
import com.writeloop.persistence.FeedbackDiagnosisLogRepository;
import com.writeloop.persistence.SessionStatus;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// qa 3단계: 02-qa-scenarios.md(백엔드)의 시나리오를 옮긴 테스트. 이름은 05-main-decision.md의 필드 이름을 따른다
// (verdict -> status, reflectedCount -> appliedCount). 기대값은 시나리오와 결정 파일에서만 가져왔다.
class FeedbackServicePreviousMissionSpecTest {

    private static final String PROMPT_ID = "prompt-spec-1";
    private static final String SESSION_ID = "session-spec-prev-mission";
    private static final String GUEST_ID = "guest-1234567890abcdef12";
    private static final List<PromptHintDto> HINTS = List.of(
            new PromptHintDto("hint-1", PROMPT_ID, "VOCAB", "take a walk", 1)
    );

    private final ObjectMapper objectMapper = new ObjectMapper();

    // ---------- 공통 준비 데이터 ----------

    private static FeedbackLanguageCorrectionDto fix(String before, String after) {
        return new FeedbackLanguageCorrectionDto("GRAMMAR_LOCAL", null, before, after, null);
    }

    private static FeedbackCoachMoveDto move(
            String focus,
            String focusType,
            String targetSlot,
            List<FeedbackLanguageCorrectionDto> corrections
    ) {
        return new FeedbackCoachMoveDto(
                focus, focusType, "why", null, null, "instruction", null, null,
                List.of(), null, targetSlot, corrections
        );
    }

    private static final FeedbackCoachMoveDto F_SLOT = move("이유 붙여보기", "SLOT", "REASON", List.of());
    private static final FeedbackCoachMoveDto F_LANG2 = move("문장 2곳 바로잡기", "LANGUAGE_FIX", null, List.of(
            fix("I go", "I went"),
            fix("a apple", "an apple")
    ));
    private static final FeedbackCoachMoveDto F_LANG3 = move("문장 3곳 바로잡기", "LANGUAGE_FIX", null, List.of(
            fix("I go", "I went"),
            fix("a apple", "an apple"),
            fix("it taste", "it tasted")
    ));
    private static final FeedbackCoachMoveDto F_TASK = move("질문에 맞게 다시 쓰기", "TASK_RESET", "CHOICE", List.of());

    private static final String PREVIOUS_ANSWER = "Yesterday I go to the market and bought a apple.";
    private static final String C1_ANSWER = "Yesterday I went to the market and bought an apple.";

    private PromptDto prompt() {
        return new PromptDto(
                PROMPT_ID,
                "Daily life",
                "Daily life",
                "Routine",
                "A",
                "What did you do yesterday?",
                "어제 무엇을 했나요?",
                "",
                null,
                new PromptTaskMetaDto(
                        "ROUTINE",
                        List.of("ACTION"),
                        List.of("REASON"),
                        "PAST_SIMPLE",
                        "FIRST_PERSON",
                        0
                )
        );
    }

    // 앞 시도의 저장된 피드백(feedbackPayloadJson)에 들어갈 응답.
    private FeedbackResponseDto storedFeedback(
            int attemptNo,
            boolean loopComplete,
            FeedbackCoachMoveDto coachMove,
            FeedbackCompletionDto completion
    ) {
        return new FeedbackResponseDto(
                PROMPT_ID, SESSION_ID, attemptNo, loopComplete,
                loopComplete ? "Complete" : null,
                "summary",
                List.of("strength"),
                List.of(), List.of(), List.of(),
                PREVIOUS_ANSWER,
                List.of(),
                "model answer", "모범 답안",
                null, null, null,
                coachMove, null, completion, null
        );
    }

    private AnswerAttemptEntity attempt(int attemptNo, String answer, String payloadJson, String submissionId) {
        return new AnswerAttemptEntity(
                SESSION_ID, attemptNo, AttemptType.INITIAL, answer, "summary", payloadJson, submissionId, null
        );
    }

    private AnswerAttemptEntity attemptWithMove(int attemptNo, FeedbackCoachMoveDto coachMove) throws Exception {
        return attempt(
                attemptNo,
                PREVIOUS_ANSWER,
                objectMapper.writeValueAsString(storedFeedback(attemptNo, false, coachMove, null)),
                "submission-prev-" + attemptNo
        );
    }

    // mock LLM이 돌려주는 새 피드백.
    private static FeedbackResponseDto newFeedback(boolean complete, FeedbackCoachMoveDto coachMove, String revisedAnswer) {
        return new FeedbackResponseDto(
                PROMPT_ID,
                "__CANONICAL_INTERNAL__",
                1,
                complete,
                complete ? "Complete" : null,
                complete ? "The answer meets the contract." : "Add one relevant detail.",
                List.of("The main action is clear."),
                List.of(), List.of(), List.of(),
                revisedAnswer,
                List.of(),
                "I went to the market yesterday because I needed food.",
                "어제 음식이 필요해서 시장에 갔어요.",
                complete ? null : "Add one detail.",
                null, null,
                complete ? null : coachMove,
                null, null, null
        );
    }

    private static FeedbackResponseDto newMissionFeedback() {
        return newFeedback(false, move("장소 구체적으로 쓰기", "SLOT", "DETAIL", List.of()), "I went to the market.");
    }

    private static FeedbackAnalysisSnapshot snapshot(TopicRelevance topic, Map<String, SlotAssessmentStatus> slots, boolean complete) {
        return snapshot(topic, slots, complete, List.of());
    }

    // 31 결정 1: 고치지 않은 줄이 남는 케이스(미반영·일부를 기대)는 이번 진단에도 문법 교정이 남아 있어야 실제 상황과 맞다.
    private static final List<LanguageRevisionStep> CORRECTIONS_LEFT = List.of(
            new LanguageRevisionStep(LanguageIssueKind.GRAMMAR_LOCAL, C1_ANSWER, "남은 교정 이유")
    );

    private static FeedbackAnalysisSnapshot snapshot(
            TopicRelevance topic,
            Map<String, SlotAssessmentStatus> slots,
            boolean complete,
            List<LanguageRevisionStep> revisionSteps
    ) {
        Map<String, SlotAssessmentValue> assessments = new LinkedHashMap<>();
        slots.forEach((slot, status) -> assessments.put(slot, new SlotAssessmentValue("evidence " + slot, status)));
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                new TopicAssessment(topic, "reason"),
                new StructureAssessment(StructureStatus.COMPLETE),
                new LanguageAssessment(revisionSteps)
        );
        MissionDecision decision = new MissionDecision(
                complete ? MissionKind.COMPLETE : MissionKind.SLOT,
                List.of(),
                List.of(),
                complete ? null : "DETAIL",
                assessments,
                null,
                null
        );
        GeneratedSections sections = new GeneratedSections(
                List.of("The main action is clear."),
                List.of(),
                "I went to the market yesterday because I needed food.",
                "어제 음식이 필요해서 시장에 갔어요.",
                decision,
                null
        );
        return new FeedbackAnalysisSnapshot("openai", "test-model", 200, "{}", diagnosis, sections);
    }

    private static Map<String, SlotAssessmentStatus> slots(Object... pairs) {
        Map<String, SlotAssessmentStatus> map = new LinkedHashMap<>();
        for (int index = 0; index < pairs.length; index += 2) {
            map.put((String) pairs[index], (SlotAssessmentStatus) pairs[index + 1]);
        }
        return map;
    }

    private static FeedbackAnalysisSnapshot onTopic(Map<String, SlotAssessmentStatus> slots) {
        return snapshot(TopicRelevance.ON_TOPIC, slots, false);
    }

    private static FeedbackAnalysisSnapshot onTopicWithCorrectionsLeft(Map<String, SlotAssessmentStatus> slots) {
        return snapshot(TopicRelevance.ON_TOPIC, slots, false, CORRECTIONS_LEFT);
    }

    // ---------- 실행 틀 ----------

    private final class Harness {
        final PromptService promptService = mock(PromptService.class);
        final LlmFeedbackClient llm = mock(LlmFeedbackClient.class);
        final AnswerSessionRepository sessions = mock(AnswerSessionRepository.class);
        final AnswerAttemptRepository attempts = mock(AnswerAttemptRepository.class);
        final FeedbackDiagnosisLogRepository logs = mock(FeedbackDiagnosisLogRepository.class);
        final FeedbackService service;
        final List<AnswerAttemptEntity> saved = new ArrayList<>();
        final List<FeedbackDiagnosisLogEntity> savedLogs = new ArrayList<>();
        final Map<Integer, AnswerAttemptEntity> previous = new HashMap<>();
        final PromptDto prompt = prompt();
        final AnswerSessionEntity session;

        Harness(boolean guest, int existingAttempts, FeedbackResponseDto llmFeedback, FeedbackAnalysisSnapshot snapshot) {
            session = new AnswerSessionEntity(
                    SESSION_ID, PROMPT_ID, guest ? GUEST_ID : null, guest ? null : 7L, SessionStatus.IN_PROGRESS
            );
            service = new FeedbackService(
                    promptService, llm, sessions, attempts, objectMapper,
                    new TransactionTemplate(new NoopTransactionManager())
            );
            ReflectionTestUtils.setField(service, "feedbackDiagnosisLogRepository", logs);

            when(promptService.findById(PROMPT_ID)).thenReturn(prompt);
            when(promptService.findHintsByPromptId(PROMPT_ID)).thenReturn(HINTS);
            when(llm.isConfigured()).thenReturn(true);
            when(llm.review(any(PromptDto.class), anyString(), anyList(), anyInt())).thenReturn(llmFeedback);
            when(llm.isAuthoritativeFeedback(any())).thenReturn(true);
            when(llm.takeLastAnalysisSnapshot()).thenReturn(snapshot);
            when(llm.takeLastExecutionTrace()).thenReturn(FeedbackExecutionTrace.successful(snapshot));
            when(llm.clearInternalMetadata(any())).thenAnswer(invocation -> invocation.getArgument(0));

            when(sessions.findById(SESSION_ID)).thenReturn(Optional.of(session));
            when(sessions.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
            when(sessions.countByGuestId(anyString())).thenReturn(0L);

            when(attempts.countBySessionId(anyString())).thenAnswer(invocation ->
                    SESSION_ID.equals(invocation.getArgument(0)) ? existingAttempts + countSaved() : 0);
            when(attempts.findBySessionIdAndAttemptNo(anyString(), anyInt())).thenAnswer(invocation ->
                    Optional.ofNullable(previous.get((Integer) invocation.getArgument(1))));
            when(attempts.findBySessionIdAndSubmissionId(anyString(), anyString())).thenAnswer(invocation -> {
                String submissionId = invocation.getArgument(1);
                return saved.stream()
                        .filter(attempt -> submissionId.equals(attempt.getSubmissionId()))
                        .findFirst();
            });
            when(attempts.findUserSubmissions(any(), anyString(), anyString())).thenReturn(List.of());
            when(attempts.findGuestSubmissions(anyString(), anyString(), anyString())).thenReturn(List.of());
            when(attempts.save(any())).thenAnswer(invocation -> {
                AnswerAttemptEntity entity = invocation.getArgument(0);
                saved.add(entity);
                return entity;
            });
            when(logs.save(any())).thenAnswer(invocation -> {
                FeedbackDiagnosisLogEntity entity = invocation.getArgument(0);
                savedLogs.add(entity);
                return entity;
            });
        }

        private int countSaved() {
            return saved.size();
        }

        Harness withPrevious(AnswerAttemptEntity attempt) {
            previous.put(attempt.getAttemptNo(), attempt);
            return this;
        }

        FeedbackResponseDto submit(String answer) {
            return submit(answer, null);
        }

        FeedbackResponseDto submit(String answer, String submissionId) {
            return service.review(
                    new FeedbackRequestDto(PROMPT_ID, answer, SESSION_ID, "REWRITE",
                            session.getGuestId(), submissionId),
                    session.getUserId()
            );
        }
    }

    private static final class NoopTransactionManager implements PlatformTransactionManager {
        @Override
        public TransactionStatus getTransaction(TransactionDefinition definition) {
            return new SimpleTransactionStatus();
        }

        @Override
        public void commit(TransactionStatus status) {
        }

        @Override
        public void rollback(TransactionStatus status) {
        }
    }

    // 시도 2를 제출한다. 앞 시도 1은 coachMove를 가진 피드백으로 저장되어 있다.
    private FeedbackResponseDto secondAttempt(
            FeedbackCoachMoveDto previousMove,
            String answer,
            FeedbackResponseDto llmFeedback,
            FeedbackAnalysisSnapshot snapshot
    ) throws Exception {
        return new Harness(false, 1, llmFeedback, snapshot)
                .withPrevious(attemptWithMove(1, previousMove))
                .submit(answer);
    }

    private PreviousMissionResultDto secondAttemptResult(
            FeedbackCoachMoveDto previousMove,
            String answer,
            FeedbackAnalysisSnapshot snapshot
    ) throws Exception {
        return secondAttempt(previousMove, answer, newMissionFeedback(), snapshot).previousMissionResult();
    }

    private PreviousMissionResultDto languageFix(FeedbackCoachMoveDto previousMove, String answer) throws Exception {
        return secondAttemptResult(previousMove, answer, onTopic(slots("REASON", SlotAssessmentStatus.MISSING)));
    }

    // 31 결정 1: 이번 진단에 문법 교정이 남아 있는 다시 쓴 답.
    private PreviousMissionResultDto languageFixWithCorrectionsLeft(FeedbackCoachMoveDto previousMove, String answer)
            throws Exception {
        return secondAttemptResult(previousMove, answer,
                onTopicWithCorrectionsLeft(slots("REASON", SlotAssessmentStatus.MISSING)));
    }

    // 붙지 않는 경우와 같은 기준: 시도 2인데 앞 시도 행이 없다(앞 피드백을 읽을 수 없음).
    private FeedbackResponseDto referenceSecondAttempt(
            String answer,
            FeedbackResponseDto llmFeedback,
            FeedbackAnalysisSnapshot snapshot
    ) {
        return new Harness(false, 1, llmFeedback, snapshot).submit(answer);
    }

    private ObjectNode json(FeedbackResponseDto response) {
        return (ObjectNode) objectMapper.valueToTree(response);
    }

    private ObjectNode withoutPreviousMission(FeedbackResponseDto response) {
        ObjectNode node = json(response);
        node.remove("previousMissionResult");
        return node;
    }

    private static void assertResult(
            PreviousMissionResultDto actual,
            String focusType,
            String title,
            String targetSlot,
            String status,
            Integer appliedCount,
            Integer totalCount,
            String message
    ) {
        assertThat(actual).isNotNull();
        assertThat(actual.focusType()).isEqualTo(focusType);
        assertThat(actual.title()).isEqualTo(title);
        assertThat(actual.targetSlot()).isEqualTo(targetSlot);
        assertThat(actual.status()).isEqualTo(status);
        assertThat(actual.appliedCount()).isEqualTo(appliedCount);
        assertThat(actual.totalCount()).isEqualTo(totalCount);
        assertThat(actual.message()).isEqualTo(message);
    }

    private static void assertSlotB1(PreviousMissionResultDto actual) {
        assertResult(actual, "SLOT", "이유 붙여보기", "REASON", "RESOLVED", null, null, "해결했어요");
    }

    private void assertNotAttachedAndOtherwiseSame(FeedbackResponseDto response, FeedbackResponseDto reference) {
        assertThat(response.previousMissionResult()).isNull();
        // 결정: 필드가 없으면 JSON에서 키를 뺀다.
        assertThat(json(response).has("previousMissionResult")).isFalse();
        // A10: 이 필드 말고 응답의 모든 필드가 같다.
        assertThat(json(response)).isEqualTo(json(reference));
    }

    // ---------- A. 붙는 조건과 붙지 않는 조건 ----------

    @Test
    void a1_firstAnswerHasNoPreviousMissionResult() {
        Harness harness = new Harness(false, 0, newMissionFeedback(), onTopic(slots("REASON", SlotAssessmentStatus.SATISFIED)));
        FeedbackResponseDto response = harness.service.review(
                new FeedbackRequestDto(PROMPT_ID, C1_ANSWER, null, "INITIAL", null), 7L
        );

        assertThat(response.attemptNo()).isEqualTo(1);
        assertThat(response.previousMissionResult()).isNull();
        assertThat(json(response).has("previousMissionResult")).isFalse();
    }

    @Test
    void a2_secondAttemptAfterSlotMissionGetsResult() throws Exception {
        FeedbackResponseDto response = secondAttempt(
                F_SLOT, C1_ANSWER, newMissionFeedback(), onTopic(slots("REASON", SlotAssessmentStatus.SATISFIED))
        );

        assertThat(response.attemptNo()).isEqualTo(2);
        assertSlotB1(response.previousMissionResult());
    }

    @Test
    void a3_previousAttemptCompletedWithEnrichmentOnlyIsNotAMission() throws Exception {
        FeedbackAnalysisSnapshot snapshot = onTopic(slots("REASON", SlotAssessmentStatus.SATISFIED));
        FeedbackCompletionDto completion = new FeedbackCompletionDto(
                "headline", "improved", "encouragement", "next",
                move("이유 더 붙여보기", "ENRICHMENT", "REASON", List.of())
        );
        AnswerAttemptEntity previous = attempt(
                1, PREVIOUS_ANSWER,
                objectMapper.writeValueAsString(storedFeedback(1, true, null, completion)),
                "submission-prev-1"
        );

        FeedbackResponseDto response = new Harness(false, 1, newMissionFeedback(), snapshot)
                .withPrevious(previous).submit(C1_ANSWER);

        assertNotAttachedAndOtherwiseSame(response, referenceSecondAttempt(C1_ANSWER, newMissionFeedback(), snapshot));
    }

    @Test
    void a4_previousMissionOfOtherKindIsNotEvaluated() throws Exception {
        FeedbackAnalysisSnapshot snapshot = onTopic(slots("REASON", SlotAssessmentStatus.SATISFIED));
        FeedbackResponseDto response = secondAttempt(
                move("작은 실수 고치기", "MICRO_FIX", "REASON", List.of(fix("I go", "I went"))),
                C1_ANSWER, newMissionFeedback(), snapshot
        );

        assertNotAttachedAndOtherwiseSame(response, referenceSecondAttempt(C1_ANSWER, newMissionFeedback(), snapshot));
    }

    @Test
    void a5_missingPreviousAttemptRowStillReturnsAndSavesFeedback() {
        FeedbackAnalysisSnapshot snapshot = onTopic(slots("REASON", SlotAssessmentStatus.SATISFIED));
        Harness harness = new Harness(false, 1, newMissionFeedback(), snapshot);

        FeedbackResponseDto response = harness.submit(C1_ANSWER);

        assertThat(response.attemptNo()).isEqualTo(2);
        assertThat(response.previousMissionResult()).isNull();
        assertThat(json(response).has("previousMissionResult")).isFalse();
        assertThat(harness.saved).hasSize(1);
        assertThat(harness.saved.get(0).getAttemptNo()).isEqualTo(2);
    }

    @Test
    void a6_nullPreviousPayloadIsTreatedAsUnreadable() {
        FeedbackAnalysisSnapshot snapshot = onTopic(slots("REASON", SlotAssessmentStatus.SATISFIED));
        Harness harness = new Harness(false, 1, newMissionFeedback(), snapshot)
                .withPrevious(attempt(1, PREVIOUS_ANSWER, null, "submission-prev-1"));

        FeedbackResponseDto response = harness.submit(C1_ANSWER);

        assertThat(harness.saved).hasSize(1);
        assertThat(harness.saved.get(0).getAttemptNo()).isEqualTo(2);
        assertNotAttachedAndOtherwiseSame(response, referenceSecondAttempt(C1_ANSWER, newMissionFeedback(), snapshot));
    }

    @Test
    void a7_brokenPreviousPayloadDoesNotFailTheRequest() {
        FeedbackAnalysisSnapshot snapshot = onTopic(slots("REASON", SlotAssessmentStatus.SATISFIED));
        Harness harness = new Harness(false, 1, newMissionFeedback(), snapshot)
                .withPrevious(attempt(1, PREVIOUS_ANSWER, "{broken", "submission-prev-1"));

        FeedbackResponseDto response = harness.submit(C1_ANSWER);

        assertThat(harness.saved).hasSize(1);
        assertThat(harness.saved.get(0).getAttemptNo()).isEqualTo(2);
        assertNotAttachedAndOtherwiseSame(response, referenceSecondAttempt(C1_ANSWER, newMissionFeedback(), snapshot));
    }

    @Test
    void a8_previousFeedbackWithoutMissionIsNotEvaluated() throws Exception {
        FeedbackAnalysisSnapshot snapshot = onTopic(slots("REASON", SlotAssessmentStatus.SATISFIED));
        AnswerAttemptEntity previous = attempt(
                1, PREVIOUS_ANSWER,
                objectMapper.writeValueAsString(storedFeedback(1, false, null, null)),
                "submission-prev-1"
        );

        FeedbackResponseDto response = new Harness(false, 1, newMissionFeedback(), snapshot)
                .withPrevious(previous).submit(C1_ANSWER);

        assertNotAttachedAndOtherwiseSame(response, referenceSecondAttempt(C1_ANSWER, newMissionFeedback(), snapshot));
    }

    @Test
    void a9_onlyTheImmediatelyPreviousAttemptCounts() throws Exception {
        FeedbackAnalysisSnapshot snapshot = onTopic(slots("REASON", SlotAssessmentStatus.MISSING));
        FeedbackResponseDto response = new Harness(false, 2, newMissionFeedback(), snapshot)
                .withPrevious(attemptWithMove(1, F_SLOT))
                .withPrevious(attemptWithMove(2, F_LANG2))
                .submit(C1_ANSWER);

        assertThat(response.attemptNo()).isEqualTo(3);
        assertResult(response.previousMissionResult(),
                "LANGUAGE_FIX", "문장 2곳 바로잡기", null, "RESOLVED", 2, 2, "2곳 모두 반영했어요");
    }

    @Test
    void a11_guestSessionGetsTheSameResult() throws Exception {
        FeedbackResponseDto response = new Harness(true, 1, newMissionFeedback(),
                onTopic(slots("REASON", SlotAssessmentStatus.SATISFIED)))
                .withPrevious(attemptWithMove(1, F_SLOT))
                .submit(C1_ANSWER);

        assertThat(response.attemptNo()).isEqualTo(2);
        assertSlotB1(response.previousMissionResult());
    }

    // ---------- B. SLOT 판정 ----------

    @Test
    void b1_slotSatisfiedIsResolved() throws Exception {
        assertSlotB1(secondAttemptResult(F_SLOT, C1_ANSWER, onTopic(slots("REASON", SlotAssessmentStatus.SATISFIED))));
    }

    @Test
    void b2_slotGenericIsPartial() throws Exception {
        assertResult(secondAttemptResult(F_SLOT, C1_ANSWER, onTopic(slots("REASON", SlotAssessmentStatus.GENERIC))),
                "SLOT", "이유 붙여보기", "REASON", "PARTIAL", null, null, "조금 더 구체적으로 써 보세요");
    }

    @Test
    void b3_slotMissingIsUnresolved() throws Exception {
        assertResult(secondAttemptResult(F_SLOT, C1_ANSWER, onTopic(slots("REASON", SlotAssessmentStatus.MISSING))),
                "SLOT", "이유 붙여보기", "REASON", "UNRESOLVED", null, null, "아직 안 들어갔어요");
    }

    @Test
    void b4_targetSlotAbsentFromNewDiagnosisIsUnresolved() throws Exception {
        assertResult(secondAttemptResult(F_SLOT, C1_ANSWER, onTopic(slots("CHOICE", SlotAssessmentStatus.SATISFIED))),
                "SLOT", "이유 붙여보기", "REASON", "UNRESOLVED", null, null, "아직 안 들어갔어요");
    }

    @Test
    void b5_offTopicWithAllSlotsMissingIsUnresolved() throws Exception {
        FeedbackAnalysisSnapshot snapshot = snapshot(TopicRelevance.OFF_TOPIC,
                slots("REASON", SlotAssessmentStatus.MISSING, "ACTION", SlotAssessmentStatus.MISSING), false);
        assertResult(secondAttemptResult(F_SLOT, C1_ANSWER, snapshot),
                "SLOT", "이유 붙여보기", "REASON", "UNRESOLVED", null, null, "아직 안 들어갔어요");
    }

    @Test
    void b6_resultIsAttachedWhenNewFeedbackIsComplete() throws Exception {
        FeedbackAnalysisSnapshot snapshot = snapshot(TopicRelevance.ON_TOPIC, slots("REASON", SlotAssessmentStatus.SATISFIED), true);
        FeedbackResponseDto complete = newFeedback(true, null, C1_ANSWER);

        FeedbackResponseDto response = secondAttempt(F_SLOT, C1_ANSWER, complete, snapshot);
        FeedbackResponseDto reference = referenceSecondAttempt(C1_ANSWER, complete, snapshot);

        assertSlotB1(response.previousMissionResult());
        assertThat(response.loopComplete()).isTrue();
        assertThat(json(response).get("completion")).isEqualTo(json(reference).get("completion"));
        assertThat(response.completion()).isNotNull();
    }

    @Test
    void b7_onlyTheTargetSlotIsJudged() throws Exception {
        assertSlotB1(secondAttemptResult(F_SLOT, C1_ANSWER, onTopic(slots(
                "REASON", SlotAssessmentStatus.SATISFIED,
                "CHOICE", SlotAssessmentStatus.MISSING
        ))));
    }

    // ---------- C. LANGUAGE_FIX 판정 ----------

    @Test
    void c1_allCorrectionsReflectedIsResolved() throws Exception {
        assertResult(languageFix(F_LANG2, C1_ANSWER),
                "LANGUAGE_FIX", "문장 2곳 바로잡기", null, "RESOLVED", 2, 2, "2곳 모두 반영했어요");
    }

    @Test
    void c2_someCorrectionsReflectedIsPartial() throws Exception {
        assertResult(languageFixWithCorrectionsLeft(F_LANG2, "Yesterday I went to the market and bought a apple."),
                "LANGUAGE_FIX", "문장 2곳 바로잡기", null, "PARTIAL", 1, 2, "2곳 중 1곳 반영했어요");
    }

    @Test
    void c3_noCorrectionReflectedIsUnresolved() throws Exception {
        assertResult(languageFixWithCorrectionsLeft(F_LANG2, PREVIOUS_ANSWER),
                "LANGUAGE_FIX", "문장 2곳 바로잡기", null, "UNRESOLVED", 0, 2, "아직 반영되지 않았어요");
    }

    @Test
    void c4_twoOfThreeIsPartial() throws Exception {
        assertResult(languageFixWithCorrectionsLeft(F_LANG3, "Yesterday I went to the market and bought an apple. I think it taste good."),
                "LANGUAGE_FIX", "문장 3곳 바로잡기", null, "PARTIAL", 2, 3, "3곳 중 2곳 반영했어요");
    }

    @Test
    void c5_caseIsIgnored() throws Exception {
        assertResult(languageFix(F_LANG2, "yesterday i WENT to the market and bought AN APPLE"),
                "LANGUAGE_FIX", "문장 2곳 바로잡기", null, "RESOLVED", 2, 2, "2곳 모두 반영했어요");
    }

    // 시나리오 C6은 "문장부호를 빼고"에 따라 RESOLVED였다. 결정 파일의 정규화는 따옴표를 남기므로
    // "it's fun"이 "its fun to swim"에 없어 UNRESOLVED가 된다(결정을 따름. 06 보고에 적음).
    @Test
    void c6_punctuationKeepsApostropheByDecision() throws Exception {
        FeedbackCoachMoveDto previous = move("문장 한 곳 바로잡기", "LANGUAGE_FIX", null, List.of(fix("Its fun", "It's fun!")));
        assertResult(languageFixWithCorrectionsLeft(previous, "Its fun to swim"),
                "LANGUAGE_FIX", "문장 한 곳 바로잡기", null, "UNRESOLVED", 0, 1, "아직 반영되지 않았어요");
    }

    // 결정 파일(정규화, 1곳 문구)에서 더한 확인: 느낌표는 빠지고 따옴표는 남는다.
    @Test
    void c6Decision_exclamationIsDroppedAndSingleFixMessage() throws Exception {
        FeedbackCoachMoveDto previous = move("문장 한 곳 바로잡기", "LANGUAGE_FIX", null, List.of(fix("Its fun", "It's fun!")));
        assertResult(languageFix(previous, "It's fun to swim"),
                "LANGUAGE_FIX", "문장 한 곳 바로잡기", null, "RESOLVED", 1, 1, "고친 곳을 반영했어요");
    }

    @Test
    void c7_curlyApostropheMatchesStraightApostrophe() throws Exception {
        FeedbackCoachMoveDto previous = move("문장 한 곳 바로잡기", "LANGUAGE_FIX", null, List.of(fix("I dont", "I don't")));
        assertResult(languageFix(previous, "I don’t like it."),
                "LANGUAGE_FIX", "문장 한 곳 바로잡기", null, "RESOLVED", 1, 1, "고친 곳을 반영했어요");
    }

    @Test
    void c8_whitespaceIsCollapsed() throws Exception {
        assertResult(languageFix(F_LANG2, "Yesterday I   went to the market\nand bought an\tapple."),
                "LANGUAGE_FIX", "문장 2곳 바로잡기", null, "RESOLVED", 2, 2, "2곳 모두 반영했어요");
    }

    @Test
    void c9_wordBoundaryAfter() throws Exception {
        assertResult(languageFixWithCorrectionsLeft(F_LANG2, "Yesterday I went to the market and bought an apples."),
                "LANGUAGE_FIX", "문장 2곳 바로잡기", null, "PARTIAL", 1, 2, "2곳 중 1곳 반영했어요");
    }

    @Test
    void c10_wordBoundaryBefore() throws Exception {
        FeedbackCoachMoveDto previous = move("문장 한 곳 바로잡기", "LANGUAGE_FIX", null, List.of(fix("a ant", "an ant")));
        assertResult(languageFixWithCorrectionsLeft(previous, "I saw a giant."),
                "LANGUAGE_FIX", "문장 한 곳 바로잡기", null, "UNRESOLVED", 0, 1, "아직 반영되지 않았어요");
        assertResult(languageFixWithCorrectionsLeft(previous, "I saw plan ant."),
                "LANGUAGE_FIX", "문장 한 곳 바로잡기", null, "UNRESOLVED", 0, 1, "아직 반영되지 않았어요");
    }

    @Test
    void c11_deletionReflectedWhenBeforeIsGone() throws Exception {
        FeedbackCoachMoveDto previous = move("문장 한 곳 바로잡기", "LANGUAGE_FIX", null, List.of(fix("very very", null)));
        assertResult(languageFix(previous, "It was good."),
                "LANGUAGE_FIX", "문장 한 곳 바로잡기", null, "RESOLVED", 1, 1, "고친 곳을 반영했어요");
    }

    @Test
    void c12_deletionNotReflectedWhenBeforeRemains() throws Exception {
        FeedbackCoachMoveDto previous = move("문장 한 곳 바로잡기", "LANGUAGE_FIX", null, List.of(fix("very very", null)));
        assertResult(languageFixWithCorrectionsLeft(previous, "It was very very good."),
                "LANGUAGE_FIX", "문장 한 곳 바로잡기", null, "UNRESOLVED", 0, 1, "아직 반영되지 않았어요");
    }

    @Test
    void c13_mixedReplacementAndDeletion() throws Exception {
        FeedbackCoachMoveDto previous = move("문장 2곳 바로잡기", "LANGUAGE_FIX", null, List.of(
                fix("I go", "I went"),
                fix("very very", null)
        ));
        assertResult(languageFixWithCorrectionsLeft(previous, "I went there. It was very very good."),
                "LANGUAGE_FIX", "문장 2곳 바로잡기", null, "PARTIAL", 1, 2, "2곳 중 1곳 반영했어요");
    }

    @Test
    void c14_resultIsAttachedWhenNewFeedbackIsComplete() throws Exception {
        FeedbackAnalysisSnapshot snapshot = snapshot(TopicRelevance.ON_TOPIC, slots("REASON", SlotAssessmentStatus.SATISFIED), true);
        FeedbackResponseDto response = secondAttempt(F_LANG2, C1_ANSWER, newFeedback(true, null, C1_ANSWER), snapshot);

        assertThat(response.loopComplete()).isTrue();
        assertResult(response.previousMissionResult(),
                "LANGUAGE_FIX", "문장 2곳 바로잡기", null, "RESOLVED", 2, 2, "2곳 모두 반영했어요");
    }

    // ---------- 결정 파일(05)에서 정한 경우 ----------

    @Test
    void decision_slotWithoutTargetSlotIsNotAttached() throws Exception {
        FeedbackResponseDto response = secondAttempt(
                move("이유 붙여보기", "SLOT", null, List.of()),
                C1_ANSWER, newMissionFeedback(), onTopic(slots("REASON", SlotAssessmentStatus.SATISFIED))
        );
        assertThat(response.previousMissionResult()).isNull();
        assertThat(json(response).has("previousMissionResult")).isFalse();
    }

    @Test
    void decision_languageFixWithoutCorrectionsIsNotAttached() throws Exception {
        FeedbackResponseDto response = secondAttempt(
                move("문장 바로잡기", "LANGUAGE_FIX", null, List.of()),
                C1_ANSWER, newMissionFeedback(), onTopic(slots("REASON", SlotAssessmentStatus.SATISFIED))
        );
        assertThat(response.previousMissionResult()).isNull();
        assertThat(json(response).has("previousMissionResult")).isFalse();
    }

    @Test
    void decision_languageFixWhoseCorrectionsAreAllEmptyIsNotAttached() throws Exception {
        FeedbackResponseDto response = secondAttempt(
                move("문장 바로잡기", "LANGUAGE_FIX", null, List.of(fix(null, null), fix("  ", ""))),
                C1_ANSWER, newMissionFeedback(), onTopic(slots("REASON", SlotAssessmentStatus.SATISFIED))
        );
        assertThat(response.previousMissionResult()).isNull();
        assertThat(json(response).has("previousMissionResult")).isFalse();
    }

    @Test
    void decision_beforeSearchUsesWordBoundary() throws Exception {
        FeedbackCoachMoveDto previous = move("문장 한 곳 바로잡기", "LANGUAGE_FIX", null, List.of(fix("very", null)));
        assertResult(languageFix(previous, "I run every day."),
                "LANGUAGE_FIX", "문장 한 곳 바로잡기", null, "RESOLVED", 1, 1, "고친 곳을 반영했어요");
    }

    @Test
    void decision_hyphenBecomesSpace() throws Exception {
        FeedbackCoachMoveDto previous = move("문장 한 곳 바로잡기", "LANGUAGE_FIX", null, List.of(fix("well know", "well-known")));
        assertResult(languageFix(previous, "It is a well known place."),
                "LANGUAGE_FIX", "문장 한 곳 바로잡기", null, "RESOLVED", 1, 1, "고친 곳을 반영했어요");
        assertResult(languageFix(previous, "It is a well-known place."),
                "LANGUAGE_FIX", "문장 한 곳 바로잡기", null, "RESOLVED", 1, 1, "고친 곳을 반영했어요");
    }

    // ---------- D. TASK_RESET 판정 ----------

    @Test
    void d1_onTopicIsResolved() throws Exception {
        assertResult(secondAttemptResult(F_TASK, C1_ANSWER, onTopic(slots("CHOICE", SlotAssessmentStatus.SATISFIED))),
                "TASK_RESET", "질문에 맞게 다시 쓰기", "CHOICE", "RESOLVED", null, null, "질문에 맞게 썼어요");
    }

    @Test
    void d2_offTopicIsUnresolved() throws Exception {
        FeedbackAnalysisSnapshot snapshot = snapshot(TopicRelevance.OFF_TOPIC, slots("CHOICE", SlotAssessmentStatus.MISSING), false);
        assertResult(secondAttemptResult(F_TASK, C1_ANSWER, snapshot),
                "TASK_RESET", "질문에 맞게 다시 쓰기", "CHOICE", "UNRESOLVED", null, null, "아직 질문과 거리가 있어요");
    }

    @Test
    void d3_onlyTopicIsJudgedNeverPartial() throws Exception {
        assertResult(secondAttemptResult(F_TASK, C1_ANSWER, onTopic(slots("CHOICE", SlotAssessmentStatus.MISSING))),
                "TASK_RESET", "질문에 맞게 다시 쓰기", "CHOICE", "RESOLVED", null, null, "질문에 맞게 썼어요");
    }

    @Test
    void d4_targetSlotOnlyWhenPresent() throws Exception {
        FeedbackCoachMoveDto previous = move("질문에 맞게 다시 쓰기", "TASK_RESET", null, List.of());
        assertResult(secondAttemptResult(previous, C1_ANSWER, onTopic(slots("CHOICE", SlotAssessmentStatus.SATISFIED))),
                "TASK_RESET", "질문에 맞게 다시 쓰기", null, "RESOLVED", null, null, "질문에 맞게 썼어요");
    }

    // ---------- E. 응답 필드 ----------

    @Test
    void e1_serializedResponseAddsOnlyThePreviousMissionObject() throws Exception {
        List<String> existingKeys = List.of(
                "promptId", "sessionId", "attemptNo", "loopComplete", "completionMessage", "summary", "strengths",
                "inlineFeedback", "revisedAnswer", "refinementExpressions", "modelAnswer", "modelAnswerKo",
                "rewriteChallenge", "ui", "loop", "coachMove", "rewriteWorkspace", "completion", "revealLater",
                "visibleFeedback"
        );
        FeedbackAnalysisSnapshot slotSnapshot = onTopic(slots("REASON", SlotAssessmentStatus.SATISFIED, "CHOICE", SlotAssessmentStatus.SATISFIED));
        Map<FeedbackCoachMoveDto, JsonNode> expected = new LinkedHashMap<>();
        expected.put(F_SLOT, objectMapper.readTree("""
                {"focusType":"SLOT","title":"이유 붙여보기","targetSlot":"REASON","status":"RESOLVED","message":"해결했어요"}
                """));
        expected.put(F_LANG2, objectMapper.readTree("""
                {"focusType":"LANGUAGE_FIX","title":"문장 2곳 바로잡기","status":"RESOLVED","appliedCount":2,"totalCount":2,"message":"2곳 모두 반영했어요"}
                """));
        expected.put(F_TASK, objectMapper.readTree("""
                {"focusType":"TASK_RESET","title":"질문에 맞게 다시 쓰기","targetSlot":"CHOICE","status":"RESOLVED","message":"질문에 맞게 썼어요"}
                """));

        ObjectNode reference = json(referenceSecondAttempt(C1_ANSWER, newMissionFeedback(), slotSnapshot));
        for (Map.Entry<FeedbackCoachMoveDto, JsonNode> entry : expected.entrySet()) {
            String serialized = objectMapper.writeValueAsString(
                    secondAttempt(entry.getKey(), C1_ANSWER, newMissionFeedback(), slotSnapshot)
            );
            JsonNode node = objectMapper.readTree(serialized);

            assertThat(node.get("previousMissionResult")).isEqualTo(entry.getValue());
            Set<String> names = new LinkedHashSet<>();
            node.fieldNames().forEachRemaining(names::add);
            assertThat(names).containsAll(existingKeys);
            Set<String> referenceNames = new LinkedHashSet<>();
            reference.fieldNames().forEachRemaining(referenceNames::add);
            referenceNames.add("previousMissionResult");
            assertThat(names).isEqualTo(referenceNames);
            ObjectNode rest = ((ObjectNode) node).deepCopy();
            rest.remove("previousMissionResult");
            assertThat(rest).isEqualTo(reference);
        }
    }

    @Test
    void e2_oldStoredPayloadWithoutTheFieldReadsAsNull() throws Exception {
        ObjectNode old = json(storedFeedback(1, false, F_SLOT, null));
        old.remove("previousMissionResult");
        FeedbackResponseDto read = objectMapper.treeToValue(old, FeedbackResponseDto.class);

        assertThat(read.previousMissionResult()).isNull();
        assertThat(read.coachMove().focus()).isEqualTo("이유 붙여보기");
    }

    @Test
    void e3_oldAppRequestBodyIsEnough() throws Exception {
        assertThat(Arrays.stream(FeedbackRequestDto.class.getRecordComponents()).map(component -> component.getName()).toList())
                .containsExactly("promptId", "answer", "sessionId", "attemptType", "guestId", "submissionId");

        Harness harness = new Harness(false, 1, newMissionFeedback(), onTopic(slots("REASON", SlotAssessmentStatus.SATISFIED)))
                .withPrevious(attemptWithMove(1, F_SLOT));
        FeedbackRequestDto request = objectMapper.readValue("""
                {"promptId":"prompt-spec-1","answer":"Yesterday I went to the market and bought an apple.",
                 "sessionId":"session-spec-prev-mission","attemptType":"REWRITE","guestId":null,"submissionId":"submission-e3"}
                """, FeedbackRequestDto.class);

        FeedbackResponseDto response = harness.service.review(request, 7L);

        assertSlotB1(response.previousMissionResult());
    }

    // ---------- F. 저장과 재전송 ----------

    @Test
    void f1ToF3_storedPayloadHoldsResultAndResendReturnsItUnchanged() throws Exception {
        Harness harness = new Harness(false, 1, newMissionFeedback(), onTopic(slots("REASON", SlotAssessmentStatus.GENERIC)))
                .withPrevious(attemptWithMove(1, F_SLOT));

        FeedbackResponseDto first = harness.submit(C1_ANSWER, "submission-f1");

        // F1
        assertThat(harness.saved).hasSize(1);
        JsonNode stored = objectMapper.readTree(harness.saved.get(0).getFeedbackPayloadJson()).get("previousMissionResult");
        assertThat(stored).isEqualTo(objectMapper.readTree("""
                {"focusType":"SLOT","title":"이유 붙여보기","targetSlot":"REASON","status":"PARTIAL","message":"조금 더 구체적으로 써 보세요"}
                """));

        // F3: 재전송 사이에 앞 시도의 저장 피드백이 바뀌어도 다시 계산하지 않는다.
        harness.withPrevious(attemptWithMove(1, F_LANG2));

        // F2
        FeedbackResponseDto resent = harness.submit(C1_ANSWER, "submission-f1");

        verify(harness.llm, times(1)).review(any(PromptDto.class), anyString(), anyList(), anyInt());
        assertThat(harness.saved).hasSize(1);
        assertThat(resent.previousMissionResult()).isEqualTo(first.previousMissionResult());
        assertResult(resent.previousMissionResult(),
                "SLOT", "이유 붙여보기", "REASON", "PARTIAL", null, null, "조금 더 구체적으로 써 보세요");
    }

    @Test
    void f4_languageFixResendKeepsCounts() throws Exception {
        Harness harness = new Harness(false, 1, newMissionFeedback(), onTopicWithCorrectionsLeft(slots("REASON", SlotAssessmentStatus.MISSING)))
                .withPrevious(attemptWithMove(1, F_LANG2));
        String answer = "Yesterday I went to the market and bought a apple.";

        FeedbackResponseDto first = harness.submit(answer, "submission-f4");
        FeedbackResponseDto resent = harness.submit(answer, "submission-f4");

        verify(harness.llm, times(1)).review(any(PromptDto.class), anyString(), anyList(), anyInt());
        assertResult(first.previousMissionResult(),
                "LANGUAGE_FIX", "문장 2곳 바로잡기", null, "PARTIAL", 1, 2, "2곳 중 1곳 반영했어요");
        assertResult(resent.previousMissionResult(),
                "LANGUAGE_FIX", "문장 2곳 바로잡기", null, "PARTIAL", 1, 2, "2곳 중 1곳 반영했어요");
    }

    // ---------- G. 그대로여야 할 동작 ----------

    @Test
    void g1_llmIsCalledOnceWithTheUsualArguments() throws Exception {
        Map<FeedbackCoachMoveDto, FeedbackAnalysisSnapshot> cases = new LinkedHashMap<>();
        cases.put(F_SLOT, onTopic(slots("REASON", SlotAssessmentStatus.SATISFIED)));
        cases.put(F_LANG2, onTopic(slots("REASON", SlotAssessmentStatus.MISSING)));
        cases.put(F_TASK, onTopic(slots("CHOICE", SlotAssessmentStatus.SATISFIED)));
        for (Map.Entry<FeedbackCoachMoveDto, FeedbackAnalysisSnapshot> entry : cases.entrySet()) {
            Harness harness = new Harness(false, 1, newMissionFeedback(), entry.getValue())
                    .withPrevious(attemptWithMove(1, entry.getKey()));

            harness.submit("  " + C1_ANSWER + "  ");

            verify(harness.llm, times(1)).review(any(PromptDto.class), anyString(), anyList(), anyInt());
            verify(harness.llm).review(eq(harness.prompt), eq(C1_ANSWER), eq(HINTS), eq(2));
        }
    }

    @Test
    void g2_missionSelectionFieldsAreUnchanged() throws Exception {
        Map<FeedbackCoachMoveDto, FeedbackAnalysisSnapshot> cases = new LinkedHashMap<>();
        cases.put(F_SLOT, onTopic(slots("REASON", SlotAssessmentStatus.SATISFIED)));
        cases.put(F_LANG2, onTopic(slots("REASON", SlotAssessmentStatus.MISSING)));
        cases.put(F_TASK, onTopic(slots("CHOICE", SlotAssessmentStatus.SATISFIED)));
        for (Map.Entry<FeedbackCoachMoveDto, FeedbackAnalysisSnapshot> entry : cases.entrySet()) {
            FeedbackResponseDto response = secondAttempt(entry.getKey(), C1_ANSWER, newMissionFeedback(), entry.getValue());
            FeedbackResponseDto reference = referenceSecondAttempt(C1_ANSWER, newMissionFeedback(), entry.getValue());

            assertThat(response.previousMissionResult()).isNotNull();
            ObjectNode actual = json(response);
            ObjectNode expected = json(reference);
            for (String key : List.of("coachMove", "loop", "rewriteWorkspace", "completion", "loopComplete")) {
                assertThat(actual.get(key)).as(key).isEqualTo(expected.get(key));
            }
            assertThat(withoutPreviousMission(response)).isEqualTo(expected);
        }
    }

    @Test
    void g3_firstAnswerResponseHasNoExtraKey() {
        FeedbackAnalysisSnapshot snapshot = onTopic(slots("REASON", SlotAssessmentStatus.SATISFIED));
        FeedbackResponseDto response = new Harness(false, 0, newMissionFeedback(), snapshot).service.review(
                new FeedbackRequestDto(PROMPT_ID, C1_ANSWER, null, "INITIAL", null), 7L
        );
        FeedbackResponseDto reference = new Harness(false, 0, newMissionFeedback(), snapshot).service.review(
                new FeedbackRequestDto(PROMPT_ID, C1_ANSWER, null, "INITIAL", null), 7L
        );

        ObjectNode actual = json(response);
        ObjectNode expected = json(reference);
        // 새 세션 id는 매번 새로 만들어지므로 빼고 비교한다.
        actual.remove("sessionId");
        expected.remove("sessionId");
        assertThat(actual.has("previousMissionResult")).isFalse();
        assertThat(actual).isEqualTo(expected);
    }

    @Test
    void g4_languageFixCorrectionsOfNewFeedbackAreUnchanged() throws Exception {
        FeedbackCoachMoveDto newLanguageMove = move("문장 2곳 바로잡기", "LANGUAGE_FIX", null, List.of(
                fix("I go", "I went"),
                fix("a apple", "an apple")
        ));
        FeedbackResponseDto llmFeedback = newFeedback(false, newLanguageMove, C1_ANSWER);
        FeedbackAnalysisSnapshot snapshot = onTopic(slots("REASON", SlotAssessmentStatus.SATISFIED));

        FeedbackResponseDto response = secondAttempt(F_SLOT, PREVIOUS_ANSWER, llmFeedback, snapshot);
        FeedbackResponseDto reference = referenceSecondAttempt(PREVIOUS_ANSWER, llmFeedback, snapshot);

        assertSlotB1(response.previousMissionResult());
        assertThat(json(response).get("coachMove")).isEqualTo(json(reference).get("coachMove"));
        assertThat(response.coachMove().languageCorrections()).isEqualTo(newLanguageMove.languageCorrections());
        assertThat(response.revisedAnswer()).isEqualTo(reference.revisedAnswer());
        assertThat(json(response).path("visibleFeedback").get("coachMove"))
                .isEqualTo(json(reference).path("visibleFeedback").get("coachMove"));
    }

    @Test
    void g5_visibleSnapshotAndDiagnosisLogAreUnchanged() throws Exception {
        FeedbackAnalysisSnapshot snapshot = onTopic(slots("REASON", SlotAssessmentStatus.SATISFIED));
        Harness harness = new Harness(false, 1, newMissionFeedback(), snapshot)
                .withPrevious(attemptWithMove(1, F_SLOT));
        Harness reference = new Harness(false, 1, newMissionFeedback(), snapshot);

        FeedbackResponseDto response = harness.submit(C1_ANSWER);
        FeedbackResponseDto referenceResponse = reference.submit(C1_ANSWER);

        assertSlotB1(response.previousMissionResult());
        String visibleJson = harness.saved.get(0).getVisibleFeedbackSnapshotJson();
        assertThat(visibleJson).isEqualTo(reference.saved.get(0).getVisibleFeedbackSnapshotJson());
        assertThat(objectMapper.readTree(visibleJson).has("previousMissionResult")).isFalse();
        assertThat(json(response).get("visibleFeedback")).isEqualTo(json(referenceResponse).get("visibleFeedback"));

        assertThat(harness.savedLogs).hasSize(1);
        FeedbackDiagnosisLogEntity log = harness.savedLogs.get(0);
        assertThat(log.getLearnerAnswer()).isEqualTo(C1_ANSWER);
        assertThat(log.getPreviousAnswer()).isEqualTo(PREVIOUS_ANSWER);
        assertThat(log.getDiagnosisPayloadJson()).isEqualTo(objectMapper.writeValueAsString(snapshot.diagnosis()));
        assertThat(log.getFinalSectionsJson()).isEqualTo(objectMapper.writeValueAsString(snapshot.finalSections()));
        assertThat(reference.savedLogs.get(0).getDiagnosisPayloadJson()).isEqualTo(log.getDiagnosisPayloadJson());
        assertThat(reference.savedLogs.get(0).getFinalSectionsJson()).isEqualTo(log.getFinalSectionsJson());
    }
}
