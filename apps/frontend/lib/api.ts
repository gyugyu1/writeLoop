import type {
  AdminPrompt,
  AdminPromptHint,
  AdminPromptHintRequest,
  AdminPromptRequest,
  AuthNotice,
  CoachHelpRequest,
  CoachHelpResponse,
  CoachUsageCheckRequest,
  CoachUsageCheckResponse,
  CommonMistake,
  CompleteRegistrationRequest,
  DeleteAccountRequest,
  AuthUser,
  DailyDifficulty,
  DailyPromptRecommendation,
  HistoryMonthStatus,
  PasswordResetAvailability,
  Feedback,
  FeedbackRequest,
  HistorySession,
  LoginRequest,
  PromptHint,
  Prompt,
  RegisterRequest,
  ResetPasswordRequest,
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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

function createCoachExpressionId(promptId: string, expression: string, index: number) {
  const base = expression
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `coach-${promptId}-${base || index + 1}`;
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
      example: expression.example ?? expression.expression ?? ""
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
    }>;
    unusedExpressions?: Array<{
      expression?: string;
      matched?: boolean;
      matchType?: string;
      matchedText?: string | null;
      source?: string;
      usageTip?: string | null;
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
    usedExpressions: hydrate(payload.usedExpressions),
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
  const response = await fetch(`${API_BASE}/api/prompts`, {
    cache: "no-store",
    credentials: "include"
  });
  if (!response.ok) {
    throw new Error("Failed to fetch prompts");
  }
  return response.json();
}

export async function getDailyPrompts(
  difficulty: DailyDifficulty
): Promise<DailyPromptRecommendation> {
  const response = await fetch(`${API_BASE}/api/prompts/daily?difficulty=${difficulty}`, {
    cache: "no-store",
    credentials: "include"
  });

  if (!response.ok) {
    throw await parseApiError(response, "Failed to fetch daily prompts");
  }

  return response.json();
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

  return response.json();
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

  return response.json();
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

  return response.json();
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
