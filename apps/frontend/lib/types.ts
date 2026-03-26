export type PromptDifficulty = "A" | "B" | "C";
export type DailyDifficulty = "A" | "B" | "C";
export type HomeFlowStep = "pick" | "answer" | "feedback" | "rewrite" | "complete";
export type WritingDraftType = "ANSWER" | "REWRITE";

export interface Prompt {
  id: string;
  topic: string;
  difficulty: PromptDifficulty;
  questionEn: string;
  questionKo: string;
  tip: string;
}

export interface PromptHint {
  id: string;
  promptId: string;
  hintType: string;
  content: string;
  displayOrder: number;
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
  summary: string;
  strengths: string[];
  corrections: Correction[];
  inlineFeedback: FeedbackInlineSegment[] | null;
  correctedAnswer: string | null;
  modelAnswer: string;
  rewriteChallenge: string;
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
  summary: string;
  strengths: string[];
  corrections: Correction[];
  inlineFeedback: FeedbackInlineSegment[] | null;
  correctedAnswer: string | null;
  modelAnswer: string;
  rewriteChallenge: string;
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
  content: string;
  displayOrder: number;
  active: boolean;
}

export interface AdminPrompt {
  id: string;
  topic: string;
  difficulty: PromptDifficulty;
  questionEn: string;
  questionKo: string;
  tip: string;
  displayOrder: number;
  active: boolean;
  hints: AdminPromptHint[];
}

export interface AdminPromptRequest {
  topic: string;
  difficulty: PromptDifficulty;
  questionEn: string;
  questionKo: string;
  tip: string;
  displayOrder: number;
  active: boolean;
}

export interface AdminPromptHintRequest {
  hintType: string;
  content: string;
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
