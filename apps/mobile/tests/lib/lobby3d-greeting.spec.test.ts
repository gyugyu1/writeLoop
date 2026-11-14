// [spec] qa 테스트(작업 060-10, 새 기능: 로비에 들어올 때 학습 상태에 따른 인사).
// 기대값은 시나리오(060-10의 02-qa-scenarios.md N3)에서만 가져온다. 홈은 로그인 전이면 로그인 화면으로 보내 화면으로는 볼 수 없으므로,
// 판정 함수(lobbyGreeting)를 바로 부른다. 구현 코드는 부르는 방법(인자 이름, 돌려주는 line·action)을 알려고만 읽었다.
// 작업 061의 12 결정(사용자 2026-11-07: 기본 말을 없애고, 판정 "그 밖"(로그인하지 않았거나 정보를 받지 못함 포함)은 "또 왔네! 반가워."와 wave)으로 N3을 고쳤다.
import { lobbyGreeting } from "@/lib/lobby3d/lobby-greeting";

/** 인사 "그 밖"(061-12 결정). */
const AGAIN = "또 왔네! 반가워.";

describe("[spec] 판정: 로그인하지 않음(N3)", () => {
  it("N3(061-12 결정): 로그인하지 않았으면 다른 값이 오늘 완료·연속 5일이어도 그 밖('또 왔네! 반가워.', wave)이다", () => {
    const greeting = lobbyGreeting({
      ready: false,
      answerSessions: 12,
      diaryEntries: 3,
      hasIncomplete: false,
      completedToday: true,
      streakDays: 5,
      lastWritingDate: "2026-11-12",
      today: "2026-11-12"
    });

    expect(greeting.line).toBe(AGAIN);
    expect(greeting.action).toBe("wave");
  });
});
