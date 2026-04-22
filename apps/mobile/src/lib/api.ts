import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { apiBaseUrl } from "./env";
import { normalizeDailyDifficulty } from "./practice";
import type {
  AdminPrompt,
  AdminPromptHint,
  AdminPromptHintRequest,
  AdminPromptRecommendationMetrics,
  AdminPromptRequest,
  AdminPromptTopicCatalogEntry,
  AuthNotice,
  AuthUser,
  CoachHelpRequest,
  CoachHelpResponse,
  CompleteSocialRegistrationRequest,
  CompleteRegistrationRequest,
  CommonMistake,
  DailyDifficulty,
  DailyPromptRecommendation,
  FeaturedDailyPromptRecommendation,
  DeleteAccountRequest,
  Feedback,
  FeedbackRequest,
  HistorySession,
  LoginRequest,
  PendingSocialRegistration,
  PromptHint,
  Prompt,
  SavedExpression,
  SaveExpressionRequest,
  SaveWritingDraftRequest,
  SendRegistrationCodeRequest,
  SocialLoginResult,
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
const RETRYABLE_STATUS_CODES = new Set([502, 503, 504]);
const RETRY_DELAYS_MS = [350, 800];
const DEFAULT_FETCH_TIMEOUT_MS = 8000;
const FEEDBACK_FETCH_TIMEOUT_MS = 90000;
const COACH_FETCH_TIMEOUT_MS = 45000;

function resolveFetchTimeoutMs(url: string) {
  if (url.includes("/api/feedback")) {
    return FEEDBACK_FETCH_TIMEOUT_MS;
  }

  if (url.includes("/api/coach/help")) {
    return COACH_FETCH_TIMEOUT_MS;
  }

  return DEFAULT_FETCH_TIMEOUT_MS;
}

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
        .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
        .filter(Boolean)
    )
  );
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
      tags?: string[] | null;
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
      example: expression.example ?? expression.expression ?? "",
      tags: normalizeExpressionTags(expression.tags)
    }));

  return {
    promptId,
    userQuestion,
    coachReply: payload.coachReply ?? "이 질문에 맞는 표현을 골라 답안에 자연스럽게 넣어 보세요.",
    expressions,
    interactionId: payload.interactionId
  };
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

function normalizeWritingDraftPayload(draft: WritingDraft): WritingDraft {
  return {
    ...draft,
    selectedDifficulty: normalizeDailyDifficulty(draft.selectedDifficulty)
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

function shouldRetryTransientFailure(init: RequestInit = {}) {
  const method = (init.method ?? "GET").toUpperCase();
  return method === "GET" || method === "HEAD";
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeNetworkError(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") {
    return new Error("서버 연결이 지연되고 있어요. 네트워크나 API 주소를 확인해 주세요.");
  }

  if (error instanceof TypeError) {
    return new Error("서버에 연결하지 못했어요. 네트워크나 API 주소를 확인해 주세요.");
  }

  return error;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = resolveFetchTimeoutMs(url)
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    throw normalizeNetworkError(error);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  const canRetry = shouldRetryTransientFailure(init);

  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, init);
      if (
        canRetry &&
        RETRYABLE_STATUS_CODES.has(response.status) &&
        attempt < RETRY_DELAYS_MS.length
      ) {
        await delay(RETRY_DELAYS_MS[attempt]);
        continue;
      }

      return response;
    } catch (error) {
      if (!canRetry || attempt >= RETRY_DELAYS_MS.length) {
        throw normalizeNetworkError(error);
      }

      await delay(RETRY_DELAYS_MS[attempt]);
    }
  }
}

async function apiFetch(path: string, init: RequestInit = {}, allowRefresh = true): Promise<Response> {
  const url = `${apiBaseUrl}${path}`;
  const tokenSession = await getStoredTokenSession();
  const accessToken = tokenSession?.accessToken ?? null;
  const headers = new Headers(init.headers);
  const hadAccessToken = Boolean(accessToken);

  if (hadAccessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetchWithRetry(url, {
    ...init,
    headers
  });

  if (response.status !== 401 || !allowRefresh) {
    return response;
  }

  if (tokenSession?.refreshToken) {
    const refreshedSession = await refreshTokenSession();
    if (refreshedSession?.accessToken) {
      const retryHeaders = new Headers(init.headers);
      retryHeaders.set("Authorization", `Bearer ${refreshedSession.accessToken}`);

      return fetchWithRetry(url, {
        ...init,
        headers: retryHeaders
      });
    }
  }

  if (!hadAccessToken) {
    return response;
  }

  await clearTokenSession();

  if (!shouldRetryTransientFailure(init)) {
    return response;
  }

  return fetchWithRetry(url, {
    ...init,
    headers: new Headers(init.headers)
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

export async function loginWithSocial(provider: SocialProvider): Promise<SocialLoginResult> {
  const redirectUri = Linking.createURL("auth/callback");
  const socialLoginUrl = `${apiBaseUrl}/api/auth/social/${provider}/start?${new URLSearchParams({
    appRedirect: redirectUri
  }).toString()}`;

  const authResult = await WebBrowser.openAuthSessionAsync(socialLoginUrl, redirectUri);
  if (authResult.type !== "success") {
    return { status: "cancelled" };
  }

  const parsedUrl = Linking.parse(authResult.url);
  const exchangeCode = getStringQueryParam(parsedUrl.queryParams?.code);
  const signupToken = getStringQueryParam(parsedUrl.queryParams?.signupToken);
  const resolvedProvider = getStringQueryParam(parsedUrl.queryParams?.provider) as SocialProvider | null;
  const errorCode = getStringQueryParam(parsedUrl.queryParams?.error);
  const errorMessage = getStringQueryParam(parsedUrl.queryParams?.message);

  if (errorCode) {
    throw createApiError(errorMessage ?? "소셜 로그인을 완료하지 못했어요.", 400, errorCode);
  }

  if (signupToken) {
    return {
      status: "signup_required",
      token: signupToken,
      provider: resolvedProvider
    };
  }

  if (!exchangeCode) {
    throw createApiError("소셜 로그인 응답을 확인하지 못했어요.", 400, "SOCIAL_LOGIN_CODE_MISSING");
  }

  const user = await exchangeSocialCode(exchangeCode);
  return {
    status: "logged_in",
    user
  };
}

export async function getPendingSocialRegistration(
  token: string
): Promise<PendingSocialRegistration> {
  const query = new URLSearchParams({
    token: token.trim()
  });
  const response = await fetch(`${apiBaseUrl}/api/auth/social/pending?${query.toString()}`, {
    method: "GET"
  });

  if (!response.ok) {
    throw await parseApiError(response, "?뚯뀥 媛???뺣낫瑜?遺덈윭?ㅼ? 紐삵뻽?댁슂.");
  }

  return (await response.json()) as PendingSocialRegistration;
}

export async function completeSocialRegistration(
  request: CompleteSocialRegistrationRequest
): Promise<AuthUser> {
  const response = await fetch(`${apiBaseUrl}/api/auth/token/social/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await parseApiError(response, "?뚯뀥 媛?낆쓣 ?꾨즺?섏? 紐삵뻽?댁슂.");
  }

  const payload = (await response.json()) as TokenAuthResponse;
  await writeTokenSession(payload);
  return payload.user;
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

export async function getSavedExpressions(): Promise<SavedExpression[]> {
  const response = await apiFetch("/api/saved-expressions");

  if (!response.ok) {
    throw await parseApiError(response, "저장한 표현을 불러오지 못했어요.");
  }

  return (await response.json()) as SavedExpression[];
}

export async function saveExpression(request: SaveExpressionRequest): Promise<SavedExpression> {
  const response = await apiFetch("/api/saved-expressions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await parseApiError(response, "표현을 저장하지 못했어요.");
  }

  return (await response.json()) as SavedExpression;
}

export async function deleteSavedExpression(savedExpressionId: number): Promise<void> {
  const response = await apiFetch(`/api/saved-expressions/${savedExpressionId}`, {
    method: "DELETE"
  });

  if (!response.ok) {
    throw await parseApiError(response, "저장한 표현을 삭제하지 못했어요.");
  }
}

export async function getPrompts(): Promise<Prompt[]> {
  const response = await apiFetch("/api/prompts");

  if (!response.ok) {
    throw await parseApiError(response, "질문 목록을 불러오지 못했어요.");
  }

  return (await response.json()) as Prompt[];
}

export async function getAdminPrompts(): Promise<AdminPrompt[]> {
  const response = await apiFetch("/api/admin/prompts");

  if (!response.ok) {
    throw await parseApiError(response, "관리자 질문 목록을 불러오지 못했어요.");
  }

  return (await response.json()) as AdminPrompt[];
}

export async function getAdminPromptTopicCatalog(): Promise<AdminPromptTopicCatalogEntry[]> {
  const response = await apiFetch("/api/admin/prompts/topic-catalog");

  if (!response.ok) {
    throw await parseApiError(response, "질문 주제 목록을 불러오지 못했어요.");
  }

  return (await response.json()) as AdminPromptTopicCatalogEntry[];
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
  const response = await apiFetch(
    `/api/admin/prompts/recommendation-metrics${queryString ? `?${queryString}` : ""}`
  );

  if (!response.ok) {
    throw await parseApiError(response, "추천 지표를 불러오지 못했어요.");
  }

  return (await response.json()) as AdminPromptRecommendationMetrics;
}

export async function createAdminPrompt(request: AdminPromptRequest): Promise<AdminPrompt> {
  const response = await apiFetch("/api/admin/prompts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await parseApiError(response, "질문을 추가하지 못했어요.");
  }

  return (await response.json()) as AdminPrompt;
}

export async function updateAdminPrompt(
  promptId: string,
  request: AdminPromptRequest
): Promise<AdminPrompt> {
  const response = await apiFetch(`/api/admin/prompts/${promptId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await parseApiError(response, "질문을 수정하지 못했어요.");
  }

  return (await response.json()) as AdminPrompt;
}

export async function deleteAdminPrompt(promptId: string): Promise<void> {
  const response = await apiFetch(`/api/admin/prompts/${promptId}`, {
    method: "DELETE"
  });

  if (!response.ok) {
    throw await parseApiError(response, "질문을 비활성화하지 못했어요.");
  }
}

export async function createAdminPromptHint(
  promptId: string,
  request: AdminPromptHintRequest
): Promise<AdminPromptHint> {
  const response = await apiFetch(`/api/admin/prompts/${promptId}/hints`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await parseApiError(response, "힌트를 추가하지 못했어요.");
  }

  return (await response.json()) as AdminPromptHint;
}

export async function updateAdminPromptHint(
  promptId: string,
  hintId: string,
  request: AdminPromptHintRequest
): Promise<AdminPromptHint> {
  const response = await apiFetch(`/api/admin/prompts/${promptId}/hints/${hintId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await parseApiError(response, "힌트를 수정하지 못했어요.");
  }

  return (await response.json()) as AdminPromptHint;
}

export async function deleteAdminPromptHint(promptId: string, hintId: string): Promise<void> {
  const response = await apiFetch(`/api/admin/prompts/${promptId}/hints/${hintId}`, {
    method: "DELETE"
  });

  if (!response.ok) {
    throw await parseApiError(response, "힌트를 비활성화하지 못했어요.");
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

  const response = await apiFetch(`/api/prompts/daily?${query.toString()}`);

  if (!response.ok) {
    throw await parseApiError(response, "오늘의 질문을 불러오지 못했어요.");
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

  const response = await apiFetch(`/api/prompts/daily/featured?${query.toString()}`);

  if (!response.ok) {
    throw await parseApiError(response, "오늘의 추천 질문을 불러오지 못했어요.");
  }

  return normalizeFeaturedDailyPromptRecommendationPayload(
    (await response.json()) as FeaturedDailyPromptRecommendation
  );
}

export async function trackDailyPromptClick(promptId: string, guestId?: string): Promise<void> {
  const response = await apiFetch("/api/prompts/daily/click", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      promptId,
      guestId
    })
  });

  if (!response.ok) {
    throw await parseApiError(response, "추천 질문 선택을 기록하지 못했어요.");
  }
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

  return normalizeWritingDraftPayload((await response.json()) as WritingDraft);
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

  return normalizeWritingDraftPayload((await response.json()) as WritingDraft);
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
      tags?: string[] | null;
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
