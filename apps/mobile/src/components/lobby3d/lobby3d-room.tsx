import { useLoader } from "@react-three/fiber/native";
import { Component, useEffect, useMemo, type ReactNode } from "react";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

// 빛과 그림자를 구워 넣은 방 껍데기(바닥, 벽, 걸레받이, 바닥판, 입구 발판). Blender에서 굽는다.
// 그림에 빛이 이미 들어 있어 조명을 받지 않는 재질로 그리고, 화면 톤 보정도 하지 않는다(구운 색 그대로).
// 가구와 가구 그림자는 앱이 따로 그린다.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ROOM_ASSET = require("../../../assets/models/lobby-room.glb");

interface BakedRoomProps {
  /** 코드로 지은 방 껍데기. 구운 방이 뜨는 동안 숨긴다. */
  fallback: THREE.Object3D;
}

export function BakedRoom({ fallback }: BakedRoomProps) {
  const gltf = useLoader(GLTFLoader, ROOM_ASSET as string) as GLTF;
  const group = useMemo(() => {
    // useLoader가 준 장면은 앱 전체에서 함께 쓰므로 복제해서 재질을 바꾼다.
    const root = gltf.scene.clone(true);
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const source = o.material as THREE.MeshStandardMaterial;
      const map = source.map;
      if (map) {
        map.colorSpace = THREE.SRGBColorSpace;
        map.anisotropy = 4;
      }
      o.material = new THREE.MeshBasicMaterial({ map, toneMapped: false });
      o.raycast = () => {};
    });
    return root;
  }, [gltf]);

  useEffect(() => {
    fallback.visible = false;
    return () => {
      fallback.visible = true;
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose();
      });
    };
  }, [fallback, group]);

  // react-three-fiber의 three 객체 속성(object)이라 RN 린트 규칙이 모르는 속성으로 본다.
  // eslint-disable-next-line react/no-unknown-property
  return <primitive object={group} />;
}

/** 구운 방을 불러오지 못하면 코드로 지은 방이 그대로 보이게 한다. 오류는 개발 콘솔에 남긴다. */
export class BakedRoomErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("[lobby3d] 구운 방을 불러오지 못했습니다", error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
