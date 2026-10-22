package com.writeloop.dto;

import java.util.List;

public record DiaryFeedbackResponseDto(
        String schemaVersion,
        String entryId,
        int attemptNo,
        int score,
        boolean finishable,
        DiaryAnswerBand diaryAnswerBand,
        String summaryKo,
        List<String> strengths,
        String correctedDiary,
        String modelDiary,
        String modelDiaryKo,
        List<DiaryCorrectionPointDto> fixPoints,
        DiaryFlowDto diaryFlow,
        List<DiaryRewriteIdeaDto> rewriteIdeas,
        List<DiaryExpressionDto> usedDiaryExpressions,
        List<DiaryExpressionDto> diaryExpressions,
        DiaryMissionDto nextDiaryMission,
        List<String> safetyFlags
) {
    public DiaryFeedbackResponseDto {
        schemaVersion = schemaVersion == null || schemaVersion.isBlank()
                ? "diary-feedback-v1"
                : schemaVersion.trim();
        entryId = normalize(entryId);
        score = Math.max(0, Math.min(100, score));
        diaryAnswerBand = diaryAnswerBand == null ? DiaryAnswerBand.DIARY_CLEAR_BASIC : diaryAnswerBand;
        summaryKo = normalize(summaryKo);
        strengths = strengths == null
                ? List.of()
                : strengths.stream()
                .filter(value -> value != null && !value.isBlank())
                .map(String::trim)
                .toList();
        correctedDiary = normalize(correctedDiary);
        modelDiary = normalize(modelDiary);
        modelDiaryKo = normalize(modelDiaryKo);
        fixPoints = fixPoints == null ? List.of() : List.copyOf(fixPoints);
        diaryFlow = diaryFlow == null
                ? new DiaryFlowDto("", "", "", "", "", List.of())
                : diaryFlow;
        rewriteIdeas = rewriteIdeas == null ? List.of() : List.copyOf(rewriteIdeas);
        usedDiaryExpressions = usedDiaryExpressions == null ? List.of() : List.copyOf(usedDiaryExpressions);
        diaryExpressions = diaryExpressions == null ? List.of() : List.copyOf(diaryExpressions);
        nextDiaryMission = nextDiaryMission == null
                ? new DiaryMissionDto("", "", "", "")
                : nextDiaryMission;
        safetyFlags = safetyFlags == null
                ? List.of()
                : safetyFlags.stream()
                .filter(value -> value != null && !value.isBlank())
                .map(String::trim)
                .toList();
    }

    public DiaryFeedbackResponseDto withIdentity(String nextEntryId, int nextAttemptNo) {
        return new DiaryFeedbackResponseDto(
                schemaVersion,
                nextEntryId,
                nextAttemptNo,
                score,
                finishable,
                diaryAnswerBand,
                summaryKo,
                strengths,
                correctedDiary,
                modelDiary,
                modelDiaryKo,
                fixPoints,
                diaryFlow,
                rewriteIdeas,
                usedDiaryExpressions,
                diaryExpressions,
                nextDiaryMission,
                safetyFlags
        );
    }

    // 완료 가능 여부는 LLM이 정하지 않고, 등급을 보고 서버가 정한다.
    public DiaryFeedbackResponseDto withFinishableFromBand() {
        return new DiaryFeedbackResponseDto(
                schemaVersion,
                entryId,
                attemptNo,
                score,
                isFinishableBand(diaryAnswerBand),
                diaryAnswerBand,
                summaryKo,
                strengths,
                correctedDiary,
                modelDiary,
                modelDiaryKo,
                fixPoints,
                diaryFlow,
                rewriteIdeas,
                usedDiaryExpressions,
                diaryExpressions,
                nextDiaryMission,
                safetyFlags
        );
    }

    public static boolean isFinishableBand(DiaryAnswerBand band) {
        return band == DiaryAnswerBand.DIARY_CLEAR_BASIC || band == DiaryAnswerBand.DIARY_NATURAL_COMPLETE;
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
