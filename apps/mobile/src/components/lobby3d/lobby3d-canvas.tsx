// three보다 먼저 불러와야 한다(Hermes에 없는 FinalizationRegistry 대체).
import "@/lib/lobby3d/hermes-polyfills";
import { Canvas, useFrame, useThree } from "@react-three/fiber/native";
import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { StyleSheet, View, type GestureResponderEvent } from "react-native";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { LobbySim, MARKS, ROOM, cameraPose, type MarkId, type PointerHit } from "@/lib/lobby3d/engine";
import type { Daylight } from "@/lib/lobby3d/daylight";
import { FURNITURE_LAYOUT, type FurniturePiece } from "@/lib/lobby3d/furniture-layout";
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

export interface Lobby3dCanvasProps {
  sim: LobbySim;
  /** 화면 가로에 보이는 바닥 폭(칸). */
  viewWidth: number;
  toon: ToonSettings;
  /** 매 프레임. 화면이 여기서 sim을 한 단계 진행한다. */
  onFrame: (dt: number, nowMs: number) => void;
  onPointer: (phase: LobbyPointerPhase, hit: PointerHit | null, x: number, y: number) => void;
  onProject: (projection: LobbyProjection) => void;
  /** 매 프레임 말풍선 꼬리가 닿을 화면 좌표. 말풍선이 라이트루프를 바로 따라가게 화면이 다시 그리지 않고 옮긴다. */
  onBubbleFrame?: (x: number, y: number) => void;
  /** 화면이 다른 화면 아래에 깔려 있을 때처럼 그리기를 멈출 때. */
  paused?: boolean;
  /** 지금 시각의 햇빛·하루의 때·계절(daylightAt). 바뀌면 방 색감·창문 빛·천장 조명·창밖이 부드럽게 따라간다. */
  daylight: Daylight;
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
 * 가구마다 까는 옅은 그림자(실시간 아님). floor는 바닥에 닿은 넓이(가구 앞면 기준 가로·깊이), wall은 벽에 건 것 뒤 벽에 비치는 넓이(가로·세로)다.
 * 빛이 앞쪽 왼편 위에서 오므로 벽 그림자는 오른쪽 아래로 조금 비껴 둔다.
 */
const FURNITURE_SHADOW: Partial<Record<FurniturePiece, { floor?: [number, number, number]; wall?: [number, number, number] }>> = {
  board: { wall: [2.0, 1.6, 0.3] },
  window: { wall: [2.55, 2.15, 0.3] },
  desk: { floor: [2.8, 1.65, 0.5] },
  chair: { floor: [0.75, 0.75, 0.42] },
  bookcase: { floor: [1.4, 1.2, 0.52] },
  wardrobe: { floor: [1.4, 1.2, 0.52] }
};

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
  /** 코드로 만든 대체 가구. Kenney 가구 묶음(lobby3d-furniture)이 뜨면 숨기지만, 보이지 않는 채로 누르기 판정을 맡는다. */
  furniture: THREE.Group;
  /** 방 조명. 하루의 때에 따라 색·세기가 바뀐다(lobby3d-daylight). */
  ambient: THREE.AmbientLight;
  sun: THREE.DirectionalLight;
}

function buildWorld(): World {
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
  kit.part(new RoundedBoxGeometry(2.0, 0.16, ROOM.stepDepth, 2, 0.04), 0x8a5a3b, 0, shell).position.set(W / 2, -0.14, D + ROOM.stepDepth / 2);

  // 가구 밑과 벽에 건 것 뒤의 옅은 그림자, 라룹이 발밑 그림자
  const blob = blobTexture();
  const softRect = softRectTexture();
  for (const place of FURNITURE_LAYOUT) {
    const shade = FURNITURE_SHADOW[place.piece];
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
      root.add(m);
    }
    if (shade.wall) {
      // 벽에 건 것(모두 뒷벽)은 뒷벽 안쪽 면(z = 0) 바로 앞에 둔다
      const [w, h, opacity] = shade.wall;
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ map: softRect, color: 0x3a2214, transparent: true, opacity, depthWrite: false })
      );
      m.position.set(place.x + 0.07, place.y - 0.1, 0.01);
      m.raycast = () => {};
      root.add(m);
    }
  }

  // 가구. Kenney 가구 묶음(lobby3d-furniture)이 뜨기 전이나 불러오지 못했을 때 보이는 간단한 모양이고,
  // 묶음이 뜬 뒤에도 보이지 않는 채로 남아 장소·가구를 누르는 판정을 맡는다(three의 누르기 판정은 보이는지와 상관없다).
  // 자리는 FURNITURE_LAYOUT과 같고, 크기는 Kenney 가구와 비슷하게 맞춘다.
  const furniture = new THREE.Group();
  root.add(furniture);
  const markObjects: World["markObjects"] = [];
  const blockers: THREE.Object3D[] = [];
  const makePiece = (piece: FurniturePiece): THREE.Group => {
    const g = new THREE.Group();
    switch (piece) {
      case "board":
        kit.part(new RoundedBoxGeometry(1.6, 1.25, 0.08, 3, 0.03), 0xe39a64, 0.03, g);
        kit.part(new THREE.BoxGeometry(1.42, 1.07, 0.04), 0xc78c52, 0, g).position.z = 0.03;
        kit.part(new THREE.BoxGeometry(0.4, 0.37, 0.02), 0xffffff, 0.012, g).position.set(-0.3, 0, 0.06);
        kit.part(new THREE.BoxGeometry(0.45, 0.4, 0.02), 0xffeb73, 0.012, g).position.set(0.3, -0.07, 0.06);
        break;
      case "window":
        kit.part(new RoundedBoxGeometry(2.3, 1.88, 0.12, 2, 0.03), 0xe39a64, 0.03, g);
        kit.part(new THREE.BoxGeometry(1.95, 1.6, 0.04), 0x9fcde6, 0, g).position.z = 0.05;
        kit.part(new THREE.BoxGeometry(1.95, 0.06, 0.05), 0xe39a64, 0, g).position.z = 0.08;
        kit.part(new THREE.BoxGeometry(0.06, 1.6, 0.05), 0xe39a64, 0, g).position.z = 0.08;
        break;
      case "exit": {
        // 입구 발판(폭 2, 깊이 0.7, 윗면은 바닥보다 조금 낮다)만 덮는 보이지 않는 상자. 방 앞쪽 바닥은 덮지 않는다.
        // 보이지 않아도 누르기 판정은 받는다.
        const hit = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.3, ROOM.stepDepth), new THREE.MeshBasicMaterial());
        hit.position.y = -0.1;
        hit.visible = false;
        g.add(hit);
        break;
      }
      case "desk":
        kit.part(new RoundedBoxGeometry(1.84, 0.1, 0.98, 3, 0.03), 0xe39a64, 0.03, g).position.y = 0.91;
        for (const [lx, lz] of [[-0.85, -0.42], [0.85, -0.42], [-0.85, 0.42], [0.85, 0.42]]) {
          kit.part(new THREE.BoxGeometry(0.08, 0.86, 0.08), 0xc78c52, 0.02, g).position.set(lx, 0.43, lz);
        }
        break;
      case "chair":
        kit.part(new THREE.BoxGeometry(0.5, 0.08, 0.5), 0xe39a64, 0.02, g).position.y = 0.55;
        kit.part(new THREE.BoxGeometry(0.5, 0.6, 0.06), 0xe39a64, 0.02, g).position.set(0, 0.88, -0.22);
        break;
      case "bookcase":
      case "wardrobe":
        kit.part(new RoundedBoxGeometry(1.0, 2.15, 0.62, 3, 0.04), 0xe39a64, 0.03, g).position.y = 1.08;
        break;
      case "rug":
        kit.part(new THREE.CylinderGeometry(1.15, 1.15, 0.02, 40), 0xef6157, 0, g).position.y = 0.01;
        break;
    }
    return g;
  };
  for (const place of FURNITURE_LAYOUT) {
    const g = makePiece(place.piece);
    // 대체 모양은 Kenney 2.5배 크기로 지었다. 창문 말고는 가구 묶음(Kenney 2.8배, 책상은 그 1.2배, 옷장·책장은 깊이 1.25배)에 맞춰 키운다.
    if (place.piece !== "window" && place.piece !== "exit") g.scale.setScalar(2.8 / 2.5);
    if (place.piece === "desk") g.scale.multiplyScalar(1.2);
    if (place.piece === "bookcase" || place.piece === "wardrobe") g.scale.z *= 1.25;
    g.position.set(place.x, place.y, place.z);
    g.rotation.y = place.rotY;
    furniture.add(g);
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
  }

  const labelPoints: Record<MarkId, THREE.Vector3> = {
    board: new THREE.Vector3(1.8, 2.75, 0.3),
    window: new THREE.Vector3(4.8, 3.05, 0.3),
    door: new THREE.Vector3(W / 2, 0.4, D + ROOM.stepDepth / 2),
    desk: new THREE.Vector3(1.25, 2.1, 5.5)
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

  return { root, kit, shadow, markObjects, blockers, labelPoints, floor, shell, furniture, ambient, sun };
}

// ---------- 장면 ----------

function Scene({
  sim,
  viewWidth,
  toon,
  onFrame,
  onProject,
  onBubbleFrame,
  daylight,
  pickRef
}: Lobby3dCanvasProps & { pickRef: MutableRefObject<((x: number, y: number) => PointerHit | null) | null> }) {
  const world = useMemo(buildWorld, []);
  // 시각에 따른 빛: 지금 보이는 색감(부드럽게 넘어가는 중인 값)과 구운 방에 곱하는 색
  const daylightState = useMemo(() => createDaylightState(daylight), []); // eslint-disable-line react-hooks/exhaustive-deps
  const roomTint = useMemo(() => new THREE.Color(0xffffff), []);
  const { camera, size, scene } = useThree();
  const target = useRef(new THREE.Vector3(sim.x, 0, sim.z));
  const character = useRef<CharacterHandle | null>(null);
  const fps = useRef({ frames: 0, since: 0, value: 0, lastSent: 0 });
  const raycaster = useMemo(() => new THREE.Raycaster(), []);

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
      // 모델을 다 불러오기 전에는 캐릭터를 누를 수 없다(그 자리는 바닥으로 본다).
      const objects: THREE.Object3D[] = [...(character.current ? [character.current.group] : []), ...world.markObjects.map((m) => m.object), ...world.blockers];
      const hits = raycaster.intersectObjects(objects, true);
      let mark: MarkId | null = null;
      let onCharacter = false;
      const first = hits[0]?.object.userData as { mark?: MarkId; isCharacter?: boolean; blocker?: boolean } | undefined;
      if (first?.isCharacter) onCharacter = true;
      else if (first?.mark) mark = first.mark;
      // 장소가 아닌 가구(화분)를 누르면 그 뒤 바닥으로 걸어가지 않게 바닥 점을 주지 않는다.
      if (first?.blocker) return { point: null, mark: null, onCharacter: false };
      const floorHit = new THREE.Vector3();
      const onFloor = raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), floorHit);
      return { point: onFloor ? { x: floorHit.x, z: floorHit.z } : null, mark, onCharacter };
    };
    return () => {
      pickRef.current = null;
    };
  }, [camera, size, raycaster, world, pickRef]);

  useFrame((_, delta) => {
    const nowMs = Date.now();
    const dt = Math.min(0.05, delta);
    onFrame(dt, nowMs);
    const lift = character.current?.update(sim, dt, nowMs / 1000) ?? 0;
    // 도형 캐릭터 때와 같이, 몸이 들리면 그림자가 작아진다(들린 높이를 그때 단위 1.25로 나눠 같은 비율로).
    const shrink = 1 - (lift / 1.25) * 0.35;
    world.shadow.position.set(sim.x, 0.01, sim.z);
    world.shadow.scale.set(1.15 * shrink, 0.8 * shrink, 1);

    // 카메라: 따라갈 점(라룹이 자리)을 부드럽게 옮기고, 그 점으로 cameraPose가 정한 원근 카메라 자리를 그대로 쓴다.
    // 매 프레임 자리를 cameraPose가 정하므로 따라가는 도중에도 방 끝 너머는 보이지 않는다.
    const persp = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    const k = Math.min(1, dt * 4);
    target.current.x += (sim.x - target.current.x) * k;
    target.current.z += (sim.z - target.current.z) * k;
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
    onBubbleFrame?.(bubble.x, bubble.y);

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
      const labels = {} as Record<MarkId, { x: number; y: number }>;
      (Object.keys(MARKS) as MarkId[]).forEach((id) => {
        labels[id] = toScreen(world.labelPoints[id]);
      });
      onProject({ bubble, labels, fps: f.value });
    }
  });

  return (
    <>
      {/* react-three-fiber의 three 객체 속성(object)이라 RN 린트 규칙이 모르는 속성으로 본다. */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <primitive object={world.root} />
      <DaylightRig state={daylightState} daylight={daylight} ambient={world.ambient} sun={world.sun} roomTint={roomTint} />
      <BakedFurnitureErrorBoundary>
        <Suspense fallback={null}>
          <BakedFurniture fallback={world.furniture} daylight={daylightState} />
        </Suspense>
      </BakedFurnitureErrorBoundary>
      <BakedRoomErrorBoundary>
        <Suspense fallback={null}>
          <BakedRoom fallback={world.shell} tint={roomTint} />
        </Suspense>
      </BakedRoomErrorBoundary>
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
