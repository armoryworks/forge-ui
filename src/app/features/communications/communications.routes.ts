import { Routes } from '@angular/router';

import { capabilityGuard } from '../../shared/guards/capability.guard';

/**
 * Proof-of-intent review. Gated on email sync because that is what produces the
 * messages this reviews; the approve action carries its own role restriction
 * server-side, since approving asserts a customer authorized work.
 */
export const COMMUNICATIONS_ROUTES: Routes = [
  {
    path: ':id',
    canActivate: [capabilityGuard('CAP-EXT-EMAIL-SYNC')],
    loadComponent: () =>
      import('./pages/review/communication-review.component')
        .then((m) => m.CommunicationReviewComponent),
  },
];
