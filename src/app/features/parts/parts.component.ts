import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { PartsService } from './services/parts.service';
import {
  PartListItem,
  PartDetail,
  BOMEntry,
  PartStatus,
  PartType,
  BOMSourceType,
} from './models/parts.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { TextareaComponent } from '../../shared/components/textarea/textarea.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { FormValidationService } from '../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../shared/directives/validation-popover.directive';

@Component({
  selector: 'app-parts',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PageHeaderComponent, DialogComponent,
    InputComponent, SelectComponent, TextareaComponent,
    DataTableComponent, ColumnCellDirective, ValidationPopoverDirective,
  ],
  templateUrl: './parts.component.html',
  styleUrl: './parts.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartsComponent {
  private readonly partsService = inject(PartsService);

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
    { value: 'Obsolete', label: 'Obsolete' },
  ];

  protected readonly typeFilterOptions: SelectOption[] = [
    { value: '', label: 'All Types' },
    { value: 'Part', label: 'Part' },
    { value: 'Assembly', label: 'Assembly' },
  ];

  protected readonly partColumns: ColumnDef[] = [
    { field: 'partNumber', header: 'Part #', sortable: true, width: '120px' },
    { field: 'description', header: 'Description', sortable: true },
    { field: 'revision', header: 'Rev', width: '60px', align: 'center' },
    { field: 'partType', header: 'Type', sortable: true },
    { field: 'status', header: 'Status', sortable: true, filterable: true, type: 'enum', filterOptions: [
      { value: 'Active', label: 'Active' }, { value: 'Draft', label: 'Draft' }, { value: 'Obsolete', label: 'Obsolete' },
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
    partNumber: new FormControl('', [Validators.required]),
    description: new FormControl('', [Validators.required]),
    revision: new FormControl('A'),
    partType: new FormControl('Part', [Validators.required]),
    material: new FormControl(''),
    moldToolRef: new FormControl(''),
  });

  protected readonly partViolations = FormValidationService.getViolations(this.partForm, {
    partNumber: 'Part Number', description: 'Description', partType: 'Type',
  });

  protected readonly partTypeOptions: SelectOption[] = [
    { value: 'Part', label: 'Part' },
    { value: 'Assembly', label: 'Assembly' },
  ];

  // ── BOM Dialog ──
  protected readonly showBomDialog = signal(false);

  protected readonly bomForm = new FormGroup({
    childPartId: new FormControl<number | null>(null, [Validators.required]),
    quantity: new FormControl(1, [Validators.required, Validators.min(0.01)]),
    sourceType: new FormControl('Buy'),
    referenceDesignator: new FormControl(''),
    notes: new FormControl(''),
  });

  protected readonly bomViolations = FormValidationService.getViolations(this.bomForm, {
    childPartId: 'Child Part', quantity: 'Quantity',
  });

  protected readonly sourceTypeOptions: SelectOption[] = [
    { value: 'Make', label: 'Make' },
    { value: 'Buy', label: 'Buy' },
  ];

  // Detail tab
  protected readonly detailTab = signal<'info' | 'bom' | 'usage'>('info');

  protected readonly partStatuses: PartStatus[] = ['Active', 'Draft', 'Obsolete'];

  constructor() {
    this.loadParts();
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
    this.partsService.getPartById(part.id).subscribe({
      next: (detail) => { this.selectedPart.set(detail); this.detailLoading.set(false); },
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
      partNumber: '', description: '', revision: 'A',
      partType: 'Part', material: '', moldToolRef: '',
    });
    this.partForm.controls.partNumber.enable();
    this.showPartDialog.set(true);
  }

  protected openEditPart(): void {
    const part = this.selectedPart();
    if (!part) return;
    this.editingPart.set(part);
    this.partForm.patchValue({
      partNumber: part.partNumber,
      description: part.description,
      revision: part.revision,
      partType: part.partType,
      material: part.material ?? '',
      moldToolRef: part.moldToolRef ?? '',
    });
    this.partForm.controls.partNumber.disable();
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
      }).subscribe({
        next: (detail) => {
          this.selectedPart.set(detail);
          this.closePartDialog();
          this.loadParts();
        },
      });
    } else {
      this.partsService.createPart({
        partNumber: form.partNumber ?? '',
        description: form.description ?? '',
        revision: form.revision || undefined,
        partType: (form.partType as PartType) ?? 'Part',
        material: form.material || undefined,
        moldToolRef: form.moldToolRef || undefined,
      }).subscribe({
        next: (detail) => {
          this.selectedPart.set(detail);
          this.closePartDialog();
          this.loadParts();
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
      sourceType: 'Buy', notes: '',
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
      notes: form.notes || undefined,
    }).subscribe({
      next: (detail) => {
        this.selectedPart.set(detail);
        this.closeBomDialog();
        this.loadParts();
      },
    });
  }

  protected deleteBomEntry(entry: BOMEntry): void {
    const part = this.selectedPart();
    if (!part) return;
    this.partsService.deleteBOMEntry(part.id, entry.id).subscribe({
      next: (detail) => {
        this.selectedPart.set(detail);
        this.loadParts();
      },
    });
  }

  protected getStatusClass(status: string): string {
    switch (status) {
      case 'Active': return 'status-badge--active';
      case 'Draft': return 'status-badge--draft';
      case 'Obsolete': return 'status-badge--obsolete';
      default: return '';
    }
  }

  protected getTypeIcon(type: string): string {
    return type === 'Assembly' ? 'account_tree' : 'settings';
  }
}
