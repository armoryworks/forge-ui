import { ReviewScopeType } from './review-scope-type.type';

export interface SaveReviewCycleRequest {
  name: string;
  startDate: string;
  endDate: string;
  description: string | null;
  ratingScaleMax: number;
  competencies: string[];
  scopeType: ReviewScopeType;
  scopeDepartment: string | null;
  scopeUserIds: number[] | null;
}
