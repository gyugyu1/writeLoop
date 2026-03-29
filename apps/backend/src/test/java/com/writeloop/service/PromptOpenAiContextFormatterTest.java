package com.writeloop.service;

import com.writeloop.dto.PromptCoachProfileDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PromptOpenAiContextFormatterTest {

    @Test
    void formatCoachProfile_renders_profile_fields_in_prompt_friendly_lines() {
        PromptDto prompt = new PromptDto(
                "prompt-b-5",
                "Goal Plan - Skill Growth",
                "B",
                "What is one skill you want to improve this year, and how will you work on it?",
                "올해 더 키우고 싶은 기술 하나는 무엇이고, 어떻게 실천할 건가요?",
                "목표와 실천 계획을 함께 말해 보세요.",
                new PromptCoachProfileDto(
                        "GOAL_PLAN",
                        List.of("goal", "plan", "growth"),
                        List.of("goal", "plan", "process"),
                        List.of("generic_example_marker"),
                        "DIRECT",
                        "목표와 실행 계획을 우선 추천합니다."
                )
        );

        String text = PromptOpenAiContextFormatter.formatCoachProfile(prompt);

        assertThat(text).contains("- primaryCategory: GOAL_PLAN");
        assertThat(text).contains("- secondaryCategories: goal, plan, growth");
        assertThat(text).contains("- preferredExpressionFamilies: goal, plan, process");
        assertThat(text).contains("- avoidFamilies: generic_example_marker");
        assertThat(text).contains("- starterStyle: DIRECT");
        assertThat(text).contains("- notes: 목표와 실행 계획을 우선 추천합니다.");
    }

    @Test
    void formatPromptHints_renders_type_and_content_per_line() {
        List<PromptHintDto> hints = List.of(
                new PromptHintDto("hint-1", "prompt-b-5", "STARTER", "I want to improve [skill] this year.", 1),
                new PromptHintDto("hint-2", "prompt-b-5", "VOCAB", "practice regularly", 2)
        );

        String text = PromptOpenAiContextFormatter.formatPromptHints(hints);

        assertThat(text).contains("- [STARTER] I want to improve [skill] this year.");
        assertThat(text).contains("- [VOCAB] practice regularly");
    }

    @Test
    void formatters_fall_back_to_none_when_context_is_missing() {
        PromptDto prompt = new PromptDto(
                "prompt-a-1",
                "Routine",
                "A",
                "How do you spend your weekday mornings?",
                "평일 아침은 보통 어떻게 보내나요?",
                "시간 표현과 순서를 함께 넣어 보세요."
        );

        assertThat(PromptOpenAiContextFormatter.formatCoachProfile(prompt)).isEqualTo("- none");
        assertThat(PromptOpenAiContextFormatter.formatPromptHints(List.of())).isEqualTo("- none");
    }
}
