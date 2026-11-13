// [spec] qa 테스트(작업 066-⑥ 방 구조 데이터, 모바일): 방 크기를 방 데이터에서 읽게 바꾼 뒤에도 기본 방에서는 값이 그대로인지(구조 변경).
// 기대값은 시나리오(private 작업 폴더 066/07-방-구조-데이터/03-qa-scenarios.md B1~B16)에서만 가져온다.
// 시나리오의 값은 기준 커밋 8cfa693의 코드로 얻은 값이다(소수 6자리 반올림).
// 방을 넘기지 않고(지금 방 = 기본 방) 부른다.
// 089-③(private 작업 폴더 089-2026-11-13-캐릭터-꾸미기/05-옷장과-꾸미기-화면/03-main-decision.md A, 사용자 결정 "qa가 새 동작에 맞게 고침")에서
// 옷장이 막는 가구가 아니라 옷장마다 하나인 장소가 되어, B11의 옷장 기대값만 새 동작(막는 가구 표시 blocker 없음, 그 옷장의 장소 표시 mark)으로 고쳤다.
// 장소 id는 구현의 closetPlaceId(가구 id)로 만든다. 자리·크기·그림자 등 나머지 기대값과 순서는 그대로다.

import { createHash } from "crypto";
import {
  CHAIR,
  MARKS,
  ROOM,
  ROOM_BOUNDS,
  SOLID_TILES,
  cameraPose,
  isFree,
  nearestOpenSpot,
  roomFitViewWidth
} from "@/lib/lobby3d/engine";
import { buildPlacements, furniturePlacements } from "@/lib/lobby3d/furniture-layout";
import { freeSpotFor, nearestWall, wallPieceInFront } from "@/lib/lobby3d/lobby-edit";
import { DEFAULT_LOBBY_LAYOUT, closetPlaceId, makeLayout, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";
import { parseLobbyLayoutPayload, toLobbyLayoutPayload } from "@/lib/lobby3d/lobby-layout-payload";

const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
/** 객체 안의 숫자를 모두 소수 6자리로 반올림한다. */
function round6<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === "number" ? r6(v) : v)));
}

describe("[spec] 기본 방의 방 값(B1~B6)", () => {
  it("B1: ROOM", () => {
    expect({ ...ROOM }).toEqual({ width: 8, depth: 11, wallHeight: 3.2, pitchDeg: 42, fovDeg: 30, wallThickness: 0.4, stepDepth: 0.7 });
  });

  it("B2: ROOM_BOUNDS", () => {
    expect(round6({ ...ROOM_BOUNDS })).toEqual({ minX: -0.4, maxX: 8.4, minY: -0.25, maxY: 3.2, minZ: -0.4, maxZ: 11.7 });
  });

  it("B3·B4: 처음 배치의 장소 서는 자리·바라볼 지점(밖으로는 (4.0, 10.5)·(4.0, 11.35))", () => {
    const marks = Object.fromEntries(Object.entries(MARKS).map(([id, m]) => [id, { approach: m.approach, faceTo: m.faceTo }]));
    expect(round6(marks)).toEqual({
      board: { approach: [{ x: 1.6, z: 1.3 }, { x: 2.2, z: 1.3 }], faceTo: { x: 1.8, z: 0 } },
      window: { approach: [{ x: 4.5, z: 1.55 }, { x: 5.1, z: 1.55 }], faceTo: { x: 4.8, z: 0 } },
      desk: { approach: [{ x: 1.5, z: 6.75 }], faceTo: { x: 1.5, z: 5.5 } },
      door: { approach: [{ x: 4, z: 10.5 }], faceTo: { x: 4, z: 11.35 } },
      bookcase: { approach: [{ x: 1.4, z: 2.5 }], faceTo: { x: 0, z: 2.5 } }
    });
  });

  it("B5: 막힌 칸", () => {
    expect([...SOLID_TILES].sort()).toEqual(["0,2", "0,5", "1,5", "2,5", "7,3"]);
  });

  it("B6: 의자", () => {
    expect(round6({ ...CHAIR })).toEqual({
      home: { x: 1.5, z: 5.95 },
      pullDir: { x: 0, z: 1 },
      pull: 0.5,
      seat: { x: 1.5, z: 6.45 },
      seatHeight: 0.67,
      side: { x: 2.15, z: 6.55 },
      heading: 3.141593
    });
  });
});

describe("[spec] 기본 방의 걷기·카메라(B7~B10)", () => {
  it("B7: isFree 격자(z 0~11.5, x −0.5~8.5, 0.25씩)의 sha256과 설 수 있는 점 수", () => {
    let grid = "";
    for (let z = 0; z <= 11.5; z += 0.25) {
      for (let x = -0.5; x <= 8.5; x += 0.25) grid += isFree(x, z) ? "1" : "0";
      grid += "|";
    }
    expect(grid.length).toBe(1786);
    expect((grid.match(/1/g) ?? []).length).toBe(988);
    expect(createHash("sha256").update(grid).digest("hex")).toBe("d3f5366eb6563ab4214c407143f7355726f7d1fd773e2997c9a64e4cd1270249");
  });

  it("B8: nearestOpenSpot", () => {
    expect(nearestOpenSpot({ x: 1.5, z: 5.5 })).toEqual({ x: 1.5, z: 4.5 });
    expect(nearestOpenSpot({ x: 7.9, z: 10.9 })).toEqual({ x: 6.5, z: 10.5 });
    expect(nearestOpenSpot({ x: 0.5, z: 2.5 })).toEqual({ x: 1.5, z: 2.5 });
  });

  it("B9: roomFitViewWidth", () => {
    expect(r6(roomFitViewWidth(0.46))).toBe(10.618327);
    expect(r6(roomFitViewWidth(0.5))).toBe(10.766932);
    expect(r6(roomFitViewWidth(0.75))).toBe(11.668304);
  });

  it("B10: cameraPose", () => {
    expect(round6(cameraPose({ x: 4, z: 5.5 }, 9.4, 0.46))).toEqual({
      position: { x: 4, y: 25.51517, z: 33.079229 },
      lookAt: { x: 4, y: 0, z: 4.741762 },
      fovDeg: 30
    });
    expect(round6(cameraPose({ x: 0.5, z: 0.5 }, 6, 0.46))).toEqual({
      position: { x: 2.001819, y: 16.286279, z: 23.257212 },
      lookAt: { x: 2.001819, y: 0, z: 5.169467 },
      fovDeg: 30
    });
    expect(round6(cameraPose({ x: 7.5, z: 10.5 }, 6, 0.46))).toEqual({
      position: { x: 5.998181, y: 16.286279, z: 23.257212 },
      lookAt: { x: 5.998181, y: 0, z: 5.169467 },
      fovDeg: 30
    });
    expect(round6(cameraPose({ x: 4, z: 5.5 }, 12.8, 0.75))).toEqual({
      position: { x: 4, y: 21.309691, z: 28.557334 },
      lookAt: { x: 4, y: 0, z: 4.890524 },
      fovDeg: 30
    });
  });
});

describe("[spec] 기본 방의 가구 자리(B11·B12)", () => {
  it("B11: furniturePlacements(처음 배치)가 순서까지 그대로", () => {
    expect(round6(furniturePlacements(DEFAULT_LOBBY_LAYOUT))).toEqual([
      { item: "board", piece: "board", mount: "wall", box: { width: 1.792, height: 1.4, depth: 0.126 }, scale: { x: 1, z: 1 }, shadow: { wall: [2, 1.6, 0.3] }, x: 1.8, y: 1.75, z: 0.06, rotY: 0, mark: "board" },
      { item: "window", piece: "window", mount: "wall", box: { width: 2.3, height: 1.876, depth: 0.35 }, scale: { x: 1, z: 1 }, shadow: { wall: [2.55, 2.15, 0.3] }, view: true, x: 4.8, y: 2.05, z: 0.17, rotY: 0, mark: "window" },
      { item: "desk", piece: "desk", mount: "floor", box: { width: 3, height: 1.292, depth: 1 }, scale: { x: 1.215559, z: 0.758725 }, shadow: { floor: [3.403566, 1.251897, 0.5] }, x: 1.5, y: 0, z: 5.5, rotY: 0, mark: "desk" },
      { item: "desk", piece: "chair", companion: true, mount: "floor", box: { width: 0.56, height: 1.316, depth: 0.56 }, scale: { x: 1, z: 1 }, shadow: { floor: [0.75, 0.75, 0.42] }, x: 1.5, y: 0, z: 5.95, rotY: 3.141593, mark: "desk" },
      { item: "bookcase", piece: "bookcase", mount: "floor", box: { width: 1, height: 2.464, depth: 0.876 }, scale: { x: 0.892857, z: 1 }, shadow: { floor: [1.25, 1.2, 0.52] }, x: 0.438, y: 0, z: 2.5, rotY: 1.570796, mark: "bookcase" },
      { item: "wardrobe", piece: "wardrobe", mount: "floor", box: { width: 1, height: 2.38, depth: 0.876 }, scale: { x: 0.892857, z: 1 }, shadow: { floor: [1.25, 1.2, 0.52] }, x: 7.562, y: 0, z: 3.5, rotY: -1.570796, mark: closetPlaceId("wardrobe") },
      { item: "rug", piece: "rug", mount: "cover", box: { width: 2.576, height: 0.028, depth: 2.576 }, scale: { x: 1, z: 1 }, x: 4.6, y: 0.004, z: 7.2, rotY: 0 },
      { item: "lamp", piece: "tableLamp", mount: "tabletop", box: { width: 0.418, height: 0.88, depth: 0.475 }, scale: { x: 1, z: 1 }, parent: "desk", pickBox: { width: 0.8, height: 0.88, depth: 0.8 }, x: 0.5, y: 1.292, z: 5.5, rotY: 0, mark: "desk" },
      { item: "exit", piece: "exit", mount: "floor", x: 4, y: 0, z: 11.35, rotY: 0, mark: "door" }
    ]);
  });

  it("B12: buildPlacements의 보관함 가구 자리", () => {
    const layout = makeLayout(
      DEFAULT_LOBBY_LAYOUT.items.filter((item) => item.id !== "wardrobe"),
      [
        { id: "wardrobe", type: "wardrobe" },
        { id: "frame-1", type: "frame" },
        { id: "books-1", type: "books" }
      ]
    );
    const stowed = buildPlacements(layout)
      .filter((p) => p.stowed)
      .map((p) => ({ item: p.item, x: p.x, y: p.y, z: p.z, rotY: p.rotY }));
    expect(round6(stowed)).toEqual([
      { item: "frame-1", x: 4, y: 2, z: 0.042, rotY: 0 },
      { item: "wardrobe", x: 4, y: 0, z: 5.438, rotY: 0 },
      { item: "books-1", x: 0.5, y: 1.292, z: 5.5, rotY: 0 }
    ]);
  });
});

describe("[spec] 기본 방의 편집·저장 본문(B13~B16)", () => {
  it("B13: freeSpotFor(처음 배치, 새 가구)", () => {
    const spot = (type: string) => freeSpotFor(DEFAULT_LOBBY_LAYOUT, { id: `${type}-1`, type });
    for (const type of ["wardrobe", "nightstand", "floorLamp", "plant"]) {
      expect(spot(type)).toEqual({ id: `${type}-1`, type, floor: { x: 3.5, z: 5.5, facing: 0 } });
    }
    expect(spot("rug")).toEqual({ id: "rug-1", type: "rug", floor: { x: 3.5, z: 3.5, facing: 0 } });
    expect(spot("bed")).toEqual({ id: "bed-1", type: "bed", floor: { x: 4, z: 5.5, facing: 0 } });
    expect(spot("frame")).toEqual({ id: "frame-1", type: "frame", wall: { wall: "back", along: 6.5 } });
    expect(spot("smallPlant")).toEqual({ id: "smallPlant-1", type: "smallPlant", on: { parent: "desk", slot: 1, facing: 0 } });
    expect(spot("books")).toEqual({ id: "books-1", type: "books", on: { parent: "desk", slot: 1, facing: 0 } });
  });

  it("B14: nearestWall", () => {
    expect(nearestWall({ x: 4.4, z: 4.0 })).toEqual({ wall: "right", along: 4.0 });
    expect(nearestWall({ x: 7.9, z: 5 })).toEqual({ wall: "right", along: 5 });
    expect(nearestWall({ x: 0.2, z: 9 })).toEqual({ wall: "left", along: 9 });
  });

  it("B15: wallPieceInFront(처음 배치 + 오른벽 액자)", () => {
    const layout: LobbyLayout = makeLayout([...DEFAULT_LOBBY_LAYOUT.items, { id: "frame-1", type: "frame", wall: { wall: "right", along: 5 } }], []);
    expect(wallPieceInFront(layout, { x: 7.5, z: 5 })).toBe("frame-1");
    expect(wallPieceInFront(layout, { x: 6.9, z: 5 })).toBeNull();
    expect(wallPieceInFront(layout, { x: 7.5, z: 5.6 })).toBeNull();
  });

  it("B16: parseLobbyLayoutPayload 경계", () => {
    const base = toLobbyLayoutPayload(DEFAULT_LOBBY_LAYOUT);
    const ok = (id: string, patch: object) =>
      parseLobbyLayoutPayload({ ...base, items: base.items.map((item) => (item.id === id ? { id: item.id, type: item.type, ...patch } : item)) }) !== null;
    expect(parseLobbyLayoutPayload(base)).not.toBeNull();
    expect(ok("wardrobe", { floor: { x: 8, z: 3.5, facing: 3 } })).toBe(true);
    expect(ok("wardrobe", { floor: { x: 8.01, z: 3.5, facing: 3 } })).toBe(false);
    expect(ok("wardrobe", { floor: { x: 7.5, z: 11, facing: 3 } })).toBe(true);
    expect(ok("wardrobe", { floor: { x: 7.5, z: 11.01, facing: 3 } })).toBe(false);
    expect(ok("board", { wall: { wall: "back", along: 8 } })).toBe(true);
    expect(ok("board", { wall: { wall: "back", along: 8.01 } })).toBe(false);
    expect(ok("board", { wall: { wall: "right", along: 11 } })).toBe(true);
    expect(ok("board", { wall: { wall: "right", along: 11.01 } })).toBe(false);
  });
});
