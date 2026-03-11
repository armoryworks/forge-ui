import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged, filter, switchMap } from 'rxjs';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { FileUploadZoneComponent, UploadedFile } from '../../../shared/components/file-upload-zone/file-upload-zone.component';
import { ActivityTimelineComponent } from '../../../shared/components/activity-timeline/activity-timeline.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { SelectComponent } from '../../../shared/components/select/select.component';
import { ActivityItem } from '../../../shared/models/activity.model';
import { FileAttachment } from '../../../shared/models/file.model';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { MatDialog } from '@angular/material/dialog';
import { TimeEntry } from '../../time-tracking/models/time-entry.model';
import { KanbanService } from '../services/kanban.service';
import { DisposeJobDialogComponent, DisposeJobDialogData } from './dispose-job-dialog.component';
import { JobDetail } from '../models/job-detail.model';
import { Subtask } from '../models/subtask.model';
import { Activity } from '../models/activity.model';
import { JobLink } from '../models/job-link.model';
import { KanbanJob } from '../models/kanban-job.model';
import { PRIORITY_COLORS } from '../models/priority-colors.const';
import { LINK_TYPE_OPTIONS } from '../models/link-type-options.const';
import { LINK_TYPE_ICONS } from '../models/link-type-icons.const';
import { LINK_TYPE_LABELS } from '../models/link-type-labels.const';
import { JobPart } from '../models/job-part.model';
import { PartSearchResult } from '../models/part-search-result.model';
import { ChildJob } from '../models/child-job.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { StatusTimelineComponent } from '../../../shared/components/status-timeline/status-timeline.component';

@Component({
  selector: 'app-job-detail-panel',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, AvatarComponent, FileUploadZoneComponent, InputComponent, SelectComponent, ActivityTimelineComponent, StatusTimelineComponent],
  templateUrl: './job-detail-panel.component.html',
  styleUrl: './job-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobDetailPanelComponent implements OnInit {
  private readonly kanbanService = inject(KanbanService);
  private readonly snackbar = inject(SnackbarService);
  private readonly matDialog = inject(MatDialog);

  readonly jobId = input.required<number>();
  readonly closed = output<void>();
  readonly editRequested = output<JobDetail>();

  protected readonly job = signal<JobDetail | null>(null);
  protected readonly subtasks = signal<Subtask[]>([]);
  protected readonly activity = signal<Activity[]>([]);
  protected readonly links = signal<JobLink[]>([]);
  protected readonly files = signal<FileAttachment[]>([]);
  protected readonly timeEntries = signal<TimeEntry[]>([]);
  protected readonly loading = signal(true);
  protected readonly newSubtaskControl = new FormControl('');
  protected readonly commentControl = new FormControl('');

  // Link add form
  protected readonly linkSearchControl = new FormControl('');
  protected readonly linkTypeControl = new FormControl('RelatedTo');
  protected readonly linkTypeOptions = LINK_TYPE_OPTIONS;
  protected readonly linkTypeIcons = LINK_TYPE_ICONS;
  protected readonly linkTypeLabels = LINK_TYPE_LABELS;
  protected readonly linkSearchResults = signal<KanbanJob[]>([]);
  protected readonly selectedLinkTarget = signal<KanbanJob | null>(null);
  protected readonly showLinkResults = signal(false);

  // Child jobs
  protected readonly childJobs = signal<ChildJob[]>([]);

  // Part add form
  protected readonly jobParts = signal<JobPart[]>([]);
  protected readonly partSearchControl = new FormControl('');
  protected readonly partSearchResults = signal<PartSearchResult[]>([]);
  protected readonly selectedPart = signal<PartSearchResult | null>(null);
  protected readonly showPartResults = signal(false);

  protected readonly totalTimeMinutes = computed(() =>
    this.timeEntries().reduce((sum, e) => sum + e.durationMinutes, 0),
  );

  protected readonly formattedTotalTime = computed(() => {
    const mins = this.totalTimeMinutes();
    if (mins === 0) return '0h';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  });

  protected readonly mappedActivity = computed<ActivityItem[]>(() =>
    this.activity().map(a => ({
      id: a.id,
      description: a.description,
      createdAt: a.createdAt,
      userInitials: a.userInitials ?? undefined,
      action: a.action,
    }))
  );

  ngOnInit(): void {
    const id = this.jobId();
    this.kanbanService.getJobDetail(id).subscribe(detail => {
      this.job.set(detail);
      this.loading.set(false);
      if (detail.childJobCount > 0) {
        this.kanbanService.getChildJobs(id).subscribe(children => this.childJobs.set(children));
      }
    });
    this.kanbanService.getSubtasks(id).subscribe(s => this.subtasks.set(s));
    this.kanbanService.getJobActivity(id).subscribe(a => this.activity.set(a));
    this.kanbanService.getJobLinks(id).subscribe(l => this.links.set(l));
    this.kanbanService.getJobFiles(id).subscribe(f => this.files.set(f));
    this.kanbanService.getJobTimeEntries(id).subscribe(t => this.timeEntries.set(t));
    this.kanbanService.getJobParts(id).subscribe(p => this.jobParts.set(p));

    this.partSearchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      filter(v => (v?.length ?? 0) >= 2),
      switchMap(term => this.kanbanService.searchParts(term!)),
    ).subscribe(results => {
      const linkedPartIds = new Set(this.jobParts().map(jp => jp.partId));
      this.partSearchResults.set(
        results.filter(p => !linkedPartIds.has(p.id)).slice(0, 8)
      );
      this.showPartResults.set(true);
    });

    this.linkSearchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      filter(v => (v?.length ?? 0) >= 2),
      switchMap(term => this.kanbanService.searchJobs(term!)),
    ).subscribe(results => {
      // Exclude the current job and already-linked jobs
      const currentId = this.jobId();
      const linkedIds = new Set(this.links().map(l => l.linkedJobId));
      this.linkSearchResults.set(
        results.filter(j => j.id !== currentId && !linkedIds.has(j.id)).slice(0, 8)
      );
      this.showLinkResults.set(true);
    });
  }

  protected priorityColor(priority: string): string {
    return PRIORITY_COLORS[priority] ?? PRIORITY_COLORS['Normal'];
  }

  protected formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  protected formatActivityDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  protected completedCount(): number {
    return this.subtasks().filter(s => s.isCompleted).length;
  }

  protected toggleSubtask(subtask: Subtask): void {
    const newState = !subtask.isCompleted;
    subtask.isCompleted = newState;
    subtask.completedAt = newState ? new Date().toISOString() : null;
    this.subtasks.update(list => [...list]);
    this.kanbanService.toggleSubtask(this.jobId(), subtask.id, newState).subscribe();
  }

  protected addSubtask(): void {
    const text = (this.newSubtaskControl.value ?? '').trim();
    if (!text) return;
    this.kanbanService.addSubtask(this.jobId(), text).subscribe(st => {
      this.subtasks.update(list => [...list, st]);
      this.newSubtaskControl.reset();
      this.snackbar.success('Subtask added.');
    });
  }

  protected selectLinkTarget(job: KanbanJob): void {
    this.selectedLinkTarget.set(job);
    this.linkSearchControl.setValue(job.jobNumber + ' — ' + job.title, { emitEvent: false });
    this.showLinkResults.set(false);
  }

  protected addLink(): void {
    const target = this.selectedLinkTarget();
    const linkType = this.linkTypeControl.value ?? 'RelatedTo';
    if (!target) return;

    this.kanbanService.createJobLink(this.jobId(), target.id, linkType).subscribe(link => {
      this.links.update(list => [...list, link]);
      this.selectedLinkTarget.set(null);
      this.linkSearchControl.reset();
      this.linkTypeControl.setValue('RelatedTo');
      this.snackbar.success('Link added.');
    });
  }

  protected deleteLink(link: JobLink): void {
    this.kanbanService.deleteJobLink(this.jobId(), link.id).subscribe(() => {
      this.links.update(list => list.filter(l => l.id !== link.id));
      this.snackbar.success('Link removed.');
    });
  }

  protected dismissLinkResults(): void {
    // Small delay to allow click on result
    setTimeout(() => this.showLinkResults.set(false), 200);
  }

  protected postComment(): void {
    const text = (this.commentControl.value ?? '').trim();
    if (!text) return;
    this.kanbanService.addComment(this.jobId(), text).subscribe(entry => {
      this.activity.update(list => [entry, ...list]);
      this.commentControl.reset();
      this.snackbar.success('Comment posted.');
    });
  }

  protected onFileUploaded(file: UploadedFile): void {
    this.kanbanService.getJobFiles(this.jobId()).subscribe(f => {
      this.files.set(f);
      this.snackbar.success('File uploaded.');
    });
  }

  protected deleteFile(file: FileAttachment): void {
    this.kanbanService.deleteJobFile(file.id).subscribe(() => {
      this.files.update(list => list.filter(f => f.id !== file.id));
      this.snackbar.success('File deleted.');
    });
  }

  protected downloadFile(file: FileAttachment): void {
    window.open(this.kanbanService.downloadFileUrl(file.id), '_blank');
  }

  protected formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  protected fileIcon(contentType: string): string {
    if (contentType.startsWith('image/')) return 'image';
    if (contentType.includes('pdf')) return 'picture_as_pdf';
    if (contentType.includes('spreadsheet') || contentType.includes('excel')) return 'table_chart';
    if (contentType.includes('word') || contentType.includes('document')) return 'description';
    return 'attach_file';
  }

  protected formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  }

  protected selectPart(part: PartSearchResult): void {
    this.selectedPart.set(part);
    this.partSearchControl.setValue(part.partNumber + ' — ' + part.description, { emitEvent: false });
    this.showPartResults.set(false);
  }

  protected addPart(): void {
    const part = this.selectedPart();
    if (!part) return;

    this.kanbanService.addJobPart(this.jobId(), part.id).subscribe(jp => {
      this.jobParts.update(list => [...list, jp]);
      this.selectedPart.set(null);
      this.partSearchControl.reset();
      this.snackbar.success('Part added.');
    });
  }

  protected removePart(jp: JobPart): void {
    this.kanbanService.removeJobPart(this.jobId(), jp.id).subscribe(() => {
      this.jobParts.update(list => list.filter(p => p.id !== jp.id));
      this.snackbar.success('Part removed.');
    });
  }

  protected dismissPartResults(): void {
    setTimeout(() => this.showPartResults.set(false), 200);
  }

  protected explodeBom(): void {
    const j = this.job();
    if (!j) return;
    this.matDialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Explode BOM?',
        message: `This will create sub-jobs for all "Make" items in the BOM of part ${j.partNumber}. This action cannot be undone.`,
        confirmLabel: 'Explode BOM',
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.kanbanService.explodeBom(j.id).subscribe(result => {
        const jobCount = result.createdJobs.length;
        const buyCount = result.buyItems.length;
        const stockCount = result.stockItems.length;
        const parts: string[] = [];
        if (jobCount > 0) parts.push(`${jobCount} sub-job${jobCount > 1 ? 's' : ''} created`);
        if (buyCount > 0) parts.push(`${buyCount} buy item${buyCount > 1 ? 's' : ''}`);
        if (stockCount > 0) parts.push(`${stockCount} stock item${stockCount > 1 ? 's' : ''}`);
        this.snackbar.success(`BOM exploded: ${parts.join(', ')}.`);
        // Reload job detail and child jobs
        this.kanbanService.getJobDetail(j.id).subscribe(detail => {
          this.job.set(detail);
        });
        this.kanbanService.getChildJobs(j.id).subscribe(children => this.childJobs.set(children));
      });
    });
  }

  protected openDispose(): void {
    const j = this.job();
    if (!j) return;
    this.matDialog.open(DisposeJobDialogComponent, {
      width: '520px',
      data: { jobId: j.id, jobNumber: j.jobNumber } satisfies DisposeJobDialogData,
    }).afterClosed().subscribe(result => {
      if (result) {
        this.job.set(result);
      }
    });
  }

  protected formatDisposition(disposition: string): string {
    const map: Record<string, string> = {
      ShipToCustomer: 'Ship to Customer',
      AddToInventory: 'Add to Inventory',
      CapitalizeAsAsset: 'Capitalize as Asset',
      Scrap: 'Scrap',
      HoldForReview: 'Hold for Review',
    };
    return map[disposition] ?? disposition;
  }

  protected close(): void {
    this.closed.emit();
  }
}
