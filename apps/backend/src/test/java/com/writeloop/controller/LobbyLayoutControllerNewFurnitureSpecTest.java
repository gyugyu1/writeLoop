package com.writeloop.controller;

import static com.writeloop.controller.LobbyLayoutControllerSpecTest.floorItem;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.floorPiece;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.floorValue;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.item;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.items;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.names;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.removeItem;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.wallItem;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.wallPiece;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.wallValue;
import static com.writeloop.controller.LobbyLayoutControllerTabletopSpecTest.lamp;
import static com.writeloop.controller.LobbyLayoutControllerTabletopSpecTest.onValue;
import static com.writeloop.controller.LobbyLayoutControllerTabletopSpecTest.p1l;
import static com.writeloop.controller.LobbyLayoutControllerTabletopSpecTest.pl;
import static com.writeloop.controller.LobbyLayoutControllerTabletopSpecTest.replaceWith;
import static com.writeloop.controller.LobbyLayoutControllerTabletopSpecTest.stored;
import static com.writeloop.controller.LobbyLayoutControllerTabletopSpecTest.storedItem;
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
 * [spec] 작업 066 ⑤ 새 가구, 서버 시나리오(06-새-가구/02-qa-scenarios.md SN-A1~A15, SN-R1~R47, SN-K2·K3)와
 * 결정 04-2(보관함 순서를 저장·불러오기에서 그대로 지킨다, SN-D2-1·D2-2)를 실제 서버로 확인한다.
 *
 * <ul>
 *   <li>새 일곱 종류: 바닥 `bed`·`nightstand`(윗면 자리 1개)·`floorLamp`·`plant`, 탁상 `smallPlant`·`books`, 벽 `frame`.
 *       모두 치울 수 있고 장소가 딸리지 않는다.</li>
 *   <li>탁상형은 받침 가구(책상 자리 0~2, 협탁 자리 0)의 있는 자리에 하나씩. 어기면 400 INVALID_LOBBY_LAYOUT이고 저장하지 않는다.</li>
 * </ul>
 * SN-K1(기존 spec 테스트를 고치지 않고 돌려 통과)은 새 테스트가 아니라 기존 테스트 실행으로 본다.
 * 테스트마다 새 이메일 사용자를 만들고 자기 데이터만 확인한다.
 */
class LobbyLayoutControllerNewFurnitureSpecTest extends IntegrationTestSupport {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String PATH = "/api/lobby-layout";
    private static final String INVALID_CODE = "INVALID_LOBBY_LAYOUT";
    private static final List<String> NEW_TYPES =
            List.of("bed", "nightstand", "floorLamp", "plant", "smallPlant", "books", "frame");

    @Autowired
    private PasswordEncoder passwordEncoder;

    private final HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();

    // ---------- 받기(A) ----------

    @Test
    void a1_allSevenNewKindsAreSavedAndLoaded() throws Exception {
        TestUser user = newUser("a1");
        ObjectNode layout = pn();

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertAccepted("SN-A1", layout, save, load);
        JsonNode loaded = JSON.readTree(load.body());
        assertThat(loaded.get("items").size()).as("SN-A1 items count").isEqualTo(14);
        for (String id : List.of("bed-1", "nightstand-1", "floorLamp-1", "plant-1")) {
            assertThat(names(itemOf(loaded, id))).as("SN-A1 %s keys", id).isEqualTo(Set.of("id", "type", "floor"));
        }
        for (String id : List.of("smallPlant-1", "books-1")) {
            assertThat(names(itemOf(loaded, id))).as("SN-A1 %s keys", id).isEqualTo(Set.of("id", "type", "on"));
        }
        assertThat(names(itemOf(loaded, "frame-1"))).as("SN-A1 frame-1 keys").isEqualTo(Set.of("id", "type", "wall"));
        assertFloor(loaded, "bed-1", "bed", 6.0, 9.5, 0, "SN-A1");
        assertFloor(loaded, "nightstand-1", "nightstand", 4.5, 10.5, 0, "SN-A1");
        assertFloor(loaded, "floorLamp-1", "floorLamp", 7.5, 0.5, 0, "SN-A1");
        assertFloor(loaded, "plant-1", "plant", 0.5, 10.5, 0, "SN-A1");
        assertOn(loaded, "smallPlant-1", "smallPlant", "nightstand-1", 0, 0, "SN-A1");
        assertOn(loaded, "books-1", "books", "desk", 1, 2, "SN-A1");
        JsonNode frame = itemOf(loaded, "frame-1");
        assertThat(frame.get("type").asText()).as("SN-A1 frame-1 type").isEqualTo("frame");
        assertThat(frame.get("wall").get("wall").asText()).as("SN-A1 frame-1 wall").isEqualTo("left");
        assertThat(frame.get("wall").get("along").asDouble()).as("SN-A1 frame-1 along").isEqualTo(8.5);
    }

    static Stream<Arguments> singleNewKinds() {
        return Stream.of(
                Arguments.of("bed", floorItem("bed-1", "bed", 4.5, 2.5, 0)),
                Arguments.of("nightstand", floorItem("nightstand-1", "nightstand", 4.5, 2.5, 0)),
                Arguments.of("floorLamp", floorItem("floorLamp-1", "floorLamp", 4.5, 2.5, 0)),
                Arguments.of("plant", floorItem("plant-1", "plant", 4.5, 2.5, 0)),
                Arguments.of("smallPlant", top("smallPlant-1", "smallPlant", "desk", 1, 0)),
                Arguments.of("books", top("books-1", "books", "desk", 1, 0)),
                Arguments.of("frame", wallItem("frame-1", "frame", "back", 6.5)));
    }

    @ParameterizedTest(name = "SN-A2 {0}")
    @MethodSource("singleNewKinds")
    void a2_eachNewKindAloneIsAccepted(String type, ObjectNode added) throws Exception {
        TestUser user = newUser("a2");
        ObjectNode layout = pl();
        items(layout).add(added);

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertAccepted("SN-A2 " + type, layout, save, load);
        assertThat(JSON.readTree(load.body()).get("items").size()).as("SN-A2 %s items count", type).isEqualTo(8);
    }

    static Stream<Arguments> floorKindsAndFacings() {
        List<Arguments> cases = new ArrayList<>();
        for (String type : List.of("bed", "nightstand", "floorLamp", "plant")) {
            for (int facing = 0; facing <= 3; facing++) {
                cases.add(Arguments.of(type, facing));
            }
        }
        return cases.stream();
    }

    @ParameterizedTest(name = "SN-A3 {0} facing {1}")
    @MethodSource("floorKindsAndFacings")
    void a3_allFourFacingsOfTheNewFloorKinds(String type, int facing) throws Exception {
        TestUser user = newUser("a3");
        ObjectNode layout = pl();
        items(layout).add(floorItem(type + "-1", type, 4.5, 2.5, facing));

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        String label = "SN-A3 " + type + " facing " + facing;
        assertAccepted(label, layout, save, load);
        assertFloor(JSON.readTree(load.body()), type + "-1", type, 4.5, 2.5, facing, label);
    }

    static Stream<Arguments> frameWallBoundaries() {
        return Stream.of(
                Arguments.of("back", 0.0),
                Arguments.of("back", 8.0),
                Arguments.of("left", 0.0),
                Arguments.of("left", 11.0),
                Arguments.of("right", 0.0),
                Arguments.of("right", 11.0));
    }

    @ParameterizedTest(name = "SN-A4 frame {0} {1}")
    @MethodSource("frameWallBoundaries")
    void a4_frameOnEachWallAtTheBoundaries(String wall, double along) throws Exception {
        TestUser user = newUser("a4");
        ObjectNode layout = pl();
        items(layout).add(wallItem("frame-1", "frame", wall, along));

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        String label = "SN-A4 frame " + wall + " " + along;
        assertAccepted(label, layout, save, load);
        JsonNode frame = itemOf(JSON.readTree(load.body()), "frame-1");
        assertThat(frame.get("wall").get("wall").asText()).as("%s wall", label).isEqualTo(wall);
        assertThat(frame.get("wall").get("along").asDouble()).as("%s along", label).isEqualTo(along);
    }

    static Stream<Arguments> tabletopKindsAndFacings() {
        List<Arguments> cases = new ArrayList<>();
        for (String type : List.of("lamp", "smallPlant", "books")) {
            for (int facing = 0; facing <= 3; facing++) {
                cases.add(Arguments.of(type, facing));
            }
        }
        return cases.stream();
    }

    @ParameterizedTest(name = "SN-A5 {0} on the nightstand facing {1}")
    @MethodSource("tabletopKindsAndFacings")
    void a5_eachTabletopKindOnTheNightstandSlot(String type, int facing) throws Exception {
        TestUser user = newUser("a5");
        ObjectNode layout = pl();
        items(layout).add(floorItem("nightstand-1", "nightstand", 4.5, 2.5, 0));
        items(layout).add(top(type + "-9", type, "nightstand-1", 0, facing));

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        String label = "SN-A5 " + type + " facing " + facing;
        assertAccepted(label, layout, save, load);
        assertOn(JSON.readTree(load.body()), type + "-9", type, "nightstand-1", 0, facing, label);
    }

    @Test
    void a6_everySlotOfTheDeskAndTwoNightstandsIsTaken() throws Exception {
        TestUser user = newUser("a6");
        ObjectNode layout = pl();
        items(layout).add(floorItem("nightstand-1", "nightstand", 0.5, 9.5, 0));
        items(layout).add(floorItem("nightstand-2", "nightstand", 7.5, 9.5, 0));
        items(layout).add(top("smallPlant-1", "smallPlant", "desk", 1, 0));
        items(layout).add(top("books-1", "books", "desk", 2, 1));
        items(layout).add(top("books-2", "books", "nightstand-1", 0, 2));
        items(layout).add(top("lamp-2", "lamp", "nightstand-2", 0, 3));
        assertThat(items(layout).size()).as("setup: SN-A6 items").isEqualTo(13);

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertAccepted("SN-A6", layout, save, load);
        JsonNode loaded = JSON.readTree(load.body());
        assertOn(loaded, "lamp", "lamp", "desk", 0, 0, "SN-A6");
        assertOn(loaded, "smallPlant-1", "smallPlant", "desk", 1, 0, "SN-A6");
        assertOn(loaded, "books-1", "books", "desk", 2, 1, "SN-A6");
        assertOn(loaded, "books-2", "books", "nightstand-1", 0, 2, "SN-A6");
        assertOn(loaded, "lamp-2", "lamp", "nightstand-2", 0, 3, "SN-A6");
    }

    @Test
    void a7_tabletopBeforeItsNightstandIsAcceptedAndTheOrderIsKept() throws Exception {
        TestUser user = newUser("a7");
        ObjectNode layout = pn();
        ObjectNode smallPlant = item(layout, "smallPlant-1");
        removeItem(layout, "smallPlant-1");
        items(layout).insert(0, smallPlant);
        List<String> sentOrder = idsInOrder(layout);
        assertThat(sentOrder.get(0)).as("setup: SN-A7 first item").isEqualTo("smallPlant-1");

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertAccepted("SN-A7", layout, save, load);
        assertThat(idsInOrder(JSON.readTree(load.body()))).as("SN-A7 item order on load")
                .containsExactly("smallPlant-1", "desk", "bookcase", "wardrobe", "rug", "board", "window", "lamp",
                        "bed-1", "nightstand-1", "floorLamp-1", "plant-1", "books-1", "frame-1");
    }

    @Test
    void a8_movedAndTurnedNightstandKeepsTheSmallPlantValues() throws Exception {
        TestUser user = newUser("a8");
        ObjectNode layout = pn();
        item(layout, "nightstand-1").set("floor", floorValue(2.5, 0.5, 3));
        item(layout, "smallPlant-1").set("on", onValue("nightstand-1", 0, 3));

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertAccepted("SN-A8", layout, save, load);
        JsonNode loaded = JSON.readTree(load.body());
        assertFloor(loaded, "nightstand-1", "nightstand", 2.5, 0.5, 3, "SN-A8");
        assertOn(loaded, "smallPlant-1", "smallPlant", "nightstand-1", 0, 3, "SN-A8");
    }

    @Test
    void a9_allSevenNewKindsCanBeStored() throws Exception {
        TestUser user = newUser("a9");
        ObjectNode layout = pl();
        for (String type : NEW_TYPES) {
            stored(layout).add(storedItem(type + "-1", type));
        }

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertAccepted("SN-A9", layout, save, load);
        JsonNode stored = JSON.readTree(load.body()).get("stored");
        assertThat(stored.size()).as("SN-A9 stored count").isEqualTo(7);
        Map<String, String> typeById = new LinkedHashMap<>();
        for (JsonNode node : stored) {
            assertThat(names(node)).as("SN-A9 stored keys of %s", node).isEqualTo(Set.of("id", "type"));
            typeById.put(node.get("id").asText(), node.get("type").asText());
        }
        Map<String, String> expected = new LinkedHashMap<>();
        NEW_TYPES.forEach(type -> expected.put(type + "-1", type));
        assertThat(typeById).as("SN-A9 stored id -> type").isEqualTo(expected);
    }

    @Test
    void a10_nightstandAndItsSmallPlantPutAwayTogether() throws Exception {
        TestUser user = newUser("a10");
        ObjectNode layout = pnWithNightstandAndSmallPlantStored();

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertAccepted("SN-A10", layout, save, load);
        JsonNode loaded = JSON.readTree(load.body());
        assertThat(idsInOrder(loaded)).as("SN-A10 room has neither").doesNotContain("nightstand-1", "smallPlant-1");
        assertThat(loaded.get("items").size()).as("SN-A10 items count").isEqualTo(12);
    }

    @Test
    void a11_smallPlantStoredWhileTheNightstandStaysEmptyInTheRoom() throws Exception {
        TestUser user = newUser("a11");
        ObjectNode layout = pn();
        removeItem(layout, "smallPlant-1");
        stored(layout).add(storedItem("smallPlant-1", "smallPlant"));

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertAccepted("SN-A11", layout, save, load);
        JsonNode loaded = JSON.readTree(load.body());
        assertFloor(loaded, "nightstand-1", "nightstand", 4.5, 10.5, 0, "SN-A11");
        assertThat(loaded.get("stored").size()).as("SN-A11 stored count").isEqualTo(1);
    }

    @Test
    void a12_severalOfTheSameNewKind() throws Exception {
        TestUser user = newUser("a12");
        ObjectNode layout = pn();
        items(layout).add(floorItem("bed-2", "bed", 3.0, 9.5, 0));
        items(layout).add(floorItem("plant-2", "plant", 7.5, 6.5, 0));
        items(layout).add(floorItem("plant-3", "plant", 7.5, 7.5, 0));
        items(layout).add(wallItem("frame-2", "frame", "back", 6.5));
        items(layout).add(wallItem("frame-3", "frame", "right", 5.0));
        items(layout).add(floorItem("floorLamp-2", "floorLamp", 3.5, 0.5, 0));

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertAccepted("SN-A12", layout, save, load);
        assertThat(JSON.readTree(load.body()).get("items").size()).as("SN-A12 items count").isEqualTo(20);
    }

    @Test
    void a13_idsWithLargerNumbers() throws Exception {
        TestUser user = newUser("a13");
        ObjectNode layout = pn();
        item(layout, "bed-1").put("id", "bed-12");
        item(layout, "nightstand-1").put("id", "nightstand-40");
        item(layout, "floorLamp-1").put("id", "floorLamp-7");
        item(layout, "plant-1").put("id", "plant-39");
        ObjectNode smallPlant = item(layout, "smallPlant-1");
        smallPlant.put("id", "smallPlant-10");
        smallPlant.set("on", onValue("nightstand-40", 0, 0));
        item(layout, "books-1").put("id", "books-3");
        item(layout, "frame-1").put("id", "frame-25");

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertAccepted("SN-A13", layout, save, load);
        assertOn(JSON.readTree(load.body()), "smallPlant-10", "smallPlant", "nightstand-40", 0, 0, "SN-A13");
    }

    @Test
    void a14_fortyItemsWithTwentySixStoredNewKinds() throws Exception {
        TestUser user = newUser("a14");
        ObjectNode layout = pn();
        addStoredNewKinds(layout, 26);
        assertThat(items(layout).size() + stored(layout).size()).as("setup: SN-A14 total").isEqualTo(40);

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertAccepted("SN-A14", layout, save, load);
        assertThat(JSON.readTree(load.body()).get("stored").size()).as("SN-A14 stored count").isEqualTo(26);
    }

    @Test
    void a15_fortyItemsWithThirtyThreePlantsInTheRoom() throws Exception {
        TestUser user = newUser("a15");
        ObjectNode layout = pl();
        addPlantsInTheRoom(layout, 33);
        assertThat(items(layout).size()).as("setup: SN-A15 total").isEqualTo(40);

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertAccepted("SN-A15", layout, save, load);
        assertThat(JSON.readTree(load.body()).get("items").size()).as("SN-A15 items count").isEqualTo(40);
    }

    // ---------- 결정 04-2: 보관함 순서를 그대로 지킨다 ----------

    @Test
    void d2_1_storedOrderNightstandThenItsSmallPlantIsKept() throws Exception {
        TestUser user = newUser("d21");
        ObjectNode layout = pnWithNightstandAndSmallPlantStored();

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertAccepted("SN-D2-1", layout, save, load);
        assertThat(storedIdsInOrder(JSON.readTree(save.body()))).as("SN-D2-1 stored order in the PUT response")
                .containsExactly("nightstand-1", "smallPlant-1");
        assertThat(storedIdsInOrder(JSON.readTree(load.body()))).as("SN-D2-1 stored order on load")
                .containsExactly("nightstand-1", "smallPlant-1");
    }

    @Test
    void d2_2_storedOrderThatIsNotSortedIsKept() throws Exception {
        TestUser user = newUser("d22");
        ObjectNode layout = pl();
        List<String[]> sent = List.of(
                new String[] {"plant-9", "plant"},
                new String[] {"bed-1", "bed"},
                new String[] {"wardrobe-2", "wardrobe"},
                new String[] {"smallPlant-1", "smallPlant"},
                new String[] {"nightstand-1", "nightstand"},
                new String[] {"frame-1", "frame"},
                new String[] {"books-1", "books"},
                new String[] {"floorLamp-1", "floorLamp"});
        sent.forEach(pair -> stored(layout).add(storedItem(pair[0], pair[1])));

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertAccepted("SN-D2-2", layout, save, load);
        String[] expected = {"plant-9", "bed-1", "wardrobe-2", "smallPlant-1", "nightstand-1", "frame-1", "books-1",
                "floorLamp-1"};
        assertThat(storedIdsInOrder(JSON.readTree(save.body()))).as("SN-D2-2 stored order in the PUT response")
                .containsExactly(expected);
        assertThat(storedIdsInOrder(JSON.readTree(load.body()))).as("SN-D2-2 stored order on load")
                .containsExactly(expected);
    }

    // ---------- 거절(R) ----------

    static Stream<Arguments> rejectedNewFurnitureLayouts() {
        List<Arguments> cases = new ArrayList<>();
        // 종류에 맞는 자리
        cases.add(rejected("SN-R1 bed with wall instead of floor", l -> {
            item(l, "bed-1").remove("floor");
            item(l, "bed-1").set("wall", wallValue("back", 6.5));
        }));
        cases.add(rejected("SN-R2 bed with on instead of floor", l -> {
            item(l, "bed-1").remove("floor");
            item(l, "bed-1").set("on", onValue("desk", 1, 0));
        }));
        cases.add(rejected("SN-R3 nightstand with floor and on", l -> item(l, "nightstand-1").set("on", onValue("desk", 2, 0))));
        cases.add(rejected("SN-R4 floorLamp without floor", l -> item(l, "floorLamp-1").remove("floor")));
        cases.add(rejected("SN-R5 plant with unknown key height", l -> item(l, "plant-1").put("height", 1.83)));
        cases.add(rejected("SN-R6 smallPlant with floor instead of on", l -> {
            item(l, "smallPlant-1").remove("on");
            item(l, "smallPlant-1").set("floor", floorValue(4.5, 4.5, 0));
        }));
        cases.add(rejected("SN-R7 books with wall instead of on", l -> {
            item(l, "books-1").remove("on");
            item(l, "books-1").set("wall", wallValue("back", 6.5));
        }));
        cases.add(rejected("SN-R8 smallPlant with on and floor", l -> item(l, "smallPlant-1").set("floor", floorValue(4.5, 10.5, 0))));
        cases.add(rejected("SN-R9 frame with floor instead of wall", l -> {
            item(l, "frame-1").remove("wall");
            item(l, "frame-1").set("floor", floorValue(4.5, 4.5, 0));
        }));
        cases.add(rejected("SN-R10 frame with on instead of wall", l -> {
            item(l, "frame-1").remove("wall");
            item(l, "frame-1").set("on", onValue("desk", 2, 0));
        }));
        cases.add(rejected("SN-R11 frame without wall", l -> item(l, "frame-1").remove("wall")));
        // 값의 범위
        cases.add(rejected("SN-R12 bed x -0.5", l -> floorPiece(l, "bed-1").put("x", -0.5)));
        cases.add(rejected("SN-R13 nightstand z 11.5", l -> floorPiece(l, "nightstand-1").put("z", 11.5)));
        cases.add(rejected("SN-R14 floorLamp facing 4", l -> floorPiece(l, "floorLamp-1").put("facing", 4)));
        cases.add(rejected("SN-R15 plant facing 1.5", l -> floorPiece(l, "plant-1").put("facing", 1.5)));
        cases.add(rejected("SN-R16 frame back along 8.5", l -> wallPiece(l, "frame-1").put("wall", "back").put("along", 8.5)));
        cases.add(rejected("SN-R17 frame left along 11.5", l -> wallPiece(l, "frame-1").put("along", 11.5)));
        cases.add(rejected("SN-R18 frame wall front", l -> wallPiece(l, "frame-1").put("wall", "front")));
        cases.add(rejected("SN-R19 books on.facing 4", l -> onOf(l, "books-1").put("facing", 4)));
        cases.add(rejected("SN-R20 smallPlant on.slot string \"0\"", l -> onOf(l, "smallPlant-1").put("slot", "0")));
        // 협탁 자리 1개, 한 자리에 하나
        cases.add(rejected("SN-R21 smallPlant on nightstand slot 1", l -> onOf(l, "smallPlant-1").put("slot", 1)));
        cases.add(rejected("SN-R22 lamp-2 on nightstand slot 1", l -> items(l).add(lamp("lamp-2", "nightstand-1", 1, 0))));
        cases.add(rejected("SN-R23 books-2 on nightstand slot 0 (taken)", l -> items(l).add(top("books-2", "books", "nightstand-1", 0, 1))));
        cases.add(rejected("SN-R24 smallPlant-2 on desk slot 1 (books-1)", l -> items(l).add(top("smallPlant-2", "smallPlant", "desk", 1, 0))));
        cases.add(rejected("SN-R25 books-2 on desk slot 0 (lamp)", l -> items(l).add(top("books-2", "books", "desk", 0, 0))));
        cases.add(rejected("SN-R26 books on desk slot 3", l -> onOf(l, "books-1").put("slot", 3)));
        // 받침 가구는 방의 책상·협탁
        cases.add(rejected("SN-R27 smallPlant on the bed", l -> onOf(l, "smallPlant-1").put("parent", "bed-1")));
        cases.add(rejected("SN-R28 smallPlant on the floorLamp", l -> onOf(l, "smallPlant-1").put("parent", "floorLamp-1")));
        cases.add(rejected("SN-R29 smallPlant on the plant", l -> onOf(l, "smallPlant-1").put("parent", "plant-1")));
        cases.add(rejected("SN-R30 smallPlant on the frame", l -> onOf(l, "smallPlant-1").put("parent", "frame-1")));
        cases.add(rejected("SN-R31 smallPlant-2 on books-1", l -> items(l).add(top("smallPlant-2", "smallPlant", "books-1", 0, 0))));
        cases.add(rejected("SN-R32 nightstand stored while smallPlant stays on it", l -> {
            removeItem(l, "nightstand-1");
            stored(l).add(storedItem("nightstand-1", "nightstand"));
        }));
        cases.add(rejected("SN-R33 smallPlant on nightstand-9 (missing)", l -> onOf(l, "smallPlant-1").put("parent", "nightstand-9")));
        // 아는 종류
        cases.add(rejected("SN-R34 type Bed", l -> item(l, "bed-1").put("type", "Bed")));
        cases.add(rejected("SN-R35 type nightStand", l -> item(l, "nightstand-1").put("type", "nightStand")));
        cases.add(rejected("SN-R36 type floor_lamp", l -> item(l, "floorLamp-1").put("type", "floor_lamp")));
        cases.add(rejected("SN-R37 type bedSingle", l -> item(l, "bed-1").put("type", "bedSingle")));
        cases.add(rejected("SN-R38 type pottedPlant", l -> item(l, "plant-1").put("type", "pottedPlant")));
        cases.add(rejected("SN-R39 type Frame", l -> item(l, "frame-1").put("type", "Frame")));
        // 보관함 모양
        cases.add(rejected("SN-R40 stored smallPlant with on", l -> {
            ObjectNode node = storedItem("smallPlant-2", "smallPlant");
            node.set("on", onValue("desk", 2, 0));
            stored(l).add(node);
        }));
        cases.add(rejected("SN-R41 stored frame with wall", l -> {
            ObjectNode node = storedItem("frame-2", "frame");
            node.set("wall", wallValue("back", 6.5));
            stored(l).add(node);
        }));
        cases.add(rejected("SN-R42 stored bed with floor", l -> {
            ObjectNode node = storedItem("bed-2", "bed");
            node.set("floor", floorValue(4.5, 4.5, 0));
            stored(l).add(node);
        }));
        // id
        cases.add(rejected("SN-R43 stored bed-1 while bed-1 is in the room", l -> stored(l).add(storedItem("bed-1", "bed"))));
        cases.add(rejected("SN-R44 second plant-1 in the room", l -> items(l).add(floorItem("plant-1", "plant", 3.5, 0.5, 0))));
        // 항목 수
        cases.add(rejected("SN-R45 14 + 27 stored = 41", l -> addStoredNewKinds(l, 27)));
        cases.add(rejected("SN-R46 PL 7 + 34 plants in the room = 41", l -> {
            replaceWith(l, pl());
            addPlantsInTheRoom(l, 34);
        }));
        // 장소 가구 규칙 그대로
        cases.add(rejected("SN-R47 bookcase missing", l -> removeItem(l, "bookcase")));
        return cases.stream();
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("rejectedNewFurnitureLayouts")
    void r_badNewFurnitureLayoutIs400AndThePreviousLayoutStays(String name, Consumer<ObjectNode> change) throws Exception {
        TestUser user = newUser("r");
        HttpResponse<String> setup = put(user.token(), p1l());
        assertThat(setup.statusCode()).as("setup: save P1L, body %s", setup.body()).isEqualTo(200);
        ObjectNode layout = pn();
        change.accept(layout);

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("%s: PUT %s -> body %s", name, layout, save.body()).isEqualTo(400);
        assertThat(JSON.readTree(save.body()).path("code").asText()).as("%s: error code, body %s", name, save.body())
                .isEqualTo(INVALID_CODE);
        assertThat(load.statusCode()).as("%s: GET after rejected save, body %s", name, load.body()).isEqualTo(200);
        LobbyLayoutControllerTabletopSpecTest.assertSameLayout(p1l(), JSON.readTree(load.body()), name + " (previous layout)");
    }

    // ---------- 그대로(K) ----------

    @Test
    void k2_initialLayoutStaysTheSame() throws Exception {
        TestUser user = newUser("k2");
        ObjectNode layout = pl();

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertAccepted("SN-K2", layout, save, load);
        JsonNode loaded = JSON.readTree(load.body());
        assertThat(loaded.get("items").size()).as("SN-K2 items count").isEqualTo(7);
        assertThat(typesOf(loaded)).as("SN-K2 no new kinds").doesNotContainAnyElementsOf(NEW_TYPES);
    }

    @Test
    void k3_rowSavedBeforeTheNewKindsLoadsAsSaved() throws Exception {
        TestUser user = newUser("k3");
        ObjectNode storedJson = JSON.createObjectNode();
        storedJson.set("items", pl().get("items"));
        jdbc.update(
                "INSERT INTO lobby_layouts (user_id, shape_version, layout_json, created_at, updated_at) "
                        + "VALUES (?, 2, ?, NOW(6), NOW(6))",
                user.id(), JSON.writeValueAsString(storedJson));
        assertThat(rowsOf(user.id())).as("setup: v2 row of user %s", user.id()).isEqualTo(1);

        HttpResponse<String> load = get(user.token());

        assertThat(load.statusCode()).as("SN-K3 GET, body %s", load.body()).isEqualTo(200);
        JsonNode loaded = JSON.readTree(load.body());
        LobbyLayoutControllerTabletopSpecTest.assertSameLayout(pl(), loaded, "SN-K3");
        assertThat(loaded.has("stored")).as("SN-K3 no stored key: %s", loaded).isFalse();
        assertThat(loaded.get("items").size()).as("SN-K3 items count").isEqualTo(7);
        assertThat(typesOf(loaded)).as("SN-K3 no new kinds").doesNotContainAnyElementsOf(NEW_TYPES);
    }

    // ---------- 배치 값 ----------

    /** TOP(id, type, parent, slot, facing)(02-qa-scenarios.md "쓰는 배치"). */
    static ObjectNode top(String id, String type, String parent, int slot, int facing) {
        ObjectNode node = JSON.createObjectNode();
        node.put("id", id);
        node.put("type", type);
        node.set("on", onValue(parent, slot, facing));
        return node;
    }

    /** PN: PL 끝에 새 일곱 종류 하나씩(14개). */
    static ObjectNode pn() {
        ObjectNode layout = pl();
        ArrayNode items = items(layout);
        items.add(floorItem("bed-1", "bed", 6.0, 9.5, 0));
        items.add(floorItem("nightstand-1", "nightstand", 4.5, 10.5, 0));
        items.add(floorItem("floorLamp-1", "floorLamp", 7.5, 0.5, 0));
        items.add(floorItem("plant-1", "plant", 0.5, 10.5, 0));
        items.add(top("smallPlant-1", "smallPlant", "nightstand-1", 0, 0));
        items.add(top("books-1", "books", "desk", 1, 2));
        items.add(wallItem("frame-1", "frame", "left", 8.5));
        return layout;
    }

    /** SN-A10·D2-1: PN에서 협탁과 그 위 작은 화분을 보관함으로(협탁, 소품 순서). */
    static ObjectNode pnWithNightstandAndSmallPlantStored() {
        ObjectNode layout = pn();
        removeItem(layout, "nightstand-1");
        removeItem(layout, "smallPlant-1");
        stored(layout).add(storedItem("nightstand-1", "nightstand"));
        stored(layout).add(storedItem("smallPlant-1", "smallPlant"));
        return layout;
    }

    /** 보관함에 s-1~s-count를 새 일곱 종류를 차례로 돌려 가며 더한다. */
    static void addStoredNewKinds(ObjectNode layout, int count) {
        for (int i = 1; i <= count; i++) {
            stored(layout).add(storedItem("s-" + i, NEW_TYPES.get((i - 1) % NEW_TYPES.size())));
        }
    }

    /**
     * 방에 plant-1~plant-count 화분을 서로 다른 칸에 더한다. 칸은 z 0~4, 9~10 줄에서 책장(0,2)·옷장(7,3) 칸을 뺀 곳이다
     * (처음 배치의 책상·깔개가 있는 z 5~8 줄은 쓰지 않는다).
     */
    static void addPlantsInTheRoom(ObjectNode layout, int count) {
        int added = 0;
        for (int z : new int[] {0, 1, 2, 3, 4, 9, 10}) {
            for (int x = 0; x < 8 && added < count; x++) {
                if ((x == 0 && z == 2) || (x == 7 && z == 3)) {
                    continue;
                }
                added++;
                items(layout).add(floorItem("plant-" + added, "plant", x + 0.5, z + 0.5, 0));
            }
        }
        assertThat(added).as("setup: plants added").isEqualTo(count);
    }

    private static ObjectNode onOf(ObjectNode layout, String id) {
        return (ObjectNode) item(layout, id).get("on");
    }

    private static Arguments rejected(String name, Consumer<ObjectNode> change) {
        return Arguments.of(name, change);
    }

    // ---------- 비교 ----------

    /** A의 기대 결과: PUT 200이고 응답이 보낸 배치와 같으며, GET 200이고 보낸 배치와 같다. */
    private static void assertAccepted(String label, ObjectNode sent, HttpResponse<String> save, HttpResponse<String> load)
            throws Exception {
        assertThat(save.statusCode()).as("%s PUT %s -> body %s", label, sent, save.body()).isEqualTo(200);
        LobbyLayoutControllerTabletopSpecTest.assertSameLayout(sent, JSON.readTree(save.body()), label + " save");
        assertThat(load.statusCode()).as("%s GET, body %s", label, load.body()).isEqualTo(200);
        LobbyLayoutControllerTabletopSpecTest.assertSameLayout(sent, JSON.readTree(load.body()), label + " load");
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

    private static void assertFloor(JsonNode layout, String id, String type, double x, double z, int facing, String label) {
        JsonNode item = itemOf(layout, id);
        assertThat(item.get("type").asText()).as("%s %s type", label, id).isEqualTo(type);
        JsonNode floor = item.get("floor");
        assertThat(names(floor)).as("%s %s.floor keys: %s", label, id, floor).isEqualTo(Set.of("x", "z", "facing"));
        assertThat(floor.get("x").asDouble()).as("%s %s.floor.x", label, id).isEqualTo(x);
        assertThat(floor.get("z").asDouble()).as("%s %s.floor.z", label, id).isEqualTo(z);
        assertThat(floor.get("facing").isIntegralNumber()).as("%s %s.floor.facing is an integer: %s", label, id, floor).isTrue();
        assertThat(floor.get("facing").asInt()).as("%s %s.floor.facing", label, id).isEqualTo(facing);
    }

    private static void assertOn(JsonNode layout, String id, String type, String parent, int slot, int facing, String label) {
        JsonNode item = itemOf(layout, id);
        assertThat(item.get("type").asText()).as("%s %s type", label, id).isEqualTo(type);
        JsonNode on = item.get("on");
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

    private static List<String> storedIdsInOrder(JsonNode layout) {
        assertThat(layout.path("stored").isArray()).as("stored is an array: %s", layout).isTrue();
        List<String> ids = new ArrayList<>();
        layout.path("stored").forEach(node -> ids.add(node.path("id").asText()));
        return ids;
    }

    private static List<String> typesOf(JsonNode layout) {
        List<String> types = new ArrayList<>();
        layout.path("items").forEach(node -> types.add(node.path("type").asText()));
        return types;
    }

    // ---------- 사용자·요청 ----------

    // 작업 086 ② 결정 1: 배치를 저장하기 전에 그 계정이 필요한 가구를 산 것으로 준비한다(put에서). 토큰으로 계정을 찾는다
    private final Map<String, Long> userIdByToken = new LinkedHashMap<>();

    private record TestUser(long id, String email, String password, String token) {
    }

    private TestUser newUser(String tag) throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        String email = "qa-066n-" + tag + "-" + suffix + "@example.com";
        String password = "qa-pass-" + suffix;
        jdbc.update(
                "INSERT INTO users (email, password_hash, display_name, email_verified, verified_at) VALUES (?, ?, ?, 1, NOW())",
                email, passwordEncoder.encode(password), "qa-066n-" + tag + "-" + suffix);
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
        HttpRequest.Builder request = HttpRequest.newBuilder(uri(PATH)).GET();
        if (token != null) {
            request.header("Authorization", "Bearer " + token);
        }
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> put(String token, JsonNode layout) throws Exception {
        LobbyLayoutPurchasePrep.ownEnoughFor(jdbc, token == null ? null : userIdByToken.get(token), layout);
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
