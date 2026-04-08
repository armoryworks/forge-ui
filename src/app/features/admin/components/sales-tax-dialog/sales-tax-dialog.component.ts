import { ChangeDetectionStrategy, Component, inject, input, output, signal, ViewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AdminService } from '../../services/admin.service';
import { SalesTaxRate } from '../../models/sales-tax-rate.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { DraftConfig } from '../../../../shared/models/draft-config.model';
import { toIsoDate } from '../../../../shared/utils/date.utils';

@Component({
  selector: 'app-sales-tax-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogComponent, InputComponent, SelectComponent, DatepickerComponent,
    ToggleComponent, TextareaComponent, ValidationPopoverDirective, TranslatePipe,
  ],
  templateUrl: './sales-tax-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesTaxDialogComponent {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;

  private readonly adminService = inject(AdminService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly rate = input<SalesTaxRate | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);

  protected readonly stateOptions: SelectOption[] = [
    { value: null, label: '-- All States / Non-state --' },
    ...['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
        'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
        'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
        'VA','WA','WV','WI','WY','DC'].map(s => ({ value: s, label: s })),
  ];

  protected draftConfig: DraftConfig = {
    entityType: 'sales-tax-rate',
    entityId: 'new',
    route: '/admin/settings',
  };

  readonly form = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.maxLength(100)]),
    code: new FormControl('', [Validators.required, Validators.maxLength(20)]),
    stateCode: new FormControl<string | null>(null),
    ratePercent: new FormControl<number | null>(null, [Validators.required, Validators.min(0), Validators.max(100)]),
    effectiveFrom: new FormControl<Date | null>(new Date()),
    isDefault: new FormControl(false),
    description: new FormControl(''),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: 'Name',
    code: 'Code',
    ratePercent: 'Rate (%)',
  });

  constructor() {
    const r = this.rate();
    if (r) {
      this.draftConfig = { ...this.draftConfig, entityId: r.id.toString() };
      this.form.patchValue({
        name: r.name,
        code: r.code,
        stateCode: r.stateCode ?? null,
        ratePercent: parseFloat((r.rate * 100).toFixed(4)),
        effectiveFrom: r.effectiveFrom ?? new Date(),
        isDefault: r.isDefault,
        description: r.description ?? '',
      });
    }
  }

  protected get isEditing(): boolean {
    return this.rate() !== null;
  }

  protected close(): void {
    this.closed.emit();
  }

  protected save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    const f = this.form.getRawValue();
    const payload = {
      name: f.name!,
      code: f.code!,
      stateCode: f.stateCode || null,
      rate: (f.ratePercent ?? 0) / 100,
      effectiveFrom: f.effectiveFrom ? toIsoDate(f.effectiveFrom) : null,
      isDefault: f.isDefault ?? false,
      description: f.description || null,
    };

    const r = this.rate();
    const call = r
      ? this.adminService.updateSalesTaxRate(r.id, payload)
      : this.adminService.createSalesTaxRate(payload);

    call.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.clearDraft();
        this.snackbar.success(this.translate.instant(r ? 'salesTax.updated' : 'salesTax.created'));
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
