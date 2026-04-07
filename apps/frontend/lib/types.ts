export type PromptDifficulty = "A" | "B" | "C";
export type DailyDifficulty = "A" | "B" | "C";
export type HomeFlowStep = "pick" | "answer" | "feedback" | "rewrite" | "complete";
export type WritingDraftType = "ANSWER" | "REWRITE";

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
  usageTip?: string | null;
}

export interface DailyPromptRecommendation {
  recommendedDate: string;
  difficulty: DailyDifficulty;
  prompts: Prompt[];
}

export interface TodayWritingStatus {
  date: string;
  completed: boolean;
  completedSessions: number;
  startedSessions: number;
  streakDays: number;
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

export type FeedbackSecondaryLearningPointKind = "GRAMMAR" | "CORRECTION" | "EXPRESSION";

export interface FeedbackSecondaryLearningPoint {
  kind: FeedbackSecondaryLearningPointKind;
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

export type FeedbackFixPoint = FeedbackSecondaryLearningPoint;

export interface FeedbackNextStepPractice {
  kind?: FeedbackSecondaryLearningPointKind | null;
  title?: string | null;
  headline?: string | null;
  supportText?: string | null;
  originalText?: string | null;
  revisedText?: string | null;
  meaningKo?: string | null;
  guidanceKo?: string | null;
  exampleEn?: string | null;
  exampleKo?: string | null;
  ctaLabel?: string | null;
  optionalTone?: boolean | null;
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
  fixFirstDisplayMode: FeedbackSectionDisplayMode;
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

export interface FeedbackUi {
  microTip?: FeedbackMicroTip | null;
  secondaryLearningPoints?: FeedbackSecondaryLearningPoint[] | null;
  fixPoints?: FeedbackFixPoint[] | null;
  nextStepPractice?: FeedbackNextStepPractice | null;
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
}

export interface Feedback {
  promptId: string;
  sessionId: string;
  attemptNo: number;
  score: number;
  loopComplete: boolean;
  completionMessage: string | null;
  /** Legacy persistence/history field. The main feedback screen no longer renders this directly. */
  summary: string;
  strengths: string[];
  /** Legacy analysis/history field. Main feedback UI is fixPoints-based and does not render this directly. */
  inlineFeedback: FeedbackInlineSegment[] | null;
  correctedAnswer: string | null;
  refinementExpressions?: RefinementExpression[] | null;
  usedExpressions?: FeedbackUsedExpression[] | null;
  modelAnswer: string;
  modelAnswerKo?: string | null;
  rewriteChallenge: string;
  ui?: FeedbackUi | null;
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
  score: number;
  loopComplete: boolean;
  completionMessage: string | null;
  /** Legacy persistence/history field. The main feedback screen no longer renders this directly. */
  summary: string;
  strengths: string[];
  /** Legacy analysis/history field. Main feedback UI is fixPoints-based and does not render this directly. */
  inlineFeedback: FeedbackInlineSegment[] | null;
  correctedAnswer: string | null;
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
  score: number;
  feedbackSummary: string;
  feedback: StoredFeedback;
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
  createdAt: string;
  updatedAt: string;
  attempts: HistoryAttempt[];
}

