import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

import { DesktopPreferenceService } from '../../../shared/services/desktop-preference.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { EntityRoute, resolveEntityRoute } from '../../../shared/utils/notification-route';

export interface MobileEntityTarget {
  route: EntityRoute;
  desktop: boolean;
}

@Injectable({ providedIn: 'root' })
export class MobileEntityLinkService {
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly desktopPreference = inject(DesktopPreferenceService);

  targetFor(entityType: string | null | undefined, entityId: number | null | undefined): MobileEntityTarget | null {
    if (!entityType || !entityId) return null;
    if (entityType.toLowerCase() === 'job') return { route: { path: ['/m/jobs', entityId] }, desktop: false };
    const route = resolveEntityRoute(entityType, entityId);
    return route ? { route, desktop: true } : null;
  }

  open(target: MobileEntityTarget): void {
    if (target.desktop) {
      this.openDesktop(target.route);
      return;
    }
    this.router.navigate(target.route.path, { queryParams: target.route.query });
  }

  openDesktop(route: EntityRoute): void {
    if (!this.desktopPreference.prefer()) {
      this.snackbar.error(this.translate.instant('mobileWeb.desktopLink.storageBlocked'));
      return;
    }
    this.router.navigate(route.path, { queryParams: route.query });
  }
}
