import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { SubcontractOrder } from '../../models/subcontract-order.model';
import { SubcontractReceiveBackDialogData } from '../../models/subcontract-receive-back-dialog-data.model';
import { SubcontractService } from '../../services/subcontract.service';

@Component({
  selector: 'app-subcontract-receive-back-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, DecimalPipe, TranslatePipe, DialogComponent, InputComponent, ValidationButtonComponent],
  templateUrl: './subcontract-receive-back-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubcontractReceiveBackDialogComponent {
  readonly matDialogRef = inject(MatDialogRef<SubcontractReceiveBackDialogComponent, SubcontractOrder>);
  readonly data = inject<SubcontractReceiveBackDialogData>(MAT_DIALOG_DATA);
  private readonly subcontractService = inject(SubcontractService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly saving = signal(false);

  readonly formGroup = new FormGroup({
    goodQuantity: new FormControl<number | null>(this.data.order.quantity, [Validators.required, Validators.min(0), this.somethingBack()]),
    scrapQuantity: new FormControl<number | null>(0, [Validators.required, Validators.min(0)]),
  });

  readonly violations = FormValidationService.getViolations(this.formGroup, {
    goodQuantity: this.translate.instant('subcontractUi.goodQuantity'),
    scrapQuantity: this.translate.instant('subcontractUi.scrapQuantity'),
  });

  constructor() {
    this.formGroup.controls.scrapQuantity.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.formGroup.controls.goodQuantity.updateValueAndValidity());
  }

  save(): void {
    if (this.formGroup.invalid || this.saving()) return;

    this.saving.set(true);
    const good = this.formGroup.controls.goodQuantity.value ?? 0;
    const scrap = this.formGroup.controls.scrapQuantity.value ?? 0;
    this.subcontractService.receiveBack(this.data.order.id, {
      receivedQuantity: good,
      scrapQuantity: scrap,
      passedInspection: good > 0,
    }).subscribe({
      next: (order) => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('subcontractUi.received', { vendor: order.vendorName }));
        this.matDialogRef.close(order);
      },
      error: () => this.saving.set(false),
    });
  }

  private somethingBack(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const good = Number(control.value ?? 0);
      const scrap = Number(control.parent?.get('scrapQuantity')?.value ?? 0);
      return good + scrap > 0
        ? null
        : { nothingBack: { message: this.translate.instant('subcontractUi.nothingBack') } };
    };
  }
}
