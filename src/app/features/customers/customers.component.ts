import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, startWith } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CustomerService } from './services/customer.service';
import { CustomerListItem } from './models/customer-list-item.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { FormValidationService } from '../../shared/services/form-validation.service';
import { ValidationButtonComponent } from '../../shared/components/validation-button/validation-button.component';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { ScannerService } from '../../shared/services/scanner.service';
import { DetailDialogService } from '../../shared/services/detail-dialog.service';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { EntityCompletenessChipComponent } from '../../shared/components/entity-completeness-chip/entity-completeness-chip.component';
import { EntityCompletenessBadgeComponent } from '../../shared/components/entity-completeness-badge/entity-completeness-badge.component';
import { CustomerDetailDialogComponent, CustomerDetailDialogData, CustomerDetailDialogResult } from './components/customer-detail-dialog/customer-detail-dialog.component';
import { NewCustomerForkDialogComponent, CustomerCreatePath } from './components/new-customer-fork-dialog/new-customer-fork-dialog.component';
import { LeadPickerDialogComponent } from './components/new-customer-fork-dialog/lead-picker-dialog.component';
import { LeadItem } from '../leads/models/lead-item.model';
import { LeadsService } from '../leads/services/leads.service';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe, TranslatePipe,
    PageHeaderComponent, DialogComponent,
    InputComponent, SelectComponent,
    DataTableComponent, ColumnCellDirective, ValidationButtonComponent,
    LoadingBlockDirective,
    EntityCompletenessChipComponent, EntityCompletenessBadgeComponent,
  ],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomersComponent {
  private readonly customerService = inject(CustomerService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly scanner = inject(ScannerService);
  private readonly detailDialog = inject(DetailDialogService);
  private readonly leadsService = inject(LeadsService);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly customers = signal<CustomerListItem[]>([]);
  // Phase 3 F7-partial / WU-17 — surfaces the server-side totalCount so the
  // header can show "X of Y" once the data-table is wired to true server
  // pagination. Today the data-table still slices the 200-record page
  // client-side, but the envelope is in place.
  protected readonly totalCount = signal<number>(0);

  // Filters
  protected readonly searchControl = new FormControl('');
  protected readonly activeFilterControl = new FormControl<boolean | null>(null);

  private readonly searchTerm = toSignal(this.searchControl.valueChanges.pipe(startWith('')), { initialValue: '' });

  protected readonly activeOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('common.all') },
    { value: true, label: this.translate.instant('common.active') },
    { value: false, label: this.translate.instant('common.inactive') },
  ];

  // Customer Create Dialog — Phase 3 F3 extends the form with the full-record
  // fields a small-shop onboarding flow captures: credit limit, default tax
  // code id, default currency, and billing/shipping addresses. All are
  // optional; existing minimal-payload submissions still work.
  protected readonly showDialog = signal(false);
  protected readonly customerForm = new FormGroup({
    name: new FormControl('', [Validators.required]),
    companyName: new FormControl(''),
    email: new FormControl('', [Validators.email]),
    phone: new FormControl(''),
    // F3 — full-record fields
    creditLimit: new FormControl<number | null>(null, [Validators.min(0), Validators.max(1_000_000_000)]),
    defaultTaxCodeId: new FormControl<number | null>(null),
    // ISO 4217: 3 uppercase letters (matches server validation)
    defaultCurrency: new FormControl<string | null>(null, [Validators.pattern(/^[A-Z]{3}$/)]),
    billingAddress: new FormGroup({
      street: new FormControl<string | null>(null),
      line2: new FormControl<string | null>(null),
      city: new FormControl<string | null>(null),
      state: new FormControl<string | null>(null),
      postal: new FormControl<string | null>(null),
      country: new FormControl<string | null>('US'),
    }),
    shippingAddress: new FormGroup({
      street: new FormControl<string | null>(null),
      line2: new FormControl<string | null>(null),
      city: new FormControl<string | null>(null),
      state: new FormControl<string | null>(null),
      postal: new FormControl<string | null>(null),
      country: new FormControl<string | null>('US'),
    }),
  });

  // F14 — match the New Job pattern exactly: getViolations returns a
  // Signal<string[]> and must be bound directly. Wrapping it in computed()
  // re-ran getViolations (which writes a signal synchronously via startWith)
  // inside a computed evaluation, so the indicator never lit up on pristine
  // open like New Job's does.
  protected readonly customerViolations = FormValidationService.getViolations(this.customerForm, {
    name: this.translate.instant('common.name'),
    companyName: this.translate.instant('customers.companyName'),
    email: this.translate.instant('common.email'),
    phone: this.translate.instant('common.phone'),
    creditLimit: this.translate.instant('customers.creditLimit'),
    defaultCurrency: this.translate.instant('customers.defaultCurrency'),
  });

  // Table
  protected readonly customerColumns: ColumnDef[] = [
    { field: 'name', header: this.translate.instant('customers.colName'), sortable: true },
    { field: 'companyName', header: this.translate.instant('customers.colCompany'), sortable: true },
    { field: 'email', header: this.translate.instant('customers.colEmail'), sortable: true },
    { field: 'phone', header: this.translate.instant('customers.colPhone'), sortable: true },
    { field: 'isActive', header: this.translate.instant('customers.colActive'), sortable: true, type: 'enum', filterable: true, filterOptions: [
      { value: true, label: this.translate.instant('common.active') }, { value: false, label: this.translate.instant('common.inactive') },
    ], width: '80px' },
    { field: 'contactCount', header: this.translate.instant('customers.colContacts'), sortable: true, width: '90px', align: 'center' },
    { field: 'jobCount', header: this.translate.instant('customers.colJobs'), sortable: true, width: '70px', align: 'center' },
    { field: 'createdAt', header: this.translate.instant('customers.colCreated'), sortable: true, type: 'date', width: '110px' },
    // Hidden by default — power users opt in via column-manager. Renders the
    // full completeness chip (click → popover with per-capability gaps).
    { field: 'completeness', header: this.translate.instant('entityCompleteness.columnHeader'), width: '160px', align: 'center', visible: false },
  ];

  constructor() {
    // Wave 4 — URL-as-truth on filter state. Read on construct so a refresh /
    // shared link lands on the same filter pose, then write back on change so
    // the URL stays in sync. Uses replaceUrl so each keystroke doesn't pile
    // entries onto the back stack.
    const params = this.route.snapshot.queryParamMap;
    const initialSearch = params.get('q') ?? '';
    const initialActive = params.get('active');
    this.searchControl.setValue(initialSearch, { emitEvent: false });
    if (initialActive === 'true') this.activeFilterControl.setValue(true, { emitEvent: false });
    else if (initialActive === 'false') this.activeFilterControl.setValue(false, { emitEvent: false });

    this.scanner.setContext('customers');
    this.loadCustomers();

    // Wave 5+ — auto-open the customer preview dialog when landing on the
    // page with `?detail=customer:{id}`. Cross-entity links from invoice /
    // SO / shipment screens drop a query param like that and route here;
    // the dialog opens after the list loads. User can dismiss to remain
    // on the customers list, or click "Open Customer Page" to navigate
    // into the full multi-tab detail.
    const detail = this.detailDialog.getDetailFromUrl();
    if (detail?.entityType === 'customer') {
      this.openCustomerPreview(detail.entityId);
    }

    // Scanner — drop scanned values into the search field. Loads on the
    // next tick via the debounced search subscription below.
    effect(() => {
      const scan = this.scanner.lastScan();
      if (!scan || scan.context !== 'customers') return;
      this.scanner.clearLastScan();
      this.searchControl.setValue(scan.value);
    });

    // Phase 3 F7-partial / WU-17 — debounced search. Typed input fires the
    // standardised `?q=` query param against the server (300ms debounce per
    // the WU-17 charter). Active-filter changes also re-fetch so the server
    // pagination + filter contract is exercised live.
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => { this.syncUrl(); this.loadCustomers(); });

    this.activeFilterControl.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => { this.syncUrl(); this.loadCustomers(); });
  }

  /**
   * Mirror the current filter state into the URL. Mirrors the established
   * Parts pattern; refresh / share the URL and the same filter pose returns.
   * `replaceUrl` prevents back-stack pollution from each keystroke.
   */
  private syncUrl(): void {
    const search = (this.searchControl.value ?? '').trim() || null;
    const active = this.activeFilterControl.value;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: search,
        active: active === null ? null : String(active),
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected loadCustomers(): void {
    this.loading.set(true);
    const search = (this.searchTerm() ?? '').trim() || undefined;
    const isActive = this.activeFilterControl.value ?? undefined;
    // Phase 3 F7-partial / WU-17 — call the paged endpoint directly so we
    // can read totalCount for the header counter. PageSize=200 matches the
    // server cap; the data-table handles client-side slicing within that
    // window. Switch to true server-paging if a tenant exceeds 200 rows.
    this.customerService.getCustomersPaged({
      q: search,
      isActive,
      pageSize: 200,
      sort: 'createdAt',
      order: 'desc',
    }).subscribe({
      next: (paged) => {
        this.customers.set(paged.items);
        this.totalCount.set(paged.totalCount);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected applyFilters(): void { this.loadCustomers(); }

  protected selectCustomer(item: CustomerListItem): void {
    this.router.navigate(['/customers', item.id]);
  }

  /**
   * Wave 5+ — Open the customer preview dialog. Used by the auto-open-from-URL
   * path; cross-entity links route here via `?detail=customer:{id}`. Mirrors
   * the lead/part detail-dialog patterns.
   */
  protected openCustomerPreview(customerId: number): void {
    this.detailDialog.open<
      CustomerDetailDialogComponent, CustomerDetailDialogData, CustomerDetailDialogResult | undefined
    >('customer', customerId, CustomerDetailDialogComponent, { customerId }, { width: '720px' });
  }

  // ─── Customer Create ───
  /**
   * Phase 1o.4 — entry point opens the fork dialog first; the chosen
   * path then routes to the appropriate downstream flow:
   *   quick    → existing inline customer dialog
   *   fromLead → lead picker → existing lead-convert stepper
   *   guided   → multi-step guided wizard
   */
  protected openCreateCustomer(): void {
    this.dialog.open<NewCustomerForkDialogComponent, void, CustomerCreatePath | undefined>(
      NewCustomerForkDialogComponent, { width: '560px' },
    ).afterClosed().subscribe(path => {
      if (!path) return;
      switch (path) {
        case 'quick': this.openQuickCreateCustomer(); break;
        case 'fromLead': this.openLeadPicker(); break;
        case 'guided': this.openGuidedCreateCustomer(); break;
      }
    });
  }

  /** Quick add — the original flat 7-field dialog. */
  private openQuickCreateCustomer(): void {
    this.customerForm.reset({
      name: '', companyName: '', email: '', phone: '',
      creditLimit: null, defaultTaxCodeId: null, defaultCurrency: null,
      billingAddress: { street: null, line2: null, city: null, state: null, postal: null, country: 'US' },
      shippingAddress: { street: null, line2: null, city: null, state: null, postal: null, country: 'US' },
    });
    this.showDialog.set(true);
  }

  /**
   * Convert from lead — pick a lead, then run the one-click convert.
   *
   * Two-step UX simplification (2026-05-31): the second dialog
   * (LeadConvertDialogComponent, a mat-stepper for credit/tax/addresses)
   * was retired alongside the vendor + customer wizard migrations. The
   * server-side convertLead handler has always been atomic; the wizard
   * around it was UX scaffolding, not a technical necessity. Pick a
   * lead → POST with empty body → navigate to the new customer. The
   * credit/tax/address fields the wizard collected now move to the
   * customer detail page after conversion (admins can fill them there
   * via the existing edit flows).
   */
  private openLeadPicker(): void {
    this.dialog.open<LeadPickerDialogComponent, void, LeadItem | undefined>(
      LeadPickerDialogComponent, { width: '560px' },
    ).afterClosed().subscribe(lead => {
      if (!lead) return;
      this.executeLeadConversion(lead.id);
    });
  }

  private executeLeadConversion(leadId: number): void {
    this.saving.set(true);
    this.leadsService.convertLead(leadId, { createJob: false }).subscribe({
      next: (result) => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('leads.convertedOnly'));
        if (result.customerId) {
          this.router.navigate(['/customers', result.customerId]);
        } else {
          this.loadCustomers();
        }
      },
      error: () => {
        this.saving.set(false);
        this.snackbar.error(this.translate.instant('leads.convertFailed'));
      },
    });
  }

  /**
   * Guided wizard — routes to the WorkflowComponent-backed customer page
   * (mirrors the parts + vendor pattern). The old MatDialog-based guided
   * wizard was retired 2026-05-31 along with the mat-stepper substrate.
   */
  private openGuidedCreateCustomer(): void {
    this.router.navigate(['/customers/new'], {
      queryParams: { workflow: 'customer-guided-v1' },
    });
  }

  protected closeDialog(): void { this.showDialog.set(false); }

  /** Returns the inner address object only if the user filled in any required field. */
  private extractAddress(group: { street: string | null; line2: string | null; city: string | null; state: string | null; postal: string | null; country: string | null }) {
    const filled = !!(group.street || group.city || group.state || group.postal);
    if (!filled) return undefined;
    return {
      street: group.street ?? '',
      line2: group.line2 ?? undefined,
      city: group.city ?? '',
      state: group.state ?? '',
      postal: group.postal ?? '',
      country: group.country ?? undefined,
    };
  }

  protected saveCustomer(): void {
    if (this.customerForm.invalid) return;
    this.saving.set(true);
    // Drop any prior server messages so a re-submit doesn't accumulate.
    FormValidationService.clearServerErrors(this.customerForm);
    const form = this.customerForm.getRawValue();

    this.customerService.createCustomer({
      name: form.name!,
      companyName: form.companyName || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      // F3 — full-record fields. Empty strings collapse to undefined so the
      // server treats them as unset rather than failing validation on a blank
      // address sub-object.
      creditLimit: form.creditLimit ?? undefined,
      defaultTaxCodeId: form.defaultTaxCodeId ?? undefined,
      defaultCurrency: form.defaultCurrency || undefined,
      billingAddress: this.extractAddress(form.billingAddress),
      shippingAddress: this.extractAddress(form.shippingAddress),
    }).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.closeDialog();
        this.snackbar.success(this.translate.instant('customers.customerCreated'));
        this.router.navigate(['/customers', created.id]);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        // Phase 3 / WU-02: surface per-field server errors against the form
        // so the validation popover lights up; legacy non-envelope errors
        // fall through to the central interceptor's snackbar.
        FormValidationService.applyServerError(this.customerForm, err);
      },
    });
  }
}
