package com.writeloop.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.writeloop.support.IntegrationTestSupport;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
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
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * [spec] 작업 130 가구점 새 매장·명패, 백엔드(01-main-spec.md 1절 상품 여섯, 4절 4~5 명패 그림·서버 목록).
 * 기대값은 명세에서만 가져왔다. 명패 파일 이름은 명세에 없어 API(assets.nameplate)로 찾는다.
 * 명패 글자가 상품 이름과 같게 읽히는지는 테스트로 볼 수 없다(사용자가 직접 볼 것).
 */
class CatalogNameplateSpecTest extends IntegrationTestSupport {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Path FILES_DIR = Path.of("src/main/resources/catalog/files");
    private static final Path ASSET_ROOT = Path.of("C:/WriteLoop-asset/가구/가구점");

    /** 명세 1절 표: 슬롯 차례의 id -> {이름, 모델 파일, 모델 크기(바이트), 애셋 원본 경로} */
    private static final Map<String, String[]> PRODUCTS = new LinkedHashMap<>();

    static {
        PRODUCTS.put("rainbootPlanter", new String[] {"장화 화분", "rainboot-planter.glb", "265740", "화분/장화화분/rainboot-planter.glb"});
        PRODUCTS.put("catPostDesk", new String[] {"고양이 편지 책상", "cat-post-desk.glb", "697104", "책상/고양이편지책상/cat-post-desk.glb"});
        PRODUCTS.put("stargazerBed", new String[] {"별지기 침대", "stargazer-bed.glb", "295452", "침대/별지기침대/stargazer-bed.glb"});
        PRODUCTS.put("walnutBed", new String[] {"호두 침대", "walnut-bed.glb", "263104", "침대/호두침대/walnut-bed.glb"});
        PRODUCTS.put("grandmasFloorBedding", new String[] {"이부자리", "grandmas-floor-bedding.glb", "1579488", "침대/이부자리/grandmas-floor-bedding.glb"});
        PRODUCTS.put("cloudDesk", new String[] {"구름 책상", "cloud-desk.glb", "703352", "책상/구름책상/cloud-desk.glb"});
    }

    private static final List<String> NEW_THREE = List.of("rainbootPlanter", "catPostDesk", "stargazerBed");

    @Autowired
    private PasswordEncoder passwordEncoder;

    private final HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();

    @Test
    void n1_sixProductsAreUnsoldFurnitureWithTheSpecNames() throws Exception {
        Map<String, JsonNode> inFile = itemsInFile();
        Map<String, JsonNode> inApi = byId(catalog());
        for (Map.Entry<String, String[]> e : PRODUCTS.entrySet()) {
            String id = e.getKey();
            for (JsonNode item : List.of(inFile.get(id) == null ? JSON.nullNode() : inFile.get(id),
                    inApi.get(id) == null ? JSON.nullNode() : inApi.get(id))) {
                assertThat(item.isNull()).as("N1 %s exists", id).isFalse();
                assertThat(item.path("kind").asText()).as("N1 kind of %s", id).isEqualTo("furniture");
                assertThat(item.path("name").asText()).as("N1 name of %s", id).isEqualTo(e.getValue()[0]);
                for (String absent : List.of("price", "category", "starter")) {
                    assertThat(item.hasNonNull(absent)).as("N1 %s has no %s: %s", id, absent, item).isFalse();
                }
                assertThat(item.path("description").asText()).as("N1 description of %s", id).isNotBlank();
            }
        }
        // 기존 셋의 설명은 지금 그대로
        assertThat(inApi.get("walnutBed").path("description").asText()).isEqualTo("갈라진 호두껍질 굴곡에 파스텔 녹색 이불을 덮었어요.");
        assertThat(inApi.get("grandmasFloorBedding").path("description").asText()).isEqualTo("방바닥에 포근한 요를 펴고 솜이불과 베개를 놓았어요.");
        assertThat(inApi.get("cloudDesk").path("description").asText()).isEqualTo("구름 모양 상판에 하늘색으로 포인트를 줬어요.");
    }

    @Test
    void n2_sixModelFilesAreOnTheServerAndTheNewThreeAreTheOriginals() throws Exception {
        Map<String, JsonNode> inFile = itemsInFile();
        for (Map.Entry<String, String[]> e : PRODUCTS.entrySet()) {
            String id = e.getKey();
            assertThat(inFile.get(id).path("files").path("model").asText()).as("N2 model name of %s", id).isEqualTo(e.getValue()[1]);
            Path file = FILES_DIR.resolve(e.getValue()[1]);
            assertThat(file).as("N2 %s exists", file).exists();
            assertThat(Files.size(file)).as("N2 size of %s", file).isEqualTo(Long.parseLong(e.getValue()[2]));
            Path original = ASSET_ROOT.resolve(e.getValue()[3]);
            if (Files.exists(original)) {
                assertThat(Files.readAllBytes(file)).as("N2 %s is the original", file).isEqualTo(Files.readAllBytes(original));
            }
            assertThat(inFile.get(id).path("files").hasNonNull("icon")).as("N2 %s has no icon", id).isFalse();
        }
    }

    @Test
    void n3_newThreeDrawValuesFollowTheProductReadme() throws Exception {
        Map<String, JsonNode> items = itemsInFile();
        // id -> {mount, 바닥 가로, 바닥 깊이, 모델 가로, 높이, 깊이}
        Map<String, Object[]> expected = new LinkedHashMap<>();
        expected.put("rainbootPlanter", new Object[] {"tabletop", 1, 1, 0.568, 0.719, 0.262});
        expected.put("catPostDesk", new Object[] {"floor", 3, 2, 2.500, 2.017, 1.380});
        expected.put("stargazerBed", new Object[] {"floor", 2, 3, 1.687, 1.895, 3.050});
        for (String id : NEW_THREE) {
            Object[] e = expected.get(id);
            JsonNode draw = items.get(id).path("draw");
            assertThat(draw.path("mount").asText()).as("N3 mount of %s", id).isEqualTo(e[0]);
            assertThat(draw.path("size").path("width").asInt()).as("N3 floor width of %s", id).isEqualTo(e[1]);
            assertThat(draw.path("size").path("depth").asInt()).as("N3 floor depth of %s", id).isEqualTo(e[2]);
            assertThat(draw.path("removable").asBoolean(false)).as("N3 removable of %s", id).isTrue();
            assertThat(draw.path("model").path("piece").asText()).as("N3 piece of %s", id).isEqualTo(id);
            JsonNode box = draw.path("model").path("box");
            assertThat(box.path("width").asDouble()).as("N3 model width of %s", id).isCloseTo((double) e[3], within(0.001));
            assertThat(box.path("height").asDouble()).as("N3 model height of %s", id).isCloseTo((double) e[4], within(0.001));
            assertThat(box.path("depth").asDouble()).as("N3 model depth of %s", id).isCloseTo((double) e[5], within(0.001));
        }
        // 바닥 가구는 걸음을 막는다(탁상 소품은 막지 않는다. 기존 탁상 가구와 같다)
        assertThat(items.get("catPostDesk").path("draw").path("blocksWalk").asBoolean(false)).isTrue();
        assertThat(items.get("stargazerBed").path("draw").path("blocksWalk").asBoolean(false)).isTrue();
        assertThat(items.get("rainbootPlanter").path("draw").path("blocksWalk").asBoolean(true)).isFalse();
    }

    @Test
    void n4_sixItemsHaveANameplateFileNameInTheListFile() throws Exception {
        Map<String, JsonNode> items = itemsInFile();
        Set<String> names = new LinkedHashSet<>();
        for (String id : PRODUCTS.keySet()) {
            JsonNode name = items.get(id).path("files").path("nameplate");
            assertThat(name.isTextual()).as("N4 files.nameplate of %s: %s", id, items.get(id).path("files")).isTrue();
            assertThat(name.asText()).as("N4 name shape of %s", id).matches("[A-Za-z0-9_-]+\\.png");
            assertThat(FILES_DIR.resolve(name.asText())).as("N4 nameplate file of %s", id).exists();
            names.add(name.asText());
        }
        assertThat(names).as("N4 six different nameplate files").hasSize(6);
    }

    @Test
    void n5_apiAssetsHaveNameplateWithUrlShaAndBytesForTheSixAndModelAndIconKeysStay() throws Exception {
        Map<String, JsonNode> byId = byId(catalog());
        for (String id : PRODUCTS.keySet()) {
            JsonNode assets = byId.get(id).path("assets");
            Set<String> keys = new LinkedHashSet<>();
            assets.fieldNames().forEachRemaining(keys::add);
            assertThat(keys).as("N5 assets keys of %s", id).contains("model", "icon", "nameplate");
            assertThat(assets.path("model").path("url").asText()).as("N5 model url of %s", id).matches("/api/catalog/files/[0-9a-f]{64}\\.glb");
            JsonNode plate = assets.path("nameplate");
            Set<String> plateKeys = new LinkedHashSet<>();
            plate.fieldNames().forEachRemaining(plateKeys::add);
            assertThat(plateKeys).as("N5 nameplate keys of %s", id).isEqualTo(new LinkedHashSet<>(List.of("url", "sha256", "bytes")));
            assertThat(plate.path("url").asText()).as("N5 nameplate url of %s", id).matches("/api/catalog/files/[0-9a-f]{64}\\.png");
            assertThat(plate.path("sha256").asText()).as("N5 sha of %s", id).matches("[0-9a-f]{64}");
            assertThat(plate.path("url").asText()).as("N5 url has the sha of %s", id).contains(plate.path("sha256").asText());
            assertThat(plate.path("bytes").asLong()).as("N5 bytes of %s", id).isPositive();
        }
    }

    @Test
    void n6_otherItemsHaveNoNameplateAndKeepTheTenFields() throws Exception {
        Set<String> expectedKeys = new LinkedHashSet<>(
                List.of("id", "kind", "name", "shopName", "description", "category", "slot", "price", "assets", "draw"));
        for (JsonNode item : catalog().get("items")) {
            Set<String> keys = new LinkedHashSet<>();
            item.fieldNames().forEachRemaining(keys::add);
            assertThat(keys).as("N6 top-level keys of %s", item.path("id").asText()).isEqualTo(expectedKeys);
            if (!PRODUCTS.containsKey(item.path("id").asText())) {
                JsonNode assets = item.path("assets");
                assertThat(assets.hasNonNull("nameplate")).as("N6 %s has no nameplate: %s", item.path("id").asText(), assets).isFalse();
            }
        }
    }

    @Test
    void n7_nameplateFilesAreServedAsPngWithTheSameBytesShaAndImmutableCache() throws Exception {
        Map<String, JsonNode> byId = byId(catalog());
        for (String id : PRODUCTS.keySet()) {
            JsonNode plate = byId.get(id).path("assets").path("nameplate");
            HttpResponse<byte[]> response = getBytes(plate.path("url").asText());
            assertThat(response.statusCode()).as("N7 GET nameplate of %s", id).isEqualTo(200);
            assertThat(response.headers().firstValue("Content-Type").orElse("")).as("N7 content type of %s", id).startsWith("image/png");
            assertThat(response.headers().firstValue("Cache-Control").orElse("")).as("N7 cache of %s", id)
                    .isEqualTo("public, max-age=31536000, immutable");
            byte[] body = response.body();
            assertThat(sha256(body)).as("N7 sha of %s", id).isEqualTo(plate.path("sha256").asText());
            assertThat((long) body.length).as("N7 bytes of %s", id).isEqualTo(plate.path("bytes").asLong());
            // 목록 파일의 그 파일과 같다
            String fileName = itemsInFile().get(id).path("files").path("nameplate").asText();
            assertThat(body).as("N7 body is the file %s", fileName).isEqualTo(Files.readAllBytes(FILES_DIR.resolve(fileName)));
            // PNG 서명
            assertThat(new String(body, 1, 3, StandardCharsets.US_ASCII)).as("N7 PNG signature of %s", id).isEqualTo("PNG");
        }
    }

    @Test
    void n8_nameplateImageIsFiveToOneTransparentWithCenteredDarkBrownText() throws Exception {
        Map<String, JsonNode> byId = byId(catalog());
        Set<String> shas = new LinkedHashSet<>();
        for (String id : PRODUCTS.keySet()) {
            JsonNode plate = byId.get(id).path("assets").path("nameplate");
            byte[] body = getBytes(plate.path("url").asText()).body();
            shas.add(plate.path("sha256").asText());

            // 헤더(IHDR)의 가로·세로가 5 : 1
            ByteBuffer header = ByteBuffer.wrap(body);
            int width = header.getInt(16);
            int height = header.getInt(20);
            assertThat(height).as("N8 height of %s", id).isPositive();
            assertThat(width).as("N8 width = 5 x height of %s (%d x %d)", id, width, height).isEqualTo(height * 5);

            BufferedImage image = ImageIO.read(new ByteArrayInputStream(body));
            assertThat(image).as("N8 readable PNG of %s", id).isNotNull();
            assertThat(image.getColorModel().hasAlpha()).as("N8 %s has an alpha channel", id).isTrue();

            // 투명 배경: 네 모서리는 투명
            int[][] corners = {{0, 0}, {width - 1, 0}, {0, height - 1}, {width - 1, height - 1}};
            for (int[] c : corners) {
                assertThat(image.getRGB(c[0], c[1]) >>> 24).as("N8 corner %d,%d of %s is transparent", c[0], c[1], id).isZero();
            }

            // 글자: 불투명한 점이 있고, 어두운 갈색(밝기 낮음, 빨강 >= 파랑)이며, 가운데에 놓인다
            long count = 0;
            double r = 0;
            double g = 0;
            double b = 0;
            int minX = width;
            int maxX = -1;
            int minY = height;
            int maxY = -1;
            for (int y = 0; y < height; y++) {
                for (int x = 0; x < width; x++) {
                    int argb = image.getRGB(x, y);
                    if ((argb >>> 24) > 200) {
                        count++;
                        r += (argb >> 16) & 0xff;
                        g += (argb >> 8) & 0xff;
                        b += argb & 0xff;
                        minX = Math.min(minX, x);
                        maxX = Math.max(maxX, x);
                        minY = Math.min(minY, y);
                        maxY = Math.max(maxY, y);
                    }
                }
            }
            assertThat(count).as("N8 %s has text pixels", id).isPositive();
            r /= count;
            g /= count;
            b /= count;
            double luminance = 0.299 * r + 0.587 * g + 0.114 * b;
            assertThat(luminance).as("N8 text of %s is dark (avg %.0f,%.0f,%.0f)", id, r, g, b).isLessThan(100);
            assertThat(r).as("N8 text of %s is brown, red >= blue", id).isGreaterThanOrEqualTo(b);
            double centerX = (minX + maxX) / 2.0 / width;
            double centerY = (minY + maxY) / 2.0 / height;
            assertThat(centerX).as("N8 text of %s is centered horizontally", id).isBetween(0.45, 0.55);
            assertThat(centerY).as("N8 text of %s is centered vertically", id).isBetween(0.40, 0.60);
        }
        assertThat(shas).as("N8 six different pictures").hasSize(6);
    }

    @Test
    void n9_sixProductsAreNotSoldNotOwnedNotPlaceable() throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        String email = "qa-130-" + suffix + "@example.com";
        String password = "qa-pass-" + suffix;
        jdbc.update(
                "INSERT INTO users (email, password_hash, display_name, email_verified, verified_at) VALUES (?, ?, ?, 1, NOW())",
                email, passwordEncoder.encode(password), "qa-130-" + suffix);
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
        assertThat(shop.statusCode()).isEqualTo(200);
        List<String> shopTypes = new ArrayList<>();
        for (JsonNode item : JSON.readTree(shop.body()).get("items")) {
            shopTypes.add(item.path("type").asText());
        }
        assertThat(shopTypes).as("N9 not in the home shopping list").doesNotContainAnyElementsOf(PRODUCTS.keySet());

        HttpResponse<String> wardrobe = send(token, "GET", "/api/wardrobe", null);
        assertThat(wardrobe.statusCode()).isEqualTo(200);
        for (String id : PRODUCTS.keySet()) {
            assertThat(wardrobe.body()).as("N9 wardrobe has no %s", id).doesNotContain(id);
        }

        for (String id : PRODUCTS.keySet()) {
            ObjectNode layout = starterLayout();
            ObjectNode item = JSON.createObjectNode().put("id", id + "-1").put("type", id);
            item.set("floor", JSON.createObjectNode().put("x", 4.0).put("z", 5.0).put("facing", 0));
            ((ArrayNode) layout.get("items")).add(item);
            HttpResponse<String> put = send(token, "PUT", "/api/lobby-layout", layout);
            assertThat(put.statusCode()).as("N9 PUT layout with %s, body %s", id, put.body()).isEqualTo(400);
            assertThat(JSON.readTree(put.body()).path("code").asText()).as("N9 code for %s", id).isEqualTo("INVALID_LOBBY_LAYOUT");
        }
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
