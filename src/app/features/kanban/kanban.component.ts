import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { BoardColumnComponent } from './components/board-column.component';
import { JobDetailPanelComponent } from './components/job-detail-panel.component';
import { JobDialogComponent, DialogMode } from './components/job-dialog.component';
import { KanbanService } from './services/kanban.service';
import { BoardColumn, JobDetail, KanbanJob, TrackType } from './models/kanban.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { BoardHubService } from '../../shared/services/board-hub.service';

@Component({
  selector: 'app-kanban',
  standalone: true,
  imports: [BoardColumnComponent, JobDetailPanelComponent, JobDialogComponent, PageHeaderComponent],
  templateUrl: './kanban.component.html',
  styleUrl: './kanban.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KanbanComponent implements OnInit, OnDestroy {
  private readonly kanbanService = inject(KanbanService);
  private readonly boardHub = inject(BoardHubService);

  protected readonly trackTypes = signal<TrackType[]>([]);
  protected readonly selectedTrackTypeId = signal<number | null>(null);
  protected readonly columns = signal<BoardColumn[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly selectedJobId = signal<number | null>(null);
  protected readonly showJobDialog = signal(false);
  protected readonly dialogMode = signal<DialogMode>('create');
  protected readonly dialogJob = signal<JobDetail | null>(null);

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

    this.initBoardHub();
  }

  ngOnDestroy(): void {
    this.boardHub.disconnect();
  }

  protected selectTrackType(trackTypeId: number): void {
    this.selectedTrackTypeId.set(trackTypeId);
    this.loading.set(true);
    this.error.set(null);

    this.boardHub.joinBoard(trackTypeId);

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

  private async initBoardHub(): Promise<void> {
    await this.boardHub.connect();

    const reloadBoard = () => {
      const trackTypeId = this.selectedTrackTypeId();
      if (trackTypeId) this.selectTrackType(trackTypeId);
    };

    this.boardHub.onJobCreatedEvent(reloadBoard);
    this.boardHub.onJobMovedEvent(reloadBoard);
    this.boardHub.onJobUpdatedEvent(reloadBoard);
    this.boardHub.onJobPositionChangedEvent(reloadBoard);
  }

  protected onCardClicked(job: KanbanJob): void {
    this.selectedJobId.set(job.id);
  }

  protected onPanelClose(): void {
    this.selectedJobId.set(null);
  }

  protected openCreateDialog(): void {
    this.dialogMode.set('create');
    this.dialogJob.set(null);
    this.showJobDialog.set(true);
  }

  protected openEditDialog(job: JobDetail): void {
    this.dialogMode.set('edit');
    this.dialogJob.set(job);
    this.showJobDialog.set(true);
  }

  protected onDialogSaved(): void {
    this.showJobDialog.set(false);
    this.selectedJobId.set(null);
    const currentTrackTypeId = this.selectedTrackTypeId();
    if (currentTrackTypeId) {
      this.selectTrackType(currentTrackTypeId);
    }
  }

  protected onDialogCancelled(): void {
    this.showJobDialog.set(false);
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
