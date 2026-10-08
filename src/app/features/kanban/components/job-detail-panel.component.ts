import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal, viewChild } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { TimeTrackingService } from '../../time-tracking/services/time-tracking.service';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { FileUploadZoneComponent, UploadedFile } from '../../../shared/components/file-upload-zone/file-upload-zone.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { CapDirective } from '../../../shared/directives/cap.directive';
import { JobGatesSectionComponent } from '../../sequences/components/job-gates-section/job-gates-section.component';
import { SelectComponent } from '../../../shared/components/select/select.component';
import { EntityActivitySectionComponent } from '../../../shared/components/entity-activity-section/entity-activity-section.component';
import { FileAttachment } from '../../../shared/models/file.model';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { AuthService } from '../../../shared/services/auth.service';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TimeEntry } from '../../time-tracking/models/time-entry.model';
import { KanbanService } from '../services/kanban.service';
import { DisposeJobDialogComponent, DisposeJobDialogData } from './dispose-job-dialog.component';
import { UserRef } from '../models/user-ref.model';
import { JobDetail } from '../models/job-detail.model';
import { JobBomAtRelease } from '../../parts/models/bom-revision.model';
import { Subtask } from '../models/subtask.model';
import { JobLink } from '../models/job-link.model';
import { PriorityIndicatorComponent } from '../../../shared/components/priority-indicator/priority-indicator.component';
import { LINK_TYPE_OPTIONS } from '../models/link-type-options.const';
import { LINK_TYPE_ICONS } from '../models/link-type-icons.const';
import { LINK_TYPE_LABELS } from '../models/link-type-labels.const';
import { JobPart } from '../models/job-part.model';
import { EntityLinkComponent } from '../../../shared/components/entity-link/entity-link.component';
import { EntityPickerComponent } from '../../../shared/components/entity-picker/entity-picker.component';
import { ChildJob } from '../models/child-job.model';
import { LotService } from '../../lots/services/lot.service';
import { LotListItem } from '../../lots/models/lot-list-item.model';
import { Stage } from '../../../shared/models/stage.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { StatusTimelineComponent } from '../../../shared/components/status-timeline/status-timeline.component';
import { BarcodeInfoComponent } from '../../../shared/components/barcode-info/barcode-info.component';
import { CoverPhotoUploadDialogComponent, CoverPhotoDialogData } from './cover-photo-upload-dialog.component';
import { JobCostTabComponent } from './job-cost-tab.component';
import { OperationTimeTabComponent } from './operation-time-tab.component';

@Component({
  selector: 'app-job-detail-panel',
  standalone: true,
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, TranslatePipe, AvatarComponent, PriorityIndicatorComponent, FileUploadZoneComponent, InputComponent, SelectComponent, EntityActivitySectionComponent, StatusTimelineComponent, BarcodeInfoComponent, JobCostTabComponent, OperationTimeTabComponent, MatMenuModule, MatTooltipModule, EntityLinkComponent, EntityPickerComponent, CapDirective, JobGatesSectionComponent],
  templateUrl: './job-detail-panel.component.html',
  styleUrl: './job-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobDetailPanelComponent implements OnInit {
  private readonly kanbanService = inject(KanbanService);
  private readonly lotService = inject(LotService);
  private readonly timeTrackingService = inject(TimeTrackingService);
  private readonly snackbar = inject(SnackbarService);
  private readonly matDialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly auth = inject(AuthService);

  readonly jobId = input.required<number>();
  readonly users = input<UserRef[]>([]);
  readonly closed = output<void>();
  readonly editRequested = output<JobDetail>();

  protected readonly job = signal<JobDetail | null>(null);
  protected readonly subtasks = signal<Subtask[]>([]);
  protected readonly links = signal<JobLink[]>([]);
  protected readonly files = signal<FileAttachment[]>([]);
  protected readonly timeEntries = signal<TimeEntry[]>([]);
  protected readonly loading = signal(true);
  // Phase 3 H4 / WU-20 — BOM revision the job was released against, plus
  // the staleness flag (true if the part's BOM has advanced since).
  protected readonly bomAtRelease = signal<JobBomAtRelease | null>(null);
  protected readonly newSubtaskControl = new FormControl('');
  protected readonly showSubtaskAdd = signal(false);

  // Link add form
  protected readonly showLinkAdd = signal(false);
  protected readonly linkTargetControl = new FormControl<number | null>(null);
  protected readonly linkPickerFilters = { isArchived: 'false' };
  protected readonly linkTypeControl = new FormControl('RelatedTo');
  protected readonly linkTypeOptions = LINK_TYPE_OPTIONS;
  protected readonly linkTypeIcons = LINK_TYPE_ICONS;
  protected readonly linkTypeLabels = LINK_TYPE_LABELS;
  protected readonly selectedLinkTargetId = signal<number | null>(null);
  private readonly linkPicker = viewChild<EntityPickerComponent>('linkPicker');

  // Child jobs
  protected readonly childJobs = signal<ChildJob[]>([]);

  // Lots attached to this job (QA: lot data must surface on the parent job card)
  protected readonly lots = signal<LotListItem[]>([]);

  // Part add form
  protected readonly jobParts = signal<JobPart[]>([]);
  protected readonly showPartAdd = signal(false);
  protected readonly partPickerControl = new FormControl<number | null>(null);
  protected readonly partQtyControl = new FormControl<number | null>(1);
  private readonly partQtyEditControls = new Map<number, FormControl<number | null>>();
  protected readonly selectedPartId = signal<number | null>(null);
  private readonly partPicker = viewChild<EntityPickerComponent>('partPicker');

  // Activity (delegated to shared EntityActivitySectionComponent)

  // Stage move
  protected readonly availableStages = signal<Stage[]>([]);

  protected readonly isTimerLoading = signal(false);
  protected readonly isArchiveSaving = signal(false);

  protected readonly isAdmin = computed(() => this.auth.hasRole('Admin'));

  protected readonly myActiveTimer = computed(() => {
    const userId = this.auth.user()?.id;
    if (userId === undefined) return null;
    return this.timeEntries().find(e =>
      e.userId === userId && !!e.timerStart && !e.timerStop && !e.jobOperationId) ?? null;
  });

  protected readonly hasActiveTimer = computed(() => this.myActiveTimer() !== null);

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


  ngOnInit(): void {
    const id = this.jobId();
    this.kanbanService.getJobDetail(id).subscribe(detail => {
      this.job.set(detail);
      this.loading.set(false);
      if (detail.childJobCount > 0) {
        this.kanbanService.getChildJobs(id).subscribe(children => this.childJobs.set(children));
      }
      // Lots attached to this job — the QA walkthrough flagged that created
      // lots never surfaced on the parent job card.
      this.lotService.getLots(undefined, undefined, id).subscribe({
        next: (lots) => this.lots.set(lots),
        error: () => this.lots.set([]),
      });
      // Phase 3 H4 / WU-20 — fetch the BOM-at-release pin once we know the
      // job has a part associated. Endpoint always answers 200 (with
      // bomRevisionId === null) when nothing is pinned, so we can safely
      // call regardless and handle the null case in the template.
      this.kanbanService.getJobBomAtRelease(id).subscribe({
        next: (snap) => this.bomAtRelease.set(snap),
        error: () => this.bomAtRelease.set(null),
      });
      // Load available stages for this track type
      this.kanbanService.getTrackTypes().subscribe(types => {
        const tt = types.find(t => t.id === detail.trackTypeId);
        if (tt) {
          this.availableStages.set([...tt.stages].sort((a, b) => a.sortOrder - b.sortOrder));
        }
      });
    });
    this.kanbanService.getSubtasks(id).subscribe(s => this.subtasks.set(s));
    this.kanbanService.getJobLinks(id).subscribe(l => this.links.set(l));
    this.kanbanService.getJobFiles(id).subscribe(f => this.files.set(f));
    this.kanbanService.getJobTimeEntries(id).subscribe(t => this.timeEntries.set(t));
    this.kanbanService.getJobParts(id).subscribe(p => this.jobParts.set(p));

  }

  protected completedCount(): number {
    return this.subtasks().filter(s => s.isCompleted).length;
  }

  protected toggleSubtask(subtask: Subtask): void {
    const newState = !subtask.isCompleted;
    subtask.isCompleted = newState;
    subtask.completedAt = newState ? new Date() : null;
    this.subtasks.update(list => [...list]);
    this.kanbanService.toggleSubtask(this.jobId(), subtask.id, newState).subscribe();
  }

  protected addSubtask(): void {
    const text = (this.newSubtaskControl.value ?? '').trim();
    if (!text) return;
    this.kanbanService.addSubtask(this.jobId(), text).subscribe(st => {
      this.subtasks.update(list => [...list, st]);
      this.newSubtaskControl.reset();
      this.snackbar.success(this.translate.instant('kanban.subtaskAdded'));
    });
  }

  protected toggleSubtaskAdd(): void {
    if (this.showSubtaskAdd()) this.newSubtaskControl.reset();
    this.showSubtaskAdd.update(open => !open);
  }

  protected toggleLinkAdd(): void {
    if (this.showLinkAdd()) this.resetLinkForm();
    this.showLinkAdd.update(open => !open);
  }

  protected togglePartAdd(): void {
    if (this.showPartAdd()) this.resetPartForm();
    this.showPartAdd.update(open => !open);
  }

  protected onLinkTargetPicked(row: Record<string, unknown> | null): void {
    const id = row ? Number(row['id']) : null;
    this.selectedLinkTargetId.set(id);
    if (row && id !== null) {
      this.linkPicker()?.setSelected(id, this.pickedLabel(row['jobNumber'], row['title']));
    }
  }

  private resetLinkForm(): void {
    this.selectedLinkTargetId.set(null);
    this.linkTargetControl.reset();
    this.linkTypeControl.setValue('RelatedTo');
  }

  protected addLink(): void {
    const targetId = this.selectedLinkTargetId();
    const linkType = this.linkTypeControl.value ?? 'RelatedTo';
    if (targetId === null) return;
    if (targetId === this.jobId()) {
      this.snackbar.error(this.translate.instant('jobDetailExtras.linkSelf'));
      return;
    }
    if (this.links().some(l => l.linkedJobId === targetId)) {
      this.snackbar.error(this.translate.instant('jobDetailExtras.linkDuplicate'));
      return;
    }

    this.kanbanService.createJobLink(this.jobId(), targetId, linkType).subscribe(link => {
      this.links.update(list => [...list, link]);
      this.resetLinkForm();
      this.snackbar.success(this.translate.instant('kanban.linkAdded'));
    });
  }

  protected deleteLink(link: JobLink): void {
    this.kanbanService.deleteJobLink(this.jobId(), link.id).subscribe(() => {
      this.links.update(list => list.filter(l => l.id !== link.id));
      this.snackbar.success(this.translate.instant('kanban.linkRemoved'));
    });
  }


  protected onFileUploaded(_file: UploadedFile): void {
    this.kanbanService.getJobFiles(this.jobId()).subscribe(f => {
      this.files.set(f);
      this.snackbar.success(this.translate.instant('kanban.fileUploaded'));
    });
  }

  protected deleteFile(file: FileAttachment): void {
    this.kanbanService.deleteJobFile(file.id).subscribe(() => {
      this.files.update(list => list.filter(f => f.id !== file.id));
      this.snackbar.success(this.translate.instant('kanban.fileDeleted'));
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

  protected onPartPicked(row: Record<string, unknown> | null): void {
    const id = row ? Number(row['id']) : null;
    this.selectedPartId.set(id);
    if (row && id !== null) {
      this.partPicker()?.setSelected(id, this.pickedLabel(row['partNumber'], row['name']));
    }
  }

  private resetPartForm(): void {
    this.selectedPartId.set(null);
    this.partPickerControl.reset();
    this.partQtyControl.setValue(1);
  }

  private pickedLabel(primary: unknown, secondary: unknown): string {
    const head = String(primary ?? '');
    return secondary ? `${head} — ${String(secondary)}` : head;
  }

  protected addPart(): void {
    const partId = this.selectedPartId();
    const qty = this.partQtyControl.value;
    if (partId === null || !this.isValidQty(qty)) return;
    if (this.jobParts().some(jp => jp.partId === partId)) {
      this.snackbar.error(this.translate.instant('jobDetailExtras.partDuplicate'));
      return;
    }

    this.kanbanService.addJobPart(this.jobId(), partId, qty).subscribe(jp => {
      this.jobParts.update(list => [...list, jp]);
      this.resetPartForm();
      this.snackbar.success(this.translate.instant('kanban.partAdded'));
    });
  }

  protected canAddPart(): boolean {
    return this.selectedPartId() !== null && this.isValidQty(this.partQtyControl.value);
  }

  protected partQtyEditControl(jp: JobPart): FormControl<number | null> {
    let control = this.partQtyEditControls.get(jp.id);
    if (!control) {
      control = new FormControl<number | null>(jp.quantity);
      this.partQtyEditControls.set(jp.id, control);
    }
    return control;
  }

  protected commitPartQtyOnEnter(event: Event): void {
    (event.target as HTMLElement).blur();
  }

  protected savePartQty(jp: JobPart): void {
    const control = this.partQtyEditControl(jp);
    const qty = control.value;
    if (!this.isValidQty(qty)) {
      control.setValue(jp.quantity);
      return;
    }
    if (qty === jp.quantity) return;

    this.kanbanService.updateJobPart(this.jobId(), jp.id, qty, jp.notes).subscribe({
      next: updated => {
        this.jobParts.update(list => list.map(p => (p.id === jp.id ? updated : p)));
        control.setValue(updated.quantity);
        this.snackbar.success(this.translate.instant('parts.partUpdated'));
      },
      error: () => control.setValue(jp.quantity),
    });
  }

  private isValidQty(qty: number | null): qty is number {
    return typeof qty === 'number' && Number.isFinite(qty) && qty > 0;
  }

  protected removePart(jp: JobPart): void {
    this.kanbanService.removeJobPart(this.jobId(), jp.id).subscribe(() => {
      this.jobParts.update(list => list.filter(p => p.id !== jp.id));
      this.partQtyEditControls.delete(jp.id);
      this.snackbar.success(this.translate.instant('kanban.partRemoved'));
    });
  }

  protected explodeBom(): void {
    const j = this.job();
    if (!j) return;
    this.matDialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('kanban.explodeBomConfirmTitle'),
        message: this.translate.instant('kanban.explodeBomConfirmMessage', { partNumber: j.partNumber }),
        confirmLabel: this.translate.instant('kanban.explodeBom'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.kanbanService.explodeBom(j.id).subscribe(result => {
        const jobCount = result.createdJobs.length;
        const buyCount = result.buyItems.length;
        const stockCount = result.stockItems.length;
        const msgParts: string[] = [];
        if (jobCount > 0) msgParts.push(this.translate.instant('kanban.bomSubJobsCreated', { count: jobCount }));
        if (buyCount > 0) msgParts.push(this.translate.instant('kanban.bomBuyItems', { count: buyCount }));
        if (stockCount > 0) msgParts.push(this.translate.instant('kanban.bomStockItems', { count: stockCount }));
        this.snackbar.success(`${this.translate.instant('kanban.bomExploded')}: ${msgParts.join(', ')}.`);
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
      data: {
        jobId: j.id,
        jobNumber: j.jobNumber,
        currentDisposition: j.disposition,
      } satisfies DisposeJobDialogData,
    }).afterClosed().subscribe(result => {
      if (result) {
        this.job.set(result);
      }
    });
  }

  protected canDispose(disposition: string | null): boolean {
    return !disposition || disposition === 'HoldForReview';
  }

  protected formatDisposition(disposition: string): string {
    const keyMap: Record<string, string> = {
      ShipToCustomer: 'kanban.dispositionShipToCustomer',
      AddToInventory: 'kanban.dispositionAddToInventory',
      CapitalizeAsAsset: 'kanban.dispositionCapitalizeAsAsset',
      Scrap: 'kanban.dispositionScrap',
      HoldForReview: 'kanban.dispositionHoldForReview',
      EnteredInError: 'kanban.dispositionEnteredInError',
      Other: 'kanban.dispositionOther',
    };
    const key = keyMap[disposition];
    return key ? this.translate.instant(key) : disposition;
  }

  protected assignJob(user: UserRef | null): void {
    const j = this.job();
    if (!j) return;

    this.kanbanService.updateJob(j.id, { assigneeId: user?.id ?? null }).subscribe({
      next: () => {
        this.job.set({
          ...j,
          assigneeId: user?.id ?? null,
          assigneeInitials: user?.initials ?? null,
          assigneeName: user?.name ?? null,
          assigneeColor: user?.color ?? null,
        });
        this.snackbar.success(user ? this.translate.instant('kanban.assignedTo', { name: user.name }) : this.translate.instant('kanban.unassignedSuccess'));
      },
      error: () => this.snackbar.error(this.translate.instant('kanban.assignFailed')),
    });
  }

  protected moveToStage(stage: Stage): void {
    const j = this.job();
    if (!j || stage.id === j.currentStageId) return;
    this.kanbanService.moveJobStage(j.id, stage.id).subscribe(() => {
      this.job.set({ ...j, currentStageId: stage.id, stageName: stage.name, stageColor: stage.color });
      this.snackbar.success(this.translate.instant('kanban.movedToStage', { stage: stage.name }));
    });
  }

  protected onAllOperationsComplete(): void {
    const j = this.job();
    if (!j) return;
    const stages = this.availableStages();
    const index = stages.findIndex(st => st.id === j.currentStageId);
    const next = index >= 0 ? stages[index + 1] : undefined;
    if (!next) return;
    this.matDialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('jobOperations.moveTitle'),
        message: this.translate.instant('jobOperations.moveMessage', { stage: next.name }),
        confirmLabel: this.translate.instant('jobOperations.moveConfirm'),
        cancelLabel: this.translate.instant('jobOperations.moveLater'),
        severity: 'info',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) this.moveToStage(next);
    });
  }

  protected startTimerForJob(): void {
    const jobId = this.job()?.id;
    if (!jobId) return;
    this.isTimerLoading.set(true);
    this.timeTrackingService.startTimer({ jobId, category: 'Production' }).subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant('kanban.timerStarted'));
        this.kanbanService.getJobTimeEntries(jobId).subscribe(t => this.timeEntries.set(t));
        this.isTimerLoading.set(false);
      },
      error: () => this.isTimerLoading.set(false),
    });
  }

  protected stopTimerForJob(): void {
    const active = this.myActiveTimer();
    if (!active) return;
    this.isTimerLoading.set(true);
    this.timeTrackingService.stopTimer({ timeEntryId: active.id }).subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant('kanban.timerStopped'));
        const jobId = this.job()?.id;
        if (jobId) this.kanbanService.getJobTimeEntries(jobId).subscribe(t => this.timeEntries.set(t));
        this.isTimerLoading.set(false);
      },
      error: () => this.isTimerLoading.set(false),
    });
  }

  protected archiveJob(): void {
    const j = this.job();
    if (!j || j.isArchived) return;
    this.matDialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('jobDetailExtras.archiveTitle'),
        message: this.translate.instant('jobDetailExtras.archiveMessage', { jobNumber: j.jobNumber }),
        confirmLabel: this.translate.instant('jobDetailExtras.archiveConfirm'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.isArchiveSaving.set(true);
      this.kanbanService.bulkArchive([j.id]).subscribe({
        next: result => {
          this.isArchiveSaving.set(false);
          if (result.successCount > 0) {
            this.job.update(current => current ? { ...current, isArchived: true } : current);
            this.snackbar.success(this.translate.instant('jobDetailExtras.archived', { jobNumber: j.jobNumber }));
          } else {
            this.snackbar.error(this.translate.instant('jobDetailExtras.archiveFailed'));
          }
        },
        error: () => {
          this.isArchiveSaving.set(false);
          this.snackbar.error(this.translate.instant('jobDetailExtras.archiveFailed'));
        },
      });
    });
  }

  protected unarchiveJob(): void {
    const j = this.job();
    if (!j || !j.isArchived || !this.isAdmin()) return;
    this.matDialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('jobDetailExtras.unarchiveTitle'),
        message: this.translate.instant('jobDetailExtras.unarchiveMessage', { jobNumber: j.jobNumber }),
        confirmLabel: this.translate.instant('jobDetailExtras.unarchive'),
        severity: 'info',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.isArchiveSaving.set(true);
      this.kanbanService.unarchiveJob(j.id).subscribe({
        next: result => {
          this.isArchiveSaving.set(false);
          if (result.successCount > 0) {
            this.job.update(current => current ? { ...current, isArchived: false } : current);
            this.snackbar.success(this.translate.instant('jobDetailExtras.unarchived', { jobNumber: j.jobNumber }));
          } else {
            this.snackbar.error(this.translate.instant('jobDetailExtras.unarchiveFailed'));
          }
        },
        error: () => {
          this.isArchiveSaving.set(false);
          this.snackbar.error(this.translate.instant('jobDetailExtras.unarchiveFailed'));
        },
      });
    });
  }

  protected openCoverPhotoDialog(): void {
    const j = this.job();
    if (!j) return;
    this.matDialog.open(CoverPhotoUploadDialogComponent, {
      width: '520px',
      data: { jobId: j.id, currentCoverPhotoUrl: j.coverPhotoUrl ?? null } satisfies CoverPhotoDialogData,
    }).afterClosed().subscribe(result => {
      if (result !== undefined) {
        this.job.update(current => current ? { ...current, coverPhotoUrl: result?.coverPhotoUrl ?? null } : current);
      }
    });
  }



  protected close(): void {
    this.closed.emit();
  }
}
