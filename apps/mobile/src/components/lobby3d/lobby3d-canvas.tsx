// three보다 먼저 불러와야 한다(Hermes에 없는 FinalizationRegistry 대체).
import "@/lib/lobby3d/hermes-polyfills";
import { Canvas, useFrame, useThree } from "@react-three/fiber/native";
import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { StyleSheet, View, type GestureResponderEvent } from "react-native";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { LobbySim, MARKS, ROOM, cameraPose, type MarkId, type PointerHit } from "@/lib/lobby3d/engine";
import { Character, CharacterErrorBoundary, type CharacterHandle } from "./lobby3d-character";
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
  /** 화면이 다른 화면 아래에 깔려 있을 때처럼 그리기를 멈출 때. */
  paused?: boolean;
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
}

function buildWorld(): World {
  const kit = new WorldKit();
  const root = new THREE.Group();
  const W = ROOM.width;
  const H = ROOM.wallHeight;

  // 앞이 트인 상자 같은 방(디오라마): 바닥, 뒷벽, 양옆 벽(두께와 윗면), 걸레받이, 옆벽 창문, 앞 가운데 입구 발판. 그 밖은 검정.
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
  // 옆벽 창문(나무 틀 + 하늘색 유리)
  for (const [wx, face] of [[0.005, 1], [W - 0.005, -1]] as const) {
    const win = new THREE.Group();
    kit.part(new RoundedBoxGeometry(0.08, 1.3, 1.0, 2, 0.03), 0xb57a45, 0, win);
    kit.part(new THREE.BoxGeometry(0.02, 1.1, 0.8), 0xbfe4fa, 0, win).position.x = face * 0.035;
    kit.part(new THREE.BoxGeometry(0.03, 1.1, 0.05), 0xb57a45, 0, win).position.x = face * 0.045;
    win.position.set(wx, 1.8, D * 0.45);
    root.add(win);
  }
  // 앞 가운데 입구 발판(바닥보다 조금 낮다)
  kit.part(new RoundedBoxGeometry(2.0, 0.16, ROOM.stepDepth, 2, 0.04), 0x8a5a3b, 0, shell).position.set(W / 2, -0.14, D + ROOM.stepDepth / 2);

  // 가구 밑의 부드러운 그림자
  const blob = blobTexture();
  const blobAt = (x: number, z: number, w: number, d: number, opacity: number) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ map: blob, color: 0x3a2214, transparent: true, opacity, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.006, z);
    m.raycast = () => {};
    root.add(m);
  };
  blobAt(1.15, 5.5, 2.4, 1.7, 0.4);
  blobAt(4.8, 0.55, 2.3, 1.3, 0.4);
  blobAt(7.4, 3.6, 1.1, 1.1, 0.45);

  const markObjects: World["markObjects"] = [];
  const tagMark = (id: MarkId, object: THREE.Object3D) => {
    object.traverse((o) => {
      o.userData.mark = id;
    });
    markObjects.push({ id, object });
  };

  // 질문 게시판
  const board = new THREE.Group();
  kit.part(new RoundedBoxGeometry(1.7, 1.35, 0.14, 3, 0.05), 0x8a5a3b, 0.03, board);
  kit.part(new THREE.BoxGeometry(1.45, 1.1, 0.06), 0xd9a866, 0, board).position.z = 0.06;
  const n1 = kit.part(new THREE.BoxGeometry(0.42, 0.38, 0.02), 0xffffff, 0.012, board);
  n1.position.set(-0.35, -0.08, 0.1);
  n1.rotation.z = -0.1;
  const n2 = kit.part(new THREE.BoxGeometry(0.48, 0.42, 0.02), 0xfff3a8, 0.012, board);
  n2.position.set(0.32, -0.12, 0.1);
  n2.rotation.z = 0.08;
  board.position.set(1.8, 1.75, 0.08);
  root.add(board);
  tagMark("board", board);

  // 생각 창가(창문 + 창가 의자)
  const win = new THREE.Group();
  kit.part(new RoundedBoxGeometry(1.7, 1.6, 0.12, 3, 0.05), 0xffffff, 0.03, win);
  kit.part(new THREE.BoxGeometry(1.4, 1.3, 0.04), 0xbfe4fa, 0, win).position.z = 0.05;
  kit.part(new THREE.BoxGeometry(0.08, 1.3, 0.05), 0xffffff, 0, win).position.z = 0.08;
  kit.part(new THREE.BoxGeometry(1.4, 0.08, 0.05), 0xffffff, 0, win).position.z = 0.08;
  win.position.set(4.8, 1.95, 0.07);
  root.add(win);
  const seat = new THREE.Group();
  kit.part(new RoundedBoxGeometry(1.7, 0.45, 0.8, 3, 0.06), 0xb9824f, 0.03, seat).position.y = 0.23;
  kit.part(new RoundedBoxGeometry(1.55, 0.18, 0.7, 3, 0.07), 0x7fb3e6, 0.025, seat).position.y = 0.53;
  seat.position.set(4.8, 0, 0.45);
  root.add(seat);
  tagMark("window", win);
  tagMark("window", seat);

  // 문
  const door = new THREE.Group();
  kit.part(new RoundedBoxGeometry(1.1, 2.1, 0.12, 3, 0.08), 0x8a5a3b, 0.03, door);
  kit.part(new THREE.SphereGeometry(0.07, 12, 10), 0xffc23d, 0.015, door).position.set(0.36, -0.05, 0.1);
  door.position.set(7.0, 1.05, 0.07);
  root.add(door);
  tagMark("door", door);

  // 일기 책상
  const desk = new THREE.Group();
  kit.part(new RoundedBoxGeometry(1.7, 0.14, 1.0, 3, 0.04), 0xb9824f, 0.03, desk).position.y = 0.78;
  for (const [lx, lz] of [[-0.72, -0.38], [0.72, -0.38], [-0.72, 0.38], [0.72, 0.38]]) {
    kit.part(new THREE.BoxGeometry(0.1, 0.72, 0.1), 0x8a5a3b, 0.02, desk).position.set(lx, 0.36, lz);
  }
  const note = kit.part(new THREE.BoxGeometry(0.7, 0.05, 0.5), 0xffffff, 0.015, desk);
  note.position.set(-0.1, 0.88, 0.05);
  note.rotation.y = 0.15;
  const pencil = kit.part(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), 0xffc23d, 0.01, desk);
  pencil.rotation.set(0, -0.5, Math.PI / 2);
  pencil.position.set(0.45, 0.88, 0.1);
  desk.position.set(1.15, 0, 5.5);
  root.add(desk);
  tagMark("desk", desk);

  // 러그, 화분
  kit.part(new THREE.CylinderGeometry(1.45, 1.45, 0.03, 40), 0x9cc8e8, 0, root).position.set(4.6, 0.015, 7.2);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.13, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(4.6, 0.035, 7.2);
  root.add(ring);
  const plant = new THREE.Group();
  kit.part(new THREE.CylinderGeometry(0.28, 0.22, 0.5, 16), 0xe36a00, 0.025, plant).position.y = 0.25;
  kit.part(new THREE.SphereGeometry(0.42, 16, 12), 0x4e9f5a, 0.03, plant).position.y = 0.85;
  kit.part(new THREE.SphereGeometry(0.3, 14, 10), 0x5db06a, 0.025, plant).position.set(0.22, 1.1, 0.1);
  plant.position.set(7.4, 0, 3.6);
  plant.traverse((o) => {
    o.userData.blocker = true;
  });
  root.add(plant);

  const labelPoints: Record<MarkId, THREE.Vector3> = {
    board: new THREE.Vector3(1.8, 2.65, 0.3),
    window: new THREE.Vector3(4.8, 2.95, 0.3),
    door: new THREE.Vector3(7.0, 2.55, 0.3),
    desk: new THREE.Vector3(1.15, 1.9, 5.5)
  };

  root.add(new THREE.AmbientLight(0xffffff, 1.35));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-3, 8, 6);
  root.add(sun);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 1.15),
    new THREE.MeshBasicMaterial({ map: blob, color: 0x2b1810, transparent: true, opacity: 0.38, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  root.add(shadow);

  return { root, kit, shadow, markObjects, blockers: [plant], labelPoints, floor, shell };
}

// ---------- 장면 ----------

function Scene({
  sim,
  viewWidth,
  toon,
  onFrame,
  onProject,
  pickRef
}: Lobby3dCanvasProps & { pickRef: MutableRefObject<((x: number, y: number) => PointerHit | null) | null> }) {
  const world = useMemo(buildWorld, []);
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
      const toScreen = (v: THREE.Vector3) => {
        const p = v.clone().project(camera);
        return { x: ((p.x + 1) / 2) * size.width, y: ((1 - p.y) / 2) * size.height };
      };
      const labels = {} as Record<MarkId, { x: number; y: number }>;
      (Object.keys(MARKS) as MarkId[]).forEach((id) => {
        labels[id] = toScreen(world.labelPoints[id]);
      });
      const bubble = toScreen(character.current?.bubblePoint() ?? new THREE.Vector3(sim.x, 3.2, sim.z));
      onProject({ bubble, labels, fps: f.value });
    }
  });

  return (
    <>
      {/* react-three-fiber의 three 객체 속성(object)이라 RN 린트 규칙이 모르는 속성으로 본다. */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <primitive object={world.root} />
      <BakedRoomErrorBoundary>
        <Suspense fallback={null}>
          <BakedRoom fallback={world.shell} />
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
