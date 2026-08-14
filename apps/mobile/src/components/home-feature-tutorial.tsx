import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type HomeTutorialSpotlight = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type HomeTutorialStep = {
  eyebrow: string;
  title: string;
  body: string;
};

type HomeFeatureTutorialProps = {
  visible: boolean;
  stepIndex: number;
  spotlight: HomeTutorialSpotlight | null;
  isPositioning: boolean;
  onNext: () => void;
  onSkip: () => void;
};

const CARD_SIDE_MARGIN = 16;
const CALLOUT_ARROW_SPACE = 38;
const ESTIMATED_CARD_HEIGHT = 230;

const HOME_TUTORIAL_STEPS: HomeTutorialStep[] = [
  {
    eyebrow: "1/4 지금 영어로",
    title: "떠오른 생각을 바로 영어로 바꿔 봐요",
    body:
      "지금 떠오르는 생각을 짧은 영어 문장으로 표현하는 연습을 해봐요. 알림을 설정하면 원하는 시간에 연습을 잊지 않고 이어갈 수 있어요."
  },
  {
    eyebrow: "2/4 질문 답변",
    title: "질문을 따라 문장을 완성해요",
    body: "질문과 힌트를 따라 쓰고, AI 피드백으로 문장을 다듬어 보세요."
  },
  {
    eyebrow: "3/4 난이도별 질문",
    title: "내 수준에 맞게 골라요",
    body: "입문부터 도전까지, 원하는 난이도의 질문을 선택해 연습할 수 있어요."
  },
  {
    eyebrow: "4/4 영어일기",
    title: "하루를 영어로 기록해요",
    body: "하루 이야기를 자유롭게 쓰고, 흐름과 표현에 대한 피드백을 받아 보세요."
  }
];

export const HOME_TUTORIAL_STEP_COUNT = HOME_TUTORIAL_STEPS.length;

export default function HomeFeatureTutorial({
  visible,
  stepIndex,
  spotlight,
  isPositioning,
  onNext,
  onSkip
}: HomeFeatureTutorialProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [cardHeight, setCardHeight] = useState(ESTIMATED_CARD_HEIGHT);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const arrowBounce = useRef(new Animated.Value(0)).current;
  const step = HOME_TUTORIAL_STEPS[stepIndex] ?? HOME_TUTORIAL_STEPS[0];
  const isLastStep = stepIndex === HOME_TUTORIAL_STEPS.length - 1;

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) {
        setReduceMotionEnabled(enabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotionEnabled
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    arrowBounce.stopAnimation();
    arrowBounce.setValue(0);
    if (!visible || !spotlight || reduceMotionEnabled) {
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(arrowBounce, {
          toValue: 1,
          duration: 620,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(arrowBounce, {
          toValue: 0,
          duration: 620,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        })
      ]),
      { iterations: 3 }
    );
    animation.start();

    return () => {
      animation.stop();
    };
  }, [arrowBounce, reduceMotionEnabled, spotlight, visible]);

  useEffect(() => {
    setCardHeight(ESTIMATED_CARD_HEIGHT);
  }, [stepIndex]);

  const minimumCardTop = insets.top + 12;
  const maximumCardBottom = windowHeight - insets.bottom - 16;
  const measuredCardHeight = Math.min(cardHeight, maximumCardBottom - minimumCardTop);
  const belowTop = spotlight
    ? spotlight.y + spotlight.height + CALLOUT_ARROW_SPACE
    : minimumCardTop;
  const aboveTop = spotlight
    ? spotlight.y - measuredCardHeight - CALLOUT_ARROW_SPACE
    : minimumCardTop;
  const canPlaceBelow = belowTop + measuredCardHeight <= maximumCardBottom;
  const canPlaceAbove = aboveTop >= minimumCardTop;
  const spaceBelow = spotlight
    ? maximumCardBottom - spotlight.y - spotlight.height
    : 0;
  const spaceAbove = spotlight ? spotlight.y - minimumCardTop : 0;
  const calloutPlacement = canPlaceBelow || (!canPlaceAbove && spaceBelow >= spaceAbove)
    ? "below"
    : "above";
  const unclampedCardTop = calloutPlacement === "below" ? belowTop : aboveTop;
  const cardTop = Math.max(
    minimumCardTop,
    Math.min(unclampedCardTop, maximumCardBottom - measuredCardHeight)
  );
  const spotlightRadius = spotlight
    ? Math.max(18, Math.min(34, spotlight.width / 2, spotlight.height / 2))
    : 24;
  const dimExtension = Math.max(windowWidth, windowHeight) + 100;
  const arrowTranslateY = reduceMotionEnabled
    ? 0
    : arrowBounce.interpolate({
        inputRange: [0, 1],
        outputRange: calloutPlacement === "below" ? [0, -5] : [0, 5]
      });

  return (
    <Modal
      animationType="fade"
      onRequestClose={() => undefined}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View
        accessibilityViewIsModal
        style={styles.root}
      >
        <Pressable
          accessibilityLabel="홈 사용법 안내"
          onPress={() => undefined}
          style={StyleSheet.absoluteFill}
        />

        {spotlight ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View
              style={[
                styles.roundedDim,
                {
                  left: spotlight.x - dimExtension,
                  top: spotlight.y - dimExtension,
                  width: spotlight.width + dimExtension * 2,
                  height: spotlight.height + dimExtension * 2,
                  borderWidth: dimExtension,
                  borderRadius: dimExtension + spotlightRadius
                }
              ]}
            />
            <View
              style={[
                styles.spotlightHalo,
                {
                  left: spotlight.x,
                  top: spotlight.y,
                  width: spotlight.width,
                  height: spotlight.height,
                  borderRadius: spotlightRadius
                }
              ]}
            />
            <View
              style={[
                styles.spotlightRing,
                {
                  left: spotlight.x,
                  top: spotlight.y,
                  width: spotlight.width,
                  height: spotlight.height,
                  borderRadius: spotlightRadius
                }
              ]}
            />
          </View>
        ) : (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.fullDim]} />
        )}

        {spotlight && !isPositioning ? (
          <View
            onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}
            style={[
              styles.card,
              {
                top: cardTop,
                left: CARD_SIDE_MARGIN,
                width: windowWidth - CARD_SIDE_MARGIN * 2
              }
            ]}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                styles.arrow,
                calloutPlacement === "below"
                  ? styles.arrowAboveCard
                  : styles.arrowBelowCard,
                { transform: [{ translateY: arrowTranslateY }] }
              ]}
            >
              <View
                style={[
                  styles.arrowShaft,
                  calloutPlacement === "below" ? styles.arrowShaftUp : styles.arrowShaftDown
                ]}
              />
              <View
                style={[
                  styles.arrowHead,
                  calloutPlacement === "below" ? styles.arrowHeadUp : styles.arrowHeadDown
                ]}
              />
            </Animated.View>

            <View style={styles.cardHeader}>
              <Text style={styles.eyebrow}>{step.eyebrow}</Text>
              <Pressable
                accessibilityLabel="홈 사용법 건너뛰기"
                accessibilityRole="button"
                hitSlop={10}
                onPress={onSkip}
                style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
              >
                <Text style={styles.skipButtonText}>건너뛰기</Text>
              </Pressable>
            </View>

            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.body}>{step.body}</Text>

            <View style={styles.footer}>
              <View
                style={styles.progressDots}
                accessibilityLabel={`${stepIndex + 1}단계 중 ${HOME_TUTORIAL_STEP_COUNT}단계`}
              >
                {HOME_TUTORIAL_STEPS.map((item, index) => (
                  <View
                    key={item.eyebrow}
                    style={[styles.progressDot, index === stepIndex && styles.progressDotActive]}
                  />
                ))}
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={onNext}
                style={({ pressed }) => [styles.nextButton, pressed && styles.pressed]}
              >
                <Text style={styles.nextButtonText}>{isLastStep ? "시작하기" : "다음"}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View pointerEvents="none" style={styles.positioningState}>
            <ActivityIndicator color="#F5A33B" size="large" />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  roundedDim: {
    position: "absolute",
    borderColor: "rgba(30, 24, 18, 0.72)",
    backgroundColor: "transparent"
  },
  fullDim: {
    backgroundColor: "rgba(30, 24, 18, 0.72)"
  },
  spotlightHalo: {
    position: "absolute",
    borderWidth: 9,
    borderColor: "rgba(255, 178, 71, 0.22)",
    backgroundColor: "transparent"
  },
  spotlightRing: {
    position: "absolute",
    borderWidth: 3,
    borderColor: "#FFB247",
    backgroundColor: "transparent"
  },
  card: {
    position: "absolute",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#F1BD74",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 8,
    shadowColor: "#1F160D",
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8
  },
  arrow: {
    position: "absolute",
    left: "50%",
    width: 38,
    height: 44,
    marginLeft: -19,
    alignItems: "center",
    justifyContent: "center"
  },
  arrowAboveCard: {
    top: -42
  },
  arrowBelowCard: {
    bottom: -42
  },
  arrowShaft: {
    position: "absolute",
    width: 9,
    height: 29,
    borderRadius: 5,
    backgroundColor: "#232128"
  },
  arrowShaftUp: {
    top: 13
  },
  arrowShaftDown: {
    top: 2
  },
  arrowHead: {
    position: "absolute",
    width: 0,
    height: 0,
    borderLeftWidth: 14,
    borderRightWidth: 14,
    borderLeftColor: "transparent",
    borderRightColor: "transparent"
  },
  arrowHeadUp: {
    top: 0,
    borderBottomWidth: 17,
    borderBottomColor: "#232128"
  },
  arrowHeadDown: {
    bottom: 0,
    borderTopWidth: 17,
    borderTopColor: "#232128"
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  eyebrow: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900",
    color: "#B26713"
  },
  skipButton: {
    paddingHorizontal: 4,
    paddingVertical: 4
  },
  skipButtonText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: "#8C7761"
  },
  title: {
    fontSize: 22,
    lineHeight: 29,
    fontWeight: "900",
    letterSpacing: -0.8,
    color: "#25211D"
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
    color: "#6F604F"
  },
  footer: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16
  },
  progressDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E8D9C7"
  },
  progressDotActive: {
    width: 24,
    backgroundColor: "#E88C13"
  },
  nextButton: {
    minWidth: 100,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingHorizontal: 20,
    backgroundColor: "#F5A33B"
  },
  nextButtonText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    color: "#24190E"
  },
  positioningState: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center"
  },
  pressed: {
    opacity: 0.76
  }
});
