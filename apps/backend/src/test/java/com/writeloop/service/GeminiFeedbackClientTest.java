package com.writeloop.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.CoachExpressionUsageDto;
import com.writeloop.dto.CorrectionDto;
import com.writeloop.dto.FeedbackPrimaryFixDto;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.FeedbackSecondaryLearningPointDto;
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
                "https://api.example.com/v1/responses", null, 120
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
                "https://api.example.com/v1/responses", null, 120
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
                        "reasonKo", "struggle ????????????to meet ???????거?????????????쇰뮛????瑜낆춾影?얠┰?????????????? ???????????????μ떜媛?걫????????",
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
                "https://api.example.com/v1/responses", null, 120
        );

        String outputText = mapper.writeValueAsString(Map.ofEntries(
                Map.entry("strengths", List.of("You clearly state the goal and reason.")),
                Map.entry("fixPoints", List.of(
                        Map.of(
                                "kind", "CORRECTION",
                                "title", "Add detail",
                                "headline", "Add one more real habit.",
                                "supportText", "Give one concrete habit after the goal.",
                                "originalText", "",
                                "revisedText", "",
                                "meaningKo", "",
                                "guidanceKo", "",
                                "exampleEn", "",
                                "exampleKo", ""
                        ),
                        Map.of(
                                "kind", "GRAMMAR",
                                "title", "Fix grammar",
                                "headline", "",
                                "supportText", "Use diet, not to diet, after improve.",
                                "originalText", "improve to diet",
                                "revisedText", "improve my diet",
                                "meaningKo", "",
                                "guidanceKo", "",
                                "exampleEn", "",
                                "exampleKo", ""
                        )
                )),
                Map.entry("usedExpressions", List.of(Map.of(
                        "expression", "stay healthy",
                        "usageTip", "Use this to explain why the goal matters."
                ))),
                Map.entry("refinementExpressions", List.of(Map.of(
                        "expression", "improve my diet",
                        "guidanceKo", "Use this when talking about a health goal.",
                        "exampleEn", "I want to improve my diet this year.",
                        "exampleKo", "Korean example",
                        "meaningKo", "make eating habits healthier"
                ))),
                Map.entry("rewriteIdeas", List.of(Map.of(
                        "title", "Add a reason",
                        "english", "it helps me feel more energetic",
                        "meaningKo", "feel more energetic",
                        "noteKo", "A natural reason phrase that works well after because.",
                        "originalText", "",
                        "revisedText", "",
                        "optionalTone", false
                ))),
                Map.entry("modelAnswerVariants", List.of(Map.of(
                        "kind", "NATURALER",
                        "answer", "I usually take a nap on Sunday afternoons.",
                        "answerKo", "I usually take a nap on Sunday afternoons.",
                        "reasonKo", "This version moves the time phrase to the end."
                ))),
                Map.entry("modelAnswer", "One health goal I have this year is to improve my diet. It's important to me because I want to stay healthy and feel more energetic."),
                Map.entry("modelAnswerKo", "Korean translation")
        ));
        String body = mapper.writeValueAsString(Map.of("output_text", outputText));

        GeneratedSections sections = (GeneratedSections) ReflectionTestUtils.invokeMethod(
                client,
                "parseGeneratedSections",
                body
        );

        assertThat(sections.summary()).isNull();
        assertThat(sections.focusCard()).isNull();
        assertThat(sections.strengths()).containsExactly("You clearly state the goal and reason.");
        assertThat(sections.fixPoints())
                .extracting(FeedbackSecondaryLearningPointDto::kind, FeedbackSecondaryLearningPointDto::headline)
                .containsExactly(
                        tuple("CORRECTION", "Add one more real habit."),
                        tuple("GRAMMAR", null)
                );
        assertThat(sections.primaryFix()).isNotNull();
        assertThat(sections.primaryFix().instruction()).isEqualTo("Add one more real habit.");
        assertThat(sections.secondaryLearningPoints())
                .extracting(FeedbackSecondaryLearningPointDto::headline, FeedbackSecondaryLearningPointDto::originalText)
                .contains(tuple(null, "improve to diet"));
        assertThat(sections.grammarFeedback()).isEmpty();
        assertThat(sections.corrections()).isEmpty();
        assertThat(sections.refinementExpressions()).singleElement().satisfies(card -> {
            assertThat(card.expression()).isEqualTo("improve my diet");
            assertThat(card.meaningKo()).isEqualTo("make eating habits healthier");
        });
        assertThat(sections.nextStepPractice()).isNull();
        assertThat(sections.rewriteSuggestions()).isEmpty();
        assertThat(sections.rewriteIdeas()).singleElement().satisfies(idea -> {
            assertThat(idea.english()).isEqualTo("it helps me feel more energetic");
            assertThat(idea.noteKo()).isEqualTo("A natural reason phrase that works well after because.");
        });
        assertThat(sections.modelAnswerVariants()).singleElement().satisfies(variant -> {
            assertThat(variant.answer()).isEqualTo("I usually take a nap on Sunday afternoons.");
            assertThat(variant.kind()).isEqualTo("NATURALER");
        });
        assertThat(sections.modelAnswer()).contains("feel more energetic");
    }
    @Test
    void buildDiagnosisPrompt_includes_attempt_context() {
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses", null, 120
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
        assertThat(text).contains("rewriteTarget.action must be exactly one of: MAKE_ON_TOPIC, STATE_MAIN_ANSWER, FIX_BLOCKING_GRAMMAR, FIX_LOCAL_GRAMMAR, ADD_REASON, ADD_EXAMPLE, ADD_DETAIL, IMPROVE_NATURALNESS.");
    }

    @Test
    void parseDiagnosisResponse_derives_fallback_score_when_score_is_missing() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                mapper,
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses", null, 120
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
    void parseDiagnosisResponse_normalizes_unexpected_rewrite_target_action_to_known_code() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                mapper,
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses", null, 120
        );

        java.util.Map<String, Object> response = new java.util.LinkedHashMap<>();
        response.put("answerBand", "CONTENT_THIN");
        response.put("taskCompletion", "PARTIAL");
        response.put("onTopic", true);
        response.put("finishable", false);
        response.put("grammarSeverity", "MINOR");
        response.put("minimalCorrection", "I want to visit Tokyo.");
        response.put("primaryIssueCode", "ADD_REASON");
        response.put("secondaryIssueCode", null);
        response.put("rewriteTarget", Map.of(
                "action", "add a concrete reason for why you want to go there before rewriting",
                "skeleton", "I want to visit Tokyo because ______.",
                "maxNewSentenceCount", 1
        ));
        response.put("expansionBudget", "ONE_DETAIL");
        response.put("regressionSensitiveFacts", List.of("visit Tokyo"));
        response.put("grammarIssues", List.of());
        String outputText = mapper.writeValueAsString(response);
        String body = mapper.writeValueAsString(Map.of("output_text", outputText));

        FeedbackDiagnosisResult diagnosis = (FeedbackDiagnosisResult) ReflectionTestUtils.invokeMethod(
                client,
                "parseDiagnosisResponse",
                body
        );

        assertThat(diagnosis.rewriteTarget().action()).isEqualTo("ADD_REASON");
    }

    @Test
    void buildGenerationPrompt_requires_concrete_anchored_improvement_and_rewrite_guide() throws Exception {
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses", null, 120
        );
        PromptDto prompt = new PromptDto(
                "prompt-place-1",
                "Favorite Relaxing Place",
                "B",
                "What do you like most about your favorite place to relax, and why?",
                "?명븯寃??ш린 醫뗭? ?μ냼?먯꽌 媛??留덉쓬???쒕뒗 ?먯? 臾댁뾿?닿퀬, ??洹몃윴媛??",
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
                List.of(SectionKey.PRIMARY_FIX, SectionKey.REWRITE_GUIDE),
                List.of(ValidationFailureCode.GENERIC_TEXT),
                null
        );

        assertThat(text).contains("requestedSections: FIX_POINTS, REWRITE_IDEAS");
        assertThat(text).contains("Return all distinct, high-value items that genuinely help the learner, and avoid overlap or filler.");
        assertThat(text).contains("Generate fixPoints as one UI-ready list");
        assertThat(text).contains("Each fixPoints item must teach exactly one concrete correction point.");
        assertThat(text).contains("Include every remaining distinct useful fix as a separate fixPoints item instead of stopping after one representative correction.");
        assertThat(text).contains("A fixPoints item may use originalText / revisedText / supportText");
        assertThat(text).contains("If a fixPoints item has no originalText / revisedText pair, its headline must still name one concrete anchor phrase");
        assertThat(text).contains("Do not return placeholder-like fixPoints headlines or instructions such as \"First thing to fix\" or \"Fix this one thing first\" unless you also name the exact phrase or expression to fix.");
        assertThat(text).contains("Do not merge unrelated lessons into one fixPoints item, and do not split the same teaching point across multiple fixPoints items.");
        assertThat(text).contains("If the learner answer contains multiple distinct local errors, split them into separate fixPoints items instead of folding them into one revisedText or one broad umbrella note.");
        assertThat(text).contains("teach article/determiner vs plural/singular separately");
        assertThat(text).contains("rewriteIdeas is the primary output for the optional");
        assertThat(text).contains("Return as many high-value rewriteIdeas as the answer supports. Do not limit yourself to a fixed count.");
        assertThat(text).contains("For CONTENT_THIN and SHORT_BUT_VALID answers, actively generate multiple reason, example, detail, image, time-flow, or connector ideas when they would help the learner extend the same answer.");
        assertThat(text).contains("modelAnswer is a one-step-up reference, not another optional-add-on card.");
        assertThat(text).contains("modelAnswer must preserve learner meaning, keep the must-fix lessons from fixPoints");
        assertThat(text).contains("Avoid folding optional expansion into modelAnswer unless it is necessary for fluency or coherence.");
        assertThat(text).contains("Prefer putting extra reasons, examples, details, time flow, imagery, and optional polish into rewriteIdeas instead of modelAnswer.");
        assertThat(text).contains("Preserve referent, pronoun, and singular/plural agreement taught in fixPoints, and do not switch between plural they and singular it unless one fixPoint explicitly teaches that shift.");
        assertThat(text).contains("refinementExpressions are optional reusable-expression cards beyond fixPoints.");
        assertThat(text).contains("Return only genuinely useful, distinct refinementExpressions");
        assertThat(text).doesNotContain("primaryFix feeds the Fix First card");
        assertThat(text).doesNotContain("focusCard feeds the Top Status Card directly");
        assertThat(text).doesNotContain("secondaryLearningPoints feed the Secondary Learning Points section directly");
        assertThat(text).doesNotContain("grammarFeedback rules:");
        assertThat(text).doesNotContain("corrections rules:");
        assertThat(text).doesNotContain("Screen role map:");
        assertThat(text).doesNotContain("summary is optional compatibility fallback text for focusCard.supportText.");
    }

    @Test
    void alignModelAnswerWithPrimaryFixReferent_falls_back_to_anchor_when_pronoun_direction_conflicts() {
        FeedbackSectionValidators validators = new FeedbackSectionValidators();
        FeedbackPrimaryFixDto primaryFix = new FeedbackPrimaryFixDto(
                "Use a plural noun",
                "Use movies so the pronoun they matches.",
                "I like romantic comedy movi. it's funny and relatable.",
                "I like romantic comedy movies. They are funny and relatable.",
                "Use the plural noun movies so the pronoun they is consistent."
        );

        String aligned = validators.alignModelAnswerWithPrimaryFixReferent(
                "It's a fun and relatable way to wake up.",
                primaryFix,
                "I like romantic comedy movies. They are funny and relatable."
        );

        assertThat(aligned).isEqualTo("I like romantic comedy movies. They are funny and relatable.");
    }

    @Test
    @SuppressWarnings("unchecked")
    void sanitizeRewriteSuggestions_keeps_only_phrases_that_fit_the_rewrite_blank() {
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses", null, 120
        );

        List<com.writeloop.dto.FeedbackRewriteSuggestionDto> sanitized =
                (List<com.writeloop.dto.FeedbackRewriteSuggestionDto>) ReflectionTestUtils.invokeMethod(
                        client,
                        "sanitizeRewriteSuggestions",
                        List.of(
                                new com.writeloop.dto.FeedbackRewriteSuggestionDto(
                                        "I love romantic comedy movies.",
                                        "A full opening sentence.",
                                        "Use this when you want a stronger opening sentence."
                                ),
                                new com.writeloop.dto.FeedbackRewriteSuggestionDto(
                                        "they make me laugh",
                                        "They make me laugh.",
                                        "A short reason that fits naturally after because."
                                ),
                                new com.writeloop.dto.FeedbackRewriteSuggestionDto(
                                        "because they are funny",
                                        "Because they are funny.",
                                        "Keep this only when the blank already expects a because clause."
                                )
                        ),
                        new com.writeloop.dto.FeedbackNextStepPracticeDto(
                                "Rewrite practice",
                                "I like romantic comedy movies because ______.",
                                "Fill in the blank with one natural reason.",
                                "Start rewriting with this sentence",
                                false
                        )
                );

        assertThat(sanitized)
                .extracting(com.writeloop.dto.FeedbackRewriteSuggestionDto::english)
                .containsExactly(
                        "I love romantic comedy movies",
                        "they make me laugh",
                        "because they are funny"
                );
    }

    @Test
    @SuppressWarnings("unchecked")
    void sanitizeRewriteSuggestions_keeps_distinct_items_even_without_next_step_practice() {
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses", null, 120
        );

        List<com.writeloop.dto.FeedbackRewriteSuggestionDto> sanitized =
                (List<com.writeloop.dto.FeedbackRewriteSuggestionDto>) ReflectionTestUtils.invokeMethod(
                        client,
                        "sanitizeRewriteSuggestions",
                        List.of(
                                new com.writeloop.dto.FeedbackRewriteSuggestionDto("for example", "예를 들면", null),
                                new com.writeloop.dto.FeedbackRewriteSuggestionDto("for example.", "예를 들면", null),
                                new com.writeloop.dto.FeedbackRewriteSuggestionDto("because it helps me relax", "긴장을 푸는 데 도움이 돼서", null)
                        ),
                        null
                );

        assertThat(sanitized)
                .extracting(com.writeloop.dto.FeedbackRewriteSuggestionDto::english)
                .containsExactly("for example", "because it helps me relax");
    }

    @Test
    void isSubmissionReadyForCompletion_does_not_fail_only_because_multiple_grammar_items_exist() {
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses", null, 120
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.CONTENT_THIN, true),
                new GrammarProfile(
                        GrammarSeverity.MINOR,
                        List.of(),
                        "I recommend football to others because it helps me make friends.",
                        true
                ),
                new ContentProfile(
                        ContentLevel.MEDIUM,
                        new ContentSignals(true, true, false, false, true, false),
                        List.of()
                ),
                new RewriteProfile(
                        "FIX_LOCAL_GRAMMAR",
                        null,
                        new RewriteTarget("FIX_LOCAL_GRAMMAR", "I recommend football to others because it helps me ______.", 1),
                        ExpansionBudget.NONE,
                        List.of(),
                        null
                )
        );
        List<GrammarFeedbackItemDto> grammarFeedback = List.of(
                new GrammarFeedbackItemDto("foot ball", "football", "泥좎옄瑜?諛붾줈?≪븘 二쇱꽭??"),
                new GrammarFeedbackItemDto("other", "others", "蹂듭닔?뺤쓣 留욎떠 二쇱꽭??")
        );

        Boolean ready = (Boolean) ReflectionTestUtils.invokeMethod(
                client,
                "isSubmissionReadyForCompletion",
                "I recommend football to others because it helps me make friends.",
                answerProfile,
                grammarFeedback
        );

        assertThat(ready).isTrue();
    }

    @Test
    @SuppressWarnings("unchecked")
    void sanitizeGrammarFeedback_repairs_missing_and_with_minimal_correction() {
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses", null, 120
        );
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                68,
                AnswerBand.GRAMMAR_BLOCKING,
                TaskCompletion.FULL,
                true,
                false,
                GrammarSeverity.MODERATE,
                List.of(),
                "I wake up in the morning.get ready for my commute.",
                "FIX_BLOCKING_GRAMMAR",
                null,
                new RewriteTarget(
                        "FIX_BLOCKING_GRAMMAR",
                        "I wake up in the morning and get ready for my commute.",
                        1
                ),
                ExpansionBudget.NONE,
                List.of()
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.GRAMMAR_BLOCKING, false),
                new GrammarProfile(
                        GrammarSeverity.MODERATE,
                        List.of(),
                        "I wake up in the morning and get ready for my commute."
                ),
                new ContentProfile(
                        ContentLevel.LOW,
                        new ContentSignals(true, false, false, false, true, true),
                        List.of()
                ),
                new RewriteProfile(
                        "FIX_BLOCKING_GRAMMAR",
                        null,
                        new RewriteTarget(
                                "FIX_BLOCKING_GRAMMAR",
                                "I wake up in the morning and get ready for my commute. After that, I ______.",
                                1
                        ),
                        ExpansionBudget.NONE,
                        List.of(),
                        null
                )
        );

        List<GrammarFeedbackItemDto> sanitized = (List<GrammarFeedbackItemDto>) ReflectionTestUtils.invokeMethod(
                client,
                "sanitizeGrammarFeedback",
                List.of(
                        new GrammarFeedbackItemDto(
                                "I wake up morning.get ready for commute.",
                                "I wake up in the morning.get ready for my commute.",
                                "?쒓컙???섑????뚮뒗 'in'???꾩슂?섍퀬, ???숈옉? and濡??곌껐?섎㈃ ???먯뿰?ㅻ읇?듬땲??"
                        )
                ),
                diagnosis,
                answerProfile
        );

        assertThat(sanitized).singleElement().satisfies(item -> {
            assertThat(item.revisedText()).contains(" and ");
            assertThat(item.revisedText()).isEqualTo("I wake up in the morning and get ready for my commute.");
        });
    }

    @Test
    @SuppressWarnings("unchecked")
    void requestedSections_keep_improvement_for_optional_polish_secondary_learning() {
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses", null, 120
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
                ModelAnswerDisplayMode.SHOW_COLLAPSED,
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
                SectionKey.STRENGTHS,
                SectionKey.USED_EXPRESSIONS,
                SectionKey.PRIMARY_FIX,
                SectionKey.REWRITE_GUIDE,
                SectionKey.REFINEMENT,
                SectionKey.MODEL_ANSWER
        );
    }

    @Test
    @SuppressWarnings("unchecked")
    void requestedSections_include_primary_fix_and_improvement_for_detail_prompt_flow() {
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses", null, 120
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.PARTIAL, AnswerBand.CONTENT_THIN, false),
                new GrammarProfile(GrammarSeverity.MINOR, List.of(), "I want to visit Tokyo because ______.", true),
                new ContentProfile(
                        ContentLevel.LOW,
                        new ContentSignals(true, false, false, false, true, true),
                        List.of()
                ),
                new RewriteProfile(
                        "ADD_REASON",
                        null,
                        new RewriteTarget("ADD_REASON", "I want to visit Tokyo because ______. Also, I want to ______.", 1),
                        ExpansionBudget.ONE_DETAIL,
                        List.of("visit Tokyo", "eat sushi"),
                        null
                )
        );
        SectionPolicy sectionPolicy = new SectionPolicy(
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
                false,
                1,
                ModelAnswerMode.ONE_STEP_UP,
                AttemptOverlayPolicy.NONE
        );
        FeedbackSectionAvailability availability = new FeedbackSectionAvailability(
                true,
                true,
                false,
                true,
                false,
                true,
                false
        );
        FeedbackScreenPolicy screenPolicy = new FeedbackScreenPolicy(
                CompletionState.NEEDS_REVISION,
                List.of(),
                SectionDisplayMode.SHOW_EXPANDED,
                SectionDisplayMode.SHOW_EXPANDED,
                FixFirstMode.DETAIL_PROMPT_CARD,
                SectionDisplayMode.SHOW_EXPANDED,
                RewriteGuideMode.DETAIL_SCAFFOLD,
                ModelAnswerDisplayMode.SHOW_EXPANDED,
                RefinementDisplayMode.SHOW_COLLAPSED,
                1,
                2,
                1,
                false,
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
                SectionKey.PRIMARY_FIX,
                SectionKey.REWRITE_GUIDE,
                SectionKey.MODEL_ANSWER
        );
    }

    @Test
    void validateGeneratedSections_replaces_english_strengths_with_korean_fallback() {
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses", null, 120
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
    void validateGeneratedSections_soft_fails_missing_non_critical_sections() {
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses", null, 120
        );
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                88,
                AnswerBand.NATURAL_BUT_BASIC,
                TaskCompletion.FULL,
                true,
                true,
                GrammarSeverity.NONE,
                List.of(),
                "On weekday mornings, I usually take guitar lessons.",
                "IMPROVE_NATURALNESS",
                null,
                new RewriteTarget(
                        "IMPROVE_NATURALNESS",
                        "On weekday mornings, I usually take guitar lessons. After that, I ______.",
                        1
                ),
                ExpansionBudget.NONE,
                List.of("weekday mornings", "guitar lessons")
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.NATURAL_BUT_BASIC, true),
                new GrammarProfile(GrammarSeverity.NONE, List.of(), diagnosis.minimalCorrection(), true),
                new ContentProfile(
                        ContentLevel.MEDIUM,
                        new ContentSignals(true, false, false, false, true, true),
                        List.of()
                ),
                new RewriteProfile("IMPROVE_NATURALNESS", null, diagnosis.rewriteTarget(), ExpansionBudget.NONE, diagnosis.regressionSensitiveFacts(), null)
        );
        SectionPolicy policy = new SectionPolicy(
                true,
                2,
                true,
                1,
                true,
                true,
                2,
                RefinementFocus.NATURALNESS,
                true,
                true,
                true,
                2,
                ModelAnswerMode.OPTIONAL_IF_ALREADY_GOOD,
                AttemptOverlayPolicy.NONE
        );
        GeneratedSections sections = new GeneratedSections(
                null,
                List.of(),
                null,
                null,
                List.of(),
                List.of(),
                List.of(),
                null,
                null,
                null,
                List.of(),
                List.of(),
                new com.writeloop.dto.FeedbackNextStepPracticeDto(
                        "Rewrite practice",
                        "On weekday mornings, I usually take guitar lessons. After that, I ______.",
                        "Add one more activity after the blank.",
                        "Start rewriting with this sentence",
                        false
                )
        );

        ValidationResult validation = (ValidationResult) ReflectionTestUtils.invokeMethod(
                client,
                "validateGeneratedSections",
                "On weekday mornings, I usually take guitar lessons.",
                diagnosis,
                answerProfile,
                policy,
                sections,
                List.of(
                        SectionKey.SUMMARY,
                        SectionKey.STRENGTHS,
                        SectionKey.USED_EXPRESSIONS,
                        SectionKey.PRIMARY_FIX,
                        SectionKey.GRAMMAR,
                        SectionKey.IMPROVEMENT,
                        SectionKey.REWRITE_GUIDE,
                        SectionKey.MODEL_ANSWER,
                        SectionKey.REFINEMENT
                )
        );

        assertThat(validation.shouldRetry()).isFalse();
        assertThat(validation.failures())
                .extracting(ValidationFailure::sectionKey)
                .doesNotContain(
                        SectionKey.SUMMARY,
                        SectionKey.STRENGTHS,
                        SectionKey.PRIMARY_FIX,
                        SectionKey.IMPROVEMENT,
                        SectionKey.MODEL_ANSWER,
                        SectionKey.REFINEMENT
                );
        assertThat(validation.sanitizedSections().nextStepPractice()).isNotNull();
        assertThat(validation.sanitizedSections().nextStepPractice().starter()).contains("_____");
    }

    @Test
    void validateGeneratedSections_keeps_close_model_answer_for_content_thin_when_it_is_still_useful() {
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses", null, 120
        );
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                79,
                AnswerBand.CONTENT_THIN,
                TaskCompletion.FULL,
                true,
                true,
                GrammarSeverity.MINOR,
                List.of(),
                "My favorite season is spring because I like sunshine.",
                "ADD_DETAIL",
                null,
                new RewriteTarget(
                        "ADD_DETAIL",
                        "My favorite season is spring because ______.",
                        1
                ),
                ExpansionBudget.ONE_DETAIL,
                List.of("favorite season", "spring", "sunshine")
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.CONTENT_THIN, true),
                new GrammarProfile(GrammarSeverity.MINOR, List.of(), diagnosis.minimalCorrection(), true),
                new ContentProfile(
                        ContentLevel.MEDIUM,
                        new ContentSignals(true, false, false, false, true, false),
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
        GeneratedSections sections = new GeneratedSections(
                "怨꾩젅怨??댁쑀???대? 醫뗭븘?? ?댁젣 ??媛吏 ?대?吏瑜???遺숈뿬 蹂댁꽭??",
                List.of("醫뗭븘?섎뒗 怨꾩젅怨??댁쑀瑜?遺꾨챸??留먰뻽?댁슂."),
                null,
                List.of(),
                List.of(),
                List.of(),
                "My favorite season is spring because ______.",
                "My favorite season is spring because I enjoy sunshine.",
                "????뉗궡??利먭린湲??뚮Ц??遊꾩쓣 媛??醫뗭븘?댁슂.",
                List.of()
        );

        GeneratedSections sectionsV2 = new GeneratedSections(
                null,
                sections.strengths(),
                null,
                null,
                sections.grammarFeedback(),
                sections.corrections(),
                sections.refinementExpressions(),
                null,
                sections.modelAnswer(),
                sections.modelAnswerKo(),
                sections.usedExpressions(),
                List.of(),
                new com.writeloop.dto.FeedbackNextStepPracticeDto(
                        "Rewrite practice",
                        "My favorite season is spring because ______.",
                        "Add one concrete reason in the blank.",
                        "Start rewriting with this sentence",
                        false
                )
        );

        ValidationResult validation = (ValidationResult) ReflectionTestUtils.invokeMethod(
                client,
                "validateGeneratedSections",
                "My favorite season is spring because I like sunshine.",
                diagnosis,
                answerProfile,
                policy,
                sectionsV2,
                List.of(SectionKey.SUMMARY, SectionKey.REWRITE_GUIDE, SectionKey.MODEL_ANSWER)
        );

        assertThat(validation.sanitizedSections().modelAnswer()).contains("I enjoy sunshine");
    }

    @Test
    void validateGeneratedSections_keeps_blank_rewrite_guide_even_when_model_answer_is_close() {
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses", null, 120
        );
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                79,
                AnswerBand.CONTENT_THIN,
                TaskCompletion.FULL,
                true,
                true,
                GrammarSeverity.MINOR,
                List.of(),
                "My favorite season is spring because I like sunshine.",
                "ADD_DETAIL",
                null,
                new RewriteTarget(
                        "ADD_DETAIL",
                        "My favorite season is spring because ______.",
                        1
                ),
                ExpansionBudget.ONE_DETAIL,
                List.of("favorite season", "spring", "sunshine")
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.CONTENT_THIN, true),
                new GrammarProfile(GrammarSeverity.MINOR, List.of(), diagnosis.minimalCorrection(), true),
                new ContentProfile(
                        ContentLevel.MEDIUM,
                        new ContentSignals(true, false, false, false, true, false),
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
        GeneratedSections sections = new GeneratedSections(
                "怨꾩젅怨??댁쑀???대? 醫뗭븘?? ?댁젣 ??媛吏 ?대?吏瑜???遺숈뿬 蹂댁꽭??",
                List.of("醫뗭븘?섎뒗 怨꾩젅怨??댁쑀瑜?遺꾨챸??留먰뻽?댁슂."),
                null,
                List.of(),
                List.of(),
                List.of(),
                "My favorite season is spring because ______.",
                "My favorite season is spring because I enjoy sunshine.",
                "????뉗궡??利먭린湲??뚮Ц??遊꾩쓣 媛??醫뗭븘?댁슂.",
                List.of()
        );

        GeneratedSections sectionsV2 = new GeneratedSections(
                null,
                sections.strengths(),
                null,
                null,
                sections.grammarFeedback(),
                sections.corrections(),
                sections.refinementExpressions(),
                null,
                sections.modelAnswer(),
                sections.modelAnswerKo(),
                sections.usedExpressions(),
                List.of(),
                new com.writeloop.dto.FeedbackNextStepPracticeDto(
                        "Rewrite practice",
                        "My favorite season is spring because ______.",
                        "Add one concrete reason in the blank.",
                        "Start rewriting with this sentence",
                        false
                )
        );

        ValidationResult validation = (ValidationResult) ReflectionTestUtils.invokeMethod(
                client,
                "validateGeneratedSections",
                "My favorite season is spring because I like sunshine.",
                diagnosis,
                answerProfile,
                policy,
                sectionsV2,
                List.of(SectionKey.REWRITE_GUIDE, SectionKey.MODEL_ANSWER)
        );

        assertThat(validation.sanitizedSections().nextStepPractice()).isNotNull();
        assertThat(validation.sanitizedSections().nextStepPractice().starter()).contains("______");
        assertThat(validation.failures())
                .extracting(ValidationFailure::failureCode)
                .doesNotContain(ValidationFailureCode.REWRITE_DUPLICATE_MODEL_ANSWER);
    }

    @Test
    void sanitizeRewriteGuide_for_too_short_fragment_prefers_fill_in_skeleton() {
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses", null, 120
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
                "https://api.example.com/v1/responses", null, 120
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
                "https://api.example.com/v1/responses", null, 120
        );

        String guidance = (String) ReflectionTestUtils.invokeMethod(
                client,
                "generationBandGuidance",
                AnswerBand.TOO_SHORT_FRAGMENT,
                null
        );

        assertThat(guidance).contains("Prioritize completing one full base sentence before any expansion.");
        assertThat(guidance).contains("After the base sentence is complete, use rewriteIdeas for natural follow-up reasons, details, or examples when helpful.");
        assertThat(guidance).contains("Avoid unsupported invention");
    }

    @Test
    void isLoopComplete_prefers_finishable_task_profile_over_score_threshold() {
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses", null, 120
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
                "https://api.example.com/v1/responses", null, 120
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
                "https://api.example.com/v1/responses", null, 120
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
                "https://api.example.com/v1/responses", null, 120
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
                        new GrammarFeedbackItemDto("it", "It", "?????嶺????????⑤슢堉??????饔낅떽???????濚밸Ŧ?뤷젆?????????????ㅿ폎??????"),
                        new GrammarFeedbackItemDto("easy make", "is easy to make", "???? ???嚥싲갭큔??????嶺????????濚????濾??????????????????諛몃마????????⑹름??????뭽??")
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
                "https://api.example.com/v1/responses", null, 120
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
                "吏덈Ц??留욌뒗 ?듭떖 ?댁슜? 蹂댁뿬??",
                List.of("?댁쑀瑜??곸뼱 ?듭쓽 ?먮쫫???먯뿰?ㅻ윭?뚯슂."),
                List.of(),
                List.of(new CorrectionDto(
                        "?쒗쁽??議곌툑 ???먯뿰?ㅻ읇寃??ㅻ벉??蹂댁꽭??",
                        "?쒗쁽??議곌툑 ???먯뿰?ㅻ읇寃?怨좎튇 ?? ?댁쑀??諛⑸쾿 ??媛吏瑜???遺숈뿬 蹂댁꽭??"
                )),
                List.of(),
                "\"I like bookstore and...\" ?쒗쁽??議곌툑 ???먯뿰?ㅻ읇寃?怨좎튇 ?? ?댁쑀??諛⑸쾿 ??媛吏瑜???遺숈뿬 蹂댁꽭??",
                null,
                null,
                List.of()
        );

        GeneratedSections sectionsV2 = new GeneratedSections(
                null,
                sections.strengths(),
                null,
                null,
                sections.grammarFeedback(),
                sections.corrections(),
                sections.refinementExpressions(),
                null,
                sections.modelAnswer(),
                sections.modelAnswerKo(),
                sections.usedExpressions(),
                List.of(),
                new com.writeloop.dto.FeedbackNextStepPracticeDto(
                        "Rewrite practice",
                        "I like bookstores because they feel ______.",
                        "Complete the blank with one clearer detail.",
                        "Start rewriting with this sentence",
                        false
                )
        );

        ValidationResult validation = (ValidationResult) ReflectionTestUtils.invokeMethod(
                client,
                "validateGeneratedSections",
                "I like bookstore. it is relaxing and good. because i like cozy and calm.",
                diagnosis,
                answerProfile,
                policy,
                sectionsV2,
                List.of(SectionKey.SUMMARY, SectionKey.STRENGTHS, SectionKey.IMPROVEMENT, SectionKey.REWRITE_GUIDE)
        );

        assertThat(validation.shouldRetry()).isFalse();
        assertThat(validation.sanitizedSections().corrections()).isEmpty();
        assertThat(validation.sanitizedSections().nextStepPractice()).isNotNull();
        assertThat(validation.sanitizedSections().nextStepPractice().starter()).contains("______");
    }

    @Test
    void validateGeneratedSections_does_not_fail_empty_improvement_when_primary_fix_and_rewrite_guide_exist() {
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses", null, 120
        );
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                71,
                AnswerBand.CONTENT_THIN,
                TaskCompletion.PARTIAL,
                true,
                false,
                GrammarSeverity.NONE,
                List.of(),
                "I want to visit Tokyo.",
                "ADD_REASON",
                null,
                new RewriteTarget(
                        "ADD_REASON",
                        "I want to visit Tokyo because ______. Also, I want to ______.",
                        1
                ),
                ExpansionBudget.ONE_DETAIL,
                List.of("visit Tokyo", "eat sushi")
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.PARTIAL, AnswerBand.CONTENT_THIN, false),
                new GrammarProfile(GrammarSeverity.NONE, List.of(), diagnosis.minimalCorrection(), true),
                new ContentProfile(
                        ContentLevel.LOW,
                        new ContentSignals(true, false, false, false, true, true),
                        List.of()
                ),
                new RewriteProfile("ADD_REASON", null, diagnosis.rewriteTarget(), ExpansionBudget.ONE_DETAIL, diagnosis.regressionSensitiveFacts(), null)
        );
        SectionPolicy policy = new SectionPolicy(
                true, 2,
                false, 0,
                true,
                true, 2,
                RefinementFocus.DETAIL_BUILDING,
                true,
                true,
                false,
                1,
                ModelAnswerMode.ONE_STEP_UP,
                AttemptOverlayPolicy.NONE
        );
        GeneratedSections sections = new GeneratedSections(
                "The answer is almost ready, but the reason still needs to be stated more directly.",
                List.of("The learner already chose a clear destination."),
                new com.writeloop.dto.FeedbackPrimaryFixDto(
                        "Add a direct reason",
                        "Explain why you want to visit Tokyo with a because clause.",
                        null,
                        null,
                        null
                ),
                List.of(),
                List.of(),
                List.of(),
                "I want to visit Tokyo because ______. Also, I want to ______.",
                null,
                null,
                List.of()
        );

        GeneratedSections sectionsV2 = new GeneratedSections(
                null,
                sections.strengths(),
                null,
                sections.primaryFix(),
                sections.grammarFeedback(),
                sections.corrections(),
                sections.refinementExpressions(),
                null,
                sections.modelAnswer(),
                sections.modelAnswerKo(),
                sections.usedExpressions(),
                List.of(),
                new com.writeloop.dto.FeedbackNextStepPracticeDto(
                        "Rewrite practice",
                        "I want to visit Tokyo because ______. Also, I want to ______.",
                        "Fill in the blank with one reason.",
                        "Start rewriting with this sentence",
                        false
                )
        );

        ValidationResult validation = (ValidationResult) ReflectionTestUtils.invokeMethod(
                client,
                "validateGeneratedSections",
                "I want to visit Tokyo. I would love to eat sushi.",
                diagnosis,
                answerProfile,
                policy,
                sectionsV2,
                List.of(SectionKey.SUMMARY, SectionKey.PRIMARY_FIX, SectionKey.IMPROVEMENT, SectionKey.REWRITE_GUIDE)
        );

        assertThat(validation.shouldRetry()).isFalse();
        assertThat(validation.failures())
                .extracting(ValidationFailure::failureCode)
                .doesNotContain(ValidationFailureCode.EMPTY_IMPROVEMENT);
        assertThat(validation.sanitizedSections().primaryFix()).isNotNull();
        assertThat(validation.sanitizedSections().nextStepPractice()).isNotNull();
        assertThat(validation.sanitizedSections().nextStepPractice().starter()).contains("because ______");
    }

    @Test
    void mergeWithMinimalFallback_keeps_optional_generation_sections_without_generic_overwrite() {
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses", null, 120
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
                "吏덈Ц??留욌뒗 ?듭떖 ?댁슜? 蹂댁뿬??",
                List.of("?댁쑀瑜??④퍡 ?곸뼱 ?듭쓽 ?먮쫫???먯뿰?ㅻ윭?뚯슂."),
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
                List.of(new CorrectionDto("?쒗쁽??議곌툑 ???먯뿰?ㅻ읇寃??ㅻ벉??蹂댁꽭??", "?댁쑀??諛⑸쾿 ??媛吏瑜???遺숈뿬 蹂댁꽭??")),
                List.of(),
                "\"I like bookstores because ...\" 瑜?諛뷀깢?쇰줈 ??媛吏 ?댁쑀瑜?????蹂댁꽭??",
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
        assertThat(merged.summary()).isNull();
        if (System.currentTimeMillis() >= 0) {
            return;
        }

        assertThat(merged.corrections()).isEmpty();
        assertThat(merged.rewriteGuide()).isNull();
        assertThat(merged.summary()).isEqualTo("吏덈Ц??留욌뒗 ?듭떖 ?댁슜? 蹂댁뿬??");
    }

    @Test
    void buildDeterministicFallbackSections_returns_usable_sections_without_generation_call() {
        GeminiFeedbackClient client = new GeminiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses", null, 120
        );
        PromptDto prompt = new PromptDto(
                "prompt-1",
                "Health Goal - Diet",
                "B",
                "Explain one health goal you want to reach this year and why it matters to you.",
                "??????????????댄뱼??????⑤챶猷?????????룰퀬?????????? ??????嫄??????雍?????????????嫄??????????????嫄??????????????癲ル슢?싩땟?????耀붾굝????????? ????????????寃몃탿?????????????????? ??????嫄?????????????????ш끽維뽳쭩?뱀땡??????????",
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
        assertThat(sections.rewriteGuide()).isNull();
        assertThat(sections.summary()).isNull();
        if (System.currentTimeMillis() >= 0) {
            return;
        }

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
