// [spec] qa 테스트(작업 085, 기능 변경, 모바일): 로비 '꾸미기'를 '완료'로 마치고 나올 때 3D 방을 다시 짓지 않고,
// 나온 뒤 방 위에 작은 로딩 표시("방을 정리하고 있어요")를 띄웠다가 방이 부드럽게 그려지면(연달아 5프레임이 34ms 안, 늦어도 1.5초) 내린다.
// 기대값은 명세(private 작업 폴더 085-2026-11-12-로비-꾸미기-완료-빠르게/01-main-spec.md)에서만 가져온다.
// 그대로 둘 동작의 기대값은 지금(고치기 전) 동작에서 가져온다. 테스트마다 이름 앞에 [바뀔]·[그대로]를 붙였다(02-qa-tests.md의 분류와 같다).
//
// 명세 "바뀌는 동작":
//   1. '완료'로 저장에 성공해 나올 때 3D 방을 다시 짓지 않는다. 꾸미던 3D(방 껍데기, 가구, 꾸미기 중 더한 가구, 창밖 풍경)를 그대로 쓰고,
//      가구는 저장된 배치의 자리·보이기로 맞춘다. 배치 표시 수(layoutKey)를 올리지 않는다. 이름표 자리는 저장된 배치로 새로 계산한다.
//   2. '완료'로 나올 때(저장했든 바뀐 것이 없어 저장하지 않았든) 로딩 표시를 띄운다. 방이 보이는 채로 가운데에 반투명 작은 판,
//      돌아가는 표시와 "방을 정리하고 있어요". 처음 로비 준비 표시와 같은 기준(연달아 5프레임이 34ms 안)으로 내리고, 늦어도 1.5초 뒤에는 내린다.
//      떠 있는 동안 이름표·장소 안내·말풍선을 숨기고 내리면 다시 보인다. '저장 중…' 동안에는 꾸미기 화면이고, 표시는 나온 뒤에 뜬다.
//
// 어떻게 보나(구현 전이라 구현 이름을 모른다. 지금 코드는 부르는 방법을 알려고만 읽었다):
// - 화면(Lobby3dScreen), 3D 그리기(Lobby3dCanvas), 방 껍데기·가구 묶음·라룹이는 모두 진짜를 쓰고(082 lobby3d-room-ready-warmup과 같은 구성),
//   Jest에서 돌지 않는 react-three-fiber만 가짜로 둔다. 모델 파일은 모두 로비를 열기 전에 읽힌 것으로 둔다.
// - 한 프레임(frameAfter(ms))은 "ms만큼 시간이 지난 뒤 장면을 한 번 그린다"이다: 가짜 시계(Date.now·performance.now)와 r3f 시계를 ms만큼 돌리고
//   등록된 useFrame을 모두 delta = ms/1000초로 한 번 부른다(082 테스트와 같다). 그래서 구현이 간격을 무엇으로 재든 같은 간격을 본다.
// - "3D를 다시 짓는다"는 "'완료'를 누르기 전에 장면에 있던 메시가 다른 메시로 바뀐다"로 본다(069·072 재현 테스트와 같은 잣대).
//   '완료' 전에 고르기를 풀어(칠한 칸이 없게) 잰다. 창밖 풍경은 가짜 createOutdoor가 불린 수로 본다(다시 만들면 한 번 더 불린다).
// - 가구의 3D 물체는 userData.furnitureOf가 그 가구 id인 물체(대체 모양과 가구 묶음 모델), 그림자는 userData.shadowOf가 그 id인 물체다.
//   가짜 가구 묶음은 모델 이름마다 0.8칸 상자 하나(userData.fakeModel = 모델 이름)를 준다.
// - "보인다"는 조상까지 모두 visible이고 장면에 붙은 것이다. "누르기 판정"은 3D 그리기의 터치 받는 View에 화면 좌표를 넣었을 때 3D 그리기가 넘기는 결과다.
// - 로딩 표시가 "보인다"는 "방을 정리하고 있어요" 글이 있고 스타일로 숨지 않은 것이다. "반투명 작은 판"은 그 글과 돌아가는 표시(ActivityIndicator)를
//   함께 담은 가장 가까운 View가 반투명 바탕(알파 0~1 사이, 또는 투명도 0~1 사이)이고 3D 자리를 꽉 채우지 않는 것, "가운데"는 그 판을 담은 것 가운데
//   3D 자리를 꽉 채우고 가로·세로 가운데 맞춤(alignItems·justifyContent center)인 것이 있는 것, "방이 보이는 채로"는 3D 그리기가 그대로 있고
//   불투명한 검은 판(082의 준비 표시 판)이 없는 것으로 본다.
// - 이름표는 장소 이름표 다섯 글(메뉴 버튼 글은 빼고), 말풍선은 로비 인사 말풍선("오늘도 해냈어!")으로 본다. 인사는 누르기 전까지 남는다.
// - "5프레임이 34ms 안"의 프레임은 '완료'로 꾸미기에서 나온 뒤에 그린 프레임부터 센다고 보았다(표시는 나온 뒤에 뜨므로).
// - 03 결정 2(사용자 2026-11-12)로 D1~D3을 더했다: 로딩 표시는 누르기를 막지 않고(표시는 누르기를 받지 않고 뒤의 방이 받는다),
//   프레임이 그려지지 않아도 꾸미기에서 나온 때부터 1.5초가 지나면 내린다. "프레임이 없다"는 가짜 시계만 돌리고 useFrame을 부르지 않는 것이다.
// - 086-③(라룹 홈쇼핑 화면) 03 결정 1(사용자)로 고친 것(private 작업 폴더 086-2026-11-12-라룹-홈쇼핑/04-홈쇼핑-화면/03-main-decision.md, 보고 05-qa-tests.md):
//   개발용 '가구 더하기' 탭과 화면의 allowAddFurniture 속성이 없어져, 속성을 빼고 B2의 "침대를 더한다" 준비를
//   "홈쇼핑에서 산 침대 bed-1이 보관함에 든 처음 배치(DEF_BOUGHT_BED)로 열어 보관함 칸 '침대'를 눌러 꺼낸다"로 바꿨다. 단언과 기대값은 그대로다.
// - 한계: 실제 폰에서 멈칫함이 줄었는지, 모양이 어울리는지, 장소 안내 말풍선(라룹이가 장소에 섰을 때)은 이 테스트로 보지 않는다.
// - 089-③(private 작업 폴더 089-2026-11-13-캐릭터-꾸미기/05-옷장과-꾸미기-화면/03-main-decision.md A, 사용자 결정 "qa가 새 동작에 맞게 고침")에서
//   옷장이 막는 가구가 아니라 옷장마다 하나인 장소가 되어, K4의 "옮긴 옷장을 누르면 막힘(바닥 점 없음)"만 새 동작
//   "옮긴 옷장을 누르면 바닥 점이 있고 그 옷장의 장소(closetPlaceId(가구 id))가 잡힌다"로 고쳤다. 막힌 칸·원래 자리 확인과 준비는 그대로다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { useState } from "react";
import { StyleSheet } from "react-native";
import * as THREE from "three";
import type { TestInstance } from "test-renderer";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen from "@/components/lobby3d/lobby3d-screen";
import { activeLobbyLayout, applyLobbyLayout, applyRoom, isBlocked, type FloorPoint, type MarkId, type PointerHit } from "@/lib/lobby3d/engine";
import { furnitureType } from "@/lib/lobby3d/furniture-catalog";
import { furniturePlacements, placementKey } from "@/lib/lobby3d/furniture-layout";
import { DEFAULT_LOBBY_LAYOUT, closetPlaceId, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";
import { BASIC_ROOM } from "@/lib/lobby3d/room";

type FrameState = {
  camera: THREE.Camera;
  gl: unknown;
  clock: { elapsedTime: number; getElapsedTime: () => number; getDelta: () => number };
  scene: THREE.Scene;
  size: { width: number; height: number };
};
type FramePart = (state: FrameState, delta: number) => void;

const mockThree: {
  camera: THREE.PerspectiveCamera | null;
  scene: THREE.Scene | null;
  size: { width: number; height: number };
  gl: unknown;
} = {
  camera: null,
  scene: null,
  size: { width: 400, height: 800 },
  gl: null
};
const mockFrames = new Set<FramePart>();
const mockModels = new Map<string, unknown>();
const mockCanvas: { props: Lobby3dCanvasProps | null } = { props: null };
const mockHits: { phase: string; hit: PointerHit | null }[] = [];
/** 3D 그리기가 마지막 프레임에 화면에 넘긴 이름표 화면 좌표. */
const mockLabels: { value: Record<MarkId, { x: number; y: number }> | null } = { value: null };
const mockClock = {
  elapsedTime: 0,
  lastDelta: 0,
  getElapsedTime() {
    return mockClock.elapsedTime;
  },
  getDelta() {
    return mockClock.lastDelta;
  }
};
/** 창밖 풍경을 만든 수(가짜 createOutdoor가 불린 수). */
const mockOutdoor = { created: 0 };
/** primitive를 r3f 장면에 붙이는 일(테스트가 정의한다). */
const mockAttach: { sync: () => void } = { sync: () => {} };

// three는 ES 모듈만 있어 Jest를 거치지 않는 Node의 require로 읽는다(082 테스트와 같다)
jest.mock("three", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const file = require.resolve("three");
  return nodeModule.createRequire(file)(file);
});
jest.mock("@react-three/fiber/native", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const frameState = () => ({ ...mockThree, clock: mockClock });
  return {
    Canvas: ({ children, onCreated }: { children: React.ReactNode; onCreated?: (state: unknown) => void }) => {
      React.useEffect(() => {
        onCreated?.(frameState());
      }, []); // eslint-disable-line react-hooks/exhaustive-deps
      return React.createElement(React.Fragment, null, children);
    },
    useThree: (selector?: (state: unknown) => unknown) => (selector ? selector(frameState()) : frameState()),
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
    // 모든 모델은 로비를 열기 전에 읽혀 있다
    useLoader: (_loader: unknown, url: unknown) => {
      const model = mockModels.get(String(url));
      if (!model) throw new Error(`테스트가 모르는 모델 파일: ${String(url)}`);
      return model;
    }
  };
});
jest.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({ GLTFLoader: class {} }));
jest.mock("three/examples/jsm/utils/SkeletonUtils.js", () => ({
  clone: (object: { clone: (recursive: boolean) => unknown }) => object.clone(true)
}));
jest.mock("three/examples/jsm/geometries/RoundedBoxGeometry.js", () => {
  const T = jest.requireMock<typeof import("three")>("three");
  return {
    RoundedBoxGeometry: function RoundedBoxGeometry(width: number, height: number, depth: number) {
      return new T.BoxGeometry(width, height, depth);
    }
  };
});
jest.mock("@/assets/models/lobby-room.glb", () => "lobby-room.glb");
jest.mock("@/assets/models/writeloop.glb", () => "writeloop.glb");
jest.mock("@/assets/models/lobby-furniture.glb", () => "lobby-furniture.glb");
// 창밖 풍경: 판 하나가 든 장면. 만든 수를 센다
jest.mock("@/components/lobby3d/lobby3d-outdoor", () => {
  const T = jest.requireMock<typeof import("three")>("three");
  return {
    createOutdoor: () => {
      mockOutdoor.created += 1;
      const scene = new T.Scene();
      scene.add(new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial()));
      return { scene, setDaylight: () => {}, update: () => {}, dispose: () => {} };
    }
  };
});
jest.mock("@/components/lobby3d/lobby3d-daylight", () => ({
  ...jest.requireActual("@/components/lobby3d/lobby3d-daylight"),
  DaylightRig: () => null
}));
// 3D 그리기는 진짜를 그리되, 받은 속성과 화면에 넘기는 누르기 결과·이름표 화면 좌표를 적어 둔다
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

// ---------- 고정 값 ----------

const NOW = new Date("2026-11-12T03:00:00.000Z");
/** 명세의 로딩 표시 글. */
const LOADING = "방을 정리하고 있어요";
/** 처음 로비 준비 표시 글(그대로 둘 동작). */
const PREPARING = "방을 준비하고 있어요";
const SAVE_FAILED = "배치를 저장하지 못했어요. 다시 눌러 주세요";
/** 장소 이름표(지금 화면의 글). "학습 기록"은 아래 메뉴 버튼과 글이 같아 버튼 안의 글은 빼고 본다. */
const NAME_TAGS = ["오늘의 질문", "생각 창가", "일기 책상", "밖으로", "학습 기록"];
const GREETING_LINE = "오늘도 해냈어!";
const ROOM_FILE = "lobby-room.glb";
const CHARACTER_FILE = "writeloop.glb";
const FURNITURE_FILE = "lobby-furniture.glb";
const SLOW_TEST_MS = 120_000;

/** 명세의 값: 고르게 그려졌다고 보는 프레임 사이 간격(이하)과 연달아 그려야 할 프레임 수, 상한. */
const STEADY_MS = 34;
const STEADY_FRAMES = 5;
const CAP_MS = 1500;
const FAST_MS = 16;
const SLOW_MS = 50;

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const DEF: LobbyLayout = copy(DEFAULT_LOBBY_LAYOUT);
/** 086-③: 처음 배치 + 홈쇼핑에서 산 침대 bed-1이 든 보관함. */
const DEF_BOUGHT_BED: LobbyLayout = copy({ ...DEFAULT_LOBBY_LAYOUT, stored: [{ id: "bed-1", type: "bed" }] } as LobbyLayout);

/** 그 가구만 바닥 자리를 바꾼 배치(방향은 그대로). */
function withFloor(layout: LobbyLayout, id: string, x: number, z: number): LobbyLayout {
  return {
    ...copy(layout),
    items: copy(layout).items.map((item) => (item.id === id && item.floor ? { ...item, floor: { ...item.floor, x, z } } : item))
  };
}

const WARDROBE_AT: FloorPoint = { x: 7.5, z: 3.5 };
/** 옷장을 옮길 곳: 칸 7,0(home-lobby-edit M9에서 놓을 수 있는 자리. 라룹이가 선 4.2, 6.2와 떨어져 있다). */
const WARDROBE_TO: FloorPoint = { x: 7.5, z: 0.5 };
const DESK_AT: FloorPoint = { x: 1.5, z: 5.5 };
const DESK_TO: FloorPoint = { x: 1.5, z: 6.5 };
/** 일기 책상 이름표 높이(카탈로그의 책상 장소 label.y. 069·072 테스트와 같은 값). */
const DESK_LABEL_Y = 2.1;

// ---------- 가짜 모델 ----------

function fakeModelFor(file: string): unknown {
  if (file === FURNITURE_FILE) {
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
    return { scene, animations: [] };
  }
  if (file === ROOM_FILE) {
    const scene = new THREE.Group();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));
    return { scene, animations: [] };
  }
  return { scene: new THREE.Group(), animations: [] };
}

// ---------- 가짜 gl ----------

function makeGl(): unknown {
  const known: Record<string, unknown> = {
    compile: () => {
      mockAttach.sync();
      return new Set();
    },
    compileAsync: (scene: unknown) => {
      mockAttach.sync();
      return Promise.resolve(scene);
    },
    initTexture: () => {},
    getRenderTarget: () => null,
    setRenderTarget: () => {},
    render: () => {}
  };
  return new Proxy(known, {
    get(target, property) {
      if (typeof property === "symbol" || property === "then") return undefined;
      if (property in target) return target[property];
      return () => {};
    }
  });
}

// ---------- r3f 장면에 primitive 붙이기 ----------

const attached = new Set<THREE.Object3D>();

function syncPrimitives() {
  const scene = mockThree.scene;
  if (!scene) return;
  let nodes: TestInstance[];
  try {
    nodes = screen.container.queryAll((node) => node.type === "primitive");
  } catch {
    return;
  }
  const want = new Set<THREE.Object3D>();
  for (const node of nodes) {
    const object = node.props.object as THREE.Object3D | undefined;
    if (!object) continue;
    let parent: THREE.Object3D = scene;
    for (let up = node.parent; up; up = up.parent) {
      if (up.type === "primitive" && up.props.object) {
        parent = up.props.object as THREE.Object3D;
        break;
      }
    }
    want.add(object);
    if (object.parent !== parent) parent.add(object);
    attached.add(object);
  }
  for (const object of [...attached]) {
    if (!want.has(object)) {
      object.parent?.remove(object);
      attached.delete(object);
    }
  }
}

function makeScene(): THREE.Scene {
  const scene = new THREE.Scene();
  const traverse = THREE.Object3D.prototype.traverse;
  const traverseVisible = THREE.Object3D.prototype.traverseVisible;
  scene.traverse = function (this: THREE.Object3D, callback: (object: THREE.Object3D) => unknown) {
    syncPrimitives();
    traverse.call(this, callback);
  };
  scene.traverseVisible = function (this: THREE.Object3D, callback: (object: THREE.Object3D) => unknown) {
    syncPrimitives();
    traverseVisible.call(this, callback);
  };
  return scene;
}

// ---------- 도우미: 시간과 프레임 ----------

async function flushAsync() {
  for (let index = 0; index < 8; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

/** ms만큼 시간이 지난 뒤 3D 장면을 한 번 그린다(프레임 사이 간격 = ms). count번 되풀이한다. */
async function frameAfter(ms: number, count = 1) {
  for (let index = 0; index < count; index += 1) {
    await act(async () => {
      jest.advanceTimersByTime(ms);
      mockClock.elapsedTime += ms / 1000;
      mockClock.lastDelta = ms / 1000;
      syncPrimitives();
      const state: FrameState = {
        camera: mockThree.camera!,
        gl: mockThree.gl,
        clock: mockClock,
        scene: mockThree.scene!,
        size: mockThree.size
      };
      for (const part of [...mockFrames]) part(state, ms / 1000);
      await Promise.resolve();
      await Promise.resolve();
      jest.advanceTimersByTime(0);
      // 실제 그리기처럼 프레임 끝에 장면의 월드 행렬을 맞춘다(누르기 판정이 이 행렬을 쓴다)
      syncPrimitives();
      mockThree.scene!.updateMatrixWorld(true);
    });
    await act(async () => {
      await Promise.resolve();
    });
  }
}

// ---------- 도우미: 화면 글과 표시 ----------

function hiddenByStyle(node: TestInstance | null): boolean {
  for (let current = node; current; current = current.parent) {
    const style = StyleSheet.flatten(current.props.style) as { opacity?: unknown; display?: unknown } | undefined;
    if (style?.opacity === 0 || style?.display === "none") return true;
  }
  return false;
}

function insideButton(node: TestInstance): boolean {
  for (let current: TestInstance | null = node; current; current = current.parent) {
    if (current.props.accessibilityRole === "button") return true;
  }
  return false;
}

function textShown(text: string, options: { skipButtons?: boolean } = {}): boolean {
  return screen.queryAllByText(text).some((node) => !(options.skipButtons && insideButton(node)) && !hiddenByStyle(node));
}

function loadingShown(): boolean {
  return textShown(LOADING);
}

function shownTags(): string[] {
  return NAME_TAGS.filter((tag) => textShown(tag, { skipButtons: true }));
}

/** 로딩 표시가 떠 있는 모습: 표시가 있고 이름표·인사 말풍선이 없다. */
function loadingView() {
  return { loading: loadingShown(), tags: shownTags(), greeting: textShown(GREETING_LINE) };
}
const LOADING_VIEW = { loading: true, tags: [], greeting: false };
/** 표시를 내린 뒤 모습: 표시가 없고 이름표 다섯과 인사 말풍선이 보인다. */
const QUIET_VIEW = { loading: false, tags: NAME_TAGS, greeting: true };

/** 표시가 사라질 때까지 ms 간격으로 그린다(최대 limit프레임). 사라질 때까지 그린 프레임 수(못 사라지면 null). */
async function framesUntilLoadingGone(ms: number, limit: number): Promise<number | null> {
  for (let index = 1; index <= limit; index += 1) {
    await frameAfter(ms);
    if (!loadingShown()) return index;
  }
  return null;
}

// ---------- 도우미: 판 모양(082 테스트의 찾기 방법) ----------

function rootView(): TestInstance {
  return screen.container.children[0] as TestInstance;
}

function inOrder(): TestInstance[] {
  const list: TestInstance[] = [];
  const walk = (node: TestInstance) => {
    list.push(node);
    for (const child of node.children) if (typeof child !== "string") walk(child);
  };
  walk(screen.container);
  return list;
}

const BLACK = new Set(["#000", "#000000", "#000f", "#000000ff", "black", "rgb(0,0,0)", "rgba(0,0,0,1)"]);

function isOpaqueBlack(color: unknown): boolean {
  return typeof color === "string" && BLACK.has(color.replace(/\s+/g, "").toLowerCase());
}

function fillsParent(node: TestInstance): boolean {
  const style = (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, unknown>;
  if (style.position !== "absolute") return false;
  if (style.inset === 0) return true;
  return style.top === 0 && style.bottom === 0 && style.left === 0 && style.right === 0;
}

/** 그 요소부터 화면 맨 바깥 바로 안까지 모두 꽉 채우는지(3D 자리를 꽉 채우는지). */
function fillsRoot(node: TestInstance): boolean {
  const root = rootView();
  if (node === root) return false;
  for (let current: TestInstance | null = node; current && current !== root; current = current.parent) {
    if (!fillsParent(current)) return false;
  }
  return true;
}

function seeThrough(node: TestInstance): boolean {
  for (let current: TestInstance | null = node; current; current = current.parent) {
    const style = (StyleSheet.flatten(current.props.style) ?? {}) as { opacity?: unknown; display?: unknown };
    if (typeof style.opacity === "number" && style.opacity < 1) return true;
    if (style.display === "none") return true;
  }
  return false;
}

/** 3D 자리를 가리는 불투명한 검은 판(처음 로비 준비 표시의 판). */
function coverPanels(): TestInstance[] {
  const root = rootView();
  return inOrder().filter((node) => {
    if (node === root || node.type !== "View") return false;
    const style = (StyleSheet.flatten(node.props.style) ?? {}) as { backgroundColor?: unknown };
    if (!isOpaqueBlack(style.backgroundColor)) return false;
    if (seeThrough(node)) return false;
    return fillsRoot(node);
  });
}

function canvasView(): TestInstance | null {
  return inOrder().find((node) => typeof node.props.onStartShouldSetResponderCapture === "function") ?? null;
}

/** 색의 알파(0~1). 알 수 없는 색 이름은 불투명(1), "transparent"는 0으로 본다. */
function alphaOf(color: unknown): number {
  if (typeof color !== "string") return 0;
  const c = color.replace(/\s+/g, "").toLowerCase();
  if (c === "transparent") return 0;
  const fn = /^(?:rgba|hsla)\((.+)\)$/.exec(c);
  if (fn) {
    const parts = fn[1].split(",");
    if (parts.length < 4) return 1;
    const a = parts[3].endsWith("%") ? Number(parts[3].slice(0, -1)) / 100 : Number(parts[3]);
    return Number.isFinite(a) ? a : 1;
  }
  const hex = /^#([0-9a-f]+)$/.exec(c);
  if (hex) {
    if (hex[1].length === 8) return parseInt(hex[1].slice(6, 8), 16) / 255;
    if (hex[1].length === 4) return parseInt(hex[1].slice(3, 4), 16) / 15;
    return 1;
  }
  return 1;
}

/** 로딩 표시 판(글과 돌아가는 표시를 함께 담은 가장 가까운 칸)의 모양. */
function loadingPanelShape() {
  const text = screen.queryAllByText(LOADING)[0];
  if (!text) return null;
  let holder: TestInstance | null = null;
  for (let current = text.parent; current; current = current.parent) {
    if (current.queryAll((node) => node.type === "ActivityIndicator").length > 0) {
      holder = current;
      break;
    }
  }
  if (!holder) return { spinner: false, translucent: false, small: false, centered: false };
  const style = (StyleSheet.flatten(holder.props.style) ?? {}) as { backgroundColor?: unknown; opacity?: unknown };
  const alpha = alphaOf(style.backgroundColor);
  const opacity = typeof style.opacity === "number" ? style.opacity : 1;
  const translucent = alpha > 0 && alpha * opacity > 0 && alpha * opacity < 1;
  const root = rootView();
  let centered = false;
  for (let current: TestInstance | null = holder.parent; current && current !== root; current = current.parent) {
    const s = (StyleSheet.flatten(current.props.style) ?? {}) as { alignItems?: unknown; justifyContent?: unknown };
    if (fillsRoot(current) && s.alignItems === "center" && s.justifyContent === "center") centered = true;
  }
  return { spinner: true, translucent, small: !fillsRoot(holder), centered };
}
const PANEL_SHAPE = { spinner: true, translucent: true, small: true, centered: true };

// ---------- 도우미: 3D 장면 ----------

function camera() {
  return mockThree.camera!;
}

function scene() {
  return mockThree.scene!;
}

function isShown(object: THREE.Object3D): boolean {
  let o: THREE.Object3D | null = object;
  while (o) {
    if (!o.visible) return false;
    if (o === scene()) return true;
    o = o.parent;
  }
  return false;
}

function meshesInScene(): Set<THREE.Object3D> {
  syncPrimitives();
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

/** before에 있던 메시 가운데 지금 장면에 없는 것(다시 만들어져 다른 메시로 바뀐 것). */
function replacedSince(before: Set<THREE.Object3D>): { count: number; sample: string[] } {
  const now = meshesInScene();
  const gone = [...before].filter((mesh) => !now.has(mesh));
  return { count: gone.length, sample: gone.slice(0, 5).map(describe1) };
}

function furnitureObjects(id: string): THREE.Object3D[] {
  syncPrimitives();
  const found: THREE.Object3D[] = [];
  scene().traverse((object) => {
    if (object.userData.furnitureOf === id) found.push(object);
  });
  return found;
}

function shadowObjects(id: string): THREE.Object3D[] {
  syncPrimitives();
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
  syncPrimitives();
  const found: THREE.Mesh[] = [];
  scene().traverse((object) => {
    if (object instanceof THREE.Mesh && object.userData.fakeModel === model && isShown(object)) found.push(object);
  });
  return found;
}

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

/** 그 가구의 보이는 3D 물체(모델·대체 모양)와 보이는 그림자가 모두 그 배치의 자리(x·z)와 방향에 있는지. 보이는 물체 수도 함께 준다. */
function poseOf(layout: LobbyLayout, id: string) {
  const place = placementOf(layout, id);
  const objects = shownFurniture(id);
  const shadows = shadowObjects(id).filter((object) => isShown(object));
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-4;
  return {
    objects: objects.length > 0,
    objectsAtPlace: objects.every((o) => near(o.position.x, place.x) && near(o.position.z, place.z) && near(o.rotation.y, place.rotY)),
    shadowsAtPlace: shadows.every((o) => near(o.position.x, place.x) && near(o.position.z, place.z))
  };
}
const AT_PLACE = { objects: true, objectsAtPlace: true, shadowsAtPlace: true };

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
  await frameAfter(FAST_MS, 3);
  expect(down).toBeDefined();
  return down!.hit;
}

/** 3D 그리기가 마지막 프레임에 넘긴 일기 책상 이름표가 장면 점 (x, y, z)의 화면 좌표에 있는지(0.5화소 안). */
function deskLabelNear(x: number, y: number, z: number): boolean {
  const want = toScreen(x, y, z);
  const got = mockLabels.value?.desk;
  if (!got) return false;
  return Math.abs(got.x - want.x) < 0.5 && Math.abs(got.y - want.y) < 0.5;
}

// ---------- 도우미: 꾸미기 조작 ----------

function canvasProps() {
  expect(mockCanvas.props).not.toBeNull();
  return mockCanvas.props!;
}

function layoutKey(): number {
  return canvasProps().layoutKey ?? 0;
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

async function pointer(phase: "down" | "move" | "up", h: PointerHit | null, x: number, y: number) {
  await act(async () => {
    canvasProps().onPointer(phase, h, x, y);
  });
  await flushAsync();
}

async function tapPiece(piece: string, at: FloorPoint) {
  await pointer("down", hit(at, piece), 200, 300);
  await pointer("up", null, 200, 300);
  await frameAfter(FAST_MS, 2);
}

async function dragPiece(piece: string, from: FloorPoint, to: FloorPoint) {
  await pointer("down", hit(from, piece), 200, 300);
  await pointer("move", hit(to, null), 300, 400);
  await pointer("up", null, 300, 400);
  await frameAfter(FAST_MS, 2);
}

/** 골라진 가구 자신을 누른 결과(바닥 가구는 칸 가운데, 벽 가구는 걸린 벽 자리). 075 이후 자신을 다시 톡하면 고르기가 풀린다. */
function selfHit(id: string): PointerHit {
  const item = edit().layout.items.find((entry) => entry.id === id);
  expect(item).toBeDefined();
  if (item!.wall) return { point: null, mark: null, onCharacter: false, piece: id, wall: { wall: item!.wall.wall, along: item!.wall.along } };
  const base = item!.floor ?? edit().layout.items.find((entry) => entry.id === item!.on?.parent)?.floor;
  expect(base).toBeDefined();
  return { point: { x: base!.x, z: base!.z }, mark: null, onCharacter: false, piece: id, wall: null };
}

async function deselect() {
  const id = lifted();
  if (id) {
    await pointer("down", selfHit(id), 200, 300);
    await pointer("up", null, 200, 300);
    await frameAfter(FAST_MS, 2);
  }
  expect(lifted()).toBeNull();
}

/** 버튼을 누른다(프레임은 그리지 않는다). */
async function press(label: string) {
  await fireEvent.press(screen.getByRole("button", { name: label }));
  await flushAsync();
}

/** 086-③ 03 결정 1: '가구 더하기' 탭 대신 보관함 줄의 산 가구 칸(가구 이름)을 눌러 꺼낸다. */
async function addFurniture(name: string) {
  const tray = screen.getByLabelText("보관함");
  await fireEvent.press(within(tray).getByRole("button", { name }));
  await flushAsync();
  await frameAfter(FAST_MS, 2);
}

// ---------- 화면 ----------

type SaveImpl = (value: LobbyLayout) => Promise<LobbyLayout>;
/** 저장(서버). 기본은 보낸 배치를 그대로 돌려준다. */
let saveImpl: SaveImpl;
const onSaveLayout = jest.fn((value: LobbyLayout) => saveImpl(value));
const host: { setLayout: ((value: LobbyLayout) => void) | null } = { setLayout: null };

/** 홈처럼 불러온 배치를 넘기고, 저장에 성공하면 저장한 배치를 다시 넘기는 화면. 꾸미기 밖 배치 바꾸기(서버 배치 받기)는 host.setLayout으로 한다. */
function LobbyHost({ loaded }: { loaded: LobbyLayout }) {
  const [layout, setLayout] = useState(loaded);
  host.setLayout = setLayout;
  const save = async (value: LobbyLayout) => {
    const saved = await onSaveLayout(copy(value));
    setLayout(saved);
    return saved;
  };
  return (
    <Lobby3dScreen
      devPanel={false}
      greeting={{ line: GREETING_LINE, action: "wave", key: 1 }}
      layout={layout}
      onSaveLayout={save}
    />
  );
}

/** 로비를 열고 처음 준비 표시가 사라질 때까지 16ms 간격으로 그린다. */
async function openReadyLobby(loaded: LobbyLayout = DEF) {
  await render(<LobbyHost loaded={loaded} />);
  await flushAsync();
  let ready = false;
  for (let index = 0; index < 60 && !ready; index += 1) {
    await frameAfter(FAST_MS);
    ready = !textShown(PREPARING);
  }
  expect({ ready, tags: shownTags(), greeting: textShown(GREETING_LINE) }).toEqual({ ready: true, tags: NAME_TAGS, greeting: true });
}

async function enterEdit() {
  await press("꾸미기");
  await frameAfter(FAST_MS, 3);
  expect(edit()).toBeTruthy();
}

/** 옷장을 칸 7,0으로 옮기고 고르기를 푼다. 돌려주는 값은 편집 중인 배치(저장할 배치)다. */
async function moveWardrobe(): Promise<LobbyLayout> {
  await dragPiece("wardrobe", WARDROBE_AT, WARDROBE_TO);
  await deselect();
  expect(floorOf(edit().layout, "wardrobe")).toMatchObject({ x: WARDROBE_TO.x, z: WARDROBE_TO.z });
  return copy(edit().layout);
}

/** '완료' 전 장면의 기준: 메시, 배치 표시 수, 창밖 풍경을 만든 수. */
function sceneMark() {
  return { meshes: meshesInScene(), key: layoutKey(), outdoors: mockOutdoor.created };
}

/** '완료' 뒤 다시 짓지 않았는지: 메시가 하나도 바뀌지 않고, 배치 표시 수와 창밖 풍경을 만든 수가 그대로다. */
function rebuiltSince(mark: ReturnType<typeof sceneMark>) {
  return { replaced: replacedSince(mark.meshes), keyChanged: layoutKey() !== mark.key, outdoorsMade: mockOutdoor.created - mark.outdoors };
}
const NOT_REBUILT = { replaced: { count: 0, sample: [] }, keyChanged: false, outdoorsMade: 0 };

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

let errorSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  mockThree.camera = new THREE.PerspectiveCamera(30, mockThree.size.width / mockThree.size.height, 1, 200);
  mockThree.scene = makeScene();
  mockThree.gl = makeGl();
  mockAttach.sync = syncPrimitives;
  attached.clear();
  mockClock.elapsedTime = 0;
  mockClock.lastDelta = 0;
  mockOutdoor.created = 0;
  mockFrames.clear();
  mockCanvas.props = null;
  mockHits.length = 0;
  mockLabels.value = null;
  mockModels.clear();
  for (const file of [ROOM_FILE, CHARACTER_FILE, FURNITURE_FILE]) mockModels.set(file, fakeModelFor(file));
  host.setLayout = null;
  saveImpl = async (value) => copy(value);
  onSaveLayout.mockClear();
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  applyRoom(BASIC_ROOM);
  applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
  errorSpy.mockRestore();
  warnSpy.mockRestore();
  jest.useRealTimers();
});

// ---------- 바뀔 동작 1: '완료'로 저장해 나올 때 3D 방을 다시 짓지 않는다 ----------

describe("[spec] 085 바뀌는 동작 1: '완료'로 저장에 성공해 나올 때 3D 방을 다시 짓지 않고, 가구는 저장된 배치로 맞춘다", () => {
  test(
    "[바뀔] B1 옷장을 칸 7,0으로 옮겨 '완료'하면 배치 표시 수(layoutKey)가 그대로이고, '완료' 전 장면의 메시(방 껍데기·가구·그림자)가 하나도 바뀌지 않으며 창밖 풍경을 새로 만들지 않는다. 옷장은 저장된 자리(7.5, 0.5)에 보인다",
    async () => {
      await openReadyLobby();
      await enterEdit();
      const sent = await moveWardrobe();
      const mark = sceneMark();
      expect(mark.outdoors).toBeGreaterThan(0);

      await press("완료");
      await frameAfter(FAST_MS, 3);

      expect(onSaveLayout).toHaveBeenCalledTimes(1);
      expect(floorOf(onSaveLayout.mock.calls[0][0], "wardrobe")).toEqual(floorOf(sent, "wardrobe"));
      expect(screen.getByRole("button", { name: "꾸미기" })).toBeTruthy();
      expect(rebuiltSince(mark)).toEqual(NOT_REBUILT);
      expect(poseOf(sent, "wardrobe")).toEqual(AT_PLACE);
    },
    SLOW_TEST_MS
  );

  test(
    "[바뀔] B2 꾸미기 중 '가구 더하기'로 침대를 더해 '완료'하면, 더한 침대를 포함해 '완료' 전 장면의 메시가 하나도 바뀌지 않고 layoutKey가 그대로이며, 침대가 저장된 자리에 침대 모델로 보이고 그 자리를 누르면 막힌다",
    async () => {
      await openReadyLobby(DEF_BOUGHT_BED);
      await enterEdit();
      await addFurniture("침대");
      await deselect();
      const sent = copy(edit().layout);
      expect(floorOf(sent, "bed-1")).toBeDefined();
      const mark = sceneMark();
      expect(shownFurniture("bed-1").length).toBeGreaterThan(0);

      await press("완료");
      await frameAfter(FAST_MS, 3);

      expect(onSaveLayout).toHaveBeenCalledTimes(1);
      expect(rebuiltSince(mark)).toEqual(NOT_REBUILT);
      expect(poseOf(sent, "bed-1")).toEqual(AT_PLACE);
      expect(visibleFakeModels(furnitureType("bed").model.piece)).toHaveLength(1);
      // 로딩 표시가 내려간 뒤(있다면) 누른다
      await frameAfter(FAST_MS, 100);
      const placed = placementOf(sent, "bed-1");
      expect(isBlocked(placed.x, placed.z)).toBe(true);
      // 침대는 라룹이가 서 있던 칸(4.2, 6.2)을 덮어 라룹이가 침대 앞으로 옮겨지므로, 라룹이에 가리지 않는 침대 머리 쪽 윗면을 누른다
      const tapped = await tapAt(toScreen(placed.x, furnitureType("bed").model.box.height - 0.1, placed.z - 1.1));
      expect({ point: tapped?.point ?? null, onCharacter: tapped?.onCharacter ?? false }).toEqual({ point: null, onCharacter: false });
    },
    SLOW_TEST_MS
  );

  test(
    "[바뀔] B3 옷장을 보관함에 넣고 '완료'하면 '완료' 전 장면의 메시가 하나도 바뀌지 않고 layoutKey가 그대로이며, 옷장의 모양·그림자가 보이지 않고 옷장 자리를 눌러도 막히지 않는다",
    async () => {
      await openReadyLobby();
      await enterEdit();
      await tapPiece("wardrobe", WARDROBE_AT);
      expect(lifted()).toBe("wardrobe");
      await press("치우기");
      await frameAfter(FAST_MS, 2);
      await deselect();
      expect(edit().layout.items.find((item) => item.id === "wardrobe")).toBeUndefined();
      const mark = sceneMark();

      await press("완료");
      await frameAfter(FAST_MS, 3);

      expect(onSaveLayout).toHaveBeenCalledTimes(1);
      expect(rebuiltSince(mark)).toEqual(NOT_REBUILT);
      expect(shownFurniture("wardrobe").map(describe1)).toEqual([]);
      expect(shadowObjects("wardrobe").filter((object) => isShown(object)).map(describe1)).toEqual([]);
      expect(visibleFakeModels(furnitureType("wardrobe").model.piece)).toHaveLength(0);
      expect(isBlocked(WARDROBE_AT.x, WARDROBE_AT.z)).toBe(false);
      await frameAfter(FAST_MS, 100);
      const tapped = await tapAt(toScreen(WARDROBE_AT.x, furnitureType("wardrobe").model.box.height / 2, WARDROBE_AT.z));
      expect(tapped?.point ?? null).not.toBeNull();
    },
    SLOW_TEST_MS
  );

  test(
    "[바뀔] B4 책상을 (1.5, 6.5)로 옮겨 '완료'하면 '완료' 전 장면의 메시가 하나도 바뀌지 않고 layoutKey가 그대로이며, 일기 책상 이름표는 옮긴 책상 위(1.5, 2.1, 6.5)에 있다",
    async () => {
      await openReadyLobby();
      await enterEdit();
      await dragPiece("desk", DESK_AT, DESK_TO);
      await deselect();
      expect(floorOf(edit().layout, "desk")).toMatchObject({ x: DESK_TO.x, z: DESK_TO.z });
      const sent = copy(edit().layout);
      const mark = sceneMark();

      await press("완료");
      await frameAfter(FAST_MS, 100);

      expect(onSaveLayout).toHaveBeenCalledTimes(1);
      expect(rebuiltSince(mark)).toEqual(NOT_REBUILT);
      expect(poseOf(sent, "desk")).toEqual(AT_PLACE);
      expect(deskLabelNear(DESK_TO.x, DESK_LABEL_Y, DESK_TO.z)).toBe(true);
      // 옮긴 자리와 원래 자리는 화면에서 떨어져 있다(위 확인이 헛돌지 않는다)
      const moved = toScreen(DESK_TO.x, DESK_LABEL_Y, DESK_TO.z);
      const original = toScreen(DESK_AT.x, DESK_LABEL_Y, DESK_AT.z);
      expect(Math.hypot(moved.x - original.x, moved.y - original.y)).toBeGreaterThan(5);
    },
    SLOW_TEST_MS
  );
});

// ---------- 바뀔 동작 2: '완료'로 나올 때 로딩 표시 ----------

describe("[spec] 085 바뀌는 동작 2: '완료'로 나오면 방 위에 작은 로딩 표시를 띄웠다가, 연달아 5프레임이 34ms 안에 그려지면(늦어도 1.5초) 내린다", () => {
  test(
    "[바뀔] B5 저장해 나온 직후(프레임 전) '방을 정리하고 있어요'와 돌아가는 표시가 반투명 작은 판에 담겨 가운데에 있고, 3D 그리기는 그대로이며 불투명한 검은 판과 처음 준비 표시는 없고, 이름표·인사 말풍선이 숨는다",
    async () => {
      await openReadyLobby();
      await enterEdit();
      await moveWardrobe();

      await press("완료");

      expect(screen.getByRole("button", { name: "꾸미기" })).toBeTruthy();
      expect(loadingView()).toEqual(LOADING_VIEW);
      expect(loadingPanelShape()).toEqual(PANEL_SHAPE);
      expect({ canvas: canvasView() !== null, blackCover: coverPanels().length, preparing: textShown(PREPARING) }).toEqual({
        canvas: true,
        blackCover: 0,
        preparing: false
      });
    },
    SLOW_TEST_MS
  );

  test(
    "[바뀔] B6 저장해 나온 뒤 16ms 간격으로 4프레임을 그려도 표시가 남고 이름표·인사 말풍선이 없다. 계속 16ms로 그리면 40프레임 안에 표시가 사라지고 이름표 다섯과 인사 말풍선이 다시 보인다",
    async () => {
      await openReadyLobby();
      await enterEdit();
      await moveWardrobe();

      await press("완료");
      expect(loadingView()).toEqual(LOADING_VIEW);
      for (let index = 1; index <= STEADY_FRAMES - 1; index += 1) {
        await frameAfter(FAST_MS);
        expect({ frame: index, ...loadingView() }).toEqual({ frame: index, ...LOADING_VIEW });
      }

      const more = await framesUntilLoadingGone(FAST_MS, 40);
      expect(more).not.toBeNull();
      expect(loadingView()).toEqual(QUIET_VIEW);
    },
    SLOW_TEST_MS
  );

  test(
    "[바뀔] B7 프레임 사이 간격이 정확히 34ms면 기준을 채운다: 저장해 나온 뒤 4프레임에는 표시가 남고, 30프레임(1.02초) 안에 사라진다",
    async () => {
      await openReadyLobby();
      await enterEdit();
      await moveWardrobe();

      await press("완료");
      await frameAfter(STEADY_MS, STEADY_FRAMES - 1);
      expect(loadingView()).toEqual(LOADING_VIEW);

      const more = await framesUntilLoadingGone(STEADY_MS, 30 - (STEADY_FRAMES - 1));
      expect(more).not.toBeNull();
      expect(loadingView()).toEqual(QUIET_VIEW);
    },
    SLOW_TEST_MS
  );

  test(
    "[바뀔] B8 프레임 사이 간격이 35ms면 기준을 채우지 못한다: 저장해 나온 뒤 40프레임(1.4초)을 그려도 표시가 남고 이름표·인사 말풍선이 없다",
    async () => {
      await openReadyLobby();
      await enterEdit();
      await moveWardrobe();

      await press("완료");
      expect(loadingShown()).toBe(true);
      for (let index = 1; index <= 40; index += 1) {
        await frameAfter(STEADY_MS + 1);
        if (!loadingShown()) break;
      }
      expect(loadingView()).toEqual(LOADING_VIEW);
    },
    SLOW_TEST_MS
  );

  test(
    "[바뀔] B9 '연달아'가 아니면 기준을 채우지 못한다: 저장해 나온 뒤 16ms 4프레임과 50ms 1프레임을 되풀이하면 1.4초까지 표시가 남는다",
    async () => {
      await openReadyLobby();
      await enterEdit();
      await moveWardrobe();

      await press("완료");
      expect(loadingShown()).toBe(true);
      let elapsed = 0;
      let goneAt: number | null = null;
      while (elapsed + FAST_MS * 4 + SLOW_MS <= 1400 && goneAt === null) {
        for (const ms of [FAST_MS, FAST_MS, FAST_MS, FAST_MS, SLOW_MS]) {
          await frameAfter(ms);
          elapsed += ms;
          if (!loadingShown()) {
            goneAt = elapsed;
            break;
          }
        }
      }
      expect({ goneAt, ...loadingView() }).toEqual({ goneAt: null, ...LOADING_VIEW });
    },
    SLOW_TEST_MS
  );

  test(
    "[바뀔] B10 상한: 저장해 나온 뒤 50ms 간격(기준 못 채움)으로 그리면 1.4초에는 표시가 남고, 1.7초까지는 표시가 사라지고 이름표 다섯과 인사 말풍선이 보인다",
    async () => {
      await openReadyLobby();
      await enterEdit();
      await moveWardrobe();

      await press("완료");
      expect(loadingShown()).toBe(true);
      let elapsed = 0;
      let goneAt: number | null = null;
      while (elapsed < 1400) {
        await frameAfter(SLOW_MS);
        elapsed += SLOW_MS;
        if (goneAt === null && !loadingShown()) goneAt = elapsed;
      }
      expect({ elapsed, goneAt, ...loadingView() }).toEqual({ elapsed: 1400, goneAt: null, ...LOADING_VIEW });

      while (elapsed < CAP_MS + 200 && loadingShown()) {
        await frameAfter(SLOW_MS);
        elapsed += SLOW_MS;
      }
      expect({ goneBy1700: elapsed <= CAP_MS + 200, ...loadingView() }).toEqual({ goneBy1700: true, ...QUIET_VIEW });
    },
    SLOW_TEST_MS
  );

  test(
    "[바뀔] B11 아무것도 바꾸지 않고 '완료'하면(저장하지 않음) 나온 직후 같은 로딩 표시(반투명 작은 판)가 뜨고 이름표·인사 말풍선이 숨으며, 16ms 4프레임 뒤에도 남고 40프레임 안에 사라진다",
    async () => {
      await openReadyLobby();
      await enterEdit();

      await press("완료");

      expect(onSaveLayout).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "꾸미기" })).toBeTruthy();
      expect(loadingView()).toEqual(LOADING_VIEW);
      expect(loadingPanelShape()).toEqual(PANEL_SHAPE);
      expect(coverPanels().length).toBe(0);
      await frameAfter(FAST_MS, STEADY_FRAMES - 1);
      expect(loadingView()).toEqual(LOADING_VIEW);
      const more = await framesUntilLoadingGone(FAST_MS, 40);
      expect(more).not.toBeNull();
      expect(loadingView()).toEqual(QUIET_VIEW);
    },
    SLOW_TEST_MS
  );

  test(
    "[바뀔] B12 저장 응답을 기다리며 16ms로 10프레임을 그리는 동안에는 표시가 없고, 저장에 성공해 나온 뒤에야 표시가 뜬다. 나온 뒤 16ms 4프레임에는 남고 40프레임 안에 사라진다",
    async () => {
      const pending = deferred<LobbyLayout>();
      saveImpl = () => pending.promise;
      await openReadyLobby();
      await enterEdit();
      const sent = await moveWardrobe();

      await press("완료");
      await frameAfter(FAST_MS, 10);
      expect({ saving: textShown("저장 중…"), loading: loadingShown() }).toEqual({ saving: true, loading: false });

      await act(async () => {
        pending.resolve(copy(sent));
      });
      await flushAsync();
      expect(screen.getByRole("button", { name: "꾸미기" })).toBeTruthy();
      expect(loadingView()).toEqual(LOADING_VIEW);
      await frameAfter(FAST_MS, STEADY_FRAMES - 1);
      expect(loadingView()).toEqual(LOADING_VIEW);
      const more = await framesUntilLoadingGone(FAST_MS, 40);
      expect(more).not.toBeNull();
      expect(loadingView()).toEqual(QUIET_VIEW);
    },
    SLOW_TEST_MS
  );
});

// ---------- 03 결정 2: 로딩 표시 세부 ----------

/** 누르기를 받지 않는지: 그 요소나 감싼 것에 pointerEvents "none"이 있다. */
function noneInChain(node: TestInstance): boolean {
  const root = rootView();
  for (let current: TestInstance | null = node; current && current !== root; current = current.parent) {
    if (current.props.pointerEvents === "none") return true;
  }
  return false;
}

/**
 * 로딩 표시가 누르기를 받지 않는지: 판(글과 돌아가는 표시를 담은 칸)이 누르기를 받지 않고("none"이 그 칸이나 감싼 것에 있음),
 * 판을 감싼 것 가운데 3D 자리를 꽉 채운 것은 모두 "none"이나 "box-none"이다(뒤의 방이 누르기를 받는다).
 */
function loadingIgnoresTouches(): { panel: boolean; wrappers: boolean } | null {
  const text = screen.queryAllByText(LOADING)[0];
  if (!text) return null;
  let holder: TestInstance | null = null;
  for (let current = text.parent; current; current = current.parent) {
    if (current.queryAll((node) => node.type === "ActivityIndicator").length > 0) {
      holder = current;
      break;
    }
  }
  if (!holder) return null;
  const root = rootView();
  let wrappers = true;
  for (let current: TestInstance | null = holder; current && current !== root; current = current.parent) {
    if (fillsRoot(current) && !(current.props.pointerEvents === "none" || current.props.pointerEvents === "box-none" || noneInChain(current))) wrappers = false;
  }
  return { panel: noneInChain(holder), wrappers };
}

describe("[spec] 085 03 결정 2: 로딩 표시는 누르기를 막지 않고, 프레임이 멈춰도 나온 때부터 1.5초 뒤 내린다", () => {
  test(
    "[바뀔] D1 저장해 나온 뒤 로딩 표시가 떠 있는 동안 표시는 누르기를 받지 않고, 빈 바닥 (2.5, 8.5)을 누르면 라룹이가 걷기 시작한다(35ms 5프레임 뒤 0.1칸 넘게 움직이고 표시는 남아 있다)",
    async () => {
      await openReadyLobby();
      await enterEdit();
      await moveWardrobe();

      await press("완료");
      expect(loadingShown()).toBe(true);
      expect(loadingIgnoresTouches()).toEqual({ panel: true, wrappers: true });

      const sim = canvasProps().sim;
      const from = { x: sim.x, z: sim.z };
      const target = toScreen(2.5, 0, 8.5);
      await touch("onResponderGrant", target);
      await touch("onResponderRelease", target);
      await flushAsync();
      await frameAfter(STEADY_MS + 1, 5);

      expect({ moved: Math.hypot(sim.x - from.x, sim.z - from.z) > 0.1, loading: loadingShown() }).toEqual({ moved: true, loading: true });
    },
    SLOW_TEST_MS
  );

  test(
    "[바뀔] D2 저장해 나온 뒤 프레임을 하나도 그리지 않아도: 1.4초 뒤에는 표시가 남고 이름표·인사 말풍선이 없으며, 1.6초 뒤에는 표시가 사라지고 이름표 다섯과 인사 말풍선이 보인다",
    async () => {
      await openReadyLobby();
      await enterEdit();
      await moveWardrobe();

      await press("완료");
      expect(loadingView()).toEqual(LOADING_VIEW);
      await act(async () => {
        jest.advanceTimersByTime(1400);
      });
      await flushAsync();
      expect(loadingView()).toEqual(LOADING_VIEW);

      await act(async () => {
        jest.advanceTimersByTime(200);
      });
      await flushAsync();
      expect(loadingView()).toEqual(QUIET_VIEW);
    },
    SLOW_TEST_MS
  );

  test(
    "[바뀔] D3 아무것도 바꾸지 않고 '완료'한 뒤 프레임을 그리지 않아도 1.4초 뒤에는 표시가 남고, 1.6초 뒤에는 사라져 이름표 다섯과 인사 말풍선이 보인다",
    async () => {
      await openReadyLobby();
      await enterEdit();

      await press("완료");
      expect(onSaveLayout).not.toHaveBeenCalled();
      expect(loadingView()).toEqual(LOADING_VIEW);
      await act(async () => {
        jest.advanceTimersByTime(1400);
      });
      await flushAsync();
      expect(loadingView()).toEqual(LOADING_VIEW);

      await act(async () => {
        jest.advanceTimersByTime(200);
      });
      await flushAsync();
      expect(loadingView()).toEqual(QUIET_VIEW);
    },
    SLOW_TEST_MS
  );
});

// ---------- 그대로 둘 동작 ----------

describe("[spec] 085 그대로여야 할 동작", () => {
  test(
    "[그대로] K1 저장 응답을 기다리는 동안('저장 중…')에는 꾸미기 화면에 있고(취소·처음 배치로가 보이고 막힘, '꾸미기' 없음) 저장은 한 번이며 로딩 표시가 없다",
    async () => {
      const pending = deferred<LobbyLayout>();
      saveImpl = () => pending.promise;
      await openReadyLobby();
      await enterEdit();
      await moveWardrobe();

      await press("완료");
      await fireEvent.press(screen.getByText("저장 중…"));
      await flushAsync();
      await frameAfter(FAST_MS, 10);

      const disabled = (name: string) => screen.getByRole("button", { name }).props.accessibilityState?.disabled === true;
      expect({
        calls: onSaveLayout.mock.calls.length,
        saving: textShown("저장 중…"),
        cancelDisabled: disabled("취소"),
        resetDisabled: disabled("처음 배치로"),
        decorate: screen.queryAllByRole("button", { name: "꾸미기" }).length,
        loading: loadingShown()
      }).toEqual({ calls: 1, saving: true, cancelDisabled: true, resetDisabled: true, decorate: 0, loading: false });
    },
    SLOW_TEST_MS
  );

  test(
    "[그대로] K2 저장에 실패하면 꾸미기에 머물며 '배치를 저장하지 못했어요. 다시 눌러 주세요'를 띄우고, 로딩 표시가 없으며 3D를 다시 짓지 않는다('완료'를 다시 누를 수 있다)",
    async () => {
      saveImpl = async () => {
        throw new Error("네트워크");
      };
      await openReadyLobby();
      await enterEdit();
      await moveWardrobe();
      const mark = sceneMark();

      await press("완료");
      await frameAfter(FAST_MS, 10);

      expect({
        calls: onSaveLayout.mock.calls.length,
        toast: screen.queryAllByText(SAVE_FAILED).length,
        done: screen.queryAllByRole("button", { name: "완료" }).length,
        cancel: screen.queryAllByRole("button", { name: "취소" }).length,
        decorate: screen.queryAllByRole("button", { name: "꾸미기" }).length,
        loading: loadingShown()
      }).toEqual({ calls: 1, toast: 1, done: 1, cancel: 1, decorate: 0, loading: false });
      expect(rebuiltSince(mark)).toEqual(NOT_REBUILT);
    },
    SLOW_TEST_MS
  );

  test(
    "[그대로] K3 옷장을 옮긴 뒤 '취소'로 나오면 저장하지 않고 로딩 표시가 없으며(나온 직후와 16ms 10프레임 뒤), 이름표·인사 말풍선이 바로 보이고 옷장은 편집 전 자리(7.5, 3.5)에 있다",
    async () => {
      await openReadyLobby();
      await enterEdit();
      await moveWardrobe();

      await press("취소");
      expect({ decorate: screen.queryAllByRole("button", { name: "꾸미기" }).length, ...loadingView() }).toEqual({ decorate: 1, ...QUIET_VIEW });
      await frameAfter(FAST_MS, 10);
      expect(loadingView()).toEqual(QUIET_VIEW);
      expect(onSaveLayout).not.toHaveBeenCalled();
      expect(poseOf(DEF, "wardrobe")).toEqual(AT_PLACE);
    },
    SLOW_TEST_MS
  );

  test(
    "[그대로] K4 옷장을 칸 7,0으로 옮겨 '완료'한 뒤 꾸미기 밖에서: 지금 배치가 저장한 배치이고, 칸 7,0은 막히고 칸 7,3은 지나갈 수 있으며, 옮긴 옷장을 누르면 바닥 점이 있고 그 옷장 장소가 잡히며(089-③ 03 결정 A) 원래 자리를 누르면 바닥 점이 있다",
    async () => {
      await openReadyLobby();
      await enterEdit();
      const sent = await moveWardrobe();

      await press("완료");
      await frameAfter(FAST_MS, 100);

      expect(floorOf(activeLobbyLayout(), "wardrobe")).toEqual(floorOf(sent, "wardrobe"));
      expect({ newBlocked: isBlocked(WARDROBE_TO.x, WARDROBE_TO.z), oldBlocked: isBlocked(WARDROBE_AT.x, WARDROBE_AT.z) }).toEqual({
        newBlocked: true,
        oldBlocked: false
      });
      expect(poseOf(sent, "wardrobe")).toEqual(AT_PLACE);
      const height = furnitureType("wardrobe").model.box.height;
      const onNew = await tapAt(toScreen(WARDROBE_TO.x, height / 2, WARDROBE_TO.z));
      expect({ hasPoint: (onNew?.point ?? null) !== null, mark: onNew?.mark ?? null }).toEqual({ hasPoint: true, mark: closetPlaceId("wardrobe") });
      const onOld = await tapAt(toScreen(WARDROBE_AT.x, 0.4, WARDROBE_AT.z));
      expect(onOld?.point ?? null).not.toBeNull();
    },
    SLOW_TEST_MS
  );

  test(
    "[그대로] K5 서버가 보낸 것과 다른 배치를 돌려주면(옷장 7,0에 더해 책상이 1.5, 6.5) 나온 뒤 3D 가구와 일기 책상 이름표는 돌려준 배치를 따른다",
    async () => {
      await openReadyLobby();
      await enterEdit();
      const sent = await moveWardrobe();
      const returned = withFloor(sent, "desk", DESK_TO.x, DESK_TO.z);
      saveImpl = async () => copy(returned);

      await press("완료");
      await frameAfter(FAST_MS, 100);

      expect(floorOf(activeLobbyLayout(), "desk")).toMatchObject({ x: DESK_TO.x, z: DESK_TO.z });
      expect({ desk: poseOf(returned, "desk"), wardrobe: poseOf(returned, "wardrobe") }).toEqual({ desk: AT_PLACE, wardrobe: AT_PLACE });
      expect(deskLabelNear(DESK_TO.x, DESK_LABEL_Y, DESK_TO.z)).toBe(true);
    },
    SLOW_TEST_MS
  );

  test(
    "[그대로] K6 '완료'로 나온 뒤 꾸미기 밖에서 배치가 바뀌면(서버 배치 받기) 지금처럼 3D를 다시 짓고(layoutKey가 오르고 메시가 바뀜), 새 배치의 책상이 (1.5, 6.5)에 보인다",
    async () => {
      await openReadyLobby();
      await enterEdit();
      const sent = await moveWardrobe();
      await press("완료");
      await frameAfter(FAST_MS, 100);
      const mark = sceneMark();
      const server = withFloor(sent, "desk", DESK_TO.x, DESK_TO.z);

      await act(async () => {
        host.setLayout!(copy(server));
      });
      await flushAsync();
      await frameAfter(FAST_MS, 3);

      expect(layoutKey()).toBeGreaterThan(mark.key);
      expect(replacedSince(mark.meshes).count).toBeGreaterThan(0);
      expect(poseOf(server, "desk")).toEqual(AT_PLACE);
    },
    SLOW_TEST_MS
  );

  test(
    "[그대로] K7 처음 로비에 들어올 때는 '방을 준비하고 있어요'와 불투명한 검은 판이 뜨고 '방을 정리하고 있어요'는 없다",
    async () => {
      await render(<LobbyHost loaded={DEF} />);
      await flushAsync();
      await frameAfter(SLOW_MS, 2);
      expect({ preparing: textShown(PREPARING), blackCover: coverPanels().length > 0, loading: loadingShown() }).toEqual({
        preparing: true,
        blackCover: true,
        loading: false
      });
    },
    SLOW_TEST_MS
  );

  test(
    "[그대로] K8 '완료'로 옷장을 7,0에 둔 뒤 다시 꾸미기에 들어가 옷장을 옮겼다가 '취소'하면, 옷장은 저장된 자리(7.5, 0.5)로 돌아오고 로딩 표시가 없다",
    async () => {
      await openReadyLobby();
      await enterEdit();
      const sent = await moveWardrobe();
      await press("완료");
      await frameAfter(FAST_MS, 100);

      await enterEdit();
      await dragPiece("wardrobe", WARDROBE_TO, { x: 7.5, z: 1.5 });
      await deselect();
      await press("취소");
      expect(loadingShown()).toBe(false);
      await frameAfter(FAST_MS, 3);

      expect(poseOf(sent, "wardrobe")).toEqual(AT_PLACE);
      expect(loadingShown()).toBe(false);
    },
    SLOW_TEST_MS
  );

  test(
    "[그대로] K9 아무것도 바꾸지 않고 '완료'하면 저장하지 않고, 3D를 다시 짓지 않는다(layoutKey·메시·창밖 풍경 그대로)",
    async () => {
      await openReadyLobby();
      await enterEdit();
      const mark = sceneMark();

      await press("완료");
      await frameAfter(FAST_MS, 100);

      expect(onSaveLayout).not.toHaveBeenCalled();
      expect(rebuiltSince(mark)).toEqual(NOT_REBUILT);
    },
    SLOW_TEST_MS
  );
});
