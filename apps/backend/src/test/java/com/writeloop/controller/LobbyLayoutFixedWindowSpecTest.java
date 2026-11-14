package com.writeloop.controller;

import static com.writeloop.controller.LobbyLayoutControllerSpecTest.assertSameLayout;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.items;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.p0;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.removeItem;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.wallItem;
import static com.writeloop.controller.LobbyLayoutControllerSpecTest.wallPiece;
import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.writeloop.support.IntegrationTestSupport;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.LinkedHashMap;
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
 * [spec] 작업 093 창문 붙박이(01-main-spec.md), 백엔드 배치 저장 API(PUT·GET /api/lobby-layout)를 실제 서버로 확인한다.
 *
 * <ul>
 *   <li>FW-R(바뀔 동작, 명세 바뀌는 동작 1·4): 창문이 뒷벽 4.8이 아니면 저장을 거절한다. 거절은 지금의 다른 잘못된 배치와 같은 오류 응답
 *       (400, code INVALID_LOBBY_LAYOUT)이고 앞 배치는 그대로다. 문구는 명세에 없어 보지 않는다. 고치기 전에는 200이라 실패가 맞다.</li>
 *   <li>FW-M(그대로 둘 동작, 명세 4의 "창문이 빠져 있으면"): 창문이 빠진 배치, 창문을 보관함으로 옮긴 배치는 지금도 같은 오류로 거절된다.</li>
 *   <li>FW-K(그대로 둘 동작): 창문이 뒷벽 4.8이면 다른 벽 가구(게시판·액자)를 옮긴 배치는 저장되고 그대로 불러와진다.</li>
 *   <li>FW-O(그대로 둘 동작, 지금 동작): 서버는 가구끼리 겹치는지 보지 않는다(LobbyLayoutControllerSpecTest S8). 창문 자리에 액자를 겹친 배치도 저장된다.
 *       겹침은 지금처럼 앱의 꾸미기 화면이 막는다(명세 "그대로여야 할 동작": 지금의 겹침 검사).</li>
 *   <li>FW-G(그대로 둘 동작, 04-main-decision.md "메인 세션이 정한 것"): 서버는 불러올 때 배치를 바꾸지 않는다. 창문이 다른 자리에 저장된 배치도 그대로 돌려준다.</li>
 * </ul>
 * 테스트마다 새 이메일 사용자를 만들고 자기 데이터만 확인한다. 저장 전에 보낼 배치에 필요한 가구를 산 것으로 준비한다(LobbyLayoutPurchasePrep).
 */
class LobbyLayoutFixedWindowSpecTest extends IntegrationTestSupport {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String PATH = "/api/lobby-layout";
    private static final String INVALID_CODE = "INVALID_LOBBY_LAYOUT";

    @Autowired
    private PasswordEncoder passwordEncoder;

    private final HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();

    // ---------- FW-R: 창문이 뒷벽 4.8이 아니면 거절(바뀔 동작) ----------

    static Stream<Arguments> windowMovedLayouts() {
        return Stream.of(
                Arguments.of("FW-R1 window back 4.0", (Consumer<ObjectNode>) l -> wallPiece(l, "window").put("wall", "back").put("along", 4.0)),
                Arguments.of("FW-R2 window back 5.6", (Consumer<ObjectNode>) l -> wallPiece(l, "window").put("wall", "back").put("along", 5.6)),
                Arguments.of("FW-R3 window back 0.0", (Consumer<ObjectNode>) l -> wallPiece(l, "window").put("wall", "back").put("along", 0.0)),
                Arguments.of("FW-R4 window back 8.0", (Consumer<ObjectNode>) l -> wallPiece(l, "window").put("wall", "back").put("along", 8.0)),
                Arguments.of("FW-R5 window left 4.8", (Consumer<ObjectNode>) l -> wallPiece(l, "window").put("wall", "left").put("along", 4.8)),
                Arguments.of("FW-R6 window right 4.8", (Consumer<ObjectNode>) l -> wallPiece(l, "window").put("wall", "right").put("along", 4.8)),
                Arguments.of("FW-R7 window right 6.2 (old P1)", (Consumer<ObjectNode>) l -> wallPiece(l, "window").put("wall", "right").put("along", 6.2)),
                Arguments.of("FW-R8 window left 11.0", (Consumer<ObjectNode>) l -> wallPiece(l, "window").put("wall", "left").put("along", 11.0)),
                Arguments.of("FW-R9 window back 4.5 with board moved away", (Consumer<ObjectNode>) l -> {
                    wallPiece(l, "board").put("wall", "left").put("along", 3.5);
                    wallPiece(l, "window").put("wall", "back").put("along", 4.5);
                }),
                // 04-main-decision.md "메인 세션이 정한 것": 창문은 id가 아니라 종류(type window)로 판단한다
                Arguments.of("FW-R10 window with id window-A_b on the right wall", (Consumer<ObjectNode>) l -> {
                    LobbyLayoutControllerSpecTest.item(l, "window").put("id", "window-A_b");
                    wallPiece(l, "window-A_b").put("wall", "right").put("along", 5.0);
                }));
    }

    // ---------- FW-G: 불러오기는 저장된 배치를 바꾸지 않는다(그대로 둘 동작, 04-main-decision.md "메인 세션이 정한 것") ----------

    @Test
    void fwG1_loadingAStoredLayoutWithTheWindowElsewhereReturnsItAsStored() throws Exception {
        TestUser user = newUser("fwg1");
        ObjectNode stored = p0();
        wallPiece(stored, "window").put("wall", "right").put("along", 6.2);
        ObjectNode storedJson = JSON.createObjectNode();
        storedJson.set("items", stored.get("items"));
        jdbc.update(
                "INSERT INTO lobby_layouts (user_id, shape_version, layout_json, created_at, updated_at) VALUES (?, 2, ?, NOW(6), NOW(6))",
                user.id(), JSON.writeValueAsString(storedJson));

        HttpResponse<String> load = get(user.token());

        assertThat(load.statusCode()).as("FW-G1 GET, body %s", load.body()).isEqualTo(200);
        assertSameLayout(stored, JSON.readTree(load.body()), "FW-G1");
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("windowMovedLayouts")
    void fwR_windowNotAtBack48IsRejectedAndThePreviousLayoutStays(String name, Consumer<ObjectNode> change) throws Exception {
        assertRejectedKeepingPrevious("fwr", name, change);
    }

    // ---------- FW-M: 창문이 빠지면 거절(그대로 둘 동작) ----------

    @Test
    void fwM1_layoutWithoutWindowIsRejected() throws Exception {
        assertRejectedKeepingPrevious("fwm1", "FW-M1 window missing", l -> removeItem(l, "window"));
    }

    @Test
    void fwM2_windowMovedToStorageIsRejected() throws Exception {
        assertRejectedKeepingPrevious("fwm2", "FW-M2 window moved to storage", l -> {
            removeItem(l, "window");
            l.putArray("stored").addObject().put("id", "window").put("type", "window");
        });
    }

    // ---------- FW-K: 창문이 뒷벽 4.8이면 다른 벽 가구는 지금처럼(그대로 둘 동작) ----------

    @Test
    void fwK1_windowAtBack48WithBoardMovedIsSavedAndLoaded() throws Exception {
        assertAccepted("FW-K1", l -> wallPiece(l, "board").put("wall", "right").put("along", 6.2));
    }

    @Test
    void fwK2_windowAtBack48WithFramesOnEveryWallIsSavedAndLoaded() throws Exception {
        assertAccepted("FW-K2", l -> {
            wallPiece(l, "board").put("wall", "left").put("along", 3.5);
            items(l).add(wallItem("frame-1", "frame", "back", 7.0));
            items(l).add(wallItem("frame-2", "frame", "left", 8.0));
            items(l).add(wallItem("frame-3", "frame", "right", 2.0));
        });
    }

    @Test
    void fwK3_p0IsSavedAndLoaded() throws Exception {
        assertAccepted("FW-K3", l -> {
        });
    }

    // ---------- FW-O: 서버는 겹침을 보지 않는다(그대로 둘 동작) ----------

    @Test
    void fwO1_frameOverlappingTheWindowSpotIsStillAcceptedByTheServer() throws Exception {
        assertAccepted("FW-O1", l -> items(l).add(wallItem("frame-1", "frame", "back", 4.8)));
    }

    // ---------- 도움 ----------

    /** 앞 배치(창문은 뒷벽 4.8, 게시판은 왼벽 3.5)를 저장해 두고, P0을 바꾼 배치를 보내 400 INVALID_LOBBY_LAYOUT과 앞 배치 그대로를 본다. */
    private void assertRejectedKeepingPrevious(String tag, String name, Consumer<ObjectNode> change) throws Exception {
        TestUser user = newUser(tag);
        ObjectNode previous = previousLayout();
        HttpResponse<String> setup = put(user.token(), previous);
        assertThat(setup.statusCode()).as("%s setup: save the previous layout, body %s", name, setup.body()).isEqualTo(200);
        ObjectNode layout = p0();
        change.accept(layout);

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("%s: PUT %s -> body %s", name, layout, save.body()).isEqualTo(400);
        JsonNode error = JSON.readTree(save.body());
        assertThat(error.path("code").asText()).as("%s: error code, body %s", name, save.body()).isEqualTo(INVALID_CODE);
        assertThat(load.statusCode()).as("%s: GET after rejected save, body %s", name, load.body()).isEqualTo(200);
        assertSameLayout(previous, JSON.readTree(load.body()), name);
    }

    private void assertAccepted(String label, Consumer<ObjectNode> change) throws Exception {
        TestUser user = newUser(label.toLowerCase().replace("-", ""));
        ObjectNode layout = p0();
        change.accept(layout);

        HttpResponse<String> save = put(user.token(), layout);
        HttpResponse<String> load = get(user.token());

        assertThat(save.statusCode()).as("%s PUT %s, body %s", label, layout, save.body()).isEqualTo(200);
        assertSameLayout(layout, JSON.readTree(save.body()), label + " save");
        assertThat(load.statusCode()).as("%s GET, body %s", label, load.body()).isEqualTo(200);
        assertSameLayout(layout, JSON.readTree(load.body()), label + " load");
    }

    /** 앞 배치: P0에서 게시판만 왼벽 3.5로 옮긴 것(창문은 뒷벽 4.8). */
    private static ObjectNode previousLayout() {
        ObjectNode layout = p0();
        wallPiece(layout, "board").put("wall", "left").put("along", 3.5);
        return layout;
    }

    private final Map<String, Long> userIdByToken = new LinkedHashMap<>();

    private record TestUser(long id, String email, String password, String token) {
    }

    private TestUser newUser(String tag) throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        String email = "qa-093-" + tag + "-" + suffix + "@example.com";
        String password = "qa-pass-" + suffix;
        jdbc.update(
                "INSERT INTO users (email, password_hash, display_name, email_verified, verified_at) VALUES (?, ?, ?, 1, NOW())",
                email, passwordEncoder.encode(password), "qa-093-" + tag + "-" + suffix);
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
        LobbyLayoutPurchasePrep.ownEnoughFor(jdbc, userIdByToken.get(token), layout);
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
