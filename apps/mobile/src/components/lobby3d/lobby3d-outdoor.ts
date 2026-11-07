import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Ambience, DayPhase, Season } from "@/lib/lobby3d/daylight";

// 라룹이 방 창문 너머의 바깥(실제 풍경이 아니다). 방과 따로 둔 장면이라 방 화면에는 그려지지 않고,
// lobby3d-furniture가 창문 자리에서 들여다본 모습을 그림판에 그려 창 안쪽에 붙인다.
// 좌표는 방과 같은 앱 좌표(칸)다. 뒷벽 바깥면(z = -0.4) 뒤, z가 음수인 쪽에 놓는다.
// 하늘·구름·먼 언덕·나무·울타리·덤불·꽃·나비·별. 멀수록 하늘빛으로 옅어지고, 나무가 바람에 흔들리고 구름이 흘러간다.
// 하늘색·햇빛·별은 하루의 때를, 잎·풀·눈은 계절을 따른다(setDaylight).

/** 바깥 장면. update는 매 프레임 부른다(t: 지난 시간 초, dt: 앞 프레임과의 차이 초). */
export interface Outdoor {
  scene: THREE.Scene;
  update(t: number, dt: number): void;
  /** 하루의 때 색감과 계절. 매 프레임 불러도 되고, 바뀐 것만 다시 칠한다. */
  setDaylight(ambience: Ambience, season: Season, phase: DayPhase): void;
  dispose(): void;
}

const SKY_TOP = 0x76b8ea;
const SKY_HORIZON = 0xd4ecf6;

/** 계절마다 칠하는 색. 잎·언덕·덤불은 자리마다(나무마다 정한 번호) 다른 색을 쓴다. 봄은 넷 중 둘이 벚꽃이다. */
const SEASON_COLORS: Record<Season, { leaves: number[]; pine: number; ground: number; hills: number[]; bushes: number[] }> = {
  spring: {
    leaves: [0xf6b3ca, 0x93d16a, 0xf9c6d7, 0x80c65d],
    pine: 0x4a9a5a,
    ground: 0x9ed66e,
    hills: [0x9fd08a, 0x92c880, 0xa6d590, 0x9ccf84],
    bushes: [0x78c060, 0x86c868, 0x6db85a]
  },
  summer: {
    leaves: [0x4f9d4c, 0x5aa850, 0x438f48, 0x63b057],
    pine: 0x3a8650,
    ground: 0x7cc15a,
    hills: [0x86bf7a, 0x7cb672, 0x8ec683, 0x93ca7c],
    bushes: [0x5aa95a, 0x67b45d, 0x4f9d55]
  },
  autumn: {
    leaves: [0xe8892e, 0xd65a30, 0xe9b83a, 0xc9752a],
    pine: 0x3f7f4f,
    ground: 0xc4b25e,
    hills: [0xc6b06a, 0xb89a5a, 0xd0b874, 0xc0a866],
    bushes: [0xa4a046, 0xc08a3a, 0xb46a34]
  },
  winter: {
    leaves: [0xeef3f6, 0xeef3f6, 0xeef3f6, 0xeef3f6],
    pine: 0x3d7a55,
    ground: 0xf1f5f8,
    hills: [0xe4ecf2, 0xdbe5ee, 0xe8eef3, 0xdfe8ef],
    bushes: [0xe6edf2, 0xdfe7ee, 0xeaf0f4]
  }
};

/** 같은 씨앗이면 늘 같은 자리에 나무를 심는다. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** centerX는 창 가운데 x, groundY는 바깥 풀밭 높이다(창턱이 풀밭에서 1.2쯤 위에 오게 앱이 정한다). */
export function createOutdoor(centerX: number, groundY: number): Outdoor {
  const scene = new THREE.Scene();
  scene.position.y = groundY;
  scene.fog = new THREE.Fog(SKY_HORIZON, 9, 55);
  const geometries: THREE.BufferGeometry[] = [];
  const materials = new Map<number, THREE.MeshLambertMaterial>();
  const geo = <T extends THREE.BufferGeometry>(g: T) => {
    geometries.push(g);
    return g;
  };
  const mat = (color: number) => {
    let m = materials.get(color);
    if (!m) {
      m = new THREE.MeshLambertMaterial({ color });
      materials.set(color, m);
    }
    return m;
  };
  const ball = geo(new THREE.IcosahedronGeometry(1, 2));
  // 공 여러 개를 한 모양으로 합친다(그리는 횟수를 줄인다). 공마다 [x, y, z, 가로 반지름, 세로 반지름, 깊이 반지름].
  const balls = (parts: readonly (readonly [number, number, number, number, number, number])[]) => {
    const pieces = parts.map(([x, y, z, rx, ry, rz]) =>
      ball.clone().applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(rx, ry, rz)))
    );
    const merged = geo(mergeGeometries(pieces));
    for (const piece of pieces) piece.dispose();
    return merged;
  };
  const rnd = seeded(7);
  const pick = <T>(items: readonly T[]) => items[Math.floor(rnd() * items.length)];

  // 하늘: 안쪽을 그리는 큰 공. 위는 맑은 하늘색, 지평선 쪽은 옅게(안개와 같은 색으로 이어진다).
  const skyGeometry = geo(new THREE.SphereGeometry(90, 24, 12));
  const skyColors = new THREE.BufferAttribute(new Float32Array(skyGeometry.attributes.position.count * 3), 3);
  skyGeometry.setAttribute("color", skyColors);
  let skyShown = { top: -1, horizon: -1 };
  const paintSky = (topHex: number, horizonHex: number) => {
    if (skyShown.top === topHex && skyShown.horizon === horizonHex) return;
    skyShown = { top: topHex, horizon: horizonHex };
    const top = new THREE.Color(topHex);
    const horizon = new THREE.Color(horizonHex);
    const pos = skyGeometry.attributes.position;
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i += 1) {
      c.copy(horizon).lerp(top, THREE.MathUtils.clamp(pos.getY(i) / 45, 0, 1));
      skyColors.setXYZ(i, c.r, c.g, c.b);
    }
    skyColors.needsUpdate = true;
  };
  paintSky(SKY_TOP, SKY_HORIZON);
  const skyMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
  const sky = new THREE.Mesh(skyGeometry, skyMaterial);
  sky.position.set(centerX, 0, -10);
  scene.add(sky);

  // 빛: 하늘빛·풀빛 반사광과, 앞쪽 왼편 위에서 비치는 따뜻한 햇빛(창에서 보이는 쪽이 밝다)
  const hemi = new THREE.HemisphereLight(0xe4f4ff, 0x6f9f55, 1.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d8, 1.7);
  sun.position.set(centerX - 8, 14, 10);
  sun.target.position.set(centerX, 0, -8);
  scene.add(sun, sun.target);

  // 풀밭
  // 계절마다 다시 칠하는 재질(잎·소나무·풀밭·언덕·덤불)
  const seasonal = (count: number) => Array.from({ length: count }, () => new THREE.MeshLambertMaterial({ color: 0xffffff }));
  const leafMats = seasonal(4);
  const pineMat = new THREE.MeshLambertMaterial({ color: 0x3f8f55 });
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x8cc76a });
  const hillMats = seasonal(4);
  const bushMats = seasonal(3);
  const ground = new THREE.Mesh(geo(new THREE.PlaneGeometry(220, 220)), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(centerX, -0.02, -60);
  scene.add(ground);

  // 먼 언덕: 납작한 공 몇 개(안개에 옅어진다)
  for (const [i, [dx, z, sx, sy]] of (
    [
      [-22, -48, 26, 9],
      [8, -55, 30, 12],
      [30, -46, 22, 8],
      [-4, -36, 16, 4.5]
    ] as const
  ).entries()) {
    const hill = new THREE.Mesh(ball, hillMats[i]);
    hill.scale.set(sx, sy, 10);
    hill.position.set(centerX + dx, -1, z);
    scene.add(hill);
  }

  // 흔들리는 것(나무 잎, 덤불)과 흘러가는 구름
  const sway: { object: THREE.Object3D; phase: number; amount: number }[] = [];
  const clouds: THREE.Object3D[] = [];

  // 겨울에만 보이는 것(앙상한 가지, 소나무에 얹힌 눈)과 겨울에 숨기는 것(둥근 나무 잎, 꽃)
  const winterOnly: THREE.Object3D[] = [];
  const notWinter: THREE.Object3D[] = [];
  const branchMat = mat(0x7a5a42);
  const snowMat = mat(0xf4f7fa);
  const tree = (x: number, z: number, s: number) => {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.13 * s, 0.2 * s, 1.6 * s, 8)), mat(0x8d5f3f));
    trunk.position.y = 0.8 * s;
    g.add(trunk);
    const crown = new THREE.Mesh(
      balls(
        (
          [
            [0, 0.9, 0, 1.0],
            [-0.6, 0.45, 0.2, 0.72],
            [0.62, 0.5, -0.1, 0.75],
            [0.1, 1.55, 0.1, 0.68],
            [0, 0.5, 0.55, 0.6]
          ] as const
        ).map(([x, y, z, r]) => [x * s, y * s, z * s, r * s, r * s, r * s] as const)
      ),
      leafMats[Math.floor(rnd() * leafMats.length)]
    );
    crown.position.y = 1.5 * s;
    g.add(crown);
    notWinter.push(crown);
    // 겨울: 잎 대신 줄기 끝에서 뻗은 가지 넷
    const twigs = [0, 1, 2, 3].map((k) => {
      const len = (0.9 + (k % 2) * 0.3) * s;
      return new THREE.CylinderGeometry(0.03 * s, 0.06 * s, len, 5)
        .translate(0, len / 2, 0)
        .rotateZ(0.6)
        .rotateY((k / 4) * Math.PI * 2)
        .translate(0, 1.5 * s, 0);
    });
    const branches = new THREE.Mesh(geo(mergeGeometries(twigs)), branchMat);
    for (const t of twigs) t.dispose();
    branches.visible = false;
    g.add(branches);
    winterOnly.push(branches);
    g.position.set(x, 0, z);
    g.rotation.y = rnd() * Math.PI * 2;
    scene.add(g);
    sway.push({ object: crown, phase: rnd() * Math.PI * 2, amount: 0.035 });
  };
  const pine = (x: number, z: number, s: number) => {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.1 * s, 0.14 * s, 0.8 * s, 8)), mat(0x8d5f3f));
    trunk.position.y = 0.4 * s;
    g.add(trunk);
    const cones = (
      [
        [1.1, 1.0, 1.4],
        [1.9, 0.78, 1.2],
        [2.6, 0.52, 1.0]
      ] as const
    ).map(([y, r, h]) => new THREE.ConeGeometry(r * s, h * s, 10).translate(0, y * s, 0));
    const crown = new THREE.Mesh(geo(mergeGeometries(cones)), pineMat);
    for (const c of cones) c.dispose();
    g.add(crown);
    // 겨울: 층마다 위쪽에 얹힌 눈
    const caps = (
      [
        [1.35, 0.62, 0.6],
        [2.1, 0.5, 0.55],
        [2.8, 0.34, 0.5]
      ] as const
    ).map(([y, r, h]) => new THREE.ConeGeometry(r * s, h * s, 10).translate(0, y * s, 0));
    const snow = new THREE.Mesh(geo(mergeGeometries(caps)), snowMat);
    for (const c of caps) c.dispose();
    snow.visible = false;
    crown.add(snow);
    winterOnly.push(snow);
    g.position.set(x, 0, z);
    scene.add(g);
    sway.push({ object: crown, phase: rnd() * Math.PI * 2, amount: 0.02 });
  };

  // 나무: 가까운 줄, 먼 줄. 창 정면 가운데는 조금 비워 멀리까지 보이게 한다.
  for (let i = 0; i < 9; i += 1) {
    const x = centerX - 10 + i * 2.5 + (rnd() - 0.5) * 1.2;
    if (Math.abs(x - centerX) < 2) continue;
    tree(x, -10 - rnd() * 3, 0.9 + rnd() * 0.4);
  }
  for (let i = 0; i < 12; i += 1) {
    const x = centerX - 18 + i * 3.2 + (rnd() - 0.5) * 1.5;
    if (rnd() < 0.35) pine(x, -20 - rnd() * 8, 1.4 + rnd() * 0.5);
    else tree(x, -20 - rnd() * 8, 1.4 + rnd() * 0.5);
  }

  // 하얀 울타리
  const fenceZ = -4.6;
  const white = mat(0xf7f3ea);
  const post = geo(new THREE.BoxGeometry(0.14, 0.75, 0.06));
  const rail = geo(new THREE.BoxGeometry(24, 0.08, 0.05));
  for (const y of [0.25, 0.55]) {
    const r = new THREE.Mesh(rail, white);
    r.position.set(centerX, y, fenceZ);
    scene.add(r);
  }
  const posts: THREE.BufferGeometry[] = [];
  for (let x = centerX - 12; x <= centerX + 12; x += 0.42) posts.push(post.clone().translate(x, 0.37, fenceZ + 0.04));
  scene.add(new THREE.Mesh(geo(mergeGeometries(posts)), white));
  for (const p of posts) p.dispose();

  // 창 바로 밖 덤불과 꽃: 창 아래쪽을 채운다
  const flowerColors = [0xb98ae0, 0xf3a6c8, 0xffffff, 0xffe27a] as const;
  for (let i = 0; i < 11; i += 1) {
    const g = new THREE.Group();
    const x = centerX - 3.6 + i * 0.72 + (rnd() - 0.5) * 0.3;
    const s = 0.75 + rnd() * 0.45;
    const leaves = (
      [
        [0, 0.45, 0, 0.62],
        [-0.42, 0.32, 0.1, 0.45],
        [0.44, 0.3, -0.05, 0.47]
      ] as const
    ).map(([x, y, z, r]) => [x * s, y * s, z * s, r * s, r * s, r * s] as const);
    g.add(new THREE.Mesh(balls(leaves), bushMats[Math.floor(rnd() * bushMats.length)]));
    const flowers = Array.from({ length: 6 }, () => {
      const a = rnd() * Math.PI * 2;
      const b = rnd() * 1.1;
      const r = 0.07 * s;
      return [Math.cos(a) * Math.sin(b) * 0.6 * s, 0.45 * s + Math.cos(b) * 0.6 * s, Math.sin(a) * Math.sin(b) * 0.6 * s + 0.08, r, r, r] as const;
    });
    const bloom = new THREE.Mesh(balls(flowers), mat(pick(flowerColors)));
    g.add(bloom);
    notWinter.push(bloom);
    g.position.set(x, 0, -1.3 - rnd() * 1.2);
    scene.add(g);
    sway.push({ object: g, phase: rnd() * Math.PI * 2, amount: 0.02 });
  }

  // 구름: 하얀 공 덩어리. 하늘 높이 천천히 흘러간다.
  const cloudMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xc8d8e6, fog: false });
  for (let i = 0; i < 6; i += 1) {
    const puffs = (
      [
        [0, 0, 2.2],
        [-2.2, -0.4, 1.6],
        [2.3, -0.3, 1.7],
        [0.9, 1.0, 1.5]
      ] as const
    ).map(([x, y, r]) => [x, y, 0, r * 1.2, r * 0.8, r] as const);
    const g = new THREE.Mesh(balls(puffs), cloudMaterial);
    g.position.set(centerX - 40 + i * 14 + rnd() * 6, 13 + rnd() * 7, -48 - rnd() * 10);
    scene.add(g);
    clouds.push(g);
  }

  // 별: 창 너머 하늘 높이 흩어진 작은 점. 밤에만 보인다.
  const starPositions: number[] = [];
  for (let i = 0; i < 160; i += 1) {
    const a = (rnd() - 0.5) * Math.PI * 0.9;
    const h = 0.08 + rnd() * 0.85;
    starPositions.push(centerX + Math.sin(a) * Math.cos(h) * 80, Math.sin(h) * 80, -10 - Math.cos(a) * Math.cos(h) * 80);
  }
  const starGeometry = geo(new THREE.BufferGeometry());
  starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
  const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const stars = new THREE.Points(starGeometry, starMaterial);
  stars.visible = false;
  scene.add(stars);

  // 나비 둘: 날개 두 장이 팔랑이며 덤불 위를 맴돈다
  const wingGeometry = geo(new THREE.CircleGeometry(0.09, 8));
  const butterflies = [0xfff6a8, 0xffffff].map((color, i) => {
    const wingMaterial = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    const g = new THREE.Group();
    const wings = [-1, 1].map((side) => {
      const hinge = new THREE.Group();
      const wing = new THREE.Mesh(wingGeometry, wingMaterial);
      wing.rotation.x = -Math.PI / 2;
      wing.position.x = side * 0.08;
      hinge.add(wing);
      g.add(hinge);
      return { hinge, side, wingMaterial };
    });
    scene.add(g);
    return { g, wings, phase: i * 2.4 };
  });

  let seasonShown: Season | null = null;
  const paintSeason = (season: Season) => {
    if (seasonShown === season) return;
    seasonShown = season;
    const c = SEASON_COLORS[season];
    leafMats.forEach((m, i) => m.color.setHex(c.leaves[i]));
    pineMat.color.setHex(c.pine);
    groundMat.color.setHex(c.ground);
    hillMats.forEach((m, i) => m.color.setHex(c.hills[i]));
    bushMats.forEach((m, i) => m.color.setHex(c.bushes[i]));
    const winter = season === "winter";
    for (const o of winterOnly) o.visible = winter;
    for (const o of notWinter) o.visible = !winter;
  };
  paintSeason("summer");
  const cloudDay = new THREE.Color(0xc8d8e6);
  const cloudNight = new THREE.Color(0x1c2440);

  return {
    scene,
    setDaylight(ambience, season, phase) {
      paintSky(ambience.skyTop, ambience.skyHorizon);
      (scene.fog as THREE.Fog).color.setHex(ambience.skyHorizon);
      hemi.intensity = ambience.outdoorHemiIntensity;
      sun.color.setHex(ambience.outdoorSunColor);
      sun.intensity = ambience.outdoorSunIntensity;
      starMaterial.opacity = ambience.stars;
      stars.visible = ambience.stars > 0.01;
      cloudMaterial.emissive.copy(cloudNight).lerp(cloudDay, 1 - ambience.stars);
      paintSeason(season);
      // 나비는 봄·여름·가을의 낮(노을까지)에만 난다
      const butterfliesOut = season !== "winter" && (phase === "day" || phase === "sunset");
      for (const b of butterflies) b.g.visible = butterfliesOut;
    },
    update(t, dt) {
      for (const s of sway) {
        s.object.rotation.z = Math.sin(t * 1.1 + s.phase) * s.amount;
        s.object.rotation.x = Math.sin(t * 0.8 + s.phase * 1.7) * s.amount * 0.6;
      }
      for (const c of clouds) {
        c.position.x += dt * 0.35;
        if (c.position.x > centerX + 44) c.position.x -= 88;
      }
      for (const b of butterflies) {
        const u = t * 0.45 + b.phase;
        b.g.position.set(centerX + Math.sin(u) * 2.6, 1.1 + Math.sin(u * 2.3) * 0.35, -1.6 + Math.cos(u * 0.7) * 0.9);
        b.g.rotation.y = Math.cos(u) > 0 ? 0.4 : -0.4;
        for (const w of b.wings) w.hinge.rotation.z = w.side * (0.3 + Math.abs(Math.sin(t * 14 + b.phase)) * 1.1);
      }
    },
    dispose() {
      for (const g of new Set(geometries)) g.dispose();
      for (const m of materials.values()) m.dispose();
      for (const m of [...leafMats, ...hillMats, ...bushMats, pineMat, groundMat, starMaterial]) m.dispose();
      skyMaterial.dispose();
      cloudMaterial.dispose();
      for (const b of butterflies) b.wings[0].wingMaterial.dispose();
    }
  };
}
