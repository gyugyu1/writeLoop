package com.writeloop.controller;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.writeloop.service.ItemCatalogWearablesSpecTest;
import com.writeloop.service.ItemCatalogWearablesSpecTest.Wear;
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
import java.util.Arrays;
import java.util.Comparator;
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
 * [spec] 작업 090 ③ 옷 내려받기, 백엔드 시나리오(05-옷-내려받기/03-qa-scenarios.md) 가운데 HTTP로 보는 것.
 *
 * <ul>
 *   <li>W6~W11: GET /api/catalog의 옷 draw·assets.</li>
 *   <li>W13~W19: 파일 API와 옷 모델 파일(glb) 내용.</li>
 *   <li>W20: 목록 version.</li>
 *   <li>W22~W26: 홈쇼핑·옷장·배치 검사 그대로, 시험 옷.</li>
 * </ul>
 * 결정 05: 고글은 draw·files가 없어 응답 assets가 null이다. 옷 모델은 열(모자 셋, 상의, 하의, 신발 한 짝, 선글라스, 백팩,
 * 머플러, 목걸이)이고 시험 옷(조끼)도 아이콘이 있다.
 * W12·W27은 기존 테스트(CatalogFilesSpecTest·ItemCatalogDrawSpecTest·ItemCatalogKeepSpecTest)가 그대로 맡는다.
 * W21(옷 파일만 바뀐 목록의 version)은 다른 파일로 목록을 읽는 진입점이 없어 옮기지 않았다.
 */
class CatalogWearablesSpecTest extends IntegrationTestSupport {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Pattern HEX64 = Pattern.compile("[0-9a-f]{64}");
    private static final Pattern MODEL_URL = Pattern.compile("/api/catalog/files/([0-9a-f]{64})\\.glb");
    private static final Pattern ICON_URL = Pattern.compile("/api/catalog/files/([0-9a-f]{64})\\.png");
    private static final String FILES = "/api/catalog/files/";

    /** 기준 커밋 be00aac의 목록 version(W20). */
    private static final String BASE_VERSION = "daec8c911b06f83c";

    /** 허용 오차(가정 G7). */
    private static final double TOLERANCE = 1e-3;

    /** 라룹이 뼈 이름 열여덟. */
    private static final Set<String> BONES = Set.of(
            "root", "hips", "leg_l", "foot_l", "leg_r", "foot_r", "spine", "arm_l", "hand_l", "arm_r", "hand_r", "thumb_r",
            "head", "ear_l", "ear_r", "tail_1", "tail_2", "tail_3");

    /** 기준 묶음의 착용 메시 노드 이름(부록 C)과 오른쪽 신발 이름. */
    private static final Set<String> WEAR_NODES = Set.of(
            "wear-backpack", "wear-hat", "wear-hat-blue", "wear-hat-green", "wear-muffler", "wear-necklace", "wear-shoe-l",
            "wear-sunglasses", "wear-bottom", "wear-top", "wear-shoe-r");

    /** 부록 B: 기준 커밋 apps/mobile/assets/icons/wearables/&lt;id&gt;.png의 sha256·bytes(고글은 결정 05로 파일 없음). */
    private record IconFile(String sha256, long bytes) {
    }

    private static final Map<String, IconFile> ICONS = icons();

    private static Map<String, IconFile> icons() {
        Map<String, IconFile> map = new LinkedHashMap<>();
        map.put("backpackRed", new IconFile("1cf315241e75d4ef30bb9e0ad5579b91275cdbc98995a54b32415c418e0d84ae", 79885));
        map.put("capBlue", new IconFile("7f71df853b20ad146116acc30ab632f6de4b246719a10765ffee5af68f8ae6c7", 76149));
        map.put("capGreen", new IconFile("5b74917bb087ad960226b4841fd145126ed87d3f07ab8ea2d521232391cf8499", 77102));
        map.put("capOrange", new IconFile("d27ff4949392ba9a64084fafedba7a15e23deb0d998893ce42f3a361d564e4e3", 76099));
        map.put("mufflerRed", new IconFile("4db84575bd949fc0c2c084107b0da558deed836486e0abc88ed3dfd4a72d23df", 95603));
        map.put("necklaceGold", new IconFile("8ba6bd0e6bef2478c41a5808ceca12cf809a556a9ac1b83a510386f76c96bf86", 93213));
        map.put("shoesBrown", new IconFile("6bce9bffa10c667b3bad1515a21e853b001b6d626141a4d79c4509822c88ec4a", 67596));
        map.put("shoesRed", new IconFile("f4ea9abf902b99ef2de2fc1ecbb5f91c1945bb8fa33ba6089d5253356f2b4739", 68755));
        map.put("shoesWhite", new IconFile("83ef155d6a0a22189326d98ace4a10df6750de65b365b1493b45415a711b30bc", 64556));
        map.put("shortsBrown", new IconFile("92e6b065e3216417cee2034a0695f922a73c7a6a7316498f0fd758189b3bdb49", 80093));
        map.put("shortsNavy", new IconFile("1748d02914114e64893ec9ffa815d6713eb9579f63b08ec8d4eacf339bcf4836", 79767));
        map.put("shortsRed", new IconFile("5e4443f2c21029162aaa95902a738f84e870720307f6243dc7c9e3fdff6dfd93", 81342));
        map.put("sunglassesBlack", new IconFile("e35ef20dd053d7663edf7aef45e8795e368dfa9b2a268863921f7d3829c5df99", 83358));
        map.put("tshirtOrange", new IconFile("145094aaf07d689dfea189250ed7b27a8ff580aba27c59cfed0ecfa10f84d2e3", 96326));
        map.put("tshirtWhite", new IconFile("0c3ceb6bf38caecef83e385e5a0899c6a04513498c1442e033a32f03ec5a290f", 89611));
        map.put("tshirtYellow", new IconFile("2315f7e31700f3bf46ebbc340b9d85fb6a31df6a4959dcc3c8c0cc5ddf76dc15", 96556));
        return map;
    }

    /** 부록 C: 메시 경계 상자와 텍스처 없는 재질 색(조각마다). colors가 null이면 텍스처(모자). */
    private record Mesh(boolean skin, double[] min, double[] max, List<double[]> colors) {
    }

    private static final Map<String, Mesh> MESHES = meshes();

    private static Map<String, Mesh> meshes() {
        Map<String, Mesh> map = new LinkedHashMap<>();
        map.put("wear-backpack", new Mesh(false, v(-0.1945, 0.1675, -0.5418), v(0.1999, 0.4771, 0.2021),
                List.of(v(0.5776, 0.0578, 0.0423, 1), v(0.3916, 0.0331, 0.0252, 1), v(0.1559, 0.0232, 0.0176, 1))));
        map.put("wear-hat", new Mesh(false, v(-0.1368, 0.8987, -0.0964), v(0.1332, 1.1128, 0.2688), null));
        map.put("wear-hat-blue", new Mesh(false, v(-0.1368, 0.8987, -0.0964), v(0.1332, 1.1128, 0.2688), null));
        map.put("wear-hat-green", new Mesh(false, v(-0.1368, 0.8987, -0.0964), v(0.1332, 1.1128, 0.2688), null));
        map.put("wear-muffler", new Mesh(false, v(-0.271, 0.2079, -0.2321), v(0.2765, 0.4026, 0.2233),
                List.of(v(0.6445, 0.0452, 0.0452, 1))));
        map.put("wear-necklace", new Mesh(false, v(-0.2272, 0.2527, -0.1879), v(0.2326, 0.4203, 0.2089),
                List.of(v(0.7454, 0.4508, 0.0452, 1))));
        map.put("wear-shoe-l", new Mesh(false, v(0.0121, -0.004, -0.0974), v(0.213, 0.0939, 0.1772),
                List.of(v(0.1946, 0.0685, 0.0232, 1))));
        map.put("wear-sunglasses", new Mesh(false, v(-0.3345, 0.556, 0.1239), v(0.3302, 0.7303, 0.3656),
                List.of(v(0.013, 0.013, 0.0176, 1), v(0.0052, 0.0052, 0.007, 1))));
        map.put("wear-bottom", new Mesh(true, v(-0.2238, -0.024, -0.1962), v(0.2217, 0.2672, 0.1526),
                List.of(v(0.0343, 0.0802, 0.1946, 1))));
        map.put("wear-top", new Mesh(true, v(-0.3138, 0.1067, -0.256), v(0.303, 0.5188, 0.182),
                List.of(v(0.8714, 0.2423, 0.0423, 1))));
        return map;
    }

    /** 기준 커밋 홈쇼핑 상품 순서와 정가(W22). */
    private static final List<String> SHOP_TYPES = List.of(
            "books", "smallPlant", "lamp", "capOrange", "capBlue", "capGreen", "frame", "shortsNavy", "shortsBrown", "shortsRed",
            "plant", "tshirtOrange", "tshirtWhite", "tshirtYellow", "shoesBrown", "shoesRed", "shoesWhite", "mufflerRed",
            "nightstand", "sunglassesBlack", "floorLamp", "necklaceGold", "backpackRed", "rug", "wardrobe", "bed");
    private static final List<Integer> SHOP_PRICES = List.of(
            40, 50, 60, 60, 60, 60, 70, 70, 70, 70, 80, 80, 80, 80, 90, 90, 90, 90, 100, 100, 110, 110, 120, 150, 180, 300);

    private static final List<String> WEAR_SLOTS = List.of("hat", "top", "bottom", "shoes", "face", "back", "accessory");

    @Autowired
    private PasswordEncoder passwordEncoder;

    private final HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();

    // =====================================================================
    // B. GET /api/catalog
    // =====================================================================

    @Test
    void w6_responseShapeIsUnchanged() throws Exception {
        HttpResponse<String> response = getString(null, "/api/catalog");
        assertThat(response.statusCode()).as("W6 GET /api/catalog without login, body %s", response.body()).isEqualTo(200);
        JsonNode body = JSON.readTree(response.body());
        assertThat(fieldNames(body)).as("W6 top-level keys").isEqualTo(set("version", "items"));
        Set<String> expected = set("id", "kind", "name", "shopName", "description", "category", "slot", "price", "assets", "draw");
        for (JsonNode item : body.get("items")) {
            assertThat(fieldNames(item)).as("W6 keys of %s", item.path("id").asText()).isEqualTo(expected);
        }
    }

    @Test
    void w7_clothAssetsHaveTheFurnitureShape() throws Exception {
        Map<String, JsonNode> byId = byId(catalog());
        List<String> ids = sixteenIds();
        ids.add(testCloth().path("id").asText());
        for (String id : ids) {
            JsonNode item = byId.get(id);
            assertThat(item).as("W7 %s in the response", id).isNotNull();
            JsonNode assets = item.get("assets");
            assertThat(assets != null && assets.isObject()).as("W7 assets of %s is an object: %s", id, item).isTrue();
            assertThat(fieldNames(assets)).as("W7 assets keys of %s", id).isEqualTo(set("model", "icon"));
            assertFileEntry(assets.get("model"), MODEL_URL, "W7 model of " + id);
            assertFileEntry(assets.get("icon"), ICON_URL, "W7 icon of " + id);
        }
    }

    @Test
    void w8_gogglesHasNoAssetsAndNoDraw() throws Exception {
        JsonNode goggles = byId(catalog()).get(ItemCatalogWearablesSpecTest.GOGGLES);
        assertThat(goggles).as("W8 goggles in the response").isNotNull();
        assertThat(goggles.has("assets") && goggles.get("assets").isNull()).as("W8 goggles assets is null (결정 05 1): %s", goggles).isTrue();
        assertThat(goggles.has("draw") && goggles.get("draw").isNull()).as("W8 goggles draw is null (결정 05 1): %s", goggles).isTrue();
    }

    @Test
    void w9_drawInTheResponse() throws Exception {
        Map<String, JsonNode> byId = byId(catalog());
        for (Wear wear : ItemCatalogWearablesSpecTest.SIXTEEN) {
            JsonNode item = byId.get(wear.id());
            assertThat(item).as("W9 %s in the response", wear.id()).isNotNull();
            ItemCatalogWearablesSpecTest.assertWearDraw(item.get("draw"), wear, "W9 response");
        }
        JsonNode test = testCloth();
        String label = "W9 " + test.path("id").asText();
        JsonNode draw = test.get("draw");
        assertThat(draw != null && draw.isObject()).as("%s draw is an object: %s", label, test).isTrue();
        assertThat(draw.path("attach").asText()).as("%s attach", label).isEqualTo("skin");
        assertThat(draw.hasNonNull("bone")).as("%s has no bone", label).isFalse();
        assertThat(draw.hasNonNull("mirror")).as("%s has no mirror", label).isFalse();
        assertThat(draw.path("body").isIntegralNumber()).as("%s body is an integer", label).isTrue();
        assertThat(draw.path("body").asInt()).as("%s body", label).isEqualTo(ItemCatalogWearablesSpecTest.BODY);
    }

    @Test
    void w10_colorVariantsShareAModelAndHatsDoNot() throws Exception {
        Map<String, JsonNode> byId = byId(catalog());
        Map<String, String> shaByModel = new LinkedHashMap<>();
        for (Wear wear : ItemCatalogWearablesSpecTest.SIXTEEN) {
            JsonNode model = byId.get(wear.id()).path("assets").path("model");
            String sha = model.path("sha256").asText();
            String url = model.path("url").asText();
            assertThat(sha).as("setup: model sha of %s", wear.id()).matches(HEX64);
            String known = shaByModel.putIfAbsent(wear.model(), sha + " " + url);
            if (known != null) {
                assertThat(sha + " " + url).as("W10 %s shares the %s file", wear.id(), wear.model()).isEqualTo(known);
            }
        }
        // 부록 A의 모델 열 개는 서로 다른 파일
        assertThat(shaByModel).as("W10 models of the sixteen").hasSize(10);
        Set<String> distinct = new LinkedHashSet<>();
        shaByModel.values().forEach(value -> distinct.add(value.split(" ")[0]));
        assertThat(distinct).as("W10 ten distinct model files: %s", shaByModel).hasSize(10);

        String testSha = testCloth().path("assets").path("model").path("sha256").asText();
        assertThat(testSha).as("W10 test cloth model sha").matches(HEX64);
        assertThat(distinct).as("W10 test cloth model differs from the ten").doesNotContain(testSha);

        Set<String> furnitureModels = new LinkedHashSet<>();
        for (JsonNode item : catalog().get("items")) {
            if ("furniture".equals(item.path("kind").asText())) {
                furnitureModels.add(item.path("assets").path("model").path("sha256").asText());
            }
        }
        assertThat(furnitureModels).as("W10 cloth models are not furniture models").doesNotContainAnyElementsOf(distinct);
        assertThat(furnitureModels).as("W10 test cloth model is not a furniture model").doesNotContain(testSha);
    }

    @Test
    void w11_iconsAreTheAppWearablePictures() throws Exception {
        Map<String, JsonNode> byId = byId(catalog());
        for (Map.Entry<String, IconFile> entry : ICONS.entrySet()) {
            String id = entry.getKey();
            IconFile expected = entry.getValue();
            JsonNode icon = byId.get(id).path("assets").path("icon");
            assertThat(icon.path("sha256").asText()).as("W11 icon sha256 of %s", id).isEqualTo(expected.sha256());
            assertThat(icon.path("bytes").asLong()).as("W11 icon bytes of %s", id).isEqualTo(expected.bytes());
            HttpResponse<byte[]> response = getBytes(null, icon.path("url").asText());
            assertThat(response.statusCode()).as("W11 GET icon of %s", id).isEqualTo(200);
            assertThat((long) response.body().length).as("W11 downloaded icon length of %s", id).isEqualTo(expected.bytes());
            assertThat(sha256(response.body())).as("W11 downloaded icon sha256 of %s", id).isEqualTo(expected.sha256());
        }
    }

    // =====================================================================
    // C. 파일 API
    // =====================================================================

    @Test
    void w13_w14_everyClothFileIsServedAtItsContentHash() throws Exception {
        TestUser user = newUser("w13");
        List<JsonNode> entries = clothFileEntries(catalog());
        // 열일곱 옷(열여섯 + 시험 옷) × 모델·아이콘
        assertThat(entries).as("W13 cloth file entries").hasSize(34);
        for (JsonNode entry : entries) {
            String url = entry.path("url").asText();
            String sha = entry.path("sha256").asText();
            Matcher matcher = Pattern.compile("/api/catalog/files/([0-9a-f]{64})\\.(glb|png)").matcher(url);
            assertThat(matcher.matches()).as("W13 url shape %s", url).isTrue();
            assertThat(matcher.group(1)).as("W13 hash in url %s = sha256", url).isEqualTo(sha);

            HttpResponse<byte[]> response = getBytes(null, url);
            assertThat(response.statusCode()).as("W13 GET %s without login", url).isEqualTo(200);
            assertThat((long) response.body().length).as("W13 length of %s = bytes", url).isEqualTo(entry.path("bytes").asLong());
            assertThat(sha256(response.body())).as("W13 sha256 of %s", url).isEqualTo(sha);
            // W14
            assertThat(response.headers().allValues("Cache-Control")).as("W14 Cache-Control of %s", url)
                    .containsExactly("public, max-age=31536000, immutable");
            String contentType = "glb".equals(matcher.group(2)) ? "model/gltf-binary" : "image/png";
            assertThat(response.headers().firstValue("Content-Type").orElse("")).as("W14 Content-Type of %s", url)
                    .isEqualTo(contentType);

            HttpResponse<byte[]> withLogin = getBytes(user.token(), url);
            assertThat(withLogin.statusCode()).as("W13 GET %s with login", url).isEqualTo(200);
            assertThat(withLogin.body()).as("W13 same body with login %s", url).isEqualTo(response.body());
        }
    }

    @Test
    void w15_sameModelHasOneUrlAndUnlistedHashIs404() throws Exception {
        Map<String, JsonNode> byId = byId(catalog());
        for (List<String> group : List.of(
                List.of("tshirtOrange", "tshirtWhite", "tshirtYellow"),
                List.of("shortsNavy", "shortsBrown", "shortsRed"),
                List.of("shoesBrown", "shoesRed", "shoesWhite"))) {
            Set<String> urls = new LinkedHashSet<>();
            for (String id : group) {
                urls.add(byId.get(id).path("assets").path("model").path("url").asText());
            }
            assertThat(urls).as("W15 one model url for %s", group).hasSize(1);
        }
        String unlisted = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        for (JsonNode entry : clothFileEntries(catalog())) {
            assertThat(entry.path("sha256").asText()).as("setup: hash is not listed").isNotEqualTo(unlisted);
        }
        for (String ext : List.of("glb", "png")) {
            assertThat(getBytes(null, FILES + unlisted + "." + ext).statusCode()).as("W15 GET unlisted .%s", ext).isEqualTo(404);
        }
    }

    @Test
    void w16_everyClothModelIsAGlb() throws Exception {
        for (Map.Entry<String, byte[]> entry : clothModels().entrySet()) {
            parseGlb(entry.getValue(), "W16 " + entry.getKey());
        }
    }

    @Test
    void w17_boneModelsAreTheirOwnMeshAtTheSamePlaceAndColor() throws Exception {
        Map<String, byte[]> models = clothModels();
        Map<String, String> textures = new LinkedHashMap<>();
        for (String node : List.of("wear-hat", "wear-hat-blue", "wear-hat-green", "wear-shoe-l", "wear-sunglasses",
                "wear-backpack", "wear-muffler", "wear-necklace")) {
            String label = "W17 " + node;
            Glb glb = parseGlb(models.get(node), label);
            assertOwnMeshOnly(glb, node, label);
            Mesh expected = MESHES.get(node);
            int index = glb.nodeIndex(node);
            double[] world = glb.worldMatrix(index);
            double[][] box = glb.meshBox(index, world);
            assertBox(box, expected, label + " world box");
            JsonNode mesh = glb.gltf.path("meshes").get(glb.gltf.path("nodes").get(index).path("mesh").asInt());
            if (expected.colors() == null) {
                List<String> shas = new ArrayList<>();
                for (JsonNode primitive : mesh.path("primitives")) {
                    JsonNode material = glb.gltf.path("materials").get(primitive.path("material").asInt());
                    JsonNode texture = material.path("pbrMetallicRoughness").get("baseColorTexture");
                    assertThat(texture).as("%s material has a base color texture: %s", label, material).isNotNull();
                    shas.add(glb.textureSha(texture.path("index").asInt()));
                }
                textures.put(node, String.join(",", shas));
            } else {
                assertColors(glb, mesh, expected.colors(), label);
            }
        }
        assertThat(new LinkedHashSet<>(textures.values())).as("W17 three hats have different textures: %s", textures).hasSize(3);
    }

    @Test
    void w18_skinModelsCarryTheSkeletonAtTheSameShapeAndColor() throws Exception {
        Map<String, byte[]> models = clothModels();
        for (String node : List.of("wear-top", "wear-bottom")) {
            String label = "W18 " + node;
            Glb glb = parseGlb(models.get(node), label);
            assertOwnMeshOnly(glb, node, label);
            int index = glb.nodeIndex(node);
            assertSkinned(glb, index, label);
            Mesh expected = MESHES.get(node);
            assertBox(glb.meshBox(index, null), expected, label + " raw POSITION box");
            JsonNode mesh = glb.gltf.path("meshes").get(glb.gltf.path("nodes").get(index).path("mesh").asInt());
            assertColors(glb, mesh, expected.colors(), label);
        }
    }

    @Test
    void w19_testClothModelIsASkinnedMeshDifferentFromTheTop() throws Exception {
        JsonNode test = testCloth();
        String label = "W19 " + test.path("id").asText();
        JsonNode model = test.path("assets").path("model");
        HttpResponse<byte[]> response = getBytes(null, model.path("url").asText());
        assertThat(response.statusCode()).as("%s GET model", label).isEqualTo(200);
        Glb glb = parseGlb(response.body(), label);
        int meshNodes = 0;
        JsonNode nodes = glb.gltf.path("nodes");
        for (int i = 0; i < nodes.size(); i++) {
            if (nodes.get(i).has("mesh")) {
                meshNodes++;
                assertSkinned(glb, i, label + " node " + nodes.get(i).path("name").asText());
            }
        }
        assertThat(meshNodes).as("%s has a mesh", label).isPositive();
        String topSha = byId(catalog()).get("tshirtOrange").path("assets").path("model").path("sha256").asText();
        assertThat(sha256(response.body())).as("%s differs from the top model", label).isNotEqualTo(topSha);
    }

    // =====================================================================
    // D. version
    // =====================================================================

    @Test
    void w20_versionChangedFromTheBaseAndIsStable() throws Exception {
        String first = catalog().path("version").asText();
        String second = catalog().path("version").asText();
        assertThat(first).as("W20 version differs from the base (be00aac) version").isNotEqualTo(BASE_VERSION);
        assertThat(second).as("W20 same version on the second call").isEqualTo(first);
    }

    // =====================================================================
    // E. 홈쇼핑·옷장·배치 그대로, 시험 옷
    // =====================================================================

    @Test
    void w22_shopListUnchangedAndWithoutTheTestCloth() throws Exception {
        String type = testCloth().path("id").asText();
        TestUser user = newUser("w22");

        HttpResponse<String> response = send(user, "GET", "/api/home-shopping", null);

        assertThat(response.statusCode()).as("W22 GET /api/home-shopping, body %s", response.body()).isEqualTo(200);
        List<String> types = new ArrayList<>();
        List<Integer> prices = new ArrayList<>();
        for (JsonNode item : JSON.readTree(response.body()).get("items")) {
            types.add(item.path("type").asText());
            prices.add(item.path("price").asInt());
        }
        assertThat(types).as("W22 types in order").containsExactlyElementsOf(SHOP_TYPES);
        assertThat(prices).as("W22 regular prices in order").containsExactlyElementsOf(SHOP_PRICES);
        assertThat(types).as("W22 test cloth is not sold").doesNotContain(type);
    }

    @Test
    void w23_testClothCannotBeOrdered() throws Exception {
        String type = testCloth().path("id").asText();
        TestUser user = newUser("w23");
        send(user, "GET", "/api/loop-points", null);
        jdbc.update("UPDATE loop_point_balances SET balance = 10000 WHERE user_id = ?", user.id());

        for (int price : List.of(0, 100, 300)) {
            ObjectNode order = JSON.createObjectNode().put("type", type).put("price", price);
            HttpResponse<String> response = send(user, "POST", "/api/home-shopping/orders", order);
            assertThat(response.statusCode()).as("W23 order %s at %d, body %s", type, price, response.body()).isEqualTo(400);
            assertThat(JSON.readTree(response.body()).path("code").asText()).as("W23 code at %d", price).isEqualTo("UNKNOWN_PRODUCT");
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM home_shopping_orders WHERE user_id = ?", Integer.class, user.id()))
                .as("W23 no order rows").isZero();
        assertThat(jdbc.queryForObject("SELECT balance FROM loop_point_balances WHERE user_id = ?", Integer.class, user.id()))
                .as("W23 balance unchanged").isEqualTo(10000);
    }

    @Test
    void w24_newUserWardrobeHasOnlyTheGoggles() throws Exception {
        TestUser user = newUser("w24");

        HttpResponse<String> response = send(user, "GET", "/api/wardrobe", null);

        assertThat(response.statusCode()).as("W24 GET /api/wardrobe, body %s", response.body()).isEqualTo(200);
        List<String> typeSlots = new ArrayList<>();
        for (JsonNode item : JSON.readTree(response.body()).get("items")) {
            typeSlots.add(item.path("type").asText() + "/" + item.path("slot").asText());
        }
        assertThat(typeSlots).as("W24 wardrobe items").containsExactly("goggles/face");
    }

    @Test
    void w25_testClothIsWornOnlyOnTopAndOnlyWhenOwned() throws Exception {
        String type = testCloth().path("id").asText();
        TestUser owner = newUser("w25o");
        jdbc.update("INSERT INTO wardrobe_items (user_id, item_type, acquired_at) VALUES (?, ?, ?)",
                owner.id(), type, "2026-11-01 00:00:00");

        HttpResponse<String> top = send(owner, "PUT", "/api/wardrobe/equipped", JSON.createObjectNode().put("top", type));
        assertThat(top.statusCode()).as("W25 owner wears %s on top, body %s", type, top.body()).isEqualTo(200);
        assertThat(JSON.readTree(top.body()).path("equipped").path("top").asText()).as("W25 equipped top").isEqualTo(type);

        for (String slot : WEAR_SLOTS) {
            if (slot.equals("top")) {
                continue;
            }
            HttpResponse<String> response = send(owner, "PUT", "/api/wardrobe/equipped", JSON.createObjectNode().put(slot, type));
            assertThat(response.statusCode()).as("W25 %s in %s, body %s", type, slot, response.body()).isEqualTo(400);
            assertThat(JSON.readTree(response.body()).path("code").asText()).as("W25 code %s in %s", type, slot)
                    .isEqualTo("WARDROBE_INVALID");
        }

        TestUser other = newUser("w25n");
        HttpResponse<String> notOwned = send(other, "PUT", "/api/wardrobe/equipped", JSON.createObjectNode().put("top", type));
        assertThat(notOwned.statusCode()).as("W25 not owned %s on top, body %s", type, notOwned.body()).isEqualTo(400);
        assertThat(JSON.readTree(notOwned.body()).path("code").asText()).as("W25 code not owned").isEqualTo("WARDROBE_INVALID");
    }

    @Test
    void w26_testClothIsNotFurnitureInTheLayout() throws Exception {
        String type = testCloth().path("id").asText();
        TestUser user = newUser("w26");
        jdbc.update("INSERT INTO wardrobe_items (user_id, item_type, acquired_at) VALUES (?, ?, ?)",
                user.id(), type, "2026-11-01 00:00:00");

        ObjectNode inRoom = starterLayout();
        ((ArrayNode) inRoom.get("items")).add(floorItem(type + "-1", type, 4.0, 5.0, 0));
        assertRejected(user, inRoom, "W26 " + type + " in the room");

        ObjectNode inStorage = starterLayout();
        inStorage.set("stored", JSON.createArrayNode().add(JSON.createObjectNode().put("id", type + "-1").put("type", type)));
        assertRejected(user, inStorage, "W26 " + type + " in storage");

        assertThat(send(user, "GET", "/api/lobby-layout", null).statusCode()).as("W26 nothing saved").isEqualTo(404);
    }

    // =====================================================================
    // 도우미: 목록
    // =====================================================================

    private JsonNode catalog() throws Exception {
        HttpResponse<String> response = getString(null, "/api/catalog");
        assertThat(response.statusCode()).as("GET /api/catalog, body %s", response.body()).isEqualTo(200);
        return JSON.readTree(response.body());
    }

    private static List<String> sixteenIds() {
        List<String> ids = new ArrayList<>();
        ItemCatalogWearablesSpecTest.SIXTEEN.forEach(wear -> ids.add(wear.id()));
        return ids;
    }

    /** 응답의 옷 열일곱 밖의 옷 하나(시험 옷). */
    private JsonNode testCloth() throws Exception {
        List<JsonNode> others = new ArrayList<>();
        for (JsonNode item : catalog().get("items")) {
            if ("wearable".equals(item.path("kind").asText())
                    && !ItemCatalogWearablesSpecTest.SEVENTEEN.contains(item.path("id").asText())) {
                others.add(item);
            }
        }
        assertThat(others).as("setup: exactly one test cloth").hasSize(1);
        return others.get(0);
    }

    private static Map<String, JsonNode> byId(JsonNode body) {
        Map<String, JsonNode> map = new LinkedHashMap<>();
        for (JsonNode item : body.get("items")) {
            map.put(item.path("id").asText(), item);
        }
        return map;
    }

    /** 응답의 옷 파일 항목(모델, null이 아닌 아이콘). */
    private static List<JsonNode> clothFileEntries(JsonNode body) {
        List<JsonNode> entries = new ArrayList<>();
        for (JsonNode item : body.get("items")) {
            if (!"wearable".equals(item.path("kind").asText())) {
                continue;
            }
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

    /** 부록 A의 모델 이름 → 받은 모델 파일(그 모델을 쓰는 첫 옷의 모델 주소로 받는다). */
    private Map<String, byte[]> clothModels() throws Exception {
        Map<String, JsonNode> byId = byId(catalog());
        Map<String, byte[]> models = new LinkedHashMap<>();
        for (Wear wear : ItemCatalogWearablesSpecTest.SIXTEEN) {
            if (models.containsKey(wear.model())) {
                continue;
            }
            String url = byId.get(wear.id()).path("assets").path("model").path("url").asText();
            HttpResponse<byte[]> response = getBytes(null, url);
            assertThat(response.statusCode()).as("setup: GET model of %s (%s)", wear.id(), url).isEqualTo(200);
            models.put(wear.model(), response.body());
        }
        String testUrl = testCloth().path("assets").path("model").path("url").asText();
        HttpResponse<byte[]> test = getBytes(null, testUrl);
        assertThat(test.statusCode()).as("setup: GET test cloth model").isEqualTo(200);
        models.put("test cloth", test.body());
        return models;
    }

    /** {url, sha256, bytes} 한 항목의 모양. */
    private static void assertFileEntry(JsonNode entry, Pattern urlPattern, String label) {
        assertThat(entry != null && entry.isObject()).as("%s is an object: %s", label, entry).isTrue();
        assertThat(fieldNames(entry)).as("%s keys", label).isEqualTo(set("url", "sha256", "bytes"));
        assertThat(entry.path("url").isTextual()).as("%s url is a string", label).isTrue();
        assertThat(urlPattern.matcher(entry.path("url").asText()).matches()).as("%s url shape: %s", label, entry.path("url")).isTrue();
        assertThat(entry.path("sha256").asText()).as("%s sha256 is 64 lowercase hex", label).matches(HEX64);
        assertThat(entry.path("bytes").isIntegralNumber()).as("%s bytes is an integer: %s", label, entry.path("bytes")).isTrue();
        assertThat(entry.path("bytes").asLong()).as("%s bytes is positive", label).isPositive();
    }

    // =====================================================================
    // 도우미: glb
    // =====================================================================

    private static double[] v(double... values) {
        return values;
    }

    /** glb의 JSON과 BIN 조각. */
    private record Glb(JsonNode gltf, byte[] bin) {

        int nodeIndex(String name) {
            JsonNode nodes = gltf.path("nodes");
            for (int i = 0; i < nodes.size(); i++) {
                if (name.equals(nodes.get(i).path("name").asText())) {
                    return i;
                }
            }
            throw new AssertionError("no node " + name);
        }

        /** 노드의 세계 행렬(열 우선 4x4). */
        double[] worldMatrix(int index) {
            JsonNode nodes = gltf.path("nodes");
            Map<Integer, Integer> parent = new LinkedHashMap<>();
            for (int i = 0; i < nodes.size(); i++) {
                for (JsonNode child : nodes.get(i).path("children")) {
                    parent.put(child.asInt(), i);
                }
            }
            double[] world = local(nodes.get(index));
            Integer up = parent.get(index);
            while (up != null) {
                world = multiply(local(nodes.get(up)), world);
                up = parent.get(up);
            }
            return world;
        }

        /** 노드 메시의 모든 조각 POSITION을 행렬로 옮긴 경계 상자(matrix가 null이면 원값). */
        double[][] meshBox(int index, double[] matrix) {
            JsonNode mesh = gltf.path("meshes").get(gltf.path("nodes").get(index).path("mesh").asInt());
            double[] min = {Double.MAX_VALUE, Double.MAX_VALUE, Double.MAX_VALUE};
            double[] max = {-Double.MAX_VALUE, -Double.MAX_VALUE, -Double.MAX_VALUE};
            for (JsonNode primitive : mesh.path("primitives")) {
                JsonNode accessor = gltf.path("accessors").get(primitive.path("attributes").path("POSITION").asInt());
                assertThat(accessor.path("componentType").asInt()).as("POSITION is float").isEqualTo(5126);
                assertThat(accessor.path("type").asText()).as("POSITION is VEC3").isEqualTo("VEC3");
                JsonNode view = gltf.path("bufferViews").get(accessor.path("bufferView").asInt());
                int stride = view.path("byteStride").asInt(12);
                int start = view.path("byteOffset").asInt(0) + accessor.path("byteOffset").asInt(0);
                ByteBuffer data = ByteBuffer.wrap(bin).order(ByteOrder.LITTLE_ENDIAN);
                for (int i = 0; i < accessor.path("count").asInt(); i++) {
                    int at = start + i * stride;
                    double[] p = {data.getFloat(at), data.getFloat(at + 4), data.getFloat(at + 8)};
                    if (matrix != null) {
                        p = new double[] {
                                matrix[0] * p[0] + matrix[4] * p[1] + matrix[8] * p[2] + matrix[12],
                                matrix[1] * p[0] + matrix[5] * p[1] + matrix[9] * p[2] + matrix[13],
                                matrix[2] * p[0] + matrix[6] * p[1] + matrix[10] * p[2] + matrix[14]};
                    }
                    for (int k = 0; k < 3; k++) {
                        min[k] = Math.min(min[k], p[k]);
                        max[k] = Math.max(max[k], p[k]);
                    }
                }
            }
            return new double[][] {min, max};
        }

        /** 텍스처 그림(bufferView에 든 것)의 SHA-256. */
        String textureSha(int textureIndex) throws Exception {
            JsonNode image = gltf.path("images").get(gltf.path("textures").get(textureIndex).path("source").asInt());
            assertThat(image.has("bufferView")).as("texture image is embedded: %s", image).isTrue();
            JsonNode view = gltf.path("bufferViews").get(image.path("bufferView").asInt());
            int offset = view.path("byteOffset").asInt(0);
            return sha256(Arrays.copyOfRange(bin, offset, offset + view.path("byteLength").asInt()));
        }

        private static double[] local(JsonNode node) {
            if (node.has("matrix")) {
                double[] m = new double[16];
                for (int i = 0; i < 16; i++) {
                    m[i] = node.get("matrix").get(i).asDouble();
                }
                return m;
            }
            double[] t = {0, 0, 0};
            double[] r = {0, 0, 0, 1};
            double[] s = {1, 1, 1};
            for (int i = 0; i < 3; i++) {
                if (node.has("translation")) t[i] = node.get("translation").get(i).asDouble();
                if (node.has("scale")) s[i] = node.get("scale").get(i).asDouble();
            }
            for (int i = 0; i < 4; i++) {
                if (node.has("rotation")) r[i] = node.get("rotation").get(i).asDouble();
            }
            double x = r[0], y = r[1], z = r[2], w = r[3];
            return new double[] {
                    (1 - 2 * (y * y + z * z)) * s[0], (2 * (x * y + z * w)) * s[0], (2 * (x * z - y * w)) * s[0], 0,
                    (2 * (x * y - z * w)) * s[1], (1 - 2 * (x * x + z * z)) * s[1], (2 * (y * z + x * w)) * s[1], 0,
                    (2 * (x * z + y * w)) * s[2], (2 * (y * z - x * w)) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0,
                    t[0], t[1], t[2], 1};
        }

        private static double[] multiply(double[] a, double[] b) {
            double[] out = new double[16];
            for (int col = 0; col < 4; col++) {
                for (int row = 0; row < 4; row++) {
                    double sum = 0;
                    for (int k = 0; k < 4; k++) {
                        sum += a[k * 4 + row] * b[col * 4 + k];
                    }
                    out[col * 4 + row] = sum;
                }
            }
            return out;
        }
    }

    /** W16: glTF 머리(magic, 판 2, 길이), 첫 조각 JSON. BIN 조각이 있으면 함께 읽는다. */
    private static Glb parseGlb(byte[] glb, String label) throws Exception {
        assertThat(glb).as("%s file present", label).isNotNull();
        assertThat(glb.length).as("%s length >= 20", label).isGreaterThanOrEqualTo(20);
        ByteBuffer header = ByteBuffer.wrap(glb).order(ByteOrder.LITTLE_ENDIAN);
        assertThat(new String(glb, 0, 4, StandardCharsets.US_ASCII)).as("%s magic", label).isEqualTo("glTF");
        assertThat(header.getInt(4)).as("%s version", label).isEqualTo(2);
        assertThat(Integer.toUnsignedLong(header.getInt(8))).as("%s header length = body length", label).isEqualTo((long) glb.length);
        int jsonLength = header.getInt(12);
        assertThat(new String(glb, 16, 4, StandardCharsets.US_ASCII)).as("%s first chunk is JSON", label).isEqualTo("JSON");
        JsonNode gltf = JSON.readTree(new String(glb, 20, jsonLength, StandardCharsets.UTF_8));
        byte[] bin = new byte[0];
        int binHeader = 20 + jsonLength;
        if (glb.length >= binHeader + 8) {
            int binLength = header.getInt(binHeader);
            bin = Arrays.copyOfRange(glb, binHeader + 8, binHeader + 8 + binLength);
        }
        return new Glb(gltf, bin);
    }

    /** 그 모델의 메시 노드가 있고 다른 착용 메시 노드는 없다(가정 G5). */
    private static void assertOwnMeshOnly(Glb glb, String own, String label) {
        Set<String> names = new LinkedHashSet<>();
        for (JsonNode node : glb.gltf().path("nodes")) {
            if (node.hasNonNull("name")) {
                names.add(node.get("name").asText());
            }
        }
        assertThat(names).as("%s has its mesh node %s", label, own).contains(own);
        assertThat(glb.gltf().path("nodes").get(glb.nodeIndex(own)).has("mesh")).as("%s node %s has a mesh", label, own).isTrue();
        Set<String> others = new LinkedHashSet<>(WEAR_NODES);
        others.remove(own);
        assertThat(names).as("%s has no other wearable mesh nodes", label).doesNotContainAnyElementsOf(others);
    }

    /** 메시에 skin이 있고 조각마다 JOINTS_0·WEIGHTS_0이 있으며, 관절 이름이 하나 이상이고 모두 라룹이 뼈 이름(가정 G6). */
    private static void assertSkinned(Glb glb, int index, String label) {
        JsonNode node = glb.gltf().path("nodes").get(index);
        assertThat(node.has("skin")).as("%s mesh has a skin: %s", label, node).isTrue();
        JsonNode mesh = glb.gltf().path("meshes").get(node.path("mesh").asInt());
        for (JsonNode primitive : mesh.path("primitives")) {
            assertThat(fieldNames(primitive.path("attributes"))).as("%s primitive attributes", label).contains("JOINTS_0", "WEIGHTS_0");
        }
        JsonNode skin = glb.gltf().path("skins").get(node.path("skin").asInt());
        List<String> joints = new ArrayList<>();
        for (JsonNode joint : skin.path("joints")) {
            joints.add(glb.gltf().path("nodes").get(joint.asInt()).path("name").asText());
        }
        assertThat(joints).as("%s skin joints", label).isNotEmpty();
        assertThat(BONES).as("%s skin joint names are Laroop bones: %s", label, joints).containsAll(joints);
    }

    private static void assertBox(double[][] box, Mesh expected, String label) {
        for (int k = 0; k < 3; k++) {
            assertThat(Math.abs(box[0][k] - expected.min()[k])).as("%s min[%d] %s vs %s", label, k,
                    Arrays.toString(box[0]), Arrays.toString(expected.min())).isLessThanOrEqualTo(TOLERANCE);
            assertThat(Math.abs(box[1][k] - expected.max()[k])).as("%s max[%d] %s vs %s", label, k,
                    Arrays.toString(box[1]), Arrays.toString(expected.max())).isLessThanOrEqualTo(TOLERANCE);
        }
    }

    /** 조각마다 텍스처 없는 재질의 baseColorFactor(없으면 1,1,1,1) 모음이 기대와 같다(순서 무관). */
    private static void assertColors(Glb glb, JsonNode mesh, List<double[]> expected, String label) {
        List<double[]> actual = new ArrayList<>();
        for (JsonNode primitive : mesh.path("primitives")) {
            JsonNode material = glb.gltf().path("materials").get(primitive.path("material").asInt());
            JsonNode pbr = material.path("pbrMetallicRoughness");
            assertThat(pbr.has("baseColorTexture")).as("%s material has no texture: %s", label, material).isFalse();
            double[] color = {1, 1, 1, 1};
            if (pbr.has("baseColorFactor")) {
                for (int i = 0; i < 4; i++) {
                    color[i] = pbr.get("baseColorFactor").get(i).asDouble();
                }
            }
            actual.add(color);
        }
        Comparator<double[]> order = Comparator.comparingDouble((double[] c) -> c[0]).thenComparingDouble(c -> c[1])
                .thenComparingDouble(c -> c[2]);
        List<double[]> sortedActual = new ArrayList<>(actual);
        sortedActual.sort(order);
        List<double[]> sortedExpected = new ArrayList<>(expected);
        sortedExpected.sort(order);
        assertThat(sortedActual).as("%s color count", label).hasSameSizeAs(sortedExpected);
        for (int i = 0; i < sortedExpected.size(); i++) {
            for (int k = 0; k < 4; k++) {
                assertThat(Math.abs(sortedActual.get(i)[k] - sortedExpected.get(i)[k])).as("%s color %s vs %s", label,
                        Arrays.toString(sortedActual.get(i)), Arrays.toString(sortedExpected.get(i))).isLessThanOrEqualTo(TOLERANCE);
            }
        }
    }

    private static String sha256(byte[] content) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
    }

    // =====================================================================
    // 도우미: 배치
    // =====================================================================

    /** 처음 배치(기존 CatalogFilesSpecTest와 같음). */
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
        String email = "qa-090w-" + tag + "-" + suffix + "@example.com";
        String password = "qa-pass-" + suffix;
        jdbc.update(
                "INSERT INTO users (email, password_hash, display_name, email_verified, verified_at) VALUES (?, ?, ?, 1, NOW())",
                email, passwordEncoder.encode(password), "qa-090w-" + tag + "-" + suffix);
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
