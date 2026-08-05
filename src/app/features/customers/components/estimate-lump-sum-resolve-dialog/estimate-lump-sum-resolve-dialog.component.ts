import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormArray, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';

import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';

import { QuoteService } from '../../../quotes/services/quote.service';
import { EstimateLine, EstimateLineResolution, EstimateLineResolutionAction } from '../../models/estimate.model';

export interface EstimateLumpSumResolveDialogData {
  /** Owning customer — used to resolve price-list prices for replacement parts. */
  customerId: number;
  estimateTitle: string;
  /** The estimate's lump-sum lines (partId == null) needing a decision. */
  lumpSumLines: EstimateLine[];
  /** Count of the estimate's catalog-part lines (they carry over untouched). */
  otherLineCount: number;
}

interface ResolutionForm {
  action: FormControl<EstimateLineResolutionAction | null>;
  partId: FormControl<number | null>;
  unitPrice: FormControl<number | null>;
}

/**
 * #24: shown before converting an estimate that has lump-sum lines
 * (partId == null) to a quote. The user must decide, per line, whether to
 * eliminate it or replace it with a real catalog part (price prefilled from
 * the customer's price list via the shared resolvePrice endpoint, editable).
 * Resolves with the `EstimateLineResolution[]` payload on confirm, or null
 * on cancel (the caller aborts the convert).
 */
@Component({
  selector: 'app-estimate-lump-sum-resolve-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    CurrencyDisplayComponent, CurrencyInputComponent, DialogComponent,
    EntityPickerComponent, SelectComponent, ValidationButtonComponent,
  ],
  templateUrl: './estimate-lump-sum-resolve-dialog.component.html',
  styleUrl: './estimate-lump-sum-resolve-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstimateLumpSumResolveDialogComponent {
  private readonly quoteService = inject(QuoteService);
  private readonly translate = inject(TranslateService);
  private readonly dialogRef = inject(MatDialogRef<EstimateLumpSumResolveDialogComponent, EstimateLineResolution[] | null>);
  protected readonly data = inject<EstimateLumpSumResolveDialogData>(MAT_DIALOG_DATA);

  /** Bumped on every form change so computed() signals re-derive from form state. */
  private readonly formTick = signal(0);

  protected readonly actionOptions: SelectOption[] = [
    { value: 'Eliminate', label: this.translate.instant('customers.estimates.resolveLumpSum.eliminate') },
    { value: 'ReplaceWithPart', label: this.translate.instant('customers.estimates.resolveLumpSum.replaceWithPart') },
  ];

  protected readonly intro = this.translate.instant(
    'customers.estimates.resolveLumpSum.intro',
    { count: this.data.lumpSumLines.length, title: this.data.estimateTitle },
  );

  // One group per lump-sum line. The action is a required, explicit choice —
  // no default — so the user consciously decides each line's fate. Unit price
  // starts at the line's lump-sum amount and is overwritten by the resolved
  // price-list price when a part is picked (still editable after).
  protected readonly resolutions = new FormArray<FormGroup<ResolutionForm>>(
    this.data.lumpSumLines.map(line => new FormGroup<ResolutionForm>(
      {
        action: new FormControl<EstimateLineResolutionAction | null>(null, [Validators.required]),
        partId: new FormControl<number | null>(null),
        unitPrice: new FormControl<number | null>(line.unitPrice, [Validators.min(0)]),
      },
      { validators: [EstimateLumpSumResolveDialogComponent.replaceRequiresPart] },
    )),
    { validators: [control => this.keepAtLeastOneLine(control)] },
  );

  protected readonly form = new FormGroup({ resolutions: this.resolutions });

  constructor() {
    this.form.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.formTick.update(v => v + 1));
  }

  /** Per-line flag driving the part-picker / price section visibility. */
  protected readonly replaceFlags = computed(() => {
    this.formTick();
    return this.resolutions.controls.map(g => g.controls.action.value === 'ReplaceWithPart');
  });

  protected readonly violations = computed(() => {
    this.formTick();
    const messages: string[] = [];
    this.resolutions.controls.forEach((group, i) => {
      const description = this.data.lumpSumLines[i]?.description ?? '';
      if (group.controls.action.value === null) {
        messages.push(this.translate.instant('customers.estimates.resolveLumpSum.chooseActionViolation', { description }));
      } else if (group.hasError('partRequired')) {
        messages.push(this.translate.instant('customers.estimates.resolveLumpSum.partRequiredViolation', { description }));
      }
    });
    if (this.resolutions.hasError('allEliminated')) {
      messages.push(this.translate.instant('customers.estimates.resolveLumpSum.keepOneLineViolation'));
    }
    return messages;
  });

  protected readonly saving = signal(false);

  /** ReplaceWithPart needs a part picked — surfaced as a group-level error. */
  private static replaceRequiresPart(group: AbstractControl): ValidationErrors | null {
    const action = group.get('action')?.value as EstimateLineResolutionAction | null;
    const partId = group.get('partId')?.value as number | null;
    return action === 'ReplaceWithPart' && !partId ? { partRequired: true } : null;
  }

  /**
   * Eliminating every lump-sum line on an estimate with no catalog-part lines
   * would convert into an empty quote — the server rejects it, so block here.
   */
  private keepAtLeastOneLine(control: AbstractControl): ValidationErrors | null {
    if (this.data.otherLineCount > 0) return null;
    const groups = (control as FormArray<FormGroup<ResolutionForm>>).controls;
    const allEliminated = groups.length > 0 && groups.every(g => g.controls.action.value === 'Eliminate');
    return allEliminated ? { allEliminated: true } : null;
  }

  /**
   * Prefill the replacement line's unit price from the customer's resolved
   * price-list price (same resolver the quote dialog and estimates tab use).
   * The price stays editable — a manual edit afterwards simply wins.
   */
  protected onPartSelected(index: number, part: Record<string, unknown> | null): void {
    if (!part) return;
    const partId = part['id'] as number | undefined;
    if (!partId) return;
    this.quoteService.resolvePrice(this.data.customerId, partId).subscribe({
      next: price => {
        if (price != null && price > 0) {
          this.resolutions.at(index).controls.unitPrice.setValue(price);
        }
      },
    });
  }

  protected close(): void {
    this.dialogRef.close(null);
  }

  protected confirm(): void {
    if (this.form.invalid) return;
    const resolutions: EstimateLineResolution[] = this.data.lumpSumLines.map((line, i) => {
      const value = this.resolutions.at(i).getRawValue();
      return value.action === 'ReplaceWithPart'
        ? {
            estimateLineId: line.id,
            action: 'ReplaceWithPart',
            partId: value.partId ?? undefined,
            unitPrice: value.unitPrice ?? undefined,
          }
        : { estimateLineId: line.id, action: 'Eliminate' };
    });
    this.dialogRef.close(resolutions);
  }
}
