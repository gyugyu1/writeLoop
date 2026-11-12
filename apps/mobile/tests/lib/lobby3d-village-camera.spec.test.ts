// [spec] qa 테스트(작업 088 ① 마을 장면, 새 기능, 모바일): 마을 카메라(C1~C4, C6).
// 기대값은 시나리오(private 작업 폴더 088-2026-11-13-바깥-마을/02-마을-장면/02-qa-scenarios.md)와
// 결정(04-main-decision.md 6: 카메라는 마을 범위(바닥) 안에서 따라가며 멈춘다)에서만 가져온다. "방과 같은" 값(기울기 42도, 시야각 30도,
// 카메라가 옆으로 돌지 않음, 따라갈 점을 그대로 따라감)은 지금 방 카메라의 값이다.
// 구현 코드는 부르는 방법(engine.ts의 applyArea·cameraPose·isFree·VIEW_WIDTH_*, village.ts의 VILLAGE_PLACES, village-layout.json의 분수 자리)을
// 알려고만 읽었다. 화면 크기는 명세에 없어 기존 방 카메라 시험과 같은 세 폰 화면을 쓴다.
import { VIEW_WIDTH_DEFAULT, VIEW_WIDTH_MAX, VIEW_WIDTH_MIN, applyArea, cameraPose, isFree, type FloorPoint } from "@/lib/lobby3d/engine";
import { VILLAGE_PLACES } from "@/lib/lobby3d/village";
import LAYOUT from "@/lib/lobby3d/village-layout.json";

type Vec3 = { x: number; y: number; z: number };
type Pose = { position: Vec3; lookAt: Vec3; fovDeg: number };
type Screen = [number, number];

const SCREENS: Screen[] = [
  [360, 640],
  [390, 844],
  [412, 915]
];
const PHONE: Screen = [390, 844];
const EPS = 1e-6;

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a.x, a.y, a.z);
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};

function pose(follow: FloorPoint, viewWidth: number, [w, h]: Screen): Pose {
  return cameraPose(follow, viewWidth, w / h) as Pose;
}

function camera(p: Pose, [w, h]: Screen) {
  const f = norm(sub(p.lookAt, p.position));
  const r = norm(cross(f, { x: 0, y: 1, z: 0 }));
  const u = cross(r, f);
  const tanV = Math.tan((p.fovDeg * Math.PI) / 360);
  const tanH = tanV * (w / h);
  return {
    /** 화면 점(가운데 0, 왼쪽·아래 -1, 오른쪽·위 +1)에서 쏜 선이 바닥(높이 0)에 닿는 점. 닿지 않으면 null. */
    groundAt(sx: number, sy: number): FloorPoint | null {
      const d = { x: f.x + r.x * sx * tanH + u.x * sy * tanV, y: f.y + r.y * sx * tanH + u.y * sy * tanV, z: f.z + r.z * sx * tanH + u.z * sy * tanV };
      if (d.y >= 0) return null;
      const t = -p.position.y / d.y;
      return { x: p.position.x + d.x * t, z: p.position.z + d.z * t };
    },
    project(q: Vec3) {
      const d = sub(q, p.position);
      const depth = dot(d, f);
      return { x: dot(d, r) / (depth * tanH), y: dot(d, u) / (depth * tanV), depth };
    }
  };
}

function nearestFreeTile(target: FloorPoint): FloorPoint {
  let best: FloorPoint | null = null;
  for (let c = 0; c < 28; c += 1) {
    for (let r = 0; r < 24; r += 1) {
      const p = { x: c + 0.5, z: r + 0.5 };
      if (isFree(p.x, p.z) && (!best || Math.hypot(p.x - target.x, p.z - target.z) < Math.hypot(best.x - target.x, best.z - target.z))) best = p;
    }
  }
  expect(best).not.toBeNull();
  return best!;
}

function viewWidths(): [string, number][] {
  const list: [string, number][] = [
    ["가장 가까이", VIEW_WIDTH_MIN],
    ["기본값", VIEW_WIDTH_DEFAULT],
    ["가장 멀리", VIEW_WIDTH_MAX]
  ];
  for (const k of [0.25, 0.5, 0.75]) list.push([`사이 ${k}`, VIEW_WIDTH_MIN + (VIEW_WIDTH_MAX - VIEW_WIDTH_MIN) * k]);
  return list;
}

beforeEach(() => {
  applyArea("village");
});

afterEach(() => {
  applyArea("room");
});

describe("[spec] 마을 카메라(C1~C4, C6)", () => {
  it("C1: 방과 같이 시야각 30도, 내려다보는 각 42도로 보고, 옆으로 돌지 않는다", () => {
    const follow = nearestFreeTile({ x: LAYOUT.fountain.x - 3, z: LAYOUT.fountain.z });
    const p = pose(follow, VIEW_WIDTH_DEFAULT, PHONE);
    expect(p.fovDeg).toBe(30);
    const d = sub(p.lookAt, p.position);
    const pitch = (Math.atan2(-d.y, Math.hypot(d.x, d.z)) * 180) / Math.PI;
    expect(Math.abs(pitch - 42)).toBeLessThanOrEqual(EPS);
    expect(Math.abs(p.position.x - p.lookAt.x)).toBeLessThanOrEqual(EPS);
  });

  it("C2: 마을 끝에서 먼 곳에서는 라룹이를 따라간다(보는 점 x = 따라갈 점 x, 앞으로 2칸 가면 보는 점도 2칸)", () => {
    let base: FloorPoint | null = null;
    for (let z = 9.5; z <= 13.5 && !base; z += 1) {
      for (let x = 9.5; x <= 16.5 && !base; x += 1) {
        if (isFree(x, z) && isFree(x + 3, z) && isFree(x, z + 2)) base = { x, z };
      }
    }
    expect(base).not.toBeNull();
    const a = pose(base!, VIEW_WIDTH_DEFAULT, PHONE);
    const right = pose({ x: base!.x + 3, z: base!.z }, VIEW_WIDTH_DEFAULT, PHONE);
    const front = pose({ x: base!.x, z: base!.z + 2 }, VIEW_WIDTH_DEFAULT, PHONE);
    expect(Math.abs(a.lookAt.x - base!.x)).toBeLessThanOrEqual(EPS);
    expect(Math.abs(right.lookAt.x - (base!.x + 3))).toBeLessThanOrEqual(EPS);
    expect(Math.abs(front.lookAt.z - a.lookAt.z - 2)).toBeLessThanOrEqual(EPS);
  });

  it("C3: 어느 화면·거리·자리에서도 화면 아래 모서리 둘과 아래 가운데에 보이는 바닥은 마을 칸 안이다", () => {
    const follows: FloorPoint[] = [
      nearestFreeTile({ x: 0, z: 0 }),
      nearestFreeTile({ x: 28, z: 0 }),
      nearestFreeTile({ x: 0, z: 24 }),
      nearestFreeTile({ x: 28, z: 24 }),
      ...Object.values(VILLAGE_PLACES).map((p) => p.approach[0])
    ];
    const outside: string[] = [];
    for (const screen of SCREENS) {
      for (const [name, width] of viewWidths()) {
        for (const follow of follows) {
          const cam = camera(pose(follow, width, screen), screen);
          for (const [sx, sy] of [
            [-1, -1],
            [1, -1],
            [0, -1]
          ]) {
            const g = cam.groundAt(sx, sy);
            const ok = g !== null && g.x >= -EPS && g.x <= 28 + EPS && g.z >= -EPS && g.z <= 24 + EPS;
            if (!ok) outside.push(`${screen.join("x")} ${name} 라룹이(${follow.x},${follow.z}) 화면(${sx},${sy}) → ${g ? `${g.x.toFixed(3)},${g.z.toFixed(3)}` : "닿지 않음"}`);
          }
        }
      }
    }
    expect(outside).toEqual([]);
  });

  it("C4: 마을 왼쪽·오른쪽 끝 근처에서는 카메라가 멈춰 더 따라가지 않는다", () => {
    let left: [FloorPoint, FloorPoint] | null = null;
    let right: [FloorPoint, FloorPoint] | null = null;
    for (let z = 2.5; z < 22 && !(left && right); z += 1) {
      if (!left && isFree(1.5, z) && isFree(2.5, z)) left = [{ x: 2.5, z }, { x: 1.5, z }];
      if (!right && isFree(26.5, z) && isFree(25.5, z)) right = [{ x: 25.5, z }, { x: 26.5, z }];
    }
    expect(left).not.toBeNull();
    expect(right).not.toBeNull();
    for (const [near, further] of [left!, right!]) {
      const a = pose(near, VIEW_WIDTH_DEFAULT, PHONE);
      const b = pose(further, VIEW_WIDTH_DEFAULT, PHONE);
      expect(Math.abs(a.lookAt.x - b.lookAt.x)).toBeLessThanOrEqual(EPS);
    }
  });

  it("C6: 기본 거리에서 라룹이 집 문 앞에 서면 분수와 라룹이 집 문이 한 화면에 들어온다", () => {
    const home = VILLAGE_PLACES.home;
    for (const screen of SCREENS) {
      const cam = camera(pose(home.approach[0], VIEW_WIDTH_DEFAULT, screen), screen);
      for (const [name, q] of [
        ["분수", { x: LAYOUT.fountain.x, y: 0, z: LAYOUT.fountain.z }],
        ["라룹이 집 문", { x: home.faceTo.x, y: 0, z: home.faceTo.z }]
      ] as [string, Vec3][]) {
        const s = cam.project(q);
        const inside = s.depth > 0 && Math.abs(s.x) <= 1 && Math.abs(s.y) <= 1;
        expect({ screen: screen.join("x"), name, inside }).toEqual({ screen: screen.join("x"), name, inside: true });
      }
    }
  });
});
