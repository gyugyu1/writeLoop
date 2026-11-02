import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { NOW_IN_ENGLISH_COACH_PROMPT_ID } from "./now-helpers";
import { requestCoachHelp } from "@/lib/api";
import type { CoachHelpResponse } from "@/lib/types";

// Now in English 화면의 AI 코치: 창 열림, 질문·답변·오류·불러오는 중, 빠른 질문, 표현을 입력칸에 넣기, 묻기,
// 바로 코치 피드백에서 코치에게 묻기. 효과가 없다.
export function useNowCoach({
  setStatusMessage,
  setText,
  text
}: {
  setStatusMessage: Dispatch<SetStateAction<string>>;
  setText: Dispatch<SetStateAction<string>>;
  text: string;
}) {
  const [isCoachOpen, setIsCoachOpen] = useState(false);
  const [coachQuestion, setCoachQuestion] = useState("");
  const [coachHelp, setCoachHelp] = useState<CoachHelpResponse | null>(null);
  const [coachHelpError, setCoachHelpError] = useState("");
  const [isLoadingCoachHelp, setIsLoadingCoachHelp] = useState(false);

  const coachQuickQuestions = useMemo(
    () => [
      "지금 하고 있는 일을 영어 한 줄로 어떻게 말해?",
      "내 문장이 자연스러운지 봐줘.",
      "이 뒤에 한 문장 더 붙이고 싶어.",
      "짧고 자연스러운 표현 3개 알려줘."
    ],
    []
  );

  function appendCoachExpression(expression: string) {
    const normalizedExpression = expression.trim();
    if (!normalizedExpression) {
      return;
    }

    setText((current) => {
      const trimmedCurrent = current.trim();
      if (!trimmedCurrent) {
        return normalizedExpression;
      }

      return `${trimmedCurrent}\n${normalizedExpression}`;
    });
    setIsCoachOpen(false);
    setStatusMessage("코치 표현을 한 줄 기록에 넣었어요.");
  }

  async function handleRequestCoachHelp(questionOverride?: string, answerOverride?: string) {
    const nextQuestion = (questionOverride ?? coachQuestion).trim();
    if (!nextQuestion) {
      setCoachHelpError("코치에게 물어볼 내용을 먼저 적어 주세요.");
      setIsCoachOpen(true);
      return;
    }

    try {
      setIsCoachOpen(true);
      setIsLoadingCoachHelp(true);
      setCoachHelp(null);
      setCoachHelpError("");
      const nextCoachHelp = await requestCoachHelp({
        promptId: NOW_IN_ENGLISH_COACH_PROMPT_ID,
        question: nextQuestion,
        answer: (answerOverride ?? text).trim() || undefined,
        attemptType: "INITIAL"
      });
      setCoachQuestion(nextQuestion);
      setCoachHelp(nextCoachHelp);
    } catch (error) {
      setCoachHelpError(error instanceof Error ? error.message : "AI 코치를 불러오지 못했어요.");
    } finally {
      setIsLoadingCoachHelp(false);
    }
  }

  function handleAskCoachAboutInstantEntry() {
    setCoachQuestion("");
    setCoachHelp(null);
    setCoachHelpError("");
    setIsCoachOpen(true);
  }

  return {
    appendCoachExpression,
    coachHelp,
    coachHelpError,
    coachQuestion,
    coachQuickQuestions,
    handleAskCoachAboutInstantEntry,
    handleRequestCoachHelp,
    isCoachOpen,
    isLoadingCoachHelp,
    setCoachHelp,
    setCoachHelpError,
    setCoachQuestion,
    setIsCoachOpen
  };
}
