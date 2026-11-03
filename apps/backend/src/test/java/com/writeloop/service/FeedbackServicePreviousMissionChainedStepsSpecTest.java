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

import java.util.ArrayList;
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

// qa test-add(29-main-decision.md): 교정 단계가 이어진 줄(앞 단계가 고친 글자를 다음 단계 줄이 품는 경우)과
// 이번 진단의 교정 유무를 섞어 보는 LANGUAGE_FIX 판정을 확인한다.
// 29 규칙:
//  1. 이번 진단의 교정 단계(languageAssessment.revisionSteps 중 종류가 있는 것: STRUCTURE·GRAMMAR_BLOCKING·GRAMMAR_LOCAL)가
//     하나도 없으면 셀 줄 전체를 반영으로 본다(RESOLVED, 1곳이면 "고친 곳을 반영했어요", 아니면 "N곳 모두 반영했어요").
//  2. 하나라도 있으면 줄별로 센다(15·22 규칙). 15 규칙 2(정규화가 같은 줄)에서 고치기 전 표현이 지난 답에 하나도 없으면,
//     이번 답에 고친 표현이 있고(앞뒤가 글자·숫자가 아닌 경계) 고치기 전 표현이 없으면(공백 경계) 반영.
// 31 결정 2: 15 규칙 2의 개수 비교에서 고친 표현은 앞뒤가 글자·숫자가 아닌 경계로 센다(고치기 전 표현은 22대로 공백 경계).
// 교정 줄은 운영처럼 단계마다 (적용 전 답, 적용 후 답)을 FeedbackRevisionDiffSupport로 비교해 만든 모양이다
// (precondition_* 테스트가 확인). 기대값은 29·22·15·05 결정과 01 명세의 문구에서만 가져왔다.
class FeedbackServicePreviousMissionChainedStepsSpecTest {

    private static final String PROMPT_ID = "prompt-spec-chained";
    private static final String SESSION_ID = "session-spec-chained";

    private final ObjectMapper objectMapper = new ObjectMapper();

    // ---------- 모양 A(28 확실한 문제 1의 A): 같은 낱말을 대소문자 → 쉼표 순서로 두 단계가 고친다 ----------

    private static final String A0_PREVIOUS = "yesterday i went to the park and it was fun";
    private static final String A1 = "Yesterday i went to the park and it was fun";
    private static final String A2 = "Yesterday, i went to the park and it was fun";
    private static final String A3_ALL_FIXED = "Yesterday, I went to the park and it was fun.";

    private static final FeedbackLanguageCorrectionDto A_L1 = fix("yesterday", "Yesterday");
    // 중간 문장의 표현: 고치기 전 표현 "Yesterday"(대문자)는 지난 답에 없다.
    private static final FeedbackLanguageCorrectionDto A_L2 = fix("Yesterday", "Yesterday,");
    private static final FeedbackLanguageCorrectionDto A_L3 =
            fix("i went to the park and it was fun", "I went to the park and it was fun.");

    // ---------- 모양 B(28 확실한 문제 1의 B): 한 단계가 앞 단계가 고친 낱말을 품고 두 곳(i→I, 끝 마침표)을 고친다 ----------

    private static final String B0_PREVIOUS = "i goes to school and it is fun";
    private static final String B1 = "i go to school and it is fun";
    private static final String B2_ALL_FIXED = "I go to school and it is fun.";

    private static final FeedbackLanguageCorrectionDto B_L1 = fix("goes", "go");
    // 중간 문장의 표현: 고치기 전 표현 "i go to school and it is fun"은 지난 답(i goes …)에 없다.
    private static final FeedbackLanguageCorrectionDto B_L2 =
            fix("i go to school and it is fun", "I go to school and it is fun.");

    // ---------- 모양 C: B 모양의 중간 표현 줄과 따로 떨어진 낱말 줄이 함께 있다 ----------

    private static final String C0_PREVIOUS = "My friend play soccer. i goes to school and it is fun";
    private static final String C1 = "My friend plays soccer. i goes to school and it is fun";
    private static final String C2 = "My friend plays soccer. i go to school and it is fun";
    private static final String C3_ALL_FIXED = "My friend plays soccer. I go to school and it is fun.";
    // 중간 표현 줄과 goes→go는 고치고, play→plays만 고치지 않은 답.
    private static final String C_PARTIAL = "My friend play soccer. I go to school and it is fun.";

    private static final FeedbackLanguageCorrectionDto C_L1 = fix("play", "plays");
    private static final FeedbackLanguageCorrectionDto C_L2 = fix("goes", "go");
    private static final FeedbackLanguageCorrectionDto C_L3 =
            fix("i go to school and it is fun", "I go to school and it is fun.");

    // ---------- 모양 D: 교정과 다르게 고쳤지만 문법은 맞는 답 ----------

    private static final String D0_PREVIOUS = "He go to school every day.";
    private static final String D1_FIXED = "He goes to school every day.";
    private static final String D_DIFFERENTLY_FIXED = "He walks to school every day.";

    private static final FeedbackLanguageCorrectionDto D_L1 = fix("go", "goes");

    // ---------- 이번 진단의 교정 단계 ----------

    private static final List<LanguageRevisionStep> NO_STEPS = List.of();

    private static List<LanguageRevisionStep> remaining(LanguageIssueKind kind, String answerAfter) {
        return List.of(new LanguageRevisionStep(kind, answerAfter, "남은 교정 이유"));
    }

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

    private static void assertProductionShape(List<String> steps, List<FeedbackLanguageCorrectionDto> lines) {
        assertThat(lines).hasSize(steps.size() - 1);
        for (int index = 0; index < lines.size(); index++) {
            LanguageRevisionDisplay display = productionDisplay(steps.get(index), steps.get(index + 1));
            assertThat(display.before()).as("before of step " + (index + 1)).isEqualTo(lines.get(index).before());
            assertThat(display.after()).as("after of step " + (index + 1)).isEqualTo(lines.get(index).after());
        }
    }

    // ---------- 실행 틀(FeedbackServicePreviousMissionCountRuleSpecTest와 같은 방식, 진단의 교정 단계만 케이스마다 정함) ----------

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

    private static FeedbackAnalysisSnapshot snapshot(List<LanguageRevisionStep> revisionSteps) {
        Map<String, SlotAssessmentValue> assessments = new LinkedHashMap<>();
        assessments.put("REASON", new SlotAssessmentValue("evidence", SlotAssessmentStatus.SATISFIED));
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                new TopicAssessment(TopicRelevance.ON_TOPIC, "reason"),
                new StructureAssessment(StructureStatus.COMPLETE),
                new LanguageAssessment(new ArrayList<>(revisionSteps))
        );
        MissionDecision decision = new MissionDecision(MissionKind.SLOT, List.of(), List.of(), "DETAIL", assessments, null, null);
        GeneratedSections sections = new GeneratedSections(
                List.of("The main action is clear."), List.of(),
                "I went to the park yesterday because the weather was nice.", "날씨가 좋아서 어제 공원에 갔어요.",
                decision, null
        );
        return new FeedbackAnalysisSnapshot("openai", "test-model", 200, "{}", diagnosis, sections);
    }

    private FeedbackResponseDto storedPreviousFeedback(FeedbackCoachMoveDto coachMove, String revisedAnswer) {
        return new FeedbackResponseDto(
                PROMPT_ID, SESSION_ID, 1, false, null, "summary", List.of("strength"),
                List.of(), List.of(), List.of(),
                revisedAnswer,
                List.of(),
                "model answer", "모범 답안",
                null, null, null,
                coachMove, null, null, null
        );
    }

    // 시도 1(지난 답 previousAnswer, 미션은 주어진 교정 줄의 LANGUAGE_FIX)이 저장된 세션에 시도 2를 내고 지난 미션 결과를 받는다.
    // 앞 피드백의 고친 답(revisedAnswer)은 운영처럼 모두 고친 답이다. 이번 진단의 교정 단계는 revisionSteps다.
    private PreviousMissionResultDto resubmit(
            String previousAnswer,
            String previousRevisedAnswer,
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
                SESSION_ID, 1, AttemptType.INITIAL, previousAnswer, "summary",
                objectMapper.writeValueAsString(
                        storedPreviousFeedback(languageMove(previousCorrections), previousRevisedAnswer)),
                "submission-chained-1", null
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

    private PreviousMissionResultDto resubmitA(
            List<FeedbackLanguageCorrectionDto> lines, String newAnswer, List<LanguageRevisionStep> steps
    ) throws Exception {
        return resubmit(A0_PREVIOUS, A3_ALL_FIXED, lines, newAnswer, steps);
    }

    private PreviousMissionResultDto resubmitB(String newAnswer, List<LanguageRevisionStep> steps) throws Exception {
        return resubmit(B0_PREVIOUS, B2_ALL_FIXED, List.of(B_L1, B_L2), newAnswer, steps);
    }

    private PreviousMissionResultDto resubmitC(String newAnswer, List<LanguageRevisionStep> steps) throws Exception {
        return resubmit(C0_PREVIOUS, C3_ALL_FIXED, List.of(C_L1, C_L2, C_L3), newAnswer, steps);
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

    // ---------- 준비 데이터가 운영 모양인지(이미 있는 동작, 통과가 맞음) ----------

    @Test
    void precondition_fixturesHaveTheProductionShape() {
        assertProductionShape(List.of(A0_PREVIOUS, A1, A2, A3_ALL_FIXED), List.of(A_L1, A_L2, A_L3));
        assertProductionShape(List.of(B0_PREVIOUS, B1, B2_ALL_FIXED), List.of(B_L1, B_L2));
        assertProductionShape(List.of(C0_PREVIOUS, C1, C2, C3_ALL_FIXED), List.of(C_L1, C_L2, C_L3));
        assertProductionShape(List.of(D0_PREVIOUS, D1_FIXED), List.of(D_L1));
    }

    // ---------- 29 규칙 1: 이번 진단에 교정이 없으면 셀 줄 전체를 반영 ----------

    // 새 동작(지금 실패가 맞음): 모양 A 세 줄을 모두 고친 답, 교정 없음 → 3/3. (28 확인용 실행: 지금은 PARTIAL 1/3)
    @Test
    void chainA_allFixed_noCorrectionsLeft_isResolvedThreeOfThree() throws Exception {
        assertLanguageFix(resubmitA(List.of(A_L1, A_L2, A_L3), A3_ALL_FIXED, NO_STEPS),
                "문장 3곳 바로잡기", "RESOLVED", 3, 3, "3곳 모두 반영했어요");
    }

    // 새 동작(지금 실패가 맞음): 모양 A의 앞 두 단계만 있는 미션, 둘 다 고친 답, 교정 없음 → 2/2. (28: 지금은 0/2)
    @Test
    void chainA_twoLineMission_allFixed_noCorrectionsLeft_isResolvedTwoOfTwo() throws Exception {
        assertLanguageFix(resubmitA(List.of(A_L1, A_L2), A2, NO_STEPS),
                "문장 2곳 바로잡기", "RESOLVED", 2, 2, "2곳 모두 반영했어요");
    }

    // 새 동작(지금 실패가 맞음): 모양 B 두 줄을 모두 고친 답, 교정 없음 → 2/2. (28: 지금은 PARTIAL 1/2)
    @Test
    void chainB_allFixed_noCorrectionsLeft_isResolvedTwoOfTwo() throws Exception {
        assertLanguageFix(resubmitB(B2_ALL_FIXED, NO_STEPS),
                "문장 2곳 바로잡기", "RESOLVED", 2, 2, "2곳 모두 반영했어요");
    }

    // 새 동작(지금 실패가 맞음): 교정과 다르게 고쳐(go→goes 대신 walks) 문법은 맞는 답, 교정 없음 → 1곳 반영.
    // 줄별 비교로는 고친 표현 "goes"가 없어 미반영이다.
    @Test
    void differentlyFixed_noCorrectionsLeft_isResolved() throws Exception {
        assertLanguageFix(resubmit(D0_PREVIOUS, D1_FIXED, List.of(D_L1), D_DIFFERENTLY_FIXED, NO_STEPS),
                "문장 한 곳 바로잡기", "RESOLVED", 1, 1, "고친 곳을 반영했어요");
    }

    // 새 동작(지금 실패가 맞음): 종류가 없는 교정 단계(알 수 없는 종류 코드)는 "교정 단계"로 세지 않는다 → 규칙 1.
    @Test
    void stepWithoutKindDoesNotCount_chainB_allFixed_isResolvedTwoOfTwo() throws Exception {
        List<LanguageRevisionStep> unknownKindOnly =
                List.of(new LanguageRevisionStep("NOT_A_KIND", B2_ALL_FIXED, "이유"));
        assertThat(unknownKindOnly.get(0).kind()).isNull();
        assertLanguageFix(resubmitB(B2_ALL_FIXED, unknownKindOnly),
                "문장 2곳 바로잡기", "RESOLVED", 2, 2, "2곳 모두 반영했어요");
    }

    // ---------- 29 규칙 2: 교정이 남아 있으면 줄별로 센다 ----------

    // 새 동작(지금 실패가 맞음): 모양 C에서 goes→go와 중간 표현 줄(i go … fun → I go … fun.)은 고치고 play→plays는 남김.
    // 중간 표현 줄은 지난 답에 고치기 전 표현이 없어 앞 규칙(고친 표현 있음, 고치기 전 표현 없음)으로 반영 → 3곳 중 2곳.
    @Test
    void chainC_partial_correctionsLeft_countsIntermediateLine() throws Exception {
        List<LanguageRevisionStep> left = remaining(LanguageIssueKind.GRAMMAR_LOCAL, C3_ALL_FIXED);
        assertLanguageFix(resubmitC(C_PARTIAL, left),
                "문장 3곳 바로잡기", "PARTIAL", 2, 3, "3곳 중 2곳 반영했어요");
    }

    // 새 동작(지금 실패가 맞음, 31 결정 2): 모양 A에서 L1(yesterday→Yesterday)·L2(Yesterday→Yesterday,)는 고치고 L3는 남김, 교정 남음.
    // L1의 고친 표현 "Yesterday"는 뒤에 쉼표가 붙어도(글자·숫자가 아닌 경계) 센다 → L1·L2 반영, 3곳 중 2곳.
    @Test
    void chainA_partial_correctionsLeft_fixedExpressionFollowedByCommaCounts() throws Exception {
        List<LanguageRevisionStep> left = remaining(LanguageIssueKind.GRAMMAR_LOCAL, A3_ALL_FIXED);
        assertLanguageFix(resubmitA(List.of(A_L1, A_L2, A_L3), A2, left),
                "문장 3곳 바로잡기", "PARTIAL", 2, 3, "3곳 중 2곳 반영했어요");
    }

    // 새 동작(지금 실패가 맞음, 31 결정 2): 모양 A 세 줄을 모두 고쳤지만 답의 다른 곳(새로 쓴 문장)에 교정이 남음 → 줄별로 세어 3/3.
    @Test
    void chainA_allFixed_correctionLeftElsewhere_isResolvedThreeOfThree() throws Exception {
        String answer = A3_ALL_FIXED + " It were great.";
        List<LanguageRevisionStep> left = remaining(LanguageIssueKind.GRAMMAR_LOCAL, A3_ALL_FIXED + " It was great.");
        assertLanguageFix(resubmitA(List.of(A_L1, A_L2, A_L3), answer, left),
                "문장 3곳 바로잡기", "RESOLVED", 3, 3, "3곳 모두 반영했어요");
    }

    // 지금도 결과가 같음(통과가 맞음): 모양 B에서 goes→go만 고치고 i→I·마침표는 남김 → 2곳 중 1곳.
    @Test
    void chainB_partial_correctionsLeft_onlyFixedLineCounts() throws Exception {
        List<LanguageRevisionStep> left = remaining(LanguageIssueKind.GRAMMAR_LOCAL, B2_ALL_FIXED);
        assertLanguageFix(resubmitB(B1, left),
                "문장 2곳 바로잡기", "PARTIAL", 1, 2, "2곳 중 1곳 반영했어요");
    }

    // 이미 있는 동작(통과가 맞음): 모양 A를 고치지 않은 답, 교정 남음 → 미반영.
    @Test
    void chainA_unchanged_correctionsLeft_isUnresolved() throws Exception {
        List<LanguageRevisionStep> left = remaining(LanguageIssueKind.GRAMMAR_LOCAL, A3_ALL_FIXED);
        assertLanguageFix(resubmitA(List.of(A_L1, A_L2, A_L3), A0_PREVIOUS, left),
                "문장 3곳 바로잡기", "UNRESOLVED", 0, 3, "아직 반영되지 않았어요");
    }

    // 이미 있는 동작(통과가 맞음): 모양 B를 고치지 않은 답, 교정 남음 → 미반영.
    @Test
    void chainB_unchanged_correctionsLeft_isUnresolved() throws Exception {
        List<LanguageRevisionStep> left = remaining(LanguageIssueKind.GRAMMAR_LOCAL, B2_ALL_FIXED);
        assertLanguageFix(resubmitB(B0_PREVIOUS, left),
                "문장 2곳 바로잡기", "UNRESOLVED", 0, 2, "아직 반영되지 않았어요");
    }

    // 이미 있는 동작(통과가 맞음): 모양 C를 고치지 않은 답, 교정 남음 → 미반영.
    @Test
    void chainC_unchanged_correctionsLeft_isUnresolved() throws Exception {
        List<LanguageRevisionStep> left = remaining(LanguageIssueKind.GRAMMAR_LOCAL, C3_ALL_FIXED);
        assertLanguageFix(resubmitC(C0_PREVIOUS, left),
                "문장 3곳 바로잡기", "UNRESOLVED", 0, 3, "아직 반영되지 않았어요");
    }

    // 이미 있는 동작(통과가 맞음): STRUCTURE 단계도 "교정이 남음"이다 → 줄별로 세어 미반영.
    @Test
    void structureStepCountsAsCorrectionLeft_chainB_unchanged_isUnresolved() throws Exception {
        List<LanguageRevisionStep> left = remaining(LanguageIssueKind.STRUCTURE, B2_ALL_FIXED);
        assertLanguageFix(resubmitB(B0_PREVIOUS, left),
                "문장 2곳 바로잡기", "UNRESOLVED", 0, 2, "아직 반영되지 않았어요");
    }

    // 이미 있는 동작(통과가 맞음): GRAMMAR_BLOCKING 단계도 "교정이 남음"이다 → 줄별로 세어 미반영.
    @Test
    void blockingStepCountsAsCorrectionLeft_chainB_unchanged_isUnresolved() throws Exception {
        List<LanguageRevisionStep> left = remaining(LanguageIssueKind.GRAMMAR_BLOCKING, B2_ALL_FIXED);
        assertLanguageFix(resubmitB(B0_PREVIOUS, left),
                "문장 2곳 바로잡기", "UNRESOLVED", 0, 2, "아직 반영되지 않았어요");
    }

    // 이미 있는 동작(통과가 맞음): 교정이 남은 다르게 고친 답은 줄별 비교대로 미반영(규칙 1이 교정 없음에만 적용됨).
    @Test
    void differentlyFixed_correctionsLeft_isUnresolved() throws Exception {
        List<LanguageRevisionStep> left = remaining(LanguageIssueKind.GRAMMAR_LOCAL, "He walks to school every day.");
        assertLanguageFix(resubmit(D0_PREVIOUS, D1_FIXED, List.of(D_L1), "He walks to school every day", left),
                "문장 한 곳 바로잡기", "UNRESOLVED", 0, 1, "아직 반영되지 않았어요");
    }

    // ---------- 규칙 1이 05 결정을 바꾸지 않음 ----------

    // 이미 있는 동작(통과가 맞음): 교정 없음이어도, 셀 줄이 없는 미션(고친 표현·고치기 전 표현이 모두 빈 줄)은 붙이지 않는다(05 결정).
    @Test
    void noCorrectionsLeft_butNoCountableLines_isNotAttached() throws Exception {
        assertThat(resubmit(B0_PREVIOUS, B2_ALL_FIXED, List.of(fix(null, null), fix("  ", "")), B2_ALL_FIXED, NO_STEPS))
                .isNull();
    }
}
