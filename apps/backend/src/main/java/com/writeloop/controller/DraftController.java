package com.writeloop.controller;

import com.writeloop.dto.SaveWritingDraftRequestDto;
import com.writeloop.dto.WritingDraftDto;
import com.writeloop.dto.WritingDraftTypeDto;
import com.writeloop.service.AuthService;
import com.writeloop.service.DraftService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/drafts")
@RequiredArgsConstructor
public class DraftController {

    private final AuthService authService;
    private final DraftService draftService;

    @GetMapping("/{promptId}")
    public ResponseEntity<WritingDraftDto> getDraft(
            @PathVariable String promptId,
            @RequestParam WritingDraftTypeDto draftType,
            HttpServletRequest request
    ) {
        Long currentUserId = requireCurrentUserId(request);
        WritingDraftDto draft = draftService.getDraft(currentUserId, promptId, draftType);
        if (draft == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(draft);
    }

    @PutMapping("/{promptId}")
    @ResponseStatus(HttpStatus.OK)
    public WritingDraftDto saveDraft(
            @PathVariable String promptId,
            @RequestBody SaveWritingDraftRequestDto draftRequest,
            HttpServletRequest request
    ) {
        return draftService.saveDraft(requireCurrentUserId(request), promptId, draftRequest);
    }

    @DeleteMapping("/{promptId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDraft(
            @PathVariable String promptId,
            @RequestParam WritingDraftTypeDto draftType,
            HttpServletRequest request
    ) {
        draftService.deleteDraft(requireCurrentUserId(request), promptId, draftType);
    }

    private Long requireCurrentUserId(HttpServletRequest request) {
        Long currentUserId = authService.getCurrentUserIdOrNull(request);
        if (currentUserId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요.");
        }
        return currentUserId;
    }
}
