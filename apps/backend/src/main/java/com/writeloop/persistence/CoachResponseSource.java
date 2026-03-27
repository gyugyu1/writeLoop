package com.writeloop.persistence;

public enum CoachResponseSource {
    DETERMINISTIC,
    DETERMINISTIC_WITH_SLOT_TRANSLATION,
    OPENAI,
    LOCAL_FALLBACK
}
