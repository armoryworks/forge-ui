import {
  ChangeDetectionStrategy, Component, computed, inject, signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { DecimalPipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

import { EstimateService } from '../../services/estimate.service';
import {
  EstimateRequest, EstimateResult, PricingMode,
} from '../../models/estimate-compute.model';

// ── Local row types (signal arrays — not FormArray) ───────────────────────────

interface MaterialRow {
  partId: number | null;
  qtyPerUnit: number;
  dropFactor: number;  // UI: 0-100 %, request: 0-1
  uom: string;
  unitCost: number;
}

interface OpRow {
  stepNumber: number;
  workCenterId: number | null;
  setupMinutes: number;
  runMinutesEach: number;
  runMinutesLot: number;
  scrapFactor: number;        // UI: 0-100 %, request: 0-1
  laborRatePerHour: number;
  burdenRatePerHour: number;
  isSubcontract: boolean;
  subcontractUnitCost: number;
  subcontractMinimum: number;
  materials: MaterialRow[];
  showMaterials: boolean;
}

interface NreRow {
  description: string;
  amount: number;
}

function defaultOp(stepNumber: number): OpRow {
  return {
    stepNumber,
    workCenterId: null,
    setupMinutes: 0,
    runMinutesEach: 0,
    runMinutesLot: 0,
    scrapFactor: 0,
    laborRatePerHour: 0,
    burdenRatePerHour: 0,
    isSubcontract: false,
    subcontractUnitCost: 0,
    subcontractMinimum: 0,
    materials: [],
    showMaterials: false,
  };
}

function defaultMat(): MaterialRow {
  return { partId: null, qtyPerUnit: 1, dropFactor: 0, uom: 'EA', unitCost: 0 };
}

// ── Dialog data ───────────────────────────────────────────────────────────────

export interface EstimateFormDialogData {
  /** Optional pre-fill from context (e.g. part detail, quote line). */
  partId: number | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-estimate-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, DecimalPipe, TranslatePipe,
    DialogComponent, InputComponent, SelectComponent,
    CurrencyDisplayComponent, ValidationButtonComponent,
  ],
  templateUrl: './estimate-form-dialog.component.html',
  styleUrl: './estimate-form-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstimateFormDialogComponent {
  private readonly estimateService = inject(EstimateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialogRef = inject(MatDialogRef<EstimateFormDialogComponent>);
  protected readonly data = inject<EstimateFormDialogData>(MAT_DIALOG_DATA);

  // ── State ──────────────────────────────────────────────────────────────────

  protected readonly computing = signal(false);
  protected readonly result = signal<EstimateResult | null>(null);
  protected readonly operations = signal<OpRow[]>([defaultOp(1)]);
  protected readonly nreLines = signal<NreRow[]>([]);
  /** Per-operation index → the in-progress new material row. */
  protected readonly pendingMat = signal<Record<number, MaterialRow>>({});

  // ── Form ───────────────────────────────────────────────────────────────────

  protected readonly form = new FormGroup({
    partId: new FormControl<number | null>(
      this.data.partId,
      [Validators.required, Validators.min(1)],
    ),
    breakQuantitiesStr: new FormControl<string>('10, 25, 50, 100', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    pricingMode: new FormControl<PricingMode>('Margin', { nonNullable: true }),
    pricingValue: new FormControl<number>(30, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(99.99)],
    }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    partId: this.translate.instant('estimate.partIdLabel'),
    breakQuantitiesStr: this.translate.instant('estimate.breakQuantitiesLabel'),
    pricingMode: this.translate.instant('estimate.pricingModeLabel'),
    pricingValue: this.translate.instant('estimate.pricingValueLabel'),
  });

  /** Reactive pricing-mode signal (drives label/hint reactivity). */
  protected readonly pricingMode = toSignal(
    this.form.controls.pricingMode.valueChanges.pipe(
      startWith(this.form.controls.pricingMode.value),
    ),
    { initialValue: 'Margin' as PricingMode },
  );

  protected readonly isMarginMode = computed(() => this.pricingMode() === 'Margin');

  protected readonly pricingValueLabel = computed(() =>
    this.isMarginMode()
      ? this.translate.instant('estimate.marginPctLabel')
      : this.translate.instant('estimate.markupPctLabel'),
  );

  protected readonly pricingModeOptions: SelectOption[] = [
    { value: 'Margin', label: this.translate.instant('estimate.pricingModeMargin') },
    { value: 'Markup', label: this.translate.instant('estimate.pricingModeMarkup') },
  ];

  // ── Operations CRUD ────────────────────────────────────────────────────────

  protected addOp(): void {
    this.operations.update(ops => [...ops, defaultOp(ops.length + 1)]);
  }

  protected removeOp(idx: number): void {
    this.operations.update(ops =>
      ops.filter((_, i) => i !== idx).map((op, i) => ({ ...op, stepNumber: i + 1 })),
    );
  }

  protected setOpField(idx: number, field: keyof Omit<OpRow, 'materials' | 'showMaterials'>, rawValue: string): void {
    const numFields: (keyof OpRow)[] = [
      'workCenterId', 'setupMinutes', 'runMinutesEach', 'runMinutesLot',
      'scrapFactor', 'laborRatePerHour', 'burdenRatePerHour',
      'subcontractUnitCost', 'subcontractMinimum', 'stepNumber',
    ];
    const value: unknown = numFields.includes(field) ? (rawValue === '' ? null : +rawValue) : rawValue;
    this.operations.update(ops => ops.map((op, i) => i === idx ? { ...op, [field]: value } : op));
  }

  protected toggleSubcontract(idx: number): void {
    this.operations.update(ops =>
      ops.map((op, i) => i === idx ? { ...op, isSubcontract: !op.isSubcontract } : op),
    );
  }

  protected toggleMaterials(idx: number): void {
    this.operations.update(ops =>
      ops.map((op, i) => i === idx ? { ...op, showMaterials: !op.showMaterials } : op),
    );
  }

  protected setPendingMatField(opIdx: number, field: keyof MaterialRow, rawValue: string): void {
    const numFields: (keyof MaterialRow)[] = ['partId', 'qtyPerUnit', 'dropFactor', 'unitCost'];
    const value: unknown = numFields.includes(field) ? (rawValue === '' ? null : +rawValue) : rawValue;
    this.pendingMat.update(m => ({
      ...m,
      [opIdx]: { ...(m[opIdx] ?? defaultMat()), [field]: value },
    }));
  }

  protected addMaterial(opIdx: number): void {
    const mat = this.pendingMat()[opIdx] ?? defaultMat();
    if (!mat.partId) return;
    this.operations.update(ops =>
      ops.map((op, i) => i === opIdx ? { ...op, materials: [...op.materials, { ...mat }] } : op),
    );
    this.pendingMat.update(m => ({ ...m, [opIdx]: defaultMat() }));
  }

  protected removeMaterial(opIdx: number, matIdx: number): void {
    this.operations.update(ops =>
      ops.map((op, i) => i === opIdx
        ? { ...op, materials: op.materials.filter((_, mi) => mi !== matIdx) }
        : op,
      ),
    );
  }

  // ── NRE lines ──────────────────────────────────────────────────────────────

  protected addNre(): void {
    this.nreLines.update(lines => [...lines, { description: '', amount: 0 }]);
  }

  protected removeNre(idx: number): void {
    this.nreLines.update(lines => lines.filter((_, i) => i !== idx));
  }

  protected setNreField(idx: number, field: keyof NreRow, rawValue: string): void {
    const value: unknown = field === 'amount' ? +rawValue : rawValue;
    this.nreLines.update(lines =>
      lines.map((l, i) => i === idx ? { ...l, [field]: value } : l),
    );
  }

  // ── Compute ────────────────────────────────────────────────────────────────

  protected compute(): void {
    if (this.form.invalid || this.computing()) return;
    this.computing.set(true);

    const v = this.form.getRawValue();
    const breakQuantities = parseBreaks(v.breakQuantitiesStr);
    if (!breakQuantities.length) {
      this.snackbar.warn(this.translate.instant('estimate.invalidBreaks'));
      this.computing.set(false);
      return;
    }

    const request: EstimateRequest = {
      partId: v.partId!,
      breakQuantities,
      pricing: {
        mode: v.pricingMode,
        value: v.pricingValue / 100,    // UI stores as %, contract wants 0-1
      },
      operations: this.operations().map(op => ({
        stepNumber: op.stepNumber,
        workCenterId: op.workCenterId,
        setupMinutes: op.setupMinutes,
        runMinutesEach: op.runMinutesEach,
        runMinutesLot: op.runMinutesLot,
        scrapFactor: op.scrapFactor / 100,  // UI stores as %, contract wants 0-1
        laborRatePerHour: op.laborRatePerHour,
        burdenRatePerHour: op.burdenRatePerHour,
        isSubcontract: op.isSubcontract,
        subcontractUnitCost: op.isSubcontract ? op.subcontractUnitCost : null,
        subcontractMinimum: op.isSubcontract ? op.subcontractMinimum : null,
        materials: op.materials
          .filter(m => m.partId !== null)
          .map(m => ({
            partId: m.partId!,
            qtyPerUnit: m.qtyPerUnit,
            dropFactor: m.dropFactor / 100,  // UI stores as %, contract wants 0-1
            uom: m.uom,
            unitCost: m.unitCost,
          })),
      })),
      nreLines: this.nreLines()
        .filter(l => l.description.trim())
        .map(l => ({ description: l.description, amount: l.amount })),
    };

    this.estimateService.compute(request).subscribe({
      next: (result) => {
        this.result.set(result);
        this.computing.set(false);
      },
      error: () => {
        this.computing.set(false);
        this.snackbar.error(this.translate.instant('estimate.computeError'));
      },
    });
  }

  close(): void {
    this.dialogRef.close();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  protected marginPct(v: number): string {
    return (v * 100).toFixed(1) + '%';
  }

  protected getPendingMat(opIdx: number): MaterialRow {
    return this.pendingMat()[opIdx] ?? defaultMat();
  }
}

function parseBreaks(str: string): number[] {
  return str
    .split(/[,\s]+/)
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n) && n > 0)
    .sort((a, b) => a - b);
}
