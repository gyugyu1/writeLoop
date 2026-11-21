package com.writeloop.service;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.ClothingShopOrderRequestDto;
import com.writeloop.dto.ClothingShopOrderResponseDto;
import com.writeloop.exception.ApiException;
import com.writeloop.persistence.HomeShoppingOrderEntity;
import com.writeloop.persistence.HomeShoppingOrderRepository;
import com.writeloop.persistence.LoopPointBalanceEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 마을 옷집 계산대: 장바구니에 담은 옷을 한 번에 룹으로 산다(전부 사거나 전부 안 산다).
 * 옷집에 진열한 상품은 앱과 같은 진열 파일(catalog/clothing-shop-stock.json)에서 읽는다. 가격은 아이템 목록(ItemCatalog)의 가격이다(홈쇼핑 방송 할인은 없다).
 * 산 기록과 룹 사용 기록은 홈쇼핑 옷 주문과 같은 방식으로 상품마다 남긴다.
 */
@Service
@RequiredArgsConstructor
public class ClothingShopService {

    static final String STOCK_PATH = "catalog/clothing-shop-stock.json";

    /** 옷집 진열 상품의 아이템 ID(카탈로그 연결이 있으면 그 ID, 없으면 상품 ID). */
    static final Set<String> DISPLAYED = loadDisplayed();

    private final LoopPointService loopPointService;
    private final HomeShoppingOrderRepository orderRepository;
    private final WardrobeService wardrobeService;

    record StockRow(String id, String catalogId) {
    }

    record Stock(List<StockRow> products) {
    }

    private static Set<String> loadDisplayed() {
        try (InputStream in = ClothingShopService.class.getClassLoader().getResourceAsStream(STOCK_PATH)) {
            if (in == null) {
                throw new IllegalStateException("옷집 진열 파일이 없다: " + STOCK_PATH);
            }
            ObjectMapper mapper = new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
            Stock stock = mapper.readValue(in, Stock.class);
            Set<String> ids = new LinkedHashSet<>();
            for (StockRow row : stock.products()) {
                ids.add(row.catalogId() != null ? row.catalogId() : row.id());
            }
            return Set.copyOf(ids);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /**
     * 장바구니를 산다. 한 트랜잭션에서 잔액 행을 잠그고 상품마다 진열·판매·소유·가격을 본 뒤, 합계만큼 룹이 있으면 모두 산다.
     * 하나라도 맞지 않으면 아무것도 바뀌지 않는다. 같은 계정의 주문은 잔액 행 잠금으로 하나씩 처리된다.
     */
    @Transactional
    public ClothingShopOrderResponseDto order(Long userId, ClothingShopOrderRequestDto request) {
        // 시작 선물(처음이면)은 주문과 따로 먼저 넣는다(홈쇼핑과 같다)
        loopPointService.ensureAccount(userId);
        List<ClothingShopOrderRequestDto.Item> items = request == null ? null : request.items();
        if (items == null || items.isEmpty()) {
            throw invalid();
        }
        Set<String> seen = new HashSet<>();
        for (ClothingShopOrderRequestDto.Item item : items) {
            if (item == null || item.type() == null || item.price() == null || !seen.add(item.type())) {
                throw invalid();
            }
        }
        // 이 트랜잭션의 첫 문장은 잔액 행 잠금이다(그 뒤의 읽기가 최신 값이다)
        LoopPointBalanceEntity balance = loopPointService.lockAccount(userId);
        Set<String> owned = wardrobeService.ownedTypes(userId);
        List<ClothingShopOrderResponseDto.Item> bought = new ArrayList<>();
        int total = 0;
        for (ClothingShopOrderRequestDto.Item item : items) {
            String type = item.type();
            if (!DISPLAYED.contains(type)) {
                throw new ApiException(HttpStatus.CONFLICT, "NOT_ON_DISPLAY", "옷집에 진열하지 않은 옷이에요.");
            }
            ItemCatalog.Item catalogItem = ItemCatalog.DEFAULT.find(type);
            if (catalogItem == null || !catalogItem.isWearable() || catalogItem.price() == null) {
                throw new ApiException(HttpStatus.CONFLICT, "NOT_FOR_SALE", "판매 준비 중인 옷이에요.");
            }
            if (owned.contains(type)) {
                throw new ApiException(HttpStatus.CONFLICT, "ALREADY_OWNED", "이미 가진 옷이에요.");
            }
            int price = catalogItem.price();
            if (item.price() != price) {
                throw new ApiException(HttpStatus.CONFLICT, "PRICE_CHANGED", "가격이 바뀌었어요. 다시 확인해 주세요.");
            }
            total += price;
            bought.add(new ClothingShopOrderResponseDto.Item(type, price));
        }
        if (balance.getBalance() < total) {
            throw new ApiException(HttpStatus.CONFLICT, "NOT_ENOUGH_LOOP_POINTS", "룹이 모자라요.");
        }
        Instant now = Instant.now();
        for (ClothingShopOrderResponseDto.Item item : bought) {
            wardrobeService.addItem(userId, item.type(), now);
            // 홈쇼핑 옷 주문과 같이 가구 id 자리에는 옷 종류를 둔다
            HomeShoppingOrderEntity order = orderRepository.save(new HomeShoppingOrderEntity(userId, item.type(), item.price(), item.type(), now));
            loopPointService.spend(balance, item.price(), HomeShoppingService.PURCHASE_REASON, "order-" + order.getId());
        }
        return new ClothingShopOrderResponseDto(List.copyOf(bought), total, balance.getBalance(), wardrobeService.getWardrobe(userId));
    }

    private static ApiException invalid() {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_ORDER", "주문 내용이 맞지 않아요.");
    }
}
