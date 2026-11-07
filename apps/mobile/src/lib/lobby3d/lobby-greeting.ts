import type { MonthWritingStatus } from "@/lib/types";
import { IDLE_LINE, type ActionType } from "./engine";

// 로비에 들어올 때 라이트루프의 인사(학습 상태에 따른 말과 동작). 어떤 상태인지 고르는 계산만 하고, 언제 인사할지는 홈이 정한다.

export type GreetingKind = "first" | "resume" | "done" | "streak" | "longTime" | "default";

export interface LearningStatus {
  /** 로그인했고 홈 정보를 다 받았는지. 아니면 "그 밖"이다. */
  ready: boolean;
  /** 전체 작문(답) 수 */
  answerSessions: number;
  /** 전체 일기 편수 */
  diaryEntries: number;
  /** 끝내지 않은 답이 있는지(이어 쓰기) */
  hasIncomplete: boolean;
  /** 오늘 작문을 마쳤는지 */
  completedToday: boolean;
  /** 연속 작문 일수(홈 머리 칩과 같은 값) */
  streakDays: number;
  /** 작문을 시작했거나 마친 가장 늦은 날("YYYY-MM-DD"). 이번 달·지난달 안에 없으면 null. */
  lastWritingDate: string | null;
  /** 오늘("YYYY-MM-DD") */
  today: string;
}

export interface LobbyGreeting {
  kind: GreetingKind;
  line: string;
  action: ActionType;
}

/** 연속 기록으로 인사하는 가장 짧은 연속 일수. */
export const STREAK_GREETING_DAYS = 3;
/** 마지막 작문이 이만큼(일) 전이거나 더 오래되면 "오랜만"이다. */
export const LONG_TIME_DAYS = 3;

function daysBetween(from: string, to: string): number {
  const ms = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10))) -
    Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)));
  return Math.round(ms / 86400000);
}

/** 마지막 작문이 오래됐는지. 두 달 안에 작문한 날이 없는데 작문한 적은 있으면 오래된 것이다. */
export function isLongTimeAway(status: Pick<LearningStatus, "answerSessions" | "lastWritingDate" | "today">): boolean {
  if (status.answerSessions <= 0) return false;
  if (!status.lastWritingDate) return true;
  return daysBetween(status.lastWritingDate, status.today) >= LONG_TIME_DAYS;
}

/** 표의 위에서부터 맞는 첫 상태를 고른다(첫 방문 → 이어 쓰기 → 오늘 완료 → 연속 기록 → 오랜만 → 그 밖). */
export function lobbyGreeting(status: LearningStatus): LobbyGreeting {
  if (!status.ready) return { kind: "default", line: IDLE_LINE, action: "wave" };
  if (status.answerSessions === 0 && status.diaryEntries === 0) {
    return { kind: "first", line: "안녕! 게시판에서 오늘의 질문을 골라 봐.", action: "wave" };
  }
  if (status.hasIncomplete) return { kind: "resume", line: "쓰다 만 답이 있어. 이어서 써 볼까?", action: "point" };
  if (status.completedToday) return { kind: "done", line: "오늘도 해냈어!", action: "jump" };
  if (status.streakDays >= STREAK_GREETING_DAYS) {
    return { kind: "streak", line: `${status.streakDays}일째 함께하고 있어!`, action: "hop" };
  }
  if (isLongTimeAway(status)) return { kind: "longTime", line: "오랜만이야! 보고 싶었어.", action: "wave" };
  return { kind: "default", line: IDLE_LINE, action: "wave" };
}

/** 작문 달력 여러 달에서 작문을 시작했거나 마친 가장 늦은 날. 없으면 null. */
export function lastWritingDateOf(months: readonly (MonthWritingStatus | null)[]): string | null {
  let latest: string | null = null;
  for (const month of months) {
    for (const day of month?.days ?? []) {
      if ((day.started || day.completed) && (!latest || day.date > latest)) latest = day.date;
    }
  }
  return latest;
}
