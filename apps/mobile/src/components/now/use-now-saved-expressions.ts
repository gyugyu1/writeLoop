import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { normalizeExpressionKey, buildSavedExpressionIdMap } from "./now-helpers";
import { deleteSavedExpression, getSavedExpressions, saveExpression } from "@/lib/api";
import type { NowInEnglishAiReflectionExpression } from "@/lib/now-in-english";
import { useSession } from "@/lib/session";

// Now in English 화면의 표현 저장: 저장된 표현 불러오기·로그아웃 때 비우기(E3), 돌아보기 표현 저장·저장 취소.
// E3 자리에서 부른다.
export function useNowSavedExpressions({
  currentUser
}: {
  currentUser: ReturnType<typeof useSession>["currentUser"];
}) {
  const [savedExpressionIdsByKey, setSavedExpressionIdsByKey] = useState<Record<string, number>>({});
  const [savingExpressionKeys, setSavingExpressionKeys] = useState<string[]>([]);

  useEffect(() => {
    if (!currentUser) {
      setSavedExpressionIdsByKey({});
      setSavingExpressionKeys([]);
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

  async function handleToggleReflectionExpression(expression: NowInEnglishAiReflectionExpression) {
    const normalizedKey = normalizeExpressionKey(expression.expression);
    if (!normalizedKey) {
      return;
    }

    if (!currentUser) {
      Alert.alert("로그인이 필요해요", "표현 저장은 로그인 후 사용할 수 있어요.", [
        { text: "취소", style: "cancel" },
        {
          text: "로그인하기",
          onPress: () => router.push("/login")
        }
      ]);
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
        expression: expression.expression,
        meaningKo: expression.meaningKo || undefined,
        usageTipKo: expression.usageTip || undefined,
        exampleEn: expression.example || undefined,
        sourceType: "COACH_RECOMMENDATION"
      });
      setSavedExpressionIdsByKey((current) => ({
        ...current,
        [normalizedKey]: savedExpression.id
      }));
    } catch (error) {
      Alert.alert("표현 저장에 실패했어요", error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setSavingExpressionKeys((current) => current.filter((key) => key !== normalizedKey));
    }
  }

  return {
    handleToggleReflectionExpression,
    savedExpressionIdsByKey,
    savingExpressionKeys
  };
}
