import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { deleteSavedExpression, getSavedExpressions, saveExpression } from "@/lib/api";
import { buildLoginHref } from "@/lib/login-redirect";
import { useSession } from "@/lib/session";
import type { CoachExpression } from "@/lib/types";
import { normalizeExpressionKey, buildSavedExpressionIdMap } from "./diary-entry-helpers";

// 영어일기 화면의 표현 저장: 저장된 표현 불러오기(E2), 피드백 패널의 표현 저장·취소, 코치 표현 저장.
// E2는 일기 불러오기(E1) 뒤, 자동 임시저장(E3) 앞에 돌아야 하므로 그 자리에서 부른다.
export function useDiaryExpressions({
  currentUser,
  initialEntryId
}: {
  currentUser: ReturnType<typeof useSession>["currentUser"];
  initialEntryId: string | null;
}) {
  const [savedCoachExpressionKeys, setSavedCoachExpressionKeys] = useState<string[]>([]);
  const [savingCoachExpressionKeys, setSavingCoachExpressionKeys] = useState<string[]>([]);
  const [savedExpressionIdsByKey, setSavedExpressionIdsByKey] = useState<Record<string, number>>({});
  const [savingExpressionKeys, setSavingExpressionKeys] = useState<string[]>([]);

  useEffect(() => {
    if (!currentUser) {
      setSavedExpressionIdsByKey({});
      setSavingExpressionKeys([]);
      setSavedCoachExpressionKeys([]);
      setSavingCoachExpressionKeys([]);
      return;
    }

    let cancelled = false;

    void getSavedExpressions()
      .then((savedExpressions) => {
        if (!cancelled) {
          setSavedExpressionIdsByKey(buildSavedExpressionIdMap(savedExpressions));
          setSavedCoachExpressionKeys(savedExpressions.map((item) => normalizeExpressionKey(item.expression)));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSavedExpressionIdsByKey({});
          setSavedCoachExpressionKeys([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  async function handleSaveCoachExpression(expression: CoachExpression) {
    const normalizedKey = normalizeExpressionKey(expression.expression);
    if (!normalizedKey || savedCoachExpressionKeys.includes(normalizedKey) || savingCoachExpressionKeys.includes(normalizedKey)) {
      return;
    }

    if (!currentUser) {
      Alert.alert("로그인이 필요해요", "표현 저장은 로그인 후 사용할 수 있어요.", [
        { text: "취소", style: "cancel" },
        { text: "로그인하기", onPress: () => router.push(buildLoginHref("/diary/write")) }
      ]);
      return;
    }

    try {
      setSavingCoachExpressionKeys((current) =>
        current.includes(normalizedKey) ? current : [...current, normalizedKey]
      );
      const savedExpression = await saveExpression({
        expression: expression.expression,
        meaningKo: expression.meaningKo,
        usageTipKo: expression.usageTip,
        exampleEn: expression.example,
        tags: expression.tags ?? undefined,
        sourceType: "DIARY_EXPRESSION"
      });
      setSavedCoachExpressionKeys((current) =>
        current.includes(normalizedKey) ? current : [...current, normalizedKey]
      );
      setSavedExpressionIdsByKey((current) => ({ ...current, [normalizedKey]: savedExpression.id }));
    } catch (caughtError) {
      Alert.alert(
        "표현 저장에 실패했어요",
        caughtError instanceof Error ? caughtError.message : "잠시 후 다시 시도해 주세요."
      );
    } finally {
      setSavingCoachExpressionKeys((current) => current.filter((item) => item !== normalizedKey));
    }
  }

  async function handleToggleDiaryExpression(
    expression: string,
    meaningKo?: string | null,
    exampleEn?: string | null,
    usageTip?: string | null,
    tags?: string[] | null
  ) {
    const normalizedKey = normalizeExpressionKey(expression);
    if (!normalizedKey) {
      return;
    }

    if (!currentUser) {
      Alert.alert("로그인이 필요해요", "표현 저장은 로그인 후 사용할 수 있어요.", [
        { text: "취소", style: "cancel" },
        {
          text: "로그인하기",
          onPress: () => router.push(buildLoginHref(initialEntryId ? `/diary/${initialEntryId}` : "/diary"))
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
        expression,
        meaningKo: meaningKo ?? undefined,
        exampleEn: exampleEn ?? undefined,
        usageTipKo: usageTip ?? undefined,
        tags: tags?.length ? tags : undefined,
        sourceType: "DIARY_EXPRESSION"
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
    handleSaveCoachExpression,
    handleToggleDiaryExpression,
    savedCoachExpressionKeys,
    savedExpressionIdsByKey,
    savingCoachExpressionKeys,
    savingExpressionKeys
  };
}
