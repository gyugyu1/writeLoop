package com.writeloop.controller;

import com.writeloop.dto.CatalogDto;
import com.writeloop.service.ItemCatalog;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

/** 아이템 목록(가구·옷)과 그 모델·아이콘 파일. 로그인하지 않아도 부른다. */
@RestController
@RequestMapping("/api/catalog")
@RequiredArgsConstructor
public class CatalogController {

    private final ItemCatalog itemCatalog;

    @GetMapping
    public CatalogDto getCatalog() {
        return new CatalogDto(
                itemCatalog.version(),
                itemCatalog.items().stream()
                        .map(item -> new CatalogDto.Item(
                                item.id(), item.kind(), item.name(), item.shopName(), item.description(),
                                item.category(), item.slot(), item.price(), itemCatalog.assetsOf(item.id()), item.draw()))
                        .toList()
        );
    }

    /** 모델·아이콘 파일. 주소에 내용 해시가 들어 있어 내용이 바뀌면 주소가 바뀌므로 오래 캐시해도 된다. 목록에 없는 주소는 404. */
    @GetMapping("/files/{name:.+}")
    public ResponseEntity<byte[]> getFile(@PathVariable String name) {
        ItemCatalog.StoredFile file = itemCatalog.file(name);
        if (file == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
                .contentType(MediaType.parseMediaType(file.contentType()))
                .body(file.content());
    }
}
