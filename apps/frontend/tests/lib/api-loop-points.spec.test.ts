// [spec] qa 테스트(작업 086-05 적립 알림, 새 기능). 웹 API 층(lib/api.ts)이 완료·일기 피드백 응답의 loopPoints를 화면까지 넘기는지.
// 기대값은 05-적립-알림/03-qa-scenarios-web.md의 A(W-A1~A5)에서만 가져왔다. fetch만 가짜로 두고 실제 함수를 부른다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { completeFeedbackSession, requestDiaryFeedback } from "../../lib/api";

const fetchMock = vi.fn();

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

// 시나리오의 "일기 피드백 응답 예".
function diaryFeedbackBody(extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: "diary-feedback-v1",
    entryId: "e-1",
    attemptNo: 1,
    score: 72,
    finishable: true,
    diaryAnswerBand: "DIARY_CLEAR_BASIC",
    summaryKo: "흐름이 자연스러워요.",
    strengths: ["시간 순서가 분명해요."],
    correctedDiary: null,
    modelDiary: null,
    modelDiaryKo: null,
    fixPoints: [],
    diaryFlow: {
      timeFlow: "아침에서 저녁으로",
      emotion: "편안함",
      detail: "공원",
      reflection: "내일도 걷기",
      commentKo: "시간 순서가 보여요.",
      connectionTips: []
    },
    rewriteIdeas: [],
    usedDiaryExpressions: [],
    diaryExpressions: [],
    nextDiaryMission: {
      focus: "detail",
      titleKo: "느낌을 한 문장 더",
      instructionKo: "그때 느낌을 한 문장 더 써 보세요.",
      starterEn: "I felt"
    },
    safetyFlags: [],
    ...extra
  };
}

const DIARY_REQUEST = { bodyText: "Today I walked.", attemptType: "INITIAL" as const };

describe("[spec] 웹 API 층의 loopPoints 전달", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("[spec] W-A1 completeFeedbackSession은 응답의 loopPoints와 sessionId·status를 그대로 돌려준다", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        sessionId: "s-1",
        status: "COMPLETED",
        loopPoints: { activity: "question", earned: 30, balance: 260, dailyLimitReached: false }
      })
    );

    const result = await completeFeedbackSession("s-1");

    expect(result.loopPoints).toEqual({ activity: "question", earned: 30, balance: 260, dailyLimitReached: false });
    expect(result.sessionId).toBe("s-1");
    expect(result.status).toBe("COMPLETED");
  });

  it("[spec] W-A2 completeFeedbackSession은 loopPoints가 null이면 null이거나 없는 값을 돌려주고 status는 그대로다", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ sessionId: "s-1", status: "COMPLETED", loopPoints: null }));

    const result = await completeFeedbackSession("s-1");

    expect(result.loopPoints == null).toBe(true);
    expect(result.status).toBe("COMPLETED");
  });

  it("[spec] W-A3 requestDiaryFeedback은 응답의 loopPoints와 다른 필드를 그대로 돌려준다", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        diaryFeedbackBody({ loopPoints: { activity: "diary", earned: 30, balance: 230, dailyLimitReached: false } })
      )
    );

    const result = await requestDiaryFeedback("e-1", DIARY_REQUEST);

    expect(result.loopPoints).toEqual({ activity: "diary", earned: 30, balance: 230, dailyLimitReached: false });
    expect(result.entryId).toBe("e-1");
    expect(result.attemptNo).toBe(1);
    expect(result.score).toBe(72);
    expect(result.summaryKo).toBe("흐름이 자연스러워요.");
  });

  it("[spec] W-A4 requestDiaryFeedback은 한도에 닿은 loopPoints를 그대로 돌려준다", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        diaryFeedbackBody({ loopPoints: { activity: "diary", earned: 0, balance: 230, dailyLimitReached: true } })
      )
    );

    const result = await requestDiaryFeedback("e-1", DIARY_REQUEST);

    expect(result.loopPoints).toEqual({ activity: "diary", earned: 0, balance: 230, dailyLimitReached: true });
  });

  it("[spec] W-A5 requestDiaryFeedback은 loopPoints 키가 없으면 null이거나 없는 값을 돌려주고 다른 필드는 그대로다", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(diaryFeedbackBody()));

    const result = await requestDiaryFeedback("e-1", DIARY_REQUEST);

    expect(result.loopPoints == null).toBe(true);
    expect(result.entryId).toBe("e-1");
    expect(result.attemptNo).toBe(1);
    expect(result.score).toBe(72);
    expect(result.summaryKo).toBe("흐름이 자연스러워요.");
  });
});
