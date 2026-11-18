import * as THREE from "three";

/**
 * 움직이지 않는 묶음의 위치 행렬을 지금 값으로 한 번 계산해 두고, 그 뒤로는 프레임마다 다시 계산하지 않게 한다.
 * three.js는 그릴 때마다 장면의 모든 물체를 훑으며 matrixAutoUpdate가 켜진 물체의 지역 행렬을 다시 만들고,
 * 그러면 그 물체와 아래 물체 모두의 세계 행렬을 다시 곱한다(Hermes에서 물체 268개에 약 2ms).
 * root와 그 아래에서 moving에 든 물체(와 그 아래)를 뺀 모두의 matrixAutoUpdate를 끈다. moving에 든 물체는 지금처럼
 * 스스로 갱신하고, 그 위 묶음의 세계 행렬은 얼린 값 그대로 쓴다(위 묶음은 움직이지 않아야 한다).
 * 얼린 뒤에 묶음에 더한 물체는 기본값(자동 갱신)대로 둔다. 되돌리는 함수를 돌려준다(되돌린 다음 프레임에 다시 계산한다).
 */
export function freezeMatrices(root: THREE.Object3D, moving: readonly THREE.Object3D[] = []): () => void {
  root.updateWorldMatrix(true, true);
  const keep = new Set(moving);
  const frozen: THREE.Object3D[] = [];
  const visit = (o: THREE.Object3D) => {
    if (keep.has(o)) return;
    if (o.matrixAutoUpdate) {
      o.matrixAutoUpdate = false;
      frozen.push(o);
    }
    for (const child of o.children) visit(child);
  };
  visit(root);
  return () => {
    for (const o of frozen) o.matrixAutoUpdate = true;
    root.matrixWorldNeedsUpdate = true;
  };
}
