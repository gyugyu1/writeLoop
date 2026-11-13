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
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * [spec] 작업 089 ⑤ 아이템 늘리기, 백엔드. 시나리오 07-아이템-늘리기/02-qa-scenarios.md의 H(목록 스물여섯), B(방송 epochDay % 26),
 * O(새 옷 주문), E(새 옷 주문 실패), K·G(방 배치와 가구 그대로), P(회원 탈퇴)를 실제 서버로 확인한다.
 *
 * <ul>
 *   <li>로그인은 토큰 로그인(Bearer). 테스트마다 새 사용자를 만든다.</li>
 *   <li>서버 서울 날짜는 테스트용 시계 빈으로 고정한다(기본 T = 2026-11-16 서울 정오, 방송 상품 bed, 옷 열여섯은 모두 정가).</li>
 *   <li>잔액은 GET /api/loop-points로 잔액 행을 만든 뒤 jdbc로 바꾼다. 가진 옷은 WardrobeItemRepository로 직접 넣는다.</li>
 *   <li>NC(아무것도 바뀌지 않음): 잔액 행, 장부 음수 줄, 주문 기록, 가진 옷, GET /api/wardrobe 본문,
 *       GET /api/lobby-layout(상태와 본문)이 요청 전후로 같다.</li>
 * </ul>
 */
class HomeShoppingMoreClothesSpecTest extends IntegrationTestSupport {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final AtomicReference<Instant> FIXED_NOW = new AtomicReference<>();

    private static final String PRICE_CHANGED_MESSAGE = "가격이 바뀌었어요. 다시 확인해 주세요.";
    private static final String NOT_ENOUGH_MESSAGE = "룹이 모자라요.";
    private static final String ALREADY_OWNED_MESSAGE = "이미 가진 옷이에요.";

    /** 기본 날짜 T: 방송 상품 bed. */
    private static final LocalDate T = LocalDate.of(2026, 11, 16);

    /** 가격표 스물여섯(시나리오 표), 이 순서가 목록 순서다. */
    private static final List<String> TYPES = List.of(
            "books", "smallPlant", "lamp", "capOrange", "capBlue", "capGreen", "frame", "shortsNavy", "shortsBrown", "shortsRed",
            "plant", "tshirtOrange", "tshirtWhite", "tshirtYellow", "shoesBrown", "shoesRed", "shoesWhite", "mufflerRed",
            "nightstand", "sunglassesBlack", "floorLamp", "necklaceGold", "backpackRed", "rug", "wardrobe", "bed");
    private static final List<Integer> PRICES = List.of(
            40, 50, 60, 60, 60, 60, 70, 70, 70, 70, 80, 80, 80, 80, 90, 90, 90, 90, 100, 100, 110, 110, 120, 150, 180, 300);
    private static final List<Integer> SALE_PRICES = List.of(
            32, 40, 48, 48, 48, 48, 56, 56, 56, 56, 64, 64, 64, 64, 72, 72, 72, 72, 80, 80, 88, 88, 96, 120, 144, 240);

    /** 방송 날짜표의 첫날(epochDay % 26 == 0, books). */
    private static final LocalDate FIRST_DAY = LocalDate.of(2026, 10, 22);

    private static final List<String> OLD_CLOTHES = List.of("capOrange", "tshirtOrange", "shortsNavy", "shoesBrown");

    /** 새 열둘(명세 1의 표 순서): 종류, 부위, 가격. */
    private static final List<Object[]> NEW_TWELVE = List.of(
            new Object[] {"capBlue", "hat", 60},
            new Object[] {"capGreen", "hat", 60},
            new Object[] {"tshirtWhite", "top", 80},
            new Object[] {"tshirtYellow", "top", 80},
            new Object[] {"shortsBrown", "bottom", 70},
            new Object[] {"shortsRed", "bottom", 70},
            new Object[] {"shoesRed", "shoes", 90},
            new Object[] {"shoesWhite", "shoes", 90},
            new Object[] {"sunglassesBlack", "face", 100},
            new Object[] {"backpackRed", "back", 120},
            new Object[] {"mufflerRed", "accessory", 90},
            new Object[] {"necklaceGold", "accessory", 110});

    private static final List<String> FURNITURE = List.of(
            "books", "smallPlant", "lamp", "frame", "plant", "nightstand", "floorLamp", "rug", "wardrobe", "bed");

    @TestConfiguration
    static class ClockConfig {
        @Bean
        Clock homeShoppingMoreClothesSpecClock() {
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
    // H. 목록
    // =====================================================================

    @Test
    void h1_h2_twentySixItemsInOrderWithOneSale() throws Exception {
        TestUser user = newUser("h1");

        HttpResponse<String> response = shop(user.token());

        assertThat(response.statusCode()).as("H1 GET, body %s", response.body()).isEqualTo(200);
        JsonNode body = JSON.readTree(response.body());
        JsonNode items = body.path("items");
        assertThat(items.size()).as("H1 items count").isEqualTo(26);
        assertThat(typesOf(items)).as("H1 item types in order").containsExactlyElementsOf(TYPES);
        for (int i = 0; i < 26; i++) {
            assertThat(items.get(i).path("price").asInt()).as("H1 price of %s", TYPES.get(i)).isEqualTo(PRICES.get(i));
        }
        // H2
        assertBroadcast(body, "bed", 300, 240, "H2");
        for (int i = 0; i < 26; i++) {
            JsonNode item = items.get(i);
            if (TYPES.get(i).equals("bed")) {
                assertThat(item.path("salePrice").asInt()).as("H2 salePrice of bed").isEqualTo(240);
            } else {
                assertThat(item.has("salePrice") && item.get("salePrice").isNull())
                        .as("H2 salePrice of %s is null: %s", TYPES.get(i), item).isTrue();
            }
        }
    }

    @Test
    void h3_newUserOwnsNoneOfTheSixteenClothes() throws Exception {
        TestUser user = newUser("h3");

        JsonNode body = JSON.readTree(shop(user.token()).body());

        assertThat(ownedMap(body)).as("H3 owned").isEqualTo(owned(Map.of("wardrobe", 1, "rug", 1, "lamp", 1)));
        int withOwnedKey = 0;
        for (JsonNode item : body.path("items")) {
            if (item.has("owned")) {
                withOwnedKey++;
            }
        }
        assertThat(withOwnedKey).as("H3 items with an owned key").isEqualTo(26);
    }

    @Test
    void h4_newClothesInTheWardrobeAreOwned() throws Exception {
        TestUser user = newUser("h4");
        own(user, "sunglassesBlack", "2026-11-01T00:00:00Z");
        own(user, "mufflerRed", "2026-11-01T00:01:00Z");
        own(user, "capBlue", "2026-11-01T00:02:00Z");

        JsonNode body = JSON.readTree(shop(user.token()).body());

        assertThat(ownedMap(body)).as("H4 owned").isEqualTo(owned(Map.of(
                "sunglassesBlack", 1, "mufflerRed", 1, "capBlue", 1, "wardrobe", 1, "rug", 1, "lamp", 1)));
    }

    @Test
    void h5_boughtNewClothIsOwnedOnce() throws Exception {
        TestUser user = newUser("h5");
        setBalance(user, 1000);
        assertOk(order(user.token(), "necklaceGold", 110), "H5 order");

        JsonNode body = JSON.readTree(shop(user.token()).body());

        assertThat(ownedMap(body)).as("H5 owned").isEqualTo(owned(Map.of("necklaceGold", 1, "wardrobe", 1, "rug", 1, "lamp", 1)));
        assertThat(body.path("balance").asInt()).as("H5 balance").isEqualTo(890);
    }

    // =====================================================================
    // B. 오늘의 방송(epochDay % 26)
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
    void b2_wrapsAroundBothWays() throws Exception {
        TestUser user = newUser("b2");

        at(LocalDate.of(2026, 11, 17));
        assertBroadcast(JSON.readTree(shop(user.token()).body()), "books", 40, 32, "B2 11-17");
        at(LocalDate.of(2026, 10, 21));
        assertBroadcast(JSON.readTree(shop(user.token()).body()), "bed", 300, 240, "B2 10-21");
    }

    @Test
    void b3_newClothesOnAir() throws Exception {
        TestUser user = newUser("b3");

        at(LocalDate.of(2026, 11, 10));
        assertBroadcast(JSON.readTree(shop(user.token()).body()), "sunglassesBlack", 100, 80, "B3 11-10");
        at(LocalDate.of(2026, 11, 13));
        assertBroadcast(JSON.readTree(shop(user.token()).body()), "backpackRed", 120, 96, "B3 11-13");
        at(LocalDate.of(2026, 11, 12));
        assertBroadcast(JSON.readTree(shop(user.token()).body()), "necklaceGold", 110, 88, "B3 11-12");
        at(LocalDate.of(2026, 11, 8));
        assertBroadcast(JSON.readTree(shop(user.token()).body()), "mufflerRed", 90, 72, "B3 11-08");
    }

    @Test
    void b4_onlyOneOfTheSamePricedItemsIsOnSale() throws Exception {
        TestUser user = newUser("b4");
        at(LocalDate.of(2026, 10, 26));

        JsonNode body = JSON.readTree(shop(user.token()).body());

        assertBroadcast(body, "capBlue", 60, 48, "B4");
        assertThat(itemOf(body, "capBlue").path("salePrice").asInt()).as("B4 capBlue salePrice").isEqualTo(48);
        for (String other : List.of("lamp", "capOrange", "capGreen")) {
            assertThat(itemOf(body, other).get("salePrice").isNull()).as("B4 %s salePrice is null", other).isTrue();
        }
    }

    @Test
    void b5_seoulMidnightSplitsTheBroadcast() throws Exception {
        TestUser user = newUser("b5");

        FIXED_NOW.set(Instant.parse("2026-11-12T14:59:59Z"));
        JsonNode before = JSON.readTree(shop(user.token()).body());
        FIXED_NOW.set(Instant.parse("2026-11-12T15:00:00Z"));
        JsonNode after = JSON.readTree(shop(user.token()).body());

        assertBroadcast(before, "necklaceGold", 110, 88, "B5 before");
        assertBroadcast(after, "backpackRed", 120, 96, "B5 after");
    }

    // =====================================================================
    // O. 새 옷 주문 성공
    // =====================================================================

    @Test
    void o1_o2_orderSunglasses() throws Exception {
        TestUser user = newUser("o1");
        setBalance(user, 300);

        HttpResponse<String> response = order(user.token(), "sunglassesBlack", 100);

        assertThat(response.statusCode()).as("O1 order, body %s", response.body()).isEqualTo(200);
        JsonNode body = JSON.readTree(response.body());
        assertThat(body.path("type").asText()).as("O1 type").isEqualTo("sunglassesBlack");
        assertThat(body.path("price").asInt()).as("O1 price").isEqualTo(100);
        assertThat(body.path("balance").asInt()).as("O1 balance").isEqualTo(200);
        assertThat(body.path("owned").asInt()).as("O1 owned").isEqualTo(1);
        assertThat(body.has("itemId") && body.get("itemId").isNull()).as("O1 itemId is null: %s", body).isTrue();
        assertThat(body.has("layout") && body.get("layout").isNull()).as("O1 layout is null: %s", body).isTrue();
        JsonNode wardrobe = body.path("wardrobe");
        assertThat(typesAndSlots(wardrobe)).as("O1 wardrobe items").containsExactly("sunglassesBlack/face");
        assertThat(wardrobe.path("equipped")).as("O1 equipped").isEqualTo(equipped(Map.of()));

        // O2
        assertThat(balanceRow(user.id())).as("O2 balance row").isEqualTo(200);
        assertThat(negativeAmounts(user.id())).as("O2 negative rows").containsExactly(-100);
        assertThat(purchases(user.id())).as("O2 purchases").containsExactly("sunglassesBlack:100");
        assertThat(wardrobeRows(user.id())).as("O2 wardrobe rows").containsExactly("sunglassesBlack");
        HttpResponse<String> get = getWardrobe(user.token());
        assertThat(get.statusCode()).as("O2 GET /api/wardrobe").isEqualTo(200);
        assertSameWardrobe(wardrobe, JSON.readTree(get.body()), "O2");
    }

    @Test
    void o3_eachNewItemAtItsPriceIntoItsSlot() throws Exception {
        for (Object[] row : NEW_TWELVE) {
            String type = (String) row[0];
            String slot = (String) row[1];
            int price = (Integer) row[2];
            TestUser user = newUser("o3-" + type.toLowerCase());
            setBalance(user, 1000);

            HttpResponse<String> response = order(user.token(), type, price);

            assertThat(response.statusCode()).as("O3 %s %d, body %s", type, price, response.body()).isEqualTo(200);
            JsonNode body = JSON.readTree(response.body());
            assertThat(body.path("price").asInt()).as("O3 %s price", type).isEqualTo(price);
            assertThat(body.path("balance").asInt()).as("O3 %s balance", type).isEqualTo(1000 - price);
            assertThat(body.path("owned").asInt()).as("O3 %s owned", type).isEqualTo(1);
            assertThat(typesAndSlots(body.path("wardrobe"))).as("O3 %s wardrobe items", type).containsExactly(type + "/" + slot);
        }
    }

    @Test
    void o4_allTwelveInOneAccount() throws Exception {
        TestUser user = newUser("o4");
        setBalance(user, 2000);
        JsonNode last = null;
        List<String> expected = new ArrayList<>();
        for (Object[] row : NEW_TWELVE) {
            last = JSON.readTree(assertOk(order(user.token(), (String) row[0], (Integer) row[2]), "O4 " + row[0]).body());
            expected.add(row[0] + "/" + row[1]);
        }

        assertThat(last.path("balance").asInt()).as("O4 balance").isEqualTo(980);
        assertThat(typesAndSlots(last.path("wardrobe"))).as("O4 wardrobe items").containsExactlyElementsOf(expected);
        assertThat(last.path("wardrobe").path("equipped")).as("O4 equipped").isEqualTo(equipped(Map.of()));
        Map<String, Integer> owned = ownedMap(JSON.readTree(shop(user.token()).body()));
        for (Object[] row : NEW_TWELVE) {
            assertThat(owned.get((String) row[0])).as("O4 %s owned", row[0]).isEqualTo(1);
        }
        for (String old : OLD_CLOTHES) {
            assertThat(owned.get(old)).as("O4 %s owned", old).isEqualTo(0);
        }
        // G3: 새 옷을 산 것이 가구 가진 개수를 바꾸지 않는다
        Map<String, Integer> furniture = new LinkedHashMap<>();
        FURNITURE.forEach(type -> furniture.put(type, owned.get(type)));
        Map<String, Integer> expectedFurniture = new LinkedHashMap<>();
        FURNITURE.forEach(type -> expectedFurniture.put(type, List.of("wardrobe", "rug", "lamp").contains(type) ? 1 : 0));
        assertThat(furniture).as("G3 furniture owned").isEqualTo(expectedFurniture);
    }

    @Test
    void o5_otherColorsOfTheSameSlotAreSeparate() throws Exception {
        TestUser user = newUser("o5");
        setBalance(user, 1000);
        own(user, "capOrange", "2026-11-01T00:00:00Z");

        assertOk(order(user.token(), "capBlue", 60), "O5 capBlue");
        JsonNode last = JSON.readTree(assertOk(order(user.token(), "capGreen", 60), "O5 capGreen").body());

        assertThat(typesAndSlots(last.path("wardrobe"))).as("O5 wardrobe items")
                .containsExactly("capOrange/hat", "capBlue/hat", "capGreen/hat");
    }

    @Test
    void o6_orderDoesNotChangeWhatIsWornInTheSameSlot() throws Exception {
        TestUser user = newUser("o6");
        setBalance(user, 300);
        own(user, "capOrange", "2026-11-01T00:00:00Z");
        assertThat(putEquipped(user.token(), Map.of("hat", "capOrange")).statusCode()).as("O6 setup wear cap").isEqualTo(200);

        JsonNode body = JSON.readTree(assertOk(order(user.token(), "capBlue", 60), "O6").body());

        assertThat(body.path("wardrobe").path("equipped")).as("O6 response equipped").isEqualTo(equipped(Map.of("hat", "capOrange")));
        assertThat(JSON.readTree(getWardrobe(user.token()).body()).path("equipped")).as("O6 GET equipped")
                .isEqualTo(equipped(Map.of("hat", "capOrange")));
    }

    @Test
    void o7_orderDoesNotWearANewSlot() throws Exception {
        TestUser user = newUser("o7");
        setBalance(user, 300);

        JsonNode body = JSON.readTree(assertOk(order(user.token(), "backpackRed", 120), "O7").body());

        assertThat(body.path("wardrobe").path("equipped")).as("O7 equipped").isEqualTo(equipped(Map.of()));
    }

    @Test
    void o8_newClothOnAirIsSoldAtTheSalePrice() throws Exception {
        TestUser user = newUser("o8");
        setBalance(user, 300);
        at(LocalDate.of(2026, 11, 13));

        JsonNode body = JSON.readTree(assertOk(order(user.token(), "backpackRed", 96), "O8").body());

        assertThat(body.path("price").asInt()).as("O8 price").isEqualTo(96);
        assertThat(body.path("balance").asInt()).as("O8 balance").isEqualTo(204);
        assertThat(purchases(user.id())).as("O8 purchases").containsExactly("backpackRed:96");
        assertThat(negativeAmounts(user.id())).as("O8 negative rows").containsExactly(-96);
    }

    @Test
    void o9_balanceExactlyThePrice() throws Exception {
        TestUser user = newUser("o9");
        setBalance(user, 120);

        JsonNode body = JSON.readTree(assertOk(order(user.token(), "backpackRed", 120), "O9").body());

        assertThat(body.path("balance").asInt()).as("O9 balance").isEqualTo(0);
    }

    @Test
    void o10_boughtNewClothCanBeWorn() throws Exception {
        TestUser user = newUser("o10");
        setBalance(user, 300);
        assertOk(order(user.token(), "sunglassesBlack", 100), "O10 order");

        HttpResponse<String> response = putEquipped(user.token(), Map.of("face", "sunglassesBlack"));

        assertThat(response.statusCode()).as("O10 PUT, body %s", response.body()).isEqualTo(200);
        assertThat(JSON.readTree(response.body()).path("equipped")).as("O10 equipped").isEqualTo(equipped(Map.of("face", "sunglassesBlack")));
    }

    @Test
    void o11_theOldFourStayTheSame() throws Exception {
        TestUser user = newUser("o11");
        setBalance(user, 1000);
        int[] prices = {60, 80, 70, 90};
        JsonNode last = null;
        for (int i = 0; i < 4; i++) {
            last = JSON.readTree(assertOk(order(user.token(), OLD_CLOTHES.get(i), prices[i]), "O11 " + OLD_CLOTHES.get(i)).body());
            assertThat(last.path("price").asInt()).as("O11 %s price", OLD_CLOTHES.get(i)).isEqualTo(prices[i]);
        }

        assertThat(last.path("balance").asInt()).as("O11 balance").isEqualTo(700);
        assertThat(typesAndSlots(last.path("wardrobe"))).as("O11 wardrobe items")
                .containsExactly("capOrange/hat", "tshirtOrange/top", "shortsNavy/bottom", "shoesBrown/shoes");
    }

    // =====================================================================
    // E. 새 옷 주문 실패
    // =====================================================================

    @Test
    void e1_alreadyOwnedNewCloth() throws Exception {
        TestUser user = newUser("e1");
        setBalance(user, 300);
        own(user, "mufflerRed", "2026-11-01T00:00:00Z");

        assertRejectedNothingChanged(user, body("mufflerRed", 90), 409, "ALREADY_OWNED", ALREADY_OWNED_MESSAGE, "E1");
    }

    @Test
    void e2_buyingTheSameNewClothAgain() throws Exception {
        TestUser user = newUser("e2");
        setBalance(user, 300);
        assertOk(order(user.token(), "sunglassesBlack", 100), "E2 first");

        assertRejectedNothingChanged(user, body("sunglassesBlack", 100), 409, "ALREADY_OWNED", ALREADY_OWNED_MESSAGE, "E2 second");
        assertThat(balanceRow(user.id())).as("E2 balance").isEqualTo(200);
        assertThat(purchases(user.id())).as("E2 purchases").containsExactly("sunglassesBlack:100");
    }

    @Test
    void e3_wrongPriceForANewCloth() throws Exception {
        TestUser user = newUser("e3");
        setBalance(user, 1000);

        assertRejectedNothingChanged(user, body("sunglassesBlack", 80), 409, "PRICE_CHANGED", PRICE_CHANGED_MESSAGE, "E3 sunglasses 80");
        assertRejectedNothingChanged(user, body("sunglassesBlack", 99), 409, "PRICE_CHANGED", PRICE_CHANGED_MESSAGE, "E3 sunglasses 99");
        assertRejectedNothingChanged(user, body("backpackRed", 100), 409, "PRICE_CHANGED", PRICE_CHANGED_MESSAGE, "E3 backpack 100");
        assertRejectedNothingChanged(user, body("necklaceGold", 90), 409, "PRICE_CHANGED", PRICE_CHANGED_MESSAGE, "E3 necklace 90");
    }

    @Test
    void e4_fullPriceOnTheNewClothsBroadcastDay() throws Exception {
        TestUser user = newUser("e4");
        setBalance(user, 1000);
        at(LocalDate.of(2026, 11, 13));

        assertRejectedNothingChanged(user, body("backpackRed", 120), 409, "PRICE_CHANGED", PRICE_CHANGED_MESSAGE, "E4");
    }

    @Test
    void e5_newClothSaleEndsWhenTheDateChanges() throws Exception {
        TestUser user = newUser("e5");
        setBalance(user, 1000);
        at(LocalDate.of(2026, 11, 10));
        assertThat(itemOf(JSON.readTree(shop(user.token()).body()), "sunglassesBlack").path("salePrice").asInt())
                .as("E5 setup sunglassesBlack salePrice on 11-10").isEqualTo(80);
        at(LocalDate.of(2026, 11, 11));

        assertRejectedNothingChanged(user, body("sunglassesBlack", 80), 409, "PRICE_CHANGED", PRICE_CHANGED_MESSAGE, "E5 old sale price");
        HttpResponse<String> fullPrice = order(user.token(), "sunglassesBlack", 100);

        assertThat(fullPrice.statusCode()).as("E5 full price, body %s", fullPrice.body()).isEqualTo(200);
    }

    @Test
    void e6_notEnoughLoopPointsForANewCloth() throws Exception {
        TestUser user = newUser("e6");
        setBalance(user, 119);

        assertRejectedNothingChanged(user, body("backpackRed", 120), 409, "NOT_ENOUGH_LOOP_POINTS", NOT_ENOUGH_MESSAGE, "E6");
        assertThat(balanceRow(user.id())).as("E6 balance").isEqualTo(119);
    }

    @Test
    void e7_errorOrderForANewCloth() throws Exception {
        TestUser owner = newUser("e7o");
        setBalance(owner, 0);
        own(owner, "necklaceGold", "2026-11-01T00:00:00Z");
        TestUser buyer = newUser("e7b");
        setBalance(buyer, 0);

        assertRejectedNothingChanged(owner, body("necklaceGold", 1), 409, "ALREADY_OWNED", ALREADY_OWNED_MESSAGE, "E7 owned");
        assertRejectedNothingChanged(buyer, body("necklaceGold", 1), 409, "PRICE_CHANGED", PRICE_CHANGED_MESSAGE, "E7 not owned");
    }

    @Test
    void e8_unsoldKinds() throws Exception {
        TestUser user = newUser("e8");
        setBalance(user, 1000);

        assertRejectedNothingChanged(user, body("sunglasses", 100), 400, null, null, "E8 sunglasses");
        assertRejectedNothingChanged(user, body("glassesRound", 100), 400, null, null, "E8 glassesRound");
        assertRejectedNothingChanged(user, body("capRed", 60), 400, null, null, "E8 capRed");
    }

    // =====================================================================
    // K·G. 방 배치와 가구 그대로
    // =====================================================================

    @Test
    void k1_newClothOrderDoesNotCreateALayout() throws Exception {
        TestUser user = newUser("k1");
        setBalance(user, 300);

        JsonNode body = JSON.readTree(assertOk(order(user.token(), "mufflerRed", 90), "K1").body());

        assertThat(body.has("layout") && body.get("layout").isNull()).as("K1 layout is null: %s", body).isTrue();
        assertThat(getLayout(user.token()).statusCode()).as("K1 GET lobby-layout").isEqualTo(404);
    }

    @Test
    void k2_newClothOrderDoesNotTouchTheSavedLayout() throws Exception {
        TestUser user = newUser("k2");
        setBalance(user, 300);
        assertThat(putLayout(user.token(), i0()).statusCode()).as("K2 setup save").isEqualTo(200);
        JsonNode before = JSON.readTree(getLayout(user.token()).body());

        assertOk(order(user.token(), "necklaceGold", 110), "K2");

        HttpResponse<String> after = getLayout(user.token());
        assertThat(after.statusCode()).as("K2 GET lobby-layout").isEqualTo(200);
        assertThat(JSON.readTree(after.body())).as("K2 layout").isEqualTo(before);
    }

    @Test
    void g1_furnitureOrderIsTheSame() throws Exception {
        TestUser user = newUser("g1");
        setBalance(user, 300);

        HttpResponse<String> response = order(user.token(), "books", 40);

        assertThat(response.statusCode()).as("G1 order books 40, body %s", response.body()).isEqualTo(200);
        JsonNode body = JSON.readTree(response.body());
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
    void g2_furnitureBroadcastOnT() throws Exception {
        TestUser user = newUser("g2");
        setBalance(user, 1000);

        assertRejectedNothingChanged(user, body("bed", 300), 409, "PRICE_CHANGED", PRICE_CHANGED_MESSAGE, "G2 full price");
        JsonNode sale = JSON.readTree(assertOk(order(user.token(), "bed", 240), "G2 sale price").body());

        assertThat(sale.path("price").asInt()).as("G2 price").isEqualTo(240);
    }

    // =====================================================================
    // P. 회원 탈퇴
    // =====================================================================

    @Test
    void p1_accountDeletionRemovesNewSlotItems() throws Exception {
        TestUser x = newUser("p1x");
        TestUser y = newUser("p1y");
        setBalance(x, 1000);
        setBalance(y, 1000);
        assertOk(order(x.token(), "sunglassesBlack", 100), "P1 X sunglasses");
        assertOk(order(x.token(), "backpackRed", 120), "P1 X backpack");
        assertOk(order(x.token(), "necklaceGold", 110), "P1 X necklace");
        assertOk(order(y.token(), "backpackRed", 120), "P1 Y backpack");
        assertThat(putEquipped(x.token(), Map.of("face", "sunglassesBlack", "back", "backpackRed", "accessory", "necklaceGold")).statusCode())
                .as("P1 X wears three").isEqualTo(200);

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

    /** 주문 결과의 wardrobe와 GET /api/wardrobe가 같다(acquiredAt은 1ms 미만 차이까지). */
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

    // =====================================================================
    // 도움 함수: 잔액·DB
    // =====================================================================

    private void setBalance(TestUser user, int balance) throws Exception {
        assertThat(loopPoints(user.token()).statusCode()).as("setup: create the balance row").isEqualTo(200);
        jdbc.update("UPDATE loop_point_balances SET balance = ? WHERE user_id = ?", balance, user.id());
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

    private static void at(LocalDate seoulDate) {
        FIXED_NOW.set(seoulDate.atTime(LocalTime.NOON).atZone(SEOUL).toInstant());
    }

    // =====================================================================
    // 도움 함수: 사용자·요청
    // =====================================================================

    private record TestUser(long id, String email, String password, String token) {
    }

    private TestUser newUser(String tag) throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        String email = "qa-089m-" + tag + "-" + suffix + "@example.com";
        String password = "qa-pass-" + suffix;
        jdbc.update(
                "INSERT INTO users (email, password_hash, display_name, email_verified, verified_at) VALUES (?, ?, ?, 1, NOW())",
                email, passwordEncoder.encode(password), "qa-089m-" + tag + "-" + suffix);
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
