import "@/lib/lobby3d/hermes-polyfills";
import "@/lib/lobby3d/model-file-loader";
import { useLoader } from "@react-three/fiber/native";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// 로비의 3D 모델 셋(방 껍데기, 라이트루프, 가구 묶음)을 앱이 시작되면 미리 읽어 둔다. 읽어 푸는 데 몇 초가 걸린다.
// 세 파일은 계정·배치와 상관없이 같다. 방을 짓고 그리는 것은 로비가 배치를 정한 뒤에 한다.
// 로비의 각 부분(lobby3d-room, lobby3d-character, lobby3d-furniture)이 useLoader로 읽는 파일과 같아야 같은 것을 함께 쓴다.

/* eslint-disable @typescript-eslint/no-require-imports */
const LOBBY_MODEL_ASSETS = [
  require("../../../assets/models/lobby-room.glb"),
  require("../../../assets/models/writeloop.glb"),
  require("../../../assets/models/lobby-furniture.glb")
] as string[];
/* eslint-enable @typescript-eslint/no-require-imports */

/**
 * 세 모델 읽기를 시작한다. useLoader와 같은 곳에 두므로, 로비가 열릴 때 다 읽혔으면 바로 쓰고 읽는 중이면 그 읽기를 기다린다.
 * 읽지 못해도 여기서는 아무 일도 하지 않는다(로비에서 그 부분만 대신 그린다).
 */
export function preloadLobbyModels(): void {
  for (const asset of LOBBY_MODEL_ASSETS) {
    useLoader.preload(GLTFLoader, asset);
  }
}
