package com.writeloop.service;

import com.writeloop.dto.NowInEnglishEntryDto;
import com.writeloop.dto.NowInEnglishEntryRequestDto;
import com.writeloop.dto.NowInEnglishEntrySyncRequestDto;
import com.writeloop.persistence.NowInEnglishEntryEntity;
import com.writeloop.persistence.NowInEnglishEntryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class NowInEnglishEntryService {

    private static final int MAX_ENTRY_LENGTH = 500;
    private static final int MAX_SYNC_ENTRIES = 120;
    private static final ZoneId SEOUL_ZONE_ID = ZoneId.of("Asia/Seoul");
    private static final Pattern ENTRY_ID_PATTERN = Pattern.compile("[A-Za-z0-9._:-]{1,80}");

    private final NowInEnglishEntryRepository nowInEnglishEntryRepository;

    @Transactional(readOnly = true)
    public List<NowInEnglishEntryDto> listEntries(Long userId) {
        return nowInEnglishEntryRepository.findTop120ByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public NowInEnglishEntryDto createEntry(Long userId, NowInEnglishEntryRequestDto request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body is required");
        }
        return toDto(upsertEntry(userId, request));
    }

    @Transactional
    public List<NowInEnglishEntryDto> syncEntries(Long userId, NowInEnglishEntrySyncRequestDto request) {
        if (request == null || request.entries() == null || request.entries().isEmpty()) {
            return listEntries(userId);
        }

        Map<String, NowInEnglishEntryRequestDto> uniqueRequests = new LinkedHashMap<>();
        for (NowInEnglishEntryRequestDto entry : request.entries()) {
            if (entry == null) {
                continue;
            }
            String entryId = normalizeEntryId(entry.id());
            uniqueRequests.putIfAbsent(entryId, entry);
            if (uniqueRequests.size() >= MAX_SYNC_ENTRIES) {
                break;
            }
        }

        uniqueRequests.values().forEach(entry -> upsertEntry(userId, entry));
        return listEntries(userId);
    }

    private NowInEnglishEntryEntity upsertEntry(Long userId, NowInEnglishEntryRequestDto request) {
        String entryId = normalizeEntryId(request.id());
        String text = normalizeText(request.text());
        String polishedFromEntryId = normalizeOptionalEntryId(request.polishedFromEntryId());
        String polishedFromText = normalizeOptionalText(request.polishedFromText());
        Instant createdAt = request.createdAt() == null ? Instant.now() : request.createdAt();
        LocalDate entryDate = resolveEntryDate(request.dateKey(), createdAt);

        NowInEnglishEntryEntity entry = nowInEnglishEntryRepository
                .findByUserIdAndEntryId(userId, entryId)
                .orElseGet(() -> new NowInEnglishEntryEntity(entryId, userId, text, entryDate, createdAt));

        entry.setText(text);
        entry.setPolishedFromEntryId(polishedFromEntryId);
        entry.setPolishedFromText(polishedFromText);
        entry.setEntryDate(entryDate);
        return nowInEnglishEntryRepository.save(entry);
    }

    private String normalizeEntryId(String value) {
        String normalized = value == null || value.isBlank()
                ? "now-" + UUID.randomUUID()
                : value.trim();
        if (!ENTRY_ID_PATTERN.matcher(normalized).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid entry id");
        }
        return normalized;
    }

    private String normalizeOptionalEntryId(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return normalizeEntryId(value);
    }

    private String normalizeText(String value) {
        String normalized = value == null ? "" : value.replaceAll("\\s+", " ").trim();
        if (normalized.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Entry text is required");
        }
        if (normalized.length() > MAX_ENTRY_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Entry text is too long");
        }
        return normalized;
    }

    private String normalizeOptionalText(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return normalizeText(value);
    }

    private LocalDate resolveEntryDate(String dateKey, Instant createdAt) {
        if (dateKey != null && !dateKey.isBlank()) {
            try {
                return LocalDate.parse(dateKey.trim());
            } catch (Exception ignored) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid date key");
            }
        }
        return LocalDate.ofInstant(createdAt, SEOUL_ZONE_ID);
    }

    private NowInEnglishEntryDto toDto(NowInEnglishEntryEntity entry) {
        return new NowInEnglishEntryDto(
                entry.getEntryId(),
                entry.getText(),
                entry.getPolishedFromEntryId(),
                entry.getPolishedFromText(),
                entry.getEntryDate().toString(),
                entry.getCreatedAt()
        );
    }
}
