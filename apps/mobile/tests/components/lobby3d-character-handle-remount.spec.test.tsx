// [spec] qa 재현 테스트(작업 091 로비 누르기 판정이 지워짐, 버그 수정, 모바일): 라룹이(Character)가 다시 만들어질 때
// 새 라룹이가 먼저 손잡이(handleRef)를 넣고 옛 라룹이의 정리가 뒤에 돌면, 옛 정리가 새 손잡이를 지우는 증상을 본다.
// 기대값은 명세(private 작업 폴더 091-2026-11-14-로비-누르기-판정-지워짐/01-main-spec.md)의 "기대 동작"에서만 가져온다:
// "옛 장면 부분의 정리가 새 부분이 넣은 ... 라룹이 손잡이(handleRef)를 지우지 않는다. 장면 부분이 하나도 없을 때(사라진 뒤)는 지금처럼 비어 있다."
// - H1(고치기 전 실패가 맞다): [옛 라룹이] → [옛, 새] → [새] 순서(새 것 넣기 → 옛 것 지우기)로 바뀐 뒤에도 handleRef는 새 라룹이의 손잡이다.
// - H2(그대로, 통과가 맞다): 한 커밋에 옛 라룹이가 빠지고 새 라룹이가 들어오면(옛 것 지우기 → 새 것 넣기) handleRef는 새 라룹이의 손잡이다.
// - H3(그대로, 통과가 맞다): 라룹이가 하나도 없게 되면(사라진 뒤) handleRef는 비어 있다(null).
//
// 어떻게 보나:
// - 진짜 Character를 그린다. Jest에서 돌지 않는 react-three-fiber의 useLoader만 가짜로 두고, 모델은 뼈·클립이 없는 빈 묶음이다
//   (머리·엉덩이 뼈가 없으면 말풍선 자리는 BUBBLE_HEIGHT로 정하는 길을 탄다. 손잡이를 넣고 지우는 것과는 상관없다).
// - 한 손잡이(handleRef)를 같이 쓰는 라룹이 여럿을 세대(key)별로 그려, 3D 그리기의 장면 부분이 다시 만들어지는 순서를 흉내 낸다.
// - "라룹이 X의 손잡이" = handleRef.current.group이 라룹이 X가 그린 primitive의 object와 같은 것.
import { act, render, screen } from "@testing-library/react-native";
import { Suspense, type MutableRefObject, type ReactElement } from "react";
import * as THREE from "three";
import type { TestInstance } from "test-renderer";
import { Character, CharacterErrorBoundary, type CharacterHandle, type ToonKit } from "@/components/lobby3d/lobby3d-character";

const mockModel: { value: unknown } = { value: null };

jest.mock("three", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const file = require.resolve("three");
  return nodeModule.createRequire(file)(file);
});
jest.mock("@react-three/fiber/native", () => ({
  useLoader: () => mockModel.value
}));
jest.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({
  GLTFLoader: class {}
}));
// three의 SkeletonUtils.clone: 뼈대로 휘는 메시가 없는 모델이라 나무 복제와 같다
jest.mock("three/examples/jsm/utils/SkeletonUtils.js", () => ({
  clone: (source: { clone: (recursive: boolean) => unknown }) => source.clone(true)
}));
jest.mock("@/assets/models/writeloop.glb", () => "writeloop.glb");

function fakeModel() {
  const scene = new THREE.Group();
  scene.name = "fake-writeloop";
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1, 0.5), new THREE.MeshStandardMaterial()));
  return { scene, animations: [] as THREE.AnimationClip[] };
}

function newKit(): ToonKit {
  return { gradient: new THREE.DataTexture(new Uint8Array([150, 210, 255]), 3, 1), toonMaterials: [] };
}

/** 3D 그리기 끝부분과 같은 모양(오류 경계 > Suspense > 라룹이)으로, 세대마다 라룹이를 하나씩 그린다. 손잡이는 모두 같은 것을 쓴다. */
function element(generations: number[], kit: ToonKit, handleRef: MutableRefObject<CharacterHandle | null>): ReactElement {
  return (
    <>
      {generations.map((generation) => (
        <CharacterErrorBoundary key={`character-${generation}`}>
          <Suspense fallback={null}>
            <Character kit={kit} outline={1} handleRef={handleRef} />
          </Suspense>
        </CharacterErrorBoundary>
      ))}
    </>
  );
}

async function flushAsync() {
  for (let index = 0; index < 4; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function drawnGroups(): THREE.Object3D[] {
  return screen.container
    .queryAll((instance: TestInstance) => instance.type === "primitive")
    .map((instance) => (instance.props as { object: THREE.Object3D }).object);
}

beforeEach(() => {
  mockModel.value = fakeModel();
});

describe("[spec] 091 기대 동작: 옛 라룹이의 정리가 새 라룹이가 넣은 손잡이(handleRef)를 지우지 않는다", () => {
  test("H1 [옛] → [옛, 새] → [새](새 것 넣기 → 옛 것 지우기) 뒤에도 handleRef는 새 라룹이의 손잡이다", async () => {
    const kit = newKit();
    const handleRef: MutableRefObject<CharacterHandle | null> = { current: null };
    const view = await render(element([0], kit, handleRef));
    await flushAsync();
    const oldGroups = drawnGroups();
    expect(oldGroups).toHaveLength(1);
    expect(handleRef.current?.group).toBe(oldGroups[0]);

    // 새 라룹이가 먼저 들어와 손잡이를 넣는다(옛 라룹이는 아직 있다)
    await act(async () => {
      await view.rerender(element([0, 1], kit, handleRef));
    });
    await flushAsync();
    const both = drawnGroups();
    expect(both).toHaveLength(2);
    const newGroup = both.find((group) => group !== oldGroups[0]);
    expect(newGroup).toBeDefined();
    expect(handleRef.current?.group).toBe(newGroup);

    // 옛 라룹이가 뒤에 빠지며 정리가 돈다
    await act(async () => {
      await view.rerender(element([1], kit, handleRef));
    });
    await flushAsync();
    expect(drawnGroups()).toEqual([newGroup]);

    expect(handleRef.current).not.toBeNull();
    expect(handleRef.current!.group).toBe(newGroup);
  });
});

describe("[spec] 091 그대로: 옛 것 지우기 → 새 것 넣기 순서와 라룹이가 사라진 뒤", () => {
  test("H2 한 커밋에 [옛] → [새](옛 것 지우기 → 새 것 넣기) 뒤 handleRef는 새 라룹이의 손잡이다", async () => {
    const kit = newKit();
    const handleRef: MutableRefObject<CharacterHandle | null> = { current: null };
    const view = await render(element([0], kit, handleRef));
    await flushAsync();
    const oldGroups = drawnGroups();
    expect(oldGroups).toHaveLength(1);

    await act(async () => {
      await view.rerender(element([1], kit, handleRef));
    });
    await flushAsync();
    const groups = drawnGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0]).not.toBe(oldGroups[0]);

    expect(handleRef.current).not.toBeNull();
    expect(handleRef.current!.group).toBe(groups[0]);
  });

  test("H3 라룹이가 하나도 없게 되면(사라진 뒤) handleRef는 비어 있다", async () => {
    const kit = newKit();
    const handleRef: MutableRefObject<CharacterHandle | null> = { current: null };
    const view = await render(element([0], kit, handleRef));
    await flushAsync();
    expect(handleRef.current).not.toBeNull();

    await act(async () => {
      await view.rerender(element([], kit, handleRef));
    });
    await flushAsync();
    expect(drawnGroups()).toHaveLength(0);

    expect(handleRef.current).toBeNull();
  });
});
