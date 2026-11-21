// [spec] qa 테스트(작업 134 ① 플레이어 교체, 기능 변경, 모바일): 앱 시작 때 미리 읽는 로비 모델 목록에서 사람형 플레이어는 들고, 라룹이 파일은 빠진다.
// 기대값은 명세(private 작업 폴더 134-2026-11-22-사람형-플레이어-교체/02-플레이어-교체/01-main-spec.md)의 바뀌는 동작 1에서만 가져온다:
// "미리 읽는 목록(lobby3d-preload.ts)이 player-human.glb를 쓴다. 미리 읽는 목록에서 라룹이 writeloop.glb와 라룹이 고글 wear-goggles.glb는 뺀다."
// 테스트 이름 앞의 [바뀔]은 구현 전에 실패해야 하는 테스트, [그대로]는 구현 전·뒤 모두 통과해야 하는 테스트다(02-qa-tests.md의 분류와 같다).
//
// 어떻게 보나: 미리 읽기 함수(preloadLobbyModels)를 직접 부르고, react-three-fiber useLoader.preload로 넘어온 파일들을 모은다.
// 모델 파일은 Jest가 읽지 못하므로 파일 이름 글자로 바꾼다(다른 미리 읽기 테스트와 같다). 사람형 파일은 아직 없을 수 있어 가상 모듈로 바꾼다.
/* eslint-disable @typescript-eslint/no-require-imports */
import { mockTreeAssets } from "../__fixtures__/tree-files-113";

const mockGltfPreloads: unknown[] = [];

jest.mock("three", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const file = require.resolve("three");
  return nodeModule.createRequire(file)(file);
});
jest.mock("@react-three/fiber/native", () => {
  const useLoader = Object.assign(jest.fn(), {
    preload: (loader: { name?: string } | unknown, input: unknown) => {
      if ((loader as { isGltf?: boolean }).isGltf) mockGltfPreloads.push(input);
    }
  });
  return { useLoader };
});
jest.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({ GLTFLoader: { isGltf: true } }));
jest.mock("expo-file-system", () => require("../__fixtures__/wear-files-090").fakeExpoFileSystem());
jest.mock("@/lib/lobby3d/texture-file-loader", () => ({ removeOldEmbeddedImageFiles: () => Promise.resolve() }));
jest.mock("@/lib/lobby3d/hermes-polyfills", () => ({}));
jest.mock("@/lib/lobby3d/model-file-loader", () => ({}));
jest.mock("@/assets/models/lobby-room.glb", () => "lobby-room.glb");
jest.mock("@/assets/models/writeloop.glb", () => "writeloop.glb");
jest.mock("@/assets/models/wear-goggles.glb", () => "wear-goggles.glb");
jest.mock("../../assets/models/player-human.glb", () => "player-human.glb", { virtual: true });
jest.mock("@/assets/models/furniture/desk.glb", () => "furniture/desk.glb");
jest.mock("@/assets/models/furniture/bookcase.glb", () => "furniture/bookcase.glb");
jest.mock("@/assets/models/furniture/board.glb", () => "furniture/board.glb");
jest.mock("@/assets/models/furniture/window.glb", () => "furniture/window.glb");
jest.mock("@/assets/models/furniture/wardrobe.glb", () => "furniture/wardrobe.glb");
jest.mock("@/assets/models/furniture/rug.glb", () => "furniture/rug.glb");
jest.mock("@/assets/models/furniture/lamp.glb", () => "furniture/lamp.glb");
jest.mock("@/assets/models/lobby-village.glb", () => "lobby-village.glb");
jest.mock("../../assets/models/village-fountain.glb", () => "village-fountain.glb", { virtual: true });
jest.mock("../../assets/models/village-streetlamp.glb", () => "village-streetlamp.glb", { virtual: true });
jest.mock("@/assets/models/village-flowers.glb", () => "village-flowers.glb");
jest.mock("@/assets/textures/village/season-scatter.png", () => "village/season-scatter.png");
jest.mock("@/assets/textures/village/dirt.jpg", () => "village/dirt.jpg");
jest.mock("@/assets/textures/village/dirt-b.jpg", () => "village/dirt-b.jpg");
jest.mock("@/assets/textures/village/ground-grass-short.jpg", () => "village/ground-grass-short.jpg");
jest.mock("@/assets/textures/village/ground-grass-lush.jpg", () => "village/ground-grass-lush.jpg");
jest.mock("@/assets/textures/village/ground-clover.jpg", () => "village/ground-clover.jpg");
jest.mock("@/assets/textures/village/ground-moss.jpg", () => "village/ground-moss.jpg");
jest.mock("@/assets/textures/village/ground-bare.jpg", () => "village/ground-bare.jpg");
mockTreeAssets((_name, rel) => rel);

function preloadedModelFiles(): string[] {
  mockGltfPreloads.length = 0;
  let preload!: () => void;
  jest.isolateModules(() => {
    preload = (require("@/components/lobby3d/lobby3d-preload") as typeof import("@/components/lobby3d/lobby3d-preload")).preloadLobbyModels;
  });
  preload();
  return mockGltfPreloads.flat().map(String);
}

describe("[spec] 134-① 앱 시작 때 미리 읽는 로비 모델 목록", () => {
  it("[바뀔] 사람형 플레이어(player-human.glb)를 미리 읽는다", () => {
    expect(preloadedModelFiles()).toContain("player-human.glb");
  });

  it("[바뀔] 라룹이(writeloop.glb)와 라룹이 고글(wear-goggles.glb)은 미리 읽지 않는다", () => {
    const files = preloadedModelFiles();
    expect(files).not.toContain("writeloop.glb");
    expect(files).not.toContain("wear-goggles.glb");
  });

  it("[그대로] 방 껍데기·마을·분수·가로등·꽃과 처음 방 가구 일곱은 그대로 미리 읽는다", () => {
    const files = preloadedModelFiles();
    for (const name of [
      "lobby-room.glb", "lobby-village.glb", "village-fountain.glb", "village-streetlamp.glb", "village-flowers.glb",
      "furniture/desk.glb", "furniture/bookcase.glb", "furniture/board.glb", "furniture/window.glb", "furniture/wardrobe.glb", "furniture/rug.glb", "furniture/lamp.glb"
    ]) {
      expect({ name, preloaded: files.includes(name) }).toEqual({ name, preloaded: true });
    }
  });
});
