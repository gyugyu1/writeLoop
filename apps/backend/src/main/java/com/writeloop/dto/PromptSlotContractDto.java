package com.writeloop.dto;

public record PromptSlotContractDto(
        String semanticRoleEn,
        String satisfiedWhenEn,
        String semanticRoleKo,
        String satisfiedWhenKo
) {
    public PromptSlotContractDto {
        semanticRoleEn = normalize(semanticRoleEn);
        satisfiedWhenEn = normalize(satisfiedWhenEn);
        semanticRoleKo = normalize(semanticRoleKo);
        satisfiedWhenKo = normalize(satisfiedWhenKo);
    }

    public boolean isComplete() {
        return !semanticRoleEn.isBlank()
                && !satisfiedWhenEn.isBlank()
                && !semanticRoleKo.isBlank()
                && !satisfiedWhenKo.isBlank();
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
