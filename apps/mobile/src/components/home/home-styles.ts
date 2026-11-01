import { StyleSheet } from "react-native";
import { MOBILE_NAV_BOTTOM_SPACING } from "@/components/mobile-nav-bar";

// 홈 화면(src/app/index.tsx)과 그 화면 조각이 함께 쓰는 스타일.
export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F2EB"
  },
  screen: {
    flex: 1
  },
  homeScrollViewport: {
    flex: 1
  },
  homeLoadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: MOBILE_NAV_BOTTOM_SPACING + 4,
    gap: 20
  },
  homeUtilityRow: {
    paddingTop: 4,
    flexDirection: "row",
    justifyContent: "flex-end"
  },
  feedbackEntryButton: {
    minHeight: 42,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2D1BF",
    backgroundColor: "#FFFDFC"
  },
  feedbackEntryButtonText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#352D26"
  },
  heroSection: {
    display: "none",
    gap: 10,
    paddingTop: 8
  },
  difficultySectionHeader: {
    gap: 10
  },
  nowEnglishSection: {
    gap: 12
  },
  nowEnglishHero: {
    borderRadius: 36,
    backgroundColor: "#FDFDFB",
    paddingHorizontal: 24,
    paddingVertical: 26,
    gap: 16,
    shadowColor: "#D18634",
    shadowOpacity: 0.13,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    borderWidth: 1,
    borderColor: "#EBDCCB",
    elevation: 3
  },
  nowEnglishBody: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: "700",
    color: "#756552"
  },
  nowEnglishStatsRow: {
    flexDirection: "row",
    gap: 10
  },
  nowEnglishStatPill: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: "#FFF3E2",
    borderWidth: 1,
    borderColor: "#EED8BF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4
  },
  nowEnglishStatNumber: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "900",
    color: "#E38B12"
  },
  nowEnglishStatLabel: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    color: "#8B6B49"
  },
  nowEnglishActionRow: {
    flexDirection: "row",
    gap: 10
  },
  nowEnglishPrimaryButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 999,
    backgroundColor: "#EA920D",
    alignItems: "center",
    justifyContent: "center"
  },
  nowEnglishPrimaryButtonText: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
    color: "#251809"
  },
  nowEnglishSecondaryButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D9AE7A",
    backgroundColor: "#FFFEFC",
    alignItems: "center",
    justifyContent: "center"
  },
  nowEnglishSecondaryButtonText: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  headerTitleBlock: {
    alignSelf: "flex-start",
    gap: 8
  },
  difficultySectionTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  difficultySectionTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900",
    letterSpacing: -1.4,
    color: "#232128"
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  heroTitle: {
    fontSize: 42,
    lineHeight: 48,
    fontWeight: "900",
    letterSpacing: -1.8,
    color: "#232128"
  },
  guideButton: {
    marginTop: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E6D2BC",
    backgroundColor: "#FFF9F2",
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  guideButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#8A6431"
  },
  heroUnderline: {
    width: 150,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#F2A14A",
    marginLeft: 2
  },
  statusPanel: {
    backgroundColor: "#FDFDFB",
    borderRadius: 34,
    padding: 22,
    gap: 0,
    borderWidth: 1,
    borderColor: "#EBDCCB",
    shadowColor: "#D89A51",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3
  },
  statusPanelMain: {
    gap: 18
  },
  statusLead: {
    flexDirection: "row",
    gap: 18
  },
  statusIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: "#FFF0DD",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  statusMascotImage: {
    width: 84,
    height: 84,
    resizeMode: "contain"
  },
  statusCopy: {
    flex: 1,
    gap: 8
  },
  statusTopRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#2A2620"
  },
  statusBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#FFE7C2",
    borderWidth: 1,
    borderColor: "#F0C586",
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  statusBadgeSecondary: {
    backgroundColor: "#FFF5E8",
    borderColor: "#EAD5B9"
  },
  statusBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    color: "#8A5A1E"
  },
  statusMetaGroup: {
    gap: 2
  },
  statusMeta: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    color: "#6D5E4E"
  },
  statusError: {
    fontSize: 13,
    color: "#B34A2B"
  },
  statusResumeSection: {
    marginTop: 18,
    borderRadius: 20,
    backgroundColor: "#FFF1DB",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4
  },
  resumeActionText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    color: "#9A611E"
  },
  resumeMeta: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
    color: "#8B7761"
  },
  sectionDivider: {
    height: 1,
    backgroundColor: "#E5D4C0",
    marginVertical: 4
  },
  homeDiarySection: {
    gap: 12
  },
  homeDiaryOverviewButton: {
    marginTop: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E4D0B8",
    backgroundColor: "#FFF9F2",
    paddingHorizontal: 13,
    paddingVertical: 9
  },
  homeDiaryOverviewButtonText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#8A6431"
  },
  homeDiaryCalendarCard: {
    borderRadius: 30,
    backgroundColor: "#FFFEFC",
    borderWidth: 1,
    borderColor: "#EADCCB",
    padding: 18,
    gap: 14
  },
  homeDiaryMonthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  homeDiaryMonthButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E4D0B8",
    backgroundColor: "#FFF9F2",
    alignItems: "center",
    justifyContent: "center"
  },
  homeDiaryMonthButtonDisabled: {
    opacity: 0.35
  },
  homeDiaryMonthButtonText: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: "900",
    color: "#8A6431"
  },
  homeDiaryMonthButtonTextDisabled: {
    color: "#BFAE9D"
  },
  homeDiaryMonthTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "900",
    color: "#2A2521"
  },
  homeDiaryLoadingRow: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4
  },
  homeDiaryErrorText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#B34A2B"
  },
  homeDiaryWeekHeader: {
    flexDirection: "row"
  },
  homeDiaryWeekLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "900",
    color: "#A28D78"
  },
  homeDiaryCalendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 8
  },
  homeDiaryCalendarCellWrap: {
    width: "14.285%",
    alignItems: "center"
  },
  homeDiaryCalendarCell: {
    width: 38,
    height: 42,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 2
  },
  homeDiaryCalendarCellOutside: {
    opacity: 0.45
  },
  homeDiaryCalendarCellFuture: {
    opacity: 0.25
  },
  homeDiaryCalendarCellHasEntries: {
    backgroundColor: "#FFF0D7"
  },
  homeDiaryCalendarCellToday: {
    borderWidth: 1,
    borderColor: "#F2A14A"
  },
  homeDiaryCalendarCellText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#5E5247"
  },
  homeDiaryCalendarCellTextOutside: {
    color: "#B4A392"
  },
  homeDiaryCalendarCellTextFuture: {
    color: "#C4B8AC"
  },
  homeDiaryCalendarCellTextHasEntries: {
    color: "#8A5A1E"
  },
  homeDiaryCalendarCellTextToday: {
    color: "#2E2416"
  },
  homeDiaryCalendarDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#A76518"
  },
  homeDiaryWriteButton: {
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: "#EA920D",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2
  },
  homeDiaryWriteButtonText: {
    fontSize: 17,
    fontWeight: "900",
    color: "#24180B"
  },
  featuredRecommendationSection: {
    gap: 12
  },
  featuredRecommendationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  featuredRecommendationLabel: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    color: "#232128",
    letterSpacing: -0.9
  },
  featuredRecommendationDifficultyBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  featuredRecommendationDifficultyText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "900"
  },
  featuredRecommendationCard: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#EADCCB",
    backgroundColor: "#FFFEFC",
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 10,
    shadowColor: "#D89A51",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2
  },
  featuredRecommendationLoadingCard: {
    minHeight: 140,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#EADCCB",
    backgroundColor: "#FFFEFC",
    alignItems: "center",
    justifyContent: "center"
  },
  featuredRecommendationFallbackCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#EADCCB",
    backgroundColor: "#FFFEFC",
    paddingHorizontal: 18,
    paddingVertical: 16
  },
  featuredRecommendationFallbackText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#6F6255"
  },
  featuredRecommendationQuestion: {
    fontSize: 24,
    lineHeight: 33,
    fontWeight: "900",
    color: "#2B2620",
    letterSpacing: -0.9
  },
  featuredRecommendationTranslation: {
    fontSize: 15,
    lineHeight: 22,
    color: "#6E6254"
  },
  featuredRecommendationReason: {
    fontSize: 14,
    lineHeight: 21,
    color: "#8A6431",
    fontWeight: "700"
  },
  featuredRecommendationFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 4
  },
  featuredRecommendationActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  featuredRecommendationMeta: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: "#8B7457",
    fontWeight: "700"
  },
  featuredRecommendationTranslationButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E0D0BC",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FFF9F2"
  },
  featuredRecommendationTranslationButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#7C6545"
  },
  difficultyTutorialSection: {
    gap: 14
  },
  difficultyChoiceHeader: {
    gap: 3
  },
  difficultyChoiceTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    color: "#232128",
    letterSpacing: -0.9
  },
  difficultyChoiceDescription: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
    color: "#7A6A59"
  },
  weekRowButton: {
    marginTop: 18
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  weekChip: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#EDE6DE",
    alignItems: "center",
    justifyContent: "center"
  },
  weekChipDone: {
    backgroundColor: "#FFE8CB"
  },
  weekChipToday: {
    borderWidth: 3,
    borderColor: "#F2C28A",
    backgroundColor: "#FFF8F1"
  },
  weekChipText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#A39A8F"
  },
  weekChipTextDone: {
    color: "#9A6A22"
  },
  weekChipTextToday: {
    color: "#8C6433"
  },
  stageSection: {
    flexGrow: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 18
  },
  difficultyCard: {
    width: "48.5%",
    minHeight: 196,
    backgroundColor: "#FFFEFC",
    borderRadius: 34,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderWidth: 3,
    borderColor: "#F0D8BF",
    alignItems: "center",
    justifyContent: "center",
    gap: 12
  },
  cardTitle: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -1.1,
    color: "#232128"
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    color: "#6B5E4E"
  },
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(36, 27, 17, 0.22)"
  },
  calendarModalBackdrop: {
    ...StyleSheet.absoluteFillObject
  },
  calendarModalFrame: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 24
  },
  calendarModalCard: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#EBDCCB",
    backgroundColor: "#FFFEFC",
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 14
  },
  calendarModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  calendarModalHeaderCopy: {
    flex: 1,
    gap: 4
  },
  calendarMonthNavRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  calendarMonthNavButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E6D2BC",
    backgroundColor: "#FFFEFC",
    alignItems: "center",
    justifyContent: "center"
  },
  calendarMonthNavButtonDisabled: {
    opacity: 0.45
  },
  calendarMonthNavButtonText: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: "900",
    color: "#8A6431"
  },
  calendarMonthNavButtonTextDisabled: {
    color: "#B7A38A"
  },
  calendarModalTitle: {
    flex: 1,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    textAlign: "center",
    color: "#232128"
  },
  calendarModalSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#77695A"
  },
  calendarModalCloseButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E6D2BC",
    backgroundColor: "#FFFEFC",
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  calendarModalCloseText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#8A6431"
  },
  calendarLoadingRow: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4
  },
  calendarErrorText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#B34A2B"
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
    borderWidth: 0,
    borderColor: "transparent",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    position: "relative"
  },
  calendarCellOutside: {
    opacity: 0.45
  },
  calendarCellDiaryOnly: {
    backgroundColor: "transparent"
  },
  calendarCellCompleted: {
    backgroundColor: "transparent"
  },
  calendarCellToday: {
    borderWidth: 1,
    borderColor: "#F2A14A"
  },
  calendarCellText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#5E5247"
  },
  calendarCellTextOutside: {
    color: "#B4A392"
  },
  calendarCellTextCompleted: {
    color: "#5E5247"
  },
  calendarCellTextDiaryOnly: {
    color: "#5E5247"
  },
  calendarCellTextToday: {
    color: "#2E2416"
  },
  calendarActivityMarkers: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 3,
    flexDirection: "row",
    justifyContent: "center",
    gap: 3
  },
  calendarActivityDotSlot: {
    width: 8,
    height: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  calendarActivityDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    borderWidth: 0
  },
  calendarActivityDotWriting: {
    backgroundColor: "#EA920D"
  },
  calendarActivityDotDiary: {
    backgroundColor: "#32835B"
  },
  calendarActivityDotNow: {
    backgroundColor: "#2F74C0"
  },
  calendarActivityLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    marginTop: 4,
    marginBottom: 8
  },
  calendarActivityLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  calendarActivityLegendText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#7A6856"
  },
  calendarFooterMeta: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6D5E4E",
    textAlign: "center"
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
    flex: 1
  },
  guideModalTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -1.2,
    color: "#232128"
  },
  guideModalCloseButton: {
    borderRadius: 999,
    paddingHorizontal: 4,
    paddingVertical: 6
  },
  guideModalCloseText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#7C6545"
  },
  guideModalScroll: {
    flex: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#E8DACB",
    backgroundColor: "#FFF9F2"
  },
  guideModalScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    gap: 18
  },
  guideLeadText: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "800",
    color: "#2A2620"
  },
  guideStepList: {
    gap: 12
  },
  guideStepCard: {
    flexDirection: "row",
    gap: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E8DACB",
    backgroundColor: "#FFFFFF",
    padding: 16
  },
  guideStepIndex: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF0D9"
  },
  guideStepIndexText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#A76518"
  },
  guideStepCopy: {
    flex: 1,
    gap: 6
  },
  guideStepTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#2A2620"
  },
  guideStepBody: {
    fontSize: 15,
    lineHeight: 23,
    color: "#6D5E4E"
  },
  guideTipCard: {
    borderRadius: 26,
    backgroundColor: "#FFF1DB",
    padding: 18,
    gap: 8
  },
  guideTipTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#7E5215"
  },
  guideTipBody: {
    fontSize: 15,
    lineHeight: 23,
    color: "#6C562F"
  }
});
