import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';

import { MatTooltipModule } from '@angular/material/tooltip';
import { catchError, of, startWith } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { DateTimePipe } from '../../../../shared/pipes/date-time.pipe';
import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { LabelPrintService } from '../../../../shared/services/label-print.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { WorkCenter } from '../../../scheduling/models/scheduling.model';
import { SchedulingService } from '../../../scheduling/services/scheduling.service';
import { ReplenishmentCardService } from '../../services/replenishment-card.service';
import { KanbanCardStatus } from '../../models/kanban-card-status.type';
import { KanbanSupplySource } from '../../models/kanban-supply-source.type';
import { ReplenishmentCard } from '../../models/replenishment-card.model';
import { ReplenishmentCardDetail } from '../../models/replenishment-card-detail.model';

const EDIT_ROLES = ['Admin', 'Manager'];
const STATUS_CHIPS: Record<KanbanCardStatus, string> = {
  Full: 'chip chip--success',
  Empty: 'chip chip--error',
  Triggered: 'chip chip--warning',
  InReplenishment: 'chip chip--info',
};

/**
 * Inventory > Replenishment cards: two-bin / multi-bin kanban for stocked parts. Each card holds a fixed
 * container quantity at a bin; emptying a container (a click or a scan of the card) records a replenishment
 * request, and confirming the refill puts the card back to Full. Cards print as barcode labels, one per bin.
 */
@Component({
  selector: 'app-replenishment-cards',
  standalone: true,
  imports: [
    ReactiveFormsModule, DecimalPipe, TranslatePipe, MatTooltipModule, DateTimePipe,
    DataTableComponent, ColumnCellDirective, DialogComponent, EntityPickerComponent, InputComponent,
    SelectComponent, ToggleComponent, ValidationButtonComponent, LoadingBlockDirective,
  ],
  templateUrl: './replenishment-cards.component.html',
  styleUrl: './replenishment-cards.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReplenishmentCardsComponent {
  private readonly cardsService = inject(ReplenishmentCardService);
  private readonly schedulingService = inject(SchedulingService);
  private readonly labels = inject(LabelPrintService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly auth = inject(AuthService);
  private readonly capabilities = inject(CapabilityService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly canEdit = this.auth.hasAnyRole(EDIT_ROLES);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly cards = signal<ReplenishmentCard[]>([]);
  protected readonly workCenters = signal<WorkCenter[]>([]);
  protected readonly statusFilter = new FormControl<KanbanCardStatus | null>(null);
  protected readonly scanControl = new FormControl('', { nonNullable: true });

  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('inventoryScreens.cards.allStatuses') },
    ...(['Full', 'Empty', 'Triggered', 'InReplenishment'] as KanbanCardStatus[])
      .map(status => ({ value: status, label: this.translate.instant(`inventoryScreens.cards.status.${status}`) })),
  ];

  protected readonly supplyOptions: SelectOption[] = (['Purchase', 'Production'] as KanbanSupplySource[])
    .map(source => ({ value: source, label: this.translate.instant(`inventoryScreens.cards.supply.${source}`) }));

  protected readonly workCenterOptions = computed<SelectOption[]>(() =>
    this.workCenters().filter(w => w.isActive).map(w => ({ value: w.id, label: `${w.code} · ${w.name}` })));

  protected readonly waitingCount = computed(() =>
    this.cards().filter(c => c.status === 'Triggered' || c.status === 'InReplenishment').length);

  protected readonly columns: ColumnDef[] = [
    { field: 'cardNumber', header: this.translate.instant('inventoryScreens.cards.card'), sortable: true, width: '110px' },
    { field: 'partNumber', header: this.translate.instant('inventory.columns.partNumber'), sortable: true, width: '150px' },
    { field: 'partDescription', header: this.translate.instant('common.description'), sortable: true, phoneHidden: true },
    { field: 'storageLocationName', header: this.translate.instant('replenishmentUi.bin'), sortable: true, width: '140px' },
    { field: 'binQuantity', header: this.translate.instant('inventoryScreens.cards.containerQty'), sortable: true, align: 'right', width: '110px' },
    { field: 'numberOfBins', header: this.translate.instant('inventoryScreens.cards.containers'), sortable: true, align: 'right', width: '100px' },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, width: '150px' },
    { field: 'lastTriggeredAt', header: this.translate.instant('inventoryScreens.cards.lastTriggered'), sortable: true, type: 'date', width: '150px' },
    { field: 'actions', header: '', width: '150px' },
  ];

  protected readonly logColumns: ColumnDef[] = [
    { field: 'triggeredAt', header: this.translate.instant('inventoryScreens.cards.requested'), sortable: true, type: 'date', width: '150px' },
    { field: 'triggerType', header: this.translate.instant('inventoryScreens.cards.how'), width: '100px' },
    { field: 'triggeredByName', header: this.translate.instant('inventory.columns.by') },
    { field: 'requestedQuantity', header: this.translate.instant('inventory.columns.qty'), align: 'right', width: '80px' },
    { field: 'fulfilledAt', header: this.translate.instant('inventoryScreens.cards.refilledAt'), sortable: true, type: 'date', width: '150px' },
    { field: 'fulfilledQuantity', header: this.translate.instant('inventoryScreens.cards.refilledQty'), align: 'right', width: '110px' },
  ];

  protected readonly detail = signal<ReplenishmentCardDetail | null>(null);

  protected readonly editing = signal<ReplenishmentCard | 'new' | null>(null);
  protected readonly cardForm = new FormGroup({
    partId: new FormControl<number | null>(null, [Validators.required]),
    workCenterId: new FormControl<number | null>(null, [Validators.required]),
    storageLocationId: new FormControl<number | null>(null),
    binQuantity: new FormControl<number | null>(null, [Validators.required, Validators.min(0.0001)]),
    numberOfBins: new FormControl<number | null>(2, [Validators.required, Validators.min(1), Validators.max(20)]),
    supplySource: new FormControl<KanbanSupplySource>('Purchase', { nonNullable: true }),
    supplyVendorId: new FormControl<number | null>(null),
    supplyWorkCenterId: new FormControl<number | null>(null),
    leadTimeDays: new FormControl<number | null>(null, [Validators.min(0)]),
    isActive: new FormControl(true, { nonNullable: true }),
  });
  protected readonly cardViolations = FormValidationService.getViolations(this.cardForm, {
    partId: this.translate.instant('replenishmentUi.part'),
    workCenterId: this.translate.instant('inventoryScreens.cards.workCenter'),
    binQuantity: this.translate.instant('inventoryScreens.cards.containerQty'),
    numberOfBins: this.translate.instant('inventoryScreens.cards.containers'),
  });
  protected readonly supplySource = toSignal(this.cardForm.controls.supplySource.valueChanges.pipe(startWith('Purchase' as KanbanSupplySource)), { initialValue: 'Purchase' as KanbanSupplySource });
  protected readonly isNew = computed(() => this.editing() === 'new');

  protected readonly confirming = signal<ReplenishmentCard | null>(null);
  protected readonly fulfilledControl = new FormControl<number | null>(null, [Validators.required, Validators.min(0.0001)]);

  constructor() {
    this.load();
    if (this.canEdit && this.capabilities.isEnabled('CAP-MD-WORKCENTERS')) {
      this.schedulingService.getWorkCenters().pipe(catchError(() => of<WorkCenter[]>([])), takeUntilDestroyed(this.destroyRef))
        .subscribe(centers => this.workCenters.set(centers));
    }
  }

  protected load(): void {
    this.loading.set(true);
    this.cardsService.getCards(this.statusFilter.value).subscribe({
      next: page => { this.cards.set(page.data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected statusClass(status: KanbanCardStatus): string {
    return STATUS_CHIPS[status] ?? 'chip';
  }

  protected canTrigger(card: ReplenishmentCard): boolean {
    return card.isActive && (card.status === 'Full' || card.status === 'Empty');
  }

  protected awaitingRefill(card: ReplenishmentCard): boolean {
    return card.status === 'Triggered' || card.status === 'InReplenishment';
  }

  protected trigger(card: ReplenishmentCard, triggerType: 'Manual' | 'Scan' = 'Manual'): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.cardsService.trigger(card.id, triggerType).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('inventoryScreens.cards.triggered', { card: card.cardNumber, part: card.partNumber }));
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  protected scan(): void {
    const code = this.scanControl.value.trim();
    if (!code) return;
    const card = this.cards().find(c => c.cardNumber.toLowerCase() === code.toLowerCase());
    this.scanControl.setValue('');
    if (!card) {
      this.snackbar.error(this.translate.instant('inventoryScreens.cards.scanUnknown', { code }));
      return;
    }
    if (!this.canTrigger(card)) {
      this.snackbar.info(this.translate.instant('inventoryScreens.cards.scanAlreadyWaiting', { card: card.cardNumber }));
      return;
    }
    this.trigger(card, 'Scan');
  }

  protected openConfirm(card: ReplenishmentCard): void {
    this.fulfilledControl.reset(card.binQuantity);
    this.confirming.set(card);
  }

  protected closeConfirm(): void {
    this.confirming.set(null);
  }

  protected confirmRefill(): void {
    const card = this.confirming();
    if (!card || this.fulfilledControl.invalid || this.saving()) return;
    this.saving.set(true);
    this.cardsService.confirm(card.id, this.fulfilledControl.value!).subscribe({
      next: () => {
        this.saving.set(false);
        this.confirming.set(null);
        this.snackbar.success(this.translate.instant('inventoryScreens.cards.refilled', { card: card.cardNumber }));
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  protected openDetail(card: ReplenishmentCard): void {
    this.cardsService.getCard(card.id).subscribe({ next: detail => this.detail.set(detail) });
  }

  protected closeDetail(): void {
    this.detail.set(null);
  }

  protected print(card: ReplenishmentCard): void {
    const labels = Array.from({ length: Math.max(card.numberOfBins, 1) }, (_, i) => ({
      type: 'barcode' as const,
      value: card.cardNumber,
      label: `${card.partNumber} · ${this.translate.instant('inventoryScreens.cards.containerOf', { n: i + 1, total: card.numberOfBins })}`,
      sublabel: this.translate.instant('inventoryScreens.cards.labelDetail', {
        qty: card.binQuantity, bin: card.storageLocationName ?? '—',
      }),
      width: 70,
    }));
    void this.labels.printLabels(labels);
  }

  protected openCreate(): void {
    this.cardForm.reset({
      partId: null, workCenterId: null, storageLocationId: null, binQuantity: null, numberOfBins: 2,
      supplySource: 'Purchase', supplyVendorId: null, supplyWorkCenterId: null, leadTimeDays: null, isActive: true,
    });
    this.cardForm.controls.partId.enable();
    this.cardForm.controls.workCenterId.enable();
    this.editing.set('new');
  }

  protected openEdit(card: ReplenishmentCard): void {
    this.cardForm.reset({
      partId: card.partId, workCenterId: card.workCenterId, storageLocationId: card.storageLocationId,
      binQuantity: card.binQuantity, numberOfBins: card.numberOfBins, supplySource: card.supplySource,
      supplyVendorId: card.supplyVendorId, supplyWorkCenterId: card.supplyWorkCenterId,
      leadTimeDays: card.leadTimeDays, isActive: card.isActive,
    });
    this.cardForm.controls.partId.disable();
    this.cardForm.controls.workCenterId.disable();
    this.editing.set(card);
  }

  protected closeEdit(): void {
    this.editing.set(null);
  }

  protected saveCard(): void {
    const target = this.editing();
    if (!target || this.cardForm.invalid || this.saving()) return;
    const v = this.cardForm.getRawValue();
    const request = {
      storageLocationId: v.storageLocationId,
      binQuantity: v.binQuantity!,
      numberOfBins: v.numberOfBins!,
      supplySource: v.supplySource,
      supplyVendorId: v.supplySource === 'Purchase' ? v.supplyVendorId : null,
      supplyWorkCenterId: v.supplySource === 'Production' ? v.supplyWorkCenterId : null,
      leadTimeDays: v.leadTimeDays,
    };
    this.saving.set(true);
    const call = target === 'new'
      ? this.cardsService.create({ ...request, partId: v.partId!, workCenterId: v.workCenterId! })
      : this.cardsService.update(target.id, { ...request, isActive: v.isActive });
    call.subscribe({
      next: card => {
        this.saving.set(false);
        this.editing.set(null);
        this.snackbar.success(this.translate.instant(target === 'new' ? 'inventoryScreens.cards.created' : 'inventoryScreens.cards.saved', { card: card.cardNumber }));
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }
}
