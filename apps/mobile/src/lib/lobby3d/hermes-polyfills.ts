// 앱의 JS 엔진(Hermes)에는 FinalizationRegistry가 없는데, three.js의 WebGLRenderer가 텍스처 정리에 쓴다.
// 3D 로비는 화면을 닫을 때 geometry·material·texture를 직접 dispose하므로, 없을 때만 아무것도 하지 않는 대체 구현을 둔다.
// three를 불러오기 전에 이 파일을 먼저 import한다.
type FinalizationRegistryLike = {
  register: (target: object, heldValue: unknown, unregisterToken?: object) => void;
  unregister: (unregisterToken: object) => boolean;
};

const scope = globalThis as unknown as { FinalizationRegistry?: unknown };

if (typeof scope.FinalizationRegistry === "undefined") {
  scope.FinalizationRegistry = class NoopFinalizationRegistry implements FinalizationRegistryLike {
    register(): void {}
    unregister(): boolean {
      return false;
    }
  };
}

export {};
