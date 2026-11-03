import { useState, type Dispatch, type SetStateAction } from "react";

type LanguageFixRevealState = {
  feedbackKey: string;
  indexes: number[];
  isSentenceRevealed: boolean;
};

// 문장 교정 미션에서 학습자가 눌러 연 교정 줄(번호)과 고친 문장 전체.
// 어느 피드백(세션·시도 번호)에서 열었는지 함께 두어, 새 피드백이 오면 그리는 순간부터 다시 가려진다.
// (화면을 그린 뒤 효과로 지우면 새 피드백의 첫 화면에 앞에서 연 정답이 한순간 보인다.)
export function useLanguageFixReveal(feedbackKey: string) {
  const [state, setState] = useState<LanguageFixRevealState>({
    feedbackKey,
    indexes: [],
    isSentenceRevealed: false
  });
  const current: LanguageFixRevealState = state.feedbackKey === feedbackKey
    ? state
    : { feedbackKey, indexes: [], isSentenceRevealed: false };

  const setRevealedLanguageCorrectionIndexes: Dispatch<SetStateAction<number[]>> = (action) => {
    setState((previous) => {
      const base = previous.feedbackKey === feedbackKey
        ? previous
        : { feedbackKey, indexes: [], isSentenceRevealed: false };
      const indexes = typeof action === "function" ? action(base.indexes) : action;
      return { ...base, indexes };
    });
  };

  const setIsRevisedSentenceRevealed: Dispatch<SetStateAction<boolean>> = (action) => {
    setState((previous) => {
      const base = previous.feedbackKey === feedbackKey
        ? previous
        : { feedbackKey, indexes: [], isSentenceRevealed: false };
      const isSentenceRevealed = typeof action === "function" ? action(base.isSentenceRevealed) : action;
      return { ...base, isSentenceRevealed };
    });
  };

  return {
    revealedLanguageCorrectionIndexes: current.indexes,
    setRevealedLanguageCorrectionIndexes,
    isRevisedSentenceRevealed: current.isSentenceRevealed,
    setIsRevisedSentenceRevealed
  };
}
