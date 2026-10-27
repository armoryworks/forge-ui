import { Routes } from '@angular/router';

import { tabGuard } from '../../shared/guards/tab.guard';
import { REVIEW_TAB_ROLES, REVIEW_TABS } from './models/review-tab.model';

export const REVIEWS_ROUTES: Routes = [
  { path: '', redirectTo: 'mine', pathMatch: 'full' },
  {
    path: 'review/:id',
    loadComponent: () => import('./pages/review-detail/review-detail.component').then(m => m.ReviewDetailComponent),
  },
  {
    path: ':tab',
    canActivate: [tabGuard(REVIEW_TABS, 'mine', REVIEW_TAB_ROLES)],
    loadComponent: () => import('./pages/reviews/reviews.component').then(m => m.ReviewsComponent),
  },
];
