import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';

import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { UserPreferencesService } from '../../../shared/services/user-preferences.service';
import { CapabilityService } from '../../../shared/services/capability.service';
import { DashboardData } from '../models/dashboard-data.model';

interface SetupStep {
  label: string;
  route: string;
  done: boolean;
  /** Optional query params for the navigation (e.g. open the New Job form). */
  queryParams?: Record<string, string>;
  /** Capability gating this step. Omitted = universal. */
  capability?: string;
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
  private readonly capabilities = inject(CapabilityService);

  readonly data = input.required<DashboardData>();

  protected readonly dismissed = signal(!!this.prefs.get(PREF_KEY));

  protected get steps(): SetupStep[] {
    const d = this.data();
    // Only surface steps whose module is enabled, so an inventory-only install
    // isn't told to create jobs or add customers.
    return [
      // CTA opens the New Job form directly (via ?new=job) rather than just
      // landing the user on the board to hunt for the button.
      { label: this.translate.instant('dashboard.createFirstJob'), route: '/kanban', queryParams: { new: 'job' }, done: d.kpis.activeCount > 0, capability: 'CAP-EXT-KANBAN' },
      // Completion keys off real counts, not unrelated kanban stage counts.
      { label: this.translate.instant('dashboard.addCustomer'), route: '/customers', done: (d.customerCount ?? 0) > 0, capability: 'CAP-MD-CUSTOMERS' },
      // 3 track types are seeded by default (Production / R&D / Maintenance);
      // "done" means the user added one of their own beyond those.
      { label: this.translate.instant('dashboard.setUpTrackTypes'), route: '/admin/track-types', done: (d.trackTypeCount ?? 0) > 3, capability: 'CAP-EXT-KANBAN' },
      { label: this.translate.instant('dashboard.receiveFirstStock'), route: '/inventory/home/kiosk', done: false, capability: 'CAP-INV-CORE' },
      { label: this.translate.instant('dashboard.exploreReports'), route: '/reports', done: false },
    ].filter(s => !s.capability || this.capabilities.isEnabled(s.capability));
  }

  protected get completedCount(): number {
    return this.steps.filter(s => s.done).length;
  }

  protected get allDone(): boolean {
    // Hide once "enough" steps are done — capped to the visible step count so a
    // module-narrowed banner (fewer steps) can still complete.
    return this.completedCount >= Math.min(3, this.steps.length);
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
