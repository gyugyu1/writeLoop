import { StyleSheet } from "react-native";
import { MOBILE_NAV_BOTTOM_SPACING } from "@/components/mobile-nav-bar";

// 기록 화면(src/app/records.tsx)과 그 조각·상세 모달이 함께 쓰는 스타일.
const baseStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F7F2EB" },
  screen: { flex: 1 },
  loadingState: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: MOBILE_NAV_BOTTOM_SPACING + 28,
    gap: 20
  },
  heroSection: { gap: 10 },
  heroTitle: {
    fontSize: 42,
    lineHeight: 48,
    fontWeight: "900",
    letterSpacing: -1.8,
    color: "#232128"
  },
  heroUnderline: {
    width: 160,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#F2A14A"
  },
  profileCard: {
    backgroundColor: "#FFFEFC",
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: "#E8DACB",
    gap: 12
  },
  name: { fontSize: 28, fontWeight: "900", letterSpacing: -1, color: "#232128" },
  email: { fontSize: 15, color: "#6A5D4E" },
  metricRow: { flexDirection: "row", gap: 10 },
  metricCard: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: "#FBF5EE",
    paddingVertical: 14,
    alignItems: "center",
    gap: 4
  },
  metricValue: { fontSize: 20, fontWeight: "900", color: "#2A2620" },
  metricLabel: { fontSize: 12, fontWeight: "800", color: "#856C53" },
  diaryShortcutButton: {
    marginTop: 2,
    borderRadius: 999,
    backgroundColor: "#FFF4E1",
    borderWidth: 1,
    borderColor: "#EACFA9",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  diaryShortcutButtonText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  diaryShortcutButtonArrow: {
    fontSize: 18,
    fontWeight: "900",
    color: "#A76518"
  },
  emptyCard: {
    backgroundColor: "#FFFEFC",
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: "#E8DACB",
    gap: 14
  },
  emptyTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "900",
    letterSpacing: -1,
    color: "#232128"
  },
  emptyBody: { fontSize: 15, lineHeight: 23, color: "#6A5D4E" },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: "#F5A33B",
    alignSelf: "flex-start"
  },
  primaryButtonText: { fontSize: 16, fontWeight: "900", color: "#232128" },
  outlineButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: "#E2C5A6",
    backgroundColor: "#FFFEFC",
    alignSelf: "flex-start"
  },
  outlineButtonText: { fontSize: 16, fontWeight: "900", color: "#8A5A1E" },
  recordActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  errorText: { fontSize: 14, lineHeight: 20, color: "#B34A2B" }
});
const listStyles = StyleSheet.create({
  contentTabRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  contentTabButton: {
    flexGrow: 1,
    flexBasis: "22%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E3D3BF",
    backgroundColor: "#FFF9F2",
    paddingVertical: 11,
    paddingHorizontal: 10
  },
  contentTabButtonActive: {
    backgroundColor: "#F5A33B",
    borderColor: "#E49A3B"
  },
  contentTabButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#7A6244"
  },
  contentTabButtonTextActive: {
    color: "#232128"
  },
  historyBoard: {
    backgroundColor: "#FFFEFC",
    borderRadius: 32,
    padding: 22,
    borderWidth: 1,
    borderColor: "#E8DACB",
    gap: 16
  },
  sectionHeader: { gap: 6 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  sectionHeaderCopy: {
    flex: 1,
    gap: 6
  },
  sectionTitle: { fontSize: 24, fontWeight: "900", letterSpacing: -1, color: "#232128" },
  sectionMeta: { fontSize: 14, fontWeight: "700", color: "#88745A" },
  savedExpressionControls: {
    gap: 10
  },
  savedExpressionSearchInput: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E3D3BF",
    backgroundColor: "#FFF9F2",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 20,
    color: "#2C2924"
  },
  savedExpressionFilterRow: {
    gap: 8,
    paddingRight: 2
  },
  savedExpressionFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E6D8C7",
    backgroundColor: "#F7EEE4",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  savedExpressionFilterChipActive: {
    borderColor: "#E49A3B",
    backgroundColor: "#F5A33B"
  },
  savedExpressionFilterChipText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#7A6244"
  },
  savedExpressionFilterChipTextActive: {
    color: "#232128"
  },
  savedExpressionFilterChipCount: {
    fontSize: 11,
    fontWeight: "900",
    color: "#A18A72"
  },
  savedExpressionFilterChipCountActive: {
    color: "#232128"
  },
  savedExpressionFilterSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  savedExpressionFilterSummaryGroup: {
    gap: 6
  },
  savedExpressionFilterSummaryText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: "#8A7259",
    fontWeight: "700"
  },
  savedExpressionFilterClearText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#8C6C46",
    fontWeight: "900"
  },
  savedExpressionTagPracticeLink: {
    alignSelf: "flex-start",
    paddingVertical: 2
  },
  savedExpressionTagPracticeLinkText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#8C6C46",
    textDecorationLine: "underline",
    fontWeight: "800"
  },
  savedExpressionTagPracticeLinkTextDisabled: {
    color: "#B3A08B",
    textDecorationLine: "none"
  },
  savedExpressionList: {
    gap: 0
  },
  savedExpressionCard: {
    paddingHorizontal: 0,
    paddingVertical: 16,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E6D8C8"
  },
  savedExpressionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  savedExpressionHeaderAside: {
    alignItems: "flex-end",
    gap: 8
  },
  savedExpressionMetaWrap: {
    flex: 1,
    gap: 8
  },
  savedExpressionText: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    color: "#2A2520"
  },
  savedExpressionBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap"
  },
  savedExpressionSourceBadge: {
    borderRadius: 999,
    backgroundColor: "#FFF0D7",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  savedExpressionSourceBadgeText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#A76518"
  },
  savedExpressionSaveCount: {
    fontSize: 12,
    fontWeight: "800",
    color: "#8A7259"
  },
  savedExpressionDeleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F0C5B4",
    backgroundColor: "#FFF0EA",
    alignItems: "center",
    justifyContent: "center"
  },
  savedExpressionMeaning: {
    fontSize: 14,
    lineHeight: 21,
    color: "#6F5D49",
    fontWeight: "700"
  },
  savedExpressionTagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  savedExpressionTagChip: {
    borderRadius: 999,
    backgroundColor: "#F4EADF",
    borderWidth: 1,
    borderColor: "#E6D8C7",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  savedExpressionTagChipActive: {
    backgroundColor: "#FFF0D7",
    borderColor: "#F0B468"
  },
  savedExpressionTagChipText: {
    fontSize: 11,
    lineHeight: 16,
    color: "#7A6244",
    fontWeight: "800"
  },
  savedExpressionTagChipTextActive: {
    color: "#A76518"
  },
  savedExpressionExample: {
    fontSize: 13,
    lineHeight: 20,
    color: "#866F56"
  },
  savedExpressionExampleHighlight: {
    fontWeight: "900",
    color: "#866F56"
  },
  savedExpressionActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap"
  },
  savedExpressionPromptLink: {
    paddingVertical: 2
  },
  savedExpressionPromptLinkText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#8C6C46",
    textDecorationLine: "underline",
    fontWeight: "700"
  },
  savedExpressionPracticeButton: {
    paddingVertical: 2
  },
  savedExpressionPracticeButtonInline: {
    paddingVertical: 2
  },
  savedExpressionPracticeButtonHidden: {
    display: "none"
  },
  savedExpressionPracticeButtonText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#8C6C46",
    textDecorationLine: "underline",
    fontWeight: "700"
  },
  savedExpressionHistoryButton: {
    alignSelf: "flex-start",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E0D1BD",
    backgroundColor: "#FFFEFC",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  savedExpressionHistoryButtonDisabled: {
    backgroundColor: "#F6F1EB",
    borderColor: "#E7DDD2"
  },
  savedExpressionHistoryButtonText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#7A6244"
  },
  savedExpressionHistoryButtonTextDisabled: {
    color: "#B2A08B"
  },
  savedExpressionPrompt: {
    fontSize: 13,
    lineHeight: 20,
    color: "#7A6244"
  },
  savedExpressionDate: {
    fontSize: 12,
    lineHeight: 18,
    color: "#9A856D",
    textAlign: "right"
  },
  calendarOpenButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E3D3BF",
    backgroundColor: "#FFF9F2",
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  calendarOpenButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#7A6244"
  },
  dateFeed: { gap: 0 },
  showMoreButton: {
    alignSelf: "center",
    marginTop: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E3D3BF",
    backgroundColor: "#FFF9F2",
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  showMoreButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#7A6244"
  },
  dateGroup: {
    backgroundColor: "transparent"
  },
  dateGroupSeparated: {
    borderTopWidth: 1,
    borderTopColor: "#E7D7C4",
    marginTop: 12,
    paddingTop: 12
  },
  dateHeading: {
    paddingHorizontal: 0,
    paddingTop: 6,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  dateHeadingCopy: { flex: 1, gap: 4 },
  dateTitle: { fontSize: 18, fontWeight: "900", color: "#2A2520" },
  dateMeta: { fontSize: 13, fontWeight: "700", color: "#8A765D" },
  dateToggle: { fontSize: 26, lineHeight: 28, fontWeight: "700", color: "#8C5D24" },
  questionStack: { paddingHorizontal: 0, paddingBottom: 0 },
  questionCard: {
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingVertical: 16,
    gap: 10
  },
  questionCardSeparated: {
    borderTopWidth: 1,
    borderTopColor: "#E9DCCF"
  },
  questionCardInteractive: {},
  questionCardPressed: { opacity: 0.72 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  topicChip: {
    borderRadius: 999,
    backgroundColor: "#FFF0D7",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  topicChipText: { fontSize: 12, fontWeight: "900", color: "#A76518" },
  neutralChip: {
    borderRadius: 999,
    backgroundColor: "#EFE7DD",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  neutralChipText: { fontSize: 12, fontWeight: "800", color: "#7C6B57" },
  questionEn: { fontSize: 21, lineHeight: 29, fontWeight: "800", color: "#2A2520" },
  questionKo: { fontSize: 15, lineHeight: 22, color: "#756757" },
  nowRecordCard: {
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingVertical: 16,
    gap: 8
  },
  nowRecordTime: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "900",
    color: "#A26A25"
  },
  nowRecordText: {
    fontSize: 19,
    lineHeight: 28,
    fontWeight: "800",
    color: "#2A2520"
  },
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(35, 33, 40, 0.18)"
  },
  calendarModalBackdrop: {
    ...StyleSheet.absoluteFillObject
  },
  calendarModalFrame: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20
  },
  calendarModalCard: {
    borderRadius: 28,
    backgroundColor: "#FFFDFC",
    borderWidth: 1,
    borderColor: "#E8DACB",
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 14
  },
  calendarModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  calendarMonthNavRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  calendarMonthNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E3D3BF",
    backgroundColor: "#FFF9F2"
  },
  calendarMonthNavButtonDisabled: {
    opacity: 0.35
  },
  calendarMonthNavButtonText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#7A6244"
  },
  calendarMonthNavButtonTextDisabled: {
    color: "#A99987"
  },
  calendarModalTitle: {
    minWidth: 120,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.8,
    color: "#232128",
    textAlign: "center"
  },
  calendarModalCloseButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E3D3BF",
    backgroundColor: "#FFF9F2",
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  calendarModalCloseText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#7A6244"
  },
  calendarWeekHeader: {
    flexDirection: "row"
  },
  calendarWeekLabel: {
    width: "14.2857%",
    textAlign: "center",
    fontSize: 12,
    fontWeight: "800",
    color: "#9C7A49"
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  calendarCellWrap: {
    width: "14.2857%",
    padding: 4
  },
  calendarCell: {
    aspectRatio: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(216, 185, 133, 0.22)"
  },
  calendarCellHasRecords: {
    backgroundColor: "#FFF1D7",
    borderColor: "#EACFA9"
  },
  calendarCellSelected: {
    backgroundColor: "#F2A14A",
    borderColor: "#E09128"
  },
  calendarCellOutside: {
    opacity: 0.42
  },
  calendarCellText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#6E573A"
  },
  calendarCellTextHasRecords: {
    color: "#8A5A1E"
  },
  calendarCellTextSelected: {
    color: "#2E2416"
  },
  calendarCellTextOutside: {
    color: "#BCA98B"
  },
  calendarFooterMeta: {
    fontSize: 13,
    lineHeight: 19,
    color: "#8A765D",
    textAlign: "center"
  }
});
const detailStyles = StyleSheet.create({
  modalSafeArea: { flex: 1, backgroundColor: "#F7F2EB" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E8DACB"
  },
  modalHeaderCopy: { flex: 1, gap: 4 },
  modalTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -1,
    color: "#232128"
  },
  modalCloseButton: {
    borderRadius: 999,
    paddingHorizontal: 4,
    paddingVertical: 6
  },
  modalCloseText: { fontSize: 14, fontWeight: "800", color: "#7B6752" },
  modalContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48 },
  sessionDetailStack: { gap: 16 },
  promptCard: {
    backgroundColor: "#FFFEFC",
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E8DACB",
    gap: 12
  },
  promptQuestionEn: {
    fontSize: 28,
    lineHeight: 38,
    fontWeight: "900",
    letterSpacing: -1.2,
    color: "#232128"
  },
  promptQuestionKo: { fontSize: 15, lineHeight: 23, color: "#6E6153" },
  detailCard: {
    backgroundColor: "#FFFEFC",
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E8DACB",
    gap: 14
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  detailTitle: { flex: 1, fontSize: 20, fontWeight: "900", letterSpacing: -0.6, color: "#232128" },
  detailMeta: { fontSize: 13, fontWeight: "700", color: "#8A765D" },
  detailNoticeCard: {
    backgroundColor: "#FFF8EE",
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E9D8C2",
    gap: 8
  },
  detailNoticeTitle: { fontSize: 18, fontWeight: "900", color: "#232128" },
  detailNoticeBody: { fontSize: 15, lineHeight: 22, color: "#6A5D4E" },
  attemptStack: { gap: 0 },
  attemptCard: {
    paddingVertical: 16,
    gap: 14
  },
  attemptCardInitial: {
    backgroundColor: "transparent"
  },
  attemptCardRewrite: {
    backgroundColor: "transparent"
  },
  attemptCardSeparated: {
    borderTopWidth: 1,
    borderTopColor: "#E8DACB"
  },
  attemptHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  attemptHeaderCopy: { flex: 1, gap: 8 },
  attemptChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  attemptTypeChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  attemptTypeChipInitial: { backgroundColor: "#EFE7DD" },
  attemptTypeChipRewrite: { backgroundColor: "#FFF0D7" },
  attemptTypeChipText: { fontSize: 12, fontWeight: "900" },
  attemptTypeChipTextInitial: { color: "#6F6253" },
  attemptTypeChipTextRewrite: { color: "#A76518" },
  latestChip: {
    borderRadius: 999,
    backgroundColor: "#F5A33B",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  latestChipText: { fontSize: 12, fontWeight: "900", color: "#232128" },
  attemptMeta: { fontSize: 13, fontWeight: "700", color: "#8A765D" },
  inlineButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E0D1BD",
    backgroundColor: "#FFFEFC"
  },
  inlineButtonPressed: { opacity: 0.86 },
  inlineButtonText: { fontSize: 13, fontWeight: "900", color: "#7A6244" },
  attemptAnswer: { fontSize: 16, lineHeight: 24, color: "#2C2924" },
  resumeSessionButton: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "#EF9413",
    paddingHorizontal: 20,
    paddingVertical: 14
  },
  resumeSessionButtonText: { fontSize: 16, fontWeight: "900", color: "#2E2416" }
});

export const styles = {
  ...baseStyles,
  ...listStyles,
  ...detailStyles
};
