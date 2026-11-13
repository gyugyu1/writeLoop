package com.writeloop.controller;

import com.writeloop.dto.CatalogDto;
import com.writeloop.service.ItemCatalog;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 아이템 목록(가구·옷). 로그인하지 않아도 부른다. */
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
                                item.category(), item.slot(), item.price(), item.assets()))
                        .toList()
        );
    }
}
