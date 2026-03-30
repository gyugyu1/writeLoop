package com.writeloop.service;

import com.writeloop.dto.PromptCoachProfileDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;
import com.writeloop.dto.PromptHintItemDto;
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
                "What skill do you want to improve this year, and how will you practice it?",
                "Explain both the goal and the action plan.",
                new PromptCoachProfileDto(
                        "GOAL_PLAN",
                        List.of("goal", "plan", "growth"),
                        List.of("goal", "plan", "process"),
                        List.of("generic_example_marker"),
                        "DIRECT",
                        "Prefer goal, plan, and process expressions."
                )
        );

        String text = PromptOpenAiContextFormatter.formatCoachProfile(prompt);

        assertThat(text).contains("- primaryCategory: GOAL_PLAN");
        assertThat(text).contains("- secondaryCategories: goal, plan, growth");
        assertThat(text).contains("- preferredExpressionFamilies: goal, plan, process");
        assertThat(text).contains("- avoidFamilies: generic_example_marker");
        assertThat(text).contains("- starterStyle: DIRECT");
        assertThat(text).contains("- notes: Prefer goal, plan, and process expressions.");
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
    void formatPromptHints_prefers_structured_items_when_available() {
        List<PromptHintDto> hints = List.of(
                new PromptHintDto(
                        "hint-1",
                        "prompt-b-5",
                        "VOCAB",
                        "legacy bundle",
                        1,
                        List.of(
                                new PromptHintItemDto("item-1", "hint-1", "WORD", "deadline", null, null, null, null, 1),
                                new PromptHintItemDto("item-2", "hint-1", "WORD", "pressure", null, null, null, null, 2)
                        )
                )
        );

        String text = PromptOpenAiContextFormatter.formatPromptHints(hints);

        assertThat(text).contains("- [VOCAB] deadline | pressure");
        assertThat(text).doesNotContain("legacy bundle");
    }

    @Test
    void formatCoachProfileInstructions_builds_soft_guidance_from_profile_fields() {
        PromptDto prompt = new PromptDto(
                "prompt-b-5",
                "Goal Plan - Skill Growth",
                "B",
                "What is one skill you want to improve this year, and how will you work on it?",
                "What skill do you want to improve this year, and how will you practice it?",
                "Explain both the goal and the action plan.",
                new PromptCoachProfileDto(
                        "GOAL_PLAN",
                        List.of("goal", "plan", "growth"),
                        List.of("goal", "plan", "process"),
                        List.of("generic_example_marker"),
                        "DIRECT",
                        "Prefer goal, plan, and process expressions."
                )
        );

        String text = PromptOpenAiContextFormatter.formatCoachProfileInstructions(prompt);

        assertThat(text).contains("Primary answer mode: GOAL_PLAN");
        assertThat(text).contains("Secondary topical angles to keep in mind: goal, plan, growth.");
        assertThat(text).contains("Soft-prefer these expression families when they fit the learner answer: goal, plan, process.");
        assertThat(text).contains("Avoid these expression families unless they are clearly necessary for a natural improvement: generic_example_marker.");
        assertThat(text).contains("Starter style bias: DIRECT -> prefer concise and direct framing over reflective setup.");
        assertThat(text).contains("Extra coaching note:");
    }

    @Test
    void formatters_fall_back_to_none_when_context_is_missing() {
        PromptDto prompt = new PromptDto(
                "prompt-a-1",
                "Routine",
                "A",
                "How do you spend your weekday mornings?",
                "How do you usually spend your weekday mornings?",
                "Include time expressions and sequence words."
        );

        assertThat(PromptOpenAiContextFormatter.formatCoachProfile(prompt)).isEqualTo("- none");
        assertThat(PromptOpenAiContextFormatter.formatPromptHints(List.of())).isEqualTo("- none");
        assertThat(PromptOpenAiContextFormatter.formatCoachProfileInstructions(prompt)).isEqualTo("- none");
    }
}
