// qa 테스트 도우미(작업 112 ③ 물체 합치기, 기능 변경, 모바일): 마을 모델의 재질 합치기와 계절 흩뿌림 한 메시를 볼 때 쓰는 장면·삼각형·인스턴스 칸 도우미.
// 이 파일은 테스트가 아니다(testMatch는 *.test.ts만 돈다). lobby3d-village-merge.spec.test.tsx, lobby3d-village-scatter-paths.spec.test.tsx(103 F1),
// lobby3d-village-round-paths.spec.test.tsx(099 K1·K2)가 함께 쓴다.
// 기대값은 명세(private 작업 폴더 112-2026-11-18-마을-그리기-JS-줄이기/04-물체-합치기/01-main-spec.md)에서만 가져온다.
//
// 관찰하는 방법(02-qa-tests.md "관찰하는 방법"):
// - sceneFromGlbFull: 진짜 마을 모델(lobby-village.glb)을 three.js GLTFLoader가 만드는 모양대로 푼 장면. village-scene-101.ts의 sceneFromGlb와 달리
//   법선(NORMAL)·그림 좌표(TEXCOORD_0)·정점색(COLOR_0, glb 그대로 Uint16 정규화 값)을 넣고, 그림은 GLTFLoader처럼 (그림 원본, 샘플러)가 같으면
//   같은 THREE.Texture 하나를 함께 쓴다(lobby-village.glb의 colormap 재질 18개는 모두 그림 원본 3, 샘플러 1이라 한 그림이다). 픽셀은 풀지 않는다.
// - 삼각형 비교: 메시의 삼각형마다 세 꼭짓점의 세계 자리(1e-4칸), 세계 법선(법선 행렬로 옮겨 정규화, 2e-3), 그림 좌표(1e-5), 정점색(1e-4, 알파가 없으면 1)을
//   모아 두 목록이 같은 삼각형을 같은 수만큼 갖는지 본다(꼭짓점 차례는 돌림만 허용해 감는 방향을 지킨다).
//   "재질 종류"(cls) = 그림 원본(Texture.source)의 uuid 또는 "none" + 정점색을 쓰는지. 합치기 전 메시는 앱이 지금 끼우는 재질(그림 = 모델 재질의 map,
//   정점색 = 도형에 color가 있는지)로, 그린 메시는 그 메시 재질의 map·vertexColors로 정한다.
// - 그린 메시가 어느 묶음의 것인지는 이름이 아니라 삼각형 자리로 정한다: 그 메시의 삼각형이 맞는 합치기 전 삼각형의 묶음(장면 뿌리 아래 이름: props, windmill 등).
// - 흩뿌림 메시의 인스턴스 칸(계약): 흩뿌림 메시 도형의 속성 가운데 THREE.InstancedBufferAttribute인 것(인스턴스마다 값이 하나)을 "칸 속성"이라 한다.
//   - 칸 속성이 없으면(지금 코드) 인스턴스는 모두 도형 uv(재질 그림의 offset·repeat·center를 더한 것, rotation 0)가 덮는 칸을 그린다(103 drawnCell과 같다).
//   - 크기 1이면 인스턴스 i의 값이 그 인스턴스가 그리는 칸 번호(0~15 정수, 그림 맨 위 줄이 0~3번).
//   - 크기 2면 인스턴스 i의 값 (du, dv)를 도형 uv(그림 변환을 더한 것)에 더한 범위가 그 인스턴스가 그리는 그림 범위다. 칸 번호는 그 범위로 103 drawnCell처럼 정한다
//     (flipY면 맨 위 줄이 v 0.75~1).
//   - 칸 속성이 둘 이상이거나 크기가 1·2가 아니면 칸을 정할 수 없다(이유 글을 돌려준다).
//   칸 속성을 셰이더가 쓰는지는 재질의 onBeforeCompile을 Lambert 셰이더 글로 불러, 고친 꼭짓점 셰이더 글에 그 이름의 attribute 선언과 쓰임이 있는지로 본다.
import * as THREE from "three";
import { accessorValues, sceneRoots, type Glb } from "./village-glb-098";

// ---------- 진짜 마을 모델(법선·그림 좌표·정점색 포함) ----------

function attributeOf(glb: Glb, accessorIndex: number, itemSize: number): THREE.BufferAttribute {
  const accessor = glb.json.accessors[accessorIndex] as { componentType: number; normalized?: boolean };
  const values = accessorValues(glb, accessorIndex).flat();
  if (accessor.componentType === 5126) return new THREE.Float32BufferAttribute(values, itemSize);
  const normalized = accessor.normalized === true;
  if (accessor.componentType === 5123) return new THREE.Uint16BufferAttribute(values, itemSize, normalized);
  if (accessor.componentType === 5121) return new THREE.Uint8BufferAttribute(values, itemSize, normalized);
  return new THREE.Float32BufferAttribute(values, itemSize);
}

/** 진짜 마을 모델(glb)을 GLTFLoader가 만드는 모양대로 장면으로(머리말). */
export function sceneFromGlbFull(glb: Glb): THREE.Group {
  const json = glb.json as Glb["json"] & { textures?: { source?: number; sampler?: number }[]; images?: { name?: string }[] };
  const textures = new Map<string, THREE.Texture>();
  const textureOf = (index: number): THREE.Texture => {
    const def = json.textures?.[index] ?? {};
    const key = `${def.source}:${def.sampler}`;
    let texture = textures.get(key);
    if (!texture) {
      texture = new THREE.Texture();
      texture.flipY = false;
      texture.name = json.images?.[def.source ?? -1]?.name ?? "";
      textures.set(key, texture);
    }
    return texture;
  };
  const materials = (json.materials ?? []).map((m) => {
    const material = new THREE.MeshStandardMaterial();
    material.name = m.name ?? "";
    const factor = m.pbrMetallicRoughness?.baseColorFactor;
    if (factor) material.color.setRGB(factor[0], factor[1], factor[2]);
    const ref = m.pbrMetallicRoughness?.baseColorTexture;
    if (ref) material.map = textureOf(ref.index);
    return material;
  });
  const build = (index: number): THREE.Object3D => {
    const node = json.nodes[index];
    let object: THREE.Object3D;
    if (node.mesh !== undefined) {
      const mesh = json.meshes[node.mesh];
      const parts = mesh.primitives.map((p) => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", attributeOf(glb, p.attributes.POSITION, 3));
        if (p.attributes.NORMAL !== undefined) geometry.setAttribute("normal", attributeOf(glb, p.attributes.NORMAL, 3));
        if (p.attributes.TEXCOORD_0 !== undefined) geometry.setAttribute("uv", attributeOf(glb, p.attributes.TEXCOORD_0, 2));
        if (p.attributes.COLOR_0 !== undefined) {
          const size = json.accessors[p.attributes.COLOR_0].type === "VEC3" ? 3 : 4;
          geometry.setAttribute("color", attributeOf(glb, p.attributes.COLOR_0, size));
        }
        if (p.indices !== undefined) {
          const values = accessorValues(glb, p.indices).flat();
          geometry.setIndex(json.accessors[p.indices].componentType === 5125 ? new THREE.Uint32BufferAttribute(values, 1) : new THREE.Uint16BufferAttribute(values, 1));
        }
        return new THREE.Mesh(geometry, p.material !== undefined ? materials[p.material] : new THREE.MeshStandardMaterial());
      });
      if (parts.length === 1) object = parts[0];
      else {
        object = new THREE.Group();
        parts.forEach((part, i) => {
          part.name = `${mesh.name ?? node.name}_${i}`;
          object.add(part);
        });
      }
    } else object = new THREE.Group();
    object.name = node.name ?? "";
    if (node.matrix) new THREE.Matrix4().fromArray(node.matrix).decompose(object.position, object.quaternion, object.scale);
    if (node.translation) object.position.fromArray(node.translation);
    if (node.rotation) object.quaternion.fromArray(node.rotation);
    if (node.scale) object.scale.fromArray(node.scale);
    (node.children ?? []).forEach((c) => object.add(build(c)));
    return object;
  };
  const scene = new THREE.Group();
  scene.name = "Scene";
  sceneRoots(glb).forEach((r) => scene.add(build(r)));
  return scene;
}

// ---------- 삼각형 ----------

export type Tri = {
  /** 세 꼭짓점의 세계 자리(9). */
  pos: number[];
  /** 세계 법선(9, 정규화). 도형에 normal이 없으면 null. */
  nrm: number[] | null;
  /** 그림 좌표(6). 없으면 null. */
  uv: number[] | null;
  /** 정점색 rgba(12, 알파가 없으면 1). 없으면 null. */
  col: number[] | null;
  /** 재질 종류(머리말). */
  cls: string;
  /** 묶음 이름(장면 뿌리 아래 이름) 등 붙인 이름. */
  label: string;
};

const materialOf = (m: THREE.Mesh) => (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshLambertMaterial;

/** 재질 종류: 그림 원본 uuid(없으면 none) + 정점색. */
export function classOf(map: THREE.Texture | null | undefined, vertexColors: boolean): string {
  return `${map ? map.source.uuid : "none"}|vc:${vertexColors}`;
}

/** 합치기 전 메시의 재질 종류(앱이 지금 끼우는 재질: 모델 재질의 map, 도형에 color가 있으면 정점색). */
export function sourceClass(mesh: THREE.Mesh): string {
  return classOf((materialOf(mesh) as unknown as THREE.MeshStandardMaterial).map, mesh.geometry.hasAttribute("color"));
}

/** 그린 메시의 재질 종류(그 메시 재질의 map, vertexColors이고 도형에 color가 있으면 정점색). */
export function drawnClass(mesh: THREE.Mesh): string {
  const m = materialOf(mesh);
  return classOf(m.map, Boolean(m.vertexColors) && mesh.geometry.hasAttribute("color"));
}

/** 메시의 삼각형들(세계 좌표). matrixWorld는 부르는 쪽이 맞춰 둔다. */
export function trianglesOf(mesh: THREE.Mesh, label: string, cls: string): Tri[] {
  const g = mesh.geometry;
  const pos = g.getAttribute("position");
  const nrm = g.getAttribute("normal");
  const uv = g.getAttribute("uv");
  const col = g.getAttribute("color");
  const index = g.getIndex();
  const count = index ? index.count : pos.count;
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  const v = new THREE.Vector3();
  const out: Tri[] = [];
  for (let t = 0; t + 2 < count; t += 3) {
    const tri: Tri = { pos: [], nrm: nrm ? [] : null, uv: uv ? [] : null, col: col ? [] : null, cls, label };
    for (let k = 0; k < 3; k += 1) {
      const i = index ? index.getX(t + k) : t + k;
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      tri.pos.push(v.x, v.y, v.z);
      if (nrm) {
        v.fromBufferAttribute(nrm, i).applyMatrix3(normalMatrix).normalize();
        tri.nrm!.push(v.x, v.y, v.z);
      }
      if (uv) tri.uv!.push(uv.getX(i), uv.getY(i));
      if (col) tri.col!.push(col.getX(i), col.getY(i), col.getZ(i), col.itemSize >= 4 ? col.getW(i) : 1);
    }
    out.push(tri);
  }
  return out;
}

const CELL = 0.05;
const cellKey = (x: number, y: number, z: number) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`;
const centroid = (t: Tri) => [(t.pos[0] + t.pos[3] + t.pos[6]) / 3, (t.pos[1] + t.pos[4] + t.pos[7]) / 3, (t.pos[2] + t.pos[5] + t.pos[8]) / 3];

function close(a: number[], b: number[], ia: number, ib: number, n: number, tol: number): boolean {
  for (let k = 0; k < n; k += 1) if (Math.abs(a[ia + k] - b[ib + k]) > tol) return false;
  return true;
}

export type MatchMode = "shape" | "full" | "full+cls";

/** a의 꼭짓점 k와 b의 꼭짓점 (k + r) % 3이 맞는 r(0~2)이 있는가. shape는 자리만, full은 법선·그림 좌표·정점색도, full+cls는 재질 종류도 본다. */
export function sameTriangle(a: Tri, b: Tri, mode: MatchMode): boolean {
  if (mode === "full+cls" && a.cls !== b.cls) return false;
  if (mode !== "shape" && ((a.nrm === null) !== (b.nrm === null) || (a.uv === null) !== (b.uv === null) || (a.col === null) !== (b.col === null))) return false;
  for (let r = 0; r < 3; r += 1) {
    let ok = true;
    for (let k = 0; k < 3 && ok; k += 1) {
      const j = (k + r) % 3;
      if (!close(a.pos, b.pos, k * 3, j * 3, 3, 1e-4)) ok = false;
      else if (mode !== "shape") {
        if (a.nrm && !close(a.nrm, b.nrm!, k * 3, j * 3, 3, 2e-3)) ok = false;
        else if (a.uv && !close(a.uv, b.uv!, k * 2, j * 2, 2, 1e-5)) ok = false;
        else if (a.col && !close(a.col, b.col!, k * 4, j * 4, 4, 1e-4)) ok = false;
      }
    }
    if (ok) return true;
  }
  return false;
}

/** 삼각형 무리를 무게중심 칸으로 나눠 둔 것. */
export class TriBank {
  private readonly cells = new Map<string, number[]>();

  constructor(readonly tris: Tri[]) {
    tris.forEach((t, i) => {
      const [x, y, z] = centroid(t);
      const key = cellKey(x, y, z);
      const list = this.cells.get(key);
      if (list) list.push(i);
      else this.cells.set(key, [i]);
    });
  }

  /** t와 같은(mode) 삼각형 번호. used가 있으면 아직 쓰지 않은 것만. 없으면 -1. */
  find(t: Tri, mode: MatchMode, used?: Uint8Array): number {
    const [x, y, z] = centroid(t);
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    const cz = Math.floor(z / CELL);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
          for (const i of this.cells.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? []) {
            if (used && used[i]) continue;
            if (sameTriangle(t, this.tris[i], mode)) return i;
          }
        }
      }
    }
    return -1;
  }
}

const describe3 = (t: Tri) => `${t.label} (${t.pos.slice(0, 3).map((v) => v.toFixed(3)).join(", ")})`;

/** 두 삼각형 목록이 같은 삼각형을 같은 수만큼 갖는가. 빠진 것(기대에만)과 남는 것(그린 것에만)의 수와 예. */
export function compareTriangles(expected: Tri[], actual: Tri[], mode: MatchMode): { expected: number; actual: number; missing: number; extra: number; examples: string[] } {
  const bank = new TriBank(actual);
  const used = new Uint8Array(actual.length);
  const examples: string[] = [];
  let missing = 0;
  for (const t of expected) {
    const i = bank.find(t, mode, used);
    if (i < 0) {
      missing += 1;
      if (examples.length < 8) examples.push(`빠짐 ${describe3(t)}`);
    } else used[i] = 1;
  }
  let extra = 0;
  actual.forEach((t, i) => {
    if (used[i]) return;
    extra += 1;
    if (examples.length < 12) examples.push(`남음 ${describe3(t)}`);
  });
  return { expected: expected.length, actual: actual.length, missing, extra, examples };
}

/** 장면 뿌리 아래 묶음 이름. */
export function topNameOf(o: THREE.Object3D, root: THREE.Object3D): string {
  let n: THREE.Object3D = o;
  while (n.parent && n.parent !== root) n = n.parent;
  return n.parent === root ? n.name : "";
}

/** 합치기 전 장면의 삼각형(묶음 이름을 붙임, 재질 종류는 앱이 지금 끼우는 재질). 장면의 matrixWorld를 새로 맞춘다. glassName이면 유리 재질 메시의 묶음 이름 뒤에 ":glass"를 붙인다. */
export function sourceTriangles(source: THREE.Object3D, options: { glass?: RegExp; skip?: (top: string) => boolean } = {}): Tri[] {
  source.updateMatrixWorld(true);
  const out: Tri[] = [];
  source.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh) return;
    const top = topNameOf(o, source);
    if (options.skip?.(top)) return;
    const glass = options.glass?.test(materialOf(o).name) ? ":glass" : "";
    out.push(...trianglesOf(o, `${top}${glass}`, sourceClass(o)));
  });
  return out;
}

/** 그린 메시가 어느 묶음의 것인지(삼각형 자리로): 묶음 이름별 맞은 삼각형 수와 맞지 않은 수. */
export function labelsOfMesh(mesh: THREE.Mesh, bank: TriBank): { labels: Map<string, number>; unmatched: number } {
  const labels = new Map<string, number>();
  let unmatched = 0;
  for (const t of trianglesOf(mesh, "", "")) {
    const i = bank.find(t, "shape");
    if (i < 0) unmatched += 1;
    else labels.set(bank.tris[i].label, (labels.get(bank.tris[i].label) ?? 0) + 1);
  }
  return { labels, unmatched };
}

/** 그린 메시 하나의 묶음 이름(삼각형이 모두 한 묶음이면 그 이름, 아니면 이유 글). */
export function labelOfMesh(mesh: THREE.Mesh, bank: TriBank): string {
  const { labels, unmatched } = labelsOfMesh(mesh, bank);
  if (unmatched > 0 || labels.size !== 1) return `여러 묶음 또는 모델에 없음(${[...labels.entries()].map(([k, v]) => `${k} ${v}`).join(", ")}${unmatched ? `, 없음 ${unmatched}` : ""})`;
  return [...labels.keys()][0];
}

// ---------- 흩뿌림 메시의 인스턴스 칸(계약, 머리말) ----------

/** 칸 속성: 없으면 null, 하나면 그 이름과 속성, 둘 이상이면 이유 글. */
export function cellAttribute(mesh: THREE.InstancedMesh): { name: string; attr: THREE.BufferAttribute } | null | string {
  const found = Object.entries(mesh.geometry.attributes).filter(([, a]) => (a as { isInstancedBufferAttribute?: boolean }).isInstancedBufferAttribute === true);
  if (found.length === 0) return null;
  if (found.length > 1) return `칸 속성이 둘 이상(${found.map(([n]) => n).join(", ")})`;
  return { name: found[0][0], attr: found[0][1] as THREE.BufferAttribute };
}

const mapUv = (map: THREE.Texture, u: number, v: number) => ({
  u: map.repeat.x * (u - map.center.x) + map.center.x + map.offset.x,
  v: map.repeat.y * (v - map.center.y) + map.center.y + map.offset.y
});

/** 인스턴스 i가 그리는 꼭짓점별 그림 좌표(그림 변환과, 크기 2 칸 속성의 옮김을 더한 것). 정할 수 없으면 이유 글. */
export function instanceTextureUvs(mesh: THREE.InstancedMesh, i: number): { u: number; v: number }[] | string {
  const map = materialOf(mesh).map;
  if (!map) return "그림 없음";
  if (map.rotation !== 0) return `그림 rotation ${map.rotation}`;
  const uv = mesh.geometry.getAttribute("uv");
  if (!uv || uv.count === 0) return "uv 없음";
  const cell = cellAttribute(mesh);
  if (typeof cell === "string") return cell;
  let du = 0;
  let dv = 0;
  if (cell && cell.attr.itemSize === 2) {
    du = cell.attr.getX(i);
    dv = cell.attr.getY(i);
  } else if (cell && cell.attr.itemSize !== 1) return `칸 속성 ${cell.name}의 크기 ${cell.attr.itemSize}`;
  const out: { u: number; v: number }[] = [];
  for (let k = 0; k < uv.count; k += 1) {
    const p = mapUv(map, uv.getX(k), uv.getY(k));
    out.push({ u: p.u + du, v: p.v + dv });
  }
  return out;
}

const EPS = 1e-6;

function rectCell(uvs: { u: number; v: number }[], flipY: boolean): { cell: number; c0: number; b0: number } | string {
  const u0 = Math.min(...uvs.map((p) => p.u));
  const u1 = Math.max(...uvs.map((p) => p.u));
  const v0 = Math.min(...uvs.map((p) => p.v));
  const v1 = Math.max(...uvs.map((p) => p.v));
  const col = Math.floor((u0 + EPS) * 4);
  const band = Math.floor((v0 + EPS) * 4);
  if (u1 > (col + 1) / 4 + EPS || v1 > (band + 1) / 4 + EPS || col < 0 || col > 3 || band < 0 || band > 3) {
    return `한 칸 밖 u ${u0.toFixed(3)}~${u1.toFixed(3)} v ${v0.toFixed(3)}~${v1.toFixed(3)}`;
  }
  return { cell: (flipY ? 3 - band : band) * 4 + col, c0: col / 4, b0: band / 4 };
}

/** 인스턴스 i가 그리는 그림 칸(0~15). 정할 수 없으면 이유 글. */
export function instanceCell(mesh: THREE.InstancedMesh, i: number): number | string {
  const cell = cellAttribute(mesh);
  if (typeof cell === "string") return cell;
  if (cell && cell.attr.itemSize === 1) {
    const k = cell.attr.getX(i);
    if (!Number.isInteger(k) || k < 0 || k > 15) return `칸 속성 ${cell.name}의 값 ${k}(0~15 정수가 아님)`;
    return k;
  }
  const uvs = instanceTextureUvs(mesh, i);
  if (typeof uvs === "string") return uvs;
  const r = rectCell(uvs, materialOf(mesh).map!.flipY);
  return typeof r === "string" ? r : r.cell;
}

/**
 * 인스턴스 i의 꼭짓점별 "칸 안 좌표"(그리는 칸 안에서 0~1, 칸의 왼쪽 아래가 (0, 0)). 그림 방향을 견줄 때 쓴다.
 * 칸 속성이 없거나 크기 2면 그리는 그림 범위에서 칸 모서리를 빼고 4를 곱한다. 크기 1이면 도형 uv(그림 변환을 더한 것)가 한 칸 폭이면 같은 방법으로,
 * 0~1 전체이면 그대로 쓴다.
 */
export function instanceLocalUvs(mesh: THREE.InstancedMesh, i: number): { u: number; v: number }[] | string {
  const uvs = instanceTextureUvs(mesh, i);
  if (typeof uvs === "string") return uvs;
  const cell = cellAttribute(mesh);
  const span = Math.max(Math.max(...uvs.map((p) => p.u)) - Math.min(...uvs.map((p) => p.u)), Math.max(...uvs.map((p) => p.v)) - Math.min(...uvs.map((p) => p.v)));
  if (cell && typeof cell !== "string" && cell.attr.itemSize === 1 && span > 0.25 + EPS) {
    const inUnit = uvs.every((p) => p.u >= -EPS && p.u <= 1 + EPS && p.v >= -EPS && p.v <= 1 + EPS);
    return inUnit ? uvs : `칸 속성 크기 1인데 도형 uv가 0~1 밖`;
  }
  const r = rectCell(uvs, materialOf(mesh).map!.flipY);
  if (typeof r === "string") return r;
  return uvs.map((p) => ({ u: (p.u - r.c0) * 4, v: (p.v - r.b0) * 4 }));
}

/** 재질의 onBeforeCompile을 Lambert 셰이더 글로 불러 고친 꼭짓점 셰이더 글에서 name의 attribute 선언과 쓰임을 찾는다. */
export function vertexShaderUses(material: THREE.Material, name: string): { custom: boolean; declared: boolean; used: boolean } {
  const lib = THREE.ShaderLib.lambert;
  const shader = {
    name: "MeshLambertMaterial",
    uniforms: THREE.UniformsUtils.clone(lib.uniforms),
    vertexShader: lib.vertexShader,
    fragmentShader: lib.fragmentShader,
    defines: {} as Record<string, unknown>
  };
  const custom = material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile;
  if (custom) material.onBeforeCompile(shader as never, {} as never);
  const text = shader.vertexShader;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const declared = new RegExp(`\\battribute\\s+(?:highp\\s+|mediump\\s+|lowp\\s+)?(?:float|vec2)\\s+${escaped}\\s*;`).test(text);
  const occurrences = text.match(new RegExp(`\\b${escaped}\\b`, "g"))?.length ?? 0;
  return { custom, declared, used: declared && occurrences >= 2 };
}

// ---------- 같은 재질의 정의를 보는 작은 모델(합성) ----------

type PrimSpec = { name: string; map?: THREE.Texture | null; color: boolean; materialName?: string };

let quadSerial = 0;

/** 서로 다른 자리·법선·그림 좌표·정점색을 가진 네모 하나(삼각형 둘, glTF처럼 Uint16 정규화 정점색과 Uint16 인덱스). */
function quadGeometry(withColor: boolean): THREE.BufferGeometry {
  const s = quadSerial;
  quadSerial += 1;
  const x = (s % 6) * 1.7;
  const z = Math.floor(s / 6) * 1.9;
  const y = 0.2 + 0.07 * s;
  const position = [x, y, z, x + 1, y + 0.1, z, x, y + 0.05, z + 1, x + 1, y + 0.2, z + 1];
  const normal: number[] = [];
  for (let k = 0; k < 4; k += 1) {
    const n = new THREE.Vector3(0.1 * k + 0.05 * (s % 3), 1, 0.2 - 0.1 * k).normalize();
    normal.push(n.x, n.y, n.z);
  }
  const u0 = (s % 5) * 0.11;
  const v0 = (s % 7) * 0.09;
  const uv = [u0, v0, u0 + 0.2, v0, u0, v0 + 0.15, u0 + 0.2, v0 + 0.15];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(normal, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  if (withColor) {
    const color: number[] = [];
    for (let k = 0; k < 4; k += 1) color.push(Math.round(65535 * (0.1 + 0.02 * s)), Math.round(65535 * (0.3 + 0.1 * k)), Math.round(65535 * (0.9 - 0.03 * s)), 65535);
    g.setAttribute("color", new THREE.Uint16BufferAttribute(color, 4, true));
  }
  g.setIndex(new THREE.Uint16BufferAttribute([0, 2, 1, 1, 2, 3], 1));
  return g;
}

function group(name: string, at: [number, number, number], turn: number, scale: number, meshAt: [number, number, number], meshTurn: [number, number, number], prims: PrimSpec[]): THREE.Object3D {
  const top = new THREE.Object3D();
  top.name = name;
  top.position.set(...at);
  top.rotation.y = turn;
  top.scale.setScalar(scale);
  const holder = new THREE.Group();
  holder.name = `${name}-mesh`;
  holder.position.set(...meshAt);
  holder.rotation.set(...meshTurn);
  top.add(holder);
  for (const p of prims) {
    const material = new THREE.MeshStandardMaterial({ map: p.map ?? null });
    material.name = p.materialName ?? p.name;
    if (/^glass/.test(material.name)) {
      material.transparent = true;
      material.opacity = 0.25;
    }
    const mesh = new THREE.Mesh(quadGeometry(p.color), material);
    mesh.name = p.name;
    holder.add(mesh);
  }
  return top;
}

/**
 * 같은 재질의 정의(명세 바뀌는 동작 2)를 가르는 작은 마을 모델. glTF 메시 하나의 여러 primitive처럼 묶음 > "<묶음>-mesh" 묶음 > 메시들로 짓는다.
 * - props: 그림 A(원본 S1) 정점색 있음 ×2(그중 하나는 원본이 같은 다른 THREE.Texture), 그림 B(원본 S2) 정점색 있음, 그림 없음 정점색 있음 ×2,
 *   그림 A 정점색 없음, 그림 없음 정점색 없음 → 재질 종류 5가지.
 * - windmill: 그림 A 정점색 있음 ×2(서로 다른 THREE.Texture, 원본 같음) → 1가지. windmill-rotor: 메시 하나.
 * - bld-home: 본체(그림 B 정점색 있음) 하나와 유리(재질 이름 glass…) 둘(같은 유리 재질 종류).
 * - glow-lamp-0: 불빛 판 둘(재질 이름 glow, 그림 없음, 같은 종류). paths: 옛 길 조각 둘(그림 A, 정점색 있음, 같은 종류).
 * 묶음마다 자리·방향·크기와 안쪽 묶음의 자리·방향을 달리 둔다.
 */
export function syntheticVillage112(): { scene: THREE.Group; propsClasses: string[]; windmillClasses: string[] } {
  quadSerial = 0;
  const texA = new THREE.Texture();
  texA.name = "qa-S1";
  const texA2 = texA.clone();
  const texB = new THREE.Texture();
  texB.name = "qa-S2";
  const scene = new THREE.Group();
  scene.name = "Scene";
  scene.add(
    group("props", [20, 0, 18], 0.7, 1.5, [0.4, 0.1, -0.3], [0.1, 0.25, 0], [
      { name: "p0", map: texA, color: true },
      { name: "p1", map: texA2, color: true },
      { name: "p2", map: texB, color: true },
      { name: "p3", map: null, color: true },
      { name: "p4", map: null, color: true },
      { name: "p5", map: texA, color: false },
      { name: "p6", map: null, color: false }
    ])
  );
  scene.add(group("windmill", [40, 0, -4], -0.4, 1.2, [0, 0.5, 0.2], [0, 0.3, 0.05], [
    { name: "w0", map: texA, color: true },
    { name: "w1", map: texA2, color: true }
  ]));
  const rotorTop = new THREE.Object3D();
  rotorTop.name = "windmill-rotor";
  rotorTop.position.set(40, 6, -3);
  const rotor = new THREE.Mesh(quadGeometry(true), new THREE.MeshStandardMaterial({ map: texA }));
  rotor.name = "windmill-rotor-mesh";
  rotorTop.add(rotor);
  scene.add(rotorTop);
  scene.add(group("bld-home", [12, 0, 30], 0.2, 1.1, [0.2, 0, 0.1], [0, 0.1, 0], [
    { name: "body", map: texB, color: true },
    { name: "glassA", map: null, color: true, materialName: "glass.qa1" },
    { name: "glassB", map: null, color: true, materialName: "glass.qa1" }
  ]));
  scene.add(group("glow-lamp-0", [25, 2, 25], 0.5, 1, [0, 0.1, 0], [0, 0, 0], [
    { name: "g0", map: null, color: false, materialName: "glow" },
    { name: "g1", map: null, color: false, materialName: "glow" }
  ]));
  scene.add(group("paths", [5, 0, 5], 0, 1, [0, 0, 0], [0, 0, 0], [
    { name: "q0", map: texA, color: true },
    { name: "q1", map: texA2, color: true }
  ]));
  return {
    scene,
    propsClasses: [classOf(texA, true), classOf(texB, true), classOf(null, true), classOf(texA, false), classOf(null, false)].sort(),
    windmillClasses: [classOf(texA, true)]
  };
}
