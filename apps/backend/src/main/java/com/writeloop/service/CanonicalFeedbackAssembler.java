package com.writeloop.service;

import com.writeloop.dto.CorrectionDto;
import com.writeloop.dto.FeedbackCoachMissionDto;
import com.writeloop.dto.FeedbackCoachMoveDto;
import com.writeloop.dto.FeedbackLanguageCorrectionDto;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.FeedbackRewriteWorkspaceDto;
import com.writeloop.dto.FeedbackUiDto;
import com.writeloop.dto.GrammarFeedbackItemDto;
import com.writeloop.dto.InlineFeedbackSegmentDto;
import com.writeloop.dto.PromptDto;

import java.util.List;

final class CanonicalFeedbackAssembler {

    private final FeedbackLearningContractPolicy policy = new FeedbackLearningContractPolicy();

    AssembledFeedback assemble(
            String internalSessionId,
            PromptDto prompt,
            String learnerAnswer,
            int attemptIndex,
        CanonicalLlmOutput output
    ) {
        GeneratedContent generated = output.content();
        LearningContractResolution resolution = policy.resolveContract(
                prompt,
                learnerAnswer,
                output.diagnosis(),
                output.slotAssessments()
        );
        FeedbackDiagnosisResult diagnosis = resolution.diagnosis();
        MissionDecision decision = resolution.decision();

        boolean languageMission = decision.missionKind() == MissionKind.LANGUAGE_FIX;
        String revisedAnswer = languageMission
                ? resolution.revisedAnswer()
                : null;
        List<FeedbackLanguageCorrectionDto> languageCorrections = languageMission
                ? buildLanguageCorrections(resolution.languageCorrections())
                : List.of();
        if (languageMission && (revisedAnswer == null
                || revisedAnswer.equals(learnerAnswer == null ? null : learnerAnswer.trim())
                || languageCorrections.isEmpty())) {
            throw new FeedbackContractException(
                    "LANGUAGE_FIX requires one to 25 explained changes and a distinct revised answer"
            );
        }
        List<ValidatedLanguageCorrection> grammarCorrections = resolution.languageCorrections().stream()
                .filter(correction -> correction.step().kind() != LanguageIssueKind.STRUCTURE)
                .toList();
        List<GrammarFeedbackItemDto> grammarFeedback = languageMission
                ? grammarCorrections.stream()
                .map(correction -> new GrammarFeedbackItemDto(
                        correction.edit().displayOriginalText(),
                        correction.edit().displayRevisedText(),
                        correction.step().reasonKo()
                ))
                .toList()
                : List.of();
        List<CorrectionDto> corrections = languageMission
                ? resolution.languageCorrections().stream()
                .map(correction -> new CorrectionDto(
                        correction.step().reasonKo(),
                        correction.edit().displayRevisedText()
                ))
                .toList()
                : List.of();
        List<InlineFeedbackSegmentDto> inlineFeedback = revisedAnswer == null
                ? List.of()
                : FeedbackInlineDiffSupport.diff(learnerAnswer, revisedAnswer);

        FeedbackCoachMissionDto coachMission = buildCoachMission(
                decision,
                learnerAnswer,
                revisedAnswer,
                languageCorrections
        );
        GeneratedSections finalSections = new GeneratedSections(
                generated.strengths(),
                generated.refinementExpressions(),
                generated.modelAnswer(),
                generated.modelAnswerKo(),
                decision,
                coachMission
        );
        String targetSlot = FeedbackSlotCatalog.targetSlotForUi(decision);
        FeedbackCoachMoveDto coachMove = coachMission == null ? null : coachMission.toCoachMove(targetSlot);
        FeedbackRewriteWorkspaceDto rewriteWorkspace = coachMission == null
                ? null
                : coachMission.toRewriteWorkspace(learnerAnswer);
        boolean complete = decision.isComplete();
        String completionMessage = complete ? "좋아요. 이 답변은 여기까지 완성됐어요." : null;
        String summary = firstNonBlank(
                generated.strengths().stream().findFirst().orElse(null),
                coachMission == null ? null : coachMission.title(),
                complete ? completionMessage : "한 가지만 더 다듬어 볼게요."
        );
        FeedbackUiDto ui = new FeedbackUiDto(null, List.of(), null, null);

        FeedbackResponseDto response = new FeedbackResponseDto(
                prompt == null ? null : prompt.id(),
                internalSessionId,
                Math.max(1, attemptIndex),
                complete,
                completionMessage,
                summary,
                generated.strengths(),
                corrections,
                inlineFeedback,
                grammarFeedback,
                revisedAnswer,
                generated.refinementExpressions(),
                generated.modelAnswer(),
                generated.modelAnswerKo(),
                coachMission == null ? null : coachMission.instructionKo(),
                ui,
                null,
                coachMove,
                rewriteWorkspace,
                null,
                null
        );
        return new AssembledFeedback(response, diagnosis, finalSections);
    }

    private FeedbackCoachMissionDto buildCoachMission(
            MissionDecision decision,
            String learnerAnswer,
            String revisedAnswer,
            List<FeedbackLanguageCorrectionDto> languageCorrections
    ) {
        if (decision.missionKind() == MissionKind.SLOT || decision.missionKind() == MissionKind.TASK_RESET) {
            SlotFeedbackSupport support = supportFor(decision, decision.chosenSlot());
            return support == null ? null : support.toCoachMission(decision.missionKind().name());
        }
        if (decision.missionKind() == MissionKind.LANGUAGE_FIX) {
            int correctionCount = languageCorrections.size();
            String title = correctionCount == 1
                    ? "문장 한 곳 바로잡기"
                    : "문장 " + correctionCount + "곳 바로잡기";
            return new FeedbackCoachMissionDto(
                    "LANGUAGE_FIX",
                    title,
                    learnerAnswer,
                    revisedAnswer,
                    null,
                    "위 교정들을 반영해 문장 전체를 다시 써 보세요.",
                    revisedAnswer,
                    null,
                    List.of(),
                    revisedAnswer,
                    "표시된 교정이 모두 문장에 반영되면 돼요.",
                    languageCorrections
            );
        }
        return null;
    }

    private SlotFeedbackSupport supportFor(MissionDecision decision, String slot) {
        if (slot == null) {
            return null;
        }
        SlotAssessmentValue assessment = decision.slotAssessments().get(slot);
        return assessment == null || assessment.support().isEmpty()
                ? null
                : assessment.support().get(0);
    }

    private List<FeedbackLanguageCorrectionDto> buildLanguageCorrections(
            List<ValidatedLanguageCorrection> validatedCorrections
    ) {
        return validatedCorrections.stream()
                .sorted(java.util.Comparator.comparingInt(ValidatedLanguageCorrection::stepIndex))
                .map(correction -> new FeedbackLanguageCorrectionDto(
                        correction.step().kind().name(),
                        displayLabel(correction.step().kind()),
                        correction.edit().displayOriginalText(),
                        correction.edit().displayRevisedText(),
                        correction.step().reasonKo()
                ))
                .toList();
    }

    private String displayLabel(LanguageIssueKind kind) {
        return switch (kind) {
            case STRUCTURE -> "문장 구조";
            case GRAMMAR_BLOCKING -> "핵심 교정";
            case GRAMMAR_LOCAL -> "세부 교정";
        };
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }
}

record AssembledFeedback(
        FeedbackResponseDto response,
        FeedbackDiagnosisResult diagnosis,
        GeneratedSections sections
) {
}
