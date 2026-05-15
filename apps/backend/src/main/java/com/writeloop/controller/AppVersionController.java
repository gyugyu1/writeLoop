package com.writeloop.controller;

import com.writeloop.dto.AppVersionStatusDto;
import com.writeloop.service.AppVersionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/app-version")
@RequiredArgsConstructor
public class AppVersionController {

    private final AppVersionService appVersionService;

    @GetMapping
    public AppVersionStatusDto getStatus(
            @RequestParam(defaultValue = "android") String platform,
            @RequestParam(required = false) String currentVersion
    ) {
        return appVersionService.getStatus(platform, currentVersion);
    }
}
