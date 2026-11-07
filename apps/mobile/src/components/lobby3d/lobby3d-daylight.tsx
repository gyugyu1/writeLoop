import { useFrame } from "@react-three/fiber/native";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { ROOM } from "@/lib/lobby3d/engine";
import { blendAmbience, windowLightPanes, type Ambience, type Daylight } from "@/lib/lobby3d/daylight";
import { FURNITURE_LAYOUT, WINDOW_OPENING } from "@/lib/lobby3d/furniture-layout";

// 시각에 따른 방의 빛. 방 조명 색·세기, 구운 방에 곱하는 색, 바닥의 창문 빛, 밤의 천장 조명을 맡는다.
// 시각이 바뀌면 그때 보이던 색감에서 새 색감으로 TRANSITION_SECONDS 동안 부드럽게 넘어간다. 창밖 풍경은 이 상태를 읽어 lobby3d-furniture가 그린다.
// 천장 조명은 보이지 않는 등이다(앞이 트인 방이라 천장이 없다). 켜지면 방 전체가 따뜻하게 밝고, 가장자리(바닥 끝, 벽 위쪽과 양 끝)만 빛이 덜 닿아 어둡다.

/** 새 색감으로 넘어가는 시간(초). */
const TRANSITION_SECONDS = 1.5;

/** 매 프레임 지금 보이는 색감. 창밖 풍경도 함께 읽는다. */
export interface DaylightState {
  ambience: Ambience;
  /** 천장 조명 켜짐 정도(0~1). 켜고 끌 때 부드럽게 바뀐다. */
  ceiling: number;
  target: Daylight;
  /** 넘어가기 시작할 때의 색감·천장 조명과 지난 정도(0~1). 매 프레임 조금씩 다가가면 반올림 때문에 색이 끝까지 가지 못해, 시작 값에서 섞는다. */
  from: Ambience;
  fromCeiling: number;
  progress: number;
  shownTarget: Daylight;
}

export function createDaylightState(daylight: Daylight): DaylightState {
  const ceiling = daylight.ceilingLight ? 1 : 0;
  return { ambience: daylight.ambience, ceiling, target: daylight, from: daylight.ambience, fromCeiling: ceiling, progress: 1, shownTarget: daylight };
}

interface DaylightRigProps {
  state: DaylightState;
  daylight: Daylight;
  ambient: THREE.AmbientLight;
  sun: THREE.DirectionalLight;
  /** 구운 방(바닥·벽) 재질이 함께 쓰는 색. 여기서 바꾸면 방 전체 색이 바뀐다. */
  roomTint: THREE.Color;
}

function dataTexture(size: number, alphaAt: (u: number, v: number) => number): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const a = Math.max(0, Math.min(1, alphaAt((x + 0.5) / size, (y + 0.5) / size)));
      data.set([255, 255, 255, Math.round(255 * a)], (y * size + x) * 4);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

const smooth = (t: number) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

// 가장자리만 살짝 옅어지는 네모(창문 빛 한 칸). 그림 좌표 0~1이 한 칸 전체다.
const paneTexture = () => dataTexture(32, (u, v) => smooth(Math.min(u, 1 - u, v, 1 - v) / 0.12));
// 바닥 가장자리 어둠: 가운데는 투명하고 바닥 끝·모서리로 갈수록 진하다
const floorEdgeTexture = () => dataTexture(64, (u, v) => smooth((Math.hypot((u - 0.5) * 2, (v - 0.5) * 2) - 0.4) / 0.75));
// 벽 가장자리 어둠: 아래 가운데는 투명하고 위쪽과 양 끝으로 갈수록 진하다(그림 v = 0이 벽 아래)
const wallEdgeTexture = () => dataTexture(64, (u, v) => smooth((Math.hypot((u - 0.5) * 1.6, v * 1.1) - 0.45) / 0.75));

/** 천장 조명 색과, 켜졌을 때 가장자리 어둠의 진하기. */
const CEILING_COLOR = 0xffe2b4;
const EDGE_COLOR = 0x1c1008;
const EDGE_OPACITY = 0.75;

export function DaylightRig({ state, daylight, ambient, sun, roomTint }: DaylightRigProps) {
  state.target = daylight;

  const parts = useMemo(() => {
    const group = new THREE.Group();
    // 바닥의 창문 빛: 네 칸을 한 모양으로 그린다(해가 움직이면 다시 만든다)
    const paneMap = paneTexture();
    const windowMaterial = new THREE.MeshBasicMaterial({
      map: paneMap,
      transparent: true,
      opacity: 0,
      // 바닥 꼭짓점 차례에 따라 아래를 보는 면이 되기도 해서 양면으로 그린다
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    });
    const windowLight = new THREE.Mesh(new THREE.BufferGeometry(), windowMaterial);
    windowLight.position.y = 0.008;
    windowLight.raycast = () => {};
    group.add(windowLight);

    // 천장 조명: 방 가운데 위의 보이지 않는 등. 가구·라이트루프를 위에서 비추고, 멀수록 약해진다.
    const W = ROOM.width;
    const D = ROOM.depth;
    const H = ROOM.wallHeight;
    const ceilingLight = new THREE.PointLight(CEILING_COLOR, 0, 16, 1);
    ceilingLight.position.set(W / 2, H + 1.6, D / 2);
    group.add(ceilingLight);

    // 가장자리 어둠: 바닥 전체와 세 벽 안쪽 면에 덮는 옅은 그림자(천장 조명이 켜졌을 때만)
    const floorEdgeMap = floorEdgeTexture();
    const wallEdgeMap = wallEdgeTexture();
    const edgeMaterial = (map: THREE.Texture) =>
      new THREE.MeshBasicMaterial({ map, color: EDGE_COLOR, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    const floorEdge = new THREE.Mesh(new THREE.PlaneGeometry(W, D), edgeMaterial(floorEdgeMap));
    floorEdge.rotation.x = -Math.PI / 2;
    floorEdge.position.set(W / 2, 0.012, D / 2);
    const backEdge = new THREE.Mesh(new THREE.PlaneGeometry(W, H), edgeMaterial(wallEdgeMap));
    backEdge.position.set(W / 2, H / 2, 0.006);
    const leftEdge = new THREE.Mesh(new THREE.PlaneGeometry(D, H), edgeMaterial(wallEdgeMap));
    leftEdge.rotation.y = Math.PI / 2;
    leftEdge.position.set(0.006, H / 2, D / 2);
    const rightEdge = new THREE.Mesh(new THREE.PlaneGeometry(D, H), edgeMaterial(wallEdgeMap));
    rightEdge.rotation.y = -Math.PI / 2;
    rightEdge.position.set(W - 0.006, H / 2, D / 2);
    const edges = [floorEdge, backEdge, leftEdge, rightEdge];
    for (const o of edges) {
      o.raycast = () => {};
      group.add(o);
    }
    return { group, windowLight, windowMaterial, paneMap, ceilingLight, edges, floorEdgeMap, wallEdgeMap };
  }, []);

  // 해가 움직이면(1분마다 바뀐다) 창문 빛 모양을 다시 만든다
  useEffect(() => {
    const place = FURNITURE_LAYOUT.find((p) => p.piece === "window");
    const panes = windowLightPanes(
      daylight.sun,
      { ...WINDOW_OPENING, x: place?.x ?? 4.8, y: place?.y ?? 2.05 },
      ROOM.width,
      ROOM.depth
    );
    const positions: number[] = [];
    const uvs: number[] = [];
    for (const pane of panes) {
      // 자르기 전 평행사변형(origin + s·u + t·v)으로 그림 좌표 (s, t)를 매긴다
      const det = pane.u.x * pane.v.z - pane.u.z * pane.v.x;
      const uvOf = (p: { x: number; z: number }) => {
        const dx = p.x - pane.origin.x;
        const dz = p.z - pane.origin.z;
        return [(dx * pane.v.z - dz * pane.v.x) / det, (pane.u.x * dz - pane.u.z * dx) / det];
      };
      for (let i = 1; i < pane.points.length - 1; i += 1) {
        for (const p of [pane.points[0], pane.points[i], pane.points[i + 1]]) {
          positions.push(p.x, 0, p.z);
          uvs.push(...uvOf(p));
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    const old = parts.windowLight.geometry;
    parts.windowLight.geometry = geometry;
    old.dispose();
  }, [daylight.sun, parts]);

  useFrame((_, delta) => {
    if (state.shownTarget !== state.target) {
      state.shownTarget = state.target;
      state.from = state.ambience;
      state.fromCeiling = state.ceiling;
      state.progress = 0;
    }
    if (state.progress < 1) {
      state.progress = Math.min(1, state.progress + delta / TRANSITION_SECONDS);
      const t = smooth(state.progress);
      state.ambience = blendAmbience(state.from, state.target.ambience, t);
      state.ceiling = state.fromCeiling + ((state.target.ceilingLight ? 1 : 0) - state.fromCeiling) * t;
    }
    const a = state.ambience;
    ambient.color.setHex(a.ambientColor);
    ambient.intensity = a.ambientIntensity;
    sun.color.setHex(a.sunColor);
    sun.intensity = a.sunIntensity;
    roomTint.setHex(a.roomTint);
    parts.windowMaterial.color.setHex(a.windowColor);
    parts.windowMaterial.opacity = a.windowStrength;
    parts.ceilingLight.intensity = 3.2 * state.ceiling;
    for (const o of parts.edges) (o.material as THREE.MeshBasicMaterial).opacity = EDGE_OPACITY * state.ceiling;
  });

  useEffect(
    () => () => {
      parts.windowLight.geometry.dispose();
      parts.windowMaterial.dispose();
      parts.paneMap.dispose();
      parts.floorEdgeMap.dispose();
      parts.wallEdgeMap.dispose();
      for (const o of parts.edges) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    },
    [parts]
  );

  // react-three-fiber의 three 객체 속성(object)이라 RN 린트 규칙이 모르는 속성으로 본다.
  // eslint-disable-next-line react/no-unknown-property
  return <primitive object={parts.group} />;
}
