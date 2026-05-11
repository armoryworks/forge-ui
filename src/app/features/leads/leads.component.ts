import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal, ViewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, startWith } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CdkDragDrop, CdkDropList, CdkDrag, CdkDragPlaceholder, CdkDragPreview } from '@angular/cdk/drag-drop';

import { LeadsService } from './services/leads.service';
import { AccountsService } from './services/accounts.service';
import { LeadItem } from './models/lead-item.model';
import { Account } from './models/account.model';
import { LeadStatus } from './models/lead-status.type';
import { LeadDetailDialogComponent, LeadDetailDialogData, LeadDetailDialogResult } from './components/lead-detail-dialog/lead-detail-dialog.component';
import { NewLeadForkDialogComponent } from './components/new-lead-fork-dialog/new-lead-fork-dialog.component';
import { CreateLeadRequest } from './models/create-lead-request.model';
import { ReferenceDataService } from '../../shared/services/reference-data.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { TextareaComponent } from '../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../shared/components/datepicker/datepicker.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { FormValidationService } from '../../shared/services/form-validation.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { ValidationButtonComponent } from '../../shared/components/validation-button/validation-button.component';
import { DraftConfig } from '../../shared/models/draft-config.model';
import { toIsoDate, todayStart } from '../../shared/utils/date.utils';
import { DetailDialogService } from '../../shared/services/detail-dialog.service';
import { ScannerService } from '../../shared/services/scanner.service';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';

type ViewMode = 'table' | 'pipeline';

const VIEW_MODE_KEY = 'leads-view-mode';

@Component({
  selector: 'app-leads',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe, TranslatePipe,
    PageHeaderComponent, DialogComponent,
    InputComponent, SelectComponent, TextareaComponent, DatepickerComponent,
    DataTableComponent, ColumnCellDirective, ValidationButtonComponent, MatTooltipModule, MatMenuModule,
    CdkDropList, CdkDrag, CdkDragPlaceholder, CdkDragPreview,
    AvatarComponent, RouterLink,
  ],
  templateUrl: './leads.component.html',
  styleUrl: './leads.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadsComponent {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;

  private readonly leadsService = inject(LeadsService);
  private readonly accountsService = inject(AccountsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly refDataService = inject(ReferenceDataService);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly detailDialog = inject(DetailDialogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly scanner = inject(ScannerService);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly leads = signal<LeadItem[]>([]);
  /**
   * Phase 1l — follow-up dates can't be set in the past on CREATE. On
   * EDIT, an existing lead may carry a stale past-dated follow-up; we
   * leave that alone (the rep is most likely updating it forward, but
   * blocking the form on the existing value with `matDatepickerMin`
   * would prevent unrelated edits to other fields). Computed signal so
   * the constraint flips off when the dialog opens in edit mode.
   */
  protected readonly today = todayStart();
  protected readonly followUpMin = computed(() => this.editingLead() ? null : this.today);
  protected draftConfig: DraftConfig = { entityType: 'lead', entityId: 'new', route: '/leads' };

  // View mode — persisted to localStorage
  protected readonly viewMode = signal<ViewMode>(
    (localStorage.getItem(VIEW_MODE_KEY) as ViewMode) ?? 'table'
  );

  // Filters
  protected readonly searchControl = new FormControl('');
  protected readonly statusFilterControl = new FormControl<LeadStatus | null>(null);

  private readonly searchTerm = toSignal(this.searchControl.valueChanges.pipe(startWith('')), { initialValue: '' });
  private readonly statusFilter = toSignal(this.statusFilterControl.valueChanges.pipe(startWith(null as LeadStatus | null)), { initialValue: null as LeadStatus | null });

  // Dialog
  protected readonly showDialog = signal(false);
  protected readonly editingLead = signal<LeadItem | null>(null);
  protected readonly leadForm = new FormGroup({
    companyName: new FormControl('', [Validators.required]),
    contactName: new FormControl(''),
    email: new FormControl('', [Validators.email]),
    phone: new FormControl(''),
    source: new FormControl<string | null>(null),
    accountId: new FormControl<number | null>(null),
    notes: new FormControl(''),
    followUpDate: new FormControl<Date | null>(null),
  });

  // Phase 1r / Batch 12 — populate the account picker on the edit dialog.
  // Loaded lazily on first edit-open; the empty/null option lets reps
  // unaffiliate a lead from any prior account.
  protected readonly accounts = signal<Account[]>([]);
  protected readonly accountOptions = computed<SelectOption[]>(() => [
    { value: null, label: this.translate.instant('leads.accounts.noneOption') },
    ...this.accounts().map(a => ({ value: a.id, label: a.name })),
  ]);

  // Bulk-assign-account on the table. Selection is tracked here from the
  // DataTable's selectionChange. When > 0 rows are selected, an action
  // bar appears with the "Assign to account" button.
  protected readonly selectedLeads = signal<LeadItem[]>([]);
  protected readonly bulkAccountControl = new FormControl<number | null>(null);
  protected readonly showBulkAssignDialog = signal(false);

  protected readonly leadViolations = FormValidationService.getViolations(this.leadForm, {
    companyName: 'Company Name',
    contactName: 'Contact Name',
    email: 'Email',
    phone: 'Phone',
    source: 'Source',
    notes: 'Notes',
    followUpDate: 'Follow-Up Date',
  });

  // Lost reason dialog (used by pipeline drag-to-Lost). Reason is required —
  // a lead going cold without a recorded reason is a data-quality hit; the
  // validation-button stereotype on the dialog's submit makes the gap visible.
  protected readonly showLostDialog = signal(false);
  protected readonly lostLeadId = signal<number | null>(null);
  protected readonly lostReasonControl = new FormControl('', [Validators.required, Validators.maxLength(500)]);
  protected readonly lostFormGroup = new FormGroup({ reason: this.lostReasonControl });
  protected readonly lostViolations = FormValidationService.getViolations(this.lostFormGroup, {
    reason: this.translate.instant('leads.reason'),
  });

  protected readonly leadColumns: ColumnDef[] = [
    { field: 'companyName', header: this.translate.instant('leads.colCompany'), sortable: true },
    { field: 'contactName', header: this.translate.instant('leads.colContact'), sortable: true },
    { field: 'source', header: this.translate.instant('leads.colSource'), sortable: true },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, filterable: true, type: 'enum', filterOptions: [
      { value: 'New', label: this.translate.instant('leads.statusNew') },
      { value: 'Contacted', label: this.translate.instant('leads.statusContacted') },
      { value: 'Quoting', label: this.translate.instant('leads.statusQuoting') },
      { value: 'Converted', label: this.translate.instant('leads.statusConverted') },
      { value: 'Lost', label: this.translate.instant('leads.statusLost') },
    ]},
    { field: 'followUpDate', header: this.translate.instant('leads.colFollowUp'), sortable: true, type: 'date' },
    { field: 'createdAt', header: this.translate.instant('leads.colCreated'), sortable: true, type: 'date' },
  ];

  protected readonly statuses: LeadStatus[] = ['New', 'Contacted', 'Quoting', 'Converted', 'Lost'];

  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('leads.allStatuses') },
    ...this.statuses.map(s => ({ value: s, label: s })),
  ];

  protected readonly sourceOptions = signal<SelectOption[]>([{ value: null, label: this.translate.instant('common.none') }]);

  // Filtered leads for pipeline grouping (client-side filter over loaded leads)
  private readonly filteredLeads = computed(() => {
    const term = (this.searchTerm() ?? '').toLowerCase().trim();
    const statusF = this.statusFilter();
    return this.leads().filter(lead => {
      const matchesSearch = !term ||
        lead.companyName.toLowerCase().includes(term) ||
        (lead.contactName ?? '').toLowerCase().includes(term);
      const matchesStatus = !statusF || lead.status === statusF;
      return matchesSearch && matchesStatus;
    });
  });

  // Grouped leads for pipeline view — Map from status → LeadItem[]
  // Using a mutable array per column so CDK drag-drop can splice in-place.
  // We keep it as a computed signal returning a plain object so the template can access each bucket.
  protected readonly groupedLeads = computed<Record<LeadStatus, LeadItem[]>>(() => {
    const map: Record<LeadStatus, LeadItem[]> = {
      New: [], Contacted: [], Quoting: [], Converted: [], Lost: [],
    };
    for (const lead of this.filteredLeads()) {
      map[lead.status].push(lead);
    }
    return map;
  });

  constructor() {
    // Wave 4 — URL-as-truth on filter state. Hydrate from query params on
    // mount so a refresh / shared link lands on the same filter pose, then
    // mirror back via syncUrl() on every change. replaceUrl prevents the
    // back stack from filling up with intermediate keystroke states.
    const params = this.route.snapshot.queryParamMap;
    const initialSearch = params.get('q') ?? '';
    const initialStatus = params.get('status') as LeadStatus | null;
    this.searchControl.setValue(initialSearch, { emitEvent: false });
    if (initialStatus && this.statuses.includes(initialStatus)) {
      this.statusFilterControl.setValue(initialStatus, { emitEvent: false });
    }

    this.scanner.setContext('leads');

    this.refDataService.getAsOptions('lead_source', { allLabel: this.translate.instant('common.none'), valueField: 'label' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(opts => this.sourceOptions.set(opts));
    this.loadLeads();

    // Scanner hookup — drop scanned values into the search input.
    effect(() => {
      const scan = this.scanner.lastScan();
      if (!scan || scan.context !== 'leads') return;
      this.scanner.clearLastScan();
      this.searchControl.setValue(scan.value);
    });

    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => { this.syncUrl(); this.loadLeads(); });

    this.statusFilterControl.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => { this.syncUrl(); this.loadLeads(); });
  }

  /** Mirror filter state into the URL. Mirrors the parts pattern. */
  private syncUrl(): void {
    const search = (this.searchControl.value ?? '').trim() || null;
    const status = this.statusFilterControl.value;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: search, status: status ?? null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  }

  protected loadLeads(): void {
    this.loading.set(true);
    const status = (this.statusFilter() ?? undefined) || undefined;
    const search = (this.searchTerm() ?? '').trim() || undefined;
    this.leadsService.getLeads(status, search).subscribe({
      next: (leads) => {
        this.leads.set(leads);
        this.loading.set(false);
        this.autoOpenFromUrl();
      },
      error: () => this.loading.set(false),
    });
  }

  /** Auto-open detail dialog when URL contains ?detail=lead:{id} */
  private autoOpenHandled = false;
  private autoOpenFromUrl(): void {
    if (this.autoOpenHandled) return;
    this.autoOpenHandled = true;
    const detail = this.detailDialog.getDetailFromUrl();
    if (detail?.entityType === 'lead') {
      this.openLeadDetail(detail.entityId);
    }
  }

  protected applyFilters(): void { this.loadLeads(); }
  protected clearSearch(): void { this.searchControl.setValue(''); this.loadLeads(); }

  protected openLeadDetail(leadId: number): void {
    this.detailDialog.open<LeadDetailDialogComponent, LeadDetailDialogData, LeadDetailDialogResult | undefined>(
      'lead', leadId, LeadDetailDialogComponent, { leadId },
    ).afterClosed().subscribe(result => {
      if (result?.action === 'edit') {
        this.openEditLeadFromDetail(result.lead);
      }
      this.loadLeads();
    });
  }

  protected openCreateLead(): void {
    // Wave 7 — New Lead routes through the fork dialog (engagement-shape
    // axis pick → form with shape-specific extras). Edit still uses the
    // inline flat form below since the lead has already been classified.
    this.dialog.open<NewLeadForkDialogComponent, void, CreateLeadRequest | undefined>(
      NewLeadForkDialogComponent,
      { width: '720px', maxWidth: '95vw' },
    ).afterClosed().subscribe(request => {
      if (!request) return;
      this.saving.set(true);
      this.leadsService.createLead(request).subscribe({
        next: () => {
          this.saving.set(false);
          this.loadLeads();
        },
        error: () => this.saving.set(false),
      });
    });
  }

  private openEditLeadFromDetail(lead: LeadItem): void {
    this.editingLead.set(lead);
    this.draftConfig = { entityType: 'lead', entityId: lead.id.toString(), route: '/leads' };
    this.leadForm.patchValue({
      companyName: lead.companyName,
      contactName: lead.contactName ?? '',
      email: lead.email ?? '',
      phone: lead.phone ?? '',
      source: lead.source ?? '',
      accountId: lead.accountId ?? null,
      notes: lead.notes ?? '',
      followUpDate: lead.followUpDate ?? null,
    });
    // Lazy-load the account list the first time an edit dialog opens.
    if (this.accounts().length === 0) {
      this.accountsService.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (rows) => this.accounts.set(rows),
      });
    }
    this.showDialog.set(true);
  }

  protected closeDialog(): void {
    this.showDialog.set(false);
  }

  /**
   * Bulk-assign-account flow. Selection comes from the DataTable's
   * selectionChange emit; opening the dialog ensures accounts are loaded
   * so the picker has options. Submit loops PATCH /leads/{id} once per
   * selected lead — leans on the existing update endpoint rather than a
   * dedicated bulk-route because the volume is bounded (a rep typically
   * selects < 50 leads to bulk-assign).
   */
  protected onLeadsSelectionChange(selected: unknown[]): void {
    this.selectedLeads.set(selected as LeadItem[]);
  }

  protected openBulkAssignDialog(): void {
    if (this.selectedLeads().length === 0) return;
    this.bulkAccountControl.setValue(null);
    if (this.accounts().length === 0) {
      this.accountsService.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (rows) => this.accounts.set(rows),
      });
    }
    this.showBulkAssignDialog.set(true);
  }

  protected closeBulkAssignDialog(): void {
    this.showBulkAssignDialog.set(false);
  }

  protected confirmBulkAssign(): void {
    const accountId = this.bulkAccountControl.value;
    const selected = this.selectedLeads();
    if (selected.length === 0) return;
    this.saving.set(true);
    // Fire all PATCHes in parallel — the server handles them as discrete
    // transactions; if some succeed and one fails we still want partial
    // success surfaced. Final reload pulls authoritative state.
    let inflight = selected.length;
    let errors = 0;
    selected.forEach(lead => {
      this.leadsService.updateLead(lead.id, { accountId }).subscribe({
        next: () => {
          if (--inflight === 0) this.finishBulkAssign(errors, selected.length);
        },
        error: () => {
          errors++;
          if (--inflight === 0) this.finishBulkAssign(errors, selected.length);
        },
      });
    });
  }

  private finishBulkAssign(errors: number, total: number): void {
    this.saving.set(false);
    this.showBulkAssignDialog.set(false);
    if (errors === 0) {
      this.snackbar.success(this.translate.instant('leads.bulkAssignSuccess', { count: total }));
    } else if (errors < total) {
      this.snackbar.error(this.translate.instant('leads.bulkAssignPartial', {
        ok: total - errors, total,
      }));
    } else {
      this.snackbar.error(this.translate.instant('leads.bulkAssignFailed'));
    }
    this.loadLeads();
  }

  protected saveLead(): void {
    if (this.leadForm.invalid) return;

    this.saving.set(true);
    const form = this.leadForm.getRawValue();
    const editing = this.editingLead();

    // Note: accountId is always included (not coerced to undefined) so that
    // explicitly clearing it on the edit dialog actually round-trips to the
    // server. The other optional fields use undefined elision since they
    // have no "clear" semantics distinct from "leave alone".
    const payload = {
      companyName: form.companyName!,
      contactName: form.contactName || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      source: form.source || undefined,
      accountId: form.accountId,
      notes: form.notes || undefined,
      followUpDate: toIsoDate(form.followUpDate) ?? undefined,
    };

    if (editing) {
      this.leadsService.updateLead(editing.id, payload).subscribe({
        next: () => {
          this.saving.set(false);
          this.dialogRef.clearDraft();
          this.closeDialog();
          this.loadLeads();
        },
        error: () => this.saving.set(false),
      });
    } else {
      this.leadsService.createLead(payload).subscribe({
        next: () => {
          this.saving.set(false);
          this.dialogRef.clearDraft();
          this.closeDialog();
          this.loadLeads();
        },
        error: () => this.saving.set(false),
      });
    }
  }

  protected confirmLost(): void {
    const leadId = this.lostLeadId();
    if (!leadId) return;
    this.leadsService.updateLead(leadId, {
      status: 'Lost',
      lostReason: this.lostReasonControl.value || undefined,
    }).subscribe({
      next: () => {
        this.showLostDialog.set(false);
        this.lostLeadId.set(null);
        this.lostReasonControl.setValue('');
        this.loadLeads();
      },
    });
  }

  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      New: 'chip--primary', Contacted: 'chip--info', Quoting: 'chip--warning',
      Converted: 'chip--success', Lost: 'chip--muted',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected isFollowUpOverdue(lead: LeadItem): boolean {
    if (!lead.followUpDate) return false;
    const d = lead.followUpDate instanceof Date ? lead.followUpDate : new Date(lead.followUpDate as unknown as string);
    return d.getTime() < new Date().getTime();
  }

  // ─── Pipeline drag-and-drop ───────────────────────────────────────────────

  /** Returns initials from a contact name (e.g. "Jane Smith" → "JS") */
  protected getInitials(name: string | null): string {
    if (!name) return '?';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0].toUpperCase())
      .join('');
  }

  /** Formats estimated value — placeholder since LeadItem has no estimatedValue field yet */
  protected formatValue(_lead: LeadItem): string | null {
    // LeadItem does not currently carry estimatedValue — extend when API adds it
    return null;
  }

  /** All column ids as a string array — needed for CdkDropList [connectedTo] */
  protected readonly pipelineColumnIds = this.statuses.map(s => `pipeline-col-${s}`);

  protected onCardDrop(
    event: CdkDragDrop<LeadItem[]>,
    targetStatus: LeadStatus,
  ): void {
    if (event.previousContainer === event.container) {
      // Reorder within same column — no API call needed
      return;
    }

    const lead: LeadItem = event.item.data;
    if (lead.status === targetStatus) return;

    // Optimistically move the card in the local leads array
    this.leads.update(all =>
      all.map(l => l.id === lead.id ? { ...l, status: targetStatus } : l)
    );

    // If dropping into Lost, show the lost reason dialog (same UX as button)
    if (targetStatus === 'Lost') {
      this.lostLeadId.set(lead.id);
      this.showLostDialog.set(true);
      return;
    }

    this.leadsService.updateLead(lead.id, { status: targetStatus }).subscribe({
      next: (updated) => {
        // Sync the authoritative response back into the leads array
        this.leads.update(all => all.map(l => l.id === updated.id ? updated : l));
      },
      error: () => {
        // Roll back optimistic update on failure
        this.leads.update(all =>
          all.map(l => l.id === lead.id ? { ...l, status: lead.status } : l)
        );
      },
    });
  }
}
