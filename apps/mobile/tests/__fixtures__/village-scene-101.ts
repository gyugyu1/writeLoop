// qa 테스트 도우미(작업 101 마을 땅 무늬): 바깥 마을 그리기(VillageNature·VillageModel)를 Jest에서 그려 볼 때 쓰는 가짜 불러오기와 장면 도우미.
// 이 파일은 테스트가 아니다(testMatch는 *.test.ts만 돈다). lobby3d-village-round-paths.spec.test.tsx와 lobby3d-village-ground-marks.spec.test.tsx가 함께 쓴다.
//
// 불러오는 방식에 묶이지 않게(03 결정 "qa에 넘기는 메모"):
// - 앱 자산 폴더(apps/mobile/assets)의 파일 가운데 Jest가 그림으로 바꿔 주지 않는 것(.glb 등)은 Jest가 읽을 수 없으므로,
//   mockUnreadableAssets()가 파일마다 jest.doMock으로 "파일 이름" 글자를 주게 한다. 마을 그리기 모듈은 그 뒤에 require로 읽는다.
//   (그림 .png 등은 jest-expo가 숫자 1로 바꿔 준다.)
// - 가짜 useLoader(fakeUseLoader)는 마을 모델 파일(lobby-village.glb)에는 테스트가 진짜 glb를 풀어 만든 장면을 주고,
//   그 밖의 파일에는 그림 불러오기(THREE.TextureLoader 또는 그 하위, 이름에 Texture가 든 로더)면 빈 THREE.Texture를,
//   그 밖의 로더(GLTFLoader 등)면 가짜 모델(fakeGltf: 어떤 이름으로 찾아도 작은 상자 메시가 나오는 장면)을 준다. 목록을 주면 목록으로 돌려준다.
import { readdirSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import * as THREE from "three";
import { accessorValues, sceneRoots, type Glb } from "./village-glb-098";
import { isFountainUrl } from "./village-fountain-118";
import { fountainGltfOrEmpty } from "./village-fountain-model-118";

export const MOBILE_DIR = join(__dirname, "..", "..");
export const ASSETS_DIR = join(MOBILE_DIR, "assets");

/** jest-expo가 숫자로 바꿔 주는 자산 확장자(jest-expo/jest-preset.js의 목록). */
const JEST_ASSET_EXTS = new Set([
  "bmp", "gif", "jpg", "jpeg", "png", "psd", "svg", "webp", "xml", "m4v", "mov", "mp4", "mpeg", "mpg", "webm", "aac", "aiff", "caf",
  "m4a", "mp3", "wav", "html", "pdf", "yaml", "yml", "otf", "ttf", "zip", "heic", "avif", "db"
]);
const CODE_EXTS = new Set(["js", "jsx", "ts", "tsx", "json", "md", "txt"]);

export function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listFiles(p));
    else out.push(p);
  }
  return out;
}

/** 자산 폴더에서 Jest가 읽지 못하는 파일(.glb 등)을 "파일 이름" 글자로 바꿔 둔다. 마을 그리기 모듈을 require하기 전에 부른다. */
export function mockUnreadableAssets(): void {
  for (const file of listFiles(ASSETS_DIR)) {
    const ext = extname(file).slice(1).toLowerCase();
    if (JEST_ASSET_EXTS.has(ext) || CODE_EXTS.has(ext)) continue;
    const name = basename(file);
    jest.doMock(file, () => name);
  }
}

/** 가짜 불러오기가 마을 모델 파일에 줄 장면. 테스트가 beforeEach에서 넣는다. */
export const loaderState: { village: unknown } = { village: null };

/** 가짜 모델: 장면에 작은 상자 메시 하나가 있고, 어떤 이름으로 찾아도(getObjectByName) 그 이름의 작은 상자 메시가 나온다. */
export function fakeGltf(): { scene: THREE.Group; animations: unknown[] } {
  const box = () => {
    const material = new THREE.MeshStandardMaterial();
    material.map = new THREE.Texture();
    return new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), material);
  };
  const scene = new THREE.Group();
  scene.name = "Scene";
  const first = box();
  first.name = "part";
  scene.add(first);
  const find = scene.getObjectByName.bind(scene);
  scene.getObjectByName = (name: string) => {
    const found = find(name);
    if (found) return found;
    const made = box();
    made.name = name;
    scene.add(made);
    return made;
  };
  return { scene, animations: [] };
}

function isTextureLoader(loader: unknown): boolean {
  if (typeof loader !== "function") return false;
  const ctor = loader as { name?: string; prototype?: unknown };
  return ctor === THREE.TextureLoader || ctor.prototype instanceof THREE.TextureLoader || /texture/i.test(ctor.name ?? "");
}

const gltfCache = new Map<string, unknown>();

/** 가짜 useLoader. */
export function fakeUseLoader(loader: unknown, input: unknown): unknown {
  const one = (url: unknown): unknown => {
    if (url === "lobby-village.glb") return loaderState.village;
    if (isTextureLoader(loader)) return new THREE.Texture();
    const key = String(url);
    // 118: 분수 모델 파일(village-fountain.glb)에는 그 파일을 GLTFLoader처럼 푼 모양을 준다(작은 상자 가짜가 아니다)
    if (!gltfCache.has(key)) gltfCache.set(key, isFountainUrl(url) ? fountainGltfOrEmpty() : fakeGltf());
    return gltfCache.get(key);
  };
  return Array.isArray(input) ? input.map(one) : one(input);
}

export function resetFakeLoader(): void {
  gltfCache.clear();
}

/** 진짜 마을 모델(glb)을 장면으로(098·099 테스트와 같은 방법. 그림 픽셀은 풀지 않고 빈 THREE.Texture로 둔다). */
export function sceneFromGlb(glb: Glb): THREE.Group {
  const textures = new Map<number, THREE.Texture>();
  const materials = (glb.json.materials ?? []).map((m) => {
    const material = new THREE.MeshStandardMaterial();
    material.name = m.name ?? "";
    const factor = m.pbrMetallicRoughness?.baseColorFactor;
    if (factor) material.color.setRGB(factor[0], factor[1], factor[2]);
    const ref = m.pbrMetallicRoughness?.baseColorTexture;
    if (ref) {
      if (!textures.has(ref.index)) textures.set(ref.index, new THREE.Texture());
      material.map = textures.get(ref.index)!;
    }
    return material;
  });
  const build = (index: number): THREE.Object3D => {
    const node = glb.json.nodes[index];
    let object: THREE.Object3D;
    if (node.mesh !== undefined) {
      const mesh = glb.json.meshes[node.mesh];
      const parts = mesh.primitives.map((p) => {
        const geometry = new THREE.BufferGeometry();
        const points = accessorValues(glb, p.attributes.POSITION);
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(points.flat(), 3));
        if (p.attributes.COLOR_0 !== undefined) geometry.setAttribute("color", new THREE.Float32BufferAttribute(new Array(points.length * 4).fill(1), 4));
        if (p.indices !== undefined) geometry.setIndex(accessorValues(glb, p.indices).flat());
        return new THREE.Mesh(geometry, p.material !== undefined ? materials[p.material] : new THREE.MeshStandardMaterial());
      });
      if (parts.length === 1) object = parts[0];
      else {
        object = new THREE.Group();
        parts.forEach((part, i) => {
          part.name = `${mesh.name ?? node.name}_${i}`;
          object.add(part);
        });
      }
    } else object = new THREE.Group();
    object.name = node.name ?? "";
    if (node.matrix) new THREE.Matrix4().fromArray(node.matrix).decompose(object.position, object.quaternion, object.scale);
    if (node.translation) object.position.fromArray(node.translation);
    if (node.rotation) object.quaternion.fromArray(node.rotation);
    if (node.scale) object.scale.fromArray(node.scale);
    (node.children ?? []).forEach((c) => object.add(build(c)));
    return object;
  };
  const scene = new THREE.Group();
  scene.name = "Scene";
  sceneRoots(glb).forEach((r) => scene.add(build(r)));
  return scene;
}

export function allObjects(roots: THREE.Object3D[]): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  for (const r of roots) {
    r.updateMatrixWorld(true);
    r.traverse((o) => out.push(o));
  }
  return out;
}

/** 메시와 그 위 모든 부모가 보이는가(뿌리는 그린 장면의 primitive). 인스턴스 메시는 찍는 수(count)가 0이면 보이지 않는 것으로 본다. */
export function drawnVisible(o: THREE.Object3D, roots: THREE.Object3D[]): boolean {
  if (o instanceof THREE.InstancedMesh && o.count === 0) return false;
  for (let n: THREE.Object3D | null = o; n; n = n.parent) {
    if (!n.visible) return false;
    if (roots.includes(n)) return true;
  }
  return false;
}

/** 마을 모델(glb)에서 온 도형들과, 장면 뿌리 묶음 이름별 도형. */
export function sourceGeometries(source: THREE.Object3D) {
  const all = new Set<THREE.BufferGeometry>();
  const byGroup = new Map<string, Set<THREE.BufferGeometry>>();
  for (const top of source.children) {
    const set = new Set<THREE.BufferGeometry>();
    top.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        set.add(o.geometry);
        all.add(o.geometry);
      }
    });
    byGroup.set(top.name, set);
  }
  return { all, byGroup };
}

/** 인스턴스 메시의 찍은 자리마다 세계 변환(메시의 세계 변환 × 인스턴스 변환). */
export function instanceWorldMatrices(mesh: THREE.InstancedMesh): THREE.Matrix4[] {
  const out: THREE.Matrix4[] = [];
  const m = new THREE.Matrix4();
  for (let i = 0; i < mesh.count; i += 1) {
    mesh.getMatrixAt(i, m);
    out.push(new THREE.Matrix4().multiplyMatrices(mesh.matrixWorld, m));
  }
  return out;
}

/** 인스턴스 하나의 모양을 세계 좌표로 옮겼을 때의 높이 폭(y 최대 - 최소). */
export function instanceHeight(mesh: THREE.InstancedMesh, world: THREE.Matrix4): number {
  const pos = mesh.geometry.getAttribute("position");
  let lo = Infinity;
  let hi = -Infinity;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i).applyMatrix4(world);
    lo = Math.min(lo, v.y);
    hi = Math.max(hi, v.y);
  }
  return hi - lo;
}
