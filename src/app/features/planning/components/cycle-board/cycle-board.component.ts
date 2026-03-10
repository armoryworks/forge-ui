import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { CdkDropList, CdkDrag, CdkDragDrop } from '@angular/cdk/drag-drop';

import { PlanningCycleDetail } from '../../models/planning-cycle-detail.model';
import { PlanningCycleEntry } from '../../models/planning-cycle-entry.model';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-cycle-board',
  standalone: true,
  imports: [CdkDropList, CdkDrag, EmptyStateComponent],
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

  protected readonly daysRemaining = computed(() => {
    const end = new Date(this.cycle().endDate);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  });

  protected readonly isActive = computed(() => this.cycle().status === 'Active');

  protected formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric',
    });
  }

  protected getPriorityClass(priority: string): string {
    const map: Record<string, string> = {
      Urgent: 'entry__priority--urgent',
      High: 'entry__priority--high',
      Normal: 'entry__priority--normal',
      Low: 'entry__priority--low',
    };
    return map[priority] ?? '';
  }

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
