import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { LeadsService } from './services/leads.service';
import { LeadItem, LeadStatus } from './models/leads.model';
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

@Component({
  selector: 'app-leads',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe,
    PageHeaderComponent, DialogComponent,
    InputComponent, SelectComponent, TextareaComponent, DatepickerComponent,
    DataTableComponent, ColumnCellDirective, ValidationPopoverDirective,
  ],
  templateUrl: './leads.component.html',
  styleUrl: './leads.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadsComponent {
  private readonly leadsService = inject(LeadsService);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly leads = signal<LeadItem[]>([]);
  protected readonly selectedLead = signal<LeadItem | null>(null);

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
    source: new FormControl(''),
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
    { field: 'companyName', header: 'Company', sortable: true },
    { field: 'contactName', header: 'Contact', sortable: true },
    { field: 'source', header: 'Source', sortable: true },
    { field: 'status', header: 'Status', sortable: true, filterable: true, type: 'enum', filterOptions: [
      { value: 'New', label: 'New' }, { value: 'Contacted', label: 'Contacted' },
      { value: 'Quoting', label: 'Quoting' }, { value: 'Converted', label: 'Converted' },
      { value: 'Lost', label: 'Lost' },
    ]},
    { field: 'followUpDate', header: 'Follow-Up', sortable: true, type: 'date' },
    { field: 'createdAt', header: 'Created', sortable: true, type: 'date' },
  ];

  protected readonly leadRowClass = (row: unknown) => {
    const lead = row as LeadItem;
    return lead.id === this.selectedLead()?.id ? 'row--selected' : '';
  };

  protected readonly statuses: LeadStatus[] = ['New', 'Contacted', 'Quoting', 'Converted', 'Lost'];
  protected readonly leadSources = ['Referral', 'Website', 'Trade Show', 'Cold Call', 'Email', 'Social Media', 'Other'];

  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: 'All Statuses' },
    ...this.statuses.map(s => ({ value: s, label: s })),
  ];

  protected readonly sourceOptions: SelectOption[] = [
    { value: '', label: 'Select...' },
    ...this.leadSources.map(s => ({ value: s, label: s })),
  ];

  constructor() {
    this.loadLeads();
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
      followUpDate: lead.followUpDate ? new Date(lead.followUpDate) : null,
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
    return new Date(lead.followUpDate) < new Date();
  }
}
