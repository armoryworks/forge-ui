export interface QuizOption {
  id: string;
  text: string;
  isCorrect?: boolean; // Only present for admin, stripped for regular users
}

export interface QuizQuestion {
  id: string;
  text: string;
  options: QuizOption[];
  explanation?: string;
}

export interface QuizContent {
  passingScore: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showExplanationsAfterSubmit: boolean;
  timeLimit?: number; // minutes, optional
  questionsPerQuiz?: number; // how many to select from pool per attempt
  poolSize?: number; // total questions in pool (server injects this for display)
  questions: QuizQuestion[];
}

export interface QuizAnswer {
  questionId: string;
  optionId: string;
}

export interface QuizScoredQuestion {
  questionId: string;
  isCorrect: boolean;
  correctOptionId: string;
  explanation?: string;
}

export interface QuizSubmissionResult {
  score: number;
  passed: boolean;
  questions: QuizScoredQuestion[];
}
