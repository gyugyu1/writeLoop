import { useCallback, useEffect, useMemo, useState } from "react";
import { buildNowEnglishRecordGroups } from "./records-helpers";
import { getNowInEnglishSummary, type NowInEnglishEntry } from "@/lib/now-in-english";

// 기록 화면의 영어조각(Now in English) 기록: 불러오기, 날짜별 묶음, 처음 한 번 불러오기(E2).
export function useNowEnglishRecords() {
  const [nowEnglishEntries, setNowEnglishEntries] = useState<NowInEnglishEntry[]>([]);
  const [isNowEnglishLoading, setIsNowEnglishLoading] = useState(true);
  const [nowEnglishError, setNowEnglishError] = useState("");

  const nowEnglishRecordGroups = useMemo(
    () => buildNowEnglishRecordGroups(nowEnglishEntries),
    [nowEnglishEntries]
  );

  const loadNowEnglishRecords = useCallback(async () => {
    try {
      setIsNowEnglishLoading(true);
      setNowEnglishError("");
      const summary = await getNowInEnglishSummary();
      setNowEnglishEntries(summary.entries);
    } catch (caughtError) {
      setNowEnglishError(
        caughtError instanceof Error ? caughtError.message : "영어조각 기록을 불러오지 못했어요."
      );
    } finally {
      setIsNowEnglishLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNowEnglishRecords();
  }, [loadNowEnglishRecords]);

  return {
    isNowEnglishLoading,
    loadNowEnglishRecords,
    nowEnglishEntries,
    nowEnglishError,
    nowEnglishRecordGroups
  };
}
