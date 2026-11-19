import type * as THREE from "three";
import { MeshBVH, SAH, acceleratedRaycast } from "three-mesh-bvh";

// 누르기 판정 가속. three.js의 기본 광선 판정은 메시의 삼각형을 하나씩 보아서, 삼각형이 많은 메시는 휴대폰(Hermes)에서
// 한 번에 수십 ms가 걸린다. 메시 모양에 가속 구조(BVH)를 한 번 만들어 두고 그 메시의 광선 판정을 가속 판정으로 바꾼다.
// 맞는 물체·자리·거리 순서는 기본 판정과 같다. 모양(삼각형 순서)은 바꾸지 않는다(indirect).
// 모프 타깃이 있는 모양은 가속 구조가 움직인 모양을 따르지 못하므로 그대로 둔다.

type BvhGeometry = THREE.BufferGeometry & { boundsTree?: MeshBVH };

/** mesh의 광선 판정을 가속한다(모양에 가속 구조가 없으면 만든다). 가속하지 못하면 기본 판정을 그대로 둔다. */
export function accelerateRaycast(mesh: THREE.Mesh): void {
  const geometry = mesh.geometry as BvhGeometry | undefined;
  if (!geometry || !geometry.getAttribute("position")) return;
  if (geometry.morphAttributes && Object.keys(geometry.morphAttributes).length > 0) return;
  try {
    geometry.boundsTree ??= new MeshBVH(geometry, { indirect: true, strategy: SAH, targetLeafSize: 3 });
    mesh.raycast = acceleratedRaycast as typeof mesh.raycast;
  } catch (error) {
    console.warn("[lobby3d] 누르기 판정 가속 구조를 만들지 못했습니다", error);
  }
}

/** accelerateRaycast로 만든 가속 구조를 버리고 기본 판정으로 되돌린다. */
export function releaseRaycast(mesh: THREE.Mesh): void {
  const geometry = mesh.geometry as BvhGeometry | undefined;
  if (geometry?.boundsTree) delete geometry.boundsTree;
  if (mesh.raycast === (acceleratedRaycast as unknown)) delete (mesh as { raycast?: unknown }).raycast;
}
