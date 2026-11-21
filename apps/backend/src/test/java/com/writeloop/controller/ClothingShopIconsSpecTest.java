package com.writeloop.controller;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.support.IntegrationTestSupport;
import java.io.File;
import java.nio.ByteBuffer;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

/**
 * [spec] 작업 133 09 피팅 아이콘·상호작용 칸, 명세 "바뀌는 동작 1": 미등록 13종의 아이콘 그림을 서버 아이템 목록에 넣는다.
 * 기대값은 명세(01-main-spec.md)와 앱 자산 clothing-shop-stock.json(미등록 13종 id)에서만 가져온다. 기준 커밋 d1cd7ea는 "등록된 9종 아이콘과
 * 나머지 항목은 그대로"를 견주는 데만 쓴다.
 * 확인하는 것: 13종마다 files.icon이 "<id>.png"이고 그 파일이 256x256 투명(RGBA) PNG이며, 응답 assets.icon으로 받아지고, 서로 다른 그림이다.
 */
class ClothingShopIconsSpecTest extends IntegrationTestSupport {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String BASE = "d1cd7ea";
    private static final String ITEMS_PATH = "apps/backend/src/main/resources/catalog/items.json";
    private static final String STOCK_PATH = "apps/mobile/src/lib/lobby3d/clothing-shop-stock.json";
    private static final String FILES_PATH = "apps/backend/src/main/resources/catalog/files";
    private static final List<String> NINE = List.of(
            "tshirtOrange", "shortsNavy", "shoesWhite", "capOrange", "shoesBrown", "capBlue", "mufflerRed", "backpackRed", "necklaceGold");

    private static Path repo() {
        Path dir = new File("").toPath().toAbsolutePath();
        while (dir != null && !Files.exists(dir.resolve(STOCK_PATH))) {
            dir = dir.getParent();
        }
        assertThat(dir).as("repo root").isNotNull();
        return dir;
    }

    private static List<String> thirteen() throws Exception {
        List<String> ids = new ArrayList<>();
        for (JsonNode product : JSON.readTree(repo().resolve(STOCK_PATH).toFile()).get("products")) {
            if (product.get("catalogId").isNull()) {
                ids.add(product.get("id").asText());
            }
        }
        assertThat(ids).as("stock.json unregistered products").hasSize(13);
        return ids;
    }

    private static Map<String, JsonNode> byId(JsonNode catalog) {
        Map<String, JsonNode> map = new LinkedHashMap<>();
        for (JsonNode item : catalog.get("items")) {
            map.put(item.path("id").asText(), item);
        }
        return map;
    }

    private static byte[] gitShow(String path) throws Exception {
        Process process = new ProcessBuilder("git", "show", BASE + ":" + path).directory(repo().toFile()).start();
        byte[] bytes = process.getInputStream().readAllBytes();
        assertThat(process.waitFor()).as("git show %s:%s", BASE, path).isZero();
        return bytes;
    }

    private static String sha256(byte[] bytes) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }

    @Test
    void i1_thirteenItemsFileNamesTheIconPngAndTheFileExists() throws Exception {
        Map<String, JsonNode> items = byId(JSON.readTree(repo().resolve(ITEMS_PATH).toFile()));
        for (String id : thirteen()) {
            assertThat(items.get(id).path("files").path("icon").asText()).as("files.icon of %s", id).isEqualTo(id + ".png");
            assertThat(Files.exists(repo().resolve(FILES_PATH).resolve(id + ".png"))).as("icon file of %s", id).isTrue();
        }
    }

    @Test
    void i2_iconsAre256SquareRgbaPngs() throws Exception {
        for (String id : thirteen()) {
            byte[] bytes = Files.readAllBytes(repo().resolve(FILES_PATH).resolve(id + ".png"));
            assertThat(bytes.length).as("size of %s", id).isGreaterThan(33);
            assertThat(HexFormat.of().formatHex(bytes, 0, 8)).as("PNG signature of %s", id).isEqualTo("89504e470d0a1a0a");
            ByteBuffer ihdr = ByteBuffer.wrap(bytes, 16, 10);
            assertThat(ihdr.getInt()).as("width of %s", id).isEqualTo(256);
            assertThat(ihdr.getInt()).as("height of %s", id).isEqualTo(256);
            assertThat(ihdr.get()).as("bit depth of %s", id).isEqualTo((byte) 8);
            assertThat(ihdr.get()).as("color type RGBA of %s", id).isEqualTo((byte) 6);
        }
    }

    @Test
    void i3_thirteenIconsAreDistinctPictures() throws Exception {
        List<String> shas = new ArrayList<>();
        for (String id : thirteen()) {
            shas.add(sha256(Files.readAllBytes(repo().resolve(FILES_PATH).resolve(id + ".png"))));
        }
        assertThat(shas).as("13 distinct icon pictures").doesNotHaveDuplicates();
    }

    @Test
    void i4_nineRegisteredIconsAndEveryOtherItemAreUnchanged() throws Exception {
        List<String> thirteen = thirteen();
        JsonNode now = JSON.readTree(repo().resolve(ITEMS_PATH).toFile());
        JsonNode base = JSON.readTree(gitShow(ITEMS_PATH));
        List<JsonNode> others = new ArrayList<>();
        for (JsonNode item : now.get("items")) {
            if (!thirteen.contains(item.path("id").asText())) {
                others.add(item);
            }
        }
        List<JsonNode> baseItems = new ArrayList<>();
        for (JsonNode item : base.get("items")) {
            if (!thirteen.contains(item.path("id").asText())) {
                baseItems.add(item);
            }
        }
        assertThat(others).as("items other than the thirteen equal the base items in order").isEqualTo(baseItems);
        for (String id : NINE) {
            String path = FILES_PATH + "/" + id + ".png";
            assertThat(Files.readAllBytes(repo().resolve(path))).as("registered icon %s unchanged", id).isEqualTo(gitShow(path));
        }
    }

    @Test
    void i5_responseGivesTheThirteenAnIconThatDownloadsAtItsHash() throws Exception {
        ResponseEntity<String> response = rest.getForEntity("/api/catalog", String.class);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        Map<String, JsonNode> items = byId(JSON.readTree(response.getBody()));
        for (String id : thirteen()) {
            JsonNode icon = items.get(id).path("assets").path("icon");
            assertThat(icon.isMissingNode() || icon.isNull()).as("assets.icon of %s present: %s", id, items.get(id)).isFalse();
            String url = icon.path("url").asText();
            assertThat(url).as("icon url of %s", id).matches("/api/catalog/files/[0-9a-f]{64}\\.png");
            ResponseEntity<byte[]> file = rest.getForEntity(url, byte[].class);
            assertThat(file.getStatusCode().value()).as("GET icon of %s", id).isEqualTo(200);
            assertThat(sha256(file.getBody())).as("downloaded icon sha of %s", id).isEqualTo(icon.path("sha256").asText());
            assertThat((long) file.getBody().length).as("downloaded icon bytes of %s", id).isEqualTo(icon.path("bytes").asLong());
        }
    }
}
