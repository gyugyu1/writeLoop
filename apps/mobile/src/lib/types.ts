import type { LobbyLayout } from "./lobby3d/lobby-layout";

export type DailyDifficulty = "I" | "A" | "B" | "C";
export type PromptDifficulty = "I" | "A" | "B" | "C";
export type MobilePlatform = "ios" | "android";
export type SocialProvider = "naver" | "google" | "kakao";
export type AttemptType = "INITIAL" | "REWRITE";
export type InlineFeedbackType = "KEEP" | "REPLACE" | "ADD" | "REMOVE";
export type WritingDraftType = "ANSWER" | "REWRITE";
export type SavedExpressionSourceType =
  | "USED_EXPRESSION"
  | "COACH_RECOMMENDATION"
  | "REFINEMENT_EXPRESSION"
  | "DIARY_EXPRESSION";
export type ExpressionTag = string;

export interface Prompt {
  id: string;
  topic: string;
  topicCategory: string;
  topicDetail: string;
  difficulty: PromptDifficulty;
  questionEn: string;
  questionKo: string;
  tip: string;
}

export interface PromptCoachProfile {
  primaryCategory: string;
  secondaryCategories: string[];
  preferredExpressionFamilies: string[];
  avoidFamilies: string[];
  starterStyle: string;
  notes: string;
}

export interface PromptRecommendationItem {
  slot: string;
  prompt: Prompt;
  reasonCode: string;
  reasonText: string;
  reasonFacts: string[];
  score: number;
}

export interface DailyPromptRecommendation {
  recommendedDate: string;
  difficulty: DailyDifficulty;
  userState?: string;
  fallbackUsed?: boolean;
  featured?: PromptRecommendationItem | null;
  alternatives?: PromptRecommendationItem[];
  prompts: Prompt[];
}

export interface FeaturedDailyPromptRecommendation {
  recommendedDate: string;
  difficulty: DailyDifficulty;
  userState?: string;
  fallbackUsed?: boolean;
  featured?: PromptRecommendationItem | null;
}

export interface MobileHomeSnapshot {
  todayStatus?: TodayWritingStatus | null;
  diaryCalendarSummary?: DiaryCalendarSummary | null;
  featuredRecommendation?: FeaturedDailyPromptRecommendation | null;
}

export interface PromptHintItem {
  id: string;
  hintId: string;
  itemType: string;
  content: string;
  meaningKo?: string | null;
  usageTipKo?: string | null;
  exampleEn?: string | null;
  expressionFamily?: string | null;
  displayOrder?: number | null;
}

export interface PromptHint {
  id: string;
  promptId: string;
  hintType: string;
  title?: string | null;
  displayOrder?: number | null;
  items: PromptHintItem[];
}

export interface SaveWritingDraftRequest {
  draftType: WritingDraftType;
  selectedDifficulty: DailyDifficulty;
  sessionId: string;
  answer: string;
  rewrite: string;
  lastSubmittedAnswer: string;
  feedback: Feedback | null;
  step: "answer" | "rewrite";
}

export interface WritingDraft {
  promptId: string;
  draftType: WritingDraftType;
  selectedDifficulty: DailyDifficulty;
  sessionId: string;
  answer: string;
  rewrite: string;
  lastSubmittedAnswer: string;
  feedback: Feedback | null;
  step: string;
  updatedAt: string;
}

export interface TodayWritingStatus {
  date: string;
  completed: boolean;
  completedSessions: number;
  startedSessions: number;
  streakDays: number;
  totalAnswerSessions: number;
  totalWrittenSentences: number;
}

export interface MonthWritingStatusDay {
  date: string;
  started: boolean;
  completed: boolean;
  startedSessions: number;
  completedSessions: number;
  isToday: boolean;
}

export interface MonthWritingStatus {
  year: number;
  month: number;
  streakDays: number;
  days: MonthWritingStatusDay[];
}

export interface AuthUser {
  id: number;
  email: string;
  displayName: string;
  socialProvider?: string | null;
  admin: boolean;
}

export interface PendingSocialRegistration {
  provider: string;
  suggestedDisplayName: string;
  returnTo: string;
}

export interface CompleteSocialRegistrationRequest {
  token: string;
  displayName: string;
}

export type SocialLoginResult =
  | {
      status: "logged_in";
      user: AuthUser;
    }
  | {
      status: "signup_required";
      token: string;
      provider?: SocialProvider | null;
    }
  | {
      status: "cancelled";
    };

export interface AdminPromptHint {
  id: string;
  promptId: string;
  hintType: string;
  title?: string | null;
  displayOrder: number;
  active: boolean;
  items?: PromptHintItem[];
}

export interface AdminPrompt {
  id: string;
  topic: string;
  topicCategory: string;
  topicDetail: string;
  difficulty: PromptDifficulty;
  questionEn: string;
  questionKo: string;
  tip: string;
  displayOrder: number;
  active: boolean;
  coachProfile?: PromptCoachProfile | null;
  hints: AdminPromptHint[];
}

export interface AdminPromptRecommendationMetricsItem {
  promptId: string;
  topic: string;
  topicCategory: string;
  topicDetail: string;
  difficulty: PromptDifficulty;
  questionEn: string;
  slotType: string;
  reasonCode: string;
  shownCount: number;
  clickedCount: number;
  startedCount: number;
  completedCount: number;
  clickRate: number;
  startRate: number;
  completeRate: number;
  completionAfterStartRate: number;
}

export interface AdminPromptRecommendationMetrics {
  startDate: string;
  endDate: string;
  difficultyFilter?: DailyDifficulty | null;
  totalShownCount: number;
  totalClickedCount: number;
  totalStartedCount: number;
  totalCompletedCount: number;
  clickRate: number;
  startRate: number;
  completeRate: number;
  items: AdminPromptRecommendationMetricsItem[];
}

export interface AdminPromptTopicCatalogEntry {
  category: string;
  details: string[];
}

export interface AdminPromptRequest {
  topic?: string;
  topicCategory: string;
  topicDetail: string;
  difficulty: PromptDifficulty;
  questionEn: string;
  questionKo: string;
  tip: string;
  displayOrder: number;
  active: boolean;
  coachProfile?: PromptCoachProfile | null;
}

export interface AdminPromptHintRequest {
  hintType: string;
  title?: string | null;
  items?: string[];
  displayOrder: number;
  active: boolean;
}

export interface AuthNotice {
  email: string;
  message: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AppleLoginRequest {
  identityToken: string;
  email?: string | null;
  fullName?: string | null;
}

export interface SendRegistrationCodeRequest {
  email: string;
}

export interface CompleteRegistrationRequest {
  email: string;
  code: string;
  password: string;
  displayName: string;
}

export interface UpdateProfileRequest {
  displayName: string;
  currentPassword?: string;
  newPassword?: string;
}

export interface DeleteAccountRequest {
  confirmationText: string;
  currentPassword?: string;
  // Apple 로그인 계정이 탈퇴할 때 Apple 로그인을 다시 받아 얻는 일회용 코드. 서버가 Apple 토큰을 해지한다.
  appleAuthorizationCode?: string;
}

export interface AppVersionStatus {
  platform: MobilePlatform | string;
  currentVersion?: string | null;
  latestVersion: string;
  minimumSupportedVersion: string;
  updateAvailable: boolean;
  forceUpdate: boolean;
  titleKo: string;
  messageKo: string;
  releaseNotesKo?: string | null;
  storeUrl?: string | null;
}

export type UserFeedbackCategory = "BUG" | "IDEA" | "OTHER";

export interface UserFeedbackRequest {
  category: UserFeedbackCategory;
  message: string;
  contactEmail?: string;
  sourceScreen?: string;
  appVersion?: string;
  platform?: string;
  osVersion?: string;
  deviceModel?: string;
  errorCode?: string;
}

export interface UserFeedbackResponse {
  id: number;
  accepted: boolean;
}

export interface SaveExpressionRequest {
  expression: string;
  meaningKo?: string;
  usageTipKo?: string;
  exampleEn?: string;
  tags?: ExpressionTag[];
  sourceType: SavedExpressionSourceType;
  promptId?: string;
  answerSessionId?: string;
  answerAttemptNo?: number;
  coachInteractionId?: string;
}

export interface SavedExpression {
  id: number;
  expression: string;
  meaningKo?: string | null;
  usageTipKo?: string | null;
  exampleEn?: string | null;
  tags?: ExpressionTag[] | null;
  sourceType: SavedExpressionSourceType;
  promptId?: string | null;
  promptDifficulty?: PromptDifficulty | null;
  promptTopic?: string | null;
  promptQuestionEn?: string | null;
  promptQuestionKo?: string | null;
  saveCount: number;
  lastSavedAt: string;
  createdAt: string;
}

export interface TokenAuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresInSeconds: number;
  refreshTokenExpiresInSeconds: number;
}

export interface CoachExpression {
  id: string;
  expression: string;
  meaningKo: string;
  usageTip: string;
  example: string;
  tags?: ExpressionTag[] | null;
}

export interface CoachHelpRequest {
  promptId: string;
  question: string;
  sessionId?: string;
  answer?: string;
  attemptType?: AttemptType;
}

export interface CoachHelpResponse {
  promptId: string;
  userQuestion: string;
  coachReply: string;
  expressions: CoachExpression[];
  interactionId?: string;
}

export interface NowInEnglishReflectionEntryRequest {
  text: string;
  createdAt?: string;
}

/** GET /api/loop-points 중 앱이 쓰는 룹 잔액. */
export interface LoopPointsSummary {
  balance: number;
}

/** 라룹 홈쇼핑 가구 한 칸. salePrice는 그날 방송 상품만 있다. */
export interface HomeShoppingItem {
  type: string;
  price: number;
  salePrice: number | null;
  owned: number;
}

/** GET /api/home-shopping */
export interface HomeShopping {
  balance: number;
  broadcast: { type: string; price: number; salePrice: number };
  items: HomeShoppingItem[];
}

/** POST /api/home-shopping/orders의 가구 주문 결과. layout은 주문 뒤 저장된 배치다(서버의 wardrobe는 null). */
export interface HomeShoppingOrderResult {
  type: string;
  price: number;
  balance: number;
  owned: number;
  itemId: string;
  layout: LobbyLayout;
  wardrobe?: null;
}

/** POST /api/home-shopping/orders의 옷 주문 결과. 배치를 바꾸지 않아 itemId·layout이 null이고, wardrobe는 주문 뒤 옷장이다(읽지 못했으면 null). */
export interface HomeShoppingWearableOrderResult {
  type: string;
  price: number;
  balance: number;
  owned: number;
  itemId: null;
  layout: null;
  wardrobe: Wardrobe | null;
}

/** 주문 결과(가구나 옷). layout이 null이면 옷 주문이다. */
export type HomeShoppingAnyOrderResult = HomeShoppingOrderResult | HomeShoppingWearableOrderResult;

/** 라룹이 착용 부위(캐릭터 꾸미기). 부위마다 한 번에 하나만 입는다. */
export type WardrobeSlot = "hat" | "top" | "bottom" | "shoes" | "face" | "back" | "accessory";

/** 가진 착용 아이템 하나. */
export interface WardrobeItem {
  type: string;
  slot: WardrobeSlot;
  acquiredAt: string;
}

/** GET /api/wardrobe, PUT /api/wardrobe/equipped 응답. equipped는 부위별 입은 아이템 종류(입지 않은 부위는 null)다. */
export interface Wardrobe {
  items: WardrobeItem[];
  equipped: Record<WardrobeSlot, string | null>;
}

/** 완료 응답에 붙는 이번 룹 적립 결과(라룹 홈쇼핑에서 쓰는 포인트). 적립 시점이 아니면 null이다. */
export interface LoopPointsReward {
  activity: "question" | "diary" | "nowInEnglish";
  earned: number;
  balance: number;
  dailyLimitReached: boolean;
}

export interface NowInEnglishEntryPayload {
  id: string;
  text: string;
  polishedFromEntryId?: string | null;
  polishedFromText?: string | null;
  createdAt: string;
  dateKey: string;
  /** 이번 요청으로 룹을 적립하는 때에만 있다(완료 응답). */
  loopPoints?: LoopPointsReward | null;
}

export interface NowInEnglishEntryRequest {
  id?: string;
  text: string;
  polishedFromEntryId?: string | null;
  polishedFromText?: string | null;
  createdAt?: string;
  dateKey?: string;
}

export interface NowInEnglishEntrySyncRequest {
  entries: NowInEnglishEntryRequest[];
}

export interface NowInEnglishCoachFeedbackRequest {
  text: string;
  createdAt?: string;
}

export interface NowInEnglishCoachFeedbackResponse {
  originalText: string;
  headlineKo: string;
  praiseKo: string;
  suggestionEn: string;
  suggestionTranslationKo: string;
  suggestionKo: string;
  nextQuestionKo: string;
  expression: string;
  expressionMeaningKo: string;
  expressionExampleEn: string;
}

export interface NowInEnglishReflectionRequest {
  dateKey: string;
  entries: NowInEnglishReflectionEntryRequest[];
  forceRefresh?: boolean;
}

export interface NowInEnglishReflectionExpression {
  expression: string;
  meaningKo: string;
  usageTip: string;
  example: string;
}

export interface NowInEnglishReflectionResponse {
  dateKey: string;
  entryCount: number;
  headlineKo: string;
  summaryKo: string;
  highlightsKo: string[];
  patternKo: string;
  gentleCorrectionKo: string;
  nextActionKo: string;
  nextActionExampleEn: string;
  expressions: NowInEnglishReflectionExpression[];
  closingKo: string;
}

export interface HistoryUsedExpression {
  expression: string;
  matchType?: string | null;
  matchedText?: string | null;
  source?: string | null;
}

export interface FeedbackInlineSegment {
  type: InlineFeedbackType;
  originalText: string;
  revisedText: string;
}

export interface FeedbackLoopStatus {
  badge?: string | null;
  headline: string;
  supportText?: string | null;
  rewriteCtaLabel?: string | null;
  finishCtaLabel?: string | null;
  cancelCtaLabel?: string | null;
}

export type FeedbackLoopAction = "rewrite" | "finish" | string;
export type FeedbackLoopExperienceStatus = "NEEDS_REWRITE" | "COMPLETE" | string;

export interface FeedbackLoop {
  status?: FeedbackLoopExperienceStatus | null;
  headline?: string | null;
  nextAction?: FeedbackLoopAction | null;
  nextActionLabel?: string | null;
  detailToggleLabel?: string | null;
}

export type FeedbackSuggestedPhrase =
  | string
  | {
      phrase?: string | null;
      meaningKo?: string | null;
    };

export type FeedbackLanguageCorrectionKind =
  | "STRUCTURE"
  | "GRAMMAR_BLOCKING"
  | "GRAMMAR_LOCAL";

export interface FeedbackLanguageCorrection {
  kind: FeedbackLanguageCorrectionKind;
  label: string;
  before?: string | null;
  after?: string | null;
  reason: string;
}

export interface FeedbackCoachMove {
  focus?: string | null;
  focusType?: string | null;
  why?: string | null;
  before?: string | null;
  after?: string | null;
  instruction?: string | null;
  skeletonEn?: string | null;
  skeletonKo?: string | null;
  suggestedPhrases?: FeedbackSuggestedPhrase[] | null;
  successCheck?: string | null;
  targetSlot?: string | null;
  languageCorrections?: FeedbackLanguageCorrection[] | null;
}

export interface FeedbackRewriteWorkspace {
  seedText?: string | null;
  placeholder?: string | null;
  lockMeaning?: boolean | null;
}

export interface FeedbackCompletion {
  headline?: string | null;
  improvedPoint?: string | null;
  encouragement?: string | null;
  nextTinyGoal?: string | null;
  // 완성 답변에만 오는 선택 제안: 선택 슬롯 하나를 더해 답을 풍부하게 만드는 문장 틀과 표현
  enrichment?: FeedbackCoachMove | null;
}

export interface FeedbackRevealLater {
  detailLabel?: string | null;
  modelAnswerLabel?: string | null;
}

export type VisibleFeedbackState = "NEEDS_REWRITE" | "READY_TO_FINISH";

export interface VisibleFeedbackSnapshot {
  schemaVersion: number;
  state: VisibleFeedbackState;
  strength?: string | null;
  coachMove?: FeedbackCoachMove | null;
  completion?: FeedbackCompletion | null;
  refinementExpressions?: RefinementExpression[] | null;
  modelAnswer?: string | null;
  modelAnswerKo?: string | null;
  legacy?: boolean | null;
}

export interface FeedbackUi {
  loopStatus?: FeedbackLoopStatus | null;
}

export type RefinementExpressionType = "LEXICAL" | "FRAME";
export type RefinementExpressionSource = "MODEL_ANSWER" | "PROMPT_HINT" | "GENERATED";
export type RefinementMeaningType = "GLOSS" | "PATTERN_EXPLANATION" | "NONE";
export type RefinementExampleSource = "EXTRACTED" | "OPENAI" | "GENERATED" | "NONE";

export interface RefinementExpression {
  expression: string;
  type?: RefinementExpressionType | null;
  source?: RefinementExpressionSource | null;
  meaningKo?: string | null;
  meaningType?: RefinementMeaningType | null;
  guidanceKo?: string | null;
  exampleEn?: string | null;
  exampleSource?: RefinementExampleSource | null;
  displayable?: boolean | null;
  qualityFlags?: string[] | null;
}

export interface FeedbackRequest {
  promptId: string;
  answer: string;
  sessionId?: string;
  attemptType?: AttemptType;
  guestId?: string;
  submissionId?: string;
}

export interface Feedback {
  promptId: string;
  sessionId: string;
  attemptNo: number;
  loopComplete: boolean;
  completionMessage: string | null;
  summary: string;
  strengths: string[];
  inlineFeedback: FeedbackInlineSegment[] | null;
  revisedAnswer: string | null;
  refinementExpressions?: RefinementExpression[] | null;
  modelAnswer: string;
  modelAnswerKo?: string | null;
  rewriteChallenge: string;
  ui?: FeedbackUi | null;
  loop?: FeedbackLoop | null;
  coachMove?: FeedbackCoachMove | null;
  rewriteWorkspace?: FeedbackRewriteWorkspace | null;
  completion?: FeedbackCompletion | null;
  revealLater?: FeedbackRevealLater | null;
  visibleFeedback?: VisibleFeedbackSnapshot | null;
  /** 다시 쓴 답이면 바로 앞 시도의 미션을 이번 답이 해결했는지. 첫 답이거나 앞이 완료였으면 없다. */
  previousMissionResult?: PreviousMissionResult | null;
}

export type PreviousMissionStatus = "RESOLVED" | "PARTIAL" | "UNRESOLVED";

export interface PreviousMissionResult {
  focusType: "SLOT" | "LANGUAGE_FIX" | "TASK_RESET" | string;
  title?: string | null;
  targetSlot?: string | null;
  status: PreviousMissionStatus | string;
  appliedCount?: number | null;
  totalCount?: number | null;
  message: string;
}

export interface FeedbackSessionStatus {
  sessionId: string;
  status: "IN_PROGRESS" | "READY_TO_FINISH" | "COMPLETED";
  /** 이번 요청으로 룹을 적립하는 때에만 있다(완료 응답). */
  loopPoints?: LoopPointsReward | null;
}

export type DiaryAnswerBand =
  | "DIARY_TOO_SHORT"
  | "DIARY_NOT_ENGLISH"
  | "DIARY_GRAMMAR_BLOCKING"
  | "DIARY_FLOW_THIN"
  | "DIARY_CLEAR_BASIC"
  | "DIARY_NATURAL_COMPLETE";

export interface DiaryCorrectionPoint {
  kind: string;
  title: string;
  originalText?: string | null;
  revisedText?: string | null;
  reasonKo: string;
  exampleEn?: string | null;
}

export interface DiaryFlow {
  timeFlow: string;
  emotion: string;
  detail: string;
  reflection: string;
  commentKo: string;
  connectionTips: string[];
}

export interface DiaryExpression {
  expression: string;
  meaningKo: string;
  exampleEn?: string | null;
  usageTipKo: string;
  tags: ExpressionTag[];
}

export interface DiaryRewriteIdea {
  title: string;
  meaningKo?: string | null;
  noteKo: string;
  exampleEn?: string | null;
}

export interface DiaryMission {
  focus: string;
  titleKo: string;
  instructionKo: string;
  starterEn?: string | null;
}

export interface DiaryFeedback {
  schemaVersion: "diary-feedback-v1" | string;
  entryId: string;
  attemptNo: number;
  score: number;
  finishable: boolean;
  diaryAnswerBand: DiaryAnswerBand;
  summaryKo: string;
  strengths: string[];
  correctedDiary?: string | null;
  modelDiary?: string | null;
  modelDiaryKo?: string | null;
  fixPoints: DiaryCorrectionPoint[];
  diaryFlow: DiaryFlow;
  rewriteIdeas: DiaryRewriteIdea[];
  usedDiaryExpressions: DiaryExpression[];
  diaryExpressions: DiaryExpression[];
  nextDiaryMission: DiaryMission;
  safetyFlags: string[];
  /** 이번 요청으로 룹을 적립하는 때에만 있다(완료 응답). */
  loopPoints?: LoopPointsReward | null;
}

export interface DiaryEntryRequest {
  entryDate?: string;
  title?: string;
  mood?: string;
  content?: string;
  language?: string;
  tags?: string[];
  draft?: boolean;
}

export interface DiaryFeedbackRequest {
  bodyText: string;
  attemptType?: AttemptType;
}

export interface DiaryAttempt {
  id: number;
  attemptNo: number;
  diaryText: string;
  score: number;
  feedbackSummary?: string | null;
  feedback?: DiaryFeedback | null;
  createdAt: string;
}

export interface DiaryEntry {
  entryId: string;
  title?: string | null;
  content: string;
  language: string;
  entryDate?: string | null;
  mood?: string | null;
  tags: string[];
  draft: boolean;
  createdAt: string;
  updatedAt: string;
  attempts: DiaryAttempt[];
}

export interface DiaryCalendarDay {
  date: string;
  entryId: string;
  entryCount: number;
}

export interface DiaryCalendarSummary {
  totalEntries: number;
  days: DiaryCalendarDay[];
}

export interface HistoryAttempt {
  id: number;
  attemptNo: number;
  attemptType: AttemptType;
  answerText: string;
  feedbackSummary: string;
  visibleFeedback?: VisibleFeedbackSnapshot | null;
  usedExpressions: HistoryUsedExpression[];
  createdAt: string;
}

export interface HistorySession {
  sessionId: string;
  promptId: string;
  topic: string;
  difficulty: PromptDifficulty;
  questionEn: string;
  questionKo: string;
  status: "IN_PROGRESS" | "READY_TO_FINISH" | "COMPLETED";
  createdAt: string;
  updatedAt: string;
  attempts: HistoryAttempt[];
}

// 관리자 AI 피드백 지표. 기능별 LLM 호출 수, 실패율, 응답 시간, 토큰(토큰은 2026-10-24부터 기록).
export interface AdminFeedbackMetricsItem {
  feedbackType: string;
  calls: number;
  failedCalls: number;
  failureRate: number;
  p50ElapsedMs: number | null;
  p95ElapsedMs: number | null;
  callsWithTokens: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

export interface AdminFeedbackMetrics {
  startDate: string;
  endDate: string;
  totalCalls: number;
  totalFailedCalls: number;
  failureRate: number;
  answerContractRetries: number;
  answerProviderRetries: number;
  items: AdminFeedbackMetricsItem[];
}
