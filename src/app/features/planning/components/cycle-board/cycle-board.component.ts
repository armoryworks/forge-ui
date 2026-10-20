import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { interval, map, startWith } from 'rxjs';

import { CdkDropList, CdkDrag, CdkDragDrop } from '@angular/cdk/drag-drop';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';

import { PlanningCycleDetail } from '../../models/planning-cycle-detail.model';
import { PlanningCycleEntry } from '../../models/planning-cycle-entry.model';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { PriorityIndicatorComponent } from '../../../../shared/components/priority-indicator/priority-indicator.component';
import { daysUntil, parseDateOnly, toDateOnly } from '../../../../shared/utils/date.utils';

@Component({
  selector: 'app-cycle-board',
  standalone: true,
  imports: [DatePipe, CdkDropList, CdkDrag, MatTooltipModule, TranslatePipe, EmptyStateComponent, PriorityIndicatorComponent],
  templateUrl: './cycle-board.component.html',
  styleUrl: './cycle-board.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CycleBoardComponent {
  readonly cycle = input.required<PlanningCycleDetail>();
  readonly loading = input(false);

  readonly entryCompleted = output<PlanningCycleEntry>();
  readonly entryRemoved = output<PlanningCycleEntry>();
  readonly entryReordered = output<CdkDragDrop<PlanningCycleEntry[]>>();

  protected readonly totalEntries = computed(() => this.cycle().entries.length);
  protected readonly completedEntries = computed(() => this.cycle().entries.filter(e => e.completedAt !== null).length);

  protected readonly progressPercent = computed(() => {
    const total = this.totalEntries();
    if (total === 0) return 0;
    return Math.round((this.completedEntries() / total) * 100);
  });

  protected readonly sortedEntries = computed(() =>
    [...this.cycle().entries].sort((a, b) => a.sortOrder - b.sortOrder),
  );

  private readonly today = toSignal(
    interval(60_000).pipe(startWith(0), map(() => toDateOnly(new Date()) ?? '')),
    { initialValue: toDateOnly(new Date()) ?? '' },
  );

  protected readonly daysRemaining = computed(() => {
    const today = parseDateOnly(this.today()) ?? new Date();
    return Math.max(0, daysUntil(this.cycle().endDate, today));
  });

  protected readonly isActive = computed(() => this.cycle().status === 'Active');

  protected onDrop(event: CdkDragDrop<PlanningCycleEntry[]>): void {
    this.entryReordered.emit(event);
  }

  protected onComplete(entry: PlanningCycleEntry, event: MouseEvent): void {
    event.stopPropagation();
    this.entryCompleted.emit(entry);
  }

  protected onRemove(entry: PlanningCycleEntry, event: MouseEvent): void {
    event.stopPropagation();
    this.entryRemoved.emit(entry);
  }
}
