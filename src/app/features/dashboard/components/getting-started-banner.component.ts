import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';

import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { UserPreferencesService } from '../../../shared/services/user-preferences.service';
import { DashboardData } from '../models/dashboard-data.model';

interface SetupStep {
  label: string;
  route: string;
  done: boolean;
  /** Optional query params for the navigation (e.g. open the New Job form). */
  queryParams?: Record<string, string>;
}

const PREF_KEY = 'dashboard:getting-started-dismissed';

@Component({
  selector: 'app-getting-started-banner',
  standalone: true,
  imports: [TranslatePipe, MatTooltipModule],
  templateUrl: './getting-started-banner.component.html',
  styleUrl: './getting-started-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GettingStartedBannerComponent {
  private readonly router = inject(Router);
  private readonly prefs = inject(UserPreferencesService);
  private readonly translate = inject(TranslateService);

  readonly data = input.required<DashboardData>();

  protected readonly dismissed = signal(!!this.prefs.get(PREF_KEY));

  protected get steps(): SetupStep[] {
    const d = this.data();
    return [
      // CTA opens the New Job form directly (via ?new=job) rather than just
      // landing the user on the board to hunt for the button.
      { label: this.translate.instant('dashboard.createFirstJob'), route: '/kanban', queryParams: { new: 'job' }, done: d.kpis.activeCount > 0 },
      // Completion keys off real counts, not unrelated kanban stage counts.
      { label: this.translate.instant('dashboard.addCustomer'), route: '/customers', done: (d.customerCount ?? 0) > 0 },
      // 3 track types are seeded by default (Production / R&D / Maintenance);
      // "done" means the user added one of their own beyond those.
      { label: this.translate.instant('dashboard.setUpTrackTypes'), route: '/admin/track-types', done: (d.trackTypeCount ?? 0) > 3 },
      { label: this.translate.instant('dashboard.exploreReports'), route: '/reports', done: false },
    ];
  }

  protected get completedCount(): number {
    return this.steps.filter(s => s.done).length;
  }

  protected get allDone(): boolean {
    return this.completedCount >= 3;
  }

  protected get visible(): boolean {
    return !this.dismissed() && !this.allDone;
  }

  protected goTo(step: SetupStep): void {
    this.router.navigate([step.route], step.queryParams ? { queryParams: step.queryParams } : undefined);
  }

  protected dismiss(): void {
    this.dismissed.set(true);
    this.prefs.set(PREF_KEY, true);
  }
}
