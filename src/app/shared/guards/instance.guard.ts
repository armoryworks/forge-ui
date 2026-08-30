import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { environment } from '../../../environments/environment';
import { InstanceService } from '../services/instance.service';

/**
 * Native shell only: /app requires an enrolled instance. Web builds pass
 * through — the PWA authenticates through the normal login flow.
 */
export const instanceGuard: CanActivateFn = () => {
  if (!environment.mobileShell) return true;

  const instances = inject(InstanceService);
  const router = inject(Router);
  return instances.instance() ? true : router.parseUrl('/app/enroll');
};
