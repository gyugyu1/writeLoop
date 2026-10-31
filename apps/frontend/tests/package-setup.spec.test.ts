/**
 * @vitest-environment node
 */
// [spec] qa 테스트(작업 037-02 시나리오 A1, A2, A5와 결정 03의 1). 웹 앱의 package.json과 루트 package-lock.json을 읽어
// 테스트 도구가 정확한 버전의 개발 의존성으로 들어 있고 실행 명령이 "vitest run"인지 본다.
// 기준 커밋과 비교하는 확인(dependencies와 다른 scripts가 그대로인지, 운영 의존성 잠금이 그대로인지)은
// 이번 작업에서만 뜻이 있어 여기 두지 않고 4단계에서 변경분으로 본다.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type PackageJson = {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
type LockEntry = { version?: string; dev?: boolean; devDependencies?: Record<string, string> };
type PackageLock = { packages: Record<string, LockEntry> };

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as PackageJson;
const lock = JSON.parse(readFileSync(new URL("../../../package-lock.json", import.meta.url), "utf8")) as PackageLock;

// 명세 1의 다섯과, 결정 03의 1로 같은 규칙을 거는 @testing-library/dom
const TOOL_PACKAGES = [
  "vitest",
  "@testing-library/react",
  "@testing-library/user-event",
  "@testing-library/jest-dom",
  "jsdom",
  "@testing-library/dom"
];

describe("[spec] 웹 테스트 도구의 의존성과 실행 명령", () => {
  it("[spec] A5: scripts.test가 정확히 vitest run이다", () => {
    expect(pkg.scripts?.test).toBe("vitest run");
  });

  it.each(TOOL_PACKAGES)("[spec] A1: %s는 devDependencies에 있고 dependencies에 없다", (name) => {
    expect(Object.keys(pkg.devDependencies ?? {})).toContain(name);
    expect(Object.keys(pkg.dependencies ?? {})).not.toContain(name);
  });

  it.each(TOOL_PACKAGES)("[spec] A2 (가): %s는 루트 잠금 파일에 같은 표기로, 개발 의존성으로 잠겨 있다", (name) => {
    const declared = pkg.devDependencies?.[name];
    expect(lock.packages["apps/frontend"]?.devDependencies?.[name]).toBe(declared);
    const entry = lock.packages[`node_modules/${name}`];
    expect(entry).toBeDefined();
    expect(entry?.dev).toBe(true);
  });

  it.each(TOOL_PACKAGES)("[spec] A2 (나): %s는 범위가 아닌 정확한 버전으로 적혀 있고 잠금 파일의 버전과 같다", (name) => {
    const declared = pkg.devDependencies?.[name] ?? "";
    expect(declared).toMatch(/^\d+\.\d+\.\d+$/);
    expect(lock.packages[`node_modules/${name}`]?.version).toBe(declared);
  });
});
