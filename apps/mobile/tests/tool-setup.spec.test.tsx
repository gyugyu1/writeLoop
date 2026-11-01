// [spec] qa 테스트(작업 039-02 시나리오 B2, A4와 결정 03의 2).
// B2: 명세 1의 도구(jest-expo 환경, @testing-library/react-native, 렌더러)가 함께 돌아, React Native 컴포넌트를 렌더하고
// 누른 뒤 바뀐 문구를 확인할 수 있는지 본다. 준비 파일의 전역 설정에 기대지 않고, 매처는 Testing Library를 불러올 때 함께 들어온다.
// A4: tsconfig의 두 경로 별칭(@/* → ./src/*, @/assets/* → ./assets/*)이 테스트에서도 앱과 같은 파일로 풀리는지 본다.
import { render, screen, userEvent } from "@testing-library/react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { buildInlineFeedbackSegments as viaAlias } from "@/lib/inline-feedback";

// 앱 코드가 아니라 이 테스트만의 작은 컴포넌트: 버튼을 누르면 문구가 바뀐다.
function ToggleMessage() {
  const [opened, setOpened] = useState(false);
  return (
    <View>
      <Text testID="message">{opened ? "열림" : "닫힘"}</Text>
      <Pressable accessibilityRole="button" onPress={() => setOpened((value) => !value)}>
        <Text>바꾸기</Text>
      </Pressable>
    </View>
  );
}

describe("[spec] 모바일 테스트 도구", () => {
  it("[spec] B2: React Native 컴포넌트를 렌더하고 누르면 바뀐 문구를 확인할 수 있다", async () => {
    const user = userEvent.setup();
    await render(<ToggleMessage />);

    expect(screen.getByTestId("message")).toHaveTextContent("닫힘");
    expect(screen.queryByText("열림")).toBeNull();

    await user.press(screen.getByRole("button", { name: "바꾸기" }));
    expect(screen.getByTestId("message")).toHaveTextContent("열림");
    expect(screen.queryByText("닫힘")).toBeNull();

    await user.press(screen.getByRole("button", { name: "바꾸기" }));
    expect(screen.getByTestId("message")).toHaveTextContent("닫힘");
  });
});

describe("[spec] 경로 별칭", () => {
  it("[spec] A4 (가): @/lib/...는 src/lib/...와 같은 모듈로 풀린다", () => {
    // 같은 파일을 import 두 줄로 부르면 lint(import/no-duplicates)가 경고하므로, 상대 경로 쪽은 jest로 불러온다.
    const viaRelative: unknown = jest.requireActual<{ buildInlineFeedbackSegments: unknown }>(
      "../src/lib/inline-feedback"
    ).buildInlineFeedbackSegments;
    expect(typeof viaAlias).toBe("function");
    expect(viaAlias).toBe(viaRelative);
  });

  it("[spec] A4 (나): @/assets/...는 assets/...와 같은 파일로 풀린다", () => {
    const logoViaAlias: unknown = require("@/assets/images/main-logo.png");
    const logoViaRelative: unknown = require("../assets/images/main-logo.png");
    expect(logoViaAlias).toBe(logoViaRelative);
  });
});
