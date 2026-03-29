package com.writeloop.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.PromptCoachProfileDto;
import com.writeloop.dto.PromptCoachProfileRequestDto;
import com.writeloop.persistence.PromptCoachProfileEntity;
import com.writeloop.persistence.PromptEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;

@Component
@RequiredArgsConstructor
public class PromptCoachProfileSupport {

    private static final TypeReference<List<String>> STRING_LIST_TYPE = new TypeReference<>() {
    };

    private final ObjectMapper objectMapper;

    public PromptCoachProfileDto toDto(PromptEntity prompt) {
        PromptCoachProfileRequestDto resolved = toResolvedRequest(prompt, prompt == null ? null : prompt.getCoachProfile());
        return new PromptCoachProfileDto(
                resolved.primaryCategory(),
                resolved.secondaryCategories(),
                resolved.preferredExpressionFamilies(),
                resolved.avoidFamilies(),
                resolved.starterStyle(),
                resolved.notes()
        );
    }

    public boolean shouldRefreshSeededProfile(PromptEntity prompt) {
        PromptCoachProfileEntity profile = prompt == null ? null : prompt.getCoachProfile();
        if (profile == null) {
            return true;
        }

        List<String> preferredFamilies = readStringList(profile.getPreferredExpressionFamiliesJson());
        String notes = normalizeText(profile.getNotes(), "");
        boolean generalFallback = normalizeText(profile.getPrimaryCategory(), "GENERAL").equalsIgnoreCase("GENERAL")
                && (preferredFamilies.isEmpty() || preferredFamilies.equals(List.of("starter", "reason")));

        if (generalFallback) {
            return true;
        }

        if (!isSeededPrompt(prompt)) {
            return false;
        }

        PromptCoachProfileRequestDto expected = defaultProfileForPrompt(prompt);
        boolean mismatchedPrimary = !normalizeText(profile.getPrimaryCategory(), "GENERAL")
                .equalsIgnoreCase(expected.primaryCategory());
        boolean mismatchedStarterStyle = !normalizeText(profile.getStarterStyle(), "DIRECT")
                .equalsIgnoreCase(expected.starterStyle());

        return mismatchedPrimary || mismatchedStarterStyle || notes.isBlank();
    }

    public PromptCoachProfileRequestDto defaultProfileForPrompt(PromptEntity prompt) {
        String promptId = prompt == null || prompt.getId() == null ? "" : prompt.getId().toLowerCase(Locale.ROOT);
        String topic = prompt == null || prompt.getTopic() == null ? "" : prompt.getTopic().toLowerCase(Locale.ROOT);
        String question = prompt == null || prompt.getQuestionEn() == null ? "" : prompt.getQuestionEn().toLowerCase(Locale.ROOT);
        String combined = (topic + " " + question).trim();

        switch (promptId) {
            case "prompt-a-1":
                return profile(
                        "ROUTINE",
                        List.of("habit", "daily_life", "after_dinner"),
                        List.of("starter_routine", "frequency", "time_marker", "activity"),
                        List.of("generic_example_marker", "formal_conclusion", "compare_balance"),
                        "DIRECT",
                        "루틴형 질문입니다. 시간 표현과 순서 표현을 우선 추천합니다."
                );
            case "prompt-a-2":
                return profile(
                        "PREFERENCE",
                        List.of("preference", "reason", "personal"),
                        List.of("favorite", "reason", "adjective", "example"),
                        List.of("compare_balance", "formal_conclusion"),
                        "DIRECT",
                        "선호형 질문입니다. favorite, because, 형용사 표현을 우선 추천합니다."
                );
            case "prompt-a-3":
                return profile(
                        "ROUTINE",
                        List.of("habit", "weekend", "leisure"),
                        List.of("starter_routine", "frequency", "activity", "companion", "place"),
                        List.of("generic_example_marker", "formal_conclusion", "compare_balance"),
                        "DIRECT",
                        "주말 루틴형 질문입니다. 활동, 장소, 함께하는 사람 표현을 우선 추천합니다."
                );
            case "prompt-a-4":
                return profile(
                        "ROUTINE",
                        List.of("habit", "after_work", "leisure"),
                        List.of("starter_routine", "time_marker", "activity", "reason"),
                        List.of("generic_example_marker", "formal_conclusion", "compare_balance"),
                        "DIRECT",
                        "퇴근 후 루틴형 질문입니다. 시간 표현과 활동, 간단한 이유 표현을 우선 추천합니다."
                );
            case "prompt-b-1":
                return profile(
                        "PROBLEM_SOLUTION",
                        List.of("experience", "problem", "solution"),
                        List.of("problem", "response", "sequence", "result"),
                        List.of("generic_example_marker"),
                        "REFLECTIVE",
                        "문제 해결형 질문입니다. 문제, 대응, 결과 흐름을 우선 추천합니다."
                );
            case "prompt-b-2":
                return profile(
                        "GOAL_PLAN",
                        List.of("travel", "place", "activity"),
                        List.of("desire", "place", "activity", "reason"),
                        List.of("formal_conclusion"),
                        "DIRECT",
                        "여행 계획형 질문입니다. 가고 싶은 이유와 현지 활동 표현을 우선 추천합니다."
                );
            case "prompt-b-3":
                return profile(
                        "GOAL_PLAN",
                        List.of("goal", "plan", "habit"),
                        List.of("goal", "plan", "process", "result"),
                        List.of("generic_example_marker", "formal_conclusion"),
                        "DIRECT",
                        "목표 계획형 질문입니다. 습관, 실천 루틴, 이유 표현을 우선 추천합니다."
                );
            case "prompt-b-4":
                return profile(
                        "GOAL_PLAN",
                        List.of("travel", "place", "activity"),
                        List.of("desire", "place", "activity", "linker"),
                        List.of("formal_conclusion"),
                        "DIRECT",
                        "여행 계획형 질문입니다. 이유와 활동을 because, also 같은 연결 표현으로 이어 주는 구성을 우선 추천합니다."
                );
            case "prompt-b-5":
                return profile(
                        "GOAL_PLAN",
                        List.of("goal", "plan", "growth"),
                        List.of("goal", "plan", "process", "reason"),
                        List.of("generic_example_marker", "formal_conclusion"),
                        "DIRECT",
                        "성장 목표형 질문입니다. 능력, 연습 계획, 개인적인 이유 표현을 우선 추천합니다."
                );
            case "prompt-c-1":
                return profile(
                        "BALANCED_OPINION",
                        List.of("opinion", "balance", "technology"),
                        List.of("starter_topic", "contrast", "opinion", "qualification"),
                        List.of("generic_example_marker"),
                        "BALANCED",
                        "균형형 질문입니다. 장단점 비교와 조건부 평가 표현을 우선 추천합니다."
                );
            case "prompt-c-2":
                return profile(
                        "OPINION_REASON",
                        List.of("opinion", "reason", "society"),
                        List.of("opinion", "responsibility", "reason", "example"),
                        List.of("generic_example_marker", "casual_habit"),
                        "DIRECT",
                        "입장형 질문입니다. 주장, 근거, 예시 표현을 우선 추천합니다."
                );
            case "prompt-c-3":
                return profile(
                        "CHANGE_REFLECTION",
                        List.of("reflection", "change", "cause"),
                        List.of("past_present", "change", "cause", "realization"),
                        List.of("generic_example_marker"),
                        "REFLECTIVE",
                        "변화 회고형 질문입니다. 과거-현재 대비와 변화 계기 표현을 우선 추천합니다."
                );
            default:
                break;
        }

        if (combined.contains("after dinner")
                || combined.contains("after work")
                || combined.contains("weekend")
                || combined.contains("usually spend")) {
            return profile(
                    "ROUTINE",
                    List.of("habit", "personal", "leisure"),
                    List.of("starter_routine", "frequency", "activity", "companion", "time_marker"),
                    List.of("generic_example_marker", "formal_conclusion"),
                    "DIRECT",
                    "루틴형 질문입니다. 빈도와 활동 중심 표현을 우선 추천합니다."
            );
        }

        if (combined.contains("favorite") || combined.contains("why do you like it")) {
            return profile(
                    "PREFERENCE",
                    List.of("preference", "reason", "personal"),
                    List.of("favorite", "reason", "adjective", "example"),
                    List.of("compare_balance", "formal_conclusion"),
                    "DIRECT",
                    "선호형 질문입니다. 좋아하는 이유를 자연스럽게 설명하는 표현을 우선 추천합니다."
            );
        }

        if ((combined.contains("challenge") && combined.contains("deal with")) || combined.contains("problem solving")) {
            return profile(
                    "PROBLEM_SOLUTION",
                    List.of("experience", "problem", "solution"),
                    List.of("problem", "response", "sequence", "result"),
                    List.of("generic_example_marker"),
                    "REFLECTIVE",
                    "문제 해결형 질문입니다. 문제와 해결 과정을 순서대로 설명하는 표현을 우선 추천합니다."
            );
        }

        if (combined.contains("visit")
                || combined.contains("would like to do there")
                || combined.contains("want to do there")
                || combined.contains("travel")) {
            return profile(
                    "GOAL_PLAN",
                    List.of("travel", "place", "activity"),
                    List.of("desire", "place", "activity", "reason"),
                    List.of("formal_conclusion"),
                    "DIRECT",
                    "계획형 질문입니다. 가고 싶은 곳과 활동을 연결해서 설명하는 표현을 우선 추천합니다."
            );
        }

        if (combined.contains("habit you want to build")
                || combined.contains("skill you want to improve")
                || combined.contains("practice it")) {
            return profile(
                    "GOAL_PLAN",
                    List.of("goal", "plan", "reason"),
                    List.of("goal", "plan", "process", "result"),
                    List.of("generic_example_marker"),
                    "DIRECT",
                    "목표 계획형 질문입니다. 목표, 계획, 이유 표현을 우선 추천합니다."
            );
        }

        if ((combined.contains("technology") && combined.contains("relationships"))
                || combined.contains("mostly positive")) {
            return profile(
                    "BALANCED_OPINION",
                    List.of("opinion", "balance", "issue"),
                    List.of("starter_topic", "contrast", "opinion", "qualification"),
                    List.of("generic_example_marker"),
                    "BALANCED",
                    "균형형 질문입니다. 찬반과 조건부 의견 표현을 우선 추천합니다."
            );
        }

        if (combined.contains("social responsibility")
                || combined.contains("successful companies")
                || combined.contains("responsibility should")) {
            return profile(
                    "OPINION_REASON",
                    List.of("opinion", "reason", "society"),
                    List.of("opinion", "responsibility", "reason", "example"),
                    List.of("generic_example_marker", "casual_habit"),
                    "DIRECT",
                    "입장형 질문입니다. 주장과 근거를 분명하게 전개하는 표현을 우선 추천합니다."
            );
        }

        if (combined.contains("changed over time")
                || combined.contains("changed your mind")
                || combined.contains("belief")) {
            return profile(
                    "CHANGE_REFLECTION",
                    List.of("reflection", "change", "cause"),
                    List.of("past_present", "change", "cause", "realization"),
                    List.of("generic_example_marker"),
                    "REFLECTIVE",
                    "회고형 질문입니다. 과거와 현재를 비교하는 표현을 우선 추천합니다."
            );
        }

        return profile(
                "GENERAL",
                List.of("general"),
                List.of("starter", "reason"),
                List.of(),
                "DIRECT",
                "일반 설명형 질문입니다. 기본 starter와 reason 표현을 우선 추천합니다."
        );
    }

    private PromptCoachProfileRequestDto profile(
            String primaryCategory,
            List<String> secondaryCategories,
            List<String> preferredExpressionFamilies,
            List<String> avoidFamilies,
            String starterStyle,
            String notes
    ) {
        return new PromptCoachProfileRequestDto(
                primaryCategory,
                secondaryCategories,
                preferredExpressionFamilies,
                avoidFamilies,
                starterStyle,
                notes
        );
    }

    public void upsertProfile(PromptEntity prompt, PromptCoachProfileRequestDto request) {
        PromptCoachProfileRequestDto resolved = normalizeProfile(request == null ? defaultProfileForPrompt(prompt) : request);
        PromptCoachProfileEntity existing = prompt.getCoachProfile();
        if (existing == null) {
            prompt.upsertCoachProfile(toEntity(prompt, resolved));
            return;
        }

        existing.attachPrompt(prompt);
        existing.update(
                resolved.primaryCategory(),
                writeStringList(resolved.secondaryCategories()),
                writeStringList(resolved.preferredExpressionFamilies()),
                writeStringList(resolved.avoidFamilies()),
                resolved.starterStyle(),
                resolved.notes()
        );
        prompt.upsertCoachProfile(existing);
    }

    public PromptCoachProfileEntity toEntity(PromptEntity prompt, PromptCoachProfileRequestDto request) {
        PromptCoachProfileRequestDto resolved = normalizeProfile(request == null ? defaultProfileForPrompt(prompt) : request);
        return new PromptCoachProfileEntity(
                prompt,
                resolved.primaryCategory(),
                writeStringList(resolved.secondaryCategories()),
                writeStringList(resolved.preferredExpressionFamilies()),
                writeStringList(resolved.avoidFamilies()),
                resolved.starterStyle(),
                resolved.notes()
        );
    }

    private PromptCoachProfileRequestDto toResolvedRequest(PromptEntity prompt, PromptCoachProfileEntity profile) {
        if (profile == null) {
            return defaultProfileForPrompt(prompt);
        }

        return normalizeProfile(new PromptCoachProfileRequestDto(
                profile.getPrimaryCategory(),
                readStringList(profile.getSecondaryCategoriesJson()),
                readStringList(profile.getPreferredExpressionFamiliesJson()),
                readStringList(profile.getAvoidFamiliesJson()),
                profile.getStarterStyle(),
                profile.getNotes()
        ));
    }

    private PromptCoachProfileRequestDto normalizeProfile(PromptCoachProfileRequestDto request) {
        return new PromptCoachProfileRequestDto(
                normalizeText(request.primaryCategory(), "GENERAL").toUpperCase(Locale.ROOT),
                normalizeStringList(request.secondaryCategories()),
                normalizeStringList(request.preferredExpressionFamilies()),
                normalizeStringList(request.avoidFamilies()),
                normalizeText(request.starterStyle(), "DIRECT").toUpperCase(Locale.ROOT),
                normalizeText(request.notes(), "")
        );
    }

    private List<String> normalizeStringList(List<String> values) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }

        LinkedHashSet<String> normalized = new LinkedHashSet<>();
        for (String value : values) {
            String trimmed = normalizeText(value, "");
            if (!trimmed.isBlank()) {
                normalized.add(trimmed);
            }
        }
        return List.copyOf(normalized);
    }

    private String normalizeText(String value, String fallback) {
        if (value == null) {
            return fallback;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? fallback : trimmed;
    }

    private boolean isSeededPrompt(PromptEntity prompt) {
        if (prompt == null || prompt.getId() == null) {
            return false;
        }

        return switch (prompt.getId().toLowerCase(Locale.ROOT)) {
            case "prompt-a-1",
                    "prompt-a-2",
                    "prompt-a-3",
                    "prompt-a-4",
                    "prompt-b-1",
                    "prompt-b-2",
                    "prompt-b-3",
                    "prompt-b-4",
                    "prompt-b-5",
                    "prompt-c-1",
                    "prompt-c-2",
                    "prompt-c-3" -> true;
            default -> false;
        };
    }

    private String writeStringList(List<String> values) {
        try {
            return objectMapper.writeValueAsString(normalizeStringList(values));
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to write prompt coach profile list", exception);
        }
    }

    private List<String> readStringList(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }

        try {
            return normalizeStringList(objectMapper.readValue(json, STRING_LIST_TYPE));
        } catch (Exception exception) {
            return List.of();
        }
    }
}
