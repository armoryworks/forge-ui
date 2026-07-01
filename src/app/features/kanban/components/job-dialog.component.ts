import {
  ChangeDetectionStrategy, Component, computed, DestroyRef, inject,
  input, OnInit, output, signal, ViewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { KanbanService } from '../services/kanban.service';
import { JobDetail } from '../models/job-detail.model';
import { CustomerRef } from '../models/customer-ref.model';
import { UserRef } from '../models/user-ref.model';
import { AssignableSalesOrderLine } from '../models/assignable-sales-order-line.model';
import { TrackType } from '../../../shared/models/track-type.model';
import { InputComponent } from '../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../shared/components/datepicker/datepicker.component';
import { ToggleComponent } from '../../../shared/components/toggle/toggle.component';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { FormValidationService } from '../../../shared/services/form-validation.service';
import { ValidationButtonComponent } from '../../../shared/components/validation-button/validation-button.component';
import { DraftConfig } from '../../../shared/models/draft-config.model';
import { toIsoDate } from '../../../shared/utils/date.utils';
import { PriorityIndicatorComponent } from '../../../shared/components/priority-indicator/priority-indicator.component';
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
    ToggleComponent,
    ValidationButtonComponent,
    PriorityIndicatorComponent,
    TranslatePipe,
  ],
  templateUrl: './job-dialog.component.html',
  styleUrl: './job-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobDialogComponent implements OnInit {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;
  private readonly kanbanService = inject(KanbanService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

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

  // #27 — inline association of the new job with an open sales-order line.
  protected readonly salesOrderLines = signal<AssignableSalesOrderLine[]>([]);
  protected readonly showAssignedControl = new FormControl(false, { nonNullable: true });

  protected readonly jobForm = new FormGroup({
    title: new FormControl('', [Validators.required, Validators.maxLength(200)]),
    description: new FormControl(''),
    trackTypeId: new FormControl<number>(0, [Validators.required]),
    customerId: new FormControl<number | null>(null),
    assigneeId: new FormControl<number | null>(null),
    priority: new FormControl('Normal'),
    dueDate: new FormControl<Date | null>(null),
    salesOrderLineId: new FormControl<number | null>(null),
  });

  protected readonly salesOrderLineOptions = computed<SelectOption[]>(() => [
    { value: null, label: this.translate.instant('kanban.noneOption') },
    ...this.salesOrderLines().map(l => ({
      value: l.id,
      label: l.assignedJobCount > 0
        ? `${l.orderNumber} · L${l.lineNumber} — ${l.description} · ${this.translate.instant('kanban.alreadyAssigned')}`
        : `${l.orderNumber} · L${l.lineNumber} — ${l.description}`,
    })),
  ]);

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

  /** Live preview of the picked priority for the shape/color indicator next to the select. */
  protected readonly priorityPreview = toSignal(
    this.jobForm.controls.priority.valueChanges,
    { initialValue: this.jobForm.controls.priority.value },
  );

  protected get draftConfig(): DraftConfig {
    return {
      entityType: 'job',
      entityId: this.job()?.id?.toString() ?? 'new',
      route: '/board',
    };
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

    forkJoin({
      customers: this.kanbanService.getCustomers(),
      users: this.kanbanService.getUsers(),
    }).subscribe(({ customers, users }) => {
      this.customers.set(customers);
      this.users.set(users);
      this.loadingRefs.set(false);
    });

    // #27 — SO-line association is offered only when creating a job. Default to the
    // unassigned lines; the toggle reloads to include already-assigned lines.
    if (this.mode() === 'create') {
      this.loadAssignableSoLines(false);
      this.showAssignedControl.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(show => this.loadAssignableSoLines(show));
    }
  }

  private loadAssignableSoLines(includeAssigned: boolean): void {
    this.kanbanService.getAssignableSalesOrderLines(includeAssigned).subscribe({
      next: lines => {
        this.salesOrderLines.set(lines);
        // If the currently-selected line dropped out of the narrowed list, clear it.
        const selected = this.jobForm.controls.salesOrderLineId.value;
        if (selected != null && !lines.some(l => l.id === selected)) {
          this.jobForm.controls.salesOrderLineId.setValue(null);
        }
      },
      error: () => { /* picker stays empty; global interceptor surfaces hard errors */ },
    });
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
        salesOrderLineId: f.salesOrderLineId,
      }).subscribe({
        next: (detail) => {
          this.saving.set(false);
          this.dialogRef.clearDraft();
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
          this.dialogRef.clearDraft();
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
    if (this.mode() === 'create') {
      this.dialogRef.clearDraft();
    }
    this.cancelled.emit();
  }
}
