// [spec] qa 테스트(작업 112-② 시야 고르기 가볍게, 기능 변경, 모바일): InstanceCulling(apps/mobile/src/components/lobby3d/instance-culling.ts)의
// 판정을 구역 단위로 바꿔도 그리는 인스턴스가 111 명세의 기준 그대로인지를, 일부러 까다롭게 늘어놓은 인스턴스와 많은 카메라로 본다.
// 기대값은 명세(private 작업 폴더 112-2026-11-18-마을-그리기-JS-줄이기/02-시야-고르기-가볍게/01-main-spec.md "바뀌는 동작" 2와 "그대로여야 할 동작")에서만 가져온다:
// 인스턴스를 감싸는 공(원본 도형 boundingSphere를 그 인스턴스의 자리·방향·크기로 옮긴 것)이 카메라 시야에 조금이라도 걸리면 그리고, 전혀 걸리지 않으면 그리지 않는다.
// 구현 코드는 부르는 방법(new InstanceCulling(메시 목록), update(카메라), setColorAt(메시, 번호, 색))을 알려고만 읽었다.
//
// 어떻게 보나:
// - 진짜 three.js로 인스턴스 메시를 만든다(메시 자체는 원점, 돌림·크기 없음). 숨기는 일을 이 클래스가 하든 쓰는 쪽이 하든 같은 기준이 되도록,
//   "그려지는 인스턴스" = 메시가 visible이면 0번~count-1번 인스턴스(행렬·색), 보이지 않으면 하나도 없다.
// - 공이 여섯 면 모두에서 안쪽으로 1e-3 넘게 걸치면 "분명히 든다(in)", 한 면에서 바깥으로 1e-3 넘게 벗어나면 "분명히 안 든다(out)", 그 사이는 보지 않는다.
// - 까다로운 배치: 넓은 바닥에 흩은 작은 것, 여러 구역에 걸칠 만큼 큰 것(공의 가운데는 시야 밖 구역에 있어도 공이 시야에 걸릴 수 있다),
//   땅에서 높이 떠 있는 것, 멀리 떨어져 모인 것, 하나뿐인 메시.
// - 카메라: 정해 둔 시드로 만든 원근 카메라(자리·방향·시야각·가로세로비·가까운 면·먼 면이 제각각)와 직교 카메라, 그리고 위 배치를 겨냥한 카메라.
//
// 모두 그대로 둘 동작(구현 전·뒤 통과)이다. 바뀌는 판정 방법의 결과가 지금과 같아야 하기 때문이다.
import * as THREE from "three";
import { InstanceCulling } from "@/components/lobby3d/instance-culling";

jest.mock("three", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const file = require.resolve("three");
  return nodeModule.createRequire(file)(file);
});

jest.setTimeout(120000);

/** 정해 둔 시드의 의사 난수(0 이상 1 미만). */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type Spot = { x: number; y: number; z: number; turn: number; tilt: number; scale: number };

/** 원본 도형: 높이 2짜리 상자를 바닥 위로 올린 것(공의 가운데가 y=1에 있다. 나무처럼 바닥에 선 모양). */
function standingBox(): THREE.BufferGeometry {
  return new THREE.BoxGeometry(1, 2, 1).translate(0, 1, 0);
}

function makeMesh(spots: Spot[], withColor: boolean, rnd: () => number): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(standingBox(), new THREE.MeshLambertMaterial(), spots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  spots.forEach((s, i) => {
    q.setFromEuler(e.set(s.tilt, s.turn, 0));
    m.compose(new THREE.Vector3(s.x, s.y, s.z), q, new THREE.Vector3(s.scale, s.scale, s.scale));
    mesh.setMatrixAt(i, m);
    if (withColor) mesh.setColorAt(i, new THREE.Color(rnd(), rnd(), rnd()));
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

/** 까다로운 배치의 메시들. */
function buildMeshes(): { meshes: THREE.InstancedMesh[]; labels: string[] } {
  const rnd = seeded(112);
  // 넓은 바닥(-120~120)에 흩은 작은 것 700개(크기 0.3~3), 그 사이에 여러 구역에 걸치는 큰 것 30개(크기 12~40)
  const spread: Spot[] = [];
  for (let i = 0; i < 700; i += 1) spread.push({ x: -120 + 240 * rnd(), y: 0, z: -120 + 240 * rnd(), turn: rnd() * 6.28, tilt: 0, scale: 0.3 + 2.7 * rnd() });
  for (let i = 0; i < 30; i += 1) spread.push({ x: -120 + 240 * rnd(), y: 0, z: -120 + 240 * rnd(), turn: rnd() * 6.28, tilt: (rnd() - 0.5) * 0.8, scale: 12 + 28 * rnd() });
  // 높이 떠 있는 것(y 30~80)과 바닥 아래(y -40~-20)
  const air: Spot[] = [];
  for (let i = 0; i < 120; i += 1) air.push({ x: -80 + 160 * rnd(), y: rnd() < 0.7 ? 30 + 50 * rnd() : -40 + 20 * rnd(), z: -80 + 160 * rnd(), turn: rnd() * 6.28, tilt: rnd() * 3, scale: 0.5 + 4 * rnd() });
  // 멀리(400, 0, 400) 근처에 모인 것
  const far: Spot[] = [];
  for (let i = 0; i < 80; i += 1) far.push({ x: 400 + 6 * rnd(), y: 0, z: 400 + 6 * rnd(), turn: rnd() * 6.28, tilt: 0, scale: 0.5 + rnd() });
  // 하나뿐인 것
  const single: Spot[] = [{ x: 15, y: 0, z: -25, turn: 0.3, tilt: 0, scale: 2 }];
  return {
    meshes: [makeMesh(spread, true, rnd), makeMesh(air, false, rnd), makeMesh(far, true, rnd), makeMesh(single, false, rnd)],
    labels: ["넓게 흩은 것(큰 것 포함)", "떠 있는 것", "멀리 모인 것", "하나뿐인 것"]
  };
}

const keyOf = (m: THREE.Matrix4) => m.elements.map((v) => (Math.abs(v) < 5e-6 ? 0 : v).toFixed(5)).join(",");

type Inst = { key: string; matrix: THREE.Matrix4; color: string | null };

function slots(mesh: THREE.InstancedMesh, upTo = mesh.count): Inst[] {
  const out: Inst[] = [];
  const c = new THREE.Color();
  for (let i = 0; i < upTo; i += 1) {
    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(i, matrix);
    let color: string | null = null;
    if (mesh.instanceColor) {
      mesh.getColorAt(i, c);
      color = c.getHexString();
    }
    out.push({ key: keyOf(matrix), matrix, color });
  }
  return out;
}

const drawnOf = (mesh: THREE.InstancedMesh): Inst[] => (mesh.visible ? slots(mesh) : []);

type Base = { order: string[]; rows: Map<string, Inst> };

function baseOf(mesh: THREE.InstancedMesh): Base {
  const list = slots(mesh);
  const rows = new Map(list.map((i) => [i.key, i]));
  expect(rows.size).toBe(list.length);
  return { order: list.map((i) => i.key), rows };
}

const EPS = 1e-3;

function frustumOf(camera: THREE.Camera): THREE.Frustum {
  camera.updateMatrixWorld(true);
  return new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
}

function classify(mesh: THREE.InstancedMesh, matrix: THREE.Matrix4, frustum: THREE.Frustum): "in" | "out" | "edge" {
  if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
  const sphere = mesh.geometry.boundingSphere!.clone().applyMatrix4(matrix);
  let least = Infinity;
  for (const plane of frustum.planes) least = Math.min(least, plane.distanceToPoint(sphere.center) + sphere.radius);
  if (least < -EPS) return "out";
  if (least > EPS) return "in";
  return "edge";
}

type Check = { mesh: string; unknown: number; duplicated: number; missingIn: number; drawnOut: number; wrongColor: number };

function check(label: string, mesh: THREE.InstancedMesh, base: Base, camera: THREE.Camera, colorOf: (key: string) => string | null): { check: Check; counts: Record<"in" | "out" | "edge", number> } {
  const frustum = frustumOf(camera);
  const list = drawnOf(mesh);
  const seen = new Map<string, number>();
  let unknown = 0;
  let wrongColor = 0;
  for (const i of list) {
    seen.set(i.key, (seen.get(i.key) ?? 0) + 1);
    if (!base.rows.has(i.key)) unknown += 1;
    else if (colorOf(i.key) !== i.color) wrongColor += 1;
  }
  const counts = { in: 0, out: 0, edge: 0 };
  let missingIn = 0;
  let drawnOut = 0;
  for (const [key, row] of base.rows) {
    const c = classify(mesh, row.matrix, frustum);
    counts[c] += 1;
    if (c === "in" && !seen.has(key)) missingIn += 1;
    if (c === "out" && seen.has(key)) drawnOut += 1;
  }
  const duplicated = [...seen.values()].filter((n) => n > 1).length;
  return { check: { mesh: label, unknown, duplicated, missingIn, drawnOut, wrongColor }, counts };
}

const cleanOf = (c: Check): Check => ({ mesh: c.mesh, unknown: 0, duplicated: 0, missingIn: 0, drawnOut: 0, wrongColor: 0 });

function perspective(pos: [number, number, number], look: [number, number, number], fov: number, aspect: number, near: number, far: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.set(...pos);
  camera.lookAt(...look);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

function orthographic(pos: [number, number, number], look: [number, number, number], half: number, aspect: number, near: number, far: number): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera(-half * aspect, half * aspect, half, -half, near, far);
  camera.position.set(...pos);
  camera.lookAt(...look);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

/** 시드로 만든 카메라 260개와 배치를 겨냥한 카메라. */
function cameras(): [string, THREE.Camera][] {
  const rnd = seeded(2026);
  const out: [string, THREE.Camera][] = [];
  for (let i = 0; i < 220; i += 1) {
    const pos: [number, number, number] = [-150 + 300 * rnd(), 1 + 90 * rnd(), -150 + 300 * rnd()];
    const look: [number, number, number] = [-120 + 240 * rnd(), -10 + 30 * rnd(), -120 + 240 * rnd()];
    out.push([`원근 ${i}`, perspective(pos, look, 15 + 75 * rnd(), 0.4 + 1.8 * rnd(), 0.3 + 5 * rnd(), 20 + 280 * rnd())]);
  }
  for (let i = 0; i < 40; i += 1) {
    const pos: [number, number, number] = [-150 + 300 * rnd(), 5 + 90 * rnd(), -150 + 300 * rnd()];
    const look: [number, number, number] = [-120 + 240 * rnd(), 0, -120 + 240 * rnd()];
    out.push([`직교 ${i}`, orthographic(pos, look, 3 + 40 * rnd(), 0.4 + 1.8 * rnd(), 0.1 + 3 * rnd(), 30 + 300 * rnd())]);
  }
  // 겨냥: 큰 것의 가장자리만 걸치는 좁은 시야, 하늘만 보는 시야(떠 있는 것), 땅 아래를 보는 시야, 멀리 모인 것을 보는 시야, 하나뿐인 것을 보는 시야
  out.push(["좁은 시야(시야각 8)", perspective([0, 20, 60], [0, 0, 0], 8, 0.5, 1, 300)]);
  out.push(["하늘을 보는 시야", perspective([0, 40, 100], [0, 55, 0], 40, 1, 1, 300)]);
  out.push(["땅 아래를 보는 시야", perspective([0, -30, 100], [0, -30, 0], 40, 1, 1, 300)]);
  out.push(["멀리 모인 것을 보는 시야", perspective([403, 10, 420], [403, 0, 403], 30, 0.5, 1, 100)]);
  out.push(["멀리 모인 것의 반만 보는 시야", perspective([403, 10, 420], [398, 0, 403], 20, 0.5, 1, 100)]);
  out.push(["하나뿐인 것을 보는 시야", perspective([15, 8, -10], [15, 1, -25], 30, 0.5, 1, 100)]);
  out.push(["아무것도 없는 시야", perspective([2000, 10, 2000], [2100, 10, 2000], 30, 0.5, 1, 200)]);
  out.push(["먼 면이 가까운 시야(먼 면 15)", perspective([0, 6, 20], [0, 0, 0], 50, 1, 0.5, 15)]);
  out.push(["가까운 면이 먼 시야(가까운 면 60)", perspective([0, 30, 140], [0, 0, 0], 50, 1, 60, 300)]);
  return out;
}

describe("[spec] 112-② 그대로 둘 동작: InstanceCulling의 판정 결과는 공이 시야에 조금이라도 걸리면 그리고 전혀 안 걸리면 그리지 않는 111 기준 그대로다", () => {
  it("U1 많은 카메라(명세 바뀌는 동작 2): 넓게 흩은 것·여러 구역에 걸치는 큰 것·떠 있는 것·멀리 모인 것·하나뿐인 것을 시드 카메라 260개와 겨냥한 카메라로 한 번씩 고르면, 매번 메시마다 분명히 드는 인스턴스는 모두, 분명히 안 드는 인스턴스는 하나도 그려지지 않고, 그려지는 인스턴스는 원래 행렬·색이며 겹치지 않는다", () => {
    const { meshes, labels } = buildMeshes();
    const bases = meshes.map(baseOf);
    const culling = new InstanceCulling(meshes);
    const totals = meshes.map(() => ({ in: 0, out: 0, mixed: 0 }));
    const failures: unknown[] = [];
    for (const [name, camera] of cameras()) {
      culling.update(camera);
      meshes.forEach((mesh, k) => {
        const got = check(labels[k], mesh, bases[k], camera, (key) => bases[k].rows.get(key)!.color);
        totals[k].in += got.counts.in;
        totals[k].out += got.counts.out;
        if (got.counts.in > 0 && got.counts.out > 0) totals[k].mixed += 1;
        const want = cleanOf(got.check);
        if (JSON.stringify(got.check) !== JSON.stringify(want)) failures.push({ camera: name, ...got.check });
      });
    }
    expect(failures).toEqual([]);
    // 카메라들이 메시마다 실제로 인스턴스를 갈랐어야 뜻이 있다
    expect(totals.map((t, k) => ({ mesh: labels[k], inSeen: t.in > 0, outSeen: t.out > 0, mixedSeen: k === 3 ? "보지 않음" : t.mixed > 0 }))).toEqual(
      labels.map((label, k) => ({ mesh: label, inSeen: true, outSeen: true, mixedSeen: k === 3 ? "보지 않음" : true }))
    );
  });

  it("U2 큰 것의 가장자리(명세 바뀌는 동작 2 '조금이라도 걸리면'): 공의 가운데는 시야에서 멀리 떨어져 있고 공의 끝만 시야에 걸리는 큰 인스턴스는 그려진다. 같은 자리의 작은 인스턴스는 그려지지 않는다", () => {
    // 크기 40(공 반지름 약 49)짜리를 x축 위에 두고, 작은 것(크기 1)을 같은 자리에 둔다. 시야는 원점 근처만 본다.
    // 자리는 큰 것의 공이 시야에 1칸 안쪽으로만 걸리는 첫 x(0.5칸 간격)로 고른다(테스트 준비: 공 가운데는 시야 밖)
    const rnd = seeded(7);
    const camera = perspective([0, 10, 30], [0, 0, 0], 30, 1, 1, 100);
    const f = frustumOf(camera);
    const probe = makeMesh([{ x: 0, y: 0, z: 0, turn: 0, tilt: 0, scale: 40 }], false, rnd);
    probe.geometry.computeBoundingSphere();
    const reach = (x: number) => {
      const s = probe.geometry.boundingSphere!.clone().applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, 0, 0), new THREE.Quaternion(), new THREE.Vector3(40, 40, 40)));
      return { least: Math.min(...f.planes.map((p) => p.distanceToPoint(s.center) + s.radius)), center: s.center };
    };
    let x = 0;
    while (reach(x).least > 1) x += 0.5;
    const big = makeMesh([{ x, y: 0, z: 0, turn: 0, tilt: 0, scale: 40 }], false, rnd);
    const small = makeMesh([{ x, y: 0, z: 0, turn: 0, tilt: 0, scale: 1 }], false, rnd);
    const bases = [baseOf(big), baseOf(small)];
    const culling = new InstanceCulling([big, small]);
    // 겨냥이 맞는지: 큰 것은 분명히 들고(1칸 안쪽까지만), 작은 것은 분명히 안 들며, 큰 것의 공 가운데는 시야 밖이다
    const first = (b: Base) => b.rows.values().next().value!.matrix;
    expect({ big: classify(big, first(bases[0]), f), small: classify(small, first(bases[1]), f), centerInside: f.containsPoint(reach(x).center), least: reach(x).least > 0.5 }).toEqual({
      big: "in",
      small: "out",
      centerInside: false,
      least: true
    });
    culling.update(camera);
    expect({ big: drawnOf(big).length, small: drawnOf(small).length }).toEqual({ big: 1, small: 0 });
  });

  it("U3 고를 것이 0인 동안 바꾼 색(명세 그대로 '시야 밖에서 계절이 바뀐 뒤 들어온 그루도 그때 계절 색'): 아무것도 없는 시야로 고른 뒤 모든 인스턴스 색을 바꾸고 프레임을 더 돌린 다음 시야를 옮기면, 그려지는 인스턴스가 바꾼 색이다", () => {
    const { meshes, labels } = buildMeshes();
    const bases = meshes.map(baseOf);
    const culling = new InstanceCulling(meshes);
    const empty = perspective([2000, 10, 2000], [2100, 10, 2000], 30, 0.5, 1, 200);
    culling.update(empty);
    expect(meshes.map((m) => drawnOf(m).length)).toEqual(meshes.map(() => 0));
    const painted = new Map<string, string>();
    meshes.forEach((mesh, k) => {
      if (!mesh.instanceColor) return;
      bases[k].order.forEach((key, i) => {
        const c = new THREE.Color().setHSL((i % 97) / 97, 0.6, 0.5);
        culling.setColorAt(mesh, i, c);
        painted.set(`${k}|${key}`, c.getHexString());
      });
    });
    culling.update(empty);
    culling.update(empty);
    for (const [name, camera] of cameras().slice(0, 30)) {
      culling.update(camera);
      meshes.forEach((mesh, k) => {
        const got = check(labels[k], mesh, bases[k], camera, (key) => (mesh.instanceColor ? painted.get(`${k}|${key}`)! : null));
        expect({ camera: name, ...got.check }).toEqual({ camera: name, ...cleanOf(got.check) });
      });
    }
  });

  it("U4 카메라가 없으면 모두 원래 순서로(명세 그대로 '카메라가 없으면 모든 인스턴스를 원래 순서로 그린다')와 같은 카메라면 다시 쓰지 않음(명세 그대로 'version이 늘지 않음'): 여러 시야로 고른 뒤 카메라 없이(null·undefined) 부르면 메시가 보이고 0번~끝이 처음 순서·행렬·색이다. 같은 카메라로 다시 부르면 instanceMatrix·instanceColor version이 늘지 않는다", () => {
    const { meshes, labels } = buildMeshes();
    const bases = meshes.map(baseOf);
    const culling = new InstanceCulling(meshes);
    const list = cameras();
    for (const missing of [null, undefined]) {
      for (const [, camera] of list.slice(0, 12)) culling.update(camera);
      culling.update(list[list.length - 3][1]);
      culling.update(missing);
      expect(meshes.map((m, k) => ({ mesh: labels[k], missing: String(missing), visible: m.visible, count: m.count, order: slots(m).map((i) => i.key), colors: slots(m).map((i) => i.color) }))).toEqual(
        meshes.map((m, k) => ({ mesh: labels[k], missing: String(missing), visible: true, count: bases[k].order.length, order: bases[k].order, colors: bases[k].order.map((key) => bases[k].rows.get(key)!.color) }))
      );
    }
    for (const [name, camera] of [list[0], list[5], list[list.length - 3]]) {
      culling.update(camera);
      const versions = () => meshes.map((m, k) => ({ camera: name, mesh: labels[k], matrix: m.instanceMatrix.version, color: m.instanceColor?.version ?? null }));
      const before = versions();
      culling.update(camera);
      culling.update(camera);
      expect(versions()).toEqual(before);
    }
  });
});
