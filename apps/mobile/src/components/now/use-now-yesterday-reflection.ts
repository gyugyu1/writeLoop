import { useCallback, useEffect, useRef, useState } from "react";
import { requestNowInEnglishReflection } from "@/lib/api";
import {
  getNowInEnglishAiReflection,
  saveNowInEnglishAiReflection,
  type NowInEnglishAiReflection,
  type NowInEnglishEntry
} from "@/lib/now-in-english";

// Now in English 화면의 돌아보기: 결과·오류·불러오는 중, 보는 날짜 ref(E1), 저장된 돌아보기 쓰기 또는 새로 만들기.
// E1은 요약 불러오기(E2)보다 먼저, 자동 불러오기(E5, 화면)보다 먼저 돌아야 하므로 E1 자리에서 부른다.
export function useNowYesterdayReflection({
  reflectionDateKey,
  yesterdayEntries,
  yesterdayEntrySignature
}: {
  reflectionDateKey: string | null;
  yesterdayEntries: NowInEnglishEntry[];
  yesterdayEntrySignature: string;
}) {
  const [yesterdayAiReflection, setYesterdayAiReflection] = useState<NowInEnglishAiReflection | null>(null);
  const [yesterdayAiReflectionError, setYesterdayAiReflectionError] = useState("");
  const [isLoadingYesterdayAiReflection, setIsLoadingYesterdayAiReflection] = useState(false);

  // 회고를 받는 사이 보는 날짜가 바뀌면 늦게 온 응답을 버린다. 다른 날짜의 회고가 화면에 남지 않게 한다.
  const shownReflectionDateKeyRef = useRef(reflectionDateKey);
  useEffect(() => {
    shownReflectionDateKeyRef.current = reflectionDateKey;
  }, [reflectionDateKey]);

  const loadOrCreateYesterdayAiReflection = useCallback(
    async (forceRefresh = false) => {
      if (!reflectionDateKey || yesterdayEntries.length === 0 || !yesterdayEntrySignature) {
        setYesterdayAiReflection(null);
        setYesterdayAiReflectionError("");
        return;
      }

      const requestedDateKey = reflectionDateKey;
      const isStillShown = () => shownReflectionDateKeyRef.current === requestedDateKey;
      try {
        setIsLoadingYesterdayAiReflection(true);
        setYesterdayAiReflectionError("");

        if (!forceRefresh) {
          const cachedReflection = await getNowInEnglishAiReflection(reflectionDateKey);
          if (cachedReflection?.entrySignature === yesterdayEntrySignature) {
            if (isStillShown()) {
              setYesterdayAiReflection(cachedReflection);
            }
            return;
          }
        }

        const response = await requestNowInEnglishReflection({
          dateKey: reflectionDateKey,
          forceRefresh,
          entries: yesterdayEntries.map((entry) => ({
            text: entry.text,
            createdAt: entry.createdAt
          }))
        });
        const nextReflection: NowInEnglishAiReflection = {
          ...response,
          entrySignature: yesterdayEntrySignature,
          createdAt: new Date().toISOString()
        };

        await saveNowInEnglishAiReflection(nextReflection);
        if (isStillShown()) {
          setYesterdayAiReflection(nextReflection);
        }
      } catch (error) {
        const cachedReflection = await getNowInEnglishAiReflection(reflectionDateKey);
        if (!isStillShown()) {
          return;
        }
        if (cachedReflection?.entrySignature === yesterdayEntrySignature) {
          setYesterdayAiReflection(cachedReflection);
        }
        setYesterdayAiReflectionError(error instanceof Error ? error.message : "AI 회고를 불러오지 못했어요.");
      } finally {
        if (isStillShown()) {
          setIsLoadingYesterdayAiReflection(false);
        }
      }
    },
    [yesterdayEntries, yesterdayEntrySignature, reflectionDateKey]
  );

  return {
    isLoadingYesterdayAiReflection,
    loadOrCreateYesterdayAiReflection,
    setYesterdayAiReflection,
    setYesterdayAiReflectionError,
    yesterdayAiReflection,
    yesterdayAiReflectionError
  };
}
