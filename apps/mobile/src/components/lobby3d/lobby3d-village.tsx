import { useFrame, useLoader, useThree } from "@react-three/fiber/native";
import { Component, Suspense, useEffect, useMemo, type MutableRefObject, type ReactNode } from "react";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { LobbySim } from "@/lib/lobby3d/engine";
import type { Season } from "@/lib/lobby3d/daylight";
import { VILLAGE, VILLAGE_PATH_RECTS, VILLAGE_TREES, VILLAGE_WINDMILL, occludingBuildings, type VillageBuildingId } from "@/lib/lobby3d/village";
import { GRASS_MARK_KINDS, villageDecorSpots, villageGrassMarks, type VillageDecorKind } from "@/lib/lobby3d/village-decor";
import { buildPathOutlines, insetLoop, type PathPoint } from "@/lib/lobby3d/village-paths";
import type { DaylightState } from "./lobby3d-daylight";
import { SEASON_COLORS } from "./lobby3d-outdoor";

// 바깥 마을 그리기. 풀밭·하늘·길(코드로 짓고 풀밭은 계절·하루의 때를 따른다. 길은 칸 모양의 경계를 둥글게 다듬어 짓는다)과, Kenney 키트로 조립한 마을 모델(lobby-village.glb: 건물·소품·풍차·나무 틀)을 그린다.
// 땅에는 큰 얼룩과 여러 풀 자국 무늬를 흩고, 3D 꽃·풀 장식(village-flowers.glb)을 무리 지어 심으며, 길에 흙 무늬를 입힌다(VillageGround. 그림·모델을 못 불러오면 빼고 그린다).
// 나무는 모델의 나무 틀을 마을 나무 자리와 둘레 숲에 여러 그루 찍고(인스턴스), 잎을 계절 색으로 칠한다.
// 모델을 불러오지 못하면 풀밭·길·하늘만 보인다(길은 배치 파일에서 코드로 짓는다. 걸어갈 수 없는 곳은 village.ts 데이터대로 막는다).
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
  paths: Paths;
  setSeason(season: Season): void;
  dispose(): void;
}

/** 길 색(흙). 마을 모델의 옛 Kenney 길 조각 윗면 색(#dcbd8e)과 같다. 흙 무늬 그림을 불러오면 그림이 색을 내고 재질 색은 흰색이 된다. */
const PATH_COLOR = 0xdcbd8e;
/** 길 가장자리에서 흙이 풀로 바래는 폭(경계 안팎으로 이만큼씩, 칸). */
const PATH_FADE = 0.25;
/** 흙 무늬 그림 한 장이 덮는 칸 수(가로·세로). */
const DIRT_TILE = 3;

/** 경계 고리들로 땅 위에 눕힌 판 하나를 짓는다(마을 x, z → 판 x, -y. 눕히면 다시 x, z). uv는 판 좌표 그대로(x, -z)다. */
function flatShapeGeometry(outlines: { outer: readonly PathPoint[]; holes: readonly (readonly PathPoint[])[] }[]): THREE.BufferGeometry {
  const shapes = outlines.map((o) => {
    const shape = new THREE.Shape(o.outer.map(([x, z]) => new THREE.Vector2(x, -z)));
    shape.holes = o.holes.map((h) => new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
    return shape;
  });
  const geometry = new THREE.ShapeGeometry(shapes);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

/** 두 고리(같은 점 수: 안쪽 선 a는 불투명, 바깥 선 b는 투명) 사이를 잇는 띠. 꼭짓점 알파로 흙이 풀로 바랜다. uv는 판과 같게 (x, -z)다. */
function fadeBandGeometry(loops: [readonly PathPoint[], readonly PathPoint[]][]): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const col: number[] = [];
  const index: number[] = [];
  for (const [a, b] of loops) {
    const base = pos.length / 3;
    const n = a.length;
    for (let i = 0; i < n; i += 1) {
      for (const [p, alpha] of [
        [a[i], 1],
        [b[i], 0]
      ] as const) {
        pos.push(p[0], 0, p[1]);
        uv.push(p[0], -p[1]);
        col.push(1, 1, 1, alpha);
      }
    }
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      const ai = base + i * 2;
      const bi = ai + 1;
      const aj = base + j * 2;
      const bj = aj + 1;
      // 위(+y)를 보는 면: 이 파일의 고리 방향(길이 진행 방향의 오른쪽)에서 안쪽 선 a, 바깥 선 b 순서
      index.push(ai, bi, aj, aj, bi, bj);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

interface Paths {
  group: THREE.Group;
  /** 흙 무늬를 입힐 재질(안쪽 흙, 바래는 띠). */
  materials: THREE.MeshLambertMaterial[];
  dispose(): void;
}

/** 둥근 길(안쪽 흙과 풀로 바래는 가장자리 띠). 칸 배치는 village-layout.json의 길 사각형을 따른다. */
function buildPaths(): Paths {
  const group = new THREE.Group();
  const outlines = buildPathOutlines(VILLAGE_PATH_RECTS);
  const loops = outlines.flatMap((o) => [o.outer, ...o.holes]);
  const inner = outlines.map((o) => ({ outer: insetLoop(o.outer, PATH_FADE), holes: o.holes.map((h) => insetLoop(h, PATH_FADE)) }));
  const fillMat = new THREE.MeshLambertMaterial({ color: PATH_COLOR });
  // 띠는 양면으로 그려 고리 방향과 관계없이 위에서 보인다
  const fadeMat = new THREE.MeshLambertMaterial({ color: PATH_COLOR, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const fill = new THREE.Mesh(flatShapeGeometry(inner), fillMat);
  const fade = new THREE.Mesh(fadeBandGeometry(loops.map((l) => [insetLoop(l, PATH_FADE), insetLoop(l, -PATH_FADE)])), fadeMat);
  // 풀밭(-0.02)과 풀 자국 위, 바래는 띠 위에 안쪽 흙을 조금씩 띄워 겹친 면이 깜빡이지 않게 한다
  fade.position.y = 0.004;
  fill.position.y = 0.008;
  for (const m of [fade, fill]) {
    m.raycast = () => {};
    group.add(m);
  }
  group.name = "village-paths";
  return {
    group,
    materials: [fillMat, fadeMat],
    dispose() {
      fill.geometry.dispose();
      fade.geometry.dispose();
      fillMat.dispose();
      fadeMat.dispose();
    }
  };
}

/** 풀밭(마을 안팎)과 둥근 길. 풀밭은 계절 색을 따른다. */
function buildNature(): Nature {
  const group = new THREE.Group();
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x8cc76a });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(VILLAGE.width + FOREST_MARGIN * 6, VILLAGE.depth + FOREST_MARGIN * 6), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(VILLAGE.width / 2, -0.02, VILLAGE.depth / 2);
  ground.raycast = () => {};
  group.add(ground);
  const paths = buildPaths();
  group.add(paths.group);
  let shownSeason: Season | null = null;
  return {
    group,
    paths,
    setSeason(season) {
      if (season === shownSeason) return;
      shownSeason = season;
      // 색 값(16진)은 화면 색이고, set이 알아서 선형 색으로 바꾼다
      groundMat.color.set(SEASON_COLORS[season].ground);
    },
    dispose() {
      ground.geometry.dispose();
      groundMat.dispose();
      paths.dispose();
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
      <Suspense fallback={null}>
        <VillageGroundErrorBoundary>
          <VillageGround daylight={daylight} pathMaterials={nature.paths.materials} />
        </VillageGroundErrorBoundary>
      </Suspense>
    </>
  );
}

// 땅 그림과 장식 모델(앱 번들 자산). 쓰는 때에 불러온다: 모듈을 읽을 때 불러오지 않아, 이 자산을 모르는 화면·테스트에서도 마을 그리기 모듈을 읽을 수 있다.
const GRASS_MARKS_TEXTURE = "grass-marks";
const DIRT_TEXTURE = "dirt";
function groundAsset(name: "grass-marks" | "dirt" | "flowers"): unknown {
  /* eslint-disable @typescript-eslint/no-require-imports */
  if (name === GRASS_MARKS_TEXTURE) return require("../../../assets/textures/village/grass-marks.png");
  if (name === DIRT_TEXTURE) return require("../../../assets/textures/village/dirt.jpg");
  return require("../../../assets/models/village-flowers.glb");
  /* eslint-enable @typescript-eslint/no-require-imports */
}

/** 장식 종류 → 모델 안 메시 이름. */
const DECOR_MESH: Record<VillageDecorKind, string> = {
  flowerWhite: "flower-white",
  flowerYellow: "flower-yellow",
  flowerPink: "flower-pink",
  flowerRed: "flower-red",
  clover: "clover",
  grassTuft: "grass-tuft"
};
/** 풀 자국 높이(풀밭 -0.02 위, 길 띠 아래). */
const MARK_Y = -0.016;
/** 큰 얼룩 높이와 수, 세기(밝게·어둡게 섞는 불투명도). */
const PATCH_Y = -0.018;
const PATCH_COUNT = 70;
const PATCH_OPACITY = 0.16;

/** 가운데가 진하고 가장자리로 바래는 둥근 얼룩 그림(코드로 만든다). */
function patchTexture(): THREE.DataTexture {
  const n = 64;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      const d = Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2);
      const i = (y * n + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(Math.max(0, 1 - d) ** 1.6 * 255);
    }
  }
  const tex = new THREE.DataTexture(data, n, n);
  tex.needsUpdate = true;
  return tex;
}

interface VillageGroundProps {
  daylight: DaylightState;
  /** 흙 무늬를 입힐 길 재질. */
  pathMaterials: THREE.MeshLambertMaterial[];
}

/**
 * 땅 꾸밈: 큰 얼룩(밝고 어두운 풀), 풀 자국(그림 모음의 무늬 16가지를 자리마다 다르게, 인스턴스), 3D 꽃·풀 장식(종류마다 인스턴스), 길의 흙 무늬.
 * 자국은 계절 풀밭 색을 따르고, 겨울에는 자국과 장식을 숨긴다(눈). 모두 누르기 대상이 아니고 걷기를 막지 않는다.
 */
function VillageGround({ daylight, pathMaterials }: VillageGroundProps) {
  const [marksTexture, dirtTexture] = useLoader(THREE.TextureLoader, [groundAsset("grass-marks"), groundAsset("dirt")] as string[]) as THREE.Texture[];
  const flowers = useLoader(GLTFLoader, groundAsset("flowers") as string) as GLTF;
  const built = useMemo(() => {
    const root = new THREE.Group();
    root.name = "village-ground";
    const owned: { dispose(): void }[] = [];
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    // 큰 얼룩: 밝은 얼룩과 어두운 얼룩을 섞어 풀밭 색을 넓게 흔든다
    const patchTex = patchTexture();
    const patchGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const patchMats = [0xffffff, 0x000000].map((c) => new THREE.MeshBasicMaterial({ color: c, map: patchTex, transparent: true, opacity: PATCH_OPACITY, depthWrite: false }));
    owned.push(patchTex, patchGeo, ...patchMats);
    const rnd = seeded(31);
    patchMats.forEach((mat, which) => {
      const count = PATCH_COUNT / 2;
      const mesh = new THREE.InstancedMesh(patchGeo, mat, count);
      for (let i = 0; i < count; i += 1) {
        const size = 6 + rnd() * 10;
        m4.compose(new THREE.Vector3(rnd() * VILLAGE.width, PATCH_Y + which * 0.0005, rnd() * VILLAGE.depth), q.identity(), new THREE.Vector3(size, 1, size * (0.6 + rnd() * 0.8)));
        mesh.setMatrixAt(i, m4);
      }
      mesh.raycast = () => {};
      root.add(mesh);
    });
    // 풀 자국: 그림 모음(4×4)의 칸마다 판 하나, 그 칸을 쓰는 자국 자리에 찍는다
    marksTexture.colorSpace = THREE.SRGBColorSpace;
    const markMat = new THREE.MeshLambertMaterial({ map: marksTexture, alphaTest: 0.4 });
    owned.push(markMat);
    const marks = villageGrassMarks();
    const markMeshes: THREE.InstancedMesh[] = [];
    const shade = new THREE.Color();
    for (let kind = 0; kind < GRASS_MARK_KINDS; kind += 1) {
      const mine = marks.filter((m) => m.kind === kind);
      if (mine.length === 0) continue;
      const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
      // 이 무늬의 그림 칸으로 uv를 옮긴다(그림 맨 위 줄이 0~3번)
      const col = kind % 4;
      const row = Math.floor(kind / 4);
      const uv = geo.getAttribute("uv");
      for (let i = 0; i < uv.count; i += 1) uv.setXY(i, (col + uv.getX(i)) / 4, (3 - row + uv.getY(i)) / 4);
      owned.push(geo);
      const mesh = new THREE.InstancedMesh(geo, markMat, mine.length);
      mine.forEach((m, i) => {
        q.setFromAxisAngle(up, m.turn);
        m4.compose(new THREE.Vector3(m.x, MARK_Y, m.z), q, new THREE.Vector3(m.size, 1, m.size));
        mesh.setMatrixAt(i, m4);
        mesh.setColorAt(i, shade.setScalar(m.shade));
      });
      mesh.raycast = () => {};
      markMeshes.push(mesh);
      root.add(mesh);
    }
    // 3D 꽃·풀 장식: 종류마다 모델 메시 하나를 인스턴스로 찍는다
    const decor = villageDecorSpots();
    const decorMeshes: THREE.InstancedMesh[] = [];
    for (const kind of Object.keys(DECOR_MESH) as VillageDecorKind[]) {
      const mine = decor.filter((d) => d.kind === kind);
      let source: THREE.Mesh | null = null;
      flowers.scene.getObjectByName(DECOR_MESH[kind])?.traverse((o) => {
        if (!source && o instanceof THREE.Mesh) source = o;
      });
      if (!source || mine.length === 0) continue;
      const src = source as THREE.Mesh;
      const mat = new THREE.MeshLambertMaterial({ vertexColors: src.geometry.hasAttribute("color") });
      owned.push(mat);
      const mesh = new THREE.InstancedMesh(src.geometry, mat, mine.length);
      mine.forEach((d, i) => {
        q.setFromAxisAngle(up, d.turn);
        m4.compose(new THREE.Vector3(d.x, 0, d.z), q, new THREE.Vector3(d.scale, d.scale, d.scale));
        mesh.setMatrixAt(i, m4);
      });
      mesh.raycast = () => {};
      decorMeshes.push(mesh);
      root.add(mesh);
    }
    return { root, markMat, patchMats, markMeshes, decorMeshes, owned, season: { shown: null as Season | null } };
  }, [marksTexture, flowers]);

  useEffect(() => {
    // 길에 흙 무늬를 입힌다(한 장이 DIRT_TILE칸을 덮게 되풀이)
    dirtTexture.colorSpace = THREE.SRGBColorSpace;
    dirtTexture.wrapS = THREE.RepeatWrapping;
    dirtTexture.wrapT = THREE.RepeatWrapping;
    dirtTexture.repeat.set(1 / DIRT_TILE, 1 / DIRT_TILE);
    dirtTexture.needsUpdate = true;
    for (const m of pathMaterials) {
      m.map = dirtTexture;
      m.color.set(0xffffff);
      m.needsUpdate = true;
    }
    return () => {
      for (const m of pathMaterials) {
        m.map = null;
        m.color.set(PATH_COLOR);
        m.needsUpdate = true;
      }
    };
  }, [dirtTexture, pathMaterials]);

  useEffect(() => () => built.owned.forEach((o) => o.dispose()), [built]);

  useFrame(() => {
    const season = daylight.target.season;
    if (built.season.shown === season) return;
    built.season.shown = season;
    const winter = season === "winter";
    // 자국은 계절 풀밭 색을 따르고(그림의 흰·회색이 풀밭보다 조금 밝고 어두운 자국이 된다), 겨울에는 자국과 장식을 숨긴다
    built.markMat.color.set(SEASON_COLORS[season].ground);
    for (const m of built.markMeshes) m.visible = !winter;
    for (const m of built.decorMeshes) m.visible = !winter;
    built.patchMats[1].opacity = winter ? PATCH_OPACITY / 3 : PATCH_OPACITY;
  });

  // eslint-disable-next-line react/no-unknown-property
  return <primitive object={built.root} />;
}

/** 땅 그림·장식 모델을 불러오지 못하면 땅 꾸밈만 빼고 그린다(풀밭·길·마을은 그대로). 오류는 개발 콘솔에 남긴다. */
class VillageGroundErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("[lobby3d] 마을 땅 그림·장식을 불러오지 못했습니다", error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
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
      if (name.startsWith("paths")) {
        // 옛 Kenney 길 조각은 그리지 않는다(길은 VillageNature가 둥글게 짓는다)
        o.visible = false;
        o.raycast = () => {};
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
export class VillageModelErrorBoundary extends Component<{ children: ReactNode; onFailed?: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("[lobby3d] 마을 모델을 불러오지 못했습니다", error);
    // 읽기 캐시에 남은 오류를 지운다(다음에 '나가기'를 누르면 다시 읽는다)
    useLoader.clear(GLTFLoader, VILLAGE_ASSET as string);
    this.props.onFailed?.();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
