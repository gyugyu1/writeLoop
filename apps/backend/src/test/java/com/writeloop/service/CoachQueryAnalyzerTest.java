package com.writeloop.service;

import com.writeloop.dto.PromptDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CoachQueryAnalyzerTest {

    private CoachQueryAnalyzer analyzer;
    private PromptDto prompt;

    @BeforeEach
    void setUp() {
        analyzer = new CoachQueryAnalyzer();
        prompt = new PromptDto(
                "prompt-1",
                "Daily writing",
                "EASY",
                "Share your idea clearly.",
                "\uC0DD\uAC01\uC744 \uBD84\uBA85\uD558\uAC8C \uC801\uC5B4 \uBCF4\uC138\uC694.",
                "Use a clear answer."
        );
    }

    @Test
    void analyze_detects_socialize_family_from_korean_conjugation() {
        CoachQueryAnalyzer.CoachQueryAnalysis analysis = analyzer.analyze(
                prompt,
                "\uCE5C\uAD6C \uB9CC\uB09C\uB2E4\uACE0 \uB9D0\uD558\uACE0 \uC2F6\uC5B4"
        );

        assertThat(analysis.lookup()).isPresent();
        assertThat(analysis.lookup().orElseThrow().frame().family())
                .isEqualTo(CoachQueryAnalyzer.ActionFamily.SOCIALIZE);
    }

    @Test
    void analyze_detects_sleep_family_from_korean_conjugation() {
        CoachQueryAnalyzer.CoachQueryAnalysis analysis = analyzer.analyze(
                prompt,
                "\uC794\uB2E4\uACE0 \uB9D0\uD558\uACE0 \uC2F6\uC5B4"
        );

        assertThat(analysis.lookup()).isPresent();
        assertThat(analysis.lookup().orElseThrow().frame().family())
                .isEqualTo(CoachQueryAnalyzer.ActionFamily.SLEEP);
    }

    @Test
    void analyze_extracts_learn_family_and_translated_target() {
        CoachQueryAnalyzer.CoachQueryAnalysis analysis = analyzer.analyze(
                prompt,
                "\uC720\uB3C4\uB97C \uBC30\uC6B0\uACE0 \uC2F6\uB2E4\uACE0 \uB9D0\uD558\uACE0 \uC2F6\uC5B4"
        );

        assertThat(analysis.lookup()).isPresent();
        assertThat(analysis.lookup().orElseThrow().frame().family())
                .isEqualTo(CoachQueryAnalyzer.ActionFamily.LEARN);
        assertThat(
                analysis.lookup().orElseThrow().translations().get(CoachQueryAnalyzer.MeaningSlot.TARGET).englishText()
        ).isEqualTo("judo");
    }

    @Test
    void analyze_detects_growth_family_for_implicit_strength_lookup() {
        CoachQueryAnalyzer.CoachQueryAnalysis analysis = analyzer.analyze(
                prompt,
                "근력을 키우고 싶다"
        );

        assertThat(analysis.lookup()).isPresent();
        assertThat(analysis.lookup().orElseThrow().frame().family())
                .isEqualTo(CoachQueryAnalyzer.ActionFamily.GROWTH_CAPABILITY);
        assertThat(
                analysis.lookup().orElseThrow().translations().get(CoachQueryAnalyzer.MeaningSlot.TARGET).englishText()
        ).isEqualTo("strength");
    }

    @Test
    void analyze_detects_growth_family_for_confidence_lookup() {
        CoachQueryAnalyzer.CoachQueryAnalysis analysis = analyzer.analyze(
                prompt,
                "자신감을 높이고 싶다"
        );

        assertThat(analysis.lookup()).isPresent();
        assertThat(analysis.lookup().orElseThrow().frame().family())
                .isEqualTo(CoachQueryAnalyzer.ActionFamily.GROWTH_CAPABILITY);
        assertThat(
                analysis.lookup().orElseThrow().translations().get(CoachQueryAnalyzer.MeaningSlot.TARGET).englishText()
        ).isEqualTo("confidence");
    }

    @Test
    void analyze_detects_reduce_manage_family_for_stress_lookup() {
        CoachQueryAnalyzer.CoachQueryAnalysis analysis = analyzer.analyze(
                prompt,
                "스트레스를 줄이고 싶다"
        );

        assertThat(analysis.lookup()).isPresent();
        assertThat(analysis.lookup().orElseThrow().frame().family())
                .isEqualTo(CoachQueryAnalyzer.ActionFamily.REDUCE_MANAGE);
        assertThat(
                analysis.lookup().orElseThrow().translations().get(CoachQueryAnalyzer.MeaningSlot.TARGET).englishText()
        ).isEqualTo("stress");
    }

    @Test
    void analyze_detects_lookup_for_generic_desire_state_statement() {
        CoachQueryAnalyzer.CoachQueryAnalysis analysis = analyzer.analyze(
                prompt,
                "매력적으로 보이고 싶다"
        );

        assertThat(analysis.lookup()).isPresent();
        assertThat(analysis.lookup().orElseThrow().frame().family())
                .isEqualTo(CoachQueryAnalyzer.ActionFamily.UNKNOWN);
    }

    @Test
    void analyze_marks_hybrid_when_support_meta_and_meaning_lookup_coexist() {
        CoachQueryAnalyzer.CoachQueryAnalysis analysis = analyzer.analyze(
                prompt,
                "이 질문에서 근력을 키우고 싶을 때 쓸 표현 알려줘"
        );

        assertThat(analysis.lookup()).isPresent();
        assertThat(analysis.lookup().orElseThrow().detection().cue())
                .isEqualTo("hybrid_meaning_support");
    }

    @Test
    void analyze_extracts_state_change_family_for_online_relationship_lookup() {
        CoachQueryAnalyzer.CoachQueryAnalysis analysis = analyzer.analyze(
                prompt,
                "\uC778\uD130\uB137\uC5D0\uC11C\uC758 \uB9CC\uB0A8\uC774 \uC790\uC5F0\uC2A4\uB7EC\uC6CC\uC84C\uB2E4\uB97C \uC5B4\uB5BB\uAC8C \uB9D0\uD574"
        );

        assertThat(analysis.lookup()).isPresent();
        assertThat(analysis.lookup().orElseThrow().frame().family())
                .isEqualTo(CoachQueryAnalyzer.ActionFamily.STATE_CHANGE);
        assertThat(
                analysis.lookup().orElseThrow().translations().get(CoachQueryAnalyzer.MeaningSlot.TOPIC).englishText()
        ).isEqualTo("meeting people online");
    }

    @Test
    void analyze_detects_lookup_for_spacing_variant_mal_hago_sipeo() {
        CoachQueryAnalyzer.CoachQueryAnalysis analysis = analyzer.analyze(
                prompt,
                "\uC2A4\uD398\uC778\uC5B4\uB97C \uBC30\uC6CC\uC57C\uD55C\uB2E4\uACE0 \uB9D0 \uD558\uACE0\uC2F6\uC5B4"
        );

        assertThat(analysis.lookup()).isPresent();
        assertThat(analysis.lookup().orElseThrow().frame().family())
                .isEqualTo(CoachQueryAnalyzer.ActionFamily.LEARN);
    }

    @Test
    void analyze_marks_unknown_learn_target_as_unresolved_translation() {
        CoachQueryAnalyzer.CoachQueryAnalysis analysis = analyzer.analyze(
                prompt,
                "\uC2A4\uD398\uC778\uC5B4\uB97C \uBC30\uC6CC\uC57C\uD55C\uB2E4\uACE0 \uB9D0 \uD558\uACE0\uC2F6\uC5B4"
        );

        assertThat(analysis.lookup()).isPresent();
        assertThat(
                analysis.lookup().orElseThrow().translations().get(CoachQueryAnalyzer.MeaningSlot.TARGET).resolved()
        ).isTrue();
        assertThat(
                analysis.lookup().orElseThrow().translations().get(CoachQueryAnalyzer.MeaningSlot.TARGET).englishText()
        ).isEqualTo("Spanish");
    }

    @Test
    void analyze_detects_visit_interest_family() {
        CoachQueryAnalyzer.CoachQueryAnalysis analysis = analyzer.analyze(
                prompt,
                "\uBA54\uC774\uB4DC\uCE74\uD398\uC5D0 \uAC00\uBCF4\uACE0 \uC2F6\uB2E4\uACE0 \uB9D0\uD558\uACE0 \uC2F6\uC5B4"
        );

        assertThat(analysis.lookup()).isPresent();
        assertThat(analysis.lookup().orElseThrow().frame().family())
                .isEqualTo(CoachQueryAnalyzer.ActionFamily.VISIT_INTEREST);
        assertThat(
                analysis.lookup().orElseThrow().translations().get(CoachQueryAnalyzer.MeaningSlot.TARGET).englishText()
        ).isEqualTo("maid cafe");
    }

    @Test
    void analyze_detects_meaning_lookup_from_expression_naturalness_question() {
        CoachQueryAnalyzer.CoachQueryAnalysis analysis = analyzer.analyze(
                prompt,
                "\uCE5C\uAD6C\uB97C \uB9CC\uB09C\uB2E4\uB294 \uD45C\uD604 \uBB50\uAC00 \uC790\uC5F0\uC2A4\uB7EC\uC6CC?"
        );

        assertThat(analysis.lookup()).isPresent();
        assertThat(analysis.lookup().orElseThrow().frame().family())
                .isEqualTo(CoachQueryAnalyzer.ActionFamily.SOCIALIZE);
    }

    @Test
    void analyze_detects_lookup_from_how_to_express_learning_question() {
        CoachQueryAnalyzer.CoachQueryAnalysis analysis = analyzer.analyze(
                prompt,
                "\uC601\uC5B4\uB97C \uBC30\uC6B0\uACE0 \uC2F6\uB2E4\uB97C \uC5B4\uB5BB\uAC8C \uD45C\uD604\uD574?"
        );

        assertThat(analysis.lookup()).isPresent();
        assertThat(analysis.lookup().orElseThrow().frame().family())
                .isEqualTo(CoachQueryAnalyzer.ActionFamily.LEARN);
    }

    @Test
    void analyze_detects_socialize_family_for_hangout_variant() {
        CoachQueryAnalyzer.CoachQueryAnalysis analysis = analyzer.analyze(
                prompt,
                "\uCE5C\uAD6C\uB4E4\uC774\uB791 \uB17C\uB2E4\uACE0 \uB9D0\uD558\uACE0 \uC2F6\uC5B4"
        );

        assertThat(analysis.lookup()).isPresent();
        assertThat(analysis.lookup().orElseThrow().frame().family())
                .isEqualTo(CoachQueryAnalyzer.ActionFamily.SOCIALIZE);
    }

    @Test
    void analyze_treats_habit_expression_help_as_writing_support() {
        CoachQueryAnalyzer.CoachQueryAnalysis analysis = analyzer.analyze(
                prompt,
                "\uC2B5\uAD00 \uB9D0\uD560 \uB54C \uD45C\uD604 \uC54C\uB824\uC918"
        );

        assertThat(analysis.lookup()).isEmpty();
        assertThat(analysis.intentKeys()).contains("habit");
    }

    @Test
    void analyze_detects_lookup_when_user_says_dago_hago_sipeo_without_mal() {
        CoachQueryAnalyzer.CoachQueryAnalysis analysis = analyzer.analyze(
                prompt,
                "\uCE5C\uAD6C\uB97C \uB9CC\uB09C\uB2E4\uACE0 \uD558\uACE0 \uC2F6\uC5B4"
        );

        assertThat(analysis.lookup()).isPresent();
        assertThat(analysis.lookup().orElseThrow().frame().family())
                .isEqualTo(CoachQueryAnalyzer.ActionFamily.SOCIALIZE);
    }

    @Test
    void analyze_prioritizes_state_change_over_rest_for_online_relationship_became_easier() {
        CoachQueryAnalyzer.CoachQueryAnalysis analysis = analyzer.analyze(
                prompt,
                "\uC628\uB77C\uC778\uC5D0\uC11C \uC0AC\uB78C \uB9CC\uB098\uB294 \uAC8C \uC26C\uC6CC\uC84C\uB2E4\uACE0 \uC5B4\uB5BB\uAC8C \uB9D0\uD574?"
        );

        assertThat(analysis.lookup()).isPresent();
        assertThat(analysis.lookup().orElseThrow().frame().family())
                .isEqualTo(CoachQueryAnalyzer.ActionFamily.STATE_CHANGE);
    }

    @Test
    void analyze_does_not_let_prompt_intents_override_meaning_lookup() {
        PromptDto supportHeavyPrompt = new PromptDto(
                "prompt-2",
                "Technology",
                "MEDIUM",
                "How has technology changed relationships, and is that mostly positive?",
                "\uC774\uC720\uC640 \uC608\uC2DC\uB97C \uD568\uAED8 \uC368 \uBCF4\uC138\uC694.",
                "Use reasons and examples."
        );

        CoachQueryAnalyzer.CoachQueryAnalysis analysis = analyzer.analyze(
                supportHeavyPrompt,
                "\uCE5C\uAD6C\uB97C \uB9CC\uB09C\uB2E4\uB294 \uD45C\uD604 \uBB50\uAC00 \uC790\uC5F0\uC2A4\uB7EC\uC6CC?"
        );

        assertThat(analysis.lookup()).isPresent();
        assertThat(analysis.lookup().orElseThrow().frame().family())
                .isEqualTo(CoachQueryAnalyzer.ActionFamily.SOCIALIZE);
    }

    @Test
    void analyze_detects_sleep_family_for_go_to_bed_korean_variant() {
        CoachQueryAnalyzer.CoachQueryAnalysis analysis = analyzer.analyze(
                prompt,
                "\uCE68\uB300\uC5D0 \uBC14\uB85C \uAC04\uB2E4\uACE0 \uB9D0\uD558\uACE0 \uC2F6\uC5B4"
        );

        assertThat(analysis.lookup()).isPresent();
        assertThat(analysis.lookup().orElseThrow().frame().family())
                .isEqualTo(CoachQueryAnalyzer.ActionFamily.SLEEP);
    }

    @Test
    void analyze_detects_state_change_for_online_meeting_became_natural_variant() {
        CoachQueryAnalyzer.CoachQueryAnalysis analysis = analyzer.analyze(
                prompt,
                "\uC628\uB77C\uC778 \uB9CC\uB0A8\uC774 \uC804\uBCF4\uB2E4 \uC790\uC5F0\uC2A4\uB7FD\uB2E4\uB97C \uC5B4\uB5BB\uAC8C \uB9D0\uD574?"
        );

        assertThat(analysis.lookup()).isPresent();
        assertThat(analysis.lookup().orElseThrow().frame().family())
                .isEqualTo(CoachQueryAnalyzer.ActionFamily.STATE_CHANGE);
    }

    @Test
    void analyze_keeps_meaning_lookup_for_hybrid_lookup_plus_structure_query() {
        CoachQueryAnalyzer.CoachQueryAnalysis analysis = analyzer.analyze(
                prompt,
                "\uC794\uB2E4\uACE0 \uB9D0\uD558\uACE0 \uC2F6\uC740\uB370 \uAD6C\uC870\uB3C4 \uAC19\uC774 \uC54C\uB824\uC918"
        );

        assertThat(analysis.lookup()).isPresent();
        assertThat(analysis.lookup().orElseThrow().frame().family())
                .isEqualTo(CoachQueryAnalyzer.ActionFamily.SLEEP);
    }

    @Test
    void analyze_treats_opinion_expression_help_as_writing_support() {
        CoachQueryAnalyzer.CoachQueryAnalysis analysis = analyzer.analyze(
                prompt,
                "\uC758\uACAC \uD45C\uD604 \uC54C\uB824\uC918"
        );

        assertThat(analysis.lookup()).isEmpty();
        assertThat(analysis.intentKeys()).contains("opinion");
    }

    @Test
    void analyze_treats_example_support_with_sample_keyword_as_writing_support() {
        CoachQueryAnalyzer.CoachQueryAnalysis analysis = analyzer.analyze(
                prompt,
                "\uC0D8\uD50C \uB123\uC744 \uB54C \uD45C\uD604 \uC788\uC5B4?"
        );

        assertThat(analysis.lookup()).isEmpty();
        assertThat(analysis.intentKeys()).contains("example");
    }
}
