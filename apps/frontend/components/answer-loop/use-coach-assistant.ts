"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { checkCoachExpressionUsage, requestCoachHelp } from "../../lib/api";
import { buildLocalCoachHelp, buildLocalCoachUsage } from "../../lib/coach";
import type { CoachHelpResponse, CoachUsageCheckResponse, Prompt } from "../../lib/types";

type CoachStep = "pick" | "answer" | "feedback" | "rewrite" | "complete";

// 웹 주 화면의 AI 코치 도우미(표현 물어보기). 코치 창 열림, 질문, 코치 응답, 답 제출 뒤 코치 표현 사용량을 맡는다.
// 창을 닫거나 비우는 일은 다른 흐름(질문 바꾸기, 초안 복구, 답 제출 등)도 하므로 close·reset을 함께 준다.
export function useCoachAssistant() {
  const [showCoachAssistant, setShowCoachAssistant] = useState(false);
  const [coachQuestion, setCoachQuestion] = useState("");
  const [coachHelp, setCoachHelp] = useState<CoachHelpResponse | null>(null);
  const [coachHelpError, setCoachHelpError] = useState("");
  const [isLoadingCoachHelp, setIsLoadingCoachHelp] = useState(false);
  const [coachUsage, setCoachUsage] = useState<CoachUsageCheckResponse | null>(null);
  const [, setIsCheckingCoachUsage] = useState(false);
  const promptInputRef = useRef<HTMLTextAreaElement | null>(null);
  const dialogCloseButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!showCoachAssistant || typeof document === "undefined" || typeof window === "undefined") {
      return;
    }

    const previousActiveElement = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowCoachAssistant(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    window.requestAnimationFrame(() => {
      promptInputRef.current?.focus();
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      if (previousActiveElement && typeof previousActiveElement.focus === "function") {
        window.requestAnimationFrame(() => {
          previousActiveElement.focus();
        });
      }
    };
  }, [showCoachAssistant]);

  // 효과와 콜백의 의존성에 넣어도 다시 실행되지 않게 고정한다.
  const open = useCallback(() => setShowCoachAssistant(true), []);
  const close = useCallback(() => setShowCoachAssistant(false), []);

  // 코치 질문·응답·오류·사용량을 비우고 창을 닫는다.
  function reset() {
    setShowCoachAssistant(false);
    setCoachQuestion("");
    setCoachHelp(null);
    setCoachHelpError("");
    setCoachUsage(null);
    setIsLoadingCoachHelp(false);
    setIsCheckingCoachUsage(false);
  }

  async function submitQuestion({
    selectedPrompt,
    sessionId,
    step,
    answer,
    rewrite
  }: {
    selectedPrompt: Prompt | null;
    sessionId: string;
    step: CoachStep;
    answer: string;
    rewrite: string;
  }) {
    if (!selectedPrompt) {
      setCoachHelpError("질문을 먼저 선택해 주세요.");
      return;
    }

    const question = coachQuestion.trim();
    if (!question) {
      setCoachHelpError("AI에게 물어볼 표현 질문을 입력해 주세요.");
      return;
    }

    setIsLoadingCoachHelp(true);
    setCoachHelpError("");
    setCoachUsage(null);

    try {
      const request = {
        promptId: selectedPrompt.id,
        question,
        sessionId: sessionId || undefined,
        answer: (step === "rewrite" ? rewrite : answer).trim() || undefined,
        attemptType: step === "rewrite" ? ("REWRITE" as const) : ("INITIAL" as const)
      };

      let result: CoachHelpResponse;
      try {
        result = await requestCoachHelp(request);
      } catch {
        result = buildLocalCoachHelp(selectedPrompt, question);
      }

      setCoachHelp(result);
    } catch {
      setCoachHelpError("표현 코치를 불러오지 못했어요.");
    } finally {
      setIsLoadingCoachHelp(false);
    }
  }

  // 답을 제출한 뒤 부른다. 제출 전에 받은 코치 표현(coachHelpSnapshot)이 있으면 답에 썼는지 확인해 사용량을 남기고,
  // 확인 요청이 실패하면 그 자리에서 계산한다. 코치 표현이 없었으면 사용량을 비운다.
  function checkUsageAfterSubmit({
    coachHelpSnapshot,
    promptSnapshot,
    promptPoolSnapshot,
    promptId,
    answer,
    sessionId,
    guestId,
    attemptNo,
    attemptType
  }: {
    coachHelpSnapshot: CoachHelpResponse | null;
    promptSnapshot: Prompt | null;
    promptPoolSnapshot: Prompt[];
    promptId: string;
    answer: string;
    sessionId: string;
    guestId: string;
    attemptNo: number;
    attemptType: "INITIAL" | "REWRITE";
  }) {
    if (coachHelpSnapshot && promptSnapshot && coachHelpSnapshot.expressions.length > 0) {
      setIsCheckingCoachUsage(true);
      void (async () => {
        try {
          const usageRequest = {
            promptId,
            answer,
            sessionId,
            guestId: guestId || undefined,
            attemptNo,
            attemptType,
            expressions: coachHelpSnapshot.expressions,
            interactionId: coachHelpSnapshot.interactionId
          };

          let usageResult: CoachUsageCheckResponse;
          try {
            usageResult = await checkCoachExpressionUsage(usageRequest);
          } catch {
            usageResult = buildLocalCoachUsage(
              promptSnapshot,
              answer,
              coachHelpSnapshot.expressions,
              promptPoolSnapshot
            );
          }

          setCoachUsage(usageResult);
        } finally {
          setIsCheckingCoachUsage(false);
        }
      })();
    } else {
      setCoachUsage(null);
    }
  }

  return {
    isOpen: showCoachAssistant,
    question: coachQuestion,
    setQuestion: setCoachQuestion,
    help: coachHelp,
    error: coachHelpError,
    isLoading: isLoadingCoachHelp,
    usage: coachUsage,
    promptInputRef,
    dialogCloseButtonRef,
    open,
    close,
    reset,
    submitQuestion,
    checkUsageAfterSubmit
  };
}

export type CoachAssistantState = ReturnType<typeof useCoachAssistant>;
