import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { BoardColumnComponent } from './components/board-column.component';
import { JobDetailPanelComponent } from './components/job-detail-panel.component';
import { JobDialogComponent, DialogMode } from './components/job-dialog.component';
import { KanbanService } from './services/kanban.service';
import { BoardColumn } from './models/board-column.model';
import { JobDetail } from './models/job-detail.model';
import { KanbanJob } from './models/kanban-job.model';
import { PRIORITY_OPTIONS } from './models/priority-options.const';
import { UserRef } from './models/user-ref.model';
import { Stage } from '../../shared/models/stage.model';
import { TrackType } from '../../shared/models/track-type.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { BoardHubService } from '../../shared/services/board-hub.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-kanban',
  standalone: true,
  imports: [BoardColumnComponent, JobDetailPanelComponent, JobDialogComponent, PageHeaderComponent, MatMenuModule],
  templateUrl: './kanban.component.html',
  styleUrl: './kanban.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KanbanComponent implements OnInit, OnDestroy {
  private readonly kanbanService = inject(KanbanService);
  private readonly boardHub = inject(BoardHubService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);

  protected readonly trackTypes = signal<TrackType[]>([]);
  protected readonly selectedTrackTypeId = signal<number | null>(null);
  protected readonly columns = signal<BoardColumn[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly selectedJobId = signal<number | null>(null);
  protected readonly showJobDialog = signal(false);
  protected readonly dialogMode = signal<DialogMode>('create');
  protected readonly dialogJob = signal<JobDetail | null>(null);

  protected readonly selectedJobIds = signal<Set<number>>(new Set());
  protected readonly selectionCount = computed(() => this.selectedJobIds().size);
  protected readonly users = signal<UserRef[]>([]);
  protected readonly priorityOptions = PRIORITY_OPTIONS;

  protected readonly currentStages = computed(() =>
    this.columns().map(c => c.stage),
  );

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
    this.kanbanService.getUsers().subscribe(u => this.users.set(u));
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

  protected onCardClicked(event: { job: KanbanJob; event: MouseEvent }): void {
    if (event.event.ctrlKey || event.event.metaKey) {
      const current = this.selectedJobIds();
      const next = new Set(current);
      if (next.has(event.job.id)) {
        next.delete(event.job.id);
      } else {
        next.add(event.job.id);
      }
      this.selectedJobIds.set(next);
      return;
    }

    if (this.selectionCount() > 0) {
      this.clearSelection();
      return;
    }

    this.selectedJobId.set(event.job.id);
  }

  protected clearSelection(): void {
    this.selectedJobIds.set(new Set());
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

  protected bulkMoveToStage(stage: Stage): void {
    const ids = [...this.selectedJobIds()];
    this.kanbanService.bulkMoveStage(ids, stage.id).subscribe({
      next: (r) => {
        this.snackbar.success(`Moved ${r.successCount} job(s) to ${stage.name}`);
        this.clearSelection();
        this.reloadBoard();
      },
      error: () => this.snackbar.error('Failed to move jobs'),
    });
  }

  protected bulkAssign(user: UserRef | null): void {
    const ids = [...this.selectedJobIds()];
    this.kanbanService.bulkAssign(ids, user?.id ?? null).subscribe({
      next: (r) => {
        const label = user ? user.name : 'Unassigned';
        this.snackbar.success(`Assigned ${r.successCount} job(s) to ${label}`);
        this.clearSelection();
        this.reloadBoard();
      },
      error: () => this.snackbar.error('Failed to assign jobs'),
    });
  }

  protected bulkSetPriority(priority: string): void {
    const ids = [...this.selectedJobIds()];
    this.kanbanService.bulkSetPriority(ids, priority).subscribe({
      next: (r) => {
        this.snackbar.success(`Set priority to ${priority} on ${r.successCount} job(s)`);
        this.clearSelection();
        this.reloadBoard();
      },
      error: () => this.snackbar.error('Failed to set priority'),
    });
  }

  protected bulkArchive(): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Archive Jobs?',
        message: `This will archive ${this.selectionCount()} selected job(s). You can restore them later.`,
        confirmLabel: 'Archive',
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      const ids = [...this.selectedJobIds()];
      this.kanbanService.bulkArchive(ids).subscribe({
        next: (r) => {
          this.snackbar.success(`Archived ${r.successCount} job(s)`);
          this.clearSelection();
          this.reloadBoard();
        },
        error: () => this.snackbar.error('Failed to archive jobs'),
      });
    });
  }

  private reloadBoard(): void {
    const trackTypeId = this.selectedTrackTypeId();
    if (trackTypeId) this.selectTrackType(trackTypeId);
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
