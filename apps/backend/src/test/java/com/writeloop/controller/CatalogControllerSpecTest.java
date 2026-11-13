package com.writeloop.controller;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.support.IntegrationTestSupport;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * [spec] 작업 090 ① 서버 아이템 목록, 백엔드 "바뀌는 동작": 새 API GET /api/catalog.
 * 기대값은 명세(02-서버-아이템-목록/01-main-spec.md)와, 명세가 "지금 앱의 홈쇼핑 이름·설명", "꾸미기 보관함 이름",
 * "지금 종류 이름 그대로", "지금 HomeShoppingService.PRODUCTS·WardrobeService.ITEM_SLOTS·LobbyLayoutService.KINDS"로
 * 가리킨 기준 커밋 613c2d2의 값이다(앱 home-shopping-catalog.ts, furniture-catalog.ts의 name, wear.ts의 label).
 *
 * <ul>
 *   <li>로그인 없이 부른다(명세: 로그인 없이도 된다).</li>
 *   <li>본문은 {version, items}. 아이템 칸은 id, kind, name, shopName, description, category, slot, price, assets 아홉이다.</li>
 *   <li>아이템 순서는 명세에 없어 보지 않는다.</li>
 *   <li>명세가 정하지 않았던 값은 결정 파일 04-main-decision.md B를 따른다: shopName·description은 늘 글이고,
 *       팔지 않는 가구와 옷의 shopName은 name과 같으며, 팔지 않는 아이템의 description은 빈 글이다.</li>
 * </ul>
 */
class CatalogControllerSpecTest extends IntegrationTestSupport {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String PATH = "/api/catalog";

    private static final List<String> ITEM_KEYS = List.of(
            "id", "kind", "name", "shopName", "description", "category", "slot", "price", "assets");

    /** 가구 한 종류의 기대값. category·price는 팔지 않으면 null이다(팔지 않으면 shopName은 name, description은 빈 글로 본다. 결정 04 B). */
    private record Furniture(String id, String name, String shopName, String category, Integer price, String description) {
    }

    /** 옷 한 종류의 기대값. category·price는 팔지 않으면(고글) null이다(그때 description은 빈 글로 본다. 결정 04 B). */
    private record Wearable(String id, String name, String slot, String category, Integer price, String description) {
    }

    /** 가구 열넷(LobbyLayoutService.KINDS). name은 꾸미기 보관함 이름, shopName·category·description은 앱 홈쇼핑 값. */
    private static final List<Furniture> FURNITURE = List.of(
            new Furniture("desk", "일기 책상", null, null, null, null),
            new Furniture("bookcase", "책장", null, null, null, null),
            new Furniture("board", "오늘의 질문 게시판", null, null, null, null),
            new Furniture("window", "창문", null, null, null, null),
            new Furniture("wardrobe", "옷장", "옷장", "furniture", 180, "방 한쪽을 차분하게 채우는 기본 옷장이에요."),
            new Furniture("rug", "깔개", "러그", "decor", 150, "가구 아래에 깔아 공간을 아늑하게 묶어 줘요."),
            new Furniture("lamp", "스탠드", "탁상 스탠드", "lighting", 60, "책상이나 협탁 위를 따뜻하게 밝혀 줘요."),
            new Furniture("bed", "침대", "침대", "furniture", 300, "하루를 마무리하는 포근한 자리예요."),
            new Furniture("nightstand", "협탁", "협탁", "furniture", 100, "윗면에 조명이나 작은 소품을 올려 보세요."),
            new Furniture("floorLamp", "바닥 스탠드", "바닥 스탠드", "lighting", 110, "침대 옆이나 방 구석에 작은 빛을 더해요."),
            new Furniture("plant", "화분", "큰 화분", "plants", 80, "빈 공간에 싱그러운 초록을 더해 보세요."),
            new Furniture("smallPlant", "작은 화분", "작은 화분", "plants", 50, "작은 초록 하나로 책상이 산뜻해져요."),
            new Furniture("books", "책", "책", "decor", 40, "책 몇 권을 쌓아 나만의 독서 분위기를 만들어요."),
            new Furniture("frame", "액자", "액자", "decor", 70, "허전한 벽을 채우는 작은 그림이에요.")
    );

    /** 옷 열일곱(WardrobeService.ITEM_SLOTS). name은 앱 착용 아이템 이름(= 지금 홈쇼핑 옷 이름). */
    private static final List<Wearable> WEARABLES = List.of(
            new Wearable("goggles", "라룹이 고글", "face", null, null, null),
            new Wearable("capOrange", "주황 야구모자", "hat", "clothes", 60, "발바닥 무늬가 들어간 산뜻한 주황 모자예요."),
            new Wearable("tshirtOrange", "주황 티셔츠", "top", "clothes", 80, "어디에나 잘 어울리는 편한 주황 티셔츠예요."),
            new Wearable("shortsNavy", "남색 반바지", "bottom", "clothes", 70, "가볍게 움직이기 좋은 남색 반바지예요."),
            new Wearable("shoesBrown", "갈색 운동화", "shoes", "clothes", 90, "폭신하게 걷기 좋은 갈색 운동화예요."),
            new Wearable("capBlue", "파랑 야구모자", "hat", "clothes", 60, "발바닥 무늬가 들어간 시원한 파랑 모자예요."),
            new Wearable("capGreen", "초록 야구모자", "hat", "clothes", 60, "발바닥 무늬가 들어간 싱그러운 초록 모자예요."),
            new Wearable("tshirtWhite", "흰 티셔츠", "top", "clothes", 80, "무엇과도 잘 어울리는 깔끔한 흰 티셔츠예요."),
            new Wearable("tshirtYellow", "노랑 티셔츠", "top", "clothes", 80, "기분까지 밝아지는 노랑 티셔츠예요."),
            new Wearable("shortsBrown", "갈색 반바지", "bottom", "clothes", 70, "차분한 갈색이라 어디에나 잘 맞는 반바지예요."),
            new Wearable("shortsRed", "빨강 반바지", "bottom", "clothes", 70, "눈에 확 띄는 빨강 반바지예요."),
            new Wearable("shoesRed", "빨강 운동화", "shoes", "clothes", 90, "한 걸음마다 신나는 빨강 운동화예요."),
            new Wearable("shoesWhite", "흰 운동화", "shoes", "clothes", 90, "어떤 옷에도 잘 어울리는 흰 운동화예요."),
            new Wearable("sunglassesBlack", "검정 선글라스", "face", "clothes", 100, "햇살 좋은 날 멋을 더하는 동그란 선글라스예요."),
            new Wearable("backpackRed", "빨강 백팩", "back", "clothes", 120, "어디든 함께 떠날 수 있는 작은 빨강 백팩이에요."),
            new Wearable("mufflerRed", "빨강 머플러", "accessory", "clothes", 90, "목을 포근하게 감싸는 빨강 머플러예요."),
            new Wearable("necklaceGold", "금 목걸이", "accessory", "clothes", 110, "동그란 펜던트가 반짝이는 금 목걸이예요.")
    );

    @Autowired
    private PasswordEncoder passwordEncoder;

    private final HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();

    // =====================================================================
    // 응답 모양
    // =====================================================================

    @Test
    void c1_withoutLoginReturnsVersionAndItems() throws Exception {
        HttpResponse<String> response = get(null);

        assertThat(response.statusCode()).as("C1 GET %s without login, body %s", PATH, response.body()).isEqualTo(200);
        JsonNode body = JSON.readTree(response.body());
        assertThat(fieldNames(body)).as("C1 top-level keys").isEqualTo(new LinkedHashSet<>(List.of("version", "items")));
        assertThat(body.get("version").isTextual()).as("C1 version is a string: %s", body.get("version")).isTrue();
        assertThat(body.get("version").asText()).as("C1 version is not blank").isNotBlank();
        assertThat(body.get("items").isArray()).as("C1 items is an array").isTrue();
    }

    @Test
    void c2_itemsAreTheFourteenFurnitureAndSeventeenWearablesOnce() throws Exception {
        JsonNode items = catalog().get("items");

        List<String> ids = new ArrayList<>();
        for (JsonNode item : items) {
            ids.add(item.path("id").asText());
        }
        List<String> expected = new ArrayList<>();
        FURNITURE.forEach(furniture -> expected.add(furniture.id()));
        WEARABLES.forEach(wearable -> expected.add(wearable.id()));
        assertThat(items.size()).as("C2 item count").isEqualTo(31);
        assertThat(ids).as("C2 ids (each once, any order)").containsExactlyInAnyOrderElementsOf(expected);
    }

    @Test
    void c3_everyItemHasExactlyTheNineAppFieldsAndNullAssets() throws Exception {
        for (JsonNode item : catalog().get("items")) {
            String id = item.path("id").asText();
            assertThat(fieldNames(item)).as("C3 keys of %s", id).isEqualTo(new LinkedHashSet<>(ITEM_KEYS));
            assertThat(item.get("assets").isNull()).as("C3 assets of %s is null: %s", id, item).isTrue();
        }
    }

    // =====================================================================
    // 값
    // =====================================================================

    @Test
    void c4_furnitureValues() throws Exception {
        Map<String, JsonNode> byId = byId(catalog());
        for (Furniture expected : FURNITURE) {
            JsonNode item = byId.get(expected.id());
            String label = "C4 " + expected.id();
            assertThat(item).as("%s present", label).isNotNull();
            assertThat(item.path("kind").asText()).as("%s kind", label).isEqualTo("furniture");
            assertThat(textOrNull(item, "name")).as("%s name (보관함 이름)", label).isEqualTo(expected.name());
            assertNullableInt(item, "price", expected.price(), label);
            assertThat(textOrNull(item, "category")).as("%s category", label).isEqualTo(expected.category());
            // 가구에는 부위가 없다(null 또는 빈 칸이 아닌 값이면 틀림)
            assertThat(item.hasNonNull("slot")).as("%s slot is not set: %s", label, item).isFalse();
            if (expected.price() != null) {
                assertThat(textOrNull(item, "shopName")).as("%s shopName (홈쇼핑 이름)", label).isEqualTo(expected.shopName());
                assertThat(textOrNull(item, "description")).as("%s description", label).isEqualTo(expected.description());
            } else {
                // 결정 04 B1·B2: 팔지 않는 가구의 shopName은 보관함 이름과 같은 글, description은 빈 글
                assertThat(textOrNull(item, "shopName")).as("%s shopName (not sold)", label).isEqualTo(expected.name());
                assertThat(textOrNull(item, "description")).as("%s description (not sold)", label).isEqualTo("");
            }
        }
    }

    @Test
    void c5_wearableValues() throws Exception {
        Map<String, JsonNode> byId = byId(catalog());
        for (Wearable expected : WEARABLES) {
            JsonNode item = byId.get(expected.id());
            String label = "C5 " + expected.id();
            assertThat(item).as("%s present", label).isNotNull();
            assertThat(item.path("kind").asText()).as("%s kind", label).isEqualTo("wearable");
            assertThat(textOrNull(item, "name")).as("%s name", label).isEqualTo(expected.name());
            assertThat(textOrNull(item, "slot")).as("%s slot", label).isEqualTo(expected.slot());
            assertNullableInt(item, "price", expected.price(), label);
            assertThat(textOrNull(item, "category")).as("%s category", label).isEqualTo(expected.category());
            // 결정 04 B3: 옷의 shopName은 옷 이름과 같은 글
            assertThat(textOrNull(item, "shopName")).as("%s shopName", label).isEqualTo(expected.name());
            if (expected.price() != null) {
                assertThat(textOrNull(item, "description")).as("%s description", label).isEqualTo(expected.description());
            } else {
                // 결정 04 B2: 팔지 않는 고글의 description은 빈 글
                assertThat(textOrNull(item, "description")).as("%s description (not sold)", label).isEqualTo("");
            }
        }
    }

    // =====================================================================
    // 버전·로그인
    // =====================================================================

    @Test
    void c6_sameListGivesTheSameVersionAndBody() throws Exception {
        JsonNode first = catalog();
        JsonNode second = catalog();

        assertThat(second.get("version").asText()).as("C6 version on the second call").isEqualTo(first.get("version").asText());
        assertThat(byId(second)).as("C6 items on the second call").isEqualTo(byId(first));
    }

    @Test
    void c7_withLoginGivesTheSameCatalog() throws Exception {
        String token = newUserToken("c7");

        HttpResponse<String> response = get(token);

        assertThat(response.statusCode()).as("C7 GET %s with login, body %s", PATH, response.body()).isEqualTo(200);
        JsonNode withLogin = JSON.readTree(response.body());
        JsonNode withoutLogin = catalog();
        assertThat(withLogin.get("version").asText()).as("C7 version").isEqualTo(withoutLogin.get("version").asText());
        assertThat(byId(withLogin)).as("C7 items").isEqualTo(byId(withoutLogin));
    }

    // =====================================================================
    // 서버의 다른 쓰임과 같은 목록(명세: 지금 따로 있던 목록은 모두 이 목록에서 만든다, 가격은 정가)
    // =====================================================================

    @Test
    void c8_soldItemsAndRegularPricesMatchTheHomeShoppingList() throws Exception {
        String token = newUserToken("c8");
        HttpResponse<String> shop = client.send(
                HttpRequest.newBuilder(uri("/api/home-shopping")).header("Authorization", "Bearer " + token).GET().build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(shop.statusCode()).as("C8 GET /api/home-shopping, body %s", shop.body()).isEqualTo(200);

        Map<String, Integer> shopPrices = new HashMap<>();
        for (JsonNode item : JSON.readTree(shop.body()).get("items")) {
            shopPrices.put(item.path("type").asText(), item.path("price").asInt());
        }
        Map<String, Integer> catalogPrices = new HashMap<>();
        for (JsonNode item : catalog().get("items")) {
            if (item.hasNonNull("price")) {
                catalogPrices.put(item.path("id").asText(), item.get("price").asInt());
            }
        }
        assertThat(catalogPrices).as("C8 catalog prices = home shopping regular prices").isEqualTo(shopPrices);
    }

    // =====================================================================
    // 도우미
    // =====================================================================

    private JsonNode catalog() throws Exception {
        HttpResponse<String> response = get(null);
        assertThat(response.statusCode()).as("GET %s, body %s", PATH, response.body()).isEqualTo(200);
        return JSON.readTree(response.body());
    }

    private static Map<String, JsonNode> byId(JsonNode body) {
        Map<String, JsonNode> byId = new LinkedHashMap<>();
        JsonNode items = body.get("items");
        if (items != null) {
            for (JsonNode item : items) {
                byId.put(item.path("id").asText(), item);
            }
        }
        return byId;
    }

    private static Set<String> fieldNames(JsonNode node) {
        Set<String> names = new LinkedHashSet<>();
        if (node != null) {
            node.fieldNames().forEachRemaining(names::add);
        }
        return names;
    }

    /** 칸이 글이면 그 값, null이거나 없으면 null. 글이 아닌 값이면 그 JSON 글(틀린 값으로 드러나게). */
    private static String textOrNull(JsonNode item, String key) {
        JsonNode value = item.get(key);
        if (value == null || value.isNull()) {
            return null;
        }
        return value.isTextual() ? value.textValue() : value.toString();
    }

    private static void assertNullableInt(JsonNode item, String key, Integer expected, String label) {
        if (expected == null) {
            assertThat(item.has(key) && item.get(key).isNull()).as("%s %s is null: %s", label, key, item).isTrue();
        } else {
            assertThat(item.path(key).isIntegralNumber()).as("%s %s is an integer: %s", label, key, item).isTrue();
            assertThat(item.get(key).asInt()).as("%s %s", label, key).isEqualTo(expected);
        }
    }

    private String newUserToken(String tag) throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        String email = "qa-090c-" + tag + "-" + suffix + "@example.com";
        String password = "qa-pass-" + suffix;
        jdbc.update(
                "INSERT INTO users (email, password_hash, display_name, email_verified, verified_at) VALUES (?, ?, ?, 1, NOW())",
                email, passwordEncoder.encode(password), "qa-090c-" + tag + "-" + suffix);
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
        HttpRequest.Builder request = HttpRequest.newBuilder(uri(PATH)).GET();
        if (token != null) {
            request.header("Authorization", "Bearer " + token);
        }
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private URI uri(String path) {
        return URI.create(rest.getRootUri() + path);
    }
}
