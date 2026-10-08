import {
  ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, FormRecord, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { BarcodeScanInputComponent } from '../../../../shared/components/barcode-scan-input/barcode-scan-input.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { QcInspection } from '../../../quality/models/qc-inspection.model';
import { QcInspectionResult } from '../../../quality/models/qc-inspection-result.model';
import { KioskInspectionTarget } from '../../models/kiosk-inspection-target.model';
import { KioskInspectionService } from '../../services/kiosk-inspection.service';

type InspectStep = 'reference' | 'starting' | 'inspect' | 'submitting' | 'done' | 'ncr' | 'ncrRaised';

const NO_TARGET: KioskInspectionTarget = { jobId: null, jobNumber: null, lotNumber: null, lotQuantity: null };

function positiveQuantity(control: AbstractControl<number | null>): ValidationErrors | null {
  return Number(control.value) > 0 ? null : { positive: true };
}

@Component({
  selector: 'app-scan-inspect-flow',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, BarcodeScanInputComponent, InputComponent, TextareaComponent, ToggleComponent],
  templateUrl: './scan-inspect-flow.component.html',
  styleUrl: './scan-inspect-flow.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScanInspectFlowComponent implements OnInit {
  private readonly kioskInspection = inject(KioskInspectionService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly partId = input.required<number>();
  readonly partNumber = input.required<string>();
  readonly qcTemplateId = input<number | null>(null);

  readonly completed = output<void>();
  readonly cancelled = output<void>();

  protected readonly step = signal<InspectStep>('reference');
  protected readonly lookingUp = signal(false);
  protected readonly referenceError = signal<string | null>(null);
  protected readonly target = signal<KioskInspectionTarget | null>(null);
  protected readonly inspection = signal<QcInspection | null>(null);
  protected readonly result = signal<'Pass' | 'Fail' | null>(null);
  protected readonly notesControl = new FormControl('');
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly checklist = signal<QcInspectionResult[]>([]);
  protected readonly checklistForm = new FormRecord<FormControl<boolean>>({});
  private readonly checkedItemIds = signal<ReadonlySet<number>>(new Set());
  protected readonly failedItems = signal<string[]>([]);

  protected readonly ncrForm = new FormGroup({
    description: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(4000)] }),
    affectedQuantity: new FormControl<number | null>(1, { validators: [Validators.required, positiveQuantity] }),
  });
  private readonly ncrFormValid = signal(false);
  protected readonly ncrSaving = signal(false);
  protected readonly ncrError = signal<string | null>(null);
  protected readonly ncrNumber = signal<string | null>(null);

  protected readonly requiredItemsChecked = computed(() => {
    const checked = this.checkedItemIds();
    return this.checklist().every(item => !item.isRequired || checked.has(item.id));
  });
  protected readonly canPass = computed(() => this.inspection() !== null && this.requiredItemsChecked());
  protected readonly canSubmit = computed(() => {
    const result = this.result();
    return this.inspection() !== null && (result === 'Fail' || (result === 'Pass' && this.canPass()));
  });
  protected readonly canRaiseNcr = computed(() => this.ncrFormValid() && !this.ncrSaving());

  ngOnInit(): void {
    this.checklistForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.checkedItemIds.set(this.readCheckedItemIds()));
    this.ncrForm.statusChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.ncrFormValid.set(this.ncrForm.valid));
  }

  protected onReferenceScanned(value: string): void {
    const scanned = value.trim();
    if (!scanned || this.lookingUp()) return;

    this.lookingUp.set(true);
    this.referenceError.set(null);
    this.kioskInspection.findTarget(this.partId(), scanned).subscribe({
      next: (lookup) => {
        this.lookingUp.set(false);
        if (lookup.status === 'found') {
          this.begin(lookup.target);
        } else if (lookup.status === 'otherPart') {
          this.referenceError.set(this.translate.instant('kioskInspect.referenceOtherPart', {
            value: scanned,
            partNumber: lookup.partNumber ?? '',
          }));
        } else {
          this.referenceError.set(this.translate.instant('kioskInspect.referenceNotFound', { value: scanned }));
        }
      },
      error: () => {
        this.lookingUp.set(false);
        this.referenceError.set(this.translate.instant('kioskInspect.referenceLookupFailed', { value: scanned }));
      },
    });
  }

  protected skipReference(): void {
    if (this.lookingUp()) return;
    this.begin(NO_TARGET);
  }

  private begin(target: KioskInspectionTarget): void {
    this.target.set(target);
    this.step.set('starting');
    this.kioskInspection.openInspection(this.partId(), this.qcTemplateId(), target).subscribe({
      next: (inspection) => {
        this.setInspection(inspection);
        this.step.set('inspect');
      },
      error: (err: { error?: { detail?: string } }) => {
        this.target.set(null);
        this.step.set('reference');
        this.referenceError.set(err?.error?.detail ?? this.translate.instant('kioskInspect.startFailed'));
      },
    });
  }

  private setInspection(inspection: QcInspection): void {
    for (const key of Object.keys(this.checklistForm.controls))
      this.checklistForm.removeControl(key, { emitEvent: false });
    for (const row of inspection.results)
      this.checklistForm.addControl(String(row.id), new FormControl(row.passed, { nonNullable: true }), { emitEvent: false });
    this.inspection.set(inspection);
    this.checklist.set(inspection.results);
    this.checkedItemIds.set(this.readCheckedItemIds());
  }

  protected setResult(value: 'Pass' | 'Fail'): void {
    this.result.set(value);
  }

  protected submitInspection(): void {
    const inspection = this.inspection();
    const outcome = this.result();
    if (!inspection || !outcome || this.submitting() || !this.canSubmit()) return;

    this.submitting.set(true);
    this.error.set(null);
    this.step.set('submitting');

    const checked = this.readCheckedItemIds();
    const results = inspection.results.length > 0
      ? inspection.results.map(r => ({
        id: r.id,
        checklistItemId: r.checklistItemId ?? undefined,
        description: r.description,
        passed: checked.has(r.id),
        measuredValue: r.measuredValue ?? undefined,
        notes: r.notes ?? undefined,
      }))
      : undefined;

    this.kioskInspection.completeInspection(inspection.id, {
      status: outcome === 'Pass' ? 'Passed' : 'Failed',
      notes: this.notesControl.value || undefined,
      results,
    }).subscribe({
      next: (completed) => {
        this.inspection.set(completed ?? inspection);
        this.failedItems.set(inspection.results.filter(r => !checked.has(r.id)).map(r => r.description));
        this.submitting.set(false);
        this.step.set('done');
        if (outcome === 'Pass') setTimeout(() => this.completed.emit(), 1500);
      },
      error: (err: { error?: { detail?: string } }) => {
        this.submitting.set(false);
        this.step.set('inspect');
        this.error.set(err?.error?.detail ?? this.translate.instant('kioskInspect.completeFailed'));
      },
    });
  }

  protected openNcr(): void {
    this.ncrForm.reset({
      description: this.ncrDescription(),
      affectedQuantity: this.target()?.lotQuantity ?? 1,
    });
    this.ncrFormValid.set(this.ncrForm.valid);
    this.ncrError.set(null);
    this.step.set('ncr');
  }

  protected backToResult(): void {
    if (this.ncrSaving()) return;
    this.step.set('done');
  }

  protected raiseNcr(): void {
    const inspection = this.inspection();
    if (!inspection || !this.canRaiseNcr() || this.ncrForm.invalid) return;

    const { description, affectedQuantity } = this.ncrForm.getRawValue();
    this.ncrSaving.set(true);
    this.ncrError.set(null);
    this.kioskInspection.raiseNcr(inspection, this.partId(), description.trim(), Number(affectedQuantity)).subscribe({
      next: (ncr) => {
        this.ncrSaving.set(false);
        this.ncrNumber.set(ncr.ncrNumber);
        this.step.set('ncrRaised');
        setTimeout(() => this.completed.emit(), 2000);
      },
      error: (err: { error?: { detail?: string } }) => {
        this.ncrSaving.set(false);
        this.ncrError.set(err?.error?.detail ?? this.translate.instant('kioskInspect.ncrFailed'));
      },
    });
  }

  protected finish(): void {
    this.completed.emit();
  }

  protected cancel(): void {
    this.cancelled.emit();
  }

  private ncrDescription(): string {
    const inspection = this.inspection();
    const target = this.target();
    const lines: string[] = [
      this.translate.instant('kioskInspect.ncrSummary', { id: inspection?.id ?? '', partNumber: this.partNumber() }),
    ];
    if (target?.jobNumber) lines.push(this.translate.instant('kioskInspect.ncrWorkOrderLine', { number: target.jobNumber }));
    if (target?.lotNumber) lines.push(this.translate.instant('kioskInspect.ncrLotLine', { number: target.lotNumber }));
    const failed = this.failedItems();
    if (failed.length > 0) {
      lines.push(this.translate.instant('kioskInspect.ncrFailedItemsLine'));
      lines.push(...failed.map(item => `- ${item}`));
    }
    const notes = this.notesControl.value?.trim();
    if (notes) lines.push(this.translate.instant('kioskInspect.ncrNotesLine', { notes }));
    return lines.join('\n');
  }

  private readCheckedItemIds(): Set<number> {
    return new Set(
      Object.entries(this.checklistForm.getRawValue())
        .filter(([, checked]) => checked)
        .map(([id]) => Number(id)),
    );
  }
}
