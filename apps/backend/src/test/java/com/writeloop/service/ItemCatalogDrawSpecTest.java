package com.writeloop.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * [spec] 작업 090 ② 가구 내려받기, 백엔드 시나리오(04-가구-내려받기/03-qa-scenarios.md) 가운데 목록 파일과 서버 검사.
 *
 * <ul>
 *   <li>B1·B3·B4: 목록 파일(클래스패스 catalog/items.json)의 draw 칸.</li>
 *   <li>B2(목록 파일 쪽): 가구 열넷의 draw가 기준 커밋 2d9f184 앱 furniture-catalog.ts의 값 그대로(시나리오 부록 1).
 *       model.piece·chair.piece는 명세에 없어 보지 않는다(가정 G1). 값이 null인 칸은 칸이 없는 것으로 본다.</li>
 *   <li>B20: 서버 검사(두는 곳, 장소 여부, 소품 자리 수)가 draw에서 만들어지고 기준 커밋 서버 검사와 같다.</li>
 *   <li>B27(일부): 처음 가진 가구는 wardrobe·rug·lamp 하나씩이고 시험 가구는 없다.</li>
 * </ul>
 * "시험 가구"는 가구 열넷 밖의 가구 하나다(결정 05: id armchair).
 */
public class ItemCatalogDrawSpecTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    /** 기준 커밋 2d9f184의 가구 열넷(시나리오 "가구 열넷"). */
    public static final List<String> FOURTEEN = List.of(
            "desk", "bookcase", "board", "window", "wardrobe", "rug", "lamp",
            "bed", "nightstand", "floorLamp", "plant", "smallPlant", "books", "frame");

    /** 결정 05의 시험 가구 id. */
    public static final String TEST_FURNITURE = "armchair";

    /**
     * 가구 열넷의 draw 기대값(시나리오 부록 1 = 기준 커밋 furniture-catalog.ts의 FurnitureType에서 id·name·model.piece·chair.piece를 뺀 것).
     */
    public static final Map<String, String> EXPECTED_DRAW = expectedDraw();

    private static Map<String, String> expectedDraw() {
        Map<String, String> map = new LinkedHashMap<>();
        map.put("desk", """
                {"mount":"floor","size":{"width":3,"depth":1},"height":{"bottom":0,"top":1.292},"blocksWalk":true,
                 "place":{"id":"desk","approach":[{"x":0,"z":1.25}],"faceTo":{"x":0,"z":0},"label":{"x":0,"y":2.1,"z":0}},
                 "chair":{"at":{"x":0,"z":0.45},"pull":0.5,"seat":{"x":0,"z":0.95},"side":{"x":0.65,"z":1.05},"seatHeight":0.67,
                          "box":{"width":0.56,"height":1.316,"depth":0.56},"shadow":[0.75,0.75,0.42]},
                 "surface":{},"removable":false,
                 "model":{"box":{"width":2.468,"height":1.292,"depth":1.318},"fillWidth":true,"y":0,"shadow":{"floor":[2.8,1.65,0.5]}}}
                """);
        map.put("bookcase", """
                {"mount":"floor","size":{"width":1,"depth":1},"height":{"bottom":0,"top":2.464},"blocksWalk":true,
                 "place":{"id":"bookcase","approach":[{"x":0,"z":0.9}],"faceTo":{"x":0,"z":-0.5},"label":{"x":0,"y":2.3,"z":0.4}},
                 "removable":false,
                 "model":{"box":{"width":1.12,"height":2.464,"depth":0.876},"y":0,"shadow":{"floor":[1.4,1.2,0.52]}}}
                """);
        map.put("wardrobe", """
                {"mount":"floor","size":{"width":1,"depth":1},"height":{"bottom":0,"top":2.38},"blocksWalk":true,
                 "closet":{"approach":[{"x":0,"z":0.9}],"faceTo":{"x":0,"z":-0.5},"label":{"x":0,"y":2.25,"z":0.4}},
                 "removable":true,
                 "model":{"box":{"width":1.12,"height":2.38,"depth":0.876},"y":0,"shadow":{"floor":[1.4,1.2,0.52]}}}
                """);
        map.put("rug", """
                {"mount":"cover","size":{"width":3,"depth":3},"height":{"bottom":0,"top":0.028},"blocksWalk":false,"removable":true,
                 "model":{"box":{"width":2.576,"height":0.028,"depth":2.576},"y":0.004}}
                """);
        map.put("lamp", """
                {"mount":"tabletop","size":{"width":1,"depth":1},"height":{"bottom":0,"top":0.88},"blocksWalk":false,"removable":true,
                 "model":{"box":{"width":0.418,"height":0.88,"depth":0.475},"y":0}}
                """);
        map.put("bed", """
                {"mount":"floor","size":{"width":2,"depth":3},"height":{"bottom":0,"top":1.05},"blocksWalk":true,"removable":true,
                 "model":{"box":{"width":1.599,"height":1.05,"depth":3.15},"y":0,"shadow":{"floor":[1.95,3.35,0.5]}}}
                """);
        map.put("nightstand", """
                {"mount":"floor","size":{"width":1,"depth":1},"height":{"bottom":0,"top":0.74},"blocksWalk":true,"surface":{},"removable":true,
                 "model":{"box":{"width":0.745,"height":0.737,"depth":0.608},"y":0,"shadow":{"floor":[0.95,0.85,0.45]}}}
                """);
        map.put("floorLamp", """
                {"mount":"floor","size":{"width":1,"depth":1},"height":{"bottom":0,"top":2.41},"blocksWalk":true,"removable":true,
                 "model":{"box":{"width":0.418,"height":2.408,"depth":0.475},"y":0,"shadow":{"floor":[0.6,0.65,0.45]}}}
                """);
        map.put("plant", """
                {"mount":"floor","size":{"width":1,"depth":1},"height":{"bottom":0,"top":1.83},"blocksWalk":true,"removable":true,
                 "model":{"box":{"width":0.486,"height":1.636,"depth":0.574},"y":0,"shadow":{"floor":[0.7,0.75,0.45]}}}
                """);
        map.put("smallPlant", """
                {"mount":"tabletop","size":{"width":1,"depth":1},"height":{"bottom":0,"top":0.41},"blocksWalk":false,"removable":true,
                 "model":{"box":{"width":0.25,"height":0.37,"depth":0.249},"y":0}}
                """);
        map.put("books", """
                {"mount":"tabletop","size":{"width":1,"depth":1},"height":{"bottom":0,"top":0.29},"blocksWalk":false,"removable":true,
                 "model":{"box":{"width":0.419,"height":0.29,"depth":0.265},"y":0}}
                """);
        map.put("board", """
                {"mount":"wall","size":{"width":1.8,"depth":0},"height":{"bottom":1.05,"top":2.45},"blocksWalk":false,
                 "place":{"id":"board","approach":[{"x":-0.2,"z":1.3},{"x":0.4,"z":1.3}],"faceTo":{"x":0,"z":0},"label":{"x":0,"y":2.75,"z":0.3}},
                 "removable":false,
                 "model":{"box":{"width":1.792,"height":1.4,"depth":0.126},"y":1.75,"wallDepth":0.06,"shadow":{"wall":[2.0,1.6,0.3]}}}
                """);
        map.put("window", """
                {"mount":"wall","size":{"width":2.3,"depth":0},"height":{"bottom":1.112,"top":2.988},"blocksWalk":false,
                 "place":{"id":"window","approach":[{"x":-0.3,"z":1.55},{"x":0.3,"z":1.55}],"faceTo":{"x":0,"z":0},"label":{"x":0,"y":3.05,"z":0.3}},
                 "removable":false,"view":true,
                 "model":{"box":{"width":2.3,"height":1.876,"depth":0.35},"y":2.05,"wallDepth":0.17,"shadow":{"wall":[2.55,2.15,0.3]}}}
                """);
        map.put("frame", """
                {"mount":"wall","size":{"width":1,"depth":0},"height":{"bottom":1.6,"top":2.4},"blocksWalk":false,"removable":true,
                 "model":{"box":{"width":1,"height":0.8,"depth":0.084},"y":2.0,"wallDepth":0.042,"shadow":{"wall":[1.15,0.95,0.3]}}}
                """);
        return map;
    }

    /** 기준 커밋 서버 검사(LobbyLayoutService.KINDS): 두는 곳(floor·wall·tabletop), 장소 여부, 소품 자리 수(시나리오 B20). */
    private record Check(String mount, boolean place, int slots) {
    }

    private static final Map<String, Check> EXPECTED_CHECKS = expectedChecks();

    private static Map<String, Check> expectedChecks() {
        Map<String, Check> map = new LinkedHashMap<>();
        map.put("desk", new Check("floor", true, 3));
        map.put("bookcase", new Check("floor", true, 0));
        map.put("board", new Check("wall", true, 0));
        map.put("window", new Check("wall", true, 0));
        map.put("wardrobe", new Check("floor", false, 0));
        map.put("rug", new Check("floor", false, 0));
        map.put("lamp", new Check("tabletop", false, 0));
        map.put("bed", new Check("floor", false, 0));
        map.put("nightstand", new Check("floor", false, 1));
        map.put("floorLamp", new Check("floor", false, 0));
        map.put("plant", new Check("floor", false, 0));
        map.put("smallPlant", new Check("tabletop", false, 0));
        map.put("books", new Check("tabletop", false, 0));
        map.put("frame", new Check("wall", false, 0));
        return map;
    }

    // =====================================================================
    // A. 목록 파일과 그리기 정보
    // =====================================================================

    @Test
    void b1_everyFurnitureHasDrawAndNoItemHasFurnitureField() throws Exception {
        JsonNode items = catalogFile().get("items");
        List<String> furniture = new ArrayList<>();
        for (JsonNode item : items) {
            String id = item.path("id").asText();
            assertThat(item.has("furniture")).as("B1 %s has no furniture field: %s", id, item).isFalse();
            if ("furniture".equals(item.path("kind").asText())) {
                furniture.add(id);
                assertThat(item.path("draw").isObject()).as("B1 %s has a draw object: %s", id, item).isTrue();
            }
        }
        List<String> expected = new ArrayList<>(FOURTEEN);
        expected.add(TEST_FURNITURE);
        assertThat(furniture).as("B1 furniture count").hasSize(15);
        assertThat(furniture).as("B1 furniture = fourteen + one test furniture").containsAll(FOURTEEN);
        assertThat(furniture.stream().filter(id -> !FOURTEEN.contains(id)).toList())
                .as("B1 exactly one furniture outside the fourteen").hasSize(1);
    }

    @Test
    void b2_drawOfTheFourteenInTheFileIsTheAppValue() throws Exception {
        Map<String, JsonNode> byId = byId(catalogFile());
        for (String id : FOURTEEN) {
            JsonNode item = byId.get(id);
            assertThat(item).as("B2 %s in the file", id).isNotNull();
            assertDrawEquals(item.get("draw"), id, "B2 file");
        }
    }

    @Test
    void b3_wearablesInTheFileHaveNoDraw() throws Exception {
        int count = 0;
        for (JsonNode item : catalogFile().get("items")) {
            if ("wearable".equals(item.path("kind").asText())) {
                count++;
                assertThat(item.has("draw")).as("B3 %s has no draw: %s", item.path("id").asText(), item).isFalse();
            }
        }
        assertThat(count).as("B3 wearable count").isEqualTo(17);
    }

    @Test
    void b4_testFurnitureIsNotSoldNotStarterAndHasNoPlace() throws Exception {
        JsonNode item = testFurnitureInFile();
        String label = "B4 " + item.path("id").asText();
        assertThat(item.path("kind").asText()).as("%s kind", label).isEqualTo("furniture");
        assertThat(item.has("price") && !item.get("price").isNull()).as("%s price is null: %s", label, item).isFalse();
        assertThat(item.path("starter").asInt(0)).as("%s starter is 0 or missing: %s", label, item).isZero();
        assertThat(item.path("draw").isObject()).as("%s has draw: %s", label, item).isTrue();
        assertThat(item.get("draw").hasNonNull("place")).as("%s draw has no place: %s", label, item).isFalse();
    }

    // =====================================================================
    // E. 서버 검사가 draw에서 만들어진다
    // =====================================================================

    @Test
    void b20_checksDerivedFromDrawMatchTheBaseServerChecks() throws Exception {
        Map<String, JsonNode> byId = byId(catalogFile());
        for (String id : FOURTEEN) {
            JsonNode draw = byId.get(id).get("draw");
            assertThat(checkFromDraw(draw)).as("B20 check derived from draw of %s", id).isEqualTo(EXPECTED_CHECKS.get(id));
        }
    }

    @Test
    void b20_serverCheckInfoComesFromDraw() throws Exception {
        Map<String, ItemCatalog.Furniture> kinds = ItemCatalog.DEFAULT.furnitureKinds();
        for (String id : FOURTEEN) {
            ItemCatalog.Furniture actual = kinds.get(id);
            assertThat(actual).as("B20 server knows %s", id).isNotNull();
            assertThat(new Check(actual.mount(), actual.place(), actual.slots())).as("B20 server check of %s", id)
                    .isEqualTo(EXPECTED_CHECKS.get(id));
        }
        // 시험 가구도 서버 검사가 그 draw를 따른다(B21의 바탕)
        JsonNode test = testFurnitureInFile();
        String testId = test.path("id").asText();
        ItemCatalog.Furniture actual = kinds.get(testId);
        assertThat(actual).as("B20 server knows the test furniture %s", testId).isNotNull();
        assertThat(new Check(actual.mount(), actual.place(), actual.slots())).as("B20 server check of %s", testId)
                .isEqualTo(checkFromDraw(test.get("draw")));
    }

    // =====================================================================
    // F. 처음 가진 가구(B27 일부)
    // =====================================================================

    @Test
    void b27_starterFurnitureIsUnchangedAndExcludesTheTestFurniture() throws Exception {
        Map<String, Integer> expected = new LinkedHashMap<>();
        expected.put("wardrobe", 1);
        expected.put("rug", 1);
        expected.put("lamp", 1);
        assertThat(ItemCatalog.DEFAULT.starterCounts()).as("B27 starter counts").isEqualTo(expected);
        assertThat(ItemCatalog.DEFAULT.starterCounts()).as("B27 test furniture is not starter")
                .doesNotContainKey(testFurnitureInFile().path("id").asText());
    }

    // =====================================================================
    // 도우미
    // =====================================================================

    /** B20 규칙: floor·cover→floor, wall→wall, tabletop→tabletop / 장소 = draw에 place / 자리 = surface 없으면 0, cells 없으면 가로×깊이, 있으면 그 수. */
    private static Check checkFromDraw(JsonNode draw) {
        String mount = draw.path("mount").asText();
        String serverMount = switch (mount) {
            case "floor", "cover" -> "floor";
            case "wall" -> "wall";
            case "tabletop" -> "tabletop";
            default -> "unknown:" + mount;
        };
        boolean place = draw.hasNonNull("place");
        int slots = 0;
        if (draw.hasNonNull("surface")) {
            JsonNode cells = draw.get("surface").get("cells");
            if (cells != null && !cells.isNull()) {
                slots = cells.size();
            } else {
                slots = (int) Math.round(draw.path("size").path("width").asDouble() * draw.path("size").path("depth").asDouble());
            }
        }
        return new Check(serverMount, place, slots);
    }

    /** draw를 부록 1 값과 견준다(model.piece·chair.piece와 null 칸은 빼고, 수는 값으로). */
    public static void assertDrawEquals(JsonNode actualDraw, String id, String label) throws Exception {
        assertThat(actualDraw).as("%s draw of %s present", label, id).isNotNull();
        assertThat(actualDraw.isObject()).as("%s draw of %s is an object: %s", label, id, actualDraw).isTrue();
        ObjectNode actual = (ObjectNode) normalized(actualDraw.deepCopy());
        if (actual.get("model") instanceof ObjectNode model) {
            model.remove("piece");
        }
        if (actual.get("chair") instanceof ObjectNode chair) {
            chair.remove("piece");
        }
        JsonNode expected = JSON.readTree(EXPECTED_DRAW.get(id));
        assertThat(actual.equals(NUMERIC_VALUE, expected))
                .as("%s draw of %s%n  actual:   %s%n  expected: %s", label, id, actual, expected)
                .isTrue();
    }

    /** null 값 칸을 없앤다(부록 1 "없음" = 칸이 없거나 null). */
    private static JsonNode normalized(JsonNode node) {
        if (node instanceof ObjectNode object) {
            Iterator<Map.Entry<String, JsonNode>> fields = object.fields();
            List<String> nulls = new ArrayList<>();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> field = fields.next();
                if (field.getValue().isNull()) {
                    nulls.add(field.getKey());
                } else {
                    normalized(field.getValue());
                }
            }
            object.remove(nulls);
        } else if (node.isArray()) {
            node.forEach(ItemCatalogDrawSpecTest::normalized);
        }
        return node;
    }

    /** 수는 값으로 견준다(2와 2.0은 같다). 다른 값은 JsonNode.equals. */
    public static final Comparator<JsonNode> NUMERIC_VALUE = (a, b) -> {
        if (a.isNumber() && b.isNumber()) {
            return new BigDecimal(a.asText()).compareTo(new BigDecimal(b.asText())) == 0 ? 0 : 1;
        }
        return a.equals(b) ? 0 : 1;
    };

    private static JsonNode catalogFile() throws Exception {
        try (InputStream in = ItemCatalogDrawSpecTest.class.getClassLoader().getResourceAsStream("catalog/items.json")) {
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

    /** 가구 열넷 밖의 가구 하나(시험 가구). */
    private static JsonNode testFurnitureInFile() throws Exception {
        List<JsonNode> others = new ArrayList<>();
        for (JsonNode item : catalogFile().get("items")) {
            if ("furniture".equals(item.path("kind").asText()) && !FOURTEEN.contains(item.path("id").asText())) {
                others.add(item);
            }
        }
        assertThat(others).as("exactly one test furniture outside the fourteen").hasSize(1);
        return others.get(0);
    }
}
