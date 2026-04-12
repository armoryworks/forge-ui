import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';

import { PurchasingService } from '../../services/purchasing.service';
import { PartsService } from '../../../parts/services/parts.service';
import { PartListItem } from '../../../parts/models/part-list-item.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';
import { CreateRfqRequest, RfqListItem } from '../../models/rfq.model';

@Component({
  selector: 'app-rfq-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogComponent, InputComponent, SelectComponent, TextareaComponent,
    DatepickerComponent, ValidationPopoverDirective,
  ],
  templateUrl: './rfq-dialog.component.html',
  styleUrl: './rfq-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RfqDialogComponent {
  private readonly purchasingService = inject(PurchasingService);
  private readonly partsService = inject(PartsService);
  private readonly snackbar = inject(SnackbarService);

  readonly rfq = input<RfqListItem | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);
  protected readonly parts = signal<PartListItem[]>([]);

  protected readonly partOptions = signal<SelectOption[]>([]);

  readonly form = new FormGroup({
    partId: new FormControl<number | null>(null, [Validators.required]),
    quantity: new FormControl<number | null>(null, [Validators.required, Validators.min(1)]),
    requiredDate: new FormControl<Date | null>(null, [Validators.required]),
    description: new FormControl(''),
    specialInstructions: new FormControl(''),
    responseDeadline: new FormControl<Date | null>(null),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    partId: 'Part',
    quantity: 'Quantity',
    requiredDate: 'Required Date',
    description: 'Description',
    specialInstructions: 'Special Instructions',
    responseDeadline: 'Response Deadline',
  });

  constructor() {
    this.partsService.getParts().subscribe({
      next: (list) => {
        this.parts.set(list);
        this.partOptions.set([
          { value: null, label: '-- Select Part --' },
          ...list.map(p => ({ value: p.id, label: `${p.partNumber} — ${p.description}` })),
        ]);
      },
    });

    const existing = this.rfq();
    if (existing) {
      this.form.patchValue({
        partId: existing.partId,
        quantity: existing.quantity,
        requiredDate: existing.requiredDate ? new Date(existing.requiredDate) : null,
        description: existing.description ?? '',
        specialInstructions: existing.specialInstructions ?? '',
        responseDeadline: existing.responseDeadline ? new Date(existing.responseDeadline) : null,
      });
    }
  }

  protected get isEdit(): boolean {
    return this.rfq() !== null;
  }

  protected close(): void {
    this.closed.emit();
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    const val = this.form.getRawValue();
    const request: CreateRfqRequest = {
      partId: val.partId!,
      quantity: val.quantity!,
      requiredDate: toIsoDate(val.requiredDate!)!,
      description: val.description || undefined,
      specialInstructions: val.specialInstructions || undefined,
      responseDeadline: val.responseDeadline ? toIsoDate(val.responseDeadline)! : undefined,
    };

    const existing = this.rfq();
    const obs$ = existing
      ? this.purchasingService.updateRfq(existing.id, request)
      : this.purchasingService.createRfq(request).pipe(map(() => void 0));

    obs$.subscribe({
      next: () => {
        this.snackbar.success(existing ? 'RFQ updated' : 'RFQ created');
        this.saving.set(false);
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
