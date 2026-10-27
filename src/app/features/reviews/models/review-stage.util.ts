import { ReviewStatus } from './review-status.type';

export type ReviewStage = 'notStarted' | 'selfSubmitted' | 'managerSubmitted' | 'acknowledged' | 'closed';

const STAGE_BY_STATUS: Record<ReviewStatus, ReviewStage> = {
  NotStarted: 'notStarted',
  SelfAssessment: 'notStarted',
  SelfSubmitted: 'selfSubmitted',
  ManagerReview: 'selfSubmitted',
  ManagerSubmitted: 'managerSubmitted',
  Discussion: 'managerSubmitted',
  Acknowledged: 'acknowledged',
  Completed: 'closed',
  Closed: 'closed',
};

export const REVIEW_STAGES: readonly ReviewStage[] = ['notStarted', 'selfSubmitted', 'managerSubmitted', 'acknowledged', 'closed'];

/** The walk stage of a review status; legacy statuses fold onto the stage they stand for. */
export function reviewStage(status: ReviewStatus): ReviewStage {
  return STAGE_BY_STATUS[status] ?? 'notStarted';
}

export function reviewStageRank(status: ReviewStatus): number {
  return REVIEW_STAGES.indexOf(reviewStage(status));
}
