import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { formatDate } from '../../../shared/utils/date.utils';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';

import { ExpensesService } from '../services/expenses.service';
import { RecurringExpense } from '../models/recurring-expense.model';
import { UpcomingExpense } from '../models/upcoming-expense.model';
import { RecurrenceFrequency } from '../models/recurrence-frequency.type';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../shared/components/datepicker/datepicker.component';
import { ToggleComponent } from '../../../shared/components/toggle/toggle.component';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../shared/models/column-def.model';
import { FormValidationService } from '../../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../../shared/directives/validation-popover.directive';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { toIsoDate } from '../../../shared/utils/date.utils';

type LedgerTab = 'upcoming' | 'recurring';

@Component({
  selector: 'app-upcoming-expenses',
  standalone: true,
  imports: [
    ReactiveFormsModule, CurrencyPipe, DatePipe,
    PageHeaderComponent, DialogComponent,
    InputComponent, SelectComponent, TextareaComponent, DatepickerComponent, ToggleComponent,
    DataTableComponent, ColumnCellDirective, ValidationPopoverDirective, LoadingBlockDirective,
  ],
  templateUrl: './upcoming-expenses.component.html',
  styleUrl: './upcoming-expenses.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpcomingExpensesComponent {
  private readonly expensesService = inject(ExpensesService);
  private readonly snackbar = inject(SnackbarService);
  private readonly matDialog = inject(MatDialog);

  protected readonly activeTab = signal<LedgerTab>('upcoming');
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);

  // Upcoming tab
  protected readonly upcomingExpenses = signal<UpcomingExpense[]>([]);
  protected readonly classificationFilter = new FormControl<string>('');
  private readonly classificationValue = toSignal(
    this.classificationFilter.valueChanges.pipe(startWith('')),
    { initialValue: '' },
  );

  protected readonly filteredUpcoming = computed(() => {
    const expenses = this.upcomingExpenses();
    const filter = this.highlightClassification();
    if (!filter) return expenses;
    return expenses; // All shown, highlighting handled in template
  });

  protected readonly highlightClassification = computed(() => {
    return (this.classificationValue() ?? '').trim();
  });

  protected readonly upcomingTotal = computed(() =>
    this.upcomingExpenses().reduce((sum, e) => sum + e.amount, 0),
  );

  protected readonly upcomingByMonth = computed(() => {
    const groups = new Map<string, { month: string; total: number; count: number }>();
    for (const e of this.upcomingExpenses()) {
      const d = new Date(e.dueDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = formatDate(d);
      const existing = groups.get(key);
      if (existing) {
        existing.total += e.amount;
        existing.count++;
      } else {
        groups.set(key, { month: label, total: e.amount, count: 1 });
      }
    }
    return [...groups.values()];
  });

  protected readonly classificationOptions: SelectOption[] = [
    { value: '', label: 'All Classifications' },
    { value: 'Subscription', label: 'Subscription' },
    { value: 'Lease', label: 'Lease' },
    { value: 'Insurance', label: 'Insurance' },
    { value: 'Utility', label: 'Utility' },
    { value: 'Maintenance Contract', label: 'Maintenance Contract' },
    { value: 'License', label: 'License' },
    { value: 'Membership', label: 'Membership' },
    { value: 'Other', label: 'Other' },
  ];

  protected readonly frequencyOptions: SelectOption[] = [
    { value: 'Weekly', label: 'Weekly' },
    { value: 'Biweekly', label: 'Bi-weekly' },
    { value: 'Monthly', label: 'Monthly' },
    { value: 'Quarterly', label: 'Quarterly' },
    { value: 'Annually', label: 'Annually' },
  ];

  protected readonly upcomingColumns: ColumnDef[] = [
    { field: 'dueDate', header: 'Due Date', sortable: true, type: 'date', width: '110px' },
    { field: 'classification', header: 'Classification', sortable: true, filterable: true, type: 'enum', width: '140px',
      filterOptions: this.classificationOptions },
    { field: 'category', header: 'Category', sortable: true, width: '120px' },
    { field: 'description', header: 'Description', sortable: true },
    { field: 'vendor', header: 'Vendor', sortable: true, width: '140px' },
    { field: 'amount', header: 'Amount', sortable: true, align: 'right', width: '100px' },
    { field: 'frequency', header: 'Frequency', sortable: true, width: '100px' },
  ];

  // Recurring tab
  protected readonly recurringExpenses = signal<RecurringExpense[]>([]);
  protected readonly showDialog = signal(false);

  protected readonly recurringColumns: ColumnDef[] = [
    { field: 'classification', header: 'Classification', sortable: true, width: '140px' },
    { field: 'category', header: 'Category', sortable: true, width: '120px' },
    { field: 'description', header: 'Description', sortable: true },
    { field: 'vendor', header: 'Vendor', sortable: true, width: '140px' },
    { field: 'amount', header: 'Amount', sortable: true, align: 'right', width: '100px' },
    { field: 'frequency', header: 'Frequency', sortable: true, width: '100px' },
    { field: 'nextOccurrenceDate', header: 'Next Due', sortable: true, type: 'date', width: '110px' },
    { field: 'isActive', header: 'Active', sortable: true, width: '80px', align: 'center' },
    { field: 'actions', header: '', width: '60px', align: 'right' },
  ];

  protected readonly categoryOptions: SelectOption[] = [
    'Materials', 'Tools', 'Travel', 'Fuel', 'Meals',
    'Shipping', 'Office Supplies', 'Equipment', 'Maintenance', 'Software', 'Other',
  ].map(c => ({ value: c, label: c }));

  // Create dialog form
  protected readonly form = new FormGroup({
    amount: new FormControl<number>(0, [Validators.required, Validators.min(0.01)]),
    category: new FormControl('', [Validators.required]),
    classification: new FormControl('', [Validators.required]),
    description: new FormControl('', [Validators.required]),
    vendor: new FormControl(''),
    frequency: new FormControl<RecurrenceFrequency>('Monthly', [Validators.required]),
    startDate: new FormControl<Date | null>(new Date(), [Validators.required]),
    endDate: new FormControl<Date | null>(null),
    autoApprove: new FormControl(false),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    amount: 'Amount',
    category: 'Category',
    classification: 'Classification',
    description: 'Description',
    frequency: 'Frequency',
    startDate: 'Start Date',
  });

  constructor() {
    this.loadUpcoming();
    this.loadRecurring();
  }

  protected switchTab(tab: LedgerTab): void {
    this.activeTab.set(tab);
  }

  protected applyClassificationFilter(): void {
    this.loadUpcoming();
  }

  protected isHighlighted(expense: UpcomingExpense): boolean {
    const filter = this.highlightClassification();
    if (!filter) return false;
    return expense.classification.toLowerCase() === filter.toLowerCase();
  }

  protected getRowClass = (row: unknown): string => {
    const expense = row as UpcomingExpense;
    const filter = this.highlightClassification();
    if (filter && expense.classification.toLowerCase() === filter.toLowerCase()) {
      return 'row--highlighted';
    }
    return '';
  };

  protected getClassificationChipClass(classification: string): string {
    const map: Record<string, string> = {
      Subscription: 'chip--error',
      Lease: 'chip--warning',
      Insurance: 'chip--info',
      Utility: 'chip--muted',
      'Maintenance Contract': 'chip--primary',
      License: 'chip--warning',
      Membership: 'chip--success',
    };
    return `chip ${map[classification] ?? ''}`.trim();
  }

  protected openCreateDialog(): void {
    this.form.reset({
      amount: 0,
      category: '',
      classification: '',
      description: '',
      vendor: '',
      frequency: 'Monthly',
      startDate: new Date(),
      endDate: null,
      autoApprove: false,
    });
    this.showDialog.set(true);
  }

  protected closeDialog(): void {
    this.showDialog.set(false);
  }

  protected save(): void {
    if (this.form.invalid) return;

    this.saving.set(true);
    const v = this.form.getRawValue();
    this.expensesService.createRecurringExpense({
      amount: v.amount!,
      category: v.category!,
      classification: v.classification!,
      description: v.description!,
      vendor: v.vendor ?? undefined,
      frequency: v.frequency!,
      startDate: toIsoDate(v.startDate) ?? new Date().toISOString(),
      endDate: v.endDate ? (toIsoDate(v.endDate) ?? undefined) : undefined,
      autoApprove: v.autoApprove ?? false,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeDialog();
        this.loadRecurring();
        this.loadUpcoming();
        this.snackbar.success('Recurring expense created.');
      },
      error: () => this.saving.set(false),
    });
  }

  protected toggleActive(expense: RecurringExpense): void {
    this.expensesService.updateRecurringExpense(expense.id, {
      isActive: !expense.isActive,
    }).subscribe({
      next: () => {
        this.loadRecurring();
        this.loadUpcoming();
        this.snackbar.success(expense.isActive ? 'Recurring expense paused.' : 'Recurring expense activated.');
      },
    });
  }

  protected deleteRecurring(expense: RecurringExpense): void {
    this.matDialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Recurring Expense?',
        message: `This will remove "${expense.description}" from recurring expenses.`,
        confirmLabel: 'Delete',
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.expensesService.deleteRecurringExpense(expense.id).subscribe({
        next: () => {
          this.loadRecurring();
          this.loadUpcoming();
          this.snackbar.success('Recurring expense deleted.');
        },
      });
    });
  }

  private loadUpcoming(): void {
    this.loading.set(true);
    const classification = (this.classificationValue() ?? '').trim() || undefined;
    this.expensesService.getUpcomingExpenses(90, classification).subscribe({
      next: (data) => { this.upcomingExpenses.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  private loadRecurring(): void {
    this.expensesService.getRecurringExpenses().subscribe({
      next: (data) => this.recurringExpenses.set(data),
    });
  }
}
