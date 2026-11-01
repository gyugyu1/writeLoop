import { StyleSheet } from "react-native";
import { MOBILE_NAV_BOTTOM_SPACING } from "@/components/mobile-nav-bar";

// Now in English 화면(src/app/now.tsx)과 그 조각·카드가 함께 쓰는 스타일.
export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F2EB"
  },
  screen: {
    flex: 1
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: MOBILE_NAV_BOTTOM_SPACING + 24,
    gap: 18
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center"
  },
  backButtonText: {
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "900",
    color: "#4A4035"
  },
  headerTitle: {
    fontSize: 23,
    lineHeight: 30,
    fontWeight: "900",
    color: "#2A2521"
  },
  headerSpacer: {
    width: 42
  },
  composerCard: {
    position: "relative",
    borderRadius: 34,
    backgroundColor: "#FDFDFB",
    borderWidth: 1,
    borderColor: "#EBDCCB",
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 0,
    gap: 18,
    overflow: "hidden",
    shadowColor: "#D18634",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2
  },
  heroTitle: {
    fontSize: 29,
    lineHeight: 36,
    letterSpacing: -0.8,
    fontWeight: "900",
    color: "#25211D"
  },
  composerDivider: {
    height: 1,
    backgroundColor: "#EAD8C2"
  },
  polishModeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#F0C993",
    backgroundColor: "#FFF4DF",
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  polishModeCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4
  },
  polishModeLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    color: "#A46412"
  },
  polishModeBody: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800",
    color: "#6A5945"
  },
  polishCancelButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E1B173",
    backgroundColor: "#FFFDF8",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  polishCancelButtonText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  writeSection: {
    gap: 14
  },
  writeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  sectionLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    color: "#C8750D"
  },
  input: {
    minHeight: 230,
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 82,
    fontSize: 21,
    lineHeight: 30,
    fontWeight: "800",
    color: "#2B2620"
  },
  coachTriggerDock: {
    position: "absolute",
    right: 14,
    bottom: 14,
    alignItems: "flex-end",
    justifyContent: "flex-end",
    minWidth: 54,
    minHeight: 54
  },
  coachTriggerDockWithBubble: {
    minWidth: 216
  },
  coachTriggerBubble: {
    position: "absolute",
    right: 44,
    bottom: 48,
    width: 166,
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
    color: "#7B5A35"
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
  statusText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    color: "#2F7A54"
  },
  primaryButton: {
    minHeight: 58,
    borderRadius: 999,
    backgroundColor: "#EA920D",
    alignItems: "center",
    justifyContent: "center"
  },
  primaryButtonText: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900",
    color: "#24180B"
  },
  buttonDisabled: {
    opacity: 0.55
  },
  instantCoachCard: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#EAD8C2",
    backgroundColor: "#FFFDF8",
    paddingHorizontal: 18,
    paddingVertical: 17,
    gap: 11,
    shadowColor: "#D18634",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2
  },
  instantCoachHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  instantCoachKicker: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    color: "#C8750D"
  },
  instantCoachOriginal: {
    borderRadius: 18,
    backgroundColor: "#F7EFE5",
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "800",
    color: "#6A5945"
  },
  instantCoachTitle: {
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
    fontWeight: "900",
    color: "#25211D"
  },
  instantCoachBody: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "800",
    color: "#6A5945"
  },
  instantCoachSuggestionBox: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#F0C993",
    backgroundColor: "#FFF4DF",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 7
  },
  instantCoachLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    color: "#A46412"
  },
  instantCoachSuggestion: {
    fontSize: 17,
    lineHeight: 25,
    fontWeight: "900",
    color: "#2B2620"
  },
  instantCoachSuggestionTranslation: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "800",
    color: "#7A6650"
  },
  instantCoachSection: {
    gap: 6
  },
  instantCoachSectionLabel: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "900",
    color: "#A46612"
  },
  instantCoachSectionBody: {
    fontSize: 15,
    lineHeight: 24,
    color: "#6D6050"
  },
  instantCoachInstruction: {
    fontSize: 16,
    lineHeight: 25,
    fontWeight: "800",
    color: "#3C342B"
  },
  instantCoachExpression: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECD9C1",
    paddingHorizontal: 13,
    paddingVertical: 11,
    gap: 4
  },
  instantCoachExpressionText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "900",
    color: "#2B2620"
  },
  instantCoachExpressionMeaning: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: "#8A5A1E"
  },
  instantCoachExpressionExample: {
    fontSize: 13,
    lineHeight: 19,
    fontStyle: "italic",
    fontWeight: "700",
    color: "#756554"
  },
  instantCoachError: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
    color: "#B84836"
  },
  instantCoachActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  instantCoachRetryButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E1B173",
    backgroundColor: "#FFFDF8",
    paddingHorizontal: 13,
    paddingVertical: 8
  },
  instantCoachRetryButtonText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  instantCoachReviseButton: {
    borderRadius: 999,
    backgroundColor: "#EA920D",
    paddingHorizontal: 15,
    paddingVertical: 9
  },
  instantCoachReviseButtonText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    color: "#24180B"
  },
  instantCoachKeepButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E1B173",
    backgroundColor: "#FFF7E9",
    paddingHorizontal: 13,
    paddingVertical: 8
  },
  instantCoachKeepButtonText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  instantCoachAskButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E1B173",
    backgroundColor: "#FFFDF8",
    paddingHorizontal: 13,
    paddingVertical: 8
  },
  instantCoachAskButtonText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  reflectionStack: {
    gap: 14
  },
  reflectionCard: {
    borderRadius: 30,
    backgroundColor: "#FFFDF8",
    borderWidth: 1,
    borderColor: "#EAD8C2",
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 14,
    shadowColor: "#D18634",
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2
  },
  reflectionKicker: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    color: "#C8750D"
  },
  reflectionTitle: {
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.4,
    fontWeight: "900",
    color: "#27231F"
  },
  reflectionBody: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "800",
    color: "#756554"
  },
  reflectionHighlight: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#F0C993",
    backgroundColor: "#FFF4DF",
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 8
  },
  reflectionHighlightLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    color: "#A46412"
  },
  reflectionSentenceList: {
    gap: 10
  },
  reflectionSentenceItem: {
    gap: 4
  },
  reflectionSentenceItemWithBorder: {
    borderTopWidth: 1,
    borderTopColor: "#F0D5AF",
    paddingTop: 10
  },
  reflectionAiCard: {
    borderRadius: 30,
    backgroundColor: "#FFFDF8",
    borderWidth: 1,
    borderColor: "#EAD8C2",
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 14,
    shadowColor: "#D18634",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2
  },
  reflectionAiHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  reflectionAiKicker: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    color: "#C8750D"
  },
  reflectionAiTitle: {
    fontSize: 22,
    lineHeight: 29,
    letterSpacing: -0.35,
    fontWeight: "900",
    color: "#25211D"
  },
  reflectionAiBody: {
    fontSize: 15,
    lineHeight: 24,
    fontWeight: "800",
    color: "#6D6050"
  },
  reflectionFeedbackBox: {
    borderTopWidth: 1,
    borderTopColor: "#EBD7BF",
    paddingTop: 13,
    gap: 9
  },
  reflectionHighlightItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8
  },
  reflectionHighlightBullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: "hidden",
    textAlign: "center",
    fontSize: 12,
    lineHeight: 22,
    fontWeight: "900",
    color: "#8A5A1E",
    backgroundColor: "#FFF1D9"
  },
  reflectionHighlightItemText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "800",
    color: "#4F4031"
  },
  reflectionPlainSection: {
    borderTopWidth: 1,
    borderTopColor: "#EBD7BF",
    paddingTop: 13,
    gap: 6
  },
  reflectionInsightLabel: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "900",
    color: "#A46612"
  },
  reflectionInsightText: {
    fontSize: 15,
    lineHeight: 24,
    fontWeight: "800",
    color: "#4F4031"
  },
  reflectionNextActionExample: {
    fontSize: 15,
    lineHeight: 22,
    fontStyle: "italic",
    fontWeight: "800",
    color: "#2B2620"
  },
  reflectionAiClosing: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "900",
    color: "#756554"
  },
  reflectionAiError: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
    color: "#B84836"
  },
  reflectionExpressionList: {
    borderTopWidth: 1,
    borderTopColor: "#EBD7BF",
    paddingTop: 13,
    gap: 9
  },
  reflectionExpressionTitle: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  reflectionExpressionCard: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECD9C1",
    paddingHorizontal: 13,
    paddingVertical: 11,
    gap: 4
  },
  reflectionExpressionItemWithBorder: {
    marginTop: 2
  },
  reflectionExpressionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10
  },
  reflectionExpressionText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "900",
    color: "#2B2620"
  },
  reflectionExpressionSaveButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E1B173",
    backgroundColor: "#FFFDF8",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  reflectionExpressionSaveButtonSaved: {
    backgroundColor: "#EA920D",
    borderColor: "#EA920D"
  },
  reflectionExpressionSaveText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  reflectionExpressionSaveTextSaved: {
    color: "#24180B"
  },
  reflectionExpressionMeaning: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: "#8A5A1E"
  },
  reflectionExpressionExample: {
    fontSize: 13,
    lineHeight: 19,
    fontStyle: "italic",
    fontWeight: "700",
    color: "#756554"
  },
  reflectionTime: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    color: "#A26A25"
  },
  reflectionEntryText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "800",
    color: "#3A3128"
  },
  reflectionButton: {
    minHeight: 50,
    borderRadius: 999,
    backgroundColor: "#EA920D",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2
  },
  reflectionButtonText: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
    color: "#24180B"
  },
  reminderSummaryButton: {
    minHeight: 70,
    borderRadius: 24,
    backgroundColor: "#FFFDF8",
    borderWidth: 1,
    borderColor: "#EAD8C2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 14
  },
  reminderSummaryCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3
  },
  reminderSummaryTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
    color: "#2B241D"
  },
  reminderSummaryMeta: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: "#8A7560"
  },
  reminderBadge: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E1C8AA",
    backgroundColor: "#FFF9F2",
    justifyContent: "center",
    minWidth: 54,
    paddingHorizontal: 11,
    paddingVertical: 6
  },
  reminderBadgeOn: {
    borderColor: "#EA920D",
    backgroundColor: "#EA920D"
  },
  reminderBadgeText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#8B6B49"
  },
  reminderBadgeTextOn: {
    color: "#24180B"
  },
  reminderMeta: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  intervalStepper: {
    gap: 8
  },
  intervalStepperLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  intervalStepperControl: {
    width: "100%",
    minHeight: 52,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5C49F",
    backgroundColor: "#FFFEFC",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    gap: 8
  },
  intervalStepperButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF3E2"
  },
  intervalStepperButtonText: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  intervalStepperValue: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
    color: "#2B241D"
  },
  scheduleModeCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#EACBA6",
    backgroundColor: "rgba(255, 253, 248, 0.68)",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12
  },
  scheduleModeHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between"
  },
  scheduleModeCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4
  },
  scheduleModeTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  scheduleModeBody: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    color: "#7B6A58"
  },
  scheduleModeOptions: {
    flexDirection: "row",
    gap: 8
  },
  scheduleModeOption: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#DDBB95",
    backgroundColor: "#FFF9F2",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  scheduleModeOptionActive: {
    borderColor: "#EA920D",
    backgroundColor: "#EA920D"
  },
  scheduleModeOptionText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    color: "#805D37"
  },
  scheduleModeOptionTextActive: {
    color: "#24180B"
  },
  quietHoursCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#EACBA6",
    backgroundColor: "rgba(255, 253, 248, 0.68)",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12
  },
  quietHoursHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  quietHoursCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4
  },
  quietHoursTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  quietHoursBody: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    color: "#7B6A58"
  },
  quietHoursToggle: {
    minWidth: 52,
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E1C8AA",
    backgroundColor: "#FFF9F2",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  quietHoursToggleActive: {
    borderColor: "#EA920D",
    backgroundColor: "#EA920D"
  },
  quietHoursToggleText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    color: "#8B6B49"
  },
  quietHoursToggleTextActive: {
    color: "#24180B"
  },
  quietHourStepperRow: {
    flexDirection: "row",
    gap: 10
  },
  quietHourStepper: {
    flex: 1,
    gap: 7
  },
  quietHourLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    color: "#9A6A22"
  },
  quietHourControl: {
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: "#FFFEFC",
    borderWidth: 1,
    borderColor: "#E5C49F",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    gap: 4
  },
  quietHourButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF3E2"
  },
  quietHourButtonText: {
    fontSize: 17,
    lineHeight: 20,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  quietHourValue: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    color: "#2B241D"
  },
  reminderPowerButton: {
    width: "100%",
    minHeight: 52,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#DDBB95",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF9F2"
  },
  reminderPowerButtonOn: {
    borderColor: "#EA920D",
    backgroundColor: "#EA920D"
  },
  reminderPowerButtonText: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
    color: "#805D37"
  },
  reminderPowerButtonTextOn: {
    color: "#24180B"
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#DDBB95",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF9F2"
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#805D37"
  },
  reminderSettingsOverlay: {
    flex: 1,
    backgroundColor: "rgba(34, 25, 16, 0.35)",
    justifyContent: "flex-end"
  },
  reminderSettingsBackdrop: {
    ...StyleSheet.absoluteFillObject
  },
  reminderSettingsFrame: {
    justifyContent: "flex-end"
  },
  reminderSettingsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 30,
    backgroundColor: "#FFFDF8",
    borderWidth: 1,
    borderColor: "#EBD5B9",
    padding: 22,
    gap: 16,
    shadowColor: "#5E3A12",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8
  },
  reminderSettingsHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  reminderSettingsHeaderCopy: {
    flex: 1,
    gap: 4
  },
  reminderSettingsTitle: {
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "900",
    color: "#27231F",
    letterSpacing: -0.5
  },
  reminderSettingsCloseButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E1C8AA",
    paddingHorizontal: 13,
    paddingVertical: 8,
    backgroundColor: "#FFF9F2"
  },
  reminderSettingsCloseText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#805D37"
  },
  reminderSettingsBody: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
    color: "#6F5E4B"
  },
  reminderSettingsActions: {
    gap: 10
  },
  listSection: {
    gap: 14
  },
  listHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  listHeaderCopy: {
    flex: 1,
    gap: 4
  },
  sectionTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    color: "#27231F"
  },
  listMeta: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    color: "#8A6F52"
  },
  calendarOpenButton: {
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2C5A6",
    backgroundColor: "#FFFEFC",
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  calendarOpenButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  historyTabs: {
    flexDirection: "row",
    borderRadius: 999,
    backgroundColor: "#EFE4D6",
    padding: 4,
    gap: 4
  },
  historyTab: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center"
  },
  historyTabActive: {
    backgroundColor: "#EA920D"
  },
  historyTabText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    color: "#7B6348"
  },
  historyTabTextActive: {
    color: "#24180B"
  },
  timelineList: {
    gap: 18
  },
  timelineGroup: {
    gap: 10
  },
  timelineGroupHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 2
  },
  timelineDateLabel: {
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    color: "#2B2620"
  },
  timelineCount: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: "#9A7140"
  },
  entryList: {
    gap: 10
  },
  entryCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#EAD8C2",
    backgroundColor: "#FFFEFC",
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 8
  },
  entryTime: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "900",
    color: "#A26A25"
  },
  entryText: {
    fontSize: 18,
    lineHeight: 27,
    fontWeight: "800",
    color: "#2B2620"
  },
  inputCounter: {
    position: "absolute",
    left: 22,
    bottom: 18,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    color: "#A89785"
  },
  polishedComparison: {
    gap: 9
  },
  polishedKicker: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    color: "#C8750D"
  },
  polishedRow: {
    gap: 4
  },
  polishedAfterRow: {
    borderTopWidth: 1,
    borderTopColor: "#EBD7BF",
    paddingTop: 9
  },
  polishedLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    color: "#8B6A45"
  },
  polishedBeforeText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "800",
    color: "#8F3D30"
  },
  polishedAfterText: {
    fontSize: 18,
    lineHeight: 27,
    fontWeight: "900",
    color: "#1F6B35"
  },
  emptyListCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#EAD8C2",
    backgroundColor: "#FFFEFC",
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 8
  },
  emptyListTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    color: "#2B2620"
  },
  emptyListBody: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
    color: "#786858"
  },
  coachModalRoot: {
    flex: 1,
    backgroundColor: "#F7F2EB"
  },
  coachModalKeyboardFrame: {
    flex: 1
  },
  coachModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16
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
  coachCloseText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#7C6545"
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
  coachPanelTitle: {
    fontSize: 20,
    lineHeight: 27,
    fontWeight: "900",
    color: "#232128"
  },
  coachInput: {
    minHeight: 96,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7D7C4",
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    lineHeight: 22,
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
    lineHeight: 18,
    fontWeight: "700",
    color: "#6D5A45"
  },
  coachPrimaryButton: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#FFD08A",
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
    marginTop: 4,
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
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(36, 26, 15, 0.36)"
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
    borderRadius: 30,
    backgroundColor: "#FFFEFC",
    borderWidth: 1,
    borderColor: "#EADCCB",
    padding: 18,
    gap: 14,
    shadowColor: "#2A1A0A",
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8
  },
  calendarModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  monthButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#E4D0B8",
    backgroundColor: "#FFF9F2",
    alignItems: "center",
    justifyContent: "center"
  },
  monthButtonText: {
    fontSize: 22,
    lineHeight: 22,
    fontWeight: "900",
    color: "#8A6431"
  },
  monthTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "900",
    color: "#2A2521"
  },
  calendarWeekHeader: {
    flexDirection: "row"
  },
  calendarWeekLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "900",
    color: "#A28D78"
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 8
  },
  calendarCellWrap: {
    width: "14.285%",
    alignItems: "center"
  },
  calendarCell: {
    width: 38,
    height: 42,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 2
  },
  calendarCellOutside: {
    opacity: 0.45
  },
  calendarCellHasEntries: {
    backgroundColor: "#FFF0D7"
  },
  calendarCellToday: {
    borderWidth: 1,
    borderColor: "#F2A14A"
  },
  calendarCellSelected: {
    backgroundColor: "#F2A14A"
  },
  calendarCellText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#5E5247"
  },
  calendarCellTextOutside: {
    color: "#B4A392"
  },
  calendarCellTextHasEntries: {
    color: "#8A5A1E"
  },
  calendarCellTextToday: {
    color: "#2E2416"
  },
  calendarCellTextSelected: {
    color: "#21160A"
  },
  calendarDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#EA920D"
  },
  calendarFooterMeta: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
    color: "#8A6F52"
  },
  calendarCloseButton: {
    minHeight: 46,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2C5A6",
    backgroundColor: "#FFF9F2",
    alignItems: "center",
    justifyContent: "center"
  },
  calendarCloseButtonText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    color: "#8A5A1E"
  }
});
