import { createContext, useContext, useState, type PropsWithChildren } from "react";

export type AppUpdateNoticePhase = "checking" | "visible" | "settled";

type AppOverlayStatusValue = {
  appUpdateNoticePhase: AppUpdateNoticePhase;
  setAppUpdateNoticePhase: (phase: AppUpdateNoticePhase) => void;
};

const AppOverlayStatusContext = createContext<AppOverlayStatusValue | null>(null);

export function AppOverlayStatusProvider({ children }: PropsWithChildren) {
  const [appUpdateNoticePhase, setAppUpdateNoticePhase] =
    useState<AppUpdateNoticePhase>("checking");

  return (
    <AppOverlayStatusContext.Provider
      value={{ appUpdateNoticePhase, setAppUpdateNoticePhase }}
    >
      {children}
    </AppOverlayStatusContext.Provider>
  );
}

export function useAppOverlayStatus() {
  const value = useContext(AppOverlayStatusContext);
  if (!value) {
    throw new Error("useAppOverlayStatus must be used inside AppOverlayStatusProvider.");
  }

  return value;
}
