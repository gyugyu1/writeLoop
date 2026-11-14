package com.writeloop.controller;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.writeloop.persistence.WardrobeItemEntity;
import com.writeloop.persistence.WardrobeItemRepository;
import com.writeloop.support.IntegrationTestSupport;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.time.Duration;
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
 * [spec] 작업 089 ④ 홈쇼핑 '옷' 분류, 백엔드. 시나리오 02-qa-scenarios.md(L, B, O, K, E, F, C, G, P)와
 * 결정 04-main-decision.md B(1: 이미 가진 옷이 먼저, 그다음 가격 → 룹. 2: 방송은 epochDay % 14, 작업 089 ⑤ 07-아이템-늘리기/04-main-decision.md A-1 사용자 결정으로 epochDay % 26)를 실제 서버로 확인한다.
 *
 * <ul>
 *   <li>로그인은 토큰 로그인(Bearer). 테스트마다 새 사용자를 만든다.</li>
 *   <li>서버 서울 날짜는 테스트용 시계 빈으로 고정한다(기본 T = 2026-11-09 서울 정오, 방송 상품 nightstand, 옷은 모두 정가).
 *       O4만 시계를 고정하지 않는다(얻은 때가 실제 지금인지 본다).</li>
 *   <li>잔액은 GET /api/loop-points로 잔액 행을 만든 뒤 jdbc로 바꾼다. 가진 옷은 저장소로 wardrobe_items에 직접 넣는다.</li>
 *   <li>NC(아무것도 바뀌지 않음): 잔액 행, 장부 음수 줄, 주문 기록(종류·가격), 가진 옷(종류·얻은 때), GET /api/wardrobe 본문,
 *       GET /api/lobby-layout(상태와 본문)이 요청 전후로 같다.</li>
 *   <li>작업 089 ⑤ 08 결정(사용자 결정, 고글 기본)에 맞춰 주문 결과 옷장의 가진 것 맨 앞에 고글을 더하고,
 *       입은 것을 저장한 적 없는 계정의 얼굴장식을 고글로 바꿨다(O1·O7, O5, O11).</li>
 * </ul>
 */
class HomeShoppingClothesControllerSpecTest extends IntegrationTestSupport {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final AtomicReference<Instant> FIXED_NOW = new AtomicReference<>();

    private static final String PRICE_CHANGED_MESSAGE = "가격이 바뀌었어요. 다시 확인해 주세요.";
    private static final String NOT_ENOUGH_MESSAGE = "룹이 모자라요.";
    private static final String ALREADY_OWNED_MESSAGE = "이미 가진 옷이에요.";

    /** 기본 날짜 T: 방송 상품 nightstand. */
    private static final LocalDate T = LocalDate.of(2026, 11, 9);

    /** 가격표(명세의 값), 이 순서가 목록 순서다(작업 089 ⑤: 옷 열둘을 더해 스물여섯). */
    private static final List<String> TYPES = List.of(
            "books", "smallPlant", "lamp", "capOrange", "capBlue", "capGreen", "frame", "shortsNavy", "shortsBrown", "shortsRed",
            "plant", "tshirtOrange", "tshirtWhite", "tshirtYellow", "shoesBrown", "shoesRed", "shoesWhite", "mufflerRed",
            "nightstand", "sunglassesBlack", "floorLamp", "necklaceGold", "backpackRed", "rug", "wardrobe", "bed");
    private static final List<Integer> PRICES = List.of(
            40, 50, 60, 60, 60, 60, 70, 70, 70, 70, 80, 80, 80, 80, 90, 90, 90, 90, 100, 100, 110, 110, 120, 150, 180, 300);
    private static final List<Integer> SALE_PRICES = List.of(
            32, 40, 48, 48, 48, 48, 56, 56, 56, 56, 64, 64, 64, 64, 72, 72, 72, 72, 80, 80, 88, 88, 96, 120, 144, 240);
    private static final List<String> CLOTHES = List.of("capOrange", "tshirtOrange", "shortsNavy", "shoesBrown");

    /** 방송 날짜표: k번째 날의 방송 상품이 가격표 k번째(epochDay % 26). */
    private static final LocalDate FIRST_DAY = LocalDate.of(2026, 10, 22);

    @TestConfiguration
    static class ClockConfig {
        @Bean
        Clock homeShoppingClothesSpecClock() {
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

    @Autowired
    private WardrobeItemRepository wardrobeItemRepository;

    private final HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();

    @BeforeEach
    void fixDate() {
        at(T);
    }

    @AfterEach
    void restoreClock() {
        FIXED_NOW.set(null);
    }

    // =====================================================================
    // L. 목록
    // =====================================================================

    @Test
    void l1_l2_twentySixItemsInPriceOrderWithOneSale() throws Exception {
        TestUser user = newUser("l1");

        HttpResponse<String> response = shop(user.token());

        assertThat(response.statusCode()).as("L1 GET, body %s", response.body()).isEqualTo(200);
        JsonNode body = JSON.readTree(response.body());
        JsonNode items = body.path("items");
        assertThat(items.isArray()).as("L1 items is an array: %s", body).isTrue();
        assertThat(items.size()).as("L1 items count").isEqualTo(26);
        assertThat(typesOf(items)).as("L1 item types in order").containsExactlyElementsOf(TYPES);
        for (int i = 0; i < 26; i++) {
            assertThat(items.get(i).path("price").asInt()).as("L1 price of %s", TYPES.get(i)).isEqualTo(PRICES.get(i));
        }
        // L2
        assertBroadcast(body, "nightstand", 100, 80, "L2");
        for (int i = 0; i < 26; i++) {
            JsonNode item = items.get(i);
            if (TYPES.get(i).equals("nightstand")) {
                assertThat(item.path("salePrice").asInt()).as("L2 salePrice of nightstand").isEqualTo(80);
            } else {
                assertThat(item.has("salePrice") && item.get("salePrice").isNull())
                        .as("L2 salePrice of %s is null: %s", TYPES.get(i), item).isTrue();
            }
        }
    }

    @Test
    void l3_newUserOwnsNoClothes() throws Exception {
        TestUser user = newUser("l3");

        JsonNode body = JSON.readTree(shop(user.token()).body());

        assertThat(ownedMap(body)).as("L3 owned").isEqualTo(owned(Map.of("wardrobe", 1, "rug", 1, "lamp", 1)));
    }

    @Test
    void l4_clothesInTheWardrobeAreOwnedWithoutAnOrder() throws Exception {
        TestUser user = newUser("l4");
        own(user, "capOrange", "2026-11-01T00:00:00Z");
        own(user, "shoesBrown", "2026-11-02T00:00:00Z");

        JsonNode body = JSON.readTree(shop(user.token()).body());

        assertThat(ownedMap(body)).as("L4 owned")
                .isEqualTo(owned(Map.of("capOrange", 1, "shoesBrown", 1, "wardrobe", 1, "rug", 1, "lamp", 1)));
    }

    @Test
    void l5_boughtClothIsOwnedOnceAndFurnitureCountsStay() throws Exception {
        TestUser user = newUser("l5");
        setBalance(user, 1000);
        assertOk(order(user.token(), "capOrange", 60), "L5 order");

        JsonNode body = JSON.readTree(shop(user.token()).body());

        assertThat(ownedMap(body)).as("L5 owned")
                .isEqualTo(owned(Map.of("capOrange", 1, "wardrobe", 1, "rug", 1, "lamp", 1)));
    }

    @Test
    void l6_ownedClothesArePerAccount() throws Exception {
        TestUser x = newUser("l6x");
        TestUser y = newUser("l6y");
        setBalance(x, 1000);
        assertOk(order(x.token(), "capOrange", 60), "L6 X order");

        JsonNode body = JSON.readTree(shop(y.token()).body());

        assertThat(ownedMap(body).get("capOrange")).as("L6 Y capOrange owned").isEqualTo(0);
        assertThat(body.path("balance").asInt()).as("L6 Y balance").isEqualTo(200);
    }

    @Test
    void l7_listWithoutLoginIs401() throws Exception {
        HttpResponse<String> response = shop(null);

        assertThat(response.statusCode()).as("L7 GET without login, body %s", response.body()).isEqualTo(401);
    }

    // =====================================================================
    // B. 오늘의 방송 상품
    // =====================================================================

    @Test
    void b1_broadcastCyclesThroughTheTwentySix() throws Exception {
        TestUser user = newUser("b1");
        for (int day = 0; day < 26; day++) {
            LocalDate date = FIRST_DAY.plusDays(day);
            at(date);
            JsonNode body = JSON.readTree(shop(user.token()).body());
            String label = "B1 " + date;
            assertBroadcast(body, TYPES.get(day), PRICES.get(day), SALE_PRICES.get(day), label);
            JsonNode items = body.path("items");
            assertThat(typesOf(items)).as("%s item types in order", label).containsExactlyElementsOf(TYPES);
            for (int i = 0; i < 26; i++) {
                JsonNode item = items.get(i);
                assertThat(item.path("price").asInt()).as("%s price of %s", label, TYPES.get(i)).isEqualTo(PRICES.get(i));
                if (i == day) {
                    assertThat(item.path("salePrice").asInt()).as("%s salePrice of %s", label, TYPES.get(i)).isEqualTo(SALE_PRICES.get(i));
                } else {
                    assertThat(item.has("salePrice") && item.get("salePrice").isNull())
                            .as("%s salePrice of %s is null: %s", label, TYPES.get(i), item).isTrue();
                }
            }
        }
    }

    @Test
    void b2_capOnAirAndTheSamePricedLampIsNot() throws Exception {
        TestUser user = newUser("b2");
        at(LocalDate.of(2026, 10, 25));

        JsonNode body = JSON.readTree(shop(user.token()).body());

        assertBroadcast(body, "capOrange", 60, 48, "B2");
        assertThat(itemOf(body, "capOrange").path("salePrice").asInt()).as("B2 capOrange salePrice").isEqualTo(48);
        assertThat(itemOf(body, "lamp").get("salePrice").isNull()).as("B2 lamp salePrice is null").isTrue();
    }

    @Test
    void b3_otherClothesOnAir() throws Exception {
        TestUser user = newUser("b3");

        at(LocalDate.of(2026, 10, 29));
        assertBroadcast(JSON.readTree(shop(user.token()).body()), "shortsNavy", 70, 56, "B3 10-29");
        at(LocalDate.of(2026, 11, 2));
        assertBroadcast(JSON.readTree(shop(user.token()).body()), "tshirtOrange", 80, 64, "B3 11-02");
        at(LocalDate.of(2026, 11, 5));
        assertBroadcast(JSON.readTree(shop(user.token()).body()), "shoesBrown", 90, 72, "B3 11-05");
    }

    @Test
    void b4_twentySixDaysLaterStartsOver() throws Exception {
        TestUser user = newUser("b4");
        at(LocalDate.of(2026, 11, 17));

        assertBroadcast(JSON.readTree(shop(user.token()).body()), "books", 40, 32, "B4");
    }

    @Test
    void b5_seoulMidnightSplitsTheBroadcast() throws Exception {
        TestUser user = newUser("b5");

        FIXED_NOW.set(Instant.parse("2026-11-02T14:59:59Z"));
        JsonNode before = JSON.readTree(shop(user.token()).body());
        FIXED_NOW.set(Instant.parse("2026-11-02T15:00:00Z"));
        JsonNode after = JSON.readTree(shop(user.token()).body());

        assertBroadcast(before, "tshirtOrange", 80, 64, "B5 before");
        assertBroadcast(after, "tshirtWhite", 80, 64, "B5 after");
    }

    // =====================================================================
    // O. 옷 주문 성공
    // =====================================================================

    @Test
    void o1_o2_o3_o7_orderACloth() throws Exception {
        TestUser user = newUser("o1");
        setBalance(user, 300);

        HttpResponse<String> response = order(user.token(), "capOrange", 60);

        assertThat(response.statusCode()).as("O1 order capOrange 60, body %s", response.body()).isEqualTo(200);
        JsonNode body = JSON.readTree(response.body());
        assertThat(body.path("type").asText()).as("O1 type").isEqualTo("capOrange");
        assertThat(body.path("price").asInt()).as("O1 price").isEqualTo(60);
        assertThat(body.path("balance").asInt()).as("O1 balance").isEqualTo(240);
        assertThat(body.path("owned").asInt()).as("O1 owned").isEqualTo(1);
        assertThat(body.has("itemId") && body.get("itemId").isNull()).as("O1 itemId is null: %s", body).isTrue();
        assertThat(body.has("layout") && body.get("layout").isNull()).as("O1 layout is null: %s", body).isTrue();
        JsonNode wardrobe = body.path("wardrobe");
        assertThat(wardrobe.isObject()).as("O1 wardrobe is an object: %s", body).isTrue();
        assertThat(typesAndSlots(wardrobe)).as("O1 wardrobe items").containsExactly("goggles/face", "capOrange/hat");
        assertThat(wardrobe.path("equipped")).as("O1 wardrobe equipped").isEqualTo(equipped(Map.of("face", "goggles")));

        // O2
        assertThat(balanceRow(user.id())).as("O2 balance row").isEqualTo(240);
        assertThat(loopPointsBalance(user)).as("O2 /api/loop-points").isEqualTo(240);
        assertThat(negativeAmounts(user.id())).as("O2 negative rows").containsExactly(-60);
        assertThat(purchases(user.id())).as("O2 purchases").containsExactly("capOrange:60");
        assertThat(wardrobeRows(user.id())).as("O2 wardrobe rows").containsExactly("capOrange");
        JsonNode list = JSON.readTree(shop(user.token()).body());
        assertThat(ownedMap(list).get("capOrange")).as("O2 list capOrange owned").isEqualTo(1);
        assertThat(list.path("balance").asInt()).as("O2 list balance").isEqualTo(240);

        // O3, O7
        HttpResponse<String> get = getWardrobe(user.token());
        assertThat(get.statusCode()).as("O3 GET /api/wardrobe, body %s", get.body()).isEqualTo(200);
        assertSameWardrobe(wardrobe, JSON.readTree(get.body()), "O3");
        assertThat(JSON.readTree(get.body()).path("equipped")).as("O7 equipped").isEqualTo(equipped(Map.of("face", "goggles")));
    }

    @Test
    void o4_acquiredAtIsNow() throws Exception {
        FIXED_NOW.set(null);
        TestUser user = newUser("o4");
        setBalance(user, 300);
        int price = todayPriceOf(JSON.readTree(shop(user.token()).body()), "shortsNavy");

        Instant t0 = Instant.now();
        HttpResponse<String> response = order(user.token(), "shortsNavy", price);
        Instant t1 = Instant.now();

        assertThat(response.statusCode()).as("O4 order, body %s", response.body()).isEqualTo(200);
        JsonNode wardrobe = JSON.readTree(response.body()).path("wardrobe");
        Instant acquiredAt = Instant.parse(itemIn(wardrobe, "shortsNavy").path("acquiredAt").asText());
        assertThat(acquiredAt).as("O4 acquiredAt").isBetween(t0.minusSeconds(1), t1.plusSeconds(1));
        assertSameWardrobe(wardrobe, JSON.readTree(getWardrobe(user.token()).body()), "O4");
    }

    @Test
    void o5_addedInAcquiredOrder() throws Exception {
        TestUser user = newUser("o5");
        setBalance(user, 300);
        own(user, "capOrange", "2026-11-01T00:00:00Z");

        JsonNode body = JSON.readTree(assertOk(order(user.token(), "shoesBrown", 90), "O5").body());

        assertThat(body.path("balance").asInt()).as("O5 balance").isEqualTo(210);
        assertThat(body.path("owned").asInt()).as("O5 owned").isEqualTo(1);
        JsonNode wardrobe = body.path("wardrobe");
        assertThat(typesAndSlots(wardrobe)).as("O5 wardrobe items").containsExactly("goggles/face", "capOrange/hat", "shoesBrown/shoes");
        assertThat(itemIn(wardrobe, "capOrange").path("acquiredAt").asText()).as("O5 capOrange acquiredAt")
                .isEqualTo("2026-11-01T00:00:00Z");
    }

    @Test
    void o6_orderDoesNotChangeWhatIsWorn() throws Exception {
        TestUser user = newUser("o6");
        setBalance(user, 300);
        own(user, "capOrange", "2026-11-01T00:00:00Z");
        assertThat(putEquipped(user.token(), Map.of("hat", "capOrange")).statusCode()).as("O6 setup wear cap").isEqualTo(200);

        JsonNode body = JSON.readTree(assertOk(order(user.token(), "tshirtOrange", 80), "O6").body());

        assertThat(body.path("wardrobe").path("equipped")).as("O6 response equipped")
                .isEqualTo(equipped(Map.of("hat", "capOrange")));
        assertThat(JSON.readTree(getWardrobe(user.token()).body()).path("equipped")).as("O6 GET equipped")
                .isEqualTo(equipped(Map.of("hat", "capOrange")));
    }

    @Test
    void o8_clothOnAirIsSoldAtTheSalePrice() throws Exception {
        TestUser user = newUser("o8");
        setBalance(user, 300);
        at(LocalDate.of(2026, 11, 2));

        JsonNode body = JSON.readTree(assertOk(order(user.token(), "tshirtOrange", 64), "O8").body());

        assertThat(body.path("price").asInt()).as("O8 price").isEqualTo(64);
        assertThat(body.path("balance").asInt()).as("O8 balance").isEqualTo(236);
        assertThat(purchases(user.id())).as("O8 purchases").containsExactly("tshirtOrange:64");
        assertThat(negativeAmounts(user.id())).as("O8 negative rows").containsExactly(-64);
    }

    @Test
    void o9_balanceExactlyThePrice() throws Exception {
        TestUser user = newUser("o9");
        setBalance(user, 90);

        JsonNode body = JSON.readTree(assertOk(order(user.token(), "shoesBrown", 90), "O9").body());

        assertThat(body.path("balance").asInt()).as("O9 balance").isEqualTo(0);
    }

    @Test
    void o10_firstLoopActionIsAClothOrder() throws Exception {
        TestUser user = newUser("o10");

        JsonNode body = JSON.readTree(assertOk(order(user.token(), "capOrange", 60), "O10").body());

        assertThat(body.path("balance").asInt()).as("O10 balance").isEqualTo(140);
        assertThat(giftEntries(user.id())).as("O10 gift rows").isEqualTo(1);
        assertThat(giftAmount(user.id())).as("O10 gift amount").isEqualTo(200);
        assertThat(negativeAmounts(user.id())).as("O10 negative rows").containsExactly(-60);
    }

    @Test
    void o11_allFourClothes() throws Exception {
        TestUser user = newUser("o11");
        setBalance(user, 1000);

        assertOk(order(user.token(), "capOrange", 60), "O11 cap");
        assertOk(order(user.token(), "tshirtOrange", 80), "O11 tshirt");
        assertOk(order(user.token(), "shortsNavy", 70), "O11 shorts");
        JsonNode last = JSON.readTree(assertOk(order(user.token(), "shoesBrown", 90), "O11 shoes").body());

        assertThat(last.path("balance").asInt()).as("O11 balance").isEqualTo(700);
        assertThat(typesAndSlots(last.path("wardrobe"))).as("O11 wardrobe items")
                .containsExactly("goggles/face", "capOrange/hat", "tshirtOrange/top", "shortsNavy/bottom", "shoesBrown/shoes");
        assertThat(last.path("wardrobe").path("equipped")).as("O11 equipped").isEqualTo(equipped(Map.of("face", "goggles")));
        Map<String, Integer> owned = ownedMap(JSON.readTree(shop(user.token()).body()));
        for (String cloth : CLOTHES) {
            assertThat(owned.get(cloth)).as("O11 %s owned", cloth).isEqualTo(1);
        }
    }

    @Test
    void o12_boughtClothCanBeWorn() throws Exception {
        TestUser user = newUser("o12");
        setBalance(user, 300);
        assertOk(order(user.token(), "capOrange", 60), "O12 order");

        HttpResponse<String> response = putEquipped(user.token(), Map.of("hat", "capOrange"));

        assertThat(response.statusCode()).as("O12 PUT equipped, body %s", response.body()).isEqualTo(200);
        assertThat(JSON.readTree(response.body()).path("equipped")).as("O12 equipped")
                .isEqualTo(equipped(Map.of("hat", "capOrange")));
    }

    // =====================================================================
    // K. 옷 주문은 방 배치를 바꾸지 않는다
    // =====================================================================

    @Test
    void k1_clothOrderDoesNotCreateALayout() throws Exception {
        TestUser user = newUser("k1");
        setBalance(user, 300);

        JsonNode body = JSON.readTree(assertOk(order(user.token(), "capOrange", 60), "K1").body());

        assertThat(body.has("layout") && body.get("layout").isNull()).as("K1 layout is null: %s", body).isTrue();
        assertThat(getLayout(user.token()).statusCode()).as("K1 GET lobby-layout").isEqualTo(404);
    }

    @Test
    void k2_clothOrderDoesNotTouchTheSavedLayout() throws Exception {
        TestUser user = newUser("k2");
        setBalance(user, 300);
        assertThat(putLayout(user.token(), i0()).statusCode()).as("K2 setup save").isEqualTo(200);
        JsonNode before = JSON.readTree(getLayout(user.token()).body());

        assertOk(order(user.token(), "shortsNavy", 70), "K2");

        HttpResponse<String> after = getLayout(user.token());
        assertThat(after.statusCode()).as("K2 GET lobby-layout").isEqualTo(200);
        assertThat(JSON.readTree(after.body())).as("K2 layout").isEqualTo(before);
    }

    @Test
    void k3_fortyFurnitureDoesNotBlockClothes() throws Exception {
        TestUser user = newUser("k3");
        setBalance(user, 1000);
        insertLayout(user.id(), layoutWithStoredBooks(33));
        JsonNode before = JSON.readTree(getLayout(user.token()).body());

        HttpResponse<String> response = order(user.token(), "capOrange", 60);

        assertThat(response.statusCode()).as("K3 order with 40 furniture, body %s", response.body()).isEqualTo(200);
        assertThat(JSON.readTree(response.body()).path("balance").asInt()).as("K3 balance").isEqualTo(940);
        JsonNode after = JSON.readTree(getLayout(user.token()).body());
        assertThat(after).as("K3 layout").isEqualTo(before);
        assertThat(totalItems(after)).as("K3 layout size").isEqualTo(40);
    }

    @Test
    void k4_furnitureLayoutStillSavesAfterBuyingClothes() throws Exception {
        TestUser user = newUser("k4");
        setBalance(user, 1000);
        for (String cloth : CLOTHES) {
            assertOk(order(user.token(), cloth, PRICES.get(TYPES.indexOf(cloth))), "K4 " + cloth);
        }

        HttpResponse<String> response = putLayout(user.token(), i0());

        assertThat(response.statusCode()).as("K4 save I0, body %s", response.body()).isEqualTo(200);
    }

    // =====================================================================
    // E. 옷 주문 실패
    // =====================================================================

    @Test
    void e1_alreadyOwnedFromTheWardrobe() throws Exception {
        TestUser user = newUser("e1");
        setBalance(user, 300);
        own(user, "capOrange", "2026-11-01T00:00:00Z");

        assertRejectedNothingChanged(user, body("capOrange", 60), 409, "ALREADY_OWNED", ALREADY_OWNED_MESSAGE, "E1");
    }

    @Test
    void e2_buyingTheSameClothAgain() throws Exception {
        TestUser user = newUser("e2");
        setBalance(user, 300);
        assertOk(order(user.token(), "capOrange", 60), "E2 first");

        assertRejectedNothingChanged(user, body("capOrange", 60), 409, "ALREADY_OWNED", ALREADY_OWNED_MESSAGE, "E2 second");
        assertThat(balanceRow(user.id())).as("E2 balance").isEqualTo(240);
        assertThat(purchases(user.id())).as("E2 purchases").containsExactly("capOrange:60");
        assertThat(wardrobeRows(user.id())).as("E2 wardrobe rows").containsExactly("capOrange");
    }

    @Test
    void e3_alreadyWearingIt() throws Exception {
        TestUser user = newUser("e3");
        setBalance(user, 300);
        own(user, "capOrange", "2026-11-01T00:00:00Z");
        assertThat(putEquipped(user.token(), Map.of("hat", "capOrange")).statusCode()).as("E3 setup wear cap").isEqualTo(200);

        assertRejectedNothingChanged(user, body("capOrange", 60), 409, "ALREADY_OWNED", ALREADY_OWNED_MESSAGE, "E3");
        assertThat(JSON.readTree(getWardrobe(user.token()).body()).path("equipped").path("hat").asText())
                .as("E3 hat").isEqualTo("capOrange");
    }

    @Test
    void e4_wrongPriceForACloth() throws Exception {
        TestUser user = newUser("e4");
        setBalance(user, 1000);
        for (int price : List.of(72, 89, 0)) {
            assertRejectedNothingChanged(user, body("shoesBrown", price), 409, "PRICE_CHANGED", PRICE_CHANGED_MESSAGE, "E4 " + price);
        }
    }

    @Test
    void e5_fullPriceOnTheClothsBroadcastDay() throws Exception {
        TestUser user = newUser("e5");
        setBalance(user, 1000);
        at(LocalDate.of(2026, 11, 2));

        assertRejectedNothingChanged(user, body("tshirtOrange", 80), 409, "PRICE_CHANGED", PRICE_CHANGED_MESSAGE, "E5");
    }

    @Test
    void e6_clothSaleEndsWhenTheDateChanges() throws Exception {
        TestUser user = newUser("e6");
        setBalance(user, 1000);
        at(LocalDate.of(2026, 10, 25));
        assertThat(itemOf(JSON.readTree(shop(user.token()).body()), "capOrange").path("salePrice").asInt())
                .as("E6 setup capOrange salePrice on 10-25").isEqualTo(48);
        at(LocalDate.of(2026, 10, 26));

        assertRejectedNothingChanged(user, body("capOrange", 48), 409, "PRICE_CHANGED", PRICE_CHANGED_MESSAGE, "E6 old sale price");
        HttpResponse<String> fullPrice = order(user.token(), "capOrange", 60);

        assertThat(fullPrice.statusCode()).as("E6 full price, body %s", fullPrice.body()).isEqualTo(200);
    }

    @Test
    void e7_notEnoughLoopPointsForACloth() throws Exception {
        TestUser user = newUser("e7");
        setBalance(user, 89);

        assertRejectedNothingChanged(user, body("shoesBrown", 90), 409, "NOT_ENOUGH_LOOP_POINTS", NOT_ENOUGH_MESSAGE, "E7");
        assertThat(balanceRow(user.id())).as("E7 balance").isEqualTo(89);
    }

    @Test
    void e8_unsoldClothKinds() throws Exception {
        TestUser user = newUser("e8");
        setBalance(user, 1000);

        assertRejectedNothingChanged(user, body("capRed", 60), 400, null, null, "E8 capRed");
        assertRejectedNothingChanged(user, body("glasses", 60), 400, null, null, "E8 glasses");
    }

    @Test
    void e9_missingOrNullPrice() throws Exception {
        TestUser user = newUser("e9");
        setBalance(user, 1000);
        Map<String, Object> missing = new LinkedHashMap<>();
        missing.put("type", "capOrange");
        Map<String, Object> nullPrice = new LinkedHashMap<>();
        nullPrice.put("type", "capOrange");
        nullPrice.put("price", null);

        assertRejectedNothingChanged(user, missing, 400, "INVALID_ORDER", "주문 내용이 맞지 않아요.", "E9 missing price");
        assertRejectedNothingChanged(user, nullPrice, 400, "INVALID_ORDER", "주문 내용이 맞지 않아요.", "E9 null price");
    }

    @Test
    void e10_clothOrderWithoutLoginIs401() throws Exception {
        HttpResponse<String> response = order(null, "capOrange", 60);

        assertThat(response.statusCode()).as("E10 POST without login, body %s", response.body()).isEqualTo(401);
    }

    /** 결정 04 B1: 이미 가진 옷이 먼저다(가격이 틀려도, 룹이 모자라도). */
    @Test
    void decisionB1_alreadyOwnedComesBeforePriceAndBalance() throws Exception {
        TestUser user = newUser("db1");
        setBalance(user, 10);
        own(user, "capOrange", "2026-11-01T00:00:00Z");

        assertRejectedNothingChanged(user, body("capOrange", 1), 409, "ALREADY_OWNED", ALREADY_OWNED_MESSAGE, "결정B1 owned + wrong price + low balance");
        assertRejectedNothingChanged(user, body("capOrange", 60), 409, "ALREADY_OWNED", ALREADY_OWNED_MESSAGE, "결정B1 owned + low balance");
    }

    /** 결정 04 B1: 가지지 않은 옷은 가구와 같은 순서(가격 → 룹). */
    @Test
    void decisionB1_notOwnedClothChecksPriceBeforeBalance() throws Exception {
        TestUser user = newUser("db1p");
        setBalance(user, 10);

        assertRejectedNothingChanged(user, body("capOrange", 1), 409, "PRICE_CHANGED", PRICE_CHANGED_MESSAGE, "결정B1 wrong price + low balance");
    }

    // =====================================================================
    // F. 한 트랜잭션
    // =====================================================================

    @Test
    void f1_f3_failedWardrobeInsertChangesNothing() throws Exception {
        TestUser user = newUser("f1");
        setBalance(user, 1000);

        HttpResponse<String> response = withRenamedTable("wardrobe_items", () -> order(user.token(), "capOrange", 60));

        assertThat(response.statusCode()).as("F1 order while wardrobe_items is broken, body %s", response.body()).isNotEqualTo(200);
        assertThat(balanceRow(user.id())).as("F1 balance").isEqualTo(1000);
        assertThat(negativeAmounts(user.id())).as("F1 negative rows").isEmpty();
        assertThat(purchases(user.id())).as("F1 purchases").isEmpty();
        assertThat(wardrobeRows(user.id())).as("F1 wardrobe rows").isEmpty();

        // F3
        JsonNode retry = JSON.readTree(assertOk(order(user.token(), "capOrange", 60), "F3 retry").body());
        assertThat(retry.path("balance").asInt()).as("F3 balance").isEqualTo(940);
        assertThat(retry.path("owned").asInt()).as("F3 owned").isEqualTo(1);
    }

    @Test
    void f2_failedPurchaseRecordChangesNothing() throws Exception {
        TestUser user = newUser("f2");
        setBalance(user, 1000);

        HttpResponse<String> response = withRenamedTable("home_shopping_orders", () -> order(user.token(), "capOrange", 60));

        assertThat(response.statusCode()).as("F2 order while purchases are broken, body %s", response.body()).isNotEqualTo(200);
        assertThat(balanceRow(user.id())).as("F2 balance").isEqualTo(1000);
        assertThat(negativeAmounts(user.id())).as("F2 negative rows").isEmpty();
        assertThat(wardrobeRows(user.id())).as("F2 wardrobe rows").isEmpty();
        assertThat(ownedMap(JSON.readTree(shop(user.token()).body())).get("capOrange")).as("F2 capOrange owned").isEqualTo(0);
    }

    // =====================================================================
    // C. 동시 주문
    // =====================================================================

    @Test
    void c1_sameClothTwiceAtOnce() throws Exception {
        TestUser user = newUser("c1");
        setBalance(user, 1000);

        List<HttpResponse<String>> responses = concurrently(List.of(
                () -> order(user.token(), "capOrange", 60),
                () -> order(user.token(), "capOrange", 60)));

        assertThat(statuses(responses)).as("C1 statuses %s", bodies(responses)).containsExactlyInAnyOrder(200, 409);
        assertThat(codesOfFailures(responses)).as("C1 failure code").containsExactly("ALREADY_OWNED");
        assertThat(balanceRow(user.id())).as("C1 balance").isEqualTo(940);
        assertThat(negativeAmounts(user.id())).as("C1 negative rows").containsExactly(-60);
        assertThat(purchases(user.id())).as("C1 purchases").containsExactly("capOrange:60");
        assertThat(wardrobeRows(user.id())).as("C1 wardrobe rows").containsExactly("capOrange");
    }

    @Test
    void c2_clothAndFurnitureAtOnceDoNotOverspend() throws Exception {
        TestUser user = newUser("c2");
        setBalance(user, 100);

        List<HttpResponse<String>> responses = concurrently(List.of(
                () -> order(user.token(), "capOrange", 60),
                () -> order(user.token(), "frame", 70)));

        assertThat(statuses(responses)).as("C2 statuses %s", bodies(responses)).containsExactlyInAnyOrder(200, 409);
        assertThat(codesOfFailures(responses)).as("C2 failure code").containsExactly("NOT_ENOUGH_LOOP_POINTS");
        int balance = balanceRow(user.id());
        assertThat(balance).as("C2 balance").isIn(40, 30);
        assertThat(negativeAmounts(user.id())).as("C2 negative rows").hasSize(1);
        if (balance == 40) {
            assertThat(wardrobeRows(user.id())).as("C2 cap won: wardrobe rows").containsExactly("capOrange");
            assertThat(getLayout(user.token()).statusCode()).as("C2 cap won: no layout").isEqualTo(404);
        } else {
            assertThat(wardrobeRows(user.id())).as("C2 frame won: wardrobe rows").isEmpty();
            assertThat(storedIds(JSON.readTree(getLayout(user.token()).body()))).as("C2 frame won: stored").containsExactly("frame-1");
        }
    }

    // =====================================================================
    // G. 가구 주문
    // =====================================================================

    @Test
    void g1_furnitureOrderIsTheSameWithWardrobeNull() throws Exception {
        TestUser user = newUser("g1");
        setBalance(user, 300);

        HttpResponse<String> response = order(user.token(), "books", 40);

        assertThat(response.statusCode()).as("G1 order books 40, body %s", response.body()).isEqualTo(200);
        JsonNode body = JSON.readTree(response.body());
        assertThat(body.path("type").asText()).as("G1 type").isEqualTo("books");
        assertThat(body.path("price").asInt()).as("G1 price").isEqualTo(40);
        assertThat(body.path("balance").asInt()).as("G1 balance").isEqualTo(260);
        assertThat(body.path("owned").asInt()).as("G1 owned").isEqualTo(1);
        assertThat(body.path("itemId").asText()).as("G1 itemId").isEqualTo("books-1");
        ObjectNode expected = i0();
        expected.putArray("stored").add(stored("books-1", "books"));
        assertThat(body.path("layout")).as("G1 layout").isEqualTo(expected);
        assertThat(body.has("wardrobe") && body.get("wardrobe").isNull()).as("G1 wardrobe is null: %s", body).isTrue();
    }

    @Test
    void g2_furniturePriceStays() throws Exception {
        TestUser user = newUser("g2");
        setBalance(user, 1000);

        JsonNode body = JSON.readTree(assertOk(order(user.token(), "rug", 150), "G2").body());

        assertThat(body.path("price").asInt()).as("G2 price").isEqualTo(150);
    }

    @Test
    void g3_furnitureOrderDoesNotTouchTheWardrobe() throws Exception {
        TestUser user = newUser("g3");
        setBalance(user, 300);
        own(user, "capOrange", "2026-11-01T00:00:00Z");
        assertThat(putEquipped(user.token(), Map.of("hat", "capOrange")).statusCode()).as("G3 setup wear cap").isEqualTo(200);
        String before = getWardrobe(user.token()).body();

        assertOk(order(user.token(), "books", 40), "G3");

        assertThat(JSON.readTree(getWardrobe(user.token()).body())).as("G3 wardrobe").isEqualTo(JSON.readTree(before));
    }

    @Test
    void g4_furnitureOnItsBroadcastDay() throws Exception {
        TestUser user = newUser("g4");
        setBalance(user, 1000);
        at(LocalDate.of(2026, 11, 16));

        assertRejectedNothingChanged(user, body("bed", 300), 409, "PRICE_CHANGED", PRICE_CHANGED_MESSAGE, "G4 full price");
        HttpResponse<String> sale = order(user.token(), "bed", 240);

        assertThat(sale.statusCode()).as("G4 sale price, body %s", sale.body()).isEqualTo(200);
    }

    // =====================================================================
    // P. 회원 탈퇴
    // =====================================================================

    @Test
    void p1_accountDeletionRemovesOnlyThatUsersClothes() throws Exception {
        TestUser x = newUser("p1x");
        TestUser y = newUser("p1y");
        assertOk(order(x.token(), "capOrange", 60), "P1 X order");
        assertOk(order(y.token(), "capOrange", 60), "P1 Y order");
        assertThat(putEquipped(x.token(), Map.of("hat", "capOrange")).statusCode()).as("P1 X wear cap").isEqualTo(200);

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
        assertThat(rowsOf("wardrobe_items", x.id())).as("P1 X wardrobe items").isZero();
        assertThat(rowsOf("wardrobe_outfits", x.id())).as("P1 X outfit").isZero();
        assertThat(rowsOf("loop_point_entries", x.id())).as("P1 X ledger").isZero();
        assertThat(rowsOf("loop_point_balances", x.id())).as("P1 X balance").isZero();
        assertThat(rowsOf("home_shopping_orders", y.id())).as("P1 Y purchases").isEqualTo(1);
        assertThat(rowsOf("wardrobe_items", y.id())).as("P1 Y wardrobe items").isEqualTo(1);
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

    /** 주문 결과의 wardrobe와 GET /api/wardrobe가 같다(종류·부위·순서·입은 것은 그대로, acquiredAt은 1ms 미만 차이까지). */
    private static void assertSameWardrobe(JsonNode fromOrder, JsonNode fromGet, String label) {
        assertThat(typesAndSlots(fromOrder)).as("%s items", label).containsExactlyElementsOf(typesAndSlots(fromGet));
        assertThat(fromOrder.path("equipped")).as("%s equipped", label).isEqualTo(fromGet.path("equipped"));
        for (int i = 0; i < fromGet.path("items").size(); i++) {
            Instant a = Instant.parse(fromOrder.path("items").get(i).path("acquiredAt").asText());
            Instant b = Instant.parse(fromGet.path("items").get(i).path("acquiredAt").asText());
            assertThat(Duration.between(a, b).abs()).as("%s acquiredAt %d (%s vs %s)", label, i, a, b)
                    .isLessThan(Duration.ofMillis(1));
        }
    }

    /** 실패하고 NC. code·message가 null이면 키가 있는지만 본다. */
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

    private record Snapshot(
            Integer balance,
            List<Integer> negativeAmounts,
            List<String> purchases,
            List<String> wardrobeRowsWithTime,
            JsonNode wardrobe,
            int layoutStatus,
            JsonNode layout) {
    }

    private Snapshot snapshot(TestUser user) throws Exception {
        HttpResponse<String> layout = getLayout(user.token());
        HttpResponse<String> wardrobe = getWardrobe(user.token());
        assertThat(wardrobe.statusCode()).as("snapshot GET /api/wardrobe, body %s", wardrobe.body()).isEqualTo(200);
        return new Snapshot(
                balanceRowOrNull(user.id()),
                negativeAmounts(user.id()),
                purchases(user.id()),
                jdbc.queryForList(
                        "SELECT CONCAT(item_type, '@', acquired_at) FROM wardrobe_items WHERE user_id = ? ORDER BY id",
                        String.class, user.id()),
                JSON.readTree(wardrobe.body()),
                layout.statusCode(),
                layout.statusCode() == 200 ? JSON.readTree(layout.body()) : null);
    }

    // =====================================================================
    // 도움 함수: 목록·옷장
    // =====================================================================

    private static List<String> typesOf(JsonNode items) {
        List<String> types = new ArrayList<>();
        items.forEach(item -> types.add(item.path("type").asText()));
        return types;
    }

    private static JsonNode itemOf(JsonNode shopBody, String type) {
        for (JsonNode item : shopBody.path("items")) {
            if (item.path("type").asText().equals(type)) {
                return item;
            }
        }
        throw new AssertionError("no item " + type + " in " + shopBody);
    }

    /** 그날 그 상품을 살 가격(방송 상품이면 할인가). */
    private static int todayPriceOf(JsonNode shopBody, String type) {
        JsonNode item = itemOf(shopBody, type);
        return item.get("salePrice").isNull() ? item.path("price").asInt() : item.path("salePrice").asInt();
    }

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

    private static List<String> typesAndSlots(JsonNode wardrobe) {
        List<String> list = new ArrayList<>();
        wardrobe.path("items").forEach(item -> list.add(item.path("type").asText() + "/" + item.path("slot").asText()));
        return list;
    }

    private static JsonNode itemIn(JsonNode wardrobe, String type) {
        for (JsonNode item : wardrobe.path("items")) {
            if (item.path("type").asText().equals(type)) {
                return item;
            }
        }
        throw new AssertionError("no wardrobe item " + type + " in " + wardrobe);
    }

    /** 일곱 부위의 입은 것(주지 않은 부위는 null). */
    private static ObjectNode equipped(Map<String, String> worn) {
        ObjectNode node = JSON.createObjectNode();
        for (String slot : List.of("hat", "top", "bottom", "shoes", "face", "back", "accessory")) {
            String type = worn.get(slot);
            if (type == null) {
                node.putNull(slot);
            } else {
                node.put(slot, type);
            }
        }
        return node;
    }

    private void own(TestUser user, String type, String acquiredAt) {
        wardrobeItemRepository.saveAndFlush(new WardrobeItemEntity(user.id(), type, Instant.parse(acquiredAt)));
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

    /** 배치 검사를 거치지 않고 저장된 배치를 넣는다(shape_version 2). */
    private void insertLayout(long userId, ObjectNode layout) throws Exception {
        ObjectNode stored = layout.deepCopy();
        stored.remove("version");
        jdbc.update(
                "INSERT INTO lobby_layouts (user_id, shape_version, layout_json, created_at, updated_at) VALUES (?, 2, ?, NOW(6), NOW(6))",
                userId, JSON.writeValueAsString(stored));
    }

    // =====================================================================
    // 도움 함수: 잔액·DB
    // =====================================================================

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

    /** 주문 기록 "종류:가격" 목록(주문 순서). */
    private List<String> purchases(long userId) {
        return jdbc.queryForList(
                "SELECT CONCAT(furniture_type, ':', price) FROM home_shopping_orders WHERE user_id = ? ORDER BY id", String.class, userId);
    }

    private List<String> wardrobeRows(long userId) {
        return jdbc.queryForList("SELECT item_type FROM wardrobe_items WHERE user_id = ? ORDER BY id", String.class, userId);
    }

    private int rowsOf(String table, long userId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM " + table + " WHERE user_id = ?", Integer.class, userId);
    }

    /** 표 이름을 잠깐 바꿔 그 표를 쓰는 단계만 실제 DB 오류로 실패하게 하고, 끝나면 되돌린다. */
    private <V> V withRenamedTable(String table, Callable<V> action) throws Exception {
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

    private static List<HttpResponse<String>> concurrently(List<Callable<HttpResponse<String>>> calls) throws Exception {
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(calls.size());
        try {
            List<Future<HttpResponse<String>>> futures = new ArrayList<>();
            for (Callable<HttpResponse<String>> call : calls) {
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

    private static List<String> codesOfFailures(List<HttpResponse<String>> responses) throws Exception {
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
        String email = "qa-089c-" + tag + "-" + suffix + "@example.com";
        String password = "qa-pass-" + suffix;
        jdbc.update(
                "INSERT INTO users (email, password_hash, display_name, email_verified, verified_at) VALUES (?, ?, ?, 1, NOW())",
                email, passwordEncoder.encode(password), "qa-089c-" + tag + "-" + suffix);
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

    private HttpResponse<String> getWardrobe(String token) throws Exception {
        return client.send(authed(HttpRequest.newBuilder(uri("/api/wardrobe")).GET(), token).build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> putEquipped(String token, Map<String, String> worn) throws Exception {
        return client.send(authed(HttpRequest.newBuilder(uri("/api/wardrobe/equipped"))
                        .header("Content-Type", "application/json")
                        .PUT(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(equipped(worn)))), token).build(),
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
