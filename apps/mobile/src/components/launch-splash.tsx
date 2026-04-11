import { useEffect, useRef } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";

type LaunchSplashProps = {
  onFinish: () => void;
};

const splashImage = require("@/assets/images/brand-splash.png");
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IMAGE_WIDTH = Math.min(SCREEN_WIDTH - 36, 300);
const IMAGE_HEIGHT = IMAGE_WIDTH * (280 / 300);

export default function LaunchSplash({ onFinish }: LaunchSplashProps) {
  const imageOpacity = useRef(new Animated.Value(0)).current;
  const imageScale = useRef(new Animated.Value(0.94)).current;
  const imageTranslateY = useRef(new Animated.Value(10)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const entrance = Animated.parallel([
      Animated.timing(imageOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.spring(imageScale, {
        toValue: 1,
        friction: 8,
        tension: 48,
        useNativeDriver: true
      }),
      Animated.timing(imageTranslateY, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      })
    ]);

    const exit = Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 260,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true
      }),
      Animated.timing(imageScale, {
        toValue: 1.02,
        duration: 260,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true
      }),
      Animated.timing(imageOpacity, {
        toValue: 0.86,
        duration: 260,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true
      })
    ]);

    const animation = Animated.sequence([entrance, Animated.delay(880), exit]);
    animation.start(({ finished }) => {
      if (finished) {
        onFinish();
      }
    });

    return () => {
      animation.stop();
    };
  }, [
    imageOpacity,
    imageScale,
    imageTranslateY,
    onFinish,
    overlayOpacity
  ]);

  return (
    <Animated.View pointerEvents="none" style={[styles.overlay, { opacity: overlayOpacity }]}>
      <View style={styles.backdropHalo} />
      <Animated.Image
        source={splashImage}
        style={[
          styles.brandImage,
          {
            opacity: imageOpacity,
            transform: [{ translateY: imageTranslateY }, { scale: imageScale }]
          }
        ]}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F2A14A",
    overflow: "hidden",
    zIndex: 20
  },
  backdropHalo: {
    position: "absolute",
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_WIDTH * 0.9,
    borderRadius: 9999,
    backgroundColor: "#FFD9AE",
    opacity: 0.34
  },
  brandImage: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    shadowColor: "#DAB48D",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5
  }
});
