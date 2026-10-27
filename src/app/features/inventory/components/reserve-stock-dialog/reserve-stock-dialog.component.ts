import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';

import { catchError, forkJoin, of, startWith, switchMap } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { InventoryService } from '../../services/inventory.service';
import { PartBinLocation } from '../../models/part-bin-location.model';
import { ReservableSalesOrderLine } from '../../models/reservable-sales-order-line.model';
import { Reservation } from '../../models/reservation.model';
import { ReservationDemand } from '../../models/reservation-demand.type';

/**
 * Sets stock in one bin aside for a job or for a sales order line. Opened from the inventory
 * reservations tab, or from a sales order line with the part and line already chosen.
 */
@Component({
  selector: 'app-reserve-stock-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, EntityPickerComponent, InputComponent, SelectComponent, TextareaComponent, ValidationButtonComponent],
  templateUrl: './reserve-stock-dialog.component.html',
  styleUrl: './reserve-stock-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReserveStockDialogComponent implements OnInit {
  private readonly inventoryService = inject(InventoryService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);

  readonly partId = input<number | null>(null);
  readonly partLabel = input<string | null>(null);
  readonly salesOrderId = input<number | null>(null);
  readonly salesOrderLineId = input<number | null>(null);
  readonly quantity = input<number | null>(null);

  readonly closed = output<void>();
  readonly saved = output<Reservation>();

  protected readonly saving = signal(false);
  protected readonly binsLoading = signal(false);
  protected readonly bins = signal<PartBinLocation[]>([]);
  protected readonly salesOrderLines = signal<ReservableSalesOrderLine[]>([]);

  protected readonly form = new FormGroup({
    partId: new FormControl<number | null>(null, [Validators.required]),
    binContentId: new FormControl<number | null>(null, [Validators.required]),
    demand: new FormControl<ReservationDemand>('none', { nonNullable: true }),
    jobId: new FormControl<number | null>(null),
    salesOrderLineId: new FormControl<number | null>(null),
    quantity: new FormControl<number | null>(null, [Validators.required, Validators.min(0.001)]),
    notes: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    partId: this.translate.instant('replenishmentUi.part'),
    binContentId: this.translate.instant('replenishmentUi.bin'),
    salesOrderLineId: this.translate.instant('inventoryScreens.reserve.salesOrderLine'),
    jobId: this.translate.instant('inventoryScreens.reserve.job'),
    quantity: this.translate.instant('common.quantity'),
  });

  private readonly demandValue = toSignal(this.form.controls.demand.valueChanges.pipe(startWith(this.form.controls.demand.value)), { initialValue: 'none' as ReservationDemand });
  private readonly partValue = toSignal(this.form.controls.partId.valueChanges.pipe(startWith(this.form.controls.partId.value)), { initialValue: null });

  protected readonly partLocked = computed(() => this.partId() != null);
  protected readonly demand = this.demandValue;

  protected readonly demandOptions: SelectOption[] = [
    { value: 'none', label: this.translate.instant('inventoryScreens.reserve.forNothing') },
    { value: 'job', label: this.translate.instant('inventoryScreens.reserve.forJob') },
    { value: 'salesOrderLine', label: this.translate.instant('inventoryScreens.reserve.forSalesOrderLine') },
  ];

  protected readonly binOptions = computed<SelectOption[]>(() =>
    this.bins()
      .filter(b => b.status !== 'QcHold' && b.availableQuantity > 0)
      .map(b => ({
        value: b.binContentId,
        label: b.lotNumber
          ? this.translate.instant('replenishmentUi.binOptionWithLot', { path: b.locationPath, lot: b.lotNumber, qty: b.availableQuantity })
          : this.translate.instant('replenishmentUi.binOption', { path: b.locationPath, qty: b.availableQuantity }),
      })));

  protected readonly salesOrderLineOptions = computed<SelectOption[]>(() =>
    this.salesOrderLines().map(l => ({
      value: l.salesOrderLineId,
      label: this.translate.instant('inventoryScreens.reserve.salesOrderLineOption', {
        order: l.salesOrderNumber, line: l.lineNumber, customer: l.customerName,
        open: l.openQuantity, reserved: l.reservedQuantity,
      }),
    })));

  protected readonly noBins = computed(() => this.partValue() != null && !this.binsLoading() && this.binOptions().length === 0);
  protected readonly noSalesOrderLines = computed(() =>
    this.demand() === 'salesOrderLine' && this.partValue() != null && this.salesOrderLines().length === 0);

  constructor() {
    this.form.controls.partId.valueChanges.pipe(
      switchMap(partId => {
        this.form.controls.binContentId.setValue(null);
        this.bins.set([]);
        this.salesOrderLines.set([]);
        if (partId == null) return of<[PartBinLocation[], ReservableSalesOrderLine[]]>([[], []]);
        this.binsLoading.set(true);
        return forkJoin([
          this.inventoryService.getPartBins(partId).pipe(catchError(() => of<PartBinLocation[]>([]))),
          this.inventoryService.getReservableSalesOrderLines(partId, this.salesOrderId() ?? undefined)
            .pipe(catchError(() => of<ReservableSalesOrderLine[]>([]))),
        ]);
      }),
      takeUntilDestroyed(),
    ).subscribe(([bins, lines]) => {
      this.bins.set(bins);
      this.salesOrderLines.set(lines);
      this.binsLoading.set(false);
    });

    this.form.controls.demand.valueChanges.pipe(takeUntilDestroyed()).subscribe(demand => this.applyDemandValidators(demand));
  }

  ngOnInit(): void {
    const lineId = this.salesOrderLineId();
    this.form.patchValue({
      demand: lineId != null ? 'salesOrderLine' : 'none',
      salesOrderLineId: lineId,
      quantity: this.quantity(),
    });
    this.applyDemandValidators(this.form.controls.demand.value);
    const partId = this.partId();
    if (partId != null) this.form.controls.partId.setValue(partId);
  }

  private applyDemandValidators(demand: ReservationDemand): void {
    const { jobId, salesOrderLineId } = this.form.controls;
    jobId.setValidators(demand === 'job' ? [Validators.required] : []);
    salesOrderLineId.setValidators(demand === 'salesOrderLine' ? [Validators.required] : []);
    if (demand !== 'job') jobId.setValue(null, { emitEvent: false });
    if (demand !== 'salesOrderLine') salesOrderLineId.setValue(null, { emitEvent: false });
    jobId.updateValueAndValidity();
    salesOrderLineId.updateValueAndValidity();
  }

  protected close(): void {
    this.closed.emit();
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) return;
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.inventoryService.createReservation({
      partId: value.partId!,
      binContentId: value.binContentId!,
      jobId: value.demand === 'job' ? value.jobId ?? undefined : undefined,
      salesOrderLineId: value.demand === 'salesOrderLine' ? value.salesOrderLineId ?? undefined : undefined,
      quantity: value.quantity!,
      notes: value.notes.trim() || undefined,
    }).subscribe({
      next: reservation => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('inventory.snackbar.reservationCreated'));
        this.saved.emit(reservation);
      },
      error: () => this.saving.set(false),
    });
  }
}
