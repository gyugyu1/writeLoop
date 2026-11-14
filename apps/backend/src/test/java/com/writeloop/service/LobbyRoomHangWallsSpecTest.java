package com.writeloop.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.Mockito.mock;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.writeloop.exception.ApiException;
import com.writeloop.persistence.LobbyLayoutRepository;
import java.util.List;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/**
 * [spec] 작업 066 ⑥ 방 구조 데이터, 검증(10-qa-verify.md 의심 1·4) 뒤 결정(11-main-decision.md 1·2)으로 바뀐 서버 동작.
 *
 * <ul>
 *   <li>HW(결정 1, 명세 1의 잘못된 방에 더함): 걸 수 있는 벽이 하나도 없거나, 모르는 벽 이름(back·left·right 밖)이 들어 있으면
 *       방을 만들 수 없다. 거절의 모양(예외 종류·메시지)은 정해지지 않아 실패하는지만 본다. 테스트 커밋 시점(고치기 전)에 실패가 맞다.</li>
 *   <li>HM(결정 2 의심 4): 걸 수 없는 벽에 건 가구를 거절할 때 안내 문구가 그 방의 걸 수 있는 벽 목록을 담는다.
 *       뒷벽·왼벽에만 거는 방에서 오른벽을 거절하면 문구에 back·left가 있고 right가 없다(고치기 전 실패가 맞다).
 *       기본 방의 문구는 그대로 "벽은 back·left·right 중 하나여야 해요."다(통과가 맞다).</li>
 * </ul>
 */
class LobbyRoomHangWallsSpecTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String INVALID_CODE = "INVALID_LOBBY_LAYOUT";
    private static final String BASIC_WALL_MESSAGE = "벽은 back·left·right 중 하나여야 해요.";

    /** 뒷벽·왼벽에만 거는 시험용 방(10×12, 입구 발판 가운데 x 5). */
    private static final LobbyRoom ROOM_BACK_LEFT = new LobbyRoom("qa-back-left", 10, 12, 3.2, 0.4,
            List.of("back", "left"), List.of(new LobbyRoom.OutsideExit(5, 2.0, 0.7)));

    private final LobbyLayoutService service = new LobbyLayoutService(mock(LobbyLayoutRepository.class), JSON);

    private static LobbyRoom roomWithHangWalls(List<String> hangWalls) {
        return new LobbyRoom("qa-hang", 8, 11, 3.2, 0.4, hangWalls, List.of(new LobbyRoom.OutsideExit(4, 2.0, 0.7)));
    }

    // ---------- 결정 1: 걸 수 있는 벽 규칙 ----------

    @Test
    void hw1_roomWithNoHangWallIsRejected() {
        assertThatThrownBy(() -> roomWithHangWalls(List.of())).isInstanceOf(RuntimeException.class);
    }

    @Test
    void hw2_roomWithTheFrontWallIsRejected() {
        assertThatThrownBy(() -> roomWithHangWalls(List.of("back", "front"))).isInstanceOf(RuntimeException.class);
    }

    @Test
    void hw3_roomWithAnUnknownWallNameBesideTheThreeIsRejected() {
        assertThatThrownBy(() -> roomWithHangWalls(List.of("back", "left", "right", "ceiling")))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void hw4_roomWithAnUpperCaseWallNameIsRejected() {
        assertThatThrownBy(() -> roomWithHangWalls(List.of("Back", "left"))).isInstanceOf(RuntimeException.class);
    }

    // ---------- 결정 2 의심 4: 걸 수 없는 벽의 안내 문구 ----------

    // 작업 093(창문 붙박이, 01-main-spec.md "고칠 기존 테스트"): 창문은 뒷벽 4.8에서 옮길 수 없게 되어,
    // 걸 수 없는 벽의 안내 문구를 창문 대신 게시판으로 확인한다(창문 붙박이 거절이 먼저 나면 문구를 볼 수 없다).
    @Test
    void hm1_rejectingTheRightWallInABackLeftRoomNamesOnlyThatRoomsWalls() {
        ApiException error = catchThrowableOfType(ApiException.class,
                () -> service.parse(p0(l -> wall(l, "board").put("wall", "right").put("along", 5.0)), ROOM_BACK_LEFT));

        assertThat(error).as("parse should reject board on the right wall").isNotNull();
        assertThat(error.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(error.getCode()).isEqualTo(INVALID_CODE);
        assertThat(error.getMessage()).as("message %s", error.getMessage())
                .contains("back")
                .contains("left")
                .doesNotContain("right");
    }

    @Test
    void hm2_basicRoomMessageStaysTheSame() {
        ApiException error = catchThrowableOfType(ApiException.class,
                () -> service.parse(p0(l -> wall(l, "board").put("wall", "front")), LobbyRoom.BASIC));

        assertThat(error).as("parse should reject board on the front wall").isNotNull();
        assertThat(error.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(error.getCode()).isEqualTo(INVALID_CODE);
        assertThat(error.getMessage()).isEqualTo(BASIC_WALL_MESSAGE);
    }

    // ---------- 도움 ----------

    /** 기존 테스트의 P0(책상 1.5·5.5, 책장 0.5·2.5, 옷장 7.5·3.5, 깔개 4.6·7.2, 게시판 뒷벽 1.8, 창문 뒷벽 4.8)에서 한 값만 바꾼다. */
    private static ObjectNode p0(Consumer<ObjectNode> change) {
        ObjectNode layout = JSON.createObjectNode();
        layout.put("version", 2);
        ArrayNode items = layout.putArray("items");
        items.add(floorItem("desk", "desk", 1.5, 5.5, 0));
        items.add(floorItem("bookcase", "bookcase", 0.5, 2.5, 1));
        items.add(floorItem("wardrobe", "wardrobe", 7.5, 3.5, 3));
        items.add(floorItem("rug", "rug", 4.6, 7.2, 0));
        items.add(wallItem("board", "board", "back", 1.8));
        items.add(wallItem("window", "window", "back", 4.8));
        change.accept(layout);
        return layout;
    }

    private static ObjectNode floorItem(String id, String type, double x, double z, int facing) {
        ObjectNode node = JSON.createObjectNode();
        node.put("id", id);
        node.put("type", type);
        ObjectNode floor = node.putObject("floor");
        floor.put("x", x);
        floor.put("z", z);
        floor.put("facing", facing);
        return node;
    }

    private static ObjectNode wallItem(String id, String type, String wall, double along) {
        ObjectNode node = JSON.createObjectNode();
        node.put("id", id);
        node.put("type", type);
        ObjectNode spot = node.putObject("wall");
        spot.put("wall", wall);
        spot.put("along", along);
        return node;
    }

    private static ObjectNode wall(ObjectNode layout, String id) {
        for (var node : layout.withArray("items")) {
            if (id.equals(node.path("id").asText())) {
                return (ObjectNode) node.get("wall");
            }
        }
        throw new IllegalArgumentException("no item " + id);
    }
}
