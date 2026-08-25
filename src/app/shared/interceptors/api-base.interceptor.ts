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

  const instances = inject(InstanceService);
  const instance = instances.instance();
  if (instance && (req.url.startsWith('/api/') || req.url.startsWith('/hubs/'))) {
    const deviceToken = instance.shared ? instances.getDeviceToken() : null;
    return next(req.clone({
      url: `${instance.serverUrl}${req.url}`,
      setHeaders: deviceToken ? { 'X-Device-Token': deviceToken } : {},
    }));
  }
  return next(req);
};
