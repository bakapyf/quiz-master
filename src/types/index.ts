export type QuestionType = "single_choice" | "multiple_choice" | "true_false" | "short_answer";

export interface Question {
  id?: number;
  bankId: number;
  type: QuestionType;
  category: string;
  stem: string;
  options: string[];
  answer: string;
  explanation: string;
  order: number;
  createdAt: number;
}

export interface QuestionBank {
  id?: number;
  name: string;
  source: string;
  questionCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface QuizRecord {
  id?: number;
  questionId: number;
  bankId: number;
  userAnswer: string;
  isCorrect: boolean;
  timestamp: number;
  mode: "sequential" | "random" | "exam" | "browse";
}

export interface ExamSession {
  id?: number;
  bankId: number;
  bankName: string;
  mode: "exam";
  totalQuestions: number;
  correctAnswers: number;
  score: number;
  duration: number;
  startedAt: number;
  completedAt: number;
}

export interface Favorite {
  id?: number;
  questionId: number;
  bankId: number;
  timestamp: number;
}

export type QuizMode = "sequential" | "random" | "exam" | "browse";

export interface QuizConfig {
  mode: QuizMode;
  bankId: number;
  questionCount?: number;
  timeLimit?: number; // minutes, only for exam mode
}
