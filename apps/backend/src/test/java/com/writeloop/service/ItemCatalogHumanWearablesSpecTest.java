package com.writeloop.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.junit.jupiter.api.Test;

/**
 * [spec] 작업 134 ② 사람형 착용물 연결, 백엔드 아이템 목록 파일(items.json, catalog/files).
 * 기대값은 명세와 사람형 원본 human-wardrobe.json(경로·슬롯·부착·뼈·좌우·숨김·sha256·bytes)에서만 가져왔다.
 * 옷 모델 sha256·bytes는 원본 값을 그대로 적었다(원본 폴더가 없는 환경에서도 돌도록).
 * 그대로 둘 동작(K*: 조끼·고글·아이콘·옷집 재고·가구·바꾸지 않는 옷 정보)은 기준 커밋 f6b6612의 값이라 지금 코드에서 통과가 맞다.
 * 바뀔 동작(H*)은 지금 코드에서 실패가 맞다.
 */
public class ItemCatalogHumanWearablesSpecTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    static final Path CATALOG_DIR = Path.of("src", "main", "resources", "catalog");
    static final Path FILES_DIR = CATALOG_DIR.resolve("files");

    /** 옷 하나의 기대값. color는 칠할 색(없으면 null), hide는 숨길 기본 메시, isNew는 이번에 목록에 더하는 옷. */
    public record Human(String id, String slot, String attach, String bone, String mirror, String color,
                        List<String> hide, String sha256, long bytes, boolean isNew) {
    }

    /** 기존 옷 29(라룹이 몸 16 + 옷집 13)와 새 사람형 옷 5. */
    public static final List<Human> HUMANS = List.of(
            new Human("capOrange", "hat", "bone", "head", null, null, List.of(), "839e3797d0d78a42a73d6d686088d249c2b07eee94e183aaa9a7eda57a67a248", 108692, false),
            new Human("capBlue", "hat", "bone", "head", null, null, List.of(), "3c61af74f692163ad0ce31efede577d8307594bb9a49e0857b1b2874a6f2e047", 111920, false),
            new Human("capGreen", "hat", "bone", "head", null, null, List.of(), "ffd072cea2264cdcfc7ce3c8b5d5ec7704252a67a3d188ce2625abc7266f9c2b", 109320, false),
            new Human("shortsNavy", "bottom", "skin", null, null, null, List.of("bottom_charcoal_cuffs"), "0fada58cdcfd6bf28761b0cf1b2036e0ad73c2df4b5bd3082e1d1bdff6b031d2", 29132, false),
            new Human("shortsBrown", "bottom", "skin", null, null, "#8A5A3B", List.of("bottom_charcoal_cuffs"), "0fada58cdcfd6bf28761b0cf1b2036e0ad73c2df4b5bd3082e1d1bdff6b031d2", 29132, false),
            new Human("shortsRed", "bottom", "skin", null, null, "#C8443A", List.of("bottom_charcoal_cuffs"), "0fada58cdcfd6bf28761b0cf1b2036e0ad73c2df4b5bd3082e1d1bdff6b031d2", 29132, false),
            new Human("tshirtOrange", "top", "skin", null, null, null, List.of("top_white_pocket_tee"), "8f96d2154e390f6cbb822ffc9f226601bf7919115d43cdf99c49fefc66937494", 67692, false),
            new Human("tshirtWhite", "top", "skin", null, null, "#F4F0E8", List.of("top_white_pocket_tee"), "8f96d2154e390f6cbb822ffc9f226601bf7919115d43cdf99c49fefc66937494", 67692, false),
            new Human("tshirtYellow", "top", "skin", null, null, "#F2C440", List.of("top_white_pocket_tee"), "8f96d2154e390f6cbb822ffc9f226601bf7919115d43cdf99c49fefc66937494", 67692, false),
            new Human("shoesBrown", "shoes", "bone", "foot_l", "foot_r", null, List.of("shoe_canvas_l", "shoe_canvas_r"), "8d9c4d69efefc0b0dd75a1a016f70f74d39bf5091c8c430f18a0ccc6fb2f8f2e", 6544, false),
            new Human("shoesRed", "shoes", "bone", "foot_l", "foot_r", "#C8443A", List.of("shoe_canvas_l", "shoe_canvas_r"), "8d9c4d69efefc0b0dd75a1a016f70f74d39bf5091c8c430f18a0ccc6fb2f8f2e", 6544, false),
            new Human("shoesWhite", "shoes", "bone", "foot_l", "foot_r", "#DCD8CF", List.of("shoe_canvas_l", "shoe_canvas_r"), "8d9c4d69efefc0b0dd75a1a016f70f74d39bf5091c8c430f18a0ccc6fb2f8f2e", 6544, false),
            new Human("mufflerRed", "accessory", "bone", "spine", null, null, List.of(), "29777d25e01d67df2671e7dae8e29b1c345cc3a6d80266cdc18763847bc38e7c", 18936, false),
            new Human("sunglassesBlack", "face", "bone", "head", null, null, List.of(), "9a9dcca7594533b48a2192cea25bf51540b8468c7e87505fa2a15357330c3f10", 35408, false),
            new Human("necklaceGold", "accessory", "bone", "spine", null, null, List.of(), "2cebfcf74d64d107b197811ffe1bd6fe4d218ee52c56132c2ddd6886252c9489", 32836, false),
            new Human("backpackRed", "back", "bone", "spine", null, null, List.of(), "996b0939ae5e9449cb68d4134fd5dd400d8b208dc4adcc376d12a2493520fba0", 48360, false),
            new Human("wear-top-kiln-jacket", "top", "skin", null, null, null, List.of("top_white_pocket_tee"), "18f36a32c493ff1168e7c47cfbd729acb8e64d3fada87da9ce3daf6ab0df9566", 151564, false),
            new Human("wear-bottom-sage-cargo", "bottom", "skin", null, null, null, List.of("bottom_charcoal_cuffs"), "60e5167ab2205c5200b90fbdeb519324d7a71264da50e3538b3d310cd2cfe650", 79888, false),
            new Human("wear-hat-breakwater-bucket", "hat", "bone", "head", null, null, List.of(), "55eb53862c91fff8edb799879eb74221e4efb7aec10c81bad2ad02336fe1fa98", 145764, false),
            new Human("wear-top-tide-sailor", "top", "skin", null, null, null, List.of("top_white_pocket_tee"), "3d570046102e1a3578090dc891aab7f58de39b7541ae69e5d6c5faf912dc10f2", 134984, false),
            new Human("wear-bottom-jetty-denim", "bottom", "skin", null, null, null, List.of("bottom_charcoal_cuffs"), "ba704d8e447e23daf943edba48ce4dc660a3280f7f7cca836f5002cd6130bcda", 104716, false),
            new Human("wear-top-field-blouse", "top", "skin", null, null, null, List.of("top_white_pocket_tee"), "4e7621c09b360842329960b9579c3f2fb2e6cd39fab093a2d78b64ef1e0f77e2", 552732, false),
            new Human("wear-bottom-field-trousers", "bottom", "skin", null, null, null, List.of("bottom_charcoal_cuffs"), "f7061bfa8249d837dd2545ea143d271dd22f241f3b466055432bdb478540389e", 126616, false),
            new Human("wear-shoe-combat-boot", "shoes", "bone", "foot_l", "foot_r", null, List.of("shoe_canvas_l", "shoe_canvas_r", "socks"), "01bca3d9a4f659a133140b761657565d0740335a385acd94360a182726ed7d6a", 167044, false),
            new Human("wear-top-quilted-liner", "top", "skin", null, null, null, List.of("top_white_pocket_tee"), "5f05b60df4187fb55ffa8df5c7c511da19f776fb6dd7678ba7d278ec81aeb546", 298244, false),
            new Human("wear-hat-peddler-straw", "hat", "bone", "head", null, null, List.of(), "1627a1d278adc36bf024e0d8facba57160b3a8a2dbf2d8ecc9f9f13bac1ffb39", 639128, false),
            new Human("wear-hat-bramble-beret", "hat", "bone", "head", null, null, List.of(), "bdc10ca83de1c3e87494152d605caa14b612ecf7e3334a00e19fd8b5549c8f3d", 123236, false),
            new Human("wear-face-honey-panto", "face", "bone", "head", null, null, List.of(), "c1845db2cd86dcde9953448e0c1b845781d82d3a86b0b5e6fe836cd19441588a", 110084, false),
            new Human("wear-hat-field-cap", "hat", "bone", "head", null, null, List.of(), "075db3a7d3092c3eff0c909cf737604db6ece0d2b57d3985d3f153df7e3688dc", 125664, false),
            new Human("wear-top-henley-oatmeal", "top", "skin", null, null, null, List.of("top_white_pocket_tee"), "6de2d194af2b8717937592a366d268fe19d1c999de9568f326cb3975adf7f129", 105428, true),
            new Human("wear-bottom-chino-graphite", "bottom", "skin", null, null, null, List.of("bottom_charcoal_cuffs"), "bb04bfef1c49e05c45b41c0f89578ccdeb635f913eb21a9f24551b2c54804522", 42512, true),
            new Human("wear-shoe-strap-sneaker", "shoes", "bone", "foot_l", "foot_r", null, List.of("shoe_canvas_l", "shoe_canvas_r"), "c7a0ad05fd08c7bc43860cdbb70e16294b48096b0256a00a33c89b9848860bea", 60864, true),
            new Human("wear-hat-newsboy-walnut", "hat", "bone", "head", null, null, List.of(), "e2e7661fae52cba6430d844c9cc3f26b815bea4a0aaf2a2b3f61d2bd2bee515d", 145860, true),
            new Human("wear-hat-pawprint-cap", "hat", "bone", "head", null, null, List.of(), "1d8ebd47e45a15955264fd2c8081d0bc51c6d19bceea3df117f93e7288119dc7", 248448, true)
    );

    /** 새 사람형 옷 5의 이름(품목 안내의 이름). */
    public static final Map<String, String> NEW_NAMES = newNames();

    private static Map<String, String> newNames() {
        Map<String, String> map = new LinkedHashMap<>();
        map.put("wear-top-henley-oatmeal", "오트밀 헨리넥 반팔");
        map.put("wear-bottom-chino-graphite", "그래파이트 치노 반바지");
        map.put("wear-shoe-strap-sneaker", "아이보리 스트랩 스니커즈");
        map.put("wear-hat-newsboy-walnut", "월넛 뉴스보이캡");
        map.put("wear-hat-pawprint-cap", "발바닥 로고 캡모자");
        return map;
    }

    /** 기준 커밋 f6b6612의 옷 아이콘(기존 옷 중 아이콘이 있는 것) sha256. 아이콘은 다시 그리지 않는다. */
    public static final Map<String, String> ICON_SHA = iconSha();

    private static Map<String, String> iconSha() {
        Map<String, String> icons = new LinkedHashMap<>();
        icons.put("capOrange", "a2543a504b6a67915d9960b3bf9230de8117e6be1e2ec36f720205672a679d6f");
        icons.put("capBlue", "9bc5a7bffbe4658e844c1b6791673498379724022f11bc8db50055f7b5ae6497");
        icons.put("capGreen", "2ea7b9743e1437bed0954cb8e4b29f050d6776ba8e94990df1f7b8ed2483ac01");
        icons.put("shortsNavy", "fd22834c97ecb7e68666bd3d8471c6316ebb6c39d6fe1e27f2e61e113a7fef01");
        icons.put("shortsBrown", "58d0c6000fed57ebf629d042c3bb5d7cee2dd78f7fe51906065224e6d7fd6bc0");
        icons.put("shortsRed", "f4c113791092606bdc8123a96effb82fd43a10525886d5ec85e546445bc7f8e4");
        icons.put("tshirtOrange", "6f943fdc2ffbf6e76bb1428a1b47205875af78b8942be1f750513eab22653f4f");
        icons.put("tshirtWhite", "0b9575a888ad6588824cc717f633facc9d10743ae1cf14feaba34abbd804a147");
        icons.put("tshirtYellow", "104fe133b1d375123d93c81a6ad5acc8be96ce067f6166a2f217db09be79b501");
        icons.put("shoesBrown", "b93d139fa891ce1d1b1e7a4522285125b6c61ed2461c58e4a3eab7ae89173b75");
        icons.put("shoesRed", "830c587f7112b5279908971d8c15745260857a10531e577613c3564e7b7459b8");
        icons.put("shoesWhite", "b9fa9691b646cf88722e12bcee0ba4eb0f99c65f426ef30ebf65130b7cf076c8");
        icons.put("mufflerRed", "55b99c90ef81793b70c4a7816aa828cf20f9ce388e5c123cdd4ad2c26a32129f");
        icons.put("sunglassesBlack", "8cf1cf5df29eeb55deec48a814bb78c3a5acaeb8f306d95ae398d01c1d96d94e");
        icons.put("necklaceGold", "fd0cbf3ab20ad78399106b7e9b112eb531078c80d3a11b460e4ef611c9dee320");
        icons.put("backpackRed", "24c7298089190c99af17b7bf11dec11ded773c8cb39aaf0e37a7dc093bba2a4b");
        icons.put("vestGreen", "fa8fdd99656b18b1187710f8c831df71250c31ec78c0af4e6576616dc0a96f7c");
        icons.put("wear-top-kiln-jacket", "f92b481740b0ca9b612687aa1be99e51eec8cf78dc21c123fd74a83f894f4d66");
        icons.put("wear-bottom-sage-cargo", "4c54b4cc59b7639e56a0c4edee2f205279522e9c7b36d4b941c2b794ce40137a");
        icons.put("wear-hat-breakwater-bucket", "5fe8e1b504a3067445e2218bdcc80f5233e4d7ad919ad9b5f76c68d534cbb0ca");
        icons.put("wear-top-tide-sailor", "2b1354e4f96b31d6ff19b5f323a8d4ff3762fd012d4ae8ec53c94c08babd67e0");
        icons.put("wear-bottom-jetty-denim", "132b8b19549df29b05e628f90a87579ea9a4566a03375202efc721b2edbdfa04");
        icons.put("wear-top-field-blouse", "71fbe5ab0058e9c6b10b1d2da48bf0218a7387a0fdd5986742506fa1b296d24b");
        icons.put("wear-bottom-field-trousers", "9ee76a242bfb65f55815e2165c0369310dcd4412ef857e8a034537b7e46921d4");
        icons.put("wear-shoe-combat-boot", "c6f50beb8b2e2ae07b337a8c5bd573c0009f0e1dad224a3f667fdef3ae6b316b");
        icons.put("wear-top-quilted-liner", "54398af1fac982720ea7776adb3001300f864763d3ae46752f844666a6faf16d");
        icons.put("wear-hat-peddler-straw", "e6dfd93fe0e410fa5e46004aab1251c0b3e742730bdfb529b62f3cb4ca6e41ab");
        icons.put("wear-hat-bramble-beret", "52d60ddf5302d566900f4060be6053a4cfe5fdc30535a6ed8561590b216506a8");
        icons.put("wear-face-honey-panto", "f752deca992aaeefabebb32a70f31e5f195a3b7f81664e9578d9ae4c9090a935");
        icons.put("wear-hat-field-cap", "c66dc29bc84fc73e24ae70b77544396cb39f2b95b4d168834cd8d03bb9d93126");
        return icons;
    }

    /** 옷집 재고 파일(서버 사본)은 바꾸지 않는다: 기준 커밋의 sha256. */
    static final String STOCK_SHA = "261420f62340e9ca0978009f2aff0162616a8c630955001816f4fb57687e71bc";
    public static final String VEST_MODEL_SHA = "c8609e5fcc00cdffd29943c980f8db556255c92fd9d9d82f667c3f7614e04eda";
    /** 기존 옷 31개의 id·kind·name·shopName·description·category·price·slot·alwaysOwned를 줄로 이은 글의 sha256(기준 커밋). */
    static final String OLD_META_SHA = "67debee4f8b8bb7e889d7453b7d4c92f3596347ebc0299c87f1afc2b15a3239c";
    /** 가구 항목(JSON 글)과 그 파일 sha256을 이은 글의 sha256(기준 커밋). 가구 목록·파일은 그대로다. */
    static final String FURNITURE_SHA = "dd7aab33482a47bc188cfb3dfd5f7eb28b3b5c7aaa2f1d255d345e47b2015a25";

    static final Set<String> DRAW_KEYS = Set.of("attach", "bone", "mirror", "color", "body", "hide");

    // =====================================================================
    // H1~H6. 바뀔 동작
    // =====================================================================

    @Test
    void h1_everyHumanClothHasHumanDraw() throws Exception {
        Map<String, JsonNode> byId = byId(items());
        for (Human h : HUMANS) {
            JsonNode item = byId.get(h.id());
            assertThat(item).as("H1 %s in items.json", h.id()).isNotNull();
            assertThat(item.path("kind").asText()).as("H1 %s kind", h.id()).isEqualTo("wearable");
            assertThat(item.path("slot").asText()).as("H1 %s slot", h.id()).isEqualTo(h.slot());
            JsonNode draw = item.path("draw");
            assertThat(draw.isObject()).as("H1 %s draw is an object", h.id()).isTrue();
            Set<String> keys = new LinkedHashSet<>();
            draw.fieldNames().forEachRemaining(keys::add);
            assertThat(DRAW_KEYS).as("H1 %s draw keys %s are known", h.id(), keys).containsAll(keys);
            assertThat(draw.path("attach").asText()).as("H1 %s attach", h.id()).isEqualTo(h.attach());
            assertThat(text(draw, "bone")).as("H1 %s bone", h.id()).isEqualTo(h.bone());
            assertThat(text(draw, "mirror")).as("H1 %s mirror", h.id()).isEqualTo(h.mirror());
            assertThat(draw.path("body").isIntegralNumber()).as("H1 %s body is an integer: %s", h.id(), draw).isTrue();
            assertThat(draw.path("body").asInt()).as("H1 %s body", h.id()).isEqualTo(2);
            assertThat(text(draw, "color")).as("H1 %s color", h.id()).isEqualTo(h.color());
            assertThat(hide(draw)).as("H1 %s hide", h.id()).isEqualTo(h.hide());
        }
    }

    @Test
    void h2_hideNamesBySlot() throws Exception {
        Map<String, JsonNode> byId = byId(items());
        for (Human h : HUMANS) {
            List<String> hide = hide(byId.get(h.id()).path("draw"));
            switch (h.slot()) {
                case "top" -> assertThat(hide).as("H2 %s", h.id()).containsExactly("top_white_pocket_tee");
                case "bottom" -> assertThat(hide).as("H2 %s", h.id()).containsExactly("bottom_charcoal_cuffs");
                case "shoes" -> {
                    if (h.id().equals("wear-shoe-combat-boot")) {
                        assertThat(hide).as("H2 %s", h.id()).containsExactlyInAnyOrder("shoe_canvas_l", "shoe_canvas_r", "socks");
                    } else {
                        assertThat(hide).as("H2 %s", h.id()).containsExactlyInAnyOrder("shoe_canvas_l", "shoe_canvas_r");
                    }
                }
                default -> assertThat(hide).as("H2 %s hats, face, neck, back hide nothing", h.id()).isEmpty();
            }
        }
    }

    @Test
    void h3_modelFilesAreTheHumanGlbs() throws Exception {
        Map<String, JsonNode> byId = byId(items());
        for (Human h : HUMANS) {
            JsonNode item = byId.get(h.id());
            assertThat(item).as("H3 %s in items.json", h.id()).isNotNull();
            String name = item.path("files").path("model").asText();
            assertThat(name).as("H3 %s files.model is a .glb name", h.id()).endsWith(".glb").doesNotContain("/").doesNotContain("\\");
            byte[] content = Files.readAllBytes(FILES_DIR.resolve(name));
            assertThat((long) content.length).as("H3 %s bytes of %s", h.id(), name).isEqualTo(h.bytes());
            assertThat(sha256(content)).as("H3 %s sha256 of %s", h.id(), name).isEqualTo(h.sha256());
        }
    }

    @Test
    void h4_fiveNewClothesAreNotForSale() throws Exception {
        Map<String, JsonNode> byId = byId(items());
        assertThat(NEW_NAMES.keySet()).as("H4 setup").containsExactlyInAnyOrderElementsOf(
                HUMANS.stream().filter(Human::isNew).map(Human::id).toList());
        for (Human h : HUMANS) {
            if (!h.isNew()) {
                continue;
            }
            JsonNode item = byId.get(h.id());
            assertThat(item).as("H4 %s in items.json", h.id()).isNotNull();
            assertThat(item.path("kind").asText()).as("H4 %s kind", h.id()).isEqualTo("wearable");
            assertThat(item.path("name").asText()).as("H4 %s name", h.id()).isEqualTo(NEW_NAMES.get(h.id()));
            assertThat(item.path("shopName").asText()).as("H4 %s shopName = name", h.id()).isEqualTo(NEW_NAMES.get(h.id()));
            assertThat(item.hasNonNull("price")).as("H4 %s has no price: %s", h.id(), item).isFalse();
            assertThat(item.hasNonNull("category")).as("H4 %s has no category: %s", h.id(), item).isFalse();
            assertThat(item.path("alwaysOwned").asBoolean(false)).as("H4 %s is not always owned", h.id()).isFalse();
            assertThat(item.path("files").hasNonNull("icon")).as("H4 %s has no icon: %s", h.id(), item).isFalse();
        }
    }

    @Test
    void h5_serverSlotsIncludeTheFiveNewClothes() {
        Map<String, String> slots = ItemCatalog.DEFAULT.wearableSlots();
        for (Human h : HUMANS) {
            if (h.isNew()) {
                assertThat(slots.get(h.id())).as("H5 slot of %s", h.id()).isEqualTo(h.slot());
            }
        }
        assertThat(slots).as("H5 31 wearables (goggles, vest included) + 5 new").hasSize(36);
    }

    @Test
    void h6_idsAreUniqueAndFiftySevenItems() throws Exception {
        List<String> ids = new ArrayList<>();
        items().path("items").forEach(item -> ids.add(item.path("id").asText()));
        assertThat(ids).as("H6 ids are unique").doesNotHaveDuplicates();
        assertThat(ids).as("H6 52 old items + 5 new").hasSize(57);
    }

    // =====================================================================
    // K1~K6. 그대로 둘 동작
    // =====================================================================

    @Test
    void k1_vestStaysBodyOneWithoutHide() throws Exception {
        JsonNode vest = byId(items()).get("vestGreen");
        assertThat(vest.path("slot").asText()).as("K1 vest slot").isEqualTo("top");
        assertThat(vest.path("draw").path("attach").asText()).as("K1 attach").isEqualTo("skin");
        assertThat(vest.path("draw").path("body").asInt()).as("K1 vest body stays 1").isEqualTo(1);
        assertThat(vest.path("draw").has("hide")).as("K1 vest has no hide").isFalse();
        assertThat(vest.path("files").path("model").asText()).as("K1 vest model name").isEqualTo("wear-vest.glb");
        assertThat(sha256(Files.readAllBytes(FILES_DIR.resolve("wear-vest.glb")))).as("K1 vest model unchanged").isEqualTo(VEST_MODEL_SHA);
    }

    @Test
    void k2_gogglesStayWithoutDrawNorFiles() throws Exception {
        JsonNode goggles = byId(items()).get("goggles");
        assertThat(goggles.path("slot").asText()).as("K2 slot").isEqualTo("face");
        assertThat(goggles.path("alwaysOwned").asBoolean(false)).as("K2 always owned").isTrue();
        assertThat(goggles.hasNonNull("draw")).as("K2 no draw").isFalse();
        assertThat(goggles.hasNonNull("files")).as("K2 no files").isFalse();
    }

    @Test
    void k3_iconsAreTheSameAsBefore() throws Exception {
        assertThat(ICON_SHA).as("K3 setup: 30 icons (vest included)").hasSize(30);
        Map<String, JsonNode> byId = byId(items());
        for (Map.Entry<String, String> entry : ICON_SHA.entrySet()) {
            String name = byId.get(entry.getKey()).path("files").path("icon").asText();
            assertThat(name).as("K3 icon name of %s", entry.getKey()).isNotBlank();
            assertThat(sha256(Files.readAllBytes(FILES_DIR.resolve(name)))).as("K3 icon of %s", entry.getKey()).isEqualTo(entry.getValue());
        }
    }

    @Test
    void k4_clothingShopStockIsUnchanged() throws Exception {
        assertThat(sha256(Files.readAllBytes(CATALOG_DIR.resolve("clothing-shop-stock.json")))).as("K4 stock sha256").isEqualTo(STOCK_SHA);
    }

    @Test
    void k5_oldClothesKeepNamePriceAndSlot() throws Exception {
        Set<String> newIds = NEW_NAMES.keySet();
        List<String> lines = new ArrayList<>();
        for (JsonNode item : items().path("items")) {
            if (!"wearable".equals(item.path("kind").asText()) || newIds.contains(item.path("id").asText())) {
                continue;
            }
            lines.add(String.join("|", item.path("id").asText(), item.path("kind").asText(), item.path("name").asText(),
                    item.path("shopName").asText(), item.path("description").asText(), String.valueOf(text(item, "category")),
                    item.hasNonNull("price") ? String.valueOf(item.path("price").asInt()) : "null", item.path("slot").asText(),
                    String.valueOf(item.path("alwaysOwned").asBoolean(false))));
        }
        assertThat(lines).as("K5 31 old wearables").hasSize(31);
        assertThat(sha256(String.join("\n", lines).getBytes(StandardCharsets.UTF_8))).as("K5 old wearable info").isEqualTo(OLD_META_SHA);
    }

    @Test
    void k6_furnitureItemsAndFilesAreUnchanged() throws Exception {
        StringBuilder text = new StringBuilder();
        for (JsonNode item : items().path("items")) {
            if ("wearable".equals(item.path("kind").asText())) {
                continue;
            }
            text.append(item.toString()).append('\n');
            for (String kind : List.of("model", "icon")) {
                if (item.path("files").hasNonNull(kind)) {
                    text.append(sha256(Files.readAllBytes(FILES_DIR.resolve(item.path("files").path(kind).asText())))).append('\n');
                }
            }
        }
        assertThat(sha256(text.toString().getBytes(StandardCharsets.UTF_8))).as("K6 furniture").isEqualTo(FURNITURE_SHA);
    }

    // =====================================================================
    // 도움 함수
    // =====================================================================

    static JsonNode items() throws Exception {
        return JSON.readTree(Files.readString(CATALOG_DIR.resolve("items.json")));
    }

    static Map<String, JsonNode> byId(JsonNode catalog) {
        Map<String, JsonNode> map = new LinkedHashMap<>();
        for (JsonNode item : catalog.path("items")) {
            map.put(item.path("id").asText(), item);
        }
        return map;
    }

    static String text(JsonNode node, String key) {
        JsonNode value = node.get(key);
        return value == null || value.isNull() ? null : value.asText();
    }

    /** draw.hide 문자열 배열. 칸이 없으면 빈 목록. */
    public static List<String> hide(JsonNode draw) {
        List<String> list = new ArrayList<>();
        JsonNode hide = draw.get("hide");
        if (hide != null && hide.isArray()) {
            hide.forEach(value -> list.add(value.asText()));
        }
        return list;
    }

    public static String sha256(byte[] content) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
    }
}
