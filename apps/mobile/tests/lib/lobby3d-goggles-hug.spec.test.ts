/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 095 고글 밀착·앞머리, 기능 변경, 모바일): 라룹이 몸(writeloop.glb)에서 앞머리를 지우고,
// 고글(wear-goggles.glb)을 이마에 감싸 붙인다. 바뀔 동작과 그대로 둘 동작을 모델 파일에서 본다.
// 기대값은 명세(private 작업 폴더 095-2026-11-15-고글-밀착-앞머리/01-main-spec.md)의 "바뀌는 동작" 1~3과 "그대로여야 할 동작"에서만 가져오고,
// 그대로 둘 동작은 기준 커밋 a36d70a의 파일(git show)과 견준다. 테스트 이름 앞의 번호와 분류는 02-qa-tests.md에 적었다.
// 좌표는 앱 규격(Y 위, 앞 +Z, 키 1, 원점 발 가운데)이고 몸 파일의 POSITION이 쉬는 자세다(뼈대의 쉬는 자세와 묶음 자세가 같다).
// 명세에 수치가 없어 qa가 정한 판정 기준(02-qa-tests.md "가정"에 이유를 적었고 사용자 확인이 필요하다):
// - 앞머리 자리 상자: x -0.27~0.30, y 0.66~0.92, z ≥ 0(기준 몸의 앞머리 전체를 덮는다. 06 결정 1로 왼쪽 끝을 -0.16에서 -0.27로 넓혔다:
//   앞머리가 왼쪽 x -0.17~-0.26까지 이어져 있다). 법선이 바뀌어도 되는 둘레: 상자를 4cm 넓힌 곳.
// - 매끈한 이마: 앞에서 본 깊이 지도(1cm 간격)에서 이마 가운데(x -0.10~0.10, y 0.68~0.84)의 2cm 간격 2차 차분이 0.3cm 이하(오목하게 꺼지거나
//   솟은 데가 없다), 이마 양옆(x 0.01~0.26, y 0.66~0.88)은 좌우 깊이 차가 1.0cm 이하(기준 몸에서 앞머리 밖은 0.5cm 안으로 좌우 대칭이다).
//   06 결정 2로 관자놀이(x 0.23~0.26, y 0.77~0.80)는 기준 몸의 좌우 차와 1.0cm 중 큰 값까지 본다(기준 몸이 이미 1.0~1.2cm 비대칭).
// - 고글이 붙음(14 결정으로 나눔): 렌즈 판은 기준 판을 돌리고 옮기기만 하고(G7, 판 점 사이 거리 0.1mm 안), 판 가운데 뒷면이 기준 고글보다
//   평균 1mm 넘게 이마에 가깝다(G3a). 띠는 몸을 향하고 다른 고글 면에 가려지지 않은 면의 가운데가 모두 몸에서 1.0cm 안(G3b, 03 결정 1).
//   16 결정으로 판 끝에서 머리까지의 이음 구간(판 점에서 판 끝 뒷면의 뜬 거리 + 2cm 안)은 판에서 멀어질수록 머리까지 거리가 늘지 않는지만 본다.
// - 파고들지 않음: 고글 표본점(꼭짓점·삼각형 가운데·변 가운데)이 몸 속(감은 수 > 0.5)에 1mm보다 깊이 들지 않는다.
// - 크기·높이가 같음: 높이(y 범위)와 높이 75% 위 부분의 폭(x 범위, 띠가 닿지 않는 렌즈 판 윗부분)이 기준의 ±5%, y 최저·최고가 기준의 ±1cm.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MOBILE = join(__dirname, "..", "..");
const REPO = join(MOBILE, "..", "..");
const BASE = "a36d70a";
const BODY_PATH = "apps/mobile/assets/models/writeloop.glb";
const GOGGLES_PATH = "apps/mobile/assets/models/wear-goggles.glb";
const ICON_PATH = "apps/mobile/assets/icons/wearables/goggles.png";
const CREDITS_PATH = "apps/mobile/assets/models/CREDITS.md";
const BUILD_PATH = "scripts/lobby3d/build-goggles.py";
const SLOW = 180_000;

const nowFile = (path: string) => readFileSync(join(REPO, path));
const baseFile = (path: string) => execFileSync("git", ["show", `${BASE}:${path}`], { cwd: REPO, maxBuffer: 64 * 1024 * 1024 });

// ---------- glTF 읽기 ----------

type Node = { name?: string; mesh?: number; skin?: number; children?: number[]; translation?: number[]; rotation?: number[]; scale?: number[]; matrix?: number[] };
type Primitive = { attributes: Record<string, number>; indices?: number; material?: number; targets?: unknown[] };
type Gltf = {
  nodes: Node[];
  meshes: { name?: string; primitives: Primitive[] }[];
  skins?: { joints: number[]; inverseBindMatrices?: number }[];
  accessors: { bufferView?: number; byteOffset?: number; count: number; componentType: number; type: string; normalized?: boolean }[];
  bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number }[];
  materials?: Record<string, unknown>[];
  textures?: { source: number }[];
  images?: { bufferView: number; mimeType: string }[];
  animations?: { name?: string; channels: { sampler: number; target: { node?: number; path: string } }[]; samplers: { input: number; output: number; interpolation?: string }[] }[];
};
type Glb = { json: Gltf; bin: Buffer };

function parseGlb(buf: Buffer): Glb {
  const jsonLength = buf.readUInt32LE(12);
  const json = JSON.parse(buf.toString("utf8", 20, 20 + jsonLength)) as Gltf;
  const binStart = 20 + jsonLength + 8;
  return { json, bin: buf.subarray(binStart, binStart + buf.readUInt32LE(20 + jsonLength)) };
}

const COMPONENTS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const BYTES: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };

/** accessor 값(정규화하지 않은 날 값). */
function values(glb: Glb, index: number): number[] {
  const a = glb.json.accessors[index];
  const view = glb.json.bufferViews[a.bufferView ?? 0];
  const n = COMPONENTS[a.type];
  const size = BYTES[a.componentType];
  const stride = view.byteStride ?? n * size;
  const start = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out: number[] = [];
  for (let i = 0; i < a.count; i += 1) {
    for (let k = 0; k < n; k += 1) {
      const o = start + i * stride + k * size;
      switch (a.componentType) {
        case 5126: out.push(glb.bin.readFloatLE(o)); break;
        case 5125: out.push(glb.bin.readUInt32LE(o)); break;
        case 5123: out.push(glb.bin.readUInt16LE(o)); break;
        case 5122: out.push(glb.bin.readInt16LE(o)); break;
        case 5121: out.push(glb.bin.readUInt8(o)); break;
        default: out.push(glb.bin.readInt8(o));
      }
    }
  }
  return out;
}

function meshNodes(glb: Glb): Node[] {
  return glb.json.nodes.filter((n) => n.mesh !== undefined);
}

function imageBytes(glb: Glb, index: number): Buffer {
  const view = glb.json.bufferViews[glb.json.images![index].bufferView];
  return glb.bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
}

type Body = { glb: Glb; prim: Primitive; P: number[]; I: number[] };
function body(buf: Buffer): Body {
  const glb = parseGlb(buf);
  const prim = glb.json.meshes[meshNodes(glb)[0].mesh!].primitives[0];
  return { glb, prim, P: values(glb, prim.attributes.POSITION), I: values(glb, prim.indices!) };
}

type Goggles = { glb: Glb; P: number[]; N: number[]; I: number[] };
function goggles(buf: Buffer): Goggles {
  const glb = parseGlb(buf);
  const prim = glb.json.meshes[meshNodes(glb)[0].mesh!].primitives[0];
  return { glb, P: values(glb, prim.attributes.POSITION), N: values(glb, prim.attributes.NORMAL), I: values(glb, prim.indices!) };
}

// 파일은 한 번만 읽는다.
let cache: { now: Body; base: Body; gNow: Goggles; gBase: Goggles } | null = null;
function files() {
  if (!cache) {
    cache = {
      now: body(nowFile(BODY_PATH)),
      base: body(baseFile(BODY_PATH)),
      gNow: goggles(nowFile(GOGGLES_PATH)),
      gBase: goggles(baseFile(GOGGLES_PATH))
    };
  }
  return cache;
}

// ---------- 기하 ----------

/** 앞(+Z)에서 본 깊이 지도: 격자점(x, y)마다 앞쪽 표면의 가장 큰 z. 맞는 삼각형이 없으면 -Infinity. */
function frontDepth(P: number[], I: number[], x0: number, x1: number, y0: number, y1: number, step: number) {
  const nx = Math.round((x1 - x0) / step) + 1;
  const ny = Math.round((y1 - y0) / step) + 1;
  const D = new Float64Array(nx * ny).fill(-Infinity);
  for (let t = 0; t < I.length; t += 3) {
    const a = 3 * I[t], b = 3 * I[t + 1], c = 3 * I[t + 2];
    const ax = P[a], ay = P[a + 1], az = P[a + 2], bx = P[b], by = P[b + 1], bz = P[b + 2], cx = P[c], cy = P[c + 1], cz = P[c + 2];
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(den) < 1e-14) continue;
    const i0 = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - x0) / step));
    const i1 = Math.min(nx - 1, Math.floor((Math.max(ax, bx, cx) - x0) / step));
    const j0 = Math.max(0, Math.ceil((Math.min(ay, by, cy) - y0) / step));
    const j1 = Math.min(ny - 1, Math.floor((Math.max(ay, by, cy) - y0) / step));
    for (let i = i0; i <= i1; i += 1) {
      for (let j = j0; j <= j1; j += 1) {
        const x = x0 + i * step, y = y0 + j * step;
        const l1 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / den;
        const l2 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / den;
        const l3 = 1 - l1 - l2;
        if (l1 >= -1e-9 && l2 >= -1e-9 && l3 >= -1e-9) {
          const z = l1 * az + l2 * bz + l3 * cz;
          if (z > D[j * nx + i]) D[j * nx + i] = z;
        }
      }
    }
  }
  return {
    at: (x: number, y: number) => {
      const i = Math.round((x - x0) / step), j = Math.round((y - y0) / step);
      return i < 0 || j < 0 || i >= nx || j >= ny ? -Infinity : D[j * nx + i];
    }
  };
}

/** 삼각형 위에서 p에 가장 가까운 점(Ericson). */
function closestOnTriangle(p: number[], P: number[], a: number, b: number, c: number): number[] {
  const ax = P[a], ay = P[a + 1], az = P[a + 2], bx = P[b], by = P[b + 1], bz = P[b + 2], cx = P[c], cy = P[c + 1], cz = P[c + 2];
  const abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az;
  const apx = p[0] - ax, apy = p[1] - ay, apz = p[2] - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) return [ax, ay, az];
  const bpx = p[0] - bx, bpy = p[1] - by, bpz = p[2] - bz;
  const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) return [bx, by, bz];
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return [ax + v * abx, ay + v * aby, az + v * abz]; }
  const cpx = p[0] - cx, cpy = p[1] - cy, cpz = p[2] - cz;
  const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) return [cx, cy, cz];
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return [ax + w * acx, ay + w * acy, az + w * acz]; }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / (d4 - d3 + (d5 - d6)); return [bx + w * (cx - bx), by + w * (cy - by), bz + w * (cz - bz)]; }
  const den = 1 / (va + vb + vc);
  const v = vb * den, w = vc * den;
  return [ax + abx * v + acx * w, ay + aby * v + acy * w, az + abz * v + acz * w];
}

/** 몸 표면까지 가장 가까운 점과 거리. */
function closestOnBody(p: number[], P: number[], I: number[]): { point: number[]; distance: number } {
  let best = Infinity;
  let point = p;
  for (let t = 0; t < I.length; t += 3) {
    const q = closestOnTriangle(p, P, 3 * I[t], 3 * I[t + 1], 3 * I[t + 2]);
    const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2;
    if (d < best) { best = d; point = q; }
  }
  return { point, distance: Math.sqrt(best) };
}

/** 몸 메시가 p를 감은 수(1에 가까우면 몸 속, 0에 가까우면 몸 밖). */
function winding(p: number[], P: number[], I: number[]): number {
  let sum = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = 3 * I[t], b = 3 * I[t + 1], c = 3 * I[t + 2];
    const x1 = P[a] - p[0], y1 = P[a + 1] - p[1], z1 = P[a + 2] - p[2];
    const x2 = P[b] - p[0], y2 = P[b + 1] - p[1], z2 = P[b + 2] - p[2];
    const x3 = P[c] - p[0], y3 = P[c + 1] - p[1], z3 = P[c + 2] - p[2];
    const l1 = Math.hypot(x1, y1, z1), l2 = Math.hypot(x2, y2, z2), l3 = Math.hypot(x3, y3, z3);
    const det = x1 * (y2 * z3 - z2 * y3) - y1 * (x2 * z3 - z2 * x3) + z1 * (x2 * y3 - y2 * x3);
    const den = l1 * l2 * l3 + (x1 * x2 + y1 * y2 + z1 * z2) * l3 + (x2 * x3 + y2 * y3 + z2 * z3) * l1 + (x3 * x1 + y3 * y1 + z3 * z1) * l2;
    sum += 2 * Math.atan2(det, den);
  }
  return sum / (4 * Math.PI);
}

/**
 * 몸 속인지 빠르게 가린다: p를 지나는 축 방향 직선 셋(x·y·z)의 양쪽 반직선 여섯이 몸 표면을 홀수 번 지나는지 센다.
 * 넷 이상이 홀수면 몸 속, 둘 이하면 몸 밖이고, 셋 대 셋이면 감은 수로 정한다. 삼각형은 축마다 1cm 칸 격자로 나눠 둔다.
 */
function insideTester(P: number[], I: number[]) {
  const CELL = 0.01;
  const axes = [0, 1, 2].map((axis) => {
    const [u, v] = [0, 1, 2].filter((k) => k !== axis);
    const grid = new Map<string, number[]>();
    for (let t = 0; t < I.length; t += 3) {
      const ps = [3 * I[t], 3 * I[t + 1], 3 * I[t + 2]];
      const us = ps.map((p) => P[p + u]), vs = ps.map((p) => P[p + v]);
      for (let i = Math.floor(Math.min(...us) / CELL); i <= Math.floor(Math.max(...us) / CELL); i += 1) {
        for (let j = Math.floor(Math.min(...vs) / CELL); j <= Math.floor(Math.max(...vs) / CELL); j += 1) {
          const key = `${i},${j}`;
          const list = grid.get(key) ?? [];
          list.push(t);
          grid.set(key, list);
        }
      }
    }
    return { axis, u, v, grid };
  });
  return (p: number[]): boolean => {
    let odd = 0;
    for (const { axis, u, v, grid } of axes) {
      // 꼭짓점·변을 정확히 지나지 않게 아주 조금 비낀다.
      const pu = p[u] + 1.37e-7, pv = p[v] + 2.11e-7;
      let ahead = 0, behind = 0;
      for (const t of grid.get(`${Math.floor(pu / CELL)},${Math.floor(pv / CELL)}`) ?? []) {
        const a = 3 * I[t], b = 3 * I[t + 1], c = 3 * I[t + 2];
        const den = (P[b + v] - P[c + v]) * (P[a + u] - P[c + u]) + (P[c + u] - P[b + u]) * (P[a + v] - P[c + v]);
        if (Math.abs(den) < 1e-18) continue;
        const l1 = ((P[b + v] - P[c + v]) * (pu - P[c + u]) + (P[c + u] - P[b + u]) * (pv - P[c + v])) / den;
        const l2 = ((P[c + v] - P[a + v]) * (pu - P[c + u]) + (P[a + u] - P[c + u]) * (pv - P[c + v])) / den;
        const l3 = 1 - l1 - l2;
        if (l1 < 0 || l2 < 0 || l3 < 0) continue;
        const along = l1 * P[a + axis] + l2 * P[b + axis] + l3 * P[c + axis];
        if (along > p[axis]) ahead += 1;
        else behind += 1;
      }
      odd += (ahead % 2) + (behind % 2);
    }
    if (odd >= 4) return true;
    if (odd <= 2) return false;
    return winding(p, P, I) > 0.5;
  };
}

/** 글 파일 비교용: 줄 끝(CRLF/LF)을 맞춘다(Windows 작업 폴더는 CRLF, git 저장본은 LF). */
const text = (buf: Buffer) => buf.toString("utf8").replace(/\r\n/g, "\n");

const round = (v: number, digits = 2) => Number(v.toFixed(digits));
const cm = (v: number) => round(v * 100, 2);

/** 점 i가 앞머리 자리 상자 안인가(margin만큼 넓혀서). */
function inBangsBox(P: number[], i: number, margin = 0): boolean {
  const x = P[3 * i], y = P[3 * i + 1], z = P[3 * i + 2];
  return x >= -0.27 - margin && x <= 0.3 + margin && y >= 0.66 - margin && y <= 0.92 + margin && z >= 0 - margin;
}

// ---------- 바뀔 동작 1: 앞머리 없는 몸 ----------

describe("[spec] 095 바뀔 동작 1: 라룹이 몸에 앞머리가 없고 이마가 매끈하다", () => {
  it("B1 writeloop.glb는 기준 커밋(a36d70a)의 파일과 바이트가 다르다", () => {
    expect(nowFile(BODY_PATH).equals(baseFile(BODY_PATH))).toBe(false);
  });

  it("B2 이마 가운데(x -0.10~0.10, y 0.68~0.84)는 앞에서 본 깊이 지도에 빈 곳이 없고, 2cm 간격 2차 차분이 가로·세로 모두 0.3cm 이하다(솟은 덩어리·접힌 면이 없다)", () => {
    const { P, I } = files().now;
    const depth = frontDepth(P, I, -0.3, 0.3, 0.6, 0.92, 0.01);
    const holes: string[] = [];
    const bumps: { x: number; y: number; axis: string; cm: number }[] = [];
    for (let xi = -10; xi <= 10; xi += 1) {
      for (let yi = 68; yi <= 84; yi += 1) {
        const x = xi / 100, y = yi / 100;
        const z = depth.at(x, y);
        if (z === -Infinity) { holes.push(`${x},${y}`); continue; }
        for (const [axis, dx, dy] of [["x", 0.02, 0], ["y", 0, 0.02]] as const) {
          const a = depth.at(x - dx, y - dy), c = depth.at(x + dx, y + dy);
          if (a === -Infinity || c === -Infinity) { holes.push(`${round(x - dx)}|${round(x + dx)},${round(y - dy)}|${round(y + dy)}`); continue; }
          const second = a - 2 * z + c;
          if (second > 0.003) bumps.push({ x, y, axis, cm: cm(second) });
        }
      }
    }
    expect(holes).toEqual([]);
    expect(bumps.sort((p, q) => q.cm - p.cm).slice(0, 10)).toEqual([]);
  });

  // 06 결정 2(사용자 "상자 넓히고 B3 고침"): 관자놀이(x 0.23~0.26, y 0.77~0.80)는 기준 몸에서 이미 좌우 깊이가 1.0cm 넘게 다르다(앞머리가 아닌
  // 머리 자체의 비대칭). 그 자리는 "기준 몸의 좌우 차보다 커지지 않으면" 통과로 본다(기준이 1.0cm 안인 점은 1.0cm 그대로). 나머지 자리는 1.0cm 그대로다.
  it("B3 이마 양옆(x 0.01~0.26, y 0.66~0.88)은 앞에서 본 깊이가 좌우(x와 -x)로 1.0cm 안에서 같고(관자놀이 x 0.23~0.26, y 0.77~0.80은 기준 몸의 좌우 차와 1.0cm 중 큰 값 안), 한쪽만 비는 곳이 없다(한쪽 털 뭉치가 없다)", () => {
    const { P, I } = files().now;
    const depth = frontDepth(P, I, -0.3, 0.3, 0.6, 0.92, 0.01);
    const base = frontDepth(files().base.P, files().base.I, -0.3, 0.3, 0.6, 0.92, 0.01);
    const off: { x: number; y: number; cm: number | string }[] = [];
    for (let xi = 1; xi <= 26; xi += 1) {
      for (let yi = 66; yi <= 88; yi += 1) {
        const x = xi / 100, y = yi / 100;
        const right = depth.at(x, y), left = depth.at(-x, y);
        if (right === -Infinity && left === -Infinity) continue;
        if (right === -Infinity || left === -Infinity) { off.push({ x, y, cm: "한쪽만 빔" }); continue; }
        const diff = Math.abs(right - left);
        let allowed = 0.01;
        if (xi >= 23 && xi <= 26 && yi >= 77 && yi <= 80) {
          const baseRight = base.at(x, y), baseLeft = base.at(-x, y);
          if (baseRight !== -Infinity && baseLeft !== -Infinity) allowed = Math.max(0.01, Math.abs(baseRight - baseLeft));
        }
        if (diff > allowed) off.push({ x, y, cm: cm(diff) });
      }
    }
    expect(off.sort((p, q) => Number(q.cm) - Number(p.cm)).slice(0, 10)).toEqual([]);
  });

  it("B4 기준 몸에서 같은 자리에 있던 점들(질감 경계로 갈라진 점)은 지금도 서로 같은 자리이고(1e-6), 열린 변의 수가 기준과 같다(찢어진 구멍이 없다)", () => {
    const { now, base } = files();
    expect(now.P.length).toBe(base.P.length);
    const groups = new Map<string, number[]>();
    for (let i = 0; i < base.P.length / 3; i += 1) {
      const key = [base.P[3 * i], base.P[3 * i + 1], base.P[3 * i + 2]].map((v) => Math.round(v * 1e5)).join(",");
      const list = groups.get(key) ?? [];
      list.push(i);
      groups.set(key, list);
    }
    const torn: number[] = [];
    for (const list of groups.values()) {
      for (const i of list.slice(1)) {
        const j = list[0];
        const gap = Math.hypot(now.P[3 * i] - now.P[3 * j], now.P[3 * i + 1] - now.P[3 * j + 1], now.P[3 * i + 2] - now.P[3 * j + 2]);
        if (gap > 1e-6) torn.push(i);
      }
    }
    expect(torn.slice(0, 20)).toEqual([]);
    const openEdges = (b: Body) => {
      const id = new Map<string, number>();
      const weld: number[] = [];
      for (let i = 0; i < b.P.length / 3; i += 1) {
        const key = [b.P[3 * i], b.P[3 * i + 1], b.P[3 * i + 2]].map((v) => Math.round(v * 1e5)).join(",");
        if (!id.has(key)) id.set(key, id.size);
        weld.push(id.get(key)!);
      }
      const use = new Map<string, number>();
      for (let t = 0; t < b.I.length; t += 3) {
        for (let k = 0; k < 3; k += 1) {
          const a = weld[b.I[t + k]], c = weld[b.I[t + ((k + 1) % 3)]];
          const key = a < c ? `${a}_${c}` : `${c}_${a}`;
          use.set(key, (use.get(key) ?? 0) + 1);
        }
      }
      return [...use.values()].filter((n) => n === 1).length;
    };
    expect(openEdges(now)).toBe(openEdges(base));
  });
});

// ---------- 그대로 둘 동작: 몸 ----------

describe("[spec] 095 그대로: 몸 모델의 점 수·삼각형·UV·뼈대·무게·동작·외곽선·질감, 앞머리 자리 밖의 모양", () => {
  it("K1 메시 노드는 뼈대로 휘는 몸 하나이고 모양 변형(targets)이 없으며, 속성 이름 집합이 기준과 같다", () => {
    const { now, base } = files();
    expect(meshNodes(now.glb).length).toBe(1);
    expect(meshNodes(now.glb)[0].skin !== undefined).toBe(true);
    expect(now.glb.json.meshes.flatMap((m) => m.primitives.filter((p) => p.targets !== undefined))).toEqual([]);
    expect(now.glb.json.meshes[meshNodes(now.glb)[0].mesh!].primitives.length).toBe(1);
    expect(Object.keys(now.prim.attributes).sort()).toEqual(Object.keys(base.prim.attributes).sort());
  });

  it("K2 점 수·삼각형 인덱스·UV·뼈 번호(JOINTS_0)·무게(WEIGHTS_0)·_OUTLINE_BIAS가 기준과 순서까지 같다", () => {
    const { now, base } = files();
    expect(now.P.length).toBe(base.P.length);
    expect(now.I).toEqual(base.I);
    for (const name of ["TEXCOORD_0", "JOINTS_0", "WEIGHTS_0", "_OUTLINE_BIAS"]) {
      expect({ name, same: JSON.stringify(values(now.glb, now.prim.attributes[name])) === JSON.stringify(values(base.glb, base.prim.attributes[name])) }).toEqual({ name, same: true });
    }
  });

  it("K3 뼈대: skin의 뼈 이름·차례와 묶음 역행렬, 모든 노드의 이름·자식·TRS가 기준과 같다", () => {
    const { now, base } = files();
    const skin = (g: Glb) => ({ joints: g.json.skins![0].joints.map((j) => g.json.nodes[j].name), inverse: values(g, g.json.skins![0].inverseBindMatrices!) });
    expect(skin(now.glb)).toEqual(skin(base.glb));
    const nodes = (g: Glb) => g.json.nodes.map((n) => ({ name: n.name, children: n.children, translation: n.translation, rotation: n.rotation, scale: n.scale, matrix: n.matrix }));
    expect(nodes(now.glb)).toEqual(nodes(base.glb));
  });

  it("K4 동작 클립 19개의 이름·채널(대상 노드·경로)·보간·키 시각·키 값이 기준과 같다", () => {
    const { now, base } = files();
    const clips = (g: Glb) =>
      (g.json.animations ?? []).map((a) => ({
        name: a.name,
        channels: a.channels.map((c) => ({
          node: g.json.nodes[c.target.node!].name,
          path: c.target.path,
          interpolation: a.samplers[c.sampler].interpolation ?? "LINEAR",
          input: values(g, a.samplers[c.sampler].input),
          output: values(g, a.samplers[c.sampler].output)
        }))
      }));
    const before = clips(base.glb);
    expect(before.length).toBe(19);
    expect(JSON.stringify(clips(now.glb))).toBe(JSON.stringify(before));
  });

  it("K5 질감 그림 바이트와 재질이 기준과 같다", () => {
    const { now, base } = files();
    expect((now.glb.json.images ?? []).length).toBe((base.glb.json.images ?? []).length);
    expect(imageBytes(now.glb, 0).equals(imageBytes(base.glb, 0))).toBe(true);
    expect(now.glb.json.materials).toEqual(base.glb.json.materials);
  });

  it("K6 앞머리 자리 상자 밖의 점과 귀·꼬리 뼈에 붙은 점(무게 0.5 넘음)의 자리가 기준과 같다(1e-5): 얼굴(눈·코·입·볼), 귀, 꼬리, 몸통", () => {
    const { now, base } = files();
    const names = base.glb.json.skins![0].joints.map((j) => base.glb.json.nodes[j].name ?? "");
    const J = values(base.glb, base.prim.attributes.JOINTS_0);
    const W = values(base.glb, base.prim.attributes.WEIGHTS_0);
    const earOrTail = (i: number) => {
      let w = 0;
      for (let k = 0; k < 4; k += 1) if (/^(ear_|tail_)/.test(names[J[4 * i + k]])) w += W[4 * i + k];
      return w > 0.5;
    };
    const moved: { i: number; at: number[]; cm: number }[] = [];
    let checked = 0;
    for (let i = 0; i < base.P.length / 3; i += 1) {
      if (inBangsBox(base.P, i) && !earOrTail(i)) continue;
      checked += 1;
      const d = Math.hypot(now.P[3 * i] - base.P[3 * i], now.P[3 * i + 1] - base.P[3 * i + 1], now.P[3 * i + 2] - base.P[3 * i + 2]);
      if (d > 1e-5) moved.push({ i, at: [base.P[3 * i], base.P[3 * i + 1], base.P[3 * i + 2]].map((v) => round(v, 3)), cm: cm(d) });
    }
    expect(checked).toBeGreaterThan(8000);
    expect(moved.slice(0, 20)).toEqual([]);
  });

  it("K7 앞머리 자리 상자를 4cm 넓힌 곳 밖의 점은 법선(NORMAL)과 외곽선 방향(_OUTLINE_NORMAL)이 기준과 같다(1e-4)", () => {
    const { now, base } = files();
    for (const name of ["NORMAL", "_OUTLINE_NORMAL"]) {
      const a = values(now.glb, now.prim.attributes[name]);
      const b = values(base.glb, base.prim.attributes[name]);
      const changed: number[] = [];
      for (let i = 0; i < base.P.length / 3; i += 1) {
        if (inBangsBox(base.P, i, 0.04)) continue;
        const d = Math.max(Math.abs(a[3 * i] - b[3 * i]), Math.abs(a[3 * i + 1] - b[3 * i + 1]), Math.abs(a[3 * i + 2] - b[3 * i + 2]));
        if (d > 1e-4) changed.push(i);
      }
      expect({ name, changed: changed.slice(0, 20) }).toEqual({ name, changed: [] });
    }
  });
});

// ---------- 바뀔 동작 2: 고글이 이마에 붙음 ----------

/** 고글 표본점: 꼭짓점, 삼각형 가운데, 변 가운데. */
function goggleSamples(g: Goggles): number[][] {
  const out: number[][] = [];
  const v = (i: number) => [g.P[3 * i], g.P[3 * i + 1], g.P[3 * i + 2]];
  for (let i = 0; i < g.P.length / 3; i += 1) out.push(v(i));
  const seen = new Set<string>();
  for (let t = 0; t < g.I.length; t += 3) {
    const [a, b, c] = [g.I[t], g.I[t + 1], g.I[t + 2]];
    out.push([0, 1, 2].map((k) => (g.P[3 * a + k] + g.P[3 * b + k] + g.P[3 * c + k]) / 3));
    for (const [p, q] of [[a, b], [b, c], [c, a]]) {
      const key = p < q ? `${p}_${q}` : `${q}_${p}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push([0, 1, 2].map((k) => (g.P[3 * p + k] + g.P[3 * q + k]) / 2));
    }
  }
  return out;
}

describe("[spec] 095 바뀔 동작 2: 고글이 이마에 붙어 보인다(새 몸 기준)", () => {
  it("G1 wear-goggles.glb는 기준 커밋(a36d70a)의 파일과 바이트가 다르다", () => {
    expect(nowFile(GOGGLES_PATH).equals(baseFile(GOGGLES_PATH))).toBe(false);
  });

  it(
    "G2 고글의 어느 부분도 몸 속으로 파고들지 않는다: 고글 표본점(꼭짓점·삼각형 가운데·변 가운데) 중 몸 속(감은 수 > 0.5)에 1mm보다 깊이 든 것이 없다",
    () => {
      const { now, gNow } = files();
      const isInside = insideTester(now.P, now.I);
      const inside: { at: number[]; cm: number }[] = [];
      for (const p of goggleSamples(gNow)) {
        if (!isInside(p)) continue;
        const { distance } = closestOnBody(p, now.P, now.I);
        if (distance > 0.001) inside.push({ at: p.map((v) => round(v, 3)), cm: cm(distance) });
      }
      expect(inside.sort((a, b) => b.cm - a.cm).slice(0, 15)).toEqual([]);
    },
    SLOW
  );

  // 14 결정(사용자 "그냥 기존에서 살짝만 더 붙이는거로하자, 렌즈 모형을 변형시키지 않는선에서"): 처음 G3(몸을 향한 고글 면 모두 1cm 안)를
  // 렌즈 판의 가까워짐(G3a)과 띠(G3b)로 나누고, 렌즈 판 모양이 그대로인지(G7)를 더했다. 렌즈 판을 찾고 짝짓는 방법은 plateOf 주석에 적었다.

  it(
    "G3a 렌즈 판 가운데 뒷면(기준 판에서 |x| ≤ 0.10, 뒤를 향한 면)이 지금 몸에서 잰 평균 거리로 기준 고글보다 1mm 넘게 이마에 가깝다",
    () => {
      const { now, gNow, gBase } = files();
      const plate = plateOf(gBase);
      const match = matchPlate(gBase, gNow, plate);
      expect({ unmatched: match.unmatched.length }).toEqual({ unmatched: 0 });
      const faces = centralBackFaces(gBase, plate);
      // 기준 판의 가운데 뒷면이 몇 개는 있어야 이 판정이 무언가를 본다.
      expect(faces.length).toBeGreaterThan(20);
      const meanGap = (position: (i: number) => number[]) =>
        faces.reduce((sum, [a, b, c]) => {
          const center = [0, 1, 2].map((k) => (position(a)[k] + position(b)[k] + position(c)[k]) / 3);
          return sum + closestOnBody(center, now.P, now.I).distance;
        }, 0) / faces.length;
      const before = meanGap((i) => [gBase.P[3 * i], gBase.P[3 * i + 1], gBase.P[3 * i + 2]]);
      const after = meanGap((i) => {
        const j = match.toNew.get(i)!;
        return [gNow.P[3 * j], gNow.P[3 * j + 1], gNow.P[3 * j + 2]];
      });
      expect({ closerByMoreThan1mm: after < before - 0.001, beforeCm: cm(before), afterCm: cm(after) }).toEqual({ closerByMoreThan1mm: true, beforeCm: cm(before), afterCm: cm(after) });
    },
    SLOW
  );

  // 16 결정(사용자 "응"): 판 끝에서 띠가 머리에 닿기까지의 이음 구간은 "판 끝에서 멀어질수록 머리까지 거리가 줄어든다(늘지 않는다)"만 보고,
  // 그 밖의 띠는 1cm 안(가려진 면 뺌)이다. 이음 구간은 좌우 따로, 판 점에서 (그쪽 판 끝 뒷면이 몸에서 뜬 가장 큰 거리 + 2cm) 안의 띠 면이다.
  //   판 끝 뒷면 = 세 점이 모두 판 점이고 가운데가 그쪽으로 |x| > 0.15이며 몸을 향한(cos > 0.5) 판 삼각형. 띠가 판 끝에서 머리까지 그 거리만큼은
  //   옮겨 가야 하므로 그만큼에 2cm 여유를 둔다.
  //   "줄어든다"는 판 점에서의 거리 1cm 칸마다 띠 면의 가장 큰 뜬 거리를 잡아, 먼 칸이 가까운 칸보다 2mm 넘게 크지 않은지로 본다(삼각형 크기만큼의 흔들림을 봐준다).
  it(
    "G3b 띠(렌즈 판이 아닌 고글 면) 안쪽이 머리에서 뜨지 않는다: 몸을 향하고 다른 고글 면에 가려지지 않은 띠 면 중, 판 끝에서 머리까지의 이음 구간(판 점에서 판 끝 뒷면의 뜬 거리 + 2cm 안)은 판에서 멀어질수록 머리까지 거리가 늘지 않고(1cm 칸, 2mm 봐줌), 그 밖은 가운데가 모두 몸에서 1.0cm 안이다",
    () => {
      const { now, gNow, gBase } = files();
      const g = gNow;
      const plateNow = new Set(matchPlate(gBase, gNow, plateOf(gBase)).toNew.values());
      const platePoints = [...plateNow].map((i) => [g.P[3 * i], g.P[3 * i + 1], g.P[3 * i + 2]]);
      expect(platePoints.length).toBeGreaterThan(0);
      /** 고글 삼각형 t가 몸을 향하고 가려지지 않았으면 가운데와 몸까지 거리, 아니면 null. */
      const facingGap = (t: number): { center: number[]; gap: number } | null => {
        const [a, b, c] = [3 * g.I[t], 3 * g.I[t + 1], 3 * g.I[t + 2]];
        const center = [0, 1, 2].map((k) => (g.P[a + k] + g.P[b + k] + g.P[c + k]) / 3);
        const n = faceNormal(g, t);
        if (!n) return null;
        const { point, distance } = closestOnBody(center, now.P, now.I);
        if (distance < 1e-4) return { center, gap: distance };
        const dir = [0, 1, 2].map((k) => (point[k] - center[k]) / distance);
        if (n[0] * dir[0] + n[1] * dir[1] + n[2] * dir[2] <= 0.5) return null;
        // 가운데에서 가장 가까운 몸 점까지 가는 선분이 다른 고글 면(이 면과 꼭짓점을 함께 쓰지 않는 면)을 지나면 가려진 면이다.
        if (blockedByGoggles(g, t, center, point)) return null;
        return { center, gap: distance };
      };
      // 좌우 판 끝 뒷면이 몸에서 뜬 가장 큰 거리.
      const endGap = new Map<number, number>([[-1, 0], [1, 0]]);
      for (let t = 0; t < g.I.length; t += 3) {
        const tri = [g.I[t], g.I[t + 1], g.I[t + 2]];
        if (!tri.every((i) => plateNow.has(i))) continue;
        const x = (g.P[3 * tri[0]] + g.P[3 * tri[1]] + g.P[3 * tri[2]]) / 3;
        if (Math.abs(x) <= 0.15) continue;
        const face = facingGap(t);
        if (face) endGap.set(Math.sign(x), Math.max(endGap.get(Math.sign(x))!, face.gap));
      }
      let facing = 0;
      const floating: { at: number[]; cm: number }[] = [];
      const bridge = new Map<number, Map<number, number>>([[-1, new Map()], [1, new Map()]]);
      for (let t = 0; t < g.I.length; t += 3) {
        if ([g.I[t], g.I[t + 1], g.I[t + 2]].some((i) => plateNow.has(i))) continue;
        const face = facingGap(t);
        if (!face) continue;
        facing += 1;
        const { center, gap } = face;
        const side = center[0] < 0 ? -1 : 1;
        const fromPlate = Math.min(...platePoints.map((p) => Math.hypot(p[0] - center[0], p[1] - center[1], p[2] - center[2])));
        if (fromPlate <= endGap.get(side)! + 0.02) {
          const bin = Math.floor(fromPlate / 0.01);
          const bins = bridge.get(side)!;
          bins.set(bin, Math.max(bins.get(bin) ?? 0, gap));
        } else if (gap > 0.01) {
          floating.push({ at: center.map((v) => round(v, 3)), cm: cm(gap) });
        }
      }
      // 몸을 향한 띠 면이 거의 없으면 이 판정이 아무것도 보지 않은 것이다.
      expect(facing).toBeGreaterThan(30);
      const rising: { side: number; nearCm: number; nearGapCm: number; farCm: number; farGapCm: number }[] = [];
      for (const [side, bins] of bridge) {
        const sorted = [...bins.entries()].sort((p, q) => p[0] - q[0]);
        for (let i = 0; i < sorted.length; i += 1) {
          for (let j = i + 1; j < sorted.length; j += 1) {
            if (sorted[j][1] > sorted[i][1] + 0.002) rising.push({ side, nearCm: sorted[i][0], nearGapCm: cm(sorted[i][1]), farCm: sorted[j][0], farGapCm: cm(sorted[j][1]) });
          }
        }
      }
      const ends = { leftEndGapCm: cm(endGap.get(-1)!), rightEndGapCm: cm(endGap.get(1)!) };
      expect({ ...ends, rising: rising.slice(0, 10), count: floating.length, worst: floating.sort((p, q) => q.cm - p.cm).slice(0, 15) }).toEqual({ ...ends, rising: [], count: 0, worst: [] });
    },
    SLOW
  );

  it("G7 렌즈 판은 기준 고글의 렌즈 판을 돌리고 옮기기만 한 것이다: 기준 판의 점마다 같은 UV의 점이 지금 고글에 있고, 판 점 사이 거리가 모두 기준과 같으며(0.1mm 안), 거울상이 아니다", () => {
    const { gNow, gBase } = files();
    const plate = plateOf(gBase);
    // 기준 판이 판 점을 충분히 잡아야 이 판정이 무언가를 본다(기준 고글은 점 2,467개 중 1,761개).
    expect(plate.length).toBeGreaterThan(1500);
    const match = matchPlate(gBase, gNow, plate);
    expect({ unmatched: match.unmatched.length, sample: match.unmatched.slice(0, 5) }).toEqual({ unmatched: 0, sample: [] });
    const before = (i: number) => [gBase.P[3 * i], gBase.P[3 * i + 1], gBase.P[3 * i + 2]];
    const after = (i: number) => { const j = match.toNew.get(i)!; return [gNow.P[3 * j], gNow.P[3 * j + 1], gNow.P[3 * j + 2]]; };
    let worst = 0;
    for (let x = 0; x < plate.length; x += 1) {
      const a0 = before(plate[x]), a1 = after(plate[x]);
      for (let y = x + 1; y < plate.length; y += 1) {
        const b0 = before(plate[y]), b1 = after(plate[y]);
        const d = Math.abs(Math.hypot(a0[0] - b0[0], a0[1] - b0[1], a0[2] - b0[2]) - Math.hypot(a1[0] - b1[0], a1[1] - b1[1], a1[2] - b1[2]));
        if (d > worst) worst = d;
      }
    }
    expect({ sameDistances: worst <= 1e-4, worstMm: round(worst * 1000, 3) }).toEqual({ sameDistances: true, worstMm: round(worst * 1000, 3) });
    // 거울상이면 거리는 같아도 네 점이 이루는 부피의 부호가 뒤집힌다. 판 끝 넷(가장 왼쪽·오른쪽·위·앞)으로 본다.
    const pick = (score: (p: number[]) => number) => plate.reduce((best, i) => (score(before(i)) > score(before(best)) ? i : best), plate[0]);
    const corners = [pick((p) => -p[0]), pick((p) => p[0]), pick((p) => p[1]), pick((p) => p[2])];
    const volume = (pos: (i: number) => number[]) => {
      const [o, p, q, r] = corners.map(pos);
      const u = [0, 1, 2].map((k) => p[k] - o[k]), v = [0, 1, 2].map((k) => q[k] - o[k]), w = [0, 1, 2].map((k) => r[k] - o[k]);
      return u[0] * (v[1] * w[2] - v[2] * w[1]) - u[1] * (v[0] * w[2] - v[2] * w[0]) + u[2] * (v[0] * w[1] - v[1] * w[0]);
    };
    expect(Math.abs(volume(before))).toBeGreaterThan(1e-6);
    expect(Math.sign(volume(after))).toBe(Math.sign(volume(before)));
  });
});

/**
 * 렌즈 판: 기준 고글에서 UV 섬(인덱스로 이어진 점 묶음) 가운데 모든 점이 z ≥ 0.19(머리 앞쪽)인 섬의 점들.
 * 띠의 섬은 옆·뒤로 이어져 z가 0.19보다 작은 점을 품는다(기준 고글: 판 1,761점, 띠 706점).
 * 지금 고글의 판 점은 UV가 똑같은 점으로 짝짓는다(기준 고글의 UV는 점마다 모두 다르다). 판을 돌리고 옮기기만 하면 UV는 그대로이고,
 * 띠는 새로 만들어도 되므로 점 수가 달라도 된다.
 */
function plateOf(g: Goggles): number[] {
  const n = g.P.length / 3;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let t = 0; t < g.I.length; t += 3) {
    parent[find(g.I[t])] = find(g.I[t + 1]);
    parent[find(g.I[t + 1])] = find(g.I[t + 2]);
  }
  const islands = new Map<number, number[]>();
  for (let i = 0; i < n; i += 1) {
    const root = find(i);
    const list = islands.get(root) ?? [];
    list.push(i);
    islands.set(root, list);
  }
  return [...islands.values()].filter((island) => island.every((i) => g.P[3 * i + 2] >= 0.19)).flat().sort((a, b) => a - b);
}

function uvOf(g: Goggles): number[] {
  const prim = g.glb.json.meshes[meshNodes(g.glb)[0].mesh!].primitives[0];
  return values(g.glb, prim.attributes.TEXCOORD_0);
}

/** 기준 판 점 → 지금 고글에서 UV가 똑같은 점. */
function matchPlate(base: Goggles, now: Goggles, plate: number[]): { toNew: Map<number, number>; unmatched: number[] } {
  const uvNow = uvOf(now);
  const byUv = new Map<string, number[]>();
  for (let j = 0; j < uvNow.length / 2; j += 1) {
    const key = `${uvNow[2 * j]},${uvNow[2 * j + 1]}`;
    byUv.set(key, [...(byUv.get(key) ?? []), j]);
  }
  const uvBase = uvOf(base);
  const toNew = new Map<number, number>();
  const unmatched: number[] = [];
  for (const i of plate) {
    const found = byUv.get(`${uvBase[2 * i]},${uvBase[2 * i + 1]}`) ?? [];
    if (found.length === 1) toNew.set(i, found[0]);
    else unmatched.push(i);
  }
  return { toNew, unmatched };
}

/** 삼각형 t의 면 법선(파일의 꼭짓점 법선 쪽으로 맞춤). 넓이가 0이면 null. */
function faceNormal(g: Goggles, t: number): number[] | null {
  const [a, b, c] = [3 * g.I[t], 3 * g.I[t + 1], 3 * g.I[t + 2]];
  const u = [0, 1, 2].map((k) => g.P[b + k] - g.P[a + k]);
  const w = [0, 1, 2].map((k) => g.P[c + k] - g.P[a + k]);
  let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
  const length = Math.hypot(n[0], n[1], n[2]);
  if (length < 1e-12) return null;
  n = n.map((v) => v / length);
  const vn = [0, 1, 2].map((k) => g.N[a + k] + g.N[b + k] + g.N[c + k]);
  if (n[0] * vn[0] + n[1] * vn[1] + n[2] * vn[2] < 0) n = n.map((v) => -v);
  return n;
}

/** 기준 판의 가운데 뒷면: 세 점이 모두 판 점이고, 가운데의 |x| ≤ 0.10이며, 면 법선이 뒤(-z)를 향하는(n_z < -0.5) 삼각형의 세 점. */
function centralBackFaces(g: Goggles, plate: number[]): number[][] {
  const inPlate = new Set(plate);
  const out: number[][] = [];
  for (let t = 0; t < g.I.length; t += 3) {
    const tri = [g.I[t], g.I[t + 1], g.I[t + 2]];
    if (!tri.every((i) => inPlate.has(i))) continue;
    const x = (g.P[3 * tri[0]] + g.P[3 * tri[1]] + g.P[3 * tri[2]]) / 3;
    const n = faceNormal(g, t);
    if (Math.abs(x) <= 0.1 && n && n[2] < -0.5) out.push(tri);
  }
  return out;
}

/** 선분 from→to가 삼각형 self와 꼭짓점을 함께 쓰지 않는 고글 삼각형을 지나는가(Möller–Trumbore). */
function blockedByGoggles(g: Goggles, self: number, from: number[], to: number[]): boolean {
  const own = new Set([g.I[self], g.I[self + 1], g.I[self + 2]]);
  const d = [0, 1, 2].map((k) => to[k] - from[k]);
  for (let t = 0; t < g.I.length; t += 3) {
    if (t === self || own.has(g.I[t]) || own.has(g.I[t + 1]) || own.has(g.I[t + 2])) continue;
    const [a, b, c] = [3 * g.I[t], 3 * g.I[t + 1], 3 * g.I[t + 2]];
    const e1 = [0, 1, 2].map((k) => g.P[b + k] - g.P[a + k]);
    const e2 = [0, 1, 2].map((k) => g.P[c + k] - g.P[a + k]);
    const p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
    const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
    if (Math.abs(det) < 1e-15) continue;
    const s = [0, 1, 2].map((k) => from[k] - g.P[a + k]);
    const u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) / det;
    if (u < 0 || u > 1) continue;
    const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
    const v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) / det;
    if (v < 0 || u + v > 1) continue;
    const along = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det;
    if (along > 1e-6 && along < 1 - 1e-6) return true;
  }
  return false;
}

// ---------- 그대로 둘 동작: 고글의 크기·높이·색·붙는 방식 ----------

describe("[spec] 095 그대로: 고글의 크기(앞에서 본 폭·높이), 붙는 높이, 색, 머리 뼈에 붙는 방식", () => {
  const extent = (g: Goggles) => {
    let yLo = Infinity, yHi = -Infinity;
    for (let i = 1; i < g.P.length; i += 3) { yLo = Math.min(yLo, g.P[i]); yHi = Math.max(yHi, g.P[i]); }
    const cut = yLo + 0.75 * (yHi - yLo);
    let xLo = Infinity, xHi = -Infinity;
    for (let i = 0; i < g.P.length; i += 3) if (g.P[i + 1] >= cut) { xLo = Math.min(xLo, g.P[i]); xHi = Math.max(xHi, g.P[i]); }
    return { yLo, yHi, height: yHi - yLo, upperWidth: xHi - xLo };
  };

  it("G4 고글 높이(y 범위)와 높이 75% 위 부분의 폭(x 범위)이 기준의 ±5% 안이고, y 최저·최고가 기준의 ±1cm 안이다", () => {
    const { gNow, gBase } = files();
    const a = extent(gNow), b = extent(gBase);
    expect({ height: Math.abs(a.height / b.height - 1) <= 0.05, now: round(a.height, 4), base: round(b.height, 4) }).toEqual({ height: true, now: round(a.height, 4), base: round(b.height, 4) });
    expect({ upperWidth: Math.abs(a.upperWidth / b.upperWidth - 1) <= 0.05, now: round(a.upperWidth, 4), base: round(b.upperWidth, 4) }).toEqual({ upperWidth: true, now: round(a.upperWidth, 4), base: round(b.upperWidth, 4) });
    expect({ yLo: Math.abs(a.yLo - b.yLo) <= 0.01, now: round(a.yLo, 4), base: round(b.yLo, 4) }).toEqual({ yLo: true, now: round(a.yLo, 4), base: round(b.yLo, 4) });
    expect({ yHi: Math.abs(a.yHi - b.yHi) <= 0.01, now: round(a.yHi, 4), base: round(b.yHi, 4) }).toEqual({ yHi: true, now: round(a.yHi, 4), base: round(b.yHi, 4) });
  });

  it("G5 색: 고글 재질이 기준과 같고(양면, 금속 0, 거칠기 0.9, 바탕색 그림 하나), 그림이 하나이며 바이트까지 기준과 같다", () => {
    const { gNow, gBase } = files();
    expect(gNow.glb.json.materials).toEqual(gBase.glb.json.materials);
    expect((gNow.glb.json.images ?? []).length).toBe(1);
    expect(gNow.glb.json.images![0].mimeType).toBe(gBase.glb.json.images![0].mimeType);
    expect(imageBytes(gNow.glb, 0).equals(imageBytes(gBase.glb, 0))).toBe(true);
  });

  // 10 결정(사용자 "095 커밋만 보게"): 같은 브랜치의 다른 작업(096 84796ec, 097 a23400d)이 apps/mobile/src를 바꾸므로, "앱 코드를 바꾸지 않는다"는
  // 기준 커밋과의 전체 차이가 아니라 095 작업의 커밋만 본다. 095 작업의 커밋은 기준 커밋 뒤로 095가 다루는 파일(몸·고글 모델, 고글 아이콘,
  // build-goggles.py, CREDITS.md, 이 테스트 파일)을 바꾼 커밋이고, 그 커밋들 중 apps/mobile/src를 건드린 것이 없어야 한다.
  it("G6 붙는 방식: 메시가 있는 노드는 wear-goggles 하나이고 노드 변환·skin이 없으며(기준과 같음), 095 작업의 커밋(기준 커밋 뒤로 095가 다루는 파일을 바꾼 커밋)이 앱 코드(apps/mobile/src)를 바꾸지 않는다", () => {
    const { gNow, gBase } = files();
    const shape = (g: Glb) => ({
      nodes: g.json.nodes.map((n) => ({ name: n.name, mesh: n.mesh !== undefined, skin: n.skin, translation: n.translation, rotation: n.rotation, scale: n.scale, matrix: n.matrix })),
      skins: (g.json.skins ?? []).length
    });
    expect(shape(gNow.glb)).toEqual(shape(gBase.glb));
    expect(meshNodes(gNow.glb).map((n) => n.name)).toEqual(["wear-goggles"]);
    const ownPaths = [BODY_PATH, GOGGLES_PATH, ICON_PATH, BUILD_PATH, CREDITS_PATH, "apps/mobile/tests/lib/lobby3d-goggles-hug.spec.test.ts"];
    const log = spawnSync("git", ["log", "--format=%H", `${BASE}..HEAD`, "--", ...ownPaths], { cwd: REPO, encoding: "utf8" });
    expect(log.status).toBe(0);
    const commits = log.stdout.split(/\s+/).filter(Boolean);
    // 095의 테스트 커밋이 이미 있으므로 095 커밋이 하나도 없으면 찾는 방법이 잘못된 것이다.
    expect(commits.length).toBeGreaterThan(0);
    const touched = commits.flatMap((commit) => {
      const changed = spawnSync("git", ["diff-tree", "--no-commit-id", "--name-only", "-r", commit, "--", "apps/mobile/src"], { cwd: REPO, encoding: "utf8" });
      expect({ commit, status: changed.status }).toEqual({ commit, status: 0 });
      return changed.stdout.split(/\r?\n/).filter(Boolean).map((file) => `${commit.slice(0, 7)} ${file}`);
    });
    expect(touched).toEqual([]);
  });
});

// ---------- 바뀔 동작 3: 만드는 스크립트, 고글 아이콘, 출처 ----------

describe("[spec] 095 바뀔 동작 3: 고글 만드는 스크립트, 고글 아이콘, CREDITS", () => {
  it("M1 scripts/lobby3d/build-goggles.py가 있고 기준 커밋의 파일과 내용이 다르다(고글을 머리에 맞추는 단계를 바꿈. 14 결정으로 감싸기 대신 렌즈 판을 옮기고 띠를 맞춤)", () => {
    expect(text(nowFile(BUILD_PATH)) === text(baseFile(BUILD_PATH))).toBe(false);
  });

  it("M2 앱의 고글 아이콘 goggles.png가 기준 커밋의 파일과 바이트가 다르고, PNG이며 투명 채널이 있다", () => {
    const png = nowFile(ICON_PATH);
    expect(png.equals(baseFile(ICON_PATH))).toBe(false);
    expect(png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    let offset = 8;
    let alpha = png[25] === 4 || png[25] === 6;
    while (!alpha && offset + 8 <= png.length) {
      const kind = png.toString("ascii", offset + 4, offset + 8);
      if (kind === "tRNS") alpha = true;
      if (kind === "IEND") break;
      offset += 12 + png.readUInt32BE(offset);
    }
    expect(alpha).toBe(true);
  });

  it("M3 CREDITS.md의 writeloop.glb 줄과 wear-goggles.glb 줄이 각각 하나이고, 둘 다 기준 커밋의 같은 줄과 다르며, 라이선스 칸은 기준과 같다", () => {
    const lines = (text: string, file: string) => text.split(/\r?\n/).filter((line) => line.includes(`\`${file}\``));
    const now = text(nowFile(CREDITS_PATH));
    const base = text(baseFile(CREDITS_PATH));
    const license = (line: string) => line.split("|").map((s) => s.trim()).filter(Boolean).pop();
    for (const file of ["writeloop.glb", "wear-goggles.glb"]) {
      const a = lines(now, file), b = lines(base, file);
      expect({ file, count: a.length }).toEqual({ file, count: 1 });
      expect({ file, changed: a[0] !== b[0] }).toEqual({ file, changed: true });
      expect({ file, license: license(a[0]) }).toEqual({ file, license: license(b[0]) });
    }
  });
});

// ---------- 그대로 둘 동작: 서버 파일 ----------

describe("[spec] 095 그대로: 옷 내려받기·서버 아이템 목록 파일", () => {
  // 작업 128(가구점 실내) 10 결정(사용자 "qa가 고침")을 14 결정으로 줄인 것: 서버 목록에 가구점 진열 상품 항목 셋(walnutBed·grandmasFloorBedding·cloudDesk)과
  // 그 모델 파일 셋이 더해졌다(130에서 여섯으로)(실내·버들 애셋 항목과 목록 머리 설명 변경은 14 결정으로 없어졌다). 그것들만 빼고 견주고, 다른 옷·가구 항목과 파일이 그대로인 단언은 그대로다.
  // 작업 130(12 결정, 사용자 "qa가 고침"): 가구점 진열 상품이 여섯이 되고 상품마다 명패 그림이 더해졌다. 여섯 항목과 그 모델·명패 그림 파일을 뺀다.
  const SHOP_IDS = ["rainbootPlanter", "catPostDesk", "stargazerBed", "walnutBed", "grandmasFloorBedding", "cloudDesk"];
  const SHOP_FILES = ["rainboot-planter", "cat-post-desk", "stargazer-bed", "walnut-bed", "grandmas-floor-bedding", "cloud-desk"]
    .flatMap((name) => [`${name}.glb`, `${name}-nameplate.png`])
    .map((name) => `apps/backend/src/main/resources/catalog/files/${name}`);
  const ITEMS = "apps/backend/src/main/resources/catalog/items.json";
  // 작업 133 ③ 결정(사용자 "qa가 옷집 13종을 빼고 견주게 고침"): 서버 목록에 더해진 옷집 미등록 13종(stock.json catalogId null)과 그 모델 파일은 뺀다
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const CLOTHING_UNREGISTERED: string[] = (require("../../src/lib/lobby3d/clothing-shop-stock.json").products as { id: string; catalogId: string | null }[]).filter((p) => p.catalogId === null).map((p) => p.id);
  // 작업 133 09 결정(03): 13종 아이콘 PNG(<id>.png)도 뺀다
  const CLOTHING_FILES = CLOTHING_UNREGISTERED.flatMap((id) => [`apps/backend/src/main/resources/catalog/files/${id}.glb`, `apps/backend/src/main/resources/catalog/files/${id}.png`]);

  it("R1 서버 아이템 목록 폴더(apps/backend/src/main/resources/catalog)가 기준 커밋과 같다(다른 착용 옷 11개와 목록 파일 포함. 가구점 진열 상품 항목·파일은 뺀다)", () => {
    const diff = spawnSync("git", ["diff", "--name-only", BASE, "--", "apps/backend/src/main/resources/catalog"], { cwd: REPO, encoding: "utf8" });
    expect(diff.status).toBe(0);
    // 작업 134 ② 결정(사용자 2026-11-22 "새 목록대로 고침"): 사람형으로 바뀐 옷 모델 파일(wear-*.glb)과 새 사람형 옷 다섯의 모델 파일(wear-*.glb)도 뺀다
    const changed = diff.stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .filter((f) => !SHOP_FILES.includes(f) && !CLOTHING_FILES.includes(f) && f !== "apps/backend/src/main/resources/catalog/clothing-shop-stock.json" && !/\/catalog\/files\/wear-[^/]*\.glb$/.test(f));
    // 가구점 파일과 옷집 진열 파일(clothing-shop-stock.json) 말고는 목록 파일(items.json)만 바뀔 수 있다(다른 모델·그림 파일은 그대로)
    expect(changed).toEqual([ITEMS]);
    const base = JSON.parse(baseFile(ITEMS).toString("utf8")) as { _comment: string; items: { id: string }[] };
    const now = JSON.parse(readFileSync(join(REPO, ITEMS), "utf8")) as { _comment: string; items: { id: string }[] };
    // 가구점 항목을 빼면 기준 커밋의 항목과 차례·내용이 같다
    // 134 ②: 옷 항목은 사람형으로 바뀐 draw.body·draw.hide·files.model을 빼고 같고(조끼·고글·아이콘·부착·뼈·색은 그대로), 새 사람형 옷 다섯 항목은 뺀다
    const NEW_HUMAN_FIVE = ["wear-top-henley-oatmeal", "wear-bottom-chino-graphite", "wear-shoe-strap-sneaker", "wear-hat-newsboy-walnut", "wear-hat-pawprint-cap"];
    const plain = (item: { id: string }) => {
      const copy = JSON.parse(JSON.stringify(item)) as { draw?: Record<string, unknown>; files?: Record<string, unknown> };
      if (copy.draw) {
        delete copy.draw.body;
        delete copy.draw.hide;
      }
      if (copy.files) delete copy.files.model;
      return copy;
    };
    expect(now.items.filter((item) => !SHOP_IDS.includes(item.id) && !CLOTHING_UNREGISTERED.includes(item.id) && !NEW_HUMAN_FIVE.includes(item.id)).map(plain)).toEqual(base.items.map(plain));
    expect(NEW_HUMAN_FIVE.every((id) => now.items.some((item) => item.id === id))).toBe(true);
    expect(now.items.filter((item) => SHOP_IDS.includes(item.id)).map((item) => item.id).sort()).toEqual([...SHOP_IDS].sort());
    // 작업 134 ② 결정(사용자 2026-11-22 09): 머리 설명(_comment)은 사람형에 맞게 고쳐지므로 완전 일치를 빼고, 글이 있는 것만 본다
    expect(typeof now._comment).toBe("string");
    expect(now._comment.length).toBeGreaterThan(0);
  });
});
