import { Redirect } from "expo-router";
import Lobby3dScreen from "@/components/lobby3d/lobby3d-screen";

// 개발용 3D 로비 시험 화면. 운영 빌드에서는 그리지 않고 홈으로 바꿔 보낸다(뒤로 가기 기록을 남기지 않음).
export default function DevLobby3dRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <Lobby3dScreen />;
}
