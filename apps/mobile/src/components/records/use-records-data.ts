import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { HISTORY_PAGE_SIZE } from "./records-helpers";
import { getAnswerHistory, getSavedExpressions, getTodayWritingStatus } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { HistorySession, SavedExpression, TodayWritingStatus } from "@/lib/types";

// 기록 화면의 작문 기록·저장 표현 불러오기: 오늘 상태, 첫 페이지와 이전 기록 더 보기, 저장 표현,
// 로그인 사용자가 바뀔 때 불러오기·비우기(E3), 당겨서 새로고침. 검색·태그·상세 모달 상태는 화면에 있어 setter를 받는다.
// 로그인 사용자(id)가 바뀌기 전에 보낸 요청과, 새로고침 전에 시작한 더 보기 요청의 응답은 버린다.
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
  const userId = currentUser?.id ?? null;
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

  // 로그인 사용자가 바뀔 때마다 1씩 늘린다. 요청을 보낼 때의 값과 응답이 올 때의 값이 다르면 그 응답을 버린다.
  const userGenerationRef = useRef(0);
  const userIdRef = useRef(userId);
  // 더 보기 요청마다, 그리고 새로고침이 시작될 때 1씩 늘린다.
  const moreHistoryRequestRef = useRef(0);

  const loadHistory = useCallback(async () => {
    const generation = userGenerationRef.current;
    const isCurrent = () => generation === userGenerationRef.current;
    try {
      setIsHistoryLoading(true);
      setHistoryError("");
      const [historyResponse, status] = await Promise.all([
        getAnswerHistory({ limit: HISTORY_PAGE_SIZE }),
        getTodayWritingStatus().catch(() => null)
      ]);
      if (!isCurrent()) {
        return;
      }
      setHistory(historyResponse);
      setHasMoreHistory(historyResponse.length >= HISTORY_PAGE_SIZE);
      if (status) {
        setTodayStatus(status);
      }
    } catch (caughtError) {
      if (!isCurrent()) {
        return;
      }
      setHistoryError(
        caughtError instanceof Error ? caughtError.message : "작문 기록을 불러오지 못했어요."
      );
    } finally {
      if (isCurrent()) {
        setIsHistoryLoading(false);
      }
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
    const generation = userGenerationRef.current;
    const request = moreHistoryRequestRef.current + 1;
    moreHistoryRequestRef.current = request;
    const isCurrent = () =>
      generation === userGenerationRef.current && request === moreHistoryRequestRef.current;
    try {
      setIsLoadingMoreHistory(true);
      const nextPage = await getAnswerHistory({ limit: HISTORY_PAGE_SIZE, before: oldestCreatedAt });
      if (!isCurrent()) {
        return;
      }
      setHistory((current) => {
        const knownIds = new Set(current.map((session) => session.sessionId));
        return [...current, ...nextPage.filter((session) => !knownIds.has(session.sessionId))];
      });
      setHasMoreHistory(nextPage.length >= HISTORY_PAGE_SIZE);
      setShowAllDateGroups(true);
    } catch (caughtError) {
      if (!isCurrent()) {
        return;
      }
      setHistoryError(
        caughtError instanceof Error ? caughtError.message : "이전 기록을 불러오지 못했어요."
      );
    } finally {
      if (isCurrent()) {
        setIsLoadingMoreHistory(false);
      }
    }
  }, [isLoadingMoreHistory, oldestCreatedAt, setShowAllDateGroups]);

  const loadSavedExpressions = useCallback(async () => {
    const generation = userGenerationRef.current;
    const isCurrent = () => generation === userGenerationRef.current;
    try {
      setIsSavedExpressionsLoading(true);
      setSavedExpressionError("");
      const response = await getSavedExpressions();
      if (!isCurrent()) {
        return;
      }
      setSavedExpressions(response);
    } catch (caughtError) {
      if (!isCurrent()) {
        return;
      }
      setSavedExpressionError(
        caughtError instanceof Error ? caughtError.message : "저장한 표현을 불러오지 못했어요."
      );
    } finally {
      if (isCurrent()) {
        setIsSavedExpressionsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (userIdRef.current !== userId) {
      userIdRef.current = userId;
      userGenerationRef.current += 1;
      // 앞 사용자의 기록·표현·더 보기 상태는 새 사용자(또는 로그아웃 상태)에게 이어지지 않는다.
      moreHistoryRequestRef.current += 1;
      setTodayStatus(null);
      setHistory([]);
      setHasMoreHistory(false);
      setIsLoadingMoreHistory(false);
      setShowAllDateGroups(false);
      setHistoryError("");
      setSavedExpressions([]);
      setSavedExpressionError("");
      setSavedExpressionSearchQuery("");
      setSelectedSavedExpressionTag(null);
      setSelectedSavedExpressionTagAnchorId(null);
      setSelectedSession(null);
    }

    if (userId === null) {
      setIsHistoryLoading(false);
      setIsSavedExpressionsLoading(false);
      return;
    }

    void loadHistory();
    void loadSavedExpressions();
  }, [
    userId,
    loadHistory,
    loadSavedExpressions,
    setSavedExpressionSearchQuery,
    setSelectedSavedExpressionTag,
    setSelectedSavedExpressionTagAnchorId,
    setSelectedSession,
    setShowAllDateGroups
  ]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // 새로고침 전에 시작한 더 보기 응답은 새 목록에 붙이지 않는다.
    moreHistoryRequestRef.current += 1;
    setIsLoadingMoreHistory(false);
    const startUserId = userIdRef.current;
    const [user] = await Promise.all([refreshSession(), loadNowEnglishRecords()]);
    // 사용자가 바뀌었으면 로그인 사용자 효과가 새 사용자 기준으로 다시 불러온다.
    if (user && user.id === startUserId) {
      await Promise.all([loadHistory(), loadSavedExpressions()]);
    } else if (!user) {
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
