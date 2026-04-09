import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { map } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { CdkDragDrop, CdkDragStart, CdkDropList, CdkDrag, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { MatDialog } from '@angular/material/dialog';
import { DetailDialogService } from '../../shared/services/detail-dialog.service';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BoardColumnComponent } from './components/board-column.component';
import { JobDetailDialogComponent, JobDetailDialogData, JobDetailDialogResult } from './components/job-detail-dialog.component';
import { JobDialogComponent, DialogMode } from './components/job-dialog.component';
import { JobCardComponent } from './components/job-card.component';
import { KanbanService } from './services/kanban.service';
import { BoardColumn } from './models/board-column.model';
import { JobDetail } from './models/job-detail.model';
import { KanbanJob } from './models/kanban-job.model';
import { SwimlaneRow } from './models/swimlane-row.model';
import { PRIORITIES } from '../../shared/models/priority.const';
import { UserRef } from './models/user-ref.model';
import { Stage } from '../../shared/models/stage.model';
import { TrackType } from '../../shared/models/track-type.model';
import { SelectOption } from '../../shared/components/select/select.component';
import { SelectComponent } from '../../shared/components/select/select.component';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { BoardHubService } from '../../shared/services/board-hub.service';
import { LoadingService } from '../../shared/services/loading.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { ScannerService } from '../../shared/services/scanner.service';
import { UserPreferencesService } from '../../shared/services/user-preferences.service';
import { AuthService } from '../../shared/services/auth.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

export type ViewMode = 'board' | 'team';

@Component({
  selector: 'app-kanban',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    BoardColumnComponent, JobDialogComponent, JobCardComponent,
    PageHeaderComponent, MatMenuModule, MatTooltipModule,
    CdkDropList, CdkDrag,
    SelectComponent, AvatarComponent,
    TranslatePipe,
  ],
  templateUrl: './kanban.component.html',
  styleUrl: './kanban.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KanbanComponent implements OnInit, OnDestroy {
  private readonly kanbanService = inject(KanbanService);
  private readonly boardHub = inject(BoardHubService);
  private readonly loadingService = inject(LoadingService);
  private readonly snackbar = inject(SnackbarService);
  private readonly scanner = inject(ScannerService);
  private readonly dialog = inject(MatDialog);
  private readonly detailDialog = inject(DetailDialogService);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly userPreferences = inject(UserPreferencesService);

  protected readonly trackTypes = signal<TrackType[]>([]);
  protected readonly selectedTrackTypeId = signal<number | null>(null);
  protected readonly columns = signal<BoardColumn[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly showJobDialog = signal(false);
  protected readonly dialogMode = signal<DialogMode>('create');
  protected readonly dialogJob = signal<JobDetail | null>(null);

  private swimlaneDragging = false;
  protected readonly selectedJobIds = signal<Set<number>>(new Set());
  protected readonly selectionCount = computed(() => this.selectedJobIds().size);
  protected readonly users = signal<UserRef[]>([]);
  protected readonly priorityOptions = PRIORITIES;

  // ── My Work Filter ──
  protected readonly myWorkOnly = toSignal(
    this.route.queryParamMap.pipe(map(p => p.get('myWork') === 'true')),
    { initialValue: this.userPreferences.get<boolean>('kanban:myWorkOnly') ?? false },
  );

  protected toggleMyWork(): void {
    const next = !this.myWorkOnly();
    this.router.navigate([], {
      queryParams: { myWork: next ? 'true' : null },
      queryParamsHandling: 'merge',
    });
    this.userPreferences.set('kanban:myWorkOnly', next);
  }

  // ── View Mode ──
  protected readonly viewMode = signal<ViewMode>('board');
  protected readonly teamUserIds = new FormControl<number[]>([]);
  private readonly teamUserIdsSignal = toSignal(this.teamUserIds.valueChanges, { initialValue: [] as number[] });

  protected readonly userOptions = computed<SelectOption[]>(() =>
    this.users().map(u => ({ value: u.id, label: u.name })),
  );

  // Columns filtered by selected team members and/or My Work toggle (applies to board view)
  protected readonly filteredColumns = computed<BoardColumn[]>(() => {
    const cols = this.columns();
    const selectedIds = this.teamUserIdsSignal() ?? [];
    const myWork = this.myWorkOnly();
    const currentUserId = this.authService.user()?.id;

    if (selectedIds.length === 0 && !myWork) return cols;

    return cols.map(col => ({
      ...col,
      jobs: col.jobs.filter(j => {
        const matchesTeam = selectedIds.length === 0 || (j.assigneeId != null && selectedIds.includes(j.assigneeId));
        const matchesMyWork = !myWork || (currentUserId != null && j.assigneeId === currentUserId);
        return matchesTeam && matchesMyWork;
      }),
    }));
  });

  protected readonly currentStages = computed(() =>
    this.columns().map(c => c.stage),
  );

  protected readonly dropListIds = computed(
    () => this.columns().map((_, i) => 'column-' + i),
  );

  // ── Swimlane Data ──
  protected readonly swimlaneRows = computed<SwimlaneRow[]>(() => {
    const cols = this.columns();
    const allJobs = cols.flatMap(c => c.jobs);
    const selectedIds = this.teamUserIdsSignal() ?? [];
    const allUsers = this.users();

    // Determine which users to show as rows
    let rowUsers: UserRef[];
    if (selectedIds.length > 0) {
      rowUsers = selectedIds
        .map(id => allUsers.find(u => u.id === id))
        .filter((u): u is UserRef => !!u);
    } else {
      // Auto: show users who have assigned jobs
      const assignedUserIds = new Set(allJobs.filter(j => j.assigneeId).map(j => j.assigneeId!));
      rowUsers = allUsers.filter(u => assignedUserIds.has(u.id));
    }

    const rows: SwimlaneRow[] = rowUsers.map(user => ({
      user,
      cells: cols.map(col => ({
        jobs: col.jobs.filter(j => j.assigneeId === user.id),
      })),
    }));

    // Unassigned row
    const hasUnassigned = allJobs.some(j => !j.assigneeId);
    const showUnassigned = selectedIds.length === 0 || hasUnassigned;
    if (showUnassigned) {
      rows.push({
        user: null,
        cells: cols.map(col => ({
          jobs: col.jobs.filter(j => !j.assigneeId),
        })),
      });
    }

    return rows;
  });

  protected readonly swimlaneDropListIds = computed<string[]>(() => {
    const rows = this.swimlaneRows();
    const stages = this.currentStages();
    const ids: string[] = [];
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < stages.length; c++) {
        ids.push(`swim-${r}-${c}`);
      }
    }
    return ids;
  });

  protected swimlaneCellId(rowIdx: number, colIdx: number): string {
    return `swim-${rowIdx}-${colIdx}`;
  }

  private readonly scanEffect = effect(() => {
    const scan = this.scanner.lastScan();
    if (!scan || scan.context !== 'kanban') return;
    this.scanner.clearLastScan();
    const job = this.columns()
      .flatMap(c => c.jobs)
      .find(j => j.jobNumber.toLowerCase() === scan.value.toLowerCase());
    if (job) {
      this.openJobDetail(job.id);
      this.snackbar.success(this.translate.instant('kanban.foundJob', { number: job.jobNumber }));
    } else {
      this.snackbar.error(this.translate.instant('kanban.jobNotFound', { value: scan.value }));
    }
  });

  ngOnInit(): void {
    this.scanner.setContext('kanban');
    this.loadingService.track('Loading board...', this.kanbanService.getTrackTypes())
      .subscribe({
        next: (types) => {
          this.trackTypes.set(types);
          const defaultType = types.find(t => t.isDefault) ?? types[0];
          if (defaultType) {
            this.selectTrackType(defaultType.id);
          }
          // Open job detail if navigated with ?detail=job:id (shared link, bookmark, notification)
          const detail = this.detailDialog.getDetailFromUrl();
          if (detail?.entityType === 'job') {
            this.openJobDetail(detail.entityId);
          }
        },
        error: () => this.error.set(this.translate.instant('kanban.loadTrackTypesFailed')),
      });

    this.initBoardHub();
    this.kanbanService.getUsers().subscribe(u => this.users.set(u));
  }

  ngOnDestroy(): void {
    this.boardHub.disconnect();
  }

  protected setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  protected selectTrackType(trackTypeId: number): void {
    this.selectedTrackTypeId.set(trackTypeId);
    this.error.set(null);

    this.boardHub.joinBoard(trackTypeId);

    this.loadingService.track('Loading board...', this.kanbanService.getBoard(trackTypeId))
      .subscribe({
        next: (columns) => this.columns.set(columns),
        error: () => this.error.set(this.translate.instant('kanban.loadBoardFailed')),
      });
  }

  private async initBoardHub(): Promise<void> {
    await this.boardHub.connect();

    const reloadBoard = () => {
      const trackTypeId = this.selectedTrackTypeId();
      if (trackTypeId) this.reloadBoard();
    };

    this.boardHub.onJobCreatedEvent(reloadBoard);
    this.boardHub.onJobMovedEvent(reloadBoard);
    this.boardHub.onJobUpdatedEvent(reloadBoard);
    this.boardHub.onJobPositionChangedEvent(reloadBoard);
  }

  protected onSwimlaneDragStarted(_event: CdkDragStart): void {
    this.swimlaneDragging = true;
  }

  protected onJobNumberClicked(event: { job: KanbanJob; event: Event }): void {
    if (this.swimlaneDragging) return;
    this.openJobDetail(event.job.id);
  }

  protected onCardClicked(event: { job: KanbanJob; event: Event }): void {
    if (this.swimlaneDragging) return;
    const e = event.event as MouseEvent | KeyboardEvent;
    if (e.ctrlKey || e.metaKey) {
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

    this.openJobDetail(event.job.id);
  }

  protected clearSelection(): void {
    this.selectedJobIds.set(new Set());
  }

  protected openJobDetail(jobId: number): void {
    this.detailDialog.open<JobDetailDialogComponent, JobDetailDialogData, JobDetailDialogResult | undefined>(
      'job', jobId, JobDetailDialogComponent,
      { jobId, users: this.users() },
    ).afterClosed().subscribe(result => {
      if (result?.action === 'edit') {
        this.openEditDialog(result.job);
      }
    });
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
    this.reloadBoard();
  }

  protected onDialogCancelled(): void {
    this.showJobDialog.set(false);
  }

  protected bulkMoveToStage(stage: Stage): void {
    const ids = [...this.selectedJobIds()];
    this.kanbanService.bulkMoveStage(ids, stage.id).subscribe({
      next: (r) => {
        this.snackbar.success(this.translate.instant('kanban.jobsMoved', { count: r.successCount, stage: stage.name }));
        this.clearSelection();
        this.reloadBoard();
      },
      error: () => this.snackbar.error(this.translate.instant('kanban.moveJobsFailed')),
    });
  }

  protected bulkAssign(user: UserRef | null): void {
    const ids = [...this.selectedJobIds()];
    this.kanbanService.bulkAssign(ids, user?.id ?? null).subscribe({
      next: (r) => {
        const label = user ? user.name : 'Unassigned';
        this.snackbar.success(this.translate.instant('kanban.jobsAssigned', { count: r.successCount, label: label }));
        this.clearSelection();
        this.reloadBoard();
      },
      error: () => this.snackbar.error(this.translate.instant('kanban.assignJobsFailed')),
    });
  }

  protected bulkSetPriority(priority: string): void {
    const ids = [...this.selectedJobIds()];
    this.kanbanService.bulkSetPriority(ids, priority).subscribe({
      next: (r) => {
        this.snackbar.success(this.translate.instant('kanban.prioritySet', { priority: priority, count: r.successCount }));
        this.clearSelection();
        this.reloadBoard();
      },
      error: () => this.snackbar.error(this.translate.instant('kanban.setPriorityFailed')),
    });
  }

  protected bulkArchive(): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('kanban.archiveJobsTitle'),
        message: this.translate.instant('kanban.archiveJobsMessage', { count: this.selectionCount() }),
        confirmLabel: this.translate.instant('kanban.archive'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      const ids = [...this.selectedJobIds()];
      this.kanbanService.bulkArchive(ids).subscribe({
        next: (r) => {
          this.snackbar.success(this.translate.instant('kanban.jobsArchived', { count: r.successCount }));
          this.clearSelection();
          this.reloadBoard();
        },
        error: () => this.snackbar.error(this.translate.instant('kanban.archiveJobsFailed')),
      });
    });
  }

  private reloadBoard(): void {
    const trackTypeId = this.selectedTrackTypeId();
    if (!trackTypeId) return;
    this.kanbanService.getBoard(trackTypeId).subscribe({
      next: (columns) => this.columns.set(columns),
    });
  }

  // ── Board View Drop ──
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

  // ── Swimlane Drop Handler ──
  protected onSwimlaneDropped(event: CdkDragDrop<KanbanJob[]>, rowIdx: number, colIdx: number): void {
    setTimeout(() => { this.swimlaneDragging = false; });
    const job = event.item.data as KanbanJob;
    const rows = this.swimlaneRows();
    const targetRow = rows[rowIdx];
    const targetStage = this.currentStages()[colIdx];

    if (!targetStage) return;

    const stageChanged = job.stageName !== targetStage.name;
    const targetUserId = targetRow.user?.id ?? null;
    const assigneeChanged = job.assigneeId !== targetUserId;

    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }

    if (targetStage.isIrreversible && stageChanged) return;

    // Optimistic move
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex,
    );

    if (stageChanged) {
      this.kanbanService.moveJobStage(job.id, targetStage.id).subscribe({
        error: () => this.reloadBoard(),
      });
    }

    if (assigneeChanged) {
      this.kanbanService.updateJob(job.id, { assigneeId: targetUserId }).subscribe({
        error: () => this.reloadBoard(),
      });
    }
  }

  protected swimlaneCanEnter = (): boolean => true;
}
