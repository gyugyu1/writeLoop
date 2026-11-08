import { useFrame, useLoader } from "@react-three/fiber/native";
import { Component, useEffect, useMemo, type MutableRefObject, type ReactNode } from "react";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ROOM, activeLobbyLayout } from "@/lib/lobby3d/engine";
import { currentFurnitureLayout } from "@/lib/lobby3d/furniture-layout";
import { wallPiecePose, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";
import type { DaylightState } from "./lobby3d-daylight";
import { createOutdoor } from "./lobby3d-outdoor";

// 라룹이 방의 가구. Kenney Furniture Kit(CC0)에서 고른 가구를 scripts/lobby3d/build-furniture.py가 한 glb로 묶는다.
// 묶음마다 이름(FurniturePiece)이 있고, 놓는 자리는 지금 배치(currentFurnitureLayout)가 정한다.
// 누르기 판정은 코드로 만든 대체 모양이 보이지 않는 채로 맡으므로, 여기서는 판정을 받지 않는다.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const FURNITURE_ASSET = require("../../../assets/models/lobby-furniture.glb");

/** 창밖이 보이는 판을 창 기준점에서 뒤로 미는 거리(칸). 미닫이 유리와 벽 사이다. */
const VIEW_DEPTH = 0.15;

/**
 * 창밖을 들여다보는 눈의 자리(창 기준, 칸). 실제 카메라는 높이 떠서 내려다보므로 그대로 들여다보면 창 너머 풀밭만 보인다.
 * 그래서 창 정면 조금 위, 창에서 EYE_DISTANCE만큼 떨어진 눈으로 들여다본다. 옆으로는 카메라를 EYE_FOLLOW만큼 따라가 창 너머가 함께 움직여 보인다.
 */
const EYE_HEIGHT = 0.2;
const EYE_DISTANCE = 2.6;
const EYE_FOLLOW = 0.5;

/** 바깥 풀밭이 창 가운데보다 낮은 거리(칸). 창 너머로 덤불·울타리·나무가 알맞게 보이는 높이다. */
const OUTDOOR_DROP = 2.05;

/** 창밖 그림판의 크기(화소). 창 안쪽 비율(가로 2 : 세로 1.78 남짓)에 맞추고, 매끄럽게 보이게 화면에 보이는 크기보다 크게 그린다. */
const VIEW_TEXTURE = { width: 768, height: 680 };

interface BakedFurnitureProps {
  /** 코드로 만든 대체 가구. 가구 묶음이 뜨는 동안 숨긴다(누르기 판정은 그대로 맡는다). */
  fallback: THREE.Object3D;
  /** 지금 보이는 하루의 때 색감과 계절(창밖 풍경이 따라간다). */
  daylight: DaylightState;
  /** 창밖 장면이 따를 배치(창문이 걸린 벽과 자리). 없으면 지금 배치다. 편집 모드에서는 놓인 배치다. */
  lightLayout?: MutableRefObject<LobbyLayout>;
}

export function BakedFurniture({ fallback, daylight, lightLayout }: BakedFurnitureProps) {
  const gltf = useLoader(GLTFLoader, FURNITURE_ASSET as string) as GLTF;
  // 창밖: 방과 따로 둔 장면과, 창문 자리에서 그 장면을 들여다볼 카메라·그림판.
  // 장면은 뒷벽 가운데(x 0) 너머에 짓고, 매 프레임 창문이 걸린 벽 너머로 옮기고 돌린다(어느 벽이든 같은 마당이 보인다)
  const outdoor = useMemo(() => createOutdoor(0, 0), []);
  // 창이 높이 걸려도 창 너머 풀밭과 덤불이 창 아래쪽에 보이게, 바깥 풀밭을 창 가운데보다 OUTDOOR_DROP 아래에 둔다
  const groundY = useMemo(() => (currentFurnitureLayout().find((p) => p.piece === "window")?.y ?? OUTDOOR_DROP) - OUTDOOR_DROP, []);
  const target = useMemo(() => new THREE.WebGLRenderTarget(VIEW_TEXTURE.width, VIEW_TEXTURE.height), []);
  const eyeCamera = useMemo(() => new THREE.PerspectiveCamera(), []);
  const built = useMemo(() => {
    const root = new THREE.Group();
    // 같은 색의 재질은 하나만 만든다. 방과 같은 부드러운 명암을 쓴다.
    // Kenney 모델은 색을 화면 색(sRGB) 값 그대로 적어 두었다(예: 나무 0.896, 0.602, 0.393 = #E59A64).
    // glTF는 그 값을 선형 값으로 읽으므로 그대로 쓰면 하얗게 바랜다. sRGB 값으로 보고 선형으로 바꾼다.
    const materials = new Map<string, THREE.MeshLambertMaterial>();
    // 유리: 창밖 풍경이 비치게 살짝 하늘빛 도는 반투명으로 한다.
    const glass = new THREE.MeshBasicMaterial({ color: 0xe6f6ff, transparent: true, opacity: 0.18, depthWrite: false, toneMapped: false });
    // 가구 묶음에는 구석 어둠이 꼭짓점 색으로 구워져 있다(테두리 없이 명암으로 모양이 보이게). 그 색을 곱해 칠한다.
    const soft = (source: THREE.Material, shaded: boolean) => {
      if (source.name.startsWith("glass")) return glass;
      const color = (source as THREE.MeshStandardMaterial).color ?? new THREE.Color(0xffffff);
      const key = `${color.getHexString()}${shaded ? "-ao" : ""}`;
      let m = materials.get(key);
      if (!m) {
        m = new THREE.MeshLambertMaterial({ color: color.clone().convertSRGBToLinear(), vertexColors: shaded });
        materials.set(key, m);
      }
      return m;
    };
    // 창 안쪽 크기: 가구 묶음의 windowView 판에서 잰다
    const viewBox = new THREE.Box3();
    const viewSource = gltf.scene.getObjectByName("windowView");
    if (viewSource) viewBox.setFromObject(viewSource);
    const viewSize = viewBox.getSize(new THREE.Vector3());
    // 바닥의 창문 빛도 같은 창 안쪽 크기를 따른다(창 모델 크기가 바뀌면 함께 바뀐다)
    if (viewSource) daylight.opening = { width: viewSize.x, height: viewSize.y };
    const views: { piece: THREE.Object3D; halfWidth: number; halfHeight: number }[] = [];
    for (const place of currentFurnitureLayout()) {
      const source = gltf.scene.getObjectByName(place.piece);
      if (!source) continue;
      // useLoader가 준 장면은 앱 전체에서 함께 쓰므로 복제해서 쓴다(창문처럼 같은 가구를 여러 번 놓기도 한다).
      const piece = source.clone(true);
      piece.position.set(place.x, place.y, place.z);
      piece.rotation.set(0, place.rotY, 0);
      // 일기 책상 의자는 '들어가기' 때 뒤로 뺀다(3D 화면이 이 자리에서 옮긴다)
      if (place.piece === "chair") piece.userData.chairBase = { x: place.x, z: place.z };
      // 편집 모드에서 3D 화면이 이 가구를 편집 중인 자리로 옮긴다
      piece.userData.furnitureOf = place.piece;
      const meshes: THREE.Mesh[] = [];
      piece.traverse((o) => {
        if (o instanceof THREE.Mesh) meshes.push(o);
      });
      for (const o of meshes) {
        const shaded = o.geometry.hasAttribute("color");
        o.material = Array.isArray(o.material) ? o.material.map((m) => soft(m, shaded)) : soft(o.material, shaded);
        o.raycast = () => {};
      }
      if (place.piece === "window" && viewSource && views.length === 0) {
        // 창 안쪽에 창밖 그림판을 둔다. 매 프레임 창밖 장면을 들여다본 모습을 그린다(아래 useFrame).
        const view = new THREE.Mesh(new THREE.PlaneGeometry(viewSize.x, viewSize.y), new THREE.MeshBasicMaterial({ map: target.texture, toneMapped: false }));
        view.position.set(0, 0, -VIEW_DEPTH);
        view.raycast = () => {};
        piece.add(view);
        views.push({ piece, halfWidth: viewSize.x / 2, halfHeight: viewSize.y / 2 });
      }
      root.add(piece);
    }
    return { root, view: views[0] ?? null };
  }, [gltf, target, daylight]);
  const group = built.root;

  // 창밖 그리기: 창 정면에서 창 안쪽을 화면 삼아 들여다본다(눈이 창 정면에서 비껴 있어도 창 네 모서리가 그림 네 모서리에 맞는 비스듬한 원근).
  const eye = useMemo(() => new THREE.Vector3(), []);
  useFrame((state, delta) => {
    const view = built.view;
    if (!view) return;
    const mount = wallPiecePose((lightLayout?.current ?? activeLobbyLayout()).wall.window, ROOM.width);
    outdoor.scene.position.set(mount.x, groundY, mount.z);
    outdoor.scene.rotation.y = mount.rotY;
    outdoor.setDaylight(daylight.ambience, daylight.target.season, daylight.target.phase);
    outdoor.update(state.clock.elapsedTime, delta);
    view.piece.updateWorldMatrix(true, false);
    eye.copy(state.camera.position);
    view.piece.worldToLocal(eye);
    eye.set(THREE.MathUtils.clamp(eye.x * EYE_FOLLOW, -1.5, 1.5), EYE_HEIGHT, EYE_DISTANCE);
    const near = EYE_DISTANCE + VIEW_DEPTH;
    eyeCamera.projectionMatrix.makePerspective(
      -view.halfWidth - eye.x,
      view.halfWidth - eye.x,
      view.halfHeight - eye.y,
      -view.halfHeight - eye.y,
      near,
      near + 120
    );
    eyeCamera.projectionMatrixInverse.copy(eyeCamera.projectionMatrix).invert();
    view.piece.localToWorld(eyeCamera.position.copy(eye));
    view.piece.getWorldQuaternion(eyeCamera.quaternion);
    eyeCamera.updateMatrixWorld(true);
    const gl = state.gl;
    const previous = gl.getRenderTarget();
    gl.setRenderTarget(target);
    gl.render(outdoor.scene, eyeCamera);
    gl.setRenderTarget(previous);
  });

  useEffect(() => {
    return () => {
      outdoor.dispose();
      target.dispose();
    };
  }, [outdoor, target]);

  useEffect(() => {
    fallback.visible = false;
    return () => {
      fallback.visible = true;
      const seen = new Set<THREE.Material>();
      group.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (!seen.has(m)) {
            seen.add(m);
            m.dispose();
          }
        }
      });
    };
  }, [fallback, group]);

  // react-three-fiber의 three 객체 속성(object)이라 RN 린트 규칙이 모르는 속성으로 본다.
  // eslint-disable-next-line react/no-unknown-property
  return <primitive object={group} />;
}

/** 가구 묶음을 불러오지 못하면 코드로 만든 대체 가구가 그대로 보이게 한다. 오류는 개발 콘솔에 남긴다. */
export class BakedFurnitureErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("[lobby3d] 가구 묶음을 불러오지 못했습니다", error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
