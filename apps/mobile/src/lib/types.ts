export type DailyDifficulty = "I" | "A" | "B" | "C";
export type PromptDifficulty = "I" | "A" | "B" | "C";
export type SocialProvider = "naver" | "google" | "kakao";
export type AttemptType = "INITIAL" | "REWRITE";
export type InlineFeedbackType = "KEEP" | "REPLACE" | "ADD" | "REMOVE";
export type WritingDraftType = "ANSWER" | "REWRITE";
export type SavedExpressionSourceType =
  | "USED_EXPRESSION"
  | "COACH_RECOMMENDATION"
  | "REFINEMENT_EXPRESSION";
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
  totalWrittenSentences: number;
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

export interface FeedbackRewriteIdea {
  title?: string | null;
  english?: string | null;
  meaningKo?: string | null;
  noteKo?: string | null;
  exampleEn?: string | null;
  tags?: ExpressionTag[] | null;
  originalText?: string | null;
  revisedText?: string | null;
  optionalTone?: boolean | null;
}

export interface FeedbackMicroTip {
  title?: string | null;
  reasonKo?: string | null;
  originalText?: string | null;
  revisedText?: string | null;
}

export type FeedbackCompletionState =
  | "NEEDS_REVISION"
  | "CAN_FINISH"
  | "OPTIONAL_POLISH";
export type FeedbackSectionDisplayMode = "HIDE" | "SHOW_EXPANDED" | "SHOW_COLLAPSED";
export type FeedbackRewriteGuideMode =
  | "FRAGMENT_SCAFFOLD"
  | "CORRECTED_SKELETON"
  | "DETAIL_SCAFFOLD"
  | "OPTIONAL_POLISH"
  | "TASK_RESET";
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

export type FeedbackModelAnswerVariantKind = "NATURAL_POLISH" | "RICHER_DETAIL";

export interface FeedbackModelAnswerVariant {
  kind?: FeedbackModelAnswerVariantKind | string | null;
  answer?: string | null;
  answerKo?: string | null;
  reasonKo?: string | null;
}

export interface FeedbackUi {
  microTip?: FeedbackMicroTip | null;
  secondaryLearningPoints?: FeedbackSecondaryLearningPoint[] | null;
  fixPoints?: FeedbackFixPoint[] | null;
  nextStepPractice?: FeedbackNextStepPractice | null;
  rewriteSuggestions?: FeedbackRewriteSuggestion[] | null;
  rewriteIdeas?: FeedbackRewriteIdea[] | null;
  modelAnswerVariants?: FeedbackModelAnswerVariant[] | null;
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
