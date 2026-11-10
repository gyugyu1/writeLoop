package com.writeloop.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * [spec] 작업 066 ⑥ 방 구조 데이터(07-방-구조-데이터/01-main-spec.md 1, 02-qa-scenarios.md 가·나, 05-main-decision.md 3)를
 * 서버의 방 데이터로 확인한다.
 *
 * <ul>
 *   <li>RS: 기본 방 basic(8×11, 벽 높이 3.2, 벽 두께 0.4, 거는 벽 뒷벽·왼벽·오른벽, 밖으로 출입구 하나: 가운데 x 4·폭 2.0·깊이 0.7),
 *       방 목록은 기본 방 하나, 지금 방은 늘 기본 방.</li>
 *   <li>RV: 최소 크기(8×11)보다 작거나, 칸 수가 정수가 아니거나, 밖으로 출입구가 정확히 하나가 아니거나,
 *       입구 발판이 앞끝 밖으로 나가면 만들기가 실패한다. 발판 끝이 앞끝 끝과 딱 맞으면 받는다(결정 05-3).
 *       거절의 모양(예외 종류·메시지)은 명세에 없어 실패하는지만 본다.</li>
 * </ul>
 */
class LobbyRoomSpecTest {

    private static final List<String> HANG_WALLS = List.of("back", "left", "right");

    private static LobbyRoom room(double width, double depth, List<LobbyRoom.Exit> exits) {
        return new LobbyRoom("qa-test", width, depth, 3.2, 0.4, HANG_WALLS, exits);
    }

    private static LobbyRoom.OutsideExit step(double x) {
        return new LobbyRoom.OutsideExit(x, 2.0, 0.7);
    }

    // ---------- 가. 기본 방과 방 목록 ----------

    @Test
    void rs1_basicRoomIsTheCurrentRoomSize() {
        LobbyRoom basic = LobbyRoom.BASIC;

        assertThat(basic.id()).isEqualTo("basic");
        assertThat(basic.width()).isEqualTo(8.0);
        assertThat(basic.depth()).isEqualTo(11.0);
        assertThat(basic.wallHeight()).isEqualTo(3.2);
        assertThat(basic.wallThickness()).isEqualTo(0.4);
    }

    @Test
    void rs2_basicRoomHangsOnBackLeftAndRightWallsOnly() {
        assertThat(LobbyRoom.BASIC.hangWalls()).containsExactlyInAnyOrder("back", "left", "right");
    }

    @Test
    void rs3_basicRoomHasOneOutsideExitAtTheFrontMiddle() {
        List<LobbyRoom.Exit> exits = LobbyRoom.BASIC.exits();

        assertThat(exits).hasSize(1);
        assertThat(exits.get(0)).isInstanceOf(LobbyRoom.OutsideExit.class);
        LobbyRoom.OutsideExit exit = (LobbyRoom.OutsideExit) exits.get(0);
        assertThat(exit.x()).isEqualTo(4.0);
        assertThat(exit.width()).isEqualTo(2.0);
        assertThat(exit.depth()).isEqualTo(0.7);
    }

    @Test
    void rs4_roomListIsOnlyTheBasicRoom() {
        assertThat(LobbyRoom.ROOMS).hasSize(1);
        assertThat(LobbyRoom.ROOMS.get(0).id()).isEqualTo("basic");
        assertThat(LobbyRoom.ROOMS.get(0)).isEqualTo(LobbyRoom.BASIC);
    }

    @Test
    void rs5_currentRoomIsAlwaysBasic() {
        assertThat(LobbyRoom.current().id()).isEqualTo("basic");
        assertThat(LobbyRoom.current()).isEqualTo(LobbyRoom.BASIC);
    }

    // ---------- 나. 방 만들기 검사 ----------

    @Test
    void rv1_minimumSizeRoomIsCreated() {
        LobbyRoom created = room(8, 11, List.of(step(4)));

        assertThat(created.width()).isEqualTo(8.0);
        assertThat(created.depth()).isEqualTo(11.0);
        assertThat(((LobbyRoom.OutsideExit) created.exits().get(0)).x()).isEqualTo(4.0);
    }

    @Test
    void rv2_largerRoomIsCreated() {
        LobbyRoom created = room(10, 12, List.of(step(5)));

        assertThat(created.width()).isEqualTo(10.0);
        assertThat(created.depth()).isEqualTo(12.0);
        assertThat(created.exits()).hasSize(1);
        LobbyRoom.OutsideExit exit = (LobbyRoom.OutsideExit) created.exits().get(0);
        assertThat(exit.x()).isEqualTo(5.0);
        assertThat(exit.width()).isEqualTo(2.0);
        assertThat(exit.depth()).isEqualTo(0.7);
    }

    @Test
    void rv3_narrowerThanMinimumIsRejected() {
        assertThatThrownBy(() -> room(7, 11, List.of(step(3.5)))).isInstanceOf(RuntimeException.class);
    }

    @Test
    void rv4_shallowerThanMinimumIsRejected() {
        assertThatThrownBy(() -> room(8, 10, List.of(step(4)))).isInstanceOf(RuntimeException.class);
    }

    @Test
    void rv5_narrowButDeepIsRejected() {
        assertThatThrownBy(() -> room(7, 20, List.of(step(3.5)))).isInstanceOf(RuntimeException.class);
    }

    @Test
    void rv6_wideButShallowIsRejected() {
        assertThatThrownBy(() -> room(20, 10, List.of(step(10)))).isInstanceOf(RuntimeException.class);
    }

    @Test
    void rv7_nonIntegerWidthIsRejected() {
        assertThatThrownBy(() -> room(8.5, 11, List.of(step(4)))).isInstanceOf(RuntimeException.class);
    }

    @Test
    void rv8_nonIntegerDepthIsRejected() {
        assertThatThrownBy(() -> room(8, 11.5, List.of(step(4)))).isInstanceOf(RuntimeException.class);
    }

    @Test
    void rv9_noExitIsRejected() {
        assertThatThrownBy(() -> room(8, 11, List.of())).isInstanceOf(RuntimeException.class);
    }

    @Test
    void rv10_twoOutsideExitsAreRejected() {
        assertThatThrownBy(() -> room(8, 11, List.of(step(2), step(6)))).isInstanceOf(RuntimeException.class);
    }

    @Test
    void rv11_onlyAnOtherRoomExitIsRejected() {
        assertThatThrownBy(() -> room(8, 11, List.of(new LobbyRoom.RoomLinkExit("upstairs"))))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void rv12_oneOutsideExitPlusAnOtherRoomExitIsNotRejectedByTheCountRule() {
        LobbyRoom created = room(8, 11, List.of(step(4), new LobbyRoom.RoomLinkExit("upstairs")));

        assertThat(created.exits()).hasSize(2);
        assertThat(created.exits().stream().filter(LobbyRoom.OutsideExit.class::isInstance).count()).isEqualTo(1);
    }

    @Test
    void rv13_stepPastTheLeftEndIsRejected() {
        assertThatThrownBy(() -> room(8, 11, List.of(step(0.5)))).isInstanceOf(RuntimeException.class);
    }

    @Test
    void rv14_stepPastTheRightEndIsRejected() {
        assertThatThrownBy(() -> room(8, 11, List.of(step(7.5)))).isInstanceOf(RuntimeException.class);
    }

    @Test
    void rv15_stepPastTheRightEndOfAWiderRoomIsRejected() {
        assertThatThrownBy(() -> room(10, 12, List.of(step(9.5)))).isInstanceOf(RuntimeException.class);
    }

    @Test
    void rv16_stepInsideTheFrontOfAWiderRoomIsCreated() {
        LobbyRoom created = room(10, 12, List.of(step(8.5)));

        assertThat(((LobbyRoom.OutsideExit) created.exits().get(0)).x()).isEqualTo(8.5);
    }

    @Test
    void rv17_stepTouchingTheFrontEndsIsCreated() {
        // 결정 05-3: 입구 발판 끝이 방 앞끝과 딱 맞으면 받는다(발판 0~2, 6~8)
        LobbyRoom left = room(8, 11, List.of(step(1.0)));
        LobbyRoom right = room(8, 11, List.of(step(7.0)));

        assertThat(((LobbyRoom.OutsideExit) left.exits().get(0)).x()).isEqualTo(1.0);
        assertThat(((LobbyRoom.OutsideExit) right.exits().get(0)).x()).isEqualTo(7.0);
    }
}
