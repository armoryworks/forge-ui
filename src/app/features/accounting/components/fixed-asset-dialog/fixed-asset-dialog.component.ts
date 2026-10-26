import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { Observable, forkJoin } from 'rxjs';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { parseDateOnly, toDateOnly } from '../../../../shared/utils/date.utils';
import { GlAccount } from '../../models/accounting.models';
import { DEPRECIATION_METHODS, DepreciationMethod } from '../../models/fixed-asset.model';
import { FixedAssetDetail } from '../../models/fixed-asset-detail.model';
import { FixedAssetInput } from '../../models/fixed-asset-input.model';
import { LinkableAsset } from '../../models/linkable-asset.model';
import { FixedAssetService } from '../../services/fixed-asset.service';
import { GeneralLedgerService } from '../../services/general-ledger.service';

export interface FixedAssetDialogData {
  bookId: number;
  detail?: FixedAssetDetail;
}

/**
 * Register a fixed asset, or edit one before its first depreciation posts: cost, salvage, life in months (or in
 * units for units-of-production, which needs the linked operational asset's shot counter), method, and the
 * asset, accumulated-depreciation and expense accounts from the postable chart of accounts. Linking an
 * operational asset is optional and pre-fills the name and acquisition cost. Closes with the saved asset.
 */
@Component({
  selector: 'app-fixed-asset-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, SelectComponent, DatepickerComponent,
    CurrencyInputComponent, ValidationButtonComponent,
  ],
  templateUrl: './fixed-asset-dialog.component.html',
  styleUrl: './fixed-asset-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FixedAssetDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<FixedAssetDialogComponent, unknown>);
  private readonly service = inject(FixedAssetService);
  private readonly gl = inject(GeneralLedgerService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly data = inject<FixedAssetDialogData>(MAT_DIALOG_DATA);

  protected readonly saving = signal(false);
  protected readonly editing = !!this.data.detail;
  private readonly accounts = signal<GlAccount[]>([]);
  private readonly linkable = signal<LinkableAsset[]>([]);

  protected readonly form = new FormGroup({
    name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    assetTag: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(50)] }),
    linkedAssetId: new FormControl<number | null>(null),
    method: new FormControl<DepreciationMethod>('StraightLine', { nonNullable: true }),
    cost: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    salvageValue: new FormControl<number | null>(0, [Validators.min(0)]),
    inServiceDate: new FormControl<Date | null>(null, [Validators.required]),
    usefulLifeMonths: new FormControl<number | null>(null, [Validators.required, Validators.min(1)]),
    usefulLifeUnits: new FormControl<number | null>(null, [Validators.min(1)]),
    assetGlAccountId: new FormControl<number | null>(null, [Validators.required]),
    accumulatedDepreciationGlAccountId: new FormControl<number | null>(null, [Validators.required]),
    depreciationExpenseGlAccountId: new FormControl<number | null>(null, [Validators.required]),
  });

  private readonly method = toSignal(this.form.controls.method.valueChanges, { initialValue: this.form.controls.method.value });
  protected readonly unitsBased = computed(() => this.method() === 'UnitsOfProduction');

  protected readonly methodOptions: SelectOption[] = DEPRECIATION_METHODS.map((m) => ({
    value: m,
    label: this.translate.instant(`accounting.fixedAssets.method.${m}`),
  }));

  protected readonly assetAccountOptions = computed(() => this.optionsFor('Asset'));
  protected readonly expenseAccountOptions = computed(() => this.optionsFor('Expense'));
  protected readonly linkableOptions = computed<SelectOption[]>(() => [
    { value: null, label: this.translate.instant('accounting.fixedAssets.noLink') },
    ...this.linkable()
      .filter((a) => a.linkedFixedAssetId === null || a.linkedFixedAssetId === this.data.detail?.asset.id)
      .map((a) => ({ value: a.id, label: a.serialNumber ? `${a.name} (${a.serialNumber})` : a.name })),
  ]);

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: this.translate.instant('accounting.fixedAssets.name'),
    cost: this.translate.instant('accounting.fixedAssets.cost'),
    salvageValue: this.translate.instant('accounting.fixedAssets.salvage'),
    inServiceDate: this.translate.instant('accounting.fixedAssets.inServiceDate'),
    usefulLifeMonths: this.translate.instant('accounting.fixedAssets.lifeMonths'),
    usefulLifeUnits: this.translate.instant('accounting.fixedAssets.lifeUnits'),
    assetGlAccountId: this.translate.instant('accounting.fixedAssets.assetAccount'),
    accumulatedDepreciationGlAccountId: this.translate.instant('accounting.fixedAssets.accumulatedAccount'),
    depreciationExpenseGlAccountId: this.translate.instant('accounting.fixedAssets.expenseAccount'),
    linkedAssetId: this.translate.instant('accounting.fixedAssets.linkedAsset'),
  });

  ngOnInit(): void {
    this.form.controls.method.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyMethodRules());
    this.form.controls.linkedAssetId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => this.prefillFromLinked(id));

    forkJoin({
      accounts: this.gl.getChartOfAccounts(this.data.bookId, true),
      linkable: this.service.linkableAssets(this.data.bookId),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ accounts, linkable }) => {
          this.accounts.set(accounts);
          this.linkable.set(linkable);
          this.patchFromDetail();
        },
        error: (err: unknown) => this.snackbar.errorFrom(err, 'accounting.errors.accountsLoadFailed'),
      });
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    const raw = this.form.getRawValue();
    const input: FixedAssetInput = {
      name: raw.name.trim(),
      assetTag: raw.assetTag.trim() || null,
      cost: raw.cost ?? 0,
      salvageValue: raw.salvageValue ?? 0,
      inServiceDate: toDateOnly(raw.inServiceDate) ?? '',
      usefulLifeMonths: raw.usefulLifeMonths ?? 0,
      assetGlAccountId: raw.assetGlAccountId as number,
      accumulatedDepreciationGlAccountId: raw.accumulatedDepreciationGlAccountId as number,
      depreciationExpenseGlAccountId: raw.depreciationExpenseGlAccountId as number,
      method: raw.method,
      usefulLifeUnits: raw.method === 'UnitsOfProduction' ? raw.usefulLifeUnits : null,
      linkedAssetId: raw.linkedAssetId,
    };
    const detail = this.data.detail;
    const save$: Observable<unknown> = detail
      ? this.service.update(detail.asset.id, input)
      : this.service.create({ ...input, bookId: this.data.bookId });
    this.saving.set(true);
    save$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (saved) => {
        this.snackbar.success(this.translate.instant(detail ? 'accounting.fixedAssets.updated' : 'accounting.fixedAssets.registered'));
        this.dialogRef.close(saved);
      },
      error: () => this.saving.set(false),
    });
  }

  private applyMethodRules(): void {
    const units = this.form.controls.usefulLifeUnits;
    const linked = this.form.controls.linkedAssetId;
    if (this.form.controls.method.value === 'UnitsOfProduction') {
      units.setValidators([Validators.required, Validators.min(1)]);
      linked.setValidators([Validators.required]);
    } else {
      units.setValidators([Validators.min(1)]);
      linked.clearValidators();
    }
    units.updateValueAndValidity();
    linked.updateValueAndValidity();
  }

  private prefillFromLinked(id: number | null): void {
    const asset = this.linkable().find((a) => a.id === id);
    if (!asset) return;
    if (!this.form.controls.name.value.trim()) this.form.controls.name.setValue(asset.name);
    if (this.form.controls.cost.value === null && asset.acquisitionCost !== null) {
      this.form.controls.cost.setValue(asset.acquisitionCost);
    }
  }

  private patchFromDetail(): void {
    const detail = this.data.detail;
    if (!detail) return;
    const a = detail.asset;
    this.form.patchValue({
      name: a.name,
      assetTag: a.assetTag ?? '',
      method: a.method,
      cost: a.cost,
      salvageValue: a.salvageValue,
      inServiceDate: parseDateOnly(a.inServiceDate),
      usefulLifeMonths: a.usefulLifeMonths,
      usefulLifeUnits: a.usefulLifeUnits,
      assetGlAccountId: detail.assetGlAccountId,
      accumulatedDepreciationGlAccountId: detail.accumulatedDepreciationGlAccountId,
      depreciationExpenseGlAccountId: detail.depreciationExpenseGlAccountId,
    }, { emitEvent: false });
    this.form.controls.linkedAssetId.setValue(a.linkedAssetId, { emitEvent: false });
    this.applyMethodRules();
  }

  private optionsFor(type: string): SelectOption[] {
    return this.accounts()
      .filter((a) => a.accountType === type && !a.isControlAccount)
      .map((a) => ({ value: a.id, label: `${a.accountNumber} — ${a.name}` }));
  }
}
