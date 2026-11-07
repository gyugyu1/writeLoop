import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { getMonthWritingStatus } from "@/lib/api";
import type { ActionType } from "@/lib/lobby3d/engine";
import { STREAK_GREETING_DAYS, lastWritingDateOf, lobbyGreeting, type LearningStatus } from "@/lib/lobby3d/lobby-greeting";
import type { MonthWritingStatus } from "@/lib/types";
import { toDateKey } from "./home-helpers";

// 홈(로비)에 들어올 때마다 라이트루프가 할 인사를 정한다. 앱을 열 때, 다른 화면에서 돌아올 때, 배경에 두었던 앱으로 돌아올 때.
// 그때 홈 정보를 다시 읽으므로, 다시 읽기가 끝난 뒤의 상태로 고른다. 처음 방문 안내가 떠 있거나 뜰 참이면 끝난 뒤에 인사한다.

export interface LobbyGreetingProp {
  line: string;
  action: ActionType;
  key: number;
}

interface UseLobbyGreetingOptions {
  /** 로그인했는지 */
  loggedIn: boolean;
  /** 홈 정보를 다 읽을 때마다 늘어나는 수(use-home-data) */
  homeLoadCount: number;
  /** 끝내지 않은 답을 아직 확인하는 중인지 */
  resolvingIncomplete: boolean;
  answerSessions: number;
  diaryEntries: number;
  hasIncomplete: boolean;
  completedToday: boolean;
  streakDays: number;
  /** 처음 방문 안내가 떠 있거나 뜰 참인지 */
  tutorialPending: boolean;
}

/** 작문 달력에서 이번 달과 지난달을 읽는다(오랜만인지 볼 때만). 읽지 못한 달은 null. */
async function loadRecentMonths(today: Date): Promise<(MonthWritingStatus | null)[]> {
  const previous = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const read = (d: Date) => getMonthWritingStatus(d.getFullYear(), d.getMonth() + 1).catch(() => null);
  return Promise.all([read(today), read(previous)]);
}

export function useLobbyGreeting(options: UseLobbyGreetingOptions): LobbyGreetingProp | null {
  const [greeting, setGreeting] = useState<LobbyGreetingProp | null>(null);
  // 인사할 차례가 생긴 때의 홈 정보 읽기 수. 그보다 새로 읽은 뒤에 인사한다. null이면 할 차례가 아니다.
  const [pendingFrom, setPendingFrom] = useState<number | null>(null);
  const loadCountRef = useRef(options.homeLoadCount);
  loadCountRef.current = options.homeLoadCount;
  const keyRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      setPendingFrom(loadCountRef.current);
    }, [])
  );
  useEffect(() => {
    let previous = AppState.currentState;
    const sub = AppState.addEventListener("change", (next) => {
      if (previous !== "active" && next === "active") setPendingFrom(loadCountRef.current);
      previous = next;
    });
    return () => sub.remove();
  }, []);

  const { loggedIn, homeLoadCount, resolvingIncomplete, tutorialPending } = options;
  useEffect(() => {
    if (pendingFrom === null || tutorialPending) return;
    // 로그인을 확인하고, 들어온 뒤의 다시 읽기가 끝나기를 기다린다. 앱을 막 열면 로그인 정보를 읽는 동안 잠깐 로그인하지 않은 것으로 보여,
    // 그때 인사하면 기본 말로 끝나 버린다(홈은 로그인해야 보이므로 로그인하지 않은 채로는 인사하지 않는다).
    if (!loggedIn || homeLoadCount <= pendingFrom || resolvingIncomplete) return;
    let cancelled = false;
    const now = new Date();
    const status: LearningStatus = {
      ready: loggedIn,
      answerSessions: options.answerSessions,
      diaryEntries: options.diaryEntries,
      hasIncomplete: options.hasIncomplete,
      completedToday: options.completedToday,
      streakDays: options.streakDays,
      lastWritingDate: null,
      today: toDateKey(now)
    };
    const finish = (s: LearningStatus) => {
      if (cancelled) return;
      const chosen = lobbyGreeting(s);
      keyRef.current += 1;
      setGreeting({ line: chosen.line, action: chosen.action, key: keyRef.current });
      setPendingFrom(null);
    };
    // 오랜만인지 볼 차례(앞의 상태가 하나도 맞지 않음)일 때만 작문 달력을 읽는다
    const needsHistory =
      loggedIn &&
      !(status.answerSessions === 0 && status.diaryEntries === 0) &&
      !status.hasIncomplete &&
      !status.completedToday &&
      status.streakDays < STREAK_GREETING_DAYS &&
      status.answerSessions > 0;
    if (!needsHistory) finish(status);
    else void loadRecentMonths(now).then((months) => finish({ ...status, lastWritingDate: lastWritingDateOf(months) }));
    return () => {
      cancelled = true;
    };
    // 상태 값은 인사를 고를 때(다시 읽기가 끝났을 때)의 값을 쓴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFrom, homeLoadCount, loggedIn, resolvingIncomplete, tutorialPending]);

  return greeting;
}
