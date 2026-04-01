export interface ShopFloorOverview {
  activeJobs: ShopFloorJob[];
  workers: ShopFloorWorker[];
  completedToday: number;
  maintenanceAlerts: number;
}

export interface ShopFloorJob {
  id: number;
  jobNumber: string;
  title: string;
  stageName: string;
  stageColor: string;
  priorityName: string;
  assigneeInitials: string | null;
  assigneeColor: string | null;
  dueDate: Date | null;
  isOverdue: boolean;
}

export interface ShopFloorWorker {
  userId: number;
  name: string;
  initials: string;
  avatarColor: string;
  currentTask: string | null;
  currentJobId: number | null;
  currentJobNumber: string | null;
  timeOnTask: string;
}
