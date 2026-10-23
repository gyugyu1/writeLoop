package com.writeloop.persistence;

// 지표 계산에 필요한 LLM 호출 한 건의 값만 읽는다(메타데이터 JSON 등은 읽지 않는다).
public interface FeedbackTimingLlmCallView {

    String getFeedbackType();

    Boolean getSuccess();

    Long getElapsedMs();

    Long getLlmInputTokens();

    Long getLlmCachedInputTokens();

    Long getLlmOutputTokens();
}
