import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Season } from "@/lib/lobby3d/daylight";

// 마을과 방 창밖에 심는 나무 모델(WriteLoop 제작, assets/models/trees). 종류 A(둥근 활엽수)·Pine(소나무)마다
// LOD1(가까이 보이는 마을 안)·LOD2(둘레 숲·창밖) 두 단계가 있다. 파일마다 잎(Tree_Foliage)과 줄기(Tree_Wood) 메시 하나씩이다.
// 잎 그림은 2×2 계절 칸(봄 왼쪽 위, 여름 오른쪽 위, 가을 왼쪽 아래, 겨울 오른쪽 아래)이고 잎 UV는 봄 칸에 있다.
// 줄기 그림은 2×1(평소 왼쪽, 눈 오른쪽)이다. 계절은 그림 위치(offset)만 옮겨 바꾼다(셰이더를 고치지 않는다).

export type TreeSpecies = "A" | "Pine";
export type TreeLod = 1 | 2;
export const TREE_SPECIES: readonly TreeSpecies[] = ["A", "Pine"];
/** 겨울에 잎을 숨기는 종류(맨가지가 된다). Pine은 겨울에도 잎(눈 덮인 칸)을 그린다. */
export function dropsLeavesInWinter(species: TreeSpecies): boolean {
  return species === "A";
}
export const TREE_LODS: readonly TreeLod[] = [1, 2];

let treeAssets: string[] | null = null;

/**
 * 나무 모델 파일 목록(순서: A LOD1, A LOD2, Pine LOD1, Pine LOD2). 늘 같은 배열이라 useLoader의 키가 같다(미리 읽기와 쓰는 곳이 함께 쓴다).
 * 파일은 처음 부를 때 require한다(이 모듈을 들여오기만 하는 곳은 모델 파일을 읽지 않는다).
 */
export function treeModelAssets(): string[] {
  /* eslint-disable @typescript-eslint/no-require-imports */
  treeAssets ??= [
    require("../../../assets/models/trees/WriteLoop_Tree_A_LOD1.glb"),
    require("../../../assets/models/trees/WriteLoop_Tree_A_LOD2.glb"),
    require("../../../assets/models/trees/WriteLoop_Tree_Pine_LOD1.glb"),
    require("../../../assets/models/trees/WriteLoop_Tree_Pine_LOD2.glb")
  ] as string[];
  /* eslint-enable @typescript-eslint/no-require-imports */
  return treeAssets;
}

/** 계절마다 잎 그림 칸 옮김(glTF UV에 더하는 값). */
const FOLIAGE_CELL: Record<Season, readonly [number, number]> = {
  spring: [0, 0],
  summer: [0.5, 0],
  autumn: [0, 0.5],
  winter: [0.5, 0.5]
};

/** 종류·단계 하나의 잎·줄기 모양과 재질. */
export interface TreePart {
  species: TreeSpecies;
  lod: TreeLod;
  foliage: { geometry: THREE.BufferGeometry; material: THREE.MeshLambertMaterial };
  wood: { geometry: THREE.BufferGeometry; material: THREE.MeshLambertMaterial };
}

export interface TreeKit {
  parts: TreePart[];
  part(species: TreeSpecies, lod: TreeLod): TreePart;
  /** 잎·줄기 그림을 그 계절 칸으로 옮긴다(겨울에 A 잎을 숨기는 것은 쓰는 쪽이 한다). */
  setSeason(season: Season): void;
  /** 만든 재질을 버린다(모양과 그림은 불러오기가 들고 있으므로 버리지 않는다). */
  dispose(): void;
}

function meshOf(gltf: GLTF, name: string): THREE.Mesh {
  let found: THREE.Mesh | null = null;
  gltf.scene.traverse((o) => {
    if (!found && o instanceof THREE.Mesh && (o.name === name || o.parent?.name === name)) found = o;
  });
  if (!found) throw new Error(`나무 모델에 ${name}가 없습니다`);
  return found;
}

/**
 * 그림의 내용 이름. 앱의 그림 읽기(texture-file-loader)는 모델 안 그림을 그 바이트의 sha256 이름 파일로 두므로,
 * 다른 모델 파일에서 푼 같은 그림도 같은 이름이다. 이름을 모르면 그 그림 원본으로 가린다.
 */
function imageKey(texture: THREE.Texture): string {
  const uri = (texture.image as { data?: { localUri?: string } } | undefined)?.data?.localUri;
  return uri ?? texture.source.uuid;
}

/**
 * 불러온 나무 모델로 종류·단계마다 모양과 재질을 만든다. gltfs는 종류(A·Pine)마다 lods 순서로 늘어놓은 것이다(기본은 treeModelAssets 순서).
 * 같은 내용의 그림은 그림 하나·재질 하나를 함께 쓴다(GPU에 한 번만 올라가게).
 * 그림 위치(offset)를 계절마다 옮기므로, 같은 그림을 쓰는 마을·창밖이 함께 그 계절이 된다.
 */
export function buildTreeKit(gltfs: GLTF[], lods: readonly TreeLod[] = TREE_LODS): TreeKit {
  // 같은 내용의 그림은 그림 하나·재질 하나를 함께 쓴다(A·Pine은 잎·줄기 그림이 서로 다르다)
  const foliageTextures = new Set<THREE.Texture>();
  const woodTextures = new Set<THREE.Texture>();
  const materials = new Map<string, THREE.MeshLambertMaterial>();
  const owned: THREE.Material[] = [];
  const parts: TreePart[] = [];
  const materialOf = (mesh: THREE.Mesh, foliage: boolean): THREE.MeshLambertMaterial => {
    const map = (mesh.material as THREE.MeshStandardMaterial).map ?? null;
    const key = `${foliage ? "foliage" : "wood"}|${map ? imageKey(map) : "none"}`;
    let material = materials.get(key);
    if (!material) {
      if (map) {
        map.colorSpace = THREE.SRGBColorSpace;
        (foliage ? foliageTextures : woodTextures).add(map);
      }
      material = foliage ? new THREE.MeshLambertMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide }) : new THREE.MeshLambertMaterial({ map });
      materials.set(key, material);
      owned.push(material);
    }
    return material;
  };
  TREE_SPECIES.forEach((species, si) => {
    lods.forEach((lod, li) => {
      const gltf = gltfs[si * lods.length + li];
      const foliageMesh = meshOf(gltf, "Tree_Foliage");
      const woodMesh = meshOf(gltf, "Tree_Wood");
      const foliageMat = materialOf(foliageMesh, true);
      const woodMat = materialOf(woodMesh, false);
      parts.push({
        species,
        lod,
        foliage: { geometry: foliageMesh.geometry, material: foliageMat },
        wood: { geometry: woodMesh.geometry, material: woodMat }
      });
    });
  });
  return {
    parts,
    part(species, lod) {
      return parts.find((p) => p.species === species && p.lod === lod)!;
    },
    setSeason(season) {
      const [u, v] = FOLIAGE_CELL[season];
      for (const t of foliageTextures) t.offset.set(u, v);
      for (const t of woodTextures) t.offset.set(season === "winter" ? 0.5 : 0, 0);
    },
    dispose() {
      for (const m of owned) m.dispose();
    }
  };
}
