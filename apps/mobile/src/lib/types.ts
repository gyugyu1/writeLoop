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

export interface CommonMistake {
  issue: string;
  displayLabel: string;
  count: number;
  latestSuggestion: string;
}

export interface FeedbackUsedExpression {
  expression: string;
  matchedText?: string | null;
  meaningKo?: string | null;
  exampleEn?: string | null;
  usageTip?: string | null;
  tags?: ExpressionTag[] | null;
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

export type FeedbackFixPointKind = "GRAMMAR" | "CORRECTION" | "EXPRESSION";

export interface FeedbackFixPoint {
  kind: FeedbackFixPointKind;
  title?: string | null;
  headline?: string | null;
  supportText?: string | null;
  originalText?: string | null;
  revisedText?: string | null;
  meaningKo?: string | null;
  guidanceKo?: string | null;
  exampleEn?: string | null;
  exampleKo?: string | null;
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

export interface FeedbackCoachMove {
  focus?: string | null;
  focusType?: string | null;
  why?: string | null;
  before?: string | null;
  after?: string | null;
  instruction?: string | null;
  exampleEn?: string | null;
  skeletonEn?: string | null;
  skeletonKo?: string | null;
  suggestedPhrases?: FeedbackSuggestedPhrase[] | null;
  successCheck?: string | null;
}

export interface FeedbackRewriteWorkspace {
  seedText?: string | null;
  placeholder?: string | null;
  targetTextHint?: string | null;
  lockMeaning?: boolean | null;
}

export interface FeedbackCompletion {
  headline?: string | null;
  improvedPoint?: string | null;
  encouragement?: string | null;
  nextTinyGoal?: string | null;
}

export interface FeedbackRevealLater {
  score?: number | null;
  detailLabel?: string | null;
  scoreLabel?: string | null;
  modelAnswerLabel?: string | null;
}

export interface FeedbackUi {
  fixPoints?: FeedbackFixPoint[] | null;
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
  exampleKo?: string | null;
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
}

export interface Feedback {
  promptId: string;
  sessionId: string;
  attemptNo: number;
  score: number;
  loopComplete: boolean;
  completionMessage: string | null;
  summary: string;
  strengths: string[];
  inlineFeedback: FeedbackInlineSegment[] | null;
  correctedAnswer: string | null;
  refinementExpressions?: RefinementExpression[] | null;
  usedExpressions?: FeedbackUsedExpression[] | null;
  modelAnswer: string;
  modelAnswerKo?: string | null;
  rewriteChallenge: string;
  ui?: FeedbackUi | null;
  loop?: FeedbackLoop | null;
  coachMove?: FeedbackCoachMove | null;
  rewriteWorkspace?: FeedbackRewriteWorkspace | null;
  completion?: FeedbackCompletion | null;
  revealLater?: FeedbackRevealLater | null;
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

export interface HistoryFeedback {
  score: number;
  loopComplete: boolean;
  completionMessage: string | null;
  summary: string;
  strengths: string[];
  inlineFeedback: FeedbackInlineSegment[] | null;
  correctedAnswer: string | null;
  modelAnswer: string;
  modelAnswerKo?: string | null;
  rewriteChallenge: string;
  ui?: FeedbackUi | null;
}

export interface HistoryAttempt {
  id: number;
  attemptNo: number;
  attemptType: AttemptType;
  answerText: string;
  score: number;
  feedbackSummary: string;
  feedback: HistoryFeedback;
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
  createdAt: string;
  updatedAt: string;
  attempts: HistoryAttempt[];
}
