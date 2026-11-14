import { useEffect, useState } from "react";
import { AppState } from "react-native";

// 라이트루프 방의 시각. 폰의 지금 시각을 1분마다, 그리고 앱으로 돌아올 때 다시 읽는다.
// 개발 화면에서 시각·달을 골랐으면(override) 그 시각으로 본다. 달만 고르면 그달 15일이다.

/** 개발 화면에서 고른 시각(0~24시, 15분 단위)과 달(1~12). */
export interface ClockOverride {
  hours: number;
  month: number;
}

const MINUTE_MS = 60_000;

/** 고른 시각·달을 날짜로 바꾼다. 해는 지금 해를 쓴다. */
export function overrideDate(now: Date, override: ClockOverride): Date {
  const whole = Math.floor(override.hours);
  return new Date(now.getFullYear(), override.month - 1, 15, whole, Math.round((override.hours - whole) * 60));
}

export function useLobbyClock(override: ClockOverride | null): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), MINUTE_MS);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(new Date());
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  return override ? overrideDate(now, override) : now;
}
