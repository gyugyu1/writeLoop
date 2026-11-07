// [spec] qa 테스트 도우미(작업 063). glb 파일에서 뼈대와 동작 클립을 읽고, 클립을 정한 시각에 샘플한다.
// lobby3d-character-clips-063.spec.test.ts와 그 기준값(lobby3d-character-clips-before-063.json)을 만드는 데 함께 쓴다.
// 파일 이름이 .test.로 끝나지 않아 Jest가 테스트로 돌리지 않는다.

export type GltfNode = {
  name?: string;
  children?: number[];
  translation?: number[];
  rotation?: number[];
  scale?: number[];
};
type Accessor = { bufferView?: number; byteOffset?: number; componentType: number; count: number; type: string; max?: number[] };
type Sampler = { input: number; output: number; interpolation?: string };
type Channel = { sampler: number; target: { node?: number; path: string } };
export type Animation = { name: string; samplers: Sampler[]; channels: Channel[] };
export type Gltf = {
  nodes?: GltfNode[];
  skins?: { joints: number[] }[];
  accessors?: Accessor[];
  bufferViews?: { byteOffset?: number; byteLength: number }[];
  animations?: Animation[];
};

export const PATHS = ["translation", "rotation", "scale"] as const;
export type TrsPath = (typeof PATHS)[number];
const WIDTH: Record<TrsPath, number> = { translation: 3, rotation: 4, scale: 3 };
const DEFAULT: Record<TrsPath, number[]> = { translation: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] };
const COMPONENTS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

export interface ParsedGlb {
  gltf: Gltf;
  bin: Buffer;
}

export function parseGlb(buffer: Buffer): ParsedGlb {
  if (buffer.toString("ascii", 0, 4) !== "glTF") throw new Error("glTF 바이너리가 아니다");
  const jsonLength = buffer.readUInt32LE(12);
  const gltf = JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength)) as Gltf;
  const binHeader = 20 + jsonLength;
  const binLength = buffer.readUInt32LE(binHeader);
  const bin = buffer.subarray(binHeader + 8, binHeader + 8 + binLength);
  return { gltf, bin };
}

function readFloats({ gltf, bin }: ParsedGlb, index: number): number[] {
  const accessor = gltf.accessors![index];
  if (accessor.componentType !== 5126) throw new Error(`float가 아닌 접근자(${accessor.componentType})는 다루지 않는다`);
  const view = gltf.bufferViews![accessor.bufferView!];
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const total = accessor.count * COMPONENTS[accessor.type];
  const out: number[] = [];
  for (let i = 0; i < total; i += 1) out.push(bin.readFloatLE(start + i * 4));
  return out;
}

/** 뼈대(skin 0)의 뼈 이름과 부모 뼈 이름(부모가 뼈대 밖이면 null)을 순서대로. */
export function skeleton({ gltf }: ParsedGlb): { name: string; parent: string | null }[] {
  const nodes = gltf.nodes ?? [];
  const parentOf = new Map<number, number>();
  nodes.forEach((node, index) => (node.children ?? []).forEach((child) => parentOf.set(child, index)));
  const joints = gltf.skins?.[0]?.joints ?? [];
  const jointSet = new Set(joints);
  return joints.map((index) => {
    const parent = parentOf.get(index);
    return { name: nodes[index].name ?? "", parent: parent !== undefined && jointSet.has(parent) ? nodes[parent].name ?? "" : null };
  });
}

export function clipNames({ gltf }: ParsedGlb): string[] {
  return (gltf.animations ?? []).map((animation) => animation.name);
}

/** 클립 길이(초): 클립의 모든 시각 접근자 max 중 가장 큰 값. */
export function clipDuration(parsed: ParsedGlb, name: string): number {
  const animation = findClip(parsed, name);
  return Math.max(...animation.samplers.map((sampler) => parsed.gltf.accessors![sampler.input].max?.[0] ?? 0));
}

/** 클립이 정한 키 시각들(가장 촘촘한 시각 접근자). */
export function clipKeyTimes(parsed: ParsedGlb, name: string): number[] {
  const animation = findClip(parsed, name);
  let best: number[] = [];
  for (const sampler of animation.samplers) {
    const times = readFloats(parsed, sampler.input);
    if (times.length > best.length) best = times;
  }
  return best;
}

function findClip(parsed: ParsedGlb, name: string): Animation {
  const animation = (parsed.gltf.animations ?? []).find((a) => a.name === name);
  if (!animation) throw new Error(`클립 없음: ${name}`);
  return animation;
}

/**
 * 클립의 뼈 하나·경로 하나를 시각 t(초)에 샘플한다. 채널이 없으면 그 노드의 기본 자세 값을 쓴다.
 * LINEAR는 성분별 직선 보간(회전은 보간 뒤 길이 1로), STEP은 앞 키, CUBICSPLINE은 키 값만 직선 보간한다.
 */
export function sampleChannel(parsed: ParsedGlb, name: string, bone: string, path: TrsPath, t: number): number[] {
  const animation = findClip(parsed, name);
  const nodes = parsed.gltf.nodes ?? [];
  const nodeIndex = nodes.findIndex((node) => node.name === bone);
  if (nodeIndex < 0) throw new Error(`노드 없음: ${bone}`);
  const channel = animation.channels.find((c) => c.target.node === nodeIndex && c.target.path === path);
  if (!channel) return [...(nodes[nodeIndex][path] ?? DEFAULT[path])];
  const sampler = animation.samplers[channel.sampler];
  const times = readFloats(parsed, sampler.input);
  const raw = readFloats(parsed, sampler.output);
  const width = WIDTH[path];
  const interpolation = sampler.interpolation ?? "LINEAR";
  const valueAt = (key: number) => {
    const base = interpolation === "CUBICSPLINE" ? (key * 3 + 1) * width : key * width;
    return raw.slice(base, base + width);
  };
  if (t <= times[0]) return valueAt(0);
  if (t >= times[times.length - 1]) return valueAt(times.length - 1);
  let k = 0;
  while (k < times.length - 2 && times[k + 1] <= t) k += 1;
  if (interpolation === "STEP") return valueAt(k);
  const a = valueAt(k);
  const b = valueAt(k + 1);
  const u = (t - times[k]) / (times[k + 1] - times[k]);
  let mixed = a.map((value, i) => value + (b[i] - value) * u);
  if (path === "rotation") {
    // 짧은 쪽으로 보간한다
    const dot = a.reduce((sum, value, i) => sum + value * b[i], 0);
    if (dot < 0) mixed = a.map((value, i) => value + (-b[i] - value) * u);
    const length = Math.hypot(...mixed);
    mixed = mixed.map((value) => value / length);
  }
  return mixed;
}

/** 두 회전(사원수) 사이 각도(라디안). q와 −q는 같은 회전으로 본다. */
export function rotationAngle(a: number[], b: number[]): number {
  const dot = Math.abs(a.reduce((sum, value, i) => sum + value * b[i], 0) / (Math.hypot(...a) * Math.hypot(...b)));
  return 2 * Math.acos(Math.min(1, dot));
}

/** 기준값을 만들 때 쓰는 샘플 시각: 키 시각 중 고르게 9개(처음과 끝 포함). */
export function sampleTimes(keyTimes: number[]): number[] {
  const count = 9;
  const picked: number[] = [];
  for (let i = 0; i < count; i += 1) picked.push(keyTimes[Math.round((i * (keyTimes.length - 1)) / (count - 1))]);
  return picked;
}
