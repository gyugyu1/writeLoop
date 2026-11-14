import { useFrame, useLoader } from "@react-three/fiber/native";
import { Component, useEffect, useMemo, useState, type MutableRefObject, type ReactNode } from "react";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useItemCatalog } from "@/lib/item-catalog-store";
import { useItemFiles } from "@/lib/item-files";
import { ROOM, activeLobbyLayout } from "@/lib/lobby3d/engine";
import { BUNDLED_FURNITURE_TYPES, bundledFurnitureModels, furnitureModelSource, requestFurnitureModel, type FurnitureModelSource } from "@/lib/lobby3d/furniture-files";
import { buildPlacements, currentFurnitureLayout, placedItemType, placementKey, type FurniturePlacement } from "@/lib/lobby3d/furniture-layout";
import { viewWindow, wallPiecePose, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";
import type { DaylightState } from "./lobby3d-daylight";
import { createOutdoor } from "./lobby3d-outdoor";

// 라룹이 방의 가구. 가구마다 모델 파일(glb) 하나이고, 그 안의 이름(카탈로그의 모델 이름) 붙은 묶음을 복제해 놓는다.
// 처음 방 가구 일곱은 앱에 든 파일이라 바로 그리고, 그 밖의 가구는 서버 아이템 목록의 파일을 받아 그린다(furniture-files).
// 받기 전이거나 받지 못한 가구는 코드로 만든 대체 상자(lobby3d-canvas의 대체 가구)를 복제해 자리를 보이고, 받으면 모델로 바꾼다.
// 보관함 가구는 꺼내져 보이게 되면 그때 모델을 받는다. 놓는 자리는 지금 배치(currentFurnitureLayout)가 정한다.
// 누르기 판정은 코드로 만든 대체 모양이 보이지 않는 채로 맡으므로, 여기서는 판정을 받지 않는다.

/** 기기에 받은 모델 파일을 읽은 것(파일마다 한 번, 앱 전체에서 함께 쓴다). */
const REMOTE_MODELS = new Map<string, Promise<GLTF | null>>();

function loadRemoteModel(source: FurnitureModelSource): Promise<GLTF | null> {
  let job = REMOTE_MODELS.get(source.key);
  if (!job) {
    job = new GLTFLoader().loadAsync(source.url as string).catch((error: unknown) => {
      console.warn("[lobby3d] 받은 가구 모델을 읽지 못했습니다", error);
      REMOTE_MODELS.delete(source.key);
      return null;
    }) as Promise<GLTF | null>;
    REMOTE_MODELS.set(source.key, job);
  }
  return job;
}

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

/**
 * 창밖 그림판을 새로 그리는 간격(초). 마당 장면을 따로 한 번 더 그리는 일이 로비에서 가장 무거워(2026-11-11 측정: 매 프레임이면 FPS 43~53, 안 그리면 81),
 * 움직임(나무·구름·새)은 초당 10번만 새로 그린다. 카메라나 창이 움직이는 동안은 창 너머가 어긋나 보이지 않게 매 프레임 그린다.
 */
const VIEW_REDRAW_SECONDS = 0.1;

/** 카메라·창 자리가 움직였다고 볼 차이(칸·라디안). 라이트루프를 따라가는 카메라가 멈춘 뒤 아주 조금씩 다가가는 것은 움직임으로 보지 않는다. */
const VIEW_MOVE_EPS = 1e-4;

/** 두 행렬·벡터가 VIEW_MOVE_EPS 안에서 같은지. */
const nearlySame = (a: ArrayLike<number>, b: ArrayLike<number>) => {
  for (let i = 0; i < a.length; i += 1) if (Math.abs(a[i] - b[i]) > VIEW_MOVE_EPS) return false;
  return true;
};

interface BakedFurnitureProps {
  /** 코드로 만든 대체 가구. 가구 묶음이 뜨는 동안 숨긴다(누르기 판정은 그대로 맡는다). */
  fallback: THREE.Object3D;
  /** 지금 보이는 하루의 때 색감과 계절(창밖 풍경이 따라간다). */
  daylight: DaylightState;
  /** 가구를 만들 배치(3D 화면이 정한다). 없으면 지금 배치다. */
  layout?: LobbyLayout;
  /** 배치 밖에서 따로 붙일 가구 자리(꾸미기 중 미리 만들지 않은 가구). 배치를 다시 만들지 않고 이 가구만 더한다. */
  added?: FurniturePlacement[];
  /** 창밖 장면이 따를 배치(창문이 걸린 벽과 자리). 없으면 지금 배치다. 편집 모드에서는 놓인 배치다. */
  lightLayout?: MutableRefObject<LobbyLayout>;
  /** 고른 창문이 떠 있는 만큼(편집 모드). 창밖 장면도 같은 만큼 옮겨 창틀과 함께 나온다. */
  windowLift?: MutableRefObject<{ x: number; y: number; z: number }>;
  /** 창밖 장면을 알려 줄 자리. 3D 화면이 방을 처음 보이기 전에 이 장면의 셰이더와 그림도 미리 준비한다. */
  outdoorRef?: MutableRefObject<THREE.Scene | null>;
}

export function BakedFurniture({ layout, added, fallback, daylight, lightLayout, windowLift, outdoorRef }: BakedFurnitureProps) {
  // 앱에 든 처음 방 가구 일곱은 미리 읽어 둔 것을 함께 쓴다(로비가 처음 그릴 때 기다린다)
  const starterModules = useMemo(() => bundledFurnitureModels() as unknown as string[], []);
  const starters = useLoader(GLTFLoader, starterModules) as GLTF[];
  // 받은 목록이나 받은 파일이 바뀌면 가구마다 그릴 모델을 다시 고른다
  const catalog = useItemCatalog();
  const filesTick = useItemFiles();
  // 받은 모델 파일을 다 읽으면 1씩 는다(그 가구를 대체 상자에서 모델로 바꾼다)
  const [remoteTick, setRemoteTick] = useState(0);
  const models = useMemo(() => {
    const map = new Map<string, GLTF>();
    BUNDLED_FURNITURE_TYPES.forEach((type, i) => map.set(`bundled:${type}`, starters[i]));
    return map;
  }, [starters]);
  // 창밖: 방과 따로 둔 장면과, 창문 자리에서 그 장면을 들여다볼 카메라·그림판.
  // 장면은 뒷벽 가운데(x 0) 너머에 짓고, 그릴 때마다 창문이 걸린 벽 너머로 옮기고 돌린다(어느 벽이든 같은 마당이 보인다)
  const outdoor = useMemo(() => createOutdoor(0, 0), []);
  // 창이 높이 걸려도 창 너머 풀밭과 덤불이 창 아래쪽에 보이게, 바깥 풀밭을 창 가운데보다 OUTDOOR_DROP 아래에 둔다
  const groundY = useMemo(() => (currentFurnitureLayout().find((p) => p.view)?.y ?? OUTDOOR_DROP) - OUTDOOR_DROP, []);
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
    // 가구 모델에는 구석 어둠이 꼭짓점 색으로 구워져 있다(테두리 없이 명암으로 모양이 보이게). 그 색을 곱해 칠한다.
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
    // 창 안쪽 크기: 앱에 든 창문 모델의 windowView 판에서 잰다
    const viewBox = new THREE.Box3();
    const viewSource = models.get("bundled:window")?.scene.getObjectByName("windowView") ?? null;
    if (viewSource) viewBox.setFromObject(viewSource);
    const viewSize = viewBox.getSize(new THREE.Vector3());
    // 바닥의 창문 빛도 같은 창 안쪽 크기를 따른다(창 모델 크기가 바뀌면 함께 바뀐다)
    if (viewSource) daylight.opening = { width: viewSize.x, height: viewSize.y };
    // 창밖 그림판(창 하나에만 붙인다. 창문 모델이 바뀌면 새 모델로 옮겨 붙인다)
    const viewPlane = viewSource
      ? new THREE.Mesh(new THREE.PlaneGeometry(viewSize.x, viewSize.y), new THREE.MeshBasicMaterial({ map: target.texture, toneMapped: false }))
      : null;
    if (viewPlane) {
      viewPlane.position.set(0, 0, -VIEW_DEPTH);
      viewPlane.raycast = () => {};
    }
    const view: { current: { piece: THREE.Object3D; halfWidth: number; halfHeight: number } | null } = { current: null };
    /** 만든 가구 자리마다: 자리, 가구 종류, 지금 그린 모델(null이면 대체 상자), 3D 물체. */
    const entries = new Map<string, { place: FurniturePlacement; type: string | undefined; sourceKey: string | null; object: THREE.Object3D }>();

    /** 그 자리의 모델을 복제해 만든다. 모델 안에 그 이름이 없으면 null. */
    const modelPiece = (place: FurniturePlacement, gltf: GLTF): THREE.Object3D | null => {
      const source = gltf.scene.getObjectByName(place.piece);
      if (!source) return null;
      // 읽은 장면은 앱 전체에서 함께 쓰므로 복제해서 쓴다(창문처럼 같은 가구를 여러 번 놓기도 한다).
      const piece = source.clone(true);
      // 모델을 칸에 맞게 줄이거나 늘린다(가로·깊이만, 카탈로그의 공통 규칙)
      if (place.scale) piece.scale.set(place.scale.x, 1, place.scale.z);
      const meshes: THREE.Mesh[] = [];
      piece.traverse((o) => {
        if (o instanceof THREE.Mesh) meshes.push(o);
      });
      for (const o of meshes) {
        const shaded = o.geometry.hasAttribute("color");
        o.material = Array.isArray(o.material) ? o.material.map((m) => soft(m, shaded)) : soft(o.material, shaded);
        o.raycast = () => {};
      }
      return piece;
    };
    /** 모델을 아직 그릴 수 없는 자리의 표시: 코드로 만든 대체 가구 상자를 복제한다(누르기 판정은 대체 가구가 그대로 맡는다). */
    const placeholderPiece = (place: FurniturePlacement): THREE.Object3D => {
      const key = placementKey(place);
      const original = fallback.children.find((child) => child.userData.furnitureOf === key);
      const piece = original ? original.clone(true) : new THREE.Group();
      piece.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.raycast = () => {};
          // 재질은 대체 가구 것을 빌려 쓴다(이 가구를 치울 때 지우지 않는다)
          o.userData.borrowed = true;
        }
      });
      return piece;
    };
    /** 그 자리를 지금 그릴 3D 물체로 만든다. fetch가 참이면(보이는 가구) 모델이 없을 때 받기를 시작한다. */
    const make = (place: FurniturePlacement, type: string | undefined, fetch: boolean) => {
      const source = type ? furnitureModelSource(type, { fetch }) : null;
      const gltf = source ? models.get(source.key) : undefined;
      if (source && !gltf && !source.bundled) {
        void loadRemoteModel(source).then((loaded) => {
          if (!loaded) return;
          models.set(source.key, loaded);
          setRemoteTick((n) => n + 1);
        });
      }
      const piece = gltf ? modelPiece(place, gltf) : null;
      return { object: piece ?? placeholderPiece(place), sourceKey: piece && source ? source.key : null };
    };
    /** 창문이면 창밖 그림판을 붙인다(아직 붙인 창이 없거나, 붙였던 창이 방에서 빠졌을 때). */
    const attachView = (place: FurniturePlacement, piece: THREE.Object3D) => {
      if (!place.view || !viewPlane) return;
      if (view.current && view.current.piece !== piece && view.current.piece.parent) return;
      piece.add(viewPlane);
      view.current = { piece, halfWidth: viewSize.x / 2, halfHeight: viewSize.y / 2 };
    };
    /** 가구 하나를 더한다. 이미 만든 자리는 건너뛴다. */
    const addPiece = (place: FurniturePlacement) => {
      const key = placementKey(place);
      if (entries.has(key)) return;
      const type = placedItemType(place.item);
      const { object: piece, sourceKey } = make(place, type, !place.stowed);
      piece.position.set(place.x, place.y, place.z);
      piece.rotation.set(0, place.rotY, 0);
      // 일기 책상 의자는 '들어가기' 때 뒤로 뺀다(3D 화면이 이 자리에서 옮긴다)
      if (place.companion) piece.userData.chairBase = { x: place.x, z: place.z };
      // 편집 모드에서 3D 화면이 이 가구를 편집 중인 자리로 옮기고, 고르면 띄운다
      piece.userData.furnitureOf = key;
      piece.userData.view = Boolean(place.view);
      piece.visible = !place.stowed;
      piece.userData.stowed = Boolean(place.stowed);
      attachView(place, piece);
      root.add(piece);
      entries.set(key, { place, type, sourceKey, object: piece });
    };
    /**
     * 그릴 모델이 바뀐 가구(받은 파일을 다 읽음, 서버 파일이 바뀜)를 바꿔 끼운다. 자리·방향·숨김은 지금 물체의 것을 그대로 옮긴다
     * (편집 중 옮긴 자리를 잃지 않게). 보이는 대체 상자는 모델 받기를 시작한다.
     */
    const refresh = () => {
      for (const [key, entry] of entries) {
        const next = make(entry.place, entry.type, !entry.object.userData.stowed);
        if (next.sourceKey === entry.sourceKey) continue;
        const old = entry.object;
        const piece = next.object;
        piece.position.copy(old.position);
        piece.rotation.copy(old.rotation);
        piece.visible = old.visible;
        piece.userData = { ...piece.userData, ...old.userData };
        if (old === view.current?.piece) {
          old.remove(viewPlane!);
          view.current = null;
        }
        attachView(entry.place, piece);
        root.remove(old);
        root.add(piece);
        entries.set(key, { ...entry, sourceKey: next.sourceKey, object: piece });
      }
    };
    /** 보이게 된 대체 상자(보관함에서 꺼냄 등)의 모델 받기를 시작한다. 같은 가구는 받은 파일이 바뀌기 전까지 한 번만 부탁한다. */
    const requested = new Set<string>();
    const requestShown = () => {
      for (const entry of entries.values()) {
        if (entry.sourceKey !== null || entry.object.userData.stowed || !entry.type || requested.has(entry.type)) continue;
        requested.add(entry.type);
        requestFurnitureModel(entry.type);
      }
    };
    // 보관함 가구도 만들어 숨겨 둔다(꾸미기에서 꺼내면 3D 화면이 보인다)
    for (const place of buildPlacements(layout ?? activeLobbyLayout())) addPiece(place);
    return { root, view, addPiece, refresh, requested, requestShown };
  }, [models, target, daylight, layout, fallback]);
  const group = built.root;
  // 꾸미기 중 붙일 가구: 이미 만든 묶음에 그 가구만 더한다(여러 번 불러도 같다)
  useMemo(() => added?.forEach(built.addPiece), [built, added]);
  // 받은 목록·파일이 바뀌거나 받은 모델을 다 읽으면 그 가구를 바꿔 끼운다. 받은 파일이 바뀌면 실패했던 받기도 다시 부탁할 수 있다
  useEffect(() => {
    built.requested.clear();
    built.refresh();
  }, [built, catalog, filesTick, remoteTick]);

  // 창밖 그리기: 창 정면에서 창 안쪽을 화면 삼아 들여다본다(눈이 창 정면에서 비껴 있어도 창 네 모서리가 그림 네 모서리에 맞는 비스듬한 원근).
  const eye = useMemo(() => new THREE.Vector3(), []);
  // 마지막으로 그린 때(시계 초)와 그때의 카메라·창 자리. 처음에는 바로 그린다
  const drawn = useMemo(() => ({ at: -Infinity, camera: new THREE.Matrix4(), place: new THREE.Vector4(), piece: new THREE.Matrix4() }), []);
  const place = useMemo(() => new THREE.Vector4(), []);
  useFrame((state, frameDelta) => {
    // 꾸미기에서 꺼내 보이게 된 대체 상자는 그때 모델을 받는다
    built.requestShown();
    const view = built.view.current;
    if (!view) return;
    const hung = viewWindow(lightLayout?.current ?? activeLobbyLayout());
    if (!hung) return;
    const mount = wallPiecePose(hung, ROOM.width);
    const lift = windowLift?.current;
    // 창밖 장면이 놓일 자리(창 자리 + 띄운 만큼)와 방향. 카메라와 이것이 그대로이고 간격이 지나지 않았으면 앞서 그린 그림을 둔다
    place.set(mount.x + (lift?.x ?? 0), groundY + (lift?.y ?? 0), mount.z + (lift?.z ?? 0), mount.rotY);
    const now = state.clock.elapsedTime;
    // 창문 자체의 자리도 본다. 끄는 동안은 창밖 장면이 끌기 전 자리에 머물러도(lightLayout) 창문은 손가락을 따라 움직인다
    view.piece.updateWorldMatrix(true, false);
    const moved =
      !nearlySame(state.camera.matrixWorld.elements, drawn.camera.elements) ||
      !nearlySame(place.toArray(), drawn.place.toArray()) ||
      !nearlySame(view.piece.matrixWorld.elements, drawn.piece.elements);
    if (!moved && now - drawn.at < VIEW_REDRAW_SECONDS) return;
    drawn.camera.copy(state.camera.matrixWorld);
    drawn.place.copy(place);
    drawn.piece.copy(view.piece.matrixWorld);
    // 움직임은 시각으로 정해져, 건너뛴 프레임이 있어도 그리는 순간의 모습이 맞다(구름처럼 흐르는 것은 지난 시간만큼 한 번에 간다)
    const delta = drawn.at === -Infinity ? frameDelta : now - drawn.at;
    drawn.at = now;
    outdoor.scene.position.set(place.x, place.y, place.z);
    outdoor.scene.rotation.y = place.w;
    outdoor.setDaylight(daylight.ambience, daylight.target.season, daylight.target.phase);
    outdoor.update(now, delta);
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
    if (outdoorRef) outdoorRef.current = outdoor.scene;
    return () => {
      if (outdoorRef?.current === outdoor.scene) outdoorRef.current = null;
      outdoor.dispose();
      target.dispose();
    };
  }, [outdoor, target, outdoorRef]);

  useEffect(() => {
    fallback.visible = false;
    return () => {
      fallback.visible = true;
      const seen = new Set<THREE.Material>();
      group.traverse((o) => {
        if (!(o instanceof THREE.Mesh) || o.userData.borrowed) return;
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
export class BakedFurnitureErrorBoundary extends Component<{ children: ReactNode; onFailed?: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("[lobby3d] 가구 묶음을 불러오지 못했습니다", error);
    this.props.onFailed?.();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
