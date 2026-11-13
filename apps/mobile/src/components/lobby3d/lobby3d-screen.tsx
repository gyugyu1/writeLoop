import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Animated, BackHandler, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Lobby3dCanvas, {
  type LobbyCanvasEdit,
  type LobbyPointerPhase,
  type LobbyProjection,
  type ToonSettings
} from "@/components/lobby3d/lobby3d-canvas";
import SimpleSlider from "@/components/lobby3d/simple-slider";
import {
  LobbySim,
  MARKS,
  MENU_FOR_MARK,
  ROOM_MARK_IDS,
  VILLAGE_MARK_IDS,
  applyArea,
  markInfo,
  VIEW_WIDTH_DEFAULT,
  VIEW_WIDTH_MAX,
  VIEW_WIDTH_MIN,
  activeLobbyLayout,
  applyLobbyLayout,
  clampViewWidth,
  roomFitViewWidth,
  type ActionType,
  type LobbySnapshot,
  type LobbyArea,
  type MarkId,
  type PlaceId,
  type PointerHit
} from "@/lib/lobby3d/engine";
import { VILLAGE_START } from "@/lib/lobby3d/village";
import { daylightAt } from "@/lib/lobby3d/daylight";
import { LobbyEditor } from "@/lib/lobby3d/lobby-edit";
import { furnitureType } from "@/lib/lobby3d/furniture-catalog";
import { furnitureIcon } from "@/lib/lobby3d/furniture-icons";
import { sameLobbyLayout, storedItems, type LobbyLayout, type StoredItem } from "@/lib/lobby3d/lobby-layout";
import { useLobbyClock, type ClockOverride } from "@/lib/lobby3d/use-lobby-clock";
import { loadLobbyViewWidth, resetLobbyViewWidth, saveLobbyViewWidth } from "@/lib/lobby3d/view-storage";

// 3D 로비(라이트루프의 방). 3D 그리기(Lobby3dCanvas) 위에 말풍선·이름표·메뉴·설정을 겹친다.
// 홈은 시험판 없이 쓰고(devPanel=false), 개발 진입 화면(/dev/lobby-3d)은 시험판을 켠 기본값 그대로 쓴다.

const ACCENT = "#E36A00";
const LINE = "#3D1B0F";
const TOAST_MS = 1800;
/** 꾸미기 '완료' 뒤 로딩 표시를 늦어도 이만큼 뒤에는 내린다. */
const RETURN_SETTLE_LIMIT_MS = 1500;

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
/** 방·마을의 장소 모두(이름표·말풍선 자리를 미리 만들어 둔다). */
const ALL_PLACE_IDS: readonly PlaceId[] = [...ROOM_MARK_IDS, ...VILLAGE_MARK_IDS];
/** 방↔마을 전환: 검게 어두워지는 시간과 밝아지는 시간(밀리초). */
const TRAVEL_FADE_MS = 300;
const VILLAGE_LOADING = "마을로 나가는 중…";
/** 마을 모델을 이만큼 넘게 기다릴 때만 "마을로 나가는 중…"을 보인다(이미 읽었으면 바로 떠서 보이지 않는다. 어두워진 뒤 0.15초라 누른 뒤 약 0.45초). */
const VILLAGE_LOADING_DELAY_MS = 150;
const VILLAGE_FAILED = "마을을 불러오지 못했어요. 잠시 뒤 다시 나가 주세요";

/** 시험판의 구역 버튼. */
const AREA_LABELS: Record<LobbyArea, string> = { room: "방", village: "마을" };

/** 그 구역의 장소들. */
function placesOf(area: LobbyArea): readonly PlaceId[] {
  return area === "village" ? VILLAGE_MARK_IDS : ROOM_MARK_IDS;
}

/** 방의 장소인지(홈이 들어가기를 맡는 장소). */
function isRoomMark(id: PlaceId): id is MarkId {
  return (ROOM_MARK_IDS as readonly PlaceId[]).includes(id);
}

/** 편집 모드('꾸미기')의 안내와 짧은 알림. */
const EDIT_GUIDE = "가구를 눌러 고르고, 끌어서 옮겨요";
const EDIT_RED_FIRST = "빨간 가구부터 옮겨 주세요";
const EDIT_RED_FINISH = "빨간 가구를 놓을 수 있는 자리로 옮기거나 돌려 주세요";
const EDIT_SAVE_FAILED = "배치를 저장하지 못했어요. 다시 눌러 주세요";
const EDIT_CANNOT_PLACE = "여기에는 놓을 수 없어요. 원래 자리로 돌려놓았어요";
const EDIT_CANNOT_MOVE_HERE = "여기에는 둘 수 없어요";
const EDIT_NO_ROOM = "놓을 자리가 없어요. 가구를 옮기거나 치운 뒤 다시 꺼내 주세요";
const STORAGE_EMPTY = "보관함이 비었어요";

/** 편집 모드에서 그릴 것과 '완료'를 누를 수 있는지, '치우기' 버튼을 띄울지, 보관함에 든 가구(치운 순서). */
interface EditView extends LobbyCanvasEdit {
  canFinish: boolean;
  storable: string | null;
  stored: StoredItem[];
}

/** 보관함 줄 머리의 돌리기·치우기 아이콘 버튼 크기. */
const TRAY_ACTION_SIZE = 44;

export type LobbyMenuId = "question" | "diary" | "thought" | "records";

const MENU = [
  { id: "question", label: "질문에 답하기", primary: true },
  { id: "diary", label: "영어일기", primary: false },
  { id: "thought", label: "지금 생각나는대로", primary: false },
  { id: "records", label: "학습 기록", primary: false }
] as const;

interface ViewState {
  bubbleText: string;
  bubbleButton: string | null;
  place: PlaceId | null;
  actionType: ActionType | null;
  idleBubble: boolean;
}

/** 홈의 카툰 명암(3단)과 외곽선(1배). 시험판에서만 바꿀 수 있다. */
const HOME_TOON: ToonSettings = { steps: 3, outline: 1 };

const EMPTY_HIT: PointerHit = { point: null, mark: null, onCharacter: false };

/** 시각(0~24시)을 "7:15"처럼 쓴다. */
function clockText(hours: number) {
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  return `${whole}:${String(minutes).padStart(2, "0")}`;
}

function sameView(a: ViewState, b: ViewState) {
  return (
    a.bubbleText === b.bubbleText &&
    a.bubbleButton === b.bubbleButton &&
    a.place === b.place &&
    a.actionType === b.actionType &&
    a.idleBubble === b.idleBubble
  );
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
  /** 로비 인사 말풍선에 붙일 버튼(예: 이어 쓰기). 인사를 거두면 보이지 않는다. */
  idleButton?: { label: string; onPress: () => void } | null;
  /** 로비에 들어올 때의 인사. key가 바뀔 때마다 라이트루프가 이 말과 동작으로 인사한다(lobby-greeting). */
  greeting?: { line: string; action: ActionType; key: number } | null;
  /** 시트를 연 동안처럼 로비 누르기를 막을 때. */
  inputBlocked?: boolean;
  /** 장소 이름표·말풍선의 화면 좌표(로비 안내가 장소를 짚을 때 쓴다). */
  onProjection?: (projection: LobbyProjection) => void;
  /** 아래 여백. 기본은 기기 아래 안전 영역(홈은 내비게이션 바가 맡아 0). */
  bottomInset?: number;
  /** 다른 화면 아래에 깔려 있는 동안 3D 그리기를 멈춘다(그 화면이 무거워지지 않게). */
  paused?: boolean;
  /** 가구 배치. 바뀌면 방에 적용하고 다시 그린다. 없으면 지금 배치(activeLobbyLayout) 그대로다(개발 화면). 편집 모드 동안은 나올 때 적용한다. */
  layout?: LobbyLayout;
  /** 처음 지을 배치가 정해졌는지(홈이 기억해 둔 배치를 읽는 동안 false). false인 동안은 3D 방을 짓지 않고 기다린다. 없으면 true다. */
  layoutReady?: boolean;
  /** 편집 모드('꾸미기')의 저장. 있으면 머리 줄에 '꾸미기' 버튼이 보인다. 저장한 배치를 돌려주고, 실패하면 던진다. */
  onSaveLayout?: (layout: LobbyLayout) => Promise<LobbyLayout>;
  /** 편집 모드에 들어가고 나올 때(홈이 아래 탭바를 숨긴다). */
  onEditingChange?: (editing: boolean) => void;
  /** 라룹 홈쇼핑을 연다. 있고 꾸미기를 쓸 수 있으면 머리 줄 '꾸미기' 옆에 '홈쇼핑' 버튼이 보인다. */
  onOpenShop?: () => void;
  /** 룹 잔액. 숫자면 '홈쇼핑' 옆에 "N룹" 칩이 보인다(누르면 홈쇼핑). null이면 칩을 숨긴다(불러오는 중·실패). */
  shopBalance?: number | null;
  /**
   * 홈쇼핑 '바로 놓기': key가 바뀌면 꾸미기를 열고 그 가구(보관함의 itemId)를 꺼낸 채로 시작한다.
   * 홈이 주문 뒤 배치(layout)를 먼저 넘긴 다음 렌더에서 함께 바꾼다.
   */
  placeRequest?: { key: number; itemId: string; type: string } | null;
}

/** 꾸미기 보관함 줄의 가구 한 칸: 가구 모양 그림(없으면 이름 첫 글자)과 이름. 보관함은 가구 하나마다 한 칸이다. */
function FurnitureTile({ type, label, onPress }: { type: string; label?: string; onPress: () => void }) {
  const { name } = furnitureType(type);
  const icon = furnitureIcon(type);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label ?? name} style={styles.tile} onPress={onPress}>
      <View style={styles.tileBox}>
        {icon ? <Image source={icon} style={styles.tileImage} resizeMode="contain" /> : <Text style={styles.tileInitial}>{name.slice(0, 1)}</Text>}
      </View>
      <Text style={styles.tileName} numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
}

export default function Lobby3dScreen({
  devPanel = true,
  showFps = devPanel,
  streakLabel = "연속 1일",
  onStreakPress,
  onMenu,
  onEnterMark,
  idleButton = null,
  greeting = null,
  inputBlocked = false,
  onProjection,
  bottomInset,
  paused = false,
  layout,
  layoutReady = true,
  onSaveLayout,
  onEditingChange,
  onOpenShop,
  shopBalance = null,
  placeRequest = null
}: Lobby3dScreenProps = {}) {
  const insets = useSafeAreaInsets();
  const bottomPad = bottomInset ?? insets.bottom;
  const inputBlockedRef = useRef(inputBlocked);
  inputBlockedRef.current = inputBlocked;
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const simRef = useRef<LobbySim | null>(null);
  if (!simRef.current) {
    // 로비는 늘 방에서 시작한다(앞 로비가 마을에 있다 사라졌어도)
    applyArea("room");
    simRef.current = new LobbySim();
  }
  const sim = simRef.current;
  // 지금 구역(방·마을). 방의 '나가기'·마을 집의 '들어가기'(검게 어두워지는 전환)와 개발 화면 시험판(바로 바뀜)에서 바꾼다
  const [area, setArea] = useState<LobbyArea>("room");
  const areaRef = useRef<LobbyArea>("room");
  // 전환 중(어두워지는 동안·마을을 읽는 동안·밝아지는 동안)에는 로비를 누르지 못한다
  const travelFade = useRef(new Animated.Value(0)).current;
  const [traveling, setTraveling] = useState(false);
  const travelingRef = useRef(false);
  const [villageLoading, setVillageLoading] = useState(false);
  // 마을 모델이 장면에 들어온 적이 있는지(한 번 읽으면 다시 나갈 때 바로 뜬다)와, 다 뜨면 밝아질 전환
  const villageReadyRef = useRef(false);
  const waitingVillage = useRef<(() => void) | null>(null);
  // 마을로 나가기 전에 방에서 서 있던 자리와 방향(마을을 못 읽어 방에 남을 때 되돌린다)
  const travelFrom = useRef<{ x: number; z: number; heading: number } | null>(null);
  const loadingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopLoadingText = () => {
    if (loadingTimer.current) clearTimeout(loadingTimer.current);
    loadingTimer.current = null;
    setVillageLoading(false);
  };
  useEffect(
    () => () => {
      if (loadingTimer.current) clearTimeout(loadingTimer.current);
    },
    []
  );

  const [view, setView] = useState<ViewState>({ bubbleText: "", bubbleButton: null, place: null, actionType: null, idleBubble: false });
  // 초당 프레임 표시. 값이 바뀔 때만 다시 그린다(이름표·말풍선 자리는 아래 Animated 값으로 옮긴다).
  const [fps, setFps] = useState<number | null>(null);
  const [viewWidth, setViewWidth] = useState(VIEW_WIDTH_DEFAULT);
  const [toon, setToon] = useState<ToonSettings>(HOME_TOON);
  const [speed, setSpeed] = useState(sim.settings.speed);
  const [turn, setTurn] = useState(sim.settings.turn);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // 방의 시각: 폰의 지금 시각. 시험판에서 시각·달을 고르면 "지금 시각으로"를 누르기 전까지 그 시각으로 본다.
  const [clockOverride, setClockOverride] = useState<ClockOverride | null>(null);
  const clock = useLobbyClock(clockOverride);
  const clockMinute = Math.floor(clock.getTime() / 60_000);
  const daylight = useMemo(() => daylightAt(new Date(clockMinute * 60_000)), [clockMinute]);
  const shownHours = clockOverride?.hours ?? Math.round((clock.getHours() + clock.getMinutes() / 60) * 4) / 4;
  const shownMonth = clockOverride?.month ?? clock.getMonth() + 1;
  // 말풍선 높이(재어 본 값). 꼬리 끝이 머리 위 점에 오도록 이만큼 올린다.
  const [bubbleHeight, setBubbleHeight] = useState(60);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncView = useCallback((given?: LobbySnapshot) => {
    const snap = given ?? sim.snapshot(Date.now());
    const next: ViewState = {
      bubbleText: snap.bubbleText,
      bubbleButton: snap.bubbleButton,
      place: snap.place,
      actionType: snap.action?.type ?? null,
      idleBubble: snap.idleBubble
    };
    setView((prev) => (sameView(prev, next) ? prev : next));
  }, [sim]);

  // 편집 모드('꾸미기'). editorRef가 편집 중인 배치와 고른 가구를 갖고, editView는 그릴 때 쓰는 그 모습이다(바뀔 때만 다시 그린다).
  const editorRef = useRef<LobbyEditor | null>(null);
  const [editView, setEditView] = useState<EditView | null>(null);
  const editing = editView !== null;
  const storedCount = editView ? editView.stored.length : 0;
  // 보관함 줄 머리(개발 빌드는 '보관함' 탭) 이름: 보관함 전체 개수, 0이면 개수 없이
  const storageTitle = storedCount > 0 ? `보관함 ${storedCount}` : "보관함";
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  savingRef.current = saving;
  // 편집 모드의 카메라 거리. 들어갈 때 방이 가로로 다 보이게 물러나고, 편집 중에 카메라 거리를 바꾸면 그 거리를 따른다.
  const [editViewWidth, setEditViewWidth] = useState<number | null>(null);
  // 3D 그리기가 매 프레임 직접 읽는 편집 모습. 끄는 동안 다시 그리기가 밀려도 가구가 바로 따라가게 한다
  const editLive = useRef<LobbyCanvasEdit | null>(null);
  const editShape = useRef<{ layout: LobbyLayout; selected: string | null; red: string | null; dragging: string | null } | null>(null);
  const refreshEdit = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) {
      editShape.current = null;
      editLive.current = null;
      setEditView(null);
      return;
    }
    const prev = editShape.current;
    if (prev && prev.layout === editor.layout && prev.selected === editor.selected && prev.red === editor.red && prev.dragging === editor.dragging) return;
    editShape.current = { layout: editor.layout, selected: editor.selected, red: editor.red, dragging: editor.dragging };
    const next: EditView = {
      layout: editor.layout,
      marks: editor.marks(),
      wallMarks: editor.wallMarks(),
      zone: editor.zone(),
      dragging: editor.dragging !== null,
      lifted: editor.selected,
      focus: editor.focus(),
      handle: editor.handle,
      canFinish: editor.canFinish,
      storable: editor.storable,
      stored: storedItems(editor.layout)
    };
    editLive.current = next;
    setEditView(next);
  }, []);

  // 가구 배치가 바뀌면 방에 적용하고, 라이트루프를 멈춰 막히지 않은 자리에 세운 뒤 3D를 다시 그린다.
  // 같은 배치를 다시 받았으면(홈에 들어올 때마다 불러온다) 아무것도 하지 않는다. 편집하는 동안 받은 배치는 나온 뒤 적용한다.
  // 꾸미기 '완료'로 저장한 배치는 3D를 다시 짓지 않는다(keepScene). 꾸미던 3D가 이미 그 배치로 그려져 있어, 3D 그리기가 가구 자리·이름표만 맞춘다.
  const [layoutKey, setLayoutKey] = useState(0);
  const applyLayout = useCallback(
    (next: LobbyLayout, keepScene = false) => {
      if (sameLobbyLayout(next, activeLobbyLayout())) return;
      applyLobbyLayout(next);
      sim.relayout(Date.now());
      syncView();
      if (!keepScene) setLayoutKey((key) => key + 1);
    },
    [sim, syncView]
  );
  useEffect(() => {
    if (!layout || editing) return;
    // 보관함만 바뀐 배치(예: 홈쇼핑 주문으로 보관함에 가구가 더해짐)는 3D를 다시 짓지 않는다. 보관함 가구는 꺼낼 때 3D를 붙인다
    const current = activeLobbyLayout();
    applyLayout(layout, sameLobbyLayout({ ...layout, stored: storedItems(current) }, current));
  }, [layout, editing, applyLayout]);
  // 3D 방은 처음 지을 배치가 정해진 뒤 그린다. 정해진 배치를 먼저 적용하고(위 효과) 다음 그리기에서 짓게 해, 기본 배치로 먼저 짓지 않는다
  const [roomReady, setRoomReady] = useState(layoutReady);
  useEffect(() => {
    if (layoutReady) setRoomReady(true);
  }, [layoutReady]);
  // 방이 처음 보였는지(3D 그림판이 알린다). 그 전에는 준비 표시를 띄우고 이름표·장소 안내·말풍선을 숨긴다. 한 번 보이면 다시 띄우지 않는다
  const [roomShown, setRoomShown] = useState(false);
  const showRoom = useCallback(() => setRoomShown(true), []);
  // 꾸미기 '완료'로 나온 뒤 방이 부드럽게 그려질 때까지 띄우는 작은 로딩 표시. 3D 그리기가 settleKey가 바뀐 뒤 부드러운 프레임을 세어 알리고,
  // 알리지 못해도 늦어도 RETURN_SETTLE_LIMIT_MS 뒤에는 내린다. 떠 있는 동안 이름표·장소 안내·말풍선을 숨긴다
  const [returning, setReturning] = useState(false);
  const [settleKey, setSettleKey] = useState(0);
  const returnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleRoom = useCallback(() => {
    if (returnTimer.current) clearTimeout(returnTimer.current);
    returnTimer.current = null;
    setReturning(false);
  }, []);
  const startReturning = () => {
    setReturning(true);
    setSettleKey((key) => key + 1);
    if (returnTimer.current) clearTimeout(returnTimer.current);
    returnTimer.current = setTimeout(settleRoom, RETURN_SETTLE_LIMIT_MS);
  };
  useEffect(
    () => () => {
      if (returnTimer.current) clearTimeout(returnTimer.current);
    },
    []
  );

  // 로비 인사: 홈이 새 인사를 줄 때마다(key) 한 번 한다
  const greetingKey = greeting?.key;
  useEffect(() => {
    if (!greeting) return;
    sim.greet(greeting.line, greeting.action, Date.now());
    syncView();
    // 같은 인사를 다시 하지 않게 key가 바뀔 때만 돈다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [greetingKey, sim, syncView]);

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

  // 말풍선 자리와 보임. 화면 전체를 다시 그리는 것은 3D가 바쁠 때 늦어져, 말풍선이 라이트루프를 늦게 따라가거나 걷는 동안에도 남았다.
  // 그래서 자리·보임은 매 프레임 값만 바꾸고(다시 그리지 않음), 글은 바뀔 때만 다시 그린다.
  // 값은 네이티브 애니메이션 쪽에 두어(useNativeDriver) 바꿀 때 화면 구조를 다시 맞추지 않고, 반 픽셀 넘게 바뀔 때만 보낸다.
  // (자바스크립트 쪽 값으로 매 프레임 열 개 넘게 바꾸면 초당 프레임이 절반쯤으로 떨어졌다.)
  const nativeValue = (v: number) => new Animated.Value(v, { useNativeDriver: true });
  const bubbleLeft = useRef(nativeValue(0)).current;
  const bubbleTop = useRef(nativeValue(320)).current;
  const bubbleOpacity = useRef(nativeValue(1)).current;
  // 장소 안내 말풍선은 장소마다 미리 만들어 두고, 지금 장소의 것만 네이티브 쪽 투명도로 보인다. 아래 메뉴 강조도 같다.
  // 손을 떼지 않고 끄는 동안에는 3D 그리기와 누르기 처리가 자바스크립트 일꾼을 차지해 화면 다시 그리기가 밀리므로(손을 떼거나
  // 몇 초 뒤에야 반영됐다), 다시 그리기를 기다리지 않고 바꿀 수 있게 한다.
  const placeOpacity = useRef(
    Object.fromEntries(ALL_PLACE_IDS.map((id) => [id, nativeValue(0)])) as Record<PlaceId, Animated.Value>
  ).current;
  const menuLitOpacity = useRef(
    Object.fromEntries(MENU.map((item) => [item.id, nativeValue(0)])) as Record<LobbyMenuId, Animated.Value>
  ).current;
  const [placeHeights, setPlaceHeights] = useState<Record<PlaceId, number>>(
    () => Object.fromEntries(ALL_PLACE_IDS.map((id) => [id, 80])) as Record<PlaceId, number>
  );
  // 화면에 그려 둔 인사·짧은 말 말풍선의 글. 다시 그리기가 밀려 글이 지금 말과 다르면 그 말풍선을 보이지 않는다.
  const renderedLine = useRef("");
  const lastSent = useRef(new Map<Animated.Value, number>()).current;
  // 네이티브 쪽 값은 그림만 옮기고 화면 구조(누르기 자리를 재는 곳)는 그대로 둔다. 말풍선 자리가 멈추면 한 번 다시 그려
  // 말풍선 버튼을 누르는 자리가 실제 자리와 맞게 한다(누른 채 손가락이 살짝 움직여도 눌림이 취소되지 않게).
  // 서 있거나 앉아 있을 때도 머리가 숨 쉬듯 1~2픽셀 오르내리므로, 마지막으로 다시 그린 자리에서 4픽셀 넘게 옮겨졌을 때만 다시 그린다
  // (눌림이 취소되는 여유 20픽셀보다 충분히 작다).
  const [, setBubbleSettled] = useState(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settledAt = useRef({ left: Number.NaN, top: Number.NaN });
  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    []
  );
  const send = useCallback(
    (value: Animated.Value, next: number, epsilon: number): boolean => {
      const prev = lastSent.get(value);
      if (prev !== undefined && Math.abs(prev - next) <= epsilon) return false;
      lastSent.set(value, next);
      value.setValue(next);
      return true;
    },
    [lastSent]
  );
  const screenWidthRef = useRef(screenWidth);
  screenWidthRef.current = screenWidth;
  // 장소 이름표 자리도 같은 까닭으로 매 프레임 값만 바꾼다(카메라가 움직여도 화면 전체를 다시 그리지 않는다)
  const labelPos = useRef(
    Object.fromEntries(ALL_PLACE_IDS.map((id) => [id, { left: nativeValue(0), top: nativeValue(0) }])) as Record<
      PlaceId,
      { left: Animated.Value; top: Animated.Value }
    >
  ).current;
  const onOverlayFrame = useCallback(
    (bubble: { x: number; y: number }, labels: Partial<Record<PlaceId, { x: number; y: number }>>) => {
      const left = Math.max(8, Math.min(bubble.x - BUBBLE_WIDTH / 2, screenWidthRef.current - BUBBLE_WIDTH - 8));
      const top = Math.max(120, bubble.y);
      const movedLeft = send(bubbleLeft, left, 0.5);
      const movedTop = send(bubbleTop, top, 0.5);
      const moved = movedLeft || movedTop;
      const settled = settledAt.current;
      const farFromSettled = !(Math.abs(left - settled.left) <= 4 && Math.abs(top - settled.top) <= 4);
      if (moved && farFromSettled) {
        if (settleTimer.current) clearTimeout(settleTimer.current);
        settleTimer.current = setTimeout(() => {
          settledAt.current = { left: lastSent.get(bubbleLeft) ?? left, top: lastSent.get(bubbleTop) ?? top };
          setBubbleSettled((n) => n + 1);
        }, 150);
      }
      for (const id of Object.keys(labels) as PlaceId[]) {
        const at = labels[id];
        if (!at || !labelPos[id]) continue;
        send(labelPos[id].left, at.x, 0.5);
        send(labelPos[id].top, at.y, 0.5);
      }
    },
    [bubbleLeft, bubbleTop, labelPos, send, lastSent]
  );

  /** 스냅숏대로 장소 안내 말풍선·인사 말풍선·메뉴 강조의 보임을 네이티브 쪽에서 바로 바꾼다. */
  const applyOverlay = useCallback(
    (snap: LobbySnapshot) => {
      const place = snap.place;
      for (const id of ALL_PLACE_IDS) send(placeOpacity[id], place === id ? 1 : 0, 0);
      const lineShown = place === null && snap.bubbleText !== "" && snap.bubbleText === renderedLine.current;
      send(bubbleOpacity, lineShown ? 1 : 0, 0);
      const lit = place ? MENU_FOR_MARK[place] ?? null : null;
      for (const item of MENU) send(menuLitOpacity[item.id], lit === item.id ? 1 : 0, 0);
    },
    [send, placeOpacity, bubbleOpacity, menuLitOpacity]
  );

  /** 장소에 들어간다(판 열기·기록 화면 등은 홈이 맡는다). 홈이 맡지 않으면(개발 화면) 들어갈 때 안내를 띄우고 false. */
  const enterPlace = useCallback(
    (id: PlaceId) => {
      if (isRoomMark(id) && onEnterMark?.(id)) return true;
      showToast(markInfo(id).enterMessage);
      return false;
    },
    [onEnterMark, showToast]
  );
  const enterPlaceRef = useRef(enterPlace);
  enterPlaceRef.current = enterPlace;

  /**
   * 구역을 바꾼다(개발 화면 시험판). 마을이면 라룹이 집 문 앞에서 카메라 쪽을 보고, 방이면 입구 발판 안쪽에서 방 안쪽을 보고 선다.
   * 꾸미기 중에는 바꾸지 않는다.
   */
  const switchArea = (next: LobbyArea) => {
    if (editorRef.current || travelingRef.current || next === areaRef.current) return;
    placeInArea(next);
  };
  /** 구역을 바꾸고 라룹이를 그 구역의 들어서는 자리에 세운다. */
  const placeInArea = (next: LobbyArea) => {
    applyArea(next);
    areaRef.current = next;
    const nowMs = Date.now();
    if (next === "village") sim.placeAt(VILLAGE_START, VILLAGE_START.heading, nowMs);
    else sim.placeAt(MARKS.door.approach[0], Math.PI, nowMs);
    setArea(next);
    syncView();
  };
  /**
   * 방↔마을 전환: 검게 어두워진 뒤(약 0.3초) 구역을 바꾸고, 밝아진다(약 0.3초). 마을로 갈 때 마을 모델을 아직 다 읽지 못했으면
   * 어두운 채 "마을로 나가는 중…"을 보이고 다 뜨면 밝아진다. 동작 줄이기면 어두워지기·밝아지기 없이 바로 바꾼다.
   * after는 밝아진 뒤 한다(마을에서 '바로 놓기': 방으로 와서 꾸미기를 연다).
   */
  const travel = (next: LobbyArea, after?: () => void) => {
    if (travelingRef.current || editorRef.current || next === areaRef.current) return;
    travelingRef.current = true;
    setTraveling(true);
    sim.pointerCancel();
    const finish = () => {
      travelingRef.current = false;
      setTraveling(false);
      setVillageLoading(false);
      after?.();
    };
    const reveal = () => {
      if (sim.reduceMotion) {
        travelFade.setValue(0);
        finish();
        return;
      }
      Animated.timing(travelFade, { toValue: 0, duration: TRAVEL_FADE_MS, useNativeDriver: true }).start(finish);
    };
    const swap = () => {
      if (next === "village") travelFrom.current = { x: sim.x, z: sim.z, heading: sim.heading };
      placeInArea(next);
      if (next === "village" && !villageReadyRef.current) {
        travelFade.setValue(1);
        waitingVillage.current = reveal;
        // 마을 모델이 뜰 때까지 검은 채 기다린다. 조금 넘게 걸리면 "마을로 나가는 중…"을 보인다(동작 줄이기면 어두워지는 움직임이 없으니 바로 보인다)
        if (loadingTimer.current) clearTimeout(loadingTimer.current);
        if (sim.reduceMotion) {
          setVillageLoading(true);
          return;
        }
        loadingTimer.current = setTimeout(() => {
          loadingTimer.current = null;
          if (waitingVillage.current) setVillageLoading(true);
        }, VILLAGE_LOADING_DELAY_MS);
        return;
      }
      reveal();
    };
    if (sim.reduceMotion) swap();
    else Animated.timing(travelFade, { toValue: 1, duration: TRAVEL_FADE_MS, useNativeDriver: true }).start(swap);
  };
  const travelRef = useRef(travel);
  travelRef.current = travel;
  const onVillageReady = useCallback(() => {
    villageReadyRef.current = true;
    const waiting = waitingVillage.current;
    waitingVillage.current = null;
    if (!waiting) return;
    stopLoadingText();
    waiting();
  }, []);
  // 마을 모델을 읽지 못하면 방으로 돌아와 밝아지고 안내한다(전환 중이 아니면 안내만)
  const onVillageFailed = useCallback(() => {
    villageReadyRef.current = false;
    const waiting = waitingVillage.current;
    waitingVillage.current = null;
    if (!waiting) {
      showToast(VILLAGE_FAILED);
      return;
    }
    // 방으로 되돌리고, 나가기 전 자리·방향 그대로 세운다
    placeInAreaRef.current("room");
    const from = travelFrom.current;
    if (from) sim.placeAt({ x: from.x, z: from.z }, from.heading, Date.now(), true);
    syncView();
    stopLoadingText();
    waiting();
    showToast(VILLAGE_FAILED);
  }, [showToast, sim, syncView]);
  const placeInAreaRef = useRef(placeInArea);
  placeInAreaRef.current = placeInArea;

  const onFrame = useCallback(
    (dt: number, nowMs: number) => {
      sim.update(dt, nowMs);
      // '들어가기' 동작이 끝나면 들어간다. 맡을 판이 없으면(개발 화면) 안내만 띄우고 바로 제자리로 돌아온다
      const entered = sim.consumeSceneEntered();
      if (entered && !enterPlaceRef.current(entered)) sim.endScene();
      const snap = sim.snapshot(Date.now());
      applyOverlay(snap);
      syncView(snap);
    },
    [sim, syncView, applyOverlay]
  );

  // 판을 닫았거나 기록 화면에서 돌아와 로비를 다시 누를 수 있게 되면, '들어가기' 동작을 마치고 제자리로 돌아온다
  const interactive = !inputBlocked && !paused;
  useEffect(() => {
    if (interactive && sim.scene?.phase === "hold") sim.endScene();
  }, [interactive, sim]);
  // 들어가는 동작 중에 다른 화면으로 가면 들어가기를 거두고 원래 자리에 선다(돌아와 남은 동작이 끝나며 판이 열리지 않게)
  useEffect(() => {
    if (paused && sim.scene?.phase === "in") sim.cancelScene();
  }, [paused, sim]);

  const onPointer = useCallback(
    (phase: LobbyPointerPhase, hit: PointerHit | null, x: number, y: number) => {
      // 편집 모드: 가구를 고르고 끈다. 저장하는 동안에는 누르지 못한다
      const editor = editorRef.current;
      if (editor) {
        if (savingRef.current) return;
        if (phase === "down") {
          setCameraOpen(false);
          if (editor.pointerDown(hit ?? EMPTY_HIT, x, y) === "red-first") showToast(EDIT_RED_FIRST);
        } else if (phase === "move") editor.pointerMove(hit ?? EMPTY_HIT, x, y);
        else if (phase === "up") {
          const notice = editor.pointerUp();
          if (notice === "cannot-place") showToast(EDIT_CANNOT_PLACE);
          else if (notice === "cannot-move-here") showToast(EDIT_CANNOT_MOVE_HERE);
        }
        else editor.pointerCancel();
        refreshEdit();
        return;
      }
      // 시트를 연 동안에는 로비를 누르지 못한다. 막는 중에 누른 것이 남지 않게 지금 누르기도 거둔다.
      // 시트를 연 동안과 '들어가기' 동작을 하는 동안에는 로비를 누르지 못한다
      if (inputBlockedRef.current || sim.scene || travelingRef.current) {
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
    [sim, syncView, showToast, refreshEdit]
  );

  const changeViewWidth = (value: number) => {
    const next = clampViewWidth(value);
    setViewWidth(next);
    setEditViewWidth(null);
    void saveLobbyViewWidth(next);
  };

  // ---------- 편집 모드 ----------
  const aliveRef = useRef(true);
  useEffect(
    () => () => {
      aliveRef.current = false;
    },
    []
  );
  const startEdit = () => {
    if (editorRef.current) return;
    // 앞 '완료'의 로딩 표시가 남아 있으면 내린다(꾸미기에서 '취소'로 나올 때 남은 표시가 보이지 않게)
    settleRoom();
    // 걷기·'들어가기' 동작을 거두고 선다(편집하는 동안 라이트루프는 숨는다)
    sim.relayout(Date.now());
    syncView();
    setCameraOpen(false);
    editorRef.current = new LobbyEditor(activeLobbyLayout());
    setEditViewWidth(Math.max(viewWidth, roomFitViewWidth(screenWidth / Math.max(1, screenHeight))));
    refreshEdit();
  };
  /**
   * 편집 모드에서 나온다. saved가 있으면 그 배치를 적용한다(없으면 그동안 받은 배치를 위 효과가 적용한다).
   * '완료'로 나오면(done) 로딩 표시를 띄우고, 저장한 배치는 3D를 다시 짓지 않고 적용한다.
   */
  const finishEdit = (saved: LobbyLayout | null, done = false) => {
    editorRef.current = null;
    setSaving(false);
    setEditViewWidth(null);
    refreshEdit();
    if (saved) applyLayout(saved, true);
    if (done) startReturning();
  };
  const cancelEdit = () => {
    if (!editorRef.current || savingRef.current) return;
    finishEdit(null);
  };
  const resetEdit = () => {
    const editor = editorRef.current;
    if (!editor || savingRef.current) return;
    editor.resetToDefault();
    refreshEdit();
  };
  const storeEdit = () => {
    const editor = editorRef.current;
    if (!editor || savingRef.current) return;
    editor.store();
    refreshEdit();
  };
  const takeOutEdit = (item: StoredItem) => {
    const editor = editorRef.current;
    if (!editor || savingRef.current) return;
    // 보관함 줄은 열린 채로 둔다(여러 개를 이어서 꺼낼 수 있고, 줄이 열린 채로도 꺼낸 가구를 끌 수 있다)
    const notice = editor.takeOut(item.type, item.id);
    if (notice === "red-first") showToast(EDIT_RED_FIRST);
    else if (notice === "no-room") showToast(EDIT_NO_ROOM);
    refreshEdit();
  };
  const rotateEdit = () => {
    const editor = editorRef.current;
    if (!editor || savingRef.current) return;
    editor.rotate();
    refreshEdit();
  };
  const finishEditWithSave = async () => {
    const editor = editorRef.current;
    if (!editor || savingRef.current) return;
    if (!editor.canFinish) {
      showToast(EDIT_RED_FINISH);
      return;
    }
    if (!editor.changed || !onSaveLayout) {
      finishEdit(null, true);
      return;
    }
    setSaving(true);
    savingRef.current = true;
    try {
      const saved = await onSaveLayout(editor.layout);
      if (aliveRef.current) finishEdit(saved, true);
    } catch {
      if (!aliveRef.current) return;
      setSaving(false);
      savingRef.current = false;
      showToast(EDIT_SAVE_FAILED);
    }
  };
  // 홈쇼핑 '바로 놓기': 꾸미기를 열고 산 가구를 보관함에서 꺼낸 채로 시작한다. 배치(layout)는 홈이 같은 렌더에서 먼저 넘겨, 위 효과가 먼저 적용한다
  const placeRequestKey = placeRequest?.key ?? null;
  // 로비가 새로 만들어질 때 이미 있던 요청은 처리하지 않는다(다시 마운트되어 꾸미기가 저절로 열리지 않게)
  const handledPlaceKey = useRef(placeRequestKey);
  const placeNowRef = useRef<(request: { itemId: string; type: string }) => void>(() => undefined);
  placeNowRef.current = (request) => {
    const place = () => {
      startEdit();
      if (editorRef.current) takeOutEdit({ id: request.itemId, type: request.type });
    };
    // 마을에 있으면 방으로 돌아온 뒤(어두워졌다 밝아진 뒤) 꾸미기를 연다
    if (areaRef.current === "village") travelRef.current("room", place);
    else place();
  };
  useEffect(() => {
    if (placeRequestKey === null || !placeRequest || placeRequestKey === handledPlaceKey.current) return;
    handledPlaceKey.current = placeRequestKey;
    placeNowRef.current({ itemId: placeRequest.itemId, type: placeRequest.type });
    // key가 바뀔 때만 한 번 한다
  }, [placeRequestKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancelEditRef = useRef(cancelEdit);
  cancelEditRef.current = cancelEdit;
  // 안드로이드 뒤로 가기는 '취소'와 같다(저장하는 동안에는 아무 일도 하지 않는다)
  useEffect(() => {
    if (!editing) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      cancelEditRef.current();
      return true;
    });
    return () => subscription.remove();
  }, [editing]);
  const onEditingChangeRef = useRef(onEditingChange);
  onEditingChangeRef.current = onEditingChange;
  const editingSent = useRef(false);
  useEffect(() => {
    if (editingSent.current === editing) return;
    editingSent.current = editing;
    onEditingChangeRef.current?.(editing);
  }, [editing]);
  // 슬라이더는 왼쪽이 멀리(넓게 보임), 오른쪽이 가까이다.
  const closeness = VIEW_WIDTH_MAX + VIEW_WIDTH_MIN - viewWidth;
  const closenessPercent = Math.round(((closeness - VIEW_WIDTH_MIN) / (VIEW_WIDTH_MAX - VIEW_WIDTH_MIN)) * 100);
  const litMenu = view.place ? MENU_FOR_MARK[view.place] ?? null : null;
  const handleProjection = useCallback(
    (next: LobbyProjection) => {
      setFps((prev) => (prev === next.fps ? prev : next.fps));
      onProjection?.(next);
    },
    [onProjection]
  );
  const shownToon = devPanel ? toon : HOME_TOON;
  // 장소 안내가 아닌 말(인사·짧은 말). 장소 안내는 아래에서 장소마다 미리 만든 말풍선이 보인다.
  const lineText = view.place === null ? view.bubbleText : "";
  const showIdleButton = Boolean(idleButton) && view.idleBubble;
  // 그린 뒤 그린 글을 적어 두고 보임을 다시 맞춘다(프레임을 기다리지 않게)
  useLayoutEffect(() => {
    renderedLine.current = lineText;
    applyOverlay(sim.snapshot(Date.now()));
  });

  return (
    <View style={styles.root}>
      {roomReady ? (
      <Lobby3dCanvas
        sim={sim}
        viewWidth={editing ? editViewWidth ?? viewWidth : viewWidth}
        toon={shownToon}
        onFrame={onFrame}
        onPointer={onPointer}
        onProject={handleProjection}
        onOverlayFrame={onOverlayFrame}
        paused={paused}
        daylight={daylight}
        layoutKey={layoutKey}
        edit={editView}
        editLive={editLive}
        onRoomShown={showRoom}
        settleKey={settleKey}
        onRoomSettled={settleRoom}
        area={area}
        onVillageReady={onVillageReady}
        onVillageFailed={onVillageFailed}
      />
      ) : null}

      {roomShown ? null : (
        <View pointerEvents="none" style={styles.preparing}>
          <ActivityIndicator color="#FFFFFF" />
          <Text style={styles.preparingText}>방을 준비하고 있어요</Text>
        </View>
      )}

      {/* 꾸미기 '완료'로 나온 뒤: 방은 보이는 채로 가운데 작은 판 */}
      {returning && roomShown && !editing ? (
        <View pointerEvents="none" style={styles.returningWrap}>
          <View style={styles.returning} accessibilityLiveRegion="polite">
            <ActivityIndicator color="#FFFFFF" />
            <Text style={styles.returningText}>방을 정리하고 있어요</Text>
          </View>
        </View>
      ) : null}

      {/* 편집 모드, 방이 보이기 전, '완료' 뒤 로딩 표시가 떠 있는 동안에는 이름표·장소 안내·말풍선을 숨긴다 */}
      {editing || !roomShown || returning ? null : placesOf(area).map((id) => (
        <Animated.View
          key={id}
          pointerEvents="none"
          style={[
            styles.label,
            {
              // 네이티브 애니메이션은 자리를 transform으로만 옮길 수 있다(styles.label의 가운데 맞춤 이동도 여기서 함께 한다)
              transform: [{ translateX: labelPos[id].left }, { translateY: labelPos[id].top }, { translateX: -40 }, { translateY: -22 }]
            }
          ]}
        >
          <Text style={styles.labelText}>{markInfo(id).label}</Text>
        </Animated.View>
      ))}

      {/* 안내 글이 없는 장소(지금은 마을의 장소)는 말풍선이 없다 */}
      {editing || !roomShown || returning ? null : placesOf(area).filter((id) => markInfo(id).prompt).map((id) => {
        const active = view.place === id;
        return (
          <Animated.View
            key={`place-${id}`}
            // 지금 장소가 아닌 말풍선은 누르기와 화면 읽기에서 뺀다(투명도는 프레임마다 네이티브 쪽에서 바뀐다)
            pointerEvents={active ? "box-none" : "none"}
            accessibilityElementsHidden={!active}
            importantForAccessibility={active ? "auto" : "no-hide-descendants"}
            onLayout={(e) => {
              const h = Math.round(e.nativeEvent.layout.height);
              if (h > 0 && h !== placeHeights[id]) setPlaceHeights((prev) => ({ ...prev, [id]: h }));
            }}
            style={[
              styles.bubbleWrap,
              {
                opacity: placeOpacity[id],
                transform: [{ translateX: bubbleLeft }, { translateY: bubbleTop }, { translateY: -placeHeights[id] - 12 }]
              }
            ]}
          >
            <View style={styles.bubble} pointerEvents="box-none">
              <View pointerEvents="none">
                <Text style={styles.bubbleText}>{markInfo(id).prompt}</Text>
              </View>
              {markInfo(id).buttonLabel ? (
              <Pressable
                accessibilityRole="button"
                style={styles.bubbleButton}
                onPress={() => {
                  // 걷기 시작해 이 안내가 사라졌는데 아직 다시 그리기 전이면 누르지 않은 것으로 본다
                  if (sim.snapshot(Date.now()).place !== id) return;
                  // 방의 '나가기'는 마을로, 마을 집의 '들어가기'는 방으로 간다
                  if (id === "door") {
                    travel("village");
                    return;
                  }
                  if (id === "home") {
                    travel("room");
                    return;
                  }
                  // 장소마다 동작(생각하기·의자에 앉기·책 꺼내기)을 한 뒤 들어간다. 동작이 없거나 "동작 줄이기"면 바로 들어간다
                  if (sim.startScene(id, Date.now())) {
                    syncView();
                    return;
                  }
                  enterPlace(id);
                }}
              >
                <Text style={styles.bubbleButtonText}>{markInfo(id).buttonLabel}</Text>
              </Pressable>
              ) : null}
            </View>
            <View style={styles.bubbleTail} pointerEvents="none" />
          </Animated.View>
        );
      })}

      {lineText && !editing && roomShown && !returning ? (
        <Animated.View
          pointerEvents="box-none"
          onLayout={(e) => {
            const h = Math.round(e.nativeEvent.layout.height);
            if (h > 0 && h !== bubbleHeight) setBubbleHeight(h);
          }}
          style={[
            styles.bubbleWrap,
            {
              opacity: bubbleOpacity,
              transform: [{ translateX: bubbleLeft }, { translateY: bubbleTop }, { translateY: -bubbleHeight - 12 }]
            }
          ]}
        >
          {/* 글 부분은 누르기를 받지 않고(뒤의 방이 받는다) 버튼만 누를 수 있다 */}
          <View style={styles.bubble} pointerEvents="box-none">
            <View pointerEvents="none">
              <Text style={styles.bubbleText}>{lineText}</Text>
            </View>
            {showIdleButton && idleButton ? (
              <Pressable
                accessibilityRole="button"
                style={styles.bubbleButton}
                onPress={() => {
                  // 누른 순간 인사 말풍선을 보이는 중일 때만 누른다(걷기 시작해 숨었는데 아직 다시 그리기 전이면 누르지 않은 것으로 본다)
                  if (sim.snapshot(Date.now()).idleBubble) idleButton.onPress();
                }}
              >
                <Text style={styles.bubbleButtonText}>{idleButton.label}</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.bubbleTail} pointerEvents="none" />
        </Animated.View>
      ) : null}

      <View pointerEvents="box-none" style={[styles.header, { top: insets.top + 10 }]}>
        {editing ? (
          // 편집 모드의 위 여백: 왼쪽에 취소·처음 배치로, 오른쪽에 완료·카메라(안내 문구는 이 줄 바로 밑)
          <View style={styles.headerLeft}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: saving }}
              disabled={saving}
              style={[styles.editTopButton, saving && styles.editButtonBusy]}
              onPress={cancelEdit}
            >
              <Text style={styles.editButtonText}>취소</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: saving }}
              disabled={saving}
              style={[styles.editTopButton, saving && styles.editButtonBusy]}
              onPress={resetEdit}
            >
              <Text style={styles.editButtonText}>처음 배치로</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.headerLeft}>
            {onStreakPress ? (
              <Pressable accessibilityRole="button" style={styles.chip} onPress={onStreakPress}>
                <Text style={styles.chipText}>{streakLabel}</Text>
              </Pressable>
            ) : (
              <View style={styles.chip}>
                <Text style={styles.chipText}>{streakLabel}</Text>
              </View>
            )}
            {/* 꾸미기는 방에서만 한다 */}
            {onSaveLayout && area === "room" ? (
              <Pressable accessibilityRole="button" style={styles.decorButton} onPress={startEdit}>
                <Text style={styles.decorText}>꾸미기</Text>
              </Pressable>
            ) : null}
            {onSaveLayout && onOpenShop ? (
              <Pressable accessibilityRole="button" style={styles.decorButton} onPress={onOpenShop}>
                <Text style={styles.decorText}>홈쇼핑</Text>
              </Pressable>
            ) : null}
            {onSaveLayout && onOpenShop && shopBalance !== null ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${shopBalance}룹, 홈쇼핑 열기`}
                style={styles.chip}
                onPress={onOpenShop}
              >
                <Text style={styles.chipText}>{shopBalance}룹</Text>
              </Pressable>
            ) : null}
          </View>
        )}
        <View style={styles.headerLeft}>
          {editing ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: saving || !editView?.canFinish }}
              disabled={saving}
              style={[styles.editTopButton, styles.editDone, (saving || !editView?.canFinish) && styles.editButtonBusy]}
              onPress={() => void finishEditWithSave()}
            >
              <Text style={[styles.editButtonText, styles.editDoneText]}>{saving ? "저장 중…" : "완료"}</Text>
            </Pressable>
          ) : null}
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
      </View>

      {/* 안내 문구는 같은 높이의 알림(토스트)이나 카메라 거리 판이 떠 있는 동안 숨긴다 */}
      {editing && !toast && !cameraOpen ? (
        <View pointerEvents="none" style={[styles.editGuideRow, { top: insets.top + 62 }]}>
          <View style={styles.editGuide}>
            <Text style={styles.editGuideText}>{EDIT_GUIDE}</Text>
          </View>
        </View>
      ) : null}

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
                // 편집 중이면 슬라이더처럼 편집 카메라도 이 거리를 따른다
                setEditViewWidth(null);
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
          <Text style={styles.fpsText}>FPS {fps ?? "-"}</Text>
          <Text style={styles.fpsText}>동작: {view.actionType ? ACTION_LABELS[view.actionType] : "없음"}</Text>
        </View>
      ) : null}

      {toast ? (
        <View accessibilityRole="alert" pointerEvents="none" style={[styles.toast, { top: insets.top + 62 }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      {/* 꾸미기 중에는 아래 탭 막대가 숨으므로, 보관함 줄을 화면 아래·좌우 끝까지 붙인다 */}
      <View pointerEvents="box-none" style={editing ? styles.bottomEdit : [styles.bottom, { bottom: bottomPad + 12 }]}>
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
            <Text style={styles.panelLabel}>구역</Text>
            <View style={styles.row}>
              {(["room", "village"] as const).map((next) => (
                <Pressable
                  key={next}
                  accessibilityRole="button"
                  accessibilityState={{ selected: area === next }}
                  style={[styles.stepButton, area === next && styles.stepButtonOn]}
                  onPress={() => switchArea(next)}
                >
                  <Text style={[styles.stepText, area === next && styles.stepTextOn]}>{AREA_LABELS[next]}</Text>
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
            <Text style={styles.panelLabel}>
              시각 {clockText(shownHours)}
              {clockOverride ? "" : " (지금)"}
            </Text>
            <SimpleSlider
              label="시각"
              value={shownHours}
              min={0}
              max={24}
              step={0.25}
              onChange={(hours) => setClockOverride({ hours, month: shownMonth })}
              valueText={clockText(shownHours)}
            />
            <Text style={styles.panelLabel}>달 {shownMonth}월</Text>
            <SimpleSlider
              label="달"
              value={shownMonth}
              min={1}
              max={12}
              step={1}
              onChange={(month) => setClockOverride({ hours: shownHours, month })}
              valueText={`${shownMonth}월`}
            />
            <Pressable
              accessibilityRole="button"
              style={[styles.stepButton, styles.clockButton]}
              onPress={() => setClockOverride(null)}
            >
              <Text style={styles.stepText}>지금 시각으로</Text>
            </Pressable>
          </View>
        ) : null}
        {devPanel ? (
          <Pressable accessibilityRole="button" style={styles.panelToggle} onPress={() => setPanelOpen((open) => !open)}>
            <Text style={styles.panelToggleText}>{panelOpen ? "시험판 접기" : "시험판 펴기"}</Text>
          </Pressable>
        ) : null}
        {editing ? (
          // 보관함 줄: 꾸미기 동안 화면 맨 아래에 늘 보인다. 가림막이 없어 줄이 보이는 채로 방의 가구를 다룬다
          <View accessibilityLabel="보관함" style={[styles.storageTray, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.rowBetween}>
              <Text style={styles.storageTitle}>{storageTitle}</Text>
              {/* 돌리기·치우기는 줄 머리 오른쪽에 둔다. 가구를 골랐을 때만 보이고, 아니면 자리만 비워 둔다(머리의 다른 것이 움직이지 않게) */}
              <View style={styles.headerLeft}>
                {editView?.handle ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="돌리기"
                    accessibilityState={{ disabled: saving }}
                    disabled={saving}
                    style={[styles.trayAction, saving && styles.editButtonBusy]}
                    onPress={rotateEdit}
                  >
                    <Text style={styles.rotateText}>↻</Text>
                  </Pressable>
                ) : (
                  <View style={styles.trayActionSlot} />
                )}
                {editView?.storable ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="치우기"
                    accessibilityState={{ disabled: saving }}
                    disabled={saving}
                    style={[styles.trayAction, saving && styles.editButtonBusy]}
                    onPress={storeEdit}
                  >
                    <Text style={styles.storeText}>📦</Text>
                  </Pressable>
                ) : (
                  <View style={styles.trayActionSlot} />
                )}
              </View>
            </View>
            {editView && editView.stored.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storageList}>
                {editView.stored.map((item) => (
                  <FurnitureTile key={item.id} type={item.type} onPress={() => takeOutEdit(item)} />
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.storageEmpty}>{STORAGE_EMPTY}</Text>
            )}
          </View>
        ) : null}
        {editing ? null : (
        <View style={styles.menu}>
          {MENU.map((item) => {
            const lit = litMenu === item.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: lit }}
                style={[styles.menuButton, item.primary && styles.menuPrimary]}
                onPress={() => {
                  // '들어가기' 동작 중이면 거두고 이 메뉴가 하는 일을 바로 한다
                  sim.cancelScene();
                  if (onMenu) onMenu(item.id);
                  else showToast(`${item.label} 화면으로 가요`);
                }}
              >
                {/* 강조 테두리. 끄는 중에도 바로 따라가게 네이티브 쪽 투명도로 보인다 */}
                <Animated.View pointerEvents="none" style={[styles.menuLitRing, { opacity: menuLitOpacity[item.id] }]} />
                <Text style={[styles.menuText, item.primary && styles.menuPrimaryText]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
        )}
      </View>
      {/* 방↔마을 전환: 검게 어두워졌다 밝아진다. 로비의 맨 위에 덮여, 전환 중에는 3D·위 줄·아래 메뉴 모두 누르기가 닿지 않는다 */}
      <Animated.View
        pointerEvents={traveling ? "auto" : "none"}
        accessibilityElementsHidden={!villageLoading}
        importantForAccessibility={villageLoading ? "auto" : "no-hide-descendants"}
        style={[styles.travelShade, { opacity: travelFade }]}
      >
        {villageLoading ? (
          <View style={styles.travelLoading} accessibilityLiveRegion="polite">
            <ActivityIndicator color="#FFFFFF" />
            <Text style={styles.preparingText}>{VILLAGE_LOADING}</Text>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

/** 말풍선 폭. 방 전체가 보이는 먼 카메라에서 장소를 덜 가리게 줄였다(2026-11-07). */
const BUBBLE_WIDTH = 196;

const styles = StyleSheet.create({
  travelShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center"
  },
  travelLoading: {
    alignItems: "center",
    gap: 10
  },
  root: { flex: 1, backgroundColor: "#000000" },
  label: {
    position: "absolute",
    left: 0,
    top: 0,
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: LINE,
    backgroundColor: "#FFFFFF"
  },
  labelText: { fontSize: 11, fontWeight: "700", color: "#2B1810" },
  // 준비하는 동안 뒤에서 그리는 방이 비쳐 보이지 않게 3D 자리를 불투명한 검정으로 가린다
  preparing: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#000000" },
  preparingText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  returningWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  returning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 16,
    backgroundColor: "rgba(43, 24, 16, 0.72)"
  },
  returningText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  bubbleWrap: { position: "absolute", left: 0, top: 0, width: BUBBLE_WIDTH, alignItems: "center" },
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
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  decorButton: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: LINE,
    backgroundColor: "rgba(255,255,255,0.94)",
    justifyContent: "center"
  },
  decorText: { color: "#2B1810", fontSize: 13, fontWeight: "700" },
  editGuide: {
    flexShrink: 1,
    minHeight: 40,
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(43,24,16,0.82)",
    justifyContent: "center"
  },
  editGuideText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  trayActionSlot: { width: TRAY_ACTION_SIZE, height: TRAY_ACTION_SIZE },
  trayAction: {
    width: TRAY_ACTION_SIZE,
    height: TRAY_ACTION_SIZE,
    borderRadius: TRAY_ACTION_SIZE / 2,
    borderWidth: 2,
    borderColor: LINE,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center"
  },
  rotateText: { fontSize: 26, color: LINE, fontWeight: "700" },
  storeText: { fontSize: 24 },
  // 꾸미기 위 줄 버튼(취소·처음 배치로·완료)
  editTopButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 2,
    borderColor: LINE,
    backgroundColor: "#FFFFFF"
  },
  editGuideRow: { position: "absolute", left: 12, right: 12, alignItems: "flex-start" },
  // 화면 아래·좌우 끝에 붙으므로 테두리와 둥근 모서리는 위쪽에만 둔다(아래 안전 영역은 화면이 안쪽 여백으로 비운다)
  storageTray: {
    paddingTop: 12,
    paddingHorizontal: 12,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 2,
    borderColor: LINE,
    backgroundColor: "#FFFFFF",
    gap: 10
  },
  tile: { width: 76, alignItems: "center", gap: 4 },
  tileBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: LINE,
    backgroundColor: "#FFF7EE",
    alignItems: "center",
    justifyContent: "center"
  },
  tileImage: { width: 56, height: 56 },
  tileInitial: { fontSize: 22, fontWeight: "800", color: "#A64B00" },
  tileName: { fontSize: 12, fontWeight: "700", color: "#2B1810", textAlign: "center" },
  storageTitle: { fontSize: 16, fontWeight: "700", color: "#2B1810" },
  storageEmpty: { fontSize: 14, color: "#7A5A48", paddingVertical: 8 },
  storageList: { gap: 10 },
  editDone: { backgroundColor: ACCENT },
  editButtonBusy: { opacity: 0.45 },
  editButtonText: { fontSize: 14, fontWeight: "700", color: "#2B1810", textAlign: "center" },
  editDoneText: { color: "#FFFFFF" },
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
  bottomEdit: { position: "absolute", left: 0, right: 0, bottom: 0, gap: 8 },
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
  clockButton: { alignSelf: "flex-start", marginTop: 6 },
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
  menu: { flexDirection: "row", gap: 6 },
  menuButton: {
    flex: 1,
    height: 72,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: LINE,
    backgroundColor: "rgba(255,255,255,0.95)",
    justifyContent: "center",
    paddingHorizontal: 6
  },
  menuPrimary: { flex: 1.15, backgroundColor: ACCENT },
  menuLitRing: { position: "absolute", top: -2, left: -2, right: -2, bottom: -2, borderRadius: 20, borderWidth: 4, borderColor: "#FFC23D" },
  // 메뉴 넷이 한 줄에 들어가게 글을 조금 줄이고 가운데 맞춘다
  menuText: { fontSize: 13, lineHeight: 17, fontWeight: "700", color: "#2B1810", textAlign: "center" },
  menuPrimaryText: { color: "#FFFFFF" }
});
