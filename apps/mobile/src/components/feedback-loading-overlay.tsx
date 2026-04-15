import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";

type FeedbackLoadingStage = {
  title: string;
  message: string;
};

type FeedbackLoadingOverlayProps = {
  visible: boolean;
  title: string;
  message: string;
  stages?: FeedbackLoadingStage[];
};

const mascotImage = require("@/assets/images/feedback-loading-mascot-cutout.png");
const DOT_COUNT = 3;
const COPY_ROTATION_INTERVAL_MS = 2300;

export default function FeedbackLoadingOverlay({
  visible,
  title,
  message,
  stages
}: FeedbackLoadingOverlayProps) {
  const haloScale = useRef(new Animated.Value(0.92)).current;
  const haloOpacity = useRef(new Animated.Value(0.34)).current;
  const mascotTranslateY = useRef(new Animated.Value(0)).current;
  const dotProgressValues = useRef(
    Array.from({ length: DOT_COUNT }, () => new Animated.Value(0))
  ).current;
  const [activeStageIndex, setActiveStageIndex] = useState(0);

  const effectiveStages = useMemo(() => {
    const normalizedStages =
      stages?.filter(
        (stage) => stage.title.trim().length > 0 || stage.message.trim().length > 0
      ) ?? [];

    if (normalizedStages.length > 0) {
      return normalizedStages;
    }

    return [{ title, message }];
  }, [message, stages, title]);

  const stageSignature = useMemo(
    () => effectiveStages.map((stage) => `${stage.title}\u0001${stage.message}`).join("\u0002"),
    [effectiveStages]
  );

  useEffect(() => {
    setActiveStageIndex(0);

    if (!visible || effectiveStages.length <= 1) {
      return;
    }

    const interval = setInterval(() => {
      setActiveStageIndex((current) => (current + 1) % effectiveStages.length);
    }, COPY_ROTATION_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [effectiveStages.length, stageSignature, visible]);

  useEffect(() => {
    if (!visible) {
      haloScale.setValue(0.92);
      haloOpacity.setValue(0.34);
      mascotTranslateY.setValue(0);
      dotProgressValues.forEach((value) => value.setValue(0));
      return;
    }

    const haloAnimation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(haloScale, {
            toValue: 1.06,
            duration: 920,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true
          }),
          Animated.timing(haloOpacity, {
            toValue: 0.5,
            duration: 920,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true
          })
        ]),
        Animated.parallel([
          Animated.timing(haloScale, {
            toValue: 0.92,
            duration: 920,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true
          }),
          Animated.timing(haloOpacity, {
            toValue: 0.34,
            duration: 920,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true
          })
        ])
      ])
    );

    const mascotAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(mascotTranslateY, {
          toValue: -8,
          duration: 780,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(mascotTranslateY, {
          toValue: 0,
          duration: 780,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        })
      ])
    );

    const dotAnimations = dotProgressValues.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 140),
          Animated.timing(value, {
            toValue: 1,
            duration: 280,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 280,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true
          }),
          Animated.delay(260)
        ])
      )
    );

    const animations = [haloAnimation, mascotAnimation, ...dotAnimations];
    animations.forEach((animation) => animation.start());

    return () => {
      animations.forEach((animation) => animation.stop());
    };
  }, [dotProgressValues, haloOpacity, haloScale, mascotTranslateY, visible]);

  if (!visible) {
    return null;
  }

  const activeStage = effectiveStages[Math.min(activeStageIndex, effectiveStages.length - 1)];

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.illustrationFrame}>
          <Animated.View
            style={[
              styles.halo,
              {
                opacity: haloOpacity,
                transform: [{ scale: haloScale }]
              }
            ]}
          />
          <Animated.View
            style={[
              styles.mascotFrame,
              {
                transform: [{ translateY: mascotTranslateY }]
              }
            ]}
          >
            <Image source={mascotImage} style={styles.mascotImage} resizeMode="contain" />
          </Animated.View>
        </View>

        <Text style={styles.title}>{activeStage.title}</Text>
        <Text style={styles.message}>{activeStage.message}</Text>

        <View style={styles.dotRow}>
          {dotProgressValues.map((value, index) => {
            const translateY = value.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -7]
            });
            const opacity = value.interpolate({
              inputRange: [0, 1],
              outputRange: [0.35, 1]
            });
            const scale = value.interpolate({
              inputRange: [0, 1],
              outputRange: [0.92, 1.12]
            });

            return (
              <Animated.View
                key={`feedback-loading-dot-${index}`}
                style={[
                  styles.dot,
                  {
                    opacity,
                    transform: [{ translateY }, { scale }]
                  }
                ]}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    backgroundColor: "rgba(247, 242, 235, 0.8)",
    zIndex: 50
  },
  card: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 22,
    alignItems: "center",
    backgroundColor: "rgba(255, 252, 247, 0.98)",
    borderWidth: 1,
    borderColor: "#E7D7C4",
    shadowColor: "#C97A1E",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8
  },
  illustrationFrame: {
    width: 164,
    height: 164,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12
  },
  halo: {
    position: "absolute",
    width: 152,
    height: 152,
    borderRadius: 999,
    backgroundColor: "#F9C27C"
  },
  mascotFrame: {
    width: 132,
    height: 132,
    alignItems: "center",
    justifyContent: "center"
  },
  mascotImage: {
    width: 132,
    height: 132
  },
  title: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "900",
    color: "#2B2620",
    textAlign: "center"
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
    color: "#7A6853",
    textAlign: "center"
  },
  dotRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#E38B12"
  }
});
