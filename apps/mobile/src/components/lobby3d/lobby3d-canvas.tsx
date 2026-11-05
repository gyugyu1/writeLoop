// three보다 먼저 불러와야 한다(Hermes에 없는 FinalizationRegistry 대체).
import "@/lib/lobby3d/hermes-polyfills";
import { Canvas, useFrame, useThree } from "@react-three/fiber/native";
import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { StyleSheet, View, type GestureResponderEvent } from "react-native";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { LobbySim, MARKS, ROOM, clampCameraTarget, type MarkId, type PointerHit } from "@/lib/lobby3d/engine";
import { Character, CharacterErrorBoundary, type CharacterHandle } from "./lobby3d-character";

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
}

const LINE = 0x3d1b0f;
const PITCH = (ROOM.pitchDeg * Math.PI) / 180;

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
        orthographic
        camera={{ position: [4, 20, 26], zoom: 60, near: 0.1, far: 120 }}
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
  materials = new Map<number, THREE.MeshToonMaterial>();
  toonMaterials: THREE.MeshToonMaterial[] = [];
  outlines: OutlinePart[] = [];
  outlineMaterial = new THREE.MeshBasicMaterial({ color: LINE, side: THREE.BackSide });
  gradient = gradientTexture(3);

  toon(color: number): THREE.MeshToonMaterial {
    let material = this.materials.get(color);
    if (!material) {
      material = new THREE.MeshToonMaterial({ color, gradientMap: this.gradient });
      this.materials.set(color, material);
      this.toonMaterials.push(material);
    }
    return material;
  }

  part(geometry: THREE.BufferGeometry, color: number, outline = 0.03, parent?: THREE.Object3D): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, this.toon(color));
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

function floorTexture(): THREE.DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const seam = y % 16 === 0 || (x === (Math.floor(y / 16) * 23) % size && y % 16 !== 0);
      const shade = seam ? 0.86 : 1;
      data.set([Math.round(0xe8 * shade), Math.round(0xc7 * shade), Math.round(0x9a * shade), 255], (y * size + x) * 4);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(ROOM.width / 2, 24 / 2);
  texture.magFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
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
  /** 장소가 아닌 가구. 누르면 움직이지 않는다. */
  blockers: THREE.Object3D[];
}

function buildWorld(): World {
  const kit = new WorldKit();
  const root = new THREE.Group();
  const W = ROOM.width;
  const H = ROOM.wallHeight;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.6, 24), new THREE.MeshToonMaterial({ map: floorTexture(), gradientMap: kit.gradient }));
  kit.toonMaterials.push(floor.material as THREE.MeshToonMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(W / 2, 0, 12);
  root.add(floor);
  kit.part(new THREE.BoxGeometry(W + 0.6, H, 0.3), 0xf4ddb8, 0, root).position.set(W / 2, H / 2, -0.15);
  kit.part(new THREE.BoxGeometry(W + 0.6, 0.22, 0.06), 0xc9a273, 0, root).position.set(W / 2, 0.11, 0.03);
  for (const sx of [-0.15, W + 0.15]) kit.part(new THREE.BoxGeometry(0.3, H, 24), 0xebd0a6, 0, root).position.set(sx, H / 2, 12);
  const stripeMaterial = new THREE.MeshBasicMaterial({ color: 0xf8e7cc });
  for (let x = 0.25; x < W; x += 0.5) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.22, H - 0.3), stripeMaterial);
    stripe.position.set(x, H / 2 + 0.15, 0.005);
    root.add(stripe);
  }

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
    new THREE.CircleGeometry(0.42, 24),
    new THREE.MeshBasicMaterial({ color: 0x2b1810, transparent: true, opacity: 0.16 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  root.add(shadow);

  return { root, kit, shadow, markObjects, blockers: [plant], labelPoints, floor };
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
    scene.background = new THREE.Color(0xe8c79a);
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
          materials.forEach((m) => m.dispose());
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

    // 카메라: 화면 가로에 viewWidth 칸이 보이게 하고, 라이트루프를 부드럽게 따라가되 방 밖은 보이지 않게.
    const ortho = camera as THREE.OrthographicCamera;
    const zoom = size.width / viewWidth;
    if (Math.abs(ortho.zoom - zoom) > 0.001) {
      ortho.zoom = zoom;
      ortho.updateProjectionMatrix();
    }
    const viewHeight = size.height / zoom;
    const want = clampCameraTarget({ x: sim.x, z: sim.z - 0.6 }, viewWidth, viewHeight);
    const k = Math.min(1, dt * 4);
    target.current.x += (want.x - target.current.x) * k;
    target.current.z += (want.z - target.current.z) * k;
    // 따라가는 도중에도(특히 거리를 바꾼 순간) 방 밖이 보이지 않게 다시 제한한다.
    const held = clampCameraTarget({ x: target.current.x, z: target.current.z }, viewWidth, viewHeight);
    target.current.x = held.x;
    target.current.z = held.z;
    const dist = 30;
    camera.position.set(target.current.x, Math.sin(PITCH) * dist, target.current.z + Math.cos(PITCH) * dist);
    camera.lookAt(target.current.x, 0, target.current.z);
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
