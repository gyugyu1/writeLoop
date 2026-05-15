package com.writeloop.controller;

import com.writeloop.dto.AdminAppVersionSettingDto;
import com.writeloop.dto.AdminAppVersionSettingRequestDto;
import com.writeloop.service.AppVersionService;
import com.writeloop.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/app-versions")
@RequiredArgsConstructor
public class AdminAppVersionController {

    private final AuthService authService;
    private final AppVersionService appVersionService;

    @GetMapping
    public List<AdminAppVersionSettingDto> findSettings(HttpServletRequest request, HttpSession session) {
        authService.requireAdmin(request, session);
        return appVersionService.findAdminSettings();
    }

    @GetMapping("/{platform}")
    public AdminAppVersionSettingDto findSetting(
            @PathVariable String platform,
            HttpServletRequest request,
            HttpSession session
    ) {
        authService.requireAdmin(request, session);
        return appVersionService.findAdminSetting(platform);
    }

    @PutMapping("/{platform}")
    public AdminAppVersionSettingDto updateSetting(
            @PathVariable String platform,
            @RequestBody AdminAppVersionSettingRequestDto settingRequest,
            HttpServletRequest request,
            HttpSession session
    ) {
        authService.requireAdmin(request, session);
        return appVersionService.updateAdminSetting(platform, settingRequest);
    }
}
