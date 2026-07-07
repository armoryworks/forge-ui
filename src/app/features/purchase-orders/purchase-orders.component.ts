import { ChangeDetectionStrategy, Component, effect, inject, signal, computed, untracked, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, map, startWith } from 'rxjs';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PurchaseOrderService } from './services/purchase-order.service';
import { PurchaseOrderListItem } from './models/purchase-order-list-item.model';
import { PO_ORIGIN_CHIP_CLASSES, PO_ORIGIN_ICONS, PO_ORIGIN_LABEL_KEYS } from './models/po-origin.const';
import { VendorService } from '../vendors/services/vendor.service';
import { VendorResponse } from '../vendors/models/vendor-response.model';
import { PoDialogComponent } from './components/po-dialog/po-dialog.component';
import { PoDetailDialogComponent, PoDetailDialogData } from './components/po-detail-dialog/po-detail-dialog.component';
import { AutoPoPanelComponent } from './components/auto-po-panel/auto-po-panel.component';
import { AutoPoSettingsPanelComponent } from './components/auto-po-settings-panel/auto-po-settings-panel.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { DetailDialogService } from '../../shared/services/detail-dialog.service';
import { AuthService } from '../../shared/services/auth.service';
import { DraftResumeService } from '../../shared/services/draft-resume.service';

type PoTab = 'orders' | 'suggestions' | 'settings';

@Component({
  selector: 'app-purchase-orders',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe, TranslatePipe,
    PageHeaderComponent, InputComponent, SelectComponent,
    DataTableComponent, ColumnCellDirective,
    PoDialogComponent, LoadingBlockDirective,
    AutoPoPanelComponent, AutoPoSettingsPanelComponent,
  ],
  templateUrl: './purchase-orders.component.html',
  styleUrl: './purchase-orders.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseOrdersComponent implements OnInit {
  private readonly poService = inject(PurchaseOrderService);
  private readonly vendorService = inject(VendorService);
  private readonly detailDialog = inject(DetailDialogService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly draftResume = inject(DraftResumeService);

  private static readonly VALID_TABS: PoTab[] = ['orders', 'suggestions', 'settings'];

  protected readonly isAdmin = this.auth.hasRole('Admin');

  protected readonly activeTab = toSignal(
    this.route.paramMap.pipe(map(p => {
      const tab = p.get('tab') as PoTab;
      return PurchaseOrdersComponent.VALID_TABS.includes(tab) ? tab : 'orders';
    })),
    { initialValue: 'orders' },
  );

  protected readonly loading = signal(false);
  protected readonly purchaseOrders = signal<PurchaseOrderListItem[]>([]);
  // Phase 3 F7-broad / WU-22 — server-side total for the header counter.
  protected readonly totalCount = signal<number>(0);
  protected readonly vendors = signal<VendorResponse[]>([]);
  protected readonly pendingSuggestionCount = signal(0);

  // Dialogs
  protected readonly showCreateDialog = signal(false);
  // Id of the PO whose detail dialog is currently open (via row click or the
  // ?detail= URL param). Guards the queryParamMap reaction against reopening
  // when DetailDialogService re-stamps the same param on open.
  private readonly openedDetailId = signal<number | null>(null);

  // Filters
  protected readonly searchControl = new FormControl('');
  protected readonly vendorFilterControl = new FormControl<number | null>(null);
  protected readonly statusFilterControl = new FormControl<string | null>(null);

  private readonly searchTerm = toSignal(this.searchControl.valueChanges.pipe(startWith('')), { initialValue: '' });

  protected readonly vendorOptions = computed<SelectOption[]>(() => [
    { value: null, label: this.translate.instant('purchaseOrders.allVendors') },
    ...this.vendors().map(v => ({ value: v.id, label: v.companyName })),
  ]);

  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('common.allStatuses') },
    { value: 'Draft', label: this.translate.instant('status.draft') },
    { value: 'Submitted', label: this.translate.instant('purchaseOrders.statusSubmitted') },
    { value: 'Acknowledged', label: this.translate.instant('purchaseOrders.statusAcknowledged') },
    { value: 'PartiallyReceived', label: this.translate.instant('purchaseOrders.statusPartiallyReceived') },
    { value: 'Received', label: this.translate.instant('purchaseOrders.statusReceived') },
    { value: 'Closed', label: this.translate.instant('status.closed') },
    { value: 'Cancelled', label: this.translate.instant('status.cancelled') },
  ];

  // S4b provenance — fixed server enum (PoOriginSource), so static options
  // are acceptable here (same as statusOptions above).
  protected readonly originFilterOptions: SelectOption[] = [
    { value: 'Manual', label: this.translate.instant('purchaseOrders.originManual') },
    { value: 'AutoMrp', label: this.translate.instant('purchaseOrders.originAutoMrp') },
    { value: 'AutoQuote', label: this.translate.instant('purchaseOrders.originAutoQuote') },
    { value: 'ExternalIntegration', label: this.translate.instant('purchaseOrders.originExternalIntegration') },
    { value: 'Edi', label: this.translate.instant('purchaseOrders.originEdi') },
  ];

  protected readonly poColumns: ColumnDef[] = [
    { field: 'poNumber', header: this.translate.instant('purchaseOrders.poNumber'), sortable: true, width: '120px' },
    { field: 'vendorName', header: this.translate.instant('purchaseOrders.vendor'), sortable: true },
    { field: 'jobNumber', header: this.translate.instant('purchaseOrders.job'), sortable: true, width: '100px' },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, filterable: true, type: 'enum', width: '140px', filterOptions: this.statusOptions.slice(1) },
    { field: 'originSource', header: this.translate.instant('purchaseOrders.origin'), sortable: true, filterable: true, type: 'enum', width: '130px', filterOptions: this.originFilterOptions },
    { field: 'lineCount', header: this.translate.instant('purchaseOrders.lines'), sortable: true, width: '70px', align: 'center' },
    { field: 'totalOrdered', header: this.translate.instant('purchaseOrders.ordered'), sortable: true, width: '90px', align: 'center' },
    { field: 'totalReceived', header: this.translate.instant('purchaseOrders.received'), sortable: true, width: '90px', align: 'center' },
    { field: 'expectedDeliveryDate', header: this.translate.instant('purchaseOrders.expected'), sortable: true, type: 'date', width: '110px' },
    { field: 'createdAt', header: this.translate.instant('common.created'), sortable: true, type: 'date', width: '110px' },
  ];

  constructor() {
    this.vendorService.getVendorDropdown().pipe(takeUntilDestroyed()).subscribe({
      next: (list) => this.vendors.set(list),
    });

    this.loadPendingSuggestionCount();

    effect(() => {
      const tab = this.activeTab();
      untracked(() => {
        if (tab === 'orders') {
          this.loadPurchaseOrders();
        }
      });
    });

    // Auto-open the PO detail from `?detail=purchase-order:{id}`. Reacting to
    // queryParamMap (not the list-load callback) fixes the dashboard 'goto'
    // double-click bug: the param emits on the initial navigation AND on a
    // re-navigation while the component is already mounted (tab unchanged), and
    // the dialog opens by id without waiting on the list HTTP round-trip.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(() => {
      const detail = this.detailDialog.getDetailFromUrl();
      if (detail?.entityType === 'purchase-order') {
        if (this.openedDetailId() !== detail.entityId) {
          this.openPurchaseOrderDetail({ id: detail.entityId } as PurchaseOrderListItem);
        }
      } else {
        this.openedDetailId.set(null);
      }
    });

    // Phase 3 F7-broad / WU-22 — debounced search + filter changes refire the
    // standardised paged endpoint.
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.loadPurchaseOrders());

    this.vendorFilterControl.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.loadPurchaseOrders());

    this.statusFilterControl.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.loadPurchaseOrders());
  }

  ngOnInit(): void {
    if (this.draftResume.consume('purchase-order')) {
      this.openCreatePo();
    }
  }

  protected switchTab(tab: PoTab): void {
    this.router.navigate(['..', tab], { relativeTo: this.route });
  }

  protected loadPurchaseOrders(): void {
    this.loading.set(true);
    const search = (this.searchTerm() ?? '').trim() || undefined;
    const vendorId = this.vendorFilterControl.value ?? undefined;
    const status = this.statusFilterControl.value ?? undefined;
    // Phase 3 F7-broad / WU-22 — call the paged endpoint directly so we can
    // read totalCount for the header counter. PageSize=200 matches the server
    // cap; the data-table handles client-side slicing within that window.
    this.poService.getPurchaseOrdersPaged({
      q: search,
      vendorId,
      status,
      pageSize: 200,
      sort: 'createdAt',
      order: 'desc',
    }).subscribe({
      next: (paged) => {
        this.purchaseOrders.set(paged.items);
        this.totalCount.set(paged.totalCount);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadPendingSuggestionCount(): void {
    this.poService.getAutoPoSuggestions('Pending').subscribe({
      next: (data) => this.pendingSuggestionCount.set(data.length),
    });
  }

  protected applyFilters(): void { this.loadPurchaseOrders(); }

  protected openPurchaseOrderDetail(item: PurchaseOrderListItem): void {
    this.openedDetailId.set(item.id);
    this.detailDialog.open<PoDetailDialogComponent, PoDetailDialogData, boolean>(
      'purchase-order',
      item.id,
      PoDetailDialogComponent,
      { purchaseOrderId: item.id },
    ).afterClosed().subscribe(changed => {
      this.openedDetailId.set(null);
      if (changed) this.loadPurchaseOrders();
    });
  }

  // --- Create ---
  protected openCreatePo(): void { this.showCreateDialog.set(true); }
  protected closeCreateDialog(): void { this.showCreateDialog.set(false); }

  protected onCreateSaved(): void {
    this.closeCreateDialog();
    this.loadPurchaseOrders();
  }

  // --- Helpers ---
  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Draft: 'chip--muted',
      Submitted: 'chip--info',
      Acknowledged: 'chip--primary',
      PartiallyReceived: 'chip--warning',
      Received: 'chip--success',
      Closed: 'chip--muted',
      Cancelled: 'chip--error',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getStatusLabel(status: string): string {
    const key = 'purchaseOrders.status' + status;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : status;
  }

  // S4b provenance — Origin column chip helpers. Row-scoped rendering inside
  // ng-templates follows the getStatusClass/getStatusLabel precedent above
  // (computed signals can't take a row argument).
  protected getOriginClass(source: string): string {
    return `chip po-origin-chip ${PO_ORIGIN_CHIP_CLASSES[source] ?? 'chip--muted'}`;
  }

  protected getOriginIcon(source: string): string {
    return PO_ORIGIN_ICONS[source] ?? 'person';
  }

  protected getOriginLabel(row: PurchaseOrderListItem): string {
    if (row.originSource === 'Manual' && row.originUserName) return row.originUserName;
    if (row.originSource === 'ExternalIntegration' && row.originReference) return row.originReference;
    const key = PO_ORIGIN_LABEL_KEYS[row.originSource];
    return key ? this.translate.instant(key) : row.originSource;
  }
}
