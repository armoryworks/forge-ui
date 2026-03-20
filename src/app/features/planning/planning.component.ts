import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { forkJoin, startWith } from 'rxjs';

import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PlanningService } from './services/planning.service';
import { PlanningCycleListItem } from './models/planning-cycle-list-item.model';
import { PlanningCycleDetail } from './models/planning-cycle-detail.model';
import { PlanningCycleEntry } from './models/planning-cycle-entry.model';
import { CreatePlanningCycleRequest } from './models/create-planning-cycle-request.model';
import { UpdatePlanningCycleRequest } from './models/update-planning-cycle-request.model';
import { CycleBoardComponent } from './components/cycle-board/cycle-board.component';
import { CycleDialogComponent } from './components/cycle-dialog/cycle-dialog.component';
import { BacklogService } from '../backlog/services/backlog.service';
import { KanbanJob } from '../kanban/models/kanban-job.model';
import { PRIORITY_COLORS } from '../kanban/models/priority-colors.const';
import { PRIORITY_FILTER_OPTIONS } from '../../shared/models/priority.const';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';

@Component({
  selector: 'app-planning',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe, MatTooltipModule,
    PageHeaderComponent, InputComponent, SelectComponent, AvatarComponent,
    CycleBoardComponent, CycleDialogComponent,
    EmptyStateComponent, LoadingBlockDirective,
  ],
  templateUrl: './planning.component.html',
  styleUrl: './planning.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanningComponent implements OnInit {
  private readonly planningService = inject(PlanningService);
  private readonly backlogService = inject(BacklogService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  // State
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly cycles = signal<PlanningCycleListItem[]>([]);
  protected readonly selectedCycle = signal<PlanningCycleDetail | null>(null);
  protected readonly backlogJobs = signal<KanbanJob[]>([]);
  protected readonly showCycleDialog = signal(false);
  protected readonly editingCycle = signal<PlanningCycleDetail | null>(null);

  // Backlog filters
  protected readonly searchControl = new FormControl('');
  protected readonly priorityControl = new FormControl<string | null>(null);

  private readonly searchTerm = toSignal(
    this.searchControl.valueChanges.pipe(startWith('')),
    { initialValue: '' },
  );
  private readonly selectedPriority = toSignal(
    this.priorityControl.valueChanges.pipe(startWith(null as string | null)),
    { initialValue: null as string | null },
  );

  // Cycle selector
  protected readonly cycleOptions = computed<SelectOption[]>(() => [
    ...this.cycles().map(c => ({
      value: c.id,
      label: c.name + ' (' + c.status + ')',
    })),
  ]);

  protected readonly cycleControl = new FormControl<number | null>(null);

  protected readonly priorityOptions = PRIORITY_FILTER_OPTIONS;

  // Committed job IDs for filtering backlog
  protected readonly committedJobIds = computed(() => {
    const cycle = this.selectedCycle();
    if (!cycle) return new Set<number>();
    return new Set(cycle.entries.map(e => e.jobId));
  });

  // Filtered backlog: exclude committed jobs, apply search/priority
  protected readonly filteredBacklog = computed(() => {
    const committed = this.committedJobIds();
    let jobs = this.backlogJobs().filter(j => !committed.has(j.id));

    const search = (this.searchTerm() ?? '').toLowerCase().trim();
    if (search) {
      jobs = jobs.filter(j =>
        j.title.toLowerCase().includes(search) ||
        j.jobNumber.toLowerCase().includes(search),
      );
    }

    const priority = this.selectedPriority();
    if (priority) {
      jobs = jobs.filter(j => j.priorityName === priority);
    }

    return jobs;
  });

  protected readonly hasCycle = computed(() => this.selectedCycle() !== null);
  protected readonly isActiveCycle = computed(() => this.selectedCycle()?.status === 'Active');
  protected readonly isDraftCycle = computed(() => this.selectedCycle()?.status === 'Draft');

  ngOnInit(): void {
    this.loadData();

    this.cycleControl.valueChanges.subscribe(cycleId => {
      if (cycleId) {
        this.loadCycle(cycleId);
      }
    });
  }

  private loadData(): void {
    this.loading.set(true);
    forkJoin({
      cycles: this.planningService.getCycles(),
      current: this.planningService.getCurrentCycle(),
      backlog: this.backlogService.getJobs(),
    }).subscribe({
      next: ({ cycles, current, backlog }) => {
        this.cycles.set(cycles);
        this.backlogJobs.set(backlog);

        if (current) {
          this.selectedCycle.set(current);
          this.cycleControl.setValue(current.id, { emitEvent: false });
        } else if (cycles.length > 0) {
          this.loadCycle(cycles[0].id);
          this.cycleControl.setValue(cycles[0].id, { emitEvent: false });
        }

        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  private loadCycle(id: number): void {
    this.planningService.getCycle(id).subscribe({
      next: (cycle) => this.selectedCycle.set(cycle),
    });
  }

  private reloadCycle(): void {
    const cycle = this.selectedCycle();
    if (cycle) {
      this.loadCycle(cycle.id);
    }
  }

  private reloadAll(): void {
    this.planningService.getCycles().subscribe(cycles => this.cycles.set(cycles));
    this.reloadCycle();
  }

  // --- Backlog Actions ---

  protected commitJob(job: KanbanJob): void {
    const cycle = this.selectedCycle();
    if (!cycle) return;

    this.planningService.commitJob(cycle.id, job.id).subscribe({
      next: () => {
        this.reloadCycle();
        this.snackbar.success(this.translate.instant('planning.committedToCycle', { number: job.jobNumber }));
      },
    });
  }

  protected priorityColor(priority: string): string {
    return PRIORITY_COLORS[priority] ?? '#94a3b8';
  }

  // --- Cycle Board Actions ---

  protected onEntryCompleted(entry: PlanningCycleEntry): void {
    const cycle = this.selectedCycle();
    if (!cycle) return;

    this.planningService.completeEntry(cycle.id, entry.jobId).subscribe({
      next: () => {
        this.reloadCycle();
        this.snackbar.success(this.translate.instant('planning.markedComplete', { number: entry.jobNumber }));
      },
    });
  }

  protected onEntryRemoved(entry: PlanningCycleEntry): void {
    const cycle = this.selectedCycle();
    if (!cycle) return;

    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('planning.removeFromCycleTitle'),
        message: this.translate.instant('planning.removeFromCycleMessage', { number: entry.jobNumber }),
        confirmLabel: this.translate.instant('common.remove'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.planningService.removeEntry(cycle.id, entry.jobId).subscribe({
        next: () => {
          this.reloadCycle();
          this.snackbar.success(this.translate.instant('planning.removedFromCycle', { number: entry.jobNumber }));
        },
      });
    });
  }

  protected onEntryReordered(event: CdkDragDrop<PlanningCycleEntry[]>): void {
    const cycle = this.selectedCycle();
    if (!cycle) return;

    const entries = [...cycle.entries].sort((a, b) => a.sortOrder - b.sortOrder);
    moveItemInArray(entries, event.previousIndex, event.currentIndex);

    const items = entries.map((e, i) => ({ jobId: e.jobId, sortOrder: i }));
    this.planningService.reorderEntries(cycle.id, items).subscribe({
      next: () => this.reloadCycle(),
    });
  }

  // --- Cycle Lifecycle ---

  protected openCreateCycleDialog(): void {
    this.editingCycle.set(null);
    this.showCycleDialog.set(true);
  }

  protected openEditCycleDialog(): void {
    this.editingCycle.set(this.selectedCycle());
    this.showCycleDialog.set(true);
  }

  protected onCycleDialogSaved(request: CreatePlanningCycleRequest | UpdatePlanningCycleRequest): void {
    this.saving.set(true);
    const existing = this.editingCycle();

    if (existing) {
      this.planningService.updateCycle(existing.id, request as UpdatePlanningCycleRequest).subscribe({
        next: () => {
          this.saving.set(false);
          this.showCycleDialog.set(false);
          this.reloadAll();
          this.snackbar.success(this.translate.instant('planning.cycleUpdated'));
        },
        error: () => this.saving.set(false),
      });
    } else {
      this.planningService.createCycle(request as CreatePlanningCycleRequest).subscribe({
        next: (created) => {
          this.saving.set(false);
          this.showCycleDialog.set(false);
          this.planningService.getCycles().subscribe(cycles => {
            this.cycles.set(cycles);
            this.selectedCycle.set(created);
            this.cycleControl.setValue(created.id, { emitEvent: false });
          });
          this.snackbar.success(this.translate.instant('planning.cycleCreated'));
        },
        error: () => this.saving.set(false),
      });
    }
  }

  protected onCycleDialogCancelled(): void {
    this.showCycleDialog.set(false);
  }

  protected activateCycle(): void {
    const cycle = this.selectedCycle();
    if (!cycle) return;

    this.planningService.activateCycle(cycle.id).subscribe({
      next: () => {
        this.reloadAll();
        this.snackbar.success(this.translate.instant('planning.cycleActivated'));
      },
    });
  }

  protected completeCycle(): void {
    const cycle = this.selectedCycle();
    if (!cycle) return;

    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('planning.completeCycleTitle'),
        message: this.translate.instant('planning.completeCycleRollMessage'),
        confirmLabel: this.translate.instant('planning.completeAndRollOver'),
        severity: 'info',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (confirmed === undefined) return;

      this.planningService.completeCycle(cycle.id, true).subscribe({
        next: (result) => {
          if (result.newCycleId) {
            this.loadCycle(result.newCycleId);
            this.cycleControl.setValue(result.newCycleId, { emitEvent: false });
          }
          this.planningService.getCycles().subscribe(cycles => this.cycles.set(cycles));
          this.snackbar.success(this.translate.instant('planning.cycleCompletedRolled'));
        },
      });
    });
  }

  protected completeWithoutRollover(): void {
    const cycle = this.selectedCycle();
    if (!cycle) return;

    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('planning.completeCycleTitle'),
        message: this.translate.instant('planning.completeCycleNoRollMessage'),
        confirmLabel: this.translate.instant('planning.completeBtn'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;

      this.planningService.completeCycle(cycle.id, false).subscribe({
        next: () => {
          this.reloadAll();
          this.snackbar.success(this.translate.instant('planning.cycleCompleted'));
        },
      });
    });
  }
}
