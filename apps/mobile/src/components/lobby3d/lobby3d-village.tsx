import { useFrame, useLoader, useThree } from "@react-three/fiber/native";
import { Component, useEffect, useMemo, type MutableRefObject, type ReactNode } from "react";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { LobbySim } from "@/lib/lobby3d/engine";
import type { Season } from "@/lib/lobby3d/daylight";
import { VILLAGE, VILLAGE_TREES, VILLAGE_WINDMILL, occludingBuildings, type VillageBuildingId } from "@/lib/lobby3d/village";
import type { DaylightState } from "./lobby3d-daylight";
import { SEASON_COLORS } from "./lobby3d-outdoor";

// 바깥 마을 그리기. 풀밭·하늘(코드로 짓고 계절·하루의 때를 따른다)과, Kenney 키트로 조립한 마을 모델(lobby-village.glb: 건물·소품·풍차·나무 틀)을 그린다.
// 나무는 모델의 나무 틀을 마을 나무 자리와 둘레 숲에 여러 그루 찍고(인스턴스), 잎을 계절 색으로 칠한다.
// 모델을 불러오지 못하면 풀밭·하늘만 보인다(걸어갈 수 없는 곳은 village.ts 데이터대로 막는다).
// 라룹이를 가리는 건물은 반투명하게 하고, 새벽·어스름·밤에는 창과 가로등에 불을 켠다. 풍차 날개는 천천히 돈다.

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

interface Nature {
  group: THREE.Group;
  setSeason(season: Season): void;
  dispose(): void;
}

/** 풀밭(마을 안팎). 계절 색을 따른다. */
function buildNature(): Nature {
  const group = new THREE.Group();
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x8cc76a });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(VILLAGE.width + FOREST_MARGIN * 6, VILLAGE.depth + FOREST_MARGIN * 6), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(VILLAGE.width / 2, -0.02, VILLAGE.depth / 2);
  ground.raycast = () => {};
  group.add(ground);
  let shownSeason: Season | null = null;
  return {
    group,
    setSeason(season) {
      if (season === shownSeason) return;
      shownSeason = season;
      // 색 값(16진)은 화면 색이고, set이 알아서 선형 색으로 바꾼다
      groundMat.color.set(SEASON_COLORS[season].ground);
    },
    dispose() {
      ground.geometry.dispose();
      groundMat.dispose();
    }
  };
}

/** 나무 한 그루를 찍을 자리. */
interface TreeSpot {
  kind: string;
  x: number;
  z: number;
  scale: number;
  turn: number;
  /** 잎 색 번호(계절 색 넷 중). */
  leaf: number;
}

/** 마을 나무 자리(배치 데이터)와 둘레 숲(마을 끝 바깥을 채운다. 화면 어디에도 검은 바깥이 보이지 않게). */
function treeSpots(): TreeSpot[] {
  const rnd = seeded(11);
  const spots: TreeSpot[] = [];
  const pick = <T,>(items: readonly T[]) => items[Math.floor(rnd() * items.length)];
  for (const [x, z] of VILLAGE_TREES) {
    spots.push({ kind: pick(VILLAGE_TREE_KINDS), x, z, scale: 1.7 + rnd() * 0.35, turn: rnd() * Math.PI * 2, leaf: Math.floor(rnd() * 4) });
  }
  for (let x = -FOREST_MARGIN; x <= VILLAGE.width + FOREST_MARGIN; x += 2.7) {
    for (let z = -FOREST_MARGIN; z <= VILLAGE.depth + FOREST_MARGIN; z += 2.7) {
      const jx = x + (rnd() - 0.5) * 1.6;
      const jz = z + (rnd() - 0.5) * 1.6;
      const inside = jx > -1 && jx < VILLAGE.width + 1 && jz > -1 && jz < VILLAGE.depth + 1;
      // 풍차 탑과 도는 날개 둘레는 비운다
      const nearMill = Math.abs(jx - VILLAGE_WINDMILL.x) < MILL_CLEAR && Math.abs(jz - VILLAGE_WINDMILL.z) < MILL_CLEAR;
      if (inside || nearMill || rnd() < 0.12) continue;
      spots.push({ kind: pick(FOREST_TREE_KINDS), x: jx, z: jz, scale: 1.8 + rnd() * 0.7, turn: rnd() * Math.PI * 2, leaf: Math.floor(rnd() * 4) });
    }
  }
  return spots;
}

/** 마을 안에 섞어 심는 나무(둥근 나무 많이)와 둘레 숲 나무(침엽수 많이). 이름은 모델의 나무 틀(tpl-<이름>-leaf/trunk)이다. */
const VILLAGE_TREE_KINDS = ["tree-high-round", "tree-high-round", "tree-crooked", "tree", "tree-high-crooked"] as const;
const FOREST_TREE_KINDS = ["tree", "tree-high", "tree-high", "tree-high-round"] as const;
/** 둘레 숲을 심지 않는 풍차 둘레(풍차 가운데에서 가로·깊이로, 칸). 탑 반 폭 1.5 + 날개 길이 약 3.7 + 나무 잎 반지름 약 1. */
const MILL_CLEAR = 6.5;
/** 침엽수 틀(잎을 사철 초록 pine으로 칠한다. 창밖 풍경과 같은 규칙). 둥근 나무만 활엽수 잎 색을 쓴다. */
const isPine = (kind: string) => !kind.includes("round");
/** 풍차 날개가 한 바퀴 도는 시간(초). */
const ROTOR_TURN_SECONDS = 14;

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
        if (/^(bld-|glow-|props|paths|hedges|fences|windmill)/.test(n.name)) return n.name;
      }
      return "";
    };
    // 나무 틀은 그리지 않고 떼어 둔다(아래에서 여러 그루로 찍는다)
    const templates = root.getObjectByName("tree-templates");
    if (templates) templates.removeFromParent();
    // 풍차 날개: 날개 가운데를 축으로 돌도록 모양을 가운데로 옮기고 그만큼 자리를 옮긴다
    let rotor: THREE.Mesh | null = null;
    root.getObjectByName("windmill-rotor")?.traverse((o) => {
      if (o instanceof THREE.Mesh && !rotor) rotor = o;
    });
    if (rotor) {
      const r = rotor as THREE.Mesh;
      r.geometry = r.geometry.clone();
      r.geometry.computeBoundingBox();
      const center = r.geometry.boundingBox!.getCenter(new THREE.Vector3());
      r.geometry.translate(-center.x, -center.y, -center.z);
      r.position.add(center);
    }
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
    // 나무: 틀마다 잎·줄기를 인스턴스로 찍는다. 잎은 흰 재질에 그루마다 색을 곱한다(계절 색)
    const leafMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    owned.push(leafMat);
    const leaves: { mesh: THREE.InstancedMesh; spots: TreeSpot[] }[] = [];
    const spots = treeSpots();
    const matrix = new THREE.Matrix4();
    const turn = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const kinds = new Set(spots.map((spot) => spot.kind));
    for (const kind of kinds) {
      const mine = spots.filter((spot) => spot.kind === kind);
      for (const part of ["leaf", "trunk"] as const) {
        const source = templates?.getObjectByName(`tpl-${kind}-${part}`) as THREE.Mesh | undefined;
        if (!source) continue;
        let material: THREE.Material = leafMat;
        if (part === "trunk") {
          const map = (source.material as THREE.MeshStandardMaterial).map;
          if (map) map.colorSpace = THREE.SRGBColorSpace;
          material = new THREE.MeshLambertMaterial({ map });
          owned.push(material);
        }
        const mesh = new THREE.InstancedMesh(source.geometry, material, mine.length);
        mine.forEach((spot, i) => {
          turn.setFromAxisAngle(up, spot.turn);
          matrix.compose(new THREE.Vector3(spot.x, 0, spot.z), turn, new THREE.Vector3(spot.scale, spot.scale, spot.scale));
          mesh.setMatrixAt(i, matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        // 잎은 그루마다 색을 곱한다. 처음 그리기 전에 색 자리를 만들어 둬야 셰이더가 그 색을 쓴다(계절 색은 아래 프레임에서 칠한다)
        if (part === "leaf") mine.forEach((_, i) => mesh.setColorAt(i, new THREE.Color(0xffffff)));
        mesh.raycast = () => {};
        root.add(mesh);
        if (part === "leaf") leaves.push({ mesh, spots: mine });
      }
    }
    return { root, buildings, glows, glowMat, hedgeMats, owned, pick, leaves, rotor: rotor as THREE.Mesh | null, season: { shown: null as Season | null } };
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
    const season = daylight.target.season;
    if (built.season.shown !== season) {
      built.season.shown = season;
      const colors = SEASON_COLORS[season];
      for (const m of built.hedgeMats) m.color.set(colors.bushes[0]);
      const color = new THREE.Color();
      for (const { mesh, spots } of built.leaves) {
        spots.forEach((spot, i) => mesh.setColorAt(i, color.set(isPine(spot.kind) ? colors.pine : colors.leaves[spot.leaf % colors.leaves.length])));
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    }
    // 풍차 날개: 동작 줄이기면 멈춘다
    if (built.rotor && !sim.reduceMotion) built.rotor.rotation.z -= (delta * Math.PI * 2) / ROTOR_TURN_SECONDS;
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
