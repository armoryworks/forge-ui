import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged, map, skip, Subscription, switchMap } from 'rxjs';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
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
import { KanbanBoard } from './models/kanban-board.model';
import { BoardFilters } from './models/board-filters.model';
import { CustomerRef } from './models/customer-ref.model';
import { JobDetail } from './models/job-detail.model';
import { KanbanJob } from './models/kanban-job.model';
import { SwimlaneRow } from './models/swimlane-row.model';
import { PRIORITIES } from '../../shared/models/priority.const';
import { UserRef } from './models/user-ref.model';
import { Stage } from '../../shared/models/stage.model';
import { TrackType } from '../../shared/models/track-type.model';
import { TeamRef } from '../../shared/models/team-ref.model';
import { SelectOption } from '../../shared/components/select/select.component';
import { SelectComponent } from '../../shared/components/select/select.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { CapDirective } from '../../shared/directives/cap.directive';
import { BoardHubService } from '../../shared/services/board-hub.service';
import { LoadingService } from '../../shared/services/loading.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { ToastService } from '../../shared/services/toast.service';
import { ScannerService } from '../../shared/services/scanner.service';
import { DraftResumeService } from '../../shared/services/draft-resume.service';
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
    SelectComponent, InputComponent, AvatarComponent,
    CapDirective,
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
  private readonly toast = inject(ToastService);
  private readonly scanner = inject(ScannerService);
  private readonly dialog = inject(MatDialog);
  private readonly detailDialog = inject(DetailDialogService);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly userPreferences = inject(UserPreferencesService);
  private readonly draftResume = inject(DraftResumeService);

  protected readonly trackTypes = signal<TrackType[]>([]);
  protected readonly selectedTrackTypeId = signal<number | null>(null);
  protected readonly columns = signal<BoardColumn[]>([]);
  protected readonly boardTotalCount = signal(0);
  protected readonly boardLoadedCount = signal(0);
  protected readonly boardTruncated = computed(() => this.boardTotalCount() > this.boardLoadedCount());
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

  protected readonly teams = signal<TeamRef[]>([]);
  protected readonly teamFilterOptions = computed<SelectOption[]>(() => [
    { value: null, label: this.translate.instant('kanban.allTeams') },
    ...this.teams().map(t => ({ value: t.id, label: t.name })),
  ]);
  private readonly teamFilterId$ = this.route.queryParamMap.pipe(
    map(p => KanbanComponent.parseTeamId(p.get('team'))),
    distinctUntilChanged(),
  );
  protected readonly teamFilterId = toSignal(this.teamFilterId$, {
    initialValue: KanbanComponent.parseTeamId(this.route.snapshot.queryParamMap.get('team')),
  });
  protected readonly teamFilter = new FormControl<number | null>(this.teamFilterId());

  private static parseTeamId(raw: string | null): number | null {
    const id = Number(raw);
    return raw && Number.isInteger(id) && id > 0 ? id : null;
  }

  private readonly teamFilterFromUrl = this.teamFilterId$.pipe(skip(1), takeUntilDestroyed()).subscribe(id => {
    this.teamFilter.setValue(id, { emitEvent: false });
    this.reloadBoard();
  });

  private readonly teamFilterToUrl = this.teamFilter.valueChanges.pipe(takeUntilDestroyed()).subscribe(id => {
    this.router.navigate([], {
      queryParams: { team: id ?? null },
      queryParamsHandling: 'merge',
    });
  });

  protected readonly activeOnly = signal(this.userPreferences.get<boolean>('kanban:activeOnly') ?? true);

  protected toggleActiveOnly(): void {
    const next = !this.activeOnly();
    this.activeOnly.set(next);
    this.userPreferences.set('kanban:activeOnly', next);
    this.reloadBoard();
  }

  private static readFilters(params: ParamMap): Omit<BoardFilters, 'activeOnly' | 'teamId'> {
    const customerId = Number(params.get('customer'));
    return {
      search: params.get('q')?.trim() ?? '',
      customerId: Number.isInteger(customerId) && customerId > 0 ? customerId : null,
      overdueOnly: params.get('overdue') === 'true',
      onHoldOnly: params.get('onHold') === 'true',
    };
  }

  private static sameFilters(a: Omit<BoardFilters, 'activeOnly' | 'teamId'>, b: Omit<BoardFilters, 'activeOnly' | 'teamId'>): boolean {
    return a.search === b.search && a.customerId === b.customerId
      && a.overdueOnly === b.overdueOnly && a.onHoldOnly === b.onHoldOnly;
  }

  private readonly urlFilters$ = this.route.queryParamMap.pipe(
    map(p => KanbanComponent.readFilters(p)),
    distinctUntilChanged(KanbanComponent.sameFilters),
  );
  private readonly urlFilters = toSignal(this.urlFilters$, {
    initialValue: KanbanComponent.readFilters(this.route.snapshot.queryParamMap),
  });
  protected readonly overdueOnly = computed(() => this.urlFilters().overdueOnly);
  protected readonly onHoldOnly = computed(() => this.urlFilters().onHoldOnly);

  protected readonly searchControl = new FormControl(this.urlFilters().search, { nonNullable: true });
  protected readonly customerFilter = new FormControl<number | null>(this.urlFilters().customerId);
  protected readonly customers = signal<CustomerRef[]>([]);
  protected readonly customerOptions = computed<SelectOption[]>(() => [
    { value: null, label: this.translate.instant('boardFilters.allCustomers') },
    ...this.customers().map(c => ({ value: c.id, label: c.name })),
  ]);

  private readonly filtersFromUrl = this.urlFilters$.pipe(skip(1), takeUntilDestroyed()).subscribe(f => {
    if (this.searchControl.value.trim() !== f.search) this.searchControl.setValue(f.search, { emitEvent: false });
    this.customerFilter.setValue(f.customerId, { emitEvent: false });
    this.reloadBoard();
  });

  private readonly searchToUrl = this.searchControl.valueChanges.pipe(
    debounceTime(300),
    map(v => v.trim()),
    distinctUntilChanged(),
    takeUntilDestroyed(),
  ).subscribe(q => this.setFilterParams({ q: q || null }));

  private readonly customerToUrl = this.customerFilter.valueChanges.pipe(takeUntilDestroyed())
    .subscribe(id => this.setFilterParams({ customer: id ?? null }));

  protected toggleOverdue(): void {
    this.setFilterParams({ overdue: this.overdueOnly() ? null : 'true' });
  }

  protected toggleOnHold(): void {
    this.setFilterParams({ onHold: this.onHoldOnly() ? null : 'true' });
  }

  private setFilterParams(queryParams: Record<string, string | number | null>): void {
    this.router.navigate([], { queryParams, queryParamsHandling: 'merge', replaceUrl: true });
  }

  private boardFilters(): BoardFilters {
    return { ...this.urlFilters(), teamId: this.teamFilterId(), activeOnly: this.activeOnly() };
  }

  private boardLoad: Subscription | null = null;

  private isActiveJob(job: KanbanJob): boolean {
    return !job.completedDate && !job.billingStatus && !job.disposition;
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
    const activeOnly = this.activeOnly();
    const currentUserId = this.authService.user()?.id;

    if (selectedIds.length === 0 && !myWork && !activeOnly) return cols;

    return cols.map(col => ({
      ...col,
      jobs: col.jobs.filter(j => {
        const matchesTeam = selectedIds.length === 0 || (j.assigneeId != null && selectedIds.includes(j.assigneeId));
        const matchesMyWork = !myWork || (currentUserId != null && j.assigneeId === currentUserId);
        const matchesActive = !activeOnly || this.isActiveJob(j);
        return matchesTeam && matchesMyWork && matchesActive;
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
    const activeOnly = this.activeOnly();
    const cols = activeOnly
      ? this.columns().map(col => ({ ...col, jobs: col.jobs.filter(j => this.isActiveJob(j)) }))
      : this.columns();
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

    // Pre-group jobs by assigneeId per column to avoid O(n*m) filtering
    const colJobsByUser = cols.map(col => {
      const grouped = new Map<number | null, typeof col.jobs>();
      for (const job of col.jobs) {
        const key = job.assigneeId ?? null;
        const list = grouped.get(key);
        if (list) list.push(job);
        else grouped.set(key, [job]);
      }
      return grouped;
    });

    const rows: SwimlaneRow[] = rowUsers.map(user => ({
      user,
      cells: colJobsByUser.map(grouped => ({
        jobs: grouped.get(user.id) ?? [],
      })),
    }));

    // Unassigned row
    const hasUnassigned = colJobsByUser.some(grouped => grouped.has(null));
    const showUnassigned = selectedIds.length === 0 || hasUnassigned;
    if (showUnassigned) {
      rows.push({
        user: null,
        cells: colJobsByUser.map(grouped => ({
          jobs: grouped.get(null) ?? [],
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
          // Open the New Job form if navigated with ?new=job (e.g. the
          // dashboard "Create your first job" CTA). Clear the param after so
          // a refresh doesn't reopen the dialog.
          if (this.route.snapshot.queryParamMap.get('new') === 'job') {
            this.openCreateDialog();
            this.router.navigate([], { queryParams: { new: null }, queryParamsHandling: 'merge', replaceUrl: true });
          }
          if (this.draftResume.consume('job')) { this.openCreateDialog(); }
        },
        error: () => this.error.set(this.translate.instant('kanban.loadTrackTypesFailed')),
      });

    this.initBoardHub();
    this.kanbanService.getUsers().subscribe(u => this.users.set(u));
    this.kanbanService.getTeams().subscribe({
      next: t => this.teams.set(t),
      error: () => this.teams.set([]),
    });
    this.kanbanService.getCustomers().subscribe({
      next: c => this.customers.set(c),
      error: () => this.customers.set([]),
    });
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

    this.boardLoad?.unsubscribe();
    this.boardLoad = this.loadingService.track('Loading board...', this.kanbanService.getBoard(trackTypeId, this.boardFilters()))
      .subscribe({
        next: (board) => this.applyBoard(board),
        // A cancelled in-flight request surfaces as status 0. That's not a
        // failure; only surface real errors.
        error: (err: HttpErrorResponse) => {
          if (err?.status === 0) return;
          this.error.set(this.translate.instant('kanban.loadBoardFailed'));
        },
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
    this.boardHub.onBoardUpdatedEvent(reloadBoard);
  }

  protected onSwimlaneDragStarted(_event: CdkDragStart): void {
    this.swimlaneDragging = true;
  }

  protected onJobNumberClicked(event: { job: KanbanJob; event: Event }): void {
    if (this.swimlaneDragging) return;
    this.openJobDetail(event.job.id);
  }

  /**
   * The card's accounting externalRef chip. There is no in-app viewer for the
   * external provider's document itself, so the chip opens the job detail —
   * its Cost Analysis section carries the accounting picture for the job.
   */
  protected onAccountingRefClicked(event: { job: KanbanJob; event: Event }): void {
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

  /**
   * Stages that are invalid bulk-move targets for the ENTIRE current
   * selection — same-stage no-ops, backward moves out of irreversible
   * stages, and forward moves that would skip a mandatory stage. When at
   * least one selected job can legally move, the target stays enabled and
   * the server reports per-job failures (partial success).
   */
  protected readonly disabledBulkStageIds = computed<Set<number>>(() => {
    const disabled = new Set<number>();
    const selected = this.selectedJobIds();
    if (selected.size === 0) return disabled;

    const cols = this.columns();
    const stages = cols.map(c => c.stage);
    const stageByName = new Map(stages.map(s => [s.name, s]));
    const selectedJobs = cols.flatMap(c => c.jobs).filter(j => selected.has(j.id));

    for (const target of stages) {
      const anyAllowed = selectedJobs.some(j => {
        const current = stageByName.get(j.stageName);
        if (!current || current.id === target.id) return false;
        if (current.isIrreversible && target.sortOrder < current.sortOrder) return false;
        if (target.sortOrder > current.sortOrder) {
          const skipsMandatory = stages.some(s => s.isMandatory
            && s.sortOrder > current.sortOrder && s.sortOrder < target.sortOrder);
          if (skipsMandatory) return false;
        }
        return true;
      });
      if (!anyAllowed) disabled.add(target.id);
    }
    return disabled;
  });

  protected bulkMoveToStage(stage: Stage): void {
    const ids = [...this.selectedJobIds()];
    this.kanbanService.bulkMoveStage(ids, stage.id).subscribe({
      next: (r) => {
        if (r.successCount > 0) {
          this.snackbar.success(this.translate.instant('kanban.jobsMoved', { count: r.successCount, stage: stage.name }));
        }
        // Surface per-job validation failures (mandatory-stage skips,
        // irreversible-stage guards, quality gates) with the server's messages.
        if (r.failureCount > 0) {
          this.toast.show({
            severity: 'warning',
            title: this.translate.instant('kanban.bulkMoveBlockedTitle'),
            message: this.translate.instant('kanban.bulkMoveBlockedMessage', { count: r.failureCount, stage: stage.name }),
            details: r.errors.map(e => e.message).join('\n'),
          });
        }
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
    this.boardLoad?.unsubscribe();
    this.boardLoad = this.kanbanService.getBoard(trackTypeId, this.boardFilters()).subscribe({
      next: (board) => this.applyBoard(board),
    });
  }

  private applyBoard(board: KanbanBoard): void {
    this.columns.set(board.columns);
    this.boardTotalCount.set(board.totalCount);
    this.boardLoadedCount.set(board.loadedCount);
  }

  private replaceColumnJobs(changes: Map<number, KanbanJob[]>): void {
    this.columns.update(cols => cols.map((col, i) => changes.has(i) ? { ...col, jobs: changes.get(i)! } : col));
  }

  private mergeIntoSlots(full: KanbanJob[], visibleOrder: KanbanJob[]): KanbanJob[] {
    const visibleIds = new Set(visibleOrder.map(j => j.id));
    const slots = full.flatMap((j, i) => visibleIds.has(j.id) ? [i] : []);
    if (slots.length !== visibleOrder.length) return full;
    const merged = [...full];
    slots.forEach((slot, k) => {
      merged[slot] = { ...visibleOrder[k], boardPosition: full[slot].boardPosition };
    });
    return merged;
  }

  private insertAtVisibleSlot(full: KanbanJob[], visibleOrder: KanbanJob[], moved: KanbanJob): KanbanJob[] {
    const rest = full.filter(j => j.id !== moved.id);
    const visibleIndex = visibleOrder.findIndex(j => j.id === moved.id);
    const before = visibleIndex > 0 ? visibleOrder[visibleIndex - 1] : undefined;
    const after = visibleIndex >= 0 ? visibleOrder[visibleIndex + 1] : undefined;
    let at = rest.length;
    if (before) {
      const i = rest.findIndex(j => j.id === before.id);
      if (i >= 0) at = i + 1;
    } else if (after) {
      const i = rest.findIndex(j => j.id === after.id);
      if (i >= 0) at = i;
    }
    const position = at > 0
      ? rest[at - 1].boardPosition + 1
      : Math.max(0, (rest[0]?.boardPosition ?? 1) - 1);
    return [...rest.slice(0, at), { ...moved, boardPosition: position }, ...rest.slice(at)];
  }

  private normalizePositions(jobs: KanbanJob[]): KanbanJob[] {
    let previous = -1;
    return jobs.map(job => {
      const position = job.boardPosition > previous ? job.boardPosition : previous + 1;
      previous = position;
      return position === job.boardPosition ? job : { ...job, boardPosition: position };
    });
  }

  private changedPositions(before: KanbanJob[], after: KanbanJob[]): KanbanJob[] {
    const original = new Map(before.map(j => [j.id, j.boardPosition]));
    return after.filter(j => original.get(j.id) !== j.boardPosition);
  }

  private persistPositions(jobs: KanbanJob[]): void {
    for (const job of jobs) {
      this.kanbanService.updateJobPosition(job.id, job.boardPosition).subscribe();
    }
  }

  // ── Board View Drop ──
  protected onCardDropped(event: CdkDragDrop<KanbanJob[]>): void {
    const targetColumnIndex = this.dropListIds().indexOf(event.container.id);
    const targetFull = [...(this.columns()[targetColumnIndex]?.jobs ?? [])];

    if (event.previousContainer === event.container) {
      if (targetColumnIndex < 0) return;
      const visible = [...event.container.data];
      moveItemInArray(visible, event.previousIndex, event.currentIndex);
      const ordered = this.normalizePositions(this.mergeIntoSlots(targetFull, visible));
      this.replaceColumnJobs(new Map([[targetColumnIndex, ordered]]));
      this.persistPositions(this.changedPositions(targetFull, ordered));
      return;
    }

    const job = event.previousContainer.data[event.previousIndex];
    const sourceColumnIndex = this.dropListIds().indexOf(event.previousContainer.id);
    const targetStage = this.columns()[targetColumnIndex]?.stage;

    if (!job || !targetStage || targetStage.isIrreversible || sourceColumnIndex < 0) return;

    const movedJob: KanbanJob = { ...job, stageName: targetStage.name, stageColor: targetStage.color };
    const targetVisible = [...event.container.data];
    targetVisible.splice(event.currentIndex, 0, movedJob);
    const targetOrdered = this.normalizePositions(this.insertAtVisibleSlot(targetFull, targetVisible, movedJob));
    const toPersist = this.changedPositions(targetFull, targetOrdered);
    const sourceRemaining = (this.columns()[sourceColumnIndex]?.jobs ?? []).filter(j => j.id !== job.id);
    this.replaceColumnJobs(new Map([
      [sourceColumnIndex, sourceRemaining],
      [targetColumnIndex, targetOrdered],
    ]));

    // JIT GET seeds the ETag cache so the PATCH carries If-Match.
    this.kanbanService.getJobDetail(job.id).pipe(
      switchMap(() => this.kanbanService.moveJobStage(job.id, targetStage.id)),
    ).subscribe({
      next: () => this.persistPositions(toPersist),
      error: () => this.reloadBoard(),
    });
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
      // JIT GET seeds the ETag cache so the PATCH carries If-Match.
      this.kanbanService.getJobDetail(job.id).pipe(
        switchMap(() => this.kanbanService.moveJobStage(job.id, targetStage.id)),
      ).subscribe({ error: () => this.reloadBoard() });
    }

    if (assigneeChanged) {
      // JIT GET seeds the ETag cache so the PUT carries If-Match.
      this.kanbanService.getJobDetail(job.id).pipe(
        switchMap(() => this.kanbanService.updateJob(job.id, { assigneeId: targetUserId })),
      ).subscribe({ error: () => this.reloadBoard() });
    }
  }

  protected swimlaneCanEnter = (): boolean => true;
}
