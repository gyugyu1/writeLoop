// [spec] qa 테스트(작업 113, 기능 변경: 새 나무 모델 넣기, 모바일) — 방 창밖 풍경(lobby3d-outdoor의 createOutdoor)의 나무.
// 기대값은 명세(private 작업 폴더 113-2026-11-18-새-나무-모델-넣기/01-main-spec.md)에서만 가져온다.
// 모든 테스트가 "바뀔 동작"이다(고치기 전에는 실패해야 한다). 03-qa-tests.md의 분류와 같다.
//
// 명세 바뀌는 동작:
//   7. 창밖 나무(지금 코드로 지은 둥근 나무·소나무: 가까운 줄 약 9그루, 먼 줄 약 12그루)를 새 모델 LOD2로 바꾼다.
//      종류는 A·B·C를 고르게(늘 같은 결과), 자리는 지금 규칙(가까운 줄·먼 줄, 창 정면 가운데 비우기), 크기는 대략 s × 1.4배(s = 지금 배율).
//   8. 계절 칸을 따른다(겨울: 잎 숨김, 줄기 눈). 지금의 겨울 가지·소나무 눈 덮개와 잎 계절 색은 없앤다.
//   9. 잎은 지금처럼 바람에 살짝 흔들린다(그루마다 위상이 다른 작은 흔들림).
//  11. 마을과 방(창밖)에서 함께 쓴다.  12. 나무 모델을 읽지 못하면 나무만 빼고 그리고, 화면이 멈추지 않게 한다.
// 명세 "새 나무 모델": 잎 UV는 봄 칸에 있고 계절마다 glTF UV에 더하는 값은 봄 (0, 0), 여름 (0.5, 0), 가을 (0, 0.5), 겨울 (0.5, 0.5).
//   줄기 그림은 겨울에만 (0.5, 0)을 더한다. 원점은 줄기 밑 가운데, 바닥은 y = 0. 높이 A 2.60, B 2.45, C 3.10.
//
// 지금 규칙(고치기 전 코드 lobby3d-outdoor.ts에서 읽은 자리 식, 명세 7 "자리는 지금 규칙 그대로"):
//   가까운 줄 i = 0..8: x = c - 10 + 2.5i + (r - 0.5)·1.2, |x - c| < 2이면 심지 않음, z = -10 - 3r, s = 0.9 + 0.4r
//   먼 줄 i = 0..11: x = c - 18 + 3.2i + (r - 0.5)·1.5, z = -20 - 8r, s = 1.4 + 0.5r   (r은 0 이상 1 미만의 난수, c는 창 가운데 x)
//   그래서 가까운 줄은 z ∈ [-13, -10], x ∈ [c - 10.6, c + 10.6], 6~8그루. 먼 줄은 z ∈ [-28, -20], x ∈ [c - 18.75, c + 18.95], 12그루.
//   새 배율은 s × 1.4: 가까운 줄 1.26~1.82, 먼 줄 1.96~2.66. 명세가 "대략"이라 위아래로 5%를 더 둔다(아래 SCALE_SLACK).
//
// 어떻게 보나(구현 전이라 구현 이름을 모른다. 가정은 03-qa-tests.md에 적었다):
// - 새 나무 모델은 createOutdoor의 세 번째 인자로 A·B·C LOD2 순서의 GLTF 배열을 준다고 가정했다(build 한 곳에서만 부른다).
//   나무 모델이 없으면(읽기 실패) 세 번째 인자 없이 부른다.
// - 나무 모델은 명세의 모양을 본뜬 가짜다(메시 Tree_Foliage 재질 Foliage, Tree_Wood 재질 Bark, 각자 그림 하나). 장면에서 그 잎·줄기 그림
//   (그림 파일 이름 image.data.localUri로 가린다)을 쓰는 물체를 새 나무의 잎·줄기로 보고, 모양의 높이로 종류(A·B·C)를 가린다. 인스턴스 메시면 인스턴스마다 한 그루로 본다.
// - "계절 칸을 그린다"는 그 물체가 쓰는 그림 좌표(모양의 uv에 재질 그림의 변환 행렬을 곱한 값)가 원본 uv에 명세의 값을 더한 것과 같은 것으로 본다.
// - "잎을 숨긴다"는 잎 물체(또는 그 위 묶음)가 보이지 않거나 인스턴스가 0개인 것으로 본다.
// - "흔들린다"는 update(시각) 뒤 잎의 위쪽 축이 수직에서 기운 각도로 본다. "작은"은 지금 둥근 나무 흔들림의 가장 큰 기울기
//   (rotation.z 0.035, rotation.x 0.021 → 약 0.041 라디안)를 넘지 않는 0.05 라디안 이하로 보았다.
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createOutdoor, type Outdoor } from "@/components/lobby3d/lobby3d-outdoor";
import type { Ambience, Season } from "@/lib/lobby3d/daylight";

jest.mock("three", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const nodePath = (process as unknown as { getBuiltinModule: (id: string) => typeof import("path") }).getBuiltinModule("path");
  const file = nodePath.join(nodePath.dirname(require.resolve("three")), "three.module.js");
  return nodeModule.createRequire(file)(file);
});
jest.mock("three/examples/jsm/utils/BufferGeometryUtils.js", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const nodePath = (process as unknown as { getBuiltinModule: (id: string) => typeof import("path") }).getBuiltinModule("path");
  const file = nodePath.join(nodePath.dirname(require.resolve("three")), "..", "examples", "jsm", "utils", "BufferGeometryUtils.js");
  return nodeModule.createRequire(file)(file);
});

// ---------- 가짜 새 나무 모델 ----------

type Kind = "A" | "B" | "C";
const TREE_KINDS: readonly { kind: Kind; height: number; width: number }[] = [
  { kind: "A", height: 2.6, width: 1.46 },
  { kind: "B", height: 2.45, width: 1.57 },
  { kind: "C", height: 3.1, width: 1.34 }
];
/** 가짜 줄기 높이 = 나무 높이 × 이 값(잎과 줄기 모양을 높이로 가린다). */
const WOOD_RATIO = 0.55;

function quads(corners: readonly (readonly [number, number, number])[][], uvs: readonly (readonly [number, number])[][], normals: readonly (readonly [number, number, number])[]) {
  const position: number[] = [];
  const normal: number[] = [];
  const uv: number[] = [];
  corners.forEach((quad, q) => {
    for (const k of [0, 1, 2, 0, 2, 3]) {
      position.push(...quad[k]);
      normal.push(...normals[q]);
      uv.push(...uvs[q][k]);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(normal, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

interface FakeTrees {
  /** A·B·C LOD2 순서 */
  models: GLTF[];
  /** 잎·줄기 그림의 파일 이름(image.data.localUri) */
  foliageImages: Set<string>;
  barkImages: Set<string>;
  /** 종류마다 원본 uv(만들 때 복사해 둔 값) */
  foliageUv: Record<Kind, number[]>;
  woodUv: Record<Kind, number[]>;
}

function fakeTreeModels(): FakeTrees {
  // 명세: 잎 그림은 같은 단계끼리 A·B·C가 같은 그림, 줄기 그림은 A·B가 같고 C는 다르다.
  // 그림은 앱의 그림 읽기(texture-file-loader)가 두는 모양({ data: { localUri }, width, height })을 따르고, 같은 그림이면 같은 파일 이름이다.
  // 모델(GLB)마다 그림 객체는 따로다(파일마다 따로 푼다).
  const image = (name: string) => ({ data: { localUri: `file:///cache/model-image-${name}.png` }, width: 2, height: 2 });
  const FOLIAGE = "qa113-foliage-LOD2";
  const BARK_AB = "qa113-bark-AB-LOD2";
  const BARK_C = "qa113-bark-C-LOD2";
  const foliageUv = {} as Record<Kind, number[]>;
  const woodUv = {} as Record<Kind, number[]>;
  const models = TREE_KINDS.map(({ kind, height, width }, i) => {
    const w = width / 2;
    const d = 0.01 * i;
    // 잎: 봄 칸(u, v 모두 0~0.5) 안의 uv
    const foliageGeometry = quads(
      [
        [[-w, 0.9, 0], [w, 0.9, 0], [w, height, 0], [-w, height, 0]],
        [[0, 0.9, -w], [0, 0.9, w], [0, height, w], [0, height, -w]]
      ],
      [
        [[0.02 + d, 0.04], [0.46 - d, 0.04], [0.46 - d, 0.44], [0.02 + d, 0.44]],
        [[0.06 + d, 0.08], [0.42 - d, 0.08], [0.42 - d, 0.4], [0.06 + d, 0.4]]
      ],
      [[0, 0, 1], [1, 0, 0]]
    );
    // 줄기: 평소 칸(u 0~0.5) 안의 uv
    const woodGeometry = quads(
      [[[-0.08, 0, 0], [0.08, 0, 0], [0.08, height * WOOD_RATIO, 0], [-0.08, height * WOOD_RATIO, 0]]],
      [[[0.05 + d, 0.1], [0.45 - d, 0.1], [0.45 - d, 0.9], [0.05 + d, 0.9]]],
      [[0, 0, 1]]
    );
    foliageUv[kind] = Array.from(foliageGeometry.attributes.uv.array as ArrayLike<number>);
    woodUv[kind] = Array.from(woodGeometry.attributes.uv.array as ArrayLike<number>);
    const foliageMap = new THREE.Texture(image(FOLIAGE) as never);
    foliageMap.flipY = false;
    const woodMap = new THREE.Texture(image(kind === "C" ? BARK_C : BARK_AB) as never);
    woodMap.flipY = false;
    const foliage = new THREE.Mesh(foliageGeometry, new THREE.MeshStandardMaterial({ name: "Foliage", map: foliageMap, alphaTest: 0.5, side: THREE.DoubleSide }));
    foliage.name = "Tree_Foliage";
    const wood = new THREE.Mesh(woodGeometry, new THREE.MeshStandardMaterial({ name: "Bark", map: woodMap }));
    wood.name = "Tree_Wood";
    const scene = new THREE.Group();
    scene.name = "Scene";
    scene.add(foliage, wood);
    return { scene, scenes: [scene], animations: [], cameras: [], asset: { version: "2.0" }, parser: {}, userData: {} } as unknown as GLTF;
  });
  return { models, foliageImages: new Set([image(FOLIAGE).data.localUri]), barkImages: new Set([image(BARK_AB).data.localUri, image(BARK_C).data.localUri]), foliageUv, woodUv };
}

let TREES: FakeTrees;
beforeEach(() => {
  TREES = fakeTreeModels();
});

/** 창밖 장면을 짓는다(가정한 부르는 법: 세 번째 인자로 A·B·C LOD2 모델). trees가 null이면 나무 모델 없이(읽기 실패) 짓는다. */
function build(centerX: number, groundY: number, trees: GLTF[] | null = TREES.models): Outdoor {
  return trees ? createOutdoor(centerX, groundY, trees) : createOutdoor(centerX, groundY);
}

// ---------- 하루의 때 ----------

const AMBIENCE_DAY: Ambience = {
  roomTint: 0xffffff,
  ambientColor: 0xffffff,
  ambientIntensity: 1.35,
  sunColor: 0xffffff,
  sunIntensity: 1.6,
  windowColor: 0xfff2d6,
  windowStrength: 0.5,
  skyTop: 0x76b8ea,
  skyHorizon: 0xd4ecf6,
  outdoorSunColor: 0xfff0d8,
  outdoorSunIntensity: 1.7,
  outdoorHemiIntensity: 1.5,
  stars: 0
};
const paint = (outdoor: Outdoor, season: Season) => outdoor.setDaylight(AMBIENCE_DAY, season, "day");

/** 명세 "새 나무 모델": 계절마다 glTF UV에 더하는 값. */
const FOLIAGE_OFFSET: Record<Season, [number, number]> = { spring: [0, 0], summer: [0.5, 0], autumn: [0, 0.5], winter: [0.5, 0.5] };
const woodOffset = (season: Season): [number, number] => (season === "winter" ? [0.5, 0] : [0, 0]);

// ---------- 장면에서 나무 찾기 ----------

type Part = "foliage" | "wood";
interface TreePart {
  part: Part;
  kind: Kind | null;
  mesh: THREE.Mesh;
  /** 장면 기준 행렬(인스턴스면 인스턴스 행렬까지 곱한 것) */
  matrix: THREE.Matrix4;
  /** 물체와 그 위 묶음이 모두 보인다 */
  shown: boolean;
}

const materialsOf = (o: THREE.Object3D): THREE.Material[] => {
  const m = (o as THREE.Mesh).material;
  return m ? (Array.isArray(m) ? m : [m]) : [];
};

function partOf(mesh: THREE.Mesh): Part | null {
  for (const m of materialsOf(mesh)) {
    const uri = ((m as THREE.MeshStandardMaterial).map?.image as { data?: { localUri?: string } } | undefined)?.data?.localUri ?? "";
    if (TREES.foliageImages.has(uri)) return "foliage";
    if (TREES.barkImages.has(uri)) return "wood";
  }
  return null;
}

function maxY(g: THREE.BufferGeometry): number {
  const p = g.attributes.position;
  let y = -Infinity;
  for (let i = 0; i < p.count; i += 1) y = Math.max(y, p.getY(i));
  return y;
}

function kindOf(mesh: THREE.Mesh, part: Part): Kind | null {
  const top = maxY(mesh.geometry as THREE.BufferGeometry);
  const found = TREE_KINDS.find(({ height }) => Math.abs(top - (part === "foliage" ? height : height * WOOD_RATIO)) < 1e-4);
  return found ? found.kind : null;
}

function shownInScene(o: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) {
    if (!p.visible) return false;
    if (p === root) return true;
  }
  return true;
}

function treeParts(outdoor: Outdoor): TreePart[] {
  const root = outdoor.scene;
  root.updateMatrixWorld(true);
  const toScene = root.matrixWorld.clone().invert();
  const parts: TreePart[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const part = partOf(mesh);
    if (!part) return;
    const base = toScene.clone().multiply(mesh.matrixWorld);
    const kind = kindOf(mesh, part);
    const shown = shownInScene(mesh, root);
    const instanced = mesh as THREE.InstancedMesh;
    if (instanced.isInstancedMesh) {
      for (let i = 0; i < instanced.count; i += 1) {
        const m = new THREE.Matrix4();
        instanced.getMatrixAt(i, m);
        parts.push({ part, kind, mesh, matrix: base.clone().multiply(m), shown });
      }
    } else {
      parts.push({ part, kind, mesh, matrix: base, shown });
    }
  });
  return parts;
}

interface Tree {
  kind: Kind | null;
  x: number;
  y: number;
  z: number;
  /** 줄기 행렬의 세 축 길이 */
  scale: [number, number, number];
  wood: TreePart;
  foliage: TreePart | undefined;
}

const translation = (m: THREE.Matrix4) => new THREE.Vector3().setFromMatrixPosition(m);
const axisLengths = (m: THREE.Matrix4): [number, number, number] => [0, 1, 2].map((i) => new THREE.Vector3().setFromMatrixColumn(m, i).length()) as [number, number, number];

/** 줄기마다 한 그루. 같은 종류이고 가로 자리(x, z)가 0.05칸 안인 잎을 짝으로 붙인다. */
function treesIn(outdoor: Outdoor): Tree[] {
  const parts = treeParts(outdoor);
  const foliage = parts.filter((p) => p.part === "foliage");
  return parts
    .filter((p) => p.part === "wood")
    .map((wood) => {
      const at = translation(wood.matrix);
      const near = foliage
        .filter((f) => f.kind === wood.kind)
        .map((f) => ({ f, d: Math.hypot(translation(f.matrix).x - at.x, translation(f.matrix).z - at.z) }))
        .filter(({ d }) => d <= 0.05)
        .sort((a, b) => a.d - b.d)[0];
      return { kind: wood.kind, x: at.x, y: at.y, z: at.z, scale: axisLengths(wood.matrix), wood, foliage: near?.f };
    });
}

type Row = "near" | "far" | "none";
function rowOf(tree: Tree, centerX: number): Row {
  const e = 1e-9;
  if (tree.z <= -10 + e && tree.z >= -13 - e && tree.x >= centerX - 10.6 - e && tree.x <= centerX + 10.6 + e && Math.abs(tree.x - centerX) >= 2 - e) return "near";
  if (tree.z <= -20 + e && tree.z >= -28 - e && tree.x >= centerX - 18.75 - e && tree.x <= centerX + 18.95 + e) return "far";
  return "none";
}

/** 그림 좌표(모양의 uv × 재질 그림의 변환 행렬)를 반올림한 글자 모음. */
function effectiveUvs(mesh: THREE.Mesh): string[] {
  const material = materialsOf(mesh).find((m) => (m as THREE.MeshStandardMaterial).map) as THREE.MeshStandardMaterial;
  const map = material.map as THREE.Texture;
  if (map.matrixAutoUpdate) map.updateMatrix();
  const uv = (mesh.geometry as THREE.BufferGeometry).attributes.uv;
  const v = new THREE.Vector2();
  const out = new Set<string>();
  for (let i = 0; i < uv.count; i += 1) {
    v.fromBufferAttribute(uv as THREE.BufferAttribute, i).applyMatrix3(map.matrix);
    out.add(uvKey(v.x, v.y));
  }
  return [...out].sort();
}
const round = (n: number) => {
  const r = Math.round(n * 1e5) / 1e5;
  return r === 0 ? 0 : r;
};
const uvKey = (u: number, v: number) => `${round(u)},${round(v)}`;
function shiftedUvs(source: number[], [du, dv]: [number, number]): string[] {
  const out = new Set<string>();
  for (let i = 0; i < source.length; i += 2) out.add(uvKey(source[i] + du, source[i + 1] + dv));
  return [...out].sort();
}

/** 고치기 전 코드의 나무 흔적: 원기둥·원뿔 모양, 줄기(0x8d5f3f)·겨울 가지(0x7a5a42)·눈 덮개(0xf4f7fa) 색 재질. */
function oldTreeTraces(outdoor: Outdoor): string[] {
  const traces: string[] = [];
  outdoor.scene.traverse((o) => {
    const geometry = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
    if (geometry && (geometry.type === "CylinderGeometry" || geometry.type === "ConeGeometry")) traces.push(`${geometry.type}`);
    for (const m of materialsOf(o)) {
      const color = (m as THREE.MeshLambertMaterial).color;
      if (color instanceof THREE.Color && [0x8d5f3f, 0x7a5a42, 0xf4f7fa].includes(color.getHex())) traces.push(`color ${color.getHexString()}`);
    }
  });
  return traces;
}

/** 고치기 전 코드가 창밖 나무에 칠하던 계절 색(lobby3d-outdoor.ts SEASON_COLORS의 leaves 넷과 pine). 명세 8로 없앤다. */
const OLD_TREE_SEASON_COLORS: Record<Season, number[]> = {
  spring: [0xf6b3ca, 0x93d16a, 0xf9c6d7, 0x80c65d, 0x4a9a5a],
  summer: [0x4f9d4c, 0x5aa850, 0x438f48, 0x63b057, 0x3a8650],
  autumn: [0xe8892e, 0xd65a30, 0xe9b83a, 0xc9752a, 0x3f7f4f],
  winter: [0xeef3f6, 0xeef3f6, 0xeef3f6, 0xeef3f6, 0x3d7a55]
};

const SCALE_SLACK = 0.05;
const NEAR_SCALE = [0.9 * 1.4 * (1 - SCALE_SLACK), 1.3 * 1.4 * (1 + SCALE_SLACK)] as const;
const FAR_SCALE = [1.4 * 1.4 * (1 - SCALE_SLACK), 1.9 * 1.4 * (1 + SCALE_SLACK)] as const;

// ---------- 테스트 ----------

describe("[spec] 창밖 나무는 새 나무 모델 LOD2로 그린다(113 명세 바뀌는 동작 7·8·9·11·12)", () => {
  test.each([
    [0, 0],
    [3.5, 1.2]
  ])("C-O1 createOutdoor(%p, %p): 나무는 새 모델(줄기와 같은 종류 잎이 짝)이고, 자리는 지금 규칙대로 가까운 줄 6~8그루·먼 줄 12그루다", (centerX, groundY) => {
    const outdoor = build(centerX, groundY);
    paint(outdoor, "summer");
    const trees = treesIn(outdoor);
    // 종류를 알 수 있고, 잎이 짝으로 붙었다
    expect(trees.filter((t) => t.kind === null)).toHaveLength(0);
    expect(trees.filter((t) => !t.foliage).map((t) => `${t.kind}@${t.x},${t.z}`)).toEqual([]);
    // 잎 수는 줄기 수와 같다(남는 잎이 없다)
    expect(treeParts(outdoor).filter((p) => p.part === "foliage")).toHaveLength(trees.length);
    // 바닥(y = 0)에 선다
    expect(trees.map((t) => round(t.y))).toEqual(trees.map(() => 0));
    // 줄마다 자리
    const rows = trees.map((t) => rowOf(t, centerX));
    expect(trees.filter((_, i) => rows[i] === "none").map((t) => `${t.x},${t.z}`)).toEqual([]);
    expect(rows.filter((r) => r === "far")).toHaveLength(12);
    const near = rows.filter((r) => r === "near").length;
    expect(near).toBeGreaterThanOrEqual(6);
    expect(near).toBeLessThanOrEqual(8);
    outdoor.dispose();
  });

  test("C-O2 종류는 A·B·C를 고르게 섞고(종류마다 전체의 20% 이상 50% 이하), 두 번 지어도 같은 자리에 같은 종류다", () => {
    const first = build(0, 0);
    const second = build(0, 0);
    const a = treesIn(first);
    const b = treesIn(second);
    const count = (kind: Kind) => a.filter((t) => t.kind === kind).length;
    for (const kind of ["A", "B", "C"] as const) {
      expect(count(kind)).toBeGreaterThanOrEqual(Math.ceil(a.length * 0.2));
      expect(count(kind)).toBeLessThanOrEqual(Math.floor(a.length * 0.5));
    }
    const list = (trees: Tree[]) => trees.map((t) => `${t.kind} ${round(t.x)},${round(t.z)} ${t.scale.map(round).join("/")}`).sort();
    expect(a.length).toBeGreaterThan(0);
    expect(list(b)).toEqual(list(a));
    first.dispose();
    second.dispose();
  });

  test("C-O3 크기는 지금 배율 s의 대략 1.4배(가까운 줄 1.26~1.82, 먼 줄 1.96~2.66에 위아래 5%)이고, 가로·세로·깊이가 같은 배율이다", () => {
    const outdoor = build(0, 0);
    paint(outdoor, "summer");
    const trees = treesIn(outdoor);
    expect(trees.length).toBeGreaterThan(0);
    for (const t of trees) {
      const [sx, sy, sz] = t.scale;
      expect(Math.abs(sx - sy)).toBeLessThan(1e-6);
      expect(Math.abs(sz - sy)).toBeLessThan(1e-6);
      const [low, high] = rowOf(t, 0) === "near" ? NEAR_SCALE : FAR_SCALE;
      expect(sy).toBeGreaterThanOrEqual(low);
      expect(sy).toBeLessThanOrEqual(high);
      // 잎도 같은 배율이다(같은 그루)
      const leaf = axisLengths(t.foliage!.matrix);
      expect(Math.abs(leaf[1] - sy)).toBeLessThan(1e-6);
    }
    outdoor.dispose();
  });

  test("C-O4 계절 칸: 잎은 그 계절 칸(봄 0,0 · 여름 0.5,0 · 가을 0,0.5)을 그리고 겨울에는 숨긴다. 줄기는 겨울에만 눈 칸(0.5,0)이고, 계절이 바뀌면 바로 따른다", () => {
    const outdoor = build(0, 0);
    const sequence: Season[] = ["summer", "winter", "autumn", "spring", "winter", "summer", "autumn"];
    for (const season of sequence) {
      paint(outdoor, season);
      const parts = treeParts(outdoor);
      const foliage = parts.filter((p) => p.part === "foliage");
      const wood = parts.filter((p) => p.part === "wood");
      // 줄기는 늘 보인다(겨울에도 가지가 남는다)
      expect(wood.length).toBeGreaterThan(0);
      expect(wood.filter((p) => !p.shown)).toHaveLength(0);
      for (const p of wood) expect([season, effectiveUvs(p.mesh)]).toEqual([season, shiftedUvs(TREES.woodUv[p.kind!], woodOffset(season))]);
      if (season === "winter") {
        expect([season, foliage.filter((p) => p.shown).length]).toEqual([season, 0]);
      } else {
        expect(foliage.filter((p) => p.shown)).toHaveLength(wood.length);
        for (const p of foliage) expect([season, effectiveUvs(p.mesh)]).toEqual([season, shiftedUvs(TREES.foliageUv[p.kind!], FOLIAGE_OFFSET[season])]);
      }
    }
    outdoor.dispose();
  });

  test("C-O5 잎 계절 색과 겨울 가지·소나무 눈 덮개가 없다: 잎 재질 색은 봄·여름·가을이 같고(겨울은 잎을 숨긴다), 장면에 옛 나무 모양·색(잎·소나무 계절 색, 줄기·가지·눈)이 없다", () => {
    const outdoor = build(0, 0);
    const leafColors: Record<string, string[]> = {};
    for (const season of ["spring", "summer", "autumn", "winter"] as const) {
      paint(outdoor, season);
      const parts = treeParts(outdoor);
      leafColors[season] = [
        ...new Set(parts.filter((p) => p.part === "foliage").flatMap((p) => materialsOf(p.mesh).map((m) => (m as THREE.MeshStandardMaterial).color.getHexString())))
      ].sort();
      // 옛 나무의 계절 색(잎 넷, 소나무)을 쓰는 재질이 없다
      const oldSeasonColors = OLD_TREE_SEASON_COLORS[season];
      const used: string[] = [];
      outdoor.scene.traverse((o) => {
        for (const m of materialsOf(o)) {
          const color = (m as THREE.MeshLambertMaterial).color;
          if (color instanceof THREE.Color && oldSeasonColors.includes(color.getHex())) used.push(`${o.type} ${color.getHexString()}`);
        }
      });
      expect([season, used]).toEqual([season, []]);
      expect([season, oldTreeTraces(outdoor)]).toEqual([season, []]);
    }
    expect(leafColors.spring.length).toBeGreaterThan(0);
    expect(leafColors.summer).toEqual(leafColors.spring);
    expect(leafColors.autumn).toEqual(leafColors.spring);
    outdoor.dispose();
  });

  test("C-O6 잎은 바람에 살짝(0.05 라디안 이하) 흔들리고, 시간에 따라 움직이며, 그루마다 위상이 다르다", () => {
    const outdoor = build(0, 0);
    paint(outdoor, "summer");
    const times = [1.25, 7.5, 12.3];
    // 그루마다, 시각마다 잎의 위쪽 축
    const ups: THREE.Vector3[][] = [];
    for (const t of times) {
      outdoor.update(t, 0.05);
      const trees = treesIn(outdoor);
      expect(trees.length).toBeGreaterThan(0);
      trees.forEach((tree, i) => {
        (ups[i] ??= []).push(new THREE.Vector3().setFromMatrixColumn(tree.foliage!.matrix, 1).normalize());
      });
    }
    const tilt = (up: THREE.Vector3) => Math.acos(THREE.MathUtils.clamp(up.y, -1, 1));
    ups.forEach((byTime, i) => {
      // 작은 흔들림
      for (const up of byTime) expect([i, tilt(up) <= 0.05]).toEqual([i, true]);
      // 움직인다: 어느 시각에는 기울어 있고, 시각마다 기울기가 다르다
      expect([i, Math.max(...byTime.map(tilt)) > 1e-4]).toEqual([i, true]);
      expect([i, byTime[0].distanceTo(byTime[1]) > 1e-7 && byTime[1].distanceTo(byTime[2]) > 1e-7]).toEqual([i, true]);
    });
    // 그루마다 위상이 다르다: 어느 두 그루도 세 시각의 기울기가 모두 같지 않다
    const same: string[] = [];
    for (let i = 0; i < ups.length; i += 1) {
      for (let j = i + 1; j < ups.length; j += 1) {
        if (times.every((_, k) => Math.abs(tilt(ups[i][k]) - tilt(ups[j][k])) <= 1e-6)) same.push(`${i}-${j}`);
      }
    }
    expect(same).toEqual([]);
    outdoor.dispose();
  });

  test("C-O7 나무 모델이 없으면(읽기 실패) 나무만 빼고 짓는다: 새 나무도 옛 나무도 없고, 나무 말고 물체는 나무가 있을 때와 같으며, 계절·시간·정리에도 멈추지 않는다", () => {
    const withTrees = build(0, 0);
    const without = build(0, 0, null);
    expect(treeParts(without)).toHaveLength(0);
    expect(oldTreeTraces(without)).toEqual([]);
    // 나무 말고 물체(새 나무 물체를 뺀 것)의 종류·이름 차례가 같다
    const nonTree = (outdoor: Outdoor) => {
      const out: string[] = [];
      outdoor.scene.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && partOf(o as THREE.Mesh)) return;
        if ((o as THREE.Mesh).isMesh || (o as THREE.Light).isLight || (o as THREE.Points).isPoints) out.push(`${o.type} ${o.name}`);
      });
      return out;
    };
    expect(nonTree(without)).toEqual(nonTree(withTrees));
    expect(() => {
      for (const season of ["spring", "summer", "autumn", "winter"] as const) paint(without, season);
      without.update(1.25, 0.016);
      without.update(7.5, 0.05);
      without.dispose();
    }).not.toThrow();
    withTrees.dispose();
  });

  test("C-O8 나무 모델을 함께 쓴다: 같은 모델로 창밖을 두 번 지어도 두 장면 모두 나무가 다 있고, 받은 모델의 잎·줄기 메시는 모델 안에 그대로 남는다", () => {
    const a = build(0, 0);
    const b = build(0, 0);
    paint(a, "summer");
    paint(b, "summer");
    const ta = treesIn(a);
    const tb = treesIn(b);
    expect(ta.length).toBeGreaterThan(0);
    expect(tb.length).toBe(ta.length);
    expect(tb.filter((t) => !t.foliage)).toHaveLength(0);
    for (const model of TREES.models) {
      expect(model.scene.children.map((c) => c.name)).toEqual(["Tree_Foliage", "Tree_Wood"]);
    }
    a.dispose();
    b.dispose();
  });
});
