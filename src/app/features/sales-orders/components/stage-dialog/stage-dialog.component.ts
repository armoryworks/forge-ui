import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { fromIsoDate, toIsoDate } from '../../../../shared/utils/date.utils';
import { SalesOrderService } from '../../services/sales-order.service';
import { SalesOrderStage } from '../../models/sales-order-stage.model';

/** Adds a stage to a staged schedule, or edits one: name, sequence, planned dates and notes. */
@Component({
  selector: 'app-stage-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DatepickerComponent, DialogComponent, InputComponent, TextareaComponent, ValidationButtonComponent],
  templateUrl: './stage-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StageDialogComponent implements OnInit {
  private readonly soService = inject(SalesOrderService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);

  readonly salesOrderId = input.required<number>();
  readonly stage = input<SalesOrderStage | null>(null);
  readonly nextSequence = input(1);

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);
  protected readonly isEdit = computed(() => this.stage() !== null);
  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    sequence: new FormControl<number | null>(1, [Validators.required, Validators.min(1)]),
    plannedProductionComplete: new FormControl<Date | null>(null),
    plannedShipDate: new FormControl<Date | null>(null),
    notes: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
  });
  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: this.translate.instant('salesOrderEngines.stages.name'),
    sequence: this.translate.instant('salesOrderEngines.stages.sequence'),
    notes: this.translate.instant('common.notes'),
  });

  ngOnInit(): void {
    const stage = this.stage();
    this.form.reset({
      name: stage?.name ?? '',
      sequence: stage?.sequence ?? this.nextSequence(),
      plannedProductionComplete: fromIsoDate(stage?.plannedProductionComplete ?? null),
      plannedShipDate: fromIsoDate(stage?.plannedShipDate ?? null),
      notes: stage?.notes ?? '',
    });
  }

  protected close(): void {
    this.closed.emit();
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const stage = this.stage();
    const body = {
      name: v.name.trim(),
      sequence: v.sequence ?? 1,
      plannedProductionComplete: toIsoDate(v.plannedProductionComplete),
      plannedShipDate: toIsoDate(v.plannedShipDate),
      notes: v.notes.trim() || null,
      paymentMilestoneId: stage?.paymentMilestoneId ?? null,
    };
    this.saving.set(true);
    const request = stage ? this.soService.updateStage(stage.id, body) : this.soService.createStage(this.salesOrderId(), body);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('salesOrderEngines.stages.saved', { name: body.name }));
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
