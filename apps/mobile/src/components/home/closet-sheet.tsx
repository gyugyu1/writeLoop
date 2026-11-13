import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { AccessibilityInfo, ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError, getWardrobe, saveWardrobeEquipped } from "@/lib/api";
import {
  CLOSET_SLOTS,
  NO_EQUIPPED,
  closetEquipped,
  closetItems,
  closetSelection,
  sameEquipped,
  type ClosetEquipped
} from "@/lib/lobby3d/closet";
import { wearFromEquipped } from "@/lib/lobby3d/wear";
import { wardrobeSlotIcon, wearableIcon } from "@/lib/lobby3d/wearable-icons";
import type { Wardrobe, WardrobeSlot } from "@/lib/types";
import type { ClosetPreviewProps } from "./closet-preview";

// 옷장(캐릭터 꾸미기 화면): 방의 옷장 '들어가기'로 홈 위에 전체 화면으로 열린다.
// 위쪽은 라룹이 미리보기(closet-preview), 아래쪽은 부위 탭과 그 부위의 칸("벗기"와 가진 아이템).
// 칸을 누르면 미리보기 라룹이가 바로 입고, '저장'을 눌러야 서버에 저장한다(성공하면 닫히고 홈이 저장한 옷을 입힌다).
// 바꾼 채로 닫으면 화면 안에서 저장하지 않고 나갈지 묻는다.

const C = {
  bg: "#FFF8EE",
  paper: "#FFFEFB",
  ink: "#3D291C",
  muted: "#796655",
  line: "#E7D9C5",
  soft: "#F4E8D6",
  accent: "#BF4C13",
  button: "#C85720",
  buttonText: "#FFFAF4",
  dim: "rgba(42, 26, 16, 0.45)"
};
const LOAD_FAILED = "옷장을 불러오지 못했어요";
const SAVE_FAILED = "입지 못했어요. 다시 시도해 주세요";
const SAVE_INVALID = "입을 수 없는 아이템이 있어요";

interface ClosetSheetProps {
  visible: boolean;
  /** 닫기(바뀐 것이 없거나 '나가기'), 불러오기·저장이 401일 때. */
  onClose: () => void;
  /** 저장에 성공했을 때(홈이 화면을 닫고 저장한 옷을 바로 입힌다). */
  onSaved: (wardrobe: Wardrobe) => void;
}

type Status = "loading" | "ready" | "error";

/** 미리보기는 3D 모듈을 쓰므로 화면을 열 때 불러온다. */
function loadPreview(): ComponentType<ClosetPreviewProps> | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require("./closet-preview") as { default: ComponentType<ClosetPreviewProps> }).default;
  } catch (error) {
    console.warn("[closet] 미리보기를 불러오지 못했습니다", error);
    return null;
  }
}

export default function ClosetSheet({ visible, onClose, onSaved }: ClosetSheetProps) {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<Status>("loading");
  const [wardrobe, setWardrobe] = useState<Wardrobe | null>(null);
  const [original, setOriginal] = useState<ClosetEquipped>(NO_EQUIPPED);
  const [selected, setSelected] = useState<ClosetEquipped>(NO_EQUIPPED);
  const [tab, setTab] = useState<WardrobeSlot>("hat");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const request = useRef(0);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const Preview = useMemo(() => (visible ? loadPreview() : null), [visible]);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (alive) setReduceMotion(enabled);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  /** 가진 것·입은 것을 불러온다. 고른 것은 서버 값으로 돌아간다. 늦게 온 앞 응답이나 닫은 뒤의 응답은 버린다. */
  const load = useCallback(() => {
    request.current += 1;
    const mine = request.current;
    setStatus("loading");
    Promise.resolve()
      .then(() => getWardrobe())
      .then((result) => {
        if (mine !== request.current || !visibleRef.current) return;
        if (!result) {
          onClose();
          return;
        }
        const equipped = closetEquipped(result);
        setWardrobe(result);
        setOriginal(equipped);
        setSelected(equipped);
        setStatus("ready");
      })
      .catch(() => {
        if (mine === request.current && visibleRef.current) setStatus("error");
      });
  }, [onClose]);

  // 열 때마다 처음 상태로 시작한다(모자 탭, 서버 값)
  useEffect(() => {
    if (!visible) {
      request.current += 1;
      return;
    }
    setWardrobe(null);
    setOriginal(NO_EQUIPPED);
    setSelected(NO_EQUIPPED);
    setTab("hat");
    setSaving(false);
    setMessage(null);
    setConfirming(false);
    load();
  }, [visible, load]);

  const ready = status === "ready";
  const dirty = ready && !sameEquipped(original, selected);
  const items = useMemo(() => closetItems(wardrobe, tab), [wardrobe, tab]);
  const selection = closetSelection(selected, items, tab);
  const tabInfo = CLOSET_SLOTS.find((entry) => entry.slot === tab)!;
  const wear = useMemo(() => wearFromEquipped(selected), [selected]);

  const choose = (type: string | null) => {
    if (!ready || saving) return;
    setMessage(null);
    setSelected((prev) => ({ ...prev, [tab]: type }));
  };

  const handleClose = () => {
    if (saving) return;
    if (confirming) {
      setConfirming(false);
      return;
    }
    if (dirty) {
      setConfirming(true);
      return;
    }
    onClose();
  };

  const handleSave = () => {
    if (!dirty || saving) return;
    setSaving(true);
    setMessage(null);
    const body = selected;
    saveWardrobeEquipped(body)
      .then((result) => {
        if (!visibleRef.current) return;
        setSaving(false);
        onSaved(result);
      })
      .catch((error: unknown) => {
        if (!visibleRef.current) return;
        setSaving(false);
        if (error instanceof ApiError && error.status === 401) {
          onClose();
          return;
        }
        if (error instanceof ApiError && error.code === "WARDROBE_INVALID") {
          setMessage(SAVE_INVALID);
          load();
          return;
        }
        setMessage(error instanceof ApiError && error.message ? error.message : SAVE_FAILED);
      });
  };

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={handleClose} statusBarTranslucent>
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + 8, paddingLeft: Math.max(8, insets.left + 4), paddingRight: Math.max(14, insets.right + 10) }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="옷장 닫기"
            accessibilityState={{ disabled: saving }}
            disabled={saving}
            hitSlop={6}
            style={styles.iconButton}
            onPress={handleClose}
          >
            <Text style={styles.iconText}>✕</Text>
          </Pressable>
          <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
            옷장
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !dirty || saving }}
            disabled={!dirty || saving}
            style={[styles.saveButton, (!dirty || saving) && styles.saveButtonOff]}
            onPress={handleSave}
          >
            {saving ? <ActivityIndicator color={C.buttonText} size="small" /> : null}
            <Text style={[styles.saveText, (!dirty || saving) && styles.saveTextOff]}>저장</Text>
          </Pressable>
        </View>

        <View style={styles.stage}>
          {ready && Preview ? <Preview wear={wear} reduceMotion={reduceMotion} /> : null}
          {status === "loading" ? (
            <View style={styles.center}>
              <ActivityIndicator color={C.accent} />
              <Text style={styles.centerText}>옷장을 여는 중…</Text>
            </View>
          ) : null}
          {status === "error" ? (
            <View style={styles.center}>
              <Text style={styles.centerText}>{LOAD_FAILED}</Text>
              <Pressable accessibilityRole="button" style={styles.retry} onPress={load}>
                <Text style={styles.retryText}>다시 시도</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={[styles.panel, { paddingBottom: insets.bottom + 14 }]}>
          {message ? (
            <Text accessibilityLiveRegion="polite" style={styles.message}>
              {message}
            </Text>
          ) : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" contentContainerStyle={styles.tabs}>
            {CLOSET_SLOTS.map((entry) => {
              const on = entry.slot === tab;
              const off = !ready || saving;
              return (
                <Pressable
                  key={entry.slot}
                  accessibilityRole="tab"
                  accessibilityLabel={entry.label}
                  accessibilityState={{ selected: on, disabled: off }}
                  disabled={off}
                  style={[styles.tab, on && styles.tabOn, off && styles.tabDisabled]}
                  onPress={() => setTab(entry.slot)}
                >
                  <Image source={wardrobeSlotIcon(entry.slot)} style={[styles.tabIcon, { tintColor: on ? C.buttonText : C.ink }]} />
                  <Text style={[styles.tabText, on && styles.tabTextOn]}>{entry.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cells}>
            <Cell label="벗기" selected={selection === null} disabled={!ready || saving} onPress={() => choose(null)} />
            {items.map((item) => (
              <Cell
                key={item.type}
                label={item.label}
                icon={wearableIcon(item.type)}
                selected={selection === item.type}
                disabled={!ready || saving}
                onPress={() => choose(item.type)}
              />
            ))}
            {ready && items.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>{tabInfo.empty}</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>

        {confirming ? (
          <View style={styles.dim}>
            <View accessibilityViewIsModal style={styles.dialog}>
              <Text style={styles.dialogText}>저장하지 않고 나갈까요?</Text>
              <View style={styles.dialogButtons}>
                <Pressable accessibilityRole="button" style={styles.dialogSecondary} onPress={() => setConfirming(false)}>
                  <Text style={styles.dialogSecondaryText}>계속 꾸미기</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  style={styles.dialogPrimary}
                  onPress={() => {
                    setConfirming(false);
                    onClose();
                  }}
                >
                  <Text style={styles.dialogPrimaryText}>나가기</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function Cell({
  label,
  icon,
  selected,
  disabled,
  onPress
}: {
  label: string;
  icon?: ReturnType<typeof wearableIcon>;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      style={[styles.cell, selected && styles.cellOn]}
      onPress={onPress}
    >
      <View style={styles.cellArt}>
        {icon ? <Image source={icon} style={styles.cellImage} resizeMode="contain" /> : <Text style={styles.cellNone}>✕</Text>}
      </View>
      <Text numberOfLines={1} style={[styles.cellText, selected && styles.cellTextOn]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 10, backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.line },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  iconText: { fontSize: 20, color: C.ink },
  title: { flex: 1, fontSize: 20, fontWeight: "700", color: C.ink },
  saveButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 18, height: 40, borderRadius: 20, backgroundColor: C.button },
  saveButtonOff: { backgroundColor: C.soft },
  saveText: { fontSize: 16, fontWeight: "700", color: C.buttonText },
  saveTextOff: { color: C.muted },
  stage: { flex: 1, backgroundColor: "#F3E2CB" },
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 12 },
  centerText: { fontSize: 16, color: C.ink },
  retry: { paddingHorizontal: 20, height: 42, borderRadius: 21, justifyContent: "center", backgroundColor: C.button },
  retryText: { fontSize: 16, fontWeight: "700", color: C.buttonText },
  panel: { backgroundColor: C.paper, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12, gap: 12 },
  message: { marginHorizontal: 16, fontSize: 14, color: C.accent },
  tabs: { paddingHorizontal: 12, gap: 8 },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 38, borderRadius: 19, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg },
  tabOn: { backgroundColor: C.button, borderColor: C.button },
  tabDisabled: { opacity: 0.5 },
  tabIcon: { width: 20, height: 20 },
  tabText: { fontSize: 14, fontWeight: "600", color: C.ink },
  tabTextOn: { color: C.buttonText },
  cells: { paddingHorizontal: 12, gap: 10, minHeight: 124, alignItems: "flex-start" },
  cell: { width: 92, alignItems: "center", gap: 6, padding: 6, borderRadius: 16, borderWidth: 2, borderColor: "transparent" },
  cellOn: { borderColor: C.button, backgroundColor: C.soft },
  cellArt: { width: 76, height: 76, borderRadius: 14, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  cellImage: { width: 72, height: 72 },
  cellNone: { fontSize: 26, color: C.muted },
  cellText: { fontSize: 13, color: C.ink },
  cellTextOn: { fontWeight: "700", color: C.accent },
  empty: { justifyContent: "center", height: 92, paddingHorizontal: 8 },
  emptyText: { fontSize: 14, color: C.muted },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: C.dim, alignItems: "center", justifyContent: "center", padding: 24 },
  dialog: { width: "100%", maxWidth: 340, borderRadius: 20, backgroundColor: C.paper, padding: 20, gap: 18 },
  dialogText: { fontSize: 17, fontWeight: "700", color: C.ink, textAlign: "center" },
  dialogButtons: { flexDirection: "row", gap: 10 },
  dialogSecondary: { flex: 1, height: 46, borderRadius: 23, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  dialogSecondaryText: { fontSize: 16, fontWeight: "600", color: C.ink },
  dialogPrimary: { flex: 1, height: 46, borderRadius: 23, backgroundColor: C.button, alignItems: "center", justifyContent: "center" },
  dialogPrimaryText: { fontSize: 16, fontWeight: "700", color: C.buttonText }
});
