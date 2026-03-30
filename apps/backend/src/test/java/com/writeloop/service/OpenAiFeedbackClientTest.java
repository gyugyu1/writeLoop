package com.writeloop.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.PromptCoachProfileDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class OpenAiFeedbackClientTest {

    @Test
    void buildPrompt_emphasizes_novel_structures_and_soft_profile_guidance() {
        OpenAiFeedbackClient client = new OpenAiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses"
        );
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
        List<PromptHintDto> hints = List.of(
                new PromptHintDto("hint-1", prompt.id(), "STARTER", "I want to improve [skill] this year.", 1),
                new PromptHintDto("hint-2", prompt.id(), "STRUCTURE", "I plan to do this by [verb]ing [method].", 2)
        );

        String text = client.buildPrompt(prompt, "I want to improve my English this year.", hints);

        assertThat(text).contains("Do not recommend the same frame, the same wording, or a simpler version of a structure the learner already used.");
        assertThat(text).contains("If the learner already used a simple frame in a family, you may recommend a clearly richer or more specific frame in that same family when it adds new value.");
        assertThat(text).contains("If inlineFeedback contains clear local edits, reflect the important ones in corrections as Korean coaching points.");
        assertThat(text).contains("Include correction guidance for small but meaningful edits such as capitalization, singular/plural, article use, determiner insertion, pronoun choice, preposition choice, and missing punctuation when they improve the sentence.");
        assertThat(text).contains("Do not leave corrections effectively empty when the learner answer still has clear edit-worthy issues.");
        assertThat(text).contains("Avoid dangling fragments such as \"to daily life\", \"to issues like cheating\", or any incomplete chunk that cannot stand alone as a reusable expression.");
        assertThat(text).contains("At least 2 refinementExpressions should be content-bearing expansions tied to the learner's actual answer, not just generic discourse markers.");
        assertThat(text).contains("Do not let all refinementExpressions play the same role. Diversify them across functions such as detail, reason, example, qualification, result, contrast, or process when possible.");
        assertThat(text).contains("Use generic discourse-organizing frames such as \"On the positive side\", \"However\", or \"Overall\" only when they add clear value, and do not let them dominate the whole list.");
        assertThat(text).contains("If the prompt is a balanced-opinion style question, prefer a mix such as one concrete positive elaboration, one concern or limitation, and one qualified overall judgment when possible.");
        assertThat(text).contains("Use prompt hints as idea sources, not as text to copy.");
        assertThat(text).contains("Do not copy a prompt hint verbatim unless it is still clearly novel and useful for this learner.");
        assertThat(text).contains("Prompt coaching strategy:");
        assertThat(text).contains("Primary answer mode: GOAL_PLAN");
        assertThat(text).contains("Soft-prefer these expression families when they fit the learner answer: goal, plan, process.");
        assertThat(text).contains("- [STRUCTURE] I plan to do this by [verb]ing [method].");
    }
}
