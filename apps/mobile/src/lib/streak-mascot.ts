import type { ImageSourcePropType } from "react-native";

const streakMascotDefault = require("../../assets/images/streak-mascot/streak-default.png");
const streakMascot03 = require("../../assets/images/streak-mascot/streak-03.png");
const streakMascot07 = require("../../assets/images/streak-mascot/streak-07.png");
const streakMascot14 = require("../../assets/images/streak-mascot/streak-14.png");
const streakMascot21 = require("../../assets/images/streak-mascot/streak-21.png");
const streakMascot30 = require("../../assets/images/streak-mascot/streak-30.png");

type StreakMascotStage = {
  minDays: number;
  source: ImageSourcePropType;
  assetFileName: string;
};

const STREAK_MASCOT_STAGES: StreakMascotStage[] = [
  {
    minDays: 30,
    source: streakMascot30,
    assetFileName: "streak-30.png"
  },
  {
    minDays: 21,
    source: streakMascot21,
    assetFileName: "streak-21.png"
  },
  {
    minDays: 14,
    source: streakMascot14,
    assetFileName: "streak-14.png"
  },
  {
    minDays: 7,
    source: streakMascot07,
    assetFileName: "streak-07.png"
  },
  {
    minDays: 3,
    source: streakMascot03,
    assetFileName: "streak-03.png"
  },
  {
    minDays: 0,
    source: streakMascotDefault,
    assetFileName: "streak-default.png"
  }
];

export function getStreakMascotStage(streakDays: number) {
  const normalizedStreakDays = Number.isFinite(streakDays) ? Math.max(0, Math.floor(streakDays)) : 0;
  return (
    STREAK_MASCOT_STAGES.find((stage) => normalizedStreakDays >= stage.minDays) ??
    STREAK_MASCOT_STAGES[STREAK_MASCOT_STAGES.length - 1]
  );
}
