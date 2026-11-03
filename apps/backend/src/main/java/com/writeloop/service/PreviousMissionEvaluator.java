package com.writeloop.service;

import com.writeloop.dto.FeedbackCoachMoveDto;
import com.writeloop.dto.FeedbackLanguageCorrectionDto;
import com.writeloop.dto.PreviousMissionResultDto;

import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// 바로 앞 시도의 미션을 이번 답이 해결했는지 기계적으로 판정한다. LLM을 다시 부르지 않고,
// 이번 진단(주제·슬롯 판정·교정 유무)과 이번 답 글자, 문장 교정이면 지난 답 글자를 본다.
final class PreviousMissionEvaluator {

    static final String RESOLVED = "RESOLVED";
    static final String PARTIAL = "PARTIAL";
    static final String UNRESOLVED = "UNRESOLVED";

    private PreviousMissionEvaluator() {
    }

    static PreviousMissionResultDto evaluate(
            FeedbackCoachMoveDto previousMove,
            String previousAnswer,
            String answer,
            FeedbackDiagnosisResult diagnosis,
            Map<String, SlotAssessmentValue> slotAssessments
    ) {
        if (previousMove == null || previousMove.focusType() == null) {
            return null;
        }
        return switch (previousMove.focusType()) {
            case "SLOT" -> slotResult(previousMove, slotAssessments);
            case "LANGUAGE_FIX" -> languageFixResult(previousMove, previousAnswer, answer, diagnosis);
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

    private static PreviousMissionResultDto languageFixResult(
            FeedbackCoachMoveDto previousMove,
            String previousAnswer,
            String answer,
            FeedbackDiagnosisResult diagnosis
    ) {
        String normalizedAnswer = normalize(answer);
        // 교정 줄은 앞 교정까지 적용한 중간 문장 기준이라 글자 비교가 어긋날 수 있다. 이번 진단에 교정이
        // 하나도 없으면 줄별 비교와 관계없이 모두 반영한 것으로 본다.
        boolean noRemainingCorrection = !hasLanguageCorrection(diagnosis);
        int total = 0;
        int applied = 0;
        for (FeedbackLanguageCorrectionDto correction : previousMove.languageCorrections()) {
            String after = normalize(correction.after());
            String before = normalize(correction.before());
            if (after.isEmpty() && before.isEmpty()) {
                continue;
            }
            total++;
            if (noRemainingCorrection
                    || isReflected(correction, before, after, previousAnswer, answer, normalizedAnswer)) {
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

    // 교정 줄 하나가 새 답에 반영됐는지. 교정 줄에는 앞뒤 낱말이 붙어 있어, 고친 표현만 찾으면
    // 고치지 않은 답에서도 찾히는 줄(대소문자·문장부호만 고친 줄, 낱말을 지우는 줄)은 고치기 전 표현이 빠졌는지도 본다.
    private static boolean isReflected(
            FeedbackLanguageCorrectionDto correction,
            String before,
            String after,
            String previousAnswer,
            String answer,
            String normalizedAnswer
    ) {
        if (after.isEmpty()) {
            return !containsWords(normalizedAnswer, before);
        }
        if (after.equals(before)) {
            // 대소문자·문장부호만 고친 줄: 같은 낱말이 답의 다른 곳에 있을 수 있어(문장 첫 The와 가운데 the),
            // 지난 답보다 고치기 전 표현이 줄고 고친 표현이 늘었는지로 본다. 고친 표현은 뒤 교정이 문장부호를
            // 더 붙였을 수 있어(Yesterday → Yesterday,) 앞뒤가 글자·숫자가 아닌 자리에서 센다.
            String rawBefore = rawWords(correction.before());
            String rawAfter = rawWords(correction.after());
            String rawPrevious = rawWords(previousAnswer);
            String rawAnswer = rawWords(answer);
            int previousBeforeCount = countBetweenSpaces(rawPrevious, rawBefore);
            if (previousBeforeCount == 0) {
                // 지난 답에 없는 중간 문장의 표현이면 셀 수 없어, 고친 표현이 있고 고치기 전 표현이 없는지로 본다.
                return countBetweenNonWords(rawAnswer, rawAfter) > 0 && countBetweenSpaces(rawAnswer, rawBefore) == 0;
            }
            return countBetweenSpaces(rawAnswer, rawBefore) < previousBeforeCount
                    && countBetweenNonWords(rawAnswer, rawAfter) > countBetweenNonWords(rawPrevious, rawAfter);
        }
        if (containsWords(before, after)) {
            return containsWords(normalizedAnswer, after) && !containsWords(normalizedAnswer, before);
        }
        return containsWords(normalizedAnswer, after);
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

    private static boolean hasLanguageCorrection(FeedbackDiagnosisResult diagnosis) {
        if (diagnosis == null) {
            return true;
        }
        return diagnosis.languageAssessment().revisionSteps().stream().anyMatch(step -> step.kind() != null);
    }

    // 대소문자와 문장부호는 그대로 두고, 공백을 하나로 줄이고 굽은 따옴표만 곧은 따옴표로 맞춘다.
    private static String rawWords(String value) {
        if (value == null) {
            return "";
        }
        return value.replace('‘', '\'')
                .replace('’', '\'')
                .replace('“', '"')
                .replace('”', '"')
                .replaceAll("\\s+", " ")
                .trim();
    }

    // 공백으로 나뉜 자리에서만 센다. "Yesterday"가 "Yesterday,"에, "i"가 "it"에 세어지지 않는다.
    private static int countBetweenSpaces(String text, String words) {
        return count(text, words, "(?<!\\S)", "(?!\\S)");
    }

    // 앞뒤가 글자·숫자에 이어지지 않는 자리에서 센다. 뒤에 문장부호가 더 붙어도 세고, "i"가 "it"에는 세어지지 않는다.
    private static int countBetweenNonWords(String text, String words) {
        return count(text, words, "(?<![\\p{L}\\p{N}])", "(?![\\p{L}\\p{N}])");
    }

    private static int count(String text, String words, String leftBoundary, String rightBoundary) {
        if (words.isEmpty()) {
            return 0;
        }
        Matcher matcher = Pattern.compile(leftBoundary + Pattern.quote(words) + rightBoundary).matcher(text);
        int count = 0;
        while (matcher.find()) {
            count++;
        }
        return count;
    }
}
