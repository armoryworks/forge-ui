import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { debounceTime, distinctUntilChanged, forkJoin, map, of, startWith, switchMap } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { VendorService } from './services/vendor.service';
import { VendorListItem } from './models/vendor-list-item.model';
import { VendorDialogComponent } from './components/vendor-dialog/vendor-dialog.component';
import { VendorDetailDialogComponent, VendorDetailDialogData } from './components/vendor-detail-dialog/vendor-detail-dialog.component';
import { NewVendorForkDialogComponent, VendorCreatePath } from './components/new-vendor-fork-dialog/new-vendor-fork-dialog.component';
import { GuidedVendorDialogComponent, GuidedVendorResult } from './components/guided-vendor-dialog/guided-vendor-dialog.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { DetailDialogService } from '../../shared/services/detail-dialog.service';
import { LoadingService } from '../../shared/services/loading.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { VendorPartsService } from '../parts/services/vendor-parts.service';
import { EntityCompletenessChipComponent } from '../../shared/components/entity-completeness-chip/entity-completeness-chip.component';
import { EntityCompletenessBadgeComponent } from '../../shared/components/entity-completeness-badge/entity-completeness-badge.component';

@Component({
  selector: 'app-vendors',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe,
    PageHeaderComponent, InputComponent, SelectComponent,
    DataTableComponent, ColumnCellDirective,
    VendorDialogComponent, LoadingBlockDirective,
    EntityCompletenessChipComponent, EntityCompletenessBadgeComponent,
    TranslatePipe,
  ],
  templateUrl: './vendors.component.html',
  styleUrl: './vendors.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorsComponent {
  private readonly vendorService = inject(VendorService);
  private readonly translate = inject(TranslateService);
  private readonly detailDialog = inject(DetailDialogService);
  private readonly matDialog = inject(MatDialog);
  private readonly loadingService = inject(LoadingService);
  private readonly snackbar = inject(SnackbarService);
  private readonly vendorPartsService = inject(VendorPartsService);

  protected readonly loading = signal(false);
  protected readonly vendors = signal<VendorListItem[]>([]);
  // Phase 3 F7-broad / WU-22 — surfaces the server-side totalCount so the
  // header can show "X of Y". Today the data-table still slices client-side
  // within a 200-record window; switch to true server-paging if a tenant
  // exceeds 200 vendors.
  protected readonly totalCount = signal<number>(0);

  // Create dialog
  protected readonly showDialog = signal(false);

  // Filters
  protected readonly searchControl = new FormControl('');
  protected readonly activeFilterControl = new FormControl<boolean | null>(null);

  private readonly searchTerm = toSignal(this.searchControl.valueChanges.pipe(startWith('')), { initialValue: '' });

  protected readonly activeOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('vendors.allFilter') },
    { value: true, label: this.translate.instant('vendors.activeFilter') },
    { value: false, label: this.translate.instant('vendors.inactiveFilter') },
  ];

  protected readonly vendorColumns: ColumnDef[] = [
    { field: 'companyName', header: this.translate.instant('vendors.companyName'), sortable: true },
    { field: 'contactName', header: this.translate.instant('vendors.contact'), sortable: true },
    { field: 'email', header: this.translate.instant('common.email'), sortable: true },
    { field: 'phone', header: this.translate.instant('common.phone'), sortable: true },
    { field: 'isActive', header: this.translate.instant('common.active'), sortable: true, type: 'enum', filterable: true, filterOptions: [
      { value: true, label: this.translate.instant('common.active') }, { value: false, label: this.translate.instant('common.inactive') },
    ], width: '80px' },
    { field: 'poCount', header: this.translate.instant('vendors.pos'), sortable: true, width: '70px', align: 'center' },
    { field: 'createdAt', header: this.translate.instant('common.createdAt'), sortable: true, type: 'date', width: '110px' },
    // Hidden by default — power users opt in via column-manager. Renders the
    // full completeness chip (click → popover with per-capability gaps).
    { field: 'completeness', header: this.translate.instant('entityCompleteness.columnHeader'), width: '160px', align: 'center', visible: false },
  ];

  constructor() {
    this.loadVendors();

    // Phase 3 F7-broad / WU-22 — debounced search. Typed input fires the
    // standardised `?q=` query param against the server (300ms debounce).
    // Active-filter changes also re-fetch so the server pagination + filter
    // contract is exercised live.
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.loadVendors());

    this.activeFilterControl.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.loadVendors());
  }

  protected loadVendors(): void {
    this.loading.set(true);
    const search = (this.searchTerm() ?? '').trim() || undefined;
    const isActive = this.activeFilterControl.value ?? undefined;
    // Phase 3 F7-broad / WU-22 — call the paged endpoint directly so we can
    // read totalCount for the header counter. PageSize=200 matches the server
    // cap; the data-table handles client-side slicing within that window.
    this.vendorService.getVendorsPaged({
      q: search,
      isActive,
      pageSize: 200,
      sort: 'companyName',
      order: 'asc',
    }).subscribe({
      next: (paged) => {
        this.vendors.set(paged.items);
        this.totalCount.set(paged.totalCount);
        this.loading.set(false);
        this.autoOpenFromUrl();
      },
      error: () => this.loading.set(false),
    });
  }

  private autoOpenFromUrl(): void {
    const detail = this.detailDialog.getDetailFromUrl();
    if (detail?.entityType === 'vendor') {
      this.detailDialog.open<VendorDetailDialogComponent, VendorDetailDialogData, boolean>(
        'vendor', detail.entityId, VendorDetailDialogComponent,
        { vendorId: detail.entityId },
      ).afterClosed().subscribe(changed => {
        if (changed) {
          this.loadVendors();
        }
      });
    }
  }

  protected applyFilters(): void { this.loadVendors(); }

  protected openVendorDetail(item: VendorListItem): void {
    this.detailDialog.open<VendorDetailDialogComponent, VendorDetailDialogData, boolean>(
      'vendor', item.id, VendorDetailDialogComponent,
      { vendorId: item.id },
    ).afterClosed().subscribe(changed => {
      if (changed) {
        this.loadVendors();
      }
    });
  }

  /**
   * Entry point opens the fork dialog first; the chosen path routes to the
   * matching downstream flow:
   *   quick  → existing inline vendor dialog (flat form)
   *   guided → multi-step guided wizard (classification, address, terms,
   *            supplied parts)
   */
  protected openCreateVendor(): void {
    this.matDialog.open<NewVendorForkDialogComponent, void, VendorCreatePath | undefined>(
      NewVendorForkDialogComponent, { width: '560px' },
    ).afterClosed().subscribe(path => {
      if (!path) return;
      switch (path) {
        case 'quick': this.openQuickCreateVendor(); break;
        case 'guided': this.openGuidedCreateVendor(); break;
      }
    });
  }

  /** Quick add — the original flat inline dialog. */
  private openQuickCreateVendor(): void {
    this.showDialog.set(true);
  }

  /**
   * Guided wizard — strategic / AVL vendors. The wizard collects the vendor
   * fields plus an in-memory list of supplied parts; on confirm we create
   * the vendor, then chain a VendorPart create per supply item (the parts
   * need the new vendor id), then surface the vendor detail.
   */
  private openGuidedCreateVendor(): void {
    this.matDialog.open<GuidedVendorDialogComponent, void, GuidedVendorResult | undefined>(
      GuidedVendorDialogComponent, { width: '680px' },
    ).afterClosed().subscribe(result => {
      if (!result) return;
      const { request, supplyItems } = result;
      const create$ = this.vendorService.createVendor(request).pipe(
        switchMap(created => {
          if (supplyItems.length === 0) return of(created);
          return forkJoin(
            supplyItems.map(si => this.vendorPartsService.create({
              vendorId: created.id,
              partId: si.partId,
              vendorPartNumber: si.vendorPartNumber,
              leadTimeDays: si.leadTimeDays,
              minOrderQty: si.minOrderQty,
              isPreferred: si.isPreferred,
            })),
          ).pipe(map(() => created));
        }),
      );

      this.loadingService.track(this.translate.instant('vendors.guided.creating'), create$).subscribe({
        next: (created) => {
          this.snackbar.success(this.translate.instant('vendors.vendorCreated'));
          this.loadVendors();
          this.openVendorDetail(created);
        },
      });
    });
  }

  protected closeDialog(): void { this.showDialog.set(false); }

  protected onDialogSaved(): void {
    this.closeDialog();
    this.loadVendors();
  }
}
