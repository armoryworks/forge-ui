import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { TranslatePipe } from '@ngx-translate/core';

import { PlanningService } from '../../planning/services/planning.service';
import { PlanningCycleDetail } from '../../planning/models/planning-cycle-detail.model';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';

@Component({
  selector: 'app-cycle-progress-widget',
  standalone: true,
  imports: [RouterLink, TranslatePipe, EmptyStateComponent, LoadingBlockDirective],
  templateUrl: './cycle-progress-widget.component.html',
  styleUrl: './cycle-progress-widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CycleProgressWidgetComponent implements OnInit {
  private readonly planningService = inject(PlanningService);
  private readonly router = inject(Router);

  protected readonly cycle = signal<PlanningCycleDetail | null>(null);
  protected readonly loading = signal(true);

  protected readonly totalEntries = computed(() => this.cycle()?.entries.length ?? 0);
  protected readonly completedEntries = computed(() =>
    this.cycle()?.entries.filter(e => e.completedAt !== null).length ?? 0
  );
  protected readonly progressPercent = computed(() => {
    const total = this.totalEntries();
    return total > 0 ? Math.round((this.completedEntries() / total) * 100) : 0;
  });

  protected readonly daysRemaining = computed(() => {
    const c = this.cycle();
    if (!c) return 0;
    const end = new Date(c.endDate);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  });

  protected readonly isOverdue = computed(() => {
    const c = this.cycle();
    if (!c) return false;
    return new Date(c.endDate) < new Date();
  });

  protected navigatePlanning(): void {
    this.router.navigate(['/planning']);
  }

  ngOnInit(): void {
    this.planningService.getCurrentCycle().subscribe({
      next: (cycle) => {
        this.cycle.set(cycle);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
