package com.writeloop.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.writeloop.support.IntegrationTestSupport;
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
 * [spec] 작업 128 가구점 실내, 백엔드 시나리오 B1~B9(08-qa-scenarios.md: 가구점 모델을 서버 목록에서 받기). 14 결정으로 실내·버들은 앱 자산이라
 * 서버 목록에는 진열 상품 셋만 남고(B2는 "실내·버들·asset 종류가 서버에 없다"로 바뀜), B1·B6·B7·B8·B9는 상품 셋 기준으로 고쳤다.
 * B10(개수를 고정한 기존 테스트 고치기)은 CatalogControllerSpecTest·CatalogFilesSpecTest·ItemCatalogDrawSpecTest에서 했다.
 * B5(파일 없는 asset 항목은 검사 실패)는 목록을 다른 파일로 읽는 진입점이 없어 옮기지 못했다.
 */
class CatalogShopModelsSpecTest extends IntegrationTestSupport {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Path FILES_DIR = Path.of("src/main/resources/catalog/files");

    /** id -> {파일 이름, 크기(바이트), 원본 경로(이 컴퓨터에 있을 때만 바이트 대조)} */
    private static final Map<String, String[]> FILES = new LinkedHashMap<>();

    static {
        FILES.put("rainbootPlanter", new String[] {"rainboot-planter.glb", "265740",
                "C:/WriteLoop-asset/가구/가구점/화분/장화화분/rainboot-planter.glb"});
        FILES.put("catPostDesk", new String[] {"cat-post-desk.glb", "697104",
                "C:/WriteLoop-asset/가구/가구점/책상/고양이편지책상/cat-post-desk.glb"});
        FILES.put("stargazerBed", new String[] {"stargazer-bed.glb", "295452",
                "C:/WriteLoop-asset/가구/가구점/침대/별지기침대/stargazer-bed.glb"});
        FILES.put("walnutBed", new String[] {"walnut-bed.glb", "263104",
                "C:/WriteLoop-asset/가구/가구점/침대/호두침대/walnut-bed.glb"});
        FILES.put("grandmasFloorBedding", new String[] {"grandmas-floor-bedding.glb", "1579488",
                "C:/WriteLoop-asset/가구/가구점/침대/이부자리/grandmas-floor-bedding.glb"});
        FILES.put("cloudDesk", new String[] {"cloud-desk.glb", "703352",
                "C:/WriteLoop-asset/가구/가구점/책상/구름책상/cloud-desk.glb"});
    }

    /** 14 결정: 실내·버들은 앱 자산이라 서버에 없다. */
    private static final List<String> MOVED_TO_APP = List.of("shopInterior", "shopkeeperBeodeul");
    private static final List<String> MOVED_FILES = List.of("shop-interior.glb", "shopkeeper-beodeul.glb");
    private static final List<String> PRODUCTS = List.of(
            "rainbootPlanter", "catPostDesk", "stargazerBed", "walnutBed", "grandmasFloorBedding", "cloudDesk");
    /** 작업 128의 상품 셋(배치 값 그대로. 새 셋의 draw는 CatalogNameplateSpecTest가 본다). */
    private static final List<String> OLD_THREE = List.of("walnutBed", "grandmasFloorBedding", "cloudDesk");

    @Autowired
    private PasswordEncoder passwordEncoder;

    private final HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();

    @Test
    void b1_threeProductFilesExistWithTheOriginalSizeAndBytesAndTheTwoMovedFilesAreGone() throws Exception {
        for (String name : MOVED_FILES) {
            assertThat(FILES_DIR.resolve(name)).as("B1 %s is not on the server (14 decision)", name).doesNotExist();
        }
        assertThat(FILES).as("B1 six product files").hasSize(6);
        for (Map.Entry<String, String[]> entry : FILES.entrySet()) {
            Path file = FILES_DIR.resolve(entry.getValue()[0]);
            assertThat(file).as("B1 %s exists", file).exists();
            assertThat(Files.size(file)).as("B1 size of %s", file).isEqualTo(Long.parseLong(entry.getValue()[1]));
            Path original = Path.of(entry.getValue()[2]);
            if (Files.exists(original)) {
                assertThat(Files.readAllBytes(file)).as("B1 %s is the original %s", file, original)
                        .isEqualTo(Files.readAllBytes(original));
            }
        }
    }

    @Test
    void b2_interiorAndBeodeulAreNotOnTheServerAndNoAssetKindExists() throws Exception {
        Map<String, JsonNode> items = itemsInFile();
        for (String id : MOVED_TO_APP) {
            assertThat(items).as("B2 %s is not in items.json", id).doesNotContainKey(id);
        }
        for (JsonNode item : items.values()) {
            assertThat(item.path("kind").asText()).as("B2 kind of %s", item.path("id").asText())
                    .isIn("furniture", "wearable");
        }
    }

    @Test
    void b3_productsAreFurnitureNotSoldNotStarterWithoutIcon() throws Exception {
        Map<String, JsonNode> items = itemsInFile();
        Map<String, String> names = Map.of("rainbootPlanter", "장화 화분", "catPostDesk", "고양이 편지 책상", "stargazerBed", "별지기 침대",
                "walnutBed", "호두 침대", "grandmasFloorBedding", "이부자리", "cloudDesk", "구름 책상");
        for (String id : PRODUCTS) {
            JsonNode item = items.get(id);
            assertThat(item).as("B3 %s in items.json", id).isNotNull();
            assertThat(item.path("kind").asText()).as("B3 kind of %s", id).isEqualTo("furniture");
            assertThat(item.path("name").asText()).as("B3 name of %s", id).isEqualTo(names.get(id));
            assertThat(item.path("files").path("model").asText()).as("B3 model file of %s", id).isEqualTo(FILES.get(id)[0]);
            for (String absent : List.of("price", "category", "starter")) {
                assertThat(item.hasNonNull(absent)).as("B3 %s has no %s: %s", id, absent, item).isFalse();
            }
            assertThat(item.path("files").hasNonNull("icon")).as("B3 %s has no icon: %s", id, item).isFalse();
        }
    }

    @Test
    void b4_productDrawValues() throws Exception {
        Map<String, JsonNode> items = itemsInFile();
        // id -> {바닥 가로, 바닥 깊이, 모델 가로, 높이, 깊이}
        Map<String, double[]> expected = Map.of(
                "walnutBed", new double[] {2, 3, 1.610, 1.296, 2.972},
                "grandmasFloorBedding", new double[] {2, 3, 1.879, 0.477, 2.935},
                "cloudDesk", new double[] {3, 2, 2.511, 1.292, 1.385});
        for (String id : OLD_THREE) {
            JsonNode draw = items.get(id).path("draw");
            double[] e = expected.get(id);
            assertThat(draw.path("size").path("width").asDouble()).as("B4 floor width of %s", id).isEqualTo(e[0]);
            assertThat(draw.path("size").path("depth").asDouble()).as("B4 floor depth of %s", id).isEqualTo(e[1]);
            assertThat(draw.path("blocksWalk").asBoolean(false)).as("B4 blocksWalk of %s", id).isTrue();
            assertThat(draw.path("removable").asBoolean(false)).as("B4 removable of %s", id).isTrue();
            JsonNode box = draw.path("model").path("box");
            assertThat(box.path("width").asDouble()).as("B4 model width of %s", id).isCloseTo(e[2], within(0.001));
            assertThat(box.path("height").asDouble()).as("B4 model height of %s", id).isCloseTo(e[3], within(0.001));
            assertThat(box.path("depth").asDouble()).as("B4 model depth of %s", id).isCloseTo(e[4], within(0.001));
            JsonNode shadow = draw.path("model").path("shadow").path("floor");
            assertThat(shadow.size()).as("B4 shadow of %s", id).isEqualTo(3);
            assertThat(shadow.get(0).asDouble()).as("B4 shadow width of %s", id).isCloseTo(e[2] + 0.1, within(0.001));
            // 이부자리는 07 결정대로 애셋 폴더 bed-placement.json의 값(깊이 3.055, 모델보다 0.12 넓다)을 따른다
            double shadowDepth = "grandmasFloorBedding".equals(id) ? 3.055 : e[4] + 0.1;
            assertThat(shadow.get(1).asDouble()).as("B4 shadow depth of %s", id).isCloseTo(shadowDepth, within(0.001));
            assertThat(shadow.get(2).asDouble()).as("B4 shadow strength of %s", id).isEqualTo(0.32);
        }
        assertThat(items.get("cloudDesk").path("draw").hasNonNull("surface")).as("B4 cloudDesk has no tabletop slots").isFalse();
    }

    @Test
    void b6_responseHasTheThreeProductsAndNoAssetKind() throws Exception {
        Map<String, JsonNode> byId = byId(catalog());
        for (String id : MOVED_TO_APP) {
            assertThat(byId).as("B6 %s not in response", id).doesNotContainKey(id);
        }
        for (String id : PRODUCTS) {
            JsonNode item = byId.get(id);
            assertThat(item).as("B6 %s in response", id).isNotNull();
            assertThat(item.path("kind").asText()).as("B6 kind of %s", id).isEqualTo("furniture");
            assertThat(item.path("assets").path("model").path("url").asText()).as("B6 url of %s", id)
                    .matches("/api/catalog/files/[0-9a-f]{64}\\.glb");
        }
        for (JsonNode item : byId.values()) {
            assertThat(item.path("kind").asText()).as("B6 kind of %s", item.path("id").asText())
                    .isIn("furniture", "wearable");
        }
    }

    @Test
    void b7_everyFileUrlServesTheSameBytesAsTheFile() throws Exception {
        Map<String, JsonNode> byId = byId(catalog());
        for (String id : FILES.keySet()) {
            JsonNode model = byId.get(id).path("assets").path("model");
            HttpResponse<byte[]> response = getBytes(model.path("url").asText());
            assertThat(response.statusCode()).as("B7 GET %s", id).isEqualTo(200);
            byte[] expected = Files.readAllBytes(FILES_DIR.resolve(FILES.get(id)[0]));
            assertThat(response.body()).as("B7 body of %s", id).isEqualTo(expected);
            assertThat(model.path("sha256").asText()).as("B7 sha256 of %s", id).isEqualTo(sha256(expected));
            assertThat(model.path("bytes").asLong()).as("B7 bytes of %s", id).isEqualTo(expected.length);
            assertThat(getBytes(model.path("url").asText()).body()).as("B7 again %s", id).isEqualTo(expected);
        }
    }

    @Test
    void b8_productsAreNotSoldNotOwnedNotPlaceableAndMovedModelsAreInNoList() throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        String email = "qa-128-" + suffix + "@example.com";
        String password = "qa-pass-" + suffix;
        jdbc.update(
                "INSERT INTO users (email, password_hash, display_name, email_verified, verified_at) VALUES (?, ?, ?, 1, NOW())",
                email, passwordEncoder.encode(password), "qa-128-" + suffix);
        Map<String, Object> login = new LinkedHashMap<>();
        login.put("email", email);
        login.put("password", password);
        HttpResponse<String> loginResponse = client.send(
                HttpRequest.newBuilder(uri("/api/auth/token/login")).header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(login))).build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(loginResponse.statusCode()).as("setup login: %s", loginResponse.body()).isEqualTo(200);
        String token = JSON.readTree(loginResponse.body()).path("accessToken").asText();

        HttpResponse<String> shop = send(token, "GET", "/api/home-shopping", null);
        assertThat(shop.statusCode()).as("B8 GET home-shopping").isEqualTo(200);
        List<String> shopTypes = new ArrayList<>();
        for (JsonNode item : JSON.readTree(shop.body()).get("items")) {
            shopTypes.add(item.path("type").asText());
        }
        assertThat(shopTypes).as("B8 not in the home shopping list (so a new account owns none)")
                .doesNotContainAnyElementsOf(FILES.keySet());

        HttpResponse<String> wardrobe = send(token, "GET", "/api/wardrobe", null);
        assertThat(wardrobe.statusCode()).as("B8 GET wardrobe").isEqualTo(200);
        for (String id : FILES.keySet()) {
            assertThat(wardrobe.body()).as("B8 wardrobe has no %s", id).doesNotContain(id);
        }

        for (String id : FILES.keySet()) {
            ObjectNode layout = starterLayout();
            ObjectNode item = floor(id + "-1", id, 4.0, 5.0, 0);
            ((ArrayNode) layout.get("items")).add(item);
            HttpResponse<String> put = send(token, "PUT", "/api/lobby-layout", layout);
            assertThat(put.statusCode()).as("B8 PUT layout with %s, body %s", id, put.body()).isEqualTo(400);
            assertThat(JSON.readTree(put.body()).path("code").asText()).as("B8 code for %s", id).isEqualTo("INVALID_LOBBY_LAYOUT");
        }
    }

    @Test
    void b9_existingItemsKeepTheTenFieldsAndNoNewKind() throws Exception {
        Set<String> expectedKeys = new LinkedHashSet<>(
                List.of("id", "kind", "name", "shopName", "description", "category", "slot", "price", "assets", "draw"));
        Set<String> kinds = new LinkedHashSet<>();
        JsonNode body = catalog();
        for (JsonNode item : body.get("items")) {
            Set<String> keys = new LinkedHashSet<>();
            item.fieldNames().forEachRemaining(keys::add);
            assertThat(keys).as("B9 keys of %s", item.path("id").asText()).isEqualTo(expectedKeys);
            kinds.add(item.path("kind").asText());
        }
        assertThat(kinds).as("B9 kinds").containsExactlyInAnyOrder("furniture", "wearable");
        Map<String, JsonNode> byId = byId(body);
        assertThat(byId.get("lamp").path("kind").asText()).isEqualTo("furniture");
        assertThat(byId.get("capOrange").path("kind").asText()).isEqualTo("wearable");
    }

    // 도우미

    private JsonNode catalog() throws Exception {
        HttpResponse<String> response = client.send(
                HttpRequest.newBuilder(uri("/api/catalog")).GET().build(), HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).as("GET /api/catalog").isEqualTo(200);
        return JSON.readTree(response.body());
    }

    private static Map<String, JsonNode> byId(JsonNode body) {
        Map<String, JsonNode> map = new LinkedHashMap<>();
        for (JsonNode item : body.get("items")) {
            map.put(item.path("id").asText(), item);
        }
        return map;
    }

    private static Map<String, JsonNode> itemsInFile() throws Exception {
        return byId(JSON.readTree(Files.readAllBytes(Path.of("src/main/resources/catalog/items.json"))));
    }

    private HttpResponse<byte[]> getBytes(String path) throws Exception {
        return client.send(HttpRequest.newBuilder(uri(path)).GET().build(), HttpResponse.BodyHandlers.ofByteArray());
    }

    private HttpResponse<String> send(String token, String method, String path, JsonNode body) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(uri(path)).header("Authorization", "Bearer " + token);
        if (body == null) {
            request.method(method, HttpRequest.BodyPublishers.noBody());
        } else {
            request.header("Content-Type", "application/json")
                    .method(method, HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body)));
        }
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private static String sha256(byte[] content) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
    }

    private URI uri(String path) {
        return URI.create(rest.getRootUri() + path);
    }

    /** 처음 배치(CatalogFilesSpecTest와 같은 자리). */
    private static ObjectNode starterLayout() {
        ArrayNode items = JSON.createArrayNode();
        items.add(floor("desk", "desk", 1.5, 5.5, 0));
        items.add(floor("bookcase", "bookcase", 0.5, 2.5, 1));
        items.add(floor("wardrobe", "wardrobe", 7.5, 3.5, 3));
        items.add(floor("rug", "rug", 4.6, 7.2, 0));
        ObjectNode board = JSON.createObjectNode().put("id", "board").put("type", "board");
        board.set("wall", JSON.createObjectNode().put("wall", "back").put("along", 1.8));
        items.add(board);
        ObjectNode window = JSON.createObjectNode().put("id", "window").put("type", "window");
        window.set("wall", JSON.createObjectNode().put("wall", "back").put("along", 4.8));
        items.add(window);
        ObjectNode lamp = JSON.createObjectNode().put("id", "lamp").put("type", "lamp");
        lamp.set("on", JSON.createObjectNode().put("parent", "desk").put("slot", 0).put("facing", 0));
        items.add(lamp);
        ObjectNode layout = JSON.createObjectNode();
        layout.put("version", 2);
        layout.set("items", items);
        return layout;
    }

    private static ObjectNode floor(String id, String type, double x, double z, int facing) {
        ObjectNode item = JSON.createObjectNode().put("id", id).put("type", type);
        item.set("floor", JSON.createObjectNode().put("x", x).put("z", z).put("facing", facing));
        return item;
    }
}
