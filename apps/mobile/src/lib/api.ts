import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { apiBaseUrl } from "./env";
import type {
  AuthNotice,
  AuthUser,
  CoachHelpRequest,
  CoachHelpResponse,
  CompleteRegistrationRequest,
  CommonMistake,
  DailyDifficulty,
  DailyPromptRecommendation,
  DeleteAccountRequest,
  Feedback,
  FeedbackRequest,
  HistorySession,
  LoginRequest,
  PromptHint,
  Prompt,
  SaveWritingDraftRequest,
  SendRegistrationCodeRequest,
  SocialProvider,
  TodayWritingStatus,
  TokenAuthResponse,
  UpdateProfileRequest,
  WritingDraft,
  WritingDraftType
} from "./types";

WebBrowser.maybeCompleteAuthSession();

const ACCESS_TOKEN_KEY = "writeloop_access_token";
const REFRESH_TOKEN_KEY = "writeloop_refresh_token";

type TokenSession = {
  accessToken: string;
  refreshToken: string;
};

let tokenSessionCache: TokenSession | null | undefined = undefined;
let refreshPromise: Promise<TokenSession | null> | null = null;

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
    expressions?: {
      id?: string;
      expression?: string;
      meaningKo?: string;
      usageTip?: string;
      example?: string;
    }[];
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
      meaningKo: expression.meaningKo ?? "이 질문에 바로 써먹을 수 있는 표현이에요.",
      usageTip: expression.usageTip ?? "답안 안에서 자연스럽게 풀어서 써 보세요.",
      example: expression.example ?? expression.expression ?? ""
    }));

  return {
    promptId,
    userQuestion,
    coachReply: payload.coachReply ?? "이 질문에 맞는 표현을 골라 답안에 자연스럽게 넣어 보세요.",
    expressions,
    interactionId: payload.interactionId
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

function createApiError(message: string, status: number, code?: string) {
  return new ApiError(message, status, code);
}

async function parseApiError(response: Response, fallbackMessage: string): Promise<ApiError> {
  try {
    const payload = (await response.json()) as { message?: string; code?: string };
    return createApiError(payload.message ?? fallbackMessage, response.status, payload.code);
  } catch {
    return createApiError(fallbackMessage, response.status);
  }
}

async function getStoredTokenSession(): Promise<TokenSession | null> {
  if (tokenSessionCache !== undefined) {
    return tokenSessionCache;
  }

  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
  ]);

  tokenSessionCache =
    accessToken && refreshToken
      ? {
          accessToken,
          refreshToken
        }
      : null;

  return tokenSessionCache;
}

async function writeTokenSession(payload: TokenAuthResponse): Promise<TokenSession> {
  const nextSession = {
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken
  };

  tokenSessionCache = nextSession;
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, nextSession.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, nextSession.refreshToken)
  ]);

  return nextSession;
}

export async function clearTokenSession(): Promise<void> {
  tokenSessionCache = null;
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY)
  ]);
}

async function requestTokenRefresh(): Promise<TokenSession | null> {
  const currentSession = await getStoredTokenSession();
  if (!currentSession?.refreshToken) {
    await clearTokenSession();
    return null;
  }

  const response = await fetch(`${apiBaseUrl}/api/auth/token/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      refreshToken: currentSession.refreshToken
    })
  });

  if (!response.ok) {
    await clearTokenSession();
    return null;
  }

  const payload = (await response.json()) as TokenAuthResponse;
  return writeTokenSession(payload);
}

async function refreshTokenSession(): Promise<TokenSession | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = requestTokenRefresh().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

async function apiFetch(path: string, init: RequestInit = {}, allowRefresh = true): Promise<Response> {
  const url = `${apiBaseUrl}${path}`;
  const tokenSession = await getStoredTokenSession();
  const headers = new Headers(init.headers);

  if (tokenSession?.accessToken) {
    headers.set("Authorization", `Bearer ${tokenSession.accessToken}`);
  }

  const response = await fetch(url, {
    ...init,
    headers
  });

  if (response.status !== 401 || !allowRefresh) {
    return response;
  }

  if (!tokenSession?.refreshToken) {
    return response;
  }

  const refreshedSession = await refreshTokenSession();
  if (!refreshedSession?.accessToken) {
    return response;
  }

  const retryHeaders = new Headers(init.headers);
  retryHeaders.set("Authorization", `Bearer ${refreshedSession.accessToken}`);

  return fetch(url, {
    ...init,
    headers: retryHeaders
  });
}

function getStringQueryParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function exchangeSocialCode(code: string): Promise<AuthUser> {
  const response = await fetch(`${apiBaseUrl}/api/auth/token/social/exchange`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      code
    })
  });

  if (!response.ok) {
    throw await parseApiError(response, "소셜 로그인을 완료하지 못했어요.");
  }

  const payload = (await response.json()) as TokenAuthResponse;
  await writeTokenSession(payload);
  return payload.user;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const response = await apiFetch("/api/auth/me");

  if (response.status === 401) {
    await clearTokenSession();
    return null;
  }

  if (!response.ok) {
    throw await parseApiError(response, "현재 로그인 상태를 확인하지 못했어요.");
  }

  return (await response.json()) as AuthUser;
}

export async function login(request: LoginRequest): Promise<AuthUser> {
  const response = await fetch(`${apiBaseUrl}/api/auth/token/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await parseApiError(response, "로그인에 실패했어요.");
  }

  const payload = (await response.json()) as TokenAuthResponse;
  await writeTokenSession(payload);
  return payload.user;
}

export async function loginWithSocial(provider: SocialProvider): Promise<AuthUser | null> {
  const redirectUri = Linking.createURL("auth/callback");
  const socialLoginUrl = `${apiBaseUrl}/api/auth/social/${provider}/start?${new URLSearchParams({
    appRedirect: redirectUri
  }).toString()}`;

  const authResult = await WebBrowser.openAuthSessionAsync(socialLoginUrl, redirectUri);
  if (authResult.type !== "success") {
    return null;
  }

  const parsedUrl = Linking.parse(authResult.url);
  const exchangeCode = getStringQueryParam(parsedUrl.queryParams?.code);
  const errorCode = getStringQueryParam(parsedUrl.queryParams?.error);
  const errorMessage = getStringQueryParam(parsedUrl.queryParams?.message);

  if (errorCode) {
    throw createApiError(errorMessage ?? "소셜 로그인을 완료하지 못했어요.", 400, errorCode);
  }

  if (!exchangeCode) {
    throw createApiError("소셜 로그인 응답을 확인하지 못했어요.", 400, "SOCIAL_LOGIN_CODE_MISSING");
  }

  return exchangeSocialCode(exchangeCode);
}

export async function logout(): Promise<void> {
  const tokenSession = await getStoredTokenSession();

  try {
    if (tokenSession?.refreshToken) {
      await fetch(`${apiBaseUrl}/api/auth/token/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          refreshToken: tokenSession.refreshToken
        })
      })
    }
  } catch {
    // Treat logout as best-effort. We still clear local auth state below.
  } finally {
    await clearTokenSession();
  }
}

export async function sendRegistrationCode(
  request: SendRegistrationCodeRequest
): Promise<AuthNotice> {
  const response = await fetch(`${apiBaseUrl}/api/auth/register/send-code`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await parseApiError(response, "인증코드를 보내지 못했어요.");
  }

  return (await response.json()) as AuthNotice;
}

export async function completeRegistration(
  request: CompleteRegistrationRequest
): Promise<AuthUser> {
  const response = await fetch(`${apiBaseUrl}/api/auth/register/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await parseApiError(response, "회원가입을 완료하지 못했어요.");
  }

  return (await response.json()) as AuthUser;
}

export async function updateProfile(request: UpdateProfileRequest): Promise<AuthUser> {
  const response = await apiFetch("/api/auth/profile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await parseApiError(response, "프로필 설정을 저장하지 못했어요.");
  }

  return (await response.json()) as AuthUser;
}

export async function deleteAccount(request: DeleteAccountRequest): Promise<void> {
  const response = await apiFetch("/api/auth/account", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await parseApiError(response, "계정을 삭제하지 못했어요.");
  }
}

export async function getPrompts(): Promise<Prompt[]> {
  const response = await apiFetch("/api/prompts");

  if (!response.ok) {
    throw await parseApiError(response, "질문 목록을 불러오지 못했어요.");
  }

  return (await response.json()) as Prompt[];
}

export async function getDailyPrompts(
  difficulty: DailyDifficulty
): Promise<DailyPromptRecommendation> {
  const response = await apiFetch(`/api/prompts/daily?difficulty=${difficulty}`);

  if (!response.ok) {
    throw await parseApiError(response, "오늘의 질문을 불러오지 못했어요.");
  }

  return (await response.json()) as DailyPromptRecommendation;
}

export async function getPromptHints(promptId: string): Promise<PromptHint[]> {
  const response = await apiFetch(`/api/prompts/${promptId}/hints`);

  if (!response.ok) {
    throw await parseApiError(response, "추천 단어와 표현을 불러오지 못했어요.");
  }

  return (await response.json()) as PromptHint[];
}

export async function getWritingDraft(
  promptId: string,
  draftType: WritingDraftType
): Promise<WritingDraft | null> {
  const response = await apiFetch(`/api/drafts/${promptId}?draftType=${draftType}`);

  if (response.status === 401 || response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw await parseApiError(response, "임시저장 초안을 불러오지 못했어요.");
  }

  return (await response.json()) as WritingDraft;
}

export async function saveWritingDraft(
  promptId: string,
  request: SaveWritingDraftRequest
): Promise<WritingDraft> {
  const response = await apiFetch(`/api/drafts/${promptId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await parseApiError(response, "임시저장에 실패했어요.");
  }

  return (await response.json()) as WritingDraft;
}

export async function deleteWritingDraft(promptId: string, draftType: WritingDraftType): Promise<void> {
  const response = await apiFetch(`/api/drafts/${promptId}?draftType=${draftType}`, {
    method: "DELETE"
  });

  if (response.status === 401 || response.status === 404 || response.status === 204) {
    return;
  }

  if (!response.ok) {
    throw await parseApiError(response, "임시저장을 지우지 못했어요.");
  }
}

export async function getTodayWritingStatus(): Promise<TodayWritingStatus | null> {
  const response = await apiFetch("/api/history/today-status");

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw await parseApiError(response, "오늘의 학습 상태를 불러오지 못했어요.");
  }

  return (await response.json()) as TodayWritingStatus;
}

export async function getAnswerHistory(): Promise<HistorySession[]> {
  const response = await apiFetch("/api/history");

  if (response.status === 401) {
    return [];
  }

  if (!response.ok) {
    throw await parseApiError(response, "작문 기록을 불러오지 못했어요.");
  }

  return (await response.json()) as HistorySession[];
}

export async function getCommonMistakes(): Promise<CommonMistake[]> {
  const response = await apiFetch("/api/history/common-mistakes");

  if (response.status === 401) {
    return [];
  }

  if (!response.ok) {
    throw await parseApiError(response, "자주 고친 포인트를 불러오지 못했어요.");
  }

  return (await response.json()) as CommonMistake[];
}

export async function requestCoachHelp(request: CoachHelpRequest): Promise<CoachHelpResponse> {
  const response = await apiFetch("/api/coach/help", {
    method: "POST",
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
    throw await parseApiError(response, "AI 코치를 불러오지 못했어요.");
  }

  const payload = (await response.json()) as {
    promptId?: string;
    userQuestion?: string;
    coachReply?: string;
    interactionId?: string;
    expressions?: {
      id?: string;
      expression?: string;
      meaningKo?: string;
      usageTip?: string;
      example?: string;
    }[];
  };

  return normalizeCoachHelpResponse(payload, request.promptId, request.question);
}

export async function submitFeedback(request: FeedbackRequest): Promise<Feedback> {
  const response = await apiFetch("/api/feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await parseApiError(response, "피드백을 생성하지 못했어요.");
  }

  return (await response.json()) as Feedback;
}
