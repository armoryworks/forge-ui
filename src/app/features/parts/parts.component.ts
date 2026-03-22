import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, startWith } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PartsService } from './services/parts.service';
import { PartListItem } from './models/part-list-item.model';
import { PartDetail } from './models/part-detail.model';
import { BOMEntry } from './models/bom-entry.model';
import { PartStatus } from './models/part-status.type';
import { PartType } from './models/part-type.type';
import { BOMSourceType } from './models/bom-source-type.type';
import { AccountingService } from '../../shared/services/accounting.service';
import { ScannerService } from '../../shared/services/scanner.service';
import { UserPreferencesService } from '../../shared/services/user-preferences.service';
import { AccountingItem } from '../admin/models/accounting-item.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { TextareaComponent } from '../../shared/components/textarea/textarea.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { EntityPickerComponent } from '../../shared/components/entity-picker/entity-picker.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { FormValidationService } from '../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../shared/directives/validation-popover.directive';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { StlViewerComponent } from '../../shared/components/stl-viewer/stl-viewer.component';
import { FileUploadZoneComponent } from '../../shared/components/file-upload-zone/file-upload-zone.component';
import { FileAttachment } from '../../shared/models/file.model';
import { PartInventorySummary } from './models/part-inventory-summary.model';
import { ProcessPlanComponent } from './components/process-plan/process-plan.component';
import { BarcodeInfoComponent } from '../../shared/components/barcode-info/barcode-info.component';
import { PartsCardGridComponent } from './components/parts-card-grid/parts-card-grid.component';
import { BomTreeComponent } from './components/bom-tree/bom-tree.component';

type ViewMode = 'table' | 'cards';
type BomViewMode = 'table' | 'tree';

@Component({
  selector: 'app-parts',
  standalone: true,
  imports: [
    DecimalPipe, ReactiveFormsModule, TranslatePipe,
    PageHeaderComponent, DialogComponent,
    InputComponent, SelectComponent, TextareaComponent,
    DataTableComponent, EntityPickerComponent, ColumnCellDirective, ValidationPopoverDirective,
    EmptyStateComponent, LoadingBlockDirective, StlViewerComponent, FileUploadZoneComponent,
    ProcessPlanComponent, BarcodeInfoComponent, MatTooltipModule,
    PartsCardGridComponent, BomTreeComponent,
  ],
  templateUrl: './parts.component.html',
  styleUrl: './parts.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartsComponent {
  protected readonly partsService = inject(PartsService);
  protected readonly accountingService = inject(AccountingService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly scanner = inject(ScannerService);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly userPreferences = inject(UserPreferencesService);

  protected readonly loading = signal(false);
  protected readonly parts = signal<PartListItem[]>([]);
  protected readonly selectedPart = signal<PartDetail | null>(null);
  protected readonly detailLoading = signal(false);

  // ── View Mode (table / cards) — URL param + persisted preference ──
  protected readonly viewMode = toSignal(
    this.route.queryParamMap.pipe(
      map(p => (p.get('view') as ViewMode) ?? (this.userPreferences.get<ViewMode>('parts:viewMode') ?? 'table')),
    ),
    { initialValue: (this.userPreferences.get<ViewMode>('parts:viewMode') ?? 'table') as ViewMode },
  );

  // ── BOM view mode (table / tree) — session-only ──
  protected readonly bomViewMode = signal<BomViewMode>('table');

  // ── Page Filters ──
  protected readonly searchControl = new FormControl('');
  protected readonly statusFilterControl = new FormControl<PartStatus | ''>('');
  protected readonly typeFilterControl = new FormControl<PartType | ''>('');

  private readonly searchTerm = toSignal(this.searchControl.valueChanges.pipe(startWith('')), { initialValue: '' });
  private readonly statusFilter = toSignal(this.statusFilterControl.valueChanges.pipe(startWith('' as PartStatus | '')), { initialValue: '' as PartStatus | '' });
  private readonly typeFilter = toSignal(this.typeFilterControl.valueChanges.pipe(startWith('' as PartType | '')), { initialValue: '' as PartType | '' });

  protected readonly statusFilterOptions: SelectOption[] = [
    { value: '', label: this.translate.instant('parts.allStatuses') },
    { value: 'Active', label: this.translate.instant('parts.statusActive') },
    { value: 'Draft', label: this.translate.instant('parts.statusDraft') },
    { value: 'Prototype', label: this.translate.instant('parts.statusPrototype') },
    { value: 'Obsolete', label: this.translate.instant('parts.statusObsolete') },
  ];

  protected readonly typeFilterOptions: SelectOption[] = [
    { value: '', label: this.translate.instant('parts.allTypes') },
    { value: 'Part', label: this.translate.instant('parts.typePart') },
    { value: 'Assembly', label: this.translate.instant('parts.typeAssembly') },
    { value: 'RawMaterial', label: this.translate.instant('parts.typeRawMaterial') },
    { value: 'Consumable', label: this.translate.instant('parts.typeConsumable') },
    { value: 'Tooling', label: this.translate.instant('parts.typeTooling') },
    { value: 'Fastener', label: this.translate.instant('parts.typeFastener') },
    { value: 'Electronic', label: this.translate.instant('parts.typeElectronic') },
    { value: 'Packaging', label: this.translate.instant('parts.typePackaging') },
  ];

  protected readonly partColumns: ColumnDef[] = [
    { field: 'partNumber', header: this.translate.instant('parts.partNumber'), sortable: true, width: '120px' },
    { field: 'externalPartNumber', header: this.translate.instant('parts.extPartNumber'), sortable: true, width: '120px' },
    { field: 'description', header: this.translate.instant('common.description'), sortable: true },
    { field: 'revision', header: this.translate.instant('parts.rev'), width: '60px', align: 'center' },
    { field: 'partType', header: this.translate.instant('common.type'), sortable: true },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, filterable: true, type: 'enum', filterOptions: [
      { value: 'Active', label: this.translate.instant('parts.statusActive') }, { value: 'Draft', label: this.translate.instant('parts.statusDraft') }, { value: 'Prototype', label: this.translate.instant('parts.statusPrototype') }, { value: 'Obsolete', label: this.translate.instant('parts.statusObsolete') },
    ]},
    { field: 'material', header: this.translate.instant('parts.material') },
    { field: 'bomEntryCount', header: this.translate.instant('parts.bom'), width: '60px', align: 'center' },
  ];

  protected readonly partRowClass = (row: unknown) => {
    const part = row as PartListItem;
    return part.id === this.selectedPart()?.id ? 'row--selected' : '';
  };

  // ── Part Dialog ──
  protected readonly showPartDialog = signal(false);
  protected readonly editingPart = signal<PartDetail | null>(null);

  protected readonly partForm = new FormGroup({
    description: new FormControl('', [Validators.required]),
    revision: new FormControl('A'),
    partType: new FormControl('Part', [Validators.required]),
    material: new FormControl(''),
    moldToolRef: new FormControl(''),
    externalPartNumber: new FormControl(''),
    toolingAssetId: new FormControl<number | null>(null),
  });

  protected readonly partViolations = FormValidationService.getViolations(this.partForm, {
    description: 'Description', partType: 'Type',
  });

  protected readonly partTypeOptions: SelectOption[] = [
    { value: 'Part', label: this.translate.instant('parts.typePart') },
    { value: 'Assembly', label: this.translate.instant('parts.typeAssembly') },
    { value: 'RawMaterial', label: this.translate.instant('parts.typeRawMaterial') },
    { value: 'Consumable', label: this.translate.instant('parts.typeConsumable') },
    { value: 'Tooling', label: this.translate.instant('parts.typeTooling') },
    { value: 'Fastener', label: this.translate.instant('parts.typeFastener') },
    { value: 'Electronic', label: this.translate.instant('parts.typeElectronic') },
    { value: 'Packaging', label: this.translate.instant('parts.typePackaging') },
  ];

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

  // Detail tab
  protected readonly detailTab = signal<'info' | 'bom' | 'usage' | 'process' | 'viewer' | 'files'>('info');

  // Files & Inventory
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
    const part = this.selectedPart();
    const inv = this.inventorySummary();
    if (!part?.minStockThreshold || !inv) return false;
    return inv.totalQuantity < part.minStockThreshold;
  });

  protected readonly partStatuses: PartStatus[] = ['Active', 'Draft', 'Prototype', 'Obsolete'];

  // ── Accounting Link Dialog ──
  protected readonly showLinkDialog = signal(false);
  protected readonly accountingItems = signal<AccountingItem[]>([]);
  protected readonly accountingItemsLoading = signal(false);
  protected readonly selectedAccountingItem = signal<AccountingItem | null>(null);
  protected readonly linkSaving = signal(false);

  protected readonly isLinked = computed(() => !!this.selectedPart()?.externalId);

  constructor() {
    this.scanner.setContext('parts');
    this.loadParts();

    effect(() => {
      const scan = this.scanner.lastScan();
      if (!scan || scan.context !== 'parts') return;
      this.scanner.clearLastScan();
      this.searchControl.setValue(scan.value);
      this.loadParts();
    });
  }

  // ── List ──

  protected loadParts(): void {
    this.loading.set(true);
    const status = (this.statusFilter() ?? '') || undefined;
    const type = (this.typeFilter() ?? '') || undefined;
    const search = (this.searchTerm() ?? '').trim() || undefined;
    this.partsService.getParts(status, type, search).subscribe({
      next: (parts) => { this.parts.set(parts); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected applyFilters(): void {
    this.loadParts();
  }

  protected clearSearch(): void {
    this.searchControl.setValue('');
    this.loadParts();
  }

  protected selectPart(part: PartListItem): void {
    this.detailLoading.set(true);
    this.detailTab.set('info');
    this.partFiles.set([]);
    this.inventorySummary.set(null);
    this.partsService.getPartById(part.id).subscribe({
      next: (detail) => {
        this.selectedPart.set(detail);
        this.detailLoading.set(false);
        this.partsService.getPartFiles(detail.id).subscribe({
          next: (files) => this.partFiles.set(files),
        });
        this.partsService.getPartInventorySummary(detail.id).subscribe({
          next: (summary) => this.inventorySummary.set(summary),
        });
      },
      error: () => this.detailLoading.set(false),
    });
  }

  protected closeDetail(): void {
    this.selectedPart.set(null);
  }

  // ── Part CRUD ──

  protected openCreatePart(): void {
    this.editingPart.set(null);
    this.partForm.reset({
      description: '', revision: 'A',
      partType: 'Part', material: '', moldToolRef: '', externalPartNumber: '',
      toolingAssetId: null,
    });
    this.showPartDialog.set(true);
  }

  protected openEditPart(): void {
    const part = this.selectedPart();
    if (!part) return;
    this.editingPart.set(part);
    this.partForm.patchValue({
      description: part.description,
      revision: part.revision,
      partType: part.partType,
      material: part.material ?? '',
      moldToolRef: part.moldToolRef ?? '',
      externalPartNumber: part.externalPartNumber ?? '',
      toolingAssetId: part.toolingAssetId,
    });
    this.showPartDialog.set(true);
  }

  protected closePartDialog(): void {
    this.showPartDialog.set(false);
  }

  protected savePart(): void {
    if (this.partForm.invalid) return;

    const form = this.partForm.getRawValue();
    const editing = this.editingPart();

    if (editing) {
      this.partsService.updatePart(editing.id, {
        description: form.description ?? '',
        revision: form.revision ?? 'A',
        partType: (form.partType as PartType) ?? 'Part',
        material: form.material || undefined,
        moldToolRef: form.moldToolRef || undefined,
        externalPartNumber: form.externalPartNumber || undefined,
        toolingAssetId: form.toolingAssetId ?? undefined,
      }).subscribe({
        next: (detail) => {
          this.selectedPart.set(detail);
          this.closePartDialog();
          this.loadParts();
          this.snackbar.success(this.translate.instant('parts.partUpdated'));
        },
      });
    } else {
      this.partsService.createPart({
        description: form.description ?? '',
        revision: form.revision || undefined,
        partType: (form.partType as PartType) ?? 'Part',
        material: form.material || undefined,
        moldToolRef: form.moldToolRef || undefined,
        externalPartNumber: form.externalPartNumber || undefined,
        toolingAssetId: form.toolingAssetId ?? undefined,
      }).subscribe({
        next: (detail) => {
          this.selectedPart.set(detail);
          this.closePartDialog();
          this.loadParts();
          this.snackbar.success(this.translate.instant('parts.partCreated'));
        },
      });
    }
  }

  protected updatePartStatus(status: PartStatus): void {
    const part = this.selectedPart();
    if (!part) return;
    this.partsService.updatePart(part.id, { status }).subscribe({
      next: (detail) => {
        this.selectedPart.set(detail);
        this.loadParts();
      },
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

    const part = this.selectedPart();
    if (!part) return;
    const form = this.bomForm.getRawValue();
    this.partsService.createBOMEntry(part.id, {
      childPartId: form.childPartId!,
      quantity: form.quantity!,
      referenceDesignator: form.referenceDesignator || undefined,
      sourceType: (form.sourceType as BOMSourceType) ?? 'Buy',
      leadTimeDays: form.leadTimeDays ?? undefined,
      notes: form.notes || undefined,
    }).subscribe({
      next: (detail) => {
        this.selectedPart.set(detail);
        this.closeBomDialog();
        this.loadParts();
        this.snackbar.success(this.translate.instant('parts.bomEntryAdded'));
      },
    });
  }

  protected deleteBomEntry(entry: BOMEntry): void {
    const part = this.selectedPart();
    if (!part) return;
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
      this.partsService.deleteBOMEntry(part.id, entry.id).subscribe({
        next: (detail) => {
          this.selectedPart.set(detail);
          this.loadParts();
          this.snackbar.success(this.translate.instant('parts.bomEntryDeleted'));
        },
      });
    });
  }

  protected deletePart(): void {
    const part = this.selectedPart();
    if (!part) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('parts.deletePart'),
        message: this.translate.instant('parts.deletePartMessage', { partNumber: part.partNumber }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.partsService.deletePart(part.id).subscribe({
        next: () => {
          this.selectedPart.set(null);
          this.loadParts();
          this.snackbar.success(this.translate.instant('parts.partDeleted'));
        },
      });
    });
  }

  // ── Accounting Linkage ──

  protected openLinkDialog(): void {
    this.selectedAccountingItem.set(null);
    this.accountingItemsLoading.set(true);
    this.accountingService.loadItems();
    // Subscribe to items signal change via a one-time load
    this.accountingItemsLoading.set(false);
    this.showLinkDialog.set(true);
  }

  protected closeLinkDialog(): void {
    this.showLinkDialog.set(false);
  }

  protected linkToAccountingItem(item: AccountingItem): void {
    const part = this.selectedPart();
    if (!part || !item.externalId) return;
    this.linkSaving.set(true);
    this.partsService.linkAccountingItem(part.id, item.externalId, item.name).subscribe({
      next: () => {
        this.linkSaving.set(false);
        this.closeLinkDialog();
        this.selectPart({ id: part.id } as PartListItem);
        this.snackbar.success(this.translate.instant('parts.link') + ` ${item.name}`);
      },
      error: () => this.linkSaving.set(false),
    });
  }

  protected unlinkAccountingItem(): void {
    const part = this.selectedPart();
    if (!part) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('parts.unlinkAccountingItem'),
        message: this.translate.instant('parts.unlinkMessage', { partNumber: part.partNumber }),
        confirmLabel: this.translate.instant('parts.unlink'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.partsService.unlinkAccountingItem(part.id).subscribe({
        next: () => {
          this.selectPart({ id: part.id } as PartListItem);
          this.snackbar.success(this.translate.instant('parts.accountingUnlinked'));
        },
      });
    });
  }

  protected getStatusClass(status: string): string {
    switch (status) {
      case 'Active': return 'status-badge--active';
      case 'Draft': return 'status-badge--draft';
      case 'Prototype': return 'status-badge--prototype';
      case 'Obsolete': return 'status-badge--obsolete';
      default: return '';
    }
  }

  protected onFileUploaded(): void {
    const part = this.selectedPart();
    if (!part) return;
    this.partsService.getPartFiles(part.id).subscribe({
      next: (files) => this.partFiles.set(files),
    });
  }

  protected getTypeIcon(type: string): string {
    return type === 'Assembly' ? 'account_tree' : 'settings';
  }

  protected setViewMode(mode: ViewMode): void {
    this.router.navigate([], {
      queryParams: { view: mode === 'table' ? null : mode },
      queryParamsHandling: 'merge',
    });
    this.userPreferences.set('parts:viewMode', mode);
  }
}
