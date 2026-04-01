import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CdkDragDrop, CdkDropList, CdkDrag, CdkDragPlaceholder, CdkDragPreview } from '@angular/cdk/drag-drop';

import { LeadsService } from './services/leads.service';
import { LeadItem } from './models/lead-item.model';
import { LeadStatus } from './models/lead-status.type';
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
import { ValidationPopoverDirective } from '../../shared/directives/validation-popover.directive';
import { toIsoDate } from '../../shared/utils/date.utils';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../shared/services/snackbar.service';
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
    DataTableComponent, ColumnCellDirective, ValidationPopoverDirective, MatTooltipModule,
    CdkDropList, CdkDrag, CdkDragPlaceholder, CdkDragPreview,
    AvatarComponent,
  ],
  templateUrl: './leads.component.html',
  styleUrl: './leads.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadsComponent {
  private readonly leadsService = inject(LeadsService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly leads = signal<LeadItem[]>([]);
  protected readonly selectedLead = signal<LeadItem | null>(null);

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
    notes: new FormControl(''),
    followUpDate: new FormControl<Date | null>(null),
  });

  protected readonly leadViolations = FormValidationService.getViolations(this.leadForm, {
    companyName: 'Company Name',
    contactName: 'Contact Name',
    email: 'Email',
    phone: 'Phone',
    source: 'Source',
    notes: 'Notes',
    followUpDate: 'Follow-Up Date',
  });

  // Lost reason dialog
  protected readonly showLostDialog = signal(false);
  protected readonly lostReasonControl = new FormControl('');

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

  protected readonly leadRowClass = (row: unknown) => {
    const lead = row as LeadItem;
    return lead.id === this.selectedLead()?.id ? 'row--selected' : '';
  };

  protected readonly statuses: LeadStatus[] = ['New', 'Contacted', 'Quoting', 'Converted', 'Lost'];
  protected readonly leadSources = ['Referral', 'Website', 'Trade Show', 'Cold Call', 'Email', 'Social Media', 'Other'];

  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('leads.allStatuses') },
    ...this.statuses.map(s => ({ value: s, label: s })),
  ];

  protected readonly sourceOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('common.none') },
    ...this.leadSources.map(s => ({ value: s, label: s })),
  ];

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
    this.loadLeads();
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
      next: (leads) => { this.leads.set(leads); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected applyFilters(): void { this.loadLeads(); }
  protected clearSearch(): void { this.searchControl.setValue(''); this.loadLeads(); }

  protected selectLead(lead: LeadItem): void {
    this.selectedLead.set(lead);
  }

  protected closeDetail(): void {
    this.selectedLead.set(null);
  }

  protected openCreateLead(): void {
    this.editingLead.set(null);
    this.leadForm.reset({
      companyName: '',
      contactName: '',
      email: '',
      phone: '',
      source: '',
      notes: '',
      followUpDate: null,
    });
    this.showDialog.set(true);
  }

  protected openEditLead(): void {
    const lead = this.selectedLead();
    if (!lead) return;
    this.editingLead.set(lead);
    this.leadForm.patchValue({
      companyName: lead.companyName,
      contactName: lead.contactName ?? '',
      email: lead.email ?? '',
      phone: lead.phone ?? '',
      source: lead.source ?? '',
      notes: lead.notes ?? '',
      followUpDate: lead.followUpDate ?? null,
    });
    this.showDialog.set(true);
  }

  protected closeDialog(): void { this.showDialog.set(false); }

  protected saveLead(): void {
    if (this.leadForm.invalid) return;

    this.saving.set(true);
    const form = this.leadForm.getRawValue();
    const editing = this.editingLead();

    const payload = {
      companyName: form.companyName!,
      contactName: form.contactName || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      source: form.source || undefined,
      notes: form.notes || undefined,
      followUpDate: toIsoDate(form.followUpDate) ?? undefined,
    };

    if (editing) {
      this.leadsService.updateLead(editing.id, payload).subscribe({
        next: (lead) => { this.saving.set(false); this.selectedLead.set(lead); this.closeDialog(); this.loadLeads(); },
        error: () => this.saving.set(false),
      });
    } else {
      this.leadsService.createLead(payload).subscribe({
        next: (lead) => { this.saving.set(false); this.selectedLead.set(lead); this.closeDialog(); this.loadLeads(); },
        error: () => this.saving.set(false),
      });
    }
  }

  protected updateStatus(status: LeadStatus): void {
    const lead = this.selectedLead();
    if (!lead) return;

    if (status === 'Lost') {
      this.showLostDialog.set(true);
      return;
    }

    this.leadsService.updateLead(lead.id, { status }).subscribe({
      next: (updated) => { this.selectedLead.set(updated); this.loadLeads(); },
    });
  }

  protected confirmLost(): void {
    const lead = this.selectedLead();
    if (!lead) return;
    this.leadsService.updateLead(lead.id, {
      status: 'Lost',
      lostReason: this.lostReasonControl.value || undefined,
    }).subscribe({
      next: (updated) => {
        this.selectedLead.set(updated);
        this.showLostDialog.set(false);
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
    return lead.followUpDate.getTime() < new Date().getTime();
  }

  protected convertLead(): void {
    const lead = this.selectedLead();
    if (!lead) return;

    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('leads.convertTitle'),
        message: this.translate.instant('leads.convertMessage', { name: lead.companyName }),
        confirmLabel: this.translate.instant('leads.convertOnly'),
        severity: 'info',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (confirmed === undefined) return;
      this.executeConversion(lead.id, false);
    });
  }

  protected convertLeadWithJob(): void {
    const lead = this.selectedLead();
    if (!lead) return;
    this.executeConversion(lead.id, true);
  }

  private executeConversion(leadId: number, createJob: boolean): void {
    this.saving.set(true);
    this.leadsService.convertLead(leadId, createJob).subscribe({
      next: () => {
        this.saving.set(false);
        const msg = createJob
          ? this.translate.instant('leads.convertedWithJob')
          : this.translate.instant('leads.convertedOnly');
        this.snackbar.success(msg);
        this.selectedLead.set(null);
        this.loadLeads();
      },
      error: () => {
        this.saving.set(false);
        this.snackbar.error(this.translate.instant('leads.convertFailed'));
      },
    });
  }

  protected deleteLead(): void {
    const lead = this.selectedLead();
    if (!lead) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('leads.deleteTitle'),
        message: this.translate.instant('leads.deleteMessage', { name: lead.companyName }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.leadsService.deleteLead(lead.id).subscribe({
        next: () => {
          this.selectedLead.set(null);
          this.loadLeads();
          this.snackbar.success(this.translate.instant('leads.deleted'));
        },
      });
    });
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
  protected formatValue(lead: LeadItem): string | null {
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
      this.selectedLead.set({ ...lead, status: targetStatus });
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
