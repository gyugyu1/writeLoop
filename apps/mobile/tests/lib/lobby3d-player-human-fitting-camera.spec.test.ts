// [spec] qa 테스트(작업 134 ① 플레이어 교체, 기능 변경, 모바일): 옷집 피팅 카메라가 새 체형(키 1.513)의 전신을 피팅 창 위 화면에 맞춘다.
// 기대값은 명세(private 작업 폴더 134-2026-11-22-사람형-플레이어-교체/02-플레이어-교체/01-main-spec.md)의 바뀌는 동작 2(월드 키 약 1.513)와 3
// ("전신(발끝~머리 꼭대기)이 피팅 창 위쪽 화면에 다 드는 계산의 몸 높이·어깨 폭·카메라 높이를 새 체형으로")에서만 가져온다.
// 테스트 이름 앞의 [바뀔]은 구현 전에 실패해야 하는 테스트, [그대로]는 구현 전·뒤 모두 통과해야 하는 테스트다(02-qa-tests.md의 분류와 같다).
//
// 어떻게 보나: 구현 값(FITTING_VIEW)은 보지 않고, 카메라 자리(fittingCameraPose)가 돌려준 위치·보는 점·시야각으로 몸의 점을 화면에 비춰 본다.
// - 몸: 라룹이 앞(+z) 서 있는 자리(focus)에서 발끝 높이 0, 머리 꼭대기 높이 1.513, 머리 폭의 반(귀 포함 키의 62%의 반 = 0.31 × 1.513).
// - 화면 높이 NDC: 위 +1, 아래 -1. 피팅 창이 아래 cover 비율을 덮으므로 보이는 구간은 [-1 + 2 × cover, 1].
// - "머리 꼭대기가 화면 위쪽에 꽉 차게 든다": NDC 0.7 이상(너무 작게 그리지 않는다는 뜻. 명세에 숫자는 없어 이 값은 qa의 가정이다).
// 가정(명세에 숫자가 없는 것): 위 0.7, 어깨 폭 대신 머리 폭의 반을 몸 가로 폭으로 쓴다.
import * as THREE from "three";
import { fittingCameraPose } from "@/lib/lobby3d/engine";

jest.mock("three", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const file = require.resolve("three");
  return nodeModule.createRequire(file)(file);
});

const BODY_HEIGHT = 1.513;
const HALF_WIDTH = 0.31 * BODY_HEIGHT;
const COVER = 0.5;
const FOCUS = { x: 3, z: 4 };
const ASPECTS = [0.42, 0.46, 0.5, 0.56, 0.75];

function project(aspect: number, point: [number, number, number]) {
  const pose = fittingCameraPose(FOCUS, aspect, COVER);
  const camera = new THREE.PerspectiveCamera(pose.fovDeg, aspect, pose.near, 100);
  camera.position.set(pose.position.x, pose.position.y, pose.position.z);
  camera.lookAt(pose.lookAt.x, pose.lookAt.y, pose.lookAt.z);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  const projected = new THREE.Vector3(...point).project(camera);
  return { x: projected.x, y: projected.y, pose };
}

describe("[spec] 134-① 옷집 피팅 카메라: 새 체형의 전신이 피팅 창 위 화면에 든다", () => {
  it.each(ASPECTS)("[그대로] 화면 비율 %s: 발끝과 머리 꼭대기가 보이는 구간 안에 들고, 가로로도 넘치지 않는다", (aspect) => {
    const feet = project(aspect, [FOCUS.x, 0, FOCUS.z]);
    const top = project(aspect, [FOCUS.x, BODY_HEIGHT, FOCUS.z]);
    const side = project(aspect, [FOCUS.x + HALF_WIDTH, BODY_HEIGHT * 0.9, FOCUS.z]);
    expect(feet.y).toBeGreaterThanOrEqual(-1 + 2 * COVER);
    expect(top.y).toBeLessThanOrEqual(1);
    expect(Math.abs(side.x)).toBeLessThanOrEqual(1);
  });

  it.each(ASPECTS)("[바뀔] 화면 비율 %s: 머리 꼭대기가 화면 위쪽에 꽉 차게 든다(NDC 0.7 이상. 옛 몸 높이 2.55로 맞춘 카메라는 작게 그린다)", (aspect) => {
    expect(project(aspect, [FOCUS.x, BODY_HEIGHT, FOCUS.z]).y).toBeGreaterThanOrEqual(0.7);
  });
});
