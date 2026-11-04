package com.writeloop.service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// 학생 화면에 나가는 LLM 글을 기계적으로 다듬는다. 프롬프트 규칙이 지켜지지 않았을 때의 안전장치다.
final class LearnerTextGuard {

    private static final Pattern BLANK = Pattern.compile("_{2,}");

    // 학생에게 보이는 한국어 글에 내부 슬롯 코드가 나오면 바꿀 한국어 이름. 긴 코드부터 맞춘다.
    private static final Map<String, String> SLOT_LABELS_KO = slotLabels();
    private static final Pattern SLOT_CODE = Pattern.compile(
            "(?<![A-Za-z_])(" + String.join("|", SLOT_LABELS_KO.keySet()) + ")(?![A-Za-z_])"
    );

    private LearnerTextGuard() {
    }

    // 넣어볼 표현이 문장 틀의 빈칸 앞뒤 낱말을 다시 담고 있으면(on ____ + "on Sunday") 그 낱말을 뗀다.
    // 한 낱말이 똑같이 겹칠 때만 떼고, 떼고 나서 남는 것이 없으면 null(그 표현을 뺀다).
    static String trimBlankOverlap(String skeletonEn, String phrase) {
        if (skeletonEn == null || phrase == null || phrase.isBlank()) {
            return phrase;
        }
        Matcher blank = BLANK.matcher(skeletonEn);
        if (!blank.find()) {
            return phrase;
        }
        String before = lastWord(skeletonEn.substring(0, blank.start()));
        String after = firstWord(skeletonEn.substring(blank.end()));
        List<String> words = new ArrayList<>(Arrays.asList(phrase.trim().split("\\s+")));
        if (before != null && !words.isEmpty() && letters(words.get(0)).equals(before)) {
            words.remove(0);
        }
        if (after != null && !words.isEmpty() && letters(words.get(words.size() - 1)).equals(after)) {
            words.remove(words.size() - 1);
        }
        return words.isEmpty() ? null : String.join(" ", words);
    }

    // 학생에게 보이는 한국어 글에서 슬롯 코드(ACTION 등)를 한국어 이름으로 바꾼다.
    static String replaceSlotCodes(String text) {
        if (text == null || text.isBlank()) {
            return text;
        }
        Matcher matcher = SLOT_CODE.matcher(text);
        StringBuilder result = new StringBuilder();
        while (matcher.find()) {
            matcher.appendReplacement(result, Matcher.quoteReplacement(SLOT_LABELS_KO.get(matcher.group(1))));
        }
        matcher.appendTail(result);
        return result.toString();
    }

    private static String lastWord(String text) {
        String[] words = text.trim().split("\\s+");
        String word = words.length == 0 ? "" : letters(words[words.length - 1]);
        return word.isEmpty() ? null : word;
    }

    private static String firstWord(String text) {
        String[] words = text.trim().split("\\s+");
        String word = words.length == 0 ? "" : letters(words[0]);
        return word.isEmpty() ? null : word;
    }

    // 낱말 비교용: 소문자로, 글자·숫자·아포스트로피만 남긴다(문장부호가 붙어도 같은 낱말로 보고, 7am과 8am은 다르게 본다).
    private static String letters(String word) {
        return word.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}']", "");
    }

    private static Map<String, String> slotLabels() {
        Map<String, String> labels = new LinkedHashMap<>();
        labels.put("ADDITIONAL_ACTION", "추가 행동");
        labels.put("SPECIFIC_TIME", "구체적인 때");
        labels.put("BEFORE_STATE", "이전 상태");
        labels.put("CHANGE_CAUSE", "바뀐 계기");
        labels.put("DISADVANTAGE", "단점");
        labels.put("ADVANTAGE", "장점");
        labels.put("NOW_STATE", "지금 상태");
        labels.put("SOLUTION", "해결책");
        labels.put("OPINION", "의견");
        labels.put("PROBLEM", "문제");
        labels.put("FEELING", "감정");
        labels.put("EXAMPLE", "예시");
        labels.put("RESULT", "결과");
        labels.put("REASON", "이유");
        labels.put("DETAIL", "세부 내용");
        labels.put("CHOICE", "선택");
        labels.put("ACTION", "행동");
        labels.put("PLACE", "장소");
        labels.put("GOAL", "목표");
        labels.put("PLAN", "계획");
        return labels;
    }
}
