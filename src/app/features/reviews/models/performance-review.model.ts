import { ReviewStatus } from './review-status.type';

export interface PerformanceReview {
  id: number;
  cycleId: number;
  cycleName: string;
  employeeId: number;
  employeeName: string;
  reviewerId: number;
  reviewerName: string;
  status: ReviewStatus;
  overallRating: number | null;
  goalsJson: string | null;
  competenciesJson: string | null;
  strengthsComments: string | null;
  improvementComments: string | null;
  employeeSelfAssessment: string | null;
  completedAt: string | null;
  acknowledgedAt: string | null;
  selfRatingsJson: string | null;
  selfSubmittedAt: string | null;
  managerSubmittedAt: string | null;
  acknowledgementComments: string | null;
  ratingScaleMax: number;
  cycleCompetencies: string[] | null;
}
