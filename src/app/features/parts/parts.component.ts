import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, map, startWith } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { HttpErrorResponse } from '@angular/common/http';

import { PartsService } from './services/parts.service';
import { PartListItem } from './models/part-list-item.model';
import { PartDetail } from './models/part-detail.model';
import { PartStatus } from './models/part-status.type';
import { PartType } from './models/part-type.type';
import { ScannerService } from '../../shared/services/scanner.service';
import { UserPreferencesService } from '../../shared/services/user-preferences.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { EntityPickerComponent } from '../../shared/components/entity-picker/entity-picker.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { FormValidationService } from '../../shared/services/form-validation.service';
import { ValidationButtonComponent } from '../../shared/components/validation-button/validation-button.component';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { PartsCardGridComponent } from './components/parts-card-grid/parts-card-grid.component';
import { DetailDialogService } from '../../shared/services/detail-dialog.service';
import { PartDetailDialogComponent, PartDetailDialogData } from './components/part-detail-dialog/part-detail-dialog.component';
import { WorkflowService } from '../../shared/services/workflow.service';
import { NewPartChoice, NewPartForkDialogComponent } from './workflow/new-part-fork-dialog/new-part-fork-dialog.component';

type ViewMode = 'table' | 'cards';

@Component({
  selector: 'app-parts',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    PageHeaderComponent, DialogComponent,
    InputComponent, SelectComponent,
    DataTableComponent, EntityPickerComponent, ColumnCellDirective, ValidationButtonComponent,
    LoadingBlockDirective, MatTooltipModule,
    PartsCardGridComponent,
  ],
  templateUrl: './parts.component.html',
  styleUrl: './parts.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartsComponent {
  protected readonly partsService = inject(PartsService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly scanner = inject(ScannerService);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly userPreferences = inject(UserPreferencesService);
  private readonly detailDialog = inject(DetailDialogService);
  private readonly workflowService = inject(WorkflowService);

  protected readonly loading = signal(false);
  protected readonly parts = signal<PartListItem[]>([]);
  // Phase 3 F7-partial / WU-17 — surfaces server-side totalCount.
  protected readonly totalCount = signal<number>(0);

  // ── View Mode (table / cards) — URL param + persisted preference ──
  protected readonly viewMode = toSignal(
    this.route.queryParamMap.pipe(
      map(p => (p.get('view') as ViewMode) ?? (this.userPreferences.get<ViewMode>('parts:viewMode') ?? 'table')),
    ),
    { initialValue: (this.userPreferences.get<ViewMode>('parts:viewMode') ?? 'table') as ViewMode },
  );

  // ── Page Filters ──
  protected readonly searchControl = new FormControl('');
  // Phase 5: status filter defaults to Active so Drafts (in-flight workflows) don't pollute the live list.
  // The user opts into Drafts/All explicitly when they want to resume / audit.
  protected readonly statusFilterControl = new FormControl<PartStatus | ''>('Active');
  protected readonly typeFilterControl = new FormControl<PartType | ''>('');

  private readonly searchTerm = toSignal(this.searchControl.valueChanges.pipe(startWith('')), { initialValue: '' });
  private readonly statusFilter = toSignal(this.statusFilterControl.valueChanges.pipe(startWith('Active' as PartStatus | '')), { initialValue: 'Active' as PartStatus | '' });
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
    minStockThreshold: new FormControl<number | null>(null, [Validators.min(0)]),
    reorderPoint: new FormControl<number | null>(null, [Validators.min(0)]),
    reorderQuantity: new FormControl<number | null>(null, [Validators.min(0.01)]),
    leadTimeDays: new FormControl<number | null>(null, [Validators.min(0)]),
    safetyStockDays: new FormControl<number | null>(null, [Validators.min(0)]),
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

    // Phase 3 F7-partial / WU-17 — debounced search + filter changes fire the
    // standardised `?q=`, `?status=`, `?type=` query params against the
    // server (300ms debounce per the WU-17 charter).
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.loadParts());

    this.statusFilterControl.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.loadParts());

    this.typeFilterControl.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.loadParts());
  }

  // ── List ──

  protected loadParts(): void {
    this.loading.set(true);
    const status = (this.statusFilter() ?? '') || undefined;
    const type = (this.typeFilter() ?? '') || undefined;
    const search = (this.searchTerm() ?? '').trim() || undefined;
    // Phase 3 F7-partial / WU-17 — paged endpoint with the standardised
    // contract; pageSize=200 matches the server cap. The data-table slices
    // client-side for now; switch to true server-paging if a tenant grows
    // beyond the 200-row window.
    this.partsService.getPartsPaged({
      status,
      type,
      q: search,
      pageSize: 200,
      sort: 'partNumber',
      order: 'asc',
    }).subscribe({
      next: (paged) => {
        this.parts.set(paged.items);
        this.totalCount.set(paged.totalCount);
        this.loading.set(false);
        this.autoOpenFromUrl();
      },
      error: () => this.loading.set(false),
    });
  }

  /** Auto-open detail dialog when URL contains ?detail=part:{id} */
  private autoOpenHandled = false;
  private autoOpenFromUrl(): void {
    if (this.autoOpenHandled) return;
    this.autoOpenHandled = true;
    const detail = this.detailDialog.getDetailFromUrl();
    if (detail?.entityType === 'part') {
      this.openPartDetail(detail.entityId);
    }
  }

  protected applyFilters(): void {
    this.loadParts();
  }

  protected clearSearch(): void {
    this.searchControl.setValue('');
    this.loadParts();
  }

  // ── Detail Dialog ──

  protected openPartDetail(partId: number): void {
    // Phase 5: if this is a Draft part, see if a workflow run exists and offer
    // to resume; otherwise fall back to the regular detail dialog.
    const part = this.parts().find(p => p.id === partId);
    if (part?.status === 'Draft') {
      this.tryResumeOrOpenDetail(partId);
      return;
    }
    this.openDetailDialog(partId);
  }

  private tryResumeOrOpenDetail(partId: number): void {
    this.workflowService.listActive().subscribe({
      next: (runs) => {
        const run = runs.find(r => r.entityType === 'Part' && r.entityId === partId
          && r.completedAt == null && r.abandonedAt == null);
        if (run) {
          this.router.navigate(['/parts', partId], {
            queryParams: { workflow: run.definitionId, step: run.currentStepId ?? 'basics', mode: run.mode },
          });
        } else {
          this.openDetailDialog(partId);
        }
      },
      error: () => this.openDetailDialog(partId),
    });
  }

  private openDetailDialog(partId: number): void {
    this.detailDialog.open<PartDetailDialogComponent, PartDetailDialogData, { action: string; part: PartDetail } | undefined>(
      'part', partId, PartDetailDialogComponent, { partId }
    ).afterClosed().subscribe(result => {
      if (result?.action === 'edit') {
        this.editPart(result.part);
      }
      this.loadParts(); // refresh list
    });
  }

  /** Phase 5: visual marker on Draft rows so they're easy to spot. */
  protected readonly partRowClass = (row: unknown): string => {
    const part = row as PartListItem;
    return part.status === 'Draft' ? 'part-row--draft' : '';
  };

  // ── Part CRUD ──

  /**
   * Phase 5: Opens the New-Part fork dialog so the user picks express
   * (single form) vs guided (workflow shell). Express → original create
   * dialog (existing behavior). Guided → starts a `part-assembly-guided-v1`
   * run and navigates to the workflow shell.
   */
  protected openCreatePart(): void {
    this.dialog.open(NewPartForkDialogComponent, { width: '540px' })
      .afterClosed().subscribe((choice: NewPartChoice | undefined) => {
        if (!choice) return;
        if (choice === 'express') {
          this.openExpressDialog();
        } else {
          this.startGuidedWorkflow();
        }
      });
  }

  private openExpressDialog(): void {
    this.editingPart.set(null);
    this.partForm.reset({
      description: '', revision: 'A',
      partType: 'Part', material: '', moldToolRef: '', externalPartNumber: '',
      toolingAssetId: null,
      minStockThreshold: null, reorderPoint: null, reorderQuantity: null,
      leadTimeDays: null, safetyStockDays: null,
    });
    this.showPartDialog.set(true);
  }

  private startGuidedWorkflow(): void {
    this.workflowService.startRun({
      entityType: 'Part',
      definitionId: 'part-assembly-guided-v1',
      mode: 'guided',
    }).subscribe({
      next: (run) => {
        this.router.navigate(['/parts', run.entityId], {
          queryParams: { workflow: 'part-assembly-guided-v1', step: 'basics', mode: 'guided' },
        });
      },
      error: () => this.snackbar.error(this.translate.instant('parts.workflow.startFailed')),
    });
  }

  protected editPart(part: PartDetail): void {
    this.editingPart.set(part);
    this.partForm.patchValue({
      description: part.description,
      revision: part.revision,
      partType: part.partType,
      material: part.material ?? '',
      moldToolRef: part.moldToolRef ?? '',
      externalPartNumber: part.externalPartNumber ?? '',
      toolingAssetId: part.toolingAssetId,
      minStockThreshold: part.minStockThreshold,
      reorderPoint: part.reorderPoint,
      reorderQuantity: part.reorderQuantity,
      leadTimeDays: part.leadTimeDays,
      safetyStockDays: part.safetyStockDays,
    });
    this.showPartDialog.set(true);
  }

  protected closePartDialog(): void {
    this.showPartDialog.set(false);
  }

  protected savePart(): void {
    if (this.partForm.invalid) return;

    // Drop any prior server messages so a re-submit doesn't accumulate.
    // (Phase 3 / WU-02 envelope pattern, mirroring customer-create.)
    FormValidationService.clearServerErrors(this.partForm);

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
        minStockThreshold: form.minStockThreshold ?? undefined,
        reorderPoint: form.reorderPoint ?? undefined,
        reorderQuantity: form.reorderQuantity ?? undefined,
        leadTimeDays: form.leadTimeDays ?? undefined,
        safetyStockDays: form.safetyStockDays ?? undefined,
      }).subscribe({
        next: () => {
          this.closePartDialog();
          this.loadParts();
          this.snackbar.success(this.translate.instant('parts.partUpdated'));
        },
        error: (err: HttpErrorResponse) => {
          // Phase 3 / WU-02 / F6: surface per-field server errors against the
          // form so the validation popover lights up on the offending field
          // (e.g. partType). Legacy non-envelope errors fall through to the
          // central interceptor's snackbar. Keep the dialog open so the user
          // can correct the field rather than losing their input.
          FormValidationService.applyServerError(this.partForm, err);
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
        minStockThreshold: form.minStockThreshold ?? undefined,
        reorderPoint: form.reorderPoint ?? undefined,
        reorderQuantity: form.reorderQuantity ?? undefined,
        leadTimeDays: form.leadTimeDays ?? undefined,
        safetyStockDays: form.safetyStockDays ?? undefined,
      }).subscribe({
        next: (detail) => {
          this.closePartDialog();
          this.loadParts();
          this.snackbar.success(this.translate.instant('parts.partCreated'));
          // Open the newly created part's detail dialog
          this.openPartDetail(detail.id);
        },
        error: (err: HttpErrorResponse) => {
          // Phase 3 / WU-02 / F6: see updatePart error handler for details.
          FormValidationService.applyServerError(this.partForm, err);
        },
      });
    }
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

  protected setViewMode(mode: ViewMode): void {
    this.router.navigate([], {
      queryParams: { view: mode === 'table' ? null : mode },
      queryParamsHandling: 'merge',
    });
    this.userPreferences.set('parts:viewMode', mode);
  }
}
