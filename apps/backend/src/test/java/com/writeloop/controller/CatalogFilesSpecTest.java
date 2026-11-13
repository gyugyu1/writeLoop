package com.writeloop.controller;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.writeloop.service.ItemCatalogDrawSpecTest;
import com.writeloop.support.IntegrationTestSupport;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * [spec] 작업 090 ② 가구 내려받기, 백엔드 시나리오(04-가구-내려받기/03-qa-scenarios.md) 가운데 HTTP로 보는 것.
 *
 * <ul>
 *   <li>B2(응답 쪽), B5~B10: GET /api/catalog의 draw·assets.</li>
 *   <li>B11~B17: 파일 API GET /api/catalog/files/&lt;내용 해시&gt;.&lt;glb|png&gt;.</li>
 *   <li>B18: 목록 version.</li>
 *   <li>B21~B24: 서버 배치 검사가 시험 가구의 draw를 따른다.</li>
 *   <li>B25~B27: 홈쇼핑 가격·순서, 시험 가구는 팔지 않음, 처음 가진 가구.</li>
 * </ul>
 * B19(모델·아이콘만 바뀐 목록의 version)는 구현에 다른 파일로 목록을 읽는 진입점이 없어 옮기지 않았다(가정 G6, 보고에 적음).
 * B28(앱 사본과 서버 파일 대조)은 결정 05에 따라 모바일 쪽 qa가 맡는다.
 */
class CatalogFilesSpecTest extends IntegrationTestSupport {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final List<String> FOURTEEN = ItemCatalogDrawSpecTest.FOURTEEN;
    private static final String FILES = "/api/catalog/files/";
    private static final Pattern HEX64 = Pattern.compile("[0-9a-f]{64}");
    private static final Pattern MODEL_URL = Pattern.compile("/api/catalog/files/([0-9a-f]{64})\\.glb");
    private static final Pattern ICON_URL = Pattern.compile("/api/catalog/files/([0-9a-f]{64})\\.png");

    /** 기준 커밋 ① 목록 version(그때 목록 파일 SHA-256 앞 16자, B18). */
    private static final String BASE_VERSION = "cc6581f4ce66eb84";

    /** 가구 열넷 가운데 치울 수 있어 아이콘이 있는 열(B8). */
    private static final List<String> WITH_ICON = List.of(
            "wardrobe", "rug", "lamp", "bed", "nightstand", "floorLamp", "plant", "smallPlant", "books", "frame");
    private static final List<String> WITHOUT_ICON = List.of("desk", "bookcase", "board", "window");

    /** 부록 2: 기준 커밋 2d9f184 apps/mobile/assets/icons/furniture/&lt;id&gt;.png의 sha256·bytes. */
    private record IconFile(String sha256, long bytes) {
    }

    private static final Map<String, IconFile> ICONS = Map.ofEntries(
            Map.entry("bed", new IconFile("972ff7ee857f987992230d7c31ba78878b7572873bebe2cb29156c7f365deaec", 54417)),
            Map.entry("books", new IconFile("b2bbaac5ddce66aa6106d1d8389172dc776c2c53ec692c532a7670b7c80ca84e", 56186)),
            Map.entry("floorLamp", new IconFile("411f58b2050d0d643953834ec54f9e3e9519a3f056e7242ce2f0bfd037c6f6db", 32403)),
            Map.entry("frame", new IconFile("59c468b8e50654e8b0155e6475d9bc70eb28e157b7b085efea3f5ea514acea25", 53585)),
            Map.entry("lamp", new IconFile("dcdef6cf9b4bcd1be381fe27470fdaa7a0555ef5c64dcd1e99cf0fb3bd8c0b74", 44139)),
            Map.entry("nightstand", new IconFile("6a08ec559be99a88f836799cc45e7826c2a604632b3e5867b0a4cf7316943b54", 57361)),
            Map.entry("plant", new IconFile("763db4c0fd046313d941ca95fe498eb3d706c9468abcf3f67e24c54845aab171", 42911)),
            Map.entry("rug", new IconFile("a22d40b8eee342ba7c7da14dc7760c34f9c62977fcfe68e2fa97d52b130d1768", 41537)),
            Map.entry("smallPlant", new IconFile("8423561a62499ce756190344ad6de6cebd7070f2e3d0348b31950b974a566dd9", 46368)),
            Map.entry("wardrobe", new IconFile("fe559131ef3ea825e05379bcb4413b8d66e10f8d7f88b17c3b7375692c5ab386", 54025)));

    /** 기준 커밋 묶음 lobby-furniture.glb의 조각(노드) 이름: 가구마다 그 파일에 있어야 하는 노드(부록 1 조각 칸, B10). */
    private static final Map<String, List<String>> PIECES = Map.ofEntries(
            Map.entry("desk", List.of("desk", "chair")),
            Map.entry("bookcase", List.of("bookcase")),
            Map.entry("wardrobe", List.of("wardrobe")),
            Map.entry("rug", List.of("rug")),
            Map.entry("lamp", List.of("tableLamp")),
            Map.entry("bed", List.of("bed")),
            Map.entry("nightstand", List.of("nightstand")),
            Map.entry("floorLamp", List.of("floorLamp")),
            Map.entry("plant", List.of("plant")),
            Map.entry("smallPlant", List.of("smallPlant")),
            Map.entry("books", List.of("booksStack")),
            Map.entry("board", List.of("board")),
            Map.entry("window", List.of("window", "windowView")),
            Map.entry("frame", List.of("frame")));

    /** 기준 커밋 홈쇼핑 상품 순서와 정가(기존 ItemCatalogKeepSpecTest k1과 같음, B25). */
    private static final List<String> SHOP_TYPES = List.of(
            "books", "smallPlant", "lamp", "capOrange", "capBlue", "capGreen", "frame", "shortsNavy", "shortsBrown", "shortsRed",
            "plant", "tshirtOrange", "tshirtWhite", "tshirtYellow", "shoesBrown", "shoesRed", "shoesWhite", "mufflerRed",
            "nightstand", "sunglassesBlack", "floorLamp", "necklaceGold", "backpackRed", "rug", "wardrobe", "bed");
    private static final List<Integer> SHOP_PRICES = List.of(
            40, 50, 60, 60, 60, 60, 70, 70, 70, 70, 80, 80, 80, 80, 90, 90, 90, 90, 100, 100, 110, 110, 120, 150, 180, 300);

    @Autowired
    private PasswordEncoder passwordEncoder;

    private final HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();

    // =====================================================================
    // B. GET /api/catalog 응답
    // =====================================================================

    @Test
    void b2_drawOfTheFourteenInTheResponseIsTheAppValue() throws Exception {
        Map<String, JsonNode> byId = byId(catalog());
        for (String id : FOURTEEN) {
            JsonNode item = byId.get(id);
            assertThat(item).as("B2 %s in the response", id).isNotNull();
            ItemCatalogDrawSpecTest.assertDrawEquals(item.get("draw"), id, "B2 response");
        }
    }

    @Test
    void b5_responseItemsHaveExactlyTheTenFields() throws Exception {
        HttpResponse<String> response = getString(null, "/api/catalog");
        assertThat(response.statusCode()).as("B5 GET /api/catalog, body %s", response.body()).isEqualTo(200);
        JsonNode body = JSON.readTree(response.body());
        assertThat(fieldNames(body)).as("B5 top-level keys").isEqualTo(set("version", "items"));
        Set<String> expected = set("id", "kind", "name", "shopName", "description", "category", "slot", "price", "assets", "draw");
        for (JsonNode item : body.get("items")) {
            assertThat(fieldNames(item)).as("B5 keys of %s", item.path("id").asText()).isEqualTo(expected);
        }
    }

    @Test
    void b6_wearablesHaveNullAssetsAndNullDraw() throws Exception {
        int count = 0;
        for (JsonNode item : catalog().get("items")) {
            if (!"wearable".equals(item.path("kind").asText())) {
                continue;
            }
            count++;
            String id = item.path("id").asText();
            assertThat(item.has("assets") && item.get("assets").isNull()).as("B6 assets of %s is null: %s", id, item).isTrue();
            assertThat(item.has("draw") && item.get("draw").isNull()).as("B6 draw of %s is null: %s", id, item).isTrue();
        }
        assertThat(count).as("B6 wearable count").isEqualTo(17);
    }

    @Test
    void b7_furnitureAssetsHaveModelAndIcon() throws Exception {
        int count = 0;
        for (JsonNode item : catalog().get("items")) {
            if (!"furniture".equals(item.path("kind").asText())) {
                continue;
            }
            count++;
            String id = item.path("id").asText();
            JsonNode assets = item.get("assets");
            assertThat(assets != null && assets.isObject()).as("B7 assets of %s is an object: %s", id, item).isTrue();
            assertThat(fieldNames(assets)).as("B7 assets keys of %s", id).isEqualTo(set("model", "icon"));
            assertFileEntry(assets.get("model"), MODEL_URL, "B7 model of " + id);
        }
        assertThat(count).as("B7 furniture count").isEqualTo(15);
    }

    @Test
    void b8_iconOnlyForRemovableFurniture() throws Exception {
        List<String> withIcon = new ArrayList<>();
        for (JsonNode item : catalog().get("items")) {
            if (!"furniture".equals(item.path("kind").asText())) {
                continue;
            }
            String id = item.path("id").asText();
            JsonNode icon = item.path("assets").get("icon");
            boolean removable = item.path("draw").path("removable").asBoolean(false);
            assertThat(item.path("draw").path("removable").isBoolean()).as("B8 draw.removable of %s is a boolean: %s", id, item).isTrue();
            if (removable) {
                assertFileEntry(icon, ICON_URL, "B8 icon of " + id);
                if (FOURTEEN.contains(id)) {
                    withIcon.add(id);
                }
            } else {
                assertThat(icon != null && icon.isNull()).as("B8 icon of not-removable %s is null: %s", id, item).isTrue();
            }
        }
        assertThat(withIcon).as("B8 furniture of the fourteen with an icon").containsExactlyInAnyOrderElementsOf(WITH_ICON);
        Map<String, JsonNode> byId = byId(catalog());
        for (String id : WITHOUT_ICON) {
            JsonNode icon = byId.get(id).path("assets").get("icon");
            assertThat(icon != null && icon.isNull()).as("B8 icon of %s is null", id).isTrue();
        }
    }

    @Test
    void b9_iconsAreTheAppIconPictures() throws Exception {
        Map<String, JsonNode> byId = byId(catalog());
        for (String id : WITH_ICON) {
            JsonNode icon = byId.get(id).path("assets").path("icon");
            IconFile expected = ICONS.get(id);
            assertThat(icon.path("sha256").asText()).as("B9 icon sha256 of %s", id).isEqualTo(expected.sha256());
            assertThat(icon.path("bytes").asLong()).as("B9 icon bytes of %s", id).isEqualTo(expected.bytes());
            HttpResponse<byte[]> response = getBytes(null, icon.path("url").asText());
            assertThat(response.statusCode()).as("B9 GET icon of %s", id).isEqualTo(200);
            assertThat((long) response.body().length).as("B9 downloaded icon length of %s", id).isEqualTo(expected.bytes());
            assertThat(sha256(response.body())).as("B9 downloaded icon sha256 of %s", id).isEqualTo(expected.sha256());
        }
    }

    @Test
    void b10_eachFurnitureModelIsItsOwnGlb() throws Exception {
        Set<String> allPieces = new LinkedHashSet<>();
        PIECES.values().forEach(allPieces::addAll);
        Map<String, JsonNode> byId = byId(catalog());
        for (String id : FOURTEEN) {
            JsonNode model = byId.get(id).path("assets").path("model");
            HttpResponse<byte[]> response = getBytes(null, model.path("url").asText());
            assertThat(response.statusCode()).as("B10 GET model of %s", id).isEqualTo(200);
            byte[] glb = response.body();
            String label = "B10 " + id;
            assertThat(glb.length).as("%s length >= 20", label).isGreaterThanOrEqualTo(20);
            ByteBuffer header = ByteBuffer.wrap(glb).order(ByteOrder.LITTLE_ENDIAN);
            assertThat(new String(glb, 0, 4, StandardCharsets.US_ASCII)).as("%s magic", label).isEqualTo("glTF");
            assertThat(header.getInt(4)).as("%s version", label).isEqualTo(2);
            assertThat(Integer.toUnsignedLong(header.getInt(8))).as("%s header length = body length", label).isEqualTo((long) glb.length);
            Set<String> nodes = glbNodeNames(glb, label);
            List<String> own = PIECES.get(id);
            assertThat(nodes).as("%s has its pieces %s", label, own).containsAll(own);
            Set<String> others = new LinkedHashSet<>(allPieces);
            others.removeAll(own);
            assertThat(nodes).as("%s has no other furniture pieces", label).doesNotContainAnyElementsOf(others);
        }
    }

    // =====================================================================
    // C. 파일 API
    // =====================================================================

    @Test
    void b11_b13_everyListedFileIsServedWithoutLoginAtItsContentHash() throws Exception {
        List<JsonNode> entries = allFileEntries(catalog());
        assertThat(entries).as("B11 file entries (15 models + 11 icons)").hasSize(26);
        for (JsonNode entry : entries) {
            String url = entry.path("url").asText();
            String sha = entry.path("sha256").asText();
            // B13: 주소의 해시 부분 = 그 항목의 sha256
            Matcher matcher = Pattern.compile("/api/catalog/files/([0-9a-f]{64})\\.(glb|png)").matcher(url);
            assertThat(matcher.matches()).as("B13 url shape %s", url).isTrue();
            assertThat(matcher.group(1)).as("B13 hash in url %s = sha256", url).isEqualTo(sha);

            HttpResponse<byte[]> response = getBytes(null, url);
            assertThat(response.statusCode()).as("B11 GET %s without login", url).isEqualTo(200);
            assertThat((long) response.body().length).as("B11 length of %s = bytes", url).isEqualTo(entry.path("bytes").asLong());
            assertThat(sha256(response.body())).as("B11 sha256 of %s", url).isEqualTo(sha);
        }
        // B13: 내용이 다른 두 파일은 주소가 다르다
        Set<String> shas = new LinkedHashSet<>();
        Set<String> urls = new LinkedHashSet<>();
        for (JsonNode entry : entries) {
            shas.add(entry.path("sha256").asText() + "/" + extension(entry.path("url").asText()));
            urls.add(entry.path("url").asText());
        }
        assertThat(urls).as("B13 distinct contents give distinct urls").hasSameSizeAs(shas);
    }

    @Test
    void b12_everyListedFileIsCachedForever() throws Exception {
        for (JsonNode entry : allFileEntries(catalog())) {
            String url = entry.path("url").asText();
            HttpResponse<byte[]> response = getBytes(null, url);
            assertThat(response.statusCode()).as("B12 GET %s", url).isEqualTo(200);
            assertThat(response.headers().allValues("Cache-Control")).as("B12 Cache-Control of %s", url)
                    .containsExactly("public, max-age=31536000, immutable");
        }
    }

    @Test
    void b14_unlistedHashIs404() throws Exception {
        Set<String> listed = new LinkedHashSet<>();
        for (JsonNode entry : allFileEntries(catalog())) {
            listed.add(entry.path("sha256").asText());
        }
        String unlisted = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        assertThat(listed).as("setup: hash is not listed").doesNotContain(unlisted);
        for (String ext : List.of("glb", "png")) {
            HttpResponse<byte[]> response = getBytes(null, FILES + unlisted + "." + ext);
            assertThat(response.statusCode()).as("B14 GET unlisted .%s", ext).isEqualTo(404);
        }
    }

    @Test
    void b15_listedHashWithTheOtherExtensionIs404() throws Exception {
        Map<String, JsonNode> byId = byId(catalog());
        String modelSha = byId.get("bed").path("assets").path("model").path("sha256").asText();
        String iconSha = byId.get("bed").path("assets").path("icon").path("sha256").asText();
        assertThat(modelSha).as("setup: bed model sha").matches(HEX64);
        assertThat(iconSha).as("setup: bed icon sha").matches(HEX64);

        assertThat(getBytes(null, FILES + modelSha + ".png").statusCode()).as("B15 model sha + .png").isEqualTo(404);
        assertThat(getBytes(null, FILES + iconSha + ".glb").statusCode()).as("B15 icon sha + .glb").isEqualTo(404);
    }

    @Test
    void b16_fileApiDoesNotServeOtherFiles() throws Exception {
        String modelSha = byId(catalog()).get("desk").path("assets").path("model").path("sha256").asText();
        assertThat(modelSha).as("setup: desk model sha").matches(HEX64);

        HttpResponse<String> itemsJson = getString(null, FILES + "items.json");
        assertThat(itemsJson.statusCode()).as("B16 GET items.json, body %s", itemsJson.body()).isEqualTo(404);
        assertNoCatalogContent(itemsJson.body(), "B16 items.json");

        HttpResponse<String> json = getString(null, FILES + modelSha + ".json");
        assertThat(json.statusCode()).as("B16 GET <model sha>.json, body %s", json.body()).isEqualTo(404);
        assertNoCatalogContent(json.body(), "B16 <model sha>.json");

        HttpResponse<String> traversal = getString(null, FILES + "..%2Fitems.json");
        assertThat(traversal.statusCode()).as("B16 GET ..%%2Fitems.json, body %s", traversal.body()).isNotEqualTo(200);
        assertNoCatalogContent(traversal.body(), "B16 ..%2Fitems.json");
    }

    @Test
    void b17_loggedInGetsTheSameFile() throws Exception {
        TestUser user = newUser("b17");
        String url = byId(catalog()).get("bed").path("assets").path("model").path("url").asText();

        HttpResponse<byte[]> withoutLogin = getBytes(null, url);
        HttpResponse<byte[]> withLogin = getBytes(user.token(), url);

        assertThat(withoutLogin.statusCode()).as("B17 without login").isEqualTo(200);
        assertThat(withLogin.statusCode()).as("B17 with login").isEqualTo(200);
        assertThat(withLogin.body()).as("B17 same body").isEqualTo(withoutLogin.body());
    }

    // =====================================================================
    // D. version
    // =====================================================================

    @Test
    void b18_versionChangedFromTheBaseListAndIsStable() throws Exception {
        String first = catalog().path("version").asText();
        String second = catalog().path("version").asText();
        assertThat(first).as("B18 version differs from the base list version").isNotEqualTo(BASE_VERSION);
        assertThat(second).as("B18 same version on the second call").isEqualTo(first);
    }

    // =====================================================================
    // E. 서버 검사가 시험 가구의 draw를 따른다
    // =====================================================================

    @Test
    void b21_ownedTestFurnitureInItsMountIsSaved() throws Exception {
        JsonNode test = testFurniture();
        String type = test.path("id").asText();
        TestUser user = newUser("b21");
        buy(user, type);
        ObjectNode layout = starterLayout();
        ((ArrayNode) layout.get("items")).add(placed(type + "-1", type, layoutMount(test.path("draw").path("mount").asText())));

        HttpResponse<String> response = send(user, "PUT", "/api/lobby-layout", layout);

        assertThat(response.statusCode()).as("B21 PUT with owned %s, body %s", type, response.body()).isEqualTo(200);
        HttpResponse<String> load = send(user, "GET", "/api/lobby-layout", null);
        assertThat(load.statusCode()).as("B21 GET").isEqualTo(200);
        assertThat(JSON.readTree(load.body())).as("B21 loaded layout").isEqualTo(layout);
    }

    @Test
    void b22_testFurnitureInAnotherMountIsRejected() throws Exception {
        JsonNode test = testFurniture();
        String type = test.path("id").asText();
        String own = layoutMount(test.path("draw").path("mount").asText());
        TestUser user = newUser("b22");
        buy(user, type);

        for (String mount : List.of("floor", "wall", "on")) {
            if (mount.equals(own)) {
                continue;
            }
            ObjectNode layout = starterLayout();
            ((ArrayNode) layout.get("items")).add(placed(type + "-1", type, mount));
            assertRejected(user, layout, "B22 " + type + " as " + mount);
        }
        assertThat(send(user, "GET", "/api/lobby-layout", null).statusCode()).as("B22 nothing saved").isEqualTo(404);
    }

    @Test
    void b23_testFurnitureNotOwnedIsRejectedInTheRoomAndInStorage() throws Exception {
        JsonNode test = testFurniture();
        String type = test.path("id").asText();
        TestUser user = newUser("b23");

        ObjectNode inRoom = starterLayout();
        ((ArrayNode) inRoom.get("items")).add(placed(type + "-1", type, layoutMount(test.path("draw").path("mount").asText())));
        assertRejected(user, inRoom, "B23 unowned " + type + " in the room");

        ObjectNode inStorage = starterLayout();
        inStorage.set("stored", JSON.createArrayNode().add(JSON.createObjectNode().put("id", type + "-1").put("type", type)));
        assertRejected(user, inStorage, "B23 unowned " + type + " in storage");

        assertThat(send(user, "GET", "/api/lobby-layout", null).statusCode()).as("B23 nothing saved").isEqualTo(404);
    }

    @Test
    void b24_tabletopSlotsOfTheTestFurnitureFollowItsDraw() throws Exception {
        JsonNode test = testFurniture();
        String type = test.path("id").asText();
        JsonNode draw = test.path("draw");
        TestUser user = newUser("b24");
        buy(user, type);
        String id = type + "-1";
        String mount = layoutMount(draw.path("mount").asText());

        if (draw.hasNonNull("surface")) {
            JsonNode cells = draw.get("surface").get("cells");
            int slots = cells != null && !cells.isNull()
                    ? cells.size()
                    : (int) Math.round(draw.path("size").path("width").asDouble() * draw.path("size").path("depth").asDouble());
            ObjectNode ok = layoutWithLampOn(type, id, mount, 0);
            HttpResponse<String> response = send(user, "PUT", "/api/lobby-layout", ok);
            assertThat(response.statusCode()).as("B24 lamp on %s slot 0, body %s", type, response.body()).isEqualTo(200);
            assertRejected(user, layoutWithLampOn(type, id, mount, slots), "B24 lamp on " + type + " slot " + slots);
        } else {
            assertRejected(user, layoutWithLampOn(type, id, mount, 0), "B24 lamp on " + type + " (no surface) slot 0");
        }
    }

    // =====================================================================
    // F. 그대로 둘 동작
    // =====================================================================

    @Test
    void b25_shopListUnchangedAndWithoutTheTestFurniture() throws Exception {
        String type = testFurniture().path("id").asText();
        TestUser user = newUser("b25");

        HttpResponse<String> response = send(user, "GET", "/api/home-shopping", null);

        assertThat(response.statusCode()).as("B25 GET /api/home-shopping, body %s", response.body()).isEqualTo(200);
        List<String> types = new ArrayList<>();
        List<Integer> prices = new ArrayList<>();
        for (JsonNode item : JSON.readTree(response.body()).get("items")) {
            types.add(item.path("type").asText());
            prices.add(item.path("price").asInt());
        }
        assertThat(types).as("B25 types in order").containsExactlyElementsOf(SHOP_TYPES);
        assertThat(prices).as("B25 regular prices in order").containsExactlyElementsOf(SHOP_PRICES);
        assertThat(types).as("B25 test furniture is not sold").doesNotContain(type);
    }

    @Test
    void b26_testFurnitureCannotBeOrdered() throws Exception {
        String type = testFurniture().path("id").asText();
        TestUser user = newUser("b26");
        send(user, "GET", "/api/loop-points", null);
        jdbc.update("UPDATE loop_point_balances SET balance = 10000 WHERE user_id = ?", user.id());

        for (int price : List.of(0, 100, 300)) {
            ObjectNode order = JSON.createObjectNode().put("type", type).put("price", price);
            HttpResponse<String> response = send(user, "POST", "/api/home-shopping/orders", order);
            assertThat(response.statusCode()).as("B26 order %s at %d, body %s", type, price, response.body()).isEqualTo(400);
            assertThat(JSON.readTree(response.body()).path("code").asText()).as("B26 code at %d", price).isEqualTo("UNKNOWN_PRODUCT");
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM home_shopping_orders WHERE user_id = ?", Integer.class, user.id()))
                .as("B26 no order rows").isZero();
    }

    @Test
    void b27_newUserOwnsOnlyTheStarterFurniture() throws Exception {
        String type = testFurniture().path("id").asText();
        TestUser user = newUser("b27");

        JsonNode body = JSON.readTree(send(user, "GET", "/api/home-shopping", null).body());

        Map<String, Integer> starter = Map.of("wardrobe", 1, "rug", 1, "lamp", 1);
        for (JsonNode item : body.get("items")) {
            String itemType = item.path("type").asText();
            assertThat(item.path("owned").asInt()).as("B27 owned of %s", itemType).isEqualTo(starter.getOrDefault(itemType, 0));
            assertThat(itemType).as("B27 test furniture not listed").isNotEqualTo(type);
        }
    }

    // =====================================================================
    // 도우미: 목록
    // =====================================================================

    private JsonNode catalog() throws Exception {
        HttpResponse<String> response = getString(null, "/api/catalog");
        assertThat(response.statusCode()).as("GET /api/catalog, body %s", response.body()).isEqualTo(200);
        return JSON.readTree(response.body());
    }

    /** 응답의 가구 열넷 밖의 가구 하나(시험 가구). */
    private JsonNode testFurniture() throws Exception {
        List<JsonNode> others = new ArrayList<>();
        for (JsonNode item : catalog().get("items")) {
            if ("furniture".equals(item.path("kind").asText()) && !FOURTEEN.contains(item.path("id").asText())) {
                others.add(item);
            }
        }
        assertThat(others).as("setup: exactly one test furniture").hasSize(1);
        assertThat(others.get(0).path("draw").isObject()).as("setup: test furniture has draw").isTrue();
        return others.get(0);
    }

    private static Map<String, JsonNode> byId(JsonNode body) {
        Map<String, JsonNode> map = new LinkedHashMap<>();
        for (JsonNode item : body.get("items")) {
            map.put(item.path("id").asText(), item);
        }
        return map;
    }

    /** 응답의 모든 파일 항목(모델, 그리고 null이 아닌 아이콘). */
    private static List<JsonNode> allFileEntries(JsonNode body) {
        List<JsonNode> entries = new ArrayList<>();
        for (JsonNode item : body.get("items")) {
            JsonNode assets = item.get("assets");
            if (assets == null || assets.isNull()) {
                continue;
            }
            entries.add(assets.get("model"));
            JsonNode icon = assets.get("icon");
            if (icon != null && !icon.isNull()) {
                entries.add(icon);
            }
        }
        return entries;
    }

    /** {url, sha256, bytes} 한 항목의 모양(B7·B8). */
    private static void assertFileEntry(JsonNode entry, Pattern urlPattern, String label) {
        assertThat(entry != null && entry.isObject()).as("%s is an object: %s", label, entry).isTrue();
        assertThat(fieldNames(entry)).as("%s keys", label).isEqualTo(set("url", "sha256", "bytes"));
        assertThat(entry.path("url").isTextual()).as("%s url is a string", label).isTrue();
        assertThat(urlPattern.matcher(entry.path("url").asText()).matches()).as("%s url shape: %s", label, entry.path("url")).isTrue();
        assertThat(entry.path("sha256").isTextual()).as("%s sha256 is a string", label).isTrue();
        assertThat(entry.path("sha256").asText()).as("%s sha256 is 64 lowercase hex", label).matches(HEX64);
        assertThat(entry.path("bytes").isIntegralNumber()).as("%s bytes is an integer: %s", label, entry.path("bytes")).isTrue();
        assertThat(entry.path("bytes").asLong()).as("%s bytes is positive", label).isPositive();
    }

    private static String extension(String url) {
        return url.substring(url.lastIndexOf('.') + 1);
    }

    /** 목록 파일 내용이 본문에 없다(목록 파일에만 있는 글로 본다). */
    private static void assertNoCatalogContent(String body, String label) {
        assertThat(body == null ? "" : body).as("%s body has no catalog content", label)
                .doesNotContain("\"shopName\"")
                .doesNotContain("\"kind\"")
                .doesNotContain("\"draw\"");
    }

    /** glb의 JSON 조각에서 노드 이름을 읽는다. */
    private static Set<String> glbNodeNames(byte[] glb, String label) throws Exception {
        ByteBuffer buffer = ByteBuffer.wrap(glb).order(ByteOrder.LITTLE_ENDIAN);
        int chunkLength = buffer.getInt(12);
        assertThat(new String(glb, 16, 4, StandardCharsets.US_ASCII)).as("%s first chunk is JSON", label).isEqualTo("JSON");
        JsonNode gltf = JSON.readTree(new String(glb, 20, chunkLength, StandardCharsets.UTF_8));
        Set<String> names = new LinkedHashSet<>();
        for (JsonNode node : gltf.path("nodes")) {
            if (node.hasNonNull("name")) {
                names.add(node.get("name").asText());
            }
        }
        return names;
    }

    private static String sha256(byte[] content) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
    }

    // =====================================================================
    // 도우미: 배치
    // =====================================================================

    /** draw의 두는 방식 → 배치의 자리 칸(floor·cover→floor, wall→wall, tabletop→on). */
    private static String layoutMount(String drawMount) {
        return switch (drawMount) {
            case "floor", "cover" -> "floor";
            case "wall" -> "wall";
            case "tabletop" -> "on";
            default -> throw new IllegalArgumentException("unknown draw mount " + drawMount);
        };
    }

    /** 처음 배치(앱·서버 DEFAULT_LAYOUT과 같은 자리, 기존 ItemCatalogKeepSpecTest와 같음). */
    private static ObjectNode starterLayout() {
        ArrayNode items = JSON.createArrayNode();
        items.add(floorItem("desk", "desk", 1.5, 5.5, 0));
        items.add(floorItem("bookcase", "bookcase", 0.5, 2.5, 1));
        items.add(floorItem("wardrobe", "wardrobe", 7.5, 3.5, 3));
        items.add(floorItem("rug", "rug", 4.6, 7.2, 0));
        items.add(wallItem("board", "board", "back", 1.8));
        items.add(wallItem("window", "window", "back", 4.8));
        items.add(onItem("lamp", "lamp", "desk", 0));
        ObjectNode layout = JSON.createObjectNode();
        layout.put("version", 2);
        layout.set("items", items);
        return layout;
    }

    /** 처음 배치에 시험 가구를 그 두는 곳에 더하고 스탠드를 그 가구의 자리에 옮긴 배치(B24). */
    private static ObjectNode layoutWithLampOn(String type, String id, String mount, int slot) {
        ObjectNode layout = starterLayout();
        ArrayNode items = (ArrayNode) layout.get("items");
        items.add(placed(id, type, mount));
        for (JsonNode item : items) {
            if ("lamp".equals(item.path("id").asText())) {
                ((ObjectNode) item.get("on")).put("parent", id).put("slot", slot);
            }
        }
        return layout;
    }

    /** 두는 곳마다 맞는 자리(바닥: 방 안, 벽: 걸 수 있는 벽, 받침: 비어 있는 책상 자리 1). */
    private static ObjectNode placed(String id, String type, String mount) {
        return switch (mount) {
            case "floor" -> floorItem(id, type, 4.0, 5.0, 0);
            case "wall" -> wallItem(id, type, "right", 5.0);
            default -> onItem(id, type, "desk", 1);
        };
    }

    private static ObjectNode floorItem(String id, String type, double x, double z, int facing) {
        ObjectNode item = JSON.createObjectNode().put("id", id).put("type", type);
        item.set("floor", JSON.createObjectNode().put("x", x).put("z", z).put("facing", facing));
        return item;
    }

    private static ObjectNode wallItem(String id, String type, String wall, double along) {
        ObjectNode item = JSON.createObjectNode().put("id", id).put("type", type);
        item.set("wall", JSON.createObjectNode().put("wall", wall).put("along", along));
        return item;
    }

    private static ObjectNode onItem(String id, String type, String parent, int slot) {
        ObjectNode item = JSON.createObjectNode().put("id", id).put("type", type);
        item.set("on", JSON.createObjectNode().put("parent", parent).put("slot", slot).put("facing", 0));
        return item;
    }

    private void buy(TestUser user, String type) {
        jdbc.update(
                "INSERT INTO home_shopping_orders (user_id, furniture_type, price, item_id, created_at) VALUES (?, ?, 0, ?, NOW(6))",
                user.id(), type, "qa-090f-" + type);
    }

    private void assertRejected(TestUser user, ObjectNode layout, String label) throws Exception {
        HttpResponse<String> response = send(user, "PUT", "/api/lobby-layout", layout);
        assertThat(response.statusCode()).as("%s, body %s", label, response.body()).isEqualTo(400);
        assertThat(JSON.readTree(response.body()).path("code").asText()).as("%s code", label).isEqualTo("INVALID_LOBBY_LAYOUT");
    }

    // =====================================================================
    // 도우미: 사용자·요청
    // =====================================================================

    private record TestUser(long id, String token) {
    }

    private TestUser newUser(String tag) throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        String email = "qa-090f-" + tag + "-" + suffix + "@example.com";
        String password = "qa-pass-" + suffix;
        jdbc.update(
                "INSERT INTO users (email, password_hash, display_name, email_verified, verified_at) VALUES (?, ?, ?, 1, NOW())",
                email, passwordEncoder.encode(password), "qa-090f-" + tag + "-" + suffix);
        long userId = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", Long.class, email);
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
        return new TestUser(userId, token);
    }

    private HttpResponse<String> send(TestUser user, String method, String path, JsonNode body) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(uri(path)).header("Authorization", "Bearer " + user.token());
        if (body == null) {
            request.method(method, HttpRequest.BodyPublishers.noBody());
        } else {
            request.header("Content-Type", "application/json")
                    .method(method, HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body)));
        }
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> getString(String token, String path) throws Exception {
        return client.send(getRequest(token, path), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<byte[]> getBytes(String token, String path) throws Exception {
        return client.send(getRequest(token, path), HttpResponse.BodyHandlers.ofByteArray());
    }

    private HttpRequest getRequest(String token, String path) {
        HttpRequest.Builder request = HttpRequest.newBuilder(uri(path)).GET();
        if (token != null) {
            request.header("Authorization", "Bearer " + token);
        }
        return request.build();
    }

    private static Set<String> fieldNames(JsonNode node) {
        Set<String> names = new LinkedHashSet<>();
        if (node != null) {
            node.fieldNames().forEachRemaining(names::add);
        }
        return names;
    }

    private static Set<String> set(String... names) {
        return new LinkedHashSet<>(List.of(names));
    }

    private URI uri(String path) {
        return URI.create(rest.getRootUri() + path);
    }
}
