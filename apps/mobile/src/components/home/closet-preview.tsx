import { Canvas, useFrame, useThree } from "@react-three/fiber/native";
import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import * as THREE from "three";
import { Character, CharacterErrorBoundary, MODEL_SCALE, type CharacterHandle, type ToonKit } from "@/components/lobby3d/lobby3d-character";
import { LobbySim } from "@/lib/lobby3d/engine";
import type { WearState } from "@/lib/lobby3d/wear";

// 옷장 화면 위쪽의 라룹이 미리보기: 따로 그리는 작은 3D 장면에 라룹이만 크게, 정면으로 세운다.
// 좌우로 끌면 몸을 돌리고, 손을 떼면 그 방향에 머문다. 동작 줄이기면 숨 쉬는 동작을 멈춘다.
// 옷장 화면이 이 파일을 열 때만 불러온다(require). 3D 모듈을 시험 환경에서 불러오지 않게 하려는 것이다.

/** 배경(방과 어울리는 따뜻한 단색). */
const BACKGROUND = "#F3E2CB";
/** 끈 거리(px)당 도는 각도(라디안). 화면 폭을 한 번 끌면 대략 한 바퀴 반. */
const TURN_PER_PX = 0.012;

export interface ClosetPreviewProps {
  wear: WearState;
  /** 동작 줄이기: 숨 쉬는 동작을 멈춘다. */
  reduceMotion: boolean;
}

/** 라룹이와 같은 카툰 명암 3단. */
function toonKit(): ToonKit {
  const tones = [150, 210, 255];
  const data = new Uint8Array(tones.length * 4);
  tones.forEach((tone, i) => data.set([tone, tone, tone, 255], i * 4));
  const gradient = new THREE.DataTexture(data, tones.length, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return { gradient, toonMaterials: [] };
}

function PreviewScene({ wear, reduceMotion, heading }: ClosetPreviewProps & { heading: MutableRefObject<number> }) {
  const kit = useMemo(toonKit, []);
  const sim = useMemo(() => new LobbySim({ x: 0, z: 0, reduceMotion }), [reduceMotion]);
  const handle = useRef<CharacterHandle | null>(null);
  // 조명(방과 같은 세기)과 발밑 그림자
  const stage = useMemo(() => {
    const group = new THREE.Group();
    group.add(new THREE.AmbientLight(0xffffff, 1.35));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(3, 6, 5);
    group.add(sun);
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.62, 32),
      new THREE.MeshBasicMaterial({ color: 0x5a3a22, transparent: true, opacity: 0.18, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.005;
    shadow.scale.set(1, 0.7, 1);
    group.add(shadow);
    return group;
  }, []);
  const scene = useThree((state) => state.scene);
  useEffect(() => {
    scene.background = new THREE.Color(BACKGROUND);
  }, [scene]);
  useFrame(({ clock, camera }, dt) => {
    camera.lookAt(0, MODEL_SCALE * 0.48, 0);
    sim.heading = heading.current;
    handle.current?.update(sim, reduceMotion ? 0 : Math.min(dt, 0.1), clock.elapsedTime);
  });
  return (
    <>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <primitive object={stage} />
      <CharacterErrorBoundary>
        <Suspense fallback={null}>
          <Character kit={kit} outline={1} handleRef={handle} wear={wear} />
        </Suspense>
      </CharacterErrorBoundary>
    </>
  );
}

export default function ClosetPreview({ wear, reduceMotion }: ClosetPreviewProps) {
  const heading = useRef(0);
  const start = useRef(0);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          start.current = heading.current;
        },
        onPanResponderMove: (_event, gesture) => {
          heading.current = start.current + gesture.dx * TURN_PER_PX;
        }
      }),
    []
  );
  return (
    <View style={styles.fill} {...pan.panHandlers} accessibilityLabel="라룹이 미리보기. 좌우로 끌면 돌아요">
      <Canvas style={styles.fill} camera={{ position: [0, MODEL_SCALE * 0.62, 7.2], fov: 30, near: 0.5, far: 50 }} gl={{ antialias: true }}>
        <PreviewScene wear={wear} reduceMotion={reduceMotion} heading={heading} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: BACKGROUND }
});
