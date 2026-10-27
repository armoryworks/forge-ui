import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, debounceTime, distinctUntilChanged, of, startWith, switchMap } from 'rxjs';

import { CustomerReturnService } from '../../services/customer-return.service';
import { CustomerReturnDetail } from '../../models/customer-return-detail.model';
import { ChannelReturnOrder } from '../../models/channel-return-order.model';
import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { DraftConfig } from '../../../../shared/models/draft-config.model';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toIsoDate, todayEnd } from '../../../../shared/utils/date.utils';

@Component({
  selector: 'app-customer-return-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogComponent, InputComponent, TextareaComponent, DatepickerComponent,
    EntityPickerComponent, ToggleComponent, ValidationButtonComponent, TranslatePipe,
    SelectComponent, CurrencyInputComponent,
  ],
  templateUrl: './customer-return-dialog.component.html',
  styleUrl: './customer-return-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerReturnDialogComponent {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;
  private readonly service = inject(CustomerReturnService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly capability = inject(CapabilityService);

  readonly returnDetail = input<CustomerReturnDetail | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);
  /** Phase 1l — return-date is when the customer returned the item;
   *  future dates make no sense. [max]=today is safe even on edit. */
  protected readonly today = todayEnd();

  protected readonly returnForm = new FormGroup({
    customerId: new FormControl<number | null>(null, [Validators.required]),
    originalJobId: new FormControl<number | null>(null, [Validators.required]),
    quantity: new FormControl<number | null>(null, [Validators.required, Validators.min(0.0001)]),
    reason: new FormControl('', [Validators.required, Validators.maxLength(500)]),
    notes: new FormControl(''),
    returnDate: new FormControl<Date | null>(new Date(), [Validators.required]),
    createReworkJob: new FormControl<boolean>(false, { nonNullable: true }),
    salesOrderId: new FormControl<number | null>({ value: null, disabled: true }, [Validators.required]),
    salesOrderLineId: new FormControl<number | null>({ value: null, disabled: true }),
    externalRmaId: new FormControl<string>({ value: '', disabled: true }, { nonNullable: true, validators: [Validators.maxLength(200)] }),
    channelQuantity: new FormControl<number | null>({ value: null, disabled: true }, [Validators.min(0.0001)]),
    refundAmount: new FormControl<number | null>({ value: null, disabled: true }, [Validators.min(0)]),
  });

  /** Direct = an RMA we authorise against a job; Channel = a return a sales channel already approved. */
  protected readonly sourceControl = new FormControl<'Direct' | 'Channel'>('Direct', { nonNullable: true });
  protected readonly channelSearch = new FormControl<string>('', { nonNullable: true });
  protected readonly canUseChannel = computed(() => !this.isEditing && this.capability.isEnabled('CAP-O2C-RETAIL'));
  protected readonly source = toSignal(this.sourceControl.valueChanges, { initialValue: this.sourceControl.value });
  protected readonly sourceOptions: SelectOption[] = [
    { value: 'Direct', label: this.translate.instant('customerReturns.sourceDirect') },
    { value: 'Channel', label: this.translate.instant('customerReturns.sourceChannel') },
  ];
  protected readonly channelOrders = signal<ChannelReturnOrder[]>([]);
  protected readonly channelOrderOptions = computed<SelectOption[]>(() => this.channelOrders().map(o => ({
    value: o.salesOrderId,
    label: [o.orderNumber, o.channelName, o.externalOrderNumber, o.buyerName].filter(Boolean).join(' · '),
  })));
  private readonly selectedOrderId = signal<number | null>(null);
  protected readonly selectedOrder = computed(() =>
    this.channelOrders().find(o => o.salesOrderId === this.selectedOrderId()) ?? null);
  protected readonly lineOptions = computed<SelectOption[]>(() => (this.selectedOrder()?.lines ?? []).map(l => ({
    value: l.id,
    label: `#${l.lineNumber} ${l.partNumber ? l.partNumber + ' — ' : ''}${l.description} (${l.quantity})`,
  })));

  private readonly selectedCustomerId = toSignal(this.returnForm.controls.customerId.valueChanges, {
    initialValue: this.returnForm.controls.customerId.value,
  });
  protected readonly jobFilters = computed(() => {
    const customerId = this.selectedCustomerId();
    const filters: Record<string, string> = { includeArchived: 'true' };
    if (customerId != null) filters['customerId'] = String(customerId);
    return filters;
  });

  protected readonly violations = FormValidationService.getViolations(this.returnForm, {
    customerId: 'Customer',
    originalJobId: 'Original Job',
    quantity: this.translate.instant('customerReturns.fieldQuantity'),
    reason: 'Reason',
    returnDate: 'Return Date',
    salesOrderId: this.translate.instant('customerReturns.channelOrder'),
    externalRmaId: this.translate.instant('customerReturns.externalRmaId'),
    channelQuantity: this.translate.instant('customerReturns.fieldQuantity'),
    refundAmount: this.translate.instant('customerReturns.refundAmount'),
  });

  protected get draftConfig(): DraftConfig {
    return {
      entityType: 'customer-return',
      entityId: this.returnDetail()?.id?.toString() ?? 'new',
      route: '/customer-returns',
    };
  }

  constructor() {
    this.returnForm.controls.customerId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.returnForm.controls.originalJobId.setValue(null);
    });
    this.sourceControl.valueChanges.pipe(takeUntilDestroyed()).subscribe(source => this.applySource(source));
    this.returnForm.controls.salesOrderId.valueChanges.pipe(takeUntilDestroyed()).subscribe(id => {
      this.selectedOrderId.set(id);
      const lines = this.channelOrders().find(o => o.salesOrderId === id)?.lines ?? [];
      this.returnForm.controls.salesOrderLineId.setValue(lines.length === 1 ? lines[0].id : null);
    });
    this.channelSearch.valueChanges.pipe(
      startWith(''),
      debounceTime(250),
      distinctUntilChanged(),
      switchMap(term => this.sourceControl.value === 'Channel'
        ? this.service.getChannelOrders(term.trim() || undefined).pipe(catchError(() => of([] as ChannelReturnOrder[])))
        : of(null)),
      takeUntilDestroyed(),
    ).subscribe(orders => {
      if (orders) this.channelOrders.set(orders);
    });
    const r = this.returnDetail();
    if (r) {
      this.returnForm.controls.quantity.disable();
      this.returnForm.patchValue({
        customerId: r.customerId,
        originalJobId: r.originalJobId,
        reason: r.reason,
        notes: r.notes ?? '',
        returnDate: r.returnDate ?? null,
        quantity: r.quantity ?? null,
      });
    }
  }

  protected get isEditing(): boolean {
    return this.returnDetail() !== null;
  }

  private applySource(source: 'Direct' | 'Channel'): void {
    const c = this.returnForm.controls;
    const direct = [c.customerId, c.originalJobId, c.quantity, c.createReworkJob];
    const channel = [c.salesOrderId, c.salesOrderLineId, c.externalRmaId, c.channelQuantity, c.refundAmount];
    for (const ctrl of source === 'Channel' ? direct : channel) ctrl.disable({ emitEvent: false });
    for (const ctrl of source === 'Channel' ? channel : direct) ctrl.enable({ emitEvent: false });
    this.returnForm.updateValueAndValidity();
    if (source === 'Channel' && this.channelOrders().length === 0) {
      this.service.getChannelOrders().pipe(catchError(() => of([] as ChannelReturnOrder[])))
        .subscribe(orders => this.channelOrders.set(orders));
    }
  }

  protected close(): void {
    this.closed.emit();
  }

  protected save(): void {
    if (this.returnForm.invalid) return;
    this.saving.set(true);
    const f = this.returnForm.getRawValue();
    const r = this.returnDetail();

    if (!r && this.sourceControl.value === 'Channel') {
      this.service.createChannel({
        salesOrderId: f.salesOrderId!,
        salesOrderLineId: f.salesOrderLineId,
        externalRmaId: f.externalRmaId.trim() || null,
        reason: f.reason!,
        notes: f.notes || null,
        quantity: f.channelQuantity,
        refundAmount: f.refundAmount,
        returnDate: f.returnDate ? toIsoDate(f.returnDate) : null,
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.dialogRef.clearDraft();
          this.snackbar.success(this.translate.instant('customerReturns.channelCreated'));
          this.saved.emit();
        },
        error: () => this.saving.set(false),
      });
      return;
    }

    if (r) {
      this.service.update(r.id, {
        reason: f.reason ?? undefined,
        notes: f.notes ?? undefined,
        returnDate: f.returnDate ? (toIsoDate(f.returnDate) ?? undefined) : undefined,
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.dialogRef.clearDraft();
          this.snackbar.success(this.translate.instant('customerReturns.updated'));
          this.saved.emit();
        },
        error: () => this.saving.set(false),
      });
    } else {
      this.service.create({
        customerId: f.customerId!,
        originalJobId: f.originalJobId!,
        reason: f.reason!,
        notes: f.notes || undefined,
        returnDate: toIsoDate(f.returnDate ?? new Date()) ?? '',
        quantity: f.quantity ?? undefined,
        createReworkJob: f.createReworkJob,
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.dialogRef.clearDraft();
          this.snackbar.success(this.translate.instant('customerReturns.created'));
          this.saved.emit();
        },
        error: () => this.saving.set(false),
      });
    }
  }
}
