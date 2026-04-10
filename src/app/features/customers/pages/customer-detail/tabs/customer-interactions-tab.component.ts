import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';

import { CustomerService } from '../../../services/customer.service';
import { ContactInteraction } from '../../../models/contact-interaction.model';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';
import { FormValidationService } from '../../../../../shared/services/form-validation.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DataTableComponent } from '../../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../../shared/directives/column-cell.directive';
import { InputComponent } from '../../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../../../shared/components/datepicker/datepicker.component';
import { DialogComponent } from '../../../../../shared/components/dialog/dialog.component';
import { ValidationPopoverDirective } from '../../../../../shared/directives/validation-popover.directive';
import { LoadingBlockDirective } from '../../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../../shared/models/column-def.model';
import { toIsoDate } from '../../../../../shared/utils/date.utils';

@Component({
  selector: 'app-customer-interactions-tab',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    DataTableComponent,
    ColumnCellDirective,
    InputComponent,
    SelectComponent,
    TextareaComponent,
    DatepickerComponent,
    DialogComponent,
    ValidationPopoverDirective,
    LoadingBlockDirective,
  ],
  templateUrl: './customer-interactions-tab.component.html',
  styleUrl: '../customer-detail-tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerInteractionsTabComponent {
  private readonly customerService = inject(CustomerService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);

  readonly customerId = input.required<number>();

  protected readonly interactions = signal<ContactInteraction[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly showDialog = signal(false);
  protected readonly editingId = signal<number | null>(null);

  protected readonly contactFilterControl = new FormControl<number | null>(null);
  protected readonly typeFilterControl = new FormControl<string>('');
  protected readonly contactOptions = signal<SelectOption[]>([{ value: null, label: '-- All Contacts --' }]);

  protected readonly typeOptions: SelectOption[] = [
    { value: '', label: '-- All Types --' },
    { value: 'Call', label: 'Call' },
    { value: 'Email', label: 'Email' },
    { value: 'Meeting', label: 'Meeting' },
    { value: 'Note', label: 'Note' },
  ];

  protected readonly formTypeOptions: SelectOption[] = [
    { value: 'Call', label: 'Call' },
    { value: 'Email', label: 'Email' },
    { value: 'Meeting', label: 'Meeting' },
    { value: 'Note', label: 'Note' },
  ];

  protected readonly form = new FormGroup({
    contactId: new FormControl<number | null>(null),
    type: new FormControl('Call', [Validators.required]),
    subject: new FormControl('', [Validators.required, Validators.maxLength(200)]),
    body: new FormControl<string | null>(null),
    interactionDate: new FormControl<Date | null>(new Date(), [Validators.required]),
    durationMinutes: new FormControl<number | null>(null),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    type: 'Type',
    subject: 'Subject',
    interactionDate: 'Date',
  });

  protected readonly columns: ColumnDef[] = [
    { field: 'type', header: 'Type', sortable: true, filterable: true, type: 'enum', width: '100px',
      filterOptions: this.typeOptions.slice(1) },
    { field: 'subject', header: 'Subject', sortable: true },
    { field: 'contactName', header: 'Contact', sortable: true, width: '160px' },
    { field: 'userName', header: 'Logged By', sortable: true, width: '160px' },
    { field: 'interactionDate', header: 'Date', sortable: true, type: 'date', width: '120px' },
    { field: 'durationMinutes', header: 'Duration', sortable: true, type: 'number', width: '90px' },
    { field: 'actions', header: '', width: '80px' },
  ];

  constructor() {
    effect(() => {
      const id = this.customerId();
      if (id > 0) {
        this.loadInteractions();
        this.loadContacts();
      }
    });

    this.contactFilterControl.valueChanges.subscribe(() => this.loadInteractions());
    this.typeFilterControl.valueChanges.subscribe(() => this.loadInteractions());
  }

  private loadContacts(): void {
    this.customerService.getCustomerById(this.customerId()).subscribe({
      next: (customer) => {
        const contacts = (customer as { contacts?: { id: number; firstName: string; lastName: string }[] }).contacts ?? [];
        this.contactOptions.set([
          { value: null, label: '-- All Contacts --' },
          ...contacts.map(c => ({ value: c.id, label: `${c.lastName}, ${c.firstName}` })),
        ]);
      },
    });
  }

  protected loadInteractions(): void {
    this.loading.set(true);
    const contactId = this.contactFilterControl.value ?? undefined;
    this.customerService.getInteractions(this.customerId(), contactId).subscribe({
      next: (data) => {
        let filtered = data;
        const typeFilter = this.typeFilterControl.value;
        if (typeFilter) {
          filtered = filtered.filter(i => i.type === typeFilter);
        }
        this.interactions.set(filtered);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected openCreate(): void {
    this.editingId.set(null);
    this.form.reset({ type: 'Call', interactionDate: new Date() });
    this.showDialog.set(true);
  }

  protected openEdit(interaction: ContactInteraction): void {
    this.editingId.set(interaction.id);
    this.form.patchValue({
      contactId: interaction.contactId,
      type: interaction.type,
      subject: interaction.subject,
      body: interaction.body,
      interactionDate: new Date(interaction.interactionDate),
      durationMinutes: interaction.durationMinutes,
    });
    this.showDialog.set(true);
  }

  protected closeDialog(): void {
    this.showDialog.set(false);
    this.editingId.set(null);
  }

  protected save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);

    const val = this.form.getRawValue();
    const request = {
      contactId: val.contactId,
      type: val.type!,
      subject: val.subject!,
      body: val.body,
      interactionDate: toIsoDate(val.interactionDate) ?? new Date().toISOString(),
      durationMinutes: val.durationMinutes,
    };

    const id = this.editingId();
    const op = id
      ? this.customerService.updateInteraction(this.customerId(), id, request)
      : this.customerService.createInteraction(this.customerId(), request);

    op.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeDialog();
        this.loadInteractions();
        this.snackbar.success(id ? 'Interaction updated' : 'Interaction logged');
      },
      error: () => this.saving.set(false),
    });
  }

  protected deleteInteraction(interaction: ContactInteraction): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Interaction?',
        message: `Delete "${interaction.subject}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.customerService.deleteInteraction(this.customerId(), interaction.id).subscribe({
        next: () => {
          this.loadInteractions();
          this.snackbar.success('Interaction deleted');
        },
      });
    });
  }

  protected typeIcon(type: string): string {
    switch (type) {
      case 'Call': return 'phone';
      case 'Email': return 'email';
      case 'Meeting': return 'groups';
      case 'Note': return 'note';
      default: return 'chat';
    }
  }

  protected formatDuration(minutes: number | null): string {
    if (!minutes) return '—';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
}
