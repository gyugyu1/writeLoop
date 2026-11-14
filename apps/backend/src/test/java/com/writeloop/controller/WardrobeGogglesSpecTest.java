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
 * [spec] 작업 089 ⑤ 라룹이 고글, 백엔드. 시나리오 07-아이템-늘리기/09-qa-scenarios.md(G, Q, S, P)와
 * 결정 08(사용자: 고글은 얼굴장식 아이템, 모두 처음부터 가지고 입은 채 시작, 팔지 않음), 11 B, 12 A
 * (09-1: wardrobe_items의 goggles 행은 무시, 09-2: 얼굴장식을 비워 저장한 계정은 맨얼굴)를 실제 서버로 확인한다.
 * 고글을 머리 뼈에 붙는 착용 모델로 바꾼 22 결정에서도 서버 동작은 그대로다(23-qa-scenarios "09 전부 그대로 쓴다").
 * 기대값은 위 시나리오·결정에서만 가져왔고, 구현은 HTTP로만 부른다(구현 이름을 가정하지 않는다).
 *
 * <ul>
 *   <li>로그인은 토큰 로그인(Bearer). 테스트마다 새 사용자를 만들고, users.created_at을 C = 2026-11-01T00:00:00Z로 정해 둔다.</li>
 *   <li>G = {goggles, face, C}. E0 = 저장한 적 없는 입은 것(face만 goggles).</li>
 *   <li>홈쇼핑 날짜는 시계 빈으로 고정한다(T = 2026-11-16 서울 정오, 방송 상품 bed).</li>
 *   <li>WNC: 요청 전후로 GET /api/wardrobe 본문과 wardrobe_outfits의 그 계정 줄이 같다.</li>
 * </ul>
 */
class WardrobeGogglesSpecTest extends IntegrationTestSupport {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final AtomicReference<Instant> FIXED_NOW = new AtomicReference<>();

    private static final List<String> SLOTS = List.of("hat", "top", "bottom", "shoes", "face", "back", "accessory");

    /** C = 2026-11-01T00:00:00Z(계정을 만든 때). */
    private static final long C_EPOCH = 1793491200L;
    private static final String C = "2026-11-01T00:00:00Z";
    /** 2026-11-02T00:00:00Z. */
    private static final long C2_EPOCH = 1793577600L;

    private static final LocalDate T = LocalDate.of(2026, 11, 16);

    @TestConfiguration
    static class ClockConfig {
        @Bean
        Clock wardrobeGogglesSpecClock() {
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
        FIXED_NOW.set(T.atTime(LocalTime.NOON).atZone(SEOUL).toInstant());
    }

    @AfterEach
    void restoreClock() {
        FIXED_NOW.set(null);
    }

    // =====================================================================
    // G. GET /api/wardrobe
    // =====================================================================

    @Test
    void g1_newAccountOwnsAndWearsGoggles() throws Exception {
        TestUser u = newUser("g1");

        assertOkBody(get(u.token()), wardrobe(items(g()), e0()), "G1");
    }

    @Test
    void g2_gogglesAcquiredWhenTheAccountWasCreated() throws Exception {
        TestUser x = newUser("g2x");
        TestUser y = newUser("g2y");
        setCreatedAt(y, C2_EPOCH);

        JsonNode xFirst = JSON.readTree(get(x.token()).body()).path("items").get(0);
        JsonNode yFirst = JSON.readTree(get(y.token()).body()).path("items").get(0);

        assertThat(xFirst.path("type").asText()).as("G2 X type").isEqualTo("goggles");
        assertThat(xFirst.path("slot").asText()).as("G2 X slot").isEqualTo("face");
        assertThat(xFirst.path("acquiredAt").asText()).as("G2 X acquiredAt").isEqualTo("2026-11-01T00:00:00Z");
        assertThat(yFirst.path("type").asText()).as("G2 Y type").isEqualTo("goggles");
        assertThat(yFirst.path("slot").asText()).as("G2 Y slot").isEqualTo("face");
        assertThat(yFirst.path("acquiredAt").asText()).as("G2 Y acquiredAt").isEqualTo("2026-11-02T00:00:00Z");
    }

    @Test
    void g3_gogglesThenAcquiredOrder() throws Exception {
        TestUser u = newUser("g3");
        own(u, "shoesBrown", "2026-11-13T12:00:00Z");
        own(u, "capOrange", "2026-11-13T12:05:00Z");

        assertOkBody(get(u.token()), wardrobe(items(
                g(),
                item("shoesBrown", "shoes", "2026-11-13T12:00:00Z"),
                item("capOrange", "hat", "2026-11-13T12:05:00Z")), e0()), "G3");
    }

    @Test
    void g4_gogglesStayFirstEvenBeforeAnEarlierItem() throws Exception {
        TestUser u = newUser("g4");
        own(u, "capOrange", "2026-10-01T00:00:00Z");

        assertOkBody(get(u.token()), wardrobe(items(g(), item("capOrange", "hat", "2026-10-01T00:00:00Z")), e0()), "G4");
    }

    @Test
    void g5_gogglesAreNotADbRow() throws Exception {
        TestUser u = newUser("g5");
        assertThat(get(u.token()).statusCode()).as("G5 GET").isEqualTo(200);

        assertThat(countItems(u.id())).as("G5 wardrobe_items rows").isZero();
    }

    @Test
    void g6_savedEmptyFaceStaysBare() throws Exception {
        TestUser u = newUser("g6");
        insertOutfit(u, new LinkedHashMap<>());

        assertOkBody(get(u.token()), wardrobe(items(g()), equipped()), "G6");
    }

    @Test
    void g7_savedOtherSlotOnlyHasNoFace() throws Exception {
        TestUser u = newUser("g7");
        own(u, "capOrange", "2026-11-13T12:00:00Z");
        Map<String, String> row = new LinkedHashMap<>();
        row.put("hat", "capOrange");
        insertOutfit(u, row);

        assertOkBody(get(u.token()), wardrobe(items(g(), item("capOrange", "hat", "2026-11-13T12:00:00Z")), equipped("hat", "capOrange")), "G7");
    }

    @Test
    void g8_perAccount() throws Exception {
        TestUser x = newUser("g8x");
        TestUser y = newUser("g8y");
        assertThat(put(x.token(), "{}").statusCode()).as("G8 X saves bare face").isEqualTo(200);

        assertThat(JSON.readTree(get(x.token()).body()).path("equipped").get("face").isNull()).as("G8 X face is null").isTrue();
        assertThat(JSON.readTree(get(y.token()).body()).path("equipped").path("face").asText()).as("G8 Y face").isEqualTo("goggles");
    }

    /** 결정 12 A 09-1: wardrobe_items에 goggles 행이 있어도 무시한다(맨 앞 고글 하나, 얻은 때는 계정을 만든 때). */
    @Test
    void decision12_gogglesRowInTheDbIsIgnored() throws Exception {
        TestUser u = newUser("d12");
        own(u, "goggles", "2026-10-01T00:00:00Z");
        own(u, "capOrange", "2026-11-13T12:00:00Z");

        assertOkBody(get(u.token()), wardrobe(items(g(), item("capOrange", "hat", "2026-11-13T12:00:00Z")), e0()), "결정12 09-1");
    }

    // =====================================================================
    // Q. PUT /api/wardrobe/equipped
    // =====================================================================

    @Test
    void q1_gogglesAreAlwaysOwned() throws Exception {
        TestUser u = newUser("q1");

        HttpResponse<String> response = put(u.token(), "{\"face\": \"goggles\"}");

        assertOkBody(response, wardrobe(items(g()), e0()), "Q1 PUT");
        assertThat(JSON.readTree(get(u.token()).body())).as("Q1 GET equals PUT").isEqualTo(JSON.readTree(response.body()));
        Map<String, String> row = nullRow();
        row.put("face", "goggles");
        assertThat(outfitRow(u.id())).as("Q1 outfit row").isEqualTo(row);
        assertThat(countItems(u.id())).as("Q1 wardrobe_items rows").isZero();
    }

    @Test
    void q2_emptyFaceIsBareAndGogglesStayOwned() throws Exception {
        TestUser u = newUser("q2");

        HttpResponse<String> response = put(u.token(), "{}");

        assertOkBody(response, wardrobe(items(g()), equipped()), "Q2 PUT");
        assertOkBody(get(u.token()), wardrobe(items(g()), equipped()), "Q2 GET");
    }

    @Test
    void q3_otherSlotOnlyLeavesFaceNull() throws Exception {
        TestUser u = newUser("q3");
        own(u, "capOrange", "2026-11-13T12:00:00Z");

        HttpResponse<String> response = put(u.token(), "{\"hat\": \"capOrange\"}");

        assertEquipped(response, equipped("hat", "capOrange"), "Q3");
    }

    @Test
    void q4_gogglesBackOnFromBare() throws Exception {
        TestUser u = newUser("q4");
        assertThat(put(u.token(), "{}").statusCode()).as("Q4 setup").isEqualTo(200);

        assertEquipped(put(u.token(), "{\"face\": \"goggles\"}"), e0(), "Q4");
    }

    @Test
    void q5_gogglesAndSunglassesShareTheFaceSlot() throws Exception {
        TestUser u = newUser("q5");
        own(u, "sunglassesBlack", "2026-11-13T12:00:00Z");

        assertEquipped(put(u.token(), "{\"face\": \"sunglassesBlack\"}"), equipped("face", "sunglassesBlack"), "Q5 sunglasses");
        assertEquipped(put(u.token(), "{\"face\": \"goggles\"}"), equipped("face", "goggles"), "Q5 goggles");
    }

    @Test
    void q6_gogglesWithOtherSlots() throws Exception {
        TestUser u = newUser("q6");
        own(u, "capOrange", "2026-11-13T12:00:00Z");
        own(u, "backpackRed", "2026-11-13T12:05:00Z");

        HttpResponse<String> response = put(u.token(), "{\"hat\": \"capOrange\", \"face\": \"goggles\", \"back\": \"backpackRed\"}");

        assertEquipped(response, equipped("hat", "capOrange", "face", "goggles", "back", "backpackRed"), "Q6");
    }

    @Test
    void q7_gogglesOnlyInTheFaceSlot() throws Exception {
        TestUser u = newUser("q7");
        for (String body : List.of(
                "{\"hat\": \"goggles\"}",
                "{\"accessory\": \"goggles\"}",
                "{\"back\": \"goggles\"}",
                "{\"top\": \"goggles\"}")) {
            assertInvalidAndUnchanged(u, body, "Q7 " + body);
        }
        assertEquipped(get(u.token()), e0(), "Q7 GET");
        assertThat(outfitRow(u.id())).as("Q7 no outfit row").isNull();
    }

    @Test
    void q8_oneWrongSlotChangesNothing() throws Exception {
        TestUser u = newUser("q8");
        assertThat(put(u.token(), "{\"face\": \"goggles\"}").statusCode()).as("Q8 setup").isEqualTo(200);

        assertInvalidAndUnchanged(u, "{\"face\": null, \"hat\": \"capOrange\"}", "Q8");
        assertEquipped(get(u.token()), e0(), "Q8 GET");
    }

    @Test
    void q9_everyAccountOwnsGoggles() throws Exception {
        TestUser x = newUser("q9x");
        TestUser y = newUser("q9y");
        setCreatedAt(y, C2_EPOCH);

        HttpResponse<String> xPut = put(x.token(), "{\"face\": \"goggles\"}");
        HttpResponse<String> yPut = put(y.token(), "{\"face\": \"goggles\"}");

        assertOkBody(xPut, wardrobe(items(g()), e0()), "Q9 X");
        assertOkBody(yPut, wardrobe(items(item("goggles", "face", "2026-11-02T00:00:00Z")), e0()), "Q9 Y");
    }

    @Test
    void q10_similarNamesAreStillUnknown() throws Exception {
        TestUser u = newUser("q10");
        for (String body : List.of("{\"face\": \"Goggles\"}", "{\"face\": \"goggle\"}", "{\"face\": \"gogglesBlue\"}")) {
            assertInvalidAndUnchanged(u, body, "Q10 " + body);
        }
    }

    // =====================================================================
    // S. 홈쇼핑
    // =====================================================================

    @Test
    void s1_gogglesAreNotInTheShop() throws Exception {
        TestUser u = newUser("s1");

        JsonNode body = JSON.readTree(shop(u.token()).body());

        List<String> types = new ArrayList<>();
        body.path("items").forEach(item -> types.add(item.path("type").asText()));
        assertThat(types).as("S1 types").doesNotContain("goggles");
        assertThat(types).as("S1 types in order").containsExactly(
                "books", "smallPlant", "lamp", "capOrange", "capBlue", "capGreen", "frame", "shortsNavy", "shortsBrown", "shortsRed",
                "plant", "tshirtOrange", "tshirtWhite", "tshirtYellow", "shoesBrown", "shoesRed", "shoesWhite", "mufflerRed",
                "nightstand", "sunglassesBlack", "floorLamp", "necklaceGold", "backpackRed", "rug", "wardrobe", "bed");
    }

    @Test
    void s2_orderingGogglesIsAnUnsoldProduct() throws Exception {
        TestUser u = newUser("s2");
        setBalance(u, 1000);

        for (int price : List.of(0, 100)) {
            Snapshot before = snapshot(u);
            HttpResponse<String> response = order(u.token(), "goggles", price);

            assertThat(response.statusCode()).as("S2 price %d, body %s", price, response.body()).isEqualTo(400);
            JsonNode body = JSON.readTree(response.body());
            assertThat(body.path("code").asText()).as("S2 code").isEqualTo("UNKNOWN_PRODUCT");
            assertThat(body.path("message").asText()).as("S2 message").isEqualTo("팔지 않는 가구예요.");
            assertThat(snapshot(u)).as("S2 price %d nothing changed", price).isEqualTo(before);
        }
    }

    @Test
    void s3_orderResultWardrobeHasGogglesFirstAndWorn() throws Exception {
        TestUser u = newUser("s3");
        setBalance(u, 300);

        HttpResponse<String> response = order(u.token(), "capOrange", 60);

        assertThat(response.statusCode()).as("S3 order, body %s", response.body()).isEqualTo(200);
        JsonNode wardrobe = JSON.readTree(response.body()).path("wardrobe");
        assertThat(wardrobe.path("items").size()).as("S3 items count").isEqualTo(2);
        assertThat(wardrobe.path("items").get(0)).as("S3 first item").isEqualTo(g());
        assertThat(wardrobe.path("items").get(1).path("type").asText()).as("S3 second type").isEqualTo("capOrange");
        assertThat(wardrobe.path("items").get(1).path("slot").asText()).as("S3 second slot").isEqualTo("hat");
        assertThat(wardrobe.path("equipped")).as("S3 equipped").isEqualTo(e0());
        assertSameWardrobe(wardrobe, JSON.readTree(get(u.token()).body()), "S3");
        assertThat(outfitRow(u.id())).as("S3 no outfit row").isNull();
    }

    @Test
    void s4_orderResultFollowsTheSavedBareFace() throws Exception {
        TestUser u = newUser("s4");
        setBalance(u, 300);
        assertThat(put(u.token(), "{}").statusCode()).as("S4 setup").isEqualTo(200);

        JsonNode wardrobe = JSON.readTree(assertOk(order(u.token(), "sunglassesBlack", 100), "S4").body()).path("wardrobe");

        assertThat(wardrobe.path("equipped")).as("S4 equipped").isEqualTo(equipped());
        assertThat(wardrobe.path("items").get(0)).as("S4 first item").isEqualTo(g());
        assertThat(typesAndSlots(wardrobe)).as("S4 items").containsExactly("goggles/face", "sunglassesBlack/face");
    }

    @Test
    void s5_buyingSunglassesKeepsGogglesOn() throws Exception {
        TestUser u = newUser("s5");
        setBalance(u, 300);

        JsonNode wardrobe = JSON.readTree(assertOk(order(u.token(), "sunglassesBlack", 100), "S5").body()).path("wardrobe");

        assertThat(wardrobe.path("equipped").path("face").asText()).as("S5 face").isEqualTo("goggles");
    }

    @Test
    void s6_furnitureOrderStillHasNullWardrobe() throws Exception {
        TestUser u = newUser("s6");
        setBalance(u, 300);

        JsonNode body = JSON.readTree(assertOk(order(u.token(), "books", 40), "S6").body());

        assertThat(body.has("wardrobe") && body.get("wardrobe").isNull()).as("S6 wardrobe is null: %s", body).isTrue();
    }

    // =====================================================================
    // P. 회원 탈퇴
    // =====================================================================

    @Test
    void p1_accountDeletionStillRemovesEverything() throws Exception {
        TestUser x = newUser("p1");
        setBalance(x, 300);
        assertThat(put(x.token(), "{\"face\": \"goggles\"}").statusCode()).as("P1 wear goggles").isEqualTo(200);
        assertOk(order(x.token(), "capOrange", 60), "P1 order");

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
        for (String table : List.of("wardrobe_items", "wardrobe_outfits", "home_shopping_orders", "loop_point_entries", "loop_point_balances")) {
            assertThat(rowsOf(table, x.id())).as("P1 X %s", table).isZero();
        }
    }

    // =====================================================================
    // 도움 함수: 기대 판정
    // =====================================================================

    private static ObjectNode g() {
        return item("goggles", "face", C);
    }

    private static ObjectNode e0() {
        return equipped("face", "goggles");
    }

    private void assertOkBody(HttpResponse<String> response, JsonNode expected, String label) throws Exception {
        assertThat(response.statusCode()).as("%s status, body %s", label, response.body()).isEqualTo(200);
        assertThat(JSON.readTree(response.body())).as("%s body", label).isEqualTo(expected);
    }

    private void assertEquipped(HttpResponse<String> response, JsonNode expected, String label) throws Exception {
        assertThat(response.statusCode()).as("%s status, body %s", label, response.body()).isEqualTo(200);
        assertThat(JSON.readTree(response.body()).path("equipped")).as("%s equipped", label).isEqualTo(expected);
    }

    private HttpResponse<String> assertOk(HttpResponse<String> response, String label) {
        assertThat(response.statusCode()).as("%s order, body %s", label, response.body()).isEqualTo(200);
        return response;
    }

    /** WARDROBE_INVALID이고 WNC. */
    private void assertInvalidAndUnchanged(TestUser user, String body, String label) throws Exception {
        JsonNode before = JSON.readTree(get(user.token()).body());
        Map<String, String> rowBefore = outfitRow(user.id());

        HttpResponse<String> response = put(user.token(), body);

        assertThat(response.statusCode()).as("%s status, body %s", label, response.body()).isEqualTo(400);
        JsonNode json = JSON.readTree(response.body());
        assertThat(json.path("code").asText()).as("%s code", label).isEqualTo("WARDROBE_INVALID");
        assertThat(json.path("message").asText()).as("%s message", label).isEqualTo("입을 수 없는 아이템이에요");
        assertThat(JSON.readTree(get(user.token()).body())).as("%s GET unchanged", label).isEqualTo(before);
        assertThat(outfitRow(user.id())).as("%s outfit row unchanged", label).isEqualTo(rowBefore);
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

    private record Snapshot(Integer balance, List<Integer> negativeAmounts, List<String> purchases,
                            List<String> wardrobeRows, JsonNode wardrobe, int layoutStatus, String layout) {
    }

    private Snapshot snapshot(TestUser user) throws Exception {
        HttpResponse<String> layout = getLayout(user.token());
        List<Integer> balance = jdbc.queryForList("SELECT balance FROM loop_point_balances WHERE user_id = ?", Integer.class, user.id());
        return new Snapshot(
                balance.isEmpty() ? null : balance.get(0),
                jdbc.queryForList("SELECT amount FROM loop_point_entries WHERE user_id = ? AND amount < 0 ORDER BY id", Integer.class, user.id()),
                jdbc.queryForList("SELECT CONCAT(furniture_type, ':', price) FROM home_shopping_orders WHERE user_id = ? ORDER BY id", String.class, user.id()),
                jdbc.queryForList("SELECT CONCAT(item_type, '@', acquired_at) FROM wardrobe_items WHERE user_id = ? ORDER BY id", String.class, user.id()),
                JSON.readTree(get(user.token()).body()),
                layout.statusCode(),
                layout.body());
    }

    // =====================================================================
    // 도움 함수: JSON
    // =====================================================================

    private static ObjectNode wardrobe(ArrayNode items, ObjectNode equipped) {
        ObjectNode node = JSON.createObjectNode();
        node.set("items", items);
        node.set("equipped", equipped);
        return node;
    }

    private static ArrayNode items(ObjectNode... items) {
        ArrayNode array = JSON.createArrayNode();
        for (ObjectNode item : items) {
            array.add(item);
        }
        return array;
    }

    private static ObjectNode item(String type, String slot, String acquiredAt) {
        ObjectNode node = JSON.createObjectNode();
        node.put("type", type);
        node.put("slot", slot);
        node.put("acquiredAt", acquiredAt);
        return node;
    }

    /** 일곱 부위가 모두 있는 equipped. 인자는 (부위, 종류) 쌍이고 나머지 부위는 null이다. */
    private static ObjectNode equipped(String... slotTypePairs) {
        ObjectNode node = JSON.createObjectNode();
        for (String slot : SLOTS) {
            node.putNull(slot);
        }
        for (int i = 0; i < slotTypePairs.length; i += 2) {
            node.put(slotTypePairs[i], slotTypePairs[i + 1]);
        }
        return node;
    }

    private static List<String> typesAndSlots(JsonNode wardrobe) {
        List<String> list = new ArrayList<>();
        wardrobe.path("items").forEach(item -> list.add(item.path("type").asText() + "/" + item.path("slot").asText()));
        return list;
    }

    private static Map<String, String> nullRow() {
        Map<String, String> row = new LinkedHashMap<>();
        for (String slot : SLOTS) {
            row.put(slot, null);
        }
        return row;
    }

    // =====================================================================
    // 도움 함수: DB
    // =====================================================================

    private void own(TestUser user, String type, String acquiredAt) {
        wardrobeItemRepository.saveAndFlush(new WardrobeItemEntity(user.id(), type, Instant.parse(acquiredAt)));
    }

    private void setCreatedAt(TestUser user, long epochSeconds) {
        jdbc.update("UPDATE users SET created_at = FROM_UNIXTIME(?) WHERE id = ?", epochSeconds, user.id());
    }

    /** 저장한 입은 것 줄을 직접 넣는다(주지 않은 부위는 null). */
    private void insertOutfit(TestUser user, Map<String, String> worn) {
        jdbc.update(
                "INSERT INTO wardrobe_outfits (user_id, hat_item, top_item, bottom_item, shoes_item, face_item, back_item, accessory_item, updated_at)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(6))",
                user.id(), worn.get("hat"), worn.get("top"), worn.get("bottom"), worn.get("shoes"),
                worn.get("face"), worn.get("back"), worn.get("accessory"));
    }

    /** 그 사용자의 wardrobe_outfits 행(부위 → 종류). 행이 없으면 null. */
    private Map<String, String> outfitRow(long userId) {
        List<Map<String, String>> rows = jdbc.query(
                "SELECT hat_item, top_item, bottom_item, shoes_item, face_item, back_item, accessory_item"
                        + " FROM wardrobe_outfits WHERE user_id = ?",
                (rs, rowNum) -> {
                    Map<String, String> row = new LinkedHashMap<>();
                    for (String slot : SLOTS) {
                        row.put(slot, rs.getString(slot + "_item"));
                    }
                    return row;
                },
                userId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private int countItems(long userId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM wardrobe_items WHERE user_id = ?", Integer.class, userId);
    }

    private int rowsOf(String table, long userId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM " + table + " WHERE user_id = ?", Integer.class, userId);
    }

    private void setBalance(TestUser user, int balance) throws Exception {
        HttpResponse<String> summary = client.send(
                HttpRequest.newBuilder(uri("/api/loop-points")).header("Authorization", "Bearer " + user.token()).GET().build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(summary.statusCode()).as("setup: create the balance row").isEqualTo(200);
        jdbc.update("UPDATE loop_point_balances SET balance = ? WHERE user_id = ?", balance, user.id());
    }

    // =====================================================================
    // 도움 함수: 사용자·요청
    // =====================================================================

    private record TestUser(long id, String email, String password, String token) {
    }

    /** 새 사용자. 계정을 만든 때는 C로 정해 둔다. */
    private TestUser newUser(String tag) throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        String email = "qa-089g-" + tag + "-" + suffix + "@example.com";
        String password = "qa-pass-" + suffix;
        jdbc.update(
                "INSERT INTO users (email, password_hash, display_name, email_verified, verified_at) VALUES (?, ?, ?, 1, NOW())",
                email, passwordEncoder.encode(password), "qa-089g-" + tag + "-" + suffix);
        long userId = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", Long.class, email);
        TestUser user = new TestUser(userId, email, password, login(email, password));
        setCreatedAt(user, C_EPOCH);
        return user;
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

    private HttpResponse<String> get(String token) throws Exception {
        return client.send(HttpRequest.newBuilder(uri("/api/wardrobe")).header("Authorization", "Bearer " + token).GET().build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> put(String token, String rawBody) throws Exception {
        return client.send(HttpRequest.newBuilder(uri("/api/wardrobe/equipped"))
                        .header("Authorization", "Bearer " + token)
                        .header("Content-Type", "application/json")
                        .PUT(HttpRequest.BodyPublishers.ofString(rawBody)).build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> shop(String token) throws Exception {
        return client.send(HttpRequest.newBuilder(uri("/api/home-shopping")).header("Authorization", "Bearer " + token).GET().build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> order(String token, String type, int price) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("type", type);
        body.put("price", price);
        return client.send(HttpRequest.newBuilder(uri("/api/home-shopping/orders"))
                        .header("Authorization", "Bearer " + token)
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body))).build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> getLayout(String token) throws Exception {
        return client.send(HttpRequest.newBuilder(uri("/api/lobby-layout")).header("Authorization", "Bearer " + token).GET().build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private URI uri(String path) {
        return URI.create(rest.getRootUri() + path);
    }
}
