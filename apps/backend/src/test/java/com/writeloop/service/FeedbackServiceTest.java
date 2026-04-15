package com.writeloop.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.CorrectionDto;
import com.writeloop.dto.CoachExpressionUsageDto;
import com.writeloop.dto.FeedbackRequestDto;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.FeedbackNextStepPracticeDto;
import com.writeloop.dto.FeedbackRewriteSuggestionDto;
import com.writeloop.dto.FeedbackSecondaryLearningPointDto;
import com.writeloop.dto.FeedbackUiDto;
import com.writeloop.dto.GrammarFeedbackItemDto;
import com.writeloop.dto.InlineFeedbackSegmentDto;
import com.writeloop.dto.PromptHintDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptTaskMetaDto;
import com.writeloop.dto.RefinementExampleSource;
import com.writeloop.dto.RefinementExpressionDto;
import com.writeloop.dto.RefinementExpressionSource;
import com.writeloop.persistence.AnswerAttemptEntity;
import com.writeloop.persistence.AnswerAttemptRepository;
import com.writeloop.persistence.AnswerSessionEntity;
import com.writeloop.persistence.AnswerSessionRepository;
import com.writeloop.persistence.AttemptType;
import com.writeloop.persistence.FeedbackDiagnosisLogEntity;
import com.writeloop.persistence.FeedbackDiagnosisLogRepository;
import com.writeloop.persistence.SessionStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FeedbackServiceTest {

    @Mock
    private PromptService promptService;

    @Mock
    private LlmFeedbackClient openAiFeedbackClient;

    @Mock
    private AnswerSessionRepository answerSessionRepository;

    @Mock
    private AnswerAttemptRepository answerAttemptRepository;

    @Mock
    private FeedbackDiagnosisLogRepository feedbackDiagnosisLogRepository;

    private FeedbackService feedbackService;

    @BeforeEach
    void setUp() {
        GeminiFeedbackClient diffHelper = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses", null, 120
        );
        feedbackService = new FeedbackService(
                promptService,
                openAiFeedbackClient,
                answerSessionRepository,
                answerAttemptRepository,
                new ObjectMapper()
        );
        ReflectionTestUtils.setField(feedbackService, "feedbackDiagnosisLogRepository", feedbackDiagnosisLogRepository);

        lenient().when(answerSessionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(answerSessionRepository.countByGuestId(any())).thenReturn(0L);
        lenient().when(answerAttemptRepository.countBySessionId(any())).thenReturn(0);
        lenient().when(answerAttemptRepository.findBySessionIdAndAttemptNo(anyString(), any())).thenReturn(java.util.Optional.empty());
        lenient().when(answerAttemptRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(feedbackDiagnosisLogRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(promptService.findHintsByPromptId(anyString())).thenReturn(List.of());
        lenient().when(openAiFeedbackClient.isAuthoritativeFeedback(any())).thenReturn(false);
        lenient().when(openAiFeedbackClient.clearInternalMetadata(any()))
                .thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(openAiFeedbackClient.buildInlineFeedbackFromCorrectedAnswer(anyString(), anyString()))
                .thenAnswer(invocation -> diffHelper.buildInlineFeedbackFromCorrectedAnswer(
                        invocation.getArgument(0),
                        invocation.getArgument(1)
                ));
        lenient().when(openAiFeedbackClient.buildPreciseInlineFeedback(anyString(), anyString()))
                .thenAnswer(invocation -> diffHelper.buildPreciseInlineFeedback(
                        invocation.getArgument(0),
                        invocation.getArgument(1)
                ));
    }

    private void stubOpenAiReview(FeedbackResponseDto feedback) {
        doReturn(feedback).when(openAiFeedbackClient)
                .review(any(PromptDto.class), anyString(), anyList(), anyInt(), nullable(String.class));
    }

    @Test
    void review_authoritativeLlmFeedback_withoutUi_doesNotComposeFallbackUi() {
        PromptDto prompt = new PromptDto(
                "prompt-authoritative-no-ui",
                "Daily routine",
                "EASY",
                "What do you do on weekday mornings?",
                "평일 아침에 무엇을 하나요?",
                "Mention one or two activities."
        );
        FeedbackRequestDto request = new FeedbackRequestDto(
                prompt.id(),
                null,
                "session-authoritative-no-ui",
                null,
                null
        );
        AnswerSessionEntity session = new AnswerSessionEntity(
                "session-authoritative-no-ui",
                prompt.id(),
                null,
                7L,
                SessionStatus.IN_PROGRESS
        );
        FeedbackResponseDto llmFeedback = new FeedbackResponseDto(
                prompt.id(),
                GeminiFeedbackClient.INTERNAL_AUTHORITATIVE_SESSION_ID,
                1,
                88,
                false,
                null,
                null,
                List.of("핵심 루틴은 잘 말했어요."),
                List.of(),
                List.of(),
                List.of(),
                null,
                List.of(),
                "I wake up early and usually drink coffee before work.",
                null,
                null,
                List.of(),
                null
        );

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(answerSessionRepository.findById("session-authoritative-no-ui")).thenReturn(java.util.Optional.of(session));
        when(openAiFeedbackClient.isAuthoritativeFeedback(llmFeedback)).thenReturn(true);
        when(openAiFeedbackClient.clearInternalMetadata(llmFeedback)).thenReturn(llmFeedback);
        when(openAiFeedbackClient.takeLastAnalysisSnapshot()).thenReturn(null);
        stubOpenAiReview(llmFeedback);

        FeedbackResponseDto response = feedbackService.review(request, 7L);

        assertThat(response.ui()).isNull();
        assertThat(response.correctedAnswer()).isNull();
        assertThat(response.inlineFeedback()).isEmpty();
    }

    @Test
    void review_authoritativeLlmFeedback_preservesLlmUiWhenPresent() {
        PromptDto prompt = new PromptDto(
                "prompt-authoritative-ui",
                "Daily routine",
                "EASY",
                "What do you do on weekday mornings?",
                "평일 아침에 무엇을 하나요?",
                "Mention one or two activities."
        );
        FeedbackRequestDto request = new FeedbackRequestDto(
                prompt.id(),
                "I wake up early and drink coffee.",
                "session-authoritative-ui",
                null,
                null
        );
        AnswerSessionEntity session = new AnswerSessionEntity(
                "session-authoritative-ui",
                prompt.id(),
                null,
                7L,
                SessionStatus.IN_PROGRESS
        );
        FeedbackUiDto llmUi = new FeedbackUiDto(
                null,
                null,
                null,
                List.of(),
                List.of(new FeedbackSecondaryLearningPointDto(
                        "GRAMMAR",
                        "시제 맞추기",
                        "drink coffee",
                        "아침 루틴은 보통 현재 시제로 말해요.",
                        "drink coffee",
                        "drink coffee",
                        null,
                        null,
                        null,
                        null
                )),
                new FeedbackNextStepPracticeDto(
                        "CORRECTION",
                        "추가하면 좋을 점",
                        "I usually drink coffee before work.",
                        "한 문장만 더 붙여서 루틴을 자연스럽게 이어 보세요.",
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        "이 문장으로 다시 써보기",
                        true
                ),
                List.of(new FeedbackRewriteSuggestionDto(
                        "before work",
                        "출근 전에",
                        null
                )),
                null,
                null
        );
        FeedbackResponseDto llmFeedback = new FeedbackResponseDto(
                prompt.id(),
                GeminiFeedbackClient.INTERNAL_AUTHORITATIVE_SESSION_ID,
                1,
                88,
                false,
                null,
                null,
                List.of("핵심 루틴은 잘 말했어요."),
                List.of(),
                List.of(),
                List.of(),
                "I wake up early and drink coffee.",
                List.of(),
                "I wake up early and usually drink coffee before work.",
                null,
                null,
                List.of(),
                llmUi
        );

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(answerSessionRepository.findById("session-authoritative-ui")).thenReturn(java.util.Optional.of(session));
        when(openAiFeedbackClient.isAuthoritativeFeedback(llmFeedback)).thenReturn(true);
        when(openAiFeedbackClient.clearInternalMetadata(llmFeedback)).thenReturn(llmFeedback);
        when(openAiFeedbackClient.takeLastAnalysisSnapshot()).thenReturn(null);
        stubOpenAiReview(llmFeedback);

        FeedbackResponseDto response = feedbackService.review(request, 7L);

        assertThat(response.ui()).isNotNull();
        assertThat(response.ui().screenPolicy()).isNull();
        assertThat(response.ui().loopStatus()).isNull();
        assertThat(response.ui().fixPoints())
                .extracting(
                        FeedbackSecondaryLearningPointDto::kind,
                        FeedbackSecondaryLearningPointDto::title,
                        FeedbackSecondaryLearningPointDto::headline
                )
                .containsExactly(tuple("GRAMMAR", "시제 맞추기", "drink coffee"));
        assertThat(response.ui().nextStepPractice()).isNotNull();
        assertThat(response.ui().nextStepPractice().headline())
                .isEqualTo("I usually drink coffee before work.");
        assertThat(response.ui().rewriteSuggestions())
                .extracting(FeedbackRewriteSuggestionDto::english)
                .containsExactly("before work");
    }

    @Test
    void review_saves_feedback_diagnosis_log_with_final_diagnosis_snapshot() {
        PromptDto prompt = new PromptDto(
                "prompt-diagnosis-log",
                "Daily routine",
                "EASY",
                "Describe your routine for your weekday mornings.",
                "?됱씪 ?꾩묠 猷⑦떞???ㅻ챸??二쇱꽭??",
                "Mention one or two activities."
        );
        FeedbackRequestDto request = new FeedbackRequestDto(
                prompt.id(),
                "I wake up at 8am and check the stock market.",
                "session-diagnosis-log",
                null,
                null
        );
        AnswerSessionEntity session = new AnswerSessionEntity(
                "session-diagnosis-log",
                prompt.id(),
                null,
                7L,
                SessionStatus.IN_PROGRESS
        );
        FeedbackResponseDto llmFeedback = new FeedbackResponseDto(
                prompt.id(),
                GeminiFeedbackClient.INTERNAL_AUTHORITATIVE_SESSION_ID,
                1,
                84,
                false,
                null,
                "?꾩묠 ?쒕룞 ?먮쫫??蹂댁엯?덈떎.",
                List.of("?쒓컙 ?먮쫫???먯뿰?ㅻ읇?듬땲??"),
                List.of(new CorrectionDto("check the stock market ?쒗쁽?????먯뿰?ㅻ읇寃??ㅻ벉??蹂댁꽭??", "?? check stock prices泥섎읆 ???먯뿰?ㅻ윭???쒗쁽?쇰줈 諛붽퓭 蹂댁꽭??")),
                List.of(),
                List.of(),
                "I wake up at 8 a.m. and check stock prices.",
                List.of(),
                "I wake up at 8 a.m. and check stock prices before breakfast.",
                null,
                "\"I wake up at 8 a.m. and check _____.\" 鍮덉뭏???ㅼ젣 ?됰룞???ｌ뼱 ?ㅼ떆 ??蹂댁꽭??",
                List.of()
        );
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                84,
                AnswerBand.SHORT_BUT_VALID,
                TaskCompletion.FULL,
                true,
                false,
                GrammarSeverity.MINOR,
                List.of(new DiagnosedGrammarIssue(
                        "LOCAL_USAGE",
                        "check the stock market",
                        "check stock prices",
                        "???먯뿰?ㅻ윭???쒗쁽?쇰줈 怨좎튌 ???덉뼱??",
                        false,
                        GrammarSeverity.MINOR
                )),
                "I wake up at 8 a.m. and check stock prices.",
                "FIX_LOCAL_GRAMMAR",
                "ADD_DETAIL",
                new RewriteTarget("ADD_DETAIL", "I wake up at 8 a.m. and check _____.", 1),
                ExpansionBudget.ONE_DETAIL,
                List.of("wake up at 8am", "check the stock market")
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.SHORT_BUT_VALID, false),
                new GrammarProfile(
                        GrammarSeverity.MINOR,
                        List.of(new GrammarIssue(
                                "LOCAL_USAGE",
                                "check the stock market",
                                "check stock prices",
                                false,
                                GrammarSeverity.MINOR
                        )),
                        "I wake up at 8 a.m. and check stock prices.",
                        true
                ),
                new ContentProfile(
                        ContentLevel.MEDIUM,
                        new ContentSignals(true, false, false, false, true, true),
                        List.of()
                ),
                new RewriteProfile(
                        "FIX_LOCAL_GRAMMAR",
                        "ADD_DETAIL",
                        new RewriteTarget("ADD_DETAIL", "I wake up at 8 a.m. and check _____.", 1),
                        ExpansionBudget.ONE_DETAIL,
                        List.of("wake up at 8am", "check the stock market"),
                        new ProgressDelta(List.of(), List.of("add one more morning detail"))
                )
        );
        SectionPolicy sectionPolicy = new SectionPolicy(
                true, 2,
                true, 1,
                true,
                true, 2,
                RefinementFocus.DETAIL_BUILDING,
                true,
                true,
                true,
                2,
                ModelAnswerMode.ONE_STEP_UP,
                AttemptOverlayPolicy.NONE
        );
        GeneratedSections finalSections = new GeneratedSections(
                "?꾩묠 ?쒕룞 ?먮쫫??蹂댁엯?덈떎.",
                List.of("?쒓컙 ?먮쫫???먯뿰?ㅻ읇?듬땲??"),
                List.of(),
                List.of(new CorrectionDto("check the stock market ?쒗쁽?????먯뿰?ㅻ읇寃??ㅻ벉??蹂댁꽭??", "?? check stock prices泥섎읆 ???먯뿰?ㅻ윭???쒗쁽?쇰줈 諛붽퓭 蹂댁꽭??")),
                List.of(),
                "\"I wake up at 8 a.m. and check _____.\" 鍮덉뭏???ㅼ젣 ?됰룞???ｌ뼱 ?ㅼ떆 ??蹂댁꽭??",
                "I wake up at 8 a.m. and check stock prices before breakfast.",
                null,
                List.of()
        );
        FeedbackAnalysisSnapshot analysisSnapshot = new FeedbackAnalysisSnapshot(
                "GEMINI",
                "gemini-2.5-flash",
                200,
                200,
                200,
                "{\"diag\":true}",
                "{\"gen\":true}",
                "{\"regen\":true}",
                diagnosis,
                answerProfile,
                sectionPolicy,
                finalSections,
                false,
                false,
                true
        );

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(answerSessionRepository.findById("session-diagnosis-log")).thenReturn(java.util.Optional.of(session));
        when(openAiFeedbackClient.isAuthoritativeFeedback(llmFeedback)).thenReturn(true);
        when(openAiFeedbackClient.clearInternalMetadata(llmFeedback)).thenReturn(llmFeedback);
        when(openAiFeedbackClient.takeLastAnalysisSnapshot()).thenReturn(analysisSnapshot);
        stubOpenAiReview(llmFeedback);

        feedbackService.review(request, 7L);

        ArgumentCaptor<FeedbackDiagnosisLogEntity> logCaptor = ArgumentCaptor.forClass(FeedbackDiagnosisLogEntity.class);
        verify(feedbackDiagnosisLogRepository).save(logCaptor.capture());
        FeedbackDiagnosisLogEntity saved = logCaptor.getValue();

        assertThat(saved.getSessionId()).isEqualTo("session-diagnosis-log");
        assertThat(saved.getPromptId()).isEqualTo(prompt.id());
        assertThat(saved.getLlmProvider()).isEqualTo("GEMINI");
        assertThat(saved.getLlmModel()).isEqualTo("gemini-2.5-flash");
        assertThat(saved.getDiagnosisResponseStatusCode()).isEqualTo(200);
        assertThat(saved.getGenerationResponseStatusCode()).isEqualTo(200);
        assertThat(saved.getRegenerationResponseStatusCode()).isEqualTo(200);
        assertThat(saved.getDiagnosisResponseBodyJson()).isEqualTo("{\"diag\":true}");
        assertThat(saved.getGenerationResponseBodyJson()).isEqualTo("{\"gen\":true}");
        assertThat(saved.getRegenerationResponseBodyJson()).isEqualTo("{\"regen\":true}");
        assertThat(saved.getDiagnosisAnswerBand()).isEqualTo("SHORT_BUT_VALID");
        assertThat(saved.getDiagnosisPrimaryIssueCode()).isEqualTo("FIX_LOCAL_GRAMMAR");
        assertThat(saved.getRewriteTargetAction()).isEqualTo("ADD_DETAIL");
        assertThat(saved.getRewriteTargetSkeleton()).isEqualTo("I wake up at 8 a.m. and check _____.");
        assertThat(saved.getProfileContentSpecificity()).isEqualTo("MEDIUM");
        assertThat(saved.getDiagnosisPayloadJson()).contains("\"answerBand\":\"SHORT_BUT_VALID\"");
        assertThat(saved.getAnswerProfileJson()).contains("\"primaryIssueCode\":\"FIX_LOCAL_GRAMMAR\"");
        assertThat(saved.getSectionPolicyJson()).contains("\"showRewriteGuide\":true");
        assertThat(saved.getFinalSectionsJson()).contains("\"rewriteGuide\":\"\\\"I wake up at 8 a.m. and check _____.\\\"");
    }

    @Test
    void review_truncates_overlong_rewrite_target_action_before_saving_diagnosis_log() {
        PromptDto prompt = new PromptDto(
                "prompt-diagnosis-log-overlong",
                "Daily routine",
                "EASY",
                "Describe your routine for your weekday mornings.",
                "吏덈Ц",
                "Mention one or two activities."
        );
        FeedbackRequestDto request = new FeedbackRequestDto(
                prompt.id(),
                "I wake up and commute.",
                "session-diagnosis-log-overlong",
                null,
                null
        );
        AnswerSessionEntity session = new AnswerSessionEntity(
                "session-diagnosis-log-overlong",
                prompt.id(),
                null,
                7L,
                SessionStatus.IN_PROGRESS
        );
        String overlongAction = "ADD_REASON_" + "X".repeat(300);
        FeedbackResponseDto llmFeedback = new FeedbackResponseDto(
                prompt.id(),
                GeminiFeedbackClient.INTERNAL_AUTHORITATIVE_SESSION_ID,
                1,
                80,
                false,
                null,
                "?붿빟",
                List.of("媛뺤젏"),
                List.of(),
                List.of(),
                List.of(),
                "I wake up and prepare for my commute.",
                List.of(),
                null,
                null,
                null,
                List.of()
        );
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                80,
                AnswerBand.CONTENT_THIN,
                TaskCompletion.PARTIAL,
                true,
                false,
                GrammarSeverity.MINOR,
                List.of(),
                "I wake up and prepare for my commute.",
                "ADD_REASON",
                null,
                new RewriteTarget(overlongAction, "I wake up and prepare for my commute because ______.", 1),
                ExpansionBudget.ONE_DETAIL,
                List.of("wake up", "commute")
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.PARTIAL, AnswerBand.CONTENT_THIN, false),
                new GrammarProfile(GrammarSeverity.MINOR, List.of(), "I wake up and prepare for my commute.", true),
                new ContentProfile(ContentLevel.MEDIUM, new ContentSignals(true, false, false, false, true, true), List.of()),
                new RewriteProfile(
                        "ADD_REASON",
                        null,
                        new RewriteTarget(overlongAction, "I wake up and prepare for my commute because ______.", 1),
                        ExpansionBudget.ONE_DETAIL,
                        List.of("wake up", "commute"),
                        new ProgressDelta(List.of(), List.of("add one reason"))
                )
        );
        FeedbackAnalysisSnapshot analysisSnapshot = new FeedbackAnalysisSnapshot(
                "GEMINI",
                "gemini-2.5-flash",
                200,
                200,
                null,
                "{\"diag\":true}",
                "{\"gen\":true}",
                null,
                diagnosis,
                answerProfile,
                null,
                null,
                false,
                false,
                false
        );

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(answerSessionRepository.findById("session-diagnosis-log-overlong")).thenReturn(java.util.Optional.of(session));
        when(openAiFeedbackClient.isAuthoritativeFeedback(llmFeedback)).thenReturn(true);
        when(openAiFeedbackClient.clearInternalMetadata(llmFeedback)).thenReturn(llmFeedback);
        when(openAiFeedbackClient.takeLastAnalysisSnapshot()).thenReturn(analysisSnapshot);
        stubOpenAiReview(llmFeedback);

        feedbackService.review(request, 7L);

        ArgumentCaptor<FeedbackDiagnosisLogEntity> logCaptor = ArgumentCaptor.forClass(FeedbackDiagnosisLogEntity.class);
        verify(feedbackDiagnosisLogRepository).save(logCaptor.capture());
        FeedbackDiagnosisLogEntity saved = logCaptor.getValue();

        assertThat(saved.getRewriteTargetAction()).hasSize(255);
        assertThat(saved.getRewriteTargetAction()).startsWith("ADD_REASON_");
    }

    @Test
    void review_rewrite_challenge_uses_profile_when_reason_is_missing() {
        PromptDto prompt = new PromptDto(
                "prompt-a-4",
                "Food",
                "EASY",
                "What food do you like, and why?",
                "?대뼡 ?뚯떇??醫뗭븘?섍퀬 ??醫뗭븘?섎뒗吏 留먰빐 蹂댁꽭??",
                "Give one reason."
        );
        String answer = "I like pizza.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(false);

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.rewriteChallenge())
                .contains("이유")
                .doesNotContain("3~4문장");
    }

    @Test
    void buildRewriteChallenge_forGrammarBlocking_prefersMinimalCorrection_over_raw_fallback() {
        PromptDto prompt = new PromptDto(
                "prompt-b-1",
                "Problem Solving - Work Challenge",
                "B",
                "What is one challenge you often face at work or school, and how do you deal with it?",
                "吏덈Ц",
                null
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.GRAMMAR_BLOCKING),
                new GrammarProfile(
                        GrammarSeverity.MAJOR,
                        List.of(new GrammarIssue("SUBJECT_VERB_AGREEMENT", "meet the deadline", "to meet deadlines", true, GrammarSeverity.MAJOR)),
                        "I often struggle to meet deadlines. To solve this, I write a to-do list."
                ),
                new ContentProfile(
                        ContentLevel.MEDIUM,
                        new ContentSignals(true, false, false, false, true, false),
                        List.of()
                ),
                new RewriteProfile(
                        "FIX_BLOCKING_GRAMMAR",
                        null,
                        new RewriteTarget("FIX_BLOCKING_GRAMMAR", "I often struggle to meet deadlines. To solve this, I write a to-do list.", 0),
                        null
                )
        );

        String rewriteChallenge = ReflectionTestUtils.invokeMethod(
                feedbackService,
                "buildRewriteChallenge",
                prompt,
                answerProfile,
                "Hint: I often struggle with meet the deadline, to address I try to stay on track by write a to-do list.",
                "One challenge I face is meeting deadlines. To solve this, I write a to-do list."
        );

        assertThat(rewriteChallenge)
                .contains("I often struggle to meet deadlines")
                .doesNotContain("I often struggle with meet the deadline");
    }

    @Test
    void saveAttempt_uses_fallback_summary_when_section_policy_hides_summary() {
        AnswerSessionEntity session = new AnswerSessionEntity(
                "session-1",
                "prompt-rtn-1",
                "guest-test-identity-0001",
                null,
                SessionStatus.IN_PROGRESS
        );
        FeedbackResponseDto feedback = new FeedbackResponseDto(
                "prompt-rtn-1",
                "session-1",
                2,
                91,
                false,
                null,
                null,
                List.of("臾몄젣? ?닿껐 諛⑸쾿???④퍡 留먰븳 ?먯씠 醫뗭븘??"),
                List.of(new CorrectionDto("??諛⑸쾿???대뼸寃??꾩????섎뒗吏 ??媛吏 ???㏓텤??蹂댁꽭??", "?④낵瑜???臾몄옣 ????蹂댁꽭??")),
                List.of(),
                List.of(),
                "I usually start my Saturday with a walk.",
                List.of(),
                null,
                null,
                null,
                List.of()
        );

        reset(answerAttemptRepository);
        when(answerAttemptRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        ReflectionTestUtils.invokeMethod(
                feedbackService,
                "saveAttempt",
                session,
                AttemptType.REWRITE,
                2,
                "I usually start my Saturday with a walk.",
                feedback
        );

        ArgumentCaptor<AnswerAttemptEntity> captor = ArgumentCaptor.forClass(AnswerAttemptEntity.class);
        verify(answerAttemptRepository).save(captor.capture());

        AnswerAttemptEntity saved = captor.getValue();
        assertThat(saved.getFeedbackSummary()).isEqualTo("臾몄젣? ?닿껐 諛⑸쾿???④퍡 留먰븳 ?먯씠 醫뗭븘?? ??諛⑸쾿???대뼸寃??꾩????섎뒗吏 ??媛吏 ???㏓텤??蹂댁꽭??");
        assertThat(saved.getModelAnswer()).isEqualTo("I usually start my Saturday with a walk.");
        assertThat(saved.getRewriteChallenge()).isNotBlank();
    }

    @Test
    void review_applies_grammar_blocking_policy_to_broken_solution_answer() {
        PromptDto prompt = new PromptDto(
                "prompt-b-1",
                "Problem Solving - Work Challenge",
                "Problem Solving",
                "Work Challenge",
                "B",
                "What is one challenge you often face at work or school, and how do you deal with it?",
                "吏덈Ц",
                null,
                null,
                new PromptTaskMetaDto("PROBLEM_SOLUTION", List.of("MAIN_ANSWER", "ACTIVITY"), List.of("REASON"))
        );
        String answer = "I often struggle with meet the deadline, to address I try to stay on track by write a to-do list.";
        String correctedAnswer = "I often struggle to meet deadlines, so I try to stay on track by writing a to-do list.";
        String modelAnswer = correctedAnswer + " This helps me organize my tasks better.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                75,
                false,
                null,
                "summary",
                List.of("\"" + answer + "\" shows your idea clearly."),
                List.of(new CorrectionDto("Add more detail.", "Explain the method and result more clearly.")),
                List.of(),
                List.of(),
                correctedAnswer,
                List.of(),
                modelAnswer,
                null,
                "Hint: " + answer,
                List.of(
                        new CoachExpressionUsageDto("stay on track", true, "SELF_DISCOVERED", null, "SELF_DISCOVERED", "Useful chunk."),
                        new CoachExpressionUsageDto("I often struggle with meet the deadline", true, "SELF_DISCOVERED", null, "SELF_DISCOVERED", "Broken span.")
                )
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.strengths()).allSatisfy(strength -> {
            assertThat(strength).doesNotContain(answer);
        });
        assertThat(response.strengths()).isNotEmpty();
        assertThat(response.grammarFeedback()).isNotEmpty();
        assertThat(response.grammarFeedback().get(0).originalText()).isEqualTo(answer);
        assertThat(response.grammarFeedback().get(0).revisedText())
                .contains("I often struggle to meet")
                .contains("writing a to-do list")
                .doesNotContain("with meet");
        assertThat(response.rewriteChallenge())
                .isNotBlank()
                .contains("I often struggle to meet")
                .doesNotContain(answer);
        assertThat(response.usedExpressions())
                .extracting(CoachExpressionUsageDto::expression)
                .contains("stay on track")
                .doesNotContain("I often struggle with meet the deadline");
    }

    @Test
    void review_aligns_minor_correction_and_content_expansion_for_health_goal_answer() {
        PromptDto prompt = new PromptDto(
                "prompt-goal-12",
                "Goal Plan - Health Goal",
                "Goal Plan",
                "Health Goal",
                "B",
                "Explain one health goal you want to reach this year and why it matters to you.",
                "?ы빐 ?대（怨??띠? 嫄닿컯 紐⑺몴 ?섎굹? 洹멸쾬????以묒슂?쒖? ?ㅻ챸??二쇱꽭??",
                null,
                null,
                new PromptTaskMetaDto("GOAL_PLAN", List.of("MAIN_ANSWER", "REASON"), List.of("ACTIVITY", "TIME_OR_PLACE"))
        );
        String answer = "One health goal I have this is to diet. It's important for me to stay healthy.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                79,
                false,
                null,
                "Add one more reason or method.",
                List.of("\"" + answer + "\" clearly states your goal."),
                List.of(
                        new CorrectionDto("Add one more reason.", "Explain why this matters a little more."),
                        new CorrectionDto("Add one concrete habit.", "Write one habit you want to follow for this goal.")
                ),
                List.of(),
                List.of(new GrammarFeedbackItemDto(
                        "One health goal I have this is to diet",
                        "One health goal I have this year is to diet",
                        "Make this phrase more natural."
                )),
                "One health goal I have this year is to diet. It's important for me to stay healthy.",
                List.of(
                        new RefinementExpressionDto("One challenge I often face is...", "Use this to introduce a problem.", "One challenge I often face is managing my schedule."),
                        new RefinementExpressionDto("As a result", "Use this to explain a result.", "As a result, I feel more organized."),
                        new RefinementExpressionDto("improve my diet", "Use this to talk about your eating habits.", "I want to improve my diet this year."),
                        new RefinementExpressionDto("It matters to me because ...", "Use this to explain why the goal is important.", "It matters to me because I want to stay healthy.")
                ),
                "One of my health goals this year is to lose weight. I exercise every weekend and stick to a healthy diet.",
                null,
                "One health goal I have this is to diet because ...",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.correctedAnswer())
                .contains("this year")
                .contains("It's important to me because I want to stay healthy.")
                .doesNotContain("I have this is to")
                .doesNotContain("to diet");
        assertThat(response.correctedAnswer())
                .matches(text -> text.contains("eat healthier") || text.contains("improve my diet"));
        assertThat(response.strengths()).hasSize(1);
        assertThat(response.strengths().get(0)).doesNotContain(answer);
        assertThat(response.corrections()).hasSize(1);
        assertThat(response.corrections().get(0).suggestion())
                .contains("이유");
        assertThat(response.rewriteChallenge())
                .contains("this year")
                .contains("It's important to me because I want to stay healthy.")
                .doesNotContain("I have this is to diet because");
        assertThat(response.modelAnswer()).doesNotContain("lose weight");
        assertThat(response.modelAnswer()).doesNotContain("exercise every weekend");
        if (response.modelAnswer() != null) {
            assertThat(response.modelAnswer()).startsWith(response.correctedAnswer());
            assertThat(response.modelAnswer()).isNotEqualTo(answer);
        }
    }

    @Test
    void review_does_not_repeat_existing_benefit_sentence_in_model_answer() {
        PromptDto prompt = new PromptDto(
                "prompt-goal-13",
                "Goal Plan - Health Goal",
                "Goal Plan",
                "Health Goal",
                "B",
                "Explain one health goal you want to reach this year and why it matters to you.",
                null,
                null,
                null,
                new PromptTaskMetaDto("GOAL_PLAN", List.of("MAIN_ANSWER", "REASON"), List.of("ACTIVITY", "TIME_OR_PLACE"))
        );
        String answer = "I work out regularly by going to gym every day to stay healthy. This helps me feel more energetic";
        String correctedAnswer = "I work out regularly by going to the gym every day to stay healthy. This helps me feel more energetic.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                86,
                false,
                null,
                "Add one more concrete detail.",
                List.of("\"" + answer + "\" explains your goal."),
                List.of(new CorrectionDto("Add one more detail.", "Add one more concrete benefit or habit.")),
                List.of(),
                List.of(new GrammarFeedbackItemDto(
                        "going to gym",
                        "going to the gym",
                        "Add the article to make the phrase natural."
                )),
                correctedAnswer,
                List.of(),
                null,
                null,
                "Use the corrected sentence and add one more detail.",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        if (response.modelAnswer() != null) {
            assertThat(response.modelAnswer()).startsWith(correctedAnswer);
            assertThat(response.modelAnswer())
                    .doesNotContain("This helps me feel more energetic. This helps me feel more energetic.");
        }
    }

    @Test
    @org.junit.jupiter.api.Disabled("Legacy refinement expectation predates placeholder-drop contract.")
    void review_filters_refinement_expressions_already_used_in_answer_or_corrected_answer() {
        PromptDto prompt = new PromptDto(
                "prompt-c-2",
                "Society",
                "HARD",
                "What kind of social responsibility should successful companies have in modern society?",
                "?꾨? ?ы쉶?먯꽌 ?깃났??湲곗뾽???대뼡 ?ы쉶??梨낆엫??媛?몄빞 ?섎뒗吏 ?ㅻ챸??二쇱꽭??",
                "援ъ껜?곸씤 ?щ?? 湲곗????④퍡 ?쒖떆?섎㈃ ???ㅻ뱷???덉뼱吏묐땲??"
        );
        String answer = "Successful companies should take responsibility for caring marginalized groups.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                90,
                false,
                null,
                "?붿빟",
                List.of("媛뺤젏"),
                List.of(new CorrectionDto("?꾩튂??蹂댁셿", "'for'瑜??ｌ뼱 蹂댁꽭??")),
                List.of(),
                "Successful companies should take responsibility for caring for marginalized groups.",
                List.of(
                        new RefinementExpressionDto(
                                "take responsibility for",
                                "?대? ???쒗쁽",
                                "take responsibility for supporting communities"
                        ),
                        new RefinementExpressionDto(
                                "caring for marginalized groups",
                                "援먯젙臾몄뿉 ?대? 諛섏쁺???쒗쁽",
                                "caring for marginalized groups by providing support"
                        ),
                        new RefinementExpressionDto(
                                "by providing support and opportunities",
                                "?ㅼ쓬 ?듬??먯꽌 ?뷀빐蹂??쒗쁽",
                                "by providing support and opportunities"
                        )
                ),
                "Successful companies should take responsibility for caring for marginalized groups by providing support and opportunities.",
                "?ㅼ떆 ??蹂댁꽭??"
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.refinementExpressions())
                .extracting(RefinementExpressionDto::expression)
                .contains("by [verb]ing [method]")
                .doesNotContain("take responsibility for", "caring for marginalized groups");
    }

    @Test
    @org.junit.jupiter.api.Disabled("Current fallback-only correction policy keeps the OpenAI correction instead of adding a second local correction.")
    void review_keeps_openai_correction_when_inline_feedback_has_additional_local_edit() {
        PromptDto prompt = new PromptDto(
                "prompt-a-4",
                "Food",
                "EASY",
                "What food do you like, and why?",
                "?대뼡 ?뚯떇??醫뗭븘?섍퀬 ??醫뗭븘?섎뒗吏 留먰빐 蹂댁꽭??",
                "Give one reason."
        );
        String answer = "I like pizza and chicken because it is delicious.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                84,
                false,
                null,
                "?붿빟",
                List.of("媛뺤젏"),
                List.of(new CorrectionDto(
                        "'Because it is delicious and versatile.'?쇰뒗 臾몄옣??異⑸텇???곌껐???꾩슂?⑸땲??",
                        "臾몄옣???곌껐?섏뿬 ?먯뿰?ㅻ읇寃?留뚮뱶?몄슂."
                )),
                List.of(
                        new InlineFeedbackSegmentDto("KEEP", "I like pizza and chicken because ", "I like pizza and chicken because "),
                        new InlineFeedbackSegmentDto("REPLACE", "it is", "they are"),
                        new InlineFeedbackSegmentDto("KEEP", " delicious.", " delicious.")
                ),
                "I like pizza and chicken because they are delicious.",
                List.of(),
                "I like pizza and chicken because they are delicious and versatile.",
                "?ㅼ떆 ??蹂댁꽭??"
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.corrections())
                .extracting(CorrectionDto::issue)
                .anySatisfy(issue -> assertThat(issue).contains("they are"));
        assertThat(response.corrections())
                .extracting(CorrectionDto::suggestion)
                .anySatisfy(suggestion -> assertThat(suggestion).contains("?紐낆궗? be?숈궗"));
    }

    @Test
    @org.junit.jupiter.api.Disabled("Grammar-only corrections are now filtered into grammarFeedback.")
    void review_does_not_add_supplemental_correction_when_openai_correction_exists() {
        PromptDto prompt = new PromptDto(
                "prompt-a-4",
                "Food",
                "EASY",
                "What food do you like, and why?",
                "?대뼡 ?뚯떇??醫뗭븘?섍퀬 ??醫뗭븘?섎뒗吏 留먰빐 蹂댁꽭??",
                "Give one reason."
        );
        String answer = "I like pizza and chicken because it is delicious.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                84,
                false,
                null,
                "?붿빟",
                List.of("媛뺤젏"),
                List.of(new CorrectionDto(
                        "'Because it is delicious and versatile.'?쇰뒗 臾몄옣??異⑸텇???곌껐???꾩슂?⑸땲??",
                        "臾몄옣????踰덉뿉 ?댁뼱????留ㅻ걚?쎄쾶 留뚮뱾??蹂댁꽭??"
                )),
                List.of(
                        new InlineFeedbackSegmentDto("KEEP", "I like pizza and chicken because ", "I like pizza and chicken because "),
                        new InlineFeedbackSegmentDto("REPLACE", "it is", "they are"),
                        new InlineFeedbackSegmentDto("KEEP", " delicious.", " delicious.")
                ),
                "I like pizza and chicken because they are delicious.",
                List.of(),
                "I like pizza and chicken because they are delicious and versatile.",
                "?ㅼ떆 ??蹂댁꽭??"
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.corrections())
                .extracting(CorrectionDto::issue)
                .containsExactly("'Because it is delicious and versatile.'?쇰뒗 臾몄옣??異⑸텇???곌껐???꾩슂?⑸땲??");
        assertThat(response.corrections())
                .extracting(CorrectionDto::suggestion)
                .containsExactly("臾몄옣????踰덉뿉 ?댁뼱????留ㅻ걚?쎄쾶 留뚮뱾??蹂댁꽭??");
    }

    @Test
    void review_extracts_used_expressions_even_without_coach_usage() {
        PromptDto prompt = new PromptDto(
                "prompt-a-2",
                "Weekend",
                "EASY",
                "What do you usually do on weekends?",
                "二쇰쭚??蹂댄넻 臾댁뾿???섎굹??",
                "Mention one or two activities."
        );
        String answer = "On weekends, I work out and spend time with my family at the park.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                90,
                false,
                null,
                "?붿빟",
                List.of("媛뺤젏"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                answer,
                List.of(),
                answer,
                "?ㅼ떆 ?⑤낫?몄슂."
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.usedExpressions())
                .extracting(CoachExpressionUsageDto::expression)
                .contains("work out", "spend time with my family at the park");
    }

    @Test
    void review_preserves_openai_used_expressions_and_drops_duplicate_matched_text() {
        PromptDto prompt = new PromptDto(
                "prompt-b-5",
                "Goal",
                "B",
                "What is one goal you have this year?",
                "?ы빐 媛吏?紐⑺몴 ??媛吏瑜?留먰빐 蹂댁꽭??",
                "Use one sentence."
        );
        String answer = "I want to speak English fluently because it is important for my job.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                90,
                false,
                null,
                "?붿빟",
                List.of("媛뺤젏"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                answer,
                List.of(),
                answer,
                "?ㅼ쓬?먮뒗 ?댁쑀瑜?議곌툑 ?????蹂댁꽭??",
                List.of(new CoachExpressionUsageDto(
                        "I want to speak English fluently",
                        true,
                        "SELF_DISCOVERED",
                        "I want to speak English fluently",
                        "SELF_DISCOVERED",
                        "紐⑺몴瑜?遺꾨챸?섍쾶 留먰븷 ???먯뿰?ㅻ읇寃??????덉뼱??"
                ))
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.usedExpressions())
                .anySatisfy(expression -> {
                    assertThat(expression.expression()).isEqualTo("I want to speak English fluently");
                    assertThat(expression.matchedText()).isNull();
                    assertThat(expression.usageTip()).isEqualTo("紐⑺몴瑜?遺꾨챸?섍쾶 留먰븷 ???먯뿰?ㅻ읇寃??????덉뼱??");
                });
    }

    @Test
    void review_deduplicates_overlapping_used_expressions_from_incomplete_and_full_matches() {
        PromptDto prompt = new PromptDto(
                "prompt-a-2",
                "Weekend",
                "EASY",
                "What do you usually do on weekends?",
                "二쇰쭚??蹂댄넻 臾댁뾿???섎굹??",
                "Mention one or two activities."
        );
        String answer = "I usually spend time with my friends on weekends.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                88,
                false,
                null,
                "?붿빟",
                List.of("媛뺤젏"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                answer,
                List.of(),
                answer,
                "?ㅼ떆 ?⑤낫?몄슂."
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.usedExpressions())
                .extracting(CoachExpressionUsageDto::expression)
                .contains("I usually spend time with my friends")
                .doesNotContain("I usually spend time with my", "spend time with my friends");
    }

    @Test
    @org.junit.jupiter.api.Disabled("Legacy refinement expectation predates placeholder-drop contract.")
    void review_converts_full_sentence_refinement_examples_into_reusable_frames() {
        PromptDto prompt = new PromptDto(
                "prompt-a-4",
                "Food",
                "EASY",
                "What food do you like, and why?",
                "?대뼡 ?뚯떇??醫뗭븘?섍퀬 ??醫뗭븘?섎뒗吏 留먰빐 蹂댁꽭??",
                "Give one reason."
        );
        String answer = "I like pizza.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                88,
                false,
                null,
                "?붿빟",
                List.of("媛뺤젏"),
                List.of(),
                List.of(),
                "I like pizza because it is delicious.",
                List.of(
                        new RefinementExpressionDto(
                                "My favorite food is pizza because it is delicious and versatile.",
                                "?ㅼ쓬 ?듬??먯꽌 ?ъ궗?⑺빐 蹂댁꽭??",
                                "My favorite food is pizza because it is delicious and versatile."
                        ),
                        new RefinementExpressionDto(
                                "I want to eat healthy food so that I can stay energetic.",
                                "?ㅼ쓬 ?듬??먯꽌 ?ъ궗?⑺빐 蹂댁꽭??",
                                "I want to eat healthy food so that I can stay energetic."
                        )
                ),
                "My favorite food is pizza because it is delicious and versatile. I want to eat healthy food so that I can stay energetic.",
                "?ㅼ떆 ??蹂댁꽭??"
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.refinementExpressions())
                .extracting(RefinementExpressionDto::expression)
                .contains(
                        "My favorite [thing] is [item] because it is [adj] and [adj].",
                        "I want to [verb] so that I can [result]."
                )
                .doesNotContain(
                        "My favorite food is pizza because it is delicious and versatile.",
                        "I want to eat healthy food so that I can stay energetic."
                );
        assertThat(response.refinementExpressions())
                .extracting(RefinementExpressionDto::example)
                .contains(
                        "My favorite food is pizza because it is delicious and versatile.",
                        "I want to eat healthy food so that I can stay energetic."
                )
                .doesNotContain(
                        "My favorite [thing] is [item] because it is [adj] and [adj].",
                        "I want to [verb] so that I can [result]."
                );
    }

    @Test
    void review_fetches_prompt_hints_and_forwards_them_to_openai_feedback() {
        PromptDto prompt = new PromptDto(
                "prompt-b-5",
                "Goal Plan - Skill Growth",
                "B",
                "What is one skill you want to improve this year, and how will you work on it?",
                "?ы빐 ???ㅼ슦怨??띠? 湲곗닠 ?섎굹??臾댁뾿?닿퀬, ?대뼸寃??ㅼ쿇??嫄닿???",
                "紐⑺몴? ?ㅼ쿇 怨꾪쉷???④퍡 留먰빐 蹂댁꽭??"
        );
        String answer = "I want to improve my English speaking this year.";
        List<PromptHintDto> hints = List.of(
                new PromptHintDto("hint-1", prompt.id(), "STARTER", "I want to improve [skill] this year.", 1),
                new PromptHintDto("hint-2", prompt.id(), "VOCAB_PHRASE", "practice regularly", 2)
        );
        FeedbackResponseDto feedback = new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                87,
                false,
                null,
                "?붿빟",
                List.of("媛뺤젏"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                answer,
                List.of(),
                answer,
                "?ㅼ떆 ??蹂댁꽭??"
        );

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(hints);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(feedback);

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.promptId()).isEqualTo(prompt.id());
        verify(promptService).findHintsByPromptId(prompt.id());
        verify(openAiFeedbackClient).review(prompt, answer, hints, 1, null);
    }

    @Test
    void review_filters_refinement_frames_when_example_or_pattern_is_already_used() {
        PromptDto prompt = new PromptDto(
                "prompt-a-1",
                "Season",
                "A",
                "What season do you like, and why?",
                "?대뼡 怨꾩젅??醫뗭븘?섍퀬 ??醫뗭븘?섎굹??",
                "醫뗭븘?섎뒗 ?댁쑀瑜???媛吏 ?댁긽 ?ｌ뼱 蹂댁꽭??"
        );
        String answer = "I like spring season because it's the season when flowers bloom and everything fresh.";
        String correctedAnswer = "I like spring because it's the season when flowers bloom and everything feels fresh.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                83,
                false,
                null,
                "?붿빟",
                List.of("媛뺤젏"),
                List.of(
                        new CorrectionDto("'spring season'? ?먯뿰?ㅻ읇吏 ?딆뒿?덈떎.", "'spring'?쇰줈 異⑸텇?⑸땲??"),
                        new CorrectionDto("'feel'? 'everything'??留욊쾶 ?섏씪移섍? ?꾩슂?⑸땲??", "'feels'瑜??ъ슜?섏꽭??")
                ),
                List.of(),
                correctedAnswer,
                List.of(
                        new RefinementExpressionDto(
                                "when [thing] [verb]",
                                "?곹솴?대굹 ?쒓린瑜??ㅻ챸?????????덉뒿?덈떎.",
                                "when flowers bloom"
                        ),
                        new RefinementExpressionDto(
                                "because it's the [noun] when [thing] [verb]",
                                "?뱀젙 ?쒓린??怨꾩젅???댁쑀濡??ㅻ챸?????좎슜?⑸땲??",
                                "because it's the season when flowers bloom"
                        ),
                        new RefinementExpressionDto(
                                "everything feels [adj]",
                                "?ㅼ뼇??媛먭컖???ㅻ챸?????덉뒿?덈떎.",
                                "everything feels fresh"
                        )
                ),
                correctedAnswer,
                "?ㅼ떆 ??蹂댁꽭??"
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.refinementExpressions()).isEmpty();
    }

    @Test
    void review_filters_refinement_suggestions_when_core_tokens_already_overlap_strongly() {
        PromptDto prompt = new PromptDto(
                "prompt-a-1",
                "Season",
                "A",
                "What season do you like, and why?",
                "?대뼡 怨꾩젅??醫뗭븘?섍퀬 ??醫뗭븘?섎굹??",
                "醫뗭븘?섎뒗 ?댁쑀瑜???媛吏 ?댁긽 ?ｌ뼱 蹂댁꽭??"
        );
        String answer = "I like spring because flowers are blooming and the air feels fresh.";
        String correctedAnswer = "I like spring because flowers are blooming and the air feels fresh.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                86,
                false,
                null,
                "?붿빟",
                List.of("媛뺤젏"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                correctedAnswer,
                List.of(
                        new RefinementExpressionDto(
                                "when [thing] [verb]",
                                "?곹솴?대굹 ?쒓린瑜??ㅻ챸?????????덉뒿?덈떎.",
                                "when flowers bloom"
                        ),
                        new RefinementExpressionDto(
                                "the air feels [adj]",
                                "遺꾩쐞湲곕굹 媛먭컖??臾섏궗????醫뗭뒿?덈떎.",
                                "the air feels fresh"
                        ),
                        new RefinementExpressionDto(
                                "I enjoy [season] because it feels [adj].",
                                "怨꾩젅 ?좏샇瑜?留먰븷 ???????덉뒿?덈떎.",
                                "I enjoy spring because it feels refreshing."
                        )
                ),
                correctedAnswer,
                "?ㅼ떆 ??蹂댁꽭??"
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.refinementExpressions())
                .extracting(RefinementExpressionDto::expression)
                .doesNotContain(
                        "when [thing] [verb]",
                        "the air feels [adj]"
                );
    }

    @Test
    void review_filters_hint_refinement_when_core_phrase_is_already_used_with_small_inflection_difference() {
        PromptDto prompt = new PromptDto(
                "prompt-b-1",
                "Problem Solving",
                "B",
                "What is one challenge you often face, and how do you deal with it?",
                "?먯＜ 寃る뒗 ?대젮?怨??닿껐 諛⑸쾿??留먰빐 蹂댁꽭??",
                "Mention the problem and one strategy."
        );
        String answer = "I often struggle to meet the deadline, but I try to stay on track by writing a to-do list.";
        List<PromptHintDto> hints = List.of(
                new PromptHintDto("hint-1", prompt.id(), "VOCAB_PHRASE", "to meet deadlines", 1),
                new PromptHintDto("hint-2", prompt.id(), "STRUCTURE", "To handle this, I [action or strategy].", 2)
        );

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(hints);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                81,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                answer,
                List.of(),
                answer,
                "rewrite"
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.refinementExpressions())
                .extracting(RefinementExpressionDto::expression)
                .doesNotContain("to meet deadlines");
    }

    @Test
    @org.junit.jupiter.api.Disabled("Legacy refinement expectation predates placeholder-drop contract.")
    void review_filters_because_frames_when_they_are_already_used_or_not_reusable() {
        PromptDto prompt = new PromptDto(
                "prompt-a-1",
                "Season",
                "A",
                "What season do you like, and why?",
                "?대뼡 怨꾩젅??醫뗭븘?섍퀬 ??醫뗭븘?섎굹??",
                "醫뗭븘?섎뒗 ?댁쑀瑜???媛吏 ?댁긽 ?ｌ뼱 蹂댁꽭??"
        );
        String answer = "I like spring because it is beautiful.";
        String correctedAnswer = "I like spring because it is beautiful.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                88,
                false,
                null,
                "?붿빟",
                List.of("媛뺤젏"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                correctedAnswer,
                List.of(
                        new RefinementExpressionDto(
                                "because [reason]",
                                "?댁쑀瑜?遺숈씪 ???좎슜?⑸땲??",
                                "because it is beautiful"
                        ),
                        new RefinementExpressionDto(
                                "because it's the [noun] when [thing] [verb]",
                                "議곌툑 ??援ъ껜?곸씤 ?댁쑀瑜??ㅻ챸????醫뗭뒿?덈떎.",
                                "because it's the season when flowers bloom"
                        )
                ),
                correctedAnswer,
                "?ㅼ떆 ??蹂댁꽭??"
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.refinementExpressions())
                .extracting(RefinementExpressionDto::expression)
                .doesNotContain("because [reason]")
                .contains("because it's the [noun] when [thing] [verb]");
    }

    @Test
    void review_prefers_dropping_invalid_refinements_over_padding_with_prompt_hints() {
        PromptDto prompt = new PromptDto(
                "prompt-a-1",
                "Season",
                "A",
                "What season do you like, and why?",
                "?대뼡 怨꾩젅??醫뗭븘?섍퀬 ??醫뗭븘?섎굹??",
                "醫뗭븘?섎뒗 ?댁쑀瑜???媛吏 ?댁긽 ?ｌ뼱 蹂댁꽭??"
        );
        String answer = "I like spring because it's the season when flowers bloom and everything feels fresh.";
        List<PromptHintDto> hints = List.of(
                new PromptHintDto("hint-1", prompt.id(), "STARTER", "I especially like [season] because ...", 1),
                new PromptHintDto("hint-2", prompt.id(), "VOCAB_WORD", "pleasant", 2),
                new PromptHintDto("hint-3", prompt.id(), "DETAIL", "It makes me feel [adj].", 3)
        );

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(hints);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                84,
                false,
                null,
                "?붿빟",
                List.of("媛뺤젏"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                answer,
                List.of(
                        new RefinementExpressionDto(
                                "when [thing] [verb]",
                                "?곹솴?대굹 ?쒓린瑜??ㅻ챸?????????덉뒿?덈떎.",
                                "when flowers bloom"
                        ),
                        new RefinementExpressionDto(
                                "because it's the [noun] when [thing] [verb]",
                                "?뱀젙 ?쒓린??怨꾩젅???댁쑀濡??ㅻ챸?????좎슜?⑸땲??",
                                "because it's the season when flowers bloom"
                        ),
                        new RefinementExpressionDto(
                                "everything feels [adj]",
                                "?ㅼ뼇??媛먭컖???ㅻ챸?????덉뒿?덈떎.",
                                "everything feels fresh"
                        )
                ),
                answer,
                "?ㅼ떆 ??蹂댁꽭??"
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.refinementExpressions()).isEmpty();
    }

    @Test
    @org.junit.jupiter.api.Disabled("Legacy refinement expectation predates placeholder-drop contract.")
    void review_keeps_usable_openai_refinements_without_padding_with_prompt_hints() {
        PromptDto prompt = new PromptDto(
                "prompt-a-1",
                "Season",
                "A",
                "What season do you like, and why?",
                "Which season do you like, and why?",
                "Give at least one reason."
        );
        String answer = "I like spring because it is beautiful.";
        List<PromptHintDto> hints = List.of(
                new PromptHintDto("hint-1", prompt.id(), "STARTER", "I especially like [season] because ...", 1),
                new PromptHintDto("hint-2", prompt.id(), "VOCAB_WORD", "pleasant", 2)
        );

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(hints);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                88,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                answer,
                List.of(
                        new RefinementExpressionDto(
                                "One reason is that [reason].",
                                "Add a clearer reason.",
                                "One reason is that the weather feels fresh."
                        ),
                        new RefinementExpressionDto(
                                "What I like most about [thing] is that [detail].",
                                "Expand the idea with a detail.",
                                "What I like most about spring is that it feels calm."
                        ),
                        new RefinementExpressionDto(
                                "because [reason]",
                                "Add a reason naturally.",
                                "because it is beautiful"
                        )
                ),
                answer,
                "rewrite"
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.refinementExpressions())
                .extracting(RefinementExpressionDto::expression)
                .contains("One reason is that [reason].", "What I like most about [thing] is that [detail].")
                .doesNotContain("because [reason]");
    }

    @Test
    @org.junit.jupiter.api.Disabled("Legacy model-supplement expectation predates current refinement policy.")
    void review_extracts_additional_refinement_frames_from_model_answer_without_hint_top_up() {
        PromptDto prompt = new PromptDto(
                "prompt-b-1",
                "Problem Solving - Time Management",
                "B",
                "What is one challenge you often face with time management, and how do you handle it?",
                "What time-management challenge do you face, and how do you handle it?",
                "Explain the problem and your response."
        );
        String answer = "Time management is difficult for me, so I try to stay organized.";
        String modelAnswer = "One challenge I often face with time management is staying consistent. "
                + "It helps me stay on track and finish important tasks. "
                + "This makes it easier to manage my schedule.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                82,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                answer,
                List.of(),
                modelAnswer,
                "rewrite"
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.refinementExpressions())
                .extracting(RefinementExpressionDto::expression)
                .contains(
                        "One challenge I often face with [noun] is [issue].",
                        "It helps me [verb] and [verb].",
                        "This makes it easier to [verb]."
                );
    }

    @Test
    @org.junit.jupiter.api.Disabled("Legacy model-supplement expectation predates current refinement policy.")
    void review_tops_up_refinement_expressions_from_model_answer_up_to_four_items() {
        PromptDto prompt = new PromptDto(
                "prompt-b-5",
                "Goal Plan - Skill Growth",
                "B",
                "What is one skill you want to improve this year, and how will you work on it?",
                "?ы빐 ?ㅼ슦怨??띠? 湲곗닠 ??媛吏? ?대뼸寃??곗뒿?좎? ?ㅻ챸??二쇱꽭??",
                "Explain both the goal and the action plan."
        );
        String answer = "I want to improve my English this year.";
        String modelAnswer = "I want to improve my English so that I can speak more confidently. "
                + "I plan to do this by studying for thirty minutes every day. "
                + "It helps me stay motivated and track my progress. "
                + "This makes it easier to keep a steady routine.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                84,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                answer,
                List.of(
                        new RefinementExpressionDto(
                                "I want to [verb] so that I can [result].",
                                "紐⑺몴? 湲곕? 寃곌낵瑜??④퍡 留먰븷 ???????덉뼱??",
                                "I want to improve my English so that I can speak more confidently."
                        ),
                        new RefinementExpressionDto(
                                "I plan to [verb] by [verb]ing [method].",
                                "?ㅼ쿇 怨꾪쉷???ㅻ챸?????????덉뼱??",
                                "I plan to do this by studying for thirty minutes every day."
                        )
                ),
                modelAnswer,
                "rewrite"
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.refinementExpressions()).hasSize(4);
        assertThat(response.refinementExpressions())
                .extracting(RefinementExpressionDto::expression)
                .contains(
                        "I want to [verb] so that I can [result].",
                        "I plan to [verb] by [verb]ing [method].",
                        "It helps me [verb] and [verb].",
                        "This makes it easier to [verb]."
                );
    }

    @Test
    void review_keeps_openai_refinement_when_openai_example_is_usable_even_if_not_in_model_answer() {
        PromptDto prompt = new PromptDto(
                "prompt-a-1",
                "Daily Life",
                "EASY",
                "What do you usually do after lunch?",
                "What do you usually do after lunch?",
                "Use one clear daily-life example."
        );
        String answer = "I usually take a short break.";
        String correctedAnswer = "I usually take a short break.";
        String modelAnswer = "I usually take a short walk before dinner.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                86,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                correctedAnswer,
                List.of(
                        new RefinementExpressionDto(
                                "after lunch",
                                "Use this to add a time phrase naturally.",
                                "I usually rest after lunch.",
                                "?먯떖 ?앹궗 ?꾩뿉"
                        )
                ),
                modelAnswer,
                "rewrite"
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.refinementExpressions())
                .extracting(
                        RefinementExpressionDto::expression,
                        RefinementExpressionDto::example,
                        RefinementExpressionDto::exampleSource
                )
                .contains(tuple("after lunch", "I usually rest after lunch.", RefinementExampleSource.OPENAI));
    }

    @Test
    void review_drops_refinement_items_when_example_is_only_the_expression_itself() {
        PromptDto prompt = new PromptDto(
                "prompt-a-2",
                "Daily Life",
                "EASY",
                "What do you usually do after lunch?",
                "What do you usually do after lunch?",
                "Use one clear daily-life example."
        );
        String answer = "I usually take a short break.";
        String correctedAnswer = "I usually take a short break.";
        String modelAnswer = "I usually take a short walk before dinner.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                86,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                correctedAnswer,
                List.of(
                        new RefinementExpressionDto(
                                "after lunch",
                                "Use this to add a time phrase naturally.",
                                "after lunch",
                                "?먯떖 ?앹궗 ?꾩뿉"
                        )
                ),
                modelAnswer,
                "rewrite"
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.refinementExpressions())
                .extracting(RefinementExpressionDto::expression)
                .doesNotContain("after lunch");
        assertThat(response.refinementExpressions())
                .extracting(RefinementExpressionDto::example)
                .doesNotContain("after lunch");
    }

    @Test
    void review_generates_lexical_gloss_for_single_word_refinement_when_hints_are_missing() {
        PromptDto prompt = new PromptDto(
                "prompt-a-3",
                "Daily Life",
                "EASY",
                "What do you usually do after lunch?",
                "What do you usually do after lunch?",
                "Use one clear daily-life example."
        );
        String answer = "I take a short break.";
        String correctedAnswer = "I take a short break.";
        String modelAnswer = "I usually rest after lunch because it helps me recharge.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                86,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                correctedAnswer,
                List.of(
                        new RefinementExpressionDto(
                                "rest",
                                "?ㅼ젣 ?듬??먯꽌 ?댁떇 ?쒓컙?대굹 ?댁쑀瑜??④퍡 遺숈뿬 蹂댁꽭??",
                                "I usually rest after lunch because it helps me recharge.",
                                null
                        )
                ),
                modelAnswer,
                "rewrite"
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.refinementExpressions())
                .extracting(RefinementExpressionDto::expression, RefinementExpressionDto::meaningKo, RefinementExpressionDto::example)
                .contains(tuple("rest", "휴식하다", "I usually rest after lunch because it helps me recharge."));
    }

    @Test
    void review_generates_lexical_gloss_for_phrase_refinement_when_hints_are_missing() {
        PromptDto prompt = new PromptDto(
                "prompt-a-4",
                "Daily Life",
                "EASY",
                "What do you usually do after lunch?",
                "What do you usually do after lunch?",
                "Use one clear daily-life example."
        );
        String answer = "I take a short break.";
        String correctedAnswer = "I take a short break.";
        String modelAnswer = "I usually rest after lunch because it helps me recharge.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                86,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                correctedAnswer,
                List.of(
                        new RefinementExpressionDto(
                                "after lunch",
                                "?쒓컙 ?쒗쁽 ?ㅼ뿉 ?대뼡 ?쒕룞???섎뒗吏 ?댁뼱??留먰빐 蹂댁꽭??",
                                "I usually rest after lunch because it helps me recharge.",
                                null
                        )
                ),
                modelAnswer,
                "rewrite"
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.refinementExpressions())
                .extracting(RefinementExpressionDto::expression, RefinementExpressionDto::meaningKo, RefinementExpressionDto::example)
                .contains(tuple("after lunch", "점심 식사 후에", "I usually rest after lunch because it helps me recharge."));
    }

    @Test
    void review_prefers_model_answer_snippet_over_openai_example_when_both_are_usable() {
        PromptDto prompt = new PromptDto(
                "prompt-a-4b",
                "Daily Life",
                "EASY",
                "What do you usually do after lunch?",
                "What do you usually do after lunch?",
                "Use one clear daily-life example."
        );
        String answer = "I take a short break.";
        String correctedAnswer = "I take a short break.";
        String modelAnswer = "I usually rest after lunch because it helps me recharge.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                86,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                correctedAnswer,
                List.of(
                        new RefinementExpressionDto(
                                "after lunch",
                                "??볦퍢 ??쀬겱 ??쇰퓠 ??堉???뺣짗????롫뮉筌왖 ??곷선??筌띾?鍮?癰귣똻苑??",
                                "I often read a book after lunch.",
                                null
                        )
                ),
                modelAnswer,
                "rewrite"
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.refinementExpressions())
                .extracting(
                        RefinementExpressionDto::expression,
                        RefinementExpressionDto::example,
                        RefinementExpressionDto::exampleSource
                )
                .contains(tuple(
                        "after lunch",
                        "I usually rest after lunch because it helps me recharge.",
                        RefinementExampleSource.EXTRACTED
                ));
    }

    @Test
    @org.junit.jupiter.api.Disabled("Legacy placeholder-based frame expectation predates placeholder-drop contract.")
    void review_generates_pattern_meaning_for_frame_refinement() {
        PromptDto prompt = new PromptDto(
                "prompt-b-2",
                "Future Plans",
                "B",
                "What habit do you want to build this year?",
                "What habit do you want to build this year?",
                "Describe a clear plan."
        );
        String answer = "Building a healthier routine is my goal this year.";
        String correctedAnswer = "Building a healthier routine is my goal this year.";
        String modelAnswer = "I want to build a healthy routine this year.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                88,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                correctedAnswer,
                List.of(
                        new RefinementExpressionDto(
                                "I want to [verb].",
                                "紐⑺몴瑜?留먰븷 ???ㅼ뿉 援ъ껜?곸씤 ?됰룞???댁뼱 蹂댁꽭??",
                                "I want to build a healthy routine this year.",
                                null
                        )
                ),
                modelAnswer,
                "rewrite"
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.refinementExpressions())
                .extracting(RefinementExpressionDto::expression, RefinementExpressionDto::meaningKo, RefinementExpressionDto::example)
                .contains(tuple("I want to [verb].", "[?숈궗]?섍퀬 ?띕떎怨?留먰븯???", "I want to build a healthy routine this year."));
    }

    @Test
    void review_keeps_single_word_openai_refinement_when_openai_example_is_usable_even_if_not_in_model_answer() {
        PromptDto prompt = new PromptDto(
                "prompt-a-5",
                "Daily Life",
                "EASY",
                "What do you usually do after lunch?",
                "What do you usually do after lunch?",
                "Use one clear daily-life example."
        );
        String answer = "I take a short break.";
        String correctedAnswer = "I take a short break.";
        String modelAnswer = "I usually take a short walk before dinner.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                86,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                correctedAnswer,
                List.of(
                        new RefinementExpressionDto(
                                "rest",
                                "?ㅼ젣 ?듬??먯꽌 ?댁떇 ?쒓컙?대굹 ?댁쑀瑜??④퍡 遺숈뿬 蹂댁꽭??",
                                "I usually rest after lunch.",
                                "?댁떇?섎떎"
                        )
                ),
                modelAnswer,
                "rewrite"
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.refinementExpressions())
                .filteredOn(expression -> "rest".equals(expression.expression()))
                .singleElement()
                .satisfies(expression -> {
                    assertThat(expression.meaningKo()).isNotBlank();
                    assertThat(expression.example()).isEqualTo("I usually rest after lunch.");
                    assertThat(expression.exampleSource()).isEqualTo(RefinementExampleSource.OPENAI);
                });
    }

    @Test
    void review_replaces_generic_meaning_placeholder_with_generated_gloss() {
        PromptDto prompt = new PromptDto(
                "prompt-a-6",
                "Daily Life",
                "EASY",
                "What do you usually do after lunch?",
                "What do you usually do after lunch?",
                "Use one clear daily-life example."
        );
        String answer = "I take a short break.";
        String correctedAnswer = "I take a short break.";
        String modelAnswer = "I usually rest after lunch because it helps me recharge.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                86,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                correctedAnswer,
                List.of(
                        new RefinementExpressionDto(
                                "after lunch",
                                "?쒓컙 ?쒗쁽 ?ㅼ뿉 ?대뼡 ?쒕룞???섎뒗吏 ?댁뼱??留먰빐 蹂댁꽭??",
                                "I usually rest after lunch because it helps me recharge.",
                                "다음 답변에서 사용하기 좋은 표현"
                        )
                ),
                modelAnswer,
                "rewrite"
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.refinementExpressions())
                .extracting(RefinementExpressionDto::expression, RefinementExpressionDto::meaningKo)
                .contains(tuple("after lunch", "점심 식사 후에"));
        assertThat(response.refinementExpressions())
                .extracting(RefinementExpressionDto::meaningKo)
                .doesNotContain("다음 답변에서 사용하기 좋은 표현");
    }

    @Test
    @org.junit.jupiter.api.Disabled("Legacy expectation assumed minor grammar was always shown before answer-band section hiding.")
    void review_collects_grammar_feedback_from_inline_edits_and_keeps_corrections_for_non_grammar_only() {
        PromptDto prompt = new PromptDto(
                "prompt-b-1",
                "Problem Solving - Time Management",
                "B",
                "What is one challenge you often face with time management, and how do you handle it?",
                "What time-management challenge do you face, and how do you handle it?",
                "Explain the problem and your response."
        );
        String answer = "i have a problem meeting friend on time. i set an alarm.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                78,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(
                        new CorrectionDto(
                                "?듬????곹솴 ?ㅻ챸??議곌툑 ??援ъ껜?곸씠硫????ㅻ뱷???덉뼱?몄슂.",
                                "??移쒓뎄瑜??쒖떆媛꾩뿉 留뚮굹湲??대젮?댁? ??臾몄옣 ???㏓텤??蹂댁꽭??"
                        ),
                        new CorrectionDto(
                                "'I'????긽 ?臾몄옄濡??⑥빞 ?댁슂.",
                                "'I'濡?怨좎퀜 二쇱꽭??"
                        )
                ),
                List.of(
                        new InlineFeedbackSegmentDto("REPLACE", "i", "I"),
                        new InlineFeedbackSegmentDto("KEEP", " have a problem meeting ", " have a problem meeting "),
                        new InlineFeedbackSegmentDto("ADD", "", "my "),
                        new InlineFeedbackSegmentDto("REPLACE", "friend", "friends"),
                        new InlineFeedbackSegmentDto("KEEP", " on time. ", " on time. "),
                        new InlineFeedbackSegmentDto("REPLACE", "i", "I"),
                        new InlineFeedbackSegmentDto("KEEP", " set an alarm.", " set an alarm.")
                ),
                List.of(new GrammarFeedbackItemDto(
                        "i",
                        "I",
                        "'I'????긽 ?臾몄옄濡??⑥빞 ?댁슂."
                )),
                "I have a problem meeting my friends on time. I set an alarm.",
                List.of(),
                "I have a problem meeting my friends on time. I set an alarm.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.grammarFeedback())
                .extracting(GrammarFeedbackItemDto::originalText, GrammarFeedbackItemDto::revisedText, GrammarFeedbackItemDto::reasonKo)
                .contains(tuple("i", "I", "'I'????긽 ?臾몄옄濡??⑥빞 ?댁슂."));
        assertThat(response.corrections())
                .extracting(CorrectionDto::issue)
                .containsExactly("?듬????곹솴 ?ㅻ챸??議곌툑 ??援ъ껜?곸씠硫????ㅻ뱷???덉뼱?몄슂.");
    }
    @Test
    @org.junit.jupiter.api.Disabled("Legacy grammar expectation predates section-policy grammar cap.")
    void review_rebuilds_inline_feedback_from_corrected_answer_and_preserves_openai_grammar_feedback_units() {
        PromptDto prompt = new PromptDto(
                "prompt-a-3",
                "Routine - Weekend",
                "A",
                "How do you usually spend your weekend?",
                "二쇰쭚? 蹂댄넻 ?대뼸寃?蹂대궡?섏슂?",
                "Mention one or two activities."
        );
        String answer = "On weekends, i usually take nap and write a my diary";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                70,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(new CorrectionDto(
                        "?댁슜??議곌툑 ??援ъ껜?곸씠硫???醫뗭븘?몄슂.",
                        "?대뵒?먯꽌 ?쒓컙??蹂대궡?붿? ??臾몄옣 ???㏓텤??蹂댁꽭??"
                )),
                List.of(),
                List.of(
                        new GrammarFeedbackItemDto("i", "I", "'I'????긽 ?臾몄옄濡??⑥빞 ?댁슂."),
                        new GrammarFeedbackItemDto("a my diary", "my diary", "'a'???뚯쑀寃?'my'? ?④퍡 ?????놁뼱??")
                ),
                "On weekends, I usually take a nap and write in my diary.",
                List.of(),
                "On weekends, I usually take a nap and write in my diary.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.inlineFeedback()).isNotEmpty();
        assertThat(response.inlineFeedback())
                .extracting(InlineFeedbackSegmentDto::type, InlineFeedbackSegmentDto::originalText, InlineFeedbackSegmentDto::revisedText)
                .contains(
                        tuple("REPLACE", "i", "I"),
                        tuple("ADD", "", "a ")
                );
        assertThat(response.grammarFeedback())
                .extracting(GrammarFeedbackItemDto::originalText, GrammarFeedbackItemDto::revisedText, GrammarFeedbackItemDto::reasonKo)
                .contains(
                        tuple("i", "I", "'I'\uB294 \uD56D\uC0C1 \uB300\uBB38\uC790\uB85C \uC368\uC57C \uD574\uC694."),
                        tuple("a my diary", "my diary", "'a'\uB294 \uC18C\uC720\uACA9 'my'\uC640 \uD568\uAED8 \uC4F8 \uC218 \uC5C6\uC5B4\uC694.")
                );
    }

    @Test
    @org.junit.jupiter.api.Disabled("Legacy grammar reason expectation predates current grammar sanitizer behavior.")
    void review_preserves_matching_openai_reason_but_refines_generic_possessive_article_reason() {
        PromptDto prompt = new PromptDto(
                "prompt-a-3",
                "Routine - Weekend",
                "A",
                "How do you usually spend your weekend?",
                "二쇰쭚??蹂댄넻 ?대뼸寃?蹂대궡?섏슂?",
                "Mention one or two activities."
        );
        String answer = "On weekends, i usually take nap and write a my diary";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                70,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(),
                List.of(
                        new GrammarFeedbackItemDto("i", "I", "capitalization reason"),
                        new GrammarFeedbackItemDto("a my diary", "my diary", "broad diary reason")
                ),
                "On weekends, I usually take a nap and write in my diary.",
                List.of(),
                "On weekends, I usually take a nap and write in my diary.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.grammarFeedback())
                .filteredOn(item -> "i".equals(item.originalText()) && "I".equals(item.revisedText()))
                .extracting(GrammarFeedbackItemDto::reasonKo)
                .containsExactly("capitalization reason");

        assertThat(response.grammarFeedback())
                .filteredOn(item -> "a my diary".equals(item.originalText()) && "my diary".equals(item.revisedText()))
                .extracting(GrammarFeedbackItemDto::reasonKo)
                .containsExactly("'my' 媛숈? ?쒖젙?ш? ?대? 紐낆궗瑜?袁몃ŉ 二쇰?濡??욎뿉 愿??'a'瑜??④퍡 ?곗? ?딆븘??");
    }

    @Test
    void review_refines_generic_article_removal_reason_when_article_precedes_possessive_determiner() {
        PromptDto prompt = new PromptDto(
                "prompt-a-3",
                "Routine - Weekend",
                "A",
                "How do you usually spend your weekend?",
                "二쇰쭚? 蹂댄넻 ?대뼸寃?蹂대궡?섏슂?",
                "Mention one or two activities."
        );
        String answer = "On weekends, I write a my diary before bed.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                75,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(),
                List.of(
                        new GrammarFeedbackItemDto("a", "", "??遺遺꾩? 鍮쇰뒗 寃껋씠 臾몃쾿?곸쑝濡????먯뿰?ㅻ윭?뚯슂.")
                ),
                "On weekends, I write my diary before bed.",
                List.of(),
                "On weekends, I write my diary before bed.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.grammarFeedback()).hasSize(1);
        assertThat(response.grammarFeedback().get(0).originalText()).isEqualTo("a");
        assertThat(response.grammarFeedback().get(0).revisedText()).isEmpty();
        assertThat(response.grammarFeedback().get(0).reasonKo())
                .contains("'my'")
                .contains("'a'");
    }

    @Test
    @org.junit.jupiter.api.Disabled("Legacy expectation assumed article fixes were always surfaced in grammar instead of being folded into corrected answer for stronger bands.")
    void review_refines_generic_article_addition_reason_into_countable_noun_rule() {
        PromptDto prompt = new PromptDto(
                "prompt-b-3",
                "Goal Plan - Habit Building",
                "B",
                "What is one habit you want to build this year, and why is it important to you?",
                "?ы빐 留뚮뱾怨??띠? ?듦? ??媛吏? 洹멸쾬????以묒슂?쒖? ?ㅻ챸??二쇱꽭??",
                "Include your goal and reason."
        );
        String answer = "I want to build exercise habit this year because it helps me stay healthy.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                82,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(),
                List.of(
                        new GrammarFeedbackItemDto("", "an", "紐낆궗 ?욎뿉 ?꾩슂???쒖젙?대? ?ｌ쑝硫??살씠 ??遺꾨챸?댁쭛?덈떎.")
                ),
                "I want to build an exercise habit this year because it helps me stay healthy.",
                List.of(),
                "I want to build an exercise habit this year because it helps me stay healthy.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.grammarFeedback())
                .extracting(GrammarFeedbackItemDto::originalText, GrammarFeedbackItemDto::revisedText, GrammarFeedbackItemDto::reasonKo)
                .contains(tuple(
                        "",
                        "an",
                        "'habit'泥섎읆 ?⑥닔 媛?곕챸???욎뿉??愿??'an'???⑥빞 ?댁슂."
                ));
    }

    @Test
    @org.junit.jupiter.api.Disabled("Legacy punctuation expectation predates section-policy grammar cap.")
    void review_refines_generic_punctuation_reason_into_comma_and_period_specific_feedback() {
        PromptDto prompt = new PromptDto(
                "prompt-a-3",
                "Routine - Weekend",
                "A",
                "How do you usually spend your weekend?",
                "二쇰쭚? 蹂댄넻 ?대뼸寃?蹂대궡?섏슂?",
                "Mention one or two activities."
        );
        String answer = "On weekends I usually relax at home";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                85,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(),
                List.of(
                        new GrammarFeedbackItemDto("", ",", "臾몄옣 ?앹뿉??臾몄옣遺?멸? ?덉뼱??臾몄옣??遺꾨챸?댁슂."),
                        new GrammarFeedbackItemDto("", ".", "臾몄옣 ?앹뿉??臾몄옣遺?멸? ?덉뼱??臾몄옣??遺꾨챸?댁슂.")
                ),
                "On weekends, I usually relax at home.",
                List.of(),
                "On weekends, I usually relax at home.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.grammarFeedback())
                .extracting(GrammarFeedbackItemDto::originalText, GrammarFeedbackItemDto::revisedText, GrammarFeedbackItemDto::reasonKo)
                .contains(
                        tuple("", ",", "?쇳몴瑜??ｌ뼱 ?욌?遺꾩쓽 ?꾩엯 ?쒗쁽怨??ㅼ쓽 蹂몃Ц??援щ텇?댁슂."),
                        tuple("", ".", "?꾩쟾??臾몄옣? ?앹뿉 留덉묠?쒕? ?ｌ뼱 留덈Т由ы빐??")
                );
    }

    @Test
    @org.junit.jupiter.api.Disabled("Legacy expectation assumed local possessive article fixes were always shown in grammar instead of hidden for otherwise-good answers.")
    void review_refines_possessive_article_reason_when_openai_span_includes_context() {
        PromptDto prompt = new PromptDto(
                "prompt-a-1",
                "Routine - Evening",
                "A",
                "What do you usually do after dinner?",
                "??곸쓣 癒밴퀬 ?섎㈃ 蹂댄넻 臾댁뾿???섎굹??",
                "Mention one or two activities."
        );
        String answer = "After dinner, I clean the my desk and organize my notes.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                74,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(),
                List.of(
                        new GrammarFeedbackItemDto(
                                "clean the my desk",
                                "clean my desk",
                                "紐낆궗 ?욎뿉 ??媛쒖쓽 ?뺢??щ? ?ъ슜?????놁뒿?덈떎."
                        )
                ),
                "After dinner, I clean my desk and organize my notes.",
                List.of(),
                "After dinner, I clean my desk and organize my notes.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.grammarFeedback())
                .extracting(GrammarFeedbackItemDto::originalText, GrammarFeedbackItemDto::revisedText, GrammarFeedbackItemDto::reasonKo)
                .contains(tuple(
                        "clean the my desk",
                        "clean my desk",
                        "'my' 媛숈? ?쒖젙?ш? ?대? 紐낆궗瑜?袁몃ŉ 二쇰?濡??욎뿉 愿??'the'瑜??④퍡 ?곗? ?딆븘??"
                ));
    }

    @Test
    void sanitizeGrammarFeedback_preserves_long_clause_level_item_for_card_rendering() {
        @SuppressWarnings("unchecked")
        List<GrammarFeedbackItemDto> sanitized = (List<GrammarFeedbackItemDto>) ReflectionTestUtils.invokeMethod(
                feedbackService,
                "sanitizeGrammarFeedback",
                List.of(
                        new GrammarFeedbackItemDto(
                                "right after I wake up I take a shower and turn on the computer to check the stock market.",
                                "Right after I wake up, I take a shower and turn on the computer to check the stock market.",
                                "臾몄옣 泥ル㉧由щ뒗 ?臾몄옄濡??쒖옉?섍퀬, ?덉씠 湲몄뼱吏??뚮뒗 ?쇳몴濡??먮쫫???뺣━?섎㈃ ???먯뿰?ㅻ윭?뚯슂."
                        )
                ),
                List.of(
                        new InlineFeedbackSegmentDto(
                                "REPLACE",
                                "right after I wake up I take a shower and turn on the computer to check the stock market.",
                                "Right after I wake up, I take a shower and turn on the computer to check the stock market."
                        )
                )
        );

        assertThat(sanitized)
                .extracting(GrammarFeedbackItemDto::originalText, GrammarFeedbackItemDto::revisedText, GrammarFeedbackItemDto::reasonKo)
                .contains(tuple(
                        "right after I wake up I take a shower and turn on the computer to check the stock market.",
                        "Right after I wake up, I take a shower and turn on the computer to check the stock market.",
                        "臾몄옣 泥ル㉧由щ뒗 ?臾몄옄濡??쒖옉?섍퀬, ?덉씠 湲몄뼱吏??뚮뒗 ?쇳몴濡??먮쫫???뺣━?섎㈃ ???먯뿰?ㅻ윭?뚯슂."
                ));
    }

    @Test
    @org.junit.jupiter.api.Disabled("Legacy expectation assumed short-valid/content-thin answers always surfaced minor article cleanup in grammar.")
    void review_refines_trailing_article_reason_when_followed_by_possessive_determiner() {
        PromptDto prompt = new PromptDto(
                "prompt-b-3",
                "Goal Plan - Habit Building",
                "B",
                "What is one habit you want to build this year, and why is it important to you?",
                "?ы빐 留뚮뱾怨??띠? ?듦? ??媛吏? 洹멸쾬????以묒슂?쒖? ?ㅻ챸??二쇱꽭??",
                "Include your goal and reason."
        );
        String answer = "I check a my schedule every morning.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                76,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(),
                List.of(
                        new GrammarFeedbackItemDto(
                                "I check a",
                                "I check",
                                "'schedule'??媛?곕챸?ъ?留?愿?щ? ?꾩슂濡??섏? ?딆쓬."
                        )
                ),
                "I check my schedule every morning.",
                List.of(),
                "I check my schedule every morning.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.grammarFeedback())
                .extracting(GrammarFeedbackItemDto::originalText, GrammarFeedbackItemDto::revisedText, GrammarFeedbackItemDto::reasonKo)
                .contains(tuple(
                        "I check a",
                        "I check",
                        "'my' 媛숈? ?쒖젙?ш? ?대? 紐낆궗瑜?袁몃ŉ 二쇰?濡??욎뿉 愿??'a'瑜??④퍡 ?곗? ?딆븘??"
                ));
    }

    @Test
    @org.junit.jupiter.api.Disabled("Legacy expectation assumed surviving minor grammar items were always shown even when section policy hides grammar for stronger answers.")
    void review_filters_out_provided_grammar_feedback_items_without_actual_change() {
        PromptDto prompt = new PromptDto(
                "prompt-a-3",
                "Routine - Weekend",
                "A",
                "How do you usually spend your weekend?",
                "二쇰쭚? 蹂댄넻 ?대뼸寃?蹂대궡?섏슂?",
                "Mention one or two activities."
        );
        String answer = "On weekends, I usually take nap at home and watch videos.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                78,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(),
                List.of(
                        new GrammarFeedbackItemDto("nap", "a nap", "'nap'? 媛?곕챸?щ씪??愿?ш? ?꾩슂?⑸땲??"),
                        new GrammarFeedbackItemDto("watch videos", "watch videos", "蹂듭닔???ㅻ챸")
                ),
                "On weekends, I usually take a nap at home and watch videos.",
                List.of(),
                "On weekends, I usually take a nap at home and watch videos.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.grammarFeedback())
                .extracting(GrammarFeedbackItemDto::originalText, GrammarFeedbackItemDto::revisedText)
                .contains(tuple("nap", "a nap"))
                .doesNotContain(tuple("watch videos", "watch videos"));
    }

    @Test
    void review_keeps_minor_grammar_asset_available_for_fix_first_ui_when_corrected_answer_is_preserved() {
        PromptDto prompt = new PromptDto(
                "prompt-b-1",
                "Problem Solving - Time Management",
                "B",
                "What is one challenge you often face with time management, and how do you handle it?",
                "What time-management challenge do you face, and how do you handle it?",
                "Explain the problem and your response."
        );
        String answer = "i have a problem meeting friend on time. i set an alarm.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                78,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(
                        new CorrectionDto(
                                "??????怨뱀넺 ??살구??鈺곌퀗?????닌딄퍥?怨몄뵠筌?????삳굣????됰선?紐꾩뒄.",
                                "??燁살뮄?꾤몴???뽯뻻揶쏄쑴肉?筌띾슢援방묾??????? ???얜챷??????볧뀮??癰귣똻苑??"
                        ),
                        new CorrectionDto(
                                "'I'????湲????얜챷?꾣에???λ튊 ??곸뒄.",
                                "'I'嚥??⑥쥙??雅뚯눘苑??"
                        )
                ),
                List.of(
                        new InlineFeedbackSegmentDto("REPLACE", "i", "I"),
                        new InlineFeedbackSegmentDto("KEEP", " have a problem meeting ", " have a problem meeting "),
                        new InlineFeedbackSegmentDto("ADD", "", "my "),
                        new InlineFeedbackSegmentDto("REPLACE", "friend", "friends"),
                        new InlineFeedbackSegmentDto("KEEP", " on time. ", " on time. "),
                        new InlineFeedbackSegmentDto("REPLACE", "i", "I"),
                        new InlineFeedbackSegmentDto("KEEP", " set an alarm.", " set an alarm.")
                ),
                List.of(new GrammarFeedbackItemDto("i", "I", "'I'????湲????얜챷?꾣에???λ튊 ??곸뒄.")),
                "I have a problem meeting my friends on time. I set an alarm.",
                List.of(),
                "I have a problem meeting my friends on time. I set an alarm.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.correctedAnswer()).isNotBlank();
        assertThat(response.grammarFeedback()).hasSize(1);
        assertThat(response.ui()).isNotNull();
        assertThat(response.ui().primaryFix()).isNotNull();
        assertThat(response.corrections()).hasSize(1);
        assertThat(response.corrections().get(0).issue()).isNotBlank();
        assertThat(response.corrections().get(0).suggestion()).isNotBlank();
    }

    @Test
    void review_keeps_countable_noun_article_fix_in_corrected_answer_when_grammar_section_is_hidden() {
        PromptDto prompt = new PromptDto(
                "prompt-b-3",
                "Goal Plan - Habit Building",
                "B",
                "What is one habit you want to build this year, and why is it important to you?",
                "??鍮?筌띾슢諭얏???? ??? ??揶쎛筌왖?? 域밸㈇苡????餓λ쵐???? ??살구??雅뚯눘苑??",
                "Include your goal and reason."
        );
        String answer = "I want to build exercise habit this year because it helps me stay healthy.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                82,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(),
                List.of(new GrammarFeedbackItemDto("", "an", "article")),
                "I want to build an exercise habit this year because it helps me stay healthy.",
                List.of(),
                "I want to build an exercise habit this year because it helps me stay healthy.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.correctedAnswer())
                .isEqualTo("I want to build an exercise habit this year because it helps me stay healthy.");
        assertThat(response.grammarFeedback()).isEmpty();
    }

    @Test
    void review_keeps_possessive_article_cleanup_available_for_fix_first_ui() {
        PromptDto prompt = new PromptDto(
                "prompt-a-1",
                "Routine - Evening",
                "A",
                "What do you usually do after dinner?",
                "???怨몄뱽 ?믩객????롢늺 癰귣똾???얜똻毓????롪돌??",
                "Mention one or two activities."
        );
        String answer = "After dinner, I clean the my desk and organize my notes.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                74,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(),
                List.of(new GrammarFeedbackItemDto("clean the my desk", "clean my desk", "article")),
                "After dinner, I clean my desk and organize my notes.",
                List.of(),
                "After dinner, I clean my desk and organize my notes.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.correctedAnswer()).isEqualTo("After dinner, I clean my desk and organize my notes.");
        assertThat(response.grammarFeedback()).hasSize(1);
        assertThat(response.ui()).isNotNull();
        assertThat(response.ui().primaryFix()).isNotNull();
    }

    @Test
    void review_keeps_local_article_fix_in_corrected_answer_when_remaining_answer_is_good_enough() {
        PromptDto prompt = new PromptDto(
                "prompt-a-3",
                "Routine - Weekend",
                "A",
                "How do you usually spend your weekend?",
                "雅뚯눖彛?? 癰귣똾????堉멨칰?癰귣?沅??륁뒄?",
                "Mention one or two activities."
        );
        String answer = "On weekends, I usually take nap at home and watch videos.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                78,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(),
                List.of(
                        new GrammarFeedbackItemDto("nap", "a nap", "article"),
                        new GrammarFeedbackItemDto("watch videos", "watch videos", "noop")
                ),
                "On weekends, I usually take a nap at home and watch videos.",
                List.of(),
                "On weekends, I usually take a nap at home and watch videos.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.correctedAnswer()).isEqualTo("On weekends, I usually take a nap at home and watch videos.");
        assertThat(response.grammarFeedback()).isEmpty();
    }

    @Test
    void review_prefers_reason_building_over_minor_article_cleanup_for_short_valid_answer() {
        PromptDto prompt = new PromptDto(
                "prompt-b-3",
                "Goal Plan - Habit Building",
                "B",
                "What is one habit you want to build this year, and why is it important to you?",
                "??鍮?筌띾슢諭얏???? ??? ??揶쎛筌왖?? 域밸㈇苡????餓λ쵐???? ??살구??雅뚯눘苑??",
                "Include your goal and reason."
        );
        String answer = "I check a my schedule every morning.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                76,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(),
                List.of(new GrammarFeedbackItemDto("I check a", "I check", "article")),
                "I check my schedule every morning.",
                List.of(),
                "I check my schedule every morning.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.correctedAnswer()).isEqualTo("I check my schedule every morning.");
        assertThat(response.grammarFeedback())
                .extracting(GrammarFeedbackItemDto::originalText, GrammarFeedbackItemDto::revisedText)
                .containsExactly(tuple("I check a", "I check"));
        assertThat(response.rewriteChallenge()).contains("이유");
    }

    @Test
    void review_ignores_provided_grammar_feedback_when_it_does_not_overlap_actual_inline_change() {
        PromptDto prompt = new PromptDto(
                "prompt-b-3",
                "Goal Plan - Habit Building",
                "B",
                "What is one habit you want to build this year, and why is it important to you?",
                "?ы빐 留뚮뱾怨??띠? ?듦? ??媛吏? 洹멸쾬????以묒슂?쒖? ?ㅻ챸??二쇱꽭??",
                "Include your goal and reason."
        );
        String answer = "I want to make study plan for this month.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                78,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(),
                List.of(
                        new GrammarFeedbackItemDto(
                                "this month.",
                                "for this month.",
                                "?꾩튂??'for'??'~???꾪븳'???섎?濡??ъ슜?⑸땲?? ?ш린?쒕뒗 湲곌컙???섑??낅땲??"
                        )
                ),
                "I want to make a study plan for this month.",
                List.of(),
                "I want to make a study plan for this month.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.grammarFeedback())
                .extracting(GrammarFeedbackItemDto::originalText, GrammarFeedbackItemDto::revisedText, GrammarFeedbackItemDto::reasonKo)
                .contains(tuple(
                        "",
                        "a",
                        "'plan'처럼 단수 가산명사 앞에는 관사 'a'를 써야 해요."
                ))
                .doesNotContain(tuple(
                        "this month.",
                        "for this month.",
                        "?꾩튂??'for'??'~???꾪븳'???섎?濡??ъ슜?⑸땲?? ?ш린?쒕뒗 湲곌컙???섑??낅땲??"
                ));
    }

    @Test
    void review_filters_out_english_only_corrections_and_keeps_korean_ones() {
        PromptDto prompt = new PromptDto(
                "prompt-a-3",
                "Routine - Weekend",
                "A",
                "How do you usually spend your weekend?",
                "二쇰쭚??蹂댄넻 ?대뼸寃?蹂대궡?섏슂?",
                "Mention one or two activities."
        );
        String answer = "When I stay at home, I usually play games and listen to music.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                80,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(
                        new CorrectionDto(
                                "Expand on activities or companions.",
                                "Consider adding more details about other activities or who you spend time with."
                        ),
                        new CorrectionDto(
                                "??援ъ껜?곸씤 ?뺣낫瑜??ы븿?섎㈃ 醫뗪쿋?댁슂.",
                                "?대뵒?먯꽌 ?쒓컙??蹂대궡?붿????꾧뎄? ?④퍡?섎뒗吏???㏓텤??蹂댁꽭??"
                        )
                ),
                List.of(),
                List.of(),
                answer,
                List.of(),
                answer,
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.corrections())
                .extracting(CorrectionDto::issue, CorrectionDto::suggestion)
                .containsExactly(tuple(
                        "??援ъ껜?곸씤 ?뺣낫瑜??ы븿?섎㈃ 醫뗪쿋?댁슂.",
                        "?대뵒?먯꽌 ?쒓컙??蹂대궡?붿????꾧뎄? ?④퍡?섎뒗吏???㏓텤??蹂댁꽭??"
                ));
    }

    @Test
    void review_discards_context_rewrites_from_corrected_answer_for_grammar_feedback() {
        PromptDto prompt = new PromptDto(
                "prompt-a-3",
                "Routine - Weekend",
                "A",
                "How do you usually spend your weekend?",
                "二쇰쭚? 蹂댄넻 ?대뼸寃?蹂대궡?섏슂?",
                "Mention one or two activities."
        );
        String answer = "In the morning, I exercise, and in the afternoon, I relax by reading a book or watching TV.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                78,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(),
                List.of(
                        new GrammarFeedbackItemDto("morning", "evening", "'morning'蹂대떎 'evening'媛 臾몃㎘?????먯뿰?ㅻ읇?듬땲??"),
                        new GrammarFeedbackItemDto("in the", "after", "愿?щ? 蹂댁셿?섎㈃ ?쒗쁽?????먯뿰?ㅻ읇怨??뺥솗?댁쭛?덈떎."),
                        new GrammarFeedbackItemDto("afternoon", "work", "'afternoon'蹂대떎 'work'媛 臾몃㎘?????먯뿰?ㅻ읇?듬땲??")
                ),
                "In the evening, I exercise, and after work, I relax by reading a book or watching TV.",
                List.of(),
                "In the evening, I exercise, and after work, I relax by reading a book or watching TV.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.correctedAnswer()).isEqualTo(answer);
        assertThat(response.inlineFeedback()).isEmpty();
        assertThat(response.grammarFeedback()).isEmpty();
    }

    @Test
    void review_drops_clause_level_context_additions_from_corrected_answer() {
        PromptDto prompt = new PromptDto(
                "prompt-a-1",
                "Routine - Morning",
                "A",
                "Describe your routine for your weekday mornings.",
                "?됱씪 ?꾩묠 猷⑦떞???ㅻ챸??二쇱꽭??",
                "Mention the order of your routine."
        );
        String answer = "I wake up in the morning to get ready for my commute. After that I have a breakfast.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                82,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(),
                List.of(
                        new GrammarFeedbackItemDto(
                                "After that I have a breakfast.",
                                "After that, I have breakfast.",
                                "?앹궗(breakfast) ?욎뿉??愿??'a'瑜?遺숈씠吏 ?딅뒗 寃껋씠 ?먯뿰?ㅻ읇?듬땲??"
                        )
                ),
                "I wake up in the morning to get ready for my commute. After that, I usually have breakfast.",
                List.of(),
                "I wake up in the morning to get ready for my commute. After that, I usually have breakfast.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.correctedAnswer()).doesNotContain("usually");
        assertThat(response.correctedAnswer()).contains("breakfast");
    }

    @Test
    void review_keeps_local_article_fix_in_corrected_answer_sanitization() {
        PromptDto prompt = new PromptDto(
                "prompt-b-3",
                "Goal Plan - Habit Building",
                "B",
                "What is one habit you want to build this year, and why is it important to you?",
                "?ы빐 留뚮뱾怨??띠? ?듦? ??媛吏? 洹멸쾬????以묒슂?쒖? ?ㅻ챸??二쇱꽭??",
                "Include your goal and reason."
        );
        String answer = "I want to take nap after lunch.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        stubOpenAiReview(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                82,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(),
                List.of(
                        new GrammarFeedbackItemDto("nap", "a nap", "'nap'? 媛?곕챸?щ씪??愿?ш? ?꾩슂?⑸땲??")
                ),
                "I want to take a nap after lunch.",
                List.of(),
                "I want to take a nap after lunch.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-test-identity-0001"),
                null
        );

        assertThat(response.correctedAnswer()).isEqualTo("I want to take a nap after lunch.");
        assertThat(response.inlineFeedback())
                .extracting(InlineFeedbackSegmentDto::type, InlineFeedbackSegmentDto::originalText, InlineFeedbackSegmentDto::revisedText)
                .contains(tuple("ADD", "", "a "));
        assertThat(response.grammarFeedback())
                .extracting(GrammarFeedbackItemDto::originalText, GrammarFeedbackItemDto::revisedText)
                .contains(tuple("nap", "a nap"));
    }

    @Test
    void buildRefinementExpressionDto_aligns_example_translation_with_model_answer_snippet() {
        RefinementExpressionDto expression = (RefinementExpressionDto) ReflectionTestUtils.invokeMethod(
                feedbackService,
                "buildRefinementExpressionDto",
                "after lunch",
                RefinementExpressionSource.MODEL_ANSWER,
                "?쒓컙 ?쒗쁽 ?ㅼ뿉 ?대뼡 ?쒕룞???섎뒗吏 遺숈씠硫?臾몄옣?????먮졆?댁쭛?덈떎.",
                null,
                null,
                "I usually rest after lunch. It helps me recharge for the afternoon.",
                "???蹂댄넻 ?먯떖 ?앹궗 ?꾩뿉 ?ъ뼱?? 洹몃윭硫??ㅽ썑瑜?????蹂대궪 ?섏씠 ?앷꺼??",
                "?먯떖 ?앹궗 ?꾩뿉",
                List.of()
        );

        assertThat(expression).isNotNull();
        assertThat(expression.exampleEn()).isEqualTo("I usually rest after lunch.");
        assertThat(expression.exampleKo()).isEqualTo("???蹂댄넻 ?먯떖 ?앹궗 ?꾩뿉 ?ъ뼱??");
        assertThat(expression.exampleSource()).isEqualTo(RefinementExampleSource.EXTRACTED);
    }
}
