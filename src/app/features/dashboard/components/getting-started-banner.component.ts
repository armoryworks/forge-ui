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
  /** Capability gating this step. */
  capability: string;
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
      { label: this.translate.instant('dashboard.addWorkCenters'), route: '/scheduling/work-centers', done: d.workCenterCount > 0, capability: 'CAP-MD-WORKCENTERS' },
      { label: this.translate.instant('dashboard.addCustomer'), route: '/customers', done: d.customerCount > 0, capability: 'CAP-MD-CUSTOMERS' },
      { label: this.translate.instant('dashboard.addFirstPart'), route: '/parts', done: d.partsWithOperationsCount > 0, capability: 'CAP-MD-ROUTING' },
      { label: this.translate.instant('dashboard.sendFirstQuote'), route: '/quotes', done: d.quoteCount > 0, capability: 'CAP-O2C-QUOTE' },
      // CTA opens the New Job form directly (via ?new=job) rather than just
      // landing the user on the board to hunt for the button.
      { label: this.translate.instant('dashboard.createFirstJob'), route: '/kanban', queryParams: { new: 'job' }, done: d.totalJobCount > 0, capability: 'CAP-EXT-KANBAN' },
      { label: this.translate.instant('dashboard.shipFirstOrder'), route: '/shipments', done: d.shipmentCount > 0, capability: 'CAP-O2C-SHIP' },
    ].filter(s => this.capabilities.isEnabled(s.capability));
  }

  protected get completedCount(): number {
    return this.steps.filter(s => s.done).length;
  }

  protected get allDone(): boolean {
    return this.steps.every(s => s.done);
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
