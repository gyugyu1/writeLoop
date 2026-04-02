package com.writeloop.dto;

public record FeedbackFocusCardDto(
        String title,
        String headline,
        String supportText
) {
    public FeedbackFocusCardDto {
        title = title == null ? "" : title.trim();
        headline = headline == null ? "" : headline.trim();
        supportText = supportText == null || supportText.isBlank() ? null : supportText.trim();
    }
}
