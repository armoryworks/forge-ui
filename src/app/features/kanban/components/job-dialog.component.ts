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
import { EntityPickerComponent } from '../../../shared/components/entity-picker/entity-picker.component';
import { FormValidationService } from '../../../shared/services/form-validation.service';
import { ValidationButtonComponent } from '../../../shared/components/validation-button/validation-button.component';
import { DraftConfig } from '../../../shared/models/draft-config.model';
import { ManualNumberSettingsService } from '../../../shared/services/manual-number-settings.service';
import { toIsoDate } from '../../../shared/utils/date.utils';
import { PriorityIndicatorComponent } from '../../../shared/components/priority-indicator/priority-indicator.component';
import { PRIORITIES, PRIORITY_OPTIONS } from '../../../shared/models/priority.const';
import { SalesOrderService } from '../../sales-orders/services/sales-order.service';

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
    EntityPickerComponent,
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
  @ViewChild(EntityPickerComponent) private partPicker?: EntityPickerComponent;
  private readonly kanbanService = inject(KanbanService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly manualNumbers = inject(ManualNumberSettingsService);
  private readonly salesOrderService = inject(SalesOrderService);

  /** Whether the tenant allows manually assigning/overriding job numbers. */
  protected readonly allowManualJobNumbers = computed(() => this.manualNumbers.isEnabled('jobs'));

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
  protected readonly filledFromSoLine = signal(false);
  private autoTitle: string | null = null;

  protected readonly jobForm = new FormGroup({
    jobNumber: new FormControl(''),
    title: new FormControl('', [Validators.required, Validators.maxLength(200)]),
    description: new FormControl(''),
    trackTypeId: new FormControl<number>(0, [Validators.required]),
    customerId: new FormControl<number | null>(null),
    assigneeId: new FormControl<number | null>(null),
    priority: new FormControl('Normal'),
    dueDate: new FormControl<Date | null>(null),
    salesOrderLineId: new FormControl<number | null>(null),
    partId: new FormControl<number | null>(null),
    quantity: new FormControl<number | null>({ value: 1, disabled: true }, [Validators.min(1)]),
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
    quantity: 'Quantity to make',
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
        jobNumber: j.jobNumber,
        title: j.title,
        description: j.description ?? '',
        trackTypeId: j.trackTypeId,
        customerId: j.customerId,
        assigneeId: j.assigneeId,
        priority: j.priority,
        dueDate: this.utcCalendarDate(j.dueDate),
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
      this.jobForm.controls.partId.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(partId => this.syncQuantityEnabled(partId));
      this.jobForm.controls.salesOrderLineId.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(lineId => this.applySoLineDefaults(lineId));
    }
  }

  private syncQuantityEnabled(partId: number | null): void {
    const quantity = this.jobForm.controls.quantity;
    if (partId == null) {
      quantity.reset(1);
      quantity.disable({ emitEvent: false });
    } else if (quantity.disabled) {
      if (quantity.value == null) quantity.setValue(1);
      quantity.enable({ emitEvent: false });
    }
  }

  private applySoLineDefaults(lineId: number | null): void {
    const line = lineId == null ? undefined : this.salesOrderLines().find(l => l.id === lineId);
    if (!line) {
      this.filledFromSoLine.set(false);
      return;
    }

    const controls = this.jobForm.controls;
    let filled = false;

    if (controls.partId.value == null && line.partId != null) {
      if (this.partPicker) {
        this.partPicker.setSelected(line.partId, line.partNumber ?? '');
      } else {
        controls.partId.setValue(line.partId);
      }
      filled = true;
    }

    if (controls.partId.value != null && line.remainingQuantity != null && line.remainingQuantity > 0
      && (controls.quantity.value == null || !controls.quantity.dirty)) {
      controls.quantity.setValue(line.remainingQuantity);
      filled = true;
    }

    const title = line.partNumber ? `${line.partNumber} — ${line.description}` : line.description;
    const currentTitle = controls.title.value?.trim() ?? '';
    if (title && (currentTitle === '' || currentTitle === this.autoTitle)) {
      controls.title.setValue(title);
      this.autoTitle = title;
      filled = true;
    }

    if (controls.dueDate.value == null && line.requestedDeliveryDate) {
      controls.dueDate.setValue(this.utcCalendarDate(line.requestedDeliveryDate));
      filled = true;
    }

    this.filledFromSoLine.set(filled);

    if (controls.customerId.value != null && controls.dueDate.value != null) return;
    this.salesOrderService.getSalesOrderById(line.salesOrderId).subscribe({
      next: so => {
        if (controls.salesOrderLineId.value !== line.id) return;
        let soFilled = false;
        if (controls.customerId.value == null && so.customerId != null) {
          controls.customerId.setValue(so.customerId);
          soFilled = true;
        }
        if (controls.dueDate.value == null && so.requestedDeliveryDate) {
          controls.dueDate.setValue(this.utcCalendarDate(so.requestedDeliveryDate));
          soFilled = true;
        }
        if (soFilled) this.filledFromSoLine.set(true);
      },
      error: () => this.filledFromSoLine.set(filled),
    });
  }

  private utcCalendarDate(value: Date | string | null | undefined): Date | null {
    if (!value) return null;
    const d = typeof value === 'string' ? new Date(value) : value;
    if (isNaN(d.getTime())) return null;
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
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
        jobNumber: this.allowManualJobNumbers() ? (f.jobNumber?.trim() || undefined) : undefined,
        title: f.title!.trim(),
        description: f.description || undefined,
        trackTypeId: f.trackTypeId!,
        assigneeId: f.assigneeId,
        customerId: f.customerId,
        priority: f.priority ?? 'Normal',
        dueDate: dueDateIso,
        salesOrderLineId: f.salesOrderLineId,
        partId: f.partId,
        quantity: f.partId != null ? (f.quantity ?? 1) : null,
      }).subscribe({
        next: (detail) => {
          this.saving.set(false);
          this.dialogRef.clearDraft();
          this.saved.emit(detail);
        },
        error: () => this.saving.set(false),
      });
    } else {
      const current = this.job()!;
      const jobId = current.id;
      // JobNumber is editable only while the job is not disposed/closed.
      const canRenumber = this.allowManualJobNumbers() && !current.disposition;
      const nextJobNumber = canRenumber ? (f.jobNumber?.trim() || current.jobNumber) : current.jobNumber;
      this.kanbanService.updateJob(jobId, {
        jobNumber: canRenumber ? (f.jobNumber?.trim() || undefined) : undefined,
        title: f.title!.trim(),
        description: f.description || null,
        assigneeId: f.assigneeId,
        customerId: f.customerId,
        priority: f.priority ?? 'Normal',
        dueDate: dueDateIso,
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.dialogRef.clearDraft();
          const updated: JobDetail = {
            ...current,
            jobNumber: nextJobNumber,
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
