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
import java.util.Set;

/**
 * 라룹 홈쇼핑: 기본 가구와 라룹이 옷(착용 아이템)을 룹으로 산다. 나중에 생길 마을 가구점·옷가게와 따로다.
 * 가격은 여기 한곳에 둔다. 날마다 한 종류가 오늘의 방송 상품이고 그날만 20% 싸다.
 * 가구는 배치 보관함에 더하고, 옷은 가진 착용 아이템에 더한다(같은 옷은 하나만).
 */
@Service
@RequiredArgsConstructor
public class HomeShoppingService {

    static final String PURCHASE_REASON = "PURCHASE";

    /**
     * 팔 수 있는 가구(치울 수 있는 종류)·옷과 가격(룹). 순서는 가격이 낮은 것부터이고, 같은 가격이면 가구, 처음 옷 넷, ⑤에서 더한 옷 순서다.
     * 오늘의 방송 상품도 이 순서로 돈다.
     */
    static final List<Product> PRODUCTS = List.of(
            new Product("books", 40),
            new Product("smallPlant", 50),
            new Product("lamp", 60),
            new Product("capOrange", 60),
            new Product("capBlue", 60),
            new Product("capGreen", 60),
            new Product("frame", 70),
            new Product("shortsNavy", 70),
            new Product("shortsBrown", 70),
            new Product("shortsRed", 70),
            new Product("plant", 80),
            new Product("tshirtOrange", 80),
            new Product("tshirtWhite", 80),
            new Product("tshirtYellow", 80),
            new Product("shoesBrown", 90),
            new Product("shoesRed", 90),
            new Product("shoesWhite", 90),
            new Product("mufflerRed", 90),
            new Product("nightstand", 100),
            new Product("sunglassesBlack", 100),
            new Product("floorLamp", 110),
            new Product("necklaceGold", 110),
            new Product("backpackRed", 120),
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
    private final WardrobeService wardrobeService;

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

    /** 홈쇼핑 목록: 잔액, 오늘의 방송 상품, 상품마다 가격·할인 가격·가진 개수(옷은 가졌으면 1). */
    public HomeShoppingDto getShop(Long userId) {
        int balance = loopPointService.getSummary(userId).balance();
        LocalDate today = loopPointService.seoulToday();
        Product broadcast = broadcastOf(today);
        Map<String, Integer> owned = furnitureOwnershipService.ownedCounts(userId);
        Set<String> wearing = wardrobeService.ownedTypes(userId);
        List<HomeShoppingDto.Item> items = new ArrayList<>();
        for (Product product : PRODUCTS) {
            Integer salePrice = product.type().equals(broadcast.type()) ? salePriceOf(product.price()) : null;
            int count = WardrobeService.isWearable(product.type())
                    ? (wearing.contains(product.type()) ? 1 : 0)
                    : owned.getOrDefault(product.type(), 0);
            items.add(new HomeShoppingDto.Item(product.type(), product.price(), salePrice, count));
        }
        return new HomeShoppingDto(
                balance,
                new HomeShoppingDto.Broadcast(broadcast.type(), broadcast.price(), salePriceOf(broadcast.price())),
                List.copyOf(items)
        );
    }

    /**
     * 가구나 옷 하나를 주문한다. 한 트랜잭션에서 잔액 차감, 산 기록, 배치 보관함(가구)이나 가진 착용 아이템(옷)에 더하기를 함께 하고,
     * 하나라도 실패하면 아무것도 바뀌지 않는다. 같은 계정의 주문은 잔액 행 잠금으로 하나씩 처리되어 잔액보다 많이 쓰거나
     * 가구 40개를 넘거나 같은 옷을 두 번 사지 않는다.
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
        boolean wearable = WardrobeService.isWearable(product.type());
        if (wearable && wardrobeService.ownedTypes(userId).contains(product.type())) {
            throw new ApiException(HttpStatus.CONFLICT, "ALREADY_OWNED", "이미 가진 옷이에요.");
        }
        int price = priceOn(product, loopPointService.seoulToday());
        if (request.price() != price) {
            throw new ApiException(HttpStatus.CONFLICT, "PRICE_CHANGED", "가격이 바뀌었어요. 다시 확인해 주세요.");
        }
        if (balance.getBalance() < price) {
            throw new ApiException(HttpStatus.CONFLICT, "NOT_ENOUGH_LOOP_POINTS", "룹이 모자라요.");
        }
        if (wearable) {
            Instant now = Instant.now();
            wardrobeService.addItem(userId, product.type(), now);
            // 옷 주문 기록의 가구 id 자리에는 옷 종류를 둔다(배치에 놓는 가구가 아니다)
            HomeShoppingOrderEntity order = orderRepository.save(new HomeShoppingOrderEntity(userId, product.type(), price, product.type(), now));
            loopPointService.spend(balance, price, PURCHASE_REASON, "order-" + order.getId());
            return new HomeShoppingOrderResponseDto(product.type(), price, balance.getBalance(), 1, null, null, wardrobeService.getWardrobe(userId));
        }
        LobbyLayoutService.AddedToStorage added = lobbyLayoutService.addToStorage(userId, product.type());
        HomeShoppingOrderEntity order = orderRepository.save(
                new HomeShoppingOrderEntity(userId, product.type(), price, added.itemId(), Instant.now())
        );
        loopPointService.spend(balance, price, PURCHASE_REASON, "order-" + order.getId());
        int owned = furnitureOwnershipService.ownedCounts(userId).getOrDefault(product.type(), 0);
        return new HomeShoppingOrderResponseDto(product.type(), price, balance.getBalance(), owned, added.itemId(), added.layout(), null);
    }
}
