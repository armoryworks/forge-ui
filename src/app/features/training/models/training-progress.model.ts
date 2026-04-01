import { TrainingProgressStatus } from './training-progress-status.enum';

export interface TrainingProgress {
  moduleId: number;
  status: TrainingProgressStatus;
  quizScore: number | null;
  quizAttempts: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  timeSpentSeconds: number;
}

export interface TrainingEnrollment {
  id: number;
  pathId: number;
  pathTitle: string;
  pathIcon: string;
  totalModules: number;
  completedModules: number;
  enrolledAt: Date | null;
  completedAt: Date | null;
}
