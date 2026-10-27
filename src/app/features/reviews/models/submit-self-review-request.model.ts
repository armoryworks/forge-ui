import { ReviewCompetencyRating } from './review-competency-rating.model';

export interface SubmitSelfReviewRequest {
  ratings: ReviewCompetencyRating[];
  selfAssessment: string | null;
}
