import type {
  AdminPromptRecommendationMetrics,
  AdminPrompt,
  AdminPromptHint,
  AdminPromptHintRequest,
  AdminPromptRequest,
  AdminPromptTopicCatalogEntry,
  AuthNotice,
  CoachHelpRequest,
  CoachHelpResponse,
  CoachUsageCheckRequest,
  CoachUsageCheckResponse,
  CommonMistake,
  CompleteRegistrationRequest,
  CompleteSocialRegistrationRequest,
  DeleteAccountRequest,
  AuthUser,
  DailyDifficulty,
  DailyPromptRecommendation,
  DiaryAttempt,
  DiaryEntry,
  DiaryEntryRequest,
  DiaryFeedback,
  DiaryFeedbackRequest,
  FeaturedDailyPromptRecommendation,
  HistoryMonthStatus,
  PasswordResetAvailability,
  PendingSocialRegistration,
  Feedback,
  FeedbackRequest,
  FeedbackSessionStatus,
  HistorySession,
  LoginRequest,
  PromptHint,
  Prompt,
  RegisterRequest,
  ResetPasswordRequest,
  SavedExpression,
  SaveExpressionRequest,
  SendPasswordResetCodeRequest,
  SendRegistrationCodeRequest,
  SaveWritingDraftRequest,
  TodayWritingStatus,
  UpdateProfileRequest,
  VerifyPasswordResetCodeRequest,
  VerifyEmailRequest,
  WritingDraft,
  WritingDraftType
} from "./types";
import { normalizeDailyDifficulty } from "./difficulty";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";
const PROMPTS_CACHE_TTL_MS = 60_000;

let promptsCache: { expiresAt: number; value: Prompt[] } | null = null;
let promptsRequest: Promise<Prompt[]> | null = null;

function createCoachExpressionId(promptId: string, expression: string, index: number) {
  const base = expression
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `coach-${promptId}-${base || index + 1}`;
}

function normalizeExpressionTags(tags?: string[] | null) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return Array.from(
    new Set(
      tags
        .map((tag) => tag?.trim() ?? "")
        .filter(Boolean)
    )
  );
}

function normalizeRefinementExpressionItem(
  item: {
    expression?: string | null;
    type?: "LEXICAL" | "FRAME" | null;
    source?: "MODEL_ANSWER" | "PROMPT_HINT" | "GENERATED" | null;
    meaningKo?: string | null;
    meaningType?: "GLOSS" | "PATTERN_EXPLANATION" | "NONE" | null;
    guidance?: string | null;
    guidanceKo?: string | null;
    example?: string | null;
    exampleEn?: string | null;
    exampleSource?: "EXTRACTED" | "OPENAI" | "GENERATED" | "NONE" | null;
    displayable?: boolean | null;
    qualityFlags?: string[] | null;
  } | null | undefined
) {
  if (!item?.expression) {
    return null;
  }

  return {
    expression: item.expression,
    type: item.type ?? null,
    source: item.source ?? null,
    meaningKo: item.meaningKo ?? null,
    meaningType: item.meaningType ?? null,
    guidanceKo: item.guidanceKo ?? item.guidance ?? null,
    exampleEn: item.exampleEn ?? item.example ?? null,
    exampleSource: item.exampleSource ?? null,
    displayable: item.displayable ?? null,
    qualityFlags: item.qualityFlags ?? null
  };
}

function normalizeFeedbackPayload<
  T extends {
    refinementExpressions?: unknown[] | null;
    visibleFeedback?: {
      refinementExpressions?: unknown[] | null;
    } | null;
  }
>(
  feedback: T
): T {
  const refinementExpressions = (feedback.refinementExpressions ?? [])
    .map((item) => normalizeRefinementExpressionItem(item as never))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const visibleFeedback = feedback.visibleFeedback
    ? {
        ...feedback.visibleFeedback,
        refinementExpressions: (feedback.visibleFeedback.refinementExpressions ?? [])
          .map((item) => normalizeRefinementExpressionItem(item as never))
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
      }
    : feedback.visibleFeedback;

  return {
    ...feedback,
    refinementExpressions,
    visibleFeedback
  } as T;
}

function normalizePromptItem(prompt: Prompt): Prompt {
  return {
    ...prompt,
    difficulty: normalizeDailyDifficulty(prompt.difficulty)
  };
}

function normalizeDailyPromptRecommendationPayload(
  payload: DailyPromptRecommendation
): DailyPromptRecommendation {
  return {
    ...payload,
    difficulty: normalizeDailyDifficulty(payload.difficulty),
    featured: payload.featured
      ? {
          ...payload.featured,
          prompt: normalizePromptItem(payload.featured.prompt)
        }
      : payload.featured ?? null,
    alternatives: (payload.alternatives ?? []).map((item) => ({
      ...item,
      prompt: normalizePromptItem(item.prompt)
    })),
    prompts: (payload.prompts ?? []).map((prompt) => normalizePromptItem(prompt))
  };
}

function normalizeFeaturedDailyPromptRecommendationPayload(
  payload: FeaturedDailyPromptRecommendation
): FeaturedDailyPromptRecommendation {
  return {
    ...payload,
    difficulty: normalizeDailyDifficulty(payload.difficulty),
    featured: payload.featured
      ? {
          ...payload.featured,
          prompt: normalizePromptItem(payload.featured.prompt)
        }
      : payload.featured ?? null
  };
}

function normalizeWritingDraftPayload(payload: WritingDraft): WritingDraft {
  const nextPayload = {
    ...payload,
    selectedDifficulty: normalizeDailyDifficulty(payload.selectedDifficulty)
  };

  return payload.feedback
    ? {
        ...nextPayload,
        feedback: normalizeFeedbackPayload(payload.feedback)
      }
    : nextPayload;
}

const DIARY_ANSWER_BANDS = new Set<DiaryFeedback["diaryAnswerBand"]>([
  "DIARY_TOO_SHORT",
  "DIARY_NOT_ENGLISH",
  "DIARY_GRAMMAR_BLOCKING",
  "DIARY_FLOW_THIN",
  "DIARY_CLEAR_BASIC",
  "DIARY_NATURAL_COMPLETE"
]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeDiaryAnswerBand(value: unknown): DiaryFeedback["diaryAnswerBand"] {
  if (typeof value === "string" && DIARY_ANSWER_BANDS.has(value as DiaryFeedback["diaryAnswerBand"])) {
    return value as DiaryFeedback["diaryAnswerBand"];
  }

  return "DIARY_CLEAR_BASIC";
}

function normalizeDiaryCorrectionPointPayload(value: unknown) {
  const payload = asRecord(value);
  return {
    kind: asString(payload.kind),
    title: asString(payload.title),
    originalText: asNullableString(payload.originalText),
    revisedText: asNullableString(payload.revisedText),
    reasonKo: asString(payload.reasonKo),
    exampleEn: asNullableString(payload.exampleEn)
  };
}

function normalizeDiaryExpressionPayload(value: unknown) {
  const payload = asRecord(value);
  return {
    expression: asString(payload.expression),
    meaningKo: asString(payload.meaningKo),
    exampleEn: asNullableString(payload.exampleEn),
    usageTipKo: asString(payload.usageTipKo),
    tags: normalizeExpressionTags(asStringArray(payload.tags))
  };
}

function normalizeDiaryRewriteIdeaPayload(value: unknown) {
  const payload = asRecord(value);
  return {
    title: asString(payload.title),
    meaningKo: asNullableString(payload.meaningKo),
    noteKo: asString(payload.noteKo),
    exampleEn: asNullableString(payload.exampleEn)
  };
}

function normalizeDiaryFlowPayload(value: unknown) {
  const payload = asRecord(value);
  return {
    timeFlow: asString(payload.timeFlow),
    emotion: asString(payload.emotion),
    detail: asString(payload.detail),
    reflection: asString(payload.reflection),
    commentKo: asString(payload.commentKo),
    connectionTips: asStringArray(payload.connectionTips)
  };
}

function normalizeDiaryMissionPayload(value: unknown) {
  const payload = asRecord(value);
  return {
    focus: asString(payload.focus),
    titleKo: asString(payload.titleKo),
    instructionKo: asString(payload.instructionKo),
    starterEn: asNullableString(payload.starterEn)
  };
}

function normalizeDiaryFeedbackPayload(value: unknown): DiaryFeedback | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const payload = asRecord(value);
  return {
    schemaVersion: asString(payload.schemaVersion, "diary-feedback-v1"),
    entryId: asString(payload.entryId),
    attemptNo: asNumber(payload.attemptNo),
    score: Math.max(0, Math.min(100, asNumber(payload.score))),
    finishable: asBoolean(payload.finishable),
    diaryAnswerBand: normalizeDiaryAnswerBand(payload.diaryAnswerBand),
    summaryKo: asString(payload.summaryKo),
    strengths: asStringArray(payload.strengths),
    correctedDiary: asNullableString(payload.correctedDiary),
    modelDiary: asNullableString(payload.modelDiary),
    modelDiaryKo: asNullableString(payload.modelDiaryKo),
    fixPoints: Array.isArray(payload.fixPoints)
      ? payload.fixPoints.map((item) => normalizeDiaryCorrectionPointPayload(item))
      : [],
    diaryFlow: normalizeDiaryFlowPayload(payload.diaryFlow),
    rewriteIdeas: Array.isArray(payload.rewriteIdeas)
      ? payload.rewriteIdeas.map((item) => normalizeDiaryRewriteIdeaPayload(item))
      : [],
    usedDiaryExpressions: Array.isArray(payload.usedDiaryExpressions)
      ? payload.usedDiaryExpressions.map((item) => normalizeDiaryExpressionPayload(item))
      : [],
    diaryExpressions: Array.isArray(payload.diaryExpressions)
      ? payload.diaryExpressions.map((item) => normalizeDiaryExpressionPayload(item))
      : [],
    nextDiaryMission: normalizeDiaryMissionPayload(payload.nextDiaryMission),
    safetyFlags: asStringArray(payload.safetyFlags)
  };
}

function normalizeDiaryAttemptPayload(payload: {
  id?: number | null;
  attemptNo?: number | null;
  diaryText?: string | null;
  score?: number | null;
  feedbackSummary?: string | null;
  feedback?: unknown;
  createdAt?: string | null;
}): DiaryAttempt {
  return {
    id: payload.id ?? 0,
    attemptNo: payload.attemptNo ?? 0,
    diaryText: payload.diaryText ?? "",
    score: payload.score ?? 0,
    feedbackSummary: payload.feedbackSummary ?? null,
    feedback: normalizeDiaryFeedbackPayload(payload.feedback),
    createdAt: payload.createdAt ?? new Date().toISOString()
  };
}

function normalizeDiaryEntryPayload(payload: {
  entryId?: string | null;
  entryDate?: string | null;
  title?: string | null;
  content?: string | null;
  language?: string | null;
  mood?: string | null;
  tags?: string[] | null;
  draft?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  attempts?: Array<{
    id?: number | null;
    attemptNo?: number | null;
    diaryText?: string | null;
    score?: number | null;
    feedbackSummary?: string | null;
    feedback?: unknown;
    createdAt?: string | null;
  }> | null;
}): DiaryEntry {
  return {
    entryId: payload.entryId ?? "",
    title: payload.title ?? null,
    content: payload.content ?? "",
    language: payload.language ?? "en",
    entryDate: payload.entryDate ?? null,
    mood: payload.mood ?? null,
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    draft: payload.draft ?? true,
    createdAt: payload.createdAt ?? payload.updatedAt ?? new Date().toISOString(),
    updatedAt: payload.updatedAt ?? payload.createdAt ?? new Date().toISOString(),
    attempts: (payload.attempts ?? []).map((attempt) => normalizeDiaryAttemptPayload(attempt))
  };
}

function normalizeCoachUsageExpression(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getMeaningfulCoachUsageTokens(value: string) {
  return normalizeCoachUsageExpression(value)
    .split(" ")
    .filter((token) => token.length >= 3);
}

function dedupeUsedCoachUsageExpressions<T extends { expression: string }>(expressions: T[]) {
  if (expressions.length < 2) {
    return expressions;
  }

  const specificityScore = (expression: T) => {
    const normalized = normalizeCoachUsageExpression(expression.expression);
    const meaningfulTokenCount = getMeaningfulCoachUsageTokens(expression.expression).length;
    const totalTokenCount = normalized ? normalized.split(" ").length : 0;
    return meaningfulTokenCount * 100 + totalTokenCount * 10 + normalized.length;
  };

  const overlaps = (left: T, right: T) => {
    const leftNormalized = normalizeCoachUsageExpression(left.expression);
    const rightNormalized = normalizeCoachUsageExpression(right.expression);

    if (!leftNormalized || !rightNormalized) {
      return false;
    }

    if (leftNormalized === rightNormalized) {
      return true;
    }

    const leftTokens = new Set(getMeaningfulCoachUsageTokens(left.expression));
    const rightTokens = new Set(getMeaningfulCoachUsageTokens(right.expression));
    const sharedTokens = [...leftTokens].filter((token) => rightTokens.has(token));
    if (sharedTokens.length < Math.min(2, leftTokens.size, rightTokens.size)) {
      return false;
    }

    return leftNormalized.includes(rightNormalized) || rightNormalized.includes(leftNormalized);
  };

  const prioritized = [...expressions].sort((left, right) => specificityScore(right) - specificityScore(left));
  const selected: T[] = [];

  for (const expression of prioritized) {
    if (!selected.some((existing) => overlaps(expression, existing))) {
      selected.push(expression);
    }
  }

  return expressions.filter((expression) => selected.includes(expression));
}

function normalizeCoachHelpResponse(
  payload: {
    promptId?: string;
    userQuestion?: string;
    coachReply?: string;
    interactionId?: string;
    expressions?: Array<{
      id?: string;
      expression?: string;
      meaningKo?: string;
      usageTip?: string;
      example?: string;
      tags?: string[] | null;
    }>;
  },
  fallbackPromptId: string,
  fallbackQuestion: string
): CoachHelpResponse {
  const promptId = payload.promptId ?? fallbackPromptId;
  const userQuestion = payload.userQuestion ?? fallbackQuestion;
  const expressions = (payload.expressions ?? [])
    .filter((expression): expression is NonNullable<typeof expression> => Boolean(expression?.expression))
    .map((expression, index) => ({
      id: expression.id ?? createCoachExpressionId(promptId, expression.expression ?? "", index),
      expression: expression.expression ?? "",
      meaningKo: expression.meaningKo ?? "이 질문에 바로 가져다 쓸 수 있는 표현이에요.",
      usageTip: expression.usageTip ?? "답변 흐름 안에 자연스럽게 한 번 넣어보세요.",
      example: expression.example ?? expression.expression ?? "",
      tags: normalizeExpressionTags(expression.tags)
    }));

  return {
    promptId,
    userQuestion,
    coachReply: payload.coachReply ?? "이 질문에 맞는 표현을 골라 답변에 자연스럽게 넣어보세요.",
    expressions,
    interactionId: payload.interactionId
  };
}

function normalizeCoachUsageResponse(
  payload: {
    promptId?: string;
    coachReply?: string;
    usedExpressions?: Array<{
      expression?: string;
      matched?: boolean;
      matchType?: string;
      matchedText?: string | null;
      source?: string;
      usageTip?: string | null;
      tags?: string[] | null;
    }>;
    unusedExpressions?: Array<{
      expression?: string;
      matched?: boolean;
      matchType?: string;
      matchedText?: string | null;
      source?: string;
      usageTip?: string | null;
      tags?: string[] | null;
    }>;
    suggestedPromptIds?: string[];
  },
  request: CoachUsageCheckRequest
): CoachUsageCheckResponse {
  const expressionLookup = new Map(
    request.expressions.map((expression) => [expression.expression, expression] as const)
  );

  const hydrate = (
    items: Array<{
      expression?: string;
      matched?: boolean;
      matchType?: string;
      matchedText?: string | null;
      source?: string;
      usageTip?: string | null;
      tags?: string[] | null;
    }> = []
  ) =>
    items
      .filter((item): item is NonNullable<typeof item> => Boolean(item?.expression))
      .map((item, index) => {
        const source = expressionLookup.get(item.expression ?? "");
        const expressionSource =
          (item.source as "RECOMMENDED" | "SELF_DISCOVERED" | undefined) ??
          "RECOMMENDED";
        const overrides = {
          meaningKo:
            source?.meaningKo ??
            (expressionSource === "SELF_DISCOVERED"
              ? "답변 안에서 스스로 잘 살린 표현이에요."
              : "질문에 맞는 표현이에요."),
          usageTip:
            item.usageTip ??
            source?.usageTip ??
            (expressionSource === "SELF_DISCOVERED"
              ? "AI가 추천하지 않아도, 이런 표현은 다음 답변에서도 다시 써볼 수 있어요."
              : "답변 안에서 자연스럽게 연결해 보세요."),
          example: source?.example ?? item.matchedText ?? item.expression ?? "",
          tags: normalizeExpressionTags(item.tags ?? source?.tags),
          source: expressionSource
        };

        return {
          id:
            source?.id ??
            createCoachExpressionId(request.promptId, item.expression ?? "", index),
          expression: item.expression ?? "",
          matched: Boolean(item.matched),
          matchType: (item.matchType ?? "UNUSED") as CoachUsageCheckResponse["usedExpressions"][number]["matchType"],
          matchedText: item.matchedText ?? null,
          ...overrides
        };
      });

  return {
    promptId: payload.promptId ?? request.promptId,
    praiseMessage: payload.coachReply ?? "추천 표현이 어떻게 쓰였는지 확인해요.",
    usedExpressions: dedupeUsedCoachUsageExpressions(hydrate(payload.usedExpressions)),
    unusedExpressions: hydrate(payload.unusedExpressions),
    relatedPromptIds: payload.suggestedPromptIds ?? []
  };
}

export class ApiError extends Error {
  code?: string;
  status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function parseApiError(response: Response, fallbackMessage: string): Promise<ApiError> {
  try {
    const payload = (await response.json()) as { message?: string; code?: string };
    return new ApiError(payload.message ?? fallbackMessage, response.status, payload.code);
  } catch {
    return new ApiError(fallbackMessage, response.status);
  }
}

export async function getPrompts(): Promise<Prompt[]> {
  const now = Date.now();
  if (promptsCache && now < promptsCache.expiresAt) {
    return promptsCache.value;
  }

  if (promptsRequest) {
    return promptsRequest;
  }

  promptsRequest = (async () => {
    const response = await fetch(`${API_BASE}/api/prompts`, {
      cache: "no-store",
      credentials: "include"
    });
    if (!response.ok) {
      throw new Error("Failed to fetch prompts");
    }
    const payload = (await response.json()) as Prompt[];
    const prompts = payload.map((prompt) => normalizePromptItem(prompt));
    promptsCache = {
      expiresAt: Date.now() + PROMPTS_CACHE_TTL_MS,
      value: prompts
    };
    return prompts;
  })();

  try {
    return await promptsRequest;
  } finally {
    promptsRequest = null;
  }
}

export async function getDailyPrompts(
  difficulty: DailyDifficulty,
  guestId?: string,
  excludePromptIds: string[] = []
): Promise<DailyPromptRecommendation> {
  const query = new URLSearchParams({ difficulty });
  if (guestId) {
    query.set("guestId", guestId);
  }
  excludePromptIds
    .filter((promptId) => typeof promptId === "string" && promptId.trim())
    .forEach((promptId) => query.append("excludePromptIds", promptId.trim()));

  const response = await fetch(`${API_BASE}/api/prompts/daily?${query.toString()}`, {
    cache: "no-store",
    credentials: "include"
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to fetch daily prompts");
  }

  return normalizeDailyPromptRecommendationPayload(
    (await response.json()) as DailyPromptRecommendation
  );
}

export async function getFeaturedDailyPrompt(
  difficulty: DailyDifficulty,
  guestId?: string
): Promise<FeaturedDailyPromptRecommendation> {
  const query = new URLSearchParams({ difficulty });
  if (guestId) {
    query.set("guestId", guestId);
  }

  const response = await fetch(`${API_BASE}/api/prompts/daily/featured?${query.toString()}`, {
    cache: "no-store",
    credentials: "include"
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to fetch featured daily prompt");
  }

  return normalizeFeaturedDailyPromptRecommendationPayload(
    (await response.json()) as FeaturedDailyPromptRecommendation
  );
}

export async function trackDailyPromptClick(promptId: string, guestId?: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/prompts/daily/click`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      promptId,
      guestId
    })
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to track daily prompt click");
  }
}

export async function getPromptHints(promptId: string): Promise<PromptHint[]> {
  const response = await fetch(`${API_BASE}/api/prompts/${promptId}/hints`, {
    cache: "no-store",
    credentials: "include"
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to fetch prompt hints");
  }

  return response.json();
}

export async function requestCoachHelp(request: CoachHelpRequest): Promise<CoachHelpResponse> {
  const response = await fetch(`${API_BASE}/api/coach/help`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      promptId: request.promptId,
      question: request.question,
      sessionId: request.sessionId,
      answer: request.answer,
      attemptType: request.attemptType
    })
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to fetch coach help");
  }

  const payload = (await response.json()) as {
    promptId?: string;
    userQuestion?: string;
    coachReply?: string;
    interactionId?: string;
    expressions?: Array<{
      id?: string;
      expression?: string;
      meaningKo?: string;
      usageTip?: string;
      example?: string;
    }>;
  };

  return normalizeCoachHelpResponse(payload, request.promptId, request.question);
}

export async function checkCoachExpressionUsage(
  request: CoachUsageCheckRequest
): Promise<CoachUsageCheckResponse> {
  const response = await fetch(`${API_BASE}/api/coach/usage-check`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      promptId: request.promptId,
      answer: request.answer,
      sessionId: request.sessionId,
      guestId: request.guestId,
      attemptNo: request.attemptNo,
      expressions: request.expressions.map((expression) => expression.expression),
      interactionId: request.interactionId
    })
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to check coach expression usage");
  }

  const payload = (await response.json()) as {
    promptId?: string;
    coachReply?: string;
    usedExpressions?: Array<{
      expression?: string;
      matched?: boolean;
      matchType?: string;
      matchedText?: string | null;
    }>;
    unusedExpressions?: Array<{
      expression?: string;
      matched?: boolean;
      matchType?: string;
      matchedText?: string | null;
    }>;
    suggestedPromptIds?: string[];
  };

  return normalizeCoachUsageResponse(payload, request);
}

export async function submitFeedback(request: FeedbackRequest): Promise<Feedback> {
  const response = await fetch(`${API_BASE}/api/feedback`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to submit feedback");
  }

  const payload = (await response.json()) as Feedback;
  return normalizeFeedbackPayload(payload);
}

export async function completeFeedbackSession(
  sessionId: string,
  guestId?: string
): Promise<FeedbackSessionStatus> {
  const response = await fetch(
    `${API_BASE}/api/feedback/${encodeURIComponent(sessionId)}/complete`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ guestId })
    }
  );

  if (!response.ok) {
    throw await parseApiError(response, "Failed to finish answer session");
  }

  return (await response.json()) as FeedbackSessionStatus;
}

export async function getDiaryEntries(): Promise<DiaryEntry[]> {
  const response = await fetch(`${API_BASE}/api/diary/entries`, {
    cache: "no-store",
    credentials: "include"
  });

  if (response.status === 401) {
    return [];
  }

  if (!response.ok) {
    throw await parseApiError(response, "Failed to load diary entries");
  }

  const payload = (await response.json()) as Parameters<typeof normalizeDiaryEntryPayload>[0][];
  return (payload ?? []).map((entry) => normalizeDiaryEntryPayload(entry));
}

export async function getDiaryEntry(entryId: string): Promise<DiaryEntry | null> {
  const normalizedEntryId = entryId.trim();
  if (!normalizedEntryId) {
    return null;
  }

  const response = await fetch(`${API_BASE}/api/diary/entries/${encodeURIComponent(normalizedEntryId)}`, {
    cache: "no-store",
    credentials: "include"
  });

  if (response.status === 401 || response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw await parseApiError(response, "Failed to load diary entry");
  }

  return normalizeDiaryEntryPayload((await response.json()) as Parameters<typeof normalizeDiaryEntryPayload>[0]);
}

export async function createDiaryEntry(request: DiaryEntryRequest): Promise<DiaryEntry> {
  const response = await fetch(`${API_BASE}/api/diary/entries`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title: request.title ?? null,
      content: request.content ?? "",
      language: request.language ?? "en",
      entryDate: request.entryDate ?? null,
      mood: request.mood ?? null,
      tags: request.tags ?? [],
      draft: request.draft ?? true
    })
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to create diary entry");
  }

  return normalizeDiaryEntryPayload((await response.json()) as Parameters<typeof normalizeDiaryEntryPayload>[0]);
}

export async function updateDiaryEntry(
  entryId: string,
  request: DiaryEntryRequest
): Promise<DiaryEntry> {
  const response = await fetch(`${API_BASE}/api/diary/entries/${encodeURIComponent(entryId)}`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title: request.title ?? null,
      content: request.content ?? "",
      language: request.language ?? "en",
      entryDate: request.entryDate ?? null,
      mood: request.mood ?? null,
      tags: request.tags ?? [],
      draft: request.draft ?? true
    })
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to save diary entry");
  }

  return normalizeDiaryEntryPayload((await response.json()) as Parameters<typeof normalizeDiaryEntryPayload>[0]);
}

export async function deleteDiaryEntry(entryId: string): Promise<void> {
  const normalizedEntryId = entryId.trim();
  if (!normalizedEntryId) {
    throw new ApiError("삭제할 일기 정보를 찾지 못했어요.", 400, "DIARY_ENTRY_ID_REQUIRED");
  }

  const response = await fetch(`${API_BASE}/api/diary/entries/${encodeURIComponent(normalizedEntryId)}`, {
    method: "DELETE",
    credentials: "include"
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to delete diary entry");
  }
}

export async function requestDiaryFeedback(
  entryId: string | null | undefined,
  request: DiaryFeedbackRequest
): Promise<DiaryFeedback> {
  const normalizedEntryId = entryId?.trim() ?? "";
  if (!normalizedEntryId) {
    throw new ApiError("영어일기 정보를 먼저 저장해 주세요.", 400, "DIARY_ENTRY_ID_REQUIRED");
  }

  const response = await fetch(`${API_BASE}/api/diary/entries/${encodeURIComponent(normalizedEntryId)}/feedback`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to generate diary feedback");
  }

  const payload = normalizeDiaryFeedbackPayload(await response.json());
  if (!payload) {
    throw new ApiError("영어일기 피드백 응답을 확인하지 못했어요.", 502, "DIARY_FEEDBACK_INVALID_RESPONSE");
  }

  return payload;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch(`${API_BASE}/api/auth/me`, {
    cache: "no-store",
    credentials: "include"
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw await parseApiError(response, "Failed to load current user");
  }

  return response.json();
}

export async function login(request: LoginRequest): Promise<AuthUser> {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to log in");
  }

  return response.json();
}

export async function register(request: RegisterRequest): Promise<AuthNotice> {
  const response = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to register");
  }

  return response.json();
}

export async function sendRegistrationCode(request: SendRegistrationCodeRequest): Promise<AuthNotice> {
  const response = await fetch(`${API_BASE}/api/auth/register/send-code`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to send registration code");
  }

  return response.json();
}

export async function sendPasswordResetCode(request: SendPasswordResetCodeRequest): Promise<AuthNotice> {
  const response = await fetch(`${API_BASE}/api/auth/password-reset/send-code`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to send password reset code");
  }

  return response.json();
}

export async function checkPasswordResetEmail(
  request: SendPasswordResetCodeRequest
): Promise<PasswordResetAvailability> {
  const response = await fetch(`${API_BASE}/api/auth/password-reset/check-email`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to check password reset email");
  }

  return response.json();
}

export async function verifyPasswordResetCode(
  request: VerifyPasswordResetCodeRequest
): Promise<AuthNotice> {
  const response = await fetch(`${API_BASE}/api/auth/password-reset/verify-code`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to verify password reset code");
  }

  return response.json();
}

export async function completeRegistration(request: CompleteRegistrationRequest): Promise<AuthUser> {
  const response = await fetch(`${API_BASE}/api/auth/register/complete`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to complete registration");
  }

  return response.json();
}

export async function getPendingSocialRegistration(token: string): Promise<PendingSocialRegistration> {
  const query = new URLSearchParams({ token: token.trim() });
  const response = await fetch(`${API_BASE}/api/auth/social/pending?${query.toString()}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store"
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to load social registration");
  }

  return response.json();
}

export async function completeSocialRegistration(
  request: CompleteSocialRegistrationRequest
): Promise<AuthUser> {
  const response = await fetch(`${API_BASE}/api/auth/social/complete`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to complete social registration");
  }

  return response.json();
}

export async function resetPassword(request: ResetPasswordRequest): Promise<AuthNotice> {
  const response = await fetch(`${API_BASE}/api/auth/password-reset/complete`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to reset password");
  }

  return response.json();
}

export async function verifyEmail(request: VerifyEmailRequest): Promise<AuthUser> {
  const response = await fetch(`${API_BASE}/api/auth/verify-email`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to verify email");
  }

  return response.json();
}

export async function resendVerification(email: string): Promise<AuthNotice> {
  const response = await fetch(`${API_BASE}/api/auth/resend-verification`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email })
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to resend verification");
  }

  return response.json();
}

export async function updateProfile(request: UpdateProfileRequest): Promise<AuthUser> {
  const response = await fetch(`${API_BASE}/api/auth/profile`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to update profile");
  }

  return response.json();
}

export async function deleteAccount(request: DeleteAccountRequest): Promise<AuthNotice> {
  const response = await fetch(`${API_BASE}/api/auth/account`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to delete account");
  }

  return response.json();
}

export async function logout(): Promise<void> {
  const response = await fetch(`${API_BASE}/api/auth/logout`, {
    method: "POST",
    credentials: "include"
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to log out");
  }
}

export async function getAnswerHistory(): Promise<HistorySession[]> {
  const response = await fetch(`${API_BASE}/api/history`, {
    cache: "no-store",
    credentials: "include"
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to load answer history");
  }

  const sessions = (await response.json()) as HistorySession[];

  return sessions.map((session) => ({
    ...session,
    attempts: (session.attempts ?? []).map((attempt) => ({
      ...attempt,
      visibleFeedback: attempt.visibleFeedback
        ? normalizeFeedbackPayload({
            visibleFeedback: attempt.visibleFeedback
          }).visibleFeedback
        : null,
      usedExpressions: (attempt.usedExpressions ?? []).map((expression) => ({
        ...expression,
        source: expression.source ?? "RECOMMENDED"
      }))
    }))
  }));
}

export async function getTodayWritingStatus(): Promise<TodayWritingStatus> {
  const response = await fetch(`${API_BASE}/api/history/today-status`, {
    cache: "no-store",
    credentials: "include"
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to load today writing status");
  }

  return response.json();
}

export async function getMonthStatus(year: number, month: number): Promise<HistoryMonthStatus> {
  const response = await fetch(`${API_BASE}/api/history/month-status?year=${year}&month=${month}`, {
    cache: "no-store",
    credentials: "include"
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to load month status");
  }

  return response.json();
}

export async function getCommonMistakes(): Promise<CommonMistake[]> {
  const response = await fetch(`${API_BASE}/api/history/common-mistakes`, {
    cache: "no-store",
    credentials: "include"
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to load common mistakes");
  }

  return response.json();
}

export async function getSavedExpressions(): Promise<SavedExpression[]> {
  const response = await fetch(`${API_BASE}/api/saved-expressions`, {
    cache: "no-store",
    credentials: "include"
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to load saved expressions");
  }

  const payload = (await response.json()) as SavedExpression[];
  return payload.map((item) => ({
    ...item,
    tags: normalizeExpressionTags(item.tags)
  }));
}

export async function saveExpression(request: SaveExpressionRequest): Promise<SavedExpression> {
  const response = await fetch(`${API_BASE}/api/saved-expressions`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to save expression");
  }

  const payload = (await response.json()) as SavedExpression;
  return {
    ...payload,
    tags: normalizeExpressionTags(payload.tags)
  };
}

export async function deleteSavedExpression(savedExpressionId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/api/saved-expressions/${savedExpressionId}`, {
    method: "DELETE",
    credentials: "include"
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to delete saved expression");
  }
}

export async function getWritingDraft(
  promptId: string,
  draftType: WritingDraftType
): Promise<WritingDraft | null> {
  const response = await fetch(`${API_BASE}/api/drafts/${promptId}?draftType=${draftType}`, {
    cache: "no-store",
    credentials: "include"
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw await parseApiError(response, "Failed to load writing draft");
  }

  return normalizeWritingDraftPayload((await response.json()) as WritingDraft);
}

export async function saveWritingDraft(
  promptId: string,
  request: SaveWritingDraftRequest
): Promise<WritingDraft> {
  const response = await fetch(`${API_BASE}/api/drafts/${promptId}`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to save writing draft");
  }

  return normalizeWritingDraftPayload((await response.json()) as WritingDraft);
}

export async function deleteWritingDraft(promptId: string, draftType: WritingDraftType): Promise<void> {
  const response = await fetch(`${API_BASE}/api/drafts/${promptId}?draftType=${draftType}`, {
    method: "DELETE",
    credentials: "include"
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to delete writing draft");
  }
}

export async function getAdminPrompts(): Promise<AdminPrompt[]> {
  const response = await fetch(`${API_BASE}/api/admin/prompts`, {
    cache: "no-store",
    credentials: "include"
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to load admin prompts");
  }

  return response.json();
}

export async function getAdminPromptTopicCatalog(): Promise<AdminPromptTopicCatalogEntry[]> {
  const response = await fetch(`${API_BASE}/api/admin/prompts/topic-catalog`, {
    cache: "no-store",
    credentials: "include"
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to load admin prompt topic catalog");
  }

  return response.json();
}

export async function getAdminPromptRecommendationMetrics(params?: {
  startDate?: string;
  endDate?: string;
  difficulty?: DailyDifficulty | "";
}): Promise<AdminPromptRecommendationMetrics> {
  const query = new URLSearchParams();
  if (params?.startDate) {
    query.set("startDate", params.startDate);
  }
  if (params?.endDate) {
    query.set("endDate", params.endDate);
  }
  if (params?.difficulty) {
    query.set("difficulty", params.difficulty);
  }

  const queryString = query.toString();
  const response = await fetch(
    `${API_BASE}/api/admin/prompts/recommendation-metrics${queryString ? `?${queryString}` : ""}`,
    {
      cache: "no-store",
      credentials: "include"
    }
  );

  if (!response.ok) {
    throw await parseApiError(response, "Failed to load prompt recommendation metrics");
  }

  return response.json();
}

export async function createAdminPrompt(request: AdminPromptRequest): Promise<AdminPrompt> {
  const response = await fetch(`${API_BASE}/api/admin/prompts`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to create prompt");
  }

  return response.json();
}

export async function updateAdminPrompt(
  promptId: string,
  request: AdminPromptRequest
): Promise<AdminPrompt> {
  const response = await fetch(`${API_BASE}/api/admin/prompts/${promptId}`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to update prompt");
  }

  return response.json();
}

export async function deleteAdminPrompt(promptId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/admin/prompts/${promptId}`, {
    method: "DELETE",
    credentials: "include"
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to delete prompt");
  }
}

export async function createAdminPromptHint(
  promptId: string,
  request: AdminPromptHintRequest
): Promise<AdminPromptHint> {
  const response = await fetch(`${API_BASE}/api/admin/prompts/${promptId}/hints`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to create hint");
  }

  return response.json();
}

export async function updateAdminPromptHint(
  promptId: string,
  hintId: string,
  request: AdminPromptHintRequest
): Promise<AdminPromptHint> {
  const response = await fetch(`${API_BASE}/api/admin/prompts/${promptId}/hints/${hintId}`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to update hint");
  }

  return response.json();
}

export async function deleteAdminPromptHint(promptId: string, hintId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/admin/prompts/${promptId}/hints/${hintId}`, {
    method: "DELETE",
    credentials: "include"
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to delete hint");
  }
}
