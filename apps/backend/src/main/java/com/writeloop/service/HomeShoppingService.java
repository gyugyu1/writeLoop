package com.writeloop.service;

import com.writeloop.dto.HomeShoppingDto;
import com.writeloop.dto.HomeShoppingOrderRequestDto;
import com.writeloop.dto.HomeShoppingOrderResponseDto;
import com.writeloop.exception.ApiException;
import com.writeloop.persistence.HomeShoppingOrderEntity;
import com.writeloop.persistence.HomeShoppingOrderRepository;
import com.writeloop.persistence.LoopPointBalanceEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 라룹 홈쇼핑: 기본 가구를 룹으로 산다. 나중에 생길 마을 가구점(특별한 가구)과 따로다.
 * 가격은 여기 한곳에 둔다. 날마다 한 종류가 오늘의 방송 상품이고 그날만 20% 싸다.
 */
@Service
@RequiredArgsConstructor
public class HomeShoppingService {

    static final String PURCHASE_REASON = "PURCHASE";

    /** 팔 수 있는 가구(치울 수 있는 종류)와 가격(룹). 순서는 가격이 낮은 것부터이고, 오늘의 방송 상품도 이 순서로 돈다. */
    static final List<Product> PRODUCTS = List.of(
            new Product("books", 40),
            new Product("smallPlant", 50),
            new Product("lamp", 60),
            new Product("frame", 70),
            new Product("plant", 80),
            new Product("nightstand", 100),
            new Product("floorLamp", 110),
            new Product("rug", 150),
            new Product("wardrobe", 180),
            new Product("bed", 300)
    );

    record Product(String type, int price) {
    }

    private final LoopPointService loopPointService;
    private final FurnitureOwnershipService furnitureOwnershipService;
    private final LobbyLayoutService lobbyLayoutService;
    private final HomeShoppingOrderRepository orderRepository;

    /** 그날(서울) 방송 상품: 가격표 순서를 날마다 하나씩 돈다. */
    static Product broadcastOf(LocalDate seoulDate) {
        return PRODUCTS.get((int) Math.floorMod(seoulDate.toEpochDay(), (long) PRODUCTS.size()));
    }

    /** 방송 상품 할인 가격: 원래 가격의 80%를 1룹 단위로 내림. */
    static int salePriceOf(int price) {
        return price * 8 / 10;
    }

    /** 그날 그 가구의 가격(방송 상품이면 할인 가격). */
    static int priceOn(Product product, LocalDate seoulDate) {
        return broadcastOf(seoulDate).type().equals(product.type()) ? salePriceOf(product.price()) : product.price();
    }

    /** 홈쇼핑 목록: 잔액, 오늘의 방송 상품, 가구마다 가격·할인 가격·가진 개수. */
    public HomeShoppingDto getShop(Long userId) {
        int balance = loopPointService.getSummary(userId).balance();
        LocalDate today = loopPointService.seoulToday();
        Product broadcast = broadcastOf(today);
        Map<String, Integer> owned = furnitureOwnershipService.ownedCounts(userId);
        List<HomeShoppingDto.Item> items = new ArrayList<>();
        for (Product product : PRODUCTS) {
            Integer salePrice = product.type().equals(broadcast.type()) ? salePriceOf(product.price()) : null;
            items.add(new HomeShoppingDto.Item(product.type(), product.price(), salePrice, owned.getOrDefault(product.type(), 0)));
        }
        return new HomeShoppingDto(
                balance,
                new HomeShoppingDto.Broadcast(broadcast.type(), broadcast.price(), salePriceOf(broadcast.price())),
                List.copyOf(items)
        );
    }

    /**
     * 가구 하나를 주문한다. 한 트랜잭션에서 잔액 차감, 산 기록, 배치 보관함에 더하기를 함께 하고, 하나라도 실패하면 아무것도 바뀌지 않는다.
     * 같은 계정의 주문은 잔액 행 잠금으로 하나씩 처리되어 잔액보다 많이 쓰거나 40개를 넘지 않는다.
     */
    @Transactional
    public HomeShoppingOrderResponseDto order(Long userId, HomeShoppingOrderRequestDto request) {
        // 시작 선물(처음이면)은 주문과 따로 먼저 넣는다. 주문이 실패해도 남는다
        loopPointService.ensureAccount(userId);
        String type = request == null ? null : request.type();
        Product product = PRODUCTS.stream()
                .filter(candidate -> candidate.type().equals(type))
                .findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "UNKNOWN_PRODUCT", "팔지 않는 가구예요."));
        if (request.price() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_ORDER", "주문 내용이 맞지 않아요.");
        }
        // 이 트랜잭션의 첫 문장은 잔액 행 잠금이다(그 뒤의 읽기가 최신 값이다)
        LoopPointBalanceEntity balance = loopPointService.lockAccount(userId);
        int price = priceOn(product, loopPointService.seoulToday());
        if (request.price() != price) {
            throw new ApiException(HttpStatus.CONFLICT, "PRICE_CHANGED", "가격이 바뀌었어요. 다시 확인해 주세요.");
        }
        if (balance.getBalance() < price) {
            throw new ApiException(HttpStatus.CONFLICT, "NOT_ENOUGH_LOOP_POINTS", "룹이 모자라요.");
        }
        LobbyLayoutService.AddedToStorage added = lobbyLayoutService.addToStorage(userId, product.type());
        HomeShoppingOrderEntity order = orderRepository.save(
                new HomeShoppingOrderEntity(userId, product.type(), price, added.itemId(), Instant.now())
        );
        loopPointService.spend(balance, price, PURCHASE_REASON, "order-" + order.getId());
        int owned = furnitureOwnershipService.ownedCounts(userId).getOrDefault(product.type(), 0);
        return new HomeShoppingOrderResponseDto(product.type(), price, balance.getBalance(), owned, added.itemId(), added.layout());
    }
}
