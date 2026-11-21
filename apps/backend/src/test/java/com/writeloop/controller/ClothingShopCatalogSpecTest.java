package com.writeloop.controller;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.writeloop.support.IntegrationTestSupport;
import java.io.File;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
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
 * [spec] 작업 133 ③ 피팅룸(양 층) 서버 아이템 목록, 시나리오 06-피팅룸-양층/02-qa-scenarios.md의 A1~A12.
 * 기대값은 시나리오와 앱 자산 clothing-shop-stock.json(미등록 13종의 id, nameKO, category, wear, wearableSHA256)에서만 가져온다.
 * 기준 커밋 01be6ec의 items.json은 "등록된 9종, 기존 항목은 그대로"(A7, A12)를 견주는 데만 쓴다.
 */
class ClothingShopCatalogSpecTest extends IntegrationTestSupport {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String BASE = "01be6ec";
    private static final String ITEMS_PATH = "apps/backend/src/main/resources/catalog/items.json";
    private static final String STOCK_PATH = "apps/mobile/src/lib/lobby3d/clothing-shop-stock.json";
    private static final String FILES_PATH = "apps/backend/src/main/resources/catalog/files";
    private static final List<String> NINE = List.of(
            "tshirtOrange", "shortsNavy", "shoesWhite", "capOrange", "shoesBrown", "capBlue", "mufflerRed", "backpackRed", "necklaceGold");

    private final HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();

    @Autowired
    private PasswordEncoder passwordEncoder;

    private static Path repo() {
        Path dir = new File("").toPath().toAbsolutePath();
        while (dir != null && !Files.exists(dir.resolve(STOCK_PATH))) {
            dir = dir.getParent();
        }
        assertThat(dir).as("repo root").isNotNull();
        return dir;
    }

    private static JsonNode stock() throws Exception {
        return JSON.readTree(repo().resolve(STOCK_PATH).toFile());
    }

    /** stock.json의 미등록(catalogId null) 상품. */
    private static List<JsonNode> unregistered() throws Exception {
        List<JsonNode> list = new ArrayList<>();
        for (JsonNode product : stock().get("products")) {
            if (product.get("catalogId").isNull()) {
                list.add(product);
            }
        }
        return list;
    }

    private static JsonNode itemsFile() throws Exception {
        return JSON.readTree(repo().resolve(ITEMS_PATH).toFile());
    }

    private static JsonNode baseItemsFile() throws Exception {
        Process process = new ProcessBuilder("git", "show", BASE + ":" + ITEMS_PATH).directory(repo().toFile()).start();
        JsonNode json = JSON.readTree(process.getInputStream());
        assertThat(process.waitFor()).as("git show %s", BASE).isZero();
        return json;
    }

    private static Map<String, JsonNode> byId(JsonNode catalog) {
        Map<String, JsonNode> map = new LinkedHashMap<>();
        for (JsonNode item : catalog.get("items")) {
            map.put(item.path("id").asText(), item);
        }
        return map;
    }

    private static String sha256(byte[] bytes) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }

    @Test
    void a1_thirteenUnregisteredClothesAreListedAsWearables() throws Exception {
        List<JsonNode> products = unregistered();
        assertThat(products).as("stock.json unregistered products").hasSize(13);
        Map<String, JsonNode> items = byId(itemsFile());
        for (JsonNode product : products) {
            String id = product.get("id").asText();
            assertThat(items).as("A1 %s listed", id).containsKey(id);
            assertThat(items.get(id).path("kind").asText()).as("A1 kind of %s", id).isEqualTo("wearable");
        }
    }

    @Test
    void a2_a3_a4_thirteenHaveNoPriceNoCategoryAndStockSlotDrawAndNames() throws Exception {
        Map<String, JsonNode> items = byId(itemsFile());
        for (JsonNode product : unregistered()) {
            String id = product.get("id").asText();
            JsonNode item = items.get(id);
            assertThat(item).as("A2 %s present", id).isNotNull();
            assertThat(item.path("price").isNull()).as("A2 price of %s is null: %s", id, item).isTrue();
            assertThat(item.path("category").isNull()).as("A2 category of %s is null: %s", id, item).isTrue();
            assertThat(item.path("slot").asText()).as("A3 slot of %s", id).isEqualTo(product.path("category").asText());
            assertThat(item.get("draw")).as("A3 draw of %s", id).isEqualTo(product.get("wear"));
            assertThat(item.path("name").asText()).as("A4 name of %s", id).isEqualTo(product.path("nameKO").asText());
            assertThat(item.path("shopName").asText()).as("A4 shopName of %s", id).isEqualTo(product.path("nameKO").asText());
            assertThat(item.path("description").asText()).as("A4 description of %s", id).isEmpty();
        }
    }

    @Test
    void a5_a6_modelFileNameIsTheWearableOriginalWithNoIconAndBytesMatchTheArchive() throws Exception {
        Map<String, JsonNode> items = byId(itemsFile());
        for (JsonNode product : unregistered()) {
            String id = product.get("id").asText();
            JsonNode files = items.get(id).path("files");
            assertThat(files.path("model").asText()).as("A5 model of %s", id).isEqualTo(id + ".glb");
            assertThat(files.hasNonNull("icon")).as("A5 %s has no icon: %s", id, files).isFalse();
            Path file = repo().resolve(FILES_PATH).resolve(id + ".glb");
            assertThat(Files.exists(file)).as("A6 file of %s exists", id).isTrue();
            assertThat(sha256(Files.readAllBytes(file))).as("A6 sha256 of %s", id).isEqualTo(product.path("wearableSHA256").asText());
        }
    }

    @Test
    void a7_a8_a12_theNineRegisteredAndEveryOtherItemAreUnchangedAndTheirModelsMatchTheArchive() throws Exception {
        List<String> thirteen = new ArrayList<>();
        unregistered().forEach(p -> thirteen.add(p.get("id").asText()));
        JsonNode now = itemsFile();
        JsonNode base = baseItemsFile();
        List<JsonNode> others = new ArrayList<>();
        for (JsonNode item : now.get("items")) {
            if (!thirteen.contains(item.path("id").asText())) {
                others.add(item);
            }
        }
        List<JsonNode> baseItems = new ArrayList<>();
        base.get("items").forEach(baseItems::add);
        assertThat(others).as("A7, A12 items other than the thirteen equal the base items in order").isEqualTo(baseItems);
        assertThat(now.get("_comment")).as("header comment").isEqualTo(base.get("_comment"));
        Map<String, Integer> prices = Map.of("tshirtOrange", 80, "shortsNavy", 70, "shoesWhite", 90, "capOrange", 60, "shoesBrown", 90,
                "capBlue", 60, "mufflerRed", 90, "backpackRed", 120, "necklaceGold", 110);
        Map<String, JsonNode> items = byId(now);
        for (String id : NINE) {
            assertThat(items.get(id).path("price").asInt()).as("A7 price of %s", id).isEqualTo(prices.get(id));
        }
        // A8: the archive wearable of each registered one (stock.json wearableSHA256) equals the server model bytes
        int checked = 0;
        for (JsonNode product : stock().get("products")) {
            String catalogId = product.path("catalogId").asText("");
            if (!NINE.contains(catalogId)) {
                continue;
            }
            String model = items.get(catalogId).path("files").path("model").asText();
            Path file = repo().resolve(FILES_PATH).resolve(model);
            assertThat(sha256(Files.readAllBytes(file))).as("A8 model of %s", catalogId).isEqualTo(product.path("wearableSHA256").asText());
            checked++;
        }
        assertThat(checked).as("A8 registered wearables checked").isEqualTo(9);
    }

    @Test
    void a11_responseListsTheThirteenWithTheSameFieldsAsOtherWearables() throws Exception {
        HttpResponse<String> response = send(null, "GET", "/api/catalog", null);
        assertThat(response.statusCode()).as("GET /api/catalog").isEqualTo(200);
        Map<String, JsonNode> items = byId(JSON.readTree(response.body()));
        Set<String> fieldsOfOther = fieldNames(items.get("tshirtOrange"));
        for (JsonNode product : unregistered()) {
            String id = product.get("id").asText();
            JsonNode item = items.get(id);
            assertThat(item).as("A11 %s in response", id).isNotNull();
            assertThat(fieldNames(item)).as("A11 fields of %s", id).isEqualTo(fieldsOfOther);
            assertThat(item.path("kind").asText()).isEqualTo("wearable");
            assertThat(item.path("price").isNull()).as("A11 price of %s", id).isTrue();
            assertThat(item.path("assets").path("model").path("url").asText()).as("A11 model url of %s", id).startsWith("/api/catalog/files/");
        }
        assertThat(items.get("tshirtOrange").path("price").asInt()).isEqualTo(80);
    }

    @Test
    void a9_a10_thirteenAreNotSoldCannotBeOrderedAndAreNotInANewWardrobe() throws Exception {
        List<String> ids = new ArrayList<>();
        unregistered().forEach(p -> ids.add(p.get("id").asText()));
        String token = newUserToken("a9");
        HttpResponse<String> shop = send(token, "GET", "/api/home-shopping", null);
        assertThat(shop.statusCode()).as("home-shopping, body %s", shop.body()).isEqualTo(200);
        List<String> types = new ArrayList<>();
        for (JsonNode item : JSON.readTree(shop.body()).get("items")) {
            types.add(item.path("type").asText());
        }
        assertThat(types).as("A9 none of the thirteen is sold").doesNotContainAnyElementsOf(ids);
        for (String id : ids) {
            ObjectNode order = JSON.createObjectNode().put("type", id).put("price", 100);
            HttpResponse<String> response = send(token, "POST", "/api/home-shopping/orders", order);
            assertThat(response.statusCode()).as("A9 order %s, body %s", id, response.body()).isEqualTo(400);
        }
        HttpResponse<String> wardrobe = send(token, "GET", "/api/wardrobe", null);
        assertThat(wardrobe.statusCode()).as("A10 wardrobe").isEqualTo(200);
        List<String> owned = new ArrayList<>();
        for (JsonNode item : JSON.readTree(wardrobe.body()).get("items")) {
            owned.add(item.path("type").asText());
        }
        assertThat(owned).as("A10 none of the thirteen is in a new wardrobe").doesNotContainAnyElementsOf(ids);
    }

    // ---- helpers ----

    private static Set<String> fieldNames(JsonNode node) {
        Set<String> names = new LinkedHashSet<>();
        node.fieldNames().forEachRemaining(names::add);
        return names;
    }

    private HttpResponse<String> send(String token, String method, String path, JsonNode body) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(rest.getRootUri() + path));
        if (token != null) {
            request.header("Authorization", "Bearer " + token);
        }
        if (body == null) {
            request.method(method, HttpRequest.BodyPublishers.noBody());
        } else {
            request.header("Content-Type", "application/json").method(method, HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body)));
        }
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private String newUserToken(String tag) throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        String email = "qa-133-" + tag + "-" + suffix + "@example.com";
        String password = "qa-pass-" + suffix;
        jdbc.update("INSERT INTO users (email, password_hash, display_name, email_verified, verified_at) VALUES (?, ?, ?, 1, NOW())",
                email, passwordEncoder.encode(password), "qa-133-" + tag + "-" + suffix);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("email", email);
        body.put("password", password);
        HttpResponse<String> login = client.send(
                HttpRequest.newBuilder(URI.create(rest.getRootUri() + "/api/auth/token/login")).header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body))).build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(login.statusCode()).as("login, body %s", login.body()).isEqualTo(200);
        return JSON.readTree(login.body()).path("accessToken").asText();
    }
}
