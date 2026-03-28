package com.writeloop.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.PromptCoachProfileRequestDto;
import com.writeloop.persistence.PromptEntity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PromptCoachProfileSupportTest {

    private PromptCoachProfileSupport support;

    @BeforeEach
    void setUp() {
        support = new PromptCoachProfileSupport(new ObjectMapper());
    }

    @Test
    void defaultProfileForPrompt_classifies_seeded_weekend_prompt_as_routine() {
        PromptCoachProfileRequestDto profile = support.defaultProfileForPrompt(new PromptEntity(
                "prompt-a-3",
                "Weekend",
                "A",
                "How do you usually spend your weekend?",
                "주말을 보통 어떻게 보내나요?",
                "평소 하는 활동을 구체적으로 말해 보세요.",
                3,
                true
        ));

        assertThat(profile.primaryCategory()).isEqualTo("ROUTINE");
        assertThat(profile.preferredExpressionFamilies()).contains("starter_routine", "frequency", "companion");
        assertThat(profile.avoidFamilies()).contains("generic_example_marker");
        assertThat(profile.notes()).isNotBlank();
    }

    @Test
    void defaultProfileForPrompt_classifies_social_responsibility_prompt_as_opinion_reason() {
        PromptCoachProfileRequestDto profile = support.defaultProfileForPrompt(new PromptEntity(
                "prompt-c-2",
                "Society",
                "C",
                "What kind of social responsibility should successful companies have in modern society?",
                "현대 사회에서 성공한 기업은 어떤 사회적 책임을 가져야 하나요?",
                "예시와 기준을 함께 말해 보세요.",
                8,
                true
        ));

        assertThat(profile.primaryCategory()).isEqualTo("OPINION_REASON");
        assertThat(profile.preferredExpressionFamilies()).contains("responsibility", "reason", "example");
        assertThat(profile.starterStyle()).isEqualTo("DIRECT");
    }

    @Test
    void shouldRefreshSeededProfile_returns_true_for_seeded_prompt_with_blank_notes() {
        PromptEntity prompt = new PromptEntity(
                "prompt-b-1",
                "Work and Study",
                "B",
                "What is one challenge you often face at work or school, and how do you deal with it?",
                "직장이나 학교에서 자주 겪는 어려움이 있나요?",
                "문제와 해결을 함께 설명해 보세요.",
                4,
                true
        );

        prompt.upsertCoachProfile(support.toEntity(
                prompt,
                new PromptCoachProfileRequestDto(
                        "PROBLEM_SOLUTION",
                        java.util.List.of("experience", "problem", "solution"),
                        java.util.List.of("problem", "response", "sequence", "result"),
                        java.util.List.of("generic_example_marker"),
                        "REFLECTIVE",
                        ""
                )
        ));

        assertThat(support.shouldRefreshSeededProfile(prompt)).isTrue();
    }
}
