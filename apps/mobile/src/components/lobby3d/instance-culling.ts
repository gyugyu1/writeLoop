import * as THREE from "three";

/**
 * 인스턴스 메시에서 카메라 시야에 드는 인스턴스만 그리게 한다.
 * three.js는 인스턴스 메시를 메시 전체 단위로만 시야 판정을 해서, 마을 둘레 숲처럼 몇 그루만 보여도 모든 그루를 그린다.
 * 그래서 인스턴스마다 감싸는 공(원본 도형의 boundingSphere를 그 인스턴스 자리·방향·크기로 옮긴 것)이 시야에 걸리는 것만
 * 앞으로 모아 그 수만큼만 그린다. 그리기 호출 수는 그대로이고 그리는 삼각형만 준다.
 * 모든 인스턴스의 행렬·색은 따로 들고 있다가 고른 것만 메시 자료에 옮겨 쓴다(인스턴스 순서는 원래 순서 그대로).
 * 판정은 바닥 구역(CELL칸 네모)부터 한다: 구역이 시야 밖이면 그 안은 모두 빼고, 시야 안에 다 들면 모두 넣고, 걸치면 인스턴스마다 본다.
 * 고른 인스턴스가 없는 메시는 숨겨 three.js가 그리기 준비(셰이더·값 확인)도 하지 않게 한다.
 */
export class InstanceCulling {
  private readonly entries: CulledMesh[];
  private readonly frustum = new THREE.Frustum();
  private readonly viewProjection = new THREE.Matrix4();
  /** 앞서 고른 카메라의 자리·방향(16)과 투영(16). 같으면 다시 고르지 않는다. */
  private readonly lastCamera = new Float32Array(32);
  private hasLast = false;
  /** 묶음 전체를 숨기는지(겨울의 꽃·풀 장식). 숨기는 동안은 고른 수와 관계없이 보이지 않는다. */
  private hidden = false;

  constructor(meshes: THREE.InstancedMesh[]) {
    this.entries = meshes.map((mesh) => new CulledMesh(mesh));
  }

  /** 메시의 i번째 인스턴스 색을 바꾼다(원래 번호). 다음 update에서 그리는 것에 옮겨 쓴다. */
  setColorAt(mesh: THREE.InstancedMesh, index: number, color: THREE.Color): void {
    this.entries.find((e) => e.mesh === mesh)?.setColorAt(index, color);
  }

  /**
   * 셰이더를 미리 컴파일할 때 쓸 대역(메시마다 같은 도형·재질의 인스턴스 하나짜리, 색이 있으면 색도). 숨긴 메시는 three.js가
   * 셰이더도 준비하지 않아, 그 재질이 처음 시야에 들 때 컴파일로 끊길 수 있다. 다 쓰면 dispose하지 않고 버린다(도형·재질은 원본 것).
   */
  warmUpStandIns(): THREE.Object3D[] {
    return this.entries.map(({ mesh }) => {
      const standIn = new THREE.InstancedMesh(mesh.geometry, mesh.material, 1);
      standIn.setMatrixAt(0, new THREE.Matrix4());
      if (mesh.instanceColor) standIn.setColorAt(0, new THREE.Color(0xffffff));
      return standIn;
    });
  }

  /** 묶음 전체를 숨기거나 다시 보이게 한다(보이게 하면 고른 수가 있는 메시만 보인다). 바로 반영한다. */
  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    for (const e of this.entries) e.showIf(!hidden);
  }

  /** 프레임마다 부른다. 카메라가 없으면 모두 그린다. 카메라·색이 그대로면 아무것도 다시 쓰지 않는다. */
  update(camera: THREE.Camera | null | undefined): void {
    if (!camera) {
      this.hasLast = false;
      for (const e of this.entries) {
        e.showAll();
        e.showIf(!this.hidden);
      }
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
    for (const e of this.entries) {
      e.cull(moved ? this.frustum : null);
      e.showIf(!this.hidden);
    }
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

/** 판정을 묶는 바닥 구역 한 변(칸). 마을 카메라는 폭 5~13칸, 깊이 35칸 안팎을 보여 준다. */
const CELL = 8;

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
  /** 구역마다 감싸는 공(가운데 x·y·z, 반지름)과 그 구역 인스턴스 번호 목록(cellStart[c]부터 cellStart[c+1] 앞까지). */
  private readonly cellSpheres: Float32Array;
  private readonly cellStart: Int32Array;
  private readonly cellMembers: Int32Array;
  /** 이번 판정에서 고른 인스턴스 표시(원래 번호). */
  private readonly picked: Uint8Array;
  /** 판정할 때 쓰는 시야 면 여섯(법선 x·y·z, 상수). */
  private readonly planeValues = new Float64Array(24);

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
    // 인스턴스를 공 가운데의 바닥 구역으로 묶고, 구역마다 그 안의 공을 모두 감싸는 공을 만든다
    const cellOf = new Map<string, number[]>();
    for (let i = 0; i < this.total; i += 1) {
      const key = `${Math.floor(this.spheres[i * 4] / CELL)},${Math.floor(this.spheres[i * 4 + 2] / CELL)}`;
      const list = cellOf.get(key);
      if (list) list.push(i);
      else cellOf.set(key, [i]);
    }
    const cells = [...cellOf.values()];
    this.cellSpheres = new Float32Array(cells.length * 4);
    this.cellStart = new Int32Array(cells.length + 1);
    this.cellMembers = new Int32Array(this.total);
    let at = 0;
    cells.forEach((members, c) => {
      const box = new THREE.Box3();
      for (const i of members) {
        const r = this.spheres[i * 4 + 3];
        box.expandByPoint(this.point.set(this.spheres[i * 4] - r, this.spheres[i * 4 + 1] - r, this.spheres[i * 4 + 2] - r));
        box.expandByPoint(this.point.set(this.spheres[i * 4] + r, this.spheres[i * 4 + 1] + r, this.spheres[i * 4 + 2] + r));
      }
      const center = box.getCenter(new THREE.Vector3());
      let radius = 0;
      for (const i of members) {
        const d = this.point.set(this.spheres[i * 4], this.spheres[i * 4 + 1], this.spheres[i * 4 + 2]).distanceTo(center) + this.spheres[i * 4 + 3];
        radius = Math.max(radius, d);
      }
      this.cellSpheres.set([center.x, center.y, center.z, radius], c * 4);
      this.cellStart[c] = at;
      for (const i of members) this.cellMembers[at++] = i;
    });
    this.cellStart[cells.length] = at;
    this.picked = new Uint8Array(this.total);
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
    // 면 여섯의 법선·상수를 숫자로 꺼내 직접 계산한다(Hermes에서는 메서드 호출이 비싸다)
    const planes = frustum.planes;
    const pl = this.planeValues;
    for (let p = 0; p < 6; p += 1) {
      const plane = planes[p];
      pl[p * 4] = plane.normal.x;
      pl[p * 4 + 1] = plane.normal.y;
      pl[p * 4 + 2] = plane.normal.z;
      pl[p * 4 + 3] = plane.constant;
    }
    const picked = this.picked;
    picked.fill(0);
    const spheres = this.spheres;
    const cellSpheres = this.cellSpheres;
    const cellCount = this.cellStart.length - 1;
    for (let c = 0; c < cellCount; c += 1) {
      const cs = c * 4;
      const cx = cellSpheres[cs];
      const cy = cellSpheres[cs + 1];
      const cz = cellSpheres[cs + 2];
      const cellRadius = cellSpheres[cs + 3];
      // 구역 공이 어느 면 밖에 다 있으면 빼고, 모든 면 안쪽에 다 있으면 모두 넣고, 걸치면 인스턴스마다 본다
      let outside = false;
      let whole = true;
      for (let p = 0; p < 24; p += 4) {
        const d = pl[p] * cx + pl[p + 1] * cy + pl[p + 2] * cz + pl[p + 3];
        if (d < -cellRadius) {
          outside = true;
          break;
        }
        if (d < cellRadius) whole = false;
      }
      if (outside) continue;
      const end = this.cellStart[c + 1];
      for (let k = this.cellStart[c]; k < end; k += 1) {
        const i = this.cellMembers[k];
        if (whole) {
          picked[i] = 1;
          continue;
        }
        const s = i * 4;
        const x = spheres[s];
        const y = spheres[s + 1];
        const z = spheres[s + 2];
        const radius = spheres[s + 3];
        let inside = true;
        for (let p = 0; p < 24; p += 4) {
          if (pl[p] * x + pl[p + 1] * y + pl[p + 2] * z + pl[p + 3] < -radius) {
            inside = false;
            break;
          }
        }
        if (inside) picked[i] = 1;
      }
    }
    // 고른 것을 원래 번호 순서로 모은다
    let count = 0;
    for (let i = 0; i < this.total; i += 1) if (picked[i]) this.next[count++] = i;
    let same = count === this.shownCount;
    for (let k = 0; same && k < count; k += 1) same = this.next[k] === this.shown[k];
    if (same) {
      if (this.colorsDirty) this.write(count, false, this.shown);
      return;
    }
    this.write(count, true);
  }

  /** 고른 인스턴스가 있고 묶음을 숨기지 않을 때만 보이게 한다. */
  showIf(allowed: boolean): void {
    const want = allowed && this.shownCount > 0;
    if (this.mesh.visible !== want) this.mesh.visible = want;
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
