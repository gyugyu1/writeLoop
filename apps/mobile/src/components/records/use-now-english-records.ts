import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildNowEnglishRecordGroups } from "./records-helpers";
import { getNowInEnglishSummary, type NowInEnglishEntry } from "@/lib/now-in-english";

// 기록 화면의 영어조각(Now in English) 기록: 불러오기, 날짜별 묶음, 처음과 로그인 사용자가 바뀔 때 불러오기(E2).
// 로그인 사용자가 바뀌기 전에 보낸 요청의 응답은 버린다.
export function useNowEnglishRecords(userId: number | string | null) {
  const [nowEnglishEntries, setNowEnglishEntries] = useState<NowInEnglishEntry[]>([]);
  const [isNowEnglishLoading, setIsNowEnglishLoading] = useState(true);
  const [nowEnglishError, setNowEnglishError] = useState("");
  const userGenerationRef = useRef(0);
  const userIdRef = useRef(userId);

  const nowEnglishRecordGroups = useMemo(
    () => buildNowEnglishRecordGroups(nowEnglishEntries),
    [nowEnglishEntries]
  );

  const loadNowEnglishRecords = useCallback(async () => {
    const generation = userGenerationRef.current;
    const isCurrent = () => generation === userGenerationRef.current;
    try {
      setIsNowEnglishLoading(true);
      setNowEnglishError("");
      const summary = await getNowInEnglishSummary();
      if (!isCurrent()) {
        return;
      }
      setNowEnglishEntries(summary.entries);
    } catch (caughtError) {
      if (!isCurrent()) {
        return;
      }
      setNowEnglishError(
        caughtError instanceof Error ? caughtError.message : "영어조각 기록을 불러오지 못했어요."
      );
    } finally {
      if (isCurrent()) {
        setIsNowEnglishLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (userIdRef.current !== userId) {
      userIdRef.current = userId;
      userGenerationRef.current += 1;
    }
    void loadNowEnglishRecords();
  }, [loadNowEnglishRecords, userId]);

  return {
    isNowEnglishLoading,
    loadNowEnglishRecords,
    nowEnglishEntries,
    nowEnglishError,
    nowEnglishRecordGroups
  };
}
