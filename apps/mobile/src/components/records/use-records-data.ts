import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { HISTORY_PAGE_SIZE } from "./records-helpers";
import { getAnswerHistory, getSavedExpressions, getTodayWritingStatus } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { HistorySession, SavedExpression, TodayWritingStatus } from "@/lib/types";

// 기록 화면의 작문 기록·저장 표현 불러오기: 오늘 상태, 첫 페이지와 이전 기록 더 보기, 저장 표현,
// 로그인이 바뀔 때 불러오기·비우기(E3), 당겨서 새로고침. 검색·태그·상세 모달 상태는 화면에 있어 setter를 받는다.
export function useRecordsData({
  currentUser,
  loadNowEnglishRecords,
  refreshSession,
  setSavedExpressionSearchQuery,
  setSelectedSavedExpressionTag,
  setSelectedSavedExpressionTagAnchorId,
  setSelectedSession,
  setShowAllDateGroups
}: {
  currentUser: ReturnType<typeof useSession>["currentUser"];
  loadNowEnglishRecords: () => Promise<void>;
  refreshSession: ReturnType<typeof useSession>["refreshSession"];
  setSavedExpressionSearchQuery: Dispatch<SetStateAction<string>>;
  setSelectedSavedExpressionTag: Dispatch<SetStateAction<string | null>>;
  setSelectedSavedExpressionTagAnchorId: Dispatch<SetStateAction<number | null>>;
  setSelectedSession: Dispatch<SetStateAction<HistorySession | null>>;
  setShowAllDateGroups: Dispatch<SetStateAction<boolean>>;
}) {
  const [todayStatus, setTodayStatus] = useState<TodayWritingStatus | null>(null);
  const [history, setHistory] = useState<HistorySession[]>([]);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [isLoadingMoreHistory, setIsLoadingMoreHistory] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [savedExpressions, setSavedExpressions] = useState<SavedExpression[]>([]);
  const [isSavedExpressionsLoading, setIsSavedExpressionsLoading] = useState(false);
  const [savedExpressionError, setSavedExpressionError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const loadHistory = useCallback(async () => {
    try {
      setIsHistoryLoading(true);
      setHistoryError("");
      const [historyResponse, status] = await Promise.all([
        getAnswerHistory({ limit: HISTORY_PAGE_SIZE }),
        getTodayWritingStatus().catch(() => null)
      ]);
      setHistory(historyResponse);
      setHasMoreHistory(historyResponse.length >= HISTORY_PAGE_SIZE);
      setTodayStatus(status);
    } catch (caughtError) {
      setHistoryError(
        caughtError instanceof Error ? caughtError.message : "작문 기록을 불러오지 못했어요."
      );
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  const oldestCreatedAt = history.reduce<string | null>(
    (oldest, session) => (!oldest || session.createdAt < oldest ? session.createdAt : oldest),
    null
  );

  const loadMoreHistory = useCallback(async () => {
    if (!oldestCreatedAt || isLoadingMoreHistory) {
      return;
    }
    try {
      setIsLoadingMoreHistory(true);
      const nextPage = await getAnswerHistory({ limit: HISTORY_PAGE_SIZE, before: oldestCreatedAt });
      setHistory((current) => {
        const knownIds = new Set(current.map((session) => session.sessionId));
        return [...current, ...nextPage.filter((session) => !knownIds.has(session.sessionId))];
      });
      setHasMoreHistory(nextPage.length >= HISTORY_PAGE_SIZE);
      setShowAllDateGroups(true);
    } catch (caughtError) {
      setHistoryError(
        caughtError instanceof Error ? caughtError.message : "이전 기록을 불러오지 못했어요."
      );
    } finally {
      setIsLoadingMoreHistory(false);
    }
  }, [isLoadingMoreHistory, oldestCreatedAt, setShowAllDateGroups]);

  const loadSavedExpressions = useCallback(async () => {
    try {
      setIsSavedExpressionsLoading(true);
      setSavedExpressionError("");
      const response = await getSavedExpressions();
      setSavedExpressions(response);
    } catch (caughtError) {
      setSavedExpressionError(
        caughtError instanceof Error ? caughtError.message : "저장한 표현을 불러오지 못했어요."
      );
    } finally {
      setIsSavedExpressionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setIsHistoryLoading(false);
      setIsSavedExpressionsLoading(false);
      setTodayStatus(null);
      setHistory([]);
      setHistoryError("");
      setSavedExpressions([]);
      setSavedExpressionError("");
      setSavedExpressionSearchQuery("");
      setSelectedSavedExpressionTag(null);
      setSelectedSavedExpressionTagAnchorId(null);
      setSelectedSession(null);
      return;
    }

    void loadHistory();
    void loadSavedExpressions();
  }, [
    currentUser,
    loadHistory,
    loadSavedExpressions,
    setSavedExpressionSearchQuery,
    setSelectedSavedExpressionTag,
    setSelectedSavedExpressionTagAnchorId,
    setSelectedSession
  ]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    const [user] = await Promise.all([refreshSession(), loadNowEnglishRecords()]);
    if (user) {
      await Promise.all([loadHistory(), loadSavedExpressions()]);
    } else {
      setSavedExpressions([]);
    }
    setIsRefreshing(false);
  }, [loadHistory, loadNowEnglishRecords, loadSavedExpressions, refreshSession]);

  return {
    handleRefresh,
    hasMoreHistory,
    history,
    historyError,
    isHistoryLoading,
    isLoadingMoreHistory,
    isRefreshing,
    isSavedExpressionsLoading,
    loadMoreHistory,
    savedExpressionError,
    savedExpressions,
    setSavedExpressions,
    todayStatus
  };
}
