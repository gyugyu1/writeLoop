package com.writeloop.controller;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/**
 * [spec] 작업 089 ⑤ 새 몸 넣기, 백엔드. 시나리오 07-아이템-늘리기/23-qa-scenarios.md의 NG4(서버 목록의 고글 항목은 그리기 정보·파일이 없다),
 * NF6(목록의 옷 해시가 지금 파일 내용), NF7(파일이 바뀌어 목록 version이 바뀐다)를 실제 서버로 확인한다.
 *
 * <ul>
 *   <li>기대값은 시나리오에서만 가져왔다. 구현은 HTTP(GET /api/catalog, 파일 API)와 목록 파일 자리만 읽었다.</li>
 *   <li>B는 시나리오 "용어와 가정"대로 이 단계 첫 구현 커밋 d6338fa의 바로 앞 커밋 7f74c06이다(64a30ab 뒤로 창문 붙박이 작업이
 *       items.json을 바꿨다). B의 목록 version과 B 옷 모델 sha256은 B의 items.json·files/로 서버와 같은 방식(목록 파일 바이트 뒤에
 *       파일마다 sha256 글을 이어 sha256, 앞 16자)으로 얻은 값이다. 같은 방식으로 기준 커밋 be00aac를 계산하면
 *       CatalogWearablesSpecTest의 BASE_VERSION(daec8c911b06f83c)이 나온다.</li>
 * </ul>
 */
class CatalogNewBodySpecTest extends IntegrationTestSupport {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Path CATALOG_DIR = Path.of("src", "main", "resources", "catalog");
    private static final Path FILES_DIR = CATALOG_DIR.resolve("files");

    /** B(7f74c06)로 띄운 서버의 목록 version. */
    private static final String B_VERSION = "e82e18fbb6e12e23";

    /** 시나리오 "옷 그림 열일곱"의 옷(열여섯 + 조끼). */
    private static final List<String> SEVENTEEN = List.of(
            "capOrange", "capBlue", "capGreen", "tshirtOrange", "tshirtWhite", "tshirtYellow", "shortsNavy", "shortsBrown",
            "shortsRed", "shoesBrown", "shoesRed", "shoesWhite", "sunglassesBlack", "backpackRed", "mufflerRed", "necklaceGold", "vestGreen");

    /** 시나리오 "11옷"과 B 파일의 sha256. */
    private static final Map<String, String> B_MODEL_SHA = bModelSha();

    private static Map<String, String> bModelSha() {
        Map<String, String> map = new LinkedHashMap<>();
        map.put("wear-backpack.glb", "17aec09d7fa6316b93589e1359124f3b35141471af62b84459701e131e68c672");
        map.put("wear-bottom.glb", "a1af531428b1d07caf57d0cf6e5b5df636677aaad8a00f32c47c9bfa7e32db87");
        map.put("wear-hat.glb", "bc2a4e2b3a61f24ef24f7b024ac49815379ed35ebd8299caca7db9a097b2f477");
        map.put("wear-hat-blue.glb", "2a64c47db7d0113f37beec73209a3bdb7442fe843f4c9eb9272a43d173fe88d3");
        map.put("wear-hat-green.glb", "564e63cee66bbbc269dc25c763dc2c8a08518f28d88e99acc3547a47f6075e8b");
        map.put("wear-muffler.glb", "7c0671e65e8ea09af3d7671b656abb830fdba92267a672ccc9c69a28bebdee85");
        map.put("wear-necklace.glb", "bdd1bd438d261a36402a98fa40a7ddf4fce1ab67d118cc5830f19523014b6b76");
        map.put("wear-shoe.glb", "0e166db5be750d3420e0efc8dc2372048420e1c33dfeedaab460120baf09af44");
        map.put("wear-sunglasses.glb", "b51ab4e2d4ca6054d59ec94d245621a7b252fd6210d3c77f6cc035fc16068888");
        map.put("wear-top.glb", "d6b5b377dec7c9cbfb884504c815639c0ce2abc4b61aed324362642399e1e04c");
        map.put("wear-vest.glb", "16c4321eba0746b2f8adda50417279275174845c295d28d1d1da7d8b3a7ea283");
        return map;
    }

    private final HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();

    // =====================================================================
    // NG4. 서버 목록의 고글 항목
    // =====================================================================

    @Test
    void ng4_gogglesHaveNoDrawNorFilesOnTheServer() throws Exception {
        JsonNode file = JSON.readTree(Files.readString(CATALOG_DIR.resolve("items.json")));
        JsonNode goggles = null;
        for (JsonNode item : file.path("items")) {
            if ("goggles".equals(item.path("id").asText())) {
                goggles = item;
            }
        }
        assertThat(goggles).as("NG4 items.json has goggles").isNotNull();
        assertThat(goggles.has("draw")).as("NG4 items.json goggles has no draw: %s", goggles).isFalse();
        assertThat(goggles.has("files")).as("NG4 items.json goggles has no files: %s", goggles).isFalse();

        List<String> named;
        try (Stream<Path> files = Files.list(FILES_DIR)) {
            named = files.map(p -> p.getFileName().toString()).filter(n -> n.toLowerCase().contains("goggle")).toList();
        }
        assertThat(named).as("NG4 no goggle file in the server files folder").isEmpty();

        JsonNode served = byId(catalog()).get("goggles");
        assertThat(served).as("NG4 GET /api/catalog has goggles").isNotNull();
        assertThat(served.has("assets") && served.get("assets").isNull()).as("NG4 goggles assets is null: %s", served).isTrue();
        assertThat(served.has("draw") && served.get("draw").isNull()).as("NG4 goggles draw is null: %s", served).isTrue();
    }

    // =====================================================================
    // NF6. 목록의 해시가 파일 내용
    // =====================================================================

    @Test
    void nf6_clothHashesAreTheCurrentFiles() throws Exception {
        JsonNode file = JSON.readTree(Files.readString(CATALOG_DIR.resolve("items.json")));
        Map<String, JsonNode> filesById = new LinkedHashMap<>();
        for (JsonNode item : file.path("items")) {
            filesById.put(item.path("id").asText(), item.path("files"));
        }
        Map<String, JsonNode> served = byId(catalog());
        Map<String, String> modelShaByFile = new LinkedHashMap<>();
        for (String id : SEVENTEEN) {
            for (String kind : List.of("model", "icon")) {
                String label = "NF6 " + id + " " + kind;
                String fileName = filesById.get(id).path(kind).asText();
                byte[] content = Files.readAllBytes(FILES_DIR.resolve(fileName));
                JsonNode entry = served.get(id).path("assets").path(kind);
                assertThat(entry.path("sha256").asText()).as("%s sha256", label).isEqualTo(sha256(content));
                assertThat(entry.path("bytes").asLong()).as("%s bytes", label).isEqualTo(content.length);
                HttpResponse<byte[]> response = client.send(HttpRequest.newBuilder(uri(entry.path("url").asText())).GET().build(),
                        HttpResponse.BodyHandlers.ofByteArray());
                assertThat(response.statusCode()).as("%s GET url", label).isEqualTo(200);
                assertThat(response.body()).as("%s downloaded content", label).isEqualTo(content);
                if ("model".equals(kind)) {
                    modelShaByFile.put(fileName, entry.path("sha256").asText());
                }
            }
        }
        assertThat(modelShaByFile.keySet()).as("NF6 the eleven model files").containsExactlyInAnyOrderElementsOf(B_MODEL_SHA.keySet());
        for (Map.Entry<String, String> entry : B_MODEL_SHA.entrySet()) {
            assertThat(modelShaByFile.get(entry.getKey())).as("NF6 %s sha256 differs from B", entry.getKey()).isNotEqualTo(entry.getValue());
        }
    }

    // =====================================================================
    // NF7. 목록 version
    // =====================================================================

    @Test
    void nf7_versionDiffersFromBAndIsStable() throws Exception {
        String first = catalog().path("version").asText();
        String second = catalog().path("version").asText();

        assertThat(first).as("NF7 version differs from B").isNotEqualTo(B_VERSION);
        assertThat(second).as("NF7 version is the same twice").isEqualTo(first);
    }

    // =====================================================================
    // 도움 함수
    // =====================================================================

    private JsonNode catalog() throws Exception {
        HttpResponse<String> response = client.send(HttpRequest.newBuilder(uri("/api/catalog")).GET().build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).as("GET /api/catalog, body %s", response.body()).isEqualTo(200);
        return JSON.readTree(response.body());
    }

    private static Map<String, JsonNode> byId(JsonNode catalog) {
        Map<String, JsonNode> map = new LinkedHashMap<>();
        List<JsonNode> items = new ArrayList<>();
        catalog.path("items").forEach(items::add);
        for (JsonNode item : items) {
            map.put(item.path("id").asText(), item);
        }
        return map;
    }

    private static String sha256(byte[] content) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
    }

    private URI uri(String path) {
        return URI.create(rest.getRootUri() + path);
    }
}
