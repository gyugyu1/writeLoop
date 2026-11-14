package com.writeloop.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * [spec] 작업 089 ⑤ 아이템 늘리기, 백엔드. 시나리오 07-아이템-늘리기/02-qa-scenarios.md의 W(옷장 아이템 목록 열여섯과
 * PUT /api/wardrobe/equipped가 새 부위를 받는 것)를 실제 서버로 확인한다.
 *
 * <ul>
 *   <li>로그인은 토큰 로그인(Bearer). 테스트마다 새 사용자를 만든다.</li>
 *   <li>가진 아이템은 WardrobeItemRepository로 직접 넣는다(② 명세: 테스트는 직접 넣어 본다). 얻은 때는 1분씩 늦춰 순서를 정한다.</li>
 *   <li>WNC(옷장이 바뀌지 않음): 요청 전후로 GET /api/wardrobe 본문과 wardrobe_outfits의 그 계정 줄이 같다.</li>
 *   <li>08 결정(사용자 결정, 고글 기본)에 맞춰 기대 응답의 가진 것 맨 앞에 고글을 더하고(개수 +1),
 *       입은 것을 저장한 적 없는 계정의 얼굴장식을 고글로 바꿨다(W1, W2, W3, W4, W5, W11, W14).</li>
 * </ul>
 */
class WardrobeItemsExpansionSpecTest extends IntegrationTestSupport {

    private static final ObjectMapper JSON = new ObjectMapper();

    private static final List<String> SLOTS = List.of("hat", "top", "bottom", "shoes", "face", "back", "accessory");

    /** 지금 넷(②). */
    private static final List<String[]> OLD_FOUR = List.of(
            new String[] {"capOrange", "hat"},
            new String[] {"tshirtOrange", "top"},
            new String[] {"shortsNavy", "bottom"},
            new String[] {"shoesBrown", "shoes"});

    /** 새 열둘(명세 1의 표 순서). */
    private static final List<String[]> NEW_TWELVE = List.of(
            new String[] {"capBlue", "hat"},
            new String[] {"capGreen", "hat"},
            new String[] {"tshirtWhite", "top"},
            new String[] {"tshirtYellow", "top"},
            new String[] {"shortsBrown", "bottom"},
            new String[] {"shortsRed", "bottom"},
            new String[] {"shoesRed", "shoes"},
            new String[] {"shoesWhite", "shoes"},
            new String[] {"sunglassesBlack", "face"},
            new String[] {"backpackRed", "back"},
            new String[] {"mufflerRed", "accessory"},
            new String[] {"necklaceGold", "accessory"});

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private WardrobeItemRepository wardrobeItemRepository;

    private final HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();

    // =====================================================================
    // W1·W2. 옷장 아이템 목록(종류 → 부위)
    // =====================================================================

    @Test
    void w1_twelveNewItemsHaveTheirSlots() throws Exception {
        TestUser u = newUser("w1");
        ArrayNode expectedItems = ownInOrder(u, NEW_TWELVE);

        HttpResponse<String> response = get(u.token());

        assertOkBody(response, wardrobe(u, expectedItems, equipped("face", "goggles")), "W1");
        assertThat(JSON.readTree(response.body()).path("items").size()).as("W1 items count").isEqualTo(13);
    }

    @Test
    void w2_sixteenItemsWithTheOldFourFirst() throws Exception {
        TestUser u = newUser("w2");
        ArrayNode expectedItems = ownSixteen(u);

        HttpResponse<String> response = get(u.token());

        assertOkBody(response, wardrobe(u, expectedItems, equipped("face", "goggles")), "W2");
        JsonNode items = JSON.readTree(response.body()).path("items");
        assertThat(items.size()).as("W2 items count").isEqualTo(17);
        List<String> firstFour = new ArrayList<>();
        for (int i = 1; i <= 4; i++) {
            firstFour.add(items.get(i).path("type").asText() + "/" + items.get(i).path("slot").asText());
        }
        assertThat(firstFour).as("W2 first four after goggles").containsExactly("capOrange/hat", "tshirtOrange/top", "shortsNavy/bottom", "shoesBrown/shoes");
    }

    // =====================================================================
    // W3~W8. 새 부위와 부위마다 하나
    // =====================================================================

    @Test
    void w3_allSevenSlotsWithNewItems() throws Exception {
        TestUser u = newUser("w3");
        ArrayNode expectedItems = ownSixteen(u);
        String body = "{\"hat\": \"capBlue\", \"top\": \"tshirtYellow\", \"bottom\": \"shortsRed\", \"shoes\": \"shoesWhite\","
                + " \"face\": \"sunglassesBlack\", \"back\": \"backpackRed\", \"accessory\": \"mufflerRed\"}";

        HttpResponse<String> response = put(u.token(), body);

        ObjectNode expectedEquipped = equipped(
                "hat", "capBlue", "top", "tshirtYellow", "bottom", "shortsRed", "shoes", "shoesWhite",
                "face", "sunglassesBlack", "back", "backpackRed", "accessory", "mufflerRed");
        assertOkBody(response, wardrobe(u, expectedItems, expectedEquipped), "W3 PUT");
        assertThat(JSON.readTree(get(u.token()).body())).as("W3 GET equals the PUT response").isEqualTo(JSON.readTree(response.body()));
        Map<String, String> row = new LinkedHashMap<>();
        row.put("hat", "capBlue");
        row.put("top", "tshirtYellow");
        row.put("bottom", "shortsRed");
        row.put("shoes", "shoesWhite");
        row.put("face", "sunglassesBlack");
        row.put("back", "backpackRed");
        row.put("accessory", "mufflerRed");
        assertThat(outfitRow(u.id())).as("W3 wardrobe_outfits row").isEqualTo(row);
    }

    @Test
    void w4_theOtherNewItemsInTheirSlots() throws Exception {
        TestUser u = newUser("w4");
        ArrayNode expectedItems = ownSixteen(u);

        HttpResponse<String> response = put(u.token(),
                "{\"hat\": \"capGreen\", \"top\": \"tshirtWhite\", \"bottom\": \"shortsBrown\", \"shoes\": \"shoesRed\", \"accessory\": \"necklaceGold\"}");

        assertOkBody(response, wardrobe(u, expectedItems, equipped(
                "hat", "capGreen", "top", "tshirtWhite", "bottom", "shortsBrown", "shoes", "shoesRed", "accessory", "necklaceGold")), "W4");
    }

    @Test
    void w5_oneNewSlotAlone() throws Exception {
        TestUser face = newUser("w5f");
        own(face, "sunglassesBlack", minute(0));
        TestUser back = newUser("w5b");
        own(back, "backpackRed", minute(0));

        assertOkBody(put(face.token(), "{\"face\": \"sunglassesBlack\"}"),
                wardrobe(face, items(item("sunglassesBlack", "face", minute(0))), equipped("face", "sunglassesBlack")), "W5 face");
        assertOkBody(put(back.token(), "{\"back\": \"backpackRed\"}"),
                wardrobe(back, items(item("backpackRed", "back", minute(0))), equipped("back", "backpackRed")), "W5 back");
    }

    @Test
    void w6_switchingWithinASlot() throws Exception {
        TestUser u = newUser("w6");
        ownSixteen(u);

        HttpResponse<String> first = put(u.token(), "{\"hat\": \"capOrange\"}");
        HttpResponse<String> second = put(u.token(), "{\"hat\": \"capGreen\"}");
        HttpResponse<String> third = put(u.token(), "{\"hat\": \"capBlue\", \"top\": \"tshirtOrange\"}");

        assertEquipped(first, equipped("hat", "capOrange"), "W6 first");
        assertEquipped(second, equipped("hat", "capGreen"), "W6 second");
        assertEquipped(third, equipped("hat", "capBlue", "top", "tshirtOrange"), "W6 third");
        assertEquipped(get(u.token()), equipped("hat", "capBlue", "top", "tshirtOrange"), "W6 GET");
    }

    @Test
    void w7_mufflerAndNecklaceShareTheAccessorySlot() throws Exception {
        TestUser u = newUser("w7");
        own(u, "mufflerRed", minute(0));
        own(u, "necklaceGold", minute(1));

        HttpResponse<String> muffler = put(u.token(), "{\"accessory\": \"mufflerRed\"}");
        HttpResponse<String> necklace = put(u.token(), "{\"accessory\": \"necklaceGold\"}");

        assertEquipped(muffler, equipped("accessory", "mufflerRed"), "W7 muffler");
        assertEquipped(necklace, equipped("accessory", "necklaceGold"), "W7 necklace");
        assertEquipped(get(u.token()), equipped("accessory", "necklaceGold"), "W7 GET");
    }

    @Test
    void w8_mufflerCannotGoToAnotherSlotToWearBoth() throws Exception {
        TestUser u = newUser("w8");
        own(u, "mufflerRed", minute(0));
        own(u, "necklaceGold", minute(1));
        assertThat(put(u.token(), "{\"accessory\": \"mufflerRed\"}").statusCode()).as("W8 setup").isEqualTo(200);

        assertInvalidAndUnchanged(u, "{\"back\": \"mufflerRed\", \"accessory\": \"necklaceGold\"}", "W8 muffler on back");
        assertInvalidAndUnchanged(u, "{\"face\": \"necklaceGold\", \"accessory\": \"mufflerRed\"}", "W8 necklace on face");
        assertEquipped(get(u.token()), equipped("accessory", "mufflerRed"), "W8 GET");
    }

    // =====================================================================
    // W9~W13. 입을 수 없는 아이템
    // =====================================================================

    @Test
    void w9_newItemInAnotherSlot() throws Exception {
        TestUser u = newUser("w9");
        ownSixteen(u);
        assertThat(put(u.token(), "{}").statusCode()).as("W9 setup").isEqualTo(200);

        for (String body : List.of(
                "{\"face\": \"backpackRed\"}",
                "{\"back\": \"sunglassesBlack\"}",
                "{\"accessory\": \"backpackRed\"}",
                "{\"hat\": \"mufflerRed\"}",
                "{\"face\": \"necklaceGold\"}",
                "{\"back\": \"mufflerRed\"}",
                "{\"top\": \"shortsBrown\"}",
                "{\"bottom\": \"tshirtWhite\"}",
                "{\"shoes\": \"capBlue\"}",
                "{\"hat\": \"shoesWhite\"}",
                "{\"face\": \"capGreen\"}",
                "{\"accessory\": \"tshirtYellow\"}")) {
            assertInvalidAndUnchanged(u, body, "W9 " + body);
        }
    }

    @Test
    void w10_newItemNotOwned() throws Exception {
        TestUser none = newUser("w10n");
        for (String body : List.of(
                "{\"face\": \"sunglassesBlack\"}",
                "{\"back\": \"backpackRed\"}",
                "{\"accessory\": \"mufflerRed\"}",
                "{\"hat\": \"capBlue\"}")) {
            assertInvalidAndUnchanged(none, body, "W10 nothing owned " + body);
        }
        TestUser muffler = newUser("w10m");
        own(muffler, "mufflerRed", minute(0));

        assertInvalidAndUnchanged(muffler, "{\"accessory\": \"necklaceGold\"}", "W10 muffler owner wears necklace");
    }

    @Test
    void w11_anotherAccountsNewItemIsNotOwned() throws Exception {
        TestUser x = newUser("w11x");
        own(x, "sunglassesBlack", minute(0));
        assertThat(put(x.token(), "{\"face\": \"sunglassesBlack\"}").statusCode()).as("W11 setup X").isEqualTo(200);
        TestUser y = newUser("w11y");

        HttpResponse<String> response = put(y.token(), "{\"face\": \"sunglassesBlack\"}");

        assertInvalid(response, "W11 Y");
        assertOkBody(get(y.token()), wardrobe(y, items(), equipped("face", "goggles")), "W11 Y GET");
        assertOkBody(get(x.token()), wardrobe(x, items(item("sunglassesBlack", "face", minute(0))), equipped("face", "sunglassesBlack")), "W11 X GET");
    }

    @Test
    void w12_namesOutsideTheSixteenAreStillUnknown() throws Exception {
        TestUser u = newUser("w12");
        ownSixteen(u);

        for (String body : List.of(
                "{\"face\": \"sunglasses\"}",
                "{\"face\": \"glassesRound\"}",
                "{\"accessory\": \"muffler\"}",
                "{\"hat\": \"capRed\"}",
                "{\"back\": \"BackpackRed\"}",
                "{\"back\": \"backpack\"}")) {
            assertInvalidAndUnchanged(u, body, "W12 " + body);
        }
    }

    @Test
    void w13_oneWrongSlotChangesNothing() throws Exception {
        TestUser u = newUser("w13");
        ownSixteen(u);
        assertThat(put(u.token(), "{\"hat\": \"capBlue\", \"top\": \"tshirtYellow\", \"bottom\": \"shortsRed\", \"shoes\": \"shoesWhite\","
                + " \"face\": \"sunglassesBlack\", \"back\": \"backpackRed\", \"accessory\": \"mufflerRed\"}").statusCode())
                .as("W13 setup").isEqualTo(200);

        assertInvalidAndUnchanged(u, "{\"hat\": \"capGreen\", \"top\": \"tshirtWhite\", \"face\": \"backpackRed\"}", "W13");
        assertEquipped(get(u.token()), equipped(
                "hat", "capBlue", "top", "tshirtYellow", "bottom", "shortsRed", "shoes", "shoesWhite",
                "face", "sunglassesBlack", "back", "backpackRed", "accessory", "mufflerRed"), "W13 GET");
    }

    // =====================================================================
    // W14·W15. DB 유일 키, 로그인
    // =====================================================================

    @Test
    void w14_sameNewTypeTwiceIsRejectedByDb() throws Exception {
        TestUser u = newUser("w14");
        own(u, "necklaceGold", minute(0));

        assertThatThrownBy(() -> jdbc.update(
                "INSERT INTO wardrobe_items (user_id, item_type, acquired_at) VALUES (?, ?, ?)",
                u.id(), "necklaceGold", "2026-11-13 21:05:00"))
                .as("W14 second necklaceGold row")
                .isInstanceOf(DataIntegrityViolationException.class);

        assertOkBody(get(u.token()), wardrobe(u, items(item("necklaceGold", "accessory", minute(0))), equipped("face", "goggles")), "W14 GET");
    }

    @Test
    void w15_putWithoutLoginIs401() throws Exception {
        HttpResponse<String> response = put(null, "{\"face\": \"sunglassesBlack\"}");

        assertThat(response.statusCode()).as("W15 PUT without login, body %s", response.body()).isEqualTo(401);
    }

    // =====================================================================
    // 도움 함수
    // =====================================================================

    private record TestUser(long id, String email, String password, String token) {
    }

    private TestUser newUser(String tag) throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        String email = "qa-089e-" + tag + "-" + suffix + "@example.com";
        String password = "qa-pass-" + suffix;
        jdbc.update(
                "INSERT INTO users (email, password_hash, display_name, email_verified, verified_at) VALUES (?, ?, ?, 1, NOW())",
                email, passwordEncoder.encode(password), "qa-089e-" + tag + "-" + suffix);
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

    /** 2026-11-13T00:00Z에서 n분 뒤(얻은 때). */
    private static String minute(int n) {
        return String.format("2026-11-13T00:%02d:00Z", n);
    }

    private void own(TestUser user, String type, String acquiredAt) {
        wardrobeItemRepository.saveAndFlush(new WardrobeItemEntity(user.id(), type, Instant.parse(acquiredAt)));
    }

    /** 주어진 순서대로 1분씩 늦춰 넣고, 기대하는 items를 돌려준다. */
    private ArrayNode ownInOrder(TestUser user, List<String[]> list) {
        ArrayNode expected = JSON.createArrayNode();
        for (int i = 0; i < list.size(); i++) {
            own(user, list.get(i)[0], minute(i));
            expected.add(item(list.get(i)[0], list.get(i)[1], minute(i)));
        }
        return expected;
    }

    /** 착용 표 순서(지금 넷, 새 열둘)로 열여섯을 넣는다. */
    private ArrayNode ownSixteen(TestUser user) {
        List<String[]> all = new ArrayList<>(OLD_FOUR);
        all.addAll(NEW_TWELVE);
        return ownInOrder(user, all);
    }

    private HttpResponse<String> get(String token) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(uri("/api/wardrobe")).GET();
        if (token != null) {
            builder.header("Authorization", "Bearer " + token);
        }
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> put(String token, String rawBody) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(uri("/api/wardrobe/equipped"))
                .header("Content-Type", "application/json")
                .PUT(HttpRequest.BodyPublishers.ofString(rawBody));
        if (token != null) {
            builder.header("Authorization", "Bearer " + token);
        }
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    private void assertOkBody(HttpResponse<String> response, JsonNode expected, String label) throws Exception {
        assertThat(response.statusCode()).as("%s status, body %s", label, response.body()).isEqualTo(200);
        assertThat(JSON.readTree(response.body())).as("%s body", label).isEqualTo(expected);
    }

    private void assertEquipped(HttpResponse<String> response, JsonNode expected, String label) throws Exception {
        assertThat(response.statusCode()).as("%s status, body %s", label, response.body()).isEqualTo(200);
        assertThat(JSON.readTree(response.body()).path("equipped")).as("%s equipped", label).isEqualTo(expected);
    }

    private void assertInvalid(HttpResponse<String> response, String label) throws Exception {
        assertThat(response.statusCode()).as("%s status, body %s", label, response.body()).isEqualTo(400);
        JsonNode body = JSON.readTree(response.body());
        assertThat(body.path("code").asText()).as("%s code, body %s", label, response.body()).isEqualTo("WARDROBE_INVALID");
        assertThat(body.path("message").asText()).as("%s message, body %s", label, response.body()).isEqualTo("입을 수 없는 아이템이에요");
    }

    /** WARDROBE_INVALID이고 WNC(GET 본문과 wardrobe_outfits 줄이 그대로). */
    private void assertInvalidAndUnchanged(TestUser user, String body, String label) throws Exception {
        JsonNode before = JSON.readTree(get(user.token()).body());
        Map<String, String> rowBefore = outfitRow(user.id());

        HttpResponse<String> response = put(user.token(), body);

        assertInvalid(response, label);
        assertThat(JSON.readTree(get(user.token()).body())).as("%s GET unchanged", label).isEqualTo(before);
        assertThat(outfitRow(user.id())).as("%s outfit row unchanged", label).isEqualTo(rowBefore);
    }

    /** 기대 응답. 08 결정(사용자: 고글 기본에 맞게 고침)으로 가진 것 맨 앞에 그 계정의 고글(얻은 때는 계정을 만든 때)을 더한다. */
    private ObjectNode wardrobe(TestUser user, ArrayNode items, ObjectNode equipped) {
        ArrayNode withGoggles = JSON.createArrayNode();
        withGoggles.add(item("goggles", "face", accountCreatedAt(user)));
        withGoggles.addAll(items);
        ObjectNode node = JSON.createObjectNode();
        node.set("items", withGoggles);
        node.set("equipped", equipped);
        return node;
    }

    /** 계정을 만든 때(users.created_at)를 ISO 순간 문자열로. */
    private String accountCreatedAt(TestUser user) {
        Long epochSeconds = jdbc.queryForObject("SELECT UNIX_TIMESTAMP(created_at) FROM users WHERE id = ?", Long.class, user.id());
        return Instant.ofEpochSecond(epochSeconds).toString();
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

    private URI uri(String path) {
        return URI.create(rest.getRootUri() + path);
    }
}
