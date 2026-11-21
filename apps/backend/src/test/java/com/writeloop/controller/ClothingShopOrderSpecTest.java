package com.writeloop.controller;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.persistence.WardrobeItemEntity;
import com.writeloop.persistence.WardrobeItemRepository;
import com.writeloop.support.IntegrationTestSupport;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
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
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * [spec] 작업 133 ④ 옷집 계산대 주문 API, 백엔드. 시나리오 07-계산대-구매/02-qa-scenarios.md(S1~S24)에서만 기대값을 가져왔다.
 * 가격은 명세의 서버 아이템 목록 값(tshirtOrange 80, shortsNavy 70, shoesWhite 90, capOrange 60 ...).
 * 진열 아님 예시는 서버 목록에는 있으나 옷집 stock.json에 없는 capGreen이다.
 */
class ClothingShopOrderSpecTest extends IntegrationTestSupport {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String NOT_ON_DISPLAY = "옷집에 진열하지 않은 옷이에요.";
    private static final String NOT_FOR_SALE = "판매 준비 중인 옷이에요.";
    private static final String OWNED = "이미 가진 옷이에요.";
    private static final String PRICE_CHANGED = "가격이 바뀌었어요. 다시 확인해 주세요.";
    private static final String NOT_ENOUGH = "룹이 모자라요.";
    private static final String INVALID = "주문 내용이 맞지 않아요.";

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private WardrobeItemRepository wardrobeItemRepository;

    private final HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();

    // S1
    @Test
    void s1_stockFileSameAsAppAndNineSellable() throws Exception {
        Path app = Path.of("..", "mobile", "src", "lib", "lobby3d", "clothing-shop-stock.json");
        Path server = Path.of("src", "main", "resources", "catalog", "clothing-shop-stock.json");
        assertThat(Files.readAllBytes(server)).as("S1 byte equal").isEqualTo(Files.readAllBytes(app));
        JsonNode products = JSON.readTree(Files.readAllBytes(server)).path("products");
        int linked = 0;
        for (JsonNode p : products) {
            if (!p.path("catalogId").isNull() && !p.path("catalogId").isMissingNode()) {
                linked++;
            }
        }
        assertThat(linked).as("S1 catalogId count").isEqualTo(9);
    }

    // S2
    @Test
    void s2_buyOne() throws Exception {
        TestUser u = newUser("s2");
        setBalance(u, 500);
        HttpResponse<String> r = post(u.token(), items(item("tshirtOrange", 80)));
        assertThat(r.statusCode()).as(r.body()).isEqualTo(200);
        JsonNode b = JSON.readTree(r.body());
        assertThat(b.path("items").size()).isEqualTo(1);
        assertThat(b.path("items").get(0).path("type").asText()).isEqualTo("tshirtOrange");
        assertThat(b.path("items").get(0).path("price").asInt()).isEqualTo(80);
        assertThat(b.path("total").asInt()).isEqualTo(80);
        assertThat(b.path("balance").asInt()).isEqualTo(420);
        assertThat(balanceRow(u.id())).isEqualTo(420);
        assertThat(ownedTypes(b.path("wardrobe"))).contains("tshirtOrange");
        assertThat(wardrobeRows(u.id())).contains("tshirtOrange");
        assertThat(purchases(u.id())).containsExactly("tshirtOrange:80");
        assertThat(negativeAmounts(u.id())).containsExactly(-80);
    }

    // S3, S22
    @Test
    void s3_s22_buyTwoAndResponseShape() throws Exception {
        TestUser u = newUser("s3");
        setBalance(u, 500);
        HttpResponse<String> r = post(u.token(), items(item("tshirtOrange", 80), item("shortsNavy", 70)));
        assertThat(r.statusCode()).as(r.body()).isEqualTo(200);
        JsonNode b = JSON.readTree(r.body());
        List<String> keys = new ArrayList<>();
        b.fieldNames().forEachRemaining(keys::add);
        assertThat(keys).containsExactlyInAnyOrder("items", "total", "balance", "wardrobe");
        assertThat(b.path("items").size()).isEqualTo(2);
        assertThat(b.path("total").asInt()).isEqualTo(150);
        assertThat(b.path("balance").asInt()).isEqualTo(350);
        assertThat(balanceRow(u.id())).isEqualTo(350);
        assertThat(wardrobeRows(u.id())).contains("tshirtOrange", "shortsNavy");
        assertThat(purchases(u.id())).containsExactlyInAnyOrder("tshirtOrange:80", "shortsNavy:70");
        assertThat(negativeAmounts(u.id())).containsExactlyInAnyOrder(-80, -70);
        HttpResponse<String> get = get(u.token(), "/api/wardrobe");
        // 얻은 때(acquiredAt)의 소수 자리는 DB에서 읽으면 잘리므로 견주지 않는다
        JsonNode fromGet = JSON.readTree(get.body());
        assertThat(ownedTypes(b.path("wardrobe"))).as("S22 items").isEqualTo(ownedTypes(fromGet));
        assertThat(b.path("wardrobe").path("equipped")).as("S22 equipped").isEqualTo(fromGet.path("equipped"));
    }

    // S4
    @Test
    void s4_balanceEqualsTotal() throws Exception {
        TestUser u = newUser("s4");
        setBalance(u, 80);
        HttpResponse<String> r = post(u.token(), items(item("tshirtOrange", 80)));
        assertThat(r.statusCode()).as(r.body()).isEqualTo(200);
        assertThat(JSON.readTree(r.body()).path("balance").asInt()).isEqualTo(0);
    }

    // S5
    @Test
    void s5_notEnough() throws Exception {
        TestUser u = newUser("s5");
        setBalance(u, 79);
        rejected(u, items(item("tshirtOrange", 80)), 409, "NOT_ENOUGH_LOOP_POINTS", NOT_ENOUGH, 79);
    }

    // S6
    @Test
    void s6_allOrNothingOnLoopPoints() throws Exception {
        TestUser u = newUser("s6");
        setBalance(u, 100);
        rejected(u, items(item("tshirtOrange", 80), item("shortsNavy", 70)), 409, "NOT_ENOUGH_LOOP_POINTS", NOT_ENOUGH, 100);
    }

    // S7
    @Test
    void s7_notOnDisplay() throws Exception {
        TestUser u = newUser("s7");
        setBalance(u, 500);
        rejected(u, items(item("capGreen", 60)), 409, "NOT_ON_DISPLAY", NOT_ON_DISPLAY, 500);
        rejected(u, items(item("no-such-thing", 60)), 409, "NOT_ON_DISPLAY", NOT_ON_DISPLAY, 500);
    }

    // S8, S9
    @Test
    void s8_s9_unregisteredNotForSale() throws Exception {
        TestUser u = newUser("s8");
        setBalance(u, 500);
        rejected(u, items(item("wear-top-kiln-jacket", 80)), 409, "NOT_FOR_SALE", NOT_FOR_SALE, 500);
        rejected(u, items(item("wear-face-honey-panto", 0)), 409, "NOT_FOR_SALE", NOT_FOR_SALE, 500);
    }

    // S10
    @Test
    void s10_alreadyOwned() throws Exception {
        TestUser u = newUser("s10");
        setBalance(u, 500);
        own(u, "tshirtOrange");
        rejected(u, items(item("tshirtOrange", 80)), 409, "ALREADY_OWNED", OWNED, 500);
    }

    // S11, S12
    @Test
    void s11_s12_priceChanged() throws Exception {
        TestUser u = newUser("s11");
        setBalance(u, 500);
        rejected(u, items(item("tshirtOrange", 79)), 409, "PRICE_CHANGED", PRICE_CHANGED, 500);
        // 홈쇼핑 방송 할인가(capOrange 60 -> 48)도 받지 않는다
        rejected(u, items(item("capOrange", 48)), 409, "PRICE_CHANGED", PRICE_CHANGED, 500);
    }

    // S13~S17
    @Test
    void s13_s17_invalidOrders() throws Exception {
        TestUser u = newUser("s13");
        setBalance(u, 500);
        rejected(u, items(), 400, "INVALID_ORDER", INVALID, 500);
        rejected(u, new LinkedHashMap<>(), 400, "INVALID_ORDER", INVALID, 500);
        Map<String, Object> nul = new LinkedHashMap<>();
        nul.put("items", null);
        rejected(u, nul, 400, "INVALID_ORDER", INVALID, 500);
        rejected(u, items(item("tshirtOrange", 80), item("tshirtOrange", 80)), 400, "INVALID_ORDER", INVALID, 500);
        Map<String, Object> noType = new LinkedHashMap<>();
        noType.put("price", 80);
        rejected(u, items(noType), 400, "INVALID_ORDER", INVALID, 500);
        Map<String, Object> noPrice = new LinkedHashMap<>();
        noPrice.put("type", "tshirtOrange");
        rejected(u, items(noPrice), 400, "INVALID_ORDER", INVALID, 500);
    }

    // S18, S19
    @Test
    void s18_s19_allOrNothingOnItems() throws Exception {
        TestUser u = newUser("s18");
        setBalance(u, 1000);
        own(u, "shortsNavy");
        rejected(u, items(item("tshirtOrange", 80), item("shortsNavy", 70)), 409, "ALREADY_OWNED", OWNED, 1000);
        rejected(u, items(item("tshirtOrange", 80), item("shoesWhite", 91)), 409, "PRICE_CHANGED", PRICE_CHANGED, 1000);
        rejected(u, items(item("tshirtOrange", 80), item("capGreen", 60)), 409, "NOT_ON_DISPLAY", NOT_ON_DISPLAY, 1000);
        assertThat(wardrobeRows(u.id())).doesNotContain("tshirtOrange");
    }

    // S20
    @Test
    void s20_loginRequired() throws Exception {
        HttpResponse<String> r = post(null, items(item("tshirtOrange", 80)));
        assertThat(r.statusCode()).as(r.body()).isEqualTo(401);
    }

    // S21
    @Test
    void s21_concurrentSameOrder() throws Exception {
        TestUser u = newUser("s21");
        setBalance(u, 80);
        List<Callable<HttpResponse<String>>> calls = new ArrayList<>();
        for (int i = 0; i < 2; i++) {
            calls.add(() -> post(u.token(), items(item("tshirtOrange", 80))));
        }
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        List<HttpResponse<String>> responses = new ArrayList<>();
        try {
            List<Future<HttpResponse<String>>> futures = new ArrayList<>();
            for (Callable<HttpResponse<String>> call : calls) {
                futures.add(pool.submit(() -> {
                    start.await();
                    return call.call();
                }));
            }
            start.countDown();
            for (Future<HttpResponse<String>> f : futures) {
                responses.add(f.get(60, TimeUnit.SECONDS));
            }
        } finally {
            pool.shutdownNow();
        }
        List<Integer> statuses = responses.stream().map(HttpResponse::statusCode).toList();
        assertThat(statuses).as("S21 %s", responses.stream().map(HttpResponse::body).toList()).containsExactlyInAnyOrder(200, 409);
        for (HttpResponse<String> r : responses) {
            if (r.statusCode() == 409) {
                assertThat(List.of("ALREADY_OWNED", "NOT_ENOUGH_LOOP_POINTS")).contains(JSON.readTree(r.body()).path("code").asText());
            }
        }
        assertThat(balanceRow(u.id())).isEqualTo(0);
        assertThat(purchases(u.id())).containsExactly("tshirtOrange:80");
    }

    // S23
    @Test
    void s23_homeShoppingListUnchanged() throws Exception {
        TestUser u = newUser("s23");
        HttpResponse<String> r = get(u.token(), "/api/home-shopping");
        assertThat(r.statusCode()).isEqualTo(200);
        List<String> types = new ArrayList<>();
        JSON.readTree(r.body()).path("items").forEach(i -> types.add(i.path("type").asText()));
        assertThat(types).hasSize(26);
        assertThat(types).noneMatch(t -> t.startsWith("wear-"));
        assertThat(get(u.token(), "/api/wardrobe").statusCode()).isEqualTo(200);
    }

    // ---- 도움 함수 ----

    private void rejected(TestUser u, Map<String, Object> body, int status, String code, String message, int balance) throws Exception {
        List<String> ownedBefore = wardrobeRows(u.id());
        JsonNode wardrobeBefore = JSON.readTree(get(u.token(), "/api/wardrobe").body());
        HttpResponse<String> r = post(u.token(), body);
        assertThat(r.statusCode()).as(r.body()).isEqualTo(status);
        JsonNode e = JSON.readTree(r.body());
        assertThat(e.path("code").asText()).isEqualTo(code);
        assertThat(e.path("message").asText()).isEqualTo(message);
        assertThat(balanceRow(u.id())).isEqualTo(balance);
        assertThat(wardrobeRows(u.id())).isEqualTo(ownedBefore);
        assertThat(purchases(u.id())).isEmpty();
        assertThat(negativeAmounts(u.id())).isEmpty();
        assertThat(JSON.readTree(get(u.token(), "/api/wardrobe").body())).isEqualTo(wardrobeBefore);
    }

    private static Map<String, Object> item(String type, int price) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", type);
        m.put("price", price);
        return m;
    }

    @SafeVarargs
    private static Map<String, Object> items(Map<String, Object>... list) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("items", List.of(list));
        return m;
    }

    private static List<String> ownedTypes(JsonNode wardrobe) {
        List<String> list = new ArrayList<>();
        wardrobe.path("items").forEach(i -> list.add(i.path("type").asText()));
        return list;
    }

    private void own(TestUser u, String type) {
        wardrobeItemRepository.saveAndFlush(new WardrobeItemEntity(u.id(), type, Instant.parse("2026-11-01T00:00:00Z")));
    }

    private void setBalance(TestUser u, int balance) throws Exception {
        assertThat(get(u.token(), "/api/loop-points").statusCode()).isEqualTo(200);
        jdbc.update("UPDATE loop_point_balances SET balance = ? WHERE user_id = ?", balance, u.id());
    }

    private int balanceRow(long id) {
        return jdbc.queryForObject("SELECT balance FROM loop_point_balances WHERE user_id = ?", Integer.class, id);
    }

    private List<Integer> negativeAmounts(long id) {
        return jdbc.queryForList("SELECT amount FROM loop_point_entries WHERE user_id = ? AND amount < 0 ORDER BY id", Integer.class, id);
    }

    private List<String> purchases(long id) {
        return jdbc.queryForList("SELECT CONCAT(furniture_type, ':', price) FROM home_shopping_orders WHERE user_id = ? ORDER BY id", String.class, id);
    }

    private List<String> wardrobeRows(long id) {
        return jdbc.queryForList("SELECT item_type FROM wardrobe_items WHERE user_id = ? ORDER BY id", String.class, id);
    }

    private record TestUser(long id, String token) {
    }

    private TestUser newUser(String tag) throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        String email = "qa-133d-" + tag + "-" + suffix + "@example.com";
        String password = "qa-pass-" + suffix;
        jdbc.update(
                "INSERT INTO users (email, password_hash, display_name, email_verified, verified_at) VALUES (?, ?, ?, 1, NOW())",
                email, passwordEncoder.encode(password), "qa-133d-" + tag + "-" + suffix);
        long id = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", Long.class, email);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("email", email);
        body.put("password", password);
        HttpResponse<String> login = client.send(
                HttpRequest.newBuilder(uri("/api/auth/token/login"))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body))).build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(login.statusCode()).as(login.body()).isEqualTo(200);
        return new TestUser(id, JSON.readTree(login.body()).path("accessToken").asText());
    }

    private HttpResponse<String> post(String token, Map<String, Object> body) throws Exception {
        HttpRequest.Builder b = HttpRequest.newBuilder(uri("/api/clothing-shop/orders"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body)));
        if (token != null) {
            b.header("Authorization", "Bearer " + token);
        }
        return client.send(b.build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> get(String token, String path) throws Exception {
        return client.send(HttpRequest.newBuilder(uri(path)).GET().header("Authorization", "Bearer " + token).build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private URI uri(String path) {
        return URI.create(rest.getRootUri() + path);
    }
}
