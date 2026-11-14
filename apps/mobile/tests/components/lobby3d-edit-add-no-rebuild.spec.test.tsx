// [spec] qa 재현 테스트(작업 072, 버그 수정: 모바일 로비 꾸미기에서 새 가구가 보이기까지 오래 걸림).
// 기대값은 명세(private 작업 폴더 072-2026-11-11-새-가구-3D만-붙이기/01-main-spec.md)에서만 가져온다.
// 그대로 둘 동작의 기대값은 지금(고치기 전) 동작에서 가져온다.
//
// - 재현(고치기 전에는 실패해야 한다): R1~R4. "3D를 다시 만든다"를 "조작 전에 장면에 있던 메시가 다른 메시로 바뀐다"로 본다
//   (069 재현 테스트 lobby3d-edit-store-no-rebuild.spec.test.tsx와 같은 잣대).
//   명세 "고친 뒤 동작" 1: 편집 중 방에 미리 만들지 않은 가구가 나오면 그 가구의 3D만 만들어 지금 장면에 더하고,
//   이미 있는 가구·방 껍데기·이름표는 다시 만들지 않고 그대로 둔다.
//   R1 '가구 더하기'로 침대(사용자 보고와 재현 상황), R2 이름표가 그대로인지, R3 '처음 배치로'로 미리 만들지 않은 깔개가 나올 때
//   (명세 "같은 일이 생기는 때"의 모든 경우), R4 잇달아 두 번 더할 때.
// - 고친 뒤에도 지킬 동작(고치기 전에도 통과해야 한다. 지금은 다시 만들기로 맞춰지는 동작): K1~K6.
//   K1·K2 더한 가구는 다른 가구처럼 자리·돌리기·띄우기·숨기기(치우기)·누르기 판정을 받는다(명세 "고친 뒤 동작" 2).
//   K3·K4 꾸미기에서 나올 때(취소·완료)는 지금 배치로 맞춘다. 취소하면 더한 가구는 보이지 않는다(명세 "고친 뒤 동작" 3).
//   K5 더한 가구는 '처음 배치로'를 누르면 보관함으로 가 보이지 않는다(꾸미기의 다른 동작 그대로).
//   K6 꾸미기 밖에서 배치가 바뀌면 지금처럼 다시 만든다(명세 "그대로여야 할 동작" 1).
//
// 어떻게 보나(068·069 재현 테스트와 같은 틀. 구현 코드는 부르는 방법을 알려고만 읽었다):
// - 화면(Lobby3dScreen)과 3D 그리기(Lobby3dCanvas)는 진짜를 쓰고, Jest에서 돌지 않는 react-three-fiber만 가짜로 둔다.
//   <primitive object>는 테스트 렌더러에서 이름이 "primitive"인 요소가 되므로, 프레임마다 그 object들을 가짜 장면에 넣는다.
// - 가구 묶음(lobby3d-furniture)은 진짜를 쓰고 glb 불러오기만 가짜로 둔다: 모델 이름마다 0.8칸 상자 하나(userData.fakeModel = 모델 이름).
// - 가구의 3D 물체는 userData.furnitureOf가 그 가구 id인 물체(대체 모양과 가구 묶음 모델), 그림자는 userData.shadowOf가 그 id인 물체다.
// - "보인다": 조상까지 모두 visible이고 장면에 붙은 것. "누르기 판정": 3D 그리기의 터치 받는 View에 화면 좌표를 넣었을 때 3D 그리기가 넘기는 결과.
// - '가구 더하기'는 개발 빌드(__DEV__ = true)의 보관함 줄 탭이다. 보관함 줄이 닫혀 있으면 '보관함' 버튼으로 열고, 열려 있으면 그대로 쓴다
//   (071 작업이 보관함 줄을 늘 보이게 바꾸는 중이라 두 모습 모두에서 돌게 했다).
// - 고르기·끌기처럼 판정 자체를 보지 않는 조작은 3D 그리기가 화면에 넘기는 onPointer에 누르기 결과(piece)를 직접 넣어 한다.
// 075(꾸미기: 들린 가구를 탭으로 옮기기) 명세의 "고칠 기존 테스트"로 고친 것(private 작업 폴더 075-2026-11-11-꾸미기-탭으로-옮기기-보관함-줄-넓히기/
// 01-main-spec.md, 보고 02-qa-tests.md): 가구가 골라져 있을 때 빈 곳을 톡하면 고르기가 풀리지 않고 골라진 가구가 그리로 옮겨 간다.
// 그래서 고르기를 푸는 도우미(deselect)는 골라진 가구 자신을 다시 톡한다(판정은 보지 않고 누르기 결과를 화면에 직접 넣는다). 준비만 바꿨고 단언은 그대로다.
// 086-③(라룹 홈쇼핑 화면) 03 결정 1(사용자)로 고친 것(private 작업 폴더 086-2026-11-12-라룹-홈쇼핑/04-홈쇼핑-화면/03-main-decision.md, 보고 05-qa-tests.md):
// 개발용 '가구 더하기' 탭이 없어져, 가구를 더하던 준비(R1·R2·R4, K1~K5)를 "홈쇼핑에서 산 침대 bed-1·화분 plant-1이 보관함에 든 처음 배치(DEF_BOUGHT)로 시작해
// 보관함 칸을 눌러 꺼낸다"로 바꿨다. 보관함 가구는 방에 미리 3D를 만들지 않으므로 꺼낼 때도 "편집 중 방에 미리 만들지 않은 가구가 나오는" 경우다.
// 단언과 기대값은 그대로다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { useState } from "react";
import * as THREE from "three";
import type { TestInstance } from "test-renderer";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen from "@/components/lobby3d/lobby3d-screen";
import { applyLobbyLayout, type FloorPoint, type MarkId, type PointerHit } from "@/lib/lobby3d/engine";
import { furnitureType } from "@/lib/lobby3d/furniture-catalog";
import { furniturePlacements, placementKey } from "@/lib/lobby3d/furniture-layout";
import { DEFAULT_LOBBY_LAYOUT, makeLayout, type FurnitureItem, type LobbyLayout, type StoredItem } from "@/lib/lobby3d/lobby-layout";

type FramePart = (state: { camera: THREE.Camera; gl: unknown; clock: { elapsedTime: number }; scene: THREE.Scene }, delta: number) => void;

const mockThree: { camera: THREE.PerspectiveCamera | null; scene: THREE.Scene | null; size: { width: number; height: number } } = {
  camera: null,
  scene: null,
  size: { width: 400, height: 800 }
};
const mockFrames = new Set<FramePart>();
const mockGltf: { value: unknown } = { value: null };
/** 090-② 05 결정 3: 가구 일곱 파일 목록에 주는 가짜 모델 배열(같은 가짜 모델이면 같은 배열). */
const mockGltfList: { source: unknown; value: unknown[] } = { source: undefined, value: [] };
const mockHits: { phase: string; hit: PointerHit | null }[] = [];
const mockCanvas: { props: Lobby3dCanvasProps | null } = { props: null };
/** 3D 그리기가 마지막 프레임에 화면에 넘긴 이름표 화면 좌표. */
const mockLabels: { value: Record<MarkId, { x: number; y: number }> | null } = { value: null };

// 090-② 05 결정 3: 일곱 밖 가구의 모델·아이콘은 서버 목록의 파일을 받아 쓴다. 이 테스트는 그 파일을 기기에 이미 받아 둔 것으로 둔다
// (기기에 있는 파일이면 그 파일의 기기 주소를 준다. 받기·기기 저장 자체는 090-② 테스트 furniture-download*.spec이 본다).
jest.mock("@/lib/item-files", () => ({
  ...jest.requireActual<typeof import("@/lib/item-files")>("@/lib/item-files"),
  cachedItemFile: (ref: { url: string } | null | undefined) => (ref ? `file:///qa-received/${ref.url.split("/").pop()}` : null)
}));
// three(0.187)는 ES 모듈만 있어 Jest의 require로는 읽지 못하므로 Node의 require로 읽는다(068 재현 테스트와 같다).
jest.mock("three", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const file = require.resolve("three");
  return nodeModule.createRequire(file)(file);
});
jest.mock("@react-three/fiber/native", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    Canvas: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    useThree: () => mockThree,
    useFrame: (callback: FramePart) => {
      const ref = React.useRef(callback);
      ref.current = callback;
      React.useEffect(() => {
        const entry: FramePart = (state, delta) => ref.current(state, delta);
        mockFrames.add(entry);
        return () => {
          mockFrames.delete(entry);
        };
      }, []);
    },
    // 090-② 05 결정 3: 가구는 앱에 든 처음 방 일곱 파일을 한 번에(목록으로) 읽는다. 목록이면 파일마다 같은 가짜 모델을 준다
    // (진짜 useLoader처럼 같은 파일 목록에는 같은 배열을 준다)
    useLoader: (_loader: unknown, input: unknown) => {
      if (!Array.isArray(input)) return mockGltf.value;
      if (mockGltfList.source !== mockGltf.value || mockGltfList.value.length !== input.length) {
        mockGltfList.source = mockGltf.value;
        mockGltfList.value = input.map(() => mockGltf.value);
      }
      return mockGltfList.value;
    }
  };
});
jest.mock("three/examples/jsm/geometries/RoundedBoxGeometry.js", () => {
  const T = jest.requireMock<typeof import("three")>("three");
  return {
    RoundedBoxGeometry: function RoundedBoxGeometry(width: number, height: number, depth: number) {
      return new T.BoxGeometry(width, height, depth);
    }
  };
});
// 090-② 05 결정 3: 일곱 밖 가구는 기기에 받은 모델 파일을 GLTFLoader.loadAsync로 읽는다(같은 가짜 모델을 준다)
jest.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({
  GLTFLoader: class {
    loadAsync() {
      return Promise.resolve(mockGltf.value);
    }
  }
}));
// 090-② 05 결정 3: 가구 묶음(lobby-furniture.glb) 대신 앱에 든 처음 방 가구 일곱의 파일이다(Jest가 읽지 못하는 파일이라 이름만 준다)
jest.mock("@/assets/models/furniture/desk.glb", () => "furniture/desk.glb");
jest.mock("@/assets/models/furniture/bookcase.glb", () => "furniture/bookcase.glb");
jest.mock("@/assets/models/furniture/board.glb", () => "furniture/board.glb");
jest.mock("@/assets/models/furniture/window.glb", () => "furniture/window.glb");
jest.mock("@/assets/models/furniture/wardrobe.glb", () => "furniture/wardrobe.glb");
jest.mock("@/assets/models/furniture/rug.glb", () => "furniture/rug.glb");
jest.mock("@/assets/models/furniture/lamp.glb", () => "furniture/lamp.glb");
jest.mock("@/components/lobby3d/lobby3d-outdoor", () => {
  const T = jest.requireMock<typeof import("three")>("three");
  return {
    createOutdoor: () => ({ scene: new T.Group(), setDaylight: () => {}, update: () => {}, dispose: () => {} })
  };
});
jest.mock("@/components/lobby3d/lobby3d-room", () => ({
  BakedRoom: () => null,
  BakedRoomErrorBoundary: ({ children }: { children: unknown }) => children
}));
jest.mock("@/components/lobby3d/lobby3d-character", () => ({
  BUBBLE_HEIGHT: 2,
  Character: () => null,
  CharacterErrorBoundary: ({ children }: { children: unknown }) => children
}));
jest.mock("@/components/lobby3d/lobby3d-daylight", () => ({
  ...jest.requireActual("@/components/lobby3d/lobby3d-daylight"),
  DaylightRig: () => null
}));
// 3D 그리기는 진짜를 그리되, 화면에 넘기는 누르기 결과와 이름표 화면 좌표를 적어 둔다
jest.mock("@/components/lobby3d/lobby3d-canvas", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const actual = jest.requireActual("@/components/lobby3d/lobby3d-canvas");
  return {
    ...actual,
    __esModule: true,
    default: (props: Lobby3dCanvasProps) => {
      mockCanvas.props = props;
      return React.createElement(actual.default, {
        ...props,
        onPointer: (phase: string, hit: PointerHit | null, x: number, y: number) => {
          mockHits.push({ phase, hit });
          props.onPointer(phase as Parameters<Lobby3dCanvasProps["onPointer"]>[0], hit, x, y);
        },
        onOverlayFrame: (bubble: { x: number; y: number }, labels: Record<MarkId, { x: number; y: number }>) => {
          mockLabels.value = JSON.parse(JSON.stringify(labels)) as Record<MarkId, { x: number; y: number }>;
          props.onOverlayFrame?.(bubble, labels);
        }
      });
    }
  };
});
jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() },
    Redirect: (props: object) => React.createElement("Redirect", props)
  };
});
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// ---------- 090-② 05 결정 3: 일곱 밖 가구는 서버 목록의 받은 파일 ----------
// 앱에 든 가구 파일은 처음 방 일곱(모델)과 옷장·깔개·스탠드(아이콘)뿐이다. 그 밖의 가구는 서버 아이템 목록(assets)의 파일을 받아 그린다.
// 그래서 테스트마다 일곱 밖 가구의 파일이 든 목록을 지금 목록으로 둔다. 이름·홈쇼핑 이름·설명·분류는 앱에 든 값 그대로이고 그리기 정보는 없다(앱 값).
const RECEIVED_FURNITURE = ["bed", "nightstand", "floorLamp", "plant", "smallPlant", "books", "frame"];
const RECEIVED_CATEGORIES = ["furniture", "lighting", "decor", "plants"] as const;
function receivedFile(ext: "glb" | "png", digit: string) {
  const sha256 = digit.repeat(64);
  return { url: `/api/catalog/files/${sha256}.${ext}`, sha256, bytes: 1000 };
}
/** 일곱 밖 가구의 파일이 든 목록을 지금 목록으로 둔다. */
function setReceivedFurnitureCatalog() {
  const store = jest.requireActual<typeof import("@/lib/item-catalog-store")>("@/lib/item-catalog-store");
  const kinds = jest.requireActual<typeof import("@/lib/lobby3d/furniture-catalog")>("@/lib/lobby3d/furniture-catalog");
  const shop = jest.requireActual<typeof import("@/components/home/home-shopping-catalog")>("@/components/home/home-shopping-catalog");
  store.setItemCatalog({
    version: "qa-received-furniture",
    items: RECEIVED_FURNITURE.map((id, index) => ({
      id,
      kind: "furniture" as const,
      name: kinds.furnitureType(id).name,
      shopName: shop.shopProductName(id),
      description: shop.shopProductDescription(id),
      category: RECEIVED_CATEGORIES.find((category) => shop.inShopCategory(id, category)) ?? null,
      slot: null,
      price: null,
      draw: null,
      assets: { model: receivedFile("glb", String(index + 1)), icon: receivedFile("png", "abcdef9"[index]) }
    }))
  });
}

// ---------- 배치 ----------

type Facing = 0 | 1 | 2 | 3;
const floor = (id: string, type: string, x: number, z: number, facing: Facing): FurnitureItem => ({ id, type, floor: { x, z, facing } });

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const layoutOf = (items: FurnitureItem[], stored: StoredItem[] = []): LobbyLayout => copy(makeLayout(items, stored));
/** 처음 배치(책상·책장·옷장·깔개·게시판·창문·스탠드). */
const DEF = layoutOf(DEFAULT_LOBBY_LAYOUT.items);
/** 086-③: 처음 배치 + 홈쇼핑에서 산 침대 bed-1·화분 plant-1이 든 보관함. */
const DEF_BOUGHT = layoutOf(DEFAULT_LOBBY_LAYOUT.items, [
  { id: "bed-1", type: "bed" },
  { id: "plant-1", type: "plant" }
]);
/** 깔개가 방에도 보관함에도 없는 배치. '처음 배치로'를 누르면 깔개가 나오는데 미리 만들지 않은 가구다. */
const NO_RUG = layoutOf(DEFAULT_LOBBY_LAYOUT.items.filter((item) => item.id !== "rug"));
/** 처음 배치에 화분 plant-9를 빈 바닥 (5.5, 3.5)에 더한 배치(꾸미기 밖에서 서버 배치가 바뀔 때). */
const EMPTY_FLOOR = { x: 5.5, z: 3.5 };
const DEF_PLUS_PLANT = layoutOf([...DEFAULT_LOBBY_LAYOUT.items, floor("plant-9", "plant", EMPTY_FLOOR.x, EMPTY_FLOOR.z, 0)]);

const WARDROBE_AT = { x: 7.5, z: 3.5 };
const DESK_AT = { x: 1.5, z: 5.5 };
const RUG_AT = { x: 4.6, z: 7.2 };
const RUG_PRESS_Y = 0.03;
/** 일기 책상 이름표 높이(카탈로그의 책상 장소 label.y, 책상 가운데 위. 069 재현 테스트 K4와 같은 값). */
const DESK_LABEL_Y = 2.1;

const NOW = new Date("2026-11-12T03:00:00.000Z");
const SLOW_TEST_MS = 60_000;

// ---------- 가짜 glb ----------

/** 모델 이름마다 0.8칸 상자 하나(바닥에 놓인)를 주는 가구 묶음. 창밖 판(windowView)은 없다. */
function fakeFurnitureGltf() {
  const scene = new THREE.Group();
  (scene as unknown as { getObjectByName: (name: string) => THREE.Object3D | undefined }).getObjectByName = (name: string) => {
    if (name === "windowView") return undefined;
    const group = new THREE.Group();
    group.name = name;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshStandardMaterial());
    mesh.position.y = 0.4;
    mesh.userData.fakeModel = name;
    group.add(mesh);
    return group;
  };
  return { scene };
}

// ---------- 도우미 ----------

async function flushAsync() {
  for (let index = 0; index < 8; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function camera() {
  return mockThree.camera!;
}

function scene() {
  return mockThree.scene!;
}

/** 지금 그려진 <primitive>의 object들을 장면에 넣는다. */
function syncScene() {
  const objects = screen.container
    .queryAll((instance: TestInstance) => instance.type === "primitive")
    .map((instance) => (instance.props as { object: THREE.Object3D }).object);
  scene().clear();
  for (const object of objects) scene().add(object);
}

/** 3D 그리기의 프레임을 n번 돈다. */
async function frames(n = 3) {
  for (let index = 0; index < n; index += 1) {
    await act(async () => {
      syncScene();
      for (const part of [...mockFrames]) part({ camera: camera(), gl: {}, clock: { elapsedTime: 0 }, scene: scene() }, 0.05);
      // 실제 그리기(renderer.render)처럼 프레임 끝에 장면의 월드 행렬을 맞춘다(누르기 판정이 이 행렬을 쓴다)
      syncScene();
      scene().updateMatrixWorld(true);
    });
  }
  syncScene();
  scene().updateMatrixWorld(true);
}

/** 장면 점의 화면 좌표. 화면 안이어야 한다. */
function toScreen(x: number, y: number, z: number) {
  camera().updateMatrixWorld();
  const p = new THREE.Vector3(x, y, z).project(camera());
  const { width, height } = mockThree.size;
  const at = { x: ((p.x + 1) / 2) * width, y: ((1 - p.y) / 2) * height };
  expect(at.x).toBeGreaterThan(0);
  expect(at.x).toBeLessThan(width);
  expect(at.y).toBeGreaterThan(0);
  expect(at.y).toBeLessThan(height);
  return at;
}

/** 3D 그리기의 터치 받는 View: 터치를 먼저 가져가고(capture) 그 안에 3D 장면(primitive)이 있는 View. */
function touchView(): TestInstance {
  const views = screen.container.queryAll((instance: TestInstance) => {
    const props = instance.props as { onResponderGrant?: unknown; onStartShouldSetResponderCapture?: unknown };
    return (
      typeof instance.type === "string" &&
      typeof props.onResponderGrant === "function" &&
      typeof props.onStartShouldSetResponderCapture === "function" &&
      instance.queryAll((child: TestInstance) => child.type === "primitive").length > 0
    );
  });
  expect(views).toHaveLength(1);
  return views[0];
}

async function touch(handler: "onResponderGrant" | "onResponderRelease", at: { x: number; y: number }) {
  const view = touchView();
  await act(async () => {
    (view.props as Record<string, (event: unknown) => void>)[handler]({ nativeEvent: { locationX: at.x, locationY: at.y } });
  });
}

/** 화면 좌표를 톡 누른다(진짜 누르기 판정). 누를 때 3D 그리기가 넘긴 누르기 결과를 돌려준다. */
async function tapAt(at: { x: number; y: number }): Promise<PointerHit | null> {
  const before = mockHits.length;
  await touch("onResponderGrant", at);
  const down = mockHits.slice(before).find((entry) => entry.phase === "down");
  await touch("onResponderRelease", at);
  await flushAsync();
  await frames();
  expect(down).toBeDefined();
  return down!.hit;
}

function canvasProps() {
  expect(mockCanvas.props).not.toBeNull();
  return mockCanvas.props!;
}

function edit() {
  const value = mockCanvas.props?.edit;
  expect(value).toBeTruthy();
  return value!;
}

function lifted(): string | null {
  return mockCanvas.props?.edit?.lifted ?? null;
}

function hit(point: FloorPoint | null, piece: string | null = null): PointerHit {
  return { point, mark: null, onCharacter: false, piece };
}

/** 화면에 누르기 결과를 직접 넣는다(판정은 보지 않는 조작). */
async function pointer(phase: "down" | "move" | "up", h: PointerHit | null, x: number, y: number) {
  await act(async () => {
    canvasProps().onPointer(phase, h, x, y);
  });
  await flushAsync();
}

async function tapPiece(piece: string | null, at: FloorPoint) {
  await pointer("down", hit(at, piece), 200, 300);
  await pointer("up", null, 200, 300);
  await frames();
}

async function dragPiece(piece: string, from: FloorPoint, to: FloorPoint) {
  await pointer("down", hit(from, piece), 200, 300);
  await pointer("move", hit(to, null), 300, 400);
  await pointer("up", null, 300, 400);
  await frames();
}

/** 075: 골라진 가구 자신을 누른 결과(바닥 가구는 칸 가운데, 탁상 소품은 받침 가구 가운데에서 그 소품을 맞힘, 벽 가구는 걸린 벽 자리). */
function selfHit(id: string): PointerHit {
  const item = edit().layout.items.find((entry) => entry.id === id);
  expect(item).toBeDefined();
  if (item!.wall) return { point: null, mark: null, onCharacter: false, piece: id, wall: { wall: item!.wall.wall, along: item!.wall.along } };
  const base = item!.floor ?? edit().layout.items.find((entry) => entry.id === item!.on?.parent)?.floor;
  expect(base).toBeDefined();
  return { point: { x: base!.x, z: base!.z }, mark: null, onCharacter: false, piece: id, wall: null };
}

/** 고르기를 푼다. 075: 골라진 가구 자신을 다시 톡한다. */
async function deselect() {
  const id = lifted();
  if (id) {
    const h = selfHit(id);
    await pointer("down", h, 200, 300);
    await pointer("up", null, 200, 300);
    await frames();
  }
  expect(lifted()).toBeNull();
}

async function pressButton(label: string) {
  await fireEvent.press(screen.getByRole("button", { name: label }));
  await flushAsync();
  await frames();
}

/** 086-③ 03 결정 1: '가구 더하기' 탭 대신 보관함 줄의 산 가구 칸(가구 이름)을 눌러 꺼낸다. */
async function addFurniture(name: string) {
  const tray = screen.getByLabelText("보관함");
  await fireEvent.press(within(tray).getByRole("button", { name }));
  await flushAsync();
  await frames();
}

/** 조상까지 모두 visible이고 지금 장면에 붙어 있는지. */
function isShown(object: THREE.Object3D): boolean {
  let o: THREE.Object3D | null = object;
  while (o) {
    if (!o.visible) return false;
    if (o === scene()) return true;
    o = o.parent;
  }
  return false;
}

/** 지금 장면에 있는 모든 메시(보이지 않는 것 포함). */
function meshesInScene(): Set<THREE.Object3D> {
  syncScene();
  const all = new Set<THREE.Object3D>();
  scene().traverse((object) => {
    if (object instanceof THREE.Mesh) all.add(object);
  });
  return all;
}

function describe1(mesh: THREE.Object3D): string {
  if (typeof mesh.userData.fakeModel === "string") return `model:${mesh.userData.fakeModel}`;
  for (let o: THREE.Object3D | null = mesh; o; o = o.parent) {
    if (typeof o.userData.furnitureOf === "string") return `${mesh.type}<${o.userData.furnitureOf}>`;
    if (typeof o.userData.shadowOf === "string") return `${mesh.type}<shadow ${o.userData.shadowOf}>`;
  }
  return mesh.type;
}

/** before에 있던 메시 가운데 지금 장면에 없는 것(다시 만들어져 다른 메시로 바뀐 것). 실패 메시지용으로 수와 앞 다섯 개를 준다. */
function replacedSince(before: Set<THREE.Object3D>): { count: number; sample: string[] } {
  const now = meshesInScene();
  const gone = [...before].filter((mesh) => !now.has(mesh));
  return { count: gone.length, sample: gone.slice(0, 5).map(describe1) };
}

/** 그 가구의 3D 물체(대체 모양과 가구 묶음 모델, furnitureOf가 가구 id). */
function furnitureObjects(id: string): THREE.Object3D[] {
  syncScene();
  const found: THREE.Object3D[] = [];
  scene().traverse((object) => {
    if (object.userData.furnitureOf === id) found.push(object);
  });
  return found;
}

/** 그 가구의 그림자(shadowOf가 가구 id). */
function shadowObjects(id: string): THREE.Object3D[] {
  syncScene();
  const found: THREE.Object3D[] = [];
  scene().traverse((object) => {
    if (object.userData.shadowOf === id) found.push(object);
  });
  return found;
}

function shownFurniture(id: string): THREE.Object3D[] {
  return furnitureObjects(id).filter((object) => isShown(object));
}

function visibleFakeModels(model: string): THREE.Mesh[] {
  syncScene();
  const found: THREE.Mesh[] = [];
  scene().traverse((object) => {
    if (object instanceof THREE.Mesh && object.userData.fakeModel === model && isShown(object)) found.push(object);
  });
  return found;
}

/** 배치에서 그 가구가 놓일 자리(3D 화면이 다른 가구를 옮기는 것과 같은 자리 계산). */
function placementOf(layout: LobbyLayout, id: string) {
  const place = furniturePlacements(layout).find((p) => placementKey(p) === id);
  expect(place).toBeDefined();
  return place!;
}

function floorOf(layout: LobbyLayout, id: string) {
  const item = layout.items.find((it) => it.id === id);
  expect(item?.floor).toBeDefined();
  return item!.floor!;
}

/** 3D 그리기가 마지막 프레임에 넘긴 일기 책상 이름표가 장면 점 (x, y, z)의 화면 좌표에 있는지(0.5화소 안). */
function expectDeskLabelAt(x: number, y: number, z: number) {
  const want = toScreen(x, y, z);
  const got = mockLabels.value?.desk;
  expect(got).toBeDefined();
  expect(Math.abs(got!.x - want.x)).toBeLessThan(0.5);
  expect(Math.abs(got!.y - want.y)).toBeLessThan(0.5);
}

/** 홈처럼 불러온 배치를 넘기고, 저장에 성공하면 저장한 배치를 다시 넘기는 화면. 꾸미기 밖 배치 바꾸기(서버 배치 받기)는 host.setLayout으로 한다. */
const host: { setLayout: ((value: LobbyLayout) => void) | null } = { setLayout: null };
function LobbyHost({ loaded, onSave }: { loaded: LobbyLayout; onSave: (value: LobbyLayout) => Promise<LobbyLayout> }) {
  const [layout, setLayout] = useState(loaded);
  host.setLayout = setLayout;
  const save = async (value: LobbyLayout) => {
    const saved = await onSave(value);
    setLayout(saved);
    return saved;
  };
  return <Lobby3dScreen devPanel={false} layout={layout} onSaveLayout={save} />;
}

async function renderLobby(loaded: LobbyLayout) {
  const onSaveLayout = jest.fn(async (value: LobbyLayout) => copy(value));
  await render(<LobbyHost loaded={loaded} onSave={onSaveLayout} />);
  await flushAsync();
  await frames();
  return { onSaveLayout };
}

async function enterEdit() {
  await fireEvent.press(screen.getByText("꾸미기"));
  await flushAsync();
  await frames();
  expect(edit()).toBeTruthy();
}

const devGlobal = globalThis as unknown as { __DEV__: boolean };
const originalDev = devGlobal.__DEV__;

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  mockThree.camera = new THREE.PerspectiveCamera(30, mockThree.size.width / mockThree.size.height, 1, 200);
  mockThree.scene = new THREE.Scene();
  mockFrames.clear();
  mockHits.length = 0;
  mockCanvas.props = null;
  mockLabels.value = null;
  mockGltf.value = fakeFurnitureGltf();
  // 090-② 05 결정 3: 일곱 밖 가구의 파일이 든 서버 목록
  setReceivedFurnitureCatalog();
  host.setLayout = null;
  // '가구 더하기'는 개발 빌드에서만 보인다
  devGlobal.__DEV__ = true;
});

afterEach(() => {
  applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
  devGlobal.__DEV__ = originalDev;
  jest.useRealTimers();
});

// ---------- 재현(고칠 동작) ----------

describe("[spec] 072 재현: 편집 중 방에 미리 만들지 않은 가구가 나오면 그 가구의 3D만 더하고, 이미 있는 3D는 다시 만들지 않는다", () => {
  test(
    "R1 (사용자 보고) 꾸미기에서 '가구 더하기'로 침대를 놓으면, 더하기 전 장면의 메시(가구·방 껍데기·그림자)가 하나도 바뀌지 않고 그대로 보이며, 침대 bed-1이 침대 모델로 보인다",
    async () => {
      await renderLobby(DEF_BOUGHT);
      await enterEdit();
      const before = meshesInScene();
      const shownBefore = [...before].filter((mesh) => isShown(mesh));
      expect(shownBefore.length).toBeGreaterThan(0);

      await addFurniture("침대");

      expect(floorOf(edit().layout, "bed-1")).toBeDefined();
      // 이미 있는 가구·방 껍데기·이름표는 다시 만들지 않는다
      expect(replacedSince(before)).toEqual({ count: 0, sample: [] });
      // 이미 있는 것의 보이는 모습이 끊기지 않는다(더하기 전에 보이던 메시는 그대로 보인다)
      expect(shownBefore.filter((mesh) => !isShown(mesh)).map(describe1)).toEqual([]);
      // 더한 침대가 보인다(가구 묶음의 침대 모델)
      expect(shownFurniture("bed-1").length).toBeGreaterThan(0);
      expect(visibleFakeModels(furnitureType("bed").model.piece)).toHaveLength(1);
    },
    SLOW_TEST_MS
  );

  test(
    "R2 꾸미기에서 책상을 (1.5, 6.5)로 옮긴 뒤 침대를 더해도, 일기 책상 이름표는 다시 만들지 않아 더하기 전 자리(1.5, 2.1, 5.5)에 그대로 있다",
    async () => {
      await renderLobby(DEF_BOUGHT);
      await enterEdit();
      await dragPiece("desk", DESK_AT, { x: DESK_AT.x, z: DESK_AT.z + 1 });
      expect(floorOf(edit().layout, "desk")).toEqual({ x: 1.5, z: 6.5, facing: 0 });
      await deselect();
      // 더하기 전: 이름표는 꾸미기에 들어가기 전 책상 자리에 있다(시작 조건)
      expectDeskLabelAt(DESK_AT.x, DESK_LABEL_Y, DESK_AT.z);

      await addFurniture("침대");

      expect(floorOf(edit().layout, "bed-1")).toBeDefined();
      expectDeskLabelAt(DESK_AT.x, DESK_LABEL_Y, DESK_AT.z);
      // 옮긴 책상 위 이름표 자리와 원래 자리는 화면에서 떨어져 있다(위 확인이 헛돌지 않는다)
      const moved = toScreen(1.5, DESK_LABEL_Y, 6.5);
      const original = toScreen(DESK_AT.x, DESK_LABEL_Y, DESK_AT.z);
      expect(Math.hypot(moved.x - original.x, moved.y - original.y)).toBeGreaterThan(5);
    },
    SLOW_TEST_MS
  );

  test(
    "R3 깔개가 방에도 보관함에도 없는 배치에서 '처음 배치로'를 누르면, 장면의 메시가 하나도 바뀌지 않고 깔개가 (4.6, 7.2)에 깔개 모델로 보이며 그 자리를 누르면 깔개가 눌린다",
    async () => {
      await renderLobby(NO_RUG);
      await enterEdit();
      const before = meshesInScene();
      expect(furnitureObjects("rug")).toEqual([]);

      await pressButton("처음 배치로");

      expect(floorOf(edit().layout, "rug")).toEqual({ x: 4.6, z: 7.2, facing: 0 });
      expect(replacedSince(before)).toEqual({ count: 0, sample: [] });
      expect(visibleFakeModels(furnitureType("rug").model.piece)).toHaveLength(1);
      const tapped = await tapAt(toScreen(RUG_AT.x, RUG_PRESS_Y, RUG_AT.z));
      expect(tapped?.piece).toBe("rug");
      expect(lifted()).toBe("rug");
    },
    SLOW_TEST_MS
  );

  test(
    "R4 침대를 더한 뒤 화분을 이어서 더하면, 두 번째 더하기 전 장면의 메시(앞서 더한 침대 포함)가 하나도 바뀌지 않고 둘 다 보인다",
    async () => {
      await renderLobby(DEF_BOUGHT);
      await enterEdit();
      await addFurniture("침대");
      expect(shownFurniture("bed-1").length).toBeGreaterThan(0);
      await deselect();
      const before = meshesInScene();

      await addFurniture("화분");

      expect(floorOf(edit().layout, "plant-1")).toBeDefined();
      expect(replacedSince(before)).toEqual({ count: 0, sample: [] });
      expect(shownFurniture("bed-1").length).toBeGreaterThan(0);
      expect(shownFurniture("plant-1").length).toBeGreaterThan(0);
      expect(visibleFakeModels(furnitureType("bed").model.piece)).toHaveLength(1);
      expect(visibleFakeModels(furnitureType("plant").model.piece)).toHaveLength(1);
    },
    SLOW_TEST_MS
  );
});

// ---------- 고친 뒤에도 지킬 동작(지금도 통과) ----------

describe("[spec] 072 더한 가구는 다른 가구처럼 다뤄지고, 꾸미기에서 나오면 지금 배치로 맞춘다", () => {
  test(
    "K1 더한 화분 plant-1은 놓인 자리에 보이고, 눌러 고르면 옷장과 같은 만큼 뜨며, 돌리고 끌면 모양·그림자가 편집 중 자리와 방향을 따른다",
    async () => {
      await renderLobby(DEF_BOUGHT);
      await enterEdit();
      // 비교할 다른 가구: 옷장을 골랐을 때 뜨는 높이
      await tapPiece("wardrobe", WARDROBE_AT);
      expect(lifted()).toBe("wardrobe");
      const wardrobeBase = placementOf(edit().layout, "wardrobe");
      const wardrobeObjects = shownFurniture("wardrobe");
      expect(wardrobeObjects.length).toBeGreaterThan(0);
      const wardrobeRaise = wardrobeObjects[0].position.y - wardrobeBase.y;
      expect(wardrobeRaise).toBeGreaterThan(0);
      await deselect();

      await addFurniture("화분");
      await deselect();
      const placed = placementOf(edit().layout, "plant-1");
      const objects = shownFurniture("plant-1");
      expect(objects.length).toBeGreaterThan(0);
      // 자리: 다른 가구처럼 편집 중 배치의 자리·방향에 놓인다. 모델은 가구 묶음의 화분이다
      for (const object of objects) {
        expect(object.position.x).toBeCloseTo(placed.x, 4);
        expect(object.position.y).toBeCloseTo(placed.y, 4);
        expect(object.position.z).toBeCloseTo(placed.z, 4);
        expect(object.rotation.y).toBeCloseTo(placed.rotY, 4);
      }
      expect(visibleFakeModels(furnitureType("plant").model.piece)).toHaveLength(1);

      // 누르기 판정과 띄우기: 화분 자리를 진짜로 누르면 화분이 골라지고 옷장과 같은 만큼 뜬다
      const plantHeight = furnitureType("plant").model.box.height;
      const tapped = await tapAt(toScreen(placed.x, plantHeight / 2, placed.z));
      expect(tapped?.piece).toBe("plant-1");
      expect(lifted()).toBe("plant-1");
      for (const object of furnitureObjects("plant-1")) expect(object.position.y - placed.y).toBeCloseTo(wardrobeRaise, 4);

      // 돌리기
      const facing = floorOf(edit().layout, "plant-1").facing;
      await pressButton("돌리기");
      expect(floorOf(edit().layout, "plant-1").facing).not.toBe(facing);
      const turned = placementOf(edit().layout, "plant-1");
      for (const object of furnitureObjects("plant-1")) expect(object.rotation.y).toBeCloseTo(turned.rotY, 4);
      await deselect();

      // 끌기: 빈 바닥으로 옮긴다(화분이 이미 그 자리면 한 칸 뒤로)
      const from = { x: turned.x, z: turned.z };
      const to = from.x === EMPTY_FLOOR.x && from.z === EMPTY_FLOOR.z ? { x: EMPTY_FLOOR.x, z: EMPTY_FLOOR.z - 1 } : EMPTY_FLOOR;
      await dragPiece("plant-1", from, to);
      await deselect();
      expect(floorOf(edit().layout, "plant-1")).toMatchObject({ x: to.x, z: to.z });
      const moved = placementOf(edit().layout, "plant-1");
      const movedObjects = shownFurniture("plant-1");
      expect(movedObjects.length).toBeGreaterThan(0);
      for (const object of movedObjects) {
        expect(object.position.x).toBeCloseTo(moved.x, 4);
        expect(object.position.z).toBeCloseTo(moved.z, 4);
      }
      // 그림자도 다른 가구처럼 함께 옮겨 간다
      const shadows = shadowObjects("plant-1").filter((object) => isShown(object));
      expect(shadows.length).toBeGreaterThan(0);
      for (const object of shadows) {
        expect(object.position.x).toBeCloseTo(moved.x, 4);
        expect(object.position.z).toBeCloseTo(moved.z, 4);
      }
    },
    SLOW_TEST_MS
  );

  test(
    "K2 더한 화분 plant-1을 치우면 모양·그림자가 보이지 않고, 그 자리를 눌러도 화분이 눌리지 않는다",
    async () => {
      await renderLobby(DEF_BOUGHT);
      await enterEdit();
      await addFurniture("화분");
      expect(lifted()).toBe("plant-1");
      const placed = placementOf(edit().layout, "plant-1");
      expect(shownFurniture("plant-1").length).toBeGreaterThan(0);

      await pressButton("치우기");

      expect(edit().layout.items.find((item) => item.id === "plant-1")).toBeUndefined();
      expect(shownFurniture("plant-1").map(describe1)).toEqual([]);
      expect(shadowObjects("plant-1").filter((object) => isShown(object)).map(describe1)).toEqual([]);
      expect(visibleFakeModels(furnitureType("plant").model.piece)).toHaveLength(0);
      const plantHeight = furnitureType("plant").model.box.height;
      const tapped = await tapAt(toScreen(placed.x, plantHeight / 2, placed.z));
      expect(tapped?.piece ?? null).not.toBe("plant-1");
      expect(lifted()).not.toBe("plant-1");
    },
    SLOW_TEST_MS
  );

  test(
    "K3 침대를 더한 뒤 '취소'하면 꾸미기 밖 로비에서 침대가 보이지 않고, 침대가 있던 자리를 눌러도 막히지 않는다(바닥 점이 있다)",
    async () => {
      const { onSaveLayout } = await renderLobby(DEF_BOUGHT);
      await enterEdit();
      await addFurniture("침대");
      const placed = placementOf(edit().layout, "bed-1");

      await pressButton("취소");

      expect(screen.getByText("꾸미기")).toBeTruthy();
      expect(mockCanvas.props?.edit ?? null).toBeNull();
      expect(onSaveLayout).not.toHaveBeenCalled();
      expect(shownFurniture("bed-1").map(describe1)).toEqual([]);
      expect(shadowObjects("bed-1").filter((object) => isShown(object)).map(describe1)).toEqual([]);
      expect(visibleFakeModels(furnitureType("bed").model.piece)).toHaveLength(0);
      const bedHeight = furnitureType("bed").model.box.height;
      const tapped = await tapAt(toScreen(placed.x, bedHeight / 2, placed.z));
      expect(tapped?.point ?? null).not.toBeNull();
    },
    SLOW_TEST_MS
  );

  test(
    "K4 침대를 더한 뒤 '완료'하면 저장한 배치에 bed-1이 있고, 꾸미기 밖 로비에서 침대가 그 자리에 침대 모델로 보이며 그 자리를 누르면 막힌다",
    async () => {
      const { onSaveLayout } = await renderLobby(DEF_BOUGHT);
      await enterEdit();
      await addFurniture("침대");
      const bedFloor = floorOf(edit().layout, "bed-1");

      await pressButton("완료");

      expect(onSaveLayout).toHaveBeenCalledTimes(1);
      const saved = onSaveLayout.mock.calls[0][0];
      expect(floorOf(saved, "bed-1")).toEqual(bedFloor);
      expect(screen.getByText("꾸미기")).toBeTruthy();
      const placed = placementOf(saved, "bed-1");
      const shown = shownFurniture("bed-1");
      expect(shown.length).toBeGreaterThan(0);
      for (const object of shown) {
        expect(object.position.x).toBeCloseTo(placed.x, 4);
        expect(object.position.z).toBeCloseTo(placed.z, 4);
      }
      expect(visibleFakeModels(furnitureType("bed").model.piece)).toHaveLength(1);
      // 놓인 침대는 꾸미기 밖에서 길을 막는다(바닥 점이 없다). K3의 "막히지 않는다" 확인이 헛돌지 않는다
      const bedHeight = furnitureType("bed").model.box.height;
      const tapped = await tapAt(toScreen(placed.x, bedHeight / 2, placed.z));
      expect(tapped?.point ?? null).toBeNull();
    },
    SLOW_TEST_MS
  );

  test(
    "K5 침대를 더한 뒤 '처음 배치로'를 누르면 bed-1은 보관함으로 가 보이지 않는다",
    async () => {
      await renderLobby(DEF_BOUGHT);
      await enterEdit();
      await addFurniture("침대");
      expect(shownFurniture("bed-1").length).toBeGreaterThan(0);

      await pressButton("처음 배치로");

      expect(((edit().layout.stored ?? []) as StoredItem[]).map((item) => item.id)).toContain("bed-1");
      expect(shownFurniture("bed-1").map(describe1)).toEqual([]);
      expect(visibleFakeModels(furnitureType("bed").model.piece)).toHaveLength(0);
    },
    SLOW_TEST_MS
  );

  test(
    "K6 꾸미기 밖에서 배치가 바뀌면(서버 배치 받기) 3D를 다시 만들고, 새 배치의 화분 plant-9가 (5.5, 3.5) 칸 자리에 보인다",
    async () => {
      await renderLobby(DEF);
      const before = meshesInScene();
      expect(furnitureObjects("plant-9")).toEqual([]);

      await act(async () => {
        host.setLayout!(copy(DEF_PLUS_PLANT));
      });
      await flushAsync();
      await frames();

      expect(replacedSince(before).count).toBeGreaterThan(0);
      const placed = placementOf(DEF_PLUS_PLANT, "plant-9");
      const shown = shownFurniture("plant-9");
      expect(shown.length).toBeGreaterThan(0);
      for (const object of shown) {
        expect(object.position.x).toBeCloseTo(placed.x, 4);
        expect(object.position.z).toBeCloseTo(placed.z, 4);
      }
    },
    SLOW_TEST_MS
  );
});
