import { router } from "expo-router";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ModalSafeAreaView from "@/components/modal-safe-area-view";
import { SymbolView } from "expo-symbols";
import MobileNavBar from "@/components/mobile-nav-bar";
import { getDifficultyLabel } from "@/lib/difficulty";
import { buildLoginHref } from "@/lib/login-redirect";
import { formatNowInEnglishTime } from "@/lib/now-in-english";
import {
  INITIAL_VISIBLE_DATE_GROUPS,
  CALENDAR_WEEKDAY_LABELS,
  getLatestAttempt,
  formatHistoryDateHeading,
  getAttemptLabel,
  formatSavedExpressionDate,
  formatSavedExpressionTagLabel,
  getVisibleSavedExpressionTags,
  escapeRegExp,
  getSavedExpressionPromptText,
  resolveSavedExpressionPracticeTarget
} from "./records-helpers";
import type { RecordsScreenValues } from "./records-screen-values";
import { styles } from "./records-styles";

type RecordsProfileCardProps = Pick<
  RecordsScreenValues,
  | "currentUser"
  | "history"
  | "todayStatus"
>;
type RecordsContentTabRowProps = Pick<
  RecordsScreenValues,
  | "activeTab"
  | "setActiveTab"
>;
type RecordsHistoryTabProps = Pick<
  RecordsScreenValues,
  | "groupedHistoryEntries"
  | "handleDateFeedLayout"
  | "handleDateGroupLayout"
  | "handleHistoryBoardLayout"
  | "handleOpenCalendar"
  | "handleOpenSession"
  | "hasMoreHistory"
  | "hiddenDateGroupCount"
  | "history"
  | "isHistoryLoading"
  | "isLoadingMoreHistory"
  | "loadMoreHistory"
  | "openDates"
  | "setOpenDates"
  | "setShowAllDateGroups"
  | "showAllDateGroups"
  | "todayStatus"
  | "visibleGroupedHistoryEntries"
>;
type RecordsNowTabProps = Pick<
  RecordsScreenValues,
  | "isNowEnglishLoading"
  | "nowEnglishEntries"
  | "nowEnglishRecordGroups"
>;
type RecordsSavedExpressionsTabProps = Pick<
  RecordsScreenValues,
  | "deletingSavedExpressionIds"
  | "findHistorySessionForSavedExpression"
  | "handleDeleteSavedExpression"
  | "handleOpenSavedExpressionHistory"
  | "handlePracticeSavedExpression"
  | "handlePracticeSelectedSavedExpressionTag"
  | "handleResetSavedExpressionControls"
  | "handleSelectSavedExpressionTag"
  | "isSavedExpressionsLoading"
  | "normalizedSavedExpressionSearch"
  | "openSavedExpressionPrompts"
  | "savedExpressionSearchQuery"
  | "savedExpressionSectionMeta"
  | "savedExpressionTagOptions"
  | "savedExpressions"
  | "selectedSavedExpressionTag"
  | "selectedSavedExpressionTagLabel"
  | "selectedTagPracticeCandidate"
  | "setSavedExpressionSearchQuery"
  | "toggleSavedExpressionPrompt"
  | "visibleSavedExpressions"
>;
type RecordsErrorMessagesProps = Pick<
  RecordsScreenValues,
  | "activeTab"
  | "historyError"
  | "nowEnglishError"
  | "savedExpressionError"
>;
type RecordsMonthCalendarModalProps = Pick<
  RecordsScreenValues,
  | "canGoToNextCalendarMonth"
  | "canGoToPreviousCalendarMonth"
  | "handleCloseCalendar"
  | "handleSelectCalendarDate"
  | "isCalendarOpen"
  | "monthCalendar"
  | "setCalendarMonthCursor"
>;

// 저장 표현 예문에서 표현 부분을 강조해 그린다(저장 표현 탭의 카드가 쓴다).
function renderSavedExpressionExample(exampleEn?: string | null, expression?: string | null) {
  const trimmedExample = exampleEn?.trim() ?? "";
  const trimmedExpression = expression?.trim() ?? "";

  if (!trimmedExample) {
    return null;
  }

  if (!trimmedExpression) {
    return <Text style={styles.savedExpressionExample}>{trimmedExample}</Text>;
  }

  const expressionPattern = new RegExp(`(${escapeRegExp(trimmedExpression)})`, "gi");
  if (!expressionPattern.test(trimmedExample)) {
    return <Text style={styles.savedExpressionExample}>{trimmedExample}</Text>;
  }

  const segments = trimmedExample.split(expressionPattern);

  return (
    <Text style={styles.savedExpressionExample}>
      {segments.map((segment, index) =>
        index % 2 === 1 ? (
          <Text key={`saved-expression-example-match-${index}`} style={styles.savedExpressionExampleHighlight}>
            {segment}
          </Text>
        ) : (
          segment
        )
      )}
    </Text>
  );
}

// 세션 확인 중 표시
export function RecordsLoadingState() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.screen}>
        <View style={styles.loadingState}>
          <ActivityIndicator color="#E38B12" />
        </View>
        <MobileNavBar activeTab="records" />
      </View>
    </SafeAreaView>
  );
}

// 로그인 안내 카드
export function RecordsLoginCard({ activeTab }: Pick<RecordsScreenValues, "activeTab">) {
  // 로그인 뒤 누른 탭으로 돌아온다. 작문 기록 탭은 탭 없는 주소(기본 탭)로 돌아온다.
  const redirectTo = activeTab === "history" ? "/records" : `/records?tab=${activeTab}`;

  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>로그인이 필요해요</Text>
      <Text style={styles.emptyBody}>
        작문과 일기 기록은 로그인한 뒤 날짜별로 모아볼 수 있어요.
      </Text>
      <Pressable
        style={styles.primaryButton}
        onPress={() => router.push(buildLoginHref(redirectTo))}
      >
        <Text style={styles.primaryButtonText}>로그인 하기</Text>
      </Pressable>
    </View>
  );
}

// 프로필 카드: 이름, 연속·질문·문장 수, 일기 쓰기
export function RecordsProfileCard({
  currentUser,
  history,
  todayStatus
}: RecordsProfileCardProps) {
  return (
    <>
      {currentUser ? (
        <View style={styles.profileCard}>
          <Text style={styles.name}>{currentUser.displayName}</Text>
          <Text style={styles.email}>{currentUser.email}</Text>
          <View style={styles.metricRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{todayStatus?.streakDays ?? 0}</Text>
              <Text style={styles.metricLabel}>연속 루프</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{todayStatus?.totalAnswerSessions ?? history.length}</Text>
              <Text style={styles.metricLabel}>질문 기록</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>
                {(todayStatus?.totalWrittenSentences ?? 0).toLocaleString("ko-KR")}
              </Text>
              <Text style={styles.metricLabel}>총 문장</Text>
            </View>
          </View>

          <Pressable style={styles.diaryShortcutButton} onPress={() => router.push("/diary/write" as never)}>
            <Text style={styles.diaryShortcutButtonText}>오늘 일기 쓰기</Text>
            <Text style={styles.diaryShortcutButtonArrow}>{">"}</Text>
          </Pressable>
        </View>
      ) : null}
    </>
  );
}

// 탭 줄: 영어 답변, 영어조각, 일기, 저장 표현
export function RecordsContentTabRow({
  activeTab,
  setActiveTab
}: RecordsContentTabRowProps) {
  return (
    <View style={styles.contentTabRow}>
      <Pressable
        style={[
          styles.contentTabButton,
          activeTab === "history" && styles.contentTabButtonActive
        ]}
        onPress={() => setActiveTab("history")}
      >
        <Text
          style={[
            styles.contentTabButtonText,
            activeTab === "history" && styles.contentTabButtonTextActive
          ]}
        >
          영어 답변
        </Text>
      </Pressable>
      <Pressable
        style={[
          styles.contentTabButton,
          activeTab === "now" && styles.contentTabButtonActive
        ]}
        onPress={() => setActiveTab("now")}
      >
        <Text
          style={[
            styles.contentTabButtonText,
            activeTab === "now" && styles.contentTabButtonTextActive
          ]}
        >
          영어조각
        </Text>
      </Pressable>
      <Pressable
        style={[
          styles.contentTabButton,
          activeTab === "diary" && styles.contentTabButtonActive
        ]}
        onPress={() => setActiveTab("diary")}
      >
        <Text
          style={[
            styles.contentTabButtonText,
            activeTab === "diary" && styles.contentTabButtonTextActive
          ]}
        >
          일기
        </Text>
      </Pressable>
      <Pressable
        style={[
          styles.contentTabButton,
          activeTab === "expressions" && styles.contentTabButtonActive
        ]}
        onPress={() => setActiveTab("expressions")}
      >
        <Text
          style={[
            styles.contentTabButtonText,
            activeTab === "expressions" && styles.contentTabButtonTextActive
          ]}
        >
          저장 표현
        </Text>
      </Pressable>
    </View>
  );
}

// 작문 기록 탭: 머리와 달력 버튼, 날짜별 묶음, 모두 보기, 더 불러오기
export function RecordsHistoryTab({
  groupedHistoryEntries,
  handleDateFeedLayout,
  handleDateGroupLayout,
  handleHistoryBoardLayout,
  handleOpenCalendar,
  handleOpenSession,
  hasMoreHistory,
  hiddenDateGroupCount,
  history,
  isHistoryLoading,
  isLoadingMoreHistory,
  loadMoreHistory,
  openDates,
  setOpenDates,
  setShowAllDateGroups,
  showAllDateGroups,
  todayStatus,
  visibleGroupedHistoryEntries
}: RecordsHistoryTabProps) {
  return (
    <View style={styles.historyBoard} onLayout={handleHistoryBoardLayout}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderCopy}>
            <Text style={styles.sectionTitle}>날짜별 기록</Text>
            <Text style={styles.sectionMeta}>
              {todayStatus?.totalAnswerSessions ?? history.length}개의 질문
            </Text>
          </View>
          <Pressable style={styles.calendarOpenButton} onPress={handleOpenCalendar}>
            <Text style={styles.calendarOpenButtonText}>달력</Text>
          </Pressable>
        </View>
      </View>

      {isHistoryLoading ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>작문 기록을 불러오고 있어요</Text>
          <Text style={styles.emptyBody}>잠시만 기다려 주세요.</Text>
        </View>
      ) : groupedHistoryEntries.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>아직 기록이 없어요</Text>
          <Text style={styles.emptyBody}>오늘의 질문으로 첫 작문을 시작해 보세요.</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.replace("/")}>
            <Text style={styles.primaryButtonText}>홈으로 가기</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.dateFeed} onLayout={handleDateFeedLayout}>
          {visibleGroupedHistoryEntries.map(({ dateKey, sessions }, groupIndex) => {
            const isOpen = openDates[dateKey] ?? false;

            return (
              <View
                key={dateKey}
                onLayout={(event) => handleDateGroupLayout(dateKey, event)}
                style={[
                  styles.dateGroup,
                  groupIndex > 0 && styles.dateGroupSeparated
                ]}
              >
                <Pressable
                  style={styles.dateHeading}
                  onPress={() =>
                    setOpenDates((current) => ({
                      ...current,
                      [dateKey]: !(current[dateKey] ?? false)
                    }))
                  }
                >
                  <View style={styles.dateHeadingCopy}>
                    <Text style={styles.dateTitle}>{formatHistoryDateHeading(dateKey)}</Text>
                    <Text style={styles.dateMeta}>{`${sessions.length}개 질문`}</Text>
                  </View>
                  <Text style={styles.dateToggle}>{isOpen ? "-" : "+"}</Text>
                </Pressable>

                {isOpen ? (
                  <View style={styles.questionStack}>
                    {sessions.map((session, sessionIndex) => {
                      const latestAttempt = getLatestAttempt(session);

                      return (
                        <Pressable
                          key={session.sessionId}
                          style={({ pressed }) => [
                            styles.questionCard,
                            sessionIndex > 0 && styles.questionCardSeparated,
                            latestAttempt && styles.questionCardInteractive,
                            pressed && latestAttempt && styles.questionCardPressed
                          ]}
                          disabled={!latestAttempt}
                          onPress={() =>
                            latestAttempt ? handleOpenSession(session) : undefined
                          }
                        >
                          <View style={styles.chipRow}>
                            <View style={styles.topicChip}>
                              <Text style={styles.topicChipText}>{session.topic}</Text>
                            </View>
                            <View style={styles.neutralChip}>
                              <Text style={styles.neutralChipText}>
                                {getDifficultyLabel(session.difficulty)}
                              </Text>
                            </View>
                            {latestAttempt ? (
                              <View style={styles.neutralChip}>
                                <Text style={styles.neutralChipText}>
                                  {getAttemptLabel(latestAttempt.attemptType)}
                                </Text>
                              </View>
                            ) : null}
                          </View>

                          <Text style={styles.questionEn}>{session.questionEn}</Text>
                          <Text style={styles.questionKo}>{session.questionKo}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      {groupedHistoryEntries.length > INITIAL_VISIBLE_DATE_GROUPS ? (
        <Pressable
          style={styles.showMoreButton}
          onPress={() => setShowAllDateGroups((current) => !current)}
        >
          <Text style={styles.showMoreButtonText}>
            {showAllDateGroups
              ? "최근 기록만 보기"
              : `전체 보기${hiddenDateGroupCount > 0 ? ` (${hiddenDateGroupCount}일 더)` : ""}`}
          </Text>
        </Pressable>
      ) : null}
      {hasMoreHistory ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isLoadingMoreHistory, busy: isLoadingMoreHistory }}
          disabled={isLoadingMoreHistory}
          style={styles.showMoreButton}
          onPress={() => void loadMoreHistory()}
        >
          <Text style={styles.showMoreButtonText}>
            {isLoadingMoreHistory ? "불러오는 중" : "이전 기록 더 보기"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// 영어일기 탭
export function RecordsDiaryTab() {
  return (
    <View style={styles.historyBoard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderCopy}>
          <Text style={styles.sectionTitle}>영어일기 기록</Text>
          <Text style={styles.sectionMeta}>일기는 날짜별 달력에서 이어서 볼 수 있어요.</Text>
        </View>
      </View>

      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>일기 기록은 일기 달력에 모아둘게요</Text>
        <Text style={styles.emptyBody}>
          긴 글은 일기 화면에서 종이 노트처럼 읽고, 날짜별로 다시 열어볼 수 있어요.
        </Text>
        <View style={styles.recordActionRow}>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push("/diary" as never)}
          >
            <Text style={styles.primaryButtonText}>일기 기록 보기</Text>
          </Pressable>
          <Pressable
            style={styles.outlineButton}
            onPress={() => router.push("/diary/write" as never)}
          >
            <Text style={styles.outlineButtonText}>오늘 일기 쓰기</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// 영어조각(Now in English) 탭
export function RecordsNowTab({
  isNowEnglishLoading,
  nowEnglishEntries,
  nowEnglishRecordGroups
}: RecordsNowTabProps) {
  return (
    <View style={styles.historyBoard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderCopy}>
            <Text style={styles.sectionTitle}>영어조각 기록</Text>
            <Text style={styles.sectionMeta}>{nowEnglishEntries.length}개의 한 줄</Text>
          </View>
          <Pressable style={styles.calendarOpenButton} onPress={() => router.push("/now" as never)}>
            <Text style={styles.calendarOpenButtonText}>지금 쓰기</Text>
          </Pressable>
        </View>
      </View>

      {isNowEnglishLoading ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>영어조각 기록을 불러오고 있어요</Text>
          <Text style={styles.emptyBody}>잠시만 기다려 주세요.</Text>
        </View>
      ) : nowEnglishRecordGroups.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>아직 남긴 영어조각이 없어요</Text>
          <Text style={styles.emptyBody}>
            지금 하고 있는 일이나 떠오른 생각을 한 줄로 먼저 남겨보세요.
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => router.push("/now" as never)}>
            <Text style={styles.primaryButtonText}>지금 쓰기</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.dateFeed}>
          {nowEnglishRecordGroups.map((group, groupIndex) => (
            <View
              key={group.dateKey}
              style={[
                styles.dateGroup,
                groupIndex > 0 && styles.dateGroupSeparated
              ]}
            >
              <View style={styles.dateHeading}>
                <View style={styles.dateHeadingCopy}>
                  <Text style={styles.dateTitle}>{group.label}</Text>
                  <Text style={styles.dateMeta}>{`${group.entries.length}개 한 줄`}</Text>
                </View>
              </View>

              <View style={styles.questionStack}>
                {group.entries.map((entry, entryIndex) => (
                  <View
                    key={entry.id}
                    style={[
                      styles.nowRecordCard,
                      entryIndex > 0 && styles.questionCardSeparated
                    ]}
                  >
                    <Text style={styles.nowRecordTime}>{formatNowInEnglishTime(entry.createdAt)}</Text>
                    <Text style={styles.nowRecordText}>{entry.text}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// 저장 표현 탭: 검색·태그·태그 연습, 표현 카드
export function RecordsSavedExpressionsTab({
  deletingSavedExpressionIds,
  findHistorySessionForSavedExpression,
  handleDeleteSavedExpression,
  handleOpenSavedExpressionHistory,
  handlePracticeSavedExpression,
  handlePracticeSelectedSavedExpressionTag,
  handleResetSavedExpressionControls,
  handleSelectSavedExpressionTag,
  isSavedExpressionsLoading,
  normalizedSavedExpressionSearch,
  openSavedExpressionPrompts,
  savedExpressionSearchQuery,
  savedExpressionSectionMeta,
  savedExpressionTagOptions,
  savedExpressions,
  selectedSavedExpressionTag,
  selectedSavedExpressionTagLabel,
  selectedTagPracticeCandidate,
  setSavedExpressionSearchQuery,
  toggleSavedExpressionPrompt,
  visibleSavedExpressions
}: RecordsSavedExpressionsTabProps) {
  return (
    <View style={styles.historyBoard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderCopy}>
          <Text style={styles.sectionTitle}>저장한 표현</Text>
          <Text style={styles.sectionMeta}>{savedExpressionSectionMeta}</Text>
        </View>
      </View>

      {savedExpressions.length > 0 ? (
        <View style={styles.savedExpressionControls}>
          <TextInput
            value={savedExpressionSearchQuery}
            onChangeText={setSavedExpressionSearchQuery}
            placeholder="표현, 뜻, 예문, 질문, 태그 검색"
            placeholderTextColor="#B9A58C"
            style={styles.savedExpressionSearchInput}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />

          {savedExpressionTagOptions.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.savedExpressionFilterRow}
            >
              {savedExpressionTagOptions.map((tagOption) => {
                const isSelected = selectedSavedExpressionTag === tagOption.tag;

                return (
                  <Pressable
                    key={tagOption.tag}
                    style={[
                      styles.savedExpressionFilterChip,
                      isSelected && styles.savedExpressionFilterChipActive
                    ]}
                    onPress={() => handleSelectSavedExpressionTag(tagOption.tag)}
                  >
                    <Text
                      style={[
                        styles.savedExpressionFilterChipText,
                        isSelected && styles.savedExpressionFilterChipTextActive
                      ]}
                    >
                      {tagOption.label}
                    </Text>
                    <Text
                      style={[
                        styles.savedExpressionFilterChipCount,
                        isSelected && styles.savedExpressionFilterChipCountActive
                      ]}
                    >
                      {tagOption.count}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {normalizedSavedExpressionSearch || selectedSavedExpressionTag ? (
            <View style={styles.savedExpressionFilterSummaryGroup}>
              <View style={styles.savedExpressionFilterSummaryRow}>
                <Text style={styles.savedExpressionFilterSummaryText}>
                  {[
                    normalizedSavedExpressionSearch
                      ? `"${savedExpressionSearchQuery.trim()}" 검색`
                      : null,
                    selectedSavedExpressionTag
                      ? `${selectedSavedExpressionTagLabel} 상단 우선 정렬`
                      : null
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
                <Pressable onPress={handleResetSavedExpressionControls}>
                  <Text style={styles.savedExpressionFilterClearText}>초기화</Text>
                </Pressable>
              </View>

              {selectedSavedExpressionTag ? (
                <Pressable
                  onPress={handlePracticeSelectedSavedExpressionTag}
                  disabled={!selectedTagPracticeCandidate}
                  style={styles.savedExpressionTagPracticeLink}
                >
                  <Text
                    style={[
                      styles.savedExpressionTagPracticeLinkText,
                      !selectedTagPracticeCandidate &&
                        styles.savedExpressionTagPracticeLinkTextDisabled
                    ]}
                  >
                    이 태그로 다시 써보기
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {isSavedExpressionsLoading ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>표현 목록을 불러오고 있어요</Text>
          <Text style={styles.emptyBody}>잠시만 기다려 주세요.</Text>
        </View>
      ) : savedExpressions.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>아직 저장한 표현이 없어요</Text>
          <Text style={styles.emptyBody}>
            피드백 화면이나 AI 코치 추천 카드에서 마음에 드는 표현을 저장해 보세요.
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => router.replace("/")}>
            <Text style={styles.primaryButtonText}>질문 풀러 가기</Text>
          </Pressable>
        </View>
      ) : visibleSavedExpressions.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>검색 결과가 없어요</Text>
          <Text style={styles.emptyBody}>
            다른 검색어로 다시 찾아보거나 태그 정렬을 초기화해 보세요.
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={handleResetSavedExpressionControls}
          >
            <Text style={styles.primaryButtonText}>검색 초기화</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.savedExpressionList}>
          {visibleSavedExpressions.map((item) => {
            const promptText = getSavedExpressionPromptText(item);
            const linkedHistorySession = findHistorySessionForSavedExpression(item);
            const practiceTarget = resolveSavedExpressionPracticeTarget(
              item,
              linkedHistorySession
            );
            const savedExpressionTags = getVisibleSavedExpressionTags(item);
            const isPromptOpen = Boolean(openSavedExpressionPrompts[item.id]);
            const hasLinkedHistory = Boolean(linkedHistorySession);

            return (
              <View key={item.id} style={styles.savedExpressionCard}>
                <View style={styles.savedExpressionHeaderRow}>
                  <View style={styles.savedExpressionMetaWrap}>
                    {savedExpressionTags.length > 0 || item.saveCount > 1 ? (
                      <View style={styles.savedExpressionTagRow}>
                        {savedExpressionTags.map((tag) => {
                          const isSelected = selectedSavedExpressionTag === tag;

                          return (
                            <Pressable
                              key={`${item.id}-${tag}`}
                              style={[
                                styles.savedExpressionTagChip,
                                isSelected && styles.savedExpressionTagChipActive
                              ]}
                              onPress={() => handleSelectSavedExpressionTag(tag, item.id)}
                            >
                              <Text
                                style={[
                                  styles.savedExpressionTagChipText,
                                  isSelected && styles.savedExpressionTagChipTextActive
                                ]}
                              >
                                {formatSavedExpressionTagLabel(tag)}
                              </Text>
                            </Pressable>
                          );
                        })}
                        {item.saveCount > 1 ? (
                          <Text style={styles.savedExpressionSaveCount}>
                            {`${item.saveCount}번 저장`}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
                    <Text style={styles.savedExpressionText}>{item.expression}</Text>
                  </View>

                  <View style={styles.savedExpressionHeaderAside}>
                    <Text style={styles.savedExpressionDate}>
                      {formatSavedExpressionDate(item.lastSavedAt)}
                    </Text>
                    <Pressable
                      style={styles.savedExpressionDeleteButton}
                      onPress={() => handleDeleteSavedExpression(item)}
                      disabled={deletingSavedExpressionIds[item.id] === true}
                    >
                      {deletingSavedExpressionIds[item.id] === true ? (
                        <ActivityIndicator color="#A3371A" size="small" />
                      ) : (
                        <SymbolView
                          name={{ ios: "trash", android: "delete", web: "delete" }}
                          size={16}
                          weight="semibold"
                          tintColor="#B95A36"
                          type="hierarchical"
                        />
                      )}
                    </Pressable>
                  </View>
                </View>

                {item.meaningKo ? (
                  <Text style={styles.savedExpressionMeaning}>{item.meaningKo}</Text>
                ) : null}
                {renderSavedExpressionExample(item.exampleEn, item.expression)}
                {practiceTarget ? (
                  <Pressable
                    style={[
                      styles.savedExpressionPracticeButton,
                      promptText && styles.savedExpressionPracticeButtonHidden
                    ]}
                    onPress={() => handlePracticeSavedExpression(item)}
                  >
                    <Text style={styles.savedExpressionPracticeButtonText}>
                      이 표현으로 한 문장 써보기
                    </Text>
                  </Pressable>
                ) : null}
                {promptText ? (
                  <>
                    <View style={styles.savedExpressionActionRow}>
                    <Pressable
                      style={styles.savedExpressionPromptLink}
                      onPress={() => toggleSavedExpressionPrompt(item.id)}
                    >
                      <Text style={styles.savedExpressionPromptLinkText}>
                        {isPromptOpen
                          ? "질문 숨기기"
                          : "어떤 질문에서 저장했는지 보기"}
                      </Text>
                    </Pressable>
                      {practiceTarget ? (
                        <Pressable
                          style={styles.savedExpressionPracticeButtonInline}
                          onPress={() => handlePracticeSavedExpression(item)}
                        >
                          <Text style={styles.savedExpressionPracticeButtonText}>
                            이 표현으로 한 문장 써보기
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                    {isPromptOpen ? (
                      <>
                        <Text style={styles.savedExpressionPrompt}>{promptText}</Text>
                        <Pressable
                          style={[
                            styles.savedExpressionHistoryButton,
                            !hasLinkedHistory && styles.savedExpressionHistoryButtonDisabled
                          ]}
                          onPress={() => handleOpenSavedExpressionHistory(item)}
                          disabled={!hasLinkedHistory}
                        >
                          <Text
                            style={[
                              styles.savedExpressionHistoryButtonText,
                              !hasLinkedHistory && styles.savedExpressionHistoryButtonTextDisabled
                            ]}
                          >
                            질문 히스토리로 가기
                          </Text>
                        </Pressable>
                      </>
                    ) : null}
                  </>
                ) : null}

              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// 탭마다 오류 문구
export function RecordsErrorMessages({
  activeTab,
  historyError,
  nowEnglishError,
  savedExpressionError
}: RecordsErrorMessagesProps) {
  return (
    <>
      {activeTab === "history" && historyError ? (
        <Text style={styles.errorText}>{historyError}</Text>
      ) : null}
      {activeTab === "expressions" && savedExpressionError ? (
        <Text style={styles.errorText}>{savedExpressionError}</Text>
      ) : null}
      {activeTab === "now" && nowEnglishError ? (
        <Text style={styles.errorText}>{nowEnglishError}</Text>
      ) : null}
    </>
  );
}

// 월 달력 모달
export function RecordsMonthCalendarModal({
  canGoToNextCalendarMonth,
  canGoToPreviousCalendarMonth,
  handleCloseCalendar,
  handleSelectCalendarDate,
  isCalendarOpen,
  monthCalendar,
  setCalendarMonthCursor
}: RecordsMonthCalendarModalProps) {
  return (
    <Modal visible={isCalendarOpen} transparent animationType="fade" onRequestClose={handleCloseCalendar}>
      <View style={styles.calendarModalOverlay}>
        <Pressable style={styles.calendarModalBackdrop} onPress={handleCloseCalendar} />
        <ModalSafeAreaView style={styles.calendarModalFrame}>
          <View style={styles.calendarModalCard}>
            <View style={styles.calendarModalHeader}>
              <View style={styles.calendarMonthNavRow}>
                <Pressable
                  style={[
                    styles.calendarMonthNavButton,
                    !canGoToPreviousCalendarMonth && styles.calendarMonthNavButtonDisabled
                  ]}
                  disabled={!canGoToPreviousCalendarMonth}
                  onPress={() =>
                    setCalendarMonthCursor(
                      (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1, 12)
                    )
                  }
                >
                  <Text
                    style={[
                      styles.calendarMonthNavButtonText,
                      !canGoToPreviousCalendarMonth && styles.calendarMonthNavButtonTextDisabled
                    ]}
                  >
                    {"<"}
                  </Text>
                </Pressable>
                <Text style={styles.calendarModalTitle}>{monthCalendar.monthLabel}</Text>
                <Pressable
                  style={[
                    styles.calendarMonthNavButton,
                    !canGoToNextCalendarMonth && styles.calendarMonthNavButtonDisabled
                  ]}
                  disabled={!canGoToNextCalendarMonth}
                  onPress={() =>
                    setCalendarMonthCursor(
                      (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1, 12)
                    )
                  }
                >
                  <Text
                    style={[
                      styles.calendarMonthNavButtonText,
                      !canGoToNextCalendarMonth && styles.calendarMonthNavButtonTextDisabled
                    ]}
                  >
                    {">"}
                  </Text>
                </Pressable>
              </View>
              <Pressable style={styles.calendarModalCloseButton} onPress={handleCloseCalendar}>
                <Text style={styles.calendarModalCloseText}>닫기</Text>
              </Pressable>
            </View>

            <View style={styles.calendarWeekHeader}>
              {CALENDAR_WEEKDAY_LABELS.map((label) => (
                <Text key={label} style={styles.calendarWeekLabel}>
                  {label}
                </Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {monthCalendar.cells.map((cell) => (
                <View key={cell.key} style={styles.calendarCellWrap}>
                  <Pressable
                    style={[
                      styles.calendarCell,
                      cell.hasRecords && styles.calendarCellHasRecords,
                      cell.isSelected && styles.calendarCellSelected,
                      !cell.isCurrentMonth && styles.calendarCellOutside
                    ]}
                    disabled={!cell.hasRecords}
                    onPress={() => handleSelectCalendarDate(cell.key)}
                  >
                    <Text
                      style={[
                        styles.calendarCellText,
                        cell.hasRecords && styles.calendarCellTextHasRecords,
                        cell.isSelected && styles.calendarCellTextSelected,
                        !cell.isCurrentMonth && styles.calendarCellTextOutside
                      ]}
                    >
                      {cell.dayNumber}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>

            <Text style={styles.calendarFooterMeta}>기록이 있는 날짜만 바로 이동할 수 있어요.</Text>
          </View>
        </ModalSafeAreaView>
      </View>
    </Modal>
  );
}
