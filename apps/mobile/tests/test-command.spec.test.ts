// [spec] qa 테스트(작업 039-02 시나리오 A6, A7). apps/mobile의 `npm run test`(Windows는 npm.cmd)가 감시 모드로 멈추지 않고
// 한 번 돌고 끝나는지, 테스트가 하나라도 실패하면 종료 코드가 0이 아닌지 본다.
// 저장소에 실패하는 테스트를 두지 않으려고, 임시 폴더에 테스트 파일을 만들고 같은 명령에 --roots·--testMatch를 붙여 그것만 돌린다.
// CI 환경 변수를 빼고 표준 입력을 닫아, CI가 아닌 곳에서 손으로 돌릴 때와 같게 한다.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MOBILE = join(__dirname, "..");
const IS_WINDOWS = process.platform === "win32";
// 명령이 감시 모드로 멈추면 이 시간 뒤에 끊는다.
const CHILD_TIMEOUT_MS = 120_000;

// 출력의 색 코드(ESC [ ... m)를 지운다. 바깥 jest가 FORCE_COLOR를 넘길 수 있다.
const ANSI_COLOR = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

let fixtureDir = "";

function runNpmTest(fixtureName: string) {
  const env = { ...process.env };
  delete env.CI;
  delete env.JEST_WORKER_ID;
  delete env.FORCE_COLOR;
  const options = {
    cwd: MOBILE,
    env,
    encoding: "utf8" as const,
    stdio: ["ignore", "pipe", "pipe"] as ("ignore" | "pipe")[],
    timeout: CHILD_TIMEOUT_MS
  };
  // Windows의 npm.cmd는 셸로만 부를 수 있어 명령 한 줄로 넘기고 경로를 따옴표로 감싼다.
  const result = IS_WINDOWS
    ? spawnSync(`npm.cmd run test -- --roots "${fixtureDir}" --testMatch **/${fixtureName}`, { ...options, shell: true })
    : spawnSync("npm", ["run", "test", "--", "--roots", fixtureDir, "--testMatch", `**/${fixtureName}`], options);
  return { ...result, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}`.replace(ANSI_COLOR, "") };
}

describe("[spec] npm run test 명령", () => {
  beforeAll(() => {
    fixtureDir = mkdtempSync(join(tmpdir(), "wl-mobile-test-command-"));
    writeFileSync(
      join(fixtureDir, "qafixture-passes.js"),
      'test("qa fixture passes", () => {\n  expect(1 + 1).toBe(2);\n});\n'
    );
    writeFileSync(
      join(fixtureDir, "qafixture-fails.js"),
      'test("qa fixture fails on purpose", () => {\n  expect(1 + 1).toBe(3);\n});\n'
    );
  });

  afterAll(() => {
    if (fixtureDir) rmSync(fixtureDir, { recursive: true, force: true });
  });

  it(
    "[spec] A6: 모두 통과하면 입력 없이 한 번 돌고 종료 코드 0으로 끝난다(감시 모드 아님)",
    () => {
      const result = runNpmTest("qafixture-passes.js");
      expect(result.error).toBeUndefined();
      expect(result.signal).toBeNull();
      expect(result.status).toBe(0);
      expect(result.output).toContain("qa fixture passes");
      expect(result.output).toMatch(/Tests:\s+1 passed, 1 total/);
    },
    CHILD_TIMEOUT_MS + 30_000
  );

  it(
    "[spec] A7: 테스트가 하나라도 실패하면 종료 코드가 0이 아니고 실패한 테스트 이름이 나온다",
    () => {
      const result = runNpmTest("qafixture-fails.js");
      expect(result.error).toBeUndefined();
      expect(result.signal).toBeNull();
      expect(result.status).not.toBeNull();
      expect(result.status).not.toBe(0);
      expect(result.output).toContain("qa fixture fails on purpose");
      expect(result.output).toMatch(/Tests:\s+1 failed, 1 total/);
    },
    CHILD_TIMEOUT_MS + 30_000
  );
});
