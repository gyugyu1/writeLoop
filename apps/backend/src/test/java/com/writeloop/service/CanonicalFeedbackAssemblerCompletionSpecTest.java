package com.writeloop.service;

import com.writeloop.dto.FeedbackCoachMoveDto;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.FeedbackSuggestedPhraseDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptTaskMetaDto;
import com.writeloop.dto.RefinementExpressionDto;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 작업 053 명세의 그대로 둘 동작: 완료 피드백의 응답 내용(모범 답안, 해석, 추천 표현, 풍부하게 써 보기 제안).
 * LLM 응답 모양(JSON)과 관계없이 조립 단계에서 본다.
 */
class CanonicalFeedbackAssemblerCompletionSpecTest {

    private final CanonicalFeedbackAssembler assembler = new CanonicalFeedbackAssembler();

    @Test
    void kept_completeAnswerKeepsModelAnswerRefinementsAndEnrichment() {
        RefinementExpressionDto first = new RefinementExpressionDto(
                "stroll around",
                "가볍게 걷는 느낌을 더해요.",
                "After dinner, I stroll around my neighborhood.",
                "~을 한가롭게 거닐다"
        );
        RefinementExpressionDto second = new RefinementExpressionDto(
                "so that",
                "목적을 이어 말해요.",
                "I take a walk so that I can digest my food.",
                "~하기 위해"
        );
        SlotFeedbackSupport placeSupport = new SlotFeedbackSupport(
                "장소를 넣어 더 풍부하게 써 보세요",
                "어디에서 산책하는지 넣으면 장면이 더 또렷해져요.",
                "산책하는 장소를 한 곳 덧붙여 보세요.",
                "I take a walk ____ after dinner.",
                "저는 저녁 식사 후에 ____에서 산책해요.",
                List.of(
                        new FeedbackSuggestedPhraseDto("in the park", "공원에서"),
                        new FeedbackSuggestedPhraseDto("around my neighborhood", "동네 주변을")
                )
        );
        Map<String, SlotAssessmentValue> values = new LinkedHashMap<>();
        values.put("ACTION", new SlotAssessmentValue("take a walk", SlotAssessmentStatus.SATISFIED));
        values.put("PLACE", new SlotAssessmentValue(null, SlotAssessmentStatus.MISSING));
        CanonicalLlmOutput output = new CanonicalLlmOutput(
                new FeedbackDiagnosisResult(
                        new TopicAssessment(TopicRelevance.ON_TOPIC, "질문과 관련된 답이에요."),
                        new StructureAssessment(StructureStatus.COMPLETE),
                        new LanguageAssessment(List.of())
                ),
                new GeneratedContent(
                        List.of("저녁 후 활동을 분명히 말했어요."),
                        List.of(first, second),
                        "I usually take a walk in the park after dinner.",
                        "저는 보통 저녁 식사 후에 공원에서 산책해요."
                ),
                new SlotAssessments(values, null, new MissionSupport("PLACE", placeSupport))
        );

        AssembledFeedback assembled = assembler.assemble("internal", prompt(), "I take a walk after dinner.", 1, output);

        FeedbackResponseDto response = assembled.response();
        assertThat(assembled.sections().missionDecision().missionKind()).isEqualTo(MissionKind.COMPLETE);
        assertThat(response.loopComplete()).isTrue();
        assertThat(response.modelAnswer()).isEqualTo("I usually take a walk in the park after dinner.");
        assertThat(response.modelAnswerKo()).isEqualTo("저는 보통 저녁 식사 후에 공원에서 산책해요.");
        assertThat(response.refinementExpressions()).containsExactly(first, second);
        assertThat(response.strengths()).containsExactly("저녁 후 활동을 분명히 말했어요.");
        FeedbackCoachMoveDto enrichment = response.completion().enrichment();
        assertThat(enrichment.focusType()).isEqualTo("ENRICHMENT");
        assertThat(enrichment.targetSlot()).isEqualTo("PLACE");
        assertThat(enrichment.focus()).isEqualTo("장소를 넣어 더 풍부하게 써 보세요");
        assertThat(enrichment.skeletonEn()).isEqualTo("I take a walk ____ after dinner.");
        assertThat(enrichment.skeletonKo()).isEqualTo("저는 저녁 식사 후에 ____에서 산책해요.");
        assertThat(enrichment.suggestedPhrases()).containsExactly(
                new FeedbackSuggestedPhraseDto("in the park", "공원에서"),
                new FeedbackSuggestedPhraseDto("around my neighborhood", "동네 주변을")
        );
    }

    private PromptDto prompt() {
        return new PromptDto(
                "prompt-spec-053-dinner",
                "Daily life",
                "Daily life",
                "Routine",
                "A",
                "What do you usually do after dinner?",
                "저녁 식사 후에 보통 무엇을 하나요?",
                "",
                null,
                new PromptTaskMetaDto("ROUTINE", List.of("ACTION"), List.of("PLACE"), null, null, 0)
        );
    }
}
