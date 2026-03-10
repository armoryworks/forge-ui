import {
  ChangeDetectionStrategy, Component, computed, inject, OnInit, signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { forkJoin, startWith } from 'rxjs';
import { BacklogService } from './services/backlog.service';
import { KanbanService } from '../kanban/services/kanban.service';
import { LoadingService } from '../../shared/services/loading.service';
import { KanbanJob } from '../kanban/models/kanban-job.model';
import { UserRef } from '../kanban/models/user-ref.model';
import { JobDetail } from '../kanban/models/job-detail.model';
import { PRIORITY_COLORS } from '../kanban/models/priority-colors.const';
import { TrackType } from '../../shared/models/track-type.model';
import { JobDetailPanelComponent } from '../kanban/components/job-detail-panel.component';
import { JobDialogComponent, DialogMode } from '../kanban/components/job-dialog.component';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';

@Component({
  selector: 'app-backlog',
  standalone: true,
  imports: [
    ReactiveFormsModule, JobDetailPanelComponent, JobDialogComponent, AvatarComponent,
    PageHeaderComponent, InputComponent, SelectComponent,
    DataTableComponent, ColumnCellDirective,
  ],
  templateUrl: './backlog.component.html',
  styleUrl: './backlog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BacklogComponent implements OnInit {
  private readonly backlogService = inject(BacklogService);
  private readonly kanbanService = inject(KanbanService);
  private readonly loadingService = inject(LoadingService);

  protected readonly jobs = signal<KanbanJob[]>([]);
  protected readonly trackTypes = signal<TrackType[]>([]);
  protected readonly users = signal<UserRef[]>([]);
  protected readonly error = signal<string | null>(null);

  // Filters
  protected readonly searchControl = new FormControl('');
  protected readonly trackTypeControl = new FormControl<number | null>(null);
  protected readonly priorityControl = new FormControl<string | null>(null);
  protected readonly assigneeControl = new FormControl<string | null>(null);

  private readonly searchTerm = toSignal(this.searchControl.valueChanges.pipe(startWith('')), { initialValue: '' });
  private readonly selectedTrackTypeId = toSignal(this.trackTypeControl.valueChanges.pipe(startWith(null as number | null)), { initialValue: null as number | null });
  private readonly selectedPriority = toSignal(this.priorityControl.valueChanges.pipe(startWith(null as string | null)), { initialValue: null as string | null });
  private readonly selectedAssignee = toSignal(this.assigneeControl.valueChanges.pipe(startWith(null as string | null)), { initialValue: null as string | null });

  // Detail panel & dialog
  protected readonly selectedJobId = signal<number | null>(null);
  protected readonly showJobDialog = signal(false);
  protected readonly dialogMode = signal<DialogMode>('create');
  protected readonly dialogJob = signal<JobDetail | null>(null);

  protected readonly priorities = ['Low', 'Normal', 'High', 'Urgent'];

  protected readonly backlogColumns = computed<ColumnDef[]>(() => {
    const stageOptions = [...new Set(this.jobs().map(j => j.stageName))].sort()
      .map(s => ({ value: s, label: s }));
    const customerOptions = [...new Set(this.jobs().map(j => j.customerName).filter(Boolean))].sort()
      .map(c => ({ value: c, label: c as string }));
    const assigneeOptions = this.users()
      .map(u => ({ value: u.initials, label: u.name }));

    return [
      { field: 'jobNumber', header: 'Job #', sortable: true, filterable: true, width: '80px' },
      { field: 'title', header: 'Title', sortable: true, filterable: true },
      { field: 'stageName', header: 'Stage', sortable: true, filterable: true, type: 'enum', filterOptions: stageOptions, width: '100px' },
      { field: 'priorityName', header: 'Priority', sortable: true, filterable: true, type: 'enum',
        filterOptions: this.priorities.map(p => ({ value: p, label: p })), width: '90px' },
      { field: 'assignee', header: 'Assignee', filterable: true, type: 'enum', filterOptions: assigneeOptions, width: '60px', align: 'center' as const },
      { field: 'customerName', header: 'Customer', sortable: true, filterable: true, type: 'enum', filterOptions: customerOptions, width: '120px' },
      { field: 'dueDate', header: 'Due Date', sortable: true, filterable: true, type: 'date', width: '100px' },
    ];
  });

  protected readonly backlogRowClass = (row: unknown) => {
    const job = row as KanbanJob;
    const classes: string[] = [];
    if (job.isOverdue) classes.push('row--overdue');
    if (job.id === this.selectedJobId()) classes.push('row--selected');
    return classes.join(' ');
  };

  protected readonly backlogRowStyle = (row: unknown): Record<string, string> => {
    const job = row as KanbanJob;
    return job.stageColor ? { '--row-tint': job.stageColor } : {};
  };

  protected readonly trackTypeOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'All Tracks' },
    ...this.trackTypes().map(tt => ({ value: tt.id, label: tt.name })),
  ]);
  protected readonly priorityOptions: SelectOption[] = [
    { value: null, label: 'All Priorities' },
    ...this.priorities.map(p => ({ value: p, label: p })),
  ];
  protected readonly assigneeOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'All Assignees' },
    ...this.users().map(u => ({ value: u.initials, label: u.name })),
  ]);

  protected readonly filteredJobs = computed(() => {
    let jobs = this.jobs();

    const search = (this.searchTerm() ?? '').toLowerCase().trim();
    if (search) {
      jobs = jobs.filter(j =>
        j.title.toLowerCase().includes(search) ||
        j.jobNumber.toLowerCase().includes(search),
      );
    }

    const trackTypeId = this.selectedTrackTypeId();
    if (trackTypeId) {
      const trackType = this.trackTypes().find(t => t.id === trackTypeId);
      if (trackType) {
        const stageNames = new Set(trackType.stages.map(s => s.name));
        jobs = jobs.filter(j => stageNames.has(j.stageName));
      }
    }

    const priority = this.selectedPriority();
    if (priority) {
      jobs = jobs.filter(j => j.priorityName === priority);
    }

    const assignee = this.selectedAssignee();
    if (assignee) {
      jobs = jobs.filter(j => j.assigneeInitials === assignee);
    }

    return jobs;
  });

  ngOnInit(): void {
    this.loadingService.track('Loading backlog...', forkJoin({
      jobs: this.backlogService.getJobs(),
      trackTypes: this.kanbanService.getTrackTypes(),
      users: this.kanbanService.getUsers(),
    })).subscribe({
      next: ({ jobs, trackTypes, users }) => {
        this.jobs.set(jobs);
        this.trackTypes.set(trackTypes);
        this.users.set(users);
      },
      error: () => this.error.set('Failed to load backlog'),
    });
  }

  protected priorityColor(priority: string): string {
    return PRIORITY_COLORS[priority] ?? '#94a3b8';
  }

  protected formatDate(date: string | null): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  protected onRowClicked(job: KanbanJob): void {
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
    this.loadJobs();
  }

  protected onDialogCancelled(): void {
    this.showJobDialog.set(false);
  }

  private loadJobs(): void {
    this.backlogService.getJobs().subscribe(jobs => this.jobs.set(jobs));
  }
}
