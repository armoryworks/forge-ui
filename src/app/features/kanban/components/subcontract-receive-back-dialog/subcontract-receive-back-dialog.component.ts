import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ToleranceBandComponent } from '../../../../shared/components/tolerance-band/tolerance-band.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { TOLERANCE_OVERRIDE_ROLES } from '../../../../shared/models/tolerance-override-roles.const';
import { AuthService } from '../../../../shared/services/auth.service';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { roomWithinTolerance } from '../../../../shared/utils/quantity-tolerance';
import { SubcontractOrder } from '../../models/subcontract-order.model';
import { SubcontractReceiveBackDialogData } from '../../models/subcontract-receive-back-dialog-data.model';
import { SubcontractService } from '../../services/subcontract.service';

type ReceiveBackOutcome = 'over' | 'closesWithin' | 'staysOpen' | null;

@Component({
  selector: 'app-subcontract-receive-back-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, DecimalPipe, TranslatePipe, DialogComponent, InputComponent, ToggleComponent,
    ToleranceBandComponent, ValidationButtonComponent,
  ],
  templateUrl: './subcontract-receive-back-dialog.component.html',
  styleUrl: './subcontract-receive-back-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubcontractReceiveBackDialogComponent {
  readonly matDialogRef = inject(MatDialogRef<SubcontractReceiveBackDialogComponent, SubcontractOrder>);
  readonly data = inject<SubcontractReceiveBackDialogData>(MAT_DIALOG_DATA);
  private readonly subcontractService = inject(SubcontractService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly saving = signal(false);
  protected readonly canOverrideTolerance = this.auth.hasAnyRole([...TOLERANCE_OVERRIDE_ROLES]);
  protected readonly returnedBefore = (this.data.order.receivedQuantity ?? 0) + (this.data.order.scrapQuantity ?? 0);
  protected readonly maxAccepted = this.data.order.maxAcceptedQuantity ?? this.data.order.quantity;
  protected readonly minComplete = this.data.order.minCompleteQuantity ?? this.data.order.quantity;
  protected readonly room = roomWithinTolerance(this.maxAccepted, this.returnedBefore);

  readonly formGroup = new FormGroup({
    goodQuantity: new FormControl<number | null>(Math.max(0, this.data.order.quantity - this.returnedBefore),
      [Validators.required, Validators.min(0), this.somethingBack()]),
    scrapQuantity: new FormControl<number | null>(0, [Validators.required, Validators.min(0)]),
    overReason: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    closeShort: new FormControl<boolean>(false, { nonNullable: true }),
  }, { validators: this.overToleranceAccepted() });

  private readonly formValue = toSignal(this.formGroup.valueChanges, { initialValue: this.formGroup.getRawValue() });

  protected readonly returnedTotal = computed(() => {
    const value = this.formValue();
    return this.returnedBefore + Number(value.goodQuantity ?? 0) + Number(value.scrapQuantity ?? 0);
  });

  protected readonly outcome = computed<ReceiveBackOutcome>(() => {
    const total = this.returnedTotal();
    if (total <= this.returnedBefore) return null;
    if (total > this.maxAccepted) return 'over';
    if (total < this.minComplete) return 'staysOpen';
    return total < this.data.order.quantity ? 'closesWithin' : null;
  });

  readonly violations = FormValidationService.getViolations(this.formGroup, {
    goodQuantity: this.translate.instant('subcontractUi.goodQuantity'),
    scrapQuantity: this.translate.instant('subcontractUi.scrapQuantity'),
    overReason: this.translate.instant('tolerance.overReason'),
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
    const outcome = this.outcome();
    const reason = this.formGroup.controls.overReason.value.trim();
    this.subcontractService.receiveBack(this.data.order.id, {
      receivedQuantity: good,
      scrapQuantity: scrap,
      passedInspection: good > 0,
      ...(outcome === 'over' ? { confirmOverTolerance: true, overToleranceReason: reason } : {}),
      ...(outcome === 'staysOpen' && this.formGroup.controls.closeShort.value ? { closeShort: true } : {}),
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
      return good + scrap <= 0
        ? { nothingBack: { message: this.translate.instant('subcontractUi.nothingBack') } }
        : null;
    };
  }

  private overToleranceAccepted(): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      const good = Number(group.get('goodQuantity')?.value ?? 0);
      const scrap = Number(group.get('scrapQuantity')?.value ?? 0);
      if (this.returnedBefore + good + scrap <= this.maxAccepted) return null;
      const reason = String(group.get('overReason')?.value ?? '').trim();
      if (this.canOverrideTolerance && reason) return null;
      return {
        overTolerance: {
          message: this.translate.instant(this.canOverrideTolerance ? 'tolerance.reasonRequired' : 'tolerance.overNeedsManager',
            { quantity: good + scrap, room: this.room }),
        },
      };
    };
  }
}
