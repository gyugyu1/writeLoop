export type DailyDifficulty = "A" | "B" | "C";
export type PromptDifficulty = "A" | "B" | "C";
export type SocialProvider = "naver" | "google" | "kakao";
export type AttemptType = "INITIAL" | "REWRITE";
export type InlineFeedbackType = "KEEP" | "REPLACE" | "ADD" | "REMOVE";
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
}

export interface DailyPromptRecommendation {
  recommendedDate: string;
  difficulty: DailyDifficulty;
  prompts: Prompt[];
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
  usageTip?: string | null;
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

export interface FeedbackLoopStatus {
  badge?: string | null;
  headline: string;
  supportText?: string | null;
  rewriteCtaLabel?: string | null;
  finishCtaLabel?: string | null;
  cancelCtaLabel?: string | null;
}

export interface FeedbackUi {
  fixPoints?: FeedbackFixPoint[] | null;
  nextStepPractice?: FeedbackNextStepPractice | null;
  rewriteSuggestions?: FeedbackRewriteSuggestion[] | null;
  loopStatus?: FeedbackLoopStatus | null;
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
