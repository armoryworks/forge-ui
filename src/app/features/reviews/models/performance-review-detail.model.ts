import { PerformanceReview } from './performance-review.model';
import { ReviewHistoryItem } from './review-history-item.model';

export interface PerformanceReviewDetail {
  review: PerformanceReview;
  history: ReviewHistoryItem[];
}
