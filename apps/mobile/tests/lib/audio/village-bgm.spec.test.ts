// 마을 배경음악 시나리오(02-qa-scenarios.md)의 [T]를 옮긴 테스트. 기대값은 시나리오에서만 가져온다.
// expo-audio와 기기 저장소는 가짜로 대신하고, 시간은 가짜 타이머로 흘린다.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { AppState } from "react-native";

import type { DayPhase } from "@/lib/lobby3d/daylight";
import {
  resetVillageBgmForTest,
  setVillageBgmArea,
  setVillageBgmHomeFocused,
  setVillageBgmWriting
} from "@/lib/audio/village-bgm";

class FakePlayer {
  source: unknown;
  volume = 1;
  loop = false;
  playing = false;
  removed = false;
  playCalls = 0;
  pauseCalls = 0;
  seekCalls = 0;
  listeners: Array<(status: { didJustFinish: boolean }) => void> = [];
  constructor(source: unknown) {
    this.source = source;
  }
  play() {
    this.playCalls += 1;
    this.playing = true;
  }
  pause() {
    this.pauseCalls += 1;
    this.playing = false;
  }
  seekTo() {
    this.seekCalls += 1;
  }
  remove() {
    this.removed = true;
    this.playing = false;
  }
  addListener(_event: string, listener: (status: { didJustFinish: boolean }) => void) {
    this.listeners.push(listener);
    return { remove: () => (this.listeners = this.listeners.filter((l) => l !== listener)) };
  }
  finish() {
    for (const l of [...this.listeners]) l({ didJustFinish: true });
  }
}

const mockStore = new Map<string, string>();
const mockStorage = {
  getItem: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  })
};
jest.mock("@react-native-async-storage/async-storage", () => ({ __esModule: true, default: mockStorage }));
// 세 파일이 테스트 환경에서 같은 번호가 되므로, 곡을 구별하려고 파일마다 다른 값으로 대신한다
jest.mock("../../../assets/audio/village_day.m4a", () => "A");
jest.mock("../../../assets/audio/village_day_cheerful.m4a", () => "B");
jest.mock("../../../assets/audio/village_night.m4a", () => "N");
jest.mock("expo-audio", () => ({ createAudioPlayer: jest.fn(), setAudioModeAsync: jest.fn() }));

const audio = jest.requireMock("expo-audio") as { createAudioPlayer: jest.Mock; setAudioModeAsync: jest.Mock };
const A = require("../../../assets/audio/village_day.m4a");
const B = require("../../../assets/audio/village_day_cheerful.m4a");
const N = require("../../../assets/audio/village_night.m4a");

let players: FakePlayer[] = [];
let appListener: ((s: string) => void) | null = null;
const alive = () => players.filter((p) => !p.removed);
const playingNow = () => alive().filter((p) => p.playing);
const tick = (ms = 0) => jest.advanceTimersByTimeAsync(ms);
const nameOf = (p: FakePlayer) => (p.source === A ? "A" : p.source === B ? "B" : p.source === N ? "N" : "?");
const aliveNames = () => alive().map(nameOf);
const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

async function enter(phase: DayPhase = "day") {
  setVillageBgmHomeFocused(true);
  setVillageBgmArea(true, phase);
  await tick(0);
}
async function leaveHome() {
  setVillageBgmHomeFocused(false);
  await tick(1000);
}
async function openWriting() {
  setVillageBgmWriting(true);
  setVillageBgmHomeFocused(false);
  await tick(1000);
}
async function setApp(state: string) {
  appListener?.(state);
  await tick(0);
}

beforeEach(() => {
  jest.useFakeTimers();
  mockStore.clear();
  players = [];
  appListener = null;
  warn.mockClear();
  mockStorage.getItem.mockReset();
  mockStorage.setItem.mockReset();
  mockStorage.getItem.mockImplementation(async (key: string) => mockStore.get(key) ?? null);
  mockStorage.setItem.mockImplementation(async (key: string, value: string) => {
    mockStore.set(key, value);
  });
  audio.createAudioPlayer.mockReset();
  audio.createAudioPlayer.mockImplementation((source: unknown) => {
    const p = new FakePlayer(source);
    players.push(p);
    return p;
  });
  audio.setAudioModeAsync.mockReset();
  audio.setAudioModeAsync.mockResolvedValue(undefined);
  jest.spyOn(AppState, "addEventListener").mockImplementation(((_t: string, l: (s: string) => void) => {
    appListener = l;
    return { remove: () => undefined };
  }) as never);
  (AppState as unknown as { currentState: string }).currentState = "active";
  resetVillageBgmForTest();
});

afterEach(() => {
  resetVillageBgmForTest();
  jest.useRealTimers();
});

const assetsDir = path.resolve(__dirname, "../../../assets/audio");
const srcDir = path.resolve(__dirname, "../../../src");

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

describe("[spec] 자산·의존성 (S01~S06)", () => {
  it("S01 오디오 폴더에는 M4A 셋만 있다", () => {
    expect(fs.readdirSync(assetsDir).sort()).toEqual(["village_day.m4a", "village_day_cheerful.m4a", "village_night.m4a"]);
  });
  it("S02 원본 폴더의 같은 이름 파일과 바이트가 같다", () => {
    const origin = "C:\\WriteLoop-asset\\BGM\\수노\\app";
    if (!fs.existsSync(origin)) return;
    for (const name of ["village_day.m4a", "village_day_cheerful.m4a", "village_night.m4a"]) {
      const sha = (f: string) => createHash("sha256").update(fs.readFileSync(f)).digest("hex");
      expect(sha(path.join(assetsDir, name))).toBe(sha(path.join(origin, name)));
    }
  });
  it("S03 expo-audio는 있고 expo-av는 없다", () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../package.json"), "utf8"));
    expect(pkg.dependencies["expo-audio"]).toBeDefined();
    expect(pkg.dependencies["expo-av"]).toBeUndefined();
  });
  it("S04 src의 코드가 세 파일을 require로 연결한다", () => {
    const code = walk(srcDir).filter((f) => /\.tsx?$/.test(f)).map((f) => fs.readFileSync(f, "utf8")).join("\n");
    for (const name of ["village_day.m4a", "village_day_cheerful.m4a", "village_night.m4a"]) {
      expect(code).toMatch(new RegExp(`require\\(["'][^"']*assets/audio/${name.replace(".", "\\.")}["']\\)`));
    }
  });
  it("S06 플레이어 생성은 관리 모듈 한 곳에서만 일어난다", () => {
    const users = walk(srcDir).filter((f) => /\.tsx?$/.test(f)).filter((f) => /createAudioPlayer|useAudioPlayer|new AudioPlayer/.test(fs.readFileSync(f, "utf8")));
    expect(users.map((f) => path.basename(f))).toEqual(["village-bgm.ts"]);
  });
});

describe("[spec] 시작과 곡 고르기 (S07~S14, S52)", () => {
  it("S08 마을·포그라운드면 시간대 묶음의 곡 하나를 튼다", async () => {
    await enter("day");
    expect(playingNow().map(nameOf)).toEqual(["A"]);
  });
  it("S07 정상 흐름에서는 살아 있는 플레이어가 하나다", async () => {
    await enter("day");
    setVillageBgmArea(true, "sunset");
    await tick(3000);
    expect(alive()).toHaveLength(1);
  });
  it("S09 방이면 틀지 않는다", async () => {
    setVillageBgmHomeFocused(true);
    setVillageBgmArea(false, "day");
    await tick(3000);
    expect(players).toHaveLength(0);
  });
  it("S09 홈이 초점을 잃었으면 틀지 않는다", async () => {
    setVillageBgmHomeFocused(false);
    setVillageBgmArea(true, "day");
    await tick(3000);
    expect(players).toHaveLength(0);
  });
  it("S09 앱이 백그라운드면 틀지 않는다", async () => {
    (AppState as unknown as { currentState: string }).currentState = "background";
    resetVillageBgmForTest();
    await enter("day");
    await tick(3000);
    expect(playingNow()).toHaveLength(0);
  });
  it.each([
    ["day", "A"],
    ["sunset", "A"],
    ["dusk", "N"],
    ["night", "N"],
    ["dawn", "N"]
  ] as const)("S10 %s 로 들어가면 %s", async (phase, name) => {
    await enter(phase);
    expect(aliveNames()).toEqual([name]);
  });
  it("S11 저장된 곡이 없으면 포근한 곡 A로 시작한다", async () => {
    await enter("day");
    expect(aliveNames()).toEqual(["A"]);
  });
  it("S12 마지막 낮 곡이 A면 B로, B면 A로 시작한다", async () => {
    mockStore.set("writeloop.villageBgm.lastDayTrack", "dayCozy");
    await enter("day");
    expect(aliveNames()).toEqual(["B"]);
    await leaveHome();
    resetVillageBgmForTest();
    players = [];
    mockStore.set("writeloop.villageBgm.lastDayTrack", "dayCheerful");
    await enter("day");
    expect(aliveNames()).toEqual(["A"]);
  });
  it("S13 낮 곡을 틀면 기기에 저장되고, 모듈을 다시 불러온 상태에서 다음 곡부터 시작한다", async () => {
    await enter("day");
    expect([...mockStore.values()]).toEqual(["dayCozy"]);
    await leaveHome();
    resetVillageBgmForTest();
    players = [];
    await enter("day");
    expect(aliveNames()).toEqual(["B"]);
  });
  it("S14 밤 곡은 마지막으로 들은 낮 곡을 바꾸지 않는다", async () => {
    mockStore.set("writeloop.villageBgm.lastDayTrack", "dayCozy");
    await enter("night");
    expect(aliveNames()).toEqual(["N"]);
    expect([...mockStore.values()]).toEqual(["dayCozy"]);
    await leaveHome();
    resetVillageBgmForTest();
    players = [];
    await enter("day");
    expect(aliveNames()).toEqual(["B"]);
  });
  it("S52 방에서는 플레이어를 만들지 않는다", async () => {
    setVillageBgmHomeFocused(true);
    setVillageBgmArea(false, "night");
    await tick(5000);
    expect(audio.createAudioPlayer).not.toHaveBeenCalled();
  });
});

describe("[spec] 곡 순환 (S15, S16)", () => {
  it("S15 낮에는 A→B→A→B 순으로 넘어가며 플레이어는 하나다", async () => {
    await enter("day");
    const seq: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      seq.push(aliveNames()[0]);
      expect(alive()).toHaveLength(1);
      alive()[0].finish();
      await tick(0);
      expect(alive()).toHaveLength(1);
      expect(alive()[0].playing).toBe(true);
    }
    expect(seq).toEqual(["A", "B", "A", "B"]);
    expect(aliveNames()).toEqual(["A"]);
  });
  it("S16 밤 곡은 되풀이하고 다른 곡으로 넘어가지 않는다", async () => {
    await enter("night");
    const p = alive()[0];
    expect(p.loop).toBe(true);
    p.finish();
    await tick(0);
    expect(aliveNames()).toEqual(["N"]);
    expect(players).toHaveLength(1);
  });
});

describe("[spec] 낮·밤 전환 (S17~S20)", () => {
  it("S17 낮→밤은 1.5초 겹쳐 바꾼 뒤 나간 곡을 해제한다", async () => {
    await enter("sunset");
    const day = alive()[0];
    setVillageBgmArea(true, "dusk");
    await tick(750);
    expect(alive()).toHaveLength(2);
    const night = alive().find((p) => p !== day)!;
    expect(nameOf(night)).toBe("N");
    expect(day.volume).toBeLessThan(1);
    expect(day.volume).toBeGreaterThan(0);
    expect(night.volume).toBeGreaterThan(0);
    expect(night.volume).toBeLessThan(1);
    await tick(900);
    expect(day.removed).toBe(true);
    expect(aliveNames()).toEqual(["N"]);
    expect(night.volume).toBeCloseTo(1, 2);
  });
  it("S18 밤→낮도 겹쳐 바꾸고 들어오는 낮 곡은 이어듣기 규칙을 따른다", async () => {
    mockStore.set("writeloop.villageBgm.lastDayTrack", "dayCozy");
    await enter("dawn");
    const night = alive()[0];
    setVillageBgmArea(true, "day");
    await tick(750);
    expect(alive()).toHaveLength(2);
    expect(alive().map(nameOf).sort()).toEqual(["B", "N"]);
    await tick(900);
    expect(night.removed).toBe(true);
    expect(aliveNames()).toEqual(["B"]);
  });
  it("S19 같은 묶음 안의 시간대 변화는 곡을 바꾸지 않는다", async () => {
    for (const [from, to] of [["day", "sunset"], ["sunset", "day"], ["dusk", "night"], ["night", "dawn"], ["dawn", "dusk"]] as const) {
      resetVillageBgmForTest();
      players = [];
      await enter(from);
      const p = alive()[0];
      setVillageBgmArea(true, to);
      await tick(3000);
      expect(players).toHaveLength(1);
      expect(alive()[0]).toBe(p);
      expect(p.removed).toBe(false);
      expect(p.seekCalls).toBe(0);
      expect(p.playing).toBe(true);
    }
  });
  it("S20 같은 값이 다시 전달돼도 플레이어를 새로 만들지 않는다", async () => {
    await enter("day");
    const p = alive()[0];
    for (let i = 0; i < 5; i += 1) {
      setVillageBgmHomeFocused(true);
      setVillageBgmArea(true, "day");
      await tick(500);
    }
    expect(players).toHaveLength(1);
    expect(alive()[0]).toBe(p);
    expect(p.pauseCalls).toBe(0);
  });
});

describe("[spec] 영작 화면 (S22~S27)", () => {
  it("S22 영작 화면을 열면 끄지 않고 0.6초에 걸쳐 평소의 40%로 낮춘다", async () => {
    await enter("day");
    const p = alive()[0];
    expect(p.volume).toBe(1);
    setVillageBgmWriting(true);
    setVillageBgmHomeFocused(false);
    await tick(300);
    expect(p.volume).toBeLessThan(1);
    expect(p.volume).toBeGreaterThan(0.4);
    await tick(400);
    expect(p.volume).toBeCloseTo(0.4, 2);
    expect(p.pauseCalls).toBe(0);
    expect(p.removed).toBe(false);
    expect(p.seekCalls).toBe(0);
    expect(players).toHaveLength(1);
    expect(p.playing).toBe(true);
  });
  it("S23 영작 화면 사이를 오가는 동안 낮춘 채 이어 간다", async () => {
    await enter("day");
    const p = alive()[0];
    await openWriting();
    // 다음 영작 화면이 먼저 초점을 얻고 앞 화면이 뒤에 잃는 경우
    setVillageBgmWriting(true);
    setVillageBgmWriting(false);
    await tick(3000);
    // 앞 화면이 잃은 뒤 다음 화면이 얻는 경우
    setVillageBgmWriting(false);
    await tick(100);
    setVillageBgmWriting(true);
    await tick(3000);
    expect(players).toHaveLength(1);
    expect(p.removed).toBe(false);
    expect(p.volume).toBeCloseTo(0.4, 2);
    expect(p.playing).toBe(true);
  });
  it("S24 영작 화면 중 묶음이 바뀌면 겹쳐 바꾸되 볼륨은 40%를 넘지 않는다", async () => {
    await enter("day");
    await openWriting();
    const day = alive()[0];
    setVillageBgmArea(true, "night");
    let max = 0;
    for (let t = 0; t < 1600; t += 50) {
      await tick(50);
      for (const p of alive()) max = Math.max(max, p.volume);
      expect(alive().length).toBeLessThanOrEqual(2);
    }
    expect(max).toBeLessThanOrEqual(0.4 + 1e-6);
    expect(day.removed).toBe(true);
    expect(aliveNames()).toEqual(["N"]);
    expect(alive()[0].volume).toBeCloseTo(0.4, 2);
    // 같은 묶음 안 변화는 곡을 바꾸지 않는다
    const n = alive()[0];
    setVillageBgmArea(true, "dawn");
    await tick(3000);
    expect(alive()[0]).toBe(n);
    expect(players).toHaveLength(2);
  });
  it("S25 마을로 돌아오면 0.6초에 걸쳐 평소 볼륨으로 돌아오고 곡은 끊기지 않는다", async () => {
    await enter("day");
    const p = alive()[0];
    await openWriting();
    setVillageBgmHomeFocused(true);
    setVillageBgmWriting(false);
    await tick(300);
    expect(p.volume).toBeGreaterThan(0.4);
    expect(p.volume).toBeLessThan(1);
    await tick(400);
    expect(p.volume).toBeCloseTo(1, 2);
    expect(p.pauseCalls).toBe(0);
    expect(p.removed).toBe(false);
    expect(players).toHaveLength(1);
  });
  it("S26 방에서 연 영작 화면은 아무것도 틀지 않는다", async () => {
    setVillageBgmHomeFocused(true);
    setVillageBgmArea(false, "day");
    await tick(100);
    await openWriting();
    await tick(3000);
    expect(players).toHaveLength(0);
  });
  it("S26 다른 화면에서 연 영작 화면은 아무것도 틀지 않는다", async () => {
    setVillageBgmWriting(true);
    await tick(3000);
    expect(players).toHaveLength(0);
  });
  it("S27 영작 화면에서 홈이 아닌 화면으로 가면 정리한다", async () => {
    await enter("day");
    const p = alive()[0];
    await openWriting();
    setVillageBgmWriting(false);
    await tick(1000);
    expect(alive()).toHaveLength(0);
    expect(p.removed).toBe(true);
  });
});

describe("[spec] 마을과 이어진 화면 (S29~S33)", () => {
  it("S29 홈 안의 시트를 열고 닫아도(같은 값 재알림) 음악은 그대로 이어진다", async () => {
    await enter("day");
    const p = alive()[0];
    setVillageBgmHomeFocused(true);
    await tick(5000);
    expect(p.pauseCalls).toBe(0);
    expect(p.removed).toBe(false);
    expect(p.volume).toBe(1);
    expect(p.playing).toBe(true);
  });
  it("S30 방으로 들어가면 정리한다", async () => {
    await enter("day");
    const p = alive()[0];
    setVillageBgmArea(false, "day");
    await tick(1000);
    expect(alive()).toHaveLength(0);
    expect(p.removed).toBe(true);
    expect(p.playing).toBe(false);
  });
  it("S31 홈이 초점을 잃으면(학습 기록 등) 정리한다", async () => {
    await enter("night");
    await leaveHome();
    expect(alive()).toHaveLength(0);
  });
  it("S32 정리 뒤 다시 마을에 들어오면 새로 시작한다", async () => {
    await enter("day");
    await leaveHome();
    expect(alive()).toHaveLength(0);
    await enter("day");
    expect(aliveNames()).toEqual(["B"]);
    expect(playingNow()).toHaveLength(1);
  });
  it("S33 영작 화면에서 정리된 뒤 마을에 들어오면 볼륨은 평소다", async () => {
    await enter("day");
    await openWriting();
    setVillageBgmWriting(false);
    await tick(1000);
    expect(alive()).toHaveLength(0);
    await enter("day");
    expect(alive()).toHaveLength(1);
    expect(alive()[0].volume).toBe(1);
  });
});

describe("[spec] 백그라운드 (S34~S38)", () => {
  it("S34 백그라운드로 가면 일시정지한다", async () => {
    await enter("day");
    await setApp("background");
    expect(playingNow()).toHaveLength(0);
    expect(alive()[0].pauseCalls).toBeGreaterThan(0);
  });
  it("S35 같은 곡이면 멈춘 자리부터 다시 튼다", async () => {
    await enter("day");
    const p = alive()[0];
    await setApp("background");
    await setApp("active");
    await tick(100);
    expect(players).toHaveLength(1);
    expect(p.seekCalls).toBe(0);
    expect(p.playing).toBe(true);
    expect(p.removed).toBe(false);
  });
  it("S36 백그라운드 중 묶음이 바뀌었으면 겹치지 않고 바로 새 곡을 처음부터 튼다", async () => {
    await enter("day");
    const day = alive()[0];
    await setApp("background");
    setVillageBgmArea(true, "night");
    await tick(0);
    await setApp("active");
    expect(alive()).toHaveLength(1);
    expect(day.removed).toBe(true);
    expect(aliveNames()).toEqual(["N"]);
    expect(alive()[0].playing).toBe(true);
    expect(alive()[0].volume).toBe(1);
    expect(alive()[0].seekCalls).toBe(0);
    await tick(3000);
    expect(alive()).toHaveLength(1);
  });
  it("S37 백그라운드 중 마을을 벗어났으면 돌아와도 틀지 않는다", async () => {
    await enter("day");
    await setApp("background");
    setVillageBgmHomeFocused(false);
    await tick(0);
    await setApp("active");
    await tick(3000);
    expect(playingNow()).toHaveLength(0);
    expect(alive()).toHaveLength(0);
  });
  it("S38 영작 화면에서 백그라운드를 다녀오면 40% 볼륨으로 다시 튼다", async () => {
    await enter("day");
    await openWriting();
    await setApp("background");
    await setApp("active");
    await tick(1000);
    const p = alive()[0];
    expect(alive()).toHaveLength(1);
    expect(p.playing).toBe(true);
    expect(p.volume).toBeCloseTo(0.4, 2);
  });
});

describe("[spec] 겹침 방지·경합 (S40~S44)", () => {
  it("S40 진입·이탈을 빠르게 반복해도 마지막 상태에 맞는 개수만 남는다(이탈로 끝)", async () => {
    mockStorage.getItem.mockImplementation(() => new Promise((r) => setTimeout(() => r(null), 80)));
    for (let i = 0; i < 4; i += 1) {
      setVillageBgmHomeFocused(true);
      setVillageBgmArea(true, "day");
      await tick(30);
      setVillageBgmHomeFocused(false);
      await tick(30);
    }
    await tick(5000);
    expect(alive()).toHaveLength(0);
  });
  it("S40 진입·이탈을 빠르게 반복해도 마지막 상태에 맞는 개수만 남는다(진입으로 끝)", async () => {
    mockStorage.getItem.mockImplementation(() => new Promise((r) => setTimeout(() => r(null), 80)));
    for (let i = 0; i < 4; i += 1) {
      setVillageBgmHomeFocused(true);
      setVillageBgmArea(true, "day");
      await tick(30);
      setVillageBgmHomeFocused(false);
      await tick(30);
    }
    setVillageBgmHomeFocused(true);
    await tick(5000);
    expect(alive()).toHaveLength(1);
    expect(playingNow()).toHaveLength(1);
  });
  it("S41 준비가 끝나기 전에 정리가 들어오면 늦게 끝난 시작은 재생하지 않고 남기지 않는다", async () => {
    mockStorage.getItem.mockImplementation(() => new Promise((r) => setTimeout(() => r(null), 1500)));
    setVillageBgmHomeFocused(true);
    setVillageBgmArea(true, "day");
    await tick(100);
    setVillageBgmArea(false, "day");
    await tick(3000);
    expect(alive()).toHaveLength(0);
    expect(players.every((p) => p.playCalls === 0)).toBe(true);
  });
  it("S42 영작과 홈을 빠르게 오가면 마지막 상태로 볼륨이 수렴하고 플레이어는 하나다", async () => {
    await enter("day");
    for (let i = 0; i < 4; i += 1) {
      setVillageBgmWriting(true);
      setVillageBgmHomeFocused(false);
      await tick(120);
      setVillageBgmHomeFocused(true);
      setVillageBgmWriting(false);
      await tick(120);
    }
    await tick(2000);
    expect(alive()).toHaveLength(1);
    expect(alive()[0].volume).toBeCloseTo(1, 2);
    setVillageBgmWriting(true);
    setVillageBgmHomeFocused(false);
    await tick(120);
    setVillageBgmHomeFocused(true);
    setVillageBgmWriting(false);
    await tick(120);
    setVillageBgmWriting(true);
    setVillageBgmHomeFocused(false);
    await tick(2000);
    expect(alive()).toHaveLength(1);
    expect(alive()[0].volume).toBeCloseTo(0.4, 2);
  });
  it("S43 겹침 전환 중에 정리가 들어오면 두 플레이어가 모두 해제된다", async () => {
    await enter("day");
    setVillageBgmArea(true, "night");
    await tick(700);
    expect(alive()).toHaveLength(2);
    setVillageBgmArea(false, "night");
    await tick(2000);
    expect(alive()).toHaveLength(0);
  });
  it("S44 겹침 중 또 묶음이 바뀌어도 동시에 둘을 넘지 않고 끝나면 하나다", async () => {
    await enter("day");
    setVillageBgmArea(true, "night");
    await tick(500);
    setVillageBgmArea(true, "day");
    for (let t = 0; t < 1500; t += 50) {
      await tick(50);
      expect(alive().length).toBeLessThanOrEqual(2);
    }
    setVillageBgmArea(true, "night");
    for (let t = 0; t < 700; t += 50) {
      await tick(50);
      expect(alive().length).toBeLessThanOrEqual(2);
    }
    await tick(5000);
    expect(alive()).toHaveLength(1);
  });
});

describe("[spec] 음량·오디오 모드 (S46, S47)", () => {
  it("S46 평소는 플레이어 최대 볼륨, 영작 중은 그 0.4배다", async () => {
    await enter("day");
    expect(alive()[0].volume).toBe(1);
    await openWriting();
    expect(alive()[0].volume).toBeCloseTo(0.4, 2);
  });
  it("S47 무음 모드에서 재생하지 않고 다른 앱 소리와 섞는다", async () => {
    await enter("day");
    expect(audio.setAudioModeAsync).toHaveBeenCalledWith(expect.objectContaining({ playsInSilentMode: false, interruptionMode: "mixWithOthers" }));
  });
});

describe("[spec] 실패 처리 (S49, S50)", () => {
  it("S49 플레이어 생성이 예외를 던져도 예외가 전파되지 않는다", async () => {
    audio.createAudioPlayer.mockImplementation(() => {
      throw new Error("읽지 못함");
    });
    expect(() => {
      setVillageBgmHomeFocused(true);
      setVillageBgmArea(true, "day");
    }).not.toThrow();
    await expect(tick(3000)).resolves.toBeUndefined();
    expect(playingNow()).toHaveLength(0);
  });
  it("S49 재생 호출이 예외를 던져도 전파되지 않는다", async () => {
    audio.createAudioPlayer.mockImplementation((source: unknown) => {
      const p = new FakePlayer(source);
      p.play = () => {
        throw new Error("재생 실패");
      };
      players.push(p);
      return p;
    });
    await expect(enter("day")).resolves.toBeUndefined();
    await expect(tick(3000)).resolves.toBeUndefined();
    expect(playingNow()).toHaveLength(0);
  });
  it("S49 오디오 모드 설정이 거부돼도 곡은 튼다", async () => {
    audio.setAudioModeAsync.mockRejectedValue(new Error("모드 실패"));
    await enter("day");
    await tick(100);
    expect(aliveNames()).toEqual(["A"]);
  });
  it("S50 저장소 읽기가 실패하면 A로 시작한다", async () => {
    mockStorage.getItem.mockRejectedValue(new Error("읽기 실패"));
    await enter("day");
    expect(aliveNames()).toEqual(["A"]);
  });
  it("S50 저장소 쓰기가 실패해도 앱은 정상이다", async () => {
    mockStorage.setItem.mockRejectedValue(new Error("쓰기 실패"));
    await enter("day");
    await tick(100);
    expect(aliveNames()).toEqual(["A"]);
    expect(playingNow()).toHaveLength(1);
  });
});
