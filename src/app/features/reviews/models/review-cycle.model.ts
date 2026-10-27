import { ReviewCycleProgress } from './review-cycle-progress.model';
import { ReviewScopeType } from './review-scope-type.type';

export interface ReviewCycle {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: 'Draft' | 'Active' | 'Completed';
  description: string | null;
  reviewCount: number;
  ratingScaleMax: number;
  competencies: string[] | null;
  scopeType: ReviewScopeType | null;
  scopeDepartment: string | null;
  scopeUserIds: number[] | null;
  launchedAt: string | null;
  closedAt: string | null;
  progress: ReviewCycleProgress | null;
}
