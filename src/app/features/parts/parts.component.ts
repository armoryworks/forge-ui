import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { PartsService } from './services/parts.service';
import { PartListItem } from './models/part-list-item.model';
import { PartDetail } from './models/part-detail.model';
import { BOMEntry } from './models/bom-entry.model';
import { PartStatus } from './models/part-status.type';
import { PartType } from './models/part-type.type';
import { BOMSourceType } from './models/bom-source-type.type';
import { AccountingService } from '../../shared/services/accounting.service';
import { ScannerService } from '../../shared/services/scanner.service';
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

@Component({
  selector: 'app-parts',
  standalone: true,
  imports: [
    DecimalPipe, ReactiveFormsModule,
    PageHeaderComponent, DialogComponent,
    InputComponent, SelectComponent, TextareaComponent,
    DataTableComponent, EntityPickerComponent, ColumnCellDirective, ValidationPopoverDirective,
    EmptyStateComponent, LoadingBlockDirective, StlViewerComponent, FileUploadZoneComponent,
    ProcessPlanComponent, BarcodeInfoComponent,
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

  protected readonly loading = signal(false);
  protected readonly parts = signal<PartListItem[]>([]);
  protected readonly selectedPart = signal<PartDetail | null>(null);
  protected readonly detailLoading = signal(false);

  // ── Page Filters ──
  protected readonly searchControl = new FormControl('');
  protected readonly statusFilterControl = new FormControl<PartStatus | ''>('');
  protected readonly typeFilterControl = new FormControl<PartType | ''>('');

  private readonly searchTerm = toSignal(this.searchControl.valueChanges.pipe(startWith('')), { initialValue: '' });
  private readonly statusFilter = toSignal(this.statusFilterControl.valueChanges.pipe(startWith('' as PartStatus | '')), { initialValue: '' as PartStatus | '' });
  private readonly typeFilter = toSignal(this.typeFilterControl.valueChanges.pipe(startWith('' as PartType | '')), { initialValue: '' as PartType | '' });

  protected readonly statusFilterOptions: SelectOption[] = [
    { value: '', label: 'All Statuses' },
    { value: 'Active', label: 'Active' },
    { value: 'Draft', label: 'Draft' },
    { value: 'Prototype', label: 'Prototype' },
    { value: 'Obsolete', label: 'Obsolete' },
  ];

  protected readonly typeFilterOptions: SelectOption[] = [
    { value: '', label: 'All Types' },
    { value: 'Part', label: 'Part' },
    { value: 'Assembly', label: 'Assembly' },
    { value: 'RawMaterial', label: 'Raw Material' },
    { value: 'Consumable', label: 'Consumable' },
    { value: 'Tooling', label: 'Tooling' },
    { value: 'Fastener', label: 'Fastener' },
    { value: 'Electronic', label: 'Electronic' },
    { value: 'Packaging', label: 'Packaging' },
  ];

  protected readonly partColumns: ColumnDef[] = [
    { field: 'partNumber', header: 'Part #', sortable: true, width: '120px' },
    { field: 'externalPartNumber', header: 'Ext. Part #', sortable: true, width: '120px' },
    { field: 'description', header: 'Description', sortable: true },
    { field: 'revision', header: 'Rev', width: '60px', align: 'center' },
    { field: 'partType', header: 'Type', sortable: true },
    { field: 'status', header: 'Status', sortable: true, filterable: true, type: 'enum', filterOptions: [
      { value: 'Active', label: 'Active' }, { value: 'Draft', label: 'Draft' }, { value: 'Prototype', label: 'Prototype' }, { value: 'Obsolete', label: 'Obsolete' },
    ]},
    { field: 'material', header: 'Material' },
    { field: 'bomEntryCount', header: 'BOM', width: '60px', align: 'center' },
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
    { value: 'Part', label: 'Part' },
    { value: 'Assembly', label: 'Assembly' },
    { value: 'RawMaterial', label: 'Raw Material' },
    { value: 'Consumable', label: 'Consumable' },
    { value: 'Tooling', label: 'Tooling' },
    { value: 'Fastener', label: 'Fastener' },
    { value: 'Electronic', label: 'Electronic' },
    { value: 'Packaging', label: 'Packaging' },
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
    { value: 'Make', label: 'Make' },
    { value: 'Buy', label: 'Buy' },
    { value: 'Stock', label: 'Stock' },
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
          this.snackbar.success('Part updated.');
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
          this.snackbar.success('Part created.');
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
        this.snackbar.success('BOM entry added.');
      },
    });
  }

  protected deleteBomEntry(entry: BOMEntry): void {
    const part = this.selectedPart();
    if (!part) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete BOM Entry?',
        message: 'This will permanently remove this BOM entry from the part.',
        confirmLabel: 'Delete',
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.partsService.deleteBOMEntry(part.id, entry.id).subscribe({
        next: (detail) => {
          this.selectedPart.set(detail);
          this.loadParts();
          this.snackbar.success('BOM entry deleted.');
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
        title: 'Delete Part?',
        message: `This will permanently delete "${part.partNumber}".`,
        confirmLabel: 'Delete',
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.partsService.deletePart(part.id).subscribe({
        next: () => {
          this.selectedPart.set(null);
          this.loadParts();
          this.snackbar.success('Part deleted.');
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
        this.snackbar.success(`Linked to ${item.name}.`);
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
        title: 'Unlink Accounting Item?',
        message: `This will remove the link between "${part.partNumber}" and its accounting item.`,
        confirmLabel: 'Unlink',
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.partsService.unlinkAccountingItem(part.id).subscribe({
        next: () => {
          this.selectPart({ id: part.id } as PartListItem);
          this.snackbar.success('Accounting item unlinked.');
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
}
