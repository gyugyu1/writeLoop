package com.writeloop.service;

import com.writeloop.dto.FeedbackCoachMoveDto;
import com.writeloop.dto.FeedbackLanguageCorrectionDto;
import com.writeloop.dto.PreviousMissionResultDto;

import java.util.Locale;
import java.util.Map;

// 바로 앞 시도의 미션을 이번 답이 해결했는지 기계적으로 판정한다. LLM을 다시 부르지 않고,
// 이번 진단(주제·슬롯 판정)과 이번 답 글자만 본다.
final class PreviousMissionEvaluator {

    static final String RESOLVED = "RESOLVED";
    static final String PARTIAL = "PARTIAL";
    static final String UNRESOLVED = "UNRESOLVED";

    private PreviousMissionEvaluator() {
    }

    static PreviousMissionResultDto evaluate(
            FeedbackCoachMoveDto previousMove,
            String answer,
            FeedbackDiagnosisResult diagnosis,
            Map<String, SlotAssessmentValue> slotAssessments
    ) {
        if (previousMove == null || previousMove.focusType() == null) {
            return null;
        }
        return switch (previousMove.focusType()) {
            case "SLOT" -> slotResult(previousMove, slotAssessments);
            case "LANGUAGE_FIX" -> languageFixResult(previousMove, answer);
            case "TASK_RESET" -> taskResetResult(previousMove, diagnosis);
            default -> null;
        };
    }

    private static PreviousMissionResultDto slotResult(
            FeedbackCoachMoveDto previousMove,
            Map<String, SlotAssessmentValue> slotAssessments
    ) {
        if (previousMove.targetSlot() == null) {
            return null;
        }
        SlotAssessmentValue assessment = slotAssessments == null ? null : slotAssessments.get(previousMove.targetSlot());
        SlotAssessmentStatus status = assessment == null ? SlotAssessmentStatus.MISSING : assessment.status();
        String result = switch (status) {
            case SATISFIED -> RESOLVED;
            case GENERIC -> PARTIAL;
            default -> UNRESOLVED;
        };
        String message = switch (result) {
            case RESOLVED -> "해결했어요";
            case PARTIAL -> "조금 더 구체적으로 써 보세요";
            default -> "아직 안 들어갔어요";
        };
        return new PreviousMissionResultDto(
                "SLOT", previousMove.focus(), previousMove.targetSlot(), result, null, null, message
        );
    }

    private static PreviousMissionResultDto languageFixResult(FeedbackCoachMoveDto previousMove, String answer) {
        String normalizedAnswer = normalize(answer);
        int total = 0;
        int applied = 0;
        for (FeedbackLanguageCorrectionDto correction : previousMove.languageCorrections()) {
            String after = normalize(correction.after());
            String before = normalize(correction.before());
            if (after.isEmpty() && before.isEmpty()) {
                continue;
            }
            total++;
            // 고친 표현이 있으면 그 표현이 들어 있는지, 지우기만 하는 교정이면 고치기 전 표현이 빠졌는지 본다.
            boolean reflected = after.isEmpty()
                    ? !containsWords(normalizedAnswer, before)
                    : containsWords(normalizedAnswer, after);
            if (reflected) {
                applied++;
            }
        }
        if (total == 0) {
            return null;
        }
        String result = applied == total ? RESOLVED : applied == 0 ? UNRESOLVED : PARTIAL;
        String message = switch (result) {
            case RESOLVED -> total == 1 ? "고친 곳을 반영했어요" : total + "곳 모두 반영했어요";
            case PARTIAL -> total + "곳 중 " + applied + "곳 반영했어요";
            default -> "아직 반영되지 않았어요";
        };
        return new PreviousMissionResultDto(
                "LANGUAGE_FIX", previousMove.focus(), null, result, applied, total, message
        );
    }

    private static PreviousMissionResultDto taskResetResult(
            FeedbackCoachMoveDto previousMove,
            FeedbackDiagnosisResult diagnosis
    ) {
        boolean onTopic = diagnosis != null && diagnosis.topicRelevance() == TopicRelevance.ON_TOPIC;
        return new PreviousMissionResultDto(
                "TASK_RESET",
                previousMove.focus(),
                previousMove.targetSlot(),
                onTopic ? RESOLVED : UNRESOLVED,
                null,
                null,
                onTopic ? "질문에 맞게 썼어요" : "아직 질문과 거리가 있어요"
        );
    }

    // 대소문자와 문장부호를 무시하고 낱말 사이 공백을 하나로 줄인다. 굽은 따옴표는 곧은 따옴표로 맞춘다.
    static String normalize(String value) {
        if (value == null) {
            return "";
        }
        return value.toLowerCase(Locale.ROOT)
                .replace('’', '\'')
                .replaceAll("[^\\p{L}\\p{N}'\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private static boolean containsWords(String normalizedText, String normalizedWords) {
        return (" " + normalizedText + " ").contains(" " + normalizedWords + " ");
    }
}
