import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { TranslatePipe } from '@ngx-translate/core';

import { RouteStatusKind } from '../../models/route-status-kind.model';
import { LayoutService } from '../../services/layout.service';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

const VIEWS: Readonly<Record<RouteStatusKind, { icon: string; message: string; help: string }>> = {
  notFound: { icon: 'search_off', message: 'routeStatus.notFound', help: 'routeStatus.notFoundHelp' },
  forbidden: { icon: 'lock', message: 'routeStatus.forbidden', help: 'routeStatus.forbiddenHelp' },
  featureOff: { icon: 'toggle_off', message: 'routeStatus.featureOff', help: 'routeStatus.featureOffHelp' },
};

/**
 * Full-page notice for a URL that cannot be shown: an unknown page, a page the user's role may not
 * open, or a page whose capability is switched off. The kind comes from the route's `status` data.
 * The address bar keeps the requested URL, which the notice names, and its action goes to the
 * user's home screen, or to the dashboard when home is the page that was just refused.
 */
@Component({
  selector: 'app-route-status-page',
  standalone: true,
  imports: [TranslatePipe, EmptyStateComponent],
  templateUrl: './route-status-page.component.html',
  styleUrl: './route-status-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RouteStatusPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly layout = inject(LayoutService);

  protected readonly attemptedUrl = this.location.path() || '/';

  protected readonly kind: RouteStatusKind = this.route.snapshot.data['status'] ?? 'notFound';

  protected readonly view = VIEWS[this.kind] ?? VIEWS.notFound;

  protected goHome(): void {
    const home = this.layout.getDefaultRoute();
    const target = firstSegment(home) === firstSegment(this.attemptedUrl) ? '/dashboard' : home;
    this.router.navigateByUrl(target);
  }
}

function firstSegment(url: string): string {
  return url.split(/[?#]/)[0].split('/').find((s) => s.length > 0) ?? '';
}
