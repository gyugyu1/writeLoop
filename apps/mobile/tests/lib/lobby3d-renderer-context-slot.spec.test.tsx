// [spec] qa 테스트(작업 104 마을 진입 오류, 버그 수정, 모바일): 3D 렌더러가 그리다가 쉬는 동안 앱 화면 렌더러가 읽는 context 값.
// 기대값은 명세(private 작업 폴더 104-2026-11-18-마을-진입-오류/01-main-spec.md)에서만 가져온다. 테스트 이름 앞의 [재현]은 고치기 전에 실패해야 하는 재현 테스트다.
//
// 명세 "원인": React Native의 앱 화면 렌더러(Fabric)와 3D 렌더러(@react-three/fiber 9.8.2에 든 reconciler)가 둘 다 보조 렌더러라 context 값을
//   같은 자리 context._currentValue2에 쓰고 읽는다. 3D 루트는 concurrent 루트라 Suspense가 풀린 뒤 다시 그릴 때 그리던 중간에 쉬고, 쉬는 동안
//   3D 트리 쪽 context 값이 _currentValue2에 남는다. 그 사이 앱 화면 렌더러가 그리면 캔버스보다 위의 컴포넌트(맨 위 NavigationContainer)가 3D 쪽 값을 읽는다.
// 명세 "기대 동작": 3D 렌더러가 그리는 중에 쉬어도, 앱 화면 렌더러가 읽는 context 값은 앱 화면 트리의 값이어야 한다(3D 트리 값이 섞이지 않는다).
// 명세 "고치는 방법 1": @react-three/fiber의 reconciler 설정을 isPrimaryRenderer: true로 바꾸는 패치를 둔다. patch-package를 모바일 개발 의존성으로 넣고
//   설치 때(postinstall) 자동 적용한다. 스토어 빌드(EAS)의 설치에도 적용된다.
//
// 어떻게 보나:
// - R1: 앱이 쓰는 @react-three/fiber/native가 내보내는 진짜 reconciler로 3D 루트를 앱과 같은 concurrent 루트(ConcurrentRoot = 1, r3f createRoot와 같은 인자)로 만든다.
//   3D 트리는 내비게이션 context를 흉내 낸 context의 Provider(값 "3D 트리 값") 아래에 Suspense를 두고, 그 안의 부분이 처음에는 읽는 중(promise를 던짐)이다.
//   읽기가 끝나면(promise를 풀면) React가 Suspense를 다시 그린다. 다시 그릴 때 그 부분이 시간을 써서(20ms) 그리던 중간에 쉬게 하고, 쉬는 바로 그때(그 부분이
//   그리기 중에 걸어 둔 microtask) 앱 화면 렌더러가 읽는 자리를 본다. 앱 화면 트리에는 이 context의 Provider가 없으므로 앱 화면 트리의 값은 기본값("앱 기본값")이다.
//   앱 화면 렌더러(Fabric)가 읽는 자리는 명세대로 context._currentValue2다. Jest의 화면 테스트 렌더러(test-renderer)는 주 렌더러(_currentValue)라
//   Fabric과 같지 않아, 앱 화면 렌더러가 읽는 자리를 직접 본다.
//   정말 쉬는 중에 봤는지는 Suspense 안 다음 부분(뒤 부분)이 아직 그려지지 않았는지로 함께 확인한다(쉬지 않았으면 재현이 아니다).
// - R2: 앱 번들이 쓰는 r3f 파일(native 입구가 개발 빌드는 dist/events-*.cjs.dev.js, 출시 빌드(EAS)는 dist/events-*.cjs.prod.js를 부른다)의 reconciler 설정.
// - R3: 설치 때 패치가 적용되는 준비(모바일 package.json의 devDependencies·postinstall, 패치 파일, 잠금 파일).
/* eslint-disable @typescript-eslint/no-require-imports */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createContext, createElement, Suspense, type ReactNode } from "react";

jest.mock("three", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const file = require.resolve("three");
  return nodeModule.createRequire(file)(file);
});

type Reconciler = {
  createContainer: (...args: unknown[]) => unknown;
  updateContainer: (element: ReactNode, container: unknown, parent: unknown, callback: (() => void) | null) => unknown;
};

const MOBILE = join(__dirname, "..", "..");
const R3F = join(MOBILE, "node_modules", "@react-three", "fiber");

/** setImmediate 한 번(스케줄러가 이어 그리는 차례를 한 번 넘긴다). */
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

async function until(check: () => boolean, label: string) {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > 3000) throw new Error(`기다리다 시간이 지났다: ${label}`);
    await tick();
  }
}

function busy(ms: number) {
  const start = performance.now();
  while (performance.now() - start < ms) {
    // 그리는 데 시간이 걸리는 부분(예: 땅 그림을 받아 장면을 짓는 일)
  }
}

describe("[spec] 3D 렌더러가 그리다가 쉬어도 앱 화면 렌더러가 읽는 context 값은 앱 화면 트리의 값이다(104 기대 동작 1, 고치는 방법 1)", () => {
  // 앱처럼 act 밖에서 그린다(act 안에서는 React가 쉬지 않고 한 번에 그린다). act 밖이라는 경고만 끈다.
  const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  let actEnvironment: boolean | undefined;
  beforeAll(() => {
    actEnvironment = g.IS_REACT_ACT_ENVIRONMENT;
    g.IS_REACT_ACT_ENVIRONMENT = false;
  });
  afterAll(() => {
    g.IS_REACT_ACT_ENVIRONMENT = actEnvironment;
  });

  test("[재현] R1: Suspense가 풀린 뒤 3D 트리를 다시 그리다가 쉬는 동안, 앱 화면 렌더러가 읽는 자리(_currentValue2)에는 3D 트리 값이 아니라 앱 화면 트리의 값(기본값)이 있다", async () => {
    const { reconciler } = require("@react-three/fiber/native") as { reconciler: Reconciler };
    const NavigationLike = createContext("앱 기본값");
    const readByAppRenderer = () => (NavigationLike as unknown as { _currentValue2: string })._currentValue2;

    let ready = false;
    let release: () => void = () => {};
    const loading = new Promise<void>((resolve) => {
      release = resolve;
    });
    let tailRendered = false;
    const seen: { appValue: string; tailRenderedBefore: boolean }[] = [];

    function SlowPart() {
      if (!ready) throw loading;
      busy(20);
      queueMicrotask(() => {
        seen.push({ appValue: readByAppRenderer(), tailRenderedBefore: tailRendered });
      });
      return null;
    }
    function TailPart() {
      tailRendered = true;
      return null;
    }

    const container = { getState: () => ({ scene: { __r3f: null } }) };
    const logError = jest.fn();
    const root = reconciler.createContainer(container, 1, null, false, null, "", logError, logError, logError, null);
    const tree = createElement(
      NavigationLike.Provider,
      { value: "3D 트리 값" },
      createElement(Suspense, { fallback: null }, createElement(SlowPart), createElement(TailPart))
    );
    // 앞 조건: 3D 트리를 그리기 전에는 기본값이다
    expect(readByAppRenderer()).toBe("앱 기본값");

    let committed = 0;
    reconciler.updateContainer(tree, root, null, () => {
      committed += 1;
    });
    await until(() => committed >= 1, "처음 그리기(Suspense 대체 화면)");
    expect(seen).toEqual([]);

    // 읽기가 끝나 Suspense가 풀린다 → 3D 트리를 다시 그린다
    ready = true;
    release();
    await until(() => tailRendered, "Suspense가 풀린 뒤 다시 그리기");

    // 다시 그리는 중간에 쉬었고(뒤 부분을 그리기 전에 봤다), 그때 앱 화면 렌더러가 읽는 값은 앱 화면 트리의 값이다
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[0].tailRenderedBefore).toBe(false);
    expect(seen[0].appValue).toBe("앱 기본값");

    reconciler.updateContainer(null, root, null, null);
    await tick();
    expect(logError).not.toHaveBeenCalled();
  });
});

describe("[spec] 앱 번들이 쓰는 3D 렌더러 설정(104 고치는 방법 1)", () => {
  const eventFiles = readdirSync(join(R3F, "dist")).filter((name) => /^events-.*\.cjs\.(dev|prod)\.js$/.test(name));

  /** reconciler를 만드는 설정 묶음(createReconciler({ ... })의 첫 줄들)에서 isPrimaryRenderer 값을 읽는다. */
  function primaryInConfig(file: string): string | null {
    const text = readFileSync(join(R3F, "dist", file), "utf8");
    const at = text.indexOf("createReconciler({");
    if (at < 0) return null;
    const found = /isPrimaryRenderer:\s*(true|false)/.exec(text.slice(at, at + 400));
    return found ? found[1] : null;
  }

  test("R2 앞 조건: 개발 빌드와 출시 빌드가 쓰는 r3f 파일이 하나씩 있다", () => {
    expect(eventFiles.filter((name) => name.endsWith(".cjs.dev.js"))).toHaveLength(1);
    expect(eventFiles.filter((name) => name.endsWith(".cjs.prod.js"))).toHaveLength(1);
  });

  test.each(["cjs.dev.js", "cjs.prod.js"])("[재현] R2: 설치된 r3f의 %s reconciler 설정은 isPrimaryRenderer: true다", (suffix) => {
    const file = eventFiles.find((name) => name.endsWith(suffix));
    expect(file).toBeDefined();
    expect(primaryInConfig(file as string)).toBe("true");
  });
});

describe("[spec] 설치 때 패치가 자동 적용된다(104 고치는 방법 1: patch-package, postinstall, 스토어 빌드의 설치)", () => {
  type PackageJson = { version?: string; scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  type PackageLock = { packages: Record<string, { version?: string; dev?: boolean; devDependencies?: Record<string, string> }> };
  const pkg = JSON.parse(readFileSync(join(MOBILE, "package.json"), "utf8")) as PackageJson;
  const lock = JSON.parse(readFileSync(join(MOBILE, "package-lock.json"), "utf8")) as PackageLock;
  const r3fVersion = (JSON.parse(readFileSync(join(R3F, "package.json"), "utf8")) as PackageJson).version;

  /** postinstall이 patch-package에 준 패치 폴더(--patch-dir). 없으면 patch-package 기본값 patches. */
  function patchDir(): string {
    const found = /--patch-dir[= ]+(\S+)/.exec(pkg.scripts?.postinstall ?? "");
    return join(MOBILE, found ? found[1] : "patches");
  }

  test("[재현] R3-1: patch-package는 모바일 devDependencies에 있고 dependencies에 없다", () => {
    expect(Object.keys(pkg.devDependencies ?? {})).toContain("patch-package");
    expect(Object.keys(pkg.dependencies ?? {})).not.toContain("patch-package");
  });

  test("[재현] R3-2: 설치 때(postinstall) patch-package를 실행한다", () => {
    expect(pkg.scripts?.postinstall ?? "").toMatch(/(^|[\s;&|])(npx\s+)?patch-package(\s|$)/);
  });

  test("[재현] R3-3: 설치된 @react-three/fiber 판의 패치 파일이 있고, 그 패치가 reconciler 설정을 isPrimaryRenderer: true로 바꾼다", () => {
    let files: string[] = [];
    try {
      files = readdirSync(patchDir());
    } catch {
      files = [];
    }
    const patch = files.find((name) => name === `@react-three+fiber+${r3fVersion}.patch`);
    expect(patch).toBeDefined();
    const text = readFileSync(join(patchDir(), patch as string), "utf8");
    expect(text).toMatch(/^-\s*isPrimaryRenderer:\s*false,?\s*$/m);
    expect(text).toMatch(/^\+\s*isPrimaryRenderer:\s*true,?\s*$/m);
    // 개발 빌드와 출시 빌드(EAS)가 쓰는 파일을 모두 고친다
    expect(text).toMatch(/^\+\+\+ b\/node_modules\/@react-three\/fiber\/dist\/events-[^/\s]*\.cjs\.dev\.js/m);
    expect(text).toMatch(/^\+\+\+ b\/node_modules\/@react-three\/fiber\/dist\/events-[^/\s]*\.cjs\.prod\.js/m);
  });

  test("[재현] R3-4: 잠금 파일에 patch-package가 package.json과 같은 표기의 개발 의존성으로 잠겨 있다(스토어 빌드의 설치도 같은 판을 받는다)", () => {
    const declared = pkg.devDependencies?.["patch-package"];
    expect(declared).toBeDefined();
    expect(lock.packages[""]?.devDependencies?.["patch-package"]).toBe(declared);
    expect(lock.packages["node_modules/patch-package"]?.version).toBeDefined();
  });
});
