import {
  ChangeDetectionStrategy, Component, computed, inject,
  input, OnDestroy, OnInit, output, signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { KanbanService } from '../services/kanban.service';
import { JobDetail } from '../models/job-detail.model';
import { CustomerRef } from '../models/customer-ref.model';
import { UserRef } from '../models/user-ref.model';
import { TrackType } from '../../../shared/models/track-type.model';
import { InputComponent } from '../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../shared/components/datepicker/datepicker.component';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { DirtyFormIndicatorComponent } from '../../../shared/components/dirty-form-indicator/dirty-form-indicator.component';
import { DraftRecoveryBannerComponent } from '../../../shared/components/draft-recovery-banner/draft-recovery-banner.component';
import { FormValidationService } from '../../../shared/services/form-validation.service';
import { DraftService } from '../../../shared/services/draft.service';
import { ValidationPopoverDirective } from '../../../shared/directives/validation-popover.directive';
import { DraftableForm } from '../../../shared/models/draftable-form.model';
import { toIsoDate } from '../../../shared/utils/date.utils';
import { PRIORITIES, PRIORITY_OPTIONS } from '../../../shared/models/priority.const';

export type DialogMode = 'create' | 'edit';

@Component({
  selector: 'app-job-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    InputComponent,
    SelectComponent,
    TextareaComponent,
    DatepickerComponent,
    DirtyFormIndicatorComponent,
    DraftRecoveryBannerComponent,
    ValidationPopoverDirective,
    TranslatePipe,
  ],
  templateUrl: './job-dialog.component.html',
  styleUrl: './job-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobDialogComponent implements DraftableForm, OnInit, OnDestroy {
  private readonly kanbanService = inject(KanbanService);
  private readonly translate = inject(TranslateService);
  protected readonly draftService = inject(DraftService);

  readonly mode = input.required<DialogMode>();
  readonly job = input<JobDetail | null>(null);
  readonly trackTypes = input.required<TrackType[]>();

  readonly saved = output<JobDetail>();
  readonly cancelled = output<void>();

  protected readonly customers = signal<CustomerRef[]>([]);
  protected readonly users = signal<UserRef[]>([]);
  protected readonly saving = signal(false);
  protected readonly loadingRefs = signal(true);
  protected readonly priorities = PRIORITIES;
  protected readonly restoredDraftTimestamp = signal<number | null>(null);

  protected readonly jobForm = new FormGroup({
    title: new FormControl('', [Validators.required, Validators.maxLength(200)]),
    description: new FormControl(''),
    trackTypeId: new FormControl<number>(0, [Validators.required]),
    customerId: new FormControl<number | null>(null),
    assigneeId: new FormControl<number | null>(null),
    priority: new FormControl('Normal'),
    dueDate: new FormControl<Date | null>(null),
  });

  protected readonly violations = FormValidationService.getViolations(this.jobForm, {
    title: 'Title',
    trackTypeId: 'Track Type',
  });

  protected readonly trackTypeOptions = computed<SelectOption[]>(() =>
    this.trackTypes().map(tt => ({ value: tt.id, label: tt.name }))
  );

  protected readonly customerOptions = computed<SelectOption[]>(() => [
    { value: null, label: this.translate.instant('kanban.noneOption') },
    ...this.customers().map(c => ({ value: c.id, label: c.name })),
  ]);

  protected readonly assigneeOptions = computed<SelectOption[]>(() => [
    { value: null, label: this.translate.instant('kanban.unassignedOption') },
    ...this.users().map(u => ({
      value: u.id,
      label: u.canBeAssignedJobs ? u.name : `⚠ ${u.name} (${this.translate.instant('kanban.incompleteProfile')})`,
    })),
  ]);

  protected readonly priorityOptions = PRIORITY_OPTIONS;

  // -- DraftableForm interface --
  get entityType(): string { return 'job'; }
  get entityId(): string { return this.job()?.id?.toString() ?? 'new'; }
  get displayLabel(): string {
    const j = this.job();
    return j ? `Job #${j.jobNumber} - Edit` : 'New Job';
  }
  get route(): string { return '/board'; }
  get form(): FormGroup { return this.jobForm; }
  isDirty(): boolean { return this.jobForm.dirty; }
  getFormSnapshot(): Record<string, unknown> { return this.jobForm.getRawValue(); }
  restoreDraft(data: Record<string, unknown>): void {
    this.jobForm.patchValue(data);
    this.jobForm.markAsDirty();
  }

  ngOnInit(): void {
    const j = this.job();
    if (j) {
      this.jobForm.patchValue({
        title: j.title,
        description: j.description ?? '',
        trackTypeId: j.trackTypeId,
        customerId: j.customerId,
        assigneeId: j.assigneeId,
        priority: j.priority,
        dueDate: j.dueDate ?? null,
      });
    } else {
      const types = this.trackTypes();
      const defaultType = types.find(t => t.isDefault) ?? types[0];
      if (defaultType) {
        this.jobForm.patchValue({ trackTypeId: defaultType.id });
      }
    }

    // Check for existing draft
    this.draftService.loadDraft(this.entityType, this.entityId).then(draft => {
      if (draft) {
        this.restoreDraft(draft.formData);
        this.restoredDraftTimestamp.set(draft.lastModified);
      }
    });

    // Register for auto-save
    this.draftService.register(this);

    forkJoin({
      customers: this.kanbanService.getCustomers(),
      users: this.kanbanService.getUsers(),
    }).subscribe(({ customers, users }) => {
      this.customers.set(customers);
      this.users.set(users);
      this.loadingRefs.set(false);
    });
  }

  ngOnDestroy(): void {
    this.draftService.unregister(this.entityType, this.entityId);
  }

  protected onSubmit(): void {
    if (this.jobForm.invalid) return;

    this.saving.set(true);

    const f = this.jobForm.getRawValue();
    const dueDateIso = toIsoDate(f.dueDate);
    const dueDateObj = f.dueDate ?? null;

    if (this.mode() === 'create') {
      this.kanbanService.createJob({
        title: f.title!.trim(),
        description: f.description || undefined,
        trackTypeId: f.trackTypeId!,
        assigneeId: f.assigneeId,
        customerId: f.customerId,
        priority: f.priority ?? 'Normal',
        dueDate: dueDateIso,
      }).subscribe({
        next: (detail) => {
          this.saving.set(false);
          this.draftService.clearDraftAndBroadcastSave(this.entityType, this.entityId);
          this.saved.emit(detail);
        },
        error: () => this.saving.set(false),
      });
    } else {
      const jobId = this.job()!.id;
      this.kanbanService.updateJob(jobId, {
        title: f.title!.trim(),
        description: f.description || null,
        assigneeId: f.assigneeId,
        customerId: f.customerId,
        priority: f.priority ?? 'Normal',
        dueDate: dueDateObj,
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.draftService.clearDraftAndBroadcastSave(this.entityType, this.entityId);
          const updated: JobDetail = {
            ...this.job()!,
            title: f.title!.trim(),
            description: f.description || null,
            assigneeId: f.assigneeId,
            customerId: f.customerId,
            priority: f.priority ?? 'Normal',
            dueDate: dueDateObj,
          };
          this.saved.emit(updated);
        },
        error: () => this.saving.set(false),
      });
    }
  }

  protected cancel(): void {
    this.cancelled.emit();
  }
}
