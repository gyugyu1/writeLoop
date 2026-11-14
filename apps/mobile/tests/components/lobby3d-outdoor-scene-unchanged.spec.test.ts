// [spec] qa 테스트(작업 081, 리팩터링: 로비 장면 짓기 빠르게, 모바일): 창밖 풍경(lobby3d-outdoor의 createOutdoor)이 짓는 장면을
// 고치기 전 코드 그대로 적어 둔다. 좋고 나쁨과 관계없이 지금 값이 기대값이고, 고치기 전에도 뒤에도 통과해야 한다.
// 명세(private 작업 폴더 081-2026-11-12-로비-장면-짓기-빠르게/01-main-spec.md) "바꾸지 않는 것"의 창밖 풍경 장면:
//   물체의 종류·개수·순서·위치·회전·크기, 모양의 꼭짓점 값(위치·법선·텍스처 좌표), 재질과 색, 보이고 숨기는 것,
//   시간에 따른 움직임(update), 하루의 때·계절 칠하기(setDaylight), 정리(dispose), 같은 씨앗의 난수 순서(나무가 같은 자리).
//
// 어떻게 적나:
// - three는 Jest를 거치지 않는 Node의 require로 읽는다(다른 lobby3d spec과 같은 까닭). 공 합치기(BufferGeometryUtils)도 같은
//   three를 쓰게, three는 ES 모듈 판(three.module.js)으로 읽고 BufferGeometryUtils도 Node로 읽는다(그 안의 import "three"가 같은 판이 된다).
// - 장면을 앞에서부터 차례로(traverse) 훑어 물체마다 한 줄(종류, 이름, 보임, 위치·회전·크기, 그리는 순서, 모양·재질 번호, 빛의 색·세기)로 적고,
//   모양마다 꼭짓점 값(속성별 배열)의 sha256, 재질마다 속성을 적어 Jest 스냅숏과 견준다. 스냅숏은 고치기 전 코드로 처음 돌 때 만든 것이다.
// - 꼭짓점 배열의 sha256은 -0을 0으로 바꾼 뒤 낸다(-0과 0은 그리기에서 같은 값이다). 그 밖에는 Float32 값이 한 비트라도 다르면 다르다.
// - 순서 번호(index)는 담은 배열 종류(Uint16·Uint32)와 관계없이 값만 본다. 속성 이름은 이름순으로 적는다(속성을 넣는 순서는 그리기와 무관하다). 경계 상자·구는 적지 않는다(three가 필요할 때 다시 계산하는 값이다).
// - 짓는 도중에 버리는 임시 모양(공 복제본 등)은 장면에 없으므로 적지 않는다. 정리는 장면에서 닿는 모양·재질이 모두 한 번씩 정리되는지 본다.
import * as THREE from "three";
import { createOutdoor, type Outdoor } from "@/components/lobby3d/lobby3d-outdoor";
import type { Ambience, DayPhase, Season } from "@/lib/lobby3d/daylight";

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

const nodeCrypto = (process as unknown as { getBuiltinModule: (id: string) => typeof import("crypto") }).getBuiltinModule("crypto");

// ---------- 적는 도우미 ----------

/** 숫자를 그대로(왕복 가능한 글자로) 적는다. -0은 0으로 적는다. */
const num = (n: number) => String(n === 0 ? 0 : n);
const v3 = (v: { x: number; y: number; z: number }) => `(${num(v.x)},${num(v.y)},${num(v.z)})`;
const rgb = (c: THREE.Color) => `(${num(c.r)},${num(c.g)},${num(c.b)})`;
const euler = (e: THREE.Euler) => `(${num(e.x)},${num(e.y)},${num(e.z)},${e.order})`;

/** 배열 값의 sha256(앞 24자). Float 배열은 -0을 0으로 바꾼 사본으로 낸다. */
function arrayHash(array: ArrayLike<number> & { constructor: { name: string }; buffer?: ArrayBufferLike }): string {
  let bytes: Uint8Array;
  if (array instanceof Float32Array || array instanceof Float64Array) {
    const copy = array.slice();
    for (let i = 0; i < copy.length; i += 1) if (copy[i] === 0) copy[i] = 0;
    bytes = new Uint8Array(copy.buffer, copy.byteOffset, copy.byteLength);
  } else {
    const typed = array as unknown as ArrayBufferView;
    bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
  }
  return nodeCrypto.createHash("sha256").update(bytes).digest("hex").slice(0, 24);
}

function attributeLine(name: string, attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): string {
  const array = (attribute as THREE.BufferAttribute).array as unknown as Float32Array;
  return `${name}:${attribute.itemSize}${attribute.normalized ? "n" : ""}x${attribute.count}:${array.constructor.name}:${arrayHash(array)}`;
}

function geometryLine(g: THREE.BufferGeometry): string {
  const names = Object.keys(g.attributes).sort();
  const attrs = names.map((name) => attributeLine(name, g.attributes[name])).join(" ");
  // 순서 번호(index)는 값만 본다(Uint16·Uint32 어느 배열에 담겨도 같은 번호면 같다)
  const index = g.index ? `${g.index.count}:${arrayHash(Uint32Array.from(g.index.array as unknown as ArrayLike<number>))}` : "none";
  const params = (g as unknown as { parameters?: unknown }).parameters;
  return [
    g.type,
    `params=${JSON.stringify(params ?? null)}`,
    `index=${index}`,
    `attrs=[${attrs}]`,
    `groups=${JSON.stringify(g.groups)}`,
    `draw=${g.drawRange.start},${g.drawRange.count}`,
    `morph=[${Object.keys(g.morphAttributes).sort().join(",")}]`
  ].join(" ");
}

function materialLine(m: THREE.Material): string {
  const any = m as unknown as Record<string, unknown>;
  const parts = [
    m.type,
    `name=${JSON.stringify(m.name)}`,
    `color=${any.color instanceof THREE.Color ? rgb(any.color) : "none"}`,
    `emissive=${any.emissive instanceof THREE.Color ? rgb(any.emissive) : "none"}`,
    `side=${m.side}`,
    `fog=${String(any.fog)}`,
    `transparent=${m.transparent}`,
    `opacity=${num(m.opacity)}`,
    `depthWrite=${m.depthWrite}`,
    `depthTest=${m.depthTest}`,
    `vertexColors=${m.vertexColors}`,
    `toneMapped=${m.toneMapped}`,
    `visible=${m.visible}`,
    `flatShading=${String(any.flatShading)}`,
    `wireframe=${String(any.wireframe)}`,
    `map=${any.map ? "yes" : "none"}`,
    `size=${any.size === undefined ? "none" : num(any.size as number)}`,
    `sizeAttenuation=${String(any.sizeAttenuation)}`
  ];
  return parts.join(" ");
}

interface Collected {
  objects: THREE.Object3D[];
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
}

/** 장면을 앞에서부터 훑어 물체, 처음 나온 순서의 모양·재질 목록을 모은다. */
function collect(scene: THREE.Object3D): Collected {
  const objects: THREE.Object3D[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  scene.traverse((o) => {
    objects.push(o);
    const withGeometry = o as THREE.Mesh;
    if (withGeometry.geometry && !geometries.includes(withGeometry.geometry)) geometries.push(withGeometry.geometry);
    const mats = withGeometry.material ? (Array.isArray(withGeometry.material) ? withGeometry.material : [withGeometry.material]) : [];
    for (const m of mats) if (!materials.includes(m)) materials.push(m);
  });
  return { objects, geometries, materials };
}

function depthOf(o: THREE.Object3D, root: THREE.Object3D): number {
  let depth = 0;
  for (let p = o; p !== root && p.parent; p = p.parent) depth += 1;
  return depth;
}

/** 물체 한 줄: 자리·보임·모양·재질·빛. */
function objectLine(o: THREE.Object3D, c: Collected, root: THREE.Object3D): string {
  const parts = [
    `${"  ".repeat(depthOf(o, root))}${o.type}`,
    `name=${JSON.stringify(o.name)}`,
    `visible=${o.visible}`,
    `pos=${v3(o.position)}`,
    `rot=${euler(o.rotation)}`,
    `scale=${v3(o.scale)}`,
    `renderOrder=${o.renderOrder}`,
    `frustumCulled=${o.frustumCulled}`,
    `layers=${o.layers.mask}`,
    `matrixAutoUpdate=${o.matrixAutoUpdate}`,
    `shadow=${o.castShadow}/${o.receiveShadow}`,
    `children=${o.children.length}`
  ];
  const mesh = o as THREE.Mesh;
  if (mesh.geometry) parts.push(`geo=${c.geometries.indexOf(mesh.geometry)}`);
  if (mesh.material) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    parts.push(`mat=[${mats.map((m) => c.materials.indexOf(m)).join(",")}]`);
  }
  const light = o as THREE.Light;
  if (light.isLight) {
    parts.push(`lightColor=${rgb(light.color)}`, `intensity=${num(light.intensity)}`);
    const hemi = o as THREE.HemisphereLight;
    if (hemi.isHemisphereLight) parts.push(`ground=${rgb(hemi.groundColor)}`);
    const directional = o as THREE.DirectionalLight;
    if (directional.isDirectionalLight) parts.push(`target=${c.objects.indexOf(directional.target)}`, `targetPos=${v3(directional.target.position)}`);
  }
  return parts.join(" ");
}

function fogLine(scene: THREE.Scene): string {
  const fog = scene.fog as THREE.Fog | null;
  return fog ? `${fog.constructor.name} color=${rgb(fog.color)} near=${num(fog.near)} far=${num(fog.far)}` : "none";
}

/** 장면 전체(물체·모양·재질·안개). */
function describeOutdoor(outdoor: Outdoor) {
  const c = collect(outdoor.scene);
  return {
    scene: `pos=${v3(outdoor.scene.position)} rot=${euler(outdoor.scene.rotation)} scale=${v3(outdoor.scene.scale)} background=${String(outdoor.scene.background)}`,
    fog: fogLine(outdoor.scene),
    counts: `objects=${c.objects.length} geometries=${c.geometries.length} materials=${c.materials.length}`,
    objects: c.objects.map((o) => objectLine(o, c, outdoor.scene)),
    geometries: c.geometries.map((g, i) => `${i} ${geometryLine(g)}`),
    materials: c.materials.map((m, i) => `${i} ${materialLine(m)}`)
  };
}

/** 하루의 때·계절을 칠한 뒤의 모습: 안개, 빛, 물체마다 보임, 재질 색, 하늘 꼭짓점 색(값과 다시 올린 횟수). */
function daylightState(outdoor: Outdoor) {
  const c = collect(outdoor.scene);
  const sky = c.objects.find((o) => (o as THREE.Mesh).isMesh && ((o as THREE.Mesh).geometry as THREE.BufferGeometry).attributes.color) as THREE.Mesh;
  const skyColor = (sky.geometry as THREE.BufferGeometry).attributes.color as THREE.BufferAttribute;
  return {
    fog: fogLine(outdoor.scene),
    lights: c.objects.filter((o) => (o as THREE.Light).isLight).map((o) => objectLine(o, c, outdoor.scene)),
    visible: c.objects.map((o) => (o.visible ? "1" : "0")).join(""),
    materials: c.materials.map((m, i) => `${i} ${materialLine(m)}`),
    sky: `${attributeLine("color", skyColor)} version=${skyColor.version}`
  };
}

/** 시간에 따라 움직인 뒤의 모습: 물체마다 자리·회전·크기·보임. */
function motionState(outdoor: Outdoor) {
  const c = collect(outdoor.scene);
  return c.objects.map((o, i) => `${i} ${o.type} visible=${o.visible} pos=${v3(o.position)} rot=${euler(o.rotation)} scale=${v3(o.scale)}`);
}

// ---------- 하루의 때 입력(테스트가 정한 값) ----------

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
const AMBIENCE_NIGHT: Ambience = {
  ...AMBIENCE_DAY,
  skyTop: 0x0b1530,
  skyHorizon: 0x22305a,
  outdoorSunColor: 0x8fa0d0,
  outdoorSunIntensity: 0.25,
  outdoorHemiIntensity: 0.45,
  stars: 1
};
const AMBIENCE_DUSK: Ambience = {
  ...AMBIENCE_DAY,
  skyTop: 0x3a4f8a,
  skyHorizon: 0xe59a6a,
  outdoorSunColor: 0xffb070,
  outdoorSunIntensity: 0.9,
  outdoorHemiIntensity: 0.9,
  stars: 0.4
};
const AMBIENCE_DAWN: Ambience = {
  ...AMBIENCE_DAY,
  skyTop: 0x8aa8d8,
  skyHorizon: 0xf2c6a0,
  outdoorSunColor: 0xffd0a0,
  outdoorSunIntensity: 1.1,
  outdoorHemiIntensity: 1.1,
  stars: 0.005
};

const DAYLIGHT_STEPS: { label: string; ambience: Ambience; season: Season; phase: DayPhase }[] = [
  { label: "낮 여름", ambience: AMBIENCE_DAY, season: "summer", phase: "day" },
  { label: "낮 여름(같은 값 다시)", ambience: AMBIENCE_DAY, season: "summer", phase: "day" },
  { label: "밤 겨울", ambience: AMBIENCE_NIGHT, season: "winter", phase: "night" },
  { label: "해 질 녘 가을", ambience: AMBIENCE_DUSK, season: "autumn", phase: "dusk" },
  { label: "새벽 봄(별 0.005)", ambience: AMBIENCE_DAWN, season: "spring", phase: "dawn" },
  { label: "낮 봄", ambience: AMBIENCE_DAY, season: "spring", phase: "day" },
  { label: "낮 겨울", ambience: AMBIENCE_DAY, season: "winter", phase: "day" },
  { label: "해 질 녘 여름", ambience: AMBIENCE_DUSK, season: "summer", phase: "sunset" }
];

// ---------- 테스트 ----------

describe("[spec] 창밖 풍경 장면은 고치기 전과 같다(081 리팩터링)", () => {
  test("K-O1 createOutdoor(0, 0)(로비가 부르는 값)의 물체·모양·재질·안개", () => {
    const outdoor = createOutdoor(0, 0);
    expect(describeOutdoor(outdoor)).toMatchSnapshot();
    outdoor.dispose();
  });

  test("K-O2 createOutdoor(3.5, 1.2)(창 가운데·풀밭 높이가 다른 값)의 물체·모양·재질·안개", () => {
    const outdoor = createOutdoor(3.5, 1.2);
    expect(describeOutdoor(outdoor)).toMatchSnapshot();
    outdoor.dispose();
  });

  test("K-O3 두 번 지으면 같은 장면이 따로 생긴다(같은 씨앗, 모양·재질을 함께 쓰지 않는다)", () => {
    const a = createOutdoor(0, 0);
    const b = createOutdoor(0, 0);
    expect(describeOutdoor(b)).toEqual(describeOutdoor(a));
    const ca = collect(a.scene);
    const cb = collect(b.scene);
    expect(cb.geometries.filter((g) => ca.geometries.includes(g))).toHaveLength(0);
    expect(cb.materials.filter((m) => ca.materials.includes(m))).toHaveLength(0);
    a.dispose();
    b.dispose();
  });

  test("K-O4 setDaylight: 하루의 때·계절마다 안개·빛·보임·재질 색·하늘 색(바뀐 것만 다시 칠한다)", () => {
    const outdoor = createOutdoor(0, 0);
    const states: Record<string, unknown> = { "처음(부르기 전)": daylightState(outdoor) };
    for (const step of DAYLIGHT_STEPS) {
      outdoor.setDaylight(step.ambience, step.season, step.phase);
      states[step.label] = daylightState(outdoor);
    }
    expect(states).toMatchSnapshot();
    outdoor.dispose();
  });

  test("K-O5 update: 시간에 따라 나무·덤불이 흔들리고 구름이 흐르고(끝에서 되돌아감) 나비가 난다", () => {
    const outdoor = createOutdoor(0, 0);
    const steps: [number, number][] = [
      [0, 0],
      [1.25, 0.016],
      [7.5, 0.05],
      [9, 200],
      [12.3, 0.033]
    ];
    const states: Record<string, unknown> = { "처음": motionState(outdoor) };
    for (const [t, dt] of steps) {
      outdoor.update(t, dt);
      states[`update(${t}, ${dt})`] = motionState(outdoor);
    }
    expect(states).toMatchSnapshot();
    outdoor.dispose();
  });

  test("K-O6 dispose: 장면에서 닿는 모양·재질이 짓는 동안에는 정리되지 않고, dispose 때 모두 한 번씩 정리된다", () => {
    const geometryDispose = jest.spyOn(THREE.BufferGeometry.prototype, "dispose");
    const materialDispose = jest.spyOn(THREE.Material.prototype, "dispose");
    try {
      const outdoor = createOutdoor(0, 0);
      const c = collect(outdoor.scene);
      const countFor = (spy: jest.SpyInstance, target: object) => spy.mock.contexts.filter((ctx) => ctx === target).length;
      expect(c.geometries.map((g) => countFor(geometryDispose, g))).toEqual(c.geometries.map(() => 0));
      expect(c.materials.map((m) => countFor(materialDispose, m))).toEqual(c.materials.map(() => 0));
      outdoor.dispose();
      expect(c.geometries.map((g) => countFor(geometryDispose, g))).toEqual(c.geometries.map(() => 1));
      expect(c.materials.map((m) => countFor(materialDispose, m))).toEqual(c.materials.map(() => 1));
      // 정리해도 장면의 물체는 그대로 남는다
      expect(collect(outdoor.scene).objects).toHaveLength(c.objects.length);
    } finally {
      geometryDispose.mockRestore();
      materialDispose.mockRestore();
    }
  });
});
