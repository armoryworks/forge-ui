import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { AssetsService } from './services/assets.service';
import { AssetItem } from './models/asset-item.model';
import { AssetType } from './models/asset-type.type';
import { AssetStatus } from './models/asset-status.type';
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
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { ToggleComponent } from '../../shared/components/toggle/toggle.component';
import { SnackbarService } from '../../shared/services/snackbar.service';

@Component({
  selector: 'app-assets',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeaderComponent, DialogComponent, InputComponent, SelectComponent, TextareaComponent, ToggleComponent, DataTableComponent, ColumnCellDirective, ValidationPopoverDirective],
  templateUrl: './assets.component.html',
  styleUrl: './assets.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetsComponent {
  private readonly assetsService = inject(AssetsService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly assets = signal<AssetItem[]>([]);
  protected readonly selectedAsset = signal<AssetItem | null>(null);

  // Filters
  protected readonly searchControl = new FormControl('');
  protected readonly typeFilterControl = new FormControl<AssetType | null>(null);
  protected readonly statusFilterControl = new FormControl<AssetStatus | null>(null);

  private readonly searchTerm = toSignal(this.searchControl.valueChanges.pipe(startWith('')), { initialValue: '' });
  private readonly typeFilter = toSignal(this.typeFilterControl.valueChanges.pipe(startWith(null as AssetType | null)), { initialValue: null as AssetType | null });
  private readonly statusFilter = toSignal(this.statusFilterControl.valueChanges.pipe(startWith(null as AssetStatus | null)), { initialValue: null as AssetStatus | null });

  // Dialog
  protected readonly showDialog = signal(false);
  protected readonly editingAsset = signal<AssetItem | null>(null);

  protected readonly assetForm = new FormGroup({
    name: new FormControl('', [Validators.required]),
    assetType: new FormControl<AssetType>('Machine', [Validators.required]),
    location: new FormControl(''),
    manufacturer: new FormControl(''),
    model: new FormControl(''),
    serialNumber: new FormControl(''),
    notes: new FormControl(''),
    isCustomerOwned: new FormControl(false),
    cavityCount: new FormControl<number | null>(null),
    toolLifeExpectancy: new FormControl<number | null>(null),
  });

  protected readonly assetViolations = FormValidationService.getViolations(this.assetForm, {
    name: 'Name',
    assetType: 'Type',
  });

  protected readonly assetColumns: ColumnDef[] = [
    { field: 'icon', header: '', width: '32px' },
    { field: 'name', header: 'Name', sortable: true },
    { field: 'assetType', header: 'Type', sortable: true, filterable: true, type: 'enum', filterOptions: [
      { value: 'Machine', label: 'Machine' }, { value: 'Tooling', label: 'Tooling' },
      { value: 'Facility', label: 'Facility' }, { value: 'Vehicle', label: 'Vehicle' }, { value: 'Other', label: 'Other' },
    ]},
    { field: 'location', header: 'Location', sortable: true },
    { field: 'manufacturer', header: 'Manufacturer', sortable: true },
    { field: 'status', header: 'Status', sortable: true },
    { field: 'currentHours', header: 'Hours', align: 'right', sortable: true },
  ];

  protected readonly assetTypes: AssetType[] = ['Machine', 'Tooling', 'Facility', 'Vehicle', 'Other'];
  protected readonly assetStatuses: AssetStatus[] = ['Active', 'Maintenance', 'Retired', 'OutOfService'];

  protected readonly typeFilterOptions: SelectOption[] = [
    { value: null, label: 'All Types' },
    ...['Machine', 'Tooling', 'Facility', 'Vehicle', 'Other'].map(t => ({ value: t, label: t })),
  ];

  protected readonly statusFilterOptions: SelectOption[] = [
    { value: null, label: 'All Statuses' },
    { value: 'Active', label: 'Active' },
    { value: 'Maintenance', label: 'Maintenance' },
    { value: 'Retired', label: 'Retired' },
    { value: 'OutOfService', label: 'Out of Service' },
  ];

  protected readonly assetTypeOptions: SelectOption[] = this.assetTypes.map(t => ({ value: t, label: t }));

  constructor() {
    this.loadAssets();
  }

  protected loadAssets(): void {
    this.loading.set(true);
    const type = this.typeFilter() ?? undefined;
    const status = this.statusFilter() ?? undefined;
    const search = (this.searchTerm() ?? '').trim() || undefined;
    this.assetsService.getAssets(type, status, search).subscribe({
      next: (assets) => { this.assets.set(assets); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected applyFilters(): void { this.loadAssets(); }
  protected clearSearch(): void { this.searchControl.setValue(''); this.loadAssets(); }

  protected readonly assetRowClass = (row: unknown) => {
    const asset = row as AssetItem;
    return asset.id === this.selectedAsset()?.id ? 'row--selected' : '';
  };

  protected selectAsset(asset: AssetItem): void { this.selectedAsset.set(asset); }
  protected closeDetail(): void { this.selectedAsset.set(null); }

  protected openCreateAsset(): void {
    this.editingAsset.set(null);
    this.assetForm.reset({
      name: '', assetType: 'Machine', location: '',
      manufacturer: '', model: '', serialNumber: '', notes: '',
      isCustomerOwned: false, cavityCount: null, toolLifeExpectancy: null,
    });
    this.showDialog.set(true);
  }

  protected openEditAsset(): void {
    const asset = this.selectedAsset();
    if (!asset) return;
    this.editingAsset.set(asset);
    this.assetForm.patchValue({
      name: asset.name,
      assetType: asset.assetType,
      location: asset.location ?? '',
      manufacturer: asset.manufacturer ?? '',
      model: asset.model ?? '',
      serialNumber: asset.serialNumber ?? '',
      notes: asset.notes ?? '',
      isCustomerOwned: asset.isCustomerOwned ?? false,
      cavityCount: asset.cavityCount,
      toolLifeExpectancy: asset.toolLifeExpectancy,
    });
    this.showDialog.set(true);
  }

  protected closeDialog(): void { this.showDialog.set(false); }

  protected saveAsset(): void {
    if (this.assetForm.invalid) return;

    this.saving.set(true);
    const form = this.assetForm.getRawValue();
    const editing = this.editingAsset();

    if (editing) {
      this.assetsService.updateAsset(editing.id, {
        name: form.name!,
        assetType: form.assetType!,
        location: form.location || undefined,
        manufacturer: form.manufacturer || undefined,
        model: form.model || undefined,
        serialNumber: form.serialNumber || undefined,
        notes: form.notes || undefined,
        isCustomerOwned: form.isCustomerOwned ?? false,
        cavityCount: form.cavityCount ?? undefined,
        toolLifeExpectancy: form.toolLifeExpectancy ?? undefined,
      }).subscribe({
        next: (asset) => { this.saving.set(false); this.selectedAsset.set(asset); this.closeDialog(); this.loadAssets(); this.snackbar.success('Asset updated.'); },
        error: () => this.saving.set(false),
      });
    } else {
      this.assetsService.createAsset({
        name: form.name!,
        assetType: form.assetType!,
        location: form.location || undefined,
        manufacturer: form.manufacturer || undefined,
        model: form.model || undefined,
        serialNumber: form.serialNumber || undefined,
        notes: form.notes || undefined,
        isCustomerOwned: form.isCustomerOwned ?? false,
        cavityCount: form.cavityCount ?? undefined,
        toolLifeExpectancy: form.toolLifeExpectancy ?? undefined,
      }).subscribe({
        next: (asset) => { this.saving.set(false); this.selectedAsset.set(asset); this.closeDialog(); this.loadAssets(); this.snackbar.success('Asset created.'); },
        error: () => this.saving.set(false),
      });
    }
  }

  protected updateStatus(status: AssetStatus): void {
    const asset = this.selectedAsset();
    if (!asset) return;
    this.assetsService.updateAsset(asset.id, { status }).subscribe({
      next: (updated) => { this.selectedAsset.set(updated); this.loadAssets(); },
    });
  }

  protected getTypeIcon(type: string): string {
    switch (type) {
      case 'Machine': return 'precision_manufacturing';
      case 'Tooling': return 'build';
      case 'Facility': return 'apartment';
      case 'Vehicle': return 'local_shipping';
      default: return 'category';
    }
  }

  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Active: 'chip--success', Maintenance: 'chip--warning',
      Retired: 'chip--muted', OutOfService: 'chip--error',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getStatusLabel(status: string): string {
    return status === 'OutOfService' ? 'Out of Service' : status;
  }

  protected deleteAsset(): void {
    const asset = this.selectedAsset();
    if (!asset) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Asset?',
        message: `This will permanently delete "${asset.name}".`,
        confirmLabel: 'Delete',
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.assetsService.deleteAsset(asset.id).subscribe({
        next: () => {
          this.selectedAsset.set(null);
          this.loadAssets();
          this.snackbar.success('Asset deleted.');
        },
      });
    });
  }
}
