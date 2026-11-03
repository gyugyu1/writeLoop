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

// qa test-add(15-main-decision.md): 문장 교정 반영 판정을 운영과 같은 모양의 교정 줄로 확인한다.
// 운영의 교정 줄 before/after는 FeedbackRevisionDiffSupport가 만든다(바꾸기는 바뀐 낱말만, 넣기·지우기는 앞뒤 낱말을 붙임).
// 기대값은 15 결정의 판정 규칙(1~4)과 01 명세·05 결정의 문구에서만 가져왔다.
class FeedbackServicePreviousMissionCorrectionShapeSpecTest {

    private static final String PROMPT_ID = "prompt-spec-shape";
    private static final String SESSION_ID = "session-spec-shape";

    private final ObjectMapper objectMapper = new ObjectMapper();

    // ---------- 운영 모양의 교정 줄 ----------

    // 앞 답과, 교정 단계를 하나씩 적용한 답. 운영은 단계마다 (적용 전 답, 적용 후 답)으로 교정 줄을 만든다.
    private static final String S0_PREVIOUS =
            "Yesterday i go to a bar on a rainy Day. Because it is a tradition. I want try makgeolli. It was very very good.";
    private static final String S1 =
            "Yesterday I go to a bar on a rainy Day. Because it is a tradition. I want try makgeolli. It was very very good.";
    private static final String S2 =
            "Yesterday I went to a bar on a rainy Day. Because it is a tradition. I want try makgeolli. It was very very good.";
    private static final String S3 =
            "Yesterday I went to a bar on a rainy Day because it is a tradition. I want try makgeolli. It was very very good.";
    private static final String S4 =
            "Yesterday I went to a bar on a rainy Day because it is a tradition. I want to try makgeolli. It was very very good.";
    private static final String S5 =
            "Yesterday I went to a bar on a rainy Day because it is a tradition. I want to try Makgeolli. It was very very good.";
    private static final String S6_ALL_FIXED =
            "Yesterday I went to a bar on a rainy Day because it is a tradition. I want to try Makgeolli. It was very good.";

    // 위 단계에서 FeedbackRevisionDiffSupport가 만드는 교정 줄(precondition_fixturesHaveTheProductionShape가 확인).
    private static final FeedbackLanguageCorrectionDto CASE_I = fix("i", "I");                              // 대소문자만
    private static final FeedbackLanguageCorrectionDto REPLACE_GO = fix("go", "went");                     // 낱말 바꾸기
    private static final FeedbackLanguageCorrectionDto PUNCT_DAY = fix("Day. Because", "Day because");     // 문장부호(와 대소문자)만
    private static final FeedbackLanguageCorrectionDto INSERT_TO = fix("want try", "want to try");         // 낱말 끼워 넣기
    private static final FeedbackLanguageCorrectionDto CASE_MAKGEOLLI = fix("makgeolli.", "Makgeolli.");   // 대소문자만
    private static final FeedbackLanguageCorrectionDto DELETE_VERY = fix("very very good.", "very good."); // 낱말 지우기

    private static final List<FeedbackLanguageCorrectionDto> ALL_SIX = List.of(
            CASE_I, REPLACE_GO, PUNCT_DAY, INSERT_TO, CASE_MAKGEOLLI, DELETE_VERY
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

    // ---------- 실행 틀(FeedbackServicePreviousMissionSpecTest와 같은 방식) ----------

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
                "I went to a bar.",
                List.of(),
                "I went to a bar yesterday because it was raining.",
                "어제 비가 와서 술집에 갔어요.",
                "Add one detail.",
                null, null,
                new FeedbackCoachMoveDto("장소 구체적으로 쓰기", "SLOT", "why", null, null, "instruction", null, null,
                        List.of(), null, "DETAIL", List.of()),
                null, null, null
        );
    }

    // 31 결정 1: 고치지 않은 줄이 남는 케이스(미반영·일부를 기대)는 이번 진단에도 문법 교정이 남아 있어야 실제 상황과 맞다.
    private static final List<LanguageRevisionStep> CORRECTIONS_LEFT = List.of(
            new LanguageRevisionStep(LanguageIssueKind.GRAMMAR_LOCAL, S6_ALL_FIXED, "남은 교정 이유")
    );

    private static FeedbackAnalysisSnapshot snapshot(List<LanguageRevisionStep> revisionSteps) {
        Map<String, SlotAssessmentValue> assessments = new LinkedHashMap<>();
        assessments.put("REASON", new SlotAssessmentValue("evidence", SlotAssessmentStatus.SATISFIED));
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                new TopicAssessment(TopicRelevance.ON_TOPIC, "reason"),
                new StructureAssessment(StructureStatus.COMPLETE),
                new LanguageAssessment(revisionSteps)
        );
        MissionDecision decision = new MissionDecision(MissionKind.SLOT, List.of(), List.of(), "DETAIL", assessments, null, null);
        GeneratedSections sections = new GeneratedSections(
                List.of("The main action is clear."), List.of(),
                "I went to a bar yesterday because it was raining.", "어제 비가 와서 술집에 갔어요.",
                decision, null
        );
        return new FeedbackAnalysisSnapshot("openai", "test-model", 200, "{}", diagnosis, sections);
    }

    private FeedbackResponseDto storedPreviousFeedback(FeedbackCoachMoveDto coachMove) {
        return new FeedbackResponseDto(
                PROMPT_ID, SESSION_ID, 1, false, null, "summary", List.of("strength"),
                List.of(), List.of(), List.of(),
                S6_ALL_FIXED,
                List.of(),
                "model answer", "모범 답안",
                null, null, null,
                coachMove, null, null, null
        );
    }

    // 시도 1(앞 답 S0, 미션은 주어진 교정 줄의 LANGUAGE_FIX)이 저장된 세션에 시도 2를 내고 지난 미션 결과를 받는다.
    private PreviousMissionResultDto resubmit(List<FeedbackLanguageCorrectionDto> previousCorrections, String newAnswer)
            throws Exception {
        return resubmit(previousCorrections, newAnswer, List.of());
    }

    // 이번 진단의 교정 단계를 정해 낸다(31 결정 1).
    private PreviousMissionResultDto resubmit(
            List<FeedbackLanguageCorrectionDto> previousCorrections,
            String newAnswer,
            List<LanguageRevisionStep> revisionSteps
    ) throws Exception {
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
        FeedbackAnalysisSnapshot snapshot = snapshot(revisionSteps);
        AnswerSessionEntity session = new AnswerSessionEntity(SESSION_ID, PROMPT_ID, null, 7L, SessionStatus.IN_PROGRESS);
        AnswerAttemptEntity previous = new AnswerAttemptEntity(
                SESSION_ID, 1, AttemptType.INITIAL, S0_PREVIOUS, "summary",
                objectMapper.writeValueAsString(storedPreviousFeedback(languageMove(previousCorrections))),
                "submission-shape-1", null
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
        List<String> steps = List.of(S0_PREVIOUS, S1, S2, S3, S4, S5, S6_ALL_FIXED);
        for (int index = 0; index < ALL_SIX.size(); index++) {
            LanguageRevisionDisplay display = productionDisplay(steps.get(index), steps.get(index + 1));
            assertThat(display.before()).as("before of step " + (index + 1)).isEqualTo(ALL_SIX.get(index).before());
            assertThat(display.after()).as("after of step " + (index + 1)).isEqualTo(ALL_SIX.get(index).after());
        }
    }

    // ---------- 앞 답을 그대로 다시 냄: 대소문자·문장부호·지우기 줄은 미반영(새 동작, 지금 실패가 맞음) ----------

    // 15 규칙 2: 정규화하면 같은 줄은 원문으로 비교. 새 답에 고치기 전 원문 "i"가 남아 있다.
    @Test
    void unchanged_caseOnlyLineIIsNotReflected() throws Exception {
        assertSingleUnresolved(resubmit(List.of(CASE_I), S0_PREVIOUS, CORRECTIONS_LEFT));
    }

    // 15 규칙 2: 새 답에 고친 원문 "Makgeolli."가 없고 고치기 전 원문 "makgeolli."가 있다.
    @Test
    void unchanged_caseOnlyLineMakgeolliIsNotReflected() throws Exception {
        assertSingleUnresolved(resubmit(List.of(CASE_MAKGEOLLI), S0_PREVIOUS, CORRECTIONS_LEFT));
    }

    // 15 규칙 2: 새 답에 고친 원문 "Day because"가 없고 고치기 전 원문 "Day. Because"가 있다.
    @Test
    void unchanged_punctuationOnlyLineIsNotReflected() throws Exception {
        assertSingleUnresolved(resubmit(List.of(PUNCT_DAY), S0_PREVIOUS, CORRECTIONS_LEFT));
    }

    // 15 규칙 3: 고친 표현 "very good"이 고치기 전 "very very good" 안에 있다. 새 답에 고치기 전 표현이 남아 있다.
    @Test
    void unchanged_deletionLineIsNotReflected() throws Exception {
        assertSingleUnresolved(resubmit(List.of(DELETE_VERY), S0_PREVIOUS, CORRECTIONS_LEFT));
    }

    // 여섯 줄 모두: 바꾸기·넣기 줄도 고치지 않았으므로 0/6.
    @Test
    void unchanged_allSixLinesAreNotReflected() throws Exception {
        assertLanguageFix(resubmit(ALL_SIX, S0_PREVIOUS, CORRECTIONS_LEFT),
                "문장 6곳 바로잡기", "UNRESOLVED", 0, 6, "아직 반영되지 않았어요");
    }

    // 바꾸기·넣기 줄만 고치고 대소문자·문장부호·지우기 줄은 그대로 둠: 2/6.
    @Test
    void partial_onlyReplacementAndInsertionFixedCountsTwoOfSix() throws Exception {
        String answer =
                "Yesterday i went to a bar on a rainy Day. Because it is a tradition. I want to try makgeolli. It was very very good.";
        assertLanguageFix(resubmit(ALL_SIX, answer, CORRECTIONS_LEFT),
                "문장 6곳 바로잡기", "PARTIAL", 2, 6, "6곳 중 2곳 반영했어요");
    }

    // ---------- 제대로 고쳐 냄: 반영(이미 있는 동작, 통과가 맞음) ----------

    // 15 규칙 2: 원문 비교. 고친 답에 낱말 "I"가 있고 낱말 "i"는 없다("drink", "it" 안의 i는 낱말이 아니다).
    @Test
    void fixed_caseOnlyLineIIsReflected() throws Exception {
        assertSingleResolved(resubmit(List.of(CASE_I), S6_ALL_FIXED));
    }

    @Test
    void fixed_caseOnlyLineMakgeolliIsReflected() throws Exception {
        assertSingleResolved(resubmit(List.of(CASE_MAKGEOLLI), S6_ALL_FIXED));
    }

    @Test
    void fixed_punctuationOnlyLineIsReflected() throws Exception {
        assertSingleResolved(resubmit(List.of(PUNCT_DAY), S6_ALL_FIXED));
    }

    // 15 규칙 2: "공백만 하나로 줄임". 고친 표현 사이 공백이 여러 개·줄바꿈이어도 반영.
    @Test
    void fixed_punctuationOnlyLineWithExtraWhitespaceIsReflected() throws Exception {
        String answer =
                "Yesterday I went to a bar on a rainy Day  \n because it is a tradition. I want to try Makgeolli. It was very good.";
        assertSingleResolved(resubmit(List.of(PUNCT_DAY), answer));
    }

    // 15 규칙 3: 새 답에 "very good"이 있고 "very very good"은 없다.
    @Test
    void fixed_deletionLineIsReflected() throws Exception {
        assertSingleResolved(resubmit(List.of(DELETE_VERY), S6_ALL_FIXED));
    }

    @Test
    void fixed_allSixLinesAreReflected() throws Exception {
        assertLanguageFix(resubmit(ALL_SIX, S6_ALL_FIXED),
                "문장 6곳 바로잡기", "RESOLVED", 6, 6, "6곳 모두 반영했어요");
    }

    // ---------- 바꾸기·넣기 줄은 지금처럼 판정(이미 있는 동작, 통과가 맞음) ----------

    // 15 규칙 4: 고친 표현 "went"가 새 답에 있으면 반영.
    @Test
    void replacementLine_reflectedOnlyWhenFixedExpressionPresent() throws Exception {
        assertSingleResolved(resubmit(List.of(REPLACE_GO), S6_ALL_FIXED));
        assertSingleUnresolved(resubmit(List.of(REPLACE_GO), S0_PREVIOUS, CORRECTIONS_LEFT));
    }

    // 15 규칙 4: 고친 표현 "want to try"가 새 답에 있으면 반영.
    @Test
    void insertionLine_reflectedOnlyWhenFixedExpressionPresent() throws Exception {
        assertSingleResolved(resubmit(List.of(INSERT_TO), S6_ALL_FIXED));
        assertSingleUnresolved(resubmit(List.of(INSERT_TO), S0_PREVIOUS, CORRECTIONS_LEFT));
    }
}
