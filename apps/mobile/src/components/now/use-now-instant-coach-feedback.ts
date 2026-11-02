import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { PendingPolishSource } from "./now-helpers";
import { requestNowInEnglishCoachFeedback } from "@/lib/api";
import type { NowInEnglishEntry } from "@/lib/now-in-english";
import type { NowInEnglishCoachFeedbackResponse } from "@/lib/types";

// Now in English 화면의 바로 코치 피드백: 저장한 문장, 피드백·오류·불러오는 중, 요청 번호로 늦은 응답 버리기,
// 다시 시도, 그대로 두기. 효과가 없다.
export function useNowInstantCoachFeedback({
  setPendingPolishSource,
  setStatusMessage
}: {
  setPendingPolishSource: Dispatch<SetStateAction<PendingPolishSource | null>>;
  setStatusMessage: Dispatch<SetStateAction<string>>;
}) {
  const [instantCoachEntry, setInstantCoachEntry] = useState<NowInEnglishEntry | null>(null);
  const [instantCoachFeedback, setInstantCoachFeedback] = useState<NowInEnglishCoachFeedbackResponse | null>(null);
  const [instantCoachFeedbackError, setInstantCoachFeedbackError] = useState("");
  const [isLoadingInstantCoachFeedback, setIsLoadingInstantCoachFeedback] = useState(false);
  const instantCoachRequestIdRef = useRef(0);

  const loadInstantCoachFeedback = useCallback(async (entry: NowInEnglishEntry) => {
    const requestId = instantCoachRequestIdRef.current + 1;
    instantCoachRequestIdRef.current = requestId;
    setInstantCoachEntry(entry);
    setInstantCoachFeedback(null);
    setInstantCoachFeedbackError("");
    setIsLoadingInstantCoachFeedback(true);

    try {
      const feedback = await requestNowInEnglishCoachFeedback({
        text: entry.text,
        createdAt: entry.createdAt
      });
      if (instantCoachRequestIdRef.current !== requestId) {
        return;
      }
      setInstantCoachFeedback(feedback);
    } catch (error) {
      if (instantCoachRequestIdRef.current !== requestId) {
        return;
      }
      setInstantCoachFeedbackError(
        error instanceof Error
          ? error.message
          : "저장은 완료됐어요. AI 코치는 잠시 후 다시 시도해 주세요."
      );
    } finally {
      if (instantCoachRequestIdRef.current === requestId) {
        setIsLoadingInstantCoachFeedback(false);
      }
    }
  }, []);

  function handleRetryInstantCoachFeedback() {
    if (!instantCoachEntry) {
      return;
    }

    void loadInstantCoachFeedback(instantCoachEntry);
  }

  function handleKeepInstantEntry() {
    instantCoachRequestIdRef.current += 1;
    setInstantCoachEntry(null);
    setInstantCoachFeedback(null);
    setInstantCoachFeedbackError("");
    setIsLoadingInstantCoachFeedback(false);
    setPendingPolishSource(null);
    setStatusMessage("좋아요. 이 문장은 그대로 남겨둘게요.");
  }

  return {
    handleKeepInstantEntry,
    handleRetryInstantCoachFeedback,
    instantCoachEntry,
    instantCoachFeedback,
    instantCoachFeedbackError,
    isLoadingInstantCoachFeedback,
    loadInstantCoachFeedback
  };
}
