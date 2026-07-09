import { ChangeDetectionStrategy, Component, inject, OnInit, signal, ViewChild } from '@angular/core';
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
import { AutocompleteComponent, AutocompleteOption } from '../../shared/components/autocomplete/autocomplete.component';
import { TextareaComponent } from '../../shared/components/textarea/textarea.component';
import { SchedulingService } from '../scheduling/services/scheduling.service';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { FormValidationService } from '../../shared/services/form-validation.service';
import { ValidationButtonComponent } from '../../shared/components/validation-button/validation-button.component';
import { DraftConfig } from '../../shared/models/draft-config.model';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ToggleComponent } from '../../shared/components/toggle/toggle.component';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { AssetDetailDialogComponent, AssetDetailDialogData, AssetDetailDialogResult } from './components/asset-detail-dialog/asset-detail-dialog.component';
import { DetailDialogService } from '../../shared/services/detail-dialog.service';
import { DraftResumeService } from '../../shared/services/draft-resume.service';

@Component({
  selector: 'app-assets',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, PageHeaderComponent, DialogComponent, InputComponent, SelectComponent, AutocompleteComponent, TextareaComponent, ToggleComponent, DataTableComponent, ColumnCellDirective, ValidationButtonComponent],
  templateUrl: './assets.component.html',
  styleUrl: './assets.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetsComponent implements OnInit {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;

  private readonly assetsService = inject(AssetsService);
  private readonly schedulingService = inject(SchedulingService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly detailDialog = inject(DetailDialogService);
  private readonly draftResume = inject(DraftResumeService);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly assets = signal<AssetItem[]>([]);
  // A32 — work centers for the searchable "assign to work center" picker on the asset form.
  // Loaded once; empty if the caller lacks CAP-MD-WORKCENTERS (picker degrades to no options).
  protected readonly workCenterOptions = signal<AutocompleteOption[]>([]);
  protected draftConfig: DraftConfig = { entityType: 'asset', entityId: 'new', route: '/assets' };

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
    status: new FormControl<AssetStatus>('Active', [Validators.required]),
    location: new FormControl(''),
    manufacturer: new FormControl(''),
    model: new FormControl(''),
    serialNumber: new FormControl(''),
    notes: new FormControl(''),
    isCustomerOwned: new FormControl(false),
    cavityCount: new FormControl<number | null>(null),
    toolLifeExpectancy: new FormControl<number | null>(null),
    // Phase 3 F4 — full-record fields. All optional on create.
    acquisitionCost: new FormControl<number | null>(null, [Validators.min(0), Validators.max(1_000_000_000)]),
    depreciationMethod: new FormControl<'StraightLine' | 'DecliningBalance' | 'UnitsOfProduction' | null>(null),
    workCenterId: new FormControl<number | null>(null),
    glAccount: new FormControl<string | null>(null),
  });

  // Depreciation-method options match the server enum exactly.
  protected readonly depreciationMethodOptions: SelectOption[] = [
    { value: null, label: '—' },
    { value: 'StraightLine', label: 'Straight Line' },
    { value: 'DecliningBalance', label: 'Declining Balance' },
    { value: 'UnitsOfProduction', label: 'Units of Production' },
  ];

  protected readonly assetViolations = FormValidationService.getViolations(this.assetForm, {
    name: 'Name',
    assetType: 'Type',
  });

  protected readonly assetColumns: ColumnDef[] = [
    { field: 'icon', header: '', width: '32px' },
    { field: 'name', header: this.translate.instant('assets.colName'), sortable: true },
    { field: 'assetType', header: this.translate.instant('assets.colType'), sortable: true, filterable: true, type: 'enum', filterOptions: [
      { value: 'Machine', label: this.translate.instant('assets.typeMachine') }, { value: 'Tooling', label: this.translate.instant('assets.typeTooling') },
      { value: 'Facility', label: this.translate.instant('assets.typeFacility') }, { value: 'Vehicle', label: this.translate.instant('assets.typeVehicle') }, { value: 'Other', label: this.translate.instant('assets.typeOther') },
    ]},
    { field: 'location', header: this.translate.instant('assets.colLocation'), sortable: true },
    { field: 'manufacturer', header: this.translate.instant('assets.colManufacturer'), sortable: true },
    { field: 'status', header: this.translate.instant('assets.colStatus'), sortable: true },
    { field: 'currentHours', header: this.translate.instant('assets.colHours'), align: 'right', sortable: true },
  ];

  protected readonly assetTypes: AssetType[] = ['Machine', 'Tooling', 'Facility', 'Vehicle', 'Other'];
  protected readonly assetStatuses: AssetStatus[] = ['Active', 'Maintenance', 'Retired', 'OutOfService'];

  protected readonly typeFilterOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('assets.allTypes') },
    { value: 'Machine', label: this.translate.instant('assets.typeMachine') },
    { value: 'Tooling', label: this.translate.instant('assets.typeTooling') },
    { value: 'Facility', label: this.translate.instant('assets.typeFacility') },
    { value: 'Vehicle', label: this.translate.instant('assets.typeVehicle') },
    { value: 'Other', label: this.translate.instant('assets.typeOther') },
  ];

  protected readonly statusFilterOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('assets.allStatuses') },
    { value: 'Active', label: this.translate.instant('assets.statusActive') },
    { value: 'Maintenance', label: this.translate.instant('assets.statusMaintenance') },
    { value: 'Retired', label: this.translate.instant('assets.statusRetired') },
    { value: 'OutOfService', label: this.translate.instant('assets.statusOutOfService') },
  ];

  protected readonly assetTypeOptions: SelectOption[] = [
    { value: 'Machine', label: this.translate.instant('assets.typeMachine') },
    { value: 'Tooling', label: this.translate.instant('assets.typeTooling') },
    { value: 'Facility', label: this.translate.instant('assets.typeFacility') },
    { value: 'Vehicle', label: this.translate.instant('assets.typeVehicle') },
    { value: 'Other', label: this.translate.instant('assets.typeOther') },
  ];

  // Status options for the edit form. Reuses the same i18n labels as the
  // status filter (minus the "all" null entry) so the edit dialog and the
  // detail-panel quick actions stay in lockstep.
  protected readonly assetStatusOptions: SelectOption[] = [
    { value: 'Active', label: this.translate.instant('assets.statusActive') },
    { value: 'Maintenance', label: this.translate.instant('assets.statusMaintenance') },
    { value: 'Retired', label: this.translate.instant('assets.statusRetired') },
    { value: 'OutOfService', label: this.translate.instant('assets.statusOutOfService') },
  ];

  constructor() {
    this.loadAssets();
    // A32 — populate the work-center picker; silently empty if not permitted.
    this.schedulingService.getWorkCenters().subscribe({
      next: (wcs) => this.workCenterOptions.set(
        wcs.filter(w => w.isActive).map(w => ({ value: w.id, label: `${w.code} — ${w.name}` }))),
      error: () => this.workCenterOptions.set([]),
    });
  }

  ngOnInit(): void {
    if (this.draftResume.consume('asset')) {
      this.openCreateAsset();
    }
  }

  protected loadAssets(): void {
    this.loading.set(true);
    const type = this.typeFilter() ?? undefined;
    const status = this.statusFilter() ?? undefined;
    const search = (this.searchTerm() ?? '').trim() || undefined;
    this.assetsService.getAssets(type, status, search).subscribe({
      next: (assets) => {
        this.assets.set(assets);
        this.loading.set(false);
        this.autoOpenFromUrl();
      },
      error: () => this.loading.set(false),
    });
  }

  /** Auto-open detail dialog when URL contains ?detail=asset:{id} */
  private autoOpenHandled = false;
  private autoOpenFromUrl(): void {
    if (this.autoOpenHandled) return;
    this.autoOpenHandled = true;
    const detail = this.detailDialog.getDetailFromUrl();
    if (detail?.entityType === 'asset') {
      this.openAssetDetail({ id: detail.entityId } as AssetItem);
    }
  }

  protected applyFilters(): void { this.loadAssets(); }
  protected clearSearch(): void { this.searchControl.setValue(''); this.loadAssets(); }

  protected openAssetDetail(asset: AssetItem): void {
    const ref = this.detailDialog.open<AssetDetailDialogComponent, AssetDetailDialogData, AssetDetailDialogResult | undefined>(
      'asset', asset.id, AssetDetailDialogComponent, { assetId: asset.id },
    );
    ref.afterClosed().subscribe(result => {
      if (result?.action === 'edit') {
        this.openEditAssetFromDetail(result.asset);
      }
      this.loadAssets();
    });
  }

  protected openCreateAsset(): void {
    this.editingAsset.set(null);
    this.draftConfig = { entityType: 'asset', entityId: 'new', route: '/assets' };
    this.assetForm.reset({
      name: '', assetType: 'Machine', status: 'Active', location: '',
      manufacturer: '', model: '', serialNumber: '', notes: '',
      isCustomerOwned: false, cavityCount: null, toolLifeExpectancy: null,
      // Phase 3 F4 — reset full-record fields too.
      acquisitionCost: null, depreciationMethod: null,
      workCenterId: null, glAccount: null,
    });
    this.showDialog.set(true);
  }

  private openEditAssetFromDetail(asset: AssetItem): void {
    this.editingAsset.set(asset);
    this.draftConfig = { entityType: 'asset', entityId: asset.id.toString(), route: '/assets' };
    this.assetForm.patchValue({
      name: asset.name,
      assetType: asset.assetType,
      status: asset.status,
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

  protected closeDialog(): void {
    this.showDialog.set(false);
  }

  protected saveAsset(): void {
    if (this.assetForm.invalid) return;

    this.saving.set(true);
    const form = this.assetForm.getRawValue();
    const editing = this.editingAsset();

    if (editing) {
      this.assetsService.updateAsset(editing.id, {
        name: form.name!,
        assetType: form.assetType!,
        status: form.status!,
        location: form.location || undefined,
        manufacturer: form.manufacturer || undefined,
        model: form.model || undefined,
        serialNumber: form.serialNumber || undefined,
        notes: form.notes || undefined,
        isCustomerOwned: form.isCustomerOwned ?? false,
        cavityCount: form.cavityCount ?? undefined,
        toolLifeExpectancy: form.toolLifeExpectancy ?? undefined,
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.dialogRef.clearDraft();
          this.closeDialog();
          this.loadAssets();
          this.snackbar.success(this.translate.instant('assets.assetUpdated'));
        },
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
        // Phase 3 F4 — pass full-record fields straight through. PATCH-edit
        // path on the existing UpdateAsset endpoint is unchanged.
        acquisitionCost: form.acquisitionCost ?? undefined,
        depreciationMethod: form.depreciationMethod ?? undefined,
        workCenterId: form.workCenterId ?? undefined,
        glAccount: form.glAccount || undefined,
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.dialogRef.clearDraft();
          this.closeDialog();
          this.loadAssets();
          this.snackbar.success(this.translate.instant('assets.assetCreated'));
        },
        error: () => this.saving.set(false),
      });
    }
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
    // deleteAsset kept for potential future toolbar action
  }
}
