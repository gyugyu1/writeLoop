package com.writeloop.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

/**
 * [spec] 작업 090 ③ 옷 내려받기, 백엔드 시나리오(05-옷-내려받기/03-qa-scenarios.md) 가운데 목록 파일.
 *
 * <ul>
 *   <li>W1: 옷마다 draw와 files(model, icon). 고글은 draw도 files도 없다(결정 05 1).</li>
 *   <li>W2: 옷 열여섯의 draw 값 = 시나리오 부록 A(방식·붙일 뼈·뒤집어 붙일 뼈·칠할 색·맞춘 몸 판 1).</li>
 *   <li>W3: skin 방식 옷에는 붙일 뼈·뒤집어 붙일 뼈가 없다. 뒤집을 뼈가 없는 bone 옷에도 그 칸이 없다.</li>
 *   <li>W4: 시험 옷(옷 열일곱 밖의 옷 하나)은 top, 팔지 않음, skin, 몸 판 1, 늘 가진 옷이 아님.</li>
 *   <li>W5: 서버의 옷 부위는 slot에서만 만들어진다(옷 열일곱 그대로 + 시험 옷 top).</li>
 * </ul>
 * draw의 칸 이름은 명세에 없어 구현 이름(attach·bone·mirror·color·body)을 따른다(가정 G1). 값은 부록 A에서 가져온다.
 * 색은 RGB 값으로 견준다(가정 G2).
 */
public class ItemCatalogWearablesSpecTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    /** 옷 하나의 기대 draw와 모델(부록 A). null은 "없음"(칸이 없거나 null). model은 기준 묶음의 메시 노드 이름. */
    public record Wear(String id, String slot, String attach, String bone, String mirror, String color, String model) {
    }

    /** 부록 A: 파는 옷 열여섯. */
    public static final List<Wear> SIXTEEN = List.of(
            new Wear("capOrange", "hat", "bone", "head", null, null, "wear-hat"),
            new Wear("capBlue", "hat", "bone", "head", null, null, "wear-hat-blue"),
            new Wear("capGreen", "hat", "bone", "head", null, null, "wear-hat-green"),
            new Wear("tshirtOrange", "top", "skin", null, null, null, "wear-top"),
            new Wear("tshirtWhite", "top", "skin", null, null, "#F4F0E8", "wear-top"),
            new Wear("tshirtYellow", "top", "skin", null, null, "#F2C440", "wear-top"),
            new Wear("shortsNavy", "bottom", "skin", null, null, null, "wear-bottom"),
            new Wear("shortsBrown", "bottom", "skin", null, null, "#8A5A3B", "wear-bottom"),
            new Wear("shortsRed", "bottom", "skin", null, null, "#C8443A", "wear-bottom"),
            new Wear("shoesBrown", "shoes", "bone", "foot_l", "foot_r", null, "wear-shoe-l"),
            new Wear("shoesRed", "shoes", "bone", "foot_l", "foot_r", "#C8443A", "wear-shoe-l"),
            new Wear("shoesWhite", "shoes", "bone", "foot_l", "foot_r", "#DCD8CF", "wear-shoe-l"),
            new Wear("sunglassesBlack", "face", "bone", "head", null, null, "wear-sunglasses"),
            new Wear("backpackRed", "back", "bone", "spine", null, null, "wear-backpack"),
            new Wear("mufflerRed", "accessory", "bone", "spine", null, null, "wear-muffler"),
            new Wear("necklaceGold", "accessory", "bone", "spine", null, null, "wear-necklace"));

    public static final String GOGGLES = "goggles";

    /** 옷 열일곱 = 열여섯 + 고글. */
    public static final Set<String> SEVENTEEN = seventeen();

    /** 결정 1: 지금 몸 판. */
    public static final int BODY = 1;

    /** draw에 있어도 되는 칸(구현 이름, 가정 G1). */
    public static final Set<String> DRAW_KEYS = Set.of("attach", "bone", "mirror", "color", "body");

    private static Set<String> seventeen() {
        Set<String> set = new LinkedHashSet<>();
        SIXTEEN.forEach(wear -> set.add(wear.id()));
        set.add(GOGGLES);
        return Set.copyOf(set);
    }

    public static Wear expected(String id) {
        return SIXTEEN.stream().filter(wear -> wear.id().equals(id)).findFirst().orElseThrow();
    }

    // =====================================================================
    // W1
    // =====================================================================

    @Test
    void w1_everyClothHasDrawAndFilesAndGogglesHasNeither() throws Exception {
        Map<String, JsonNode> byId = byId(catalogFile());
        List<String> withFiles = new ArrayList<>();
        SIXTEEN.forEach(wear -> withFiles.add(wear.id()));
        withFiles.add(testClothInFile().path("id").asText());
        for (String id : withFiles) {
            JsonNode item = byId.get(id);
            String label = "W1 " + id;
            assertThat(item).as("%s in the file", label).isNotNull();
            assertThat(item.path("draw").isObject()).as("%s draw is an object: %s", label, item).isTrue();
            assertThat(item.path("files").isObject()).as("%s files is an object: %s", label, item).isTrue();
            assertThat(item.path("files").path("model").asText()).as("%s files.model is a .glb name", label).matches("[^/\\\\]+\\.glb");
            assertThat(item.path("files").path("icon").asText()).as("%s files.icon is a .png name", label).matches("[^/\\\\]+\\.png");
        }
        JsonNode goggles = byId.get(GOGGLES);
        assertThat(goggles).as("W1 goggles in the file").isNotNull();
        assertThat(goggles.hasNonNull("draw")).as("W1 goggles has no draw (결정 05 1): %s", goggles).isFalse();
        assertThat(goggles.hasNonNull("files")).as("W1 goggles has no files (결정 05 1): %s", goggles).isFalse();
    }

    // =====================================================================
    // W2·W3
    // =====================================================================

    @Test
    void w2_drawOfTheSixteenIsAppendixA() throws Exception {
        Map<String, JsonNode> byId = byId(catalogFile());
        for (Wear wear : SIXTEEN) {
            JsonNode item = byId.get(wear.id());
            assertThat(item).as("W2 %s in the file", wear.id()).isNotNull();
            assertThat(item.path("slot").asText()).as("W2 %s slot", wear.id()).isEqualTo(wear.slot());
            assertWearDraw(item.get("draw"), wear, "W2 file");
        }
    }

    @Test
    void w3_boneFieldsOnlyWhenAttachedToABone() throws Exception {
        Map<String, JsonNode> byId = byId(catalogFile());
        List<JsonNode> skinItems = new ArrayList<>();
        for (Wear wear : SIXTEEN) {
            JsonNode draw = byId.get(wear.id()).path("draw");
            if ("skin".equals(wear.attach())) {
                skinItems.add(byId.get(wear.id()));
            } else if (wear.mirror() == null) {
                assertThat(draw.hasNonNull("mirror")).as("W3 %s (bone, no mirror) has no mirror: %s", wear.id(), draw).isFalse();
            }
        }
        skinItems.add(testClothInFile());
        assertThat(skinItems).as("W3 skin items: tshirt x3, shorts x3, test cloth").hasSize(7);
        for (JsonNode item : skinItems) {
            JsonNode draw = item.path("draw");
            String id = item.path("id").asText();
            assertThat(draw.path("attach").asText()).as("W3 %s attach", id).isEqualTo("skin");
            assertThat(draw.hasNonNull("bone")).as("W3 %s (skin) has no bone: %s", id, draw).isFalse();
            assertThat(draw.hasNonNull("mirror")).as("W3 %s (skin) has no mirror: %s", id, draw).isFalse();
        }
    }

    // =====================================================================
    // W4
    // =====================================================================

    @Test
    void w4_testClothIsANotSoldSkinTopForBodyOne() throws Exception {
        JsonNode item = testClothInFile();
        String label = "W4 " + item.path("id").asText();
        assertThat(item.path("kind").asText()).as("%s kind", label).isEqualTo("wearable");
        assertThat(item.path("slot").asText()).as("%s slot", label).isEqualTo("top");
        assertThat(item.hasNonNull("price")).as("%s price is missing or null: %s", label, item).isFalse();
        assertThat(item.path("alwaysOwned").asBoolean(false)).as("%s is not always owned: %s", label, item).isFalse();
        JsonNode draw = item.path("draw");
        assertThat(draw.isObject()).as("%s draw is an object", label).isTrue();
        assertThat(draw.path("attach").asText()).as("%s draw attach", label).isEqualTo("skin");
        assertThat(draw.path("body").isIntegralNumber()).as("%s draw body is an integer: %s", label, draw).isTrue();
        assertThat(draw.path("body").asInt()).as("%s draw body", label).isEqualTo(BODY);
        // 가정 G3: 지금 목록의 팔지 않는 아이템 관례
        assertThat(item.hasNonNull("category")).as("%s category is null: %s", label, item).isFalse();
        assertThat(item.path("description").asText("")).as("%s description is empty", label).isEqualTo("");
        assertThat(item.path("shopName").asText()).as("%s shopName = name", label).isEqualTo(item.path("name").asText());
    }

    // =====================================================================
    // W5
    // =====================================================================

    @Test
    void w5_serverSlotsComeFromSlotOnly() throws Exception {
        Map<String, String> expected = new HashMap<>();
        SIXTEEN.forEach(wear -> expected.put(wear.id(), wear.slot()));
        expected.put(GOGGLES, "face");
        expected.put(testClothInFile().path("id").asText(), "top");
        assertThat(new HashMap<>(ItemCatalog.DEFAULT.wearableSlots())).as("W5 wearable slots").isEqualTo(expected);
    }

    // =====================================================================
    // 도우미(CatalogWearablesSpecTest도 쓴다)
    // =====================================================================

    /** draw가 부록 A의 값과 같다(칸은 DRAW_KEYS 안, null 칸은 없는 칸, 색은 RGB 값). */
    public static void assertWearDraw(JsonNode draw, Wear wear, String label) {
        String id = wear.id();
        assertThat(draw).as("%s draw of %s present", label, id).isNotNull();
        assertThat(draw.isObject()).as("%s draw of %s is an object: %s", label, id, draw).isTrue();
        Set<String> keys = new LinkedHashSet<>();
        Iterator<Map.Entry<String, JsonNode>> fields = draw.fields();
        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> field = fields.next();
            if (!field.getValue().isNull()) {
                keys.add(field.getKey());
            }
        }
        assertThat(DRAW_KEYS).as("%s draw keys of %s are known: %s", label, id, draw).containsAll(keys);
        assertThat(draw.path("attach").asText()).as("%s attach of %s", label, id).isEqualTo(wear.attach());
        assertThat(textOrNull(draw, "bone")).as("%s bone of %s", label, id).isEqualTo(wear.bone());
        assertThat(textOrNull(draw, "mirror")).as("%s mirror of %s", label, id).isEqualTo(wear.mirror());
        assertThat(draw.path("body").isIntegralNumber()).as("%s body of %s is an integer: %s", label, id, draw).isTrue();
        assertThat(draw.path("body").asInt()).as("%s body of %s", label, id).isEqualTo(BODY);
        String color = textOrNull(draw, "color");
        if (wear.color() == null) {
            assertThat(color).as("%s %s has no color", label, id).isNull();
        } else {
            assertThat(color).as("%s %s has a color", label, id).isNotNull();
            assertThat(rgb(color)).as("%s color of %s (%s)", label, id, color).isEqualTo(rgb(wear.color()));
        }
    }

    /** "#RRGGBB"나 "RRGGBB"(대소문자 무관) → 0xRRGGBB. 다른 모양이면 -1. */
    static int rgb(String color) {
        String hex = color.startsWith("#") ? color.substring(1) : color;
        if (!hex.matches("[0-9A-Fa-f]{6}")) {
            return -1;
        }
        return Integer.parseInt(hex, 16);
    }

    private static String textOrNull(JsonNode node, String key) {
        JsonNode value = node.get(key);
        return value == null || value.isNull() ? null : value.asText();
    }

    static JsonNode catalogFile() throws Exception {
        try (InputStream in = ItemCatalogWearablesSpecTest.class.getClassLoader().getResourceAsStream("catalog/items.json")) {
            assertThat(in).as("catalog/items.json on the classpath").isNotNull();
            return JSON.readTree(in);
        }
    }

    private static Map<String, JsonNode> byId(JsonNode catalog) {
        Map<String, JsonNode> map = new LinkedHashMap<>();
        for (JsonNode item : catalog.get("items")) {
            map.put(item.path("id").asText(), item);
        }
        return map;
    }

    /** 옷 열일곱 밖의 옷 하나(시험 옷, 가정 G4). */
    private static JsonNode testClothInFile() throws Exception {
        List<JsonNode> others = new ArrayList<>();
        for (JsonNode item : catalogFile().get("items")) {
            if ("wearable".equals(item.path("kind").asText()) && !SEVENTEEN.contains(item.path("id").asText())) {
                others.add(item);
            }
        }
        assertThat(others).as("exactly one test cloth outside the seventeen").hasSize(1);
        return others.get(0);
    }
}
