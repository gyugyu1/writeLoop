package com.writeloop.controller;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.support.IntegrationTestSupport;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * [spec] 작업 093 창문 붙박이(01-main-spec.md 바뀌는 동작 3, 그대로여야 할 동작), 서버 아이템 목록 GET /api/catalog의 창문.
 *
 * <ul>
 *   <li>FC-1(바뀔 동작, 명세 3과 04-main-decision.md 사용자 결정 1): 창문 항목에 "옮길 수 없음" 값 draw.fixed(true)가 더해진다.
 *       기준 커밋 64a30ab의 창문 항목(assets 밖)과 견줘 새로 생긴 칸은 draw.fixed 하나이고 값은 true이며,
 *       창문 밖의 다른 가구에는 draw.fixed가 없다. 고치기 전에는 새 칸이 없어 실패가 맞다.</li>
 *   <li>FC-2(그대로 둘 동작, 명세 "창문의 모양, 창밖 풍경, 바닥 햇빛, 생각 창가 장소", "보관함에 넣을 수 없다"): 기준 커밋 창문 항목의
 *       칸은 모두 그대로 있고 값이 같다(draw의 모양·장소·removable false·view true 포함). 수는 값으로 견준다.</li>
 * </ul>
 */
class CatalogFixedWindowSpecTest extends IntegrationTestSupport {

    private static final ObjectMapper JSON = new ObjectMapper();

    /** 기준 커밋 64a30ab의 GET /api/catalog 창문 항목에서 assets를 뺀 것(목록 파일 catalog/items.json의 창문과 CatalogDto 칸). */
    private static final String BASE_WINDOW = """
            {"id":"window","kind":"furniture","name":"창문","shopName":"창문","description":"","category":null,"slot":null,"price":null,
             "draw":{"mount":"wall","size":{"width":2.3,"depth":0},"height":{"bottom":1.112,"top":2.988},"blocksWalk":false,
                     "place":{"id":"window","approach":[{"x":-0.3,"z":1.55},{"x":0.3,"z":1.55}],"faceTo":{"x":0,"z":0},"label":{"x":0,"y":3.05,"z":0.3}},
                     "removable":false,"view":true,
                     "model":{"piece":"window","box":{"width":2.3,"height":1.876,"depth":0.35},"y":2.05,"wallDepth":0.17,"shadow":{"wall":[2.55,2.15,0.3]}}}}
            """;

    private final HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();

    @Test
    void fc1_windowCarriesANewValueThatNoOtherFurnitureHas() throws Exception {
        JsonNode items = catalogItems();
        JsonNode window = furniture(items, "window");
        JsonNode base = JSON.readTree(BASE_WINDOW);

        Map<String, JsonNode> added = new LinkedHashMap<>();
        collectAdded(base, window, "", added);
        added.keySet().removeIf(path -> path.equals("/assets") || path.startsWith("/assets/"));

        // 04-main-decision.md 1: 새 값은 draw.fixed(true) 하나다
        assertThat(added.keySet()).as("FC-1 new value(s) on the window item compared with base 64a30ab: %s", window)
                .containsExactly("/draw/fixed");
        JsonNode fixed = window.at("/draw/fixed");
        assertThat(fixed.isBoolean()).as("FC-1 window draw.fixed is a boolean: %s", fixed).isTrue();
        assertThat(fixed.booleanValue()).as("FC-1 window draw.fixed").isTrue();
        // 04-main-decision.md 1: 다른 가구에는 두지 않는다(없으면 옮길 수 있음)
        for (JsonNode other : items) {
            if (!"furniture".equals(other.path("kind").asText()) || "window".equals(other.path("id").asText())) {
                continue;
            }
            assertThat(other.path("draw").has("fixed")).as("FC-1 furniture %s has no draw.fixed: %s", other.path("id").asText(), other)
                    .isFalse();
        }
    }

    @Test
    void fc2_everyBaseValueOfTheWindowStaysTheSame() throws Exception {
        JsonNode window = furniture(catalogItems(), "window");
        JsonNode base = JSON.readTree(BASE_WINDOW);

        List<String> changed = new ArrayList<>();
        collectChanged(base, window, "", changed);

        assertThat(changed).as("FC-2 base values of the window that changed or disappeared: %s", window).isEmpty();
    }

    // ---------- 도움 ----------

    /** actual에만 있는 칸(객체 안의 새 키)을 JSON Pointer 경로로 모은다. 배열은 통째로 한 값으로 본다. */
    private static void collectAdded(JsonNode base, JsonNode actual, String path, Map<String, JsonNode> added) {
        if (actual == null || !actual.isObject()) {
            return;
        }
        Iterator<Map.Entry<String, JsonNode>> fields = actual.fields();
        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> field = fields.next();
            String child = path + "/" + field.getKey();
            if (base == null || !base.isObject() || !base.has(field.getKey())) {
                added.put(child, field.getValue());
            } else {
                collectAdded(base.get(field.getKey()), field.getValue(), child, added);
            }
        }
    }

    /** base의 칸마다 actual에 같은 값이 있는지 본다. 객체는 키마다 내려가고, 그 밖의 값은 sameValue로 견준다. */
    private static void collectChanged(JsonNode base, JsonNode actual, String path, List<String> changed) {
        if (base.isObject()) {
            if (actual == null || !actual.isObject()) {
                changed.add(path + " (not an object: " + actual + ")");
                return;
            }
            Iterator<Map.Entry<String, JsonNode>> fields = base.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> field = fields.next();
                String child = path + "/" + field.getKey();
                if (!actual.has(field.getKey())) {
                    changed.add(child + " (missing)");
                } else {
                    collectChanged(field.getValue(), actual.get(field.getKey()), child, changed);
                }
            }
            return;
        }
        if (actual == null || !sameValue(base, actual)) {
            changed.add(path + " (base " + base + ", now " + actual + ")");
        }
    }

    /** 수는 값으로(2와 2.0은 같다), 배열은 원소마다, 그 밖은 JsonNode.equals로 견준다. */
    private static boolean sameValue(JsonNode a, JsonNode b) {
        if (a.isNumber() && b.isNumber()) {
            return new BigDecimal(a.asText()).compareTo(new BigDecimal(b.asText())) == 0;
        }
        if (a.isArray() && b.isArray()) {
            if (a.size() != b.size()) {
                return false;
            }
            for (int i = 0; i < a.size(); i++) {
                if (!sameValue(a.get(i), b.get(i))) {
                    return false;
                }
            }
            return true;
        }
        if (a.isObject() && b.isObject()) {
            if (a.size() != b.size()) {
                return false;
            }
            Iterator<Map.Entry<String, JsonNode>> fields = a.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> field = fields.next();
                if (!b.has(field.getKey()) || !sameValue(field.getValue(), b.get(field.getKey()))) {
                    return false;
                }
            }
            return true;
        }
        return a.equals(b);
    }

    private JsonNode catalogItems() throws Exception {
        HttpResponse<String> response = client.send(
                HttpRequest.newBuilder(URI.create(rest.getRootUri() + "/api/catalog")).GET().build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).as("GET /api/catalog, body %s", response.body()).isEqualTo(200);
        JsonNode items = JSON.readTree(response.body()).get("items");
        assertThat(items != null && items.isArray()).as("items is an array").isTrue();
        return items;
    }

    private static JsonNode furniture(JsonNode items, String id) {
        JsonNode found = null;
        int count = 0;
        for (JsonNode item : items) {
            if (id.equals(item.path("id").asText()) && "furniture".equals(item.path("kind").asText())) {
                found = item;
                count++;
            }
        }
        assertThat(count).as("furniture %s in the catalog", id).isEqualTo(1);
        return found;
    }
}
