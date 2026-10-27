import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { catchError, of } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { DateTimePipe } from '../../../../shared/pipes/date-time.pipe';
import { AuthService } from '../../../../shared/services/auth.service';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { InterPlantTransferService } from '../../services/inter-plant-transfer.service';
import { InventoryService } from '../../services/inventory.service';
import { InterPlantTransfer } from '../../models/inter-plant-transfer.model';
import { InterPlantTransferPlant } from '../../models/inter-plant-transfer-plant.model';
import { InterPlantTransferStatus } from '../../models/inter-plant-transfer-status.type';
import { PartBinLocation } from '../../models/part-bin-location.model';
import { TransferLineForm } from '../../models/transfer-line-form.model';
import { TransferReceiveLineForm } from '../../models/transfer-receive-line-form.model';

const MANAGE_ROLES = ['Admin', 'Manager', 'OfficeManager', 'Engineer'];
const STATUS_CHIPS: Record<InterPlantTransferStatus, string> = {
  Draft: 'chip chip--muted',
  Approved: 'chip chip--info',
  Shipped: 'chip chip--warning',
  InTransit: 'chip chip--warning',
  Received: 'chip chip--success',
  Cancelled: 'chip chip--error',
};

/**
 * Inventory > Transfers: stock moving between plants. A transfer is created with its lines (part, the bin
 * and lot it leaves, the bin it lands in), shipped (stock leaves the source bin and is in transit), then
 * received at the destination, or cancelled before it ships.
 */
@Component({
  selector: 'app-inter-plant-transfers',
  standalone: true,
  imports: [
    ReactiveFormsModule, DecimalPipe, TranslatePipe, MatTooltipModule, DateTimePipe,
    DataTableComponent, ColumnCellDirective, DialogComponent, EntityPickerComponent, InputComponent,
    SelectComponent, TextareaComponent, ValidationButtonComponent, LoadingBlockDirective,
  ],
  templateUrl: './inter-plant-transfers.component.html',
  styleUrl: './inter-plant-transfers.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InterPlantTransfersComponent {
  private readonly transfersService = inject(InterPlantTransferService);
  private readonly inventoryService = inject(InventoryService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly canManage = this.auth.hasAnyRole(MANAGE_ROLES);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly transfers = signal<InterPlantTransfer[]>([]);
  protected readonly plants = signal<InterPlantTransferPlant[]>([]);
  protected readonly statusFilter = new FormControl<InterPlantTransferStatus | null>(null);

  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('inventoryScreens.transfers.allStatuses') },
    ...(['Draft', 'Shipped', 'Received', 'Cancelled'] as InterPlantTransferStatus[])
      .map(status => ({ value: status, label: this.translate.instant(`inventoryScreens.transfers.status.${status}`) })),
  ];

  protected readonly plantOptions = computed<SelectOption[]>(() =>
    this.plants().map(p => ({ value: p.id, label: `${p.code} · ${p.name}` })));

  protected readonly inTransit = computed(() => {
    const moving = this.transfers().filter(t => t.status === 'Shipped' || t.status === 'InTransit');
    return {
      transfers: moving.length,
      quantity: moving.reduce((sum, t) => sum + t.lines.reduce((lineSum, l) => lineSum + l.quantity, 0), 0),
    };
  });

  protected readonly columns: ColumnDef[] = [
    { field: 'transferNumber', header: this.translate.instant('inventoryScreens.transfers.number'), sortable: true, width: '170px' },
    { field: 'route', header: this.translate.instant('inventoryScreens.transfers.route'), sortable: false },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, width: '120px' },
    { field: 'lineCount', header: this.translate.instant('inventoryScreens.transfers.lines'), sortable: true, align: 'right', width: '70px' },
    { field: 'shippedAt', header: this.translate.instant('inventoryScreens.transfers.shipped'), sortable: true, type: 'date', width: '150px' },
    { field: 'receivedAt', header: this.translate.instant('inventoryScreens.transfers.received'), sortable: true, type: 'date', width: '150px' },
    { field: 'actions', header: '', width: '120px' },
  ];

  protected readonly lineColumns: ColumnDef[] = [
    { field: 'partNumber', header: this.translate.instant('inventory.columns.partNumber'), sortable: true, width: '150px' },
    { field: 'fromLocationPath', header: this.translate.instant('inventoryScreens.transfers.fromBin'), sortable: true },
    { field: 'toLocationPath', header: this.translate.instant('inventoryScreens.transfers.toBin'), sortable: true },
    { field: 'lotNumber', header: this.translate.instant('inventory.columns.lotNumber'), sortable: true, width: '110px' },
    { field: 'quantity', header: this.translate.instant('inventory.columns.qty'), sortable: true, align: 'right', width: '90px' },
    { field: 'receivedQuantity', header: this.translate.instant('inventoryScreens.transfers.receivedQty'), sortable: true, align: 'right', width: '100px' },
  ];

  protected readonly selected = signal<InterPlantTransfer | null>(null);

  protected readonly showCreate = signal(false);
  private nextLineKey = 1;
  protected readonly lineBins = signal<Record<number, PartBinLocation[]>>({});
  protected readonly lineBinOptions = computed<Record<number, SelectOption[]>>(() => {
    const options: Record<number, SelectOption[]> = {};
    for (const [key, bins] of Object.entries(this.lineBins())) {
      options[Number(key)] = bins.map(b => ({
        value: b.binContentId,
        label: b.lotNumber
          ? this.translate.instant('replenishmentUi.binOptionWithLot', { path: b.locationPath, lot: b.lotNumber, qty: b.availableQuantity })
          : this.translate.instant('replenishmentUi.binOption', { path: b.locationPath, qty: b.availableQuantity }),
      }));
    }
    return options;
  });
  protected readonly createForm = new FormGroup({
    fromPlantId: new FormControl<number | null>(null, [Validators.required]),
    toPlantId: new FormControl<number | null>(null, [Validators.required]),
    notes: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
    lines: new FormArray<TransferLineForm>([]),
  });
  protected readonly createViolations = FormValidationService.getViolations(this.createForm, {
    fromPlantId: this.translate.instant('inventoryScreens.transfers.fromPlant'),
    toPlantId: this.translate.instant('inventoryScreens.transfers.toPlant'),
  });
  protected readonly samePlant = signal(false);

  protected readonly shipping = signal<InterPlantTransfer | null>(null);
  protected readonly trackingControl = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] });

  protected readonly receiving = signal<InterPlantTransfer | null>(null);
  protected readonly receiveLines = new FormArray<TransferReceiveLineForm>([]);

  constructor() {
    this.load();
    this.transfersService.getPlants().pipe(catchError(() => of<InterPlantTransferPlant[]>([])))
      .subscribe(plants => this.plants.set(plants));
    this.createForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(v =>
      this.samePlant.set(v.fromPlantId != null && v.fromPlantId === v.toPlantId));
  }

  protected load(): void {
    this.loading.set(true);
    this.transfersService.getTransfers(this.statusFilter.value).subscribe({
      next: transfers => { this.transfers.set(transfers); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected statusClass(status: InterPlantTransferStatus): string {
    return STATUS_CHIPS[status] ?? 'chip';
  }

  protected canShip(transfer: InterPlantTransfer): boolean {
    return this.canManage && (transfer.status === 'Draft' || transfer.status === 'Approved');
  }

  protected canReceive(transfer: InterPlantTransfer): boolean {
    return this.canManage && (transfer.status === 'Shipped' || transfer.status === 'InTransit');
  }

  protected openDetail(transfer: InterPlantTransfer): void {
    this.selected.set(transfer);
  }

  protected closeDetail(): void {
    this.selected.set(null);
  }

  protected openCreate(): void {
    this.createForm.reset({ fromPlantId: this.plants().find(p => p.isDefault)?.id ?? null, toPlantId: null, notes: '' });
    this.createForm.controls.lines.clear();
    this.lineBins.set({});
    this.addLine();
    this.showCreate.set(true);
  }

  protected closeCreate(): void {
    this.showCreate.set(false);
  }

  protected get lineGroups(): TransferLineForm[] {
    return this.createForm.controls.lines.controls;
  }

  protected addLine(): void {
    const key = this.nextLineKey++;
    const group: TransferLineForm = new FormGroup({
      key: new FormControl(key, { nonNullable: true }),
      partId: new FormControl<number | null>(null, [Validators.required]),
      sourceBinContentId: new FormControl<number | null>(null, [Validators.required]),
      toLocationId: new FormControl<number | null>(null, [Validators.required]),
      quantity: new FormControl<number | null>(null, [Validators.required, Validators.min(0.0001)]),
    });
    group.controls.partId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(partId => {
      group.controls.sourceBinContentId.setValue(null);
      this.lineBins.update(all => ({ ...all, [key]: [] }));
      if (partId == null) return;
      this.inventoryService.getPartBins(partId).pipe(catchError(() => of<PartBinLocation[]>([])))
        .subscribe(bins => this.lineBins.update(all => ({ ...all, [key]: bins.filter(b => b.status === 'Stored' && b.availableQuantity > 0) })));
    });
    this.lineBins.update(all => ({ ...all, [key]: [] }));
    this.createForm.controls.lines.push(group);
  }

  protected removeLine(index: number): void {
    const key = this.lineGroups[index]?.controls.key.value;
    this.createForm.controls.lines.removeAt(index);
    if (key !== undefined) this.lineBins.update(all => {
      const next = { ...all };
      delete next[key];
      return next;
    });
  }


  protected saveCreate(): void {
    if (this.createForm.invalid || this.samePlant() || this.saving()) return;
    const value = this.createForm.getRawValue();
    const bins = this.lineBins();
    const lines = value.lines.map(line => {
      const bin = (bins[line.key] ?? []).find(b => b.binContentId === line.sourceBinContentId);
      return {
        partId: line.partId!,
        quantity: line.quantity!,
        fromLocationId: bin?.locationId ?? null,
        toLocationId: line.toLocationId,
        lotNumber: bin?.lotNumber ?? null,
      };
    });
    this.saving.set(true);
    this.transfersService.create({
      fromPlantId: value.fromPlantId!,
      toPlantId: value.toPlantId!,
      notes: value.notes.trim() || null,
      lines,
    }).subscribe({
      next: transfer => {
        this.saving.set(false);
        this.showCreate.set(false);
        this.snackbar.success(this.translate.instant('inventoryScreens.transfers.created', { number: transfer.transferNumber }));
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  protected openShip(transfer: InterPlantTransfer): void {
    this.trackingControl.reset('');
    this.shipping.set(transfer);
  }

  protected closeShip(): void {
    this.shipping.set(null);
  }

  protected confirmShip(): void {
    const transfer = this.shipping();
    if (!transfer || this.trackingControl.invalid || this.saving()) return;
    this.saving.set(true);
    this.transfersService.ship(transfer.id, this.trackingControl.value.trim() || null).subscribe({
      next: () => {
        this.saving.set(false);
        this.shipping.set(null);
        this.snackbar.success(this.translate.instant('inventoryScreens.transfers.shippedMessage', { number: transfer.transferNumber }));
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  protected openReceive(transfer: InterPlantTransfer): void {
    this.receiveLines.clear();
    for (const line of transfer.lines) {
      this.receiveLines.push(new FormGroup({
        partId: new FormControl(line.partId, { nonNullable: true }),
        receivedQuantity: new FormControl<number | null>(line.quantity, [Validators.required, Validators.min(0), Validators.max(line.quantity)]),
        toLocationId: new FormControl<number | null>(null),
      }));
    }
    this.receiving.set(transfer);
  }

  protected closeReceive(): void {
    this.receiving.set(null);
  }

  protected confirmReceive(): void {
    const transfer = this.receiving();
    if (!transfer || this.receiveLines.invalid || this.saving()) return;
    this.saving.set(true);
    const lines = this.receiveLines.getRawValue().map(l => ({
      partId: l.partId, receivedQuantity: l.receivedQuantity ?? 0, toLocationId: l.toLocationId,
    }));
    this.transfersService.receive(transfer.id, lines).subscribe({
      next: () => {
        this.saving.set(false);
        this.receiving.set(null);
        this.snackbar.success(this.translate.instant('inventoryScreens.transfers.receivedMessage', { number: transfer.transferNumber }));
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  protected cancel(transfer: InterPlantTransfer): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: this.translate.instant('inventoryScreens.transfers.cancelTitle'),
        message: this.translate.instant('inventoryScreens.transfers.cancelMessage', { number: transfer.transferNumber }),
        confirmLabel: this.translate.instant('inventoryScreens.transfers.cancelConfirm'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.transfersService.cancel(transfer.id).subscribe({
        next: () => {
          this.snackbar.info(this.translate.instant('inventoryScreens.transfers.cancelledMessage', { number: transfer.transferNumber }));
          this.load();
        },
      });
    });
  }
}
