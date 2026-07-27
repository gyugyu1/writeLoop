export type PromptDifficulty = "I" | "A" | "B" | "C";
export type DailyDifficulty = "I" | "A" | "B" | "C";
export type HomeFlowStep = "pick" | "answer" | "feedback" | "rewrite" | "complete";
export type WritingDraftType = "ANSWER" | "REWRITE";

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
  coachProfile?: PromptCoachProfile | null;
}

export interface PromptCoachProfile {
  primaryCategory: string;
  secondaryCategories: string[];
  preferredExpressionFamilies: string[];
  avoidFamilies: string[];
  starterStyle: string;
  notes: string;
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
  displayOrder: number;
}

export interface PromptHint {
  id: string;
  promptId: string;
  hintType: string;
  title?: string | null;
  displayOrder: number;
  items?: PromptHintItem[];
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
  attemptType?: "INITIAL" | "REWRITE";
}

export interface CoachHelpResponse {
  promptId: string;
  userQuestion: string;
  coachReply: string;
  expressions: CoachExpression[];
  interactionId?: string;
}

export type CoachExpressionMatchType =
  | "EXACT"
  | "NORMALIZED"
  | "PARAPHRASED"
  | "SELF_DISCOVERED"
  | "UNUSED";
export type CoachUsageExpressionSource = "RECOMMENDED" | "SELF_DISCOVERED";

export interface CoachUsageExpression extends CoachExpression {
  matched: boolean;
  matchType: CoachExpressionMatchType;
  matchedText?: string | null;
  source: CoachUsageExpressionSource;
}

export interface CoachUsageCheckRequest {
  promptId: string;
  answer: string;
  sessionId?: string;
  guestId?: string;
  attemptNo?: number;
  attemptType?: "INITIAL" | "REWRITE";
  expressions: CoachExpression[];
  interactionId?: string;
}

export interface CoachUsageCheckResponse {
  promptId: string;
  praiseMessage: string;
  usedExpressions: CoachUsageExpression[];
  unusedExpressions: CoachUsageExpression[];
  relatedPromptIds: string[];
}

export interface FeedbackUsedExpression {
  expression: string;
  matchedText?: string | null;
  meaningKo?: string | null;
  exampleEn?: string | null;
  usageTip?: string | null;
  tags?: ExpressionTag[] | null;
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

export interface PromptRecommendationItem {
  slot: string;
  prompt: Prompt;
  reasonCode: string;
  reasonText: string;
  reasonFacts: string[];
  score: number;
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

export interface MonthStatusDay {
  date: string;
  started: boolean;
  completed: boolean;
  startedSessions: number;
  completedSessions: number;
  isToday: boolean;
}

export interface HistoryMonthStatus {
  year: number;
  month: number;
  streakDays: number;
  days: MonthStatusDay[];
}

export interface CommonMistake {
  issue: string;
  displayLabel: string;
  count: number;
  latestSuggestion: string;
}

export type SavedExpressionSourceType =
  | "USED_EXPRESSION"
  | "COACH_RECOMMENDATION"
  | "REFINEMENT_EXPRESSION";

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

export interface Correction {
  issue: string;
  suggestion: string;
}

export type InlineFeedbackType = "KEEP" | "REPLACE" | "ADD" | "REMOVE";

export interface FeedbackInlineSegment {
  type: InlineFeedbackType;
  originalText: string;
  revisedText: string;
}

export interface GrammarFeedbackItem {
  originalText: string;
  revisedText: string;
  reasonKo: string;
}

export interface FeedbackMicroTip {
  title: string;
  originalText?: string | null;
  revisedText?: string | null;
  reasonKo?: string | null;
}

export interface FeedbackRewriteSuggestion {
  english: string;
  meaningKo?: string | null;
  noteKo?: string | null;
}

export type FeedbackCompletionState = "NEEDS_REVISION" | "CAN_FINISH" | "OPTIONAL_POLISH";
export type FeedbackSectionDisplayMode = "HIDE" | "SHOW_EXPANDED" | "SHOW_COLLAPSED";
export type FeedbackRewriteGuideMode =
  | "FRAGMENT_SCAFFOLD"
  | "CORRECTED_SKELETON"
  | "DETAIL_SCAFFOLD"
  | "TASK_RESET"
  | "OPTIONAL_POLISH";
export type FeedbackModelAnswerDisplayMode =
  | "HIDE"
  | "SHOW_EXPANDED"
  | "SHOW_COLLAPSED"
  | "TASK_RESET_EXAMPLE";
export type FeedbackRefinementDisplayMode = "HIDE" | "SHOW_EXPANDED" | "SHOW_COLLAPSED";

export interface FeedbackScreenPolicy {
  completionState: FeedbackCompletionState;
  sectionOrder: string[];
  keepWhatWorksDisplayMode: FeedbackSectionDisplayMode;
  rewriteGuideDisplayMode: FeedbackSectionDisplayMode;
  rewriteGuideMode: FeedbackRewriteGuideMode;
  modelAnswerDisplayMode: FeedbackModelAnswerDisplayMode;
  refinementDisplayMode: FeedbackRefinementDisplayMode;
  keepWhatWorksMaxItems: number;
  keepExpressionChipMaxItems: number;
  refinementMaxCards: number;
  showFinishCta: boolean;
  showRewriteCta: boolean;
  showCancelCta: boolean;
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
  exampleEn?: string | null;
  skeletonEn?: string | null;
  skeletonKo?: string | null;
  suggestedPhrases?: (string | { phrase?: string | null; meaningKo?: string | null })[] | null;
  successCheck?: string | null;
  targetSlot?: string | null;
  languageCorrections?: FeedbackLanguageCorrection[] | null;
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
  microTip?: FeedbackMicroTip | null;
  rewriteSuggestions?: FeedbackRewriteSuggestion[] | null;
  screenPolicy?: FeedbackScreenPolicy | null;
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
  attemptType?: "INITIAL" | "REWRITE";
  guestId?: string;
  submissionId?: string;
}

export interface Feedback {
  promptId: string;
  sessionId: string;
  attemptNo: number;
  loopComplete: boolean;
  completionMessage: string | null;
  /** Legacy persistence/history field. The main feedback screen no longer renders this directly. */
  summary: string;
  strengths: string[];
  /** Legacy analysis/history field. The main feedback UI does not render this directly. */
  inlineFeedback: FeedbackInlineSegment[] | null;
  revisedAnswer: string | null;
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
  visibleFeedback?: VisibleFeedbackSnapshot | null;
}

export interface FeedbackSessionStatus {
  sessionId: string;
  status: "IN_PROGRESS" | "READY_TO_FINISH" | "COMPLETED";
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
  attemptType?: "INITIAL" | "REWRITE";
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

export interface HomeDraftSnapshot {
  selectedDifficulty: DailyDifficulty;
  selectedPromptId: string;
  sessionId: string;
  answer: string;
  rewrite: string;
  lastSubmittedAnswer: string;
  feedback: Feedback | null;
  step: HomeFlowStep;
}

export interface SaveWritingDraftRequest {
  draftType: WritingDraftType;
  selectedDifficulty: DailyDifficulty;
  sessionId: string;
  answer: string;
  rewrite: string;
  lastSubmittedAnswer: string;
  feedback: Feedback | null;
  step: HomeFlowStep;
}

export interface WritingDraft extends HomeDraftSnapshot {
  promptId: string;
  draftType: WritingDraftType;
  updatedAt: string;
}

export interface StoredFeedback {
  loopComplete: boolean;
  completionMessage: string | null;
  /** Legacy persistence/history field. The main feedback screen no longer renders this directly. */
  summary: string;
  strengths: string[];
  /** Legacy analysis/history field. The main feedback UI does not render this directly. */
  inlineFeedback: FeedbackInlineSegment[] | null;
  revisedAnswer: string | null;
  refinementExpressions?: RefinementExpression[] | null;
  usedExpressions?: FeedbackUsedExpression[] | null;
  modelAnswer: string;
  modelAnswerKo?: string | null;
  rewriteChallenge: string;
  ui?: FeedbackUi | null;
}

export interface AuthUser {
  id: number;
  email: string;
  displayName: string;
  socialProvider?: string | null;
  admin: boolean;
}

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

export interface AdminPromptTopicCatalogEntry {
  category: string;
  details: string[];
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

export interface PendingSocialRegistration {
  provider: string;
  suggestedDisplayName: string;
  returnTo: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest extends LoginRequest {
  displayName: string;
}

export interface SendRegistrationCodeRequest {
  email: string;
}

export interface SendPasswordResetCodeRequest {
  email: string;
}

export interface PasswordResetAvailability {
  email: string;
  available: boolean;
  message: string;
}

export interface CompleteRegistrationRequest {
  email: string;
  code: string;
  password: string;
  displayName: string;
}

export interface CompleteSocialRegistrationRequest {
  token: string;
  displayName: string;
}

export interface ResetPasswordRequest {
  email: string;
  code: string;
  newPassword: string;
}

export interface VerifyPasswordResetCodeRequest {
  email: string;
  code: string;
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

export interface VerifyEmailRequest {
  email: string;
  code: string;
}

export interface HistoryAttempt {
  id: number;
  attemptNo: number;
  attemptType: "INITIAL" | "REWRITE";
  answerText: string;
  feedbackSummary: string;
  visibleFeedback?: VisibleFeedbackSnapshot | null;
  usedExpressions: HistoryUsedExpression[];
  createdAt: string;
}

export interface HistoryUsedExpression {
  expression: string;
  matchType: CoachExpressionMatchType;
  matchedText?: string | null;
  source?: CoachUsageExpressionSource | null;
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

