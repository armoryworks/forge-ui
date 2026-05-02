import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../../../shared/components/datepicker/datepicker.component';
import { ToggleComponent } from '../../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';
import { toIsoDate } from '../../../../../shared/utils/date.utils';

import { PriceListsService } from '../../../services/price-lists.service';
import {
  CreatePriceListRequest,
  PriceList,
  UpdatePriceListRequest,
} from '../../../models/price-list.model';

export interface PriceListFormDialogData {
  /** Null = create mode; populated = edit mode. */
  priceList: PriceList | null;
  /**
   * When set, the new list scopes to that customer. Ignored on edit (a
   * list's scope is fixed at creation time — see UpdatePriceListRequestModel
   * server doc-comment for rationale).
   */
  customerId: number | null;
}

/**
 * Parent CRUD dialog for `PriceList`. Pairs with the entries dialog
 * (`PriceListEntryFormDialogComponent`) — together they own all
 * pricing-tab CRUD on the Customer detail page.
 *
 * On create: every field editable; CustomerId is set from `data.customerId`
 * (not surfaced in the form — it's set by context).
 * On edit: same field set; CustomerId is locked at creation time and not
 * modified on save.
 */
@Component({
  selector: 'app-price-list-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, InputComponent, TextareaComponent,
    DatepickerComponent, ToggleComponent, ValidationButtonComponent,
  ],
  templateUrl: './price-list-form-dialog.component.html',
  styleUrl: './price-list-form-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceListFormDialogComponent {
  private readonly priceListsService = inject(PriceListsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialogRef = inject(MatDialogRef<PriceListFormDialogComponent, PriceList | null>);
  protected readonly data = inject<PriceListFormDialogData>(MAT_DIALOG_DATA);

  protected readonly saving = signal(false);
  protected readonly isEdit = !!this.data.priceList;

  protected readonly title = computed(() =>
    this.isEdit
      ? this.translate.instant('priceList.dialogTitleEdit')
      : this.translate.instant('priceList.dialogTitleCreate'),
  );

  protected readonly submitLabel = computed(() =>
    this.isEdit
      ? this.translate.instant('priceList.save')
      : this.translate.instant('priceList.create'),
  );

  protected readonly form = new FormGroup({
    name: new FormControl<string>(
      this.data.priceList?.name ?? '',
      { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] },
    ),
    description: new FormControl<string | null>(
      this.data.priceList?.description ?? '',
      [Validators.maxLength(500)],
    ),
    effectiveFrom: new FormControl<Date | string | null>(
      this.data.priceList?.effectiveFrom ?? null,
    ),
    effectiveTo: new FormControl<Date | string | null>(
      this.data.priceList?.effectiveTo ?? null,
    ),
    isDefault: new FormControl<boolean>(
      this.data.priceList?.isDefault ?? false,
      { nonNullable: true },
    ),
    isActive: new FormControl<boolean>(
      this.data.priceList?.isActive ?? true,
      { nonNullable: true },
    ),
  }, { validators: [PriceListFormDialogComponent.dateRangeValidator] });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: this.translate.instant('priceList.nameLabel'),
    description: this.translate.instant('priceList.descriptionLabel'),
    effectiveFrom: this.translate.instant('priceList.effectiveFromLabel'),
    effectiveTo: this.translate.instant('priceList.effectiveToLabel'),
    isDefault: this.translate.instant('priceList.isDefaultLabel'),
    isActive: this.translate.instant('priceList.isActiveLabel'),
  });

  /** Cross-field validator: EffectiveTo must be > EffectiveFrom when both set. */
  static dateRangeValidator(control: AbstractControl): ValidationErrors | null {
    const fromCtrl = control.get('effectiveFrom');
    const toCtrl = control.get('effectiveTo');
    const from = fromCtrl?.value ? new Date(fromCtrl.value) : null;
    const to = toCtrl?.value ? new Date(toCtrl.value) : null;
    if (from && to && to <= from) {
      return { effectiveRange: true };
    }
    return null;
  }

  close(): void {
    this.dialogRef.close(null);
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    const description = v.description ? v.description : null;
    const effectiveFrom = v.effectiveFrom ? toIsoDate(v.effectiveFrom) : null;
    const effectiveTo = v.effectiveTo ? toIsoDate(v.effectiveTo) : null;

    if (this.isEdit && this.data.priceList) {
      const body: UpdatePriceListRequest = {
        name: v.name,
        description,
        isDefault: v.isDefault,
        isActive: v.isActive,
        effectiveFrom,
        effectiveTo,
      };
      this.priceListsService.update(this.data.priceList.id, body).subscribe({
        next: result => {
          this.saving.set(false);
          this.snackbar.success(this.translate.instant('priceList.savedSuccess'));
          this.dialogRef.close(result);
        },
        error: () => this.saving.set(false),
      });
    } else {
      const body: CreatePriceListRequest = {
        name: v.name,
        description,
        customerId: this.data.customerId,
        isDefault: v.isDefault,
        isActive: v.isActive,
        effectiveFrom,
        effectiveTo,
      };
      this.priceListsService.create(body).subscribe({
        next: result => {
          this.saving.set(false);
          this.snackbar.success(this.translate.instant('priceList.createdSuccess'));
          this.dialogRef.close(result);
        },
        error: () => this.saving.set(false),
      });
    }
  }
}
