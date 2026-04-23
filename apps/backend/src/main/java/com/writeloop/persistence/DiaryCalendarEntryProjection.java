package com.writeloop.persistence;

import java.time.Instant;
import java.time.LocalDate;

public interface DiaryCalendarEntryProjection {

    String getId();

    LocalDate getEntryDate();

    Instant getCreatedAt();
}
