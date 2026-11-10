// three보다 먼저 불러와야 한다(Hermes에 없는 FinalizationRegistry 대체).
import "@/lib/lobby3d/hermes-polyfills";
import { Canvas, useFrame, useThree } from "@react-three/fiber/native";
import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { StyleSheet, View, type GestureResponderEvent } from "react-native";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { CHAIR, LobbySim, MARKS, ROOM, activeLobbyLayout, cameraPose, type FloorPoint, type MarkId, type PointerHit } from "@/lib/lobby3d/engine";
import { layoutGeometry, layoutItem, storedItems, type LobbyLayout, type WallSide } from "@/lib/lobby3d/lobby-layout";
import { BASIC_ROOM, currentRoom, outsideExit } from "@/lib/lobby3d/room";
import type { EditMark, EditWallMark, EditZone } from "@/lib/lobby3d/lobby-edit";
import type { Daylight } from "@/lib/lobby3d/daylight";
import { buildPlacements, furniturePlacements, placementKey, type FurniturePlacement } from "@/lib/lobby3d/furniture-layout";
import { BUBBLE_HEIGHT, Character, CharacterErrorBoundary, type CharacterHandle } from "./lobby3d-character";
import { DaylightRig, createDaylightState } from "./lobby3d-daylight";
import { BakedFurniture, BakedFurnitureErrorBoundary } from "./lobby3d-furniture";
import { BakedRoom, BakedRoomErrorBoundary } from "./lobby3d-room";

// 3D 로비 그리기. 동작 규칙은 LobbySim(화면이 가진다)에 있고, 여기서는 매 프레임 그 상태를 그림으로 옮긴다.
// 테스트에서는 이 모듈을 가짜로 바꾼다(three·expo-gl은 Jest에서 돌지 않는다).

export interface ToonSettings {
  /** 명암 단계. 2면 거의 평평한 색면, 3이면 웹 시험본과 같다. */
  steps: 2 | 3;
  /** 외곽선 굵기 배율(1 = 웹 시험본). */
  outline: number;
}

export interface LobbyProjection {
  /** 말풍선 꼬리가 닿을 화면 좌표(라이트루프 머리 위). */
  bubble: { x: number; y: number };
  /** 장소 이름표 화면 좌표. */
  labels: Record<MarkId, { x: number; y: number }>;
  fps: number;
}

export type LobbyPointerPhase = "down" | "move" | "up" | "cancel";

/** 편집 모드(꾸미기)에서 그릴 것. */
export interface LobbyCanvasEdit {
  /** 편집 중인 배치. 가구를 이 배치대로 옮겨 그린다(방을 다시 만들지 않는다). */
  layout: LobbyLayout;
  /** 바닥에 칠할 칸. */
  marks: EditMark[];
  /** 벽에 칠할 자리(고른 벽 가구). */
  wallMarks: EditWallMark[];
  /** 고른 가구에 딸린 장소의 구역과 서는 자리. 바닥에는 서는 자리만 노랑 점으로 보인다. */
  zone: EditZone | null;
  /** 가구를 끄는 중인지. 끄는 동안은 창밖 장면·창문 빛을 끌기 전 배치로 둔다. */
  dragging: boolean;
  /** 고른 가구. 골라진 줄 알게 띄우고 천천히 출렁이게 한다(바닥 가구는 위로, 벽 가구는 벽에서 앞으로). 그림자는 제자리다. */
  lifted: string | null;
  /** 카메라가 따라갈 점. 없으면 지금 자리에 둔다. */
  focus: FloorPoint | null;
  /** 돌리기 버튼(화면 아래)을 보일 가구. 없으면 숨긴다. */
  handle: string | null;
}

export interface Lobby3dCanvasProps {
  sim: LobbySim;
  /** 화면 가로에 보이는 바닥 폭(칸). */
  viewWidth: number;
  toon: ToonSettings;
  /** 매 프레임. 화면이 여기서 sim을 한 단계 진행한다. */
  onFrame: (dt: number, nowMs: number) => void;
  onPointer: (phase: LobbyPointerPhase, hit: PointerHit | null, x: number, y: number) => void;
  onProject: (projection: LobbyProjection) => void;
  /**
   * 매 프레임 말풍선 꼬리가 닿을 화면 좌표와 장소 이름표 화면 좌표. 화면이 다시 그리지 않고 옮겨,
   * 말풍선·이름표가 라이트루프와 카메라를 바로 따라간다.
   */
  onOverlayFrame?: (bubble: { x: number; y: number }, labels: Record<MarkId, { x: number; y: number }>) => void;
  /** 화면이 다른 화면 아래에 깔려 있을 때처럼 그리기를 멈출 때. */
  paused?: boolean;
  /** 지금 시각의 햇빛·하루의 때·계절(daylightAt). 바뀌면 방 색감·창문 빛·천장 조명·창밖이 부드럽게 따라간다. */
  daylight: Daylight;
  /** 가구 배치를 바꿀 때마다(applyLobbyLayout) 바뀌는 수. 바뀌면 가구·이름표·창문 빛을 지금 배치로 다시 만든다. */
  layoutKey?: number;
  /** 편집 모드. 있으면 라이트루프와 발밑 그림자를 숨기고, 가구를 편집 중인 배치대로 그리고, 칠할 칸을 바닥에 보인다. */
  edit?: LobbyCanvasEdit | null;
  /**
   * 편집 모드를 매 프레임 직접 읽는 곳. 있으면 edit 대신 이것을 읽는다.
   * 가구를 끄는 동안에는 3D 그리기와 누르기 처리가 자바스크립트 일꾼을 차지해 화면 다시 그리기가 밀리므로,
   * 다시 그리기를 기다리지 않고 가구·칸 칠·카메라가 바로 따라가게 한다.
   */
  editLive?: MutableRefObject<LobbyCanvasEdit | null>;
}

const LINE = 0x3d1b0f;

export default function Lobby3dCanvas(props: Lobby3dCanvasProps) {
  const pickRef = useRef<((x: number, y: number) => PointerHit | null) | null>(null);
  const send = (phase: LobbyPointerPhase, event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    const hit = phase === "cancel" || phase === "up" ? null : pickRef.current?.(locationX, locationY) ?? null;
    props.onPointer(phase, hit, locationX, locationY);
  };
  return (
    <View
      style={styles.fill}
      onStartShouldSetResponderCapture={() => true}
      onMoveShouldSetResponderCapture={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(event) => send("down", event)}
      onResponderMove={(event) => send("move", event)}
      onResponderRelease={(event) => send("up", event)}
      onResponderTerminate={(event) => send("cancel", event)}
    >
      <Canvas
        style={styles.fill}
        frameloop={props.paused ? "never" : "always"}
        camera={{ position: [4, 12, 24], fov: ROOM.fovDeg, near: 1, far: 200 }}
        gl={{ antialias: true }}
      >
        <Scene {...props} pickRef={pickRef} />
      </Canvas>
    </View>
  );
}

// ---------- 재질·외곽선 ----------

function gradientTexture(steps: 2 | 3): THREE.DataTexture {
  const tones = steps === 2 ? [175, 255] : [150, 210, 255];
  const data = new Uint8Array(tones.length * 4);
  tones.forEach((tone, i) => data.set([tone, tone, tone, 255], i * 4));
  const texture = new THREE.DataTexture(data, tones.length, 1, THREE.RGBAFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

interface OutlinePart {
  mesh: THREE.Mesh;
  size: THREE.Vector3;
  thickness: number;
}

class WorldKit {
  materials = new Map<number, THREE.MeshLambertMaterial>();
  toonMaterials: THREE.MeshToonMaterial[] = [];
  outlines: OutlinePart[] = [];
  outlineMaterial = new THREE.MeshBasicMaterial({ color: LINE, side: THREE.BackSide });
  gradient = gradientTexture(3);

  /** 방과 가구는 부드러운 명암을 쓴다. 카툰 명암(toonMaterials)은 라룹이만 쓴다. */
  soft(color: number): THREE.MeshLambertMaterial {
    let material = this.materials.get(color);
    if (!material) {
      material = new THREE.MeshLambertMaterial({ color });
      this.materials.set(color, material);
    }
    return material;
  }

  part(geometry: THREE.BufferGeometry, color: number, outline = 0.03, parent?: THREE.Object3D): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, this.soft(color));
    if (outline > 0) {
      geometry.computeBoundingBox();
      const size = new THREE.Vector3();
      geometry.boundingBox!.getSize(size);
      const shell = new THREE.Mesh(geometry, this.outlineMaterial);
      shell.raycast = () => {};
      mesh.add(shell);
      this.outlines.push({ mesh: shell, size, thickness: outline });
    }
    parent?.add(mesh);
    return mesh;
  }

  applyToon(toon: ToonSettings) {
    this.gradient.dispose();
    this.gradient = gradientTexture(toon.steps);
    this.toonMaterials.forEach((m) => {
      m.gradientMap = this.gradient;
      m.needsUpdate = true;
    });
    this.outlines.forEach(({ mesh, size, thickness }) => {
      const t = thickness * toon.outline;
      mesh.scale.set(1 + (2 * t) / Math.max(size.x, 0.01), 1 + (2 * t) / Math.max(size.y, 0.01), 1 + (2 * t) / Math.max(size.z, 0.01));
    });
  }
}

function seeded(seed: number) {
  let v = seed;
  return () => {
    v = (v * 16807) % 2147483647;
    return v / 2147483647;
  };
}

function rgbaTexture(data: Uint8Array, width: number, height: number, srgb: boolean): THREE.DataTexture {
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

// 나무 널빤지 바닥: 가로로 긴 널빤지를 줄마다 어긋나게 깔고, 널빤지마다 색과 나뭇결을 조금씩 달리한다. 한 장 = 4칸 × 4칸.
function floorTexture(): THREE.DataTexture {
  const size = 512;
  const rowPx = 64; // 한 줄(널빤지 폭) = 0.5칸
  const data = new Uint8Array(size * size * 4);
  const base = [0xdc, 0x9c, 0x62];
  const rand = seeded(7);
  for (let row = 0; row < size / rowPx; row += 1) {
    // 이 줄의 널빤지: x마다 몇 번째 널빤지인지, 이음매인지
    const plankOf = new Int16Array(size);
    const seamAt = new Uint8Array(size);
    let next = Math.floor(rand() * 160);
    let plank = 0;
    for (let px = 0; px < size; px += 1) {
      if (px === next) {
        plank += 1;
        next += 160 + Math.floor(rand() * 200);
      }
      plankOf[px] = plank;
    }
    for (let px = 1; px < size; px += 1) {
      if (plankOf[px] !== plankOf[px - 1]) for (const q of [px - 1, px, px + 1]) if (q < size) seamAt[q] = 1;
    }
    const tints = Array.from({ length: plank + 1 }, () => 0.9 + rand() * 0.14);
    const phases = Array.from({ length: plank + 1 }, () => rand() * 100);
    for (let y = row * rowPx; y < (row + 1) * rowPx; y += 1) {
      const ry = y - row * rowPx;
      const edge = ry < 2 ? 0.74 : ry === 2 ? 1.05 : 1;
      for (let px = 0; px < size; px += 1) {
        const pl = plankOf[px];
        const ph = phases[pl];
        const grain = 1 + 0.02 * Math.sin(ry * 0.3 + Math.sin(px * 0.02 + ph) * 2.2 + ph) + 0.01 * Math.sin(px * 0.13 + ph);
        const k = (seamAt[px] ? 0.78 : 1) * edge * tints[pl] * grain;
        const i = (y * size + px) * 4;
        data[i] = Math.min(255, Math.round(base[0] * k));
        data[i + 1] = Math.min(255, Math.round(base[1] * k));
        data[i + 2] = Math.min(255, Math.round(base[2] * k));
        data[i + 3] = 255;
      }
    }
  }
  const texture = rgbaTexture(data, size, size, true);
  texture.repeat.set(ROOM.width / 4, ROOM.depth / 4);
  return texture;
}

// 벽지: 크림색 바탕에 옅은 세로 줄무늬와 작은 점. 가로 한 장 = 1칸, 세로는 벽 높이 전체.
function wallpaperTexture(): THREE.DataTexture {
  const w = 128;
  const h = 256;
  const data = new Uint8Array(w * h * 4);
  const base = [0xf4, 0xe6, 0xcf];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const stripe = x % 64 < 32 ? 1 : 0.965;
      const edge = x % 32 === 0 ? 0.95 : 1;
      const dx = (x % 32) - 16;
      const dy = (y % 32) - 16;
      const dot = stripe === 1 && dx * dx + dy * dy < 7 ? 0.93 : 1;
      const k = stripe * edge * dot;
      const i = (y * w + x) * 4;
      data[i] = Math.round(base[0] * k);
      data[i + 1] = Math.round(base[1] * k);
      data[i + 2] = Math.round(base[2] * k);
      data[i + 3] = 255;
    }
  }
  return rgbaTexture(data, w, h, true);
}

// 가운데가 진하고 둘레로 갈수록 투명해지는 둥근 그림자
function blobTexture(): THREE.DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const r = Math.hypot(x - size / 2 + 0.5, y - size / 2 + 0.5) / (size / 2);
      const a = Math.max(0, 1 - r);
      data.set([255, 255, 255, Math.round(255 * a * a * (3 - 2 * a))], (y * size + x) * 4);
    }
  }
  const texture = rgbaTexture(data, size, size, false);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// 모서리가 둥근 네모 그림자. 가운데 60%는 고르게 진하고, 바깥 40%에서 옅어진다(네모난 가구 밑과 벽에 건 것 뒤에 쓴다).
function softRectTexture(): THREE.DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = Math.abs((x + 0.5) / size - 0.5) * 2;
      const v = Math.abs((y + 0.5) / size - 0.5) * 2;
      const r = Math.hypot(Math.max(0, u - 0.6), Math.max(0, v - 0.6)) / 0.4;
      const a = Math.max(0, 1 - r);
      data.set([255, 255, 255, Math.round(255 * a * a * (3 - 2 * a))], (y * size + x) * 4);
    }
  }
  const texture = rgbaTexture(data, size, size, false);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}


/**
 * 구석 어둠을 꼭짓점 색으로 굽는다(조명은 그대로라 라룹이 명암이 바뀌지 않는다).
 * 바닥·뒷벽·양옆 벽에 가까울수록 어둡고, 벽은 위로 갈수록 조금 밝다. 자기가 붙은 면(거리 0 이하)은 빼고 계산한다.
 */
function bakeCornerShade(geometry: THREE.BufferGeometry) {
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const near = (d: number) => (d > 0.01 ? 1 - 0.34 * Math.exp(-d / 0.5) : 1);
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    let k = near(y) * near(z) * near(x) * near(ROOM.width - x);
    if (y > 0.01) k *= 0.9 + 0.1 * Math.min(1, y / ROOM.wallHeight);
    colors.set([k, k, k], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

/** 벽에 건 가구 뒤 그림자를 걸린 벽 안쪽 면 바로 앞에 둔다(뒷벽 z = 0, 왼벽 x = 0, 오른벽 x = 방 폭). 앞면이 방 안쪽을 본다. */
function placeWallShadow(m: THREE.Object3D, place: { x: number; y: number; z: number; rotY: number }) {
  const inward = { x: Math.sin(place.rotY), z: Math.cos(place.rotY) };
  const along = { x: Math.cos(place.rotY), z: -Math.sin(place.rotY) };
  const onWall =
    Math.abs(inward.z) > 0.5 ? { x: place.x, z: 0 } : inward.x > 0 ? { x: 0, z: place.z } : { x: ROOM.width, z: place.z };
  m.rotation.set(0, place.rotY, 0);
  m.position.set(onWall.x + inward.x * 0.01 + along.x * 0.07, place.y - 0.1, onWall.z + inward.z * 0.01 + along.z * 0.07);
}

// ---------- 방과 라이트루프 ----------

interface World {
  root: THREE.Group;
  kit: WorldKit;
  /** 라이트루프 발밑 그림자. 모델은 따로 불러와 붙인다(lobby3d-character). */
  shadow: THREE.Mesh;
  markObjects: { id: MarkId; object: THREE.Object3D }[];
  labelPoints: Record<MarkId, THREE.Vector3>;
  floor: THREE.Mesh;
  /** 코드로 지은 방 껍데기(바닥, 벽, 걸레받이, 바닥판, 입구 발판). 구운 방(lobby3d-room)이 뜨면 숨긴다. */
  shell: THREE.Group;
  /** 장소가 아닌 가구. 누르면 움직이지 않는다. */
  blockers: THREE.Object3D[];
  /** 편집 모드에서 누르기 판정을 받는 가구(입구 발판 빼고 모두). */
  pieceObjects: THREE.Object3D[];
  /** 코드로 만든 대체 가구. Kenney 가구 묶음(lobby3d-furniture)이 뜨면 숨기지만, 보이지 않는 채로 누르기 판정을 맡는다. */
  furniture: THREE.Group;
  /** 방 조명. 하루의 때에 따라 색·세기가 바뀐다(lobby3d-daylight). */
  ambient: THREE.AmbientLight;
  sun: THREE.DirectionalLight;
}

/** 보관함 가구의 3D 물체를 숨기거나 보인다. 숨긴 물체는 누르기 판정도 받지 않는다(userData.stowed). */
function setStowed(object: THREE.Object3D, stowed: boolean) {
  object.visible = !stowed;
  object.traverse((o) => {
    o.userData.stowed = stowed;
  });
}

function buildWorld(layout: LobbyLayout): World {
  // 가구 자리는 받은 배치에서 계산한다. 보관함 가구도 만들어 숨겨 둔다(꾸미기에서 꺼내면 보인다)
  const placements = buildPlacements(layout);
  const kit = new WorldKit();
  const root = new THREE.Group();
  const W = ROOM.width;
  const H = ROOM.wallHeight;

  // 앞이 트인 상자 같은 방(디오라마): 바닥, 뒷벽, 양옆 벽(두께와 윗면), 걸레받이, 앞 가운데 입구 발판. 그 밖은 검정.
  // 바닥과 벽은 꼭짓점 색으로 구석 어둠을 굽기 위해 잘게 나누고, 모양을 월드 좌표로 옮겨 둔다.
  const D = ROOM.depth;
  const T = ROOM.wallThickness;
  const floorGeometry = new THREE.PlaneGeometry(W, D, 32, 44);
  floorGeometry.rotateX(-Math.PI / 2);
  floorGeometry.translate(W / 2, 0, D / 2);
  bakeCornerShade(floorGeometry);
  const shell = new THREE.Group();
  root.add(shell);
  const floor = new THREE.Mesh(floorGeometry, new THREE.MeshLambertMaterial({ map: floorTexture(), vertexColors: true }));
  shell.add(floor);
  // 바닥판의 두께(앞쪽 잘린 면이 보인다). 윗면을 바닥보다 조금 낮춰, 멀리서 둘이 겹쳐 번갈아 그려지지 않게 한다.
  kit.part(new THREE.BoxGeometry(W + T * 2, 0.22, D + T), 0x8a5230, 0, shell).position.set(W / 2, -0.13, (D - T) / 2);
  // 벽: 안쪽 면만 벽지, 윗면·잘린 면은 벽 단면 색
  const paper = wallpaperTexture();
  const cut = new THREE.MeshLambertMaterial({ color: 0xc4a47c, vertexColors: true });
  const wall = (w: number, h: number, d: number, center: THREE.Vector3, inner: number, length: number) => {
    const geometry = new THREE.BoxGeometry(w, h, d, Math.max(1, Math.round(w * 4)), 16, Math.max(1, Math.round(d * 4)));
    geometry.translate(center.x, center.y, center.z);
    bakeCornerShade(geometry);
    const map = paper.clone();
    map.repeat.set(length, 1);
    map.needsUpdate = true;
    const papered = new THREE.MeshLambertMaterial({ map, vertexColors: true });
    // BoxGeometry 면 순서: +x, -x, +y, -y, +z, -z
    const materials = [0, 1, 2, 3, 4, 5].map((face) => (face === inner ? papered : cut));
    shell.add(new THREE.Mesh(geometry, materials));
  };
  wall(W + T * 2, H, T, new THREE.Vector3(W / 2, H / 2, -T / 2), 4, W + T * 2);
  wall(T, H, D + T, new THREE.Vector3(-T / 2, H / 2, (D - T) / 2), 0, D + T);
  wall(T, H, D + T, new THREE.Vector3(W + T / 2, H / 2, (D - T) / 2), 1, D + T);
  // 걸레받이
  kit.part(new RoundedBoxGeometry(W, 0.2, 0.06, 2, 0.02), 0xb57a45, 0, shell).position.set(W / 2, 0.1, 0.03);
  for (const bx of [0.03, W - 0.03]) kit.part(new RoundedBoxGeometry(0.06, 0.2, D, 2, 0.02), 0xb57a45, 0, shell).position.set(bx, 0.1, D / 2);
  // 앞 가운데 입구 발판(바닥보다 조금 낮다)
  const step = outsideExit(currentRoom());
  kit.part(new RoundedBoxGeometry(step.width, 0.16, step.depth, 2, 0.04), 0x8a5a3b, 0, shell).position.set(step.x, -0.14, D + step.depth / 2);

  // 가구 밑과 벽에 건 것 뒤의 옅은 그림자, 라룹이 발밑 그림자
  const blob = blobTexture();
  const softRect = softRectTexture();
  // 가구마다 까는 옅은 그림자(실시간 아님, 카탈로그 값). floor는 바닥에 닿은 넓이(가구 앞면 기준 가로·깊이), wall은 벽에 건 것 뒤 벽에 비치는 넓이(가로·세로)다.
  for (const place of placements) {
    const shade = place.shadow;
    if (!shade) continue;
    if (shade.floor) {
      const [w, d, opacity] = shade.floor;
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, d),
        new THREE.MeshBasicMaterial({ map: softRect, color: 0x3a2214, transparent: true, opacity, depthWrite: false })
      );
      m.rotation.set(-Math.PI / 2, place.rotY, 0, "YXZ");
      m.position.set(place.x, 0.006, place.z);
      m.raycast = () => {};
      // 편집 모드에서 가구를 따라 옮긴다(poseFurniture)
      m.userData.shadowOf = placementKey(place);
      if (place.stowed) setStowed(m, true);
      root.add(m);
    }
    if (shade.wall) {
      // 벽에 건 것은 걸린 벽 안쪽 면 바로 앞에 둔다(뒷벽 z = 0, 왼벽 x = 0, 오른벽 x = 방 폭). 앞면이 방 안쪽을 본다
      const [w, h, opacity] = shade.wall;
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ map: softRect, color: 0x3a2214, transparent: true, opacity, depthWrite: false })
      );
      placeWallShadow(m, place);
      m.raycast = () => {};
      m.userData.shadowOf = placementKey(place);
      m.userData.shadowWall = true;
      if (place.stowed) setStowed(m, true);
      root.add(m);
    }
  }

  // 가구. Kenney 가구 묶음(lobby3d-furniture)이 뜨기 전이나 불러오지 못했을 때 보이는 간단한 모양이고,
  // 묶음이 뜬 뒤에도 보이지 않는 채로 남아 장소·가구를 누르는 판정을 맡는다(three의 누르기 판정은 보이는지와 상관없다).
  // 자리는 받은 배치를 따르고, 크기는 칸에 맞춘 모델 크기다.
  const furniture = new THREE.Group();
  root.add(furniture);
  const markObjects: World["markObjects"] = [];
  const blockers: THREE.Object3D[] = [];
  const pieceObjects: THREE.Object3D[] = [];
  const makePiece = (place: FurniturePlacement): THREE.Group => {
    const g = new THREE.Group();
    if (place.piece === "exit") {
      // 입구 발판(지금 방의 출입구 폭·깊이, 윗면은 바닥보다 조금 낮다)만 덮는 보이지 않는 상자. 방 앞쪽 바닥은 덮지 않는다.
      // 보이지 않아도 누르기 판정은 받는다.
      const step = outsideExit(currentRoom());
      const hit = new THREE.Mesh(new THREE.BoxGeometry(step.width, 0.3, step.depth), new THREE.MeshBasicMaterial());
      hit.position.y = -0.1;
      hit.visible = false;
      g.add(hit);
      return g;
    }
    // 가구마다 따로 짓지 않고 모델 실제 크기만 한 상자로 만든다(벽 가구는 기준점이 가운데, 바닥 가구는 바닥 가운데)
    const box = place.box ?? { width: 1, height: 1, depth: 1 };
    const radius = Math.min(0.04, box.width / 4, box.height / 4, box.depth / 4);
    const part = kit.part(new RoundedBoxGeometry(box.width, Math.max(0.02, box.height), box.depth, 2, radius), 0xe39a64, 0.03, g);
    part.position.y = place.mount === "wall" ? 0 : box.height / 2;
    // 작은 소품(탁상형)은 모델보다 넓은 보이지 않는 상자로도 누른다(누르기 판정은 보이는지와 상관없다)
    if (place.pickBox) {
      const pick = new THREE.Mesh(new THREE.BoxGeometry(place.pickBox.width, place.pickBox.height, place.pickBox.depth), new THREE.MeshBasicMaterial());
      pick.position.y = place.pickBox.height / 2;
      pick.visible = false;
      // 넓힌 판정은 꾸미기에서만 쓴다(꾸미기 밖에서는 모델 크기로만 누른다)
      pick.userData.widePick = true;
      g.add(pick);
    }
    return g;
  };
  for (const place of placements) {
    const g = makePiece(place);
    g.position.set(place.x, place.y, place.z);
    g.rotation.y = place.rotY;
    if (place.companion) g.userData.chairBase = { x: place.x, z: place.z };
    furniture.add(g);
    if (place.piece !== "exit") {
      g.userData.furnitureOf = placementKey(place);
      g.userData.view = Boolean(place.view);
      // 누르면 그 가구(딸린 의자는 책상)를 고른다
      const id = place.item;
      g.traverse((o) => {
        o.userData.pickPiece = id;
      });
      pieceObjects.push(g);
    }
    if (place.mark) {
      const id = place.mark;
      g.traverse((o) => {
        o.userData.mark = id;
      });
      markObjects.push({ id, object: g });
    }
    if (place.blocker) {
      g.traverse((o) => {
        o.userData.blocker = true;
      });
      blockers.push(g);
    }
    if (place.stowed) setStowed(g, true);
  }

  // 이름표 자리는 가구를 따라간다(받은 배치에서 계산). 밖으로 가는 입구 발판은 고정이다
  const places = layoutGeometry(layout, ROOM.width).places;
  const at = (p: { x: number; y: number; z: number }) => new THREE.Vector3(p.x, p.y, p.z);
  const labelPoints: Record<MarkId, THREE.Vector3> = {
    board: at(places.board.label),
    window: at(places.window.label),
    door: new THREE.Vector3(outsideExit(currentRoom()).x, 0.4, D + ROOM.stepDepth / 2),
    desk: at(places.desk.label),
    bookcase: at(places.bookcase.label)
  };

  // 방 조명. 해는 앞쪽 왼편 위에서 가구 앞면을 비춘다(실제 해 방향은 바닥의 창문 빛이 맡는다). 색·세기는 하루의 때를 따른다.
  const ambient = new THREE.AmbientLight(0xffffff, 1.35);
  root.add(ambient);
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-3, 8, 6);
  root.add(sun);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15 * 0.8, 1.15 * 0.8),
    new THREE.MeshBasicMaterial({ map: blob, color: 0x2b1810, transparent: true, opacity: 0.38, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  root.add(shadow);

  return { root, kit, shadow, markObjects, blockers, pieceObjects, labelPoints, floor, shell, furniture, ambient, sun };
}


/** 고른 가구를 띄우는 높이와 벽 가구를 벽에서 내미는 거리(칸), 출렁이는 폭(칸)과 한 번 오르내리는 시간(초). */
const LIFT_HEIGHT = 0.6;
const LIFT_OUT = 0.35;
const BOB_AMPLITUDE = 0.06;
const BOB_SECONDS = 1.5;

/** 띄운 가구 하나: 띄우기 전 자리와 벽 가구인지. 매 프레임 이 자리에서 띄우고 출렁인다. */
interface LiftedObject {
  object: THREE.Object3D;
  base: { x: number; y: number; z: number; rotY: number };
  wall: boolean;
}

/**
 * 가구(대체 모양과 가구 묶음)와 바닥 그림자를 placements 자리로 옮긴다. 편집 모드에서 방을 다시 만들지 않고 가구만 옮길 때 쓴다.
 * 의자는 '들어가기' 때 빼는 기준 자리도 옮긴다(매 프레임 그 자리에서 뺀다).
 * lifted 가구(의자는 책상을 따라)는 제자리에 두고 목록으로 돌려준다. 띄우기와 출렁임은 매 프레임 liftObjects가 한다.
 */
function poseFurniture(scene: THREE.Object3D, placements: FurniturePlacement[], lifted: string | null = null): LiftedObject[] {
  const raised: LiftedObject[] = [];
  const byKey = new Map(placements.map((p) => [placementKey(p), p]));
  scene.traverse((o) => {
    const of = o.userData.furnitureOf as string | undefined;
    const shadowOf = o.userData.shadowOf as string | undefined;
    if (of === undefined && shadowOf === undefined) return;
    const place = byKey.get((of ?? shadowOf) as string);
    // 배치에 없는 가구(보관함)는 숨기고, 다시 놓이면 보인다
    if (!place) {
      if (!o.userData.stowed) setStowed(o, true);
      return;
    }
    if (o.userData.stowed) setStowed(o, false);
    if (of) {
      o.position.set(place.x, place.y, place.z);
      o.rotation.y = place.rotY;
      // 받침 가구를 띄우면 위의 소품도 함께 뜬다
      if (lifted !== null && (place.item === lifted || place.parent === lifted)) {
        raised.push({ object: o, base: { x: place.x, y: place.y, z: place.z, rotY: place.rotY }, wall: place.mount === "wall" });
      }
      if (place.companion) o.userData.chairBase = { x: place.x, z: place.z };
    } else if (o.userData.shadowWall) {
      placeWallShadow(o, place);
    } else {
      o.position.set(place.x, 0.006, place.z);
      o.rotation.set(-Math.PI / 2, place.rotY, 0, "YXZ");
    }
  });
  return raised;
}

/** 띄운 가구를 띄우고 출렁이게 한다. 바닥 가구는 위로, 벽 가구는 방 안쪽(앞면이 보는 쪽)으로 내민다. 의자의 x·z는 매 프레임 의자 빼기가 정한다. */
function liftObjects(list: LiftedObject[], seconds: number, windowLift: { x: number; y: number; z: number }) {
  const bob = Math.sin((seconds / BOB_SECONDS) * Math.PI * 2) * BOB_AMPLITUDE;
  windowLift.x = 0;
  windowLift.y = 0;
  windowLift.z = 0;
  for (const { object, base, wall } of list) {
    const out = wall ? LIFT_OUT : 0;
    const offset = { x: Math.sin(base.rotY) * out, y: (wall ? 0 : LIFT_HEIGHT) + bob, z: Math.cos(base.rotY) * out };
    object.position.set(base.x + offset.x, base.y + offset.y, base.z + offset.z);
    // 창문이 뜨면 창밖 장면도 같은 만큼 옮긴다(lobby3d-furniture)
    if (object.userData.view) Object.assign(windowLift, offset);
  }
}

/** 모서리가 둥근 사각형(가운데가 원점, 가로 w·세로 h, 모서리 반지름 r). 칠한 칸에 쓴다. */
function roundedRectGeometry(w: number, h: number, r: number): THREE.ShapeGeometry {
  const rr = Math.min(r, w / 2, h / 2);
  const x = -w / 2;
  const y = -h / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + rr, y);
  shape.lineTo(x + w - rr, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + rr);
  shape.lineTo(x + w, y + h - rr);
  shape.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  shape.lineTo(x + rr, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - rr);
  shape.lineTo(x, y + rr);
  shape.quadraticCurveTo(x, y, x + rr, y);
  return new THREE.ShapeGeometry(shape, 6);
}

/**
 * 바닥의 장소 구역 모양: from을 중심으로 한 반지름 r 원이 to까지 이어진 길쭉한 모양(to가 없거나 같으면 원).
 * 바닥(y = 0)에 눕힐 모양이라 바닥 좌표 (x, z)를 모양 좌표 (x, −z)로 둔다(눕히면 −z가 다시 z가 된다).
 */
function zoneGeometry(from: FloorPoint, to: FloorPoint | null, r: number): THREE.ShapeGeometry {
  const end = to ?? from;
  const dx = end.x - from.x;
  const dz = end.z - from.z;
  const angle = Math.atan2(dz, dx);
  const shape = new THREE.Shape();
  const at = (p: FloorPoint, a: number) => ({ x: p.x + Math.cos(a) * r, y: -(p.z + Math.sin(a) * r) });
  const steps = 16;
  // 끝(to) 쪽 반원, 시작(from) 쪽 반원 순서로 둘레를 잇는다
  for (let i = 0; i <= steps; i += 1) {
    const p = at(end, angle - Math.PI / 2 + (Math.PI * i) / steps);
    if (i === 0) shape.moveTo(p.x, p.y);
    else shape.lineTo(p.x, p.y);
  }
  for (let i = 0; i <= steps; i += 1) {
    const p = at(from, angle + Math.PI / 2 + (Math.PI * i) / steps);
    shape.lineTo(p.x, p.y);
  }
  return new THREE.ShapeGeometry(shape);
}

/**
 * 편집 모드 격자. 바닥은 칸 경계를 흰 실선으로 긋고,
 * 뒷벽·양옆 벽은 벽 가구를 맞추는 반 칸 간격으로 옅게 긋는다.
 */
function buildEditGrid(): THREE.Group {
  const W = ROOM.width;
  const D = ROOM.depth;
  const H = ROOM.wallHeight;
  const group = new THREE.Group();
  const lines = (points: number[], material: THREE.LineBasicMaterial) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    const segments = new THREE.LineSegments(geometry, material);
    segments.raycast = () => {};
    segments.renderOrder = 1;
    group.add(segments);
  };
  const y = 0.012;
  const floor: number[] = [];
  for (let x = 0; x <= W; x += 1) floor.push(x, y, 0, x, y, D);
  for (let z = 0; z <= D; z += 1) floor.push(0, y, z, W, y, z);
  lines(floor, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }));
  const wall: number[] = [];
  const off = 0.008;
  for (let x = 0; x <= W; x += 0.5) wall.push(x, 0, off, x, H, off);
  for (let z = 0; z <= D; z += 0.5) wall.push(off, 0, z, off, H, z, W - off, 0, z, W - off, H, z);
  for (let h = 0.5; h <= H; h += 0.5) wall.push(0, h, off, W, h, off, off, h, 0, off, h, D, W - off, h, 0, W - off, h, D);
  lines(wall, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false }));
  group.visible = false;
  return group;
}

/** 바닥 칸 칠의 높이(칸). 깔개 윗면(약 0.03칸)보다 높아야 깔개에 가려지지 않는다. */
const MARK_LIFT = 0.045;

/** 칠한 칸 모서리 반지름과 장소 구역·서는 자리 색(칸). */
const MARK_CORNER = 0.16;
const ZONE_COLOR = 0xffd23f;


/** 화면을 누른 곳의 벽: 누른 광선이 방 안쪽 벽 면(뒷벽·양옆 벽, 바닥~벽 높이)에 닿는 가장 가까운 곳. 없으면 null. */
function wallUnderRay(ray: THREE.Ray): { wall: WallSide; along: number } | null {
  const planes: { wall: WallSide; plane: THREE.Plane }[] = [
    { wall: "back", plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0) },
    { wall: "left", plane: new THREE.Plane(new THREE.Vector3(1, 0, 0), 0) },
    { wall: "right", plane: new THREE.Plane(new THREE.Vector3(-1, 0, 0), ROOM.width) }
  ];
  let best: { wall: WallSide; along: number; distance: number } | null = null;
  const at = new THREE.Vector3();
  for (const { wall, plane } of planes) {
    if (!ray.intersectPlane(plane, at)) continue;
    if (at.y < 0 || at.y > ROOM.wallHeight) continue;
    const along = wall === "back" ? at.x : at.z;
    if (along < 0 || along > (wall === "back" ? ROOM.width : ROOM.depth)) continue;
    const distance = at.distanceTo(ray.origin);
    if (!best || distance < best.distance) best = { wall, along, distance };
  }
  return best ? { wall: best.wall, along: best.along } : null;
}

// ---------- 장면 ----------

function Scene({
  sim,
  viewWidth,
  toon,
  onFrame,
  onProject,
  onOverlayFrame,
  daylight,
  layoutKey = 0,
  edit = null,
  editLive,
  pickRef
}: Lobby3dCanvasProps & { pickRef: MutableRefObject<((x: number, y: number) => PointerHit | null) | null> }) {
  // 3D 가구는 지금 배치(보관함 가구는 숨겨서)로 만들고, 배치가 바뀌면(layoutKey) 다시 만든다.
  // 꾸미기 중에는 다시 만들지 않는다. 끌기·돌리기는 자리만, 치우기·꺼내기는 보이기만 바꾼다(poseFurniture).
  // 미리 만들지 않은 가구가 방에 나오면(드물다) 편집 중 배치로 다시 만들고, 그 뒤 꾸미기에서 나오면 지금 배치로 다시 만든다.
  const live = activeLobbyLayout();
  const built = useRef<{ layout: LobbyLayout; layoutKey: number; ids: Set<string> } | null>(null);
  const missing = edit && built.current ? edit.layout.items.some((item) => !built.current!.ids.has(item.id)) : false;
  if (!built.current || built.current.layoutKey !== layoutKey || missing || (!edit && built.current.layout !== live)) {
    const from = edit?.layout ?? live;
    built.current = { layout: from, layoutKey, ids: new Set([...from.items, ...storedItems(from)].map((item) => item.id)) };
  }
  const furnitureLayout = built.current.layout;
  const world = useMemo(() => buildWorld(furnitureLayout), [furnitureLayout]);
  // 시각에 따른 빛: 지금 보이는 색감(부드럽게 넘어가는 중인 값)과 구운 방에 곱하는 색
  const daylightState = useMemo(() => createDaylightState(daylight), []); // eslint-disable-line react-hooks/exhaustive-deps
  const roomTint = useMemo(() => new THREE.Color(0xffffff), []);
  const { camera, size, scene } = useThree();
  const target = useRef(new THREE.Vector3(sim.x, 0, sim.z));
  const character = useRef<CharacterHandle | null>(null);
  const fps = useRef({ frames: 0, since: 0, value: 0, lastSent: 0 });
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const editRef = useRef(edit);
  editRef.current = edit;
  const editLiveRef = useRef(editLive);
  editLiveRef.current = editLive;
  /** 지금 편집 모습(매 프레임 직접 읽는 곳이 있으면 그것). */
  const currentEdit = () => (editLiveRef.current ? editLiveRef.current.current : editRef.current);

  useEffect(() => {
    scene.background = new THREE.Color(0x000000);
  }, [scene]);

  useEffect(() => {
    world.kit.applyToon(toon);
  }, [world, toon]);

  useEffect(
    () => () => {
      world.root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const materials = Array.isArray(o.material) ? o.material : [o.material];
          materials.forEach((m) => {
            (m as THREE.MeshBasicMaterial).map?.dispose();
            m.dispose();
          });
        }
      });
      world.kit.gradient.dispose();
    },
    [world]
  );

  useEffect(() => {
    pickRef.current = (x: number, y: number) => {
      if (size.width <= 0 || size.height <= 0) return null;
      const ndc = new THREE.Vector2((x / size.width) * 2 - 1, -(y / size.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const floorPoint = () => {
        const floorHit = new THREE.Vector3();
        return raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), floorHit) ? { x: floorHit.x, z: floorHit.z } : null;
      };
      // 편집 모드: 가구만 누르기 판정을 받는다(라이트루프는 숨어 있다). 가장 앞에 맞은 가구를 고르되,
      // 탁상형 소품의 판정 앞에 맞은 것이 그 소품이 지금 올라간 받침 가구(딸린 의자 포함)뿐이면 소품을 먼저 고른다.
      // 받침 가구는 편집 중 배치에서 읽는다(꾸미기 중 다른 받침 가구로 옮기거나 꺼내도 3D는 다시 만들지 않는다).
      const editing = currentEdit();
      if (editing) {
        const hits = raycaster.intersectObjects(world.pieceObjects, true).filter((h) => !h.object.userData.stowed);
        const parentOf = (piece: unknown) => (typeof piece === "string" ? layoutItem(editing.layout, piece)?.on?.parent : undefined);
        const at = hits.findIndex((h) => parentOf(h.object.userData.pickPiece));
        const onParent = at > 0 && hits.slice(0, at).every((h) => h.object.userData.pickPiece === parentOf(hits[at].object.userData.pickPiece));
        const first = (onParent ? hits[at] : hits[0])?.object.userData as { pickPiece?: string } | undefined;
        return { point: floorPoint(), mark: null, onCharacter: false, piece: first?.pickPiece ?? null, wall: wallUnderRay(raycaster.ray) };
      }
      // 모델을 다 불러오기 전에는 캐릭터를 누를 수 없다(그 자리는 바닥으로 본다).
      const objects: THREE.Object3D[] = [...(character.current ? [character.current.group] : []), ...world.markObjects.map((m) => m.object), ...world.blockers];
      const hits = raycaster.intersectObjects(objects, true).filter((h) => !h.object.userData.stowed && !h.object.userData.widePick);
      let mark: MarkId | null = null;
      let onCharacter = false;
      const first = hits[0]?.object.userData as { mark?: MarkId; isCharacter?: boolean; blocker?: boolean } | undefined;
      if (first?.isCharacter) onCharacter = true;
      else if (first?.mark) mark = first.mark;
      // 장소가 아닌 가구(화분)를 누르면 그 뒤 바닥으로 걸어가지 않게 바닥 점을 주지 않는다.
      if (first?.blocker) return { point: null, mark: null, onCharacter: false };
      return { point: floorPoint(), mark, onCharacter };
    };
    return () => {
      pickRef.current = null;
    };
  }, [camera, size, raycaster, world, pickRef]);

  // 일기 책상 의자(대체 모양과 가구 묶음). 가구 묶음은 나중에 불러와지므로 가끔 다시 찾는다.
  const chairs = useRef<{ list: THREE.Object3D[]; scannedAt: number }>({ list: [], scannedAt: -Infinity });
  useEffect(() => {
    chairs.current = { list: [], scannedAt: -Infinity };
  }, [world]);

  // 편집 모드: 가구를 편집 중인 배치대로 옮긴다. 가구 묶음은 나중에 불러와지므로 편집하는 동안 가끔 다시 옮긴다.
  // 편집을 마치면 지금 배치로 되돌린다(배치가 바뀌었으면 방을 다시 만들어 어차피 지금 배치다).
  const posed = useRef<{ layout: LobbyLayout | null; lifted: string | null; at: number; raised: LiftedObject[] }>({
    layout: null,
    lifted: null,
    at: 0,
    raised: []
  });
  useEffect(() => {
    posed.current = { layout: null, lifted: null, at: 0, raised: [] };
  }, [world]);
  // 바닥에 칠한 칸과 벽에 칠한 자리. 칠할 것이 바뀌면 매 프레임(다시 그리기를 기다리지 않고) 다시 만든다
  const markGroup = useMemo(() => new THREE.Group(), []);
  // 편집 모드에서만 보이는 격자(바닥 칸, 벽 반 칸)
  const editGrid = useMemo(buildEditGrid, []);
  useEffect(
    () => () => {
      editGrid.traverse((o) => {
        if (o instanceof THREE.LineSegments) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
    },
    [editGrid]
  );
  const shownMarks = useRef<{ marks: EditMark[] | undefined; wallMarks: EditWallMark[] | undefined; zone: EditZone | null | undefined }>({
    marks: undefined,
    wallMarks: undefined,
    zone: undefined
  });
  const drawMarks = (editMarks: EditMark[] | undefined, editWallMarks: EditWallMark[] | undefined, zone: EditZone | null | undefined) => {
    for (const child of [...markGroup.children]) {
      const m = child as THREE.Mesh;
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
      markGroup.remove(m);
    }
    for (const mark of editMarks ?? []) {
      const w = mark.maxX - mark.minX;
      const d = mark.maxZ - mark.minZ;
      const m = new THREE.Mesh(
        roundedRectGeometry(Math.max(0.1, w - 0.06), Math.max(0.1, d - 0.06), MARK_CORNER),
        new THREE.MeshBasicMaterial({ color: mark.ok ? 0x8fe3b0 : 0xff4a3d, transparent: true, opacity: 0.55, depthWrite: false })
      );
      m.rotation.x = -Math.PI / 2;
      // 깔개 윗면(약 0.03칸)보다 위에 깐다(깔개 위의 가구 칸이 깔개에 가려지지 않게)
      // 탁상형 소품의 자리는 받침 가구 윗면에 칠한다
      m.position.set((mark.minX + mark.maxX) / 2, (mark.y ?? 0) + MARK_LIFT, (mark.minZ + mark.maxZ) / 2);
      m.raycast = () => {};
      m.renderOrder = 2;
      markGroup.add(m);
    }
    for (const mark of editWallMarks ?? []) {
      // 벽 가구가 걸린 높이 범위에서 위아래로 조금 넉넉하게 칠한다
      const y = (mark.bottom + mark.top) / 2;
      const height = mark.top - mark.bottom + 0.2;
      const m = new THREE.Mesh(
        roundedRectGeometry(Math.max(0.1, mark.to - mark.from), height, MARK_CORNER),
        new THREE.MeshBasicMaterial({ color: mark.ok ? 0x8fe3b0 : 0xff4a3d, transparent: true, opacity: 0.45, depthWrite: false })
      );
      const mid = (mark.from + mark.to) / 2;
      // 벽 안쪽 면 바로 앞, 방 안쪽을 보게 둔다
      if (mark.wall === "back") m.position.set(mid, y, 0.012);
      else if (mark.wall === "left") {
        m.position.set(0.012, y, mid);
        m.rotation.y = Math.PI / 2;
      } else {
        m.position.set(ROOM.width - 0.012, y, mid);
        m.rotation.y = -Math.PI / 2;
      }
      m.raycast = () => {};
      m.renderOrder = 2;
      markGroup.add(m);
    }
    if (zone) {
      // 서는 자리(노랑 점). 장소 구역은 칠하지 않는다(사용자 결정)
      for (const spot of zone.approach) {
        const dot = new THREE.Mesh(
          zoneGeometry(spot, null, 0.14),
          new THREE.MeshBasicMaterial({ color: ZONE_COLOR, transparent: true, opacity: 0.9, depthWrite: false })
        );
        dot.rotation.x = -Math.PI / 2;
        dot.position.y = MARK_LIFT + 0.006;
        dot.raycast = () => {};
        dot.renderOrder = 3;
        markGroup.add(dot);
      }
    }
  };

  // 창밖 장면·창문 빛이 따를 배치: 편집 중이면 놓인 배치(끄는 동안은 끌기 전 배치), 아니면 지금 배치
  const lightLayout = useRef<LobbyLayout>(activeLobbyLayout());
  // 고른 창문이 떠 있는 만큼(창밖 장면도 함께 옮긴다)
  const windowLift = useRef({ x: 0, y: 0, z: 0 });

  useFrame((_, delta) => {
    const nowMs = Date.now();
    const dt = Math.min(0.05, delta);
    onFrame(dt, nowMs);
    const editing = currentEdit();
    if (editing?.marks !== shownMarks.current.marks || editing?.wallMarks !== shownMarks.current.wallMarks || editing?.zone !== shownMarks.current.zone) {
      drawMarks(editing?.marks, editing?.wallMarks, editing?.zone);
      shownMarks.current = { marks: editing?.marks, wallMarks: editing?.wallMarks, zone: editing?.zone };
    }
    const want = editing?.layout ?? null;
    const lifted = editing?.lifted ?? null;
    if (want !== posed.current.layout || lifted !== posed.current.lifted || (want && nowMs - posed.current.at > 500)) {
      const raised = poseFurniture(scene, furniturePlacements(want ?? activeLobbyLayout()), lifted);
      posed.current = { layout: want, lifted, at: nowMs, raised };
    }
    liftObjects(posed.current.raised, nowMs / 1000, windowLift.current);
    if (!editing) lightLayout.current = activeLobbyLayout();
    else if (!editing.dragging) lightLayout.current = editing.layout;
    if (character.current) character.current.group.visible = !editing;
    editGrid.visible = Boolean(editing);
    world.shadow.visible = !editing;
    const lift = character.current?.update(sim, dt, nowMs / 1000) ?? 0;
    // '들어가기' 때 의자를 책상 밑에서 뒤로 뺀다
    if (chairs.current.list.length < 2 && nowMs - chairs.current.scannedAt > 1000) {
      const list: THREE.Object3D[] = [];
      scene.traverse((o) => {
        if (o.userData.chairBase) list.push(o);
      });
      chairs.current = { list, scannedAt: nowMs };
    }
    // 책상 앞쪽으로 뺀다
    const pull = sim.chairPull() * CHAIR.pull;
    for (const chair of chairs.current.list) {
      const base = chair.userData.chairBase as { x: number; z: number };
      chair.position.x = base.x + CHAIR.pullDir.x * pull;
      chair.position.z = base.z + CHAIR.pullDir.z * pull;
    }
    // 도형 캐릭터 때와 같이, 몸이 들리면 그림자가 작아진다(들린 높이를 그때 단위 1.25로 나눠 같은 비율로).
    const shrink = 1 - (lift / 1.25) * 0.35;
    world.shadow.position.set(sim.x, 0.01, sim.z);
    world.shadow.scale.set(1.15 * shrink, 0.8 * shrink, 1);

    // 카메라: 따라갈 점(라룹이 자리)을 부드럽게 옮기고, 그 점으로 cameraPose가 정한 원근 카메라 자리를 그대로 쓴다.
    // 매 프레임 자리를 cameraPose가 정하므로 따라가는 도중에도 방 끝 너머는 보이지 않는다.
    const persp = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    const k = Math.min(1, dt * 4);
    const follow = editing ? editing.focus ?? target.current : sim;
    target.current.x += (follow.x - target.current.x) * k;
    target.current.z += (follow.z - target.current.z) * k;
    const pose = cameraPose(target.current, viewWidth, aspect);
    if (Math.abs(persp.fov - pose.fovDeg) > 0.01 || Math.abs(persp.aspect - aspect) > 0.001) {
      persp.fov = pose.fovDeg;
      persp.aspect = aspect;
      persp.updateProjectionMatrix();
    }
    camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    camera.lookAt(pose.lookAt.x, pose.lookAt.y, pose.lookAt.z);
    camera.updateMatrixWorld();

    const toScreen = (v: THREE.Vector3) => {
      const p = v.clone().project(camera);
      return { x: ((p.x + 1) / 2) * size.width, y: ((1 - p.y) / 2) * size.height };
    };
    const bubble = toScreen(character.current?.bubblePoint() ?? new THREE.Vector3(sim.x, BUBBLE_HEIGHT, sim.z));
    const labels = {} as Record<MarkId, { x: number; y: number }>;
    (Object.keys(MARKS) as MarkId[]).forEach((id) => {
      labels[id] = toScreen(world.labelPoints[id]);
    });
    onOverlayFrame?.(bubble, labels);

    // 초당 프레임 수, 말풍선·이름표 위치(초당 약 15번 보낸다)
    const f = fps.current;
    f.frames += 1;
    if (nowMs - f.since >= 1000) {
      f.value = Math.round((f.frames * 1000) / Math.max(1, nowMs - f.since));
      f.frames = 0;
      f.since = nowMs;
    }
    if (nowMs - f.lastSent >= 66) {
      f.lastSent = nowMs;
      onProject({ bubble, labels, fps: f.value });
    }
  });

  return (
    <>
      {/* react-three-fiber의 three 객체 속성(object)이라 RN 린트 규칙이 모르는 속성으로 본다. */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <primitive object={world.root} />
      {/* eslint-disable-next-line react/no-unknown-property */}
      <primitive object={markGroup} />
      {/* eslint-disable-next-line react/no-unknown-property */}
      <primitive object={editGrid} />
      <DaylightRig
        key={`daylight-${layoutKey}`}
        state={daylightState}
        daylight={daylight}
        ambient={world.ambient}
        sun={world.sun}
        roomTint={roomTint}
        lightLayout={lightLayout}
      />
      <BakedFurnitureErrorBoundary>
        <Suspense fallback={null}>
          <BakedFurniture
            key={`furniture-${layoutKey}`}
            layout={furnitureLayout}
            fallback={world.furniture}
            daylight={daylightState}
            lightLayout={lightLayout}
            windowLift={windowLift}
          />
        </Suspense>
      </BakedFurnitureErrorBoundary>
      {/* 구운 방 껍데기는 기본 방 전용이다(다른 방은 코드로 지은 방이 보인다. 다른 방의 껍데기는 확장 기능 때 정한다) */}
      {currentRoom().id === BASIC_ROOM.id ? (
        <BakedRoomErrorBoundary>
          <Suspense fallback={null}>
            <BakedRoom fallback={world.shell} tint={roomTint} />
          </Suspense>
        </BakedRoomErrorBoundary>
      ) : null}
      <CharacterErrorBoundary>
        <Suspense fallback={null}>
          <Character kit={world.kit} outline={toon.outline} handleRef={character} />
        </Suspense>
      </CharacterErrorBoundary>
    </>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1
  }
});
