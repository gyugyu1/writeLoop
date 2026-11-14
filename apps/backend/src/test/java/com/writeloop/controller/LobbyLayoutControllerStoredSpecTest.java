package com.writeloop.controller;

import static com.writeloop.controller.LobbyLayoutControllerSpecTest.assertSameLayout;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.floorItem;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.floorValue;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.items;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.names;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.p0;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.p1;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.removeItem;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.wallValue;
import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.writeloop.support.IntegrationTestSupport;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * [spec] 작업 066 ③ 제거·보관함·꺼내 놓기, 서버 시나리오(04-제거-보관함-꺼내기/02-qa-scenarios.md SV-A1~A13, SV-R0~R33)와
 * 결정 04-main-decision.md 3(`"stored": null`은 잘못된 본문으로 거절)·"묻지 않고 정한 것"(`stored: []`는 응답에도 `[]`,
 * 보관함 순서는 비교하지 않는다)을 실제 서버로 확인한다.
 *
 * <ul>
 *   <li>저장 본문 v2에 보관함 목록 `stored: [{ id, type }]`가 더해진다. 없어도 되고, 없으면 응답에도 없다.</li>
 *   <li>보관함 항목은 id·type 두 키만. id 형식은 방의 가구와 같고 방과 보관함을 통틀어 겹치지 않는다.
 *       종류는 아는 종류이면서 치울 수 있는(장소가 없는) 종류여야 한다.</li>
 *   <li>항목 수 1~40개는 방과 보관함을 합친 수다. 어기면 400 INVALID_LOBBY_LAYOUT이고 저장하지 않는다.</li>
 * </ul>
 * 테스트마다 새 이메일 사용자를 만들고 자기 데이터만 확인한다.
 */
class LobbyLayoutControllerStoredSpecTest extends IntegrationTestSupport {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String PATH = "/api/lobby-layout";
    private static final String INVALID_CODE = "INVALID_LOBBY_LAYOUT";

    /** 064 ②가 DB에 남긴 v1 배치(LobbyLayoutControllerV2SpecTest의 V1_LAYOUT_JSON과 같은 값). */
    private static final String V1_LAYOUT_JSON = "{\"floor\":{"
            + "\"desk\":{\"x\":1.5,\"z\":5.5,\"facing\":0},"
            + "\"bookcase\":{\"x\":0.5,\"z\":2.5,\"facing\":1},"
            + "\"wardrobe\":{\"x\":7.5,\"z\":3.5,\"facing\":3},"
            + "\"rug\":{\"x\":4.6,\"z\":7.2,\"facing\":0}},"
            + "\"wall\":{"
            + "\"board\":{\"wall\":\"back\",\"along\":1.8},"
            + "\"window\":{\"wall\":\"back\",\"along\":4.8}}}";

    @Autowired
    private PasswordEncoder passwordEncoder;

    private final HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();

    // ---------- 받아야 하는 쪽(A) ----------

    @Test
    void a1_layoutWithoutStoredKeyComesBackWithoutStored() throws Exception {
        TestUser user = newUser("a1");

        HttpResponse<String> save = put(user.token(), p0());
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("SV-A1 PUT P0 without stored, body %s", save.body()).isEqualTo(200);
        assertSameStoredLayout(p0(), JSON.readTree(save.body()), "SV-A1 save");
        assertThat(load.statusCode()).as("SV-A1 GET, body %s", load.body()).isEqualTo(200);
        assertSameStoredLayout(p0(), JSON.readTree(load.body()), "SV-A1 load");
    }

    @Test
    void a2_emptyStoredListComesBackAsEmptyList() throws Exception {
        // 결정 04 "묻지 않고 정한 것": stored: []를 받으면 응답에도 []로 돌려준다.
        TestUser user = newUser("a2");
        ObjectNode layout = p0();
        layout.putArray("stored");

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("SV-A2 PUT P0 + stored [], body %s", save.body()).isEqualTo(200);
        assertThat(load.statusCode()).as("SV-A2 GET, body %s", load.body()).isEqualTo(200);
        JsonNode loaded = JSON.readTree(load.body());
        assertSameStoredLayout(layout, loaded, "SV-A2 load");
        assertThat(loaded.get("stored").isArray()).as("SV-A2 stored is an array: %s", loaded).isTrue();
        assertThat(loaded.get("stored").size()).as("SV-A2 stored length").isEqualTo(0);
    }

    @Test
    void a3_storedWardrobeIsSavedAndLoaded() throws Exception {
        TestUser user = newUser("a3");

        HttpResponse<String> save = put(user.token(), p0s());
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("SV-A3 PUT P0S, body %s", save.body()).isEqualTo(200);
        // SV-A13: 저장 응답도 요청과 같은 배치다
        assertSameStoredLayout(p0s(), JSON.readTree(save.body()), "SV-A3/A13 save");
        assertThat(load.statusCode()).as("SV-A3 GET, body %s", load.body()).isEqualTo(200);
        JsonNode loaded = JSON.readTree(load.body());
        assertSameStoredLayout(p0s(), loaded, "SV-A3 load");
        assertThat(loaded.get("items").size()).as("SV-A3 items count").isEqualTo(5);
        assertThat(loaded.get("stored").size()).as("SV-A3 stored count").isEqualTo(1);
        assertThat(names(loaded.get("stored").get(0))).as("SV-A3 stored item keys").isEqualTo(Set.of("id", "type"));
        assertThat(loaded.get("stored").get(0).get("id").asText()).as("SV-A3 stored id").isEqualTo("wardrobe");
        assertThat(loaded.get("stored").get(0).get("type").asText()).as("SV-A3 stored type").isEqualTo("wardrobe");
    }

    @Test
    void a4_severalRemovableItemsOfTheSameTypeCanBeStored() throws Exception {
        TestUser user = newUser("a4");
        ObjectNode layout = p0();
        removeItem(layout, "wardrobe");
        removeItem(layout, "rug");
        ArrayNode stored = layout.putArray("stored");
        stored.add(storedItem("wardrobe", "wardrobe"));
        stored.add(storedItem("rug", "rug"));
        stored.add(storedItem("wardrobe-2", "wardrobe"));
        stored.add(storedItem("rug_2", "rug"));

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("SV-A4 PUT four stored items, body %s", save.body()).isEqualTo(200);
        assertSameStoredLayout(layout, JSON.readTree(save.body()), "SV-A4/A13 save");
        assertThat(load.statusCode()).as("SV-A4 GET, body %s", load.body()).isEqualTo(200);
        assertSameStoredLayout(layout, JSON.readTree(load.body()), "SV-A4 load");
    }

    @Test
    void a5_sameTypeMayBeInTheRoomAndInStorageWithDifferentIds() throws Exception {
        TestUser user = newUser("a5");
        ObjectNode layout = p0();
        layout.putArray("stored").add(storedItem("wardrobe-2", "wardrobe"));

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("SV-A5 PUT, body %s", save.body()).isEqualTo(200);
        assertThat(load.statusCode()).as("SV-A5 GET, body %s", load.body()).isEqualTo(200);
        assertSameStoredLayout(layout, JSON.readTree(load.body()), "SV-A5");
    }

    @Test
    void a6_storedIdsFollowTheRoomIdFormat() throws Exception {
        TestUser user = newUser("a6");
        ObjectNode layout = p0();
        ArrayNode stored = layout.putArray("stored");
        stored.add(storedItem("a".repeat(40), "rug"));
        stored.add(storedItem("W", "wardrobe"));
        stored.add(storedItem("x_Y-9", "rug"));

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("SV-A6 PUT, body %s", save.body()).isEqualTo(200);
        assertThat(load.statusCode()).as("SV-A6 GET, body %s", load.body()).isEqualTo(200);
        assertSameStoredLayout(layout, JSON.readTree(load.body()), "SV-A6");
    }

    @Test
    void a7_fortyItemsCountingRoomAndStorageAreAccepted() throws Exception {
        TestUser user = newUser("a7");
        ObjectNode layout = p0();
        ArrayNode stored = layout.putArray("stored");
        for (int i = 1; i <= 34; i++) {
            stored.add(storedItem("rug-s" + i, "rug"));
        }
        assertThat(items(layout).size() + stored.size()).as("setup: 40 items in total").isEqualTo(40);

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("SV-A7 PUT 6 + 34 stored, body %s", save.body()).isEqualTo(200);
        assertSameStoredLayout(layout, JSON.readTree(save.body()), "SV-A7/A13 save");
        assertThat(load.statusCode()).as("SV-A7 GET, body %s", load.body()).isEqualTo(200);
        JsonNode loaded = JSON.readTree(load.body());
        assertSameStoredLayout(layout, loaded, "SV-A7 load");
        assertThat(loaded.get("stored").size()).as("SV-A7 stored count").isEqualTo(34);
    }

    @Test
    void a8_fortyItemsInTheRoomWithAnEmptyStorageAreAccepted() throws Exception {
        TestUser user = newUser("a8");
        ObjectNode layout = p0();
        addRugs(layout, 34);
        layout.putArray("stored");
        assertThat(items(layout).size()).as("setup: 40 items in the room").isEqualTo(40);

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("SV-A8 PUT 40 items + stored [], body %s", save.body()).isEqualTo(200);
        assertThat(load.statusCode()).as("SV-A8 GET, body %s", load.body()).isEqualTo(200);
        assertSameStoredLayout(layout, JSON.readTree(load.body()), "SV-A8");
    }

    @Test
    void a9_overwritingWithoutStoredDropsTheStorage() throws Exception {
        TestUser user = newUser("a9");

        HttpResponse<String> first = put(user.token(), p0s());
        HttpResponse<String> second = put(user.token(), p1());
        HttpResponse<String> load = get(user.token());

        assertThat(first.statusCode()).as("SV-A9 PUT P0S, body %s", first.body()).isEqualTo(200);
        assertThat(second.statusCode()).as("SV-A9 PUT P1, body %s", second.body()).isEqualTo(200);
        assertThat(load.statusCode()).as("SV-A9 GET, body %s", load.body()).isEqualTo(200);
        assertSameStoredLayout(p1(), JSON.readTree(load.body()), "SV-A9");
        assertThat(rowsOf(user.id())).as("SV-A9 lobby_layouts rows of user %s", user.id()).isEqualTo(1);
    }

    @Test
    void a10_eachSaveOverwritesTheStorage() throws Exception {
        TestUser user = newUser("a10");

        HttpResponse<String> first = put(user.token(), p0s());
        HttpResponse<String> second = put(user.token(), p1s());
        HttpResponse<String> load = get(user.token());

        assertThat(first.statusCode()).as("SV-A10 PUT P0S, body %s", first.body()).isEqualTo(200);
        assertThat(second.statusCode()).as("SV-A10 PUT P1S, body %s", second.body()).isEqualTo(200);
        assertThat(load.statusCode()).as("SV-A10 GET, body %s", load.body()).isEqualTo(200);
        assertSameStoredLayout(p1s(), JSON.readTree(load.body()), "SV-A10");
    }

    @Test
    void a11_v2RowSavedBeforeStorageExistedStillLoads() throws Exception {
        TestUser user = newUser("a11");
        ObjectNode storedRow = JSON.createObjectNode();
        storedRow.set("items", p0().get("items"));
        jdbc.update(
                "INSERT INTO lobby_layouts (user_id, shape_version, layout_json, created_at, updated_at) "
                        + "VALUES (?, 2, ?, NOW(6), NOW(6))",
                user.id(), JSON.writeValueAsString(storedRow));
        assertThat(rowsOf(user.id())).as("setup: v2 row of user %s", user.id()).isEqualTo(1);

        HttpResponse<String> load = get(user.token());

        assertThat(load.statusCode()).as("SV-A11 GET an old v2 row, body %s", load.body()).isEqualTo(200);
        assertSameStoredLayout(p0(), JSON.readTree(load.body()), "SV-A11");
    }

    @Test
    void a12_v1RowIsNoneAndSavingWithStorageOverwritesIt() throws Exception {
        TestUser user = newUser("a12");
        jdbc.update(
                "INSERT INTO lobby_layouts (user_id, shape_version, layout_json, created_at, updated_at) "
                        + "VALUES (?, 1, ?, NOW(6), NOW(6))",
                user.id(), V1_LAYOUT_JSON);

        HttpResponse<String> firstLoad = get(user.token());
        HttpResponse<String> save = put(user.token(), p0s());
        HttpResponse<String> secondLoad = get(user.token());

        assertThat(firstLoad.statusCode()).as("SV-A12 GET a v1 row, body %s", firstLoad.body()).isEqualTo(404);
        assertThat(save.statusCode()).as("SV-A12 PUT P0S, body %s", save.body()).isEqualTo(200);
        assertThat(secondLoad.statusCode()).as("SV-A12 GET after saving, body %s", secondLoad.body()).isEqualTo(200);
        assertSameStoredLayout(p0s(), JSON.readTree(secondLoad.body()), "SV-A12");
        assertThat(shapeVersionOf(user.id())).as("SV-A12 shape_version").isEqualTo(2);
    }

    // ---------- 거절(R) ----------

    static Stream<Arguments> rejectedStoredLayouts() {
        List<Arguments> cases = new ArrayList<>();
        // stored 모양
        cases.add(rejected("SV-R1 stored is an object", l -> l.putObject("stored").put("wardrobe", "wardrobe")));
        cases.add(rejected("SV-R2 stored is a string", l -> l.put("stored", "wardrobe")));
        cases.add(rejected("SV-R3 a stored item is a string", l -> stored(l).add("wardrobe")));
        cases.add(rejected("SV-R4 a stored item is null", l -> stored(l).addNull()));
        cases.add(rejected("SV-R5 a stored item is an array", l -> stored(l).addArray().add("wardrobe").add("wardrobe")));
        // 결정 04-3: "stored": null은 잘못된 본문
        cases.add(rejected("D04-3 stored is null", l -> l.putNull("stored")));
        // 보관함 항목은 id·type 두 키만
        cases.add(rejected("SV-R6 stored item with floor", l -> storedWardrobe(l).set("floor", floorValue(7.5, 3.5, 3))));
        cases.add(rejected("SV-R7 stored item with wall", l -> storedWardrobe(l).set("wall", wallValue("back", 6.5))));
        cases.add(rejected("SV-R8 stored item with count", l -> storedWardrobe(l).put("count", 1)));
        cases.add(rejected("SV-R9 stored item without type", l -> storedWardrobe(l).remove("type")));
        cases.add(rejected("SV-R10 stored item without id", l -> storedWardrobe(l).remove("id")));
        // id 형식
        cases.add(rejected("SV-R11 stored id empty", l -> storedWardrobe(l).put("id", "")));
        cases.add(rejected("SV-R12 stored id 41 chars", l -> storedWardrobe(l).put("id", "a".repeat(41))));
        cases.add(rejected("SV-R13 stored id with a space", l -> storedWardrobe(l).put("id", "ward robe")));
        cases.add(rejected("SV-R14 stored id with a dot", l -> storedWardrobe(l).put("id", "wardrobe.2")));
        cases.add(rejected("SV-R15 stored id in Korean", l -> storedWardrobe(l).put("id", "옷장")));
        cases.add(rejected("SV-R16 stored id is a number", l -> storedWardrobe(l).put("id", 7)));
        cases.add(rejected("SV-R17 stored id null", l -> storedWardrobe(l).putNull("id")));
        // 아는 종류
        cases.add(rejected("SV-R18 stored type sofa", l -> storedWardrobe(l).put("type", "sofa")));
        cases.add(rejected("SV-R19 stored type Wardrobe (upper case)", l -> storedWardrobe(l).put("type", "Wardrobe")));
        cases.add(rejected("SV-R20 stored type is a number", l -> storedWardrobe(l).put("type", 3)));
        cases.add(rejected("SV-R21 stored type null", l -> storedWardrobe(l).putNull("type")));
        // 치울 수 있는 종류만(장소 가구는 치울 수 없다)
        cases.add(rejected("SV-R22 stored desk while the desk is in the room", l -> stored(l).add(storedItem("desk-2", "desk"))));
        cases.add(rejected("SV-R23 bookcase moved from the room to storage", l -> {
            removeItem(l, "bookcase");
            stored(l).add(storedItem("bookcase", "bookcase"));
        }));
        cases.add(rejected("SV-R24 stored board while the board is on the wall", l -> stored(l).add(storedItem("board-2", "board"))));
        cases.add(rejected("SV-R25 window moved from the wall to storage", l -> {
            removeItem(l, "window");
            stored(l).add(storedItem("window", "window"));
        }));
        // id는 방과 보관함을 통틀어 겹치지 않는다
        cases.add(rejected("SV-R26 duplicate id within storage", l -> stored(l).add(storedItem("wardrobe", "wardrobe"))));
        cases.add(rejected("SV-R27 duplicate id within storage, different types", l -> stored(l).add(storedItem("wardrobe", "rug"))));
        cases.add(rejected("SV-R28 stored id equals the room rug id", l -> stored(l).add(storedItem("rug", "rug"))));
        cases.add(rejected("SV-R29 stored id equals the room desk id", l -> stored(l).add(storedItem("desk", "wardrobe"))));
        // 방과 보관함을 합친 항목 수 40 초과
        cases.add(rejected("SV-R30 6 in the room + 35 stored", l -> {
            replaceWith(l, p0());
            ArrayNode stored = l.putArray("stored");
            for (int i = 1; i <= 35; i++) {
                stored.add(storedItem("rug-s" + i, "rug"));
            }
        }));
        cases.add(rejected("SV-R31 40 in the room + 1 stored", l -> {
            replaceWith(l, p0());
            addRugs(l, 34);
            l.putArray("stored").add(storedItem("w-s", "wardrobe"));
        }));
        // 장소 가구는 방에 종류마다 하나
        cases.add(rejected("SV-R32 empty room, one stored wardrobe", l -> {
            items(l).removeAll();
            l.putArray("stored").add(storedItem("wardrobe", "wardrobe"));
        }));
        // 모르는 최상위 키
        cases.add(rejected("SV-R33 storage instead of stored", l -> {
            JsonNode stored = l.remove("stored");
            l.set("storage", stored);
        }));
        return cases.stream();
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("rejectedStoredLayouts")
    void r_badStoredLayoutIs400AndThePreviousLayoutStays(String name, Consumer<ObjectNode> change) throws Exception {
        TestUser user = newUser("r");
        HttpResponse<String> setup = put(user.token(), p1s());
        assertThat(setup.statusCode()).as("setup: save P1S, body %s", setup.body()).isEqualTo(200);
        ObjectNode layout = p0s();
        change.accept(layout);

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("%s: PUT %s -> body %s", name, layout, save.body()).isEqualTo(400);
        assertThat(JSON.readTree(save.body()).path("code").asText()).as("%s: error code, body %s", name, save.body())
                .isEqualTo(INVALID_CODE);
        assertThat(load.statusCode()).as("%s: GET after rejected save, body %s", name, load.body()).isEqualTo(200);
        assertSameStoredLayout(p1s(), JSON.readTree(load.body()), name);
    }

    @Test
    void r0_rejectedFirstSaveCreatesNoRow() throws Exception {
        TestUser user = newUser("r0");
        ObjectNode layout = p0s();
        stored(layout).add(storedItem("desk-2", "desk"));

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("SV-R0 PUT %s -> body %s", layout, save.body()).isEqualTo(400);
        assertThat(JSON.readTree(save.body()).path("code").asText()).as("SV-R0 error code, body %s", save.body())
                .isEqualTo(INVALID_CODE);
        assertThat(load.statusCode()).as("SV-R0 GET, body %s", load.body()).isEqualTo(404);
        assertThat(rowsOf(user.id())).as("SV-R0 lobby_layouts rows of user %s", user.id()).isEqualTo(0);
    }

    // ---------- 배치 값 ----------

    /** P0S: P0에서 옷장을 빼 보관함에 넣은 배치. */
    static ObjectNode p0s() {
        ObjectNode layout = p0();
        removeItem(layout, "wardrobe");
        layout.putArray("stored").add(storedItem("wardrobe", "wardrobe"));
        return layout;
    }

    /** P1S: P1에서 깔개를 빼 보관함에 넣은 배치. */
    static ObjectNode p1s() {
        ObjectNode layout = p1();
        removeItem(layout, "rug");
        layout.putArray("stored").add(storedItem("rug", "rug"));
        return layout;
    }

    static ObjectNode storedItem(String id, String type) {
        ObjectNode node = JSON.createObjectNode();
        node.put("id", id);
        node.put("type", type);
        return node;
    }

    private static ArrayNode stored(ObjectNode layout) {
        return (ArrayNode) layout.get("stored");
    }

    /** 기본 본문 P0S의 보관함 옷장(첫 항목). */
    private static ObjectNode storedWardrobe(ObjectNode layout) {
        ObjectNode first = (ObjectNode) stored(layout).get(0);
        assertThat(first.path("id").asText()).as("setup: first stored item is the wardrobe").isEqualTo("wardrobe");
        return first;
    }

    private static void replaceWith(ObjectNode layout, ObjectNode replacement) {
        layout.removeAll();
        layout.setAll(replacement);
    }

    /** 방에 깔개를 count개 더한다(id rug-1, rug-2, ...). */
    private static void addRugs(ObjectNode layout, int count) {
        for (int i = 1; i <= count; i++) {
            items(layout).add(floorItem("rug-" + i, "rug", 1.0 + (i % 6), 1.0 + (i % 9), i % 4));
        }
    }

    private static Arguments rejected(String name, Consumer<ObjectNode> change) {
        return Arguments.of(name, change);
    }

    /**
     * 시나리오 "같은 배치": 요청에 stored가 있었으면 최상위 키가 정확히 {version, items, stored}, 없었으면 {version, items}.
     * items는 기존 assertSameLayout의 규칙 그대로, stored는 배열이고 개수가 같고 항목마다 키가 정확히 {id, type}이며
     * id 집합과 id별 type이 요청과 같다. 순서는 보지 않는다(결정 04).
     */
    static void assertSameStoredLayout(JsonNode expected, JsonNode actual, String label) {
        if (expected.has("stored")) {
            assertThat(names(actual)).as("%s top-level keys of %s", label, actual)
                    .isEqualTo(Set.of("items", "stored", "version"));
        } else {
            assertThat(names(actual)).as("%s top-level keys of %s", label, actual).isEqualTo(Set.of("items", "version"));
        }

        ObjectNode expectedRoom = ((ObjectNode) expected).deepCopy();
        expectedRoom.remove("stored");
        ObjectNode actualRoom = ((ObjectNode) actual).deepCopy();
        actualRoom.remove("stored");
        assertSameLayout(expectedRoom, actualRoom, label);

        if (!expected.has("stored")) {
            return;
        }
        JsonNode expectedStored = expected.get("stored");
        JsonNode actualStored = actual.get("stored");
        assertThat(actualStored.isArray()).as("%s stored is an array: %s", label, actual).isTrue();
        assertThat(actualStored.size()).as("%s stored count of %s", label, actual).isEqualTo(expectedStored.size());
        Map<String, String> actualTypes = new TreeMap<>();
        for (JsonNode a : actualStored) {
            assertThat(names(a)).as("%s stored item keys: %s", label, a).isEqualTo(Set.of("id", "type"));
            assertThat(a.get("id").isTextual()).as("%s stored id is text: %s", label, a).isTrue();
            assertThat(a.get("type").isTextual()).as("%s stored type is text: %s", label, a).isTrue();
            actualTypes.put(a.get("id").asText(), a.get("type").asText());
        }
        Map<String, String> expectedTypes = new TreeMap<>();
        expectedStored.forEach(e -> expectedTypes.put(e.get("id").asText(), e.get("type").asText()));
        assertThat(actualTypes).as("%s stored id -> type", label).isEqualTo(expectedTypes);
    }

    // ---------- 사용자·요청·DB ----------

    // 작업 086 ② 결정 1: 배치를 저장하기 전에 그 계정이 필요한 가구를 산 것으로 준비한다(put에서). 토큰으로 계정을 찾는다
    private final Map<String, Long> userIdByToken = new LinkedHashMap<>();

    private record TestUser(long id, String email, String password, String token) {
    }

    private TestUser newUser(String tag) throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        String email = "qa-066s-" + tag + "-" + suffix + "@example.com";
        String password = "qa-pass-" + suffix;
        jdbc.update(
                "INSERT INTO users (email, password_hash, display_name, email_verified, verified_at) VALUES (?, ?, ?, 1, NOW())",
                email, passwordEncoder.encode(password), "qa-066s-" + tag + "-" + suffix);
        long userId = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", Long.class, email);
        String token = login(email, password);
        userIdByToken.put(token, userId);
        return new TestUser(userId, email, password, token);
    }

    private String login(String email, String password) throws Exception {
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
        return token;
    }

    private HttpResponse<String> get(String token) throws Exception {
        return client.send(
                HttpRequest.newBuilder(uri(PATH)).header("Authorization", "Bearer " + token).GET().build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> put(String token, JsonNode layout) throws Exception {
        LobbyLayoutPurchasePrep.ownEnoughFor(jdbc, token == null ? null : userIdByToken.get(token), layout);
        return client.send(
                HttpRequest.newBuilder(uri(PATH))
                        .header("Content-Type", "application/json")
                        .header("Authorization", "Bearer " + token)
                        .PUT(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(layout)))
                        .build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private int rowsOf(long userId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM lobby_layouts WHERE user_id = ?", Integer.class, userId);
    }

    private int shapeVersionOf(long userId) {
        return jdbc.queryForObject("SELECT shape_version FROM lobby_layouts WHERE user_id = ?", Integer.class, userId);
    }

    private URI uri(String path) {
        return URI.create(rest.getRootUri() + path);
    }
}
