import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

import { PartsService } from '../../services/parts.service';
import { PartDetail } from '../../models/part-detail.model';
import { PartListItem } from '../../models/part-list-item.model';
import { BOMEntry } from '../../models/bom-entry.model';
import { PartStatus } from '../../models/part-status.type';
import { BOMSourceType } from '../../models/bom-source-type.type';
import { PartPrice } from '../../models/part-price.model';
import { PartInventorySummary } from '../../models/part-inventory-summary.model';
import { AccountingService } from '../../../../shared/services/accounting.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { AccountingItem } from '../../../admin/models/accounting-item.model';
import { FileAttachment } from '../../../../shared/models/file.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { StlViewerComponent } from '../../../../shared/components/stl-viewer/stl-viewer.component';
import { FileUploadZoneComponent } from '../../../../shared/components/file-upload-zone/file-upload-zone.component';
import { BarcodeInfoComponent } from '../../../../shared/components/barcode-info/barcode-info.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { RoutingComponent } from '../routing/routing.component';
import { BomTreeComponent } from '../bom-tree/bom-tree.component';
import { EntityActivitySectionComponent } from '../../../../shared/components/entity-activity-section/entity-activity-section.component';
import { PartAlternatesTabComponent } from '../part-alternates-tab/part-alternates-tab.component';
import { toIsoDate } from '../../../../shared/utils/date.utils';

type BomViewMode = 'table' | 'tree';

@Component({
  selector: 'app-part-detail-panel',
  standalone: true,
  imports: [
    CurrencyPipe, DatePipe, DecimalPipe, ReactiveFormsModule, TranslatePipe,
    MatTooltipModule,
    DialogComponent, InputComponent, SelectComponent, TextareaComponent, DatepickerComponent,
    EntityPickerComponent, EmptyStateComponent, LoadingBlockDirective, ValidationPopoverDirective,
    StlViewerComponent, FileUploadZoneComponent, BarcodeInfoComponent,
    RoutingComponent, BomTreeComponent, EntityActivitySectionComponent, PartAlternatesTabComponent,
  ],
  templateUrl: './part-detail-panel.component.html',
  styleUrl: './part-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartDetailPanelComponent {
  protected readonly partsService = inject(PartsService);
  protected readonly accountingService = inject(AccountingService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly partId = input.required<number>();
  readonly closed = output<void>();
  readonly editRequested = output<PartDetail>();

  protected readonly part = signal<PartDetail | null>(null);
  protected readonly detailLoading = signal(false);
  protected readonly detailTab = signal<'info' | 'bom' | 'usage' | 'process' | 'viewer' | 'files' | 'alternates'>('info');

  // ── BOM view mode ──
  protected readonly bomViewMode = signal<BomViewMode>('table');

  // ── Files & Inventory ──
  protected readonly partFiles = signal<FileAttachment[]>([]);
  protected readonly inventorySummary = signal<PartInventorySummary | null>(null);
  protected readonly stlFile = computed(() => {
    return this.partFiles().find(f => f.fileName.toLowerCase().endsWith('.stl')) ?? null;
  });
  protected readonly stlFileUrl = computed(() => {
    const file = this.stlFile();
    return file ? this.partsService.getFileDownloadUrl(file.id) : null;
  });

  protected readonly isLowStock = computed(() => {
    const p = this.part();
    const inv = this.inventorySummary();
    if (!p?.minStockThreshold || !inv) return false;
    return inv.totalQuantity < p.minStockThreshold;
  });

  protected readonly partStatuses: PartStatus[] = ['Active', 'Draft', 'Prototype', 'Obsolete'];

  // ── Pricing ──
  protected readonly partPrices = signal<PartPrice[]>([]);
  protected readonly priceSaving = signal(false);

  protected readonly currentPrice = computed(() =>
    this.partPrices().find(p => p.isCurrent) ?? null
  );
  protected readonly priceHistory = computed(() =>
    this.partPrices().filter(p => !p.isCurrent).slice(0, 5)
  );

  protected readonly priceForm = new FormGroup({
    unitPrice: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    effectiveFrom: new FormControl<Date | null>(new Date()),
    notes: new FormControl(''),
  });

  // ── Accounting Link Dialog ──
  protected readonly showLinkDialog = signal(false);
  protected readonly accountingItemsLoading = signal(false);
  protected readonly linkSaving = signal(false);

  protected readonly isLinked = computed(() => !!this.part()?.externalId);

  // ── BOM Dialog ──
  protected readonly showBomDialog = signal(false);

  protected readonly bomForm = new FormGroup({
    childPartId: new FormControl<number | null>(null, [Validators.required]),
    quantity: new FormControl(1, [Validators.required, Validators.min(0.01)]),
    sourceType: new FormControl('Buy'),
    referenceDesignator: new FormControl(''),
    leadTimeDays: new FormControl<number | null>(null),
    notes: new FormControl(''),
  });

  protected readonly bomViolations = FormValidationService.getViolations(this.bomForm, {
    childPartId: 'Child Part', quantity: 'Quantity',
  });

  protected readonly sourceTypeOptions: SelectOption[] = [
    { value: 'Make', label: this.translate.instant('parts.sourceMake') },
    { value: 'Buy', label: this.translate.instant('parts.sourceBuy') },
    { value: 'Stock', label: this.translate.instant('parts.sourceStock') },
  ];

  constructor() {
    effect(() => {
      const id = this.partId();
      if (id) {
        this.loadDetail(id);
      }
    });
  }

  // ── Data Loading ──

  private loadDetail(id: number): void {
    this.detailLoading.set(true);
    this.detailTab.set('info');
    this.partFiles.set([]);
    this.inventorySummary.set(null);
    this.partPrices.set([]);
    this.priceForm.reset({ unitPrice: null, effectiveFrom: new Date(), notes: '' });
    this.partsService.getPartById(id).subscribe({
      next: (detail) => {
        this.part.set(detail);
        this.detailLoading.set(false);
        this.partsService.getPartFiles(detail.id).subscribe({
          next: (files) => this.partFiles.set(files),
        });
        this.partsService.getPartInventorySummary(detail.id).subscribe({
          next: (summary) => this.inventorySummary.set(summary),
        });
        this.partsService.getPartPrices(detail.id).subscribe({
          next: (prices) => this.partPrices.set(prices),
        });
      },
      error: () => this.detailLoading.set(false),
    });
  }

  // ── Actions ──

  protected openEditPart(): void {
    const p = this.part();
    if (p) {
      this.editRequested.emit(p);
    }
  }

  protected closePanel(): void {
    this.closed.emit();
  }

  protected updatePartStatus(status: PartStatus): void {
    const p = this.part();
    if (!p) return;
    this.partsService.updatePart(p.id, { status }).subscribe({
      next: (detail) => {
        this.part.set(detail);
      },
    });
  }

  protected addPrice(): void {
    if (this.priceForm.invalid) return;
    const p = this.part();
    if (!p) return;
    this.priceSaving.set(true);
    const f = this.priceForm.getRawValue();
    const request = {
      unitPrice: f.unitPrice!,
      effectiveFrom: f.effectiveFrom ? toIsoDate(f.effectiveFrom) ?? undefined : undefined,
      notes: f.notes || undefined,
    };
    this.partsService.addPartPrice(p.id, request).subscribe({
      next: () => {
        this.priceSaving.set(false);
        this.priceForm.reset({ unitPrice: null, effectiveFrom: new Date(), notes: '' });
        this.partsService.getPartPrices(p.id).subscribe({
          next: (prices) => this.partPrices.set(prices),
        });
        this.snackbar.success('Price updated');
      },
      error: () => this.priceSaving.set(false),
    });
  }

  // ── Accounting Linkage ──

  protected openLinkDialog(): void {
    this.accountingItemsLoading.set(true);
    this.accountingService.loadItems();
    this.accountingItemsLoading.set(false);
    this.showLinkDialog.set(true);
  }

  protected closeLinkDialog(): void {
    this.showLinkDialog.set(false);
  }

  protected linkToAccountingItem(item: AccountingItem): void {
    const p = this.part();
    if (!p || !item.externalId) return;
    this.linkSaving.set(true);
    this.partsService.linkAccountingItem(p.id, item.externalId, item.name).subscribe({
      next: () => {
        this.linkSaving.set(false);
        this.closeLinkDialog();
        this.loadDetail(p.id);
        this.snackbar.success(this.translate.instant('parts.link') + ` ${item.name}`);
      },
      error: () => this.linkSaving.set(false),
    });
  }

  protected unlinkAccountingItem(): void {
    const p = this.part();
    if (!p) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('parts.unlinkAccountingItem'),
        message: this.translate.instant('parts.unlinkMessage', { partNumber: p.partNumber }),
        confirmLabel: this.translate.instant('parts.unlink'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.partsService.unlinkAccountingItem(p.id).subscribe({
        next: () => {
          this.loadDetail(p.id);
          this.snackbar.success(this.translate.instant('parts.accountingUnlinked'));
        },
      });
    });
  }

  // ── BOM ──

  protected openAddBom(): void {
    this.bomForm.reset({
      childPartId: null, quantity: 1, referenceDesignator: '',
      sourceType: 'Buy', leadTimeDays: null, notes: '',
    });
    this.showBomDialog.set(true);
  }

  protected closeBomDialog(): void {
    this.showBomDialog.set(false);
  }

  protected saveBomEntry(): void {
    if (this.bomForm.invalid) return;
    const p = this.part();
    if (!p) return;
    const form = this.bomForm.getRawValue();
    this.partsService.createBOMEntry(p.id, {
      childPartId: form.childPartId!,
      quantity: form.quantity!,
      referenceDesignator: form.referenceDesignator || undefined,
      sourceType: (form.sourceType as BOMSourceType) ?? 'Buy',
      leadTimeDays: form.leadTimeDays ?? undefined,
      notes: form.notes || undefined,
    }).subscribe({
      next: (detail) => {
        this.part.set(detail);
        this.closeBomDialog();
        this.snackbar.success(this.translate.instant('parts.bomEntryAdded'));
      },
    });
  }

  protected deleteBomEntry(entry: BOMEntry): void {
    const p = this.part();
    if (!p) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('parts.deleteBomEntry'),
        message: this.translate.instant('parts.deleteBomMessage'),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.partsService.deleteBOMEntry(p.id, entry.id).subscribe({
        next: (detail) => {
          this.part.set(detail);
          this.snackbar.success(this.translate.instant('parts.bomEntryDeleted'));
        },
      });
    });
  }

  protected navigateToPart(usage: { parentPartId: number }): void {
    // Reload the detail panel with the parent part
    this.loadDetail(usage.parentPartId);
  }

  // ── Files ──

  protected onFileUploaded(): void {
    const p = this.part();
    if (!p) return;
    this.partsService.getPartFiles(p.id).subscribe({
      next: (files) => this.partFiles.set(files),
    });
  }

  // ── Helpers ──

  protected getStatusClass(status: string): string {
    switch (status) {
      case 'Active': return 'status-badge--active';
      case 'Draft': return 'status-badge--draft';
      case 'Prototype': return 'status-badge--prototype';
      case 'Obsolete': return 'status-badge--obsolete';
      default: return '';
    }
  }

  protected getTypeIcon(type: string): string {
    return type === 'Assembly' ? 'account_tree' : 'settings';
  }
}
