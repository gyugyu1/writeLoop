package com.writeloop.controller;

import static com.writeloop.controller.LobbyLayoutControllerSpecTest.floorValue;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.item;
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
import java.math.BigInteger;
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
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * [spec] 작업 066 ④ 탁상형(책상 위 소품), 서버 시나리오(05-책상-위-소품/02-qa-scenarios.md SV-TA1~TA10, SV-TR0~TR55,
 * SV-TK1·TK2)를 실제 서버로 확인한다.
 *
 * <ul>
 *   <li>탁상형 종류(`lamp`)는 `id`·`type`·`on` 세 키, `on`은 `parent`·`slot`·`facing` 세 키를 정확히 가진다.
 *       탁상형이 아닌 종류는 `on`을 가질 수 없다.</li>
 *   <li>`parent`는 방(`items`)에 있는 윗면이 있는 가구(지금은 책상)의 id. `slot`은 그 가구의 자리 번호(책상 0~2),
 *       `facing`은 0~3 정수. 같은 받침 가구의 같은 자리에 둘 이상 올리지 않는다.</li>
 *   <li>보관함의 탁상형은 `id`·`type`만. 탁상형도 항목 수 40에 든다. 어기면 400 INVALID_LOBBY_LAYOUT이고 저장하지 않는다.</li>
 * </ul>
 * 시나리오 SV-TK3(기존 spec 테스트를 고치지 않고 돌려 통과)은 새 테스트가 아니라 기존 테스트 실행으로 본다.
 * 테스트마다 새 이메일 사용자를 만들고 자기 데이터만 확인한다.
 */
class LobbyLayoutControllerTabletopSpecTest extends IntegrationTestSupport {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String PATH = "/api/lobby-layout";
    private static final String INVALID_CODE = "INVALID_LOBBY_LAYOUT";

    @Autowired
    private PasswordEncoder passwordEncoder;

    private final HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();

    // ---------- 받기(A) ----------

    @Test
    void ta1_initialLayoutWithLampIsSavedAndLoaded() throws Exception {
        TestUser user = newUser("ta1");
        ObjectNode layout = pl();

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertAccepted("SV-TA1", layout, save, load);
        JsonNode loaded = JSON.readTree(load.body());
        JsonNode lamp = itemOf(loaded, "lamp");
        assertThat(names(lamp)).as("SV-TA1 lamp keys: %s", lamp).isEqualTo(Set.of("id", "type", "on"));
        assertThat(lamp.get("type").asText()).as("SV-TA1 lamp type").isEqualTo("lamp");
        JsonNode on = lamp.get("on");
        assertThat(names(on)).as("SV-TA1 lamp.on keys: %s", on).isEqualTo(Set.of("parent", "slot", "facing"));
        assertThat(on.get("parent").isTextual()).as("SV-TA1 on.parent is text: %s", on).isTrue();
        assertThat(on.get("parent").asText()).as("SV-TA1 on.parent").isEqualTo("desk");
        assertThat(on.get("slot").isIntegralNumber()).as("SV-TA1 on.slot is an integer: %s", on).isTrue();
        assertThat(on.get("slot").asInt()).as("SV-TA1 on.slot").isEqualTo(0);
        assertThat(on.get("facing").isIntegralNumber()).as("SV-TA1 on.facing is an integer: %s", on).isTrue();
        assertThat(on.get("facing").asInt()).as("SV-TA1 on.facing").isEqualTo(0);
        JsonNode desk = itemOf(loaded, "desk");
        assertThat(names(desk)).as("SV-TA1 desk keys: %s", desk).isEqualTo(Set.of("id", "type", "floor"));
        assertThat(desk.get("floor").get("x").asDouble()).as("SV-TA1 desk x").isEqualTo(1.5);
        assertThat(desk.get("floor").get("z").asDouble()).as("SV-TA1 desk z").isEqualTo(5.5);
        assertThat(desk.get("floor").get("facing").asInt()).as("SV-TA1 desk facing").isEqualTo(0);
    }

    @Test
    void ta2_threeLampsOnTheThreeDeskSlots() throws Exception {
        TestUser user = newUser("ta2");
        ObjectNode layout = p0WithThreeLamps();

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertAccepted("SV-TA2", layout, save, load);
        JsonNode loaded = JSON.readTree(load.body());
        assertOn(loaded, "lamp", "desk", 0, 1, "SV-TA2");
        assertOn(loaded, "lamp-2", "desk", 1, 2, "SV-TA2");
        assertOn(loaded, "lamp_3", "desk", 2, 3, "SV-TA2");
    }

    @ParameterizedTest(name = "SV-TA3 facing {0}")
    @ValueSource(ints = {0, 1, 2, 3})
    void ta3_allFourLampFacingsAreAccepted(int facing) throws Exception {
        TestUser user = newUser("ta3");
        ObjectNode layout = pl();
        lampOn(layout, "lamp").put("facing", facing);

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertAccepted("SV-TA3 facing " + facing, layout, save, load);
        assertOn(JSON.readTree(load.body()), "lamp", "desk", 0, facing, "SV-TA3 facing " + facing);
    }

    @Test
    void ta4_lampValuesStayAsSentWhenTheDeskIsMovedAndTurned() throws Exception {
        TestUser user = newUser("ta4");
        ObjectNode layout = p1l();

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertAccepted("SV-TA4", layout, save, load);
        assertOn(JSON.readTree(load.body()), "lamp", "desk", 2, 3, "SV-TA4");
    }

    @Test
    void ta5_lampBeforeTheDeskIsAcceptedAndTheOrderIsKept() throws Exception {
        TestUser user = newUser("ta5");
        ObjectNode layout = p0();
        items(layout).insert(0, lamp("lamp", "desk", 0, 0));

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertAccepted("SV-TA5", layout, save, load);
        assertThat(idsInOrder(JSON.readTree(load.body()))).as("SV-TA5 item order on load")
                .containsExactly("lamp", "desk", "bookcase", "wardrobe", "rug", "board", "window");
    }

    @Test
    void ta6_parentIsTheDeskInstanceIdNotTheTypeName() throws Exception {
        TestUser user = newUser("ta6");
        ObjectNode layout = p0();
        item(layout, "desk").put("id", "desk-a");
        items(layout).add(lamp("lamp", "desk-a", 1, 0));

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertAccepted("SV-TA6", layout, save, load);
        assertOn(JSON.readTree(load.body()), "lamp", "desk-a", 1, 0, "SV-TA6");
    }

    @Test
    void ta7_storedLampHasOnlyIdAndType() throws Exception {
        TestUser user = newUser("ta7");
        ObjectNode layout = p0();
        stored(layout).add(storedItem("lamp", "lamp"));

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertAccepted("SV-TA7", layout, save, load);
        JsonNode stored = JSON.readTree(load.body()).get("stored");
        assertThat(stored.size()).as("SV-TA7 stored count").isEqualTo(1);
        assertThat(names(stored.get(0))).as("SV-TA7 stored lamp keys").isEqualTo(Set.of("id", "type"));
        assertThat(stored.get(0).get("id").asText()).as("SV-TA7 stored id").isEqualTo("lamp");
        assertThat(stored.get(0).get("type").asText()).as("SV-TA7 stored type").isEqualTo("lamp");
    }

    @Test
    void ta8_lampOnTheDeskAndAnotherLampInStorage() throws Exception {
        TestUser user = newUser("ta8");
        ObjectNode layout = pl();
        stored(layout).add(storedItem("lamp-2", "lamp"));

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertAccepted("SV-TA8", layout, save, load);
    }

    @Test
    void ta9_fortyItemsCountingThreeLampsOnTheDesk() throws Exception {
        TestUser user = newUser("ta9");
        ObjectNode layout = p0WithThreeLamps();
        addStored(layout, "w", "wardrobe", 31);
        assertThat(items(layout).size() + stored(layout).size()).as("setup: SV-TA9 total").isEqualTo(40);

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertAccepted("SV-TA9", layout, save, load);
    }

    @Test
    void ta10_fortyItemsWithThirtyFourStoredLamps() throws Exception {
        TestUser user = newUser("ta10");
        ObjectNode layout = p0();
        addStored(layout, "l", "lamp", 34);
        assertThat(items(layout).size() + stored(layout).size()).as("setup: SV-TA10 total").isEqualTo(40);

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertAccepted("SV-TA10", layout, save, load);
    }

    // ---------- 거절(R) ----------

    static Stream<Arguments> rejectedTabletopLayouts() {
        List<Arguments> cases = new ArrayList<>();
        // 탁상형 항목의 모양
        cases.add(rejected("SV-TR1 lamp with floor instead of on", l -> {
            ObjectNode lamp = item(l, "lamp");
            lamp.remove("on");
            lamp.set("floor", floorValue(1.5, 5.5, 0));
        }));
        cases.add(rejected("SV-TR2 lamp with wall instead of on", l -> {
            ObjectNode lamp = item(l, "lamp");
            lamp.remove("on");
            lamp.set("wall", wallValue("back", 6.5));
        }));
        cases.add(rejected("SV-TR3 lamp with on and floor", l -> item(l, "lamp").set("floor", floorValue(1.5, 5.5, 0))));
        cases.add(rejected("SV-TR4 lamp without on", l -> item(l, "lamp").remove("on")));
        cases.add(rejected("SV-TR5 lamp with unknown key height", l -> item(l, "lamp").put("height", 1.3)));
        cases.add(rejected("SV-TR6 on is null", l -> item(l, "lamp").putNull("on")));
        cases.add(rejected("SV-TR7 on is an array", l -> item(l, "lamp").putArray("on").add("desk").add(0).add(0)));
        cases.add(rejected("SV-TR8 on is a string", l -> item(l, "lamp").put("on", "desk")));
        cases.add(rejected("SV-TR9 on without parent", l -> lampOn(l, "lamp").remove("parent")));
        cases.add(rejected("SV-TR10 on without slot", l -> lampOn(l, "lamp").remove("slot")));
        cases.add(rejected("SV-TR11 on without facing", l -> lampOn(l, "lamp").remove("facing")));
        cases.add(rejected("SV-TR12 on with unknown key y", l -> lampOn(l, "lamp").put("y", 1.292)));
        cases.add(rejected("SV-TR13 on with unknown key x", l -> lampOn(l, "lamp").put("x", 0.5)));
        // 탁상형이 아닌 종류의 on
        cases.add(rejected("SV-TR14 wardrobe with on instead of floor", l -> {
            ObjectNode wardrobe = item(l, "wardrobe");
            wardrobe.remove("floor");
            wardrobe.set("on", onValue("desk", 1, 0));
        }));
        cases.add(rejected("SV-TR15 rug with floor and on", l -> item(l, "rug").set("on", onValue("desk", 1, 0))));
        cases.add(rejected("SV-TR16 board with on instead of wall", l -> {
            ObjectNode board = item(l, "board");
            board.remove("wall");
            board.set("on", onValue("desk", 1, 0));
        }));
        cases.add(rejected("SV-TR17 desk with floor and on", l -> item(l, "desk").set("on", onValue("desk", 1, 0))));
        // parent
        cases.add(rejected("SV-TR18 parent desk-9 (not in the room)", l -> lampOn(l, "lamp").put("parent", "desk-9")));
        cases.add(rejected("SV-TR19 parent Desk (case)", l -> lampOn(l, "lamp").put("parent", "Desk")));
        cases.add(rejected("SV-TR20 parent empty", l -> lampOn(l, "lamp").put("parent", "")));
        cases.add(rejected("SV-TR21 parent is a number", l -> lampOn(l, "lamp").put("parent", 1)));
        cases.add(rejected("SV-TR22 parent null", l -> lampOn(l, "lamp").putNull("parent")));
        cases.add(rejected("SV-TR23 parent bookcase (no top)", l -> lampOn(l, "lamp").put("parent", "bookcase")));
        cases.add(rejected("SV-TR24 parent wardrobe", l -> lampOn(l, "lamp").put("parent", "wardrobe")));
        cases.add(rejected("SV-TR25 parent rug", l -> lampOn(l, "lamp").put("parent", "rug")));
        cases.add(rejected("SV-TR26 parent board (wall)", l -> lampOn(l, "lamp").put("parent", "board")));
        cases.add(rejected("SV-TR27 parent window", l -> lampOn(l, "lamp").put("parent", "window")));
        cases.add(rejected("SV-TR28 lamp-2 on the lamp in the room", l -> items(l).add(lamp("lamp-2", "lamp", 0, 0))));
        cases.add(rejected("SV-TR29 lamp on itself", l -> lampOn(l, "lamp").put("parent", "lamp")));
        cases.add(rejected("SV-TR30 parent is a stored lamp", l -> {
            stored(l).add(storedItem("lamp-2", "lamp"));
            lampOn(l, "lamp").put("parent", "lamp-2");
        }));
        cases.add(rejected("SV-TR31 parent is the stored wardrobe", l -> {
            removeItem(l, "wardrobe");
            stored(l).add(storedItem("wardrobe", "wardrobe"));
            lampOn(l, "lamp").put("parent", "wardrobe");
        }));
        cases.add(rejected("SV-TR32 desk id desk-a, parent still desk (type name)", l -> item(l, "desk").put("id", "desk-a")));
        // slot
        cases.add(rejected("SV-TR33 slot 3", l -> lampOn(l, "lamp").put("slot", 3)));
        cases.add(rejected("SV-TR34 slot -1", l -> lampOn(l, "lamp").put("slot", -1)));
        cases.add(rejected("SV-TR35 slot 1.5", l -> lampOn(l, "lamp").put("slot", 1.5)));
        cases.add(rejected("SV-TR36 slot string \"0\"", l -> lampOn(l, "lamp").put("slot", "0")));
        cases.add(rejected("SV-TR37 slot null", l -> lampOn(l, "lamp").putNull("slot")));
        cases.add(rejected("SV-TR38 slot 2147483648", l -> lampOn(l, "lamp").put("slot", new BigInteger("2147483648"))));
        cases.add(rejected("SV-TR39 slot true", l -> lampOn(l, "lamp").put("slot", true)));
        // facing
        cases.add(rejected("SV-TR40 facing 4", l -> lampOn(l, "lamp").put("facing", 4)));
        cases.add(rejected("SV-TR41 facing -1", l -> lampOn(l, "lamp").put("facing", -1)));
        cases.add(rejected("SV-TR42 facing 1.5", l -> lampOn(l, "lamp").put("facing", 1.5)));
        cases.add(rejected("SV-TR43 facing string \"1\"", l -> lampOn(l, "lamp").put("facing", "1")));
        cases.add(rejected("SV-TR44 facing null", l -> lampOn(l, "lamp").putNull("facing")));
        // 같은 자리
        cases.add(rejected("SV-TR45 lamp-2 on slot 0 with another facing", l -> items(l).add(lamp("lamp-2", "desk", 0, 2))));
        cases.add(rejected("SV-TR46 lamp-2 and lamp-3 both on slot 1", l -> {
            items(l).add(lamp("lamp-2", "desk", 1, 0));
            items(l).add(lamp("lamp-3", "desk", 1, 1));
        }));
        // 종류와 id
        cases.add(rejected("SV-TR47 type vase", l -> item(l, "lamp").put("type", "vase")));
        cases.add(rejected("SV-TR48 type Lamp", l -> item(l, "lamp").put("type", "Lamp")));
        cases.add(rejected("SV-TR49 lamp id with a space", l -> item(l, "lamp").put("id", "lamp 2")));
        cases.add(rejected("SV-TR50 lamp id equals the desk id", l -> item(l, "lamp").put("id", "desk")));
        cases.add(rejected("SV-TR51 stored id equals the lamp id in the room", l -> stored(l).add(storedItem("lamp", "lamp"))));
        // 보관함의 탁상형
        cases.add(rejected("SV-TR52 stored lamp with on", l -> {
            ObjectNode stored = storedItem("lamp-2", "lamp");
            stored.set("on", onValue("desk", 1, 0));
            stored(l).add(stored);
        }));
        cases.add(rejected("SV-TR53 stored lamp with floor", l -> {
            ObjectNode stored = storedItem("lamp-2", "lamp");
            stored.set("floor", floorValue(4.5, 4.5, 0));
            stored(l).add(stored);
        }));
        // 항목 수
        cases.add(rejected("SV-TR54 6 + 3 lamps + 32 stored wardrobes = 41", l -> {
            replaceWith(l, p0WithThreeLamps());
            addStored(l, "w", "wardrobe", 32);
        }));
        cases.add(rejected("SV-TR55 6 + 35 stored lamps = 41", l -> {
            replaceWith(l, p0());
            addStored(l, "l", "lamp", 35);
        }));
        return cases.stream();
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("rejectedTabletopLayouts")
    void tr_badTabletopLayoutIs400AndThePreviousLayoutStays(String name, Consumer<ObjectNode> change) throws Exception {
        TestUser user = newUser("tr");
        HttpResponse<String> setup = put(user.token(), p1l());
        assertThat(setup.statusCode()).as("setup: save P1L, body %s", setup.body()).isEqualTo(200);
        ObjectNode layout = pl();
        change.accept(layout);

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("%s: PUT %s -> body %s", name, layout, save.body()).isEqualTo(400);
        assertThat(JSON.readTree(save.body()).path("code").asText()).as("%s: error code, body %s", name, save.body())
                .isEqualTo(INVALID_CODE);
        assertThat(load.statusCode()).as("%s: GET after rejected save, body %s", name, load.body()).isEqualTo(200);
        assertSameLayout(p1l(), JSON.readTree(load.body()), name + " (previous layout)");
    }

    @Test
    void tr0_rejectedTabletopLayoutIsNotSavedForAnAccountWithoutLayout() throws Exception {
        TestUser user = newUser("tr0");
        ObjectNode layout = pl();
        lampOn(layout, "lamp").put("parent", "desk-9");

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("SV-TR0 PUT %s -> body %s", layout, save.body()).isEqualTo(400);
        assertThat(JSON.readTree(save.body()).path("code").asText()).as("SV-TR0 error code, body %s", save.body())
                .isEqualTo(INVALID_CODE);
        assertThat(load.statusCode()).as("SV-TR0 GET, body %s", load.body()).isEqualTo(404);
        assertThat(rowsOf(user.id())).as("SV-TR0 lobby_layouts rows of user %s", user.id()).isEqualTo(0);
    }

    // ---------- 그대로여야 할 동작(K) ----------

    @Test
    void tk1_layoutWithoutLampStaysWithoutLamp() throws Exception {
        TestUser user = newUser("tk1");

        HttpResponse<String> save = put(user.token(), p0());
        HttpResponse<String> load = get(user.token());

        assertAccepted("SV-TK1", p0(), save, load);
        JsonNode loaded = JSON.readTree(load.body());
        assertThat(loaded.get("items").size()).as("SV-TK1 items count").isEqualTo(6);
        assertThat(typesOf(loaded)).as("SV-TK1 no lamp added").doesNotContain("lamp");
    }

    @Test
    void tk2_rowSavedBeforeTabletopsLoadsAsSaved() throws Exception {
        TestUser user = newUser("tk2");
        ObjectNode storedJson = JSON.createObjectNode();
        storedJson.set("items", p0().get("items"));
        jdbc.update(
                "INSERT INTO lobby_layouts (user_id, shape_version, layout_json, created_at, updated_at) "
                        + "VALUES (?, 2, ?, NOW(6), NOW(6))",
                user.id(), JSON.writeValueAsString(storedJson));
        assertThat(rowsOf(user.id())).as("setup: v2 row of user %s", user.id()).isEqualTo(1);

        HttpResponse<String> load = get(user.token());

        assertThat(load.statusCode()).as("SV-TK2 GET, body %s", load.body()).isEqualTo(200);
        JsonNode loaded = JSON.readTree(load.body());
        assertSameLayout(p0(), loaded, "SV-TK2");
        assertThat(loaded.get("items").size()).as("SV-TK2 items count").isEqualTo(6);
        assertThat(typesOf(loaded)).as("SV-TK2 no lamp added").doesNotContain("lamp");
    }

    // ---------- 배치 값 ----------

    /** LAMP(id, parent, slot, facing)(02-qa-scenarios.md "쓰는 배치"). */
    static ObjectNode lamp(String id, String parent, int slot, int facing) {
        ObjectNode node = JSON.createObjectNode();
        node.put("id", id);
        node.put("type", "lamp");
        node.set("on", onValue(parent, slot, facing));
        return node;
    }

    static ObjectNode onValue(String parent, int slot, int facing) {
        ObjectNode node = JSON.createObjectNode();
        node.put("parent", parent);
        node.put("slot", slot);
        node.put("facing", facing);
        return node;
    }

    /** PL: P0 끝에 LAMP("lamp", "desk", 0, 0)(명세 4의 처음 배치). */
    static ObjectNode pl() {
        ObjectNode layout = p0();
        items(layout).add(lamp("lamp", "desk", 0, 0));
        return layout;
    }

    /** P1L: P1 끝에 LAMP("lamp", "desk", 2, 3). */
    static ObjectNode p1l() {
        ObjectNode layout = p1();
        items(layout).add(lamp("lamp", "desk", 2, 3));
        return layout;
    }

    /** SV-TA2의 배치: P0 + 책상 세 자리에 스탠드 셋. */
    static ObjectNode p0WithThreeLamps() {
        ObjectNode layout = p0();
        items(layout).add(lamp("lamp", "desk", 0, 1));
        items(layout).add(lamp("lamp-2", "desk", 1, 2));
        items(layout).add(lamp("lamp_3", "desk", 2, 3));
        return layout;
    }

    static ObjectNode storedItem(String id, String type) {
        ObjectNode node = JSON.createObjectNode();
        node.put("id", id);
        node.put("type", type);
        return node;
    }

    /** 배치의 보관함 목록. 없으면 빈 목록을 만든다. */
    static ArrayNode stored(ObjectNode layout) {
        if (!layout.has("stored")) {
            layout.putArray("stored");
        }
        return (ArrayNode) layout.get("stored");
    }

    /** 보관함에 prefix1~prefixN id로 type 가구 count개를 더한다. */
    static void addStored(ObjectNode layout, String prefix, String type, int count) {
        ArrayNode stored = stored(layout);
        for (int i = 1; i <= count; i++) {
            stored.add(storedItem(prefix + i, type));
        }
    }

    static ObjectNode lampOn(ObjectNode layout, String id) {
        return (ObjectNode) item(layout, id).get("on");
    }

    static void replaceWith(ObjectNode layout, ObjectNode other) {
        layout.removeAll();
        layout.setAll(other);
    }

    private static Arguments rejected(String name, Consumer<ObjectNode> change) {
        return Arguments.of(name, change);
    }

    // ---------- 비교 ----------

    /** A의 기대 결과: PUT 200이고 응답이 보낸 배치와 같으며, GET 200이고 보낸 배치와 같다. */
    private static void assertAccepted(String label, ObjectNode sent, HttpResponse<String> save, HttpResponse<String> load)
            throws Exception {
        assertThat(save.statusCode()).as("%s PUT %s -> body %s", label, sent, save.body()).isEqualTo(200);
        assertSameLayout(sent, JSON.readTree(save.body()), label + " save");
        assertThat(load.statusCode()).as("%s GET, body %s", label, load.body()).isEqualTo(200);
        assertSameLayout(sent, JSON.readTree(load.body()), label + " load");
    }

    /**
     * 02-qa-scenarios.md "같다": 최상위 키, version, 항목 수와 id·type이 같고, 항목마다 키가 정확히 같으며(탁상형은 id·type·on,
     * on은 parent·slot·facing, 탁상형이 아닌 항목에 on 없음) 값이 같다. 정수로 보낸 값은 JSON 정수로 돌아와야 한다.
     * 목록 순서는 SV-TA5만 따로 본다. 보관함은 id로 맞춰 본다.
     */
    static void assertSameLayout(JsonNode expected, JsonNode actual, String label) {
        assertThat(names(actual)).as("%s top-level keys of %s", label, actual).isEqualTo(names(expected));
        assertThat(actual.get("version").isIntegralNumber()).as("%s version is an integer: %s", label, actual).isTrue();
        assertThat(actual.get("version").asInt()).as("%s version", label).isEqualTo(expected.get("version").asInt());
        assertSameById(expected.get("items"), actual.get("items"), label + " items");
        if (expected.has("stored")) {
            assertSameById(expected.get("stored"), actual.get("stored"), label + " stored");
        }
    }

    private static void assertSameById(JsonNode expected, JsonNode actual, String label) {
        assertThat(actual != null && actual.isArray()).as("%s is an array: %s", label, actual).isTrue();
        Map<String, JsonNode> expectedById = byId(expected, label + " (expected)");
        Map<String, JsonNode> actualById = byId(actual, label);
        assertThat(actualById.keySet()).as("%s ids", label).isEqualTo(expectedById.keySet());
        for (Map.Entry<String, JsonNode> e : expectedById.entrySet()) {
            assertSameValue(e.getValue(), actualById.get(e.getKey()), label + " [" + e.getKey() + "]");
        }
    }

    private static Map<String, JsonNode> byId(JsonNode list, String label) {
        Map<String, JsonNode> byId = new TreeMap<>();
        for (JsonNode node : list) {
            assertThat(node.path("id").isTextual()).as("%s id is text: %s", label, node).isTrue();
            assertThat(byId.put(node.get("id").asText(), node)).as("%s duplicate id %s", label, node.get("id")).isNull();
        }
        assertThat(byId.size()).as("%s count of %s", label, list).isEqualTo(list.size());
        return byId;
    }

    private static void assertSameValue(JsonNode expected, JsonNode actual, String path) {
        assertThat(actual).as("%s present", path).isNotNull();
        if (expected.isObject()) {
            assertThat(actual.isObject()).as("%s is an object: %s", path, actual).isTrue();
            assertThat(names(actual)).as("%s keys of %s", path, actual).isEqualTo(names(expected));
            expected.fieldNames().forEachRemaining(key -> assertSameValue(expected.get(key), actual.get(key), path + "." + key));
        } else if (expected.isTextual()) {
            assertThat(actual.isTextual()).as("%s is text: %s", path, actual).isTrue();
            assertThat(actual.asText()).as(path).isEqualTo(expected.asText());
        } else if (expected.isIntegralNumber()) {
            assertThat(actual.isIntegralNumber()).as("%s is an integer: %s", path, actual).isTrue();
            assertThat(actual.longValue()).as(path).isEqualTo(expected.longValue());
        } else if (expected.isNumber()) {
            assertThat(actual.isNumber()).as("%s is a number: %s", path, actual).isTrue();
            assertThat(actual.doubleValue()).as(path).isEqualTo(expected.doubleValue());
        } else {
            assertThat(actual).as(path).isEqualTo(expected);
        }
    }

    private static JsonNode itemOf(JsonNode layout, String id) {
        JsonNode found = null;
        for (JsonNode node : layout.path("items")) {
            if (id.equals(node.path("id").asText())) {
                assertThat(found).as("only one item %s in %s", id, layout).isNull();
                found = node;
            }
        }
        assertThat(found).as("item %s in %s", id, layout).isNotNull();
        return found;
    }

    private static void assertOn(JsonNode layout, String id, String parent, int slot, int facing, String label) {
        JsonNode on = itemOf(layout, id).get("on");
        assertThat(names(on)).as("%s %s.on keys: %s", label, id, on).isEqualTo(Set.of("parent", "slot", "facing"));
        assertThat(on.get("parent").asText()).as("%s %s.on.parent", label, id).isEqualTo(parent);
        assertThat(on.get("slot").isIntegralNumber()).as("%s %s.on.slot is an integer: %s", label, id, on).isTrue();
        assertThat(on.get("slot").asInt()).as("%s %s.on.slot", label, id).isEqualTo(slot);
        assertThat(on.get("facing").isIntegralNumber()).as("%s %s.on.facing is an integer: %s", label, id, on).isTrue();
        assertThat(on.get("facing").asInt()).as("%s %s.on.facing", label, id).isEqualTo(facing);
    }

    private static List<String> idsInOrder(JsonNode layout) {
        List<String> ids = new ArrayList<>();
        layout.path("items").forEach(node -> ids.add(node.path("id").asText()));
        return ids;
    }

    private static List<String> typesOf(JsonNode layout) {
        List<String> types = new ArrayList<>();
        layout.path("items").forEach(node -> types.add(node.path("type").asText()));
        return types;
    }

    // ---------- 사용자·요청 ----------

    private record TestUser(long id, String email, String password, String token) {
    }

    private TestUser newUser(String tag) throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        String email = "qa-066t-" + tag + "-" + suffix + "@example.com";
        String password = "qa-pass-" + suffix;
        jdbc.update(
                "INSERT INTO users (email, password_hash, display_name, email_verified, verified_at) VALUES (?, ?, ?, 1, NOW())",
                email, passwordEncoder.encode(password), "qa-066t-" + tag + "-" + suffix);
        long userId = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", Long.class, email);
        return new TestUser(userId, email, password, login(email, password));
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
        HttpRequest.Builder request = HttpRequest.newBuilder(uri(PATH)).GET();
        if (token != null) {
            request.header("Authorization", "Bearer " + token);
        }
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> put(String token, JsonNode layout) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(uri(PATH))
                .header("Content-Type", "application/json")
                .PUT(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(layout)));
        if (token != null) {
            request.header("Authorization", "Bearer " + token);
        }
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private int rowsOf(long userId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM lobby_layouts WHERE user_id = ?", Integer.class, userId);
    }

    private URI uri(String path) {
        return URI.create(rest.getRootUri() + path);
    }
}
