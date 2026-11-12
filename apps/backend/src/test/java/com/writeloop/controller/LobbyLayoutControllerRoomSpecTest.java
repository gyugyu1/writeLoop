package com.writeloop.controller;

import static com.writeloop.controller.LobbyLayoutControllerSpecTest.assertSameLayout;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.floorPiece;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.names;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.p0;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.p1;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.wallPiece;
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
import java.util.LinkedHashMap;
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
 * [spec] 작업 066 ⑥ 방 구조 데이터(07-방-구조-데이터/01-main-spec.md 2·4, 02-qa-scenarios.md 다 RA-1~14)에서
 * 서버의 방 크기 검사가 지금 방(기본 방 8×11)의 데이터를 읽게 바뀐 뒤에도 로비 배치 API의 결과가 지금과 같은지 실제 서버로 확인한다.
 *
 * <ul>
 *   <li>바닥 가운데 점 x 0~8·z 0~11, 뒷벽 along 0~8, 옆벽 along 0~11(경계 포함). 그 밖은 400 INVALID_LOBBY_LAYOUT "가구 자리가 방 밖이에요."</li>
 *   <li>벽 front는 400 "벽은 back·left·right 중 하나여야 해요."</li>
 *   <li>저장 형식(v2) 그대로: 맨 위 room 키는 받지 않고, 응답·GET·DB에 방을 가리키는 값이 없다.</li>
 *   <li>거절된 저장은 앞 배치(P1)를 바꾸지 않는다.</li>
 * </ul>
 * 테스트마다 새 이메일 사용자를 만들고 자기 데이터만 확인한다.
 */
class LobbyLayoutControllerRoomSpecTest extends IntegrationTestSupport {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String PATH = "/api/lobby-layout";
    private static final String INVALID_CODE = "INVALID_LOBBY_LAYOUT";
    private static final String OUTSIDE_MESSAGE = "가구 자리가 방 밖이에요.";
    private static final String WALL_MESSAGE = "벽은 back·left·right 중 하나여야 해요.";
    private static final String SHAPE_MESSAGE = "가구 배치 모양이 맞지 않아요.";

    @Autowired
    private PasswordEncoder passwordEncoder;

    private final HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();

    // ---------- 받는 배치 ----------

    @Test
    void ra1_p0IsSavedAndLoadedAsIs() throws Exception {
        TestUser user = newUser("ra1");
        ObjectNode layout = p0();

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("RA-1 PUT, body %s", save.body()).isEqualTo(200);
        assertSameLayout(layout, JSON.readTree(save.body()), "RA-1 save");
        assertThat(load.statusCode()).as("RA-1 GET, body %s", load.body()).isEqualTo(200);
        assertSameLayout(layout, JSON.readTree(load.body()), "RA-1 load");
    }

    @Test
    void ra2_floorBoundaryOfTheBasicRoomIsAccepted() throws Exception {
        assertAccepted("RA-2", l -> {
            floorPiece(l, "wardrobe").put("x", 8.0).put("z", 11.0);
            floorPiece(l, "rug").put("x", 0.0).put("z", 0.0);
        });
    }

    @Test
    void ra7_wallBoundaryOfTheBasicRoomIsAccepted() throws Exception {
        assertAccepted("RA-7", l -> {
            wallPiece(l, "board").put("wall", "back").put("along", 8.0);
            wallPiece(l, "window").put("wall", "left").put("along", 11.0);
        });
    }

    @Test
    void ra10_sideWallAlongBeyondTheWidthIsAccepted() throws Exception {
        assertAccepted("RA-10", l -> wallPiece(l, "window").put("wall", "right").put("along", 8.5));
    }

    // ---------- 거절 ----------

    static Stream<Arguments> rejectedLayouts() {
        return Stream.of(
                rejected("RA-3 wardrobe x 8.0001", OUTSIDE_MESSAGE, l -> floorPiece(l, "wardrobe").put("x", 8.0001)),
                rejected("RA-4 wardrobe z 11.0001", OUTSIDE_MESSAGE, l -> floorPiece(l, "wardrobe").put("z", 11.0001)),
                rejected("RA-5 rug x -0.0001", OUTSIDE_MESSAGE, l -> floorPiece(l, "rug").put("x", -0.0001)),
                rejected("RA-6 rug z -0.0001", OUTSIDE_MESSAGE, l -> floorPiece(l, "rug").put("z", -0.0001)),
                rejected("RA-8 board back along 8.0001", OUTSIDE_MESSAGE,
                        l -> wallPiece(l, "board").put("wall", "back").put("along", 8.0001)),
                rejected("RA-9 window right along 11.0001", OUTSIDE_MESSAGE,
                        l -> wallPiece(l, "window").put("wall", "right").put("along", 11.0001)),
                rejected("RA-11 board wall front", WALL_MESSAGE, l -> wallPiece(l, "board").put("wall", "front")),
                rejected("RA-12 top-level room key", SHAPE_MESSAGE, l -> l.put("room", "basic"))
        );
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("rejectedLayouts")
    void ra_rejectedLayoutIs400AndThePreviousLayoutStays(String name, String message, Consumer<ObjectNode> change)
            throws Exception {
        TestUser user = newUser("rar");
        assertThat(put(user.token(), p1()).statusCode()).as("setup: save P1").isEqualTo(200);
        ObjectNode layout = p0();
        change.accept(layout);

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("%s: PUT %s -> body %s", name, layout, save.body()).isEqualTo(400);
        JsonNode error = JSON.readTree(save.body());
        assertThat(error.path("code").asText()).as("%s: error code, body %s", name, save.body()).isEqualTo(INVALID_CODE);
        assertThat(error.path("message").asText()).as("%s: error message, body %s", name, save.body()).isEqualTo(message);
        assertThat(load.statusCode()).as("%s: GET after rejected save, body %s", name, load.body()).isEqualTo(200);
        assertSameLayout(p1(), JSON.readTree(load.body()), name);
    }

    // ---------- 저장 형식 ----------

    @Test
    void ra13_savedFormatHasNoRoomAnywhere() throws Exception {
        TestUser user = newUser("ra13");

        HttpResponse<String> save = put(user.token(), p0());
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("RA-13 PUT, body %s", save.body()).isEqualTo(200);
        JsonNode saved = JSON.readTree(save.body());
        JsonNode loaded = JSON.readTree(load.body());
        assertThat(names(saved)).as("RA-13 save keys").isEqualTo(Set.of("version", "items"));
        assertThat(saved.get("version").asInt()).isEqualTo(2);
        assertThat(names(loaded)).as("RA-13 load keys").isEqualTo(Set.of("version", "items"));
        assertThat(loaded.get("version").asInt()).isEqualTo(2);

        Integer shapeVersion = jdbc.queryForObject(
                "SELECT shape_version FROM lobby_layouts WHERE user_id = ?", Integer.class, user.id());
        String layoutJson = jdbc.queryForObject(
                "SELECT layout_json FROM lobby_layouts WHERE user_id = ?", String.class, user.id());
        assertThat(shapeVersion).isEqualTo(2);
        JsonNode stored = JSON.readTree(layoutJson);
        assertThat(names(stored)).as("RA-13 layout_json keys of %s", layoutJson).isEqualTo(Set.of("items"));
        assertThat(layoutJson).as("RA-13 layout_json has no room").doesNotContain("room").doesNotContain("basic");
        assertThat(save.body()).as("RA-13 save body has no room").doesNotContain("room").doesNotContain("basic");
        assertThat(load.body()).as("RA-13 load body has no room").doesNotContain("room").doesNotContain("basic");
    }

    @Test
    void ra14_storedIsKeptInTheSameFormat() throws Exception {
        TestUser user = newUser("ra14");
        ObjectNode layout = p0();
        ArrayNode stored = layout.putArray("stored");
        stored.addObject().put("id", "rug-9").put("type", "rug");

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("RA-14 PUT, body %s", save.body()).isEqualTo(200);
        assertThat(load.statusCode()).as("RA-14 GET, body %s", load.body()).isEqualTo(200);
        for (JsonNode body : new JsonNode[] {JSON.readTree(save.body()), JSON.readTree(load.body())}) {
            assertThat(names(body)).as("RA-14 keys of %s", body).isEqualTo(Set.of("version", "items", "stored"));
            assertThat(body.get("version").asInt()).isEqualTo(2);
            assertThat(body.get("items").size()).isEqualTo(6);
            assertThat(body.get("stored")).as("RA-14 stored of %s", body).isEqualTo(JSON.readTree("[{\"id\":\"rug-9\",\"type\":\"rug\"}]"));
        }
    }

    // ---------- 도움 ----------

    private void assertAccepted(String label, Consumer<ObjectNode> change) throws Exception {
        TestUser user = newUser(label.toLowerCase().replace("-", ""));
        ObjectNode layout = p0();
        change.accept(layout);

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("%s PUT %s, body %s", label, layout, save.body()).isEqualTo(200);
        assertThat(load.statusCode()).as("%s GET, body %s", label, load.body()).isEqualTo(200);
        assertSameLayout(layout, JSON.readTree(load.body()), label);
    }

    private static Arguments rejected(String name, String message, Consumer<ObjectNode> change) {
        return Arguments.of(name, message, change);
    }

    // 작업 086 ② 결정 1: 배치를 저장하기 전에 그 계정이 필요한 가구를 산 것으로 준비한다(put에서). 토큰으로 계정을 찾는다
    private final Map<String, Long> userIdByToken = new LinkedHashMap<>();

    private record TestUser(long id, String email, String password, String token) {
    }

    private TestUser newUser(String tag) throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        String email = "qa-066r-" + tag + "-" + suffix + "@example.com";
        String password = "qa-pass-" + suffix;
        jdbc.update(
                "INSERT INTO users (email, password_hash, display_name, email_verified, verified_at) VALUES (?, ?, ?, 1, NOW())",
                email, passwordEncoder.encode(password), "qa-066r-" + tag + "-" + suffix);
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
        return client.send(HttpRequest.newBuilder(uri(PATH)).header("Authorization", "Bearer " + token).GET().build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> put(String token, JsonNode layout) throws Exception {
        LobbyLayoutPurchasePrep.ownEnoughFor(jdbc, token == null ? null : userIdByToken.get(token), layout);
        return client.send(HttpRequest.newBuilder(uri(PATH))
                        .header("Content-Type", "application/json")
                        .header("Authorization", "Bearer " + token)
                        .PUT(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(layout)))
                        .build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private URI uri(String path) {
        return URI.create(rest.getRootUri() + path);
    }
}
