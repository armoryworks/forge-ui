import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { InstanceService } from '../services/instance.service';

/**
 * Native shell only: rewrites the app's same-origin API/hub paths onto the
 * enrolled instance's origin. Registered LAST so every other interceptor
 * keeps seeing the familiar relative /api/v1 URLs.
 */
export const apiBaseInterceptor: HttpInterceptorFn = (req, next) => {
  if (!environment.mobileShell) return next(req);

  const instance = inject(InstanceService).instance();
  if (instance && (req.url.startsWith('/api/') || req.url.startsWith('/hubs/'))) {
    return next(req.clone({ url: `${instance.serverUrl}${req.url}` }));
  }
  return next(req);
};
