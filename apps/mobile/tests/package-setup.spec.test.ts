// [spec] qa 테스트(작업 039-02 시나리오 A1, A2, A5와 결정 03의 3). 모바일 앱의 package.json과 package-lock.json을 읽어
// 테스트 도구가 정확한 버전의 개발 의존성으로 들어 있고 실행 명령 "test"가 있는지 본다.
// 기준 커밋과 비교하는 확인(dependencies와 다른 scripts가 그대로인지, 운영 의존성 잠금이 그대로인지)은
// 이번 작업에서만 뜻이 있어 여기 두지 않고 4단계에서 변경분으로 본다.
import { readFileSync } from "node:fs";
import { join } from "node:path";

type PackageJson = {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};
type LockEntry = { version?: string; dev?: boolean; devDependencies?: Record<string, string> };
type PackageLock = { packages: Record<string, LockEntry> };

const MOBILE = join(__dirname, "..");
const pkg = JSON.parse(readFileSync(join(MOBILE, "package.json"), "utf8")) as PackageJson;
const lock = JSON.parse(readFileSync(join(MOBILE, "package-lock.json"), "utf8")) as PackageLock;
const testingLibrary = JSON.parse(
  readFileSync(require.resolve("@testing-library/react-native/package.json"), "utf8")
) as PackageJson;

// 명세 1의 "@testing-library/react-native(와 그것이 요구하는 렌더러)": 설치된 판의 짝 의존성 중 jest·react·react-native가 아닌 것
const RENDERERS = Object.keys(testingLibrary.peerDependencies ?? {}).filter(
  (name) => !["jest", "react", "react-native"].includes(name)
);
const TOOL_PACKAGES = ["jest-expo", "jest", "@testing-library/react-native", ...RENDERERS, "@types/jest"];
// 결정 03의 3: expo-router가 Testing Library를 선택 짝 의존성으로 걸어 두어, Testing Library와 그 짝(jest, 렌더러)은
// 잠금 파일에 개발 전용 표시가 붙지 않는 것을 받아들였다. 개발 전용 표시는 나머지 둘만 본다.
const DEV_MARKED_PACKAGES = ["jest-expo", "@types/jest"];

describe("[spec] 모바일 테스트 도구의 의존성과 실행 명령", () => {
  it("[spec] A5: scripts.test가 있다", () => {
    expect(typeof pkg.scripts?.test).toBe("string");
    expect(pkg.scripts?.test?.trim()).not.toBe("");
  });

  it("[spec] A1: 설치된 Testing Library가 짝 의존성으로 요구하는 렌더러가 있다", () => {
    expect(RENDERERS.length).toBeGreaterThan(0);
  });

  it.each(TOOL_PACKAGES)("[spec] A1: %s는 devDependencies에 있고 dependencies에 없다", (name) => {
    expect(Object.keys(pkg.devDependencies ?? {})).toContain(name);
    expect(Object.keys(pkg.dependencies ?? {})).not.toContain(name);
  });

  it.each(TOOL_PACKAGES)("[spec] A2 (가): %s는 범위가 아닌 정확한 버전으로 적혀 있다", (name) => {
    expect(pkg.devDependencies?.[name] ?? "").toMatch(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/);
  });

  it("[spec] A2 (나): jest-expo는 55.x, jest는 29.x다", () => {
    expect(pkg.devDependencies?.["jest-expo"] ?? "").toMatch(/^55\./);
    expect(pkg.devDependencies?.jest ?? "").toMatch(/^29\./);
  });

  it.each(TOOL_PACKAGES)("[spec] A2 (다): %s는 잠금 파일에 같은 표기와 같은 버전으로 잠겨 있다", (name) => {
    const declared = pkg.devDependencies?.[name];
    expect(declared).toBeDefined();
    expect(lock.packages[""]?.devDependencies?.[name]).toBe(declared);
    expect(lock.packages[`node_modules/${name}`]?.version).toBe(declared);
  });

  it.each(DEV_MARKED_PACKAGES)("[spec] A2 (다): %s는 잠금 파일에 개발 전용으로 표시돼 있다", (name) => {
    expect(lock.packages[`node_modules/${name}`]?.dev).toBe(true);
  });
});
