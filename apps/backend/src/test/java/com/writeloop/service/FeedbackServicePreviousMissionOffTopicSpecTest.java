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

// qa test-add(38-main-decision.md 1): "이번 진단에 교정이 없으면 모두 반영"(29 결정 1)은 이번 진단의 주제 판정이
// ON_TOPIC일 때만 쓴다. 주제 이탈(OFF_TOPIC)이면 계약상 교정 단계가 늘 없으므로, 줄별로 센다(15·22·29·31 규칙).
// 지난 미션은 LANGUAGE_FIX(교정 줄 2개), 이번 진단의 교정 단계는 두 테스트 모두 없음이다. 다른 것은 주제 판정뿐이다.
// 교정 줄은 운영처럼 FeedbackRevisionDiffSupport가 만드는 모양이다(precondition_fixturesHaveTheProductionShape가 확인).
// 기대값은 38·29 결정과 01 명세의 문구에서만 가져왔다.
class FeedbackServicePreviousMissionOffTopicSpecTest {

    private static final String PROMPT_ID = "prompt-spec-offtopic";
    private static final String SESSION_ID = "session-spec-offtopic";

    private final ObjectMapper objectMapper = new ObjectMapper();

    // ---------- 지난 답과 운영 모양의 교정 줄(37 검증의 P5) ----------

    // 지난 답(시도 1). 시제(go → went)와 끝 마침표가 틀렸다.
    private static final String P0_PREVIOUS = "I go to school yesterday";
    // 교정을 하나씩 적용한 답. 운영은 단계마다 (적용 전 답, 적용 후 답)으로 교정 줄을 만든다.
    private static final String P1 = "I went to school yesterday";
    private static final String P2_ALL_FIXED = "I went to school yesterday.";

    private static final FeedbackLanguageCorrectionDto TENSE_GO = fix("go", "went");
    private static final FeedbackLanguageCorrectionDto PERIOD_YESTERDAY = fix("yesterday", "yesterday.");

    private static final List<FeedbackLanguageCorrectionDto> BOTH_LINES = List.of(TENSE_GO, PERIOD_YESTERDAY);

    // 질문과 상관없는 새 답(37 확실한 문제 1의 예). 교정 줄의 고친 표현(went, yesterday.)이 하나도 없다.
    private static final String OFF_TOPIC_ANSWER = "I like pizza.";
    // 질문(어제 무엇을 했나요?)에 맞게 새로 쓴, 문법이 맞는 답. 교정 줄의 고친 표현(went, yesterday.)이 하나도 없어
    // 줄별로 세면 0곳이다.
    private static final String ON_TOPIC_REWRITTEN_ANSWER = "Yesterday I studied at the library.";

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

    // ---------- 실행 틀(FeedbackServicePreviousMissionCountRuleSpecTest와 같은 방식) ----------

    private PromptDto prompt() {
        return new PromptDto(
                PROMPT_ID, "Daily life", "Daily life", "Routine", "A",
                "What did you do yesterday?", "어제 무엇을 했나요?", "", null,
                new PromptTaskMetaDto("ROUTINE", List.of("ACTION"), List.of("REASON"), "PAST_SIMPLE", "FIRST_PERSON", 0)
        );
    }

    // 이번 피드백(가짜 LLM 응답). 주제 이탈이면 새 미션은 TASK_RESET, 주제에 맞으면 SLOT이다.
    private static FeedbackResponseDto newFeedback(TopicRelevance topic) {
        FeedbackCoachMoveDto move = topic == TopicRelevance.OFF_TOPIC
                ? new FeedbackCoachMoveDto("질문에 맞게 다시 쓰기", "TASK_RESET", "why", null, null, "instruction",
                        null, null, List.of(), null, "ACTION", List.of())
                : new FeedbackCoachMoveDto("이유 붙여보기", "SLOT", "why", null, null, "instruction",
                        null, null, List.of(), null, "REASON", List.of());
        return new FeedbackResponseDto(
                PROMPT_ID, "__CANONICAL_INTERNAL__", 1, false, null,
                "summary",
                List.of("strength"),
                List.of(), List.of(), List.of(),
                "revised",
                List.of(),
                "I went to school yesterday because I had a class.",
                "수업이 있어서 어제 학교에 갔어요.",
                "Add one detail.",
                null, null,
                move,
                null, null, null
        );
    }

    // 이번 진단: 주제 판정은 인자대로, 교정 단계는 없음(OFF_TOPIC은 계약상 교정 단계가 금지다).
    private static FeedbackAnalysisSnapshot snapshot(TopicRelevance topic) {
        Map<String, SlotAssessmentValue> assessments = new LinkedHashMap<>();
        MissionDecision decision;
        if (topic == TopicRelevance.OFF_TOPIC) {
            assessments.put("ACTION", new SlotAssessmentValue("none", SlotAssessmentStatus.MISSING));
            decision = new MissionDecision(MissionKind.TASK_RESET, List.of(), List.of("ACTION"), "ACTION", assessments, null, null);
        } else {
            assessments.put("ACTION", new SlotAssessmentValue("studied at the library", SlotAssessmentStatus.SATISFIED));
            assessments.put("REASON", new SlotAssessmentValue("none", SlotAssessmentStatus.MISSING));
            decision = new MissionDecision(MissionKind.SLOT, List.of("ACTION"), List.of("REASON"), "REASON", assessments, null, null);
        }
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                new TopicAssessment(topic, "reason"),
                new StructureAssessment(StructureStatus.COMPLETE),
                new LanguageAssessment(List.of())
        );
        GeneratedSections sections = new GeneratedSections(
                List.of("strength"), List.of(),
                "I went to school yesterday because I had a class.", "수업이 있어서 어제 학교에 갔어요.",
                decision, null
        );
        return new FeedbackAnalysisSnapshot("openai", "test-model", 200, "{}", diagnosis, sections);
    }

    // 앞 피드백의 고친 답(revisedAnswer)은 운영처럼 모두 고친 답이다. 지난 답은 이것이 아니라 시도 1의 답(P0)이다.
    private FeedbackResponseDto storedPreviousFeedback(FeedbackCoachMoveDto coachMove) {
        return new FeedbackResponseDto(
                PROMPT_ID, SESSION_ID, 1, false, null, "summary", List.of("strength"),
                List.of(), List.of(), List.of(),
                P2_ALL_FIXED,
                List.of(),
                "model answer", "모범 답안",
                null, null, null,
                coachMove, null, null, null
        );
    }

    // 시도 1(지난 답 P0, 미션은 교정 줄 2개의 LANGUAGE_FIX)이 저장된 세션에 시도 2를 내고 지난 미션 결과를 받는다.
    private PreviousMissionResultDto resubmit(String newAnswer, TopicRelevance topic) throws Exception {
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
        FeedbackAnalysisSnapshot snapshot = snapshot(topic);
        AnswerSessionEntity session = new AnswerSessionEntity(SESSION_ID, PROMPT_ID, null, 7L, SessionStatus.IN_PROGRESS);
        AnswerAttemptEntity previous = new AnswerAttemptEntity(
                SESSION_ID, 1, AttemptType.INITIAL, P0_PREVIOUS, "summary",
                objectMapper.writeValueAsString(storedPreviousFeedback(languageMove(BOTH_LINES))),
                "submission-offtopic-1", null
        );

        when(promptService.findById(PROMPT_ID)).thenReturn(prompt);
        when(promptService.findHintsByPromptId(PROMPT_ID)).thenReturn(List.<PromptHintDto>of());
        when(llm.isConfigured()).thenReturn(true);
        when(llm.review(any(PromptDto.class), anyString(), anyList(), anyInt())).thenReturn(newFeedback(topic));
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
            PreviousMissionResultDto actual, String status, int applied, int total, String message
    ) {
        assertThat(actual).isNotNull();
        assertThat(actual.focusType()).isEqualTo("LANGUAGE_FIX");
        assertThat(actual.title()).isEqualTo("문장 2곳 바로잡기");
        assertThat(actual.targetSlot()).isNull();
        assertThat(actual.status()).isEqualTo(status);
        assertThat(actual.appliedCount()).isEqualTo(applied);
        assertThat(actual.totalCount()).isEqualTo(total);
        assertThat(actual.message()).isEqualTo(message);
    }

    // ---------- 준비 데이터가 운영 모양인지(이미 있는 동작, 통과가 맞음) ----------

    @Test
    void precondition_fixturesHaveTheProductionShape() {
        List<String> steps = List.of(P0_PREVIOUS, P1, P2_ALL_FIXED);
        for (int index = 0; index < BOTH_LINES.size(); index++) {
            LanguageRevisionDisplay display = productionDisplay(steps.get(index), steps.get(index + 1));
            assertThat(display.before()).as("before of step " + (index + 1)).isEqualTo(BOTH_LINES.get(index).before());
            assertThat(display.after()).as("after of step " + (index + 1)).isEqualTo(BOTH_LINES.get(index).after());
        }
    }

    // ---------- 38 결정 1 ----------

    // 새 동작(테스트 커밋 시점에 실패가 맞음): 새 답이 주제 이탈(OFF_TOPIC, 교정 단계 없음)이고 교정 줄을 하나도
    // 고치지 않았다. 규칙 1(모두 반영)을 쓰지 않고 줄별로 센다.
    // go → went: 고친 표현 went가 새 답에 없어 미반영. yesterday → yesterday.: 고친 표현 yesterday.가 지난 답 0곳,
    // 새 답 0곳이라 늘지 않아 미반영. 0/2 → UNRESOLVED "아직 반영되지 않았어요".
    @Test
    void offTopic_noCorrections_nothingFixed_isUnresolved() throws Exception {
        assertLanguageFix(resubmit(OFF_TOPIC_ANSWER, TopicRelevance.OFF_TOPIC),
                "UNRESOLVED", 0, 2, "아직 반영되지 않았어요");
    }

    // 이미 있는 동작(통과가 맞음): 같은 지난 미션에서 새 답이 주제에 맞고(ON_TOPIC) 교정 단계가 없다. 교정 줄의
    // 고친 표현은 새 답에 하나도 없지만(줄별로 세면 0/2), 규칙 1로 모두 반영 → RESOLVED 2/2 "2곳 모두 반영했어요".
    @Test
    void onTopic_noCorrections_nothingFixedByLine_isResolved() throws Exception {
        assertLanguageFix(resubmit(ON_TOPIC_REWRITTEN_ANSWER, TopicRelevance.ON_TOPIC),
                "RESOLVED", 2, 2, "2곳 모두 반영했어요");
    }
}
