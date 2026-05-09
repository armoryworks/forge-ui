import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CustomerService } from '../../services/customer.service';
import { ContactInteraction } from '../../models/contact-interaction.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { toIsoDate } from '../../../../shared/utils/date.utils';

/**
 * Wave 6 — Customer Interactions cluster (CRM activity log).
 *
 * Multi-row entity collection cluster surfacing the contact-interaction
 * timeline (call / email / meeting / note logs) per contact + per
 * customer. Mounted into the Interactions tab on the customer detail
 * page when CAP-MD-CUSTOMER-INTERACTIONS is enabled.
 *
 * Was previously `CustomerInteractionsTabComponent` at
 * `pages/customer-detail/tabs/`. Moved to `components/customer-clusters/`
 * + renamed to match the cluster naming convention. Visible UX unchanged.
 */
@Component({
  selector: 'app-customer-interactions-cluster',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    TranslatePipe,
    DataTableComponent,
    ColumnCellDirective,
    InputComponent,
    SelectComponent,
    TextareaComponent,
    DatepickerComponent,
    DialogComponent,
    ValidationButtonComponent,
    LoadingBlockDirective,
  ],
  templateUrl: './customer-interactions-cluster.component.html',
  styleUrl: '../../pages/customer-detail/customer-detail-tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerInteractionsClusterComponent {
  private readonly customerService = inject(CustomerService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  readonly customerId = input.required<number>();

  protected readonly interactions = signal<ContactInteraction[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly showDialog = signal(false);
  protected readonly editingId = signal<number | null>(null);

  protected readonly contactFilterControl = new FormControl<number | null>(null);
  protected readonly typeFilterControl = new FormControl<string>('');
  protected readonly contactOptions = signal<SelectOption[]>([
    { value: null, label: this.translate.instant('customers.interactions.filterAllContacts') },
  ]);

  protected readonly typeOptions: SelectOption[] = [
    { value: '', label: this.translate.instant('customers.interactions.filterAllTypes') },
    { value: 'Call', label: this.translate.instant('customers.interactions.types.Call') },
    { value: 'Email', label: this.translate.instant('customers.interactions.types.Email') },
    { value: 'Meeting', label: this.translate.instant('customers.interactions.types.Meeting') },
    { value: 'Note', label: this.translate.instant('customers.interactions.types.Note') },
  ];

  protected readonly formTypeOptions: SelectOption[] = [
    { value: 'Call', label: this.translate.instant('customers.interactions.types.Call') },
    { value: 'Email', label: this.translate.instant('customers.interactions.types.Email') },
    { value: 'Meeting', label: this.translate.instant('customers.interactions.types.Meeting') },
    { value: 'Note', label: this.translate.instant('customers.interactions.types.Note') },
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
    type: this.translate.instant('customers.interactions.violations.type'),
    subject: this.translate.instant('customers.interactions.violations.subject'),
    interactionDate: this.translate.instant('customers.interactions.violations.date'),
  });

  protected readonly columns: ColumnDef[] = [
    { field: 'type', header: this.translate.instant('customers.interactions.type'),
      sortable: true, filterable: true, type: 'enum', width: '100px',
      filterOptions: this.typeOptions.slice(1) },
    { field: 'subject', header: this.translate.instant('customers.interactions.subject'), sortable: true },
    { field: 'contactName', header: this.translate.instant('customers.interactions.contact'), sortable: true, width: '160px' },
    { field: 'userName', header: this.translate.instant('customers.interactions.loggedBy'), sortable: true, width: '160px' },
    { field: 'interactionDate', header: this.translate.instant('customers.interactions.date'), sortable: true, type: 'date', width: '120px' },
    { field: 'durationMinutes', header: this.translate.instant('customers.interactions.duration'), sortable: true, type: 'number', width: '90px' },
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

    this.contactFilterControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadInteractions());
    this.typeFilterControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadInteractions());
  }

  private loadContacts(): void {
    this.customerService.getCustomerById(this.customerId()).subscribe({
      next: (customer) => {
        const contacts = (customer as { contacts?: { id: number; firstName: string; lastName: string }[] }).contacts ?? [];
        this.contactOptions.set([
          { value: null, label: this.translate.instant('customers.interactions.filterAllContacts') },
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
        this.snackbar.success(this.translate.instant(id ? 'customers.interactions.updated' : 'customers.interactions.logged'));
      },
      error: () => this.saving.set(false),
    });
  }

  protected deleteInteraction(interaction: ContactInteraction): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('customers.interactions.deleteTitle'),
        message: this.translate.instant('customers.interactions.deleteMessage', { subject: interaction.subject }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.customerService.deleteInteraction(this.customerId(), interaction.id).subscribe({
        next: () => {
          this.loadInteractions();
          this.snackbar.success(this.translate.instant('customers.interactions.deleted'));
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
