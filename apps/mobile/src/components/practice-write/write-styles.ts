import { StyleSheet } from "react-native";

// 작문 화면(src/app/practice/write.tsx)과 그 화면 조각이 함께 쓰는 스타일.
export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F2EB"
  },
  keyboardFrame: {
    flex: 1
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 18
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
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
  loadingCard: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center"
  },
  practiceFlowCard: {
    backgroundColor: "transparent",
    borderRadius: 0,
    padding: 0,
    borderWidth: 0,
    gap: 16
  },
  promptSummaryCard: {
    backgroundColor: "transparent",
    borderRadius: 0,
    padding: 0,
    borderWidth: 0,
    gap: 10
  },
  promptSummaryEn: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "800",
    color: "#2B2620"
  },
  promptSummaryKo: {
    fontSize: 15,
    lineHeight: 22,
    color: "#756757"
  },
  tagPracticeCard: {
    gap: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E8D8C5",
    backgroundColor: "#FFF8EF",
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  tagPracticeEyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.3,
    color: "#A56B1F"
  },
  tagPracticeBody: {
    fontSize: 13,
    lineHeight: 19,
    color: "#6B5A46",
    fontWeight: "700"
  },
  tagPracticeExpressionScroller: {
    flexGrow: 0
  },
  tagPracticeExpressionList: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 12
  },
  tagPracticeExpressionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E7D6C1",
    backgroundColor: "#FFFDF9",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  tagPracticeExpressionChipPrimary: {
    borderColor: "#E9AF63",
    backgroundColor: "#FFF1DC"
  },
  tagPracticeExpressionChipText: {
    fontSize: 14,
    lineHeight: 19,
    color: "#5F5244",
    fontWeight: "700"
  },
  tagPracticeExpressionChipTextPrimary: {
    fontSize: 15,
    lineHeight: 21,
    color: "#2C2924",
    fontWeight: "900"
  },
  questionActionRow: {
    display: "none"
  },
  practiceFlowDivider: {
    height: 1,
    backgroundColor: "#EEE0CF"
  },
  promptToolRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 10,
    flexWrap: "wrap"
  },
  translationButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E0D0BC",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF"
  },
  translationButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#7C6545"
  },
  composerCard: {
    backgroundColor: "transparent",
    borderRadius: 0,
    padding: 0,
    borderWidth: 0,
    gap: 16
  },
  rewriteContextCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E8D6BE",
    backgroundColor: "#FFF8EA",
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 8
  },
  rewriteContextEyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
    color: "#A56B1F"
  },
  rewriteContextTitle: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "900",
    color: "#2F2A24"
  },
  rewriteContextBody: {
    fontSize: 14,
    lineHeight: 21,
    color: "#5B4B39"
  },
  rewriteContextButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2CEB3",
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  rewriteContextButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#755E42"
  },
  composerToolRow: {
    display: "none"
  },
  composerToolButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E0D0BC",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FFF9F2"
  },
  composerToolButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#7C6545"
  },
  answerInputFrame: {
    position: "relative",
    minHeight: 252,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7D7C4"
  },
  composerFooterRow: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 60
  },
  composerMetaBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    flex: 1
  },
  composerStatusBadge: {
    borderRadius: 999,
    backgroundColor: "#FFF3DA",
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "800",
    color: "#8E652E",
    overflow: "hidden"
  },
  composerStatusBadgeError: {
    backgroundColor: "#FDE6DF",
    color: "#B34A2B"
  },
  composerWordCount: {
    borderRadius: 999,
    backgroundColor: "#F7EFE6",
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "800",
    color: "#7A6853",
    overflow: "hidden"
  },
  coachTriggerDock: {
    position: "relative",
    alignItems: "flex-end",
    justifyContent: "flex-end",
    minWidth: 54,
    minHeight: 54
  },
  coachTriggerDockWithBubble: {
    paddingTop: 60
  },
  coachTriggerBubble: {
    position: "absolute",
    right: 0,
    bottom: 62,
    width: 156,
    minWidth: 156,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E6D6C1",
    backgroundColor: "rgba(255, 253, 248, 0.98)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: "#C1761E",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4
  },
  coachTriggerBubbleText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800",
    color: "#7B5A35",
    textAlign: "left"
  },
  coachTriggerBubbleTail: {
    position: "absolute",
    right: 18,
    bottom: -7,
    width: 13,
    height: 13,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E6D6C1",
    backgroundColor: "rgba(255, 253, 248, 0.98)",
    transform: [{ rotate: "45deg" }]
  },
  coachTriggerMascotFrame: {
    width: 54,
    height: 54,
    borderRadius: 999,
    overflow: "hidden",
    shadowColor: "#C1761E",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5
  },
  coachTriggerMascot: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(193, 118, 30, 0.72)",
    backgroundColor: "rgba(255, 255, 255, 0.96)"
  },
  guideModalRoot: {
    flex: 1,
    backgroundColor: "#F7F2EB"
  },
  guideModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14
  },
  guideModalHeaderText: {
    gap: 4,
    flex: 1
  },
  guideModalTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -1.2,
    color: "#232128"
  },
  guideModalScroll: {
    flex: 1
  },
  guideModalScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 14
  },
  guideIntroCard: {
    borderRadius: 28,
    backgroundColor: "#FFFEFC",
    borderWidth: 1,
    borderColor: "#E8DACB",
    padding: 20,
    gap: 8
  },
  guideIntroLabel: {
    fontSize: 13,
    fontWeight: "900",
    color: "#A56B1F"
  },
  guideIntroTitle: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "900",
    color: "#232128"
  },
  guideIntroBody: {
    fontSize: 15,
    lineHeight: 23,
    color: "#6D6050"
  },
  guideStarterCard: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F0DFC8",
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  guideStarterText: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "900",
    color: "#2B2620"
  },
  guideHintSection: {
    gap: 12
  },
  guideHintGroups: {
    gap: 14
  },
  guideHintGroup: {
    gap: 8
  },
  guideHintGroupTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#8A6431"
  },
  guideHintWordCardList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  guideHintWordCard: {
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F0DFC8",
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
    maxWidth: "100%"
  },
  guideHintWordLine: {
    fontSize: 14,
    lineHeight: 19
  },
  guideHintWordContent: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
    color: "#2B2620"
  },
  guideHintWordMeaningInline: {
    fontSize: 12,
    lineHeight: 17,
    color: "#7A6A59"
  },
  guideHintPhraseCardList: {
    gap: 10
  },
  guideHintPhraseCard: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F0DFC8",
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  guideHintPhraseLine: {
    fontSize: 15,
    lineHeight: 22
  },
  guideHintPhraseContent: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "800",
    color: "#2B2620"
  },
  guideHintCardMeaningInline: {
    fontSize: 13,
    lineHeight: 19,
    color: "#7A6A59"
  },
  guideHintEmptyText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#8B7761"
  },
  coachModalRoot: {
    flex: 1,
    backgroundColor: "#F7F2EB"
  },
  feedbackModalRoot: {
    flex: 1,
    backgroundColor: "#F7F2EB"
  },
  feedbackModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14
  },
  feedbackModalHeaderText: {
    gap: 4,
    flex: 1
  },
  feedbackModalTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -1.2,
    color: "#232128"
  },
  feedbackModalBody: {
    flex: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#E8DACB",
    backgroundColor: "#FFF9F2",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8
  },
  feedbackModalScroll: {
    flex: 1
  },
  feedbackModalScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28
  },
  feedbackModalEmptyCard: {
    borderRadius: 24,
    backgroundColor: "#FFFEFC",
    borderWidth: 1,
    borderColor: "#E8DACB",
    padding: 18,
    gap: 10
  },
  feedbackModalEmptyTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    color: "#232128"
  },
  feedbackModalEmptyBody: {
    fontSize: 14,
    lineHeight: 21,
    color: "#6D6050"
  },
  coachModalKeyboardFrame: {
    flex: 1
  },
  coachModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14
  },
  coachModalHeaderText: {
    gap: 4,
    flex: 1
  },
  coachModalTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -1.2,
    color: "#232128"
  },
  coachModalCloseButton: {
    borderRadius: 999,
    paddingHorizontal: 4,
    paddingVertical: 6
  },
  coachModalBody: {
    flex: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#E8DACB",
    backgroundColor: "#FFF9F2",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8
  },
  coachModalScroll: {
    flex: 1
  },
  coachModalScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28
  },
  coachPanel: {
    gap: 14
  },
  coachEyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: "#B27B2E"
  },
  coachPanelTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#232128"
  },
  coachCloseText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#7C6545"
  },
  coachInput: {
    minHeight: 88,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7D7C4",
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: "#232128"
  },
  coachQuickActionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  coachQuickChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E0D0BC",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  coachQuickChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6D5A45"
  },
  coachPrimaryButton: {
    borderRadius: 18,
    backgroundColor: "#FFD08A",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  coachPrimaryButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#5A3A00"
  },
  coachMetaText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#7A6B58"
  },
  coachErrorText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#B34A2B"
  },
  coachResultStack: {
    gap: 12
  },
  coachReplyCard: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7D7C4",
    padding: 16,
    gap: 8
  },
  coachReplyBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#FFF0D7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "900",
    color: "#A76518"
  },
  coachReplyText: {
    fontSize: 15,
    lineHeight: 23,
    color: "#2F2A23"
  },
  coachExpressionList: {
    gap: 10
  },
  coachExpressionCard: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7D7C4",
    padding: 16,
    gap: 8
  },
  coachExpressionActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4
  },
  coachExpressionTop: {
    gap: 4
  },
  coachExpressionText: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "900",
    color: "#2A2620"
  },
  coachExpressionMeaning: {
    fontSize: 13,
    lineHeight: 19,
    color: "#8C7355"
  },
  coachExpressionTip: {
    fontSize: 14,
    lineHeight: 21,
    color: "#5D5143"
  },
  coachExpressionExample: {
    fontSize: 13,
    lineHeight: 20,
    color: "#8A775E"
  },
  coachExpressionInsertButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#FFF4E2",
    borderWidth: 1,
    borderColor: "#EBCB97",
    paddingVertical: 12
  },
  coachExpressionInsertButtonText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#8A5A19"
  },
  coachExpressionSaveButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#FFFBF4",
    borderWidth: 1,
    borderColor: "#E3C39B",
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  coachExpressionSaveButtonSaved: {
    backgroundColor: "#EAF7ED",
    borderColor: "#AFD2B7"
  },
  coachExpressionSaveButtonText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#8A5A19"
  },
  coachExpressionSaveButtonTextSaved: {
    color: "#2F7A46"
  },
  answerInput: {
    minHeight: 252,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 92,
    fontSize: 16,
    color: "#232128"
  },
  answerInputDisabled: {
    color: "#7B6B59"
  },
  submitButton: {
    borderRadius: 22,
    backgroundColor: "#E38B12",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#2E2416"
  },
  cancelWritingButton: {
    borderRadius: 22,
    backgroundColor: "#FFFCF7",
    borderWidth: 1,
    borderColor: "#E4CDB4",
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center"
  },
  cancelWritingButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#8F5D35"
  },
  disabledButton: {
    opacity: 0.7
  },
  errorText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#B34A2B"
  },
  emptyStateCard: {
    backgroundColor: "#FFFEFC",
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: "#E8DACB",
    gap: 14
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -1,
    color: "#232128"
  },
  emptyStateBody: {
    fontSize: 15,
    lineHeight: 23,
    color: "#6D6050"
  }
});
