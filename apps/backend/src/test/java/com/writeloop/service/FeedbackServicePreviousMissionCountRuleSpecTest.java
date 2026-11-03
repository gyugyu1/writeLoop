package com.writeloop.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.FeedbackCoachMoveDto;
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
import com.writeloop.persistence.FeedbackDiagnosisLogRepository;
import com.writeloop.persistence.SessionStatus;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

// qa test-add(22-main-decision.md): 대소문자·문장부호만 고친 교정 줄(15 규칙 2)을 22 결정의 규칙으로 확인한다.
// 22 규칙: 공백만 줄이고 따옴표(’‘ → ', “” → ")를 맞춘 원문에서, 공백 경계(앞뒤가 공백이나 글 끝)로 센 출현 개수를
// 지난 답(앞 시도의 답)과 이번 답에서 비교한다. 고치기 전 표현 개수가 줄고 고친 표현 개수가 늘었으면 반영.
// 교정 줄은 운영처럼 FeedbackRevisionDiffSupport가 만드는 모양이다(precondition_fixturesHaveTheProductionShape가 확인).
// 기대값은 22·15 결정의 규칙과 01 명세·05 결정의 문구에서만 가져왔다.
class FeedbackServicePreviousMissionCountRuleSpecTest {

    private static final String PROMPT_ID = "prompt-spec-count";
    private static final String SESSION_ID = "session-spec-count";

    private final ObjectMapper objectMapper = new ObjectMapper();

    // ---------- 지난 답과 운영 모양의 교정 줄 ----------

    // 지난 답(시도 1). 문장 첫 the는 소문자, 같은 낱말 the가 "to the park"에 소문자로 또 있다.
    private static final String P0_PREVIOUS =
            "the weather was nice. Yesterday I went to the park with my friend and i'm still happy because it was fun";
    // 교정을 하나씩 적용한 답. 운영은 단계마다 (적용 전 답, 적용 후 답)으로 교정 줄을 만든다.
    private static final String P1 =
            "The weather was nice. Yesterday I went to the park with my friend and i'm still happy because it was fun";
    private static final String P2 =
            "The weather was nice. Yesterday, I went to the park with my friend and i'm still happy because it was fun";
    private static final String P3 =
            "The weather was nice. Yesterday, I went to the park with my friend and I'm still happy because it was fun";
    // 네 줄을 모두 그대로 고친 답(곧은 따옴표).
    private static final String P4_ALL_FIXED =
            "The weather was nice. Yesterday, I went to the park with my friend and I'm still happy because it was fun.";
    // 네 줄을 모두 고쳤고 I'm만 굽은 따옴표(’)로 쓴 답(모바일 자동 입력).
    private static final String P4_ALL_FIXED_CURLY =
            "The weather was nice. Yesterday, I went to the park with my friend and I’m still happy because it was fun.";

    private static final FeedbackLanguageCorrectionDto CAPITAL_THE = fix("the", "The");               // 문장 첫 대문자
    private static final FeedbackLanguageCorrectionDto COMMA_YESTERDAY = fix("Yesterday", "Yesterday,"); // 쉼표 덧붙이기
    private static final FeedbackLanguageCorrectionDto CASE_IM = fix("i'm", "I'm");                    // 대소문자만
    private static final FeedbackLanguageCorrectionDto PERIOD_FUN = fix("fun", "fun.");                // 마침표 덧붙이기

    private static final List<FeedbackLanguageCorrectionDto> ALL_FOUR = List.of(
            CAPITAL_THE, COMMA_YESTERDAY, CASE_IM, PERIOD_FUN
    );

    private static FeedbackLanguageCorrectionDto fix(String before, String after) {
        return new FeedbackLanguageCorrectionDto("GRAMMAR_LOCAL", "세부 교정", before, after, "이유");
    }

    private static FeedbackCoachMoveDto languageMove(List<FeedbackLanguageCorrectionDto> corrections) {
        String focus = corrections.size() == 1 ? "문장 한 곳 바로잡기" : "문장 " + corrections.size() + "곳 바로잡기";
        return new FeedbackCoachMoveDto(
                focus, "LANGUAGE_FIX", "why", null, null, "instruction", null, null,
                List.of(), null, null, corrections
        );
    }

    private static LanguageRevisionDisplay productionDisplay(String beforeStep, String afterStep) {
        FeedbackRevisionDiff diff = FeedbackRevisionDiffSupport.compare(beforeStep, afterStep);
        LanguageRevisionEdit edit = FeedbackRevisionDiffSupport.enclosingEdit(beforeStep, afterStep, diff);
        return FeedbackRevisionDiffSupport.displayWithSurroundingWords(beforeStep, afterStep, edit);
    }

    // ---------- 실행 틀(FeedbackServicePreviousMissionCorrectionShapeSpecTest와 같은 방식) ----------

    private PromptDto prompt() {
        return new PromptDto(
                PROMPT_ID, "Daily life", "Daily life", "Routine", "A",
                "What did you do yesterday?", "어제 무엇을 했나요?", "", null,
                new PromptTaskMetaDto("ROUTINE", List.of("ACTION"), List.of("REASON"), "PAST_SIMPLE", "FIRST_PERSON", 0)
        );
    }

    private static FeedbackResponseDto newMissionFeedback() {
        return new FeedbackResponseDto(
                PROMPT_ID, "__CANONICAL_INTERNAL__", 1, false, null,
                "Add one relevant detail.",
                List.of("The main action is clear."),
                List.of(), List.of(), List.of(),
                "I went to the park.",
                List.of(),
                "I went to the park yesterday because the weather was nice.",
                "날씨가 좋아서 어제 공원에 갔어요.",
                "Add one detail.",
                null, null,
                new FeedbackCoachMoveDto("장소 구체적으로 쓰기", "SLOT", "why", null, null, "instruction", null, null,
                        List.of(), null, "DETAIL", List.of()),
                null, null, null
        );
    }

    private static FeedbackAnalysisSnapshot snapshot() {
        Map<String, SlotAssessmentValue> assessments = new LinkedHashMap<>();
        assessments.put("REASON", new SlotAssessmentValue("evidence", SlotAssessmentStatus.SATISFIED));
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                new TopicAssessment(TopicRelevance.ON_TOPIC, "reason"),
                new StructureAssessment(StructureStatus.COMPLETE),
                new LanguageAssessment(List.of())
        );
        MissionDecision decision = new MissionDecision(MissionKind.SLOT, List.of(), List.of(), "DETAIL", assessments, null, null);
        GeneratedSections sections = new GeneratedSections(
                List.of("The main action is clear."), List.of(),
                "I went to the park yesterday because the weather was nice.", "날씨가 좋아서 어제 공원에 갔어요.",
                decision, null
        );
        return new FeedbackAnalysisSnapshot("openai", "test-model", 200, "{}", diagnosis, sections);
    }

    // 앞 피드백의 고친 답(revisedAnswer)은 운영처럼 모두 고친 답이다. 지난 답은 이것이 아니라 시도 1의 답(P0)이다.
    private FeedbackResponseDto storedPreviousFeedback(FeedbackCoachMoveDto coachMove) {
        return new FeedbackResponseDto(
                PROMPT_ID, SESSION_ID, 1, false, null, "summary", List.of("strength"),
                List.of(), List.of(), List.of(),
                P4_ALL_FIXED,
                List.of(),
                "model answer", "모범 답안",
                null, null, null,
                coachMove, null, null, null
        );
    }

    // 시도 1(지난 답 P0, 미션은 주어진 교정 줄의 LANGUAGE_FIX)이 저장된 세션에 시도 2를 내고 지난 미션 결과를 받는다.
    private PreviousMissionResultDto resubmit(List<FeedbackLanguageCorrectionDto> previousCorrections, String newAnswer)
            throws Exception {
        PromptService promptService = mock(PromptService.class);
        LlmFeedbackClient llm = mock(LlmFeedbackClient.class);
        AnswerSessionRepository sessions = mock(AnswerSessionRepository.class);
        AnswerAttemptRepository attempts = mock(AnswerAttemptRepository.class);
        FeedbackDiagnosisLogRepository logs = mock(FeedbackDiagnosisLogRepository.class);
        FeedbackService service = new FeedbackService(
                promptService, llm, sessions, attempts, objectMapper,
                new TransactionTemplate(new NoopTransactionManager())
        );
        ReflectionTestUtils.setField(service, "feedbackDiagnosisLogRepository", logs);

        PromptDto prompt = prompt();
        FeedbackAnalysisSnapshot snapshot = snapshot();
        AnswerSessionEntity session = new AnswerSessionEntity(SESSION_ID, PROMPT_ID, null, 7L, SessionStatus.IN_PROGRESS);
        AnswerAttemptEntity previous = new AnswerAttemptEntity(
                SESSION_ID, 1, AttemptType.INITIAL, P0_PREVIOUS, "summary",
                objectMapper.writeValueAsString(storedPreviousFeedback(languageMove(previousCorrections))),
                "submission-count-1", null
        );

        when(promptService.findById(PROMPT_ID)).thenReturn(prompt);
        when(promptService.findHintsByPromptId(PROMPT_ID)).thenReturn(List.<PromptHintDto>of());
        when(llm.isConfigured()).thenReturn(true);
        when(llm.review(any(PromptDto.class), anyString(), anyList(), anyInt())).thenReturn(newMissionFeedback());
        when(llm.isAuthoritativeFeedback(any())).thenReturn(true);
        when(llm.takeLastAnalysisSnapshot()).thenReturn(snapshot);
        when(llm.takeLastExecutionTrace()).thenReturn(FeedbackExecutionTrace.successful(snapshot));
        when(llm.clearInternalMetadata(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(sessions.findById(SESSION_ID)).thenReturn(Optional.of(session));
        when(sessions.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(attempts.countBySessionId(anyString())).thenReturn(1);
        when(attempts.findBySessionIdAndAttemptNo(anyString(), anyInt())).thenAnswer(invocation ->
                Integer.valueOf(1).equals(invocation.getArgument(1)) ? Optional.of(previous) : Optional.empty());
        when(attempts.findBySessionIdAndSubmissionId(anyString(), anyString())).thenReturn(Optional.empty());
        when(attempts.findUserSubmissions(any(), anyString(), anyString())).thenReturn(List.of());
        when(attempts.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(logs.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        FeedbackResponseDto response = service.review(
                new FeedbackRequestDto(PROMPT_ID, newAnswer, SESSION_ID, "REWRITE", null, null), 7L
        );
        assertThat(response.attemptNo()).isEqualTo(2);
        return response.previousMissionResult();
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

    private static void assertLanguageFix(
            PreviousMissionResultDto actual, String title, String status, int applied, int total, String message
    ) {
        assertThat(actual).isNotNull();
        assertThat(actual.focusType()).isEqualTo("LANGUAGE_FIX");
        assertThat(actual.title()).isEqualTo(title);
        assertThat(actual.targetSlot()).isNull();
        assertThat(actual.status()).isEqualTo(status);
        assertThat(actual.appliedCount()).isEqualTo(applied);
        assertThat(actual.totalCount()).isEqualTo(total);
        assertThat(actual.message()).isEqualTo(message);
    }

    private static void assertSingleUnresolved(PreviousMissionResultDto actual) {
        assertLanguageFix(actual, "문장 한 곳 바로잡기", "UNRESOLVED", 0, 1, "아직 반영되지 않았어요");
    }

    private static void assertSingleResolved(PreviousMissionResultDto actual) {
        assertLanguageFix(actual, "문장 한 곳 바로잡기", "RESOLVED", 1, 1, "고친 곳을 반영했어요");
    }

    // ---------- 준비 데이터가 운영 모양인지(이미 있는 동작, 통과가 맞음) ----------

    @Test
    void precondition_fixturesHaveTheProductionShape() {
        List<String> steps = List.of(P0_PREVIOUS, P1, P2, P3, P4_ALL_FIXED);
        for (int index = 0; index < ALL_FOUR.size(); index++) {
            LanguageRevisionDisplay display = productionDisplay(steps.get(index), steps.get(index + 1));
            assertThat(display.before()).as("before of step " + (index + 1)).isEqualTo(ALL_FOUR.get(index).before());
            assertThat(display.after()).as("after of step " + (index + 1)).isEqualTo(ALL_FOUR.get(index).after());
        }
    }

    // ---------- 쉼표·마침표를 덧붙이는 줄(22 결정 1) ----------

    // 새 동작(지금 실패가 맞음): 지난 답 "Yesterday" 1·"Yesterday," 0 → 이번 답 0·1. 줄고 늘었으니 반영.
    @Test
    void commaLine_fixedAsCorrectedIsReflected() throws Exception {
        assertSingleResolved(resubmit(List.of(COMMA_YESTERDAY), P4_ALL_FIXED));
    }

    // 새 동작(지금 실패가 맞음): 지난 답 "fun" 1·"fun." 0 → 이번 답 0·1. 반영.
    @Test
    void periodLine_fixedAsCorrectedIsReflected() throws Exception {
        assertSingleResolved(resubmit(List.of(PERIOD_FUN), P4_ALL_FIXED));
    }

    // 이미 있는 동작(통과가 맞음): 지난 답을 그대로 내면 개수가 같아 미반영.
    @Test
    void commaLine_unchangedIsNotReflected() throws Exception {
        assertSingleUnresolved(resubmit(List.of(COMMA_YESTERDAY), P0_PREVIOUS));
    }

    // 이미 있는 동작(통과가 맞음): 지난 답을 그대로 내면 개수가 같아 미반영.
    @Test
    void periodLine_unchangedIsNotReflected() throws Exception {
        assertSingleUnresolved(resubmit(List.of(PERIOD_FUN), P0_PREVIOUS));
    }

    // ---------- 굽은 따옴표(22 결정 2) ----------

    // 새 동작(지금 실패가 맞음): 줄 i'm → I'm을 "I’m"으로 고침. 따옴표를 맞추면 "i'm" 1→0, "I'm" 0→1. 반영.
    @Test
    void caseLine_fixedWithCurlyApostropheIsReflected() throws Exception {
        assertSingleResolved(resubmit(List.of(CASE_IM), P4_ALL_FIXED_CURLY));
    }

    // ---------- 문장 첫 대문자(22 결정 3) ----------

    // 새 동작(지금 실패가 맞음): 지난 답 "the" 2·"The" 0 → 이번 답 "the" 1("to the park")·"The" 1. 줄고 늘었으니 반영.
    @Test
    void sentenceStartCapitalLine_fixedIsReflectedEvenWithAnotherLowercaseThe() throws Exception {
        assertSingleResolved(resubmit(List.of(CAPITAL_THE), P4_ALL_FIXED));
    }

    // 이미 있는 동작(통과가 맞음): 고치지 않으면 "the" 2·"The" 0 그대로라 미반영.
    @Test
    void sentenceStartCapitalLine_unchangedIsNotReflected() throws Exception {
        assertSingleUnresolved(resubmit(List.of(CAPITAL_THE), P0_PREVIOUS));
    }

    // ---------- 네 줄을 함께(22 결정 1·2·3) ----------

    // 새 동작(지금 실패가 맞음): 네 줄을 모두 그대로 고치고 I'm만 굽은 따옴표로 씀. 4/4 반영.
    @Test
    void allFourLines_fixedAreAllReflected() throws Exception {
        assertLanguageFix(resubmit(ALL_FOUR, P4_ALL_FIXED_CURLY),
                "문장 4곳 바로잡기", "RESOLVED", 4, 4, "4곳 모두 반영했어요");
    }
}
