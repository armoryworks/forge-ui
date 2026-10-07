import {
  ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject,
  input, OnInit, output, signal, untracked, ViewChild, viewChild,
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
import { SoLineAutoFill } from '../models/so-line-auto-fill.model';
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
import { PartsService } from '../../parts/services/parts.service';

export type DialogMode = 'create' | 'edit';

const EMPTY_AUTO_FILL: SoLineAutoFill = {
  salesOrderId: null, partId: null, quantity: null, title: null, customerId: null, dueDate: null,
};

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
  private readonly partPicker = viewChild(EntityPickerComponent);
  private readonly kanbanService = inject(KanbanService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly manualNumbers = inject(ManualNumberSettingsService);
  private readonly salesOrderService = inject(SalesOrderService);
  private readonly partsService = inject(PartsService);

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
  private autoFilled: SoLineAutoFill = { ...EMPTY_AUTO_FILL };
  private restoringDraft = false;
  private readonly partLabel = signal<{ id: number; text: string } | null>(null);

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
    quantity: new FormControl<number | null>({ value: 1, disabled: true }, [Validators.min(0.0001)]),
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
    title: this.translate.instant('kanban.jobTitle'),
    trackTypeId: this.translate.instant('kanban.trackType'),
    quantity: this.translate.instant('kanban.quantityToMake'),
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
      restoreFn: data => this.restoreDraft(data),
    };
  }

  private readonly partLabelEffect = effect(() => {
    const picker = this.partPicker();
    const label = this.partLabel();
    if (!picker || !label) return;
    untracked(() => {
      if (this.jobForm.controls.partId.value === label.id) picker.setSelected(label.id, label.text);
    });
  });

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

  private restoreDraft(data: Record<string, unknown>): void {
    this.restoringDraft = true;
    this.jobForm.patchValue(data);
    this.restoringDraft = false;
    const partId = this.jobForm.controls.partId.value;
    if (partId == null) return;
    this.partsService.getPartById(partId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: part => this.partLabel.set({ id: partId, text: part.partNumber }),
        error: () => this.setPart(null, null),
      });
  }

  private setPart(partId: number | null, label: string | null): void {
    this.partLabel.set(partId != null && label ? { id: partId, text: label } : null);
    this.jobForm.controls.partId.setValue(partId);
  }

  private holdsAuto<T>(value: T | null, auto: T | null): boolean {
    return auto != null && value === auto;
  }

  private holdsAutoDate(value: Date | null, auto: number | null): boolean {
    return auto != null && value != null && value.getTime() === auto;
  }

  private quantityReplaceable(): boolean {
    const quantity = this.jobForm.controls.quantity;
    return quantity.value == null || !quantity.dirty;
  }

  private lineTitle(line: AssignableSalesOrderLine, partName: string | null = null): string {
    const name = partName || line.description;
    return line.partNumber ? `${line.partNumber} — ${name}` : name;
  }

  private applySoLineDefaults(lineId: number | null): void {
    if (this.restoringDraft) return;
    const line = lineId == null ? undefined : this.salesOrderLines().find(l => l.id === lineId);
    const controls = this.jobForm.controls;
    const previous = this.autoFilled;
    this.autoFilled = { ...EMPTY_AUTO_FILL };

    if (!line) {
      if (this.holdsAuto(controls.partId.value, previous.partId)) this.setPart(null, null);
      if (controls.partId.value != null && this.holdsAuto(controls.quantity.value, previous.quantity)
        && this.quantityReplaceable()) {
        controls.quantity.setValue(1);
      }
      if (this.holdsAuto(controls.title.value?.trim() ?? '', previous.title)) controls.title.setValue('');
      if (this.holdsAuto(controls.customerId.value, previous.customerId)) controls.customerId.setValue(null);
      if (this.holdsAutoDate(controls.dueDate.value, previous.dueDate)) controls.dueDate.setValue(null);
      this.filledFromSoLine.set(false);
      return;
    }

    let filled = false;
    this.autoFilled.salesOrderId = line.salesOrderId;

    if (controls.partId.value == null || this.holdsAuto(controls.partId.value, previous.partId)) {
      if (line.partId != null) {
        this.setPart(line.partId, line.partNumber);
        this.autoFilled.partId = line.partId;
        filled = true;
      } else if (controls.partId.value != null) {
        this.setPart(null, null);
      }
    }

    if (controls.partId.value != null && this.quantityReplaceable()) {
      const remaining = line.remainingQuantity;
      if (controls.partId.value === line.partId && remaining != null && remaining > 0) {
        controls.quantity.setValue(remaining);
        this.autoFilled.quantity = remaining;
        filled = true;
      } else if (this.holdsAuto(controls.quantity.value, previous.quantity)) {
        controls.quantity.setValue(1);
      }
    }

    const currentTitle = controls.title.value?.trim() ?? '';
    if (currentTitle === '' || this.holdsAuto(currentTitle, previous.title)) {
      const title = this.lineTitle(line);
      controls.title.setValue(title);
      this.autoFilled.title = title || null;
      if (title) filled = true;
    }

    const lineDue = this.utcCalendarDate(line.requestedDeliveryDate);
    const dueReplaceable = controls.dueDate.value == null || this.holdsAutoDate(controls.dueDate.value, previous.dueDate);
    if (dueReplaceable) {
      controls.dueDate.setValue(lineDue);
      this.autoFilled.dueDate = lineDue?.getTime() ?? null;
      if (lineDue) filled = true;
    }

    const customerIsAuto = this.holdsAuto(controls.customerId.value, previous.customerId);
    if (customerIsAuto && previous.salesOrderId === line.salesOrderId) {
      this.autoFilled.customerId = previous.customerId;
      filled = true;
    } else if (customerIsAuto) {
      controls.customerId.setValue(null);
    }

    this.filledFromSoLine.set(filled);

    if (line.partId != null && this.autoFilled.title != null) this.applyPartNameToTitle(line);

    if (controls.customerId.value != null && controls.dueDate.value != null) return;
    this.salesOrderService.getSalesOrderById(line.salesOrderId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: so => {
          if (controls.salesOrderLineId.value !== line.id) return;
          let soFilled = false;
          if (controls.customerId.value == null && so.customerId != null) {
            controls.customerId.setValue(so.customerId);
            this.autoFilled.customerId = so.customerId;
            soFilled = true;
          }
          if (controls.dueDate.value == null && so.requestedDeliveryDate) {
            const due = this.utcCalendarDate(so.requestedDeliveryDate);
            controls.dueDate.setValue(due);
            this.autoFilled.dueDate = due?.getTime() ?? null;
            soFilled = true;
          }
          if (soFilled) this.filledFromSoLine.set(true);
        },
        error: () => this.filledFromSoLine.set(filled),
      });
  }

  private applyPartNameToTitle(line: AssignableSalesOrderLine): void {
    this.partsService.getPartById(line.partId!)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: part => {
          const controls = this.jobForm.controls;
          if (controls.salesOrderLineId.value !== line.id || !part.name) return;
          if (!this.holdsAuto(controls.title.value?.trim() ?? '', this.autoFilled.title)) return;
          const title = this.lineTitle(line, part.name);
          controls.title.setValue(title);
          this.autoFilled.title = title;
        },
        error: () => undefined,
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

  private submittedQuantity(partId: number | null, lineId: number | null, quantity: number | null): number | null {
    if (partId == null) return null;
    const control = this.jobForm.controls.quantity;
    if (lineId != null && !control.dirty && this.holdsAuto(quantity, this.autoFilled.quantity)) return null;
    return quantity ?? 1;
  }

  protected onSubmit(): void {
    if (this.jobForm.invalid) return;

    this.saving.set(true);

    const f = this.jobForm.getRawValue();
    const dueDateIso = toIsoDate(f.dueDate);

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
        quantity: this.submittedQuantity(f.partId, f.salesOrderLineId, f.quantity),
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
            dueDate: dueDateIso ? new Date(dueDateIso) : null,
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
