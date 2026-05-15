"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import styles from "./app-download-prompt.module.css";

const DISMISSED_STORAGE_KEY = "writeloop_app_download_prompt_dismissed_at";
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000;
const ANDROID_STORE_URL = "https://play.google.com/store/apps/details?id=kr.writeloop";
const IOS_STORE_URL = "https://apps.apple.com/app/id6763569959";

const TEXT = {
  closeLabel: "\uC571 \uB2E4\uC6B4\uB85C\uB4DC \uC548\uB0B4 \uB2EB\uAE30",
  title: "\uB77C\uC774\uD2B8\uB8E8\uD504\uB97C \uC571\uC73C\uB85C \uB354 \uD3B8\uD558\uAC8C \uC368\uBCF4\uC138\uC694.",
  appStore: "App Store\uC5D0\uC11C \uBC1B\uAE30",
  googlePlay: "Google Play\uC5D0\uC11C \uBC1B\uAE30",
  continueWeb: "\uC6F9\uC73C\uB85C \uACC4\uC18D\uD558\uAE30"
};

type StorePlatform = "ios" | "android" | "desktop";

function resolveStorePlatform(): StorePlatform {
  const userAgent = window.navigator.userAgent;
  const platform = window.navigator.platform;
  const maxTouchPoints = window.navigator.maxTouchPoints ?? 0;

  if (/iPad|iPhone|iPod/i.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1)) {
    return "ios";
  }

  if (/Android/i.test(userAgent)) {
    return "android";
  }

  return "desktop";
}

function getPrimaryStore(platform: StorePlatform) {
  if (platform === "ios") {
    return {
      label: TEXT.appStore,
      url: IOS_STORE_URL
    };
  }

  return {
    label: TEXT.googlePlay,
    url: ANDROID_STORE_URL
  };
}

export function AppDownloadPrompt() {
  const [isVisible, setIsVisible] = useState(false);
  const [platform, setPlatform] = useState<StorePlatform>("desktop");

  useEffect(() => {
    setPlatform(resolveStorePlatform());

    try {
      const dismissedAt = Number(window.localStorage.getItem(DISMISSED_STORAGE_KEY) ?? "0");
      if (dismissedAt && Date.now() - dismissedAt < DISMISS_DURATION_MS) {
        return;
      }

      const timer = window.setTimeout(() => setIsVisible(true), 900);
      return () => window.clearTimeout(timer);
    } catch {
      setIsVisible(true);
    }
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISSED_STORAGE_KEY, String(Date.now()));
    } catch {
      // localStorage can be unavailable in private browsing; closing should still work.
    }
    setIsVisible(false);
  }

  if (!isVisible) {
    return null;
  }

  const primaryStore = getPrimaryStore(platform);
  const shouldShowDesktopStorePair = platform === "desktop";

  return (
    <div className={styles.overlay} role="presentation" onClick={dismiss}>
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-download-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className={styles.closeButton} aria-label={TEXT.closeLabel} onClick={dismiss}>
          {"\u00d7"}
        </button>
        <div className={styles.mascotFrame}>
          <Image src="/home/mascote-face.png" alt="" width={92} height={92} className={styles.mascot} />
        </div>
        <div className={styles.copy}>
          <h2 id="app-download-title">{TEXT.title}</h2>
        </div>
        <div className={styles.actions}>
          {shouldShowDesktopStorePair ? (
            <div className={styles.storePair}>
              <a className={styles.primaryLink} href={ANDROID_STORE_URL} target="_blank" rel="noreferrer" onClick={dismiss}>
                {TEXT.googlePlay}
              </a>
              <a className={styles.secondaryStoreLink} href={IOS_STORE_URL} target="_blank" rel="noreferrer" onClick={dismiss}>
                {TEXT.appStore}
              </a>
            </div>
          ) : (
            <a className={styles.primaryLink} href={primaryStore.url} target="_blank" rel="noreferrer" onClick={dismiss}>
              {primaryStore.label}
            </a>
          )}
          <button type="button" className={styles.secondaryButton} onClick={dismiss}>
            {TEXT.continueWeb}
          </button>
        </div>
      </section>
    </div>
  );
}
