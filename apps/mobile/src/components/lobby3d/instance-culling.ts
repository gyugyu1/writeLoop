import * as THREE from "three";

/**
 * 인스턴스 메시에서 카메라 시야에 드는 인스턴스만 그리게 한다.
 * three.js는 인스턴스 메시를 메시 전체 단위로만 시야 판정을 해서, 마을 둘레 숲처럼 몇 그루만 보여도 모든 그루를 그린다.
 * 그래서 인스턴스마다 감싸는 공(원본 도형의 boundingSphere를 그 인스턴스 자리·방향·크기로 옮긴 것)이 시야에 걸리는 것만
 * 앞으로 모아 그 수만큼만 그린다. 그리기 호출 수는 그대로이고 그리는 삼각형만 준다.
 * 모든 인스턴스의 행렬·색은 따로 들고 있다가 고른 것만 메시 자료에 옮겨 쓴다(인스턴스 순서는 원래 순서 그대로).
 */
export class InstanceCulling {
  private readonly entries: CulledMesh[];
  private readonly frustum = new THREE.Frustum();
  private readonly viewProjection = new THREE.Matrix4();
  /** 앞서 고른 카메라의 자리·방향(16)과 투영(16). 같으면 다시 고르지 않는다. */
  private readonly lastCamera = new Float32Array(32);
  private hasLast = false;

  constructor(meshes: THREE.InstancedMesh[]) {
    this.entries = meshes.map((mesh) => new CulledMesh(mesh));
  }

  /** 메시의 i번째 인스턴스 색을 바꾼다(원래 번호). 다음 update에서 그리는 것에 옮겨 쓴다. */
  setColorAt(mesh: THREE.InstancedMesh, index: number, color: THREE.Color): void {
    this.entries.find((e) => e.mesh === mesh)?.setColorAt(index, color);
  }

  /** 프레임마다 부른다. 카메라가 없으면 모두 그린다. 카메라·색이 그대로면 아무것도 다시 쓰지 않는다. */
  update(camera: THREE.Camera | null | undefined): void {
    if (!camera) {
      this.hasLast = false;
      for (const e of this.entries) e.showAll();
      return;
    }
    camera.updateMatrixWorld();
    const moved = !this.hasLast || !sameCamera(this.lastCamera, camera);
    if (moved) {
      this.lastCamera.set(camera.matrixWorld.elements, 0);
      this.lastCamera.set(camera.projectionMatrix.elements, 16);
      this.hasLast = true;
      this.viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      this.frustum.setFromProjectionMatrix(this.viewProjection, camera.coordinateSystem);
    }
    for (const e of this.entries) e.cull(moved ? this.frustum : null);
  }
}

function sameCamera(last: Float32Array, camera: THREE.Camera): boolean {
  const w = camera.matrixWorld.elements;
  const p = camera.projectionMatrix.elements;
  for (let i = 0; i < 16; i += 1) {
    if (last[i] !== Math.fround(w[i]) || last[16 + i] !== Math.fround(p[i])) return false;
  }
  return true;
}

class CulledMesh {
  readonly mesh: THREE.InstancedMesh;
  private readonly total: number;
  private readonly matrices: Float32Array;
  private readonly colors: Float32Array | null;
  /** 인스턴스마다 감싸는 공(가운데 x·y·z, 반지름). */
  private readonly spheres: Float32Array;
  /** 지금 그리는 인스턴스의 원래 번호(앞에서 count개). */
  private readonly shown: Int32Array;
  private readonly next: Int32Array;
  private shownCount: number;
  private colorsDirty = false;
  private readonly point = new THREE.Vector3();

  constructor(mesh: THREE.InstancedMesh) {
    this.mesh = mesh;
    this.total = mesh.count;
    this.matrices = Float32Array.from(mesh.instanceMatrix.array as ArrayLike<number>);
    this.colors = mesh.instanceColor ? Float32Array.from(mesh.instanceColor.array as ArrayLike<number>) : null;
    // 메시 단위 시야 판정이 그리는 인스턴스를 빼지 않게, 모든 인스턴스를 감싸는 공을 지금(모두 있을 때) 정해 둔다.
    // three.js는 이 공이 비어 있을 때만 다시 계산한다
    mesh.computeBoundingSphere();
    const geometry = mesh.geometry;
    if (!geometry.boundingSphere) geometry.computeBoundingSphere();
    const base = geometry.boundingSphere!;
    this.spheres = new Float32Array(this.total * 4);
    const m = new THREE.Matrix4();
    for (let i = 0; i < this.total; i += 1) {
      m.fromArray(this.matrices, i * 16);
      this.point.copy(base.center).applyMatrix4(m);
      this.spheres[i * 4] = this.point.x;
      this.spheres[i * 4 + 1] = this.point.y;
      this.spheres[i * 4 + 2] = this.point.z;
      this.spheres[i * 4 + 3] = base.radius * m.getMaxScaleOnAxis();
    }
    this.shown = new Int32Array(this.total);
    this.next = new Int32Array(this.total);
    for (let i = 0; i < this.total; i += 1) this.shown[i] = i;
    this.shownCount = this.total;
  }

  setColorAt(index: number, color: THREE.Color): void {
    if (!this.colors) return;
    this.colors[index * 3] = color.r;
    this.colors[index * 3 + 1] = color.g;
    this.colors[index * 3 + 2] = color.b;
    this.colorsDirty = true;
  }

  showAll(): void {
    let same = this.shownCount === this.total;
    for (let i = 0; same && i < this.total; i += 1) same = this.shown[i] === i;
    if (same && !this.colorsDirty) return;
    for (let i = 0; i < this.total; i += 1) this.next[i] = i;
    this.write(this.total, !same);
  }

  /** frustum이 null이면 카메라가 그대로라 고른 것은 두고, 바뀐 색만 옮긴다. */
  cull(frustum: THREE.Frustum | null): void {
    if (!frustum) {
      if (this.colorsDirty) this.write(this.shownCount, false, this.shown);
      return;
    }
    const planes = frustum.planes;
    let count = 0;
    for (let i = 0; i < this.total; i += 1) {
      const s = i * 4;
      this.point.set(this.spheres[s], this.spheres[s + 1], this.spheres[s + 2]);
      const radius = this.spheres[s + 3];
      let inside = true;
      for (let p = 0; p < 6; p += 1) {
        if (planes[p].distanceToPoint(this.point) < -radius) {
          inside = false;
          break;
        }
      }
      if (inside) this.next[count++] = i;
    }
    let same = count === this.shownCount;
    for (let k = 0; same && k < count; k += 1) same = this.next[k] === this.shown[k];
    if (same) {
      if (this.colorsDirty) this.write(count, false, this.shown);
      return;
    }
    this.write(count, true);
  }

  /** 고른 것(order, 기본은 next)을 메시 자료 앞에 옮겨 쓰고 그 수만큼 그리게 한다. */
  private write(count: number, matricesChanged: boolean, order: Int32Array = this.next): void {
    const target = this.mesh.instanceMatrix.array as Float32Array;
    if (matricesChanged) {
      // 새 배열을 만들지 않고 옮긴다(프레임마다 쓰레기를 만들지 않게)
      for (let k = 0; k < count; k += 1) {
        const from = order[k] * 16;
        for (let j = 0; j < 16; j += 1) target[k * 16 + j] = this.matrices[from + j];
      }
      this.mesh.instanceMatrix.needsUpdate = true;
    }
    if (this.colors && this.mesh.instanceColor && (matricesChanged || this.colorsDirty)) {
      const colorTarget = this.mesh.instanceColor.array as Float32Array;
      for (let k = 0; k < count; k += 1) {
        const from = order[k] * 3;
        colorTarget[k * 3] = this.colors[from];
        colorTarget[k * 3 + 1] = this.colors[from + 1];
        colorTarget[k * 3 + 2] = this.colors[from + 2];
      }
      this.mesh.instanceColor.needsUpdate = true;
    }
    this.colorsDirty = false;
    if (order !== this.shown) for (let k = 0; k < count; k += 1) this.shown[k] = order[k];
    this.shownCount = count;
    this.mesh.count = count;
  }
}
