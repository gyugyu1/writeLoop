"use client";

import { motion, useReducedMotion } from "motion/react";
import type { CSSProperties } from "react";
import styles from "./streak-sparkle-effect.module.css";

type StreakSparkleEffectProps = {
  className?: string;
  streakDays: number;
};

type SparkleSpec = {
  id: string;
  left: string;
  top: string;
  size: number;
  delay: number;
  duration: number;
  driftX: number;
  driftY: number;
  rotation: number;
  strength: number;
};

type DustSpec = {
  id: string;
  left: string;
  top: string;
  size: number;
  delay: number;
  duration: number;
};

const SPARKLES: SparkleSpec[] = [
  {
    id: "sparkle-a",
    left: "14%",
    top: "24%",
    size: 34,
    delay: 0.1,
    duration: 2.1,
    driftX: 4,
    driftY: -4,
    rotation: -8,
    strength: 0.95
  },
  {
    id: "sparkle-b",
    left: "32%",
    top: "70%",
    size: 20,
    delay: 0.55,
    duration: 1.8,
    driftX: 3,
    driftY: -3,
    rotation: 10,
    strength: 0.78
  },
  {
    id: "sparkle-c",
    left: "52%",
    top: "22%",
    size: 28,
    delay: 0.35,
    duration: 2,
    driftX: -2,
    driftY: -4,
    rotation: 6,
    strength: 0.88
  },
  {
    id: "sparkle-d",
    left: "74%",
    top: "34%",
    size: 18,
    delay: 0.75,
    duration: 1.7,
    driftX: 3,
    driftY: -2,
    rotation: -4,
    strength: 0.72
  },
  {
    id: "sparkle-e",
    left: "84%",
    top: "66%",
    size: 30,
    delay: 0.2,
    duration: 2.3,
    driftX: -4,
    driftY: -3,
    rotation: 4,
    strength: 0.9
  },
  {
    id: "sparkle-f",
    left: "62%",
    top: "78%",
    size: 16,
    delay: 0.95,
    duration: 1.6,
    driftX: 2,
    driftY: -2,
    rotation: 14,
    strength: 0.68
  }
];

const DUST: DustSpec[] = [
  { id: "dust-a", left: "22%", top: "38%", size: 8, delay: 0.1, duration: 2.4 },
  { id: "dust-b", left: "46%", top: "58%", size: 10, delay: 0.7, duration: 2.1 },
  { id: "dust-c", left: "68%", top: "20%", size: 7, delay: 0.35, duration: 1.9 },
  { id: "dust-d", left: "88%", top: "44%", size: 9, delay: 1.05, duration: 2.2 }
];

const STAR_PATH =
  "M50 2 C52 24 59 41 98 50 C59 59 52 76 50 98 C48 76 41 59 2 50 C41 41 48 24 50 2Z";
const INNER_STAR_PATH =
  "M50 18 C51 31 56 43 82 50 C56 57 51 69 50 82 C49 69 44 57 18 50 C44 43 49 31 50 18Z";

export function StreakSparkleEffect({
  className,
  streakDays
}: StreakSparkleEffectProps) {
  const prefersReducedMotion = useReducedMotion();
  const speedFactor = prefersReducedMotion
    ? 1.9
    : streakDays >= 14
      ? 0.8
      : streakDays >= 7
        ? 0.9
        : 1;
  const scaleBoost = prefersReducedMotion ? 1 : Math.min(1.28, 1 + streakDays * 0.018);
  const opacityBoost = prefersReducedMotion ? 0.58 : Math.min(1.12, 0.82 + streakDays * 0.028);

  return (
    <div className={[styles.root, className].filter(Boolean).join(" ")} aria-hidden="true">
      <motion.div
        className={styles.sweep}
        initial={false}
        animate={
          prefersReducedMotion
            ? { opacity: 0.18, x: "-10%" }
            : {
                opacity: [0, 0.28, 0],
                x: ["-48%", "4%", "28%"],
                scale: [0.98, 1.04, 1]
              }
        }
        transition={{
          duration: 2.8 * speedFactor,
          ease: "easeInOut",
          repeat: Infinity,
          repeatDelay: prefersReducedMotion ? 1 : 0.18
        }}
      />

      {SPARKLES.map((sparkle) => {
        const sparkleStyle = {
          left: sparkle.left,
          top: sparkle.top
        } satisfies CSSProperties;

        return (
          <span key={sparkle.id} className={styles.anchor} style={sparkleStyle}>
            <motion.span
              className={styles.sparkle}
              style={{
                width: sparkle.size * scaleBoost,
                height: sparkle.size * scaleBoost
              }}
              initial={false}
              animate={
                prefersReducedMotion
                  ? {
                      opacity: sparkle.strength * 0.6,
                      scale: 0.96
                    }
                  : {
                      opacity: [
                        0,
                        sparkle.strength * opacityBoost,
                        0.24,
                        sparkle.strength * 1.08,
                        0
                      ],
                      scale: [0.42, 1.08, 0.78, 1.18, 0.44],
                      rotate: [
                        sparkle.rotation - 10,
                        sparkle.rotation + 8,
                        sparkle.rotation - 4,
                        sparkle.rotation + 12,
                        sparkle.rotation - 8
                      ],
                      x: [0, sparkle.driftX, -sparkle.driftX * 0.35, 0],
                      y: [0, sparkle.driftY, -sparkle.driftY * 0.2, 0]
                    }
              }
              transition={{
                duration: sparkle.duration * speedFactor,
                ease: "easeInOut",
                delay: sparkle.delay,
                repeat: Infinity,
                repeatDelay: prefersReducedMotion ? 1.4 : 0.1
              }}
            >
              <span className={styles.sparkleGlow} style={{ opacity: sparkle.strength }} />
              <svg
                className={styles.sparkleStar}
                viewBox="0 0 100 100"
                fill="none"
                aria-hidden="true"
              >
                <path className={styles.sparkleOuter} d={STAR_PATH} />
                <path className={styles.sparkleInner} d={INNER_STAR_PATH} />
              </svg>
            </motion.span>
          </span>
        );
      })}

      {DUST.map((dust) => {
        const dustStyle = {
          left: dust.left,
          top: dust.top,
          width: dust.size,
          height: dust.size
        } satisfies CSSProperties;

        return (
          <motion.span
            key={dust.id}
            className={styles.dust}
            style={dustStyle}
            initial={false}
            animate={
              prefersReducedMotion
                ? { opacity: 0.16 }
                : {
                    opacity: [0, 0.44, 0.12, 0.56, 0],
                    scale: [0.55, 1, 0.72, 1.08, 0.6],
                    y: [0, -4, 0]
                  }
            }
            transition={{
              duration: dust.duration * speedFactor,
              ease: "easeInOut",
              delay: dust.delay,
              repeat: Infinity,
              repeatDelay: prefersReducedMotion ? 1.6 : 0.14
            }}
          />
        );
      })}
    </div>
  );
}
