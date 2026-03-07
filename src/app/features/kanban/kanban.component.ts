import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { BoardColumnComponent } from './components/board-column.component';
import { KanbanService } from './services/kanban.service';
import { BoardColumn, KanbanJob, TrackType } from './models/kanban.model';

@Component({
  selector: 'app-kanban',
  standalone: true,
  imports: [BoardColumnComponent],
  templateUrl: './kanban.component.html',
  styleUrl: './kanban.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KanbanComponent implements OnInit {
  private readonly kanbanService = inject(KanbanService);

  protected readonly trackTypes = signal<TrackType[]>([]);
  protected readonly selectedTrackTypeId = signal<number | null>(null);
  protected readonly columns = signal<BoardColumn[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly dropListIds = computed(
    () => this.columns().map((_, i) => 'column-' + i),
  );

  ngOnInit(): void {
    this.kanbanService.getTrackTypes().subscribe({
      next: (types) => {
        this.trackTypes.set(types);
        const defaultType = types.find(t => t.isDefault) ?? types[0];
        if (defaultType) {
          this.selectTrackType(defaultType.id);
        } else {
          this.loading.set(false);
        }
      },
      error: () => {
        this.error.set('Failed to load track types');
        this.loading.set(false);
      },
    });
  }

  protected selectTrackType(trackTypeId: number): void {
    this.selectedTrackTypeId.set(trackTypeId);
    this.loading.set(true);
    this.error.set(null);

    this.kanbanService.getBoard(trackTypeId).subscribe({
      next: (columns) => {
        this.columns.set(columns);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load board data');
        this.loading.set(false);
      },
    });
  }

  protected onCardDropped(event: CdkDragDrop<KanbanJob[]>): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      event.container.data.forEach((job, index) => {
        this.kanbanService.updateJobPosition(job.id, index).subscribe();
      });
    } else {
      const job = event.previousContainer.data[event.previousIndex];
      const targetColumnIndex = this.dropListIds().indexOf(event.container.id);
      const targetStage = this.columns()[targetColumnIndex]?.stage;

      if (!targetStage || targetStage.isIrreversible) return;

      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );

      this.kanbanService.moveJobStage(job.id, targetStage.id).subscribe({
        error: () => {
          transferArrayItem(
            event.container.data,
            event.previousContainer.data,
            event.currentIndex,
            event.previousIndex,
          );
        },
      });

      event.container.data.forEach((j, index) => {
        this.kanbanService.updateJobPosition(j.id, index).subscribe();
      });
    }
  }
}
