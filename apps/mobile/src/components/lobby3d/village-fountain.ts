import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VILLAGE_FOUNTAIN } from "@/lib/lobby3d/village";

// 마을 광장 분수(WriteLoop 제작 모델, assets/models/village-fountain.glb). 석재 메시와 물 메시 둘이고,
// 물은 모프 타깃 셋을 움직이는 약 2초 고리 클립(Fountain_Flow)으로 윗그릇 가장자리에서 아래 수조로 졸졸 흐른다.
// 자리와 크기는 배치 파일의 fountain(가운데 x·z, 걷기를 막는 반지름)을 따른다. 재질과 모프 타깃은 모델 원본 그대로 쓴다.

let fountainAsset: string | null = null;

/** 분수 모델 파일(늘 같은 값이라 useLoader의 키가 같다. 미리 읽기와 마을이 함께 쓴다). 처음 부를 때 require한다. */
export function villageFountainAsset(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  fountainAsset ??= require("../../../assets/models/village-fountain.glb") as string;
  return fountainAsset;
}

/** 물 흐름 고리 클립 이름. */
export const FOUNTAIN_FLOW_CLIP = "Fountain_Flow";

export interface VillageFountain {
  /** 장면에 넣을 분수(배치 자리·크기를 준 묶음). */
  root: THREE.Group;
  /** 복제한 모델(물 흐름 믹서의 뿌리). */
  model: THREE.Object3D;
  /** 누르기 판정 대상(석재·물 메시). */
  meshes: THREE.Mesh[];
  /** 물 흐름 클립(첫 키가 0초가 되게 당긴 복제본). 없으면 null. */
  flow: THREE.AnimationClip | null;
}

/**
 * 불러온 분수 모델로 마을 분수를 만든다. useLoader가 준 장면은 함께 쓰므로 복제한다(모양·재질은 함께 쓰고, 모프 영향값은 복제마다 따로).
 * 크기: 모델의 바깥 반폭(석재 테두리)을 배치 파일의 반지름에 맞추는 균일 배율. 높이: 모델 밑면을 땅(y = 0)에 놓는다.
 */
export function buildVillageFountain(gltf: GLTF): VillageFountain {
  const model = gltf.scene.clone(true);
  model.updateMatrixWorld(true);
  // 모델의 원래 꼭짓점으로 잰 상자(three의 경계 상자는 모프 타깃 자리까지 넓혀 잡으므로 쓰지 않는다)
  const box = new THREE.Box3();
  const part = new THREE.Box3();
  model.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    part.setFromBufferAttribute(o.geometry.getAttribute("position") as THREE.BufferAttribute).applyMatrix4(o.matrixWorld);
    box.union(part);
  });
  const half = Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z);
  const scale = VILLAGE_FOUNTAIN.radius / half;
  const root = new THREE.Group();
  root.name = "village-fountain";
  root.position.set(VILLAGE_FOUNTAIN.x, -box.min.y * scale, VILLAGE_FOUNTAIN.z);
  root.scale.setScalar(scale);
  root.add(model);
  const meshes: THREE.Mesh[] = [];
  model.traverse((o) => {
    if (o instanceof THREE.Mesh) meshes.push(o);
  });
  const source = gltf.animations.find((clip) => clip.name === FOUNTAIN_FLOW_CLIP) ?? null;
  let flow: THREE.AnimationClip | null = null;
  if (source) {
    // 내보낸 클립은 첫 키가 1/24초에 있다. 그대로 되풀이하면 0초~첫 키 사이를 첫 값으로 붙잡아 경계에서 한 프레임 멈칫하므로,
    // 키를 첫 키만큼 앞으로 당겨 길이를 첫 키~끝 키로 맞춘다(끝 키와 첫 키 값이 같아 이음매 없이 돈다)
    flow = source.clone();
    const start = Math.min(...flow.tracks.map((track) => track.times[0] ?? 0));
    for (const track of flow.tracks) track.shift(-start);
    flow.resetDuration();
  }
  return { root, model, meshes, flow };
}

/** 물 흐름을 되풀이 재생하는 믹서를 연결한다. 돌려준 update(delta)를 매 프레임 부르고, stop()으로 믹서를 정리한다. */
export function startFountainFlow(fountain: VillageFountain): { update(delta: number): void; stop(): void } {
  if (!fountain.flow) return { update() {}, stop() {} };
  const mixer = new THREE.AnimationMixer(fountain.model);
  const action = mixer.clipAction(fountain.flow);
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.play();
  return {
    update(delta) {
      mixer.update(delta);
    },
    stop() {
      mixer.stopAllAction();
      mixer.uncacheRoot(fountain.model);
    }
  };
}
