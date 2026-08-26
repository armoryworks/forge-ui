import { ErrorHandler, Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

import { environment } from '../../../environments/environment';
import { CrashReportingService } from './crash-reporting.service';

/** Angular's default handling plus, in the native shell, a crash report to the instance's own service. */
@Injectable()
export class MobileErrorHandler extends ErrorHandler {
  private readonly crash = inject(CrashReportingService);
  private readonly router = inject(Router);

  override handleError(error: unknown): void {
    super.handleError(error);
    if (environment.mobileShell) this.crash.capture(error, this.router.url.split('?')[0]);
  }
}
