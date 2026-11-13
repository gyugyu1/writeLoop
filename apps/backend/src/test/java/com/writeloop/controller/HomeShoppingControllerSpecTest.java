package com.writeloop.controller;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.writeloop.support.IntegrationTestSupport;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * [spec] 작업 086 ② 홈쇼핑 서버. 시나리오 02-qa-scenarios.md(L, B, O, I, E, C, V, P, K)와
 * 결정 03-main-decision.md(2: price가 없거나 null이면 400 INVALID_ORDER, 4: 실패한 첫 주문에도 시작 선물)를 실제 서버로 확인한다.
 *
 * <ul>
 *   <li>로그인은 토큰 로그인(Bearer). 테스트마다 새 사용자를 만든다.</li>
 *   <li>서버의 서울 날짜는 테스트용 시계 빈으로 고정한다(기본은 D13 = 2026-11-18 서울 정오, 방송 상품 bed).</li>
 *   <li>작업 089 ④(옷 넷을 더해 방송이 열넷을 돎, 04-main-decision.md A 사용자 결정)에 맞춰 날짜별 방송 상품·목록 개수·주기만 열넷 순환으로 바꿨다.</li>
 *   <li>잔액은 GET /api/loop-points로 잔액 행을 만든 뒤 jdbc로 바꾼다. 40개·39개 같은 배치는 jdbc로 lobby_layouts에 바로 넣는다.</li>
 *   <li>NC(아무것도 바뀌지 않음): 잔액, 장부 음수 줄 수, 산 기록 수, GET /api/lobby-layout(상태와 본문)이 요청 전후로 같다.</li>
 * </ul>
 */
class HomeShoppingControllerSpecTest extends IntegrationTestSupport {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final AtomicReference<Instant> FIXED_NOW = new AtomicReference<>();

    /** Dk는 방송 상품이 가격표 k번째인 날(epochDay % 14 == k). D0 books, D9 nightstand, D12 wardrobe, D13 bed. */
    private static final LocalDate D0 = LocalDate.of(2026, 11, 5);
    private static final LocalDate D9 = LocalDate.of(2026, 11, 14);
    private static final LocalDate D12 = LocalDate.of(2026, 11, 17);
    private static final LocalDate D13 = LocalDate.of(2026, 11, 18);

    /** 가격표(PT), 이 순서가 목록 순서다(작업 089 ④: 같은 가격이면 가구 다음에 옷). */
    private static final List<String> TYPES = List.of(
            "books", "smallPlant", "lamp", "capOrange", "frame", "shortsNavy", "plant", "tshirtOrange", "shoesBrown",
            "nightstand", "floorLamp", "rug", "wardrobe", "bed");
    private static final List<Integer> PRICES = List.of(40, 50, 60, 60, 70, 70, 80, 80, 90, 100, 110, 150, 180, 300);
    private static final List<Integer> SALE_PRICES = List.of(32, 40, 48, 48, 56, 56, 64, 64, 72, 80, 88, 120, 144, 240);

    /** D0~D13 방송 상품(epochDay % 14). */
    private static final List<LocalDate> FOURTEEN_DAYS = List.of(
            LocalDate.of(2026, 11, 5), LocalDate.of(2026, 11, 6), LocalDate.of(2026, 11, 7), LocalDate.of(2026, 11, 8),
            LocalDate.of(2026, 11, 9), LocalDate.of(2026, 11, 10), LocalDate.of(2026, 11, 11), LocalDate.of(2026, 11, 12),
            LocalDate.of(2026, 11, 13), LocalDate.of(2026, 11, 14), LocalDate.of(2026, 11, 15), LocalDate.of(2026, 11, 16),
            LocalDate.of(2026, 11, 17), LocalDate.of(2026, 11, 18));

    @TestConfiguration
    static class ClockConfig {
        @Bean
        Clock homeShoppingSpecClock() {
            return new SwitchableClock(SEOUL);
        }
    }

    /** FIXED_NOW가 비어 있으면 실제 시각, 있으면 그 시각을 돌려주는 시계. */
    static final class SwitchableClock extends Clock {
        private final ZoneId zone;

        SwitchableClock(ZoneId zone) {
            this.zone = zone;
        }

        @Override
        public ZoneId getZone() {
            return zone;
        }

        @Override
        public Clock withZone(ZoneId newZone) {
            return new SwitchableClock(newZone);
        }

        @Override
        public Instant instant() {
            Instant fixed = FIXED_NOW.get();
            return fixed == null ? Instant.now() : fixed;
        }
    }

    @Autowired
    private PasswordEncoder passwordEncoder;

    private final HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();

    @BeforeEach
    void fixDate() {
        at(D13);
    }

    @AfterEach
    void restoreClock() {
        FIXED_NOW.set(null);
    }

    // =====================================================================
    // L. 홈쇼핑 목록
    // =====================================================================

    @Test
    void l1_listWithoutLoginIs401() throws Exception {
        HttpResponse<String> response = shop(null);

        assertThat(response.statusCode()).as("L1 GET without login, body %s", response.body()).isEqualTo(401);
    }

    @Test
    void l2_l3_l4_l5_firstListHasGiftBroadcastAndFourteenItems() throws Exception {
        TestUser user = newUser("l2");

        HttpResponse<String> response = shop(user.token());

        assertThat(response.statusCode()).as("L2 GET, body %s", response.body()).isEqualTo(200);
        JsonNode body = JSON.readTree(response.body());
        assertThat(body.path("balance").asInt()).as("L2 balance").isEqualTo(200);
        assertBroadcast(body, "bed", 300, 240, "L2");
        JsonNode items = body.path("items");
        assertThat(items.isArray()).as("L2 items is an array: %s", body).isTrue();
        assertThat(items.size()).as("L2 items count").isEqualTo(14);
        List<String> types = new ArrayList<>();
        items.forEach(item -> types.add(item.path("type").asText()));
        // L2 순서, L5 팔지 않는 가구 없음
        assertThat(types).as("L2/L5 item types in order").containsExactlyElementsOf(TYPES);
        for (int i = 0; i < 14; i++) {
            JsonNode item = items.get(i);
            assertThat(item.path("price").asInt()).as("L2 price of %s", TYPES.get(i)).isEqualTo(PRICES.get(i));
            if (TYPES.get(i).equals("bed")) {
                assertThat(item.path("salePrice").asInt()).as("L3 salePrice of bed").isEqualTo(240);
            } else {
                // L3: 예시처럼 키가 있고 값이 null
                assertThat(item.has("salePrice")).as("L3 salePrice key of %s: %s", TYPES.get(i), item).isTrue();
                assertThat(item.get("salePrice").isNull()).as("L3 salePrice of %s is null: %s", TYPES.get(i), item).isTrue();
            }
        }
        // L4
        assertThat(ownedMap(body)).as("L4 owned").isEqualTo(owned(Map.of("wardrobe", 1, "rug", 1, "lamp", 1)));
    }

    @Test
    void l6_giftIsGivenOnce() throws Exception {
        TestUser user = newUser("l6");

        HttpResponse<String> first = shop(user.token());
        HttpResponse<String> second = shop(user.token());

        assertThat(JSON.readTree(first.body()).path("balance").asInt()).as("L6 first balance").isEqualTo(200);
        assertThat(JSON.readTree(second.body()).path("balance").asInt()).as("L6 second balance").isEqualTo(200);
        assertThat(giftEntries(user.id())).as("L6 start gift rows").isEqualTo(1);
    }

    @Test
    void l7_listBalanceIsTheLoopPointBalance() throws Exception {
        TestUser user = newUser("l7");
        setBalance(user, 777);

        HttpResponse<String> response = shop(user.token());

        assertThat(JSON.readTree(response.body()).path("balance").asInt()).as("L7 list balance").isEqualTo(777);
        assertThat(loopPointsBalance(user)).as("L7 /api/loop-points balance").isEqualTo(777);
    }

    @Test
    void l8_ownedIsStarterPlusBought() throws Exception {
        TestUser user = newUser("l8");
        setBalance(user, 1000);
        assertOk(order(user.token(), "bed", 240), "L8 bed");
        assertOk(order(user.token(), "books", 40), "L8 books 1");
        assertOk(order(user.token(), "books", 40), "L8 books 2");
        assertOk(order(user.token(), "wardrobe", 180), "L8 wardrobe");

        JsonNode body = JSON.readTree(shop(user.token()).body());

        assertThat(ownedMap(body)).as("L8 owned")
                .isEqualTo(owned(Map.of("bed", 1, "books", 2, "wardrobe", 2, "rug", 1, "lamp", 1)));
    }

    @Test
    void l9_ownedDoesNotFollowTheLayout() throws Exception {
        TestUser user = newUser("l9");
        ObjectNode layout = i0();
        removeItem(layout, "wardrobe");
        HttpResponse<String> save = putLayout(user.token(), layout);
        assertThat(save.statusCode()).as("L9 setup: save I0 without wardrobe, body %s", save.body()).isEqualTo(200);

        JsonNode body = JSON.readTree(shop(user.token()).body());

        assertThat(ownedMap(body).get("wardrobe")).as("L9 wardrobe owned").isEqualTo(1);
    }

    @Test
    void l10_ownedAndBalanceArePerAccount() throws Exception {
        TestUser x = newUser("l10x");
        TestUser y = newUser("l10y");
        setBalance(x, 1000);
        assertOk(order(x.token(), "bed", 240), "L10 X bed");

        JsonNode body = JSON.readTree(shop(y.token()).body());

        assertThat(ownedMap(body).get("bed")).as("L10 Y bed owned").isEqualTo(0);
        assertThat(body.path("balance").asInt()).as("L10 Y balance").isEqualTo(200);
    }

    @Test
    void l11_k2_listDoesNotCreateALayout() throws Exception {
        TestUser user = newUser("l11");

        assertThat(shop(user.token()).statusCode()).as("L11 list").isEqualTo(200);
        HttpResponse<String> layout = getLayout(user.token());

        assertThat(layout.statusCode()).as("L11/K2 GET lobby-layout, body %s", layout.body()).isEqualTo(404);
    }

    // =====================================================================
    // B. 오늘의 방송 상품
    // =====================================================================

    @Test
    void b1_b3_broadcastCyclesThroughThePriceTable() throws Exception {
        TestUser user = newUser("b1");
        for (int day = 0; day < 14; day++) {
            at(FOURTEEN_DAYS.get(day));
            JsonNode body = JSON.readTree(shop(user.token()).body());
            String label = "B1 " + FOURTEEN_DAYS.get(day);
            assertBroadcast(body, TYPES.get(day), PRICES.get(day), SALE_PRICES.get(day), label);
            JsonNode items = body.path("items");
            for (int i = 0; i < 14; i++) {
                JsonNode item = items.get(i);
                assertThat(item.path("type").asText()).as("%s B3 type %d", label, i).isEqualTo(TYPES.get(i));
                assertThat(item.path("price").asInt()).as("%s B3 price of %s", label, TYPES.get(i)).isEqualTo(PRICES.get(i));
                if (i == day) {
                    assertThat(item.path("salePrice").asInt()).as("%s B3 salePrice of %s", label, TYPES.get(i)).isEqualTo(SALE_PRICES.get(i));
                } else {
                    assertThat(item.has("salePrice") && item.get("salePrice").isNull())
                            .as("%s B3 salePrice of %s is null: %s", label, TYPES.get(i), item).isTrue();
                }
            }
        }
    }

    @Test
    void b2_fourteenDaysLaterStartsOver() throws Exception {
        TestUser user = newUser("b2");
        at(LocalDate.of(2026, 11, 19));

        JsonNode body = JSON.readTree(shop(user.token()).body());

        assertBroadcast(body, "books", 40, 32, "B2");
    }

    @Test
    void b4_sameDaySameBroadcastForEveryone() throws Exception {
        TestUser x = newUser("b4x");
        TestUser y = newUser("b4y");
        at(D9);

        JsonNode bx = JSON.readTree(shop(x.token()).body()).path("broadcast");
        JsonNode by = JSON.readTree(shop(y.token()).body()).path("broadcast");

        assertThat(bx).as("B4 X and Y broadcast").isEqualTo(by);
        assertThat(bx.path("type").asText()).as("B4 type").isEqualTo("nightstand");
        assertThat(bx.path("price").asInt()).as("B4 price").isEqualTo(100);
        assertThat(bx.path("salePrice").asInt()).as("B4 salePrice").isEqualTo(80);
    }

    @Test
    void b5_b6_seoulMidnightSplitsTheBroadcast() throws Exception {
        TestUser user = newUser("b5");

        FIXED_NOW.set(Instant.parse("2026-11-17T14:59:59Z"));
        JsonNode before = JSON.readTree(shop(user.token()).body());
        FIXED_NOW.set(Instant.parse("2026-11-17T15:00:00Z"));
        JsonNode after = JSON.readTree(shop(user.token()).body());

        assertBroadcast(before, "wardrobe", 180, 144, "B5");
        assertBroadcast(after, "bed", 300, 240, "B6");
    }

    // =====================================================================
    // O. 주문 성공
    // =====================================================================

    @Test
    void o1_orderWithoutLoginIs401() throws Exception {
        HttpResponse<String> response = order(null, "books", 40);

        assertThat(response.statusCode()).as("O1 POST without login, body %s", response.body()).isEqualTo(401);
    }

    @Test
    void o2_to_o6_orderWithoutSavedLayoutStartsFromTheInitialLayout() throws Exception {
        TestUser user = newUser("o2");
        setBalance(user, 300);

        HttpResponse<String> response = order(user.token(), "bed", 240);

        assertThat(response.statusCode()).as("O2 order bed 240, body %s", response.body()).isEqualTo(200);
        JsonNode body = JSON.readTree(response.body());
        assertThat(body.path("type").asText()).as("O2 type").isEqualTo("bed");
        assertThat(body.path("price").asInt()).as("O2 price").isEqualTo(240);
        assertThat(body.path("balance").asInt()).as("O2 balance").isEqualTo(60);
        assertThat(body.path("owned").asInt()).as("O2 owned").isEqualTo(1);
        assertThat(body.path("itemId").asText()).as("O2 itemId").isEqualTo("bed-1");
        ObjectNode expected = i0();
        expected.putArray("stored").add(stored("bed-1", "bed"));
        assertThat(body.path("layout")).as("O2 layout").isEqualTo(expected);

        // O3
        HttpResponse<String> layout = getLayout(user.token());
        assertThat(layout.statusCode()).as("O3 GET lobby-layout, body %s", layout.body()).isEqualTo(200);
        assertThat(JSON.readTree(layout.body())).as("O3 saved layout").isEqualTo(body.path("layout"));
        // O4
        assertThat(loopPointsBalance(user)).as("O4 /api/loop-points").isEqualTo(60);
        JsonNode list = JSON.readTree(shop(user.token()).body());
        assertThat(list.path("balance").asInt()).as("O4 list balance").isEqualTo(60);
        assertThat(ownedMap(list).get("bed")).as("O4 list bed owned").isEqualTo(1);
        // O5
        assertThat(negativeAmounts(user.id())).as("O5 negative ledger rows").containsExactly(-240);
        assertThat(giftEntries(user.id())).as("O5 start gift rows").isEqualTo(1);
        // O6
        assertThat(purchaseTypes(user.id())).as("O6 purchases").containsExactly("bed");
    }

    @Test
    void o7_o8_nonBroadcastIsFullPriceAndFirstOrderGetsTheGift() throws Exception {
        TestUser user = newUser("o7");

        // O8: 잔액 조회·목록 없이 바로 주문
        HttpResponse<String> response = order(user.token(), "books", 40);

        assertThat(response.statusCode()).as("O7 order books 40, body %s", response.body()).isEqualTo(200);
        JsonNode body = JSON.readTree(response.body());
        assertThat(body.path("price").asInt()).as("O7 price").isEqualTo(40);
        assertThat(body.path("balance").asInt()).as("O7/O8 balance").isEqualTo(160);
        assertThat(body.path("owned").asInt()).as("O7 owned").isEqualTo(1);
        assertThat(body.path("itemId").asText()).as("O7 itemId").isEqualTo("books-1");
        assertThat(giftEntries(user.id())).as("O8 start gift rows").isEqualTo(1);
        assertThat(giftAmount(user.id())).as("O8 start gift amount").isEqualTo(200);
        assertThat(negativeAmounts(user.id())).as("O8 order row").containsExactly(-40);
    }

    @Test
    void o9_buyingAStarterKind() throws Exception {
        TestUser user = newUser("o9");

        JsonNode body = JSON.readTree(assertOk(order(user.token(), "wardrobe", 180), "O9").body());

        assertThat(body.path("balance").asInt()).as("O9 balance").isEqualTo(20);
        assertThat(body.path("owned").asInt()).as("O9 owned").isEqualTo(2);
        assertThat(body.path("itemId").asText()).as("O9 itemId").isEqualTo("wardrobe-1");
    }

    @Test
    void o10_balanceExactlyThePrice() throws Exception {
        TestUser user = newUser("o10");
        setBalance(user, 240);

        JsonNode body = JSON.readTree(assertOk(order(user.token(), "bed", 240), "O10").body());

        assertThat(body.path("balance").asInt()).as("O10 balance").isEqualTo(0);
    }

    @Test
    void o11_addsToTheEndOfTheSavedStorage() throws Exception {
        TestUser user = newUser("o11");
        ObjectNode layout = i0();
        removeItem(layout, "rug");
        layout.putArray("stored").add(stored("rug", "rug"));
        assertThat(putLayout(user.token(), layout).statusCode()).as("O11 setup save").isEqualTo(200);

        JsonNode body = JSON.readTree(assertOk(order(user.token(), "lamp", 60), "O11").body());

        assertThat(body.path("itemId").asText()).as("O11 itemId").isEqualTo("lamp-1");
        ObjectNode expected = layout.deepCopy();
        ((ArrayNode) expected.get("stored")).add(stored("lamp-1", "lamp"));
        assertThat(body.path("layout")).as("O11 layout").isEqualTo(expected);
    }

    @Test
    void o12_savedLayoutWithoutStoredKey() throws Exception {
        TestUser user = newUser("o12");
        assertThat(putLayout(user.token(), i0()).statusCode()).as("O12 setup save").isEqualTo(200);

        JsonNode body = JSON.readTree(assertOk(order(user.token(), "books", 40), "O12").body());

        ObjectNode expected = i0();
        expected.putArray("stored").add(stored("books-1", "books"));
        assertThat(body.path("layout")).as("O12 layout").isEqualTo(expected);
    }

    @Test
    void o13_severalOfTheSameKind() throws Exception {
        TestUser user = newUser("o13");
        setBalance(user, 1000);

        JsonNode first = JSON.readTree(assertOk(order(user.token(), "books", 40), "O13 1").body());
        JsonNode second = JSON.readTree(assertOk(order(user.token(), "books", 40), "O13 2").body());
        JsonNode third = JSON.readTree(assertOk(order(user.token(), "books", 40), "O13 3").body());

        assertThat(List.of(first.path("itemId").asText(), second.path("itemId").asText(), third.path("itemId").asText()))
                .as("O13 itemIds").containsExactly("books-1", "books-2", "books-3");
        assertThat(List.of(first.path("owned").asInt(), second.path("owned").asInt(), third.path("owned").asInt()))
                .as("O13 owned").containsExactly(1, 2, 3);
        assertThat(storedIds(third.path("layout"))).as("O13 stored").containsExactly("books-1", "books-2", "books-3");
        assertThat(third.path("balance").asInt()).as("O13 balance").isEqualTo(880);
    }

    @Test
    void o14_boughtItemCanBePlaced() throws Exception {
        TestUser user = newUser("o14");
        setBalance(user, 300);
        assertOk(order(user.token(), "bed", 240), "O14 setup order");
        ObjectNode layout = i0();
        items(layout).add(floor("bed-1", "bed", 4.5, 9.5, 0));

        HttpResponse<String> save = putLayout(user.token(), layout);

        assertThat(save.statusCode()).as("O14 save with bed-1 placed, body %s", save.body()).isEqualTo(200);
    }

    // =====================================================================
    // I. 새 가구 id
    // =====================================================================

    @Test
    void i1_nextNumberAfterBed1() throws Exception {
        assertNewId("i1", storedLayout(List.of(stored("bed-1", "bed"))), "bed", 240, "bed-2");
    }

    @Test
    void i2_smallestFreeNumber() throws Exception {
        assertNewId("i2", storedLayout(List.of(stored("bed-2", "bed"))), "bed", 240, "bed-1");
    }

    @Test
    void i3_fillsTheGap() throws Exception {
        assertNewId("i3", storedLayout(List.of(stored("bed-1", "bed"), stored("bed-3", "bed"))), "bed", 240, "bed-2");
    }

    @Test
    void i4_avoidsTheSameIdOfAnotherKind() throws Exception {
        assertNewId("i4", storedLayout(List.of(stored("books-1", "plant"))), "books", 40, "books-2");
    }

    @Test
    void i5_avoidsIdsInTheRoom() throws Exception {
        ObjectNode layout = i0();
        for (JsonNode item : items(layout)) {
            if (item.path("id").asText().equals("lamp")) {
                ((ObjectNode) item).put("id", "lamp-1");
            }
        }
        assertNewId("i5", layout, "lamp", 60, "lamp-2");
    }

    @Test
    void i6_initialIdIsNotNumbered() throws Exception {
        assertNewId("i6", i0(), "rug", 150, "rug-1");
    }

    // =====================================================================
    // E. 주문 실패
    // =====================================================================

    @Test
    void e1_e2_placeFurnitureIsNotSold() throws Exception {
        TestUser user = newUser("e1");
        setBalance(user, 1000);
        for (String type : List.of("desk", "bookcase", "board", "window")) {
            assertRejectedNothingChanged(user, body(type, 0), 400, null, null, "E1/E2 " + type);
        }
    }

    @Test
    void e3_unknownKind() throws Exception {
        TestUser user = newUser("e3");
        setBalance(user, 1000);

        assertRejectedNothingChanged(user, body("sofa", 100), 400, null, null, "E3");
    }

    @Test
    void e4_missingOrNonTextType() throws Exception {
        TestUser user = newUser("e4");
        setBalance(user, 1000);
        Map<String, Object> missing = new LinkedHashMap<>();
        missing.put("price", 40);
        Map<String, Object> nullType = new LinkedHashMap<>();
        nullType.put("type", null);
        nullType.put("price", 40);
        Map<String, Object> numberType = new LinkedHashMap<>();
        numberType.put("type", 123);
        numberType.put("price", 40);

        assertRejectedNothingChanged(user, missing, 400, null, null, "E4 missing type");
        assertRejectedNothingChanged(user, nullType, 400, null, null, "E4 null type");
        assertRejectedNothingChanged(user, numberType, 400, null, null, "E4 number type");
    }

    @Test
    void decision2_missingOrNullPriceIs400InvalidOrder() throws Exception {
        TestUser user = newUser("d2");
        setBalance(user, 1000);
        Map<String, Object> missing = new LinkedHashMap<>();
        missing.put("type", "books");
        Map<String, Object> nullPrice = new LinkedHashMap<>();
        nullPrice.put("type", "books");
        nullPrice.put("price", null);

        assertRejectedNothingChanged(user, missing, 400, "INVALID_ORDER", "주문 내용이 맞지 않아요.", "결정2 missing price");
        assertRejectedNothingChanged(user, nullPrice, 400, "INVALID_ORDER", "주문 내용이 맞지 않아요.", "결정2 null price");
    }

    @Test
    void e5_fullPriceOnTheBroadcastDay() throws Exception {
        TestUser user = newUser("e5");
        setBalance(user, 1000);

        assertRejectedNothingChanged(user, body("bed", 300), 409, "PRICE_CHANGED", "가격이 바뀌었어요. 다시 확인해 주세요.", "E5");
    }

    @Test
    void e6_salePriceForANonBroadcastItem() throws Exception {
        TestUser user = newUser("e6");
        setBalance(user, 1000);

        assertRejectedNothingChanged(user, body("books", 32), 409, "PRICE_CHANGED", "가격이 바뀌었어요. 다시 확인해 주세요.", "E6");
    }

    @Test
    void e7_saleEndsWhenTheDateChanges() throws Exception {
        TestUser user = newUser("e7");
        at(D12);
        JsonNode list = JSON.readTree(shop(user.token()).body());
        assertBroadcast(list, "wardrobe", 180, 144, "E7 setup D12");
        at(D13);

        assertRejectedNothingChanged(user, body("wardrobe", 144), 409, "PRICE_CHANGED", "가격이 바뀌었어요. 다시 확인해 주세요.", "E7 old sale price");
        HttpResponse<String> fullPrice = order(user.token(), "wardrobe", 180);

        assertThat(fullPrice.statusCode()).as("E7 full price, body %s", fullPrice.body()).isEqualTo(200);
    }

    @Test
    void e8_anyOtherPriceIsRejected() throws Exception {
        TestUser user = newUser("e8");
        setBalance(user, 1000);
        for (int price : List.of(39, 41, 0, -40)) {
            assertRejectedNothingChanged(user, body("books", price), 409, "PRICE_CHANGED", "가격이 바뀌었어요. 다시 확인해 주세요.", "E8 " + price);
        }
    }

    @Test
    void e9_notEnoughLoopPoints() throws Exception {
        TestUser user = newUser("e9");
        setBalance(user, 239);

        assertRejectedNothingChanged(user, body("bed", 240), 409, "NOT_ENOUGH_LOOP_POINTS", "룹이 모자라요.", "E9");
        assertThat(loopPointsBalance(user)).as("E9 balance").isEqualTo(239);
    }

    @Test
    void e10_decision4_firstOrderNotEnoughStillGivesTheGift() throws Exception {
        TestUser user = newUser("e10");
        at(D0);

        HttpResponse<String> response = order(user.token(), "bed", 300);

        assertThat(response.statusCode()).as("E10 first order bed 300, body %s", response.body()).isEqualTo(409);
        assertThat(JSON.readTree(response.body()).path("code").asText()).as("E10 code").isEqualTo("NOT_ENOUGH_LOOP_POINTS");
        // 결정 4: 잔액 조회 전에 이미 시작 선물이 들어 있다
        assertThat(balanceRow(user.id())).as("결정4 balance row after the failed order").isEqualTo(200);
        assertThat(negativeAmounts(user.id())).as("E10 negative rows").isEmpty();
        assertThat(purchaseTypes(user.id())).as("E10 purchases").isEmpty();
        assertThat(getLayout(user.token()).statusCode()).as("E10 layout").isEqualTo(404);
        HttpResponse<String> summary = loopPoints(user.token());
        assertThat(summary.statusCode()).as("E10 GET /api/loop-points").isEqualTo(200);
        assertThat(JSON.readTree(summary.body()).path("balance").asInt()).as("E10 balance").isEqualTo(200);
    }

    @Test
    void decision4_firstOrderWithChangedPriceOrUnsoldKindStillGivesTheGift() throws Exception {
        TestUser priceUser = newUser("d4p");
        TestUser kindUser = newUser("d4k");

        HttpResponse<String> priceChanged = order(priceUser.token(), "bed", 300);
        HttpResponse<String> unsold = order(kindUser.token(), "desk", 0);

        assertThat(priceChanged.statusCode()).as("결정4 price changed, body %s", priceChanged.body()).isEqualTo(409);
        assertThat(unsold.statusCode()).as("결정4 unsold kind, body %s", unsold.body()).isEqualTo(400);
        for (TestUser user : List.of(priceUser, kindUser)) {
            assertThat(balanceRow(user.id())).as("결정4 balance of %s", user.email()).isEqualTo(200);
            assertThat(giftEntries(user.id())).as("결정4 gift rows of %s", user.email()).isEqualTo(1);
            assertThat(negativeAmounts(user.id())).as("결정4 negative rows of %s", user.email()).isEmpty();
            assertThat(purchaseTypes(user.id())).as("결정4 purchases of %s", user.email()).isEmpty();
            assertThat(getLayout(user.token()).statusCode()).as("결정4 layout of %s", user.email()).isEqualTo(404);
        }
    }

    @Test
    void e11_fortyItemsIsFull() throws Exception {
        TestUser user = newUser("e11");
        setBalance(user, 1000);
        insertLayout(user.id(), layoutWithStoredBooks(33));

        assertRejectedNothingChanged(user, body("books", 40), 409, "LAYOUT_FULL", "가구는 40개까지 둘 수 있어요.", "E11");
        assertThat(totalItems(JSON.readTree(getLayout(user.token()).body()))).as("E11 layout size").isEqualTo(40);
    }

    @Test
    void e12_thirtyNineItemsTakesOneMore() throws Exception {
        TestUser user = newUser("e12");
        setBalance(user, 1000);
        insertLayout(user.id(), layoutWithStoredBooks(32));

        JsonNode body = JSON.readTree(assertOk(order(user.token(), "books", 40), "E12").body());

        assertThat(totalItems(body.path("layout"))).as("E12 layout size").isEqualTo(40);
        assertRejectedNothingChanged(user, body("books", 40), 409, "LAYOUT_FULL", "가구는 40개까지 둘 수 있어요.", "E12 next");
    }

    @Test
    void e13_priceIsCheckedBeforeBalance() throws Exception {
        TestUser user = newUser("e13");
        setBalance(user, 10);

        assertRejectedNothingChanged(user, body("bed", 300), 409, "PRICE_CHANGED", "가격이 바뀌었어요. 다시 확인해 주세요.", "E13");
    }

    @Test
    void e14_balanceIsCheckedBeforeTheLayoutSize() throws Exception {
        TestUser user = newUser("e14");
        setBalance(user, 10);
        insertLayout(user.id(), layoutWithStoredBooks(33));

        assertRejectedNothingChanged(user, body("books", 40), 409, "NOT_ENOUGH_LOOP_POINTS", "룹이 모자라요.", "E14");
    }

    @Test
    void e15_kindIsCheckedBeforePrice() throws Exception {
        TestUser user = newUser("e15");
        setBalance(user, 1000);

        assertRejectedNothingChanged(user, body("desk", 999), 400, null, null, "E15");
    }

    @Test
    void e16_failedLayoutSaveChangesNothing() throws Exception {
        TestUser user = newUser("e16");
        setBalance(user, 1000);

        HttpResponse<String> response = withRenamedTable("lobby_layouts", () -> order(user.token(), "books", 40));

        assertThat(response.statusCode()).as("E16 order while layouts are broken, body %s", response.body()).isNotEqualTo(200);
        assertThat(balanceRow(user.id())).as("E16 balance").isEqualTo(1000);
        assertThat(negativeAmounts(user.id())).as("E16 negative rows").isEmpty();
        assertThat(purchaseTypes(user.id())).as("E16 purchases").isEmpty();
        assertThat(getLayout(user.token()).statusCode()).as("E16 layout").isEqualTo(404);
    }

    @Test
    void e17_failedPurchaseRecordChangesNothing() throws Exception {
        TestUser user = newUser("e17");
        setBalance(user, 1000);
        assertThat(putLayout(user.token(), i0()).statusCode()).as("E17 setup save").isEqualTo(200);
        String layoutBefore = getLayout(user.token()).body();

        HttpResponse<String> response = withRenamedTable("home_shopping_orders", () -> order(user.token(), "books", 40));

        assertThat(response.statusCode()).as("E17 order while purchases are broken, body %s", response.body()).isNotEqualTo(200);
        assertThat(balanceRow(user.id())).as("E17 balance").isEqualTo(1000);
        assertThat(negativeAmounts(user.id())).as("E17 negative rows").isEmpty();
        assertThat(purchaseTypes(user.id())).as("E17 purchases").isEmpty();
        assertThat(JSON.readTree(getLayout(user.token()).body())).as("E17 layout").isEqualTo(JSON.readTree(layoutBefore));
    }

    // =====================================================================
    // C. 동시 주문
    // =====================================================================

    @Test
    void c1_concurrentOrdersDoNotOverspend() throws Exception {
        TestUser user = newUser("c1");
        setBalance(user, 200);

        List<HttpResponse<String>> responses = concurrently(2, () -> order(user.token(), "rug", 150));

        assertThat(statuses(responses)).as("C1 statuses %s", bodies(responses)).containsExactlyInAnyOrder(200, 409);
        assertThat(codeOfFailure(responses)).as("C1 failure code").containsExactly("NOT_ENOUGH_LOOP_POINTS");
        assertThat(balanceRow(user.id())).as("C1 balance").isEqualTo(50);
        assertThat(negativeAmounts(user.id())).as("C1 negative rows").containsExactly(-150);
        assertThat(purchaseTypes(user.id())).as("C1 purchases").containsExactly("rug");
        assertThat(ownedMap(JSON.readTree(shop(user.token()).body())).get("rug")).as("C1 rug owned").isEqualTo(2);
        assertThat(storedIds(JSON.readTree(getLayout(user.token()).body()))).as("C1 stored").containsExactly("rug-1");
    }

    @Test
    void c2_fiveConcurrentOrders() throws Exception {
        TestUser user = newUser("c2");
        setBalance(user, 100);

        List<HttpResponse<String>> responses = concurrently(5, () -> order(user.token(), "books", 40));

        assertThat(statuses(responses)).as("C2 statuses %s", bodies(responses)).containsExactlyInAnyOrder(200, 200, 409, 409, 409);
        assertThat(codeOfFailure(responses)).as("C2 failure codes")
                .containsExactly("NOT_ENOUGH_LOOP_POINTS", "NOT_ENOUGH_LOOP_POINTS", "NOT_ENOUGH_LOOP_POINTS");
        assertThat(balanceRow(user.id())).as("C2 balance").isEqualTo(20);
        assertThat(negativeAmounts(user.id())).as("C2 negative rows").containsExactly(-40, -40);
        assertThat(purchaseTypes(user.id())).as("C2 purchases").containsExactly("books", "books");
        assertThat(storedIds(JSON.readTree(getLayout(user.token()).body()))).as("C2 stored")
                .containsExactlyInAnyOrder("books-1", "books-2");
    }

    @Test
    void c3_concurrentOrdersDoNotPassForty() throws Exception {
        TestUser user = newUser("c3");
        setBalance(user, 1000);
        insertLayout(user.id(), layoutWithStoredBooks(32));

        List<HttpResponse<String>> responses = concurrently(2, () -> order(user.token(), "books", 40));

        assertThat(statuses(responses)).as("C3 statuses %s", bodies(responses)).containsExactlyInAnyOrder(200, 409);
        assertThat(codeOfFailure(responses)).as("C3 failure code").containsExactly("LAYOUT_FULL");
        assertThat(totalItems(JSON.readTree(getLayout(user.token()).body()))).as("C3 layout size").isEqualTo(40);
        assertThat(balanceRow(user.id())).as("C3 balance").isEqualTo(960);
        assertThat(purchaseTypes(user.id())).as("C3 purchases").containsExactly("books");
    }

    @Test
    void c4_concurrentFirstOrdersWithoutSavedLayout() throws Exception {
        TestUser user = newUser("c4");
        setBalance(user, 200);

        List<HttpResponse<String>> responses = concurrently(2, () -> order(user.token(), "books", 40));

        assertThat(statuses(responses)).as("C4 statuses %s", bodies(responses)).containsExactly(200, 200);
        assertThat(balanceRow(user.id())).as("C4 balance").isEqualTo(120);
        assertThat(purchaseTypes(user.id())).as("C4 purchases").containsExactly("books", "books");
        JsonNode layout = JSON.readTree(getLayout(user.token()).body());
        ObjectNode expectedItems = i0();
        assertThat(layout.path("items")).as("C4 items").isEqualTo(expectedItems.get("items"));
        assertThat(storedIds(layout)).as("C4 stored").containsExactlyInAnyOrder("books-1", "books-2");
    }

    @Test
    void c5_concurrentFirstOrderAndSummaryGiveTheGiftOnce() throws Exception {
        TestUser user = newUser("c5");
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<HttpResponse<String>> orderFuture = pool.submit(() -> {
                start.await();
                return order(user.token(), "books", 40);
            });
            Future<HttpResponse<String>> summaryFuture = pool.submit(() -> {
                start.await();
                return loopPoints(user.token());
            });
            start.countDown();
            HttpResponse<String> orderResponse = orderFuture.get(60, TimeUnit.SECONDS);
            HttpResponse<String> summaryResponse = summaryFuture.get(60, TimeUnit.SECONDS);

            assertThat(orderResponse.statusCode()).as("C5 order, body %s", orderResponse.body()).isEqualTo(200);
            assertThat(summaryResponse.statusCode()).as("C5 summary, body %s", summaryResponse.body()).isEqualTo(200);
        } finally {
            pool.shutdownNow();
        }
        assertThat(balanceRow(user.id())).as("C5 balance").isEqualTo(160);
        assertThat(giftEntries(user.id())).as("C5 gift rows").isEqualTo(1);
    }

    // =====================================================================
    // V. 배치 저장의 가진 개수 검사
    // =====================================================================

    @Test
    void v1_initialLayoutIsSaved() throws Exception {
        TestUser user = newUser("v1");

        assertThat(putLayout(user.token(), i0()).statusCode()).as("V1 save I0").isEqualTo(200);
    }

    @Test
    void v2_to_v6_moreThanOwnedIsRejected() throws Exception {
        ObjectNode bedInRoom = i0();
        items(bedInRoom).add(floor("bed", "bed", 4.5, 9.5, 0));
        ObjectNode bedStored = i0();
        bedStored.putArray("stored").add(stored("bed-1", "bed"));
        ObjectNode secondWardrobe = i0();
        secondWardrobe.putArray("stored").add(stored("wardrobe-2", "wardrobe"));
        ObjectNode secondLamp = i0();
        secondLamp.putArray("stored").add(stored("lamp-2", "lamp"));
        ObjectNode secondRug = i0();
        items(secondRug).add(floor("rug-2", "rug", 4.5, 9.5, 0));

        assertNotOwned("v2", bedInRoom, "V2 bed in the room");
        assertNotOwned("v3", bedStored, "V3 bed stored");
        assertNotOwned("v4", secondWardrobe, "V4 second wardrobe");
        assertNotOwned("v5", secondLamp, "V5 second lamp");
        assertNotOwned("v6", secondRug, "V6 second rug");
    }

    @Test
    void v7_fewerThanOwnedIsFine() throws Exception {
        TestUser user = newUser("v7");
        ObjectNode layout = i0();
        removeItem(layout, "wardrobe");
        removeItem(layout, "rug");
        removeItem(layout, "lamp");

        assertThat(putLayout(user.token(), layout).statusCode()).as("V7 save without removable kinds").isEqualTo(200);
    }

    @Test
    void v8_v9_v12_boughtCountRaisesTheLimit() throws Exception {
        TestUser user = newUser("v8");
        setBalance(user, 300);
        assertOk(order(user.token(), "bed", 240), "V8 setup order");
        ObjectNode v8 = i0();
        items(v8).add(floor("bed-1", "bed", 4.5, 9.5, 0));
        ObjectNode v9 = v8.deepCopy();
        v9.putArray("stored").add(stored("bed-2", "bed"));

        HttpResponse<String> saved = putLayout(user.token(), v8);
        HttpResponse<String> rejected = putLayout(user.token(), v9);
        HttpResponse<String> load = getLayout(user.token());

        assertThat(saved.statusCode()).as("V8 save with bed-1, body %s", saved.body()).isEqualTo(200);
        assertNotOwnedResponse(rejected, "V9 bed-1 + bed-2");
        assertThat(load.statusCode()).as("V12 load").isEqualTo(200);
        assertThat(JSON.readTree(load.body())).as("V12 previous layout stays").isEqualTo(v8);
    }

    @Test
    void v10_starterPlusBought() throws Exception {
        TestUser user = newUser("v10");
        assertOk(order(user.token(), "lamp", 60), "V10 setup order");
        ObjectNode ok = i0();
        ok.putArray("stored").add(stored("lamp-1", "lamp"));
        ObjectNode tooMany = ok.deepCopy();
        ((ArrayNode) tooMany.get("stored")).add(stored("lamp-2", "lamp"));

        HttpResponse<String> saved = putLayout(user.token(), ok);
        HttpResponse<String> rejected = putLayout(user.token(), tooMany);

        assertThat(saved.statusCode()).as("V10 lamp + lamp-1, body %s", saved.body()).isEqualTo(200);
        assertNotOwnedResponse(rejected, "V10 lamp + lamp-1 + lamp-2");
    }

    @Test
    void v11_anotherAccountsPurchasesDoNotCount() throws Exception {
        TestUser x = newUser("v11x");
        TestUser y = newUser("v11y");
        setBalance(x, 300);
        assertOk(order(x.token(), "bed", 240), "V11 X order");
        ObjectNode layout = i0();
        items(layout).add(floor("bed", "bed", 4.5, 9.5, 0));

        assertNotOwnedResponse(putLayout(y.token(), layout), "V11 Y bed");
        assertThat(getLayout(y.token()).statusCode()).as("V11 Y layout").isEqualTo(404);
    }

    @Test
    void v13_placeFurnitureCheckStaysTheSame() throws Exception {
        TestUser user = newUser("v13");
        ObjectNode layout = i0();
        items(layout).add(floor("desk-2", "desk", 5.5, 9.5, 0));

        HttpResponse<String> response = putLayout(user.token(), layout);

        assertThat(response.statusCode()).as("V13 two desks, body %s", response.body()).isEqualTo(400);
        JsonNode body = JSON.readTree(response.body());
        assertThat(body.path("code").asText()).as("V13 code").isEqualTo("INVALID_LOBBY_LAYOUT");
        assertThat(body.path("message").asText()).as("V13 message").isEqualTo("장소가 딸린 가구는 하나씩 있어야 해요.");
    }

    // =====================================================================
    // P. 회원 탈퇴
    // =====================================================================

    @Test
    void p1_accountDeletionRemovesOnlyThatUsersPurchases() throws Exception {
        TestUser x = newUser("p1x");
        TestUser y = newUser("p1y");
        assertOk(order(x.token(), "books", 40), "P1 X order");
        assertOk(order(y.token(), "books", 40), "P1 Y order");

        Map<String, Object> deleteBody = new LinkedHashMap<>();
        deleteBody.put("confirmationText", "탈퇴");
        deleteBody.put("currentPassword", x.password());
        HttpResponse<String> delete = client.send(
                HttpRequest.newBuilder(uri("/api/auth/account"))
                        .header("Authorization", "Bearer " + x.token())
                        .header("Content-Type", "application/json")
                        .method("DELETE", HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(deleteBody)))
                        .build(),
                HttpResponse.BodyHandlers.ofString());

        assertThat(delete.statusCode()).as("P1 DELETE /api/auth/account, body %s", delete.body()).isEqualTo(200);
        assertThat(rowsOf("home_shopping_orders", x.id())).as("P1 X purchases").isZero();
        assertThat(rowsOf("home_shopping_orders", y.id())).as("P1 Y purchases").isEqualTo(1);
        assertThat(rowsOf("loop_point_entries", x.id())).as("P1 X ledger").isZero();
        assertThat(rowsOf("loop_point_balances", x.id())).as("P1 X balance").isZero();
        assertThat(rowsOf("lobby_layouts", x.id())).as("P1 X layout").isZero();
    }

    // =====================================================================
    // K. 그대로 둘 동작
    // =====================================================================

    @Test
    void k1_layoutShapeAfterAnOrder() throws Exception {
        TestUser user = newUser("k1");
        assertOk(order(user.token(), "books", 40), "K1 order");

        JsonNode layout = JSON.readTree(getLayout(user.token()).body());

        assertThat(fieldNames(layout)).as("K1 layout keys").containsExactlyInAnyOrder("version", "items", "stored");
        assertThat(layout.path("version").asInt()).as("K1 version").isEqualTo(2);
        for (JsonNode item : layout.path("items")) {
            List<String> names = fieldNames(item);
            assertThat(names).as("K1 item keys %s", item).contains("id", "type").hasSize(3);
            assertThat(names.stream().filter(name -> List.of("floor", "wall", "on").contains(name)).count())
                    .as("K1 one spot in %s", item).isEqualTo(1);
        }
    }

    @Test
    void k3_earningAfterAnOrderStaysTheSame() throws Exception {
        TestUser user = newUser("k3");
        JsonNode ordered = JSON.readTree(assertOk(order(user.token(), "books", 40), "K3 order").body());
        int balance = ordered.path("balance").asInt();

        for (int i = 1; i <= 5; i++) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("id", "now-qa-" + UUID.randomUUID().toString().replace("-", "").substring(0, 24));
            entry.put("text", "K3 piece " + i + ".");
            HttpResponse<String> response = client.send(
                    HttpRequest.newBuilder(uri("/api/now-in-english/entries"))
                            .header("Authorization", "Bearer " + user.token())
                            .header("Content-Type", "application/json")
                            .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(entry)))
                            .build(),
                    HttpResponse.BodyHandlers.ofString());
            assertThat(response.statusCode()).as("K3 entry %d, body %s", i, response.body()).isEqualTo(201);
            JsonNode points = JSON.readTree(response.body()).path("loopPoints");
            balance += 10;
            assertThat(points.path("earned").asInt()).as("K3 entry %d earned", i).isEqualTo(10);
            assertThat(points.path("balance").asInt()).as("K3 entry %d balance", i).isEqualTo(balance);
        }
        assertThat(loopPointsBalance(user)).as("K3 final balance").isEqualTo(160 + 50);
    }

    // =====================================================================
    // 도움 함수: 기대 판정
    // =====================================================================

    private void assertBroadcast(JsonNode body, String type, int price, int salePrice, String label) {
        JsonNode broadcast = body.path("broadcast");
        assertThat(broadcast.isObject()).as("%s broadcast is an object: %s", label, body).isTrue();
        assertThat(broadcast.path("type").asText()).as("%s broadcast.type", label).isEqualTo(type);
        assertThat(broadcast.path("price").asInt()).as("%s broadcast.price", label).isEqualTo(price);
        assertThat(broadcast.path("salePrice").asInt()).as("%s broadcast.salePrice", label).isEqualTo(salePrice);
    }

    private HttpResponse<String> assertOk(HttpResponse<String> response, String label) {
        assertThat(response.statusCode()).as("%s order, body %s", label, response.body()).isEqualTo(200);
        return response;
    }

    private void assertNewId(String tag, ObjectNode savedLayout, String type, int price, String expectedId) throws Exception {
        TestUser user = newUser(tag);
        setBalance(user, 1000);
        insertLayout(user.id(), savedLayout);

        JsonNode body = JSON.readTree(assertOk(order(user.token(), type, price), tag).body());

        assertThat(body.path("itemId").asText()).as("%s itemId", tag).isEqualTo(expectedId);
        ObjectNode expected = savedLayout.deepCopy();
        ArrayNode stored = expected.has("stored") ? (ArrayNode) expected.get("stored") : expected.putArray("stored");
        stored.add(stored(expectedId, type));
        assertThat(body.path("layout")).as("%s layout", tag).isEqualTo(expected);
    }

    /** 실패하고 NC(잔액, 장부 음수 줄, 산 기록, 배치가 그대로). code·message가 null이면 키가 있는지만 본다. */
    private void assertRejectedNothingChanged(
            TestUser user, Map<String, Object> request, int status, String code, String message, String label) throws Exception {
        Snapshot before = snapshot(user);

        HttpResponse<String> response = order(user.token(), request);

        assertThat(response.statusCode()).as("%s status, body %s", label, response.body()).isEqualTo(status);
        JsonNode body = JSON.readTree(response.body());
        if (code == null) {
            assertThat(body.path("code").isTextual() && !body.path("code").asText().isBlank()).as("%s code key: %s", label, body).isTrue();
        } else {
            assertThat(body.path("code").asText()).as("%s code", label).isEqualTo(code);
        }
        if (message == null) {
            assertThat(body.path("message").isTextual() && !body.path("message").asText().isBlank()).as("%s message key: %s", label, body).isTrue();
        } else {
            assertThat(body.path("message").asText()).as("%s message", label).isEqualTo(message);
        }
        assertThat(snapshot(user)).as("%s nothing changed", label).isEqualTo(before);
    }

    private void assertNotOwned(String tag, ObjectNode layout, String label) throws Exception {
        TestUser user = newUser(tag);
        assertNotOwnedResponse(putLayout(user.token(), layout), label);
        assertThat(getLayout(user.token()).statusCode()).as("%s nothing saved", label).isEqualTo(404);
    }

    private void assertNotOwnedResponse(HttpResponse<String> response, String label) throws Exception {
        assertThat(response.statusCode()).as("%s status, body %s", label, response.body()).isEqualTo(400);
        JsonNode body = JSON.readTree(response.body());
        assertThat(body.path("code").asText()).as("%s code", label).isEqualTo("INVALID_LOBBY_LAYOUT");
        assertThat(body.path("message").asText()).as("%s message", label).isEqualTo("가지지 않은 가구가 있어요.");
    }

    private record Snapshot(Integer balance, List<Integer> negativeAmounts, List<String> purchases, int layoutStatus, JsonNode layout) {
    }

    private Snapshot snapshot(TestUser user) throws Exception {
        HttpResponse<String> layout = getLayout(user.token());
        return new Snapshot(
                balanceRowOrNull(user.id()),
                negativeAmounts(user.id()),
                purchaseTypes(user.id()),
                layout.statusCode(),
                layout.statusCode() == 200 ? JSON.readTree(layout.body()) : null);
    }

    // =====================================================================
    // 도움 함수: 배치
    // =====================================================================

    /** 처음 배치(I0): 앱 DEFAULT_LOBBY_LAYOUT과 같은 7개, 보관함 없음. */
    private static ObjectNode i0() {
        ObjectNode layout = JSON.createObjectNode();
        layout.put("version", 2);
        ArrayNode items = layout.putArray("items");
        items.add(floor("desk", "desk", 1.5, 5.5, 0));
        items.add(floor("bookcase", "bookcase", 0.5, 2.5, 1));
        items.add(floor("wardrobe", "wardrobe", 7.5, 3.5, 3));
        items.add(floor("rug", "rug", 4.6, 7.2, 0));
        items.add(wall("board", "board", "back", 1.8));
        items.add(wall("window", "window", "back", 4.8));
        ObjectNode lamp = JSON.createObjectNode();
        lamp.put("id", "lamp");
        lamp.put("type", "lamp");
        lamp.putObject("on").put("parent", "desk").put("slot", 0).put("facing", 0);
        items.add(lamp);
        return layout;
    }

    private static ObjectNode floor(String id, String type, double x, double z, int facing) {
        ObjectNode item = JSON.createObjectNode();
        item.put("id", id);
        item.put("type", type);
        item.putObject("floor").put("x", x).put("z", z).put("facing", facing);
        return item;
    }

    private static ObjectNode wall(String id, String type, String side, double along) {
        ObjectNode item = JSON.createObjectNode();
        item.put("id", id);
        item.put("type", type);
        item.putObject("wall").put("wall", side).put("along", along);
        return item;
    }

    private static ObjectNode stored(String id, String type) {
        ObjectNode item = JSON.createObjectNode();
        item.put("id", id);
        item.put("type", type);
        return item;
    }

    private static ArrayNode items(ObjectNode layout) {
        return (ArrayNode) layout.get("items");
    }

    private static void removeItem(ObjectNode layout, String id) {
        ArrayNode items = items(layout);
        for (int i = 0; i < items.size(); i++) {
            if (items.get(i).path("id").asText().equals(id)) {
                items.remove(i);
                return;
            }
        }
        throw new IllegalArgumentException("no item " + id);
    }

    private static ObjectNode storedLayout(List<ObjectNode> storedItems) {
        ObjectNode layout = i0();
        ArrayNode stored = layout.putArray("stored");
        storedItems.forEach(stored::add);
        return layout;
    }

    /** I0(7개) + 보관함 책 count개(id books-s1...). */
    private static ObjectNode layoutWithStoredBooks(int count) {
        ObjectNode layout = i0();
        ArrayNode stored = layout.putArray("stored");
        for (int i = 1; i <= count; i++) {
            stored.add(stored("books-s" + i, "books"));
        }
        return layout;
    }

    private static int totalItems(JsonNode layout) {
        return layout.path("items").size() + layout.path("stored").size();
    }

    private static List<String> storedIds(JsonNode layout) {
        List<String> ids = new ArrayList<>();
        layout.path("stored").forEach(item -> ids.add(item.path("id").asText()));
        return ids;
    }

    private static List<String> fieldNames(JsonNode node) {
        List<String> names = new ArrayList<>();
        node.fieldNames().forEachRemaining(names::add);
        return names;
    }

    /** 배치 검사를 거치지 않고 저장된 배치를 넣는다(shape_version 2). */
    private void insertLayout(long userId, ObjectNode layout) throws Exception {
        ObjectNode stored = layout.deepCopy();
        stored.remove("version");
        jdbc.update(
                "INSERT INTO lobby_layouts (user_id, shape_version, layout_json, created_at, updated_at) VALUES (?, 2, ?, NOW(6), NOW(6))",
                userId, JSON.writeValueAsString(stored));
    }

    // =====================================================================
    // 도움 함수: 목록·잔액·DB
    // =====================================================================

    private static Map<String, Integer> owned(Map<String, Integer> nonZero) {
        Map<String, Integer> all = new LinkedHashMap<>();
        TYPES.forEach(type -> all.put(type, nonZero.getOrDefault(type, 0)));
        return all;
    }

    private static Map<String, Integer> ownedMap(JsonNode body) {
        Map<String, Integer> owned = new LinkedHashMap<>();
        body.path("items").forEach(item -> owned.put(item.path("type").asText(), item.path("owned").asInt()));
        return owned;
    }

    private void setBalance(TestUser user, int balance) throws Exception {
        assertThat(loopPoints(user.token()).statusCode()).as("setup: create the balance row").isEqualTo(200);
        jdbc.update("UPDATE loop_point_balances SET balance = ? WHERE user_id = ?", balance, user.id());
    }

    private int loopPointsBalance(TestUser user) throws Exception {
        HttpResponse<String> response = loopPoints(user.token());
        assertThat(response.statusCode()).as("GET /api/loop-points, body %s", response.body()).isEqualTo(200);
        return JSON.readTree(response.body()).path("balance").asInt();
    }

    private int balanceRow(long userId) {
        return jdbc.queryForObject("SELECT balance FROM loop_point_balances WHERE user_id = ?", Integer.class, userId);
    }

    private Integer balanceRowOrNull(long userId) {
        List<Integer> rows = jdbc.queryForList("SELECT balance FROM loop_point_balances WHERE user_id = ?", Integer.class, userId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private List<Integer> negativeAmounts(long userId) {
        return jdbc.queryForList(
                "SELECT amount FROM loop_point_entries WHERE user_id = ? AND amount < 0 ORDER BY id", Integer.class, userId);
    }

    private int giftEntries(long userId) {
        return jdbc.queryForObject(
                "SELECT COUNT(*) FROM loop_point_entries WHERE user_id = ? AND reason = 'START_GIFT'", Integer.class, userId);
    }

    private int giftAmount(long userId) {
        return jdbc.queryForObject(
                "SELECT amount FROM loop_point_entries WHERE user_id = ? AND reason = 'START_GIFT'", Integer.class, userId);
    }

    private List<String> purchaseTypes(long userId) {
        return jdbc.queryForList(
                "SELECT furniture_type FROM home_shopping_orders WHERE user_id = ? ORDER BY id", String.class, userId);
    }

    private int rowsOf(String table, long userId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM " + table + " WHERE user_id = ?", Integer.class, userId);
    }

    /** 표 이름을 잠깐 바꿔 그 표를 쓰는 단계만 실제 DB 오류로 실패하게 하고, 끝나면 되돌린다. */
    private <T> T withRenamedTable(String table, Callable<T> action) throws Exception {
        jdbc.execute("RENAME TABLE " + table + " TO " + table + "_qa_off");
        try {
            return action.call();
        } finally {
            jdbc.execute("RENAME TABLE " + table + "_qa_off TO " + table);
        }
    }

    private static void at(LocalDate seoulDate) {
        FIXED_NOW.set(seoulDate.atTime(LocalTime.NOON).atZone(SEOUL).toInstant());
    }

    // =====================================================================
    // 도움 함수: 동시 요청
    // =====================================================================

    private static List<HttpResponse<String>> concurrently(int count, Callable<HttpResponse<String>> call) throws Exception {
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(count);
        try {
            List<Future<HttpResponse<String>>> futures = new ArrayList<>();
            for (int i = 0; i < count; i++) {
                futures.add(pool.submit(() -> {
                    start.await();
                    return call.call();
                }));
            }
            start.countDown();
            List<HttpResponse<String>> responses = new ArrayList<>();
            for (Future<HttpResponse<String>> future : futures) {
                responses.add(future.get(60, TimeUnit.SECONDS));
            }
            return responses;
        } finally {
            pool.shutdownNow();
        }
    }

    private static List<Integer> statuses(List<HttpResponse<String>> responses) {
        return responses.stream().map(HttpResponse::statusCode).toList();
    }

    private static List<String> bodies(List<HttpResponse<String>> responses) {
        return responses.stream().map(r -> r.statusCode() + " " + r.body()).toList();
    }

    private static List<String> codeOfFailure(List<HttpResponse<String>> responses) throws Exception {
        List<String> codes = new ArrayList<>();
        for (HttpResponse<String> response : responses) {
            if (response.statusCode() != 200) {
                codes.add(JSON.readTree(response.body()).path("code").asText());
            }
        }
        return codes;
    }

    // =====================================================================
    // 도움 함수: 사용자·요청
    // =====================================================================

    private record TestUser(long id, String email, String password, String token) {
    }

    private TestUser newUser(String tag) throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        String email = "qa-086h-" + tag + "-" + suffix + "@example.com";
        String password = "qa-pass-" + suffix;
        jdbc.update(
                "INSERT INTO users (email, password_hash, display_name, email_verified, verified_at) VALUES (?, ?, ?, 1, NOW())",
                email, passwordEncoder.encode(password), "qa-086h-" + tag + "-" + suffix);
        long userId = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", Long.class, email);
        return new TestUser(userId, email, password, login(email, password));
    }

    private String login(String email, String password) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("email", email);
        body.put("password", password);
        HttpResponse<String> login = client.send(
                HttpRequest.newBuilder(uri("/api/auth/token/login"))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body)))
                        .build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(login.statusCode()).as("setup: token login, body %s", login.body()).isEqualTo(200);
        String token = JSON.readTree(login.body()).path("accessToken").asText();
        assertThat(token).as("setup: access token").isNotBlank();
        return token;
    }

    private static Map<String, Object> body(String type, int price) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("type", type);
        body.put("price", price);
        return body;
    }

    private HttpRequest.Builder authed(HttpRequest.Builder builder, String token) {
        if (token != null) {
            builder.header("Authorization", "Bearer " + token);
        }
        return builder;
    }

    private HttpResponse<String> shop(String token) throws Exception {
        return client.send(authed(HttpRequest.newBuilder(uri("/api/home-shopping")).GET(), token).build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> order(String token, String type, int price) throws Exception {
        return order(token, body(type, price));
    }

    private HttpResponse<String> order(String token, Map<String, Object> body) throws Exception {
        return client.send(authed(HttpRequest.newBuilder(uri("/api/home-shopping/orders"))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body))), token).build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> loopPoints(String token) throws Exception {
        return client.send(authed(HttpRequest.newBuilder(uri("/api/loop-points")).GET(), token).build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> getLayout(String token) throws Exception {
        return client.send(authed(HttpRequest.newBuilder(uri("/api/lobby-layout")).GET(), token).build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> putLayout(String token, JsonNode layout) throws Exception {
        return client.send(authed(HttpRequest.newBuilder(uri("/api/lobby-layout"))
                        .header("Content-Type", "application/json")
                        .PUT(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(layout))), token).build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private URI uri(String path) {
        return URI.create(rest.getRootUri() + path);
    }
}
