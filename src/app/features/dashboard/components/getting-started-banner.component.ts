import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';

import { UserPreferencesService } from '../../../shared/services/user-preferences.service';
import { DashboardData } from '../models/dashboard-data.model';

interface SetupStep {
  label: string;
  route: string;
  done: boolean;
}

const PREF_KEY = 'dashboard:getting-started-dismissed';

@Component({
  selector: 'app-getting-started-banner',
  standalone: true,
  templateUrl: './getting-started-banner.component.html',
  styleUrl: './getting-started-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GettingStartedBannerComponent {
  private readonly router = inject(Router);
  private readonly prefs = inject(UserPreferencesService);

  readonly data = input.required<DashboardData>();

  protected readonly dismissed = signal(!!this.prefs.get(PREF_KEY));

  protected get steps(): SetupStep[] {
    const d = this.data();
    return [
      { label: 'Create your first job', route: '/kanban', done: d.kpis.activeCount > 0 },
      { label: 'Add a customer', route: '/customers', done: (d.stages?.length ?? 0) > 0 },
      { label: 'Set up track types', route: '/admin/track-types', done: (d.stages?.length ?? 0) > 3 },
      { label: 'Explore reports', route: '/reports', done: false },
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
    this.router.navigate([step.route]);
  }

  protected dismiss(): void {
    this.dismissed.set(true);
    this.prefs.set(PREF_KEY, true);
  }
}
