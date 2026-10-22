import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { DashboardService } from '../services/dashboard.service';
import { DashboardData } from '../models/dashboard-data.model';
import { LanguageService } from '../../../shared/services/language.service';

@Component({
  selector: 'app-ambient-mode',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './ambient-mode.component.html',
  styleUrl: './ambient-mode.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AmbientModeComponent implements OnInit, OnDestroy {
  private readonly dashboardService = inject(DashboardService);
  private readonly language = inject(LanguageService);

  readonly exit = output<void>();

  protected readonly data = signal<DashboardData | null>(null);
  protected readonly currentTime = signal(new Date());

  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private clockInterval: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.loadData();
    this.refreshInterval = setInterval(() => this.loadData(), 60000);
    this.clockInterval = setInterval(() => this.currentTime.set(new Date()), 1000);

    document.addEventListener('keydown', this.onKeydown);
    document.addEventListener('click', this.onClick);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    if (this.clockInterval) clearInterval(this.clockInterval);
    document.removeEventListener('keydown', this.onKeydown);
    document.removeEventListener('click', this.onClick);
  }

  private loadData(): void {
    this.dashboardService.getDashboard().subscribe({
      next: (data) => this.data.set(data),
    });
  }

  private readonly onKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.exit.emit();
  };

  private readonly onClick = (): void => {
    this.exit.emit();
  };

  protected formatTime(d: Date): string {
    return d.toLocaleTimeString(this.language.intlLocale(), {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  }

  protected formatDate(d: Date): string {
    return d.toLocaleDateString(this.language.intlLocale(), { weekday: 'long', month: 'long', day: 'numeric' });
  }
}
