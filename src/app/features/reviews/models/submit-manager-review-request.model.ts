import { ReviewCompetencyRating } from './review-competency-rating.model';

export interface SubmitManagerReviewRequest {
  ratings: ReviewCompetencyRating[];
  overallRating: number;
  goals: string | null;
  strengthsComments: string | null;
  improvementComments: string | null;
}
