package com.writeloop.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.Mockito.mock;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.writeloop.dto.LobbyLayoutDto;
import com.writeloop.exception.ApiException;
import com.writeloop.persistence.LobbyLayoutRepository;
import java.util.List;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/**
 * [spec] 작업 066 ⑥ 방 구조 데이터에서 서버의 배치 검사가 받은 방의 크기와 걸 수 있는 벽을 읽는지(07-방-구조-데이터/01-main-spec.md 2,
 * 02-qa-scenarios.md 라, 05-main-decision.md 1)를 시험용 방으로 확인한다.
 *
 * <ul>
 *   <li>RT: 시험용 방 T(10×12)에서 바닥 가운데 점 x 0~10·z 0~12, 뒷벽 along 0~10, 옆벽 along 0~12는 받고, 그 밖은
 *       400 INVALID_LOBBY_LAYOUT "가구 자리가 방 밖이에요."로 거절한다. 같은 배치를 기본 방으로 검사하면 기본 방 크기로 거절한다.</li>
 *   <li>RW: 걸 수 없는 벽에 건 가구는 저장 본문 검사가 거절한다(결정 05-1). 메시지는 결정에 없어 보지 않는다.</li>
 * </ul>
 * 배치는 기존 테스트의 P0(책상 1.5·5.5, 책장 0.5·2.5, 옷장 7.5·3.5, 깔개 4.6·7.2, 게시판 뒷벽 1.8, 창문 뒷벽 4.8)에서 한 값만 바꾼다.
 */
class LobbyLayoutServiceRoomSpecTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String INVALID_CODE = "INVALID_LOBBY_LAYOUT";
    private static final String OUTSIDE_MESSAGE = "가구 자리가 방 밖이에요.";

    /** 시험용 방 T: 10×12, 세 벽에 건다, 입구 발판 가운데 x 5. */
    private static final LobbyRoom ROOM_T = new LobbyRoom("qa-t", 10, 12, 3.2, 0.4,
            List.of("back", "left", "right"), List.of(new LobbyRoom.OutsideExit(5, 2.0, 0.7)));

    /** 결정 05-1 시험용 방: 10×12, 뒷벽·왼벽에만 건다. */
    private static final LobbyRoom ROOM_NO_RIGHT = new LobbyRoom("qa-no-right", 10, 12, 3.2, 0.4,
            List.of("back", "left"), List.of(new LobbyRoom.OutsideExit(5, 2.0, 0.7)));

    private final LobbyLayoutService service = new LobbyLayoutService(mock(LobbyLayoutRepository.class), JSON);

    // ---------- 라. 시험용 방 T ----------

    @Test
    void rt1_floorBoundaryOfRoomTIsAccepted() {
        LobbyLayoutDto parsed = service.parse(p0(l -> floor(l, "wardrobe").put("x", 10.0).put("z", 12.0)), ROOM_T);

        LobbyLayoutDto.Item wardrobe = item(parsed, "wardrobe");
        assertThat(wardrobe.floor().x()).isEqualTo(10.0);
        assertThat(wardrobe.floor().z()).isEqualTo(12.0);
    }

    @Test
    void rt2_floorXPastRoomTIsRejected() {
        assertOutside(p0(l -> floor(l, "wardrobe").put("x", 10.0001)), ROOM_T);
    }

    @Test
    void rt3_floorZPastRoomTIsRejected() {
        assertOutside(p0(l -> floor(l, "wardrobe").put("z", 12.0001)), ROOM_T);
    }

    @Test
    void rt4_wallBoundaryOfRoomTIsAccepted() {
        LobbyLayoutDto parsed = service.parse(p0(l -> {
            wall(l, "board").put("wall", "back").put("along", 10.0);
            wall(l, "window").put("wall", "left").put("along", 12.0);
        }), ROOM_T);

        assertThat(item(parsed, "board").wall().wall()).isEqualTo("back");
        assertThat(item(parsed, "board").wall().along()).isEqualTo(10.0);
        assertThat(item(parsed, "window").wall().wall()).isEqualTo("left");
        assertThat(item(parsed, "window").wall().along()).isEqualTo(12.0);
    }

    @Test
    void rt5_backWallAlongPastRoomTIsRejected() {
        assertOutside(p0(l -> wall(l, "board").put("wall", "back").put("along", 10.0001)), ROOM_T);
    }

    @Test
    void rt6_rightWallAlongPastRoomTIsRejected() {
        assertOutside(p0(l -> wall(l, "window").put("wall", "right").put("along", 12.0001)), ROOM_T);
    }

    @Test
    void rt7_theSameLayoutCheckedWithTheBasicRoomIsRejected() {
        assertOutside(p0(l -> floor(l, "wardrobe").put("x", 10.0)), LobbyRoom.BASIC);
    }

    // ---------- 결정 05-1: 걸 수 없는 벽 ----------

    @Test
    void rw1_windowOnAWallThatCannotHangIsRejected() {
        ApiException error = catchThrowableOfType(ApiException.class,
                () -> service.parse(p0(l -> wall(l, "window").put("wall", "right").put("along", 5.0)), ROOM_NO_RIGHT));

        assertThat(error).as("parse should reject window on the right wall").isNotNull();
        assertThat(error.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(error.getCode()).isEqualTo(INVALID_CODE);
    }

    @Test
    void rw2_boardOnAWallThatCannotHangIsRejected() {
        ApiException error = catchThrowableOfType(ApiException.class,
                () -> service.parse(p0(l -> wall(l, "board").put("wall", "right").put("along", 3.0)), ROOM_NO_RIGHT));

        assertThat(error).as("parse should reject board on the right wall").isNotNull();
        assertThat(error.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(error.getCode()).isEqualTo(INVALID_CODE);
    }

    @Test
    void rw3_wallsThatCanHangStillAcceptInTheSameRoom() {
        LobbyLayoutDto parsed = service.parse(p0(l -> wall(l, "window").put("wall", "left").put("along", 5.0)), ROOM_NO_RIGHT);

        assertThat(item(parsed, "window").wall().wall()).isEqualTo("left");
        assertThat(item(parsed, "window").wall().along()).isEqualTo(5.0);
        assertThat(item(parsed, "board").wall().wall()).isEqualTo("back");
        assertThat(item(parsed, "board").wall().along()).isEqualTo(1.8);
    }

    @Test
    void rw4_theRightWallStillAcceptsInTheBasicRoom() {
        LobbyLayoutDto parsed = service.parse(p0(l -> wall(l, "window").put("wall", "right").put("along", 5.0)), LobbyRoom.BASIC);

        assertThat(item(parsed, "window").wall().wall()).isEqualTo("right");
        assertThat(item(parsed, "window").wall().along()).isEqualTo(5.0);
    }

    // ---------- 도움 ----------

    private void assertOutside(ObjectNode layout, LobbyRoom room) {
        ApiException error = catchThrowableOfType(ApiException.class, () -> service.parse(layout, room));

        assertThat(error).as("parse should reject %s in room %s", layout, room.id()).isNotNull();
        assertThat(error.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(error.getCode()).isEqualTo(INVALID_CODE);
        assertThat(error.getMessage()).isEqualTo(OUTSIDE_MESSAGE);
    }

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

    private static ObjectNode itemNode(ObjectNode layout, String id) {
        for (var node : layout.withArray("items")) {
            if (id.equals(node.path("id").asText())) {
                return (ObjectNode) node;
            }
        }
        throw new IllegalArgumentException("no item " + id);
    }

    private static ObjectNode floor(ObjectNode layout, String id) {
        return (ObjectNode) itemNode(layout, id).get("floor");
    }

    private static ObjectNode wall(ObjectNode layout, String id) {
        return (ObjectNode) itemNode(layout, id).get("wall");
    }

    private static LobbyLayoutDto.Item item(LobbyLayoutDto layout, String id) {
        return layout.items().stream().filter(i -> i.id().equals(id)).findFirst().orElseThrow();
    }
}
