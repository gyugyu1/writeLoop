import { StyleSheet } from "react-native";

// 영어일기 화면(src/components/diary-entry-screen.tsx)과 그 조각·피드백 패널이 함께 쓰는 스타일.
export const styles = StyleSheet.create({
  loopNotice: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FFF1D6",
    borderWidth: 1,
    borderColor: "#E38B12"
  },
  loopNoticeText: { fontSize: 14, fontWeight: "800", color: "#B5650A" },
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F2EB"
  },
  keyboardFrame: {
    flex: 1
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 36,
    gap: 16
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  loginGate: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 14
  },
  loginTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#232128"
  },
  loginBody: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    color: "#756758"
  },
  loadFailedActions: {
    alignSelf: "stretch",
    flexDirection: "row",
    gap: 10,
    marginTop: 6
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.4,
    color: "#2F312D"
  },
  headerSpacer: {
    width: 42,
    height: 42
  },
  headerBackButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center"
  },
  headerBackIcon: {
    fontSize: 28,
    lineHeight: 28,
    fontWeight: "700",
    color: "#4A4033"
  },
  introCard: {
    borderRadius: 28,
    backgroundColor: "#FFF9F2",
    borderWidth: 1,
    borderColor: "#E8D7C4",
    padding: 20,
    gap: 8
  },
  introTitle: {
    fontSize: 24,
    lineHeight: 31,
    fontWeight: "900",
    color: "#25211E",
    letterSpacing: -0.7
  },
  introBody: {
    fontSize: 15,
    lineHeight: 23,
    color: "#746656"
  },
  metaCard: {
    borderRadius: 26,
    backgroundColor: "#FFFEFC",
    borderWidth: 1,
    borderColor: "#EADCCB",
    padding: 18,
    gap: 10
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "900",
    color: "#9A611E"
  },
  metaInput: {
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E4D3BE",
    backgroundColor: "#FFF9F2",
    paddingHorizontal: 14,
    fontSize: 16,
    color: "#2A2620"
  },
  moodRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  moodChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E4D3BE",
    backgroundColor: "#FFF9F2",
    paddingHorizontal: 13,
    paddingVertical: 8
  },
  moodChipActive: {
    borderColor: "#F3A13E",
    backgroundColor: "#FFF0D7"
  },
  moodChipText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#7D6A55"
  },
  moodChipTextActive: {
    color: "#A15F10"
  },
  readMetaCard: {
    borderRadius: 28,
    backgroundColor: "#FFFEFC",
    borderWidth: 1,
    borderColor: "#EADCCB",
    padding: 20,
    gap: 12
  },
  readMetaTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  readMetaEyebrow: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900",
    color: "#9A611E",
    letterSpacing: 1.1
  },
  readMetaDate: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    color: "#8D7A65"
  },
  readMetaTitle: {
    fontSize: 28,
    lineHeight: 35,
    fontWeight: "900",
    color: "#25211E",
    letterSpacing: -0.7
  },
  readMoodRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  readMoodChip: {
    alignSelf: "flex-start",
    minHeight: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E4D3BE",
    backgroundColor: "#FFF9F2",
    paddingHorizontal: 13,
    paddingVertical: 0
  },
  readMoodChipText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "800",
    color: "#7D6A55",
    includeFontPadding: false,
    textAlignVertical: "center"
  },
  readDiaryPaper: {
    borderRadius: 18,
    backgroundColor: "#FFFDF6",
    borderWidth: 1,
    borderColor: "#EEE1CE",
    borderStyle: "dashed",
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 16,
    shadowColor: "#8A6431",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2
  },
  readDiaryLabel: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "900",
    color: "#9A611E"
  },
  readDiaryNotebook: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 14,
    backgroundColor: "#FFFDF7",
    paddingHorizontal: 2,
    paddingTop: 4,
    paddingBottom: 2
  },
  readDiaryNotebookLines: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 28
  },
  readDiaryNotebookLine: {
    height: 30,
    borderTopWidth: 1,
    borderTopColor: "#D8C4AA"
  },
  readDiaryText: {
    fontSize: 18,
    lineHeight: 30,
    color: "#25211E",
    letterSpacing: -0.1,
    paddingBottom: 2
  },
  readDiaryFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  readDiaryWordCount: {
    fontSize: 14,
    fontWeight: "900",
    color: "#8D7A65"
  },
  readDiaryStatus: {
    borderRadius: 999,
    backgroundColor: "#FFF0D7",
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontSize: 13,
    fontWeight: "900",
    color: "#A15F10",
    overflow: "hidden"
  },
  readFeedbackArea: {
    gap: 12
  },
  readFeedbackToggle: {
    minHeight: 56,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E4D3BE",
    backgroundColor: "#FFFEFC",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  readFeedbackToggleText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "900",
    color: "#8A6431"
  },
  readFeedbackToggleIcon: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: "900",
    color: "#A15F10"
  },
  editorCard: {
    position: "relative",
    borderRadius: 0,
    backgroundColor: "transparent",
    borderWidth: 0,
    padding: 0,
    gap: 12
  },
  diaryInputWrap: {
    position: "relative"
  },
  diaryInput: {
    minHeight: 260,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EADCCB",
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 18,
    lineHeight: 26,
    color: "#25211E"
  },
  editorFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  wordCount: {
    fontSize: 13,
    fontWeight: "800",
    color: "#8D7A65"
  },
  diaryCoachTrigger: {
    position: "absolute",
    right: 16,
    bottom: 10,
    alignItems: "flex-end",
    justifyContent: "flex-end",
    minWidth: 58,
    minHeight: 58,
    zIndex: 5
  },
  diaryCoachTriggerWithBubble: {
    minWidth: 204
  },
  diaryCoachBubble: {
    position: "absolute",
    right: 12,
    bottom: 70,
    width: 188,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E6D6C1",
    backgroundColor: "rgba(255, 253, 248, 0.98)",
    paddingHorizontal: 13,
    paddingVertical: 10,
    shadowColor: "#C1761E",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4
  },
  diaryCoachBubbleText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "900",
    color: "#7B5A35"
  },
  diaryCoachBubbleTail: {
    position: "absolute",
    right: 20,
    bottom: -7,
    width: 13,
    height: 13,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E6D6C1",
    backgroundColor: "rgba(255, 253, 248, 0.98)",
    transform: [{ rotate: "45deg" }]
  },
  diaryCoachMascotFrame: {
    width: 58,
    height: 58,
    borderRadius: 999,
    overflow: "hidden",
    shadowColor: "#C1761E",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5
  },
  diaryCoachMascot: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(193, 118, 30, 0.72)",
    backgroundColor: "rgba(255, 255, 255, 0.96)"
  },
  saveDraftButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E4D3BE",
    paddingHorizontal: 13,
    paddingVertical: 8
  },
  saveDraftButtonText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#8A6431"
  },
  feedbackCard: {
    borderRadius: 30,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7D4BE",
    padding: 18,
    gap: 16
  },
  feedbackHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  feedbackHeaderCopy: {
    flex: 1
  },
  feedbackTitle: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "900",
    color: "#25211E"
  },
  scoreBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F2A14A",
    alignItems: "center",
    justifyContent: "center"
  },
  scoreBadgeText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#2A1603"
  },
  feedbackSummary: {
    fontSize: 15,
    lineHeight: 23,
    color: "#6F5E4D"
  },
  feedbackSection: {
    borderTopWidth: 1,
    borderTopColor: "#DECBB5",
    paddingTop: 14,
    gap: 10
  },
  innerDivider: {
    borderTopWidth: 1,
    borderTopColor: "#E1CFBA",
    paddingTop: 14,
    marginTop: 4
  },
  sectionLabel: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    color: "#2A2620"
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8
  },
  sectionHeadingBar: {
    width: 6,
    height: 31,
    borderRadius: 999,
    backgroundColor: "#F2A14A"
  },
  sectionHeadingText: {
    flex: 1,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "900",
    color: "#25211E"
  },
  bulletList: {
    gap: 6
  },
  bulletText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#5B4A3B"
  },
  fixPointCard: {
    paddingBottom: 4,
    gap: 8
  },
  fixPointTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "900",
    color: "#2A2620"
  },
  repairBox: {
    gap: 6
  },
  originalText: {
    borderRadius: 14,
    backgroundColor: "#FFF0EC",
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    lineHeight: 21,
    color: "#A84228"
  },
  revisedText: {
    borderRadius: 14,
    backgroundColor: "#EEF8ED",
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "800",
    color: "#2E6C35"
  },
  diaryRemovedText: {
    color: "#B23A22",
    backgroundColor: "#FFD9D2",
    borderRadius: 6,
    paddingHorizontal: 2,
    fontWeight: "900"
  },
  diaryAddedText: {
    color: "#1F6B32",
    backgroundColor: "#DDF3DF",
    borderRadius: 6,
    paddingHorizontal: 2,
    fontWeight: "900"
  },
  fixPointSupport: {
    fontSize: 14,
    lineHeight: 21,
    color: "#6F5E4D"
  },
  expressionList: {
    gap: 0
  },
  expressionChip: {
    paddingVertical: 2,
    gap: 5
  },
  expressionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  expressionText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "900",
    color: "#2A2620"
  },
  expressionMeaning: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 19,
    color: "#7C6545"
  },
  expressionSaveButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E4D3BE",
    backgroundColor: "#FFF9F2",
    alignItems: "center",
    justifyContent: "center"
  },
  expressionSaveButtonSaved: {
    backgroundColor: "#EAF7ED",
    borderColor: "#AFD2B7"
  },
  ideaCard: {
    paddingBottom: 6,
    gap: 8
  },
  flowGrid: {
    gap: 0
  },
  flowSubCard: {
    paddingBottom: 4,
    gap: 7
  },
  flowSubTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "900",
    color: "#2A2620"
  },
  flowItemText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#6F5E4D"
  },
  flowItemLabel: {
    fontWeight: "900",
    color: "#8A6431"
  },
  ideaTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "900",
    color: "#2A2620"
  },
  ideaNote: {
    fontSize: 14,
    lineHeight: 21,
    color: "#7A6856"
  },
  exampleText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#8B735A",
    fontStyle: "italic"
  },
  variantCard: {
    borderTopWidth: 1,
    borderTopColor: "#DECBB5",
    paddingTop: 14,
    gap: 8
  },
  variantTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#C2761B"
  },
  challengeCard: {
    borderTopWidth: 1,
    borderTopColor: "#DECBB5",
    paddingTop: 14,
    gap: 4
  },
  challengeLabel: {
    fontSize: 13,
    fontWeight: "900",
    color: "#C2761B"
  },
  challengeText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#4D4035"
  },
  coachModalRoot: {
    flex: 1,
    backgroundColor: "#F7F0E7"
  },
  coachModalKeyboardFrame: {
    flex: 1
  },
  coachModalHeader: {
    minHeight: 64,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E6D8C8"
  },
  coachModalTitle: {
    fontSize: 24,
    lineHeight: 31,
    fontWeight: "900",
    color: "#25211E",
    letterSpacing: -0.6
  },
  coachModalCloseButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E4D3BE",
    backgroundColor: "#FFFEFC",
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  coachCloseText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#8A6431"
  },
  coachModalScroll: {
    flex: 1
  },
  coachModalScrollContent: {
    padding: 18,
    paddingBottom: 32
  },
  coachPanel: {
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EADCCB",
    padding: 18,
    gap: 14
  },
  coachInput: {
    minHeight: 112,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#EADCCB",
    backgroundColor: "#FFF9F2",
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 16,
    lineHeight: 23,
    color: "#25211E"
  },
  coachQuickActionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  coachQuickChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E4D3BE",
    backgroundColor: "#FFFEFC",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  coachQuickChipText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: "#7D6A55"
  },
  coachPrimaryButton: {
    minHeight: 54,
    borderRadius: 20,
    backgroundColor: "#F2A14A",
    alignItems: "center",
    justifyContent: "center"
  },
  coachPrimaryButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#21160A"
  },
  coachMetaText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#8D7A65"
  },
  coachErrorText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    color: "#B33A22"
  },
  coachResultStack: {
    gap: 12
  },
  coachReplyCard: {
    borderRadius: 20,
    backgroundColor: "#FFF6E8",
    borderWidth: 1,
    borderColor: "#EAD0A8",
    padding: 14,
    gap: 8
  },
  coachReplyBadge: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "900",
    color: "#9A611E"
  },
  coachReplyText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#4D4035"
  },
  coachExpressionList: {
    gap: 10
  },
  coachExpressionCard: {
    borderRadius: 20,
    backgroundColor: "#FFFEFC",
    borderWidth: 1,
    borderColor: "#EADCCB",
    padding: 14,
    gap: 7
  },
  coachExpressionText: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "900",
    color: "#25211E"
  },
  coachExpressionMeaning: {
    fontSize: 14,
    lineHeight: 20,
    color: "#8A6431"
  },
  coachExpressionTip: {
    fontSize: 14,
    lineHeight: 20,
    color: "#6F5E4D"
  },
  coachExpressionExample: {
    fontSize: 14,
    lineHeight: 20,
    color: "#8B735A",
    fontStyle: "italic"
  },
  coachExpressionActionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4
  },
  coachExpressionInsertButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 16,
    backgroundColor: "#F2A14A",
    alignItems: "center",
    justifyContent: "center"
  },
  coachExpressionInsertButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#21160A"
  },
  coachExpressionSaveButton: {
    minHeight: 42,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E4D3BE",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14
  },
  coachExpressionSaveButtonSaved: {
    backgroundColor: "#EAF7ED",
    borderColor: "#AFD2B7"
  },
  coachExpressionSaveButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#8A6431"
  },
  coachExpressionSaveButtonTextSaved: {
    color: "#2E6C35"
  },
  actionRow: {
    flexDirection: "row",
    gap: 10
  },
  feedbackActionStack: {
    gap: 10
  },
  feedbackSecondaryRow: {
    flexDirection: "row",
    gap: 10
  },
  primaryButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 22,
    backgroundColor: "#F2A14A",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16
  },
  primaryButtonDisabled: {
    opacity: 0.45
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: "900",
    color: "#21160A"
  },
  outlineButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E4D3BE",
    backgroundColor: "#FFFEFC",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16
  },
  outlineButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#8A6431"
  },
  secondaryButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 22,
    backgroundColor: "#F2A14A",
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#21160A"
  },
  ghostButton: {
    minHeight: 56,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E4D3BE",
    backgroundColor: "#FFF9F2",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  ghostButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#8A6431"
  },
  deleteArea: {
    alignItems: "flex-end",
    paddingTop: 2,
    paddingRight: 4
  },
  deleteButtonText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
    color: "#A84228",
    textDecorationLine: "underline"
  },
  deleteButtonTextDisabled: {
    opacity: 0.45
  },
  errorText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#B34A2B"
  }
});
