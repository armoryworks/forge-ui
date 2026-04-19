export interface FollowUpTask {
  id: number;
  title: string;
  description: string | null;
  assignedToUserId: number;
  assignedToName: string;
  dueDate: string | null;
  sourceEntityType: string | null;
  sourceEntityId: number | null;
  triggerType: string;
  status: 'Open' | 'Completed' | 'Dismissed';
  completedAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
}
