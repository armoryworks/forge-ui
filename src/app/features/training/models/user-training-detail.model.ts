export interface UserTrainingModuleDetail {
  moduleId: number;
  title: string;
  contentType: string;
  status: string | null;
  quizScore: number | null;
  quizAttempts: number;
  timeSpentSeconds: number;
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface UserTrainingDetail {
  userId: number;
  displayName: string;
  role: string;
  totalEnrolled: number;
  overallCompletionPct: number;
  modules: UserTrainingModuleDetail[];
}
