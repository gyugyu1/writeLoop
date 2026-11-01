import { router } from "expo-router";
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Alert } from "react-native";
import { requestCoachHelp, saveExpression } from "@/lib/api";
import type { AuthUser, CoachHelpResponse, Feedback, Prompt } from "@/lib/types";
import { getPromptNotFoundMessage, normalizeExpressionKey } from "./write-helpers";

// 작문 화면의 AI 코치: 질문·답변·오류·불러오는 중, 코치 표현 저장, 빠른 질문, 코치에게 묻기.
// 효과가 없으므로 부르는 자리는 상관없지만, 질문 불러오기(loadPrompt)가 비우는 setter를 쓰므로 그보다 앞에서 부른다.
export function useWriteCoach({
  currentUser,
  selectedPrompt,
  feedback,
  answer,
  setError,
  setIsCoachOpen
}: {
  currentUser: AuthUser | null | undefined;
  selectedPrompt: Prompt | null;
  feedback: Feedback | null;
  answer: string;
  setError: Dispatch<SetStateAction<string>>;
  setIsCoachOpen: Dispatch<SetStateAction<boolean>>;
}) {
  const [coachQuestion, setCoachQuestion] = useState("");
  const [coachHelp, setCoachHelp] = useState<CoachHelpResponse | null>(null);
  const [coachHelpError, setCoachHelpError] = useState("");
  const [isLoadingCoachHelp, setIsLoadingCoachHelp] = useState(false);
  const [savedCoachExpressionKeys, setSavedCoachExpressionKeys] = useState<string[]>([]);
  const [savingCoachExpressionKeys, setSavingCoachExpressionKeys] = useState<string[]>([]);

  const coachQuickQuestions = useMemo(() => {
    const topic = selectedPrompt?.topic?.trim();
    return Array.from(
      new Set([
        topic ? `${topic} 주제에 어울리는 표현 3개 알려줘.` : "이 질문에 어울리는 표현 3개 알려줘.",
        "첫 문장을 어떻게 시작하면 좋을까?",
        "이유를 자연스럽게 붙이는 표현을 알려줘.",
        "마무리 문장을 어떻게 쓰면 좋을까?"
      ])
    );
  }, [selectedPrompt?.topic]);

  async function handleSaveCoachExpression(
    expression: CoachHelpResponse["expressions"][number]
  ) {
    const normalizedKey = normalizeExpressionKey(expression.expression);
    if (!normalizedKey || !selectedPrompt) {
      return;
    }

    if (!currentUser) {
      Alert.alert(
        "로그인이 필요해요",
        "표현 저장은 로그인 후 사용할 수 있어요.",
        [
          { text: "취소", style: "cancel" },
          {
            text: "로그인하기",
            onPress: () => router.push("/login")
          }
        ]
      );
      return;
    }

    if (
      savedCoachExpressionKeys.includes(normalizedKey) ||
      savingCoachExpressionKeys.includes(normalizedKey)
    ) {
      return;
    }

    setSavingCoachExpressionKeys((current) =>
      current.includes(normalizedKey) ? current : [...current, normalizedKey]
    );

    try {
      await saveExpression({
        expression: expression.expression,
        meaningKo: expression.meaningKo,
        usageTipKo: expression.usageTip,
        exampleEn: expression.example,
        tags: expression.tags?.length ? expression.tags : undefined,
        sourceType: "COACH_RECOMMENDATION",
        promptId: selectedPrompt.id,
        coachInteractionId: coachHelp?.interactionId
      });
      setSavedCoachExpressionKeys((current) =>
        current.includes(normalizedKey) ? current : [...current, normalizedKey]
      );
    } catch (caughtError) {
      Alert.alert(
        "표현 저장에 실패했어요.",
        caughtError instanceof Error ? caughtError.message : "잠시 후 다시 시도해 주세요."
      );
    } finally {
      setSavingCoachExpressionKeys((current) => current.filter((item) => item !== normalizedKey));
    }
  }

  async function handleRequestCoachHelp(questionOverride?: string) {
    if (!selectedPrompt) {
      setError(getPromptNotFoundMessage());
      return;
    }

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
        promptId: selectedPrompt.id,
        question: nextQuestion,
        sessionId: feedback?.sessionId,
        answer: answer.trim() || undefined,
        attemptType: feedback ? "REWRITE" : "INITIAL"
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
    coachQuestion,
    setCoachQuestion,
    coachHelp,
    setCoachHelp,
    coachHelpError,
    setCoachHelpError,
    isLoadingCoachHelp,
    savedCoachExpressionKeys,
    setSavedCoachExpressionKeys,
    savingCoachExpressionKeys,
    setSavingCoachExpressionKeys,
    coachQuickQuestions,
    handleSaveCoachExpression,
    handleRequestCoachHelp
  };
}
