import { StyleSheet } from "react-native";

// 피드백 화면(src/app/practice/feedback.tsx)과 그 화면 조각이 함께 쓰는 스타일.
export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F2EB"
  },
  keyboardFrame: {
    flex: 1
  },
  screen: {
    flex: 1,
    position: "relative"
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 180,
    gap: 16
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
  strengthCard: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#E9D9C6",
    backgroundColor: "#FFFEFC",
    paddingHorizontal: 22,
    paddingVertical: 24,
    gap: 14,
    shadowColor: "#C58A43",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 8
    },
    elevation: 2
  },
  strengthLabel: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "900",
    letterSpacing: -1.4,
    color: "#232128"
  },
  strengthText: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: "800",
    color: "#3D342B"
  },
  modelAnswerCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E5D4BE",
    backgroundColor: "#FFFCF7",
    overflow: "hidden"
  },
  modelAnswerToggle: {
    minHeight: 72,
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  modelAnswerEyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    color: "#A56A1C"
  },
  modelAnswerTitle: {
    marginTop: 2,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    color: "#3D3227"
  },
  modelAnswerToggleIcon: {
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "500",
    color: "#A56A1C"
  },
  modelAnswerBody: {
    borderTopWidth: 1,
    borderTopColor: "#EEDFCB",
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 8
  },
  modelAnswerEn: {
    fontSize: 17,
    lineHeight: 27,
    fontWeight: "800",
    color: "#382F27"
  },
  modelAnswerKo: {
    fontSize: 14,
    lineHeight: 22,
    color: "#826E58"
  },
  stickyTabOverlay: {
    position: "absolute",
    top: 8,
    left: 20,
    right: 20,
    zIndex: 20
  },
  stickyTabBar: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 6,
    backgroundColor: "#F7F2EB"
  },
  stickyTabButton: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2D4C3",
    backgroundColor: "#FFFBF4",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#D89A51",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 4
    },
    elevation: 2
  },
  stickyTabButtonActive: {
    backgroundColor: "#F2A14A",
    borderColor: "#E09128"
  },
  stickyTabButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#7A6244"
  },
  stickyTabButtonTextActive: {
    color: "#2E2416"
  },
  coachMoveCard: {
    backgroundColor: "#FFFEFC",
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#E9D9C6",
    paddingHorizontal: 22,
    paddingVertical: 24,
    gap: 16,
    shadowColor: "#C58A43",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 8
    },
    elevation: 2
  },
  coachMoveHeadline: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "900",
    letterSpacing: -1.4,
    color: "#232128"
  },
  enrichmentEyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    color: "#A56A1C"
  },
  enrichmentHeadline: {
    marginTop: -8,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "900",
    letterSpacing: -0.8,
    color: "#232128"
  },
  coachMoveBody: {
    gap: 12
  },
  coachMoveSwap: {
    gap: 10
  },
  coachMoveSwapRow: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 7
  },
  coachMoveBeforeRow: {
    backgroundColor: "#FDEDE9"
  },
  coachMoveAfterRow: {
    backgroundColor: "#EAF7EA"
  },
  coachMoveSwapLabel: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "900",
    color: "#8B6A45"
  },
  coachMoveBefore: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "800",
    color: "#A23B2B"
  },
  coachMoveBeforeHighlight: {
    backgroundColor: "#F8CFC7",
    color: "#8F2F23",
    fontWeight: "900"
  },
  coachMoveAfter: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "900",
    color: "#1F6B35"
  },
  coachMoveAfterHighlight: {
    backgroundColor: "#BDEAC7",
    color: "#145F2A",
    fontWeight: "900"
  },
  languageCorrectionList: {
    gap: 10
  },
  languageCorrectionItem: {
    gap: 9,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EADBC8",
    backgroundColor: "#FFFFFF",
    padding: 14
  },
  languageCorrectionBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  languageCorrectionBadgeStructure: {
    backgroundColor: "#F7E4C5"
  },
  languageCorrectionBadgeCore: {
    backgroundColor: "#F8D8D1"
  },
  languageCorrectionBadgeDetail: {
    backgroundColor: "#DCEEE5"
  },
  languageCorrectionBadgeText: {
    color: "#47382B",
    fontSize: 12,
    fontWeight: "900"
  },
  languageCorrectionSwap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 7
  },
  languageCorrectionBefore: {
    color: "#9B3B2E",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "800",
    textDecorationLine: "line-through"
  },
  languageCorrectionArrow: {
    color: "#A67A48",
    fontSize: 15,
    fontWeight: "900"
  },
  languageCorrectionAfter: {
    color: "#1F6B35",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "900"
  },
  languageCorrectionReason: {
    color: "#67594B",
    fontSize: 14,
    lineHeight: 21
  },
  languageCorrectionToggle: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DDBB8E",
    backgroundColor: "#FFF9F0",
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  languageCorrectionTogglePressed: {
    opacity: 0.72
  },
  languageCorrectionReveal: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#DDBB8E",
    backgroundColor: "#FFF9F0",
    paddingHorizontal: 12,
    paddingVertical: 4
  },
  languageCorrectionToggleText: {
    color: "#8D5617",
    fontSize: 14,
    fontWeight: "900"
  },
  coachMoveWhyBox: {
    gap: 6
  },
  coachMoveWhyLabel: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "900",
    color: "#A46612"
  },
  coachMoveWhy: {
    fontSize: 15,
    lineHeight: 24,
    color: "#6D6050"
  },
  coachMoveInstructionBox: {
    paddingVertical: 2,
    gap: 8
  },
  coachMoveInstructionLabel: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "900",
    color: "#A46612"
  },
  coachMoveInstruction: {
    fontSize: 16,
    lineHeight: 25,
    fontWeight: "800",
    color: "#3C342B"
  },
  coachMoveSkeletonBox: {
    marginTop: 2,
    gap: 4
  },
  coachMoveSkeletonLabel: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "900",
    color: "#A46612"
  },
  coachMoveSkeleton: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "800",
    color: "#5A4630"
  },
  coachMoveSkeletonMeaning: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
    color: "#8B7358"
  },
  coachMovePhraseBox: {
    marginTop: 6,
    gap: 8
  },
  coachMovePhraseLabel: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "900",
    color: "#A46612"
  },
  coachMovePhraseList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  coachMovePhraseChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E7CDAA",
    backgroundColor: "#FFF9EF",
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  coachMovePhraseChipSaved: {
    backgroundColor: "#EAF7ED",
    borderColor: "#AFD2B7"
  },
  coachMovePhraseContent: {
    gap: 2,
    flexShrink: 1
  },
  coachMovePhraseText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    color: "#6B5138"
  },
  coachMovePhraseMeaning: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    color: "#9A8066"
  },
  coachMovePhraseSaveText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "900",
    color: "#A76518"
  },
  coachMovePhraseSaveTextSaved: {
    color: "#2F7A46"
  },
  coachMovePhraseSaveButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E3C39B",
    backgroundColor: "#FFFBF4",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  },
  coachMovePhraseSaveButtonSaved: {
    backgroundColor: "#EAF7ED",
    borderColor: "#AFD2B7"
  },
  coachMoveSuccessBox: {
    gap: 6
  },
  coachMoveSuccessLabel: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "900",
    color: "#A46612"
  },
  coachMoveSuccess: {
    fontSize: 14,
    lineHeight: 22,
    color: "#7B6A55"
  },
  detailToggleButton: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#D8B17A",
    backgroundColor: "#FFFBF4",
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center"
  },
  detailToggleButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#8A5A19"
  },
  inlineRewriteCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#E8DACB",
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 13
  },
  inlineRewriteHelp: {
    fontSize: 15,
    lineHeight: 23,
    color: "#6D6050"
  },
  inlineRewriteInput: {
    minHeight: 170,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E1D0BC",
    backgroundColor: "#FFFCF7",
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 17,
    lineHeight: 26,
    color: "#2F2A24",
    fontWeight: "600"
  },
  inlineRewriteError: {
    fontSize: 14,
    lineHeight: 20,
    color: "#B6402D",
    fontWeight: "800"
  },
  completionFooter: {
    gap: 14
  },
  completionCard: {
    paddingTop: 4
  },
  completionSuggestionBox: {
    backgroundColor: "#FFFEFC",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E8DACB",
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 10
  },
  completionSuggestionLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    color: "#A46612"
  },
  completionSuggestionList: {
    gap: 8
  },
  completionSuggestionChip: {
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E7CDAA",
    backgroundColor: "#FFF9EF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  completionSpeechRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 14
  },
  completionBubbleWrap: {
    flex: 1
  },
  completionBubble: {
    backgroundColor: "#FFFEFC",
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "#F2994A",
    paddingHorizontal: 22,
    paddingVertical: 20
  },
  completionHeadline: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "900",
    color: "#2F312D"
  },
  completionMascotFrame: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 2,
    borderColor: "#E0A45E",
    backgroundColor: "#FFFEFC",
    alignItems: "center",
    justifyContent: "center",
    padding: 3,
    flexShrink: 0
  },
  completionMascot: {
    width: 104,
    height: 104,
    resizeMode: "contain"
  },
  primaryButton: {
    borderRadius: 22,
    backgroundColor: "#E38B12",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryButtonDisabled: {
    opacity: 0.58
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#2E2416"
  },
  secondaryButton: {
    borderRadius: 22,
    backgroundColor: "#FFFBF4",
    borderWidth: 1,
    borderColor: "#D8B17A",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#8A5A19"
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
