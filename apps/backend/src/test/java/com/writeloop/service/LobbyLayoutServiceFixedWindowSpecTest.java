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
 * [spec] 작업 093 창문 붙박이(01-main-spec.md), 배치 본문 검사(LobbyLayoutService.parse)와 처음 배치.
 *
 * <ul>
 *   <li>FU-R(바뀔 동작, 명세 1·4): 창문은 늘 뒷벽 4.8이다. 방 크기가 기본 방과 달라도 창문이 뒷벽 4.8이 아니면
 *       400 INVALID_LOBBY_LAYOUT으로 거절한다(지금의 다른 잘못된 배치와 같은 오류). 문구는 명세에 없어 보지 않는다. 고치기 전에는 받으므로 실패가 맞다.</li>
 *   <li>FU-K(그대로 둘 동작): 창문이 뒷벽 4.8이면 다른 벽 가구를 옮긴 배치를 받는다. 처음 배치의 창문은 뒷벽 4.8이다.</li>
 * </ul>
 * 배치는 기존 테스트의 P0(책상 1.5·5.5, 책장 0.5·2.5, 옷장 7.5·3.5, 깔개 4.6·7.2, 게시판 뒷벽 1.8, 창문 뒷벽 4.8)에서 바꾼다.
 */
class LobbyLayoutServiceFixedWindowSpecTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String INVALID_CODE = "INVALID_LOBBY_LAYOUT";

    /** 시험용 방 T: 10×12, 세 벽에 건다(LobbyLayoutServiceRoomSpecTest와 같은 값). */
    private static final LobbyRoom ROOM_T = new LobbyRoom("qa-t", 10, 12, 3.2, 0.4,
            List.of("back", "left", "right"), List.of(new LobbyRoom.OutsideExit(5, 2.0, 0.7)));

    private final LobbyLayoutService service = new LobbyLayoutService(mock(LobbyLayoutRepository.class), JSON);

    // ---------- FU-R: 바뀔 동작 ----------

    @Test
    void fuR1_windowBack5InTheBasicRoomIsRejected() {
        assertRejected(p0(l -> wall(l, "window").put("wall", "back").put("along", 5.0)), LobbyRoom.BASIC);
    }

    @Test
    void fuR2_windowOnTheLeftWallInTheBasicRoomIsRejected() {
        assertRejected(p0(l -> wall(l, "window").put("wall", "left").put("along", 4.8)), LobbyRoom.BASIC);
    }

    @Test
    void fuR3_windowBack10InRoomTIsRejected() {
        assertRejected(p0(l -> wall(l, "window").put("wall", "back").put("along", 10.0)), ROOM_T);
    }

    @Test
    void fuR4_windowOnTheRightWallInRoomTIsRejected() {
        assertRejected(p0(l -> wall(l, "window").put("wall", "right").put("along", 4.8)), ROOM_T);
    }

    // ---------- FU-K: 그대로 둘 동작 ----------

    @Test
    void fuK1_windowAtBack48WithBoardAndFrameMovedIsAcceptedInTheBasicRoom() {
        LobbyLayoutDto parsed = service.parse(p0(l -> {
            wall(l, "board").put("wall", "right").put("along", 6.2);
            l.withArray("items").add(wallItem("frame-1", "frame", "left", 2.0));
        }), LobbyRoom.BASIC);

        assertThat(item(parsed, "window").wall().wall()).isEqualTo("back");
        assertThat(item(parsed, "window").wall().along()).isEqualTo(4.8);
        assertThat(item(parsed, "board").wall().wall()).isEqualTo("right");
        assertThat(item(parsed, "board").wall().along()).isEqualTo(6.2);
        assertThat(item(parsed, "frame-1").wall().wall()).isEqualTo("left");
        assertThat(item(parsed, "frame-1").wall().along()).isEqualTo(2.0);
    }

    @Test
    void fuK2_windowAtBack48IsAcceptedInRoomT() {
        LobbyLayoutDto parsed = service.parse(p0(l -> wall(l, "board").put("wall", "left").put("along", 12.0)), ROOM_T);

        assertThat(item(parsed, "window").wall().wall()).isEqualTo("back");
        assertThat(item(parsed, "window").wall().along()).isEqualTo(4.8);
        assertThat(item(parsed, "board").wall().wall()).isEqualTo("left");
        assertThat(item(parsed, "board").wall().along()).isEqualTo(12.0);
    }

    @Test
    void fuK3_defaultLayoutKeepsTheWindowAtBack48() {
        List<LobbyLayoutDto.Item> windows = LobbyLayoutService.DEFAULT_LAYOUT.items().stream()
                .filter(i -> i.type().equals("window"))
                .toList();

        assertThat(windows).hasSize(1);
        assertThat(windows.get(0).id()).isEqualTo("window");
        assertThat(windows.get(0).floor()).isNull();
        assertThat(windows.get(0).wall().wall()).isEqualTo("back");
        assertThat(windows.get(0).wall().along()).isEqualTo(4.8);
    }

    // ---------- 도움 ----------

    private void assertRejected(ObjectNode layout, LobbyRoom room) {
        ApiException error = catchThrowableOfType(ApiException.class, () -> service.parse(layout, room));

        assertThat(error).as("parse should reject %s in room %s", layout, room.id()).isNotNull();
        assertThat(error.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(error.getCode()).isEqualTo(INVALID_CODE);
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

    private static ObjectNode wall(ObjectNode layout, String id) {
        for (var node : layout.withArray("items")) {
            if (id.equals(node.path("id").asText())) {
                return (ObjectNode) node.get("wall");
            }
        }
        throw new IllegalArgumentException("no item " + id);
    }

    private static LobbyLayoutDto.Item item(LobbyLayoutDto layout, String id) {
        return layout.items().stream().filter(i -> i.id().equals(id)).findFirst().orElseThrow();
    }
}
