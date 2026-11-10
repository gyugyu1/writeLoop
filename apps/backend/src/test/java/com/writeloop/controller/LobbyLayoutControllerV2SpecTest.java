package com.writeloop.controller;

import static com.writeloop.controller.LobbyLayoutControllerSpecTest.assertSameLayout;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.floorItem;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.floorValue;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.item;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.items;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.p0;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.p1;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.removeItem;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.wallItem;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.wallValue;
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
 * [spec] 작업 066 ① 가구 카탈로그와 배치 데이터 v2(02-카탈로그-배치v2-공통규칙/01-main-spec.md 2·4)에서
 * 서버 API 검사가 v2로 바뀐 부분을 실제 서버로 확인한다. 064 ②의 규칙을 v2 모양으로 옮긴 확인은
 * {@link LobbyLayoutControllerSpecTest}에 있다.
 *
 * <ul>
 *   <li>불러오기: 저장된 배치가 v1(모양 버전 1)이면 "없음"(404). 다시 저장하면 v2로 덮어쓴다.</li>
 *   <li>items 1~40개. 항목마다 id(1~40자, 영문·숫자·_·-, 목록 안에서 겹치지 않음), type(아는 종류),
 *       종류에 맞는 자리 하나(바닥형·덮개형은 floor만, 벽 부착형은 wall만). 모르는 키는 받지 않는다.</li>
 *   <li>장소 가구(board·window·desk·bookcase)는 종류마다 정확히 하나 있어야 한다(04-main-decision.md 1). 옷장·깔개는 없어도 되고 같은 종류를 여러 개 놓을 수 있는 모양이다.</li>
 *   <li>맞지 않으면 저장하지 않고 400 INVALID_LOBBY_LAYOUT.</li>
 * </ul>
 * 테스트마다 새 이메일 사용자를 만들고 자기 데이터만 확인한다.
 */
class LobbyLayoutControllerV2SpecTest extends IntegrationTestSupport {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String PATH = "/api/lobby-layout";
    private static final String INVALID_CODE = "INVALID_LOBBY_LAYOUT";

    /** 064 ②가 DB에 남긴 v1 배치(shape_version 1, layout_json은 floor·wall). P0과 같은 자리다. */
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

    // ---------- v1로 저장된 배치 ----------

    @Test
    void v1_storedV1LayoutLoadsAsNone() throws Exception {
        TestUser user = newUser("v1");
        insertV1Row(user.id());

        HttpResponse<String> load = get(user.token());

        assertThat(load.statusCode()).as("V1 GET with a stored v1 layout (spec 4: none = 404), body %s", load.body())
                .isEqualTo(404);
    }

    @Test
    void v2_savingAgainOverwritesTheV1LayoutWithV2() throws Exception {
        TestUser user = newUser("v2");
        insertV1Row(user.id());

        HttpResponse<String> save = put(user.token(), p1());
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("V2 PUT P1 over a v1 row, body %s", save.body()).isEqualTo(200);
        assertSameLayout(p1(), JSON.readTree(save.body()), "V2 save");
        assertThat(load.statusCode()).as("V2 GET after saving, body %s", load.body()).isEqualTo(200);
        assertSameLayout(p1(), JSON.readTree(load.body()), "V2 load");
        assertThat(rowsOf(user.id())).as("V2 lobby_layouts rows of user %s", user.id()).isEqualTo(1);
        assertThat(shapeVersionOf(user.id())).as("V2 shape_version after saving").isEqualTo(2);
    }

    // ---------- 받아야 하는 쪽 ----------

    @Test
    void v3_wardrobeAndRugMayBeAbsent() throws Exception {
        // 명세 4: 장소 가구(board·window·desk·bookcase)만 꼭 있어야 한다.
        TestUser user = newUser("v3");
        ObjectNode layout = p0();
        removeItem(layout, "wardrobe");
        removeItem(layout, "rug");

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("V3 PUT only the four place pieces, body %s", save.body()).isEqualTo(200);
        assertThat(load.statusCode()).as("V3 GET, body %s", load.body()).isEqualTo(200);
        assertSameLayout(layout, JSON.readTree(load.body()), "V3");
    }

    @Test
    void v4_theSameTypeCanBePlacedSeveralTimes() throws Exception {
        // 명세 2: 같은 종류를 여러 개 놓을 수 있는 모양이다(인스턴스마다 고유 id).
        TestUser user = newUser("v4");
        ObjectNode layout = p0();
        items(layout).add(floorItem("wardrobe-2", "wardrobe", 6.5, 9.5, 0));
        items(layout).add(floorItem("wardrobe_3", "wardrobe", 3.5, 9.5, 2));
        items(layout).add(floorItem("rug2", "rug", 2.0, 9.0, 1));

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("V4 PUT three wardrobes and two rugs, body %s", save.body()).isEqualTo(200);
        assertThat(load.statusCode()).as("V4 GET, body %s", load.body()).isEqualTo(200);
        assertSameLayout(layout, JSON.readTree(load.body()), "V4");
    }

    @Test
    void v5_instanceIdsAreFreeWithinTheAllowedCharacters() throws Exception {
        // 명세 4: id는 1~40자, 영문·숫자·_·-. 종류 id와 같지 않아도 된다.
        TestUser user = newUser("v5");
        ObjectNode layout = p0();
        item(layout, "desk").put("id", "Desk_01");
        item(layout, "bookcase").put("id", "b-2");
        item(layout, "wardrobe").put("id", "W");
        item(layout, "rug").put("id", "a".repeat(40));
        item(layout, "board").put("id", "9");
        item(layout, "window").put("id", "window-A_b");

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("V5 PUT with free instance ids, body %s", save.body()).isEqualTo(200);
        assertThat(load.statusCode()).as("V5 GET, body %s", load.body()).isEqualTo(200);
        assertSameLayout(layout, JSON.readTree(load.body()), "V5");
    }

    @Test
    void v6_fortyItemsAreAccepted() throws Exception {
        // 명세 4: items 1~40개, 경계 40 포함. 겹침은 서버가 보지 않는다.
        TestUser user = newUser("v6");
        ObjectNode layout = p0();
        addRugs(layout, 34);
        assertThat(items(layout).size()).as("setup: 40 items").isEqualTo(40);

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("V6 PUT 40 items, body %s", save.body()).isEqualTo(200);
        assertThat(load.statusCode()).as("V6 GET, body %s", load.body()).isEqualTo(200);
        assertSameLayout(layout, JSON.readTree(load.body()), "V6");
    }

    // ---------- 거절 ----------

    static Stream<Arguments> rejectedV2Layouts() {
        List<Arguments> cases = new ArrayList<>();
        // items 개수·모양
        cases.add(rejected("R1 items empty", l -> items(l).removeAll()));
        cases.add(rejected("R2 41 items", l -> addRugs(l, 35)));
        cases.add(rejected("R3 items is an object", l -> l.putObject("items").set("desk", floorValue(1.5, 5.5, 0))));
        cases.add(rejected("R4 an item is a string", l -> items(l).add("wardrobe")));
        cases.add(rejected("R5 an item is null", l -> items(l).addNull()));
        // 장소 가구는 꼭 있어야 한다
        cases.add(rejected("R6 desk missing", l -> removeItem(l, "desk")));
        cases.add(rejected("R7 bookcase missing", l -> removeItem(l, "bookcase")));
        cases.add(rejected("R8 board missing", l -> removeItem(l, "board")));
        cases.add(rejected("R9 window missing", l -> removeItem(l, "window")));
        cases.add(rejected("R10 only the desk (1 item)", l -> {
            removeItem(l, "bookcase");
            removeItem(l, "wardrobe");
            removeItem(l, "rug");
            removeItem(l, "board");
            removeItem(l, "window");
        }));
        // 결정 04-1: 장소 가구는 종류마다 정확히 하나다. 둘 이상이면 거절
        cases.add(rejected("R39 two desks", l -> items(l).add(floorItem("desk-2", "desk", 5.5, 9.5, 0))));
        cases.add(rejected("R40 two bookcases", l -> items(l).add(floorItem("bookcase-2", "bookcase", 6.5, 9.5, 2))));
        cases.add(rejected("R41 two boards", l -> items(l).add(wallItem("board-2", "board", "left", 5.0))));
        cases.add(rejected("R42 two windows", l -> items(l).add(wallItem("window-2", "window", "right", 5.0))));
        // id
        cases.add(rejected("R11 duplicate id within the same type", l -> items(l).add(floorItem("wardrobe", "wardrobe", 6.5, 9.5, 0))));
        cases.add(rejected("R12 duplicate id across types (rug with id desk)", l -> items(l).add(floorItem("desk", "rug", 2.0, 9.0, 0))));
        cases.add(rejected("R13 id empty", l -> item(l, "rug").put("id", "")));
        cases.add(rejected("R14 id 41 chars", l -> item(l, "rug").put("id", "a".repeat(41))));
        cases.add(rejected("R15 id with a space", l -> item(l, "rug").put("id", "rug 2")));
        cases.add(rejected("R16 id with a dot", l -> item(l, "rug").put("id", "rug.2")));
        cases.add(rejected("R17 id with a slash", l -> item(l, "rug").put("id", "rug/2")));
        cases.add(rejected("R18 id in Korean", l -> item(l, "rug").put("id", "깔개")));
        cases.add(rejected("R19 id is a number", l -> item(l, "rug").put("id", 7)));
        cases.add(rejected("R20 id null", l -> item(l, "rug").putNull("id")));
        cases.add(rejected("R21 id missing", l -> item(l, "rug").remove("id")));
        // type
        cases.add(rejected("R22 type sofa (not a known type)", l -> items(l).add(floorItem("sofa", "sofa", 6.5, 9.5, 0))));
        cases.add(rejected("R23 type Desk (upper case)", l -> item(l, "desk").put("type", "Desk")));
        cases.add(rejected("R24 type missing", l -> item(l, "wardrobe").remove("type")));
        cases.add(rejected("R25 type null", l -> item(l, "wardrobe").putNull("type")));
        cases.add(rejected("R26 type is a number", l -> item(l, "wardrobe").put("type", 3)));
        // 종류에 맞는 자리 하나
        cases.add(rejected("R27 wardrobe (floor type) on a wall", l -> {
            item(l, "wardrobe").remove("floor");
            item(l, "wardrobe").set("wall", wallValue("back", 6.5));
        }));
        cases.add(rejected("R28 rug (cover type) on a wall", l -> {
            item(l, "rug").remove("floor");
            item(l, "rug").set("wall", wallValue("right", 5.0));
        }));
        cases.add(rejected("R29 window (wall type) on the floor", l -> {
            item(l, "window").remove("wall");
            item(l, "window").set("floor", floorValue(4.5, 4.5, 0));
        }));
        cases.add(rejected("R30 desk with both floor and wall", l -> item(l, "desk").set("wall", wallValue("back", 6.5))));
        cases.add(rejected("R31 board with both wall and floor", l -> item(l, "board").set("floor", floorValue(4.5, 4.5, 0))));
        cases.add(rejected("R32 desk with neither floor nor wall", l -> item(l, "desk").remove("floor")));
        cases.add(rejected("R33 desk with an extra wall: null", l -> item(l, "desk").putNull("wall")));
        cases.add(rejected("R34 desk floor null", l -> item(l, "desk").putNull("floor")));
        cases.add(rejected("R35 board wall is a string", l -> item(l, "board").put("wall", "back")));
        cases.add(rejected("R36 unknown key on an item", l -> item(l, "wardrobe").put("rotation", 0)));
        // version
        cases.add(rejected("R37 version 3", l -> l.put("version", 3)));
        cases.add(rejected("R38 the old v1 body", l -> {
            l.removeAll();
            l.setAll(v1Body());
        }));
        return cases.stream();
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("rejectedV2Layouts")
    void r_badV2LayoutIs400AndThePreviousLayoutStays(String name, Consumer<ObjectNode> change) throws Exception {
        TestUser user = newUser("r");
        assertThat(put(user.token(), p1()).statusCode()).as("setup: save P1").isEqualTo(200);
        ObjectNode layout = p0();
        change.accept(layout);

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("%s: PUT %s -> body %s", name, layout, save.body()).isEqualTo(400);
        assertThat(JSON.readTree(save.body()).path("code").asText()).as("%s: error code, body %s", name, save.body())
                .isEqualTo(INVALID_CODE);
        assertThat(load.statusCode()).as("%s: GET after rejected save, body %s", name, load.body()).isEqualTo(200);
        assertSameLayout(p1(), JSON.readTree(load.body()), name);
    }

    // ---------- 배치 값 ----------

    /** 깔개를 count개 더한다(id rug-1, rug-2, ...). */
    private static void addRugs(ObjectNode layout, int count) {
        for (int i = 1; i <= count; i++) {
            items(layout).add(floorItem("rug-" + i, "rug", 1.0 + (i % 6), 1.0 + (i % 9), i % 4));
        }
    }

    /** 064 ②의 v1 요청 본문(P0). */
    private static ObjectNode v1Body() {
        try {
            ObjectNode body = (ObjectNode) JSON.readTree(V1_LAYOUT_JSON);
            ObjectNode withVersion = JSON.createObjectNode();
            withVersion.put("version", 1);
            withVersion.setAll(body);
            return withVersion;
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private static Arguments rejected(String name, Consumer<ObjectNode> change) {
        return Arguments.of(name, change);
    }

    // ---------- 사용자·요청·DB ----------

    private record TestUser(long id, String email, String password, String token) {
    }

    private TestUser newUser(String tag) throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        String email = "qa-066-" + tag + "-" + suffix + "@example.com";
        String password = "qa-pass-" + suffix;
        jdbc.update(
                "INSERT INTO users (email, password_hash, display_name, email_verified, verified_at) VALUES (?, ?, ?, 1, NOW())",
                email, passwordEncoder.encode(password), "qa-066-" + tag + "-" + suffix);
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

    private void insertV1Row(long userId) {
        jdbc.update(
                "INSERT INTO lobby_layouts (user_id, shape_version, layout_json, created_at, updated_at) "
                        + "VALUES (?, 1, ?, NOW(6), NOW(6))",
                userId, V1_LAYOUT_JSON);
        assertThat(rowsOf(userId)).as("setup: v1 row of user %s", userId).isEqualTo(1);
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

    private int shapeVersionOf(long userId) {
        return jdbc.queryForObject("SELECT shape_version FROM lobby_layouts WHERE user_id = ?", Integer.class, userId);
    }

    private URI uri(String path) {
        return URI.create(rest.getRootUri() + path);
    }
}
