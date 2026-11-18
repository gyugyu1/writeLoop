import { AppState, type AppStateStatus } from "react-native";
import type { DayPhase } from "@/lib/lobby3d/daylight";

// 마을 배경음악을 관리하는 곳(하나). 홈 화면(초점), 로비 화면(구역·하루의 때), 영작 화면(열림), 앱 상태가 이곳에 알린다.
// - 낮(day·sunset)에는 포근한 곡과 명랑한 곡을 한 곡이 끝날 때마다 번갈아 틀고, 밤(dusk·night·dawn)에는 밤 곡을 되풀이한다.
//   마지막으로 들은 낮 곡을 기기에 저장해, 마을에 다시 들어오면 그 다음 곡부터 튼다.
// - 마을에 머무는 중 낮↔밤이 바뀌면 약 1.5초 동안 두 곡을 겹쳐 바꾼다(이때만 플레이어가 둘이다).
// - 마을에서 연 영작 화면에서는 재생 위치를 지키고 볼륨을 평소의 40%로 낮춘다. 홈(마을)으로 돌아오면 되돌린다.
// - 마을과 이어진 화면(마을, 홈 안의 시트, 마을에서 연 영작 화면)을 벗어나면 정리하고, 백그라운드에서는 일시정지한다.
// 재생 모듈(expo-audio)은 처음 틀 때 불러온다. 불러오거나 틀지 못하면 소리만 없다.

export type VillageBgmGroup = "day" | "night";
type TrackId = "dayCozy" | "dayCheerful" | "night";

/** 낮 두 곡의 차례(포근한 곡이 먼저). */
const DAY_TRACKS: readonly TrackId[] = ["dayCozy", "dayCheerful"];
/** 낮↔밤을 겹쳐 바꾸는 시간(ms). */
export const VILLAGE_BGM_CROSSFADE_MS = 1500;
/** 영작 화면에서 볼륨을 낮추고 되돌리는 시간(ms). */
export const VILLAGE_BGM_DUCK_MS = 600;
/** 영작 화면에서의 볼륨(평소의 비율). */
export const VILLAGE_BGM_DUCK_RATIO = 0.4;
/** 평소 볼륨(앱에 음량 설정이 없어 플레이어 최대로 두고 기기 음량을 따른다). */
const FULL_VOLUME = 1;
/** 마을도 영작 화면도 아니게 된 뒤 정리하기까지 기다리는 시간(ms). 화면을 넘길 때 초점이 잠깐 비는 사이에 끊지 않으려고. */
const LEAVE_GRACE_MS = 400;
/** 볼륨을 바꿀 때 한 걸음 간격(ms). */
const RAMP_STEP_MS = 50;
/** 마지막으로 들은 낮 곡을 저장하는 열쇠. */
export const VILLAGE_BGM_LAST_DAY_KEY = "writeloop.villageBgm.lastDayTrack";

/** 하루의 때를 배경음악 묶음으로: day·sunset은 낮, dusk·night·dawn은 밤. */
export function villageBgmGroupOf(phase: DayPhase): VillageBgmGroup {
  return phase === "day" || phase === "sunset" ? "day" : "night";
}

type AudioModule = typeof import("expo-audio");
type Player = import("expo-audio").AudioPlayer;

let audio: AudioModule | null | undefined;
function audioModule(): AudioModule | null {
  if (audio !== undefined) return audio;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    audio = require("expo-audio") as AudioModule;
  } catch (error) {
    console.warn("[bgm] 재생 모듈을 불러오지 못했습니다", error);
    audio = null;
  }
  return audio;
}

type Storage = typeof import("@react-native-async-storage/async-storage").default;

/** 기기 저장소(마지막 낮 곡). 처음 쓸 때 불러오고, 못 불러오면 저장하지 않는다(처음 쓰는 기기처럼 포근한 곡부터). */
function storage(): Storage | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require("@react-native-async-storage/async-storage") as { default: Storage }).default;
  } catch (error) {
    console.warn("[bgm] 기기 저장소를 불러오지 못했습니다", error);
    return null;
  }
}

function trackSource(id: TrackId): number {
  if (id === "dayCozy") return require("../../../assets/audio/village_day.m4a") as number;
  if (id === "dayCheerful") return require("../../../assets/audio/village_day_cheerful.m4a") as number;
  return require("../../../assets/audio/village_night.m4a") as number;
}

interface Playing {
  player: Player;
  group: VillageBgmGroup;
  track: TrackId;
  /** 지금 볼륨(바꾸는 중이면 바뀌고 있는 값). */
  volume: number;
  ramp: ReturnType<typeof setInterval> | null;
  finished: { remove(): void } | null;
}

const state = {
  homeFocused: false,
  villageArea: false,
  phase: null as DayPhase | null,
  writing: 0,
  appActive: AppState.currentState !== "background",
  /** 마을에서 시작해 이어지는 중인지(영작 화면은 이때만 낮춰 이어 간다). */
  linked: false,
  /** 백그라운드에서 막 돌아왔는지(이때 묶음이 바뀌었으면 겹치지 않고 바로 바꾼다). */
  resumed: false
};
let current: Playing | null = null;
let fading: Playing | null = null;
let leaveTimer: ReturnType<typeof setTimeout> | null = null;
/** 시작할 때마다 늘린다. 준비를 기다린 시작이 끝났을 때 번호가 다르면 그 사이 다른 일이 있었던 것이라 버린다. */
let startToken = 0;
let lastDay: TrackId | null = null;
let prepared: Promise<void> | null = null;
let appStateSubscription: { remove(): void } | null = null;

function prepare(): Promise<void> {
  prepared ??= (async () => {
    try {
      const saved = (await storage()?.getItem(VILLAGE_BGM_LAST_DAY_KEY)) ?? null;
      if (saved === "dayCozy" || saved === "dayCheerful") lastDay = saved;
    } catch (error) {
      console.warn("[bgm] 마지막 낮 곡을 읽지 못했습니다", error);
    }
    const module = audioModule();
    if (!module) return;
    try {
      // 무음 스위치를 켜면 소리를 내지 않고, 다른 앱의 소리는 끊지 않고 섞는다. 백그라운드에서는 틀지 않는다
      await module.setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers", shouldPlayInBackground: false });
    } catch (error) {
      console.warn("[bgm] 오디오 모드를 정하지 못했습니다", error);
    }
  })();
  return prepared;
}

function watchAppState() {
  if (appStateSubscription) return;
  appStateSubscription = AppState.addEventListener("change", (next: AppStateStatus) => {
    const active = next !== "background";
    if (active === state.appActive) return;
    state.appActive = active;
    if (active) state.resumed = true;
    evaluate();
  });
}

function stopRamp(item: Playing) {
  if (item.ramp) clearInterval(item.ramp);
  item.ramp = null;
}

function setVolume(item: Playing, volume: number) {
  item.volume = volume;
  try {
    item.player.volume = volume;
  } catch (error) {
    console.warn("[bgm] 볼륨을 바꾸지 못했습니다", error);
  }
}

/** item의 볼륨을 ms 동안 to로 바꾼다(0이면 바로). 다 바꾸면 done. */
function rampTo(item: Playing, to: number, ms: number, done?: () => void) {
  stopRamp(item);
  if (ms <= 0 || Math.abs(item.volume - to) < 1e-3) {
    setVolume(item, to);
    done?.();
    return;
  }
  const from = item.volume;
  const steps = Math.max(1, Math.round(ms / RAMP_STEP_MS));
  let step = 0;
  item.ramp = setInterval(() => {
    step += 1;
    setVolume(item, from + ((to - from) * step) / steps);
    if (step >= steps) {
      stopRamp(item);
      done?.();
    }
  }, RAMP_STEP_MS);
}

function release(item: Playing | null) {
  if (!item) return;
  stopRamp(item);
  item.finished?.remove();
  item.finished = null;
  try {
    item.player.pause();
  } catch {
    // 이미 놓은 플레이어
  }
  try {
    item.player.remove();
  } catch (error) {
    console.warn("[bgm] 플레이어를 놓지 못했습니다", error);
  }
}

function nextDayTrack(): TrackId {
  if (lastDay === null) return DAY_TRACKS[0];
  return DAY_TRACKS[(DAY_TRACKS.indexOf(lastDay) + 1) % DAY_TRACKS.length];
}

function rememberDay(track: TrackId) {
  lastDay = track;
  Promise.resolve()
    .then(() => storage()?.setItem(VILLAGE_BGM_LAST_DAY_KEY, track))
    .catch((error: unknown) => console.warn("[bgm] 마지막 낮 곡을 저장하지 못했습니다", error));
}

/** 곡 하나를 새 플레이어로 처음부터 튼다(볼륨 volume). 낮 곡은 끝나면 다음 낮 곡으로 넘어간다. */
function startTrack(group: VillageBgmGroup, track: TrackId, volume: number): Playing | null {
  const module = audioModule();
  if (!module) return null;
  let player: Player;
  try {
    player = module.createAudioPlayer(trackSource(track));
  } catch (error) {
    console.warn("[bgm] 플레이어를 만들지 못했습니다", error);
    return null;
  }
  const item: Playing = { player, group, track, volume, ramp: null, finished: null };
  try {
    player.loop = group === "night";
    player.volume = volume;
    player.play();
  } catch (error) {
    console.warn("[bgm] 곡을 틀지 못했습니다", error);
    release(item);
    return null;
  }
  if (group === "day") {
    rememberDay(track);
    // 재생 상태 알림(곡 끝은 didJustFinish). 이 판의 형 정의에서 SharedObject의 addListener가 보이지 않아 모양만 적어 부른다
    const events = player as unknown as { addListener(event: "playbackStatusUpdate", listener: (status: { didJustFinish: boolean }) => void): { remove(): void } };
    item.finished = events.addListener("playbackStatusUpdate", (status) => {
      if (!status.didJustFinish || current !== item) return;
      // 낮 곡이 끝나면 다른 낮 곡을 처음부터 튼다(볼륨은 지금 그대로)
      const next = nextDayTrack();
      const followed = startTrack("day", next, item.volume);
      release(item);
      current = followed;
    });
  }
  return item;
}

function targetVolume(): number {
  const inVillage = state.homeFocused && state.villageArea;
  return inVillage ? FULL_VOLUME : FULL_VOLUME * VILLAGE_BGM_DUCK_RATIO;
}

function trackFor(group: VillageBgmGroup): TrackId {
  return group === "day" ? nextDayTrack() : "night";
}

function stopAll() {
  startToken += 1;
  release(fading);
  fading = null;
  release(current);
  current = null;
  state.linked = false;
  // 정리했으면 '백그라운드에서 막 돌아옴'도 지운다(다음 시작은 어차피 겹치지 않는다)
  state.resumed = false;
}

function pauseAll() {
  // 겹쳐 바꾸던 중이면 나가는 곡은 놓는다(돌아오면 하나만 남게)
  release(fading);
  fading = null;
  if (!current) return;
  stopRamp(current);
  setVolume(current, targetVolume());
  try {
    current.player.pause();
  } catch (error) {
    console.warn("[bgm] 일시정지하지 못했습니다", error);
  }
}

/** 마을에 있거나 마을에서 연 영작 화면에 있으면 그때 묶음의 곡을 튼다. */
async function play() {
  const group = villageBgmGroupOf(state.phase ?? "day");
  const volume = targetVolume();
  const resumed = state.resumed;
  state.resumed = false;
  if (current && current.group === group) {
    rampTo(current, volume, VILLAGE_BGM_DUCK_MS);
    try {
      if (!current.player.playing) current.player.play();
    } catch (error) {
      console.warn("[bgm] 다시 틀지 못했습니다", error);
    }
    if (fading) rampTo(fading, 0, VILLAGE_BGM_CROSSFADE_MS, () => {
      release(fading);
      fading = null;
    });
    return;
  }
  const token = ++startToken;
  await prepare();
  // 준비를 기다리는 사이 정리·다른 시작이 있었으면 이 시작은 버린다
  if (token !== startToken || !shouldPlay()) return;
  const stillGroup = villageBgmGroupOf(state.phase ?? "day");
  if (current && current.group === stillGroup) return;
  if (!current || resumed) {
    // 처음 시작이거나, 백그라운드에서 돌아왔는데 묶음이 바뀌었으면 겹치지 않고 바로 바꾼다
    release(fading);
    fading = null;
    release(current);
    current = startTrack(stillGroup, trackFor(stillGroup), targetVolume());
    return;
  }
  // 마을에 머무는 중 낮↔밤이 바뀌면 겹쳐 바꾼다. 이미 겹치는 중이었으면 더 먼저 나가던 곡은 바로 놓는다(둘을 넘지 않게)
  release(fading);
  fading = current;
  const leaving = fading;
  rampTo(leaving, 0, VILLAGE_BGM_CROSSFADE_MS, () => {
    if (fading === leaving) fading = null;
    release(leaving);
  });
  const entering = startTrack(stillGroup, trackFor(stillGroup), 0);
  current = entering;
  if (entering) rampTo(entering, targetVolume(), VILLAGE_BGM_CROSSFADE_MS);
}

function shouldPlay(): boolean {
  const inVillage = state.homeFocused && state.villageArea;
  return state.appActive && state.linked && (inVillage || state.writing > 0);
}

function evaluate() {
  watchAppState();
  const inVillage = state.homeFocused && state.villageArea;
  if (inVillage) state.linked = true;
  if (!inVillage && state.writing === 0) {
    // 마을도 영작 화면도 아니다: 화면을 넘기는 사이일 수 있어 잠깐 기다렸다가 정리한다
    if (!leaveTimer && (current || fading || state.linked)) {
      leaveTimer = setTimeout(() => {
        leaveTimer = null;
        if (!(state.homeFocused && state.villageArea) && state.writing === 0) stopAll();
      }, LEAVE_GRACE_MS);
    }
    return;
  }
  if (leaveTimer) {
    clearTimeout(leaveTimer);
    leaveTimer = null;
  }
  // 마을이 아닌 곳에서 연 영작 화면은 틀지 않는다
  if (!state.linked) return;
  if (!state.appActive) {
    pauseAll();
    return;
  }
  void play();
}

/** 홈 화면의 초점(다른 화면으로 넘어가면 거짓). 홈 안의 시트는 초점을 바꾸지 않는다. */
export function setVillageBgmHomeFocused(focused: boolean): void {
  if (state.homeFocused === focused) return;
  state.homeFocused = focused;
  evaluate();
}

/** 로비 화면의 구역(마을인지)과 하루의 때. 같은 값이 다시 와도 곡은 그대로다. */
export function setVillageBgmArea(inVillage: boolean, phase: DayPhase): void {
  if (state.villageArea === inVillage && state.phase === phase) return;
  state.villageArea = inVillage;
  state.phase = phase;
  evaluate();
}

/** 영작 화면이 초점을 얻으면 true, 잃으면 false. 화면마다 짝을 맞춰 부른다. */
export function setVillageBgmWriting(open: boolean): void {
  state.writing = Math.max(0, state.writing + (open ? 1 : -1));
  evaluate();
}

/** 테스트용: 모든 상태와 플레이어를 처음으로 되돌린다. */
export function resetVillageBgmForTest(): void {
  stopAll();
  if (leaveTimer) clearTimeout(leaveTimer);
  leaveTimer = null;
  appStateSubscription?.remove();
  appStateSubscription = null;
  Object.assign(state, { homeFocused: false, villageArea: false, phase: null, writing: 0, appActive: AppState.currentState !== "background", linked: false, resumed: false });
  lastDay = null;
  prepared = null;
  audio = undefined;
}
