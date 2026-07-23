package com.writeloop.service;

import com.writeloop.dto.CorrectionDto;
import com.writeloop.dto.FeedbackCoachMissionDto;
import com.writeloop.dto.FeedbackCoachMoveDto;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.FeedbackRewriteWorkspaceDto;
import com.writeloop.dto.FeedbackSecondaryLearningPointDto;
import com.writeloop.dto.FeedbackUiDto;
import com.writeloop.dto.GrammarFeedbackItemDto;
import com.writeloop.dto.InlineFeedbackSegmentDto;
import com.writeloop.dto.PromptDto;

import java.util.ArrayList;
import java.util.Comparator;
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
        FeedbackDiagnosisResult diagnosis = output.diagnosis();
        GeneratedContent generated = output.content();
        MissionDecision decision = policy.resolve(
                prompt,
                learnerAnswer,
                diagnosis,
                output.slotAssessments()
        );

        List<DiagnosedGrammarIssue> usableGrammarIssues = diagnosis.grammarIssues().stream()
                .filter(issue -> issue.isUsableFor(learnerAnswer))
                .sorted(Comparator.comparingInt(
                        (DiagnosedGrammarIssue issue) -> issue.impact().ordinal()
                ).reversed())
                .toList();
        List<StructureRepair> usableStructureRepairs = diagnosis.structureAssessment().repair().stream()
                .filter(repair -> repair.isUsableFor(learnerAnswer))
                .toList();
        boolean structureMission = decision.missionKind() == MissionKind.STRUCTURE_FIX;
        List<DiagnosedGrammarIssue> visibleGrammarIssues = structureMission ? List.of() : usableGrammarIssues;
        String correctedAnswer = structureMission
                ? usableStructureRepairs.stream()
                .findFirst()
                .map(StructureRepair::correctedAnswer)
                .orElse(null)
                : applyGrammarIssues(learnerAnswer, visibleGrammarIssues);
        List<GrammarFeedbackItemDto> grammarFeedback = visibleGrammarIssues.stream()
                .map(issue -> new GrammarFeedbackItemDto(
                        issue.originalText(),
                        issue.revisedText(),
                        issue.reasonKo()
                ))
                .toList();
        List<CorrectionDto> corrections = visibleGrammarIssues.stream()
                .map(issue -> new CorrectionDto(issue.reasonKo(), issue.revisedText()))
                .toList();
        List<InlineFeedbackSegmentDto> inlineFeedback = FeedbackInlineDiffSupport.diff(
                learnerAnswer,
                correctedAnswer
        );

        FeedbackCoachMissionDto coachMission = buildCoachMission(
                decision,
                correctedAnswer,
                usableStructureRepairs,
                usableGrammarIssues
        );
        List<FeedbackSecondaryLearningPointDto> fixPoints = buildFixPoints(
                decision,
                correctedAnswer,
                usableStructureRepairs,
                usableGrammarIssues
        );
        GeneratedSections finalSections = new GeneratedSections(
                generated.strengths(),
                generated.refinementExpressions(),
                generated.usedExpressions(),
                generated.modelAnswer(),
                generated.modelAnswerKo(),
                decision,
                coachMission,
                fixPoints
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
        FeedbackUiDto ui = new FeedbackUiDto(null, null, null, fixPoints, null);

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
                correctedAnswer,
                generated.refinementExpressions(),
                generated.modelAnswer(),
                generated.modelAnswerKo(),
                coachMission == null ? null : coachMission.instructionKo(),
                generated.usedExpressions(),
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
            String correctedAnswer,
            List<StructureRepair> structureRepairs,
            List<DiagnosedGrammarIssue> grammarIssues
    ) {
        if (decision.missionKind() == MissionKind.SLOT || decision.missionKind() == MissionKind.TASK_RESET) {
            SlotFeedbackSupport support = supportFor(decision, decision.chosenSlot());
            return support == null ? null : support.toCoachMission(decision.missionKind().name());
        }
        if (decision.missionKind() == MissionKind.STRUCTURE_FIX) {
            StructureRepair repair = structureRepairs.stream().findFirst()
                    .orElseThrow(() -> new FeedbackContractException(
                            "STRUCTURE_FIX requires structure correction evidence"
                    ));
            return new FeedbackCoachMissionDto(
                    "STRUCTURE_FIX",
                    "문장 완성하기",
                    repair.originalText(),
                    correctedAnswer,
                    repair.reasonKo(),
                    repair.instructionKo(),
                    correctedAnswer,
                    correctedAnswer,
                    null,
                    List.of(),
                    correctedAnswer,
                    repair.instructionKo(),
                    "주어와 서술어가 있는 완전한 문장으로 쓰면 돼요."
            );
        }
        if (decision.missionKind() == MissionKind.GRAMMAR_FIX) {
            DiagnosedGrammarIssue issue = grammarIssues.stream().findFirst()
                    .orElseThrow(() -> new FeedbackContractException("GRAMMAR_FIX requires correction evidence"));
            return new FeedbackCoachMissionDto(
                    "GRAMMAR_FIX",
                    "문법 한 곳 바로잡기",
                    issue.originalText(),
                    issue.revisedText(),
                    issue.reasonKo(),
                    issue.instructionKo(),
                    issue.revisedText(),
                    issue.revisedText(),
                    null,
                    List.of(),
                    issue.revisedText(),
                    issue.instructionKo(),
                    "고친 표현이 문장 안에 정확히 들어가면 돼요."
            );
        }
        return null;
    }

    private List<FeedbackSecondaryLearningPointDto> buildFixPoints(
            MissionDecision decision,
            String correctedAnswer,
            List<StructureRepair> structureRepairs,
            List<DiagnosedGrammarIssue> grammarIssues
    ) {
        if (decision.missionKind() == MissionKind.SLOT || decision.missionKind() == MissionKind.TASK_RESET) {
            SlotFeedbackSupport support = supportFor(decision, decision.chosenSlot());
            return support == null ? List.of() : List.of(support.toFixPoint(decision.chosenSlot()));
        }
        if (decision.missionKind() == MissionKind.STRUCTURE_FIX) {
            return structureRepairs.stream()
                    .map(repair -> structureFixPoint(repair, correctedAnswer))
                    .limit(1)
                    .toList();
        }
        if (decision.missionKind() == MissionKind.GRAMMAR_FIX) {
            return grammarIssues.stream().map(this::grammarFixPoint).limit(3).toList();
        }
        return List.of();
    }

    private FeedbackSecondaryLearningPointDto structureFixPoint(
            StructureRepair repair,
            String correctedAnswer
    ) {
        return new FeedbackSecondaryLearningPointDto(
                "STRUCTURE_FIX",
                "문장 완성하기",
                null,
                repair.reasonKo(),
                repair.originalText(),
                correctedAnswer,
                null,
                repair.instructionKo(),
                correctedAnswer,
                null
        );
    }

    private FeedbackSecondaryLearningPointDto grammarFixPoint(DiagnosedGrammarIssue issue) {
        return new FeedbackSecondaryLearningPointDto(
                "GRAMMAR_FIX",
                "문법 한 곳 바로잡기",
                null,
                issue.reasonKo(),
                issue.originalText(),
                issue.revisedText(),
                null,
                issue.instructionKo(),
                issue.revisedText(),
                null
        );
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

    private String applyGrammarIssues(String learnerAnswer, List<DiagnosedGrammarIssue> issues) {
        String corrected = learnerAnswer == null ? "" : learnerAnswer;
        for (DiagnosedGrammarIssue issue : issues) {
            int index = corrected.indexOf(issue.originalText());
            if (index < 0) {
                continue;
            }
            corrected = corrected.substring(0, index)
                    + issue.revisedText()
                    + corrected.substring(index + issue.originalText().length());
        }
        return corrected;
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
