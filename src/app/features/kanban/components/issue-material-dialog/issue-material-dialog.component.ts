import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { PartBinLocation } from '../../../inventory/models/part-bin-location.model';
import { InventoryService } from '../../../inventory/services/inventory.service';
import { IssuableMaterial } from '../../models/issuable-material.model';
import { IssueMaterialDialogData } from '../../models/issue-material-dialog-data.model';
import { MaterialIssue } from '../../models/job-cost.model';
import { JobCostService } from '../../services/job-cost.service';

@Component({
  selector: 'app-issue-material-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, SelectComponent, ValidationButtonComponent],
  templateUrl: './issue-material-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssueMaterialDialogComponent {
  readonly matDialogRef = inject(MatDialogRef<IssueMaterialDialogComponent, MaterialIssue>);
  readonly data = inject<IssueMaterialDialogData>(MAT_DIALOG_DATA);
  private readonly costService = inject(JobCostService);
  private readonly inventoryService = inject(InventoryService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly saving = signal(false);
  protected readonly loaded = signal(false);
  readonly materials = signal<IssuableMaterial[]>([]);
  readonly bins = signal<PartBinLocation[]>([]);

  readonly partOptions = computed<SelectOption[]>(() => this.materials().map(m => ({
    value: m.partId,
    label: m.alternateForPartNumber
      ? this.translate.instant('jobCostTab.alternateOption', {
        part: m.partNumber, primary: m.alternateForPartNumber, required: m.requiredQuantity, issued: m.issuedQuantity,
      })
      : this.translate.instant('jobCostTab.partOption', {
        part: m.partNumber, required: m.requiredQuantity, issued: m.issuedQuantity,
      }),
  })));

  readonly binOptions = computed<SelectOption[]>(() => this.issuableBins().map(b => ({
    value: b.binContentId,
    label: b.lotNumber
      ? this.translate.instant('jobCostTab.binOption', { location: b.locationPath, lot: b.lotNumber, available: b.availableQuantity })
      : this.translate.instant('jobCostTab.binOptionNoLot', { location: b.locationPath, available: b.availableQuantity }),
  })));

  readonly formGroup = new FormGroup({
    partId: new FormControl<number | null>(null, [Validators.required]),
    binContentId: new FormControl<number | null>(null, [Validators.required]),
    quantity: new FormControl<number | null>(null, [Validators.required, Validators.min(0.0001), this.withinBin()]),
  });

  readonly violations = FormValidationService.getViolations(this.formGroup, {
    partId: this.translate.instant('jobCostTab.part'),
    binContentId: this.translate.instant('jobCostTab.bin'),
    quantity: this.translate.instant('jobCostTab.quantity'),
  });

  constructor() {
    this.costService.getIssuableMaterials(this.data.jobId)
      .pipe(catchError(() => of<IssuableMaterial[]>([])), takeUntilDestroyed(this.destroyRef))
      .subscribe(materials => {
        this.materials.set(materials);
        this.loaded.set(true);
      });

    this.formGroup.controls.partId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(partId => this.loadBins(partId));
    this.formGroup.controls.binContentId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.formGroup.controls.quantity.updateValueAndValidity());
  }

  issuableBins(): PartBinLocation[] {
    return this.bins().filter(b => b.status !== 'QcHold' && b.availableQuantity > 0);
  }

  save(): void {
    if (this.formGroup.invalid || this.saving()) return;

    this.saving.set(true);
    const raw = this.formGroup.getRawValue();
    this.costService.issueMaterial(this.data.jobId, {
      partId: raw.partId!,
      quantity: raw.quantity!,
      binContentId: raw.binContentId!,
      issueType: 'Issue',
    }).subscribe({
      next: (issue) => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('jobCostTab.issued', { quantity: issue.quantity, part: issue.partNumber }));
        this.matDialogRef.close(issue);
      },
      error: () => this.saving.set(false),
    });
  }

  private loadBins(partId: number | null): void {
    this.bins.set([]);
    this.formGroup.controls.binContentId.setValue(null);
    if (partId == null) return;
    this.inventoryService.getPartBins(partId)
      .pipe(catchError(() => of<PartBinLocation[]>([])), takeUntilDestroyed(this.destroyRef))
      .subscribe(bins => {
        this.bins.set(bins);
        const usable = this.issuableBins();
        if (usable.length === 1) this.formGroup.controls.binContentId.setValue(usable[0].binContentId);
      });
  }

  private withinBin(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const binId = control.parent?.get('binContentId')?.value as number | null | undefined;
      const quantity = control.value as number | null;
      const bin = this.bins().find(b => b.binContentId === binId);
      if (bin == null || quantity == null) return null;
      return quantity > bin.availableQuantity ? { max: { max: bin.availableQuantity, actual: quantity } } : null;
    };
  }
}
