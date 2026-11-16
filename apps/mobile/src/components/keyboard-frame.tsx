import { useEffect, useState, type ReactNode } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, type StyleProp, type ViewStyle } from "react-native";

type KeyboardFrameProps = {
  style?: StyleProp<ViewStyle>;
  /** iOS에서 키보드 위에 더 띄울 간격. Android는 쓰지 않는다. */
  iosOffset?: number;
  /**
   * Android에서 키보드 위에 더 띄울 간격. 틀이 SafeAreaView 바로 아래가 아니라 한 겹 더 들어가
   * 틀의 위치가 상태 표시줄 높이만큼 덜 잡히는 화면(내 정보)에서 그 높이를 준다.
   */
  androidOffset?: number;
  children: ReactNode;
};

/** Android에서 키보드가 떠 있는가(다른 플랫폼은 늘 false). */
function useAndroidKeyboardShown() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const show = Keyboard.addListener("keyboardDidShow", () => setShown(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setShown(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return shown;
}

/**
 * 입력칸이 키보드에 가리지 않게 하는 틀. 키보드에 덮이는 만큼 아래 여백(padding)을 둔다.
 * Android는 키보드를 내릴 때 키보드 위쪽 끝을 화면 끝이 아니라 내비게이션 바 위쯤으로 알려,
 * 내린 뒤에도 그만큼 여백이 남는다. 그래서 Android에서는 키보드가 떠 있는 동안만 여백을 둔다
 * (끄면 여백이 0이 된다. height 방식은 끈 뒤에도 고정 높이가 남아 쓰지 않는다).
 */
export function KeyboardFrame({ style, iosOffset = 0, androidOffset = 0, children }: KeyboardFrameProps) {
  const androidKeyboardShown = useAndroidKeyboardShown();
  return (
    <KeyboardAvoidingView
      style={style}
      behavior="padding"
      enabled={Platform.OS !== "android" || androidKeyboardShown}
      keyboardVerticalOffset={Platform.OS === "ios" ? iosOffset : androidOffset}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
