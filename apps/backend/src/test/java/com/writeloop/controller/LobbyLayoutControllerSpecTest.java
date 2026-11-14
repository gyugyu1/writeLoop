package com.writeloop.controller;

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
 *
 * <p>작업 066 ①(02-카탈로그-배치v2-공통규칙 명세 "고칠 기존 테스트")에서 배치 데이터 모양만 v2(version 2, 가구 인스턴스 목록
 * items, 바닥형·덮개형은 floor, 벽 부착형은 wall)로 고쳤다. 확인하는 뜻과 기대 동작은 그대로다. 다만 v2에서 바뀐 규칙에 맞춰
 * 다음 두 거절 사례의 대상을 바꿨다: S12-3(빠진 가구)은 v2에서 꼭 있어야 하는 장소 가구인 책장으로, D2(모르는 버전)는 옛 버전 1로.
 * v2에서 새로 생긴 규칙은 {@link LobbyLayoutControllerV2SpecTest}가 확인한다.
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

        assertThat(first.statusCode()).as("S5/S15 PUT P1 (board on the left wall), body %s", first.body()).isEqualTo(200);
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
            assertThat(itemById(node, "rug").at("/floor/x").asDouble()).as("S6 rug x").isEqualTo(4.6);
            assertThat(itemById(node, "rug").at("/floor/z").asDouble()).as("S6 rug z").isEqualTo(7.2);
            assertThat(itemById(node, "board").at("/wall/along").asDouble()).as("S6 board along").isEqualTo(1.8);
            assertThat(itemById(node, "window").at("/wall/along").asDouble()).as("S6 window along").isEqualTo(4.8);
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
        items(layout).add(floorItem("lamp", "lamp", 4.5, 4.5, 0));

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("S12-0 PUT with unknown piece, body %s", save.body()).isEqualTo(400);
        assertThat(load.statusCode()).as("S12-0 GET after rejected save, body %s", load.body()).isEqualTo(404);
        assertThat(rowsOf(user.id())).as("S12-0 rows").isZero();
    }

    static Stream<Arguments> rejectedLayouts() {
        List<Arguments> cases = new ArrayList<>();
        // 02-qa-scenarios.md S12-1~S12-16
        cases.add(rejected("S12-1 unknown floor piece lamp", l -> items(l).add(floorItem("lamp", "lamp", 4.5, 4.5, 0))));
        cases.add(rejected("S12-2 unknown wall piece clock", l -> items(l).add(wallItem("clock", "clock", "back", 6.5))));
        // 066 ①: v2에서는 장소 가구만 꼭 있어야 하므로(명세 4), 빠진 가구를 옷장 대신 장소 가구인 책장으로 한다.
        cases.add(rejected("S12-3 bookcase missing", l -> removeItem(l, "bookcase")));
        cases.add(rejected("S12-4 window missing", l -> removeItem(l, "window")));
        cases.add(rejected("S12-5 items missing", l -> l.remove("items")));
        cases.add(rejected("S12-6 desk x -1", l -> floorPiece(l, "desk").put("x", -1.0)));
        cases.add(rejected("S12-7 rug x 9", l -> floorPiece(l, "rug").put("x", 9.0)));
        cases.add(rejected("S12-8 bookcase z 12", l -> floorPiece(l, "bookcase").put("z", 12.0)));
        cases.add(rejected("S12-9 wardrobe z -0.5", l -> floorPiece(l, "wardrobe").put("z", -0.5)));
        cases.add(rejected("S12-10 board back along 10", l -> wallPiece(l, "board").put("along", 10.0)));
        // 작업 093: 창문은 옮길 수 없게 되어(붙박이), 옆벽 길이 검사를 창문 대신 게시판으로 확인한다
        cases.add(rejected("S12-11 board left along 12", l -> wallPiece(l, "board").put("wall", "left").put("along", 12.0)));
        cases.add(rejected("S12-12 board right along -1", l -> wallPiece(l, "board").put("wall", "right").put("along", -1.0)));
        cases.add(rejected("S12-13 desk facing 4", l -> floorPiece(l, "desk").put("facing", 4)));
        cases.add(rejected("S12-14 rug facing -1", l -> floorPiece(l, "rug").put("facing", -1)));
        cases.add(rejected("S12-15 board wall front", l -> wallPiece(l, "board").put("wall", "front")));
        // 작업 093: 모르는 벽 이름 검사를 창문 대신 게시판으로 확인한다
        cases.add(rejected("S12-16 board wall ceiling", l -> wallPiece(l, "board").put("wall", "ceiling")));
        // 결정 04-1: 버전이 빠졌거나 모르는 버전이면 거절
        cases.add(rejected("D1 version missing", l -> l.remove("version")));
        // 066 ①: v2는 version 2만 받으므로(명세 4), 모르는 버전을 옛 버전 1로 한다.
        cases.add(rejected("D2 version 1", l -> l.put("version", 1)));
        cases.add(rejected("D3 version string \"2\"", l -> l.put("version", "2")));
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
        cases.add(rejected("D17 wall piece board placed on the floor", l -> {
            ObjectNode board = item(l, "board");
            board.remove("wall");
            board.set("floor", floorValue(4.5, 4.5, 0));
        }));
        cases.add(rejected("D18 items null", l -> l.putNull("items")));
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
        // 작업 093: 창문은 뒷벽 4.8 붙박이라 뒷벽 끝(8.0)으로 옮기지 않는다(뒷벽 8.0 경계는 RoomSpecTest RA-7의 게시판이 본다)

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
        // 작업 093: 창문은 뒷벽 4.8 붙박이라 오른벽으로 옮기지 않는다(오른벽 0.0 경계는 NewFurnitureSpecTest의 액자가 본다)

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

    /** 처음 배치 P0(02-배치-데이터 결정 03)을 v2 모양으로. 인스턴스 id는 종류 id와 같다(066 ① 명세 2). */
    static ObjectNode p0() {
        ObjectNode layout = JSON.createObjectNode();
        layout.put("version", 2);
        ArrayNode items = layout.putArray("items");
        items.add(floorItem("desk", "desk", 1.5, 5.5, 0));
        items.add(floorItem("bookcase", "bookcase", 0.5, 2.5, 1));
        items.add(floorItem("wardrobe", "wardrobe", 7.5, 3.5, 3));
        items.add(floorItem("rug", "rug", 4.6, 7.2, 0));
        items.add(wallItem("board", "board", "back", 1.8));
        items.add(wallItem("window", "window", "back", 4.8));
        return layout;
    }

    /**
     * 다른 배치 P1(02-qa-scenarios.md)을 v2 모양으로. 창문 밖의 모든 가구가 P0과 다르고, 게시판은 왼벽.
     * 작업 093(창문 붙박이, 01-main-spec.md "고칠 기존 테스트"): 창문은 늘 뒷벽 4.8이어야 저장되므로 창문을 오른벽 6.2에서 뒷벽 4.8로 옮겼다.
     */
    static ObjectNode p1() {
        ObjectNode layout = JSON.createObjectNode();
        layout.put("version", 2);
        ArrayNode items = layout.putArray("items");
        items.add(floorItem("desk", "desk", 5.5, 8.5, 2));
        items.add(floorItem("bookcase", "bookcase", 6.5, 1.5, 3));
        items.add(floorItem("wardrobe", "wardrobe", 1.5, 1.5, 1));
        items.add(floorItem("rug", "rug", 3.0, 4.0, 1));
        items.add(wallItem("board", "board", "left", 3.5));
        items.add(wallItem("window", "window", "back", 4.8));
        return layout;
    }

    static ObjectNode floorItem(String id, String type, double x, double z, int facing) {
        ObjectNode node = JSON.createObjectNode();
        node.put("id", id);
        node.put("type", type);
        node.set("floor", floorValue(x, z, facing));
        return node;
    }

    static ObjectNode wallItem(String id, String type, String wall, double along) {
        ObjectNode node = JSON.createObjectNode();
        node.put("id", id);
        node.put("type", type);
        node.set("wall", wallValue(wall, along));
        return node;
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

    static ArrayNode items(ObjectNode layout) {
        return (ArrayNode) layout.get("items");
    }

    /** 요청 배치에서 인스턴스 id가 id인 항목. */
    static ObjectNode item(ObjectNode layout, String id) {
        return (ObjectNode) itemById(layout, id);
    }

    static void removeItem(ObjectNode layout, String id) {
        ArrayNode items = items(layout);
        for (int i = 0; i < items.size(); i++) {
            if (id.equals(items.get(i).path("id").asText())) {
                items.remove(i);
                return;
            }
        }
        throw new IllegalArgumentException("no item " + id);
    }

    /** 인스턴스 id가 id인 가구의 바닥 자리(floor). */
    static ObjectNode floorPiece(ObjectNode layout, String id) {
        return (ObjectNode) item(layout, id).get("floor");
    }

    /** 인스턴스 id가 id인 가구의 벽 자리(wall). */
    static ObjectNode wallPiece(ObjectNode layout, String id) {
        return (ObjectNode) item(layout, id).get("wall");
    }

    /** 배치(요청이나 응답)의 items에서 id가 같은 항목 하나. 없거나 둘 이상이면 실패한다. */
    static JsonNode itemById(JsonNode layout, String id) {
        JsonNode found = null;
        int count = 0;
        for (JsonNode item : layout.path("items")) {
            if (item.path("id").isTextual() && id.equals(item.path("id").asText())) {
                found = item;
                count++;
            }
        }
        assertThat(count).as("items with id %s in %s", id, layout).isEqualTo(1);
        return found;
    }

    private static Arguments rejected(String name, Consumer<ObjectNode> change) {
        return Arguments.of(name, change);
    }

    /**
     * 결정 04-1: 응답은 요청과 같은 모양이고 값이 그대로다. 066 ① v2에서는 version 2와 items이고,
     * 항목마다 id·type과 종류에 맞는 자리 하나(바닥형·덮개형은 floor만, 벽 부착형은 wall만)다.
     * 목록 순서는 명세에 없어 id로 맞춰 본다.
     */
    static void assertSameLayout(JsonNode expected, JsonNode actual, String label) {
        assertThat(names(actual)).as("%s top-level keys of %s", label, actual).isEqualTo(Set.of("items", "version"));
        assertThat(actual.get("version").isIntegralNumber()).as("%s version is an integer: %s", label, actual).isTrue();
        assertThat(actual.get("version").asInt()).as("%s version", label).isEqualTo(expected.get("version").asInt());

        assertThat(actual.get("items").isArray()).as("%s items is an array: %s", label, actual).isTrue();
        assertThat(actual.get("items").size()).as("%s items count of %s", label, actual)
                .isEqualTo(expected.get("items").size());
        Set<String> actualIds = new TreeSet<>();
        for (JsonNode a : actual.get("items")) {
            assertThat(a.path("id").isTextual()).as("%s item id is text: %s", label, a).isTrue();
            actualIds.add(a.get("id").asText());
        }
        Set<String> expectedIds = new TreeSet<>();
        expected.get("items").forEach(e -> expectedIds.add(e.get("id").asText()));
        assertThat(actualIds).as("%s item ids", label).isEqualTo(expectedIds);

        for (JsonNode e : expected.get("items")) {
            String id = e.get("id").asText();
            JsonNode a = itemById(actual, id);
            assertThat(names(a)).as("%s item %s keys", label, id).isEqualTo(names(e));
            assertThat(a.get("type").isTextual()).as("%s item %s type is text: %s", label, id, a).isTrue();
            assertThat(a.get("type").asText()).as("%s item %s type", label, id).isEqualTo(e.get("type").asText());
            if (e.has("floor")) {
                JsonNode ef = e.get("floor");
                JsonNode af = a.get("floor");
                assertThat(names(af)).as("%s item %s floor keys", label, id).isEqualTo(Set.of("facing", "x", "z"));
                assertThat(af.get("x").isNumber()).as("%s item %s floor.x is a number: %s", label, id, af).isTrue();
                assertThat(af.get("z").isNumber()).as("%s item %s floor.z is a number: %s", label, id, af).isTrue();
                assertThat(af.get("facing").isIntegralNumber())
                        .as("%s item %s floor.facing is an integer: %s", label, id, af).isTrue();
                assertThat(af.get("x").asDouble()).as("%s item %s floor.x", label, id).isEqualTo(ef.get("x").asDouble());
                assertThat(af.get("z").asDouble()).as("%s item %s floor.z", label, id).isEqualTo(ef.get("z").asDouble());
                assertThat(af.get("facing").asInt()).as("%s item %s floor.facing", label, id)
                        .isEqualTo(ef.get("facing").asInt());
            } else {
                JsonNode ew = e.get("wall");
                JsonNode aw = a.get("wall");
                assertThat(names(aw)).as("%s item %s wall keys", label, id).isEqualTo(Set.of("along", "wall"));
                assertThat(aw.get("wall").isTextual()).as("%s item %s wall.wall is text: %s", label, id, aw).isTrue();
                assertThat(aw.get("along").isNumber()).as("%s item %s wall.along is a number: %s", label, id, aw).isTrue();
                assertThat(aw.get("wall").asText()).as("%s item %s wall.wall", label, id).isEqualTo(ew.get("wall").asText());
                assertThat(aw.get("along").asDouble()).as("%s item %s wall.along", label, id)
                        .isEqualTo(ew.get("along").asDouble());
            }
        }
    }

    static Set<String> names(JsonNode node) {
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
