import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { deleteSavedExpression, getSavedExpressions, saveExpression } from "@/lib/api";
import type { PracticeFeedbackState } from "@/lib/practice-feedback-state";
import type { AuthUser, SavedExpressionSourceType } from "@/lib/types";
import { buildSavedExpressionIdMap, normalizeExpressionKey } from "./feedback-helpers";

// 피드백 화면의 표현 저장: 로그인 사용자의 저장 목록, 저장 중인 표현, 저장·취소.
// 효과의 실행 순서를 지키려고 화면의 피드백 상태 불러오기 효과 바로 뒤에서 부른다.
export function useFeedbackSavedExpressions({
  currentUser,
  feedbackState
}: {
  currentUser: AuthUser | null | undefined;
  feedbackState: PracticeFeedbackState | null;
}) {
  const [savedExpressionIdsByKey, setSavedExpressionIdsByKey] = useState<Record<string, number>>(
    {}
  );
  const [savingExpressionKeys, setSavingExpressionKeys] = useState<string[]>([]);

  useEffect(() => {
    if (!currentUser) {
      setSavedExpressionIdsByKey({});
      return;
    }

    let cancelled = false;

    void getSavedExpressions()
      .then((savedExpressions) => {
        if (cancelled) {
          return;
        }

        setSavedExpressionIdsByKey(buildSavedExpressionIdMap(savedExpressions));
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setSavedExpressionIdsByKey({});
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  async function handleToggleFeedbackExpression(
    expression: string,
    sourceType: SavedExpressionSourceType,
    meaningKo?: string | null,
    exampleEn?: string | null,
    usageTip?: string | null,
    tags?: string[] | null
  ) {
    const normalizedKey = normalizeExpressionKey(expression);
    if (!normalizedKey || !feedbackState) {
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

    if (savingExpressionKeys.includes(normalizedKey)) {
      return;
    }

    const savedExpressionId = savedExpressionIdsByKey[normalizedKey];

    setSavingExpressionKeys((current) =>
      current.includes(normalizedKey) ? current : [...current, normalizedKey]
    );

    try {
      if (savedExpressionId) {
        await deleteSavedExpression(savedExpressionId);
        setSavedExpressionIdsByKey((current) => {
          const next = { ...current };
          delete next[normalizedKey];
          return next;
        });
        return;
      }

      const savedExpression = await saveExpression({
        expression,
        meaningKo: meaningKo ?? undefined,
        exampleEn: exampleEn ?? undefined,
        usageTipKo: usageTip ?? undefined,
        tags: tags?.length ? tags : undefined,
        sourceType,
        promptId: feedbackState.prompt.id,
        answerSessionId: feedbackState.feedback.sessionId,
        answerAttemptNo: feedbackState.feedback.attemptNo
      });
      setSavedExpressionIdsByKey((current) => ({
        ...current,
        [normalizedKey]: savedExpression.id
      }));
    } catch (caughtError) {
      Alert.alert(
        "표현 저장에 실패했어요",
        caughtError instanceof Error ? caughtError.message : "잠시 후 다시 시도해 주세요."
      );
    } finally {
      setSavingExpressionKeys((current) => current.filter((item) => item !== normalizedKey));
    }
  }

  return {
    savedExpressionIdsByKey,
    savingExpressionKeys,
    setSavingExpressionKeys,
    handleToggleFeedbackExpression
  };
}

export type FeedbackSavedExpressionsState = ReturnType<typeof useFeedbackSavedExpressions>;
