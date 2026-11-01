import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { requestCoachHelp } from "@/lib/api";
import type { CoachHelpResponse } from "@/lib/types";
import { type DiaryStep, DIARY_COACH_PROMPT_ID } from "./diary-entry-helpers";

// 영어일기 화면의 AI 코치: 질문·답변·오류·불러오는 중, 빠른 질문, 코치에게 묻기. 효과가 없다.
// 코치 창이 열렸는지(isCoachOpen)와 일기에 넣기는 스크롤·입력칸 ref를 쓰므로 화면에 남는다.
export function useDiaryCoach({
  activeText,
  setIsCoachOpen,
  step
}: {
  activeText: string;
  setIsCoachOpen: Dispatch<SetStateAction<boolean>>;
  step: DiaryStep;
}) {
  const [coachQuestion, setCoachQuestion] = useState("");
  const [coachHelp, setCoachHelp] = useState<CoachHelpResponse | null>(null);
  const [coachHelpError, setCoachHelpError] = useState("");
  const [isLoadingCoachHelp, setIsLoadingCoachHelp] = useState(false);
  const diaryCoachQuickQuestions = useMemo(
    () => [
      "오늘 일기에 어울리는 표현 3개 알려줘.",
      "내 감정을 자연스럽게 쓰는 문장을 알려줘.",
      "마무리 문장을 어떻게 쓰면 좋을까?",
      "이 일기 문장을 조금 더 자연스럽게 만들고 싶어."
    ],
    []
  );

  async function handleRequestCoachHelp(questionOverride?: string) {
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
        promptId: DIARY_COACH_PROMPT_ID,
        question: nextQuestion,
        answer: activeText.trim() || undefined,
        attemptType: step === "rewrite" ? "REWRITE" : "INITIAL"
      });
      setCoachQuestion(nextQuestion);
      setCoachHelp(nextCoachHelp);
    } catch (caughtError) {
      setCoachHelpError(caughtError instanceof Error ? caughtError.message : "AI 코치를 불러오지 못했어요.");
    } finally {
      setIsLoadingCoachHelp(false);
    }
  }

  return {
    coachHelp,
    coachHelpError,
    coachQuestion,
    diaryCoachQuickQuestions,
    handleRequestCoachHelp,
    isLoadingCoachHelp,
    setCoachHelp,
    setCoachHelpError,
    setCoachQuestion
  };
}
