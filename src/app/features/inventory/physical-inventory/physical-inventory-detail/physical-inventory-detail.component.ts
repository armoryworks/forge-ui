import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { map } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PhysicalInventoryService } from '../services/physical-inventory.service';
import { PhysicalInventoryDetail } from '../models/physical-inventory-detail.model';
import { PhysicalInventoryTag } from '../models/physical-inventory-tag.model';
import { PhysicalInventoryVariance } from '../models/physical-inventory-variance.model';
import { PhysicalInventoryStatus } from '../models/physical-inventory-status.type';
import { PhysicalCountRow } from '../models/physical-count-row.model';
import { physicalInventoryStatusChip } from '../physical-inventory-status';
import { PhysicalInventoryTagDialogComponent } from '../components/physical-inventory-tag-dialog/physical-inventory-tag-dialog.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { AuthService } from '../../../../shared/services/auth.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { downloadBlob } from '../../../../shared/utils/download-blob';
import { DateOnlyPipe } from '../../../../shared/pipes/date-only.pipe';

const STEPS: PhysicalInventoryStatus[] = ['Draft', 'Frozen', 'Counting', 'Review', 'Posted'];

/**
 * One physical inventory, as a wizard over its status: freeze the draft, print the count sheets, enter counts by
 * tag (recounts where the tolerance asks for one), review the variance at current cost, then post. Counting is
 * open to the stock roles; the lifecycle actions and the variance are Admin and Manager.
 */
@Component({
  selector: 'app-physical-inventory-detail',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, DecimalPipe, RouterLink,
    PageHeaderComponent, InputComponent, ToggleComponent, DataTableComponent, CurrencyDisplayComponent,
    ColumnCellDirective, LoadingBlockDirective, PhysicalInventoryTagDialogComponent, DateOnlyPipe,
  ],
  templateUrl: './physical-inventory-detail.component.html',
  styleUrl: './physical-inventory-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhysicalInventoryDetailComponent {
  private readonly service = inject(PhysicalInventoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialog = inject(MatDialog);

  private readonly id = toSignal(this.route.paramMap.pipe(map(p => Number(p.get('id')))), { initialValue: 0 });

  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly inventory = signal<PhysicalInventoryDetail | null>(null);
  protected readonly variance = signal<PhysicalInventoryVariance | null>(null);
  protected readonly showTagDialog = signal(false);
  protected readonly savingTagId = signal<number | null>(null);

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly pendingOnlyControl = new FormControl(false, { nonNullable: true });
  private readonly search = toSignal(this.searchControl.valueChanges, { initialValue: '' });
  private readonly pendingOnly = toSignal(this.pendingOnlyControl.valueChanges, { initialValue: false });

  protected readonly canManage = computed(() => this.auth.hasAnyRole(['Admin', 'Manager']));
  protected readonly status = computed(() => this.inventory()?.status ?? 'Draft');
  protected readonly counting = computed(() => this.status() === 'Frozen' || this.status() === 'Counting');
  protected readonly reviewing = computed(() => this.status() === 'Review' || this.status() === 'Posted');
  protected readonly closed = computed(() => this.status() === 'Posted' || this.status() === 'Cancelled');
  protected readonly showBook = computed(() => this.inventory()?.bookQuantitiesVisible ?? false);
  protected readonly canSubmitReview = computed(() => {
    const inv = this.inventory();
    return !!inv && this.counting() && inv.tagCount > 0 && inv.countedTagCount === inv.tagCount;
  });

  protected readonly steps = computed(() => {
    const current = this.status();
    const index = STEPS.indexOf(current);
    return STEPS.map((step, i) => ({
      status: step,
      done: index > i || current === 'Posted',
      current: step === current,
    }));
  });

  protected readonly rows = computed<PhysicalCountRow[]>(() => {
    const term = this.search().trim().toLowerCase();
    const pending = this.pendingOnly();
    return (this.inventory()?.tags ?? [])
      .filter(t => t.status !== 'Void')
      .filter(t => !pending || t.status === 'Open' || t.status === 'RecountRequired')
      .filter(t => !term
        || String(t.tagNumber) === term
        || t.partNumber.toLowerCase().includes(term)
        || t.locationName.toLowerCase().includes(term)
        || (t.lotNumber ?? '').toLowerCase().includes(term))
      .map(t => this.toRow(t));
  });

  private readonly controls = new Map<number, FormControl<number | null>>();

  protected readonly countColumns = computed<ColumnDef[]>(() => [
    { field: 'tagNumber', header: this.translate.instant('physicalInventory.tag'), sortable: true, width: '80px' },
    { field: 'locationName', header: this.translate.instant('physicalInventory.location'), sortable: true },
    { field: 'partNumber', header: this.translate.instant('common.part'), sortable: true },
    { field: 'lotNumber', header: this.translate.instant('physicalInventory.lot'), sortable: true, phoneHidden: true },
    ...(this.showBook()
      ? [{ field: 'frozenQuantity', header: this.translate.instant('physicalInventory.bookQuantity'), sortable: true, type: 'number', align: 'right', width: '110px' } as ColumnDef]
      : []),
    { field: 'finalQuantity', header: this.translate.instant('physicalInventory.counted'), sortable: false, align: 'right', width: '200px' },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, width: '140px' },
  ]);

  protected readonly varianceColumns: ColumnDef[] = [
    { field: 'tagNumber', header: this.translate.instant('physicalInventory.tag'), sortable: true, width: '80px' },
    { field: 'partNumber', header: this.translate.instant('common.part'), sortable: true },
    { field: 'locationName', header: this.translate.instant('physicalInventory.location'), sortable: true, phoneHidden: true },
    { field: 'frozenQuantity', header: this.translate.instant('physicalInventory.bookQuantity'), sortable: true, type: 'number', align: 'right', width: '100px' },
    { field: 'countedQuantity', header: this.translate.instant('physicalInventory.counted'), sortable: true, type: 'number', align: 'right', width: '100px' },
    { field: 'varianceQuantity', header: this.translate.instant('physicalInventory.varianceQuantity'), sortable: true, type: 'number', align: 'right', width: '100px' },
    { field: 'unitCost', header: this.translate.instant('physicalInventory.unitCost'), sortable: true, align: 'right', width: '110px' },
    { field: 'varianceValue', header: this.translate.instant('physicalInventory.varianceValue'), sortable: true, align: 'right', width: '120px' },
  ];

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(() => this.load());
  }

  protected load(): void {
    const id = this.id();
    if (!id) return;
    this.loading.set(true);
    this.service.get(id).subscribe({
      next: detail => {
        this.setInventory(detail);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private setInventory(detail: PhysicalInventoryDetail): void {
    this.inventory.set(detail);
    for (const tag of detail.tags) {
      const control = this.controlFor(tag.id);
      control.setValue(tag.status === 'RecountRequired' ? null : tag.finalQuantity, { emitEvent: false });
    }
    if (this.canManage() && (detail.status === 'Review' || detail.status === 'Posted')) this.loadVariance();
    else this.variance.set(null);
  }

  private loadVariance(): void {
    this.service.variance(this.id()).subscribe({ next: v => this.variance.set(v) });
  }

  private controlFor(tagId: number): FormControl<number | null> {
    let control = this.controls.get(tagId);
    if (!control) {
      control = new FormControl<number | null>(null, [Validators.min(0)]);
      this.controls.set(tagId, control);
    }
    return control;
  }

  private toRow(tag: PhysicalInventoryTag): PhysicalCountRow {
    return { ...tag, control: this.controlFor(tag.id), isRecount: tag.status === 'RecountRequired' || tag.status === 'Recounted' };
  }

  protected saveCount(row: PhysicalCountRow): void {
    const quantity = row.control.value;
    if (quantity === null || quantity < 0 || this.savingTagId() !== null) return;
    this.savingTagId.set(row.id);
    this.service.enterCount(row.physicalInventoryId, row.id, quantity).subscribe({
      next: tag => {
        this.savingTagId.set(null);
        this.replaceTag(tag);
        if (tag.status === 'RecountRequired')
          this.snackbar.warn(this.translate.instant('physicalInventory.recountAsked', { tag: tag.tagNumber }));
      },
      error: () => this.savingTagId.set(null),
    });
  }

  private replaceTag(tag: PhysicalInventoryTag): void {
    const current = this.inventory();
    if (!current) return;
    const tags = current.tags.some(t => t.id === tag.id)
      ? current.tags.map(t => (t.id === tag.id ? tag : t))
      : [...current.tags, tag];
    const live = tags.filter(t => t.status !== 'Void');
    this.setInventory({
      ...current,
      status: current.status === 'Frozen' ? 'Counting' : current.status,
      tags,
      tagCount: live.length,
      countedTagCount: live.filter(t => t.status === 'Counted' || t.status === 'Recounted').length,
      recountTagCount: live.filter(t => t.status === 'RecountRequired').length,
    });
  }

  protected onTagAdded(tag: PhysicalInventoryTag): void {
    this.showTagDialog.set(false);
    this.replaceTag(tag);
  }

  protected freeze(): void {
    this.confirm('physicalInventory.freezeTitle', 'physicalInventory.freezeMessage', 'physicalInventory.freeze', 'warn',
      () => this.run(this.service.freeze(this.id()), 'physicalInventory.frozen'));
  }

  protected submitForReview(): void {
    this.run(this.service.submitForReview(this.id()), 'physicalInventory.inReview');
  }

  protected reopen(): void {
    this.run(this.service.reopen(this.id()), 'physicalInventory.reopened');
  }

  protected post(): void {
    this.confirm('physicalInventory.postTitle', 'physicalInventory.postMessage', 'physicalInventory.post', 'warn',
      () => this.run(this.service.post(this.id()), 'physicalInventory.posted'));
  }

  protected cancel(): void {
    this.confirm('physicalInventory.cancelTitle', 'physicalInventory.cancelMessage', 'physicalInventory.cancelCount', 'danger',
      () => this.run(this.service.cancel(this.id()), 'physicalInventory.cancelled'));
  }

  protected printSheets(): void {
    const inv = this.inventory();
    if (!inv) return;
    this.busy.set(true);
    this.service.countSheets(inv.id, this.translate.currentLang || 'en').subscribe({
      next: blob => {
        this.busy.set(false);
        downloadBlob(blob, `${inv.inventoryNumber}-count-sheets.pdf`);
      },
      error: () => this.busy.set(false),
    });
  }

  protected statusClass(status: string): string {
    return physicalInventoryStatusChip(status);
  }

  private run(request: ReturnType<PhysicalInventoryService['freeze']>, messageKey: string): void {
    this.busy.set(true);
    request.subscribe({
      next: detail => {
        this.busy.set(false);
        this.setInventory(detail);
        this.snackbar.success(this.translate.instant(messageKey, { number: detail.inventoryNumber }));
      },
      error: () => this.busy.set(false),
    });
  }

  private confirm(titleKey: string, messageKey: string, confirmKey: string, severity: 'warn' | 'danger', action: () => void): void {
    const inv = this.inventory();
    if (!inv) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '440px',
      data: {
        title: this.translate.instant(titleKey, { number: inv.inventoryNumber }),
        message: this.translate.instant(messageKey, { number: inv.inventoryNumber }),
        confirmLabel: this.translate.instant(confirmKey),
        severity,
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) action();
    });
  }
}
