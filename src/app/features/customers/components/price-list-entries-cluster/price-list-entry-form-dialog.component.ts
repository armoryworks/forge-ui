import { ChangeDetectionStrategy, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CurrencyService } from '../../../../shared/services/currency.service';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent } from '../../../../shared/components/select/select.component';
import { CURRENCY_OPTIONS } from '../../../../shared/models/currency.const';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

import { PriceListsService } from '../../services/price-lists.service';
import { PriceListEntry } from '../../models/price-list.model';
import { PartQuickCreateDialogComponent, PartQuickCreateDialogData } from '../../../parts/components/part-quick-create-dialog/part-quick-create-dialog.component';
import { PartDetail } from '../../../parts/models/part-detail.model';

export interface PriceListEntryFormDialogData {
  /** Null = create mode; populated = edit mode (PartId locked). */
  entry: PriceListEntry | null;
  /** Parent list id — required for the create POST. */
  priceListId: number;
}

/**
 * Pattern B form dialog (per `phase-4-output/pricelist-entry-edit-ux.md` §4.4).
 * Mirrors `<app-vendor-part-form-dialog>` because the data shape is the same
 * (child catalog row, currency + tier + notes).
 *
 * On create: Part picker is shown.
 * On edit: Part is rendered as a locked chip — entry id is keyed off
 *   (PriceListId, PartId, MinQuantity), so reassigning the part means
 *   delete + recreate (server enforces this; UI surfaces it visually).
 */
@Component({
  selector: 'app-price-list-entry-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, CurrencyInputComponent, InputComponent, SelectComponent,
    TextareaComponent, EntityPickerComponent, ValidationButtonComponent,
  ],
  templateUrl: './price-list-entry-form-dialog.component.html',
  styleUrl: './price-list-entry-form-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceListEntryFormDialogComponent {
  private readonly priceListsService = inject(PriceListsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly currencyService = inject(CurrencyService);
  private readonly matDialog = inject(MatDialog);
  private readonly dialogRef = inject(MatDialogRef<PriceListEntryFormDialogComponent, PriceListEntry | null>);
  protected readonly data = inject<PriceListEntryFormDialogData>(MAT_DIALOG_DATA);

  /** Picker ref so the inline-create round-trip can call setSelected(). */
  @ViewChild('partPicker') protected partPicker?: EntityPickerComponent;

  protected readonly saving = signal(false);
  protected readonly isEdit = !!this.data.entry;

  protected readonly currencyOptions = CURRENCY_OPTIONS;

  protected readonly title = computed(() =>
    this.isEdit
      ? this.translate.instant('priceListEntry.dialogTitleEdit')
      : this.translate.instant('priceListEntry.dialogTitleCreate'),
  );

  protected readonly form = new FormGroup({
    partId: new FormControl<number | null>(
      this.data.entry?.partId ?? null,
      this.isEdit ? [] : [Validators.required],
    ),
    unitPrice: new FormControl<number | null>(
      this.data.entry?.unitPrice ?? null,
      [Validators.required, Validators.min(0)],
    ),
    minQuantity: new FormControl<number | null>(
      this.data.entry?.minQuantity ?? 1,
      [Validators.required, Validators.min(1)],
    ),
    currency: new FormControl<string>(
      this.data.entry?.currency ?? this.currencyService.baseCurrency() ?? 'USD',
      { nonNullable: true, validators: [Validators.required] },
    ),
    notes: new FormControl<string | null>(
      this.data.entry?.notes ?? '',
      [Validators.maxLength(2000)],
    ),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    partId: this.translate.instant('priceListEntry.partLabel'),
    unitPrice: this.translate.instant('priceListEntry.unitPriceLabel'),
    minQuantity: this.translate.instant('priceListEntry.minQuantityLabel'),
    currency: this.translate.instant('priceListEntry.currencyLabel'),
    notes: this.translate.instant('priceListEntry.notesLabel'),
  });

  close(): void {
    this.dialogRef.close(null);
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const v = this.form.getRawValue();

    if (this.isEdit && this.data.entry) {
      this.priceListsService.updateEntry(this.data.entry.id, {
        unitPrice: v.unitPrice!,
        minQuantity: v.minQuantity!,
        currency: v.currency,
        notes: v.notes ? v.notes : null,
      }).subscribe({
        next: result => {
          this.saving.set(false);
          this.snackbar.success('Price entry updated');
          this.dialogRef.close(result);
        },
        error: () => this.saving.set(false),
      });
    } else {
      this.priceListsService.createEntry(this.data.priceListId, {
        partId: v.partId!,
        unitPrice: v.unitPrice!,
        minQuantity: v.minQuantity!,
        currency: v.currency,
        notes: v.notes ? v.notes : null,
      }).subscribe({
        next: result => {
          this.saving.set(false);
          this.snackbar.success('Price entry added');
          this.dialogRef.close(result);
        },
        error: () => this.saving.set(false),
      });
    }
  }

  /**
   * Inline-create handler — opens PartQuickCreateDialog pre-filled with
   * the typed term, lands the new part as Draft (Buy default since price
   * lists are sell-side: a customer-facing price list typically prices
   * finished goods or stock, but Buy is the safest default and the user
   * can flip it).
   */
  protected onCreateNewPart(typedTerm: string): void {
    this.matDialog.open<PartQuickCreateDialogComponent, PartQuickCreateDialogData, PartDetail | null>(
      PartQuickCreateDialogComponent,
      { width: '480px', data: { initialName: typedTerm, defaultProcurementSource: 'Buy' } },
    ).afterClosed().subscribe((created) => {
      if (!created) return;
      this.form.controls.partId.setValue(created.id);
      this.partPicker?.setSelected(created.id, created.partNumber);
    });
  }
}
