package com.writeloop.controller;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.TreeSet;
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
 * [spec] 작업 064 ② 계정 저장, 서버 시나리오(02-qa-scenarios.md S1~S17, S12-*, S13~S15)와
 * 결정 04-main-decision.md 1(경로 /api/lobby-layout GET·PUT, version 1, 없으면 404, 로그인 없으면 401 "로그인이 필요해요.",
 * 모양이 틀리면 400, 방 안의 기준은 경계 포함, 목록에 없는 이상한 값도 거절)을 실제 서버로 확인한다.
 * 로그인은 모바일과 같은 토큰 로그인(Bearer)으로 하고, 쿠키 저장소가 없는 JDK HttpClient로 보낸다.
 * 테스트마다 새 이메일 사용자를 만들고 자기 데이터만 확인한다.
 */
class LobbyLayoutControllerSpecTest extends IntegrationTestSupport {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String PATH = "/api/lobby-layout";
    private static final String LOGIN_REQUIRED = "로그인이 필요해요.";

    @Autowired
    private PasswordEncoder passwordEncoder;

    private final HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();

    // ---------- 불러오기 ----------

    @Test
    void s1_loadWithoutSavedLayoutIs404NotAnError() throws Exception {
        TestUser user = newUser("s1");

        HttpResponse<String> load = get(user.token());

        assertThat(load.statusCode()).as("S1 GET without saved layout (decision 04: 404 = none), body %s", load.body())
                .isEqualTo(404);
    }

    @Test
    void s2_loadReturnsTheSavedLayoutWithVersion() throws Exception {
        TestUser user = newUser("s2");
        assertThat(put(user.token(), p1()).statusCode()).as("setup: save P1").isEqualTo(200);

        HttpResponse<String> load = get(user.token());

        assertThat(load.statusCode()).as("S2 GET, body %s", load.body()).isEqualTo(200);
        assertSameLayout(p1(), JSON.readTree(load.body()), "S2");
    }

    @Test
    void s3_anotherTokenOfTheSameUserLoadsTheSameLayout() throws Exception {
        TestUser user = newUser("s3");
        // 다른 폰처럼 같은 계정으로 한 번 더 로그인해 받은 토큰
        String secondToken = login(user.email(), user.password());

        assertThat(put(user.token(), p1()).statusCode()).as("setup: save P1 with token 1").isEqualTo(200);
        HttpResponse<String> load = get(secondToken);

        assertThat(load.statusCode()).as("S3 GET with token 2, body %s", load.body()).isEqualTo(200);
        assertSameLayout(p1(), JSON.readTree(load.body()), "S3");
    }

    // ---------- 저장하기 ----------

    @Test
    void s4_saveReturnsTheSavedLayout() throws Exception {
        TestUser user = newUser("s4");

        HttpResponse<String> save = put(user.token(), p1());

        assertThat(save.statusCode()).as("S4 PUT, body %s", save.body()).isEqualTo(200);
        assertSameLayout(p1(), JSON.readTree(save.body()), "S4");
    }

    @Test
    void s5_s15_saveOverwritesAndKeepsOneRowPerAccount() throws Exception {
        TestUser user = newUser("s5");

        HttpResponse<String> first = put(user.token(), p1());
        HttpResponse<String> second = put(user.token(), p0());
        HttpResponse<String> load = get(user.token());

        assertThat(first.statusCode()).as("S5/S15 PUT P1 (left and right walls), body %s", first.body()).isEqualTo(200);
        assertThat(second.statusCode()).as("S5/S15 PUT P0 (back walls), body %s", second.body()).isEqualTo(200);
        assertThat(load.statusCode()).as("S5 GET, body %s", load.body()).isEqualTo(200);
        assertSameLayout(p0(), JSON.readTree(load.body()), "S5");
        assertThat(rowsOf(user.id())).as("S5 lobby_layouts rows of user %s", user.id()).isEqualTo(1);
    }

    @Test
    void s6_offGridValuesComeBackExactly() throws Exception {
        TestUser user = newUser("s6");

        HttpResponse<String> save = put(user.token(), p0());
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("S6 PUT P0, body %s", save.body()).isEqualTo(200);
        assertThat(load.statusCode()).as("S6 GET, body %s", load.body()).isEqualTo(200);
        JsonNode saved = JSON.readTree(save.body());
        JsonNode loaded = JSON.readTree(load.body());
        for (JsonNode node : List.of(saved, loaded)) {
            assertThat(node.at("/floor/rug/x").asDouble()).as("S6 rug x").isEqualTo(4.6);
            assertThat(node.at("/floor/rug/z").asDouble()).as("S6 rug z").isEqualTo(7.2);
            assertThat(node.at("/wall/board/along").asDouble()).as("S6 board along").isEqualTo(1.8);
            assertThat(node.at("/wall/window/along").asDouble()).as("S6 window along").isEqualTo(4.8);
        }
        assertSameLayout(p0(), saved, "S6 save");
        assertSameLayout(p0(), loaded, "S6 load");
    }

    @Test
    void s7_layoutsAreSeparatePerAccount() throws Exception {
        TestUser a = newUser("s7a");
        TestUser b = newUser("s7b");
        assertThat(put(a.token(), p1()).statusCode()).as("setup: A saves P1").isEqualTo(200);

        HttpResponse<String> bFirstLoad = get(b.token());
        assertThat(bFirstLoad.statusCode()).as("S7 B GET before saving, body %s", bFirstLoad.body()).isEqualTo(404);

        assertThat(put(b.token(), p0()).statusCode()).as("S7 B saves P0").isEqualTo(200);
        HttpResponse<String> aLoad = get(a.token());

        assertThat(aLoad.statusCode()).as("S7 A GET, body %s", aLoad.body()).isEqualTo(200);
        assertSameLayout(p1(), JSON.readTree(aLoad.body()), "S7 A");
    }

    @Test
    void s8_overlappingLayoutIsAcceptedBecauseOnlyTheShapeIsChecked() throws Exception {
        TestUser user = newUser("s8");
        ObjectNode overlapping = p0();
        floorPiece(overlapping, "bookcase").put("x", 1.5).put("z", 5.5).put("facing", 0);

        HttpResponse<String> save = put(user.token(), overlapping);
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("S8 PUT bookcase on the desk, body %s", save.body()).isEqualTo(200);
        assertThat(load.statusCode()).as("S8 GET, body %s", load.body()).isEqualTo(200);
        assertSameLayout(overlapping, JSON.readTree(load.body()), "S8");
    }

    // ---------- 로그인하지 않은 요청 ----------

    @Test
    void s9_loadWithoutLoginIs401() throws Exception {
        HttpResponse<String> load = get(null);

        assertThat(load.statusCode()).as("S9 GET without login, body %s", load.body()).isEqualTo(401);
        assertThat(JSON.readTree(load.body()).path("message").asText()).as("S9 message").isEqualTo(LOGIN_REQUIRED);
    }

    @Test
    void s10_saveWithoutLoginIs401AndAddsNoRow() throws Exception {
        int before = allRows();

        HttpResponse<String> save = put(null, p1());

        assertThat(save.statusCode()).as("S10 PUT without login, body %s", save.body()).isEqualTo(401);
        assertThat(JSON.readTree(save.body()).path("message").asText()).as("S10 message").isEqualTo(LOGIN_REQUIRED);
        assertThat(allRows()).as("S10 lobby_layouts rows").isEqualTo(before);
    }

    @Test
    void s11_saveWithoutLoginDoesNotTouchAnExistingLayout() throws Exception {
        TestUser user = newUser("s11");
        assertThat(put(user.token(), p1()).statusCode()).as("setup: save P1").isEqualTo(200);

        HttpResponse<String> save = put(null, p0());
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("S11 PUT without login, body %s", save.body()).isEqualTo(401);
        assertThat(load.statusCode()).as("S11 GET, body %s", load.body()).isEqualTo(200);
        assertSameLayout(p1(), JSON.readTree(load.body()), "S11");
    }

    // ---------- 모양 검사: 거절 ----------

    @Test
    void s12_0_rejectedLayoutIsNotSavedForAnAccountWithoutLayout() throws Exception {
        TestUser user = newUser("s120");
        ObjectNode layout = p0();
        floorGroup(layout).set("lamp", floorValue(4.5, 4.5, 0));

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("S12-0 PUT with unknown piece, body %s", save.body()).isEqualTo(400);
        assertThat(load.statusCode()).as("S12-0 GET after rejected save, body %s", load.body()).isEqualTo(404);
        assertThat(rowsOf(user.id())).as("S12-0 rows").isZero();
    }

    static Stream<Arguments> rejectedLayouts() {
        List<Arguments> cases = new ArrayList<>();
        // 02-qa-scenarios.md S12-1~S12-16
        cases.add(rejected("S12-1 unknown floor piece lamp", l -> floorGroup(l).set("lamp", floorValue(4.5, 4.5, 0))));
        cases.add(rejected("S12-2 unknown wall piece clock", l -> wallGroup(l).set("clock", wallValue("back", 6.5))));
        cases.add(rejected("S12-3 wardrobe missing", l -> floorGroup(l).remove("wardrobe")));
        cases.add(rejected("S12-4 window missing", l -> wallGroup(l).remove("window")));
        cases.add(rejected("S12-5 floor group missing", l -> l.remove("floor")));
        cases.add(rejected("S12-6 desk x -1", l -> floorPiece(l, "desk").put("x", -1.0)));
        cases.add(rejected("S12-7 rug x 9", l -> floorPiece(l, "rug").put("x", 9.0)));
        cases.add(rejected("S12-8 bookcase z 12", l -> floorPiece(l, "bookcase").put("z", 12.0)));
        cases.add(rejected("S12-9 wardrobe z -0.5", l -> floorPiece(l, "wardrobe").put("z", -0.5)));
        cases.add(rejected("S12-10 board back along 10", l -> wallPiece(l, "board").put("along", 10.0)));
        cases.add(rejected("S12-11 window left along 12", l -> wallPiece(l, "window").put("wall", "left").put("along", 12.0)));
        cases.add(rejected("S12-12 window right along -1", l -> wallPiece(l, "window").put("wall", "right").put("along", -1.0)));
        cases.add(rejected("S12-13 desk facing 4", l -> floorPiece(l, "desk").put("facing", 4)));
        cases.add(rejected("S12-14 rug facing -1", l -> floorPiece(l, "rug").put("facing", -1)));
        cases.add(rejected("S12-15 board wall front", l -> wallPiece(l, "board").put("wall", "front")));
        cases.add(rejected("S12-16 window wall ceiling", l -> wallPiece(l, "window").put("wall", "ceiling")));
        // 결정 04-1: 버전이 빠졌거나 모르는 버전이면 거절
        cases.add(rejected("D1 version missing", l -> l.remove("version")));
        cases.add(rejected("D2 version 2", l -> l.put("version", 2)));
        cases.add(rejected("D3 version string \"1\"", l -> l.put("version", "1")));
        // 결정 04-1: 바닥 0~8·0~11, 뒷벽 along 0~8, 옆벽 along 0~11 밖
        cases.add(rejected("D4 board back along 8.5 (inside only for side walls)", l -> wallPiece(l, "board").put("along", 8.5)));
        cases.add(rejected("D5 desk z 11.5", l -> floorPiece(l, "desk").put("z", 11.5)));
        cases.add(rejected("D6 wardrobe x 8.5", l -> floorPiece(l, "wardrobe").put("x", 8.5)));
        // 결정 04-1: 목록에 없는 이상한 값도 거절(방향 1.5, 문자열 숫자, null·빠진 값, 대문자, 모르는 키)
        cases.add(rejected("D7 desk facing 1.5", l -> floorPiece(l, "desk").put("facing", 1.5)));
        cases.add(rejected("D8 desk facing string \"1\"", l -> floorPiece(l, "desk").put("facing", "1")));
        cases.add(rejected("D9 desk facing null", l -> floorPiece(l, "desk").putNull("facing")));
        cases.add(rejected("D10 desk facing missing", l -> floorPiece(l, "desk").remove("facing")));
        cases.add(rejected("D11 bookcase x missing", l -> floorPiece(l, "bookcase").remove("x")));
        cases.add(rejected("D12 bookcase x string \"0.5\"", l -> floorPiece(l, "bookcase").put("x", "0.5")));
        cases.add(rejected("D13 board wall BACK", l -> wallPiece(l, "board").put("wall", "BACK")));
        cases.add(rejected("D14 window along null", l -> wallPiece(l, "window").putNull("along")));
        cases.add(rejected("D15 unknown key in desk", l -> floorPiece(l, "desk").put("y", 0)));
        cases.add(rejected("D16 unknown top-level key", l -> l.put("theme", "wood")));
        cases.add(rejected("D17 wall piece board in floor group", l -> floorGroup(l).set("board", floorValue(4.5, 4.5, 0))));
        cases.add(rejected("D18 floor group null", l -> l.putNull("floor")));
        cases.add(rejected("D19 unknown key in board", l -> wallPiece(l, "board").put("height", 1.75)));
        return cases.stream();
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("rejectedLayouts")
    void s12_badShapeIs400AndThePreviousLayoutStays(String name, Consumer<ObjectNode> change) throws Exception {
        TestUser user = newUser("s12");
        assertThat(put(user.token(), p1()).statusCode()).as("setup: save P1").isEqualTo(200);
        ObjectNode layout = p0();
        change.accept(layout);

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("%s: PUT %s -> body %s", name, layout, save.body()).isEqualTo(400);
        assertThat(load.statusCode()).as("%s: GET after rejected save, body %s", name, load.body()).isEqualTo(200);
        assertSameLayout(p1(), JSON.readTree(load.body()), name);
    }

    // ---------- 모양 검사: 받아야 하는 쪽 ----------

    @Test
    void s13_alongTenIsInsideOnASideWall() throws Exception {
        TestUser user = newUser("s13");
        ObjectNode layout = p0();
        wallPiece(layout, "board").put("wall", "left").put("along", 10.0);

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("S13 PUT board left 10, body %s", save.body()).isEqualTo(200);
        assertSameLayout(layout, JSON.readTree(load.body()), "S13");
    }

    @Test
    void s14_allFourFacingsAreAccepted() throws Exception {
        TestUser user = newUser("s14");
        ObjectNode layout = p0();
        floorPiece(layout, "desk").put("facing", 2);
        floorPiece(layout, "bookcase").put("facing", 3);
        floorPiece(layout, "wardrobe").put("facing", 0);
        floorPiece(layout, "rug").put("facing", 1);

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("S14 PUT, body %s", save.body()).isEqualTo(200);
        assertSameLayout(layout, JSON.readTree(load.body()), "S14");
    }

    @Test
    void d20_boundaryValuesAreInsideTheRoom_backWall() throws Exception {
        // 결정 04-1: 경계도 안이다. 바닥 가운데 점 x 0~8·z 0~11, 뒷벽 along 0~8
        TestUser user = newUser("d20");
        ObjectNode layout = p0();
        floorPiece(layout, "bookcase").put("x", 0.0).put("z", 0.0);
        floorPiece(layout, "wardrobe").put("x", 8.0).put("z", 11.0);
        floorPiece(layout, "rug").put("x", 8.0).put("z", 0.0);
        floorPiece(layout, "desk").put("x", 0.0).put("z", 11.0);
        wallPiece(layout, "board").put("wall", "back").put("along", 0.0);
        wallPiece(layout, "window").put("wall", "back").put("along", 8.0);

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("D20 PUT boundary values, body %s", save.body()).isEqualTo(200);
        assertSameLayout(layout, JSON.readTree(load.body()), "D20");
    }

    @Test
    void d21_boundaryValuesAreInsideTheRoom_sideWalls() throws Exception {
        // 결정 04-1: 옆벽 along 0~11, 경계 포함
        TestUser user = newUser("d21");
        ObjectNode layout = p0();
        wallPiece(layout, "board").put("wall", "left").put("along", 11.0);
        wallPiece(layout, "window").put("wall", "right").put("along", 0.0);

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("D21 PUT side wall boundary values, body %s", save.body()).isEqualTo(200);
        assertSameLayout(layout, JSON.readTree(load.body()), "D21");
    }

    // ---------- 회원 탈퇴 ----------

    @Test
    void s16_s17_accountDeletionRemovesOnlyThatUsersLayout() throws Exception {
        TestUser a = newUser("s16a");
        TestUser b = newUser("s17b");
        assertThat(put(a.token(), p1()).statusCode()).as("setup: A saves P1").isEqualTo(200);
        assertThat(put(b.token(), p0()).statusCode()).as("setup: B saves P0").isEqualTo(200);
        assertThat(rowsOf(a.id())).as("setup: A has a row").isEqualTo(1);

        Map<String, Object> deleteBody = new LinkedHashMap<>();
        deleteBody.put("confirmationText", "탈퇴");
        deleteBody.put("currentPassword", a.password());
        HttpResponse<String> delete = client.send(
                HttpRequest.newBuilder(uri("/api/auth/account"))
                        .header("Authorization", "Bearer " + a.token())
                        .header("Content-Type", "application/json")
                        .method("DELETE", HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(deleteBody)))
                        .build(),
                HttpResponse.BodyHandlers.ofString());

        assertThat(delete.statusCode()).as("S16 DELETE /api/auth/account, body %s", delete.body()).isEqualTo(200);
        assertThat(rowsOf(a.id())).as("S16 lobby_layouts rows of deleted user %s", a.id()).isZero();
        assertThat(rowsOf(b.id())).as("S17 lobby_layouts rows of user B %s", b.id()).isEqualTo(1);
        HttpResponse<String> bLoad = get(b.token());
        assertThat(bLoad.statusCode()).as("S17 B GET, body %s", bLoad.body()).isEqualTo(200);
        assertSameLayout(p0(), JSON.readTree(bLoad.body()), "S17");
    }

    // ---------- 배치 값 ----------

    /** 처음 배치 P0(02-배치-데이터 결정 03)에 version 1. */
    static ObjectNode p0() {
        ObjectNode layout = JSON.createObjectNode();
        layout.put("version", 1);
        ObjectNode floor = layout.putObject("floor");
        floor.set("desk", floorValue(1.5, 5.5, 0));
        floor.set("bookcase", floorValue(0.5, 2.5, 1));
        floor.set("wardrobe", floorValue(7.5, 3.5, 3));
        floor.set("rug", floorValue(4.6, 7.2, 0));
        ObjectNode wall = layout.putObject("wall");
        wall.set("board", wallValue("back", 1.8));
        wall.set("window", wallValue("back", 4.8));
        return layout;
    }

    /** 다른 배치 P1(02-qa-scenarios.md). 모든 가구가 P0과 다르고, 게시판은 왼벽, 창문은 오른벽. */
    static ObjectNode p1() {
        ObjectNode layout = JSON.createObjectNode();
        layout.put("version", 1);
        ObjectNode floor = layout.putObject("floor");
        floor.set("desk", floorValue(5.5, 8.5, 2));
        floor.set("bookcase", floorValue(6.5, 1.5, 3));
        floor.set("wardrobe", floorValue(1.5, 1.5, 1));
        floor.set("rug", floorValue(3.0, 4.0, 1));
        ObjectNode wall = layout.putObject("wall");
        wall.set("board", wallValue("left", 3.5));
        wall.set("window", wallValue("right", 6.2));
        return layout;
    }

    static ObjectNode floorValue(double x, double z, int facing) {
        ObjectNode node = JSON.createObjectNode();
        node.put("x", x);
        node.put("z", z);
        node.put("facing", facing);
        return node;
    }

    static ObjectNode wallValue(String wall, double along) {
        ObjectNode node = JSON.createObjectNode();
        node.put("wall", wall);
        node.put("along", along);
        return node;
    }

    static ObjectNode floorGroup(ObjectNode layout) {
        return (ObjectNode) layout.get("floor");
    }

    static ObjectNode wallGroup(ObjectNode layout) {
        return (ObjectNode) layout.get("wall");
    }

    static ObjectNode floorPiece(ObjectNode layout, String piece) {
        return (ObjectNode) floorGroup(layout).get(piece);
    }

    static ObjectNode wallPiece(ObjectNode layout, String piece) {
        return (ObjectNode) wallGroup(layout).get(piece);
    }

    private static Arguments rejected(String name, Consumer<ObjectNode> change) {
        return Arguments.of(name, change);
    }

    /** 결정 04-1: 응답은 요청과 같은 모양(version, floor 넷, wall 둘)이고 값이 그대로다. */
    private static void assertSameLayout(JsonNode expected, JsonNode actual, String label) {
        assertThat(names(actual)).as("%s top-level keys of %s", label, actual).isEqualTo(Set.of("floor", "version", "wall"));
        assertThat(actual.get("version").isIntegralNumber()).as("%s version is an integer: %s", label, actual).isTrue();
        assertThat(actual.get("version").asInt()).as("%s version", label).isEqualTo(expected.get("version").asInt());

        assertThat(names(actual.get("floor"))).as("%s floor keys", label)
                .isEqualTo(Set.of("bookcase", "desk", "rug", "wardrobe"));
        for (String piece : List.of("desk", "bookcase", "wardrobe", "rug")) {
            JsonNode e = expected.at("/floor/" + piece);
            JsonNode a = actual.at("/floor/" + piece);
            assertThat(names(a)).as("%s floor.%s keys", label, piece).isEqualTo(Set.of("facing", "x", "z"));
            assertThat(a.get("x").isNumber()).as("%s floor.%s.x is a number: %s", label, piece, a).isTrue();
            assertThat(a.get("z").isNumber()).as("%s floor.%s.z is a number: %s", label, piece, a).isTrue();
            assertThat(a.get("facing").isIntegralNumber()).as("%s floor.%s.facing is an integer: %s", label, piece, a).isTrue();
            assertThat(a.get("x").asDouble()).as("%s floor.%s.x", label, piece).isEqualTo(e.get("x").asDouble());
            assertThat(a.get("z").asDouble()).as("%s floor.%s.z", label, piece).isEqualTo(e.get("z").asDouble());
            assertThat(a.get("facing").asInt()).as("%s floor.%s.facing", label, piece).isEqualTo(e.get("facing").asInt());
        }

        assertThat(names(actual.get("wall"))).as("%s wall keys", label).isEqualTo(Set.of("board", "window"));
        for (String piece : List.of("board", "window")) {
            JsonNode e = expected.at("/wall/" + piece);
            JsonNode a = actual.at("/wall/" + piece);
            assertThat(names(a)).as("%s wall.%s keys", label, piece).isEqualTo(Set.of("along", "wall"));
            assertThat(a.get("wall").isTextual()).as("%s wall.%s.wall is text: %s", label, piece, a).isTrue();
            assertThat(a.get("along").isNumber()).as("%s wall.%s.along is a number: %s", label, piece, a).isTrue();
            assertThat(a.get("wall").asText()).as("%s wall.%s.wall", label, piece).isEqualTo(e.get("wall").asText());
            assertThat(a.get("along").asDouble()).as("%s wall.%s.along", label, piece).isEqualTo(e.get("along").asDouble());
        }
    }

    private static Set<String> names(JsonNode node) {
        Set<String> names = new TreeSet<>();
        if (node != null) {
            node.fieldNames().forEachRemaining(names::add);
        }
        return names;
    }

    // ---------- 사용자·요청 ----------

    private record TestUser(long id, String email, String password, String token) {
    }

    private TestUser newUser(String tag) throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        String email = "qa-064-" + tag + "-" + suffix + "@example.com";
        String password = "qa-pass-" + suffix;
        jdbc.update(
                "INSERT INTO users (email, password_hash, display_name, email_verified, verified_at) VALUES (?, ?, ?, 1, NOW())",
                email, passwordEncoder.encode(password), "qa-064-" + tag + "-" + suffix);
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

    private int allRows() {
        return jdbc.queryForObject("SELECT COUNT(*) FROM lobby_layouts", Integer.class);
    }

    private URI uri(String path) {
        return URI.create(rest.getRootUri() + path);
    }
}
