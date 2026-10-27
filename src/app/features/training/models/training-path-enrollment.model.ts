export interface TrainingPathEnrollment {
  id: number;
  userId: number;
  userName: string;
  userIsActive: boolean;
  enrolledAt: string;
  dueDate: string | null;
  isOverdue: boolean;
  isAutoAssigned: boolean;
  assignedByName: string | null;
  totalModules: number;
  completedModules: number;
  progressPercent: number;
  completedAt: string | null;
}
