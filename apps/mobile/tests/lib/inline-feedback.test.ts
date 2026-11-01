import { buildInlineFeedbackSegments } from "@/lib/inline-feedback";

// 순수 함수 테스트가 도구에서 도는지 보이는 테스트. 지금 동작을 그대로 적는다.
describe("buildInlineFeedbackSegments", () => {
  it("고친 문장이 같으면 원문 하나를 그대로 둔다", () => {
    expect(buildInlineFeedbackSegments("I like coffee.", "I like coffee.")).toEqual([
      { kind: "equal", text: "I like coffee." }
    ]);
  });

  it("모델 구간이 없으면 원문과 고친 문장의 차이로 구간을 만든다", () => {
    expect(buildInlineFeedbackSegments("I go to school yesterday.", "I went to school yesterday.")).toEqual([
      { kind: "equal", text: "I " },
      { kind: "replace", removed: "go", added: "went" },
      { kind: "equal", text: " to school yesterday." }
    ]);
  });
});
