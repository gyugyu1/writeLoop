"use client";

import { useEffect, useState } from "react";
import { deleteSavedExpression, getSavedExpressions, saveExpression } from "../../lib/api";
import {
  buildSavedExpressionIdMap,
  normalizeExpressionTagList,
  normalizeSavedExpressionKey
} from "../../lib/saved-expressions";
import { trimNullable } from "../../lib/text";
import type { AuthUser, SavedExpressionSourceType } from "../../lib/types";

// 표현을 저장할 때 함께 보내는 지금 화면의 질문·답 정보.
type SaveContext = {
  promptId?: string;
  answerSessionId?: string;
  answerAttemptNo?: number;
};

export type SavedExpressionToggleInput = {
  expression: string;
  meaningKo?: string | null;
  exampleEn?: string | null;
  usageTipKo?: string | null;
  tags?: string[] | null;
  sourceType: SavedExpressionSourceType;
  coachInteractionId?: string | null;
};

// 웹 주 화면의 표현 저장(내 표현함에 저장·저장 취소). 저장된 표현 목록, 저장 중 표시, 알림·오류 문구를 맡는다.
// 저장 버튼은 코치 도우미 패널과 피드백 화면에 있고, 이 훅의 값과 함수를 함께 쓴다.
export function useSavedExpressions({
  currentUser,
  saveContext,
  onLoginRequired
}: {
  currentUser: AuthUser | null;
  saveContext: SaveContext;
  onLoginRequired: () => void;
}) {
  const [savedExpressionIdsByKey, setSavedExpressionIdsByKey] = useState<Record<string, number>>({});
  const [savingExpressionKeys, setSavingExpressionKeys] = useState<string[]>([]);
  const [expressionSaveNotice, setExpressionSaveNotice] = useState("");
  const [expressionSaveError, setExpressionSaveError] = useState("");

  useEffect(() => {
    if (!currentUser) {
      setSavedExpressionIdsByKey({});
      return;
    }

    let cancelled = false;

    async function loadSavedExpressionIds() {
      try {
        const savedExpressions = await getSavedExpressions();
        if (!cancelled) {
          setSavedExpressionIdsByKey(buildSavedExpressionIdMap(savedExpressions));
        }
      } catch {
        if (!cancelled) {
          setSavedExpressionIdsByKey({});
        }
      }
    }

    void loadSavedExpressionIds();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  function isSaved(expression: string) {
    return Boolean(savedExpressionIdsByKey[normalizeSavedExpressionKey(expression)]);
  }

  function isSaving(expression: string) {
    return savingExpressionKeys.includes(normalizeSavedExpressionKey(expression));
  }

  async function toggle({
    expression,
    meaningKo,
    exampleEn,
    usageTipKo,
    tags,
    sourceType,
    coachInteractionId
  }: SavedExpressionToggleInput) {
    const trimmedExpression = expression.trim();
    const key = normalizeSavedExpressionKey(trimmedExpression);
    if (!key) {
      return;
    }

    if (!currentUser) {
      onLoginRequired();
      setExpressionSaveError("표현 저장은 로그인 후 사용할 수 있어요.");
      setExpressionSaveNotice("");
      return;
    }

    if (savingExpressionKeys.includes(key)) {
      return;
    }

    const existingSavedExpressionId = savedExpressionIdsByKey[key];
    setSavingExpressionKeys((current) => [...current, key]);
    setExpressionSaveError("");
    setExpressionSaveNotice("");

    try {
      if (existingSavedExpressionId) {
        await deleteSavedExpression(existingSavedExpressionId);
        setSavedExpressionIdsByKey((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
        setExpressionSaveNotice("저장을 취소했어요.");
        return;
      }

      const savedExpression = await saveExpression({
        expression: trimmedExpression,
        meaningKo: trimNullable(meaningKo) ?? undefined,
        exampleEn: trimNullable(exampleEn) ?? undefined,
        usageTipKo: trimNullable(usageTipKo) ?? undefined,
        tags: normalizeExpressionTagList(tags),
        sourceType,
        promptId: saveContext.promptId,
        answerSessionId: saveContext.answerSessionId,
        answerAttemptNo: saveContext.answerAttemptNo,
        coachInteractionId: trimNullable(coachInteractionId) ?? undefined
      });

      setSavedExpressionIdsByKey((current) => ({
        ...current,
        [key]: savedExpression.id
      }));
      setExpressionSaveNotice("표현을 저장했어요.");
    } catch (caughtError) {
      setExpressionSaveError(
        caughtError instanceof Error ? caughtError.message : "표현을 저장하지 못했어요."
      );
    } finally {
      setSavingExpressionKeys((current) => current.filter((item) => item !== key));
    }
  }

  function clearMessages() {
    setExpressionSaveNotice("");
    setExpressionSaveError("");
  }

  return {
    notice: expressionSaveNotice,
    error: expressionSaveError,
    isSaved,
    isSaving,
    toggle,
    clearMessages
  };
}
