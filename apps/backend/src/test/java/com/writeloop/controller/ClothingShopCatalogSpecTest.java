package com.writeloop.controller;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.writeloop.service.ItemCatalogHumanWearablesSpecTest;
import com.writeloop.service.ItemCatalogHumanWearablesSpecTest.Human;
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
 * 작업 134 ② 결정 04(사용자 "새 목록대로 고침"): 서버 목록의 옷이 사람형 모델·그리기 정보(body 2, hide)로 바뀌었다. 앱의 옷집 재고 파일은
 * 그대로(body 1, 옛 해시)라 draw·모델 해시의 기대값은 stock.json이 아니라 human-wardrobe.json 값(ItemCatalogHumanWearablesSpecTest.HUMANS)이다.
 * 이름·부위·가격·분류는 그대로 stock.json·기준 커밋과 견준다.
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

    private static Human human(String id) {
        return ItemCatalogHumanWearablesSpecTest.HUMANS.stream().filter(h -> h.id().equals(id)).findFirst().orElseThrow();
    }

    /** 사람형 그리기 정보(body 2, 부착·뼈·좌우·색, 숨길 기본 메시). */
    private static ObjectNode humanDraw(Human h) {
        ObjectNode draw = JSON.createObjectNode();
        draw.put("attach", h.attach());
        if (h.bone() != null) {
            draw.put("bone", h.bone());
        }
        if (h.mirror() != null) {
            draw.put("mirror", h.mirror());
        }
        if (h.color() != null) {
            draw.put("color", h.color());
        }
        draw.put("body", 2);
        com.fasterxml.jackson.databind.node.ArrayNode hide = draw.putArray("hide");
        h.hide().forEach(hide::add);
        return draw;
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
            assertThat(item.get("draw")).as("A3 draw of %s (사람형: body 2, hide)", id).isEqualTo(humanDraw(human(id)));
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
            assertThat(files.path("icon").asText()).as("A5 %s icon (09: 아이콘이 있다): %s", id, files).isEqualTo(id + ".png");
            Path file = repo().resolve(FILES_PATH).resolve(id + ".glb");
            assertThat(Files.exists(file)).as("A6 file of %s exists", id).isTrue();
            assertThat(sha256(Files.readAllBytes(file))).as("A6 sha256 of %s (사람형 모델)", id).isEqualTo(human(id).sha256());
            assertThat((long) Files.readAllBytes(file).length).as("A6 bytes of %s", id).isEqualTo(human(id).bytes());
        }
    }

    @Test
    void a7_a8_a12_theNineRegisteredAndEveryOtherItemAreUnchangedAndTheirModelsMatchTheArchive() throws Exception {
        List<String> thirteen = new ArrayList<>();
        unregistered().forEach(p -> thirteen.add(p.get("id").asText()));
        JsonNode now = itemsFile();
        JsonNode base = baseItemsFile();
        // 작업 134 ② 결정 04: 열세 종과 새 사람형 옷 다섯 밖의 항목은 기준 항목과 같고 순서도 같다. 사람형으로 바뀐 열여섯 옷은
        // 그리기 정보(draw)와 모델 파일 이름(files.model)만 빼고 같다. 조끼(vestGreen)·고글은 통째로 같다.
        List<String> humanBase = new ArrayList<>();
        ItemCatalogHumanWearablesSpecTest.HUMANS.stream().filter(h -> !h.isNew() && !thirteen.contains(h.id())).forEach(h -> humanBase.add(h.id()));
        assertThat(humanBase).as("setup: sixteen clothes of the Laroop body").hasSize(16);
        List<JsonNode> others = new ArrayList<>();
        for (JsonNode item : now.get("items")) {
            String id = item.path("id").asText();
            if (!thirteen.contains(id) && !ItemCatalogHumanWearablesSpecTest.NEW_NAMES.containsKey(id)) {
                others.add(stripHumanFields(item, humanBase.contains(id)));
            }
        }
        List<JsonNode> baseItems = new ArrayList<>();
        for (JsonNode item : base.get("items")) {
            baseItems.add(stripHumanFields(item, humanBase.contains(item.path("id").asText())));
        }
        assertThat(others).as("A7, A12 items other than the thirteen and the five new equal the base items in order").isEqualTo(baseItems);
        assertThat(now.get("_comment") != null && now.get("_comment").isTextual()).as("header comment is still a text").isTrue();
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
            assertThat(sha256(Files.readAllBytes(file))).as("A8 model of %s (사람형 모델)", catalogId).isEqualTo(human(catalogId).sha256());
            checked++;
        }
        assertThat(checked).as("A8 registered wearables checked").isEqualTo(9);
    }

    /** 사람형으로 바뀌는 옷이면 draw와 files.model을 뺀 사본(바뀌지 않는 칸만 견주려고). */
    private static JsonNode stripHumanFields(JsonNode item, boolean human) {
        if (!human) {
            return item;
        }
        ObjectNode copy = ((ObjectNode) item).deepCopy();
        copy.remove("draw");
        if (copy.has("files")) {
            ((ObjectNode) copy.get("files")).remove("model");
        }
        return copy;
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
