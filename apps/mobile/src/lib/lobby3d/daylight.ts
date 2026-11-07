// 라이트루프 방의 햇빛과 하루의 때(그림을 그리지 않는 계산). 그리기는 lobby3d-canvas·lobby3d-outdoor가 한다.
// 위치는 묻지 않고 서울(북위 37.5도)로 보고, 해가 가장 높은 때(남중)를 12시 30분으로 본다. 시각은 폰의 지금 시각(그 폰의 시간대)이다.
// 방 뒷벽 창문은 남쪽을 본다. 앱 좌표로 남쪽은 -z(창 밖), 북쪽은 +z(방 앞), 창을 바라보면 동쪽이 왼쪽(-x)이다.

export type Season = "spring" | "summer" | "autumn" | "winter";
export type DayPhase = "dawn" | "day" | "sunset" | "dusk" | "night";

const LATITUDE_DEG = 37.5;
const SOLAR_NOON_HOURS = 12.5;
const DEG = Math.PI / 180;

/** 봄 3~5월, 여름 6~8월, 가을 9~11월, 겨울 12~2월. month는 1~12. */
export function seasonOf(month: number): Season {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

export interface SunPosition {
  /** 지평선에서 잰 높이(도). 음수면 해가 진 것이다. */
  elevation: number;
  /** 북쪽에서 시계 방향으로 잰 방향(도). 동 90, 남 180, 서 270. */
  azimuth: number;
}

function dayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 1);
  return Math.floor((new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - start.getTime()) / 86400000) + 1;
}

/** 날짜·시각으로 해의 높이와 방향을 구한다(어림 공식). */
export function sunPosition(date: Date): SunPosition {
  const declination = 23.44 * Math.sin((2 * Math.PI * (284 + dayOfYear(date))) / 365) * DEG;
  const hours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const hourAngle = (hours - SOLAR_NOON_HOURS) * 15 * DEG;
  const lat = LATITUDE_DEG * DEG;
  const sinElevation = Math.sin(lat) * Math.sin(declination) + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle);
  const elevation = Math.asin(Math.max(-1, Math.min(1, sinElevation)));
  const azimuth = Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(lat) - Math.tan(declination) * Math.cos(lat)) + Math.PI;
  return { elevation: elevation / DEG, azimuth: ((azimuth / DEG) % 360 + 360) % 360 };
}

/** 해를 향하는 단위 벡터(앱 좌표). 남쪽 하늘의 해는 z가 음수다. */
export function sunDirection(sun: SunPosition) {
  const e = sun.elevation * DEG;
  const a = sun.azimuth * DEG;
  return { x: -Math.cos(e) * Math.sin(a), y: Math.sin(e), z: Math.cos(e) * Math.cos(a) };
}

/** 노을이 시작하는 해 높이(도). 해 지기 1시간쯤 전이다. */
const SUNSET_START = 8;
/** 새벽이 끝나는 해 높이(도). 해 뜬 뒤 조금 지나서다. */
const DAWN_END = 3;
/** 어스름·새벽이 시작하는 해 높이(도). 해 진 뒤 40분쯤(시민 박명)이다. */
const TWILIGHT = -6;

const isMorning = (sun: SunPosition) => sun.azimuth < 180;

/**
 * 하루의 때. 해 높이로 나누고, 해가 동쪽(오전)인지 서쪽(오후)인지로 새벽과 노을·어스름을 가른다.
 * 밤: 해 높이 -6도 아래. 새벽: 오전 -6~3도. 노을: 오후 0~8도. 어스름: 오후 -6~0도. 그 밖은 낮.
 */
export function dayPhaseOf(sun: SunPosition): DayPhase {
  const e = sun.elevation;
  if (e < TWILIGHT) return "night";
  if (isMorning(sun)) return e < DAWN_END ? "dawn" : "day";
  if (e < 0) return "dusk";
  if (e < SUNSET_START) return "sunset";
  return "day";
}

/** 경계에서 두 때가 섞이는 폭(해 높이 ±도). */
const BLEND = 1.5;

const ramp = (edge: number, e: number) => {
  const t = Math.max(0, Math.min(1, (e - (edge - BLEND)) / (2 * BLEND)));
  return t * t * (3 - 2 * t);
};

/** 다섯 때의 섞는 비율(합 1). 경계(dayPhaseOf의 해 높이)에서 ±1.5도 사이로 부드럽게 넘어간다. */
export function dayPhaseWeights(sun: SunPosition): Record<DayPhase, number> {
  const e = sun.elevation;
  const weights: Record<DayPhase, number> = { dawn: 0, day: 0, sunset: 0, dusk: 0, night: 0 };
  if (isMorning(sun)) {
    const toDawn = ramp(TWILIGHT, e);
    const toDay = ramp(DAWN_END, e);
    weights.night = 1 - toDawn;
    weights.dawn = toDawn - toDay;
    weights.day = toDay;
  } else {
    const toDusk = ramp(TWILIGHT, e);
    const toSunset = ramp(0, e);
    const toDay = ramp(SUNSET_START, e);
    weights.night = 1 - toDusk;
    weights.dusk = toDusk - toSunset;
    weights.sunset = toSunset - toDay;
    weights.day = toDay;
  }
  return weights;
}

/** 천장 조명은 해가 지면(어스름부터) 켜지고 새벽이 끝나면 꺼진다. */
export function ceilingLightOn(phase: DayPhase): boolean {
  return phase === "dusk" || phase === "night" || phase === "dawn";
}

// ---------- 방 색감(때마다 정한 값을 해 높이로 섞는다) ----------

export interface Ambience {
  /** 구운 방(바닥·벽)에 곱하는 색. */
  roomTint: number;
  ambientColor: number;
  ambientIntensity: number;
  /** 방의 해(가구·라이트루프 명암) */
  sunColor: number;
  sunIntensity: number;
  /** 바닥 창문 빛 */
  windowColor: number;
  windowStrength: number;
  /** 창밖 하늘(위, 지평선)과 해·반사광 */
  skyTop: number;
  skyHorizon: number;
  outdoorSunColor: number;
  outdoorSunIntensity: number;
  outdoorHemiIntensity: number;
  /** 밤하늘 별(0~1) */
  stars: number;
}

interface Key extends Ambience {
  elevation: number;
}

const DAY: Ambience = {
  roomTint: 0xffffff,
  ambientColor: 0xffffff,
  ambientIntensity: 1.35,
  sunColor: 0xffffff,
  sunIntensity: 1.6,
  windowColor: 0xfff1d0,
  windowStrength: 0.5,
  skyTop: 0x76b8ea,
  skyHorizon: 0xd4ecf6,
  outdoorSunColor: 0xfff0d8,
  outdoorSunIntensity: 1.7,
  outdoorHemiIntensity: 1.5,
  stars: 0
};

// 밤: 천장 조명이 방 전체를 따뜻하게 밝힌다(방 가장자리는 lobby3d-daylight가 따로 어둡게 한다). 창밖만 어둡다.
const NIGHT: Ambience = {
  roomTint: 0xe8d2b2,
  ambientColor: 0xffe2bc,
  ambientIntensity: 1.1,
  sunColor: 0xffdcb0,
  sunIntensity: 0.7,
  windowColor: 0xfff1d0,
  windowStrength: 0,
  skyTop: 0x0b1230,
  skyHorizon: 0x1f2b55,
  outdoorSunColor: 0x9fb2e8,
  outdoorSunIntensity: 0.15,
  outdoorHemiIntensity: 0.35,
  stars: 1
};

/** 해가 머리 위에 있을 때. 낮 동안은 해가 높을수록 창문 빛이 조금씩 진해진다(해가 낮을수록 옅다). */
const HIGH_NOON: Key = { ...DAY, elevation: 90, windowStrength: 0.62 };

/** 오후·저녁: 해 높이가 내려가는 차례 */
const EVENING: Key[] = [
  HIGH_NOON,
  { ...DAY, elevation: 15 },
  {
    ...DAY,
    elevation: 6,
    roomTint: 0xffe0bd,
    ambientColor: 0xffe8d0,
    ambientIntensity: 1.25,
    sunColor: 0xffc890,
    sunIntensity: 1.35,
    windowColor: 0xffb45e,
    windowStrength: 0.48,
    skyTop: 0x7aa2d4,
    skyHorizon: 0xffd2a0,
    outdoorSunColor: 0xffbe82,
    outdoorSunIntensity: 1.45,
    outdoorHemiIntensity: 1.3
  },
  {
    ...DAY,
    elevation: 0,
    roomTint: 0xf2b897,
    ambientColor: 0xf0c8c0,
    ambientIntensity: 1.05,
    sunColor: 0xff9a60,
    sunIntensity: 0.7,
    windowColor: 0xff9450,
    windowStrength: 0,
    skyTop: 0x5d6aa8,
    skyHorizon: 0xff9f7a,
    outdoorSunColor: 0xff9a66,
    outdoorSunIntensity: 0.9,
    outdoorHemiIntensity: 1.0
  },
  {
    ...NIGHT,
    elevation: -4,
    roomTint: 0xd9c4b6,
    ambientColor: 0xf2d8c8,
    ambientIntensity: 1.0,
    sunColor: 0xf0c8b0,
    sunIntensity: 0.6,
    skyTop: 0x27336a,
    skyHorizon: 0x6a6aa0,
    outdoorSunColor: 0xa8a8e0,
    outdoorSunIntensity: 0.35,
    outdoorHemiIntensity: 0.6,
    stars: 0.3
  },
  { ...NIGHT, elevation: -12 }
];

/** 새벽·아침: 해 높이가 올라가는 차례(높은 쪽부터 적는다) */
const MORNING: Key[] = [
  HIGH_NOON,
  { ...DAY, elevation: 15 },
  {
    ...DAY,
    elevation: 6,
    roomTint: 0xfff1e4,
    ambientColor: 0xfff0e8,
    ambientIntensity: 1.3,
    sunColor: 0xffe2c8,
    sunIntensity: 1.4,
    windowColor: 0xffe6c4,
    windowStrength: 0.45,
    skyTop: 0x84b4e6,
    skyHorizon: 0xffe4d0
  },
  {
    ...DAY,
    elevation: 0,
    roomTint: 0xf0c4c4,
    ambientColor: 0xf0d0dc,
    ambientIntensity: 1.05,
    sunColor: 0xffb8a8,
    sunIntensity: 0.7,
    windowColor: 0xffc4a8,
    windowStrength: 0,
    skyTop: 0x8a9ad8,
    skyHorizon: 0xffbdb0,
    outdoorSunColor: 0xffb8a0,
    outdoorSunIntensity: 0.9,
    outdoorHemiIntensity: 1.0
  },
  {
    ...NIGHT,
    elevation: -4,
    roomTint: 0xdcc8c0,
    ambientColor: 0xf0dcd4,
    ambientIntensity: 1.0,
    sunColor: 0xf0d0c4,
    sunIntensity: 0.6,
    skyTop: 0x34407e,
    skyHorizon: 0xc39ab8,
    outdoorSunColor: 0xc0a8d8,
    outdoorSunIntensity: 0.4,
    outdoorHemiIntensity: 0.65,
    stars: 0.25
  },
  { ...NIGHT, elevation: -12 }
];

function mixColor(a: number, b: number, t: number) {
  const ch = (c: number, s: number) => (c >> s) & 0xff;
  const m = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return (m(16) << 16) | (m(8) << 8) | m(0);
}

function mixAmbience(a: Ambience, b: Ambience, t: number): Ambience {
  const out = {} as Ambience;
  for (const key of Object.keys(a) as (keyof Ambience)[]) {
    out[key] = key.endsWith("Color") || key === "roomTint" || key.startsWith("sky") ? mixColor(a[key], b[key], t) : a[key] + (b[key] - a[key]) * t;
  }
  return out;
}

/** 해 자리로 방 색감을 정한다. 이웃한 두 때의 값을 해 높이로 섞어 갑자기 튀지 않는다. */
export function ambienceAt(sun: SunPosition): Ambience {
  const keys = isMorning(sun) ? MORNING : EVENING;
  const e = sun.elevation;
  if (e >= keys[0].elevation) return strip(keys[0]);
  for (let i = 1; i < keys.length; i += 1) {
    const hi = keys[i - 1];
    const lo = keys[i];
    if (e >= lo.elevation) return mixAmbience(strip(lo), strip(hi), (e - lo.elevation) / (hi.elevation - lo.elevation));
  }
  return strip(keys[keys.length - 1]);
}

function strip(key: Key): Ambience {
  const { elevation: _elevation, ...rest } = key;
  return rest;
}

/** 두 색감 사이(앞 색감에서 뒤 색감으로 t만큼). 시각이 바뀔 때 부드럽게 넘어가는 데 쓴다. */
export function blendAmbience(from: Ambience, to: Ambience, t: number): Ambience {
  return mixAmbience(from, to, Math.max(0, Math.min(1, t)));
}

// ---------- 바닥의 창문 빛 ----------

/** 창 안쪽(햇빛이 지나는 곳). 가운데 세로 창살과 가운데 가로 창살로 네 칸이 된다. 좌표는 앱 좌표(칸). */
export interface WindowOpening {
  /** 창 안쪽 가운데 */
  x: number;
  y: number;
  /** 햇빛이 지나는 면의 z(뒷벽 바로 앞) */
  z: number;
  width: number;
  height: number;
  /** 창살 굵기 */
  bar: number;
}

export interface FloorPoint2 {
  x: number;
  z: number;
}

/** 바닥에 비친 창 한 칸. points는 방 바닥 안으로 자른 다각형이고, origin·u·v는 자르기 전 평행사변형(그림 좌표를 매길 때 쓴다). */
export interface WindowLightPane {
  points: FloorPoint2[];
  origin: FloorPoint2;
  u: FloorPoint2;
  v: FloorPoint2;
}

/**
 * 해 자리와 창 크기로 바닥에 비치는 창문 빛(네 칸)을 구한다. 방 바닥(0~floorWidth, 0~floorDepth) 밖은 자른다.
 * 해가 졌거나(높이 0 이하) 창 뒤쪽(북쪽 하늘)에 있으면 빈 목록이다.
 */
export function windowLightPanes(sun: SunPosition, opening: WindowOpening, floorWidth: number, floorDepth: number): WindowLightPane[] {
  const s = sunDirection(sun);
  if (s.y <= 0.001 || s.z >= -0.001) return [];
  // 창 면의 점 (px, py, z)을 햇빛 방향(-s)으로 바닥(y = 0)까지 옮긴다
  const toFloor = (px: number, py: number): FloorPoint2 => ({ x: px - (py * s.x) / s.y, z: opening.z - (py * s.z) / s.y });
  const paneW = (opening.width - opening.bar) / 2;
  const paneH = (opening.height - opening.bar) / 2;
  const left = opening.x - opening.width / 2;
  const bottom = opening.y - opening.height / 2;
  const panes: WindowLightPane[] = [];
  for (const col of [0, 1]) {
    for (const row of [0, 1]) {
      const x0 = left + col * (paneW + opening.bar);
      const y0 = bottom + row * (paneH + opening.bar);
      const a = toFloor(x0, y0);
      const b = toFloor(x0 + paneW, y0);
      const d = toFloor(x0, y0 + paneH);
      const u = { x: b.x - a.x, z: b.z - a.z };
      const v = { x: d.x - a.x, z: d.z - a.z };
      const quad = [a, b, { x: b.x + v.x, z: b.z + v.z }, d];
      const points = clipToRect(quad, floorWidth, floorDepth);
      if (points.length >= 3) panes.push({ points, origin: a, u, v });
    }
  }
  return panes;
}

/** 볼록 다각형을 사각형 0~w, 0~d 안으로 자른다(Sutherland–Hodgman). */
function clipToRect(poly: FloorPoint2[], w: number, d: number): FloorPoint2[] {
  const edges: [(p: FloorPoint2) => number][] = [[(p) => p.x], [(p) => w - p.x], [(p) => p.z], [(p) => d - p.z]];
  let out = poly;
  for (const [inside] of edges) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i += 1) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      const ci = inside(cur);
      const pi = inside(prev);
      if (ci >= 0) {
        if (pi < 0) out.push(lerpPoint(prev, cur, pi / (pi - ci)));
        out.push(cur);
      } else if (pi >= 0) {
        out.push(lerpPoint(prev, cur, pi / (pi - ci)));
      }
    }
    if (out.length === 0) break;
  }
  return out;
}

function lerpPoint(a: FloorPoint2, b: FloorPoint2, t: number): FloorPoint2 {
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
}

// ---------- 한 번에 ----------

export interface Daylight {
  sun: SunPosition;
  phase: DayPhase;
  season: Season;
  /** 천장 조명이 켜졌는지 */
  ceilingLight: boolean;
  ambience: Ambience;
}

/** 날짜·시각 하나로 방의 햇빛 상태를 모두 구한다. */
export function daylightAt(date: Date): Daylight {
  const sun = sunPosition(date);
  const phase = dayPhaseOf(sun);
  return { sun, phase, season: seasonOf(date.getMonth() + 1), ceilingLight: ceilingLightOn(phase), ambience: ambienceAt(sun) };
}
