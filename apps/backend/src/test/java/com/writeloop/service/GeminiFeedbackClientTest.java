package com.writeloop.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.CoachExpressionUsageDto;
import com.writeloop.dto.CorrectionDto;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.GrammarFeedbackItemDto;
import com.writeloop.dto.InlineFeedbackSegmentDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

class GeminiFeedbackClientTest {

    @Test
    @SuppressWarnings("unchecked")
    void normalizeInlineFeedback_returns_empty_when_response_only_contains_keep_segments() {
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses"
        );

        List<InlineFeedbackSegmentDto> result = (List<InlineFeedbackSegmentDto>) ReflectionTestUtils.invokeMethod(
                client,
                "normalizeInlineFeedback",
                "I like pizza.",
                "I like pizza.",
                List.of(new InlineFeedbackSegmentDto("KEEP", "I like pizza.", "I like pizza."))
        );

        assertThat(result).isEmpty();
    }

    @Test
    void parseDiagnosisResponse_reads_band_minimal_correction_and_rewrite_target() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                mapper,
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses"
        );

        String outputText = mapper.writeValueAsString(Map.ofEntries(
                Map.entry("score", 74),
                Map.entry("answerBand", "GRAMMAR_BLOCKING"),
                Map.entry("taskCompletion", "FULL"),
                Map.entry("onTopic", true),
                Map.entry("finishable", false),
                Map.entry("grammarSeverity", "MAJOR"),
                Map.entry("minimalCorrection", "I often struggle to meet deadlines, so I try to stay on track by writing a to-do list."),
                Map.entry("primaryIssueCode", "FIX_BLOCKING_GRAMMAR"),
                Map.entry("secondaryIssueCode", "ADD_DETAIL"),
                Map.entry("rewriteTarget", Map.of(
                        "action", "FIX_BLOCKING_GRAMMAR",
                        "skeleton", "I often struggle to meet deadlines, so I try to stay on track by writing a to-do list.",
                        "maxNewSentenceCount", 1
                )),
                Map.entry("expansionBudget", "ONE_DETAIL"),
                Map.entry("regressionSensitiveFacts", List.of("meet deadlines", "write a to-do list")),
                Map.entry("grammarIssues", List.of(Map.of(
                        "code", "VERB_PATTERN",
                        "span", "with meet the deadline",
                        "correction", "to meet deadlines",
                        "reasonKo", "struggle ????????????to meet ??????됰Ŧ????????????ㅼ뒧?됰??륅쭚節띾즽?????????????? ??????????????嚥싲갭큔????????",
                        "blocksMeaning", true,
                        "severity", "MAJOR"
                )))
        ));
        String body = mapper.writeValueAsString(Map.of("output_text", outputText));

        FeedbackDiagnosisResult diagnosis = (FeedbackDiagnosisResult) ReflectionTestUtils.invokeMethod(
                client,
                "parseDiagnosisResponse",
                body
        );

        assertThat(diagnosis.answerBand()).isEqualTo(AnswerBand.GRAMMAR_BLOCKING);
        assertThat(diagnosis.minimalCorrection()).contains("to meet deadlines");
        assertThat(diagnosis.rewriteTarget().action()).isEqualTo("FIX_BLOCKING_GRAMMAR");
        assertThat(diagnosis.grammarIssues()).singleElement().satisfies(issue -> {
            assertThat(issue.reasonKo()).contains("struggle");
            assertThat(issue.severity()).isEqualTo(GrammarSeverity.MAJOR);
        });
    }

    @Test
    void parseGeneratedSections_reads_section_generation_payload() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                mapper,
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses"
        );

        String outputText = mapper.writeValueAsString(Map.of(
                "summary", "Add one more detail to make the answer stronger.",
                "strengths", List.of("You clearly state the goal and reason."),
                "corrections", List.of(Map.of(
                        "issue", "The plan still needs one more concrete detail.",
                        "suggestion", "Add one real habit you want to follow."
                )),
                "usedExpressions", List.of(Map.of(
                        "expression", "stay healthy",
                        "usageTip", "Use this to explain why the goal matters."
                )),
                "refinementExpressions", List.of(Map.of(
                        "expression", "improve my diet",
                        "guidanceKo", "Use this when talking about a health goal.",
                        "exampleEn", "I want to improve my diet this year.",
                        "exampleKo", "Korean example",
                        "meaningKo", "make eating habits healthier"
                )),
                "rewriteGuide", "Add one real habit after the corrected sentence.",
                "modelAnswer", "One health goal I have this year is to improve my diet. It's important to me because I want to stay healthy and feel more energetic.",
                "modelAnswerKo", "Korean translation"
        ));
        String body = mapper.writeValueAsString(Map.of("output_text", outputText));

        GeneratedSections sections = (GeneratedSections) ReflectionTestUtils.invokeMethod(
                client,
                "parseGeneratedSections",
                body
        );

        assertThat(sections.summary()).contains("detail");
        assertThat(sections.strengths()).containsExactly("You clearly state the goal and reason.");
        assertThat(sections.refinementExpressions()).singleElement().satisfies(card -> {
            assertThat(card.expression()).isEqualTo("improve my diet");
            assertThat(card.meaningKo()).isEqualTo("make eating habits healthier");
        });
        assertThat(sections.modelAnswer()).contains("feel more energetic");
    }
    @Test
    void buildDiagnosisPrompt_includes_attempt_context() {
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses"
        );
        PromptDto prompt = new PromptDto(
                "prompt-goal-1",
                "Health Goal",
                "B",
                "Explain one health goal you want to reach this year and why it matters to you.",
                "?? ??? ?? ?? ?? ??? ? ??? ??? ???.",
                null
        );

        String text = (String) ReflectionTestUtils.invokeMethod(
                client,
                "buildDiagnosisPrompt",
                prompt,
                "One health goal I have this is to diet.",
                List.of(),
                2,
                "I want to eat healthier."
        );

        assertThat(text).contains("attemptIndex: 2");
        assertThat(text).contains("previousAnswer: I want to eat healthier.");
        assertThat(text).contains("Do not keep finishable false only because the answer could be longer");
        assertThat(text).contains("For routine or daily-life prompts, one or two clear activities");
        assertThat(text).contains("If a required reason, detail, or activity clause still needs more than one small local repair");
        assertThat(text).contains("Do not set finishable=true when a required clause still has missing be-verbs");
        assertThat(text).contains("score is optional metadata only");
    }

    @Test
    void parseDiagnosisResponse_derives_fallback_score_when_score_is_missing() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                mapper,
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses"
        );

        String outputText = mapper.writeValueAsString(new java.util.LinkedHashMap<>(Map.ofEntries(
                Map.entry("answerBand", "NATURAL_BUT_BASIC"),
                Map.entry("taskCompletion", "FULL"),
                Map.entry("onTopic", true),
                Map.entry("finishable", true),
                Map.entry("grammarSeverity", "MINOR"),
                Map.entry("minimalCorrection", "On weekday mornings, I usually take guitar lessons."),
                Map.entry("primaryIssueCode", "IMPROVE_NATURALNESS"),
                Map.entry("rewriteTarget", Map.of(
                        "action", "IMPROVE_NATURALNESS",
                        "skeleton", "On weekday mornings, I usually take guitar lessons.",
                        "maxNewSentenceCount", 1
                )),
                Map.entry("expansionBudget", "NONE"),
                Map.entry("regressionSensitiveFacts", List.of("weekday mornings", "guitar lessons")),
                Map.entry("grammarIssues", List.of())
        )));
        String body = mapper.writeValueAsString(Map.of("output_text", outputText));

        FeedbackDiagnosisResult diagnosis = (FeedbackDiagnosisResult) ReflectionTestUtils.invokeMethod(
                client,
                "parseDiagnosisResponse",
                body
        );

        assertThat(diagnosis.score()).isEqualTo(91);
        assertThat(diagnosis.answerBand()).isEqualTo(AnswerBand.NATURAL_BUT_BASIC);
        assertThat(diagnosis.finishable()).isTrue();
    }

    @Test
    void buildGenerationPrompt_requires_concrete_anchored_improvement_and_rewrite_guide() throws Exception {
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses"
        );
        PromptDto prompt = new PromptDto(
                "prompt-place-1",
                "Favorite Relaxing Place",
                "B",
                "What do you like most about your favorite place to relax, and why?",
                "편하게 쉬기 좋은 장소에서 가장 마음에 드는 점은 무엇이고, 왜 그런가요?",
                null
        );
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                73,
                AnswerBand.CONTENT_THIN,
                TaskCompletion.FULL,
                true,
                false,
                GrammarSeverity.MINOR,
                List.of(),
                "I like bookstores. They feel cozy and calm.",
                "ADD_DETAIL",
                "FIX_LOCAL_GRAMMAR",
                new RewriteTarget(
                        "ADD_DETAIL",
                        "I like bookstores because they feel cozy and calm.",
                        1
                ),
                ExpansionBudget.ONE_DETAIL,
                List.of("bookstores", "cozy and calm")
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.CONTENT_THIN, false),
                new GrammarProfile(GrammarSeverity.MINOR, List.of(), diagnosis.minimalCorrection(), true),
                new ContentProfile(
                        ContentLevel.LOW,
                        new ContentSignals(true, true, false, true, false, false),
                        List.of()
                ),
                new RewriteProfile("ADD_DETAIL", "FIX_LOCAL_GRAMMAR", diagnosis.rewriteTarget(), ExpansionBudget.ONE_DETAIL, diagnosis.regressionSensitiveFacts(), null)
        );
        SectionPolicy policy = new SectionPolicy(
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

        String text = (String) ReflectionTestUtils.invokeMethod(
                client,
                "buildGenerationPrompt",
                prompt,
                "I like bookstore. it is relaxing and good. because i like cozy and calm.",
                List.of(),
                diagnosis,
                answerProfile,
                policy,
                1,
                null,
                List.of(SectionKey.IMPROVEMENT, SectionKey.REWRITE_GUIDE),
                List.of(ValidationFailureCode.GENERIC_TEXT),
                null
        );

        assertThat(text).contains("corrections must name one concrete weak learner phrase");
        assertThat(text).contains("rewriteGuide must include one concrete anchored sentence pattern");
        assertThat(text).contains("IMPROVEMENT must mention one actual learner phrase");
        assertThat(text).contains("REWRITE_GUIDE must include a concrete anchored sentence pattern");
        assertThat(text).contains("usedExpressions feed the small expression chips under Keep What Works");
        assertThat(text).contains("corrections are optional. If the current screen does not need a separate content/detail action, return []");
    }

    @Test
    @SuppressWarnings("unchecked")
    void requestedSections_follow_screen_policy_and_skip_improvement_for_optional_polish() {
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses"
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.NATURAL_BUT_BASIC, true),
                new GrammarProfile(GrammarSeverity.MINOR, List.of(), "On weekday mornings, I usually take guitar lessons.", true),
                new ContentProfile(
                        ContentLevel.MEDIUM,
                        new ContentSignals(true, false, false, false, true, true),
                        List.of()
                ),
                new RewriteProfile(
                        "IMPROVE_NATURALNESS",
                        null,
                        new RewriteTarget("IMPROVE_NATURALNESS", "After that, I ____.", 1),
                        ExpansionBudget.NONE,
                        List.of("weekday mornings", "guitar lessons"),
                        null
                )
        );
        SectionPolicy sectionPolicy = new SectionPolicy(
                true, 2,
                false, 0,
                true,
                true, 3, RefinementFocus.NATURALNESS,
                true,
                true,
                true,
                2, ModelAnswerMode.OPTIONAL_IF_ALREADY_GOOD,
                AttemptOverlayPolicy.NONE
        );
        FeedbackSectionAvailability availability = new FeedbackSectionAvailability(
                true,
                false,
                false,
                true,
                false,
                true,
                false
        );
        FeedbackScreenPolicy screenPolicy = new FeedbackScreenPolicy(
                CompletionState.OPTIONAL_POLISH,
                List.of(),
                SectionDisplayMode.SHOW_EXPANDED,
                SectionDisplayMode.HIDE,
                FixFirstMode.HIDE,
                SectionDisplayMode.SHOW_EXPANDED,
                RewriteGuideMode.OPTIONAL_POLISH,
                ModelAnswerDisplayMode.HIDE,
                RefinementDisplayMode.SHOW_COLLAPSED,
                1,
                2,
                1,
                true,
                true,
                true
        );

        List<SectionKey> requestedSections = (List<SectionKey>) ReflectionTestUtils.invokeMethod(
                client,
                "requestedSections",
                answerProfile,
                sectionPolicy,
                screenPolicy,
                availability
        );

        assertThat(requestedSections).contains(
                SectionKey.SUMMARY,
                SectionKey.STRENGTHS,
                SectionKey.USED_EXPRESSIONS,
                SectionKey.REWRITE_GUIDE,
                SectionKey.REFINEMENT
        );
        assertThat(requestedSections).doesNotContain(SectionKey.IMPROVEMENT, SectionKey.MODEL_ANSWER, SectionKey.GRAMMAR);
    }

    @Test
    void validateGeneratedSections_replaces_english_strengths_with_korean_fallback() {
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses"
        );
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                86,
                AnswerBand.NATURAL_BUT_BASIC,
                TaskCompletion.FULL,
                true,
                true,
                GrammarSeverity.MINOR,
                List.of(),
                "On weekday mornings, I usually take guitar lessons.",
                "IMPROVE_NATURALNESS",
                null,
                new RewriteTarget(
                        "IMPROVE_NATURALNESS",
                        "On weekday mornings, I usually take guitar lessons.",
                        1
                ),
                ExpansionBudget.NONE,
                List.of("weekday mornings", "take guitar lessons")
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.NATURAL_BUT_BASIC, true),
                new GrammarProfile(GrammarSeverity.MINOR, List.of(), diagnosis.minimalCorrection(), true),
                new ContentProfile(
                        ContentLevel.MEDIUM,
                        new ContentSignals(true, false, false, false, true, true),
                        List.of(new StrengthSignal("DESCRIBES_ACTIVITY", "take guitar lessons"))
                ),
                new RewriteProfile("IMPROVE_NATURALNESS", null, diagnosis.rewriteTarget(), ExpansionBudget.NONE, diagnosis.regressionSensitiveFacts(), null)
        );
        SectionPolicy policy = new SectionPolicy(
                true,
                2,
                false,
                0,
                false,
                false,
                0,
                RefinementFocus.NATURALNESS,
                false,
                false,
                false,
                1,
                ModelAnswerMode.OPTIONAL_IF_ALREADY_GOOD,
                AttemptOverlayPolicy.NONE
        );
        GeneratedSections sections = new GeneratedSections(
                null,
                List.of("Clear sequencing of morning activities."),
                List.of(),
                List.of(),
                List.of(),
                null,
                null,
                null,
                List.of()
        );

        ValidationResult validation = (ValidationResult) ReflectionTestUtils.invokeMethod(
                client,
                "validateGeneratedSections",
                "On weekday mornings, I usually take guitar lessons.",
                diagnosis,
                answerProfile,
                policy,
                sections,
                List.of(SectionKey.STRENGTHS)
        );

        assertThat(validation.sanitizedSections().strengths()).isNotEmpty();
        assertThat(validation.sanitizedSections().strengths().get(0)).isNotBlank();
        assertThat(validation.sanitizedSections().strengths().get(0)).doesNotContain("Clear sequencing");
    }

    @Test
    void validateGeneratedSections_replaces_english_summary_with_korean_fallback() {
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses"
        );
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                82,
                AnswerBand.CONTENT_THIN,
                TaskCompletion.FULL,
                true,
                false,
                GrammarSeverity.MINOR,
                List.of(),
                "On weekday mornings, I usually take guitar lessons.",
                "ADD_DETAIL",
                null,
                new RewriteTarget(
                        "ADD_DETAIL",
                        "On weekday mornings, I usually take guitar lessons.",
                        1
                ),
                ExpansionBudget.ONE_DETAIL,
                List.of("weekday mornings", "take guitar lessons")
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.CONTENT_THIN, false),
                new GrammarProfile(GrammarSeverity.MINOR, List.of(), diagnosis.minimalCorrection(), true),
                new ContentProfile(
                        ContentLevel.MEDIUM,
                        new ContentSignals(true, false, false, false, true, true),
                        List.of(new StrengthSignal("DESCRIBES_ACTIVITY", "take guitar lessons"))
                ),
                new RewriteProfile("ADD_DETAIL", null, diagnosis.rewriteTarget(), ExpansionBudget.ONE_DETAIL, diagnosis.regressionSensitiveFacts(), null)
        );
        SectionPolicy policy = new SectionPolicy(
                true,
                2,
                false,
                0,
                true,
                false,
                0,
                RefinementFocus.DETAIL_BUILDING,
                true,
                false,
                false,
                1,
                ModelAnswerMode.ONE_STEP_UP,
                AttemptOverlayPolicy.NONE
        );
        GeneratedSections sections = new GeneratedSections(
                "Your routine description mentions waking up and preparing for the commute, but adding one more detail would make it richer.",
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                null,
                null,
                null,
                List.of()
        );

        ValidationResult validation = (ValidationResult) ReflectionTestUtils.invokeMethod(
                client,
                "validateGeneratedSections",
                "On weekday mornings, I usually take guitar lessons.",
                diagnosis,
                answerProfile,
                policy,
                sections,
                List.of(SectionKey.SUMMARY)
        );

        assertThat(validation.sanitizedSections().summary()).isNotBlank();
        assertThat(validation.sanitizedSections().summary()).doesNotContain("Your routine description");
    }

    @Test
    void sanitizeRewriteGuide_for_too_short_fragment_prefers_fill_in_skeleton() {
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses"
        );
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                41,
                AnswerBand.TOO_SHORT_FRAGMENT,
                TaskCompletion.PARTIAL,
                true,
                false,
                GrammarSeverity.MODERATE,
                List.of(),
                "I go to church.",
                "STATE_MAIN_ANSWER",
                null,
                new RewriteTarget(
                        "STATE_MAIN_ANSWER",
                        "I go to ____.",
                        1
                ),
                ExpansionBudget.NONE,
                List.of("go to church")
        );

        String sanitized = (String) ReflectionTestUtils.invokeMethod(
                client,
                "sanitizeRewriteGuide",
                "I go to church, and afterwards, I spend time with my family.",
                diagnosis,
                null
        );

        assertThat(sanitized).contains("I go to ____.");
        assertThat(sanitized).doesNotContain("my family");
        assertThat(sanitized).contains("____");
    }

    @Test
    void sanitizeRewriteGuide_for_blank_too_short_fragment_returns_instructional_skeleton() {
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses"
        );
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                35,
                AnswerBand.TOO_SHORT_FRAGMENT,
                TaskCompletion.PARTIAL,
                true,
                false,
                GrammarSeverity.MODERATE,
                List.of(),
                "I go to church.",
                "STATE_MAIN_ANSWER",
                null,
                new RewriteTarget(
                        "STATE_MAIN_ANSWER",
                        "On Sunday afternoons, I usually ____.",
                        1
                ),
                ExpansionBudget.NONE,
                List.of("go to church")
        );

        String sanitized = (String) ReflectionTestUtils.invokeMethod(
                client,
                "sanitizeRewriteGuide",
                "   ",
                diagnosis,
                null
        );

        assertThat(sanitized).contains("I go to ____.");
        assertThat(sanitized).contains("____");
    }

    @Test
    void generationBandGuidance_for_too_short_fragment_prefers_single_clause_instructional_skeleton() {
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses"
        );

        String guidance = (String) ReflectionTestUtils.invokeMethod(
                client,
                "generationBandGuidance",
                AnswerBand.TOO_SHORT_FRAGMENT,
                null
        );

        assertThat(guidance).contains("Prefer one blank and one clause");
        assertThat(guidance).contains("complete the blank with their real activity");
        assertThat(guidance).contains("Do not push expansion");
    }

    @Test
    void isLoopComplete_prefers_finishable_task_profile_over_score_threshold() {
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses"
        );
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                78,
                AnswerBand.CONTENT_THIN,
                TaskCompletion.FULL,
                true,
                true,
                GrammarSeverity.MINOR,
                List.of(),
                "I go to church and then in the afternoon, I usually meet friends at a cafe.",
                "ADD_DETAIL",
                null,
                new RewriteTarget(
                        "ADD_DETAIL",
                        "On Sunday afternoons, I usually go to church and then meet friends at a cafe.",
                        1
                ),
                ExpansionBudget.ONE_DETAIL,
                List.of("go to church", "meet friends at a cafe")
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.CONTENT_THIN, true),
                new GrammarProfile(GrammarSeverity.MINOR, List.of(), diagnosis.minimalCorrection(), true),
                new ContentProfile(
                        ContentLevel.MEDIUM,
                        new ContentSignals(true, false, false, false, true, true),
                        List.of()
                ),
                new RewriteProfile("ADD_DETAIL", null, diagnosis.rewriteTarget(), ExpansionBudget.ONE_DETAIL, diagnosis.regressionSensitiveFacts(), null)
        );

        boolean loopComplete = (boolean) ReflectionTestUtils.invokeMethod(
                client,
                "isLoopComplete",
                "I go to church and then in the afternoon, I usually meet friends at a cafe.",
                diagnosis,
                answerProfile,
                List.of(),
                List.of()
        );

        assertThat(loopComplete).isTrue();
    }

    @Test
    void isLoopComplete_requires_diagnosis_finishable_even_when_local_profile_looks_good() {
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses"
        );
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                84,
                AnswerBand.NATURAL_BUT_BASIC,
                TaskCompletion.FULL,
                true,
                false,
                GrammarSeverity.MINOR,
                List.of(),
                "On Sunday afternoons, I usually go to church and then meet friends at a cafe.",
                "IMPROVE_NATURALNESS",
                null,
                new RewriteTarget(
                        "IMPROVE_NATURALNESS",
                        "On Sunday afternoons, I usually go to church and then meet friends at a cafe.",
                        1
                ),
                ExpansionBudget.NONE,
                List.of("go to church", "meet friends at a cafe")
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.NATURAL_BUT_BASIC, true),
                new GrammarProfile(GrammarSeverity.MINOR, List.of(), diagnosis.minimalCorrection(), true),
                new ContentProfile(
                        ContentLevel.MEDIUM,
                        new ContentSignals(true, false, false, false, true, true),
                        List.of()
                ),
                new RewriteProfile("IMPROVE_NATURALNESS", null, diagnosis.rewriteTarget(), ExpansionBudget.NONE, diagnosis.regressionSensitiveFacts(), null)
        );

        boolean loopComplete = (boolean) ReflectionTestUtils.invokeMethod(
                client,
                "isLoopComplete",
                "On Sunday afternoons, I usually go to church and then meet friends at a cafe.",
                diagnosis,
                answerProfile,
                List.of(),
                List.of()
        );

        assertThat(loopComplete).isFalse();
    }

    @Test
    void isLoopComplete_still_vetoes_blocking_grammar_even_when_finishable_is_true() {
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses"
        );
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                88,
                AnswerBand.GRAMMAR_BLOCKING,
                TaskCompletion.FULL,
                true,
                true,
                GrammarSeverity.MAJOR,
                List.of(),
                "I often struggle to meet deadlines.",
                "FIX_BLOCKING_GRAMMAR",
                null,
                new RewriteTarget(
                        "FIX_BLOCKING_GRAMMAR",
                        "I often struggle to meet deadlines.",
                        1
                ),
                ExpansionBudget.NONE,
                List.of("meet deadlines")
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.GRAMMAR_BLOCKING, true),
                new GrammarProfile(
                        GrammarSeverity.MAJOR,
                        List.of(new GrammarIssue("LOCAL_GRAMMAR", "with meet the deadline", "to meet deadlines", true, GrammarSeverity.MAJOR)),
                        diagnosis.minimalCorrection(),
                        true
                ),
                new ContentProfile(
                        ContentLevel.MEDIUM,
                        new ContentSignals(true, false, false, false, true, false),
                        List.of()
                ),
                new RewriteProfile("FIX_BLOCKING_GRAMMAR", null, diagnosis.rewriteTarget(), ExpansionBudget.NONE, diagnosis.regressionSensitiveFacts(), null)
        );

        boolean loopComplete = (boolean) ReflectionTestUtils.invokeMethod(
                client,
                "isLoopComplete",
                "I often struggle with meet the deadline, to address I try to stay on track by write a to-do list.",
                diagnosis,
                answerProfile,
                List.of(),
                List.of()
        );

        assertThat(loopComplete).isFalse();
    }

    @Test
    void isLoopComplete_requires_submission_ready_clause_quality_even_when_finishable_is_true() {
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses"
        );
        String learnerAnswer = "I like ramen. it easy make and delicious.";
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                84,
                AnswerBand.CONTENT_THIN,
                TaskCompletion.FULL,
                true,
                true,
                GrammarSeverity.MINOR,
                List.of(),
                "I like ramen. It is easy to make and delicious.",
                "FIX_LOCAL_GRAMMAR",
                null,
                new RewriteTarget(
                        "FIX_LOCAL_GRAMMAR",
                        "I like ramen because it is easy to make and delicious.",
                        1
                ),
                ExpansionBudget.ONE_DETAIL,
                List.of("like ramen", "easy to make", "delicious")
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.CONTENT_THIN, true),
                new GrammarProfile(
                        GrammarSeverity.MINOR,
                        List.of(new GrammarIssue("LOCAL_GRAMMAR", "it easy make", "It is easy to make", false, GrammarSeverity.MINOR)),
                        diagnosis.minimalCorrection(),
                        true
                ),
                new ContentProfile(
                        ContentLevel.MEDIUM,
                        new ContentSignals(true, true, false, false, false, false),
                        List.of()
                ),
                new RewriteProfile("FIX_LOCAL_GRAMMAR", null, diagnosis.rewriteTarget(), ExpansionBudget.ONE_DETAIL, diagnosis.regressionSensitiveFacts(), null)
        );

        boolean loopComplete = (boolean) ReflectionTestUtils.invokeMethod(
                client,
                "isLoopComplete",
                learnerAnswer,
                diagnosis,
                answerProfile,
                List.of(),
                List.of(
                        new GrammarFeedbackItemDto("it", "It", "?????筌???????怨뚮뼺??????轅붽틓??????繹먮끏堉????????????⑤９苡?????"),
                        new GrammarFeedbackItemDto("easy make", "is easy to make", "???? ???濚밸Ŧ援?????筌????????繹????椰??????????????????밸븶???????용츧????ロ뒌??")
                )
        );

        assertThat(loopComplete).isFalse();
    }

    @Test
    void shouldRetryFailure_keeps_strengths_and_summary_as_optional_sections() {
        FeedbackRetryPolicy retryPolicy = new FeedbackRetryPolicy();

        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                72,
                AnswerBand.CONTENT_THIN,
                TaskCompletion.FULL,
                true,
                false,
                GrammarSeverity.MINOR,
                List.of(),
                "One health goal I have this year is to improve my diet. It's important to me because I want to stay healthy.",
                "ADD_DETAIL",
                null,
                new RewriteTarget(
                        "ADD_DETAIL",
                        "One health goal I have this year is to improve my diet. It's important to me because I want to stay healthy.",
                        1
                ),
                ExpansionBudget.ONE_DETAIL,
                List.of("improve my diet", "stay healthy")
        );
        SectionPolicy policy = new SectionPolicy(
                true,
                2,
                true,
                1,
                true,
                true,
                2,
                RefinementFocus.DETAIL_BUILDING,
                true,
                true,
                true,
                2,
                ModelAnswerMode.ONE_STEP_UP,
                AttemptOverlayPolicy.NONE
        );

        boolean retryStrengths = retryPolicy.shouldRetry(
                new ValidationFailure(SectionKey.STRENGTHS, ValidationFailureCode.LOW_VALUE_SECTION, "missing strengths"),
                diagnosis,
                policy
        );
        boolean retrySummary = retryPolicy.shouldRetry(
                new ValidationFailure(SectionKey.SUMMARY, ValidationFailureCode.LOW_VALUE_SECTION, "missing summary"),
                diagnosis,
                policy
        );

        assertThat(retryStrengths).isFalse();
        assertThat(retrySummary).isFalse();
    }

    @Test
    void shouldRetryFailure_does_not_retry_generic_improvement_or_rewrite_guide_under_minimal_validation() {
        FeedbackRetryPolicy retryPolicy = new FeedbackRetryPolicy();
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                72,
                AnswerBand.CONTENT_THIN,
                TaskCompletion.FULL,
                true,
                false,
                GrammarSeverity.MINOR,
                List.of(),
                "I like bookstores because they feel cozy and calm.",
                "ADD_DETAIL",
                null,
                new RewriteTarget(
                        "ADD_DETAIL",
                        "I like bookstores because they feel cozy and calm.",
                        1
                ),
                ExpansionBudget.ONE_DETAIL,
                List.of("bookstores", "cozy and calm")
        );
        SectionPolicy policy = new SectionPolicy(
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

        boolean retryImprovement = retryPolicy.shouldRetry(
                new ValidationFailure(SectionKey.IMPROVEMENT, ValidationFailureCode.GENERIC_TEXT, "generic improvement"),
                diagnosis,
                policy
        );
        boolean retryRewriteGuide = retryPolicy.shouldRetry(
                new ValidationFailure(SectionKey.REWRITE_GUIDE, ValidationFailureCode.GENERIC_TEXT, "generic rewrite guide"),
                diagnosis,
                policy
        );

        assertThat(retryImprovement).isFalse();
        assertThat(retryRewriteGuide).isFalse();
    }

    @Test
    void validateGeneratedSections_keeps_generic_improvement_and_rewrite_guide_when_they_are_structurally_valid() {
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses"
        );
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                72,
                AnswerBand.CONTENT_THIN,
                TaskCompletion.FULL,
                true,
                false,
                GrammarSeverity.MINOR,
                List.of(),
                "I like bookstores because they feel cozy and calm.",
                "ADD_DETAIL",
                "FIX_LOCAL_GRAMMAR",
                new RewriteTarget(
                        "ADD_DETAIL",
                        "I like bookstores because they feel cozy and calm.",
                        1
                ),
                ExpansionBudget.ONE_DETAIL,
                List.of("bookstores", "cozy and calm")
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.CONTENT_THIN, false),
                new GrammarProfile(GrammarSeverity.MINOR, List.of(), diagnosis.minimalCorrection(), true),
                new ContentProfile(
                        ContentLevel.LOW,
                        new ContentSignals(true, true, false, true, false, false),
                        List.of()
                ),
                new RewriteProfile("ADD_DETAIL", "FIX_LOCAL_GRAMMAR", diagnosis.rewriteTarget(), ExpansionBudget.ONE_DETAIL, diagnosis.regressionSensitiveFacts(), null)
        );
        SectionPolicy policy = new SectionPolicy(
                true, 2,
                true, 1,
                true,
                true, 2,
                RefinementFocus.DETAIL_BUILDING,
                true,
                true,
                false,
                2,
                ModelAnswerMode.ONE_STEP_UP,
                AttemptOverlayPolicy.NONE
        );
        GeneratedSections sections = new GeneratedSections(
                "질문에 맞는 핵심 내용은 보여요.",
                List.of("이유를 적어 답의 흐름이 자연스러워요."),
                List.of(),
                List.of(new CorrectionDto(
                        "표현을 조금 더 자연스럽게 다듬어 보세요.",
                        "표현을 조금 더 자연스럽게 고친 뒤, 이유나 방법 한 가지를 더 붙여 보세요."
                )),
                List.of(),
                "\"I like bookstore and...\" 표현을 조금 더 자연스럽게 고친 뒤, 이유나 방법 한 가지를 더 붙여 보세요.",
                null,
                null,
                List.of()
        );

        ValidationResult validation = (ValidationResult) ReflectionTestUtils.invokeMethod(
                client,
                "validateGeneratedSections",
                "I like bookstore. it is relaxing and good. because i like cozy and calm.",
                diagnosis,
                answerProfile,
                policy,
                sections,
                List.of(SectionKey.SUMMARY, SectionKey.STRENGTHS, SectionKey.IMPROVEMENT, SectionKey.REWRITE_GUIDE)
        );

        assertThat(validation.shouldRetry()).isFalse();
        assertThat(validation.sanitizedSections().corrections()).isNotEmpty();
        assertThat(validation.sanitizedSections().rewriteGuide()).isNotBlank();
    }

    @Test
    void mergeWithMinimalFallback_keeps_optional_generation_sections_without_generic_overwrite() {
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses"
        );
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                74,
                AnswerBand.CONTENT_THIN,
                TaskCompletion.FULL,
                true,
                false,
                GrammarSeverity.MINOR,
                List.of(),
                "I like bookstores because they feel cozy and calm.",
                "ADD_DETAIL",
                null,
                new RewriteTarget(
                        "ADD_DETAIL",
                        "I like bookstores because they feel cozy and calm.",
                        1
                ),
                ExpansionBudget.ONE_DETAIL,
                List.of("like bookstores", "cozy and calm")
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.CONTENT_THIN, false),
                new GrammarProfile(GrammarSeverity.MINOR, List.of(), diagnosis.minimalCorrection(), true),
                new ContentProfile(
                        ContentLevel.LOW,
                        new ContentSignals(true, true, false, false, false, false),
                        List.of()
                ),
                new RewriteProfile("ADD_DETAIL", null, diagnosis.rewriteTarget(), ExpansionBudget.ONE_DETAIL, diagnosis.regressionSensitiveFacts(), null)
        );
        SectionPolicy policy = new SectionPolicy(
                true,
                2,
                false,
                0,
                true,
                true,
                2,
                RefinementFocus.DETAIL_BUILDING,
                true,
                true,
                true,
                2,
                ModelAnswerMode.ONE_STEP_UP,
                AttemptOverlayPolicy.NONE
        );
        GeneratedSections generated = new GeneratedSections(
                "질문에 맞는 핵심 내용은 보여요.",
                List.of("이유를 함께 적어 답의 흐름이 자연스러워요."),
                List.of(),
                List.of(),
                List.of(),
                null,
                null,
                null,
                List.of()
        );
        GeneratedSections fallback = new GeneratedSections(
                "fallback summary",
                List.of("fallback strength"),
                List.of(),
                List.of(new CorrectionDto("표현을 조금 더 자연스럽게 다듬어 보세요.", "이유나 방법 한 가지를 더 붙여 보세요.")),
                List.of(),
                "\"I like bookstores because ...\" 를 바탕으로 한 가지 이유를 더 써 보세요.",
                "I like bookstores because they feel cozy and calm.",
                null,
                List.of()
        );

        GeneratedSections merged = (GeneratedSections) ReflectionTestUtils.invokeMethod(
                client,
                "mergeWithMinimalFallback",
                generated,
                fallback,
                diagnosis,
                answerProfile,
                policy
        );

        assertThat(merged.corrections()).isEmpty();
        assertThat(merged.rewriteGuide()).isNull();
        assertThat(merged.summary()).isEqualTo("질문에 맞는 핵심 내용은 보여요.");
    }

    @Test
    void buildDeterministicFallbackSections_returns_usable_sections_without_generation_call() {
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses"
        );
        PromptDto prompt = new PromptDto(
                "prompt-1",
                "Health Goal - Diet",
                "B",
                "Explain one health goal you want to reach this year and why it matters to you.",
                "?????????????살퓢?????怨몃룭???勇????猷고??燁?????? ??????거??????輿?????????????거??????????????거??????????????嶺뚮씚維?????饔낅떽???????? ????????????겸뵛?????????????????? ??????거????????????????熬곣뫖利당춯??????????",
                "Explain the goal and why it matters."
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.CONTENT_THIN, false),
                new GrammarProfile(
                        GrammarSeverity.MINOR,
                        List.of(new GrammarIssue("PHRASING", "I have this is", "I have this year is", false, GrammarSeverity.MINOR)),
                        "One health goal I have this year is to improve my diet. It's important to me because I want to stay healthy.",
                        true
                ),
                new ContentProfile(
                        ContentLevel.LOW,
                        new ContentSignals(true, true, false, false, false, true),
                        List.of(new StrengthSignal("HAS_REASON", "It's important for me to stay healthy"))
                ),
                new RewriteProfile(
                        "ADD_DETAIL",
                        null,
                        new RewriteTarget(
                                "ADD_DETAIL",
                                "One health goal I have this year is to improve my diet. It's important to me because I want to stay healthy.",
                                1
                        ),
                        ExpansionBudget.ONE_DETAIL,
                        List.of("improve my diet", "stay healthy"),
                        null
                )
        );
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                78,
                AnswerBand.CONTENT_THIN,
                TaskCompletion.FULL,
                true,
                false,
                GrammarSeverity.MINOR,
                List.of(),
                "One health goal I have this year is to improve my diet. It's important to me because I want to stay healthy.",
                "ADD_DETAIL",
                null,
                new RewriteTarget(
                        "ADD_DETAIL",
                        "One health goal I have this year is to improve my diet. It's important to me because I want to stay healthy.",
                        1
                ),
                ExpansionBudget.ONE_DETAIL,
                List.of("improve my diet", "stay healthy")
        );
        SectionPolicy policy = new SectionPolicy(
                true,
                2,
                true,
                1,
                true,
                true,
                2,
                RefinementFocus.DETAIL_BUILDING,
                true,
                true,
                true,
                2,
                ModelAnswerMode.ONE_STEP_UP,
                AttemptOverlayPolicy.NONE
        );

        GeneratedSections sections = (GeneratedSections) ReflectionTestUtils.invokeMethod(
                client,
                "buildDeterministicFallbackSections",
                prompt,
                "One health goal I have this is to diet. It's important for me to stay healthy.",
                diagnosis,
                answerProfile,
                policy
        );

        assertThat(sections.strengths()).isNotEmpty();
        assertThat(sections.corrections()).isNotEmpty();
        assertThat(sections.rewriteGuide()).isNotBlank();
        assertThat(sections.summary()).satisfies(summary -> {
            if (summary != null) {
                assertThat(summary).isNotBlank();
            }
        });
    }
}
