import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Lobby3dCanvas, { type LobbyPointerPhase, type LobbyProjection, type ToonSettings } from "@/components/lobby3d/lobby3d-canvas";
import SimpleSlider from "@/components/lobby3d/simple-slider";
import {
  IDLE_LINE,
  LobbySim,
  MARKS,
  MENU_FOR_MARK,
  VIEW_WIDTH_DEFAULT,
  VIEW_WIDTH_MAX,
  VIEW_WIDTH_MIN,
  clampViewWidth,
  type ActionType,
  type MarkId,
  type PointerHit
} from "@/lib/lobby3d/engine";
import { loadLobbyViewWidth, resetLobbyViewWidth, saveLobbyViewWidth } from "@/lib/lobby3d/view-storage";

// 3D 로비(라이트루프의 방). 3D 그리기(Lobby3dCanvas) 위에 말풍선·이름표·메뉴·설정을 겹친다.
// 홈은 시험판 없이 쓰고(devPanel=false), 개발 진입 화면(/dev/lobby-3d)은 시험판을 켠 기본값 그대로 쓴다.

const ACCENT = "#E36A00";
const LINE = "#3D1B0F";
const TOAST_MS = 1800;

export const ACTION_LABELS: Record<ActionType, string> = {
  wave: "손 흔들기",
  jump: "신나게 점프",
  hop: "깡충깡충",
  point: "가리키기",
  spin: "한 바퀴",
  look: "두리번",
  poke: "눌렀을 때 반응"
};
const TEST_ACTIONS: ActionType[] = ["wave", "jump", "hop", "point", "spin", "look"];

export type LobbyMenuId = "question" | "diary" | "thought";

const MENU = [
  { id: "question", label: "질문에 답하기", primary: true },
  { id: "diary", label: "영어일기", primary: false },
  { id: "thought", label: "지금 생각나는대로", primary: false }
] as const;

interface ViewState {
  bubbleText: string;
  bubbleButton: string | null;
  arrived: MarkId | null;
  actionType: ActionType | null;
}

/** 홈의 카툰 명암(3단)과 외곽선(1배). 시험판에서만 바꿀 수 있다. */
const HOME_TOON: ToonSettings = { steps: 3, outline: 1 };

const EMPTY_HIT: PointerHit = { point: null, mark: null, onCharacter: false };

function sameView(a: ViewState, b: ViewState) {
  return a.bubbleText === b.bubbleText && a.bubbleButton === b.bubbleButton && a.arrived === b.arrived && a.actionType === b.actionType;
}

export interface Lobby3dScreenProps {
  /** 시험판(동작 버튼·속도·명암·외곽선 조절). 기본은 켬(개발 화면). */
  devPanel?: boolean;
  /** 초당 프레임·동작 표시. 기본은 시험판과 같다(홈은 개발 빌드에서만 켠다). */
  showFps?: boolean;
  /** 머리 줄 왼쪽 칩 글. 기본은 시험판의 고정 글. */
  streakLabel?: string;
  onStreakPress?: () => void;
  /** 아래 메뉴를 눌렀을 때. 없으면 시험판처럼 짧은 안내만 띄운다. */
  onMenu?: (id: LobbyMenuId) => void;
  /** 장소에 도착해 말풍선 버튼을 눌렀을 때. true를 돌려주면 처리한 것이고, 아니면 장소 안내(enterMessage)를 띄운다. */
  onEnterMark?: (mark: MarkId) => boolean;
  /** 기본 말풍선에 붙일 버튼(예: 이어 쓰기). */
  idleButton?: { label: string; onPress: () => void } | null;
  /** 시트를 연 동안처럼 로비 누르기를 막을 때. */
  inputBlocked?: boolean;
  /** 장소 이름표·말풍선의 화면 좌표(로비 안내가 장소를 짚을 때 쓴다). */
  onProjection?: (projection: LobbyProjection) => void;
  /** 아래 여백. 기본은 기기 아래 안전 영역(홈은 내비게이션 바가 맡아 0). */
  bottomInset?: number;
  /** 다른 화면 아래에 깔려 있는 동안 3D 그리기를 멈춘다(그 화면이 무거워지지 않게). */
  paused?: boolean;
}

export default function Lobby3dScreen({
  devPanel = true,
  showFps = devPanel,
  streakLabel = "연속 1일",
  onStreakPress,
  onMenu,
  onEnterMark,
  idleButton = null,
  inputBlocked = false,
  onProjection,
  bottomInset,
  paused = false
}: Lobby3dScreenProps = {}) {
  const insets = useSafeAreaInsets();
  const bottomPad = bottomInset ?? insets.bottom;
  const inputBlockedRef = useRef(inputBlocked);
  inputBlockedRef.current = inputBlocked;
  const { width: screenWidth } = useWindowDimensions();
  const simRef = useRef<LobbySim | null>(null);
  if (!simRef.current) simRef.current = new LobbySim();
  const sim = simRef.current;

  const [view, setView] = useState<ViewState>({ bubbleText: IDLE_LINE, bubbleButton: null, arrived: null, actionType: null });
  const [projection, setProjection] = useState<LobbyProjection | null>(null);
  const [viewWidth, setViewWidth] = useState(VIEW_WIDTH_DEFAULT);
  const [toon, setToon] = useState<ToonSettings>(HOME_TOON);
  const [speed, setSpeed] = useState(sim.settings.speed);
  const [turn, setTurn] = useState(sim.settings.turn);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // 말풍선 높이(재어 본 값). 꼬리 끝이 머리 위 점에 오도록 이만큼 올린다.
  const [bubbleHeight, setBubbleHeight] = useState(60);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncView = useCallback(() => {
    const snap = sim.snapshot(Date.now());
    const next: ViewState = {
      bubbleText: snap.bubbleText,
      bubbleButton: snap.bubbleButton,
      arrived: snap.moving ? null : snap.arrived,
      actionType: snap.action?.type ?? null
    };
    setView((prev) => (sameView(prev, next) ? prev : next));
  }, [sim]);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  // 화면에 들어오면 손을 한 번 흔든다. "동작 줄이기"는 큰 동작만 막는다.
  useEffect(() => {
    let alive = true;
    sim.startAction("wave");
    syncView();
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (alive) sim.reduceMotion = enabled;
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      sim.reduceMotion = enabled;
    });
    return () => {
      alive = false;
      subscription?.remove();
    };
  }, [sim, syncView]);

  useEffect(() => {
    let alive = true;
    void loadLobbyViewWidth().then((value) => {
      if (alive) setViewWidth(value);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    sim.settings = { speed, turn };
  }, [sim, speed, turn]);

  const onFrame = useCallback(
    (dt: number, nowMs: number) => {
      sim.update(dt, nowMs);
      syncView();
    },
    [sim, syncView]
  );

  const onPointer = useCallback(
    (phase: LobbyPointerPhase, hit: PointerHit | null, x: number, y: number) => {
      // 시트를 연 동안에는 로비를 누르지 못한다. 막는 중에 누른 것이 남지 않게 지금 누르기도 거둔다.
      if (inputBlockedRef.current) {
        if (phase !== "move") sim.pointerCancel();
        return;
      }
      const now = Date.now();
      if (phase === "down") {
        setCameraOpen(false);
        sim.pointerDown(hit ?? EMPTY_HIT, x, y, now);
      } else if (phase === "move") sim.pointerMove(hit ?? EMPTY_HIT, x, y);
      else if (phase === "up") sim.pointerUp(now);
      else sim.pointerCancel();
      syncView();
    },
    [sim, syncView]
  );

  const changeViewWidth = (value: number) => {
    const next = clampViewWidth(value);
    setViewWidth(next);
    void saveLobbyViewWidth(next);
  };
  // 슬라이더는 왼쪽이 멀리(넓게 보임), 오른쪽이 가까이다.
  const closeness = VIEW_WIDTH_MAX + VIEW_WIDTH_MIN - viewWidth;
  const closenessPercent = Math.round(((closeness - VIEW_WIDTH_MIN) / (VIEW_WIDTH_MAX - VIEW_WIDTH_MIN)) * 100);
  const litMenu = view.arrived ? MENU_FOR_MARK[view.arrived] ?? null : null;
  const bubblePos = projection?.bubble ?? { x: 195, y: 320 };
  const handleProjection = useCallback(
    (next: LobbyProjection) => {
      setProjection(next);
      onProjection?.(next);
    },
    [onProjection]
  );
  const shownToon = devPanel ? toon : HOME_TOON;
  const showIdleButton = Boolean(idleButton) && !view.bubbleButton && view.bubbleText === IDLE_LINE;

  return (
    <View style={styles.root}>
      <Lobby3dCanvas
        sim={sim}
        viewWidth={viewWidth}
        toon={shownToon}
        onFrame={onFrame}
        onPointer={onPointer}
        onProject={handleProjection}
        paused={paused}
      />

      {(Object.keys(MARKS) as MarkId[]).map((id) => {
        const pos = projection?.labels[id] ?? { x: 0, y: 0 };
        return (
          <View key={id} pointerEvents="none" style={[styles.label, { left: pos.x, top: pos.y }]}>
            <Text style={styles.labelText}>{MARKS[id].label}</Text>
          </View>
        );
      })}

      {view.bubbleText ? (
        <View
          pointerEvents="box-none"
          onLayout={(e) => {
            const h = Math.round(e.nativeEvent.layout.height);
            if (h > 0 && h !== bubbleHeight) setBubbleHeight(h);
          }}
          style={[
            styles.bubbleWrap,
            {
              left: Math.max(8, Math.min(bubblePos.x - BUBBLE_WIDTH / 2, screenWidth - BUBBLE_WIDTH - 8)),
              top: Math.max(120, bubblePos.y),
              transform: [{ translateY: -bubbleHeight - 12 }]
            }
          ]}
        >
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>{view.bubbleText}</Text>
            {view.bubbleButton ? (
              <Pressable
                accessibilityRole="button"
                style={styles.bubbleButton}
                onPress={() => {
                  const arrived = sim.arrived;
                  if (arrived && onEnterMark?.(arrived)) return;
                  const message = sim.enterMessage();
                  if (message) showToast(message);
                }}
              >
                <Text style={styles.bubbleButtonText}>{view.bubbleButton}</Text>
              </Pressable>
            ) : null}
            {showIdleButton && idleButton ? (
              <Pressable accessibilityRole="button" style={styles.bubbleButton} onPress={idleButton.onPress}>
                <Text style={styles.bubbleButtonText}>{idleButton.label}</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.bubbleTail} />
        </View>
      ) : null}

      <View pointerEvents="box-none" style={[styles.header, { top: insets.top + 10 }]}>
        {onStreakPress ? (
          <Pressable accessibilityRole="button" style={styles.chip} onPress={onStreakPress}>
            <Text style={styles.chipText}>{streakLabel}</Text>
          </Pressable>
        ) : (
          <View style={styles.chip}>
            <Text style={styles.chipText}>{streakLabel}</Text>
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="카메라 거리 설정"
          accessibilityState={{ expanded: cameraOpen }}
          style={styles.iconButton}
          onPress={() => setCameraOpen((open) => !open)}
        >
          <Text style={styles.iconText}>⌕</Text>
        </Pressable>
      </View>

      {cameraOpen ? (
        <View accessibilityLabel="카메라 거리" style={[styles.popover, { top: insets.top + 62 }]}>
          <View style={styles.rowBetween}>
            <Text style={styles.popTitle}>카메라 거리</Text>
            <Text style={styles.popValue}>{closenessPercent}%</Text>
          </View>
          <SimpleSlider
            testID="lobby3d-zoom-slider"
            label="카메라 거리"
            value={closeness}
            min={VIEW_WIDTH_MIN}
            max={VIEW_WIDTH_MAX}
            step={0.1}
            valueText={`${closenessPercent}%`}
            onChange={(value) => changeViewWidth(VIEW_WIDTH_MAX + VIEW_WIDTH_MIN - value)}
          />
          <View style={styles.rowBetween}>
            <Text style={styles.smallMuted}>멀리</Text>
            <Text style={styles.smallMuted}>가까이</Text>
          </View>
          <View style={styles.row}>
            <Pressable
              accessibilityRole="button"
              style={[styles.popButton, styles.popGhost]}
              onPress={() => {
                setViewWidth(VIEW_WIDTH_DEFAULT);
                void resetLobbyViewWidth();
              }}
            >
              <Text style={styles.popGhostText}>기본값</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={[styles.popButton, styles.popSolid]} onPress={() => setCameraOpen(false)}>
              <Text style={styles.popSolidText}>닫기</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {showFps ? (
        <View pointerEvents="none" style={[styles.fps, { top: insets.top + 60 }]}>
          <Text style={styles.fpsText}>FPS {projection?.fps ?? "-"}</Text>
          <Text style={styles.fpsText}>동작: {view.actionType ? ACTION_LABELS[view.actionType] : "없음"}</Text>
        </View>
      ) : null}

      {toast ? (
        <View accessibilityRole="alert" pointerEvents="none" style={[styles.toast, { top: insets.top + 62 }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      <View pointerEvents="box-none" style={[styles.bottom, { bottom: bottomPad + 12 }]}>
        {devPanel && panelOpen ? (
          <View style={styles.panel}>
            <View style={styles.actionGrid}>
              {TEST_ACTIONS.map((type) => (
                <Pressable
                  key={type}
                  accessibilityRole="button"
                  style={styles.actionButton}
                  onPress={() => {
                    sim.playAction(type);
                    syncView();
                  }}
                >
                  <Text style={styles.actionText}>{ACTION_LABELS[type]}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.panelLabel}>걷는 속도 {speed.toFixed(1)}</Text>
            <SimpleSlider label="걷는 속도" value={speed} min={1.4} max={4} step={0.1} onChange={setSpeed} valueText={speed.toFixed(1)} />
            <Text style={styles.panelLabel}>돌아서는 빠르기 {turn.toFixed(1)}</Text>
            <SimpleSlider label="돌아서는 빠르기" value={turn} min={3} max={20} step={0.5} onChange={setTurn} valueText={turn.toFixed(1)} />
            <Text style={styles.panelLabel}>명암 단계</Text>
            <View style={styles.row}>
              {([2, 3] as const).map((steps) => (
                <Pressable
                  key={steps}
                  accessibilityRole="button"
                  accessibilityState={{ selected: toon.steps === steps }}
                  style={[styles.stepButton, toon.steps === steps && styles.stepButtonOn]}
                  onPress={() => setToon((t) => ({ ...t, steps }))}
                >
                  <Text style={[styles.stepText, toon.steps === steps && styles.stepTextOn]}>{steps}단</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.panelLabel}>외곽선 굵기 {toon.outline.toFixed(1)}배</Text>
            <SimpleSlider
              label="외곽선 굵기"
              value={toon.outline}
              min={0.5}
              max={2.5}
              step={0.1}
              onChange={(outline) => setToon((t) => ({ ...t, outline }))}
              valueText={`${toon.outline.toFixed(1)}배`}
            />
          </View>
        ) : null}
        {devPanel ? (
          <Pressable accessibilityRole="button" style={styles.panelToggle} onPress={() => setPanelOpen((open) => !open)}>
            <Text style={styles.panelToggleText}>{panelOpen ? "시험판 접기" : "시험판 펴기"}</Text>
          </Pressable>
        ) : null}
        <View style={styles.menu}>
          {MENU.map((item) => {
            const lit = litMenu === item.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: lit }}
                style={[styles.menuButton, item.primary && styles.menuPrimary, lit && styles.menuLit]}
                onPress={() => (onMenu ? onMenu(item.id) : showToast(`${item.label} 화면으로 가요`))}
              >
                <Text style={[styles.menuText, item.primary && styles.menuPrimaryText]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/** 말풍선 폭. 방 전체가 보이는 먼 카메라에서 장소를 덜 가리게 줄였다(2026-11-07). */
const BUBBLE_WIDTH = 196;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  label: {
    position: "absolute",
    transform: [{ translateX: -40 }, { translateY: -22 }],
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: LINE,
    backgroundColor: "#FFFFFF"
  },
  labelText: { fontSize: 11, fontWeight: "700", color: "#2B1810" },
  bubbleWrap: { position: "absolute", width: BUBBLE_WIDTH, alignItems: "center" },
  bubble: {
    maxWidth: BUBBLE_WIDTH,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: LINE,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    gap: 6
  },
  bubbleText: { fontSize: 13, lineHeight: 18, fontWeight: "500", color: "#2B1810", textAlign: "center" },
  bubbleButton: { minHeight: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: ACCENT, justifyContent: "center" },
  bubbleButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  bubbleTail: {
    width: 10,
    height: 10,
    marginTop: -6,
    backgroundColor: "#FFFFFF",
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: LINE,
    transform: [{ rotate: "45deg" }]
  },
  header: { position: "absolute", left: 12, right: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chip: {
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: ACCENT,
    backgroundColor: "#FFF0E0",
    justifyContent: "center"
  },
  chipText: { color: "#A64B00", fontSize: 13, fontWeight: "700" },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: LINE,
    backgroundColor: "rgba(255,255,255,0.94)",
    alignItems: "center",
    justifyContent: "center"
  },
  iconText: { fontSize: 22, color: LINE, fontWeight: "700" },
  popover: {
    position: "absolute",
    right: 12,
    width: 250,
    padding: 14,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: LINE,
    backgroundColor: "#FFFFFF",
    gap: 6
  },
  popTitle: { fontSize: 15, fontWeight: "700", color: "#2B1810" },
  popValue: { fontSize: 13, color: "#5B6472" },
  smallMuted: { fontSize: 12, color: "#5B6472" },
  row: { flexDirection: "row", gap: 8 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  popButton: { flex: 1, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  popGhost: { borderWidth: 1.5, borderColor: "#D3DAE3", backgroundColor: "#F7F9FB" },
  popGhostText: { fontSize: 14, color: "#2B1810" },
  popSolid: { backgroundColor: ACCENT },
  popSolidText: { fontSize: 14, color: "#FFFFFF", fontWeight: "700" },
  fps: {
    position: "absolute",
    left: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(43,24,16,0.7)"
  },
  fpsText: { color: "#FFFFFF", fontSize: 11, fontWeight: "600" },
  toast: {
    position: "absolute",
    alignSelf: "center",
    maxWidth: 320,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(43,24,16,0.88)"
  },
  toastText: { color: "#FFFFFF", fontSize: 14, textAlign: "center" },
  bottom: { position: "absolute", left: 12, right: 12, gap: 8 },
  panel: {
    padding: 12,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: LINE,
    backgroundColor: "rgba(255,255,255,0.96)",
    gap: 2
  },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  actionButton: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#D3C2B1",
    backgroundColor: "#FFF6E6",
    justifyContent: "center"
  },
  actionText: { fontSize: 13, color: "#2B1810" },
  panelLabel: { fontSize: 12.5, color: "#4A5260", marginTop: 4 },
  stepButton: {
    minHeight: 36,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#D3DAE3",
    justifyContent: "center"
  },
  stepButtonOn: { borderColor: ACCENT, backgroundColor: "#FFF0E0" },
  stepText: { fontSize: 13, color: "#2B1810" },
  stepTextOn: { fontWeight: "700", color: "#A64B00" },
  panelToggle: {
    alignSelf: "flex-start",
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: "rgba(43,24,16,0.75)",
    justifyContent: "center"
  },
  panelToggleText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  menu: { flexDirection: "row", gap: 8 },
  menuButton: {
    flex: 1,
    height: 72,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: LINE,
    backgroundColor: "rgba(255,255,255,0.95)",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  menuPrimary: { flex: 1.3, backgroundColor: ACCENT },
  menuLit: { borderColor: "#FFC23D", borderWidth: 4 },
  menuText: { fontSize: 15, fontWeight: "700", color: "#2B1810" },
  menuPrimaryText: { color: "#FFFFFF" }
});
