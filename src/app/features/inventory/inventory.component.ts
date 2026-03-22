import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MatTooltipModule } from '@angular/material/tooltip';

import { InventoryService } from './services/inventory.service';
import { StorageLocation } from './models/storage-location.model';
import { InventoryPartSummary } from './models/inventory-part-summary.model';
import { LowStockAlert } from './models/low-stock-alert.model';
import { BinContentItem } from './models/bin-content-item.model';
import { BinMovementItem } from './models/bin-movement-item.model';
import { ReceivingRecord } from './models/receiving-record.model';
import { CycleCount } from './models/cycle-count.model';
import { Reservation } from './models/reservation.model';
import { LocationType } from './models/location-type.type';
import { StorageLocationFlat } from './models/storage-location-flat.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { TextareaComponent } from '../../shared/components/textarea/textarea.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { RowExpandDirective } from '../../shared/directives/row-expand.directive';
import { ValidationPopoverDirective } from '../../shared/directives/validation-popover.directive';
import { FormValidationService } from '../../shared/services/form-validation.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { ScannerService } from '../../shared/services/scanner.service';
import { ColumnDef } from '../../shared/models/column-def.model';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { BarcodeInfoComponent } from '../../shared/components/barcode-info/barcode-info.component';

type InventoryTab = 'stock' | 'locations' | 'movements' | 'receiving' | 'stockOps' | 'cycleCounts' | 'reservations';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, TranslatePipe, PageHeaderComponent, DialogComponent, InputComponent, SelectComponent, TextareaComponent, DataTableComponent, ColumnCellDirective, RowExpandDirective, ValidationPopoverDirective, EmptyStateComponent, LoadingBlockDirective, BarcodeInfoComponent, MatTooltipModule],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryComponent {
  private readonly inventoryService = inject(InventoryService);
  private readonly snackbar = inject(SnackbarService);
  private readonly scanner = inject(ScannerService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly activeTab = signal<InventoryTab>('stock');

  // Stock tab
  protected readonly partSummaries = signal<InventoryPartSummary[]>([]);
  protected readonly lowStockAlerts = signal<LowStockAlert[]>([]);
  protected readonly searchControl = new FormControl('');
  private readonly searchTerm = toSignal(this.searchControl.valueChanges.pipe(startWith('')), { initialValue: '' });

  protected readonly stockColumns: ColumnDef[] = [
    { field: 'partNumber', header: this.translate.instant('inventory.columns.partNumber'), sortable: true, width: '120px' },
    { field: 'description', header: this.translate.instant('common.description'), sortable: true },
    { field: 'material', header: this.translate.instant('inventory.columns.material'), sortable: true, width: '140px' },
    { field: 'onHand', header: this.translate.instant('inventory.onHand'), sortable: true, align: 'right', width: '90px' },
    { field: 'reserved', header: this.translate.instant('inventory.columns.reserved'), sortable: true, align: 'right', width: '90px' },
    { field: 'available', header: this.translate.instant('inventory.available'), sortable: true, align: 'right', width: '90px' },
  ];

  protected readonly stockRowClass = (row: unknown) => {
    const summary = row as InventoryPartSummary;
    if (summary.available <= 0) return 'stock-level--empty';
    if (summary.available < summary.onHand * 0.2) return 'stock-level--low';
    return '';
  };

  // Locations tab
  protected readonly locationTree = signal<StorageLocation[]>([]);
  protected readonly selectedLocation = signal<StorageLocation | null>(null);
  protected readonly binContents = signal<BinContentItem[]>([]);
  protected readonly expandedLocationIds = signal<Set<number>>(new Set());

  // Movements tab
  protected readonly movements = signal<BinMovementItem[]>([]);

  protected readonly movementColumns: ColumnDef[] = [
    { field: 'entityName', header: this.translate.instant('inventory.columns.item'), sortable: true },
    { field: 'quantity', header: this.translate.instant('inventory.columns.qty'), sortable: true, width: '70px', align: 'right' },
    { field: 'fromLocationName', header: this.translate.instant('inventory.columns.from'), sortable: true },
    { field: 'toLocationName', header: this.translate.instant('inventory.columns.to'), sortable: true },
    { field: 'reason', header: this.translate.instant('inventory.columns.reason'), sortable: true, width: '120px' },
    { field: 'movedByName', header: this.translate.instant('inventory.columns.by'), sortable: true },
    { field: 'movedAt', header: this.translate.instant('inventory.columns.when'), sortable: true, type: 'date', width: '120px' },
  ];

  // Receiving tab
  protected readonly receivingHistory = signal<ReceivingRecord[]>([]);

  protected readonly receivingColumns: ColumnDef[] = [
    { field: 'purchaseOrderNumber', header: 'PO #', sortable: true, width: '110px' },
    { field: 'partNumber', header: 'Part #', sortable: true, width: '120px' },
    { field: 'quantityReceived', header: 'Qty', sortable: true, width: '70px', align: 'right' },
    { field: 'receivedBy', header: 'Received By', sortable: true },
    { field: 'storageLocationName', header: 'Location', sortable: true },
    { field: 'lotNumber', header: 'Lot #', sortable: true, width: '100px' },
    { field: 'createdAt', header: 'Date', sortable: true, type: 'date', width: '120px' },
  ];

  // Cycle Counts tab
  protected readonly cycleCounts = signal<CycleCount[]>([]);

  protected readonly cycleCountColumns: ColumnDef[] = [
    { field: 'locationName', header: 'Location', sortable: true },
    { field: 'countedByName', header: 'Counted By', sortable: true },
    { field: 'countedAt', header: 'Date', sortable: true, type: 'date', width: '120px' },
    { field: 'status', header: 'Status', sortable: true, filterable: true, type: 'enum', width: '110px',
      filterOptions: [
        { value: 'Pending', label: 'Pending' },
        { value: 'Approved', label: 'Approved' },
        { value: 'Rejected', label: 'Rejected' },
      ]},
    { field: 'lineCount', header: 'Items', sortable: true, width: '70px', align: 'right' },
    { field: 'variance', header: 'Variance', sortable: true, width: '90px', align: 'right' },
  ];

  // Bin locations for dropdowns
  protected readonly binLocations = signal<StorageLocationFlat[]>([]);
  protected readonly binLocationOptions = signal<SelectOption[]>([]);

  // Location dialog
  protected readonly showLocationDialog = signal(false);
  protected readonly locationForm = new FormGroup({
    name: new FormControl('', [Validators.required]),
    locationType: new FormControl<LocationType>('Area', [Validators.required]),
    parentId: new FormControl<number | null>(null),
    barcode: new FormControl(''),
    description: new FormControl(''),
  });

  protected readonly locationViolations = FormValidationService.getViolations(this.locationForm, {
    name: 'Name',
    locationType: 'Type',
  });

  protected readonly locationTypes: LocationType[] = ['Area', 'Rack', 'Shelf', 'Bin'];
  protected readonly locationTypeOptions: SelectOption[] = this.locationTypes.map(t => ({ value: t, label: t }));

  // Receive dialog
  protected readonly showReceiveDialog = signal(false);
  protected readonly receiveForm = new FormGroup({
    purchaseOrderLineId: new FormControl<number | null>(null, [Validators.required]),
    quantityReceived: new FormControl<number | null>(null, [Validators.required, Validators.min(1)]),
    locationId: new FormControl<number | null>(null),
    lotNumber: new FormControl(''),
    notes: new FormControl(''),
  });

  protected readonly receiveViolations = FormValidationService.getViolations(this.receiveForm, {
    purchaseOrderLineId: 'PO Line ID',
    quantityReceived: 'Quantity',
  });

  // Transfer dialog
  protected readonly showTransferDialog = signal(false);
  protected readonly transferForm = new FormGroup({
    sourceBinContentId: new FormControl<number | null>(null, [Validators.required]),
    destinationLocationId: new FormControl<number | null>(null, [Validators.required]),
    quantity: new FormControl<number | null>(null, [Validators.required, Validators.min(1)]),
    notes: new FormControl(''),
  });

  protected readonly transferViolations = FormValidationService.getViolations(this.transferForm, {
    sourceBinContentId: 'Source Bin Content',
    destinationLocationId: 'Destination',
    quantity: 'Quantity',
  });

  // Adjust dialog
  protected readonly showAdjustDialog = signal(false);
  protected readonly adjustForm = new FormGroup({
    binContentId: new FormControl<number | null>(null, [Validators.required]),
    newQuantity: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    reason: new FormControl('', [Validators.required]),
    notes: new FormControl(''),
  });

  protected readonly adjustViolations = FormValidationService.getViolations(this.adjustForm, {
    binContentId: 'Bin Content',
    newQuantity: 'New Quantity',
    reason: 'Reason',
  });

  // Reservations tab
  protected readonly reservations = signal<Reservation[]>([]);
  protected readonly reservationFilterPartId = signal<number | null>(null);
  protected readonly reservationFilterJobId = signal<number | null>(null);

  protected readonly reservationColumns: ColumnDef[] = [
    { field: 'partNumber', header: 'Part #', sortable: true, width: '120px' },
    { field: 'partDescription', header: 'Description', sortable: true },
    { field: 'locationPath', header: 'Bin Location', sortable: true },
    { field: 'quantity', header: 'Qty', sortable: true, align: 'right', width: '80px' },
    { field: 'jobNumber', header: 'Job #', sortable: true, width: '100px' },
    { field: 'jobTitle', header: 'Job', sortable: true },
    { field: 'notes', header: 'Notes', sortable: false },
    { field: 'createdAt', header: 'Reserved', sortable: true, type: 'date', width: '120px' },
    { field: 'actions', header: '', width: '60px' },
  ];

  // Create reservation dialog
  protected readonly showReservationDialog = signal(false);
  protected readonly reservationForm = new FormGroup({
    partId: new FormControl<number | null>(null, [Validators.required]),
    binContentId: new FormControl<number | null>(null, [Validators.required]),
    jobId: new FormControl<number | null>(null),
    quantity: new FormControl<number | null>(null, [Validators.required, Validators.min(0.001)]),
    notes: new FormControl(''),
  });

  protected readonly reservationViolations = FormValidationService.getViolations(this.reservationForm, {
    partId: 'Part ID',
    binContentId: 'Bin Content ID',
    quantity: 'Quantity',
  });

  // Cycle count detail dialog
  protected readonly showCycleCountDialog = signal(false);
  protected readonly selectedCycleCount = signal<CycleCount | null>(null);

  // Create cycle count dialog
  protected readonly showCreateCycleCountDialog = signal(false);
  protected readonly createCycleCountForm = new FormGroup({
    locationId: new FormControl<number | null>(null, [Validators.required]),
    notes: new FormControl(''),
  });

  protected readonly createCycleCountViolations = FormValidationService.getViolations(this.createCycleCountForm, {
    locationId: 'Location',
  });

  constructor() {
    this.scanner.setContext('inventory');
    this.loadStock();
    this.loadLowStockAlerts();
    this.loadBinLocations();

    effect(() => {
      const scan = this.scanner.lastScan();
      if (!scan || scan.context !== 'inventory') return;
      this.scanner.clearLastScan();
      this.searchControl.setValue(scan.value);
      this.activeTab.set('stock');
      this.loadStock();
    });
  }

  protected switchTab(tab: InventoryTab): void {
    this.activeTab.set(tab);
    if (tab === 'stock' && this.partSummaries().length === 0) this.loadStock();
    if (tab === 'locations' && this.locationTree().length === 0) this.loadLocations();
    if (tab === 'movements' && this.movements().length === 0) this.loadMovements();
    if (tab === 'receiving' && this.receivingHistory().length === 0) this.loadReceivingHistory();
    if (tab === 'cycleCounts' && this.cycleCounts().length === 0) this.loadCycleCounts();
    if (tab === 'reservations' && this.reservations().length === 0) this.loadReservations();
  }

  private loadBinLocations(): void {
    this.inventoryService.getBinLocations().subscribe({
      next: (data) => {
        this.binLocations.set(data);
        this.binLocationOptions.set(
          [{ value: null, label: '-- None --' }, ...data.map(l => ({ value: l.id, label: l.locationPath }))]
        );
      },
      error: () => { /* bin locations are optional — dialogs will show empty dropdown */ },
    });
  }

  // ── Stock Tab ──

  protected loadStock(): void {
    this.loading.set(true);
    const search = (this.searchTerm() ?? '').trim() || undefined;
    this.inventoryService.getPartInventory(search).subscribe({
      next: (data) => { this.partSummaries.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  private loadLowStockAlerts(): void {
    this.inventoryService.getLowStockAlerts().subscribe({
      next: (data) => this.lowStockAlerts.set(data),
      error: () => { /* low stock alerts are optional */ },
    });
  }

  protected createPoForPart(): void {
    this.router.navigate(['/purchase-orders']);
  }

  protected applySearch(): void {
    this.loadStock();
  }

  protected clearSearch(): void {
    this.searchControl.setValue('');
    this.loadStock();
  }


  // ── Locations Tab ──

  protected loadLocations(): void {
    this.loading.set(true);
    this.inventoryService.getLocationTree().subscribe({
      next: (data) => { this.locationTree.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected toggleLocationExpand(locationId: number): void {
    const ids = new Set(this.expandedLocationIds());
    if (ids.has(locationId)) {
      ids.delete(locationId);
    } else {
      ids.add(locationId);
    }
    this.expandedLocationIds.set(ids);
  }

  protected isLocationExpanded(locationId: number): boolean {
    return this.expandedLocationIds().has(locationId);
  }

  protected selectLocation(location: StorageLocation): void {
    this.selectedLocation.set(location);
    if (location.locationType === 'Bin') {
      this.inventoryService.getBinContents(location.id).subscribe({
        next: (data) => this.binContents.set(data),
      });
    } else {
      this.binContents.set([]);
    }
  }

  protected getLocationIcon(type: LocationType): string {
    switch (type) {
      case 'Area': return 'warehouse';
      case 'Rack': return 'view_column';
      case 'Shelf': return 'shelves';
      case 'Bin': return 'inventory_2';
    }
  }

  protected openCreateLocation(parentId?: number): void {
    this.locationForm.reset({
      name: '', locationType: parentId ? 'Rack' : 'Area',
      parentId: parentId ?? null, barcode: '', description: '',
    });
    this.showLocationDialog.set(true);
  }

  protected closeLocationDialog(): void {
    this.showLocationDialog.set(false);
  }

  protected saveLocation(): void {
    if (this.locationForm.invalid) return;

    this.saving.set(true);
    const form = this.locationForm.getRawValue();
    this.inventoryService.createLocation({
      name: form.name!,
      locationType: form.locationType!,
      parentId: form.parentId ?? undefined,
      barcode: form.barcode || undefined,
      description: form.description || undefined,
    }).subscribe({
      next: () => { this.saving.set(false); this.closeLocationDialog(); this.loadLocations(); this.snackbar.success(this.translate.instant('inventory.snackbar.locationCreated')); },
      error: () => this.saving.set(false),
    });
  }

  // ── Movements Tab ──

  protected loadMovements(): void {
    this.loading.set(true);
    this.inventoryService.getMovements().subscribe({
      next: (data) => { this.movements.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected getReasonLabel(reason: string | null): string {
    if (!reason) return '\u2014';
    const labels: Record<string, string> = {
      Receive: 'Received', Pick: 'Picked', Restock: 'Restocked',
      QcRelease: 'QC Released', Ship: 'Shipped', Move: 'Moved',
      Adjustment: 'Adjusted', Return: 'Returned',
      Transfer: 'Transferred', CycleCount: 'Cycle Count',
    };
    return labels[reason] ?? reason;
  }

  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Reserved: 'chip--primary', ReadyToShip: 'chip--success', QcHold: 'chip--warning',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      Stored: 'Stored', Reserved: 'Reserved',
      ReadyToShip: 'Ready to Ship', QcHold: 'QC Hold',
    };
    return labels[status] ?? status;
  }

  // ── Receiving Tab ──

  protected loadReceivingHistory(): void {
    this.loading.set(true);
    this.inventoryService.getReceivingHistory().subscribe({
      next: (data) => { this.receivingHistory.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected openReceiveDialog(): void {
    this.receiveForm.reset();
    this.showReceiveDialog.set(true);
  }

  protected closeReceiveDialog(): void {
    this.showReceiveDialog.set(false);
  }

  protected submitReceive(): void {
    if (this.receiveForm.invalid) return;
    this.saving.set(true);
    const form = this.receiveForm.getRawValue();
    this.inventoryService.receiveGoods({
      purchaseOrderLineId: form.purchaseOrderLineId!,
      quantityReceived: form.quantityReceived!,
      locationId: form.locationId ?? undefined,
      lotNumber: form.lotNumber || undefined,
      notes: form.notes || undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeReceiveDialog();
        this.loadReceivingHistory();
        this.snackbar.success(this.translate.instant('inventory.snackbar.goodsReceived'));
      },
      error: () => this.saving.set(false),
    });
  }

  // ── Stock Operations ──

  protected openTransferDialog(binContent?: BinContentItem): void {
    this.transferForm.reset();
    if (binContent) {
      this.transferForm.patchValue({
        sourceBinContentId: binContent.id,
        quantity: binContent.quantity as number,
      });
    }
    this.showTransferDialog.set(true);
  }

  protected closeTransferDialog(): void {
    this.showTransferDialog.set(false);
  }

  protected submitTransfer(): void {
    if (this.transferForm.invalid) return;
    this.saving.set(true);
    const form = this.transferForm.getRawValue();
    this.inventoryService.transferStock({
      sourceBinContentId: form.sourceBinContentId!,
      destinationLocationId: form.destinationLocationId!,
      quantity: form.quantity!,
      notes: form.notes || undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeTransferDialog();
        this.loadStock();
        this.snackbar.success(this.translate.instant('inventory.snackbar.stockTransferred'));
      },
      error: () => this.saving.set(false),
    });
  }

  protected openAdjustDialog(binContent?: BinContentItem): void {
    this.adjustForm.reset();
    if (binContent) {
      this.adjustForm.patchValue({
        binContentId: binContent.id,
        newQuantity: binContent.quantity as number,
      });
    }
    this.showAdjustDialog.set(true);
  }

  protected closeAdjustDialog(): void {
    this.showAdjustDialog.set(false);
  }

  protected submitAdjust(): void {
    if (this.adjustForm.invalid) return;
    this.saving.set(true);
    const form = this.adjustForm.getRawValue();
    this.inventoryService.adjustStock({
      binContentId: form.binContentId!,
      newQuantity: form.newQuantity!,
      reason: form.reason!,
      notes: form.notes || undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeAdjustDialog();
        this.loadStock();
        this.snackbar.success(this.translate.instant('inventory.snackbar.stockAdjusted'));
      },
      error: () => this.saving.set(false),
    });
  }

  // ── Cycle Counts Tab ──

  protected loadCycleCounts(): void {
    this.loading.set(true);
    this.inventoryService.getCycleCounts().subscribe({
      next: (data) => {
        this.cycleCounts.set(data.map(cc => ({
          ...cc,
          lineCount: cc.lines.length,
          variance: cc.lines.reduce((sum, l) => sum + Math.abs(l.variance), 0),
        })));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected openCreateCycleCountDialog(): void {
    this.createCycleCountForm.reset();
    this.showCreateCycleCountDialog.set(true);
  }

  protected closeCreateCycleCountDialog(): void {
    this.showCreateCycleCountDialog.set(false);
  }

  protected submitCreateCycleCount(): void {
    if (this.createCycleCountForm.invalid) return;
    this.saving.set(true);
    const form = this.createCycleCountForm.getRawValue();
    this.inventoryService.createCycleCount(form.locationId!, form.notes || undefined).subscribe({
      next: (cc) => {
        this.saving.set(false);
        this.closeCreateCycleCountDialog();
        this.loadCycleCounts();
        this.snackbar.success(this.translate.instant('inventory.snackbar.cycleCountCreated'));
        this.openCycleCountDetail(cc);
      },
      error: () => this.saving.set(false),
    });
  }

  protected openCycleCountDetail(cycleCount: CycleCount): void {
    this.selectedCycleCount.set(cycleCount);
    this.showCycleCountDialog.set(true);
  }

  protected closeCycleCountDialog(): void {
    this.showCycleCountDialog.set(false);
    this.selectedCycleCount.set(null);
  }

  protected updateCycleCountLine(lineId: number, actualQuantity: number): void {
    const cc = this.selectedCycleCount();
    if (!cc) return;
    const updated = {
      ...cc,
      lines: cc.lines.map(l =>
        l.id === lineId
          ? { ...l, actualQuantity, variance: actualQuantity - l.expectedQuantity }
          : l
      ),
    };
    this.selectedCycleCount.set(updated);
  }

  protected approveCycleCount(): void {
    const cc = this.selectedCycleCount();
    if (!cc) return;
    this.saving.set(true);
    this.inventoryService.updateCycleCount(cc.id, {
      status: 'Approved',
      lines: cc.lines.map(l => ({ id: l.id, actualQuantity: l.actualQuantity, notes: l.notes ?? undefined })),
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeCycleCountDialog();
        this.loadCycleCounts();
        this.snackbar.success(this.translate.instant('inventory.snackbar.cycleCountApproved'));
      },
      error: () => this.saving.set(false),
    });
  }

  protected rejectCycleCount(): void {
    const cc = this.selectedCycleCount();
    if (!cc) return;
    this.saving.set(true);
    this.inventoryService.updateCycleCount(cc.id, { status: 'Rejected' }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeCycleCountDialog();
        this.loadCycleCounts();
        this.snackbar.info(this.translate.instant('inventory.snackbar.cycleCountRejected'));
      },
      error: () => this.saving.set(false),
    });
  }

  protected getCycleCountStatusClass(status: string): string {
    const map: Record<string, string> = {
      Pending: 'chip--warning', Approved: 'chip--success', Rejected: 'chip--error',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getVarianceClass(variance: number): string {
    if (variance === 0) return '';
    return variance > 0 ? 'variance--positive' : 'variance--negative';
  }

  // ── Reservations Tab ──

  protected loadReservations(): void {
    this.loading.set(true);
    this.inventoryService.getReservations(
      this.reservationFilterPartId() ?? undefined,
      this.reservationFilterJobId() ?? undefined,
    ).subscribe({
      next: (data) => { this.reservations.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected openReservationDialog(): void {
    this.reservationForm.reset();
    this.showReservationDialog.set(true);
  }

  protected closeReservationDialog(): void {
    this.showReservationDialog.set(false);
  }

  protected submitReservation(): void {
    if (this.reservationForm.invalid) return;
    this.saving.set(true);
    const form = this.reservationForm.getRawValue();
    this.inventoryService.createReservation({
      partId: form.partId!,
      binContentId: form.binContentId!,
      jobId: form.jobId ?? undefined,
      quantity: form.quantity!,
      notes: form.notes || undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeReservationDialog();
        this.loadReservations();
        this.loadStock();
        this.snackbar.success(this.translate.instant('inventory.snackbar.reservationCreated'));
      },
      error: () => this.saving.set(false),
    });
  }

  protected releaseReservation(id: number): void {
    this.saving.set(true);
    this.inventoryService.releaseReservation(id).subscribe({
      next: () => {
        this.saving.set(false);
        this.loadReservations();
        this.loadStock();
        this.snackbar.info(this.translate.instant('inventory.snackbar.reservationReleased'));
      },
      error: () => this.saving.set(false),
    });
  }

  protected getReservedClass(reserved: number): string {
    return reserved > 0 ? 'qty-reserved' : '';
  }

  protected getLotExpirationClass(expirationDate: string | null): string {
    if (!expirationDate) return '';
    const expiry = new Date(expirationDate);
    const now = new Date();
    const daysUntilExpiry = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry < 0) return 'lot-expired';
    if (daysUntilExpiry <= 30) return 'lot-expiring-soon';
    return '';
  }
}
