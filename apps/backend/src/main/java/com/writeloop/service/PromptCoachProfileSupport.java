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

        return isSeededPrompt(prompt) && notes.isBlank();
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
                        "저녁 이후 루틴형 질문입니다. 시간표지와 빈도 표현을 우선 추천하고, 무거운 결론형 표현은 뒤로 미룹니다."
                );
            case "prompt-a-2":
                return profile(
                        "PREFERENCE",
                        List.of("preference", "reason", "personal"),
                        List.of("favorite", "reason", "adjective", "example"),
                        List.of("compare_balance", "formal_conclusion"),
                        "DIRECT",
                        "좋아하는 대상과 이유를 함께 말하는 질문입니다. favorite, because, 형용사 표현을 우선 추천합니다."
                );
            case "prompt-a-3":
                return profile(
                        "ROUTINE",
                        List.of("habit", "weekend", "leisure"),
                        List.of("starter_routine", "frequency", "activity", "companion", "place"),
                        List.of("generic_example_marker", "formal_conclusion", "compare_balance"),
                        "DIRECT",
                        "주말 루틴형 질문입니다. 빈도, 활동, 함께하는 사람, 장소 표현을 우선 추천합니다."
                );
            case "prompt-b-1":
                return profile(
                        "PROBLEM_SOLUTION",
                        List.of("experience", "problem", "solution"),
                        List.of("problem", "response", "sequence", "result"),
                        List.of("generic_example_marker"),
                        "REFLECTIVE",
                        "문제 상황과 해결 과정을 말하는 질문입니다. 문제 -> 대응 -> 결과 흐름을 살리는 표현을 우선 추천합니다."
                );
            case "prompt-b-2":
                return profile(
                        "GOAL_PLAN",
                        List.of("travel", "place", "activity"),
                        List.of("desire", "place", "activity", "reason"),
                        List.of("formal_conclusion"),
                        "DIRECT",
                        "가보고 싶은 장소와 그곳에서 하고 싶은 일을 말하는 질문입니다. desire, place, activity 표현을 우선 추천합니다."
                );
            case "prompt-b-3":
                return profile(
                        "GOAL_PLAN",
                        List.of("goal", "plan", "habit"),
                        List.of("goal", "plan", "process", "result"),
                        List.of("generic_example_marker"),
                        "DIRECT",
                        "올해 만들고 싶은 습관과 실천 계획을 말하는 질문입니다. 목표, 계획, 유지 과정 표현을 우선 추천합니다."
                );
            case "prompt-c-1":
                return profile(
                        "BALANCED_OPINION",
                        List.of("opinion", "balance", "technology"),
                        List.of("starter_topic", "contrast", "opinion", "qualification"),
                        List.of("generic_example_marker"),
                        "BALANCED",
                        "기술 변화의 장단점을 함께 다루는 균형형 질문입니다. 대조, 입장, 조건부 평가 표현을 우선 추천합니다."
                );
            case "prompt-c-2":
                return profile(
                        "OPINION_REASON",
                        List.of("opinion", "reason", "society"),
                        List.of("opinion", "responsibility", "reason", "example"),
                        List.of("generic_example_marker", "casual_habit"),
                        "DIRECT",
                        "사회적 책임에 대한 입장과 근거를 말하는 질문입니다. 주장, 책임, 근거, 구체 예시 표현을 우선 추천합니다."
                );
            case "prompt-c-3":
                return profile(
                        "CHANGE_REFLECTION",
                        List.of("reflection", "change", "cause"),
                        List.of("past_present", "change", "cause", "realization"),
                        List.of("generic_example_marker"),
                        "REFLECTIVE",
                        "시간이 지나며 바뀐 생각을 돌아보는 질문입니다. 과거-현재 대비와 변화 계기 표현을 우선 추천합니다."
                );
            default:
                break;
        }

        if (promptId.equals("prompt-a-1") || promptId.equals("prompt-a-3")
                || combined.contains("weekend") || combined.contains("usually spend") || combined.contains("daily routine") || combined.contains("after dinner")) {
            return profile(
                    "ROUTINE",
                    List.of("habit", "personal", "leisure"),
                    List.of("starter_routine", "frequency", "activity", "companion", "time_marker"),
                    List.of("generic_example_marker", "formal_conclusion"),
                    "DIRECT",
                    "일상 루틴형 질문입니다. 빈도와 활동 중심 표현을 먼저 추천합니다."
            );
        }

        if (promptId.equals("prompt-a-2") || combined.contains("favorite") || combined.contains("why do you like it")) {
            return profile(
                    "PREFERENCE",
                    List.of("preference", "reason", "personal"),
                    List.of("favorite", "reason", "adjective", "example"),
                    List.of("compare_balance", "formal_conclusion"),
                    "DIRECT",
                    "선호와 이유를 함께 설명하는 질문입니다."
            );
        }

        if (promptId.equals("prompt-b-1") || (combined.contains("challenge") && combined.contains("deal with"))) {
            return profile(
                    "PROBLEM_SOLUTION",
                    List.of("experience", "problem", "solution"),
                    List.of("problem", "response", "sequence", "result"),
                    List.of("generic_example_marker"),
                    "REFLECTIVE",
                    "문제와 해결 과정을 설명하는 질문입니다."
            );
        }

        if (promptId.equals("prompt-b-2") || combined.contains("visit") || combined.contains("would like to do there") || combined.contains("travel")) {
            return profile(
                    "GOAL_PLAN",
                    List.of("travel", "place", "activity"),
                    List.of("desire", "place", "activity", "reason"),
                    List.of("formal_conclusion"),
                    "DIRECT",
                    "원하는 장소와 활동 계획을 말하는 질문입니다."
            );
        }

        if (promptId.equals("prompt-b-3")
                || combined.contains("habit you want to build")
                || combined.contains("skill you want to improve")
                || combined.contains("practice it")) {
            return profile(
                    "GOAL_PLAN",
                    List.of("goal", "plan", "reason"),
                    List.of("goal", "plan", "process", "result"),
                    List.of("generic_example_marker"),
                    "DIRECT",
                    "목표와 실천 계획을 함께 설명하는 질문입니다."
            );
        }

        if (promptId.equals("prompt-c-1") || (combined.contains("technology") && combined.contains("relationships") && combined.contains("positive"))) {
            return profile(
                    "BALANCED_OPINION",
                    List.of("opinion", "balance", "technology"),
                    List.of("starter_topic", "contrast", "opinion", "qualification"),
                    List.of("generic_example_marker"),
                    "BALANCED",
                    "장단점을 균형 있게 평가하는 질문입니다."
            );
        }

        if (promptId.equals("prompt-c-2") || combined.contains("social responsibility") || combined.contains("successful companies")) {
            return profile(
                    "OPINION_REASON",
                    List.of("opinion", "reason", "society"),
                    List.of("opinion", "responsibility", "reason", "example"),
                    List.of("generic_example_marker", "casual_habit"),
                    "DIRECT",
                    "입장과 근거를 설득력 있게 전개하는 질문입니다."
            );
        }

        if (promptId.equals("prompt-c-3") || (combined.contains("belief") && combined.contains("changed over time"))) {
            return profile(
                    "CHANGE_REFLECTION",
                    List.of("reflection", "change", "cause"),
                    List.of("past_present", "change", "cause", "realization"),
                    List.of("generic_example_marker"),
                    "REFLECTIVE",
                    "생각이 어떻게 바뀌었는지 돌아보는 질문입니다."
            );
        }

        return profile(
                "GENERAL",
                List.of("general"),
                List.of("starter", "reason"),
                List.of(),
                "DIRECT",
                "일반 질문입니다. 기본 starter와 reason 표현을 우선 추천합니다."
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
                    "prompt-b-1",
                    "prompt-b-2",
                    "prompt-b-3",
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
