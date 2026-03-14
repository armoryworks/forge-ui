import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CdkDropList, CdkDrag, CdkDragDrop, CdkDragStart } from '@angular/cdk/drag-drop';
import { JobCardComponent } from './job-card.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { BoardColumn } from '../models/board-column.model';
import { KanbanJob } from '../models/kanban-job.model';

@Component({
  selector: 'app-board-column',
  standalone: true,
  imports: [CdkDropList, CdkDrag, JobCardComponent, EmptyStateComponent],
  templateUrl: './board-column.component.html',
  styleUrl: './board-column.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardColumnComponent {
  readonly column = input.required<BoardColumn>();
  readonly allDropListIds = input.required<string[]>();
  readonly dropListId = input.required<string>();

  readonly selectedJobIds = input<Set<number>>(new Set());

  readonly dropped = output<CdkDragDrop<KanbanJob[]>>();
  readonly cardClicked = output<{ job: KanbanJob; event: Event }>();
  readonly jobNumberClicked = output<{ job: KanbanJob; event: Event }>();

  private dragging = false;

  protected readonly jobCount = computed(() => this.column().jobs.length);
  protected readonly wipLimit = computed(() => this.column().stage.wipLimit);
  protected readonly isOverWip = computed(() => {
    const limit = this.wipLimit();
    return limit !== null && this.jobCount() >= limit;
  });

  protected onDragStarted(_event: CdkDragStart): void {
    this.dragging = true;
  }

  protected onDrop(event: CdkDragDrop<KanbanJob[]>): void {
    this.dropped.emit(event);
    // Reset drag flag after the click event has had a chance to fire
    setTimeout(() => { this.dragging = false; });
  }

  protected onCardClicked(event: { job: KanbanJob; event: Event }): void {
    if (this.dragging) return;
    this.cardClicked.emit(event);
  }

  protected onJobNumberClicked(event: { job: KanbanJob; event: Event }): void {
    if (this.dragging) return;
    this.jobNumberClicked.emit(event);
  }

  protected canEnter = (drag: CdkDrag, drop: CdkDropList): boolean => {
    if (!this.column().stage.isIrreversible) return true;
    return drag.dropContainer === drop;
  };
}
