import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { resolveEntityRoute } from '../utils/notification-route';

/** `/open/:type/:id`, the record link in notification emails: redirects to that record's page, or to the notifications list. */
export const openEntityGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const id = Number(route.paramMap.get('id'));
  const target = Number.isInteger(id) && id > 0
    ? resolveEntityRoute(route.paramMap.get('type') ?? '', id)
    : null;
  return target
    ? router.createUrlTree(target.path, { queryParams: target.query })
    : router.createUrlTree(['/notifications']);
};
