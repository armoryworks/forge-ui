import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CdkDropList, CdkDrag, CdkDragDrop } from '@angular/cdk/drag-drop';
import { JobCardComponent } from './job-card.component';
import { BoardColumn, KanbanJob } from '../models/kanban.model';

@Component({
  selector: 'app-board-column',
  standalone: true,
  imports: [CdkDropList, CdkDrag, JobCardComponent],
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
  readonly cardClicked = output<{ job: KanbanJob; event: MouseEvent }>();

  protected readonly jobCount = computed(() => this.column().jobs.length);
  protected readonly wipLimit = computed(() => this.column().stage.wipLimit);
  protected readonly isOverWip = computed(() => {
    const limit = this.wipLimit();
    return limit !== null && this.jobCount() >= limit;
  });

  protected onDrop(event: CdkDragDrop<KanbanJob[]>): void {
    this.dropped.emit(event);
  }

  protected canEnter = (drag: CdkDrag, drop: CdkDropList): boolean => {
    if (!this.column().stage.isIrreversible) return true;
    return drag.dropContainer === drop;
  };
}
