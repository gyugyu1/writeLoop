import { useLoader } from "@react-three/fiber/native";
import { Component, Suspense, useEffect, useMemo, useState, type MutableRefObject, type ReactNode } from "react";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { characterClipState } from "@/lib/lobby3d/character-clips";
import { outlineAttributes, type OutlineAttributeChoice } from "@/lib/lobby3d/outline-attributes";
import type { LobbySim } from "@/lib/lobby3d/engine";
import { NO_WEAR, wearsAnything, type WearLook, type WearState } from "@/lib/lobby3d/wear";
import type * as WearablesModule from "./lobby3d-wearables";

// 로비의 라이트루프 3D 모델(규격: docs/guides/character-3d-model-spec.ko.md).
// 모델은 키 1, 앞쪽 +Z이고 동작 클립을 담고 있다. 어떤 클립을 얼마나 섞을지는 character-clips가 정하고, 여기서는 그대로 재생한다.

/** 키 1인 모델을 키우는 배율. 도형 캐릭터 때 키(약 2.27 × 1.25)의 0.8이다(가구와 어울리게 줄임). */
const SIZE = 0.8;
export const MODEL_SCALE = 2.27 * 1.25 * SIZE;
const LINE = 0x3d1b0f;
/** 외곽선 껍질을 부풀리는 거리(키 1 기준). 설정의 외곽선 굵기 배율을 곱한다. */
const OUTLINE_THICKNESS = 0.012;
/** 말풍선 꼬리가 닿을 높이(바닥에서). 모델 키에 맞춰 도형 캐릭터 때(3.2)에 SIZE를 곱한다. 몸이 들리면 머리를 따라 올라간다. */
export const BUBBLE_HEIGHT = 3.2 * SIZE;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MODEL_ASSET = require("../../../assets/models/writeloop.glb");

export interface CharacterHandle {
  /** 누르기 판정과 위치·방향을 맡는 묶음. */
  group: THREE.Group;
  /** 매 프레임 시뮬레이션 상태로 자세를 맞춘다. 돌려준 값은 서 있을 때보다 몸이 들린 높이(칸)다(그림자 크기에 쓴다). */
  update(sim: LobbySim, dt: number, nowSec: number): number;
  /** 말풍선 꼬리가 닿을 월드 좌표. */
  bubblePoint(): THREE.Vector3;
}

/** 책장에서 꺼내 펼치는 책(칸). 덮은 책 폭·높이·두께. */
const BOOK = { width: 0.52, height: 0.62, thickness: 0.08 };

/**
 * 손에 드는 책. 책등(세로축)을 가운데로 두 쪽이 펼쳐진다. 반환한 open(0 덮음 ~ 1 펼침)으로 두 쪽을 돌린다.
 * 재질은 카툰 명암을 따르도록 toonMaterials로 돌려준다.
 */
function makeBook(): { group: THREE.Group; setOpen: (open: number) => void; materials: THREE.MeshToonMaterial[]; dispose: () => void } {
  const group = new THREE.Group();
  const cover = new THREE.MeshToonMaterial({ color: 0xc0392b });
  const pages = new THREE.MeshToonMaterial({ color: 0xfff6e0 });
  const line = new THREE.MeshBasicMaterial({ color: LINE, side: THREE.BackSide });
  const half = BOOK.width / 2;
  const geometries: THREE.BufferGeometry[] = [];
  const halves = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    const coverGeo = new THREE.BoxGeometry(half, BOOK.height, 0.015);
    const pageGeo = new THREE.BoxGeometry(half * 0.94, BOOK.height * 0.94, BOOK.thickness / 2 - 0.015);
    geometries.push(coverGeo, pageGeo);
    const coverMesh = new THREE.Mesh(coverGeo, cover);
    coverMesh.position.set((side * half) / 2, 0, -0.0075);
    const outline = new THREE.Mesh(coverGeo, line);
    outline.position.copy(coverMesh.position);
    outline.scale.setScalar(1.12);
    const pageMesh = new THREE.Mesh(pageGeo, pages);
    pageMesh.position.set((side * half * 0.94) / 2, 0, (BOOK.thickness / 2 - 0.015) / 2);
    pivot.add(coverMesh, outline, pageMesh);
    group.add(pivot);
    return { pivot, side };
  });
  for (const o of [group, ...halves.map((h) => h.pivot)]) o.traverse((m) => ((m as THREE.Mesh).raycast = () => {}));
  return {
    group,
    // 덮으면 두 쪽이 책등을 축으로 앞(+z)으로 접혀 겹치고, 펼치면 나란히 앞을 본다
    setOpen(open) {
      for (const h of halves) h.pivot.rotation.y = -h.side * (Math.PI / 2) * (1 - open);
    },
    materials: [cover, pages],
    dispose() {
      geometries.forEach((g) => g.dispose());
      cover.dispose();
      pages.dispose();
      line.dispose();
    }
  };
}

/** 외곽선 굵기·배율(착용 아이템도 같은 값을 쓴다). */
export type CharacterOutlineUniforms = OutlineUniforms;

/** 라룹이와 같은 갈색 외곽선 재질(법선 방향으로 부풀림). 착용 아이템이 쓴다. */
export function characterOutlineMaterial(uniforms: OutlineUniforms): THREE.MeshBasicMaterial {
  return outlineMaterial(uniforms, outlineAttributes({ hasOutlineNormal: false, hasOutlineBias: false }));
}

interface OutlineUniforms {
  thickness: { value: number };
  scale: { value: number };
}

/**
 * 외곽선 재질. 모델에 구워 넣은 방향(_outline_normal)으로 부풀리고, 구워 넣은 거리(_outline_bias)만큼 카메라에서 뒤로 민다.
 * 속성이 없는 모델이면 꼭짓점 법선과 고정 거리로 대신한다(outline-attributes).
 */
function outlineMaterial(uniforms: OutlineUniforms, choice: OutlineAttributeChoice): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({ color: LINE, side: THREE.BackSide });
  const direction = choice.direction;
  const bias = choice.bias.source === "attribute" ? choice.bias.attribute : `${choice.bias.value.toFixed(4)}`;
  const declare =
    (direction === "_outline_normal" ? "attribute vec3 _outline_normal;\n" : "") +
    (choice.bias.source === "attribute" ? "attribute float _outline_bias;\n" : "");
  material.onBeforeCompile = (shader) => {
    shader.uniforms.outlineThickness = uniforms.thickness;
    shader.uniforms.outlineScale = uniforms.scale;
    shader.vertexShader =
      "uniform float outlineThickness;\nuniform float outlineScale;\n" +
      declare +
      shader.vertexShader
        .replace("#include <beginnormal_vertex>", `vec3 objectNormal = ${direction};`)
        .replace("#include <begin_vertex>", `vec3 transformed = position + normalize(${direction}) * outlineThickness;`)
        .replace(
          "#include <project_vertex>",
          `vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);\nmvPosition.z -= ${bias} * outlineScale;\ngl_Position = projectionMatrix * mvPosition;`
        );
  };
  // 고른 속성에 따라 셰이더가 달라지므로, 같은 재질로 묶어 컴파일하지 않게 구별한다.
  material.customProgramCacheKey = () => `writeloop-outline:${direction}:${bias}`;
  return material;
}

/** 방 가구와 함께 쓰는 카툰 명암. 명암 단계를 바꾸면 화면이 gradient를 새로 만들어 toonMaterials에 바꿔 끼운다. */
export interface ToonKit {
  gradient: THREE.Texture;
  toonMaterials: THREE.MeshToonMaterial[];
}

interface CharacterProps {
  kit: ToonKit;
  outline: number;
  handleRef: MutableRefObject<CharacterHandle | null>;
  /** 입은 착용 아이템(①의 부위 넷, 참·거짓). 없으면 아무것도 입지 않는다. */
  wear?: WearState;
  /** 부위 일곱마다 입은 아이템 종류(⑤). 주면 이 값으로 모델·색을 고르고, 없으면 wear의 넷을 기본 아이템으로 그린다. */
  look?: WearLook | null;
}

/** 모델을 불러와 장면에 붙인다. 다 불러올 때까지는 아무것도 그리지 않는다(Suspense). */
export function Character({ kit, outline, handleRef, wear = NO_WEAR, look = null }: CharacterProps) {
  // 모델 자산은 require로 받은 번들 자산 번호다. R3F 네이티브가 expo-asset으로 파일을 찾아 읽는다.
  const gltf = useLoader(GLTFLoader, MODEL_ASSET as string) as GLTF;
  const built = useMemo(() => {
    // useLoader는 불러온 모델을 앱 전체에서 한 번만 두고 다시 열 때도 같은 것을 준다. 고치기 전에 뼈대째 복제한다
    // (그대로 고치면 로비를 다시 열 때 앞서 붙인 외곽선 껍질까지 다시 바뀐다).
    const model = cloneSkinned(gltf.scene);
    const group = new THREE.Group();
    const lift = new THREE.Group();
    group.add(lift);
    lift.add(model);
    model.scale.setScalar(MODEL_SCALE);
    const uniforms: OutlineUniforms = { thickness: { value: OUTLINE_THICKNESS }, scale: { value: MODEL_SCALE } };
    const shellMaterials: THREE.Material[] = [];
    const materials: THREE.MeshToonMaterial[] = [];
    const skinned: THREE.SkinnedMesh[] = [];
    model.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned.push(o as THREE.SkinnedMesh);
    });
    // 몸의 외곽선 껍질(고글을 감출 때 몸과 함께 모양 변형을 준다)
    for (const mesh of skinned) {
      const source = mesh.material as THREE.MeshStandardMaterial;
      // 꼬리 뿌리처럼 면이 접혀 겹친 자리에서 몇 장이 뒤를 보여 틈이 생긴다. 닫힌 몸이라 양면으로 그려도 뒷면은 가려진다.
      // 원래 재질은 다른 복제본과 함께 쓰므로 지우지 않는다.
      const toon = new THREE.MeshToonMaterial({ map: source.map, side: THREE.DoubleSide });
      mesh.material = toon;
      materials.push(toon);
      mesh.frustumCulled = false;
      // 뼈대로 휘는 메시를 누르기 판정에 쓰면 three가 꼭짓점마다 휜 자리를 다시 계산해, 끄는 동안(초당 120번) 앱이 멈춘다.
      // 판정은 아래의 보이지 않는 통이 맡는다.
      mesh.raycast = () => {};
      // 법선이 없는 모델이면 불러올 때 계산한다(명암과, 외곽선 속성이 없을 때의 부풀리는 방향에 쓴다).
      if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals();
      const choice = outlineAttributes({
        hasOutlineNormal: Boolean(mesh.geometry.attributes._outline_normal),
        hasOutlineBias: Boolean(mesh.geometry.attributes._outline_bias)
      });
      const shellMaterial = outlineMaterial(uniforms, choice);
      shellMaterials.push(shellMaterial);
      const shell = new THREE.SkinnedMesh(mesh.geometry, shellMaterial);
      shell.bind(mesh.skeleton, mesh.bindMatrix);
      shell.frustumCulled = false;
      shell.raycast = () => {};
      mesh.parent?.add(shell);
    }
    // 누르기 판정용 보이지 않는 통. 라룹이와 함께 움직이고 돈다. 점프로 몸이 들려도 귀 끝까지 들게 키보다 조금 높다.
    // (Raycaster는 보이지 않는 물체도 맞힌다.)
    const hit = new THREE.Mesh(new THREE.CapsuleGeometry(0.75 * SIZE, 1.9 * SIZE, 4, 12), new THREE.MeshBasicMaterial());
    hit.visible = false;
    hit.position.y = (0.75 + 1.9 / 2) * SIZE;
    hit.userData.isCharacter = true;
    group.add(hit);
    const mixer = new THREE.AnimationMixer(model);
    const actions = new Map<string, THREE.AnimationAction>();
    for (const clip of gltf.animations) {
      const action = mixer.clipAction(clip);
      action.play();
      action.setEffectiveWeight(0);
      actions.set(clip.name, action);
    }
    const head = model.getObjectByName("head") ?? null;
    const hips = model.getObjectByName("hips") ?? null;
    const handR = model.getObjectByName("hand_r") ?? null;
    const handL = model.getObjectByName("hand_l") ?? null;
    // 책장에서 꺼내는 책. 몸이 아니라 위치·방향 묶음(group)에 붙여 손 사이에 둔다
    const book = makeBook();
    book.group.visible = false;
    group.add(book.group);
    materials.push(...book.materials);
    return { group, lift, model, mixer, actions, materials, shellMaterials, uniforms, head, hips, hit, handR, handL, book, body: skinned[0] ?? null };
  }, [gltf]);

  // 카툰 명암 단계·외곽선 굵기 설정을 따른다.
  useEffect(() => {
    built.uniforms.thickness.value = OUTLINE_THICKNESS * outline;
  }, [built, outline]);
  // 모델 재질도 명암 목록에 넣어, 지금 명암 단계를 바로 쓰고 나중에 바꿀 때도 함께 바뀌게 한다.
  useEffect(() => {
    built.materials.forEach((m) => {
      m.gradientMap = kit.gradient;
      m.needsUpdate = true;
    });
    kit.toonMaterials.push(...built.materials);
    return () => {
      for (const m of built.materials) {
        const i = kit.toonMaterials.indexOf(m);
        if (i >= 0) kit.toonMaterials.splice(i, 1);
      }
    };
  }, [built, kit]);

  useEffect(() => {
    const look = { yaw: 0, target: 0, next: 4 };
    const upInParent = new THREE.Vector3();
    const parentQuat = new THREE.Quaternion();
    const yawQuat = new THREE.Quaternion();
    // 지난 프레임에 머리에 더 곱한 두리번 회전. 섞은 값이 바뀌지 않은 프레임에는 클립이 머리를 다시 쓰지 않아,
    // 되돌리지 않으면 회전이 쌓인다.
    const appliedYaw = new THREE.Quaternion();
    const headWorld = new THREE.Vector3();
    const hipsWorld = new THREE.Vector3();
    const handRLocal = new THREE.Vector3();
    const handLLocal = new THREE.Vector3();
    const handMid = new THREE.Vector3();
    const bookAt = new THREE.Vector3();
    let activeOneShot: string | null = null;
    const handle: CharacterHandle = {
      group: built.group,
      update(sim, dt, nowSec) {
        const speed = Math.hypot(sim.vx, sim.vz);
        const state = characterClipState({ speed, action: sim.action, posture: sim.posture, scene: sim.scene });
        const base = 1 - state.actionWeight;
        built.actions.get("idle")?.setEffectiveWeight(state.idleWeight * base);
        const walk = built.actions.get("walk");
        if (walk) {
          walk.setEffectiveWeight(state.walkWeight * base);
          walk.setEffectiveTimeScale(state.walkTimeScale);
        }
        // 한 번 하는 동작은 시뮬레이션의 지난 시간에 맞춰 클립 시간을 직접 둔다.
        const shot = state.actionClip;
        if (activeOneShot && activeOneShot !== shot) built.actions.get(activeOneShot)?.setEffectiveWeight(0);
        activeOneShot = shot;
        if (shot) {
          const action = built.actions.get(shot);
          if (action) {
            action.time = Math.min(state.actionTime, action.getClip().duration);
            action.setEffectiveTimeScale(0);
            action.setEffectiveWeight(state.actionWeight);
          }
        }
        if (built.head) built.head.quaternion.premultiply(appliedYaw.invert());
        appliedYaw.identity();
        built.mixer.update(dt);

        // 가만히 있을 때 가끔 고개를 돌린다(도형 캐릭터와 같은 규칙). 클립 위에 머리 뼈를 더 돌린다.
        const idle = state.walkWeight < 0.05 && !sim.action;
        if (idle && nowSec > look.next) {
          look.target = (sim.nextRandom() - 0.5) * 1.1;
          look.next = nowSec + 3 + sim.nextRandom() * 4;
        }
        if (!idle) look.target = 0;
        look.yaw += (look.target - look.yaw) * Math.min(1, dt * 4);
        if (built.head?.parent && Math.abs(look.yaw) > 1e-4) {
          built.head.parent.updateWorldMatrix(true, false);
          built.head.parent.getWorldQuaternion(parentQuat);
          upInParent.set(0, 1, 0).applyQuaternion(parentQuat.invert());
          yawQuat.setFromAxisAngle(upInParent, look.yaw);
          built.head.quaternion.premultiply(yawQuat);
          appliedYaw.copy(yawQuat);
        }

        built.group.position.set(sim.x, 0, sim.z);
        built.group.rotation.y = sim.heading + state.spinAngle;
        // 의자에 올라앉으면 몸 전체를 의자 높이로 올린다
        built.lift.position.y = state.spinLift + sim.sceneLift();

        // 손에 든 책: 오른손에서 두 손 사이로 옮겨 가고, 앞으로 기울여 펼친다
        const book = sim.sceneBook();
        built.book.group.visible = book.visible && Boolean(built.handR && built.handL);
        if (built.book.group.visible && built.handR && built.handL) {
          built.group.updateMatrixWorld(true);
          built.group.worldToLocal(built.handR.getWorldPosition(handRLocal));
          built.group.worldToLocal(built.handL.getWorldPosition(handLLocal));
          bookAt.copy(handRLocal).lerp(handMid.copy(handRLocal).add(handLLocal).multiplyScalar(0.5), book.hold);
          // 머리가 커서 위에서 보는 카메라에 가리지 않게 배 앞으로 내밀고, 펼친 면이 위(카메라 쪽)를 보게 뒤로 눕힌다
          built.book.group.position.set(bookAt.x, bookAt.y + 0.3 * book.hold, bookAt.z + 0.55 * book.hold + 0.08);
          built.book.group.rotation.set(-1.15 * book.hold, 0, 0);
          built.book.setOpen(book.open);
        }
        if (!built.hips) return state.spinLift;
        built.hips.getWorldPosition(hipsWorld);
        return Math.max(0, hipsWorld.y - hipsRestY);
      },
      bubblePoint() {
        if (!built.head) return new THREE.Vector3(built.group.position.x, BUBBLE_HEIGHT, built.group.position.z);
        built.head.getWorldPosition(headWorld);
        return new THREE.Vector3(built.group.position.x, headWorld.y + headToBubble, built.group.position.z);
      }
    };
    // 서 있는 자세의 머리 높이를 재어, 말풍선이 도형 캐릭터 때와 같은 높이에 오게 한다.
    built.actions.get("idle")?.setEffectiveWeight(1);
    built.mixer.update(0);
    built.group.updateMatrixWorld(true);
    const headToBubble = built.head ? BUBBLE_HEIGHT - built.head.getWorldPosition(new THREE.Vector3()).y : 0;
    const hipsRestY = built.hips ? built.hips.getWorldPosition(new THREE.Vector3()).y : 0;
    handleRef.current = handle;
    return () => {
      // 다시 만들어질 때 새 라룹이가 먼저 넣고 옛 것의 정리가 뒤에 돌 수 있어, 자기가 넣은 손잡이일 때만 지운다
      if (handleRef.current === handle) handleRef.current = null;
      built.mixer.stopAllAction();
      built.materials.forEach((m) => m.dispose());
      built.shellMaterials.forEach((m) => m.dispose());
      built.hit.geometry.dispose();
      (built.hit.material as THREE.Material).dispose();
      built.book.dispose();
    };
  }, [built, handleRef]);

  // 착용 아이템(라룹이 고글 포함): 한 번이라도 입으면 착용 모듈을 불러와 붙인다(벗어도 붙인 채 숨긴다).
  // 입은 것을 모르면(look 없음) 고글을 쓴 모습이라 처음부터 붙인다
  const [wearHost, setWearHost] = useState<WearablesModule.WearHost | null>(null);
  // 배치를 다시 지어 명암 목록(kit)이 새로 생기면, 착용 재질도 새 목록에 넣도록 다시 붙인다
  useEffect(() => {
    if (!built.body) return;
    if (wearHost ? wearHost.kit === kit && wearHost.body === built.body : !wearsAnything(wear, look)) return;
    setWearHost({ model: built.model, body: built.body, uniforms: built.uniforms, kit });
  }, [built, kit, wear, look, wearHost]);

  return (
    <>
      {/* react-three-fiber의 three 객체 속성(object)이라 RN 린트 규칙이 모르는 속성으로 본다. */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <primitive object={built.group} />
      {wearHost ? <WearLayer host={wearHost} wear={wear} look={look} /> : null}
    </>
  );
}

/** 착용 모듈(착용 모델·도형 도구)은 처음 입을 때 불러온다. */
function WearLayer({ host, wear, look }: { host: WearablesModule.WearHost; wear: WearState; look: WearLook | null }) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("./lobby3d-wearables") as typeof WearablesModule;
  return (
    <mod.WearablesErrorBoundary>
      <Suspense fallback={null}>
        <mod.Wearables host={host} wear={wear} look={look} />
      </Suspense>
    </mod.WearablesErrorBoundary>
  );
}

/** 모델을 불러오지 못하면 캐릭터 없이 방만 보이게 한다. 오류는 개발 콘솔에 남긴다. */
export class CharacterErrorBoundary extends Component<{ children: ReactNode; onFailed?: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("[lobby3d] 라이트루프 모델을 불러오지 못했습니다", error);
    this.props.onFailed?.();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
