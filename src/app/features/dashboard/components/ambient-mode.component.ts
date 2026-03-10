import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, output, signal } from '@angular/core';
import { DashboardService } from '../services/dashboard.service';
import { DashboardData } from '../models/dashboard-data.model';

@Component({
  selector: 'app-ambient-mode',
  standalone: true,
  templateUrl: './ambient-mode.component.html',
  styleUrl: './ambient-mode.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AmbientModeComponent implements OnInit, OnDestroy {
  private readonly dashboardService = inject(DashboardService);

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
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  protected formatDate(d: Date): string {
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }
}
