// [spec] qa 테스트(작업 060-10, 새 기능: 로비에 들어올 때 학습 상태에 따른 인사).
// 기대값은 시나리오(060-10의 02-qa-scenarios.md N3)에서만 가져온다. 홈은 로그인 전이면 로그인 화면으로 보내 화면으로는 볼 수 없으므로,
// 판정 함수(lobbyGreeting)를 바로 부른다. 구현 코드는 부르는 방법(인자 이름, 돌려주는 line·action)을 알려고만 읽었다.
import { lobbyGreeting } from "@/lib/lobby3d/lobby-greeting";

const IDLE_LINE = "오늘은 뭘 해 볼까?\n가고 싶은 곳을 눌러 봐.";

describe("[spec] 판정: 로그인하지 않음(N3)", () => {
  it("N3: 로그인하지 않았으면 다른 값이 오늘 완료·연속 5일이어도 그 밖(기본 말, wave)이다", () => {
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

    expect(greeting.line).toBe(IDLE_LINE);
    expect(greeting.action).toBe("wave");
  });
});
