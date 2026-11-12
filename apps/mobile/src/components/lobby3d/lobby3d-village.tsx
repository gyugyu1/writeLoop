import { useFrame, useLoader, useThree } from "@react-three/fiber/native";
import { Component, useEffect, useMemo, type MutableRefObject, type ReactNode } from "react";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { LobbySim } from "@/lib/lobby3d/engine";
import type { Season } from "@/lib/lobby3d/daylight";
import { VILLAGE, VILLAGE_TREES, occludingBuildings, type VillageBuildingId } from "@/lib/lobby3d/village";
import type { DaylightState } from "./lobby3d-daylight";
import { SEASON_COLORS } from "./lobby3d-outdoor";

// 바깥 마을 그리기. 풀밭·나무·숲·하늘(코드로 짓고 계절·하루의 때를 따른다)과, Kenney 키트로 조립한 건물·소품 모델(lobby-village.glb)을 그린다.
// 모델을 불러오지 못하면 풀밭·나무·하늘만 보인다(걸어갈 수 없는 곳은 village.ts 데이터대로 막는다).
// 라룹이를 가리는 건물은 반투명하게 하고, 새벽·어스름·밤에는 창과 가로등에 불을 켠다.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const VILLAGE_ASSET = require("../../../assets/models/lobby-village.glb");

/** 라룹이를 가리는 건물의 불투명도와, 바뀌는 데 걸리는 시간(초). */
const FADED_OPACITY = 0.35;
const FADE_SECONDS = 0.25;
/** 마을 둘레 숲의 넓이(마을 끝에서 바깥으로, 칸). */
const FOREST_MARGIN = 9;

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** 나무 한 그루의 잎 공들(가운데 x·z, 크기 s). [x, y, z, 반지름]. */
function crownBalls(x: number, z: number, s: number, full: boolean): [number, number, number, number][] {
  const parts: [number, number, number, number][] = full
    ? [
        [0, 2.4, 0, 1.0],
        [-0.6, 1.95, 0.2, 0.72],
        [0.62, 2.0, -0.1, 0.75],
        [0.1, 3.05, 0.1, 0.68],
        [0, 2.0, 0.55, 0.6]
      ]
    : [
        [0, 2.4, 0, 1.05],
        [-0.55, 2.0, 0.25, 0.75],
        [0.15, 3.0, 0, 0.7]
      ];
  return parts.map(([px, py, pz, r]) => [x + px * s, py * s, z + pz * s, r * s]);
}

interface Nature {
  group: THREE.Group;
  setSeason(season: Season): void;
  dispose(): void;
}

/** 풀밭(마을 안팎), 마을 나무, 둘레 숲. 잎 색을 넷으로 나눠 색마다 한 모양으로 합친다(그리는 횟수를 줄인다). */
function buildNature(): Nature {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x8cc76a });
  const leafMats = [0, 1, 2, 3].map(() => new THREE.MeshLambertMaterial({ color: 0xffffff }));
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8d5f3f });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(VILLAGE.width + FOREST_MARGIN * 6, VILLAGE.depth + FOREST_MARGIN * 6), groundMat);
  geometries.push(ground.geometry);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(VILLAGE.width / 2, -0.02, VILLAGE.depth / 2);
  ground.raycast = () => {};
  group.add(ground);

  const rnd = seeded(11);
  const ball = new THREE.IcosahedronGeometry(1, 1);
  const crowns: THREE.BufferGeometry[][] = [[], [], [], []];
  const trunks: THREE.BufferGeometry[] = [];
  const addTree = (x: number, z: number, s: number, full: boolean) => {
    const leaf = Math.floor(rnd() * 4);
    for (const [bx, by, bz, r] of crownBalls(x, z, s, full)) crowns[leaf].push(ball.clone().scale(r, r, r).translate(bx, by, bz));
    trunks.push(new THREE.CylinderGeometry(0.13 * s, 0.2 * s, 1.8 * s, 6).translate(x, 0.9 * s, z));
  };
  // 마을 안 나무(걸어갈 수 없는 칸은 village.ts가 같은 자리로 막는다)
  for (const [x, z] of VILLAGE_TREES) addTree(x, z, 0.95 + rnd() * 0.2, true);
  // 둘레 숲: 마을 끝 바깥을 채운다(화면 어디에도 검은 바깥이 보이지 않게)
  for (let x = -FOREST_MARGIN; x <= VILLAGE.width + FOREST_MARGIN; x += 2.6) {
    for (let z = -FOREST_MARGIN; z <= VILLAGE.depth + FOREST_MARGIN; z += 2.6) {
      const jx = x + (rnd() - 0.5) * 1.6;
      const jz = z + (rnd() - 0.5) * 1.6;
      const inside = jx > -1 && jx < VILLAGE.width + 1 && jz > -1 && jz < VILLAGE.depth + 1;
      if (inside || rnd() < 0.15) continue;
      addTree(jx, jz, 1.0 + rnd() * 0.5, false);
    }
  }
  crowns.forEach((parts, i) => {
    if (parts.length === 0) return;
    const merged = mergeGeometries(parts);
    parts.forEach((p) => p.dispose());
    geometries.push(merged);
    const mesh = new THREE.Mesh(merged, leafMats[i]);
    mesh.raycast = () => {};
    group.add(mesh);
  });
  if (trunks.length) {
    const merged = mergeGeometries(trunks);
    trunks.forEach((t) => t.dispose());
    geometries.push(merged);
    const mesh = new THREE.Mesh(merged, trunkMat);
    mesh.raycast = () => {};
    group.add(mesh);
  }
  ball.dispose();

  let shownSeason: Season | null = null;
  return {
    group,
    setSeason(season) {
      if (season === shownSeason) return;
      shownSeason = season;
      // 색 값(16진)은 화면 색이고, set이 알아서 선형 색으로 바꾼다
      const colors = SEASON_COLORS[season];
      groundMat.color.set(colors.ground);
      leafMats.forEach((m, i) => m.color.set(colors.leaves[i % colors.leaves.length]));
    },
    dispose() {
      geometries.forEach((g) => g.dispose());
      [groundMat, trunkMat, ...leafMats].forEach((m) => m.dispose());
    }
  };
}

interface VillageNatureProps {
  daylight: DaylightState;
}

/** 풀밭·나무·숲과 하늘색 배경, 마을 빛(하늘빛 반사광과 햇빛). 마을 모델이 없어도 보인다. */
export function VillageNature({ daylight }: VillageNatureProps) {
  const nature = useMemo(buildNature, []);
  const hemi = useMemo(() => new THREE.HemisphereLight(0xe4f4ff, 0x6f9f55, 1.5), []);
  const sun = useMemo(() => {
    const light = new THREE.DirectionalLight(0xfff0d8, 1.7);
    light.position.set(VILLAGE.width / 2 - 10, 18, VILLAGE.depth / 2 + 12);
    light.target.position.set(VILLAGE.width / 2, 0, VILLAGE.depth / 2);
    return light;
  }, []);
  const { scene } = useThree();
  const sky = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    const before = scene.background;
    return () => {
      scene.background = before instanceof THREE.Color ? new THREE.Color(0x000000) : before;
      nature.dispose();
    };
  }, [scene, nature]);

  useFrame(() => {
    const a = daylight.ambience;
    nature.setSeason(daylight.target.season);
    sky.set(a.skyHorizon);
    scene.background = sky;
    hemi.intensity = a.outdoorHemiIntensity;
    sun.color.set(a.outdoorSunColor);
    sun.intensity = a.outdoorSunIntensity;
  });

  return (
    <>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <primitive object={nature.group} />
      {/* eslint-disable-next-line react/no-unknown-property */}
      <primitive object={hemi} />
      {/* eslint-disable-next-line react/no-unknown-property */}
      <primitive object={sun} />
      {/* eslint-disable-next-line react/no-unknown-property */}
      <primitive object={sun.target} />
    </>
  );
}

interface VillageModelProps {
  sim: LobbySim;
  daylight: DaylightState;
  /** 누르기 판정을 받을 건물·소품. 3D 화면이 마을에서 누른 곳을 찾을 때 쓴다. */
  pickTargets: MutableRefObject<THREE.Object3D[]>;
}


/** 건물·소품 모델. 라룹이를 가리는 건물은 반투명하게 하고, 밤에는 불빛 판을 켠다. */
export function VillageModel({ sim, daylight, pickTargets }: VillageModelProps) {
  const gltf = useLoader(GLTFLoader, VILLAGE_ASSET as string) as GLTF;
  const built = useMemo(() => {
    // useLoader가 준 장면은 앱 전체에서 함께 쓰므로 복제해서 재질을 바꾼다
    const root = gltf.scene.clone(true);
    const buildings = new Map<VillageBuildingId, { materials: THREE.MeshLambertMaterial[]; opacity: number }>();
    const glows: THREE.Mesh[] = [];
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, toneMapped: false, depthWrite: false });
    const hedgeMats: THREE.MeshLambertMaterial[] = [];
    const owned: THREE.Material[] = [glowMat];
    const pick: THREE.Object3D[] = [];
    // 묶음 이름(합친 메시는 뒤에 "-mesh"가 붙는다: bld-home-mesh, props-mesh 등)
    const groupOf = (o: THREE.Object3D): string => {
      for (let n: THREE.Object3D | null = o; n; n = n.parent) {
        if (/^(bld-|glow-|props|paths|hedges)/.test(n.name)) return n.name;
      }
      return "";
    };
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const name = groupOf(o);
      if (name.startsWith("glow")) {
        o.material = glowMat;
        o.raycast = () => {};
        glows.push(o);
        return;
      }
      const source = o.material as THREE.MeshStandardMaterial;
      const map = source.map;
      if (map) map.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.MeshLambertMaterial({ map, vertexColors: o.geometry.hasAttribute("color") });
      owned.push(material);
      o.material = material;
      if (name.startsWith("bld-")) {
        // 묶음 이름 bld-<id>(합친 메시는 bld-<id>-mesh)
        const id = /^bld-([A-Za-z]+)/.exec(name)![1] as VillageBuildingId;
        const entry = buildings.get(id) ?? { materials: [], opacity: 1 };
        entry.materials.push(material);
        buildings.set(id, entry);
        pick.push(o);
      } else if (name.startsWith("props")) {
        pick.push(o);
      } else {
        o.raycast = () => {};
        if (name.startsWith("hedges")) {
          // 생울타리는 색 그림 대신 창밖 풍경 덤불과 같은 계절 색으로 칠한다(겨울에는 눈 덮인 흰색). 구석 어둠은 그대로 곱한다
          material.map = null;
          material.needsUpdate = true;
          hedgeMats.push(material);
        }
      }
    });
    return { root, buildings, glows, glowMat, hedgeMats, owned, pick };
  }, [gltf]);

  useEffect(() => {
    pickTargets.current = built.pick;
    return () => {
      pickTargets.current = [];
      built.owned.forEach((m) => m.dispose());
    };
  }, [built, pickTargets]);

  useFrame((_, delta) => {
    // 가리는 건물: 0.25초에 걸쳐 0.35까지 옅어지고, 벗어나면 같은 빠르기로 돌아온다
    const hiding = new Set(occludingBuildings({ x: sim.x, z: sim.z }));
    const step = Math.min(1, delta / FADE_SECONDS) * (1 - FADED_OPACITY);
    for (const [id, entry] of built.buildings) {
      const goal = hiding.has(id) ? FADED_OPACITY : 1;
      const next = entry.opacity < goal ? Math.min(goal, entry.opacity + step) : Math.max(goal, entry.opacity - step);
      if (next === entry.opacity) continue;
      entry.opacity = next;
      for (const m of entry.materials) {
        m.opacity = next;
        const transparent = next < 0.999;
        if (m.transparent !== transparent) {
          m.transparent = transparent;
          m.needsUpdate = true;
        }
      }
    }
    // 밤 불빛: 천장 조명과 같은 때(새벽·어스름·밤) 켜진다. 켜고 끌 때는 천장 조명처럼 부드럽게
    built.glowMat.opacity = 0.9 * daylight.ceiling;
    for (const g of built.glows) g.visible = daylight.ceiling > 0.01;
    const bush = SEASON_COLORS[daylight.target.season].bushes[0];
    for (const m of built.hedgeMats) m.color.set(bush);
  });

  // eslint-disable-next-line react/no-unknown-property
  return <primitive object={built.root} />;
}

/** 마을 모델을 불러오지 못하면 풀밭·나무·하늘만 보이게 한다. 오류는 개발 콘솔에 남긴다. */
export class VillageModelErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("[lobby3d] 마을 모델을 불러오지 못했습니다", error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
