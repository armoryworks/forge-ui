import { TrainingProgressStatus } from './training-progress-status.enum';

export interface TrainingProgress {
  moduleId: number;
  status: TrainingProgressStatus;
  quizScore: number | null;
  quizAttempts: number | null;
  startedAt: string | null;
  completedAt: string | null;
  timeSpentSeconds: number;
}

export interface TrainingEnrollment {
  id: number;
  pathId: number;
  pathTitle: string;
  pathIcon: string;
  totalModules: number;
  completedModules: number;
  enrolledAt: string | null;
  completedAt: string | null;
}
