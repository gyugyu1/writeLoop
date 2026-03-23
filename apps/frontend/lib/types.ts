export type PromptDifficulty = "A" | "B" | "C";
export type DailyDifficulty = "A" | "B" | "C";

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
  modelAnswer: string;
  rewriteChallenge: string;
}

export interface StoredFeedback {
  score: number;
  loopComplete: boolean;
  completionMessage: string | null;
  summary: string;
  strengths: string[];
  corrections: Correction[];
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

export interface SendPasswordResetCodeRequest {
  email: string;
}

export interface PasswordResetAvailability {
  email: string;
  available: boolean;
  message: string;
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
