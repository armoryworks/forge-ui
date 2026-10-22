import { AfterViewInit, ChangeDetectionStrategy, Component, inject, input, OnInit, output, signal, ViewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PurchasingService } from '../../services/purchasing.service';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { fromIsoDate, toIsoDate } from '../../../../shared/utils/date.utils';
import { CreateRfqRequest, RfqListItem } from '../../models/rfq.model';

@Component({
  selector: 'app-rfq-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, InputComponent, EntityPickerComponent, TextareaComponent,
    DatepickerComponent, ValidationButtonComponent,
  ],
  templateUrl: './rfq-dialog.component.html',
  styleUrl: './rfq-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RfqDialogComponent implements OnInit, AfterViewInit {
  @ViewChild(EntityPickerComponent) private partPicker?: EntityPickerComponent;
  private readonly purchasingService = inject(PurchasingService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly rfq = input<RfqListItem | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);
  protected readonly partFilters: Record<string, string> = { isActive: 'true' };

  readonly form = new FormGroup({
    partId: new FormControl<number | null>(null, [Validators.required]),
    quantity: new FormControl<number | null>(null, [Validators.required, Validators.min(1)]),
    requiredDate: new FormControl<Date | null>(null, [Validators.required]),
    description: new FormControl(''),
    specialInstructions: new FormControl(''),
    responseDeadline: new FormControl<Date | null>(null),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    partId: this.translate.instant('purchasing.part'),
    quantity: this.translate.instant('purchasing.quantity'),
    requiredDate: this.translate.instant('purchasing.requiredDate'),
    description: this.translate.instant('purchasing.description'),
    specialInstructions: this.translate.instant('purchasing.specialInstructions'),
    responseDeadline: this.translate.instant('purchasing.responseDeadline'),
  });

  ngOnInit(): void {
    const existing = this.rfq();
    if (existing) {
      this.form.patchValue({
        partId: existing.partId,
        quantity: existing.quantity,
        requiredDate: fromIsoDate(existing.requiredDate),
        description: existing.description ?? '',
        specialInstructions: existing.specialInstructions ?? '',
        responseDeadline: fromIsoDate(existing.responseDeadline),
      });
    }
  }

  ngAfterViewInit(): void {
    const existing = this.rfq();
    if (existing) this.partPicker?.setSelected(existing.partId, existing.partNumber);
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
        this.snackbar.success(this.translate.instant(existing ? 'purchasing.snackbar.rfqUpdated' : 'purchasing.snackbar.rfqCreated'));
        this.saving.set(false);
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
