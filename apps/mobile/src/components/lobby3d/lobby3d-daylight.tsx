import { useFrame } from "@react-three/fiber/native";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { ROOM } from "@/lib/lobby3d/engine";
import { blendAmbience, windowLightPanes, type Ambience, type Daylight } from "@/lib/lobby3d/daylight";
import { FURNITURE_LAYOUT, WINDOW_OPENING } from "@/lib/lobby3d/furniture-layout";

// 시각에 따른 방의 빛. 방 조명 색·세기, 구운 방에 곱하는 색, 바닥의 창문 빛, 밤의 스탠드 빛을 맡는다.
// 시각이 바뀌면 그때 보이던 색감에서 새 색감으로 TRANSITION_SECONDS 동안 부드럽게 넘어간다. 창밖 풍경은 이 상태를 읽어 lobby3d-furniture가 그린다.

/** 새 색감으로 넘어가는 시간(초). */
const TRANSITION_SECONDS = 1.5;

/** 매 프레임 지금 보이는 색감. 창밖 풍경도 함께 읽는다. */
export interface DaylightState {
  ambience: Ambience;
  /** 스탠드 켜짐 정도(0~1). 켜고 끌 때 부드럽게 바뀐다. */
  lamp: number;
  target: Daylight;
  /** 넘어가기 시작할 때의 색감·스탠드와 지난 정도(0~1). 매 프레임 조금씩 다가가면 반올림 때문에 색이 끝까지 가지 못해, 시작 값에서 섞는다. */
  from: Ambience;
  fromLamp: number;
  progress: number;
  shownTarget: Daylight;
}

export function createDaylightState(daylight: Daylight): DaylightState {
  const lamp = daylight.lamp ? 1 : 0;
  return { ambience: daylight.ambience, lamp, target: daylight, from: daylight.ambience, fromLamp: lamp, progress: 1, shownTarget: daylight };
}

interface DaylightRigProps {
  state: DaylightState;
  daylight: Daylight;
  ambient: THREE.AmbientLight;
  sun: THREE.DirectionalLight;
  /** 구운 방(바닥·벽) 재질이 함께 쓰는 색. 여기서 바꾸면 방 전체 색이 바뀐다. */
  roomTint: THREE.Color;
}

// 가장자리만 살짝 옅어지는 네모(창문 빛 한 칸). 그림 좌표 0~1이 한 칸 전체다.
function paneTexture(): THREE.DataTexture {
  const size = 32;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = Math.min(x + 0.5, size - x - 0.5) / size;
      const v = Math.min(y + 0.5, size - y - 0.5) / size;
      const a = Math.min(1, Math.min(u, v) / 0.12);
      data.set([255, 255, 255, Math.round(255 * a * a * (3 - 2 * a))], (y * size + x) * 4);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

// 가운데가 밝고 둘레로 옅어지는 둥근 빛(스탠드 둘레, 갓의 빛남)
function glowTexture(): THREE.DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const r = Math.hypot(x - size / 2 + 0.5, y - size / 2 + 0.5) / (size / 2);
      const a = Math.max(0, 1 - r);
      data.set([255, 255, 255, Math.round(255 * a * a)], (y * size + x) * 4);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

const LAMP_COLOR = 0xffc87a;

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

    // 스탠드: 갓의 빛남, 둘레 바닥·뒷벽의 둥근 빛, 가구·라이트루프를 비추는 점 빛
    const lamp = FURNITURE_LAYOUT.find((p) => p.piece === "lamp");
    const lampX = lamp?.x ?? 3.3;
    const lampZ = lamp?.z ?? 0.35;
    const glowMap = glowTexture();
    const glowMaterial = (opacity: number) =>
      new THREE.MeshBasicMaterial({
        map: glowMap,
        color: LAMP_COLOR,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      });
    const floorGlow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), glowMaterial(0));
    floorGlow.rotation.x = -Math.PI / 2;
    floorGlow.position.set(lampX, 0.01, lampZ + 0.6);
    const wallGlow = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.0), glowMaterial(0));
    wallGlow.position.set(lampX, 2.0, 0.012);
    const shadeGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, color: LAMP_COLOR, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    shadeGlow.scale.set(1.3, 1.3, 1);
    shadeGlow.position.set(lampX, 2.15, lampZ + 0.1);
    const lampLight = new THREE.PointLight(LAMP_COLOR, 0, 6, 1.6);
    lampLight.position.set(lampX, 2.0, lampZ + 0.5);
    for (const o of [floorGlow, wallGlow, shadeGlow]) {
      o.raycast = () => {};
      group.add(o);
    }
    group.add(lampLight);
    return { group, windowLight, windowMaterial, paneMap, glowMap, floorGlow, wallGlow, shadeGlow, lampLight };
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
      state.fromLamp = state.lamp;
      state.progress = 0;
    }
    if (state.progress < 1) {
      state.progress = Math.min(1, state.progress + delta / TRANSITION_SECONDS);
      const t = state.progress * state.progress * (3 - 2 * state.progress);
      state.ambience = blendAmbience(state.from, state.target.ambience, t);
      state.lamp = state.fromLamp + ((state.target.lamp ? 1 : 0) - state.fromLamp) * t;
    }
    const a = state.ambience;
    ambient.color.setHex(a.ambientColor);
    ambient.intensity = a.ambientIntensity;
    sun.color.setHex(a.sunColor);
    sun.intensity = a.sunIntensity;
    roomTint.setHex(a.roomTint);
    parts.windowMaterial.color.setHex(a.windowColor);
    parts.windowMaterial.opacity = a.windowStrength;
    const lamp = state.lamp;
    (parts.floorGlow.material as THREE.MeshBasicMaterial).opacity = 0.55 * lamp;
    (parts.wallGlow.material as THREE.MeshBasicMaterial).opacity = 0.4 * lamp;
    parts.shadeGlow.material.opacity = 0.9 * lamp;
    parts.lampLight.intensity = 2.2 * lamp;
  });

  useEffect(
    () => () => {
      parts.windowLight.geometry.dispose();
      parts.windowMaterial.dispose();
      parts.paneMap.dispose();
      parts.glowMap.dispose();
      parts.floorGlow.geometry.dispose();
      parts.wallGlow.geometry.dispose();
      (parts.floorGlow.material as THREE.Material).dispose();
      (parts.wallGlow.material as THREE.Material).dispose();
      parts.shadeGlow.material.dispose();
    },
    [parts]
  );

  // react-three-fiber의 three 객체 속성(object)이라 RN 린트 규칙이 모르는 속성으로 본다.
  // eslint-disable-next-line react/no-unknown-property
  return <primitive object={parts.group} />;
}
