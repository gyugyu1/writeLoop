// 라이트루프 방의 고정 구조(방 데이터): 직사각형 방의 크기, 벽, 출입구. 방 크기와 입구는 여기서만 정하고,
// 엔진·편집 모드·3D·저장 본문 검사는 지금 방(currentRoom)의 데이터를 읽는다.
// 집 넓히기·이층집처럼 방이 바뀌는 기능은 아직 없어 지금 방은 늘 기본 방이다(계정마다 방을 기록하는 일은 그 기능 때 정한다).
// 좌표는 engine과 같다(바닥 한 칸 = 1, x는 왼쪽→오른쪽, z는 뒷벽→앞). 앞쪽(z = depth)은 카메라 쪽이라 열려 있다.

/** 벽 가구를 거는 벽. 앞쪽은 열려 있어(카메라 쪽) 걸 수 없다. */
export type WallSide = "back" | "left" | "right";

/** 밖으로 나가는 출입구: 방 앞끝 가운데쯤의 입구 발판. */
export interface OutsideExit {
  kind: "outside";
  /** 입구 발판 가운데의 가로 자리(x). */
  x: number;
  /** 입구 발판의 폭(x 방향). */
  width: number;
  /** 입구 발판이 방 앞끝에서 앞으로 나온 깊이. */
  depth: number;
}

/** 다른 방으로 가는 출입구(이층집의 계단 등). 모양과 자리 값은 그 기능 때 정한다. */
export interface RoomLinkExit {
  kind: "room";
  /** 이어지는 방의 id. */
  to: string;
}

export type RoomExit = OutsideExit | RoomLinkExit;

export interface RoomSpec {
  id: string;
  /** 가로(x)·깊이(z) 칸 수. */
  width: number;
  depth: number;
  wallHeight: number;
  /** 벽 두께. 벽 바깥면까지가 방이다(그 밖은 검정). */
  wallThickness: number;
  /** 벽 가구를 걸 수 있는 벽. */
  hangWalls: readonly WallSide[];
  exits: readonly RoomExit[];
}

/** 방의 최소 크기(기본 방). 방은 넓어지기만 해서, 처음 배치의 장소 가구를 늘 놓을 수 있다. */
export const MIN_ROOM_SIZE = { width: 8, depth: 11 } as const;

const WALL_SIDES: readonly WallSide[] = ["back", "left", "right"];

/** 방 데이터가 맞지 않는 까닭(정수 칸 수, 최소 크기, 걸 수 있는 벽 하나 이상·아는 벽, 밖으로 출입구 하나, 입구 발판이 앞끝 안). 맞으면 null. */
export function roomProblem(room: RoomSpec): string | null {
  if (!Number.isInteger(room.width) || !Number.isInteger(room.depth)) return "칸 수는 정수여야 한다";
  if (room.width < MIN_ROOM_SIZE.width || room.depth < MIN_ROOM_SIZE.depth) return "최소 크기보다 작다";
  // 최소 크기 덕에 어느 벽 하나에도 장소가 딸린 벽 가구(게시판·창문)를 함께 걸 수 있다
  if (room.hangWalls.length === 0 || !room.hangWalls.every((wall) => WALL_SIDES.includes(wall))) return "걸 수 있는 벽이 하나 이상, 아는 벽이어야 한다";
  const outside = room.exits.filter((exit): exit is OutsideExit => exit.kind === "outside");
  if (outside.length !== 1) return "밖으로 출입구는 정확히 하나여야 한다";
  const [step] = outside;
  if (!(step.width > 0) || !(step.depth > 0) || step.x - step.width / 2 < 0 || step.x + step.width / 2 > room.width) {
    return "입구 발판이 방 앞끝 밖으로 나간다";
  }
  return null;
}

/** 방 데이터를 검사해 돌려준다. 맞지 않으면 던진다. */
export function makeRoom(room: RoomSpec): RoomSpec {
  const problem = roomProblem(room);
  if (problem) throw new Error(`invalid room ${room.id}: ${problem}`);
  return room;
}

/** 기본 방: 8×11, 뒷벽·양옆 벽에 걸고, 앞 가운데 입구 발판(폭 2, 깊이 0.7)이 밖으로 가는 길이다. */
export const BASIC_ROOM: RoomSpec = makeRoom({
  id: "basic",
  width: 8,
  depth: 11,
  wallHeight: 3.2,
  wallThickness: 0.4,
  hangWalls: ["back", "left", "right"],
  exits: [{ kind: "outside", x: 4, width: 2.0, depth: 0.7 }]
});

/** 아는 방 목록. */
export const ROOMS: readonly RoomSpec[] = [BASIC_ROOM];

let current: RoomSpec = BASIC_ROOM;

/** 지금 방. 앱에서는 늘 기본 방이다(방을 바꾸는 기능이 아직 없다). */
export function currentRoom(): RoomSpec {
  return current;
}

/** 지금 방을 바꾼다. engine의 applyRoom만 부른다(엔진이 방에서 계산한 값도 함께 바꾼다). */
export function setCurrentRoom(room: RoomSpec): void {
  current = makeRoom(room);
}

/** 방의 밖으로 출입구(방마다 정확히 하나다). */
export function outsideExit(room: RoomSpec): OutsideExit {
  return room.exits.find((exit): exit is OutsideExit => exit.kind === "outside")!;
}

/** 밖으로 장소: 입구 발판 가운데를 보고(방 앞끝 너머), 방 앞끝 바로 안쪽에 선다. */
export function outsidePlace(room: RoomSpec): { faceTo: { x: number; z: number }; approach: { x: number; z: number }[] } {
  const step = outsideExit(room);
  return { faceTo: { x: step.x, z: room.depth + step.depth / 2 }, approach: [{ x: step.x, z: room.depth - 0.5 }] };
}

/** 벽을 따라간 자리의 범위(벽 길이). 뒷벽은 방 폭, 옆벽은 방 깊이다. */
export function roomWallLength(room: RoomSpec, wall: WallSide): number {
  return wall === "back" ? room.width : room.depth;
}
