import { useState } from "react";
import { StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";

interface SimpleSliderProps {
  /** 읽어 주는 이름(화면에는 바깥에서 따로 쓴다). */
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  /** 읽어 줄 값 문구. 없으면 숫자 그대로. */
  valueText?: string;
  accent?: string;
  testID?: string;
}

// 앱에 슬라이더 라이브러리가 없어 만든 가로 막대 슬라이더. 끌거나 눌러 값을 고르고, 화면 낭독기에서는 올리기·내리기로 바꾼다.
export default function SimpleSlider({ label, value, min, max, step, onChange, valueText, accent = "#E36A00", testID }: SimpleSliderProps) {
  const [width, setWidth] = useState(0);
  const ratio = max > min ? (value - min) / (max - min) : 0;
  const clampStep = (v: number) => {
    const stepped = Math.round((v - min) / step) * step + min;
    return Math.min(max, Math.max(min, Number(stepped.toFixed(4))));
  };
  const pick = (event: GestureResponderEvent) => {
    if (width <= 0) return;
    const x = Math.min(width, Math.max(0, event.nativeEvent.locationX));
    onChange(clampStep(min + (x / width) * (max - min)));
  };
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text: valueText }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "increment") onChange(clampStep(value + step));
        if (event.nativeEvent.actionName === "decrement") onChange(clampStep(value - step));
      }}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={pick}
      onResponderMove={pick}
      style={styles.hit}
    >
      <View pointerEvents="none" style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: accent }]} />
      </View>
      <View pointerEvents="none" style={[styles.knob, { left: `${Math.round(ratio * 100)}%`, borderColor: accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  hit: {
    height: 36,
    justifyContent: "center"
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E7DCCF",
    overflow: "hidden"
  },
  fill: {
    height: 6
  },
  knob: {
    position: "absolute",
    width: 22,
    height: 22,
    marginLeft: -11,
    borderRadius: 11,
    borderWidth: 3,
    backgroundColor: "#FFFFFF"
  }
});
