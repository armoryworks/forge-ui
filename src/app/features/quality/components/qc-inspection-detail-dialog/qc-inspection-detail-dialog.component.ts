import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { map, startWith } from 'rxjs';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { EntityActivitySectionComponent } from '../../../../shared/components/entity-activity-section/entity-activity-section.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { NcrDetectionStage } from '../../models/ncr-detection-stage.model';
import { NonConformance } from '../../models/non-conformance.model';
import { QcInspectionDetail } from '../../models/qc-inspection-detail.model';
import { QcInspectionResult } from '../../models/qc-inspection-result.model';
import { NcrCapaService } from '../../services/ncr-capa.service';
import { QualityService } from '../../services/quality.service';

export interface QcInspectionDetailDialogData {
  inspectionId: number;
}

export interface QcInspectionDetailDialogResult {
  changed: boolean;
  openNcrId?: number;
}

type ResultGroup = FormGroup<{
  id: FormControl<number>;
  checklistItemId: FormControl<number | null>;
  description: FormControl<string>;
  specification: FormControl<string | null>;
  isRequired: FormControl<boolean>;
  passed: FormControl<boolean>;
  measuredValue: FormControl<string>;
  notes: FormControl<string>;
}>;

const NCR_CAPABILITY = 'CAP-QC-NCR';

const DETECTION_STAGES: NcrDetectionStage[] = ['Receiving', 'InProcess', 'FinalInspection', 'Shipping', 'Customer', 'Audit'];

@Component({
  selector: 'app-qc-inspection-detail-dialog',
  standalone: true,
  imports: [
    DatePipe, ReactiveFormsModule, TranslatePipe,
    DialogComponent, EntityActivitySectionComponent, EntityPickerComponent,
    InputComponent, SelectComponent, TextareaComponent, ValidationButtonComponent, LoadingBlockDirective,
  ],
  templateUrl: './qc-inspection-detail-dialog.component.html',
  styleUrl: './qc-inspection-detail-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QcInspectionDetailDialogComponent {
  private readonly ref = inject(MatDialogRef<QcInspectionDetailDialogComponent, QcInspectionDetailDialogResult>);
  private readonly data = inject<QcInspectionDetailDialogData>(MAT_DIALOG_DATA);
  private readonly qualityService = inject(QualityService);
  private readonly ncrCapaService = inject(NcrCapaService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly capabilities = inject(CapabilityService);

  protected readonly inspection = signal<QcInspectionDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly linkedNcr = signal<NonConformance | null>(null);
  protected readonly showNcrForm = signal(false);
  private changed = false;

  protected readonly title = computed(() =>
    this.translate.instant('qcInspections.detailTitle', { id: this.data.inspectionId }));

  protected readonly isComplete = computed(() => {
    const status = this.inspection()?.status;
    return status === 'Passed' || status === 'Failed';
  });

  protected readonly isFailed = computed(() => this.inspection()?.status === 'Failed');

  protected readonly ncrEnabled = computed(() => this.capabilities.isEnabled(NCR_CAPABILITY));

  protected readonly needsNcrPart = computed(() => {
    const inspection = this.inspection();
    return inspection !== null && inspection.partId == null;
  });

  protected readonly statusLabel = computed(() => {
    const status = this.inspection()?.status ?? '';
    const key: Record<string, string> = {
      InProgress: 'quality.statusInProgress',
      Passed: 'quality.statusPassed',
      Failed: 'quality.statusFailed',
    };
    return key[status] ? this.translate.instant(key[status]) : status;
  });

  protected readonly statusClass = computed(() => {
    const classes: Record<string, string> = {
      InProgress: 'chip chip--warning',
      Passed: 'chip chip--success',
      Failed: 'chip chip--error',
    };
    return classes[this.inspection()?.status ?? ''] ?? 'chip';
  });

  protected readonly passFailOptions: SelectOption[] = [
    { value: true, label: this.translate.instant('qcInspections.pass') },
    { value: false, label: this.translate.instant('qcInspections.fail') },
  ];

  protected readonly stageOptions: SelectOption[] = DETECTION_STAGES.map(stage => ({
    value: stage,
    label: this.translate.instant(`qcInspections.stage${stage}`),
  }));

  protected readonly form = new FormGroup({
    notes: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
    results: new FormArray<ResultGroup>([]),
  });

  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(startWith(null), map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  protected readonly passViolations = computed<string[]>(() =>
    this.formValue().results
      .filter(r => r.isRequired && !r.passed)
      .map(r => this.translate.instant('qcInspections.requiredNotPassed', { item: r.description })));

  protected readonly ncrForm = new FormGroup({
    partId: new FormControl<number | null>(null, [Validators.required]),
    detectedAtStage: new FormControl<NcrDetectionStage>('FinalInspection', { nonNullable: true }),
    affectedQuantity: new FormControl<number | null>(1, [Validators.required, Validators.min(0.0001)]),
    description: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(4000)] }),
  });

  protected readonly ncrViolations = FormValidationService.getViolations(this.ncrForm, {
    partId: this.translate.instant('qcInspections.part'),
    affectedQuantity: this.translate.instant('qcInspections.ncrQuantity'),
    description: this.translate.instant('qcInspections.ncrDescription'),
  });

  constructor() {
    this.load();
  }

  protected get results(): FormArray<ResultGroup> {
    return this.form.controls.results;
  }

  protected save(): void {
    this.submit(undefined, 'qcInspections.saved');
  }

  protected markPassed(): void {
    if (this.passViolations().length > 0) return;
    this.submit('Passed', 'qcInspections.passedMessage');
  }

  protected markFailed(): void {
    this.submit('Failed', 'qcInspections.failedMessage');
  }

  protected openNcrForm(): void {
    const inspection = this.inspection();
    if (!inspection || !this.ncrEnabled()) return;
    const failedChecks = inspection.results.filter(r => !r.passed).map(r => r.description);
    const description = [
      this.translate.instant('qcInspections.ncrDescriptionDefault', { id: inspection.id }),
      failedChecks.length > 0
        ? this.translate.instant('qcInspections.ncrFailedChecks', { items: failedChecks.join(', ') })
        : '',
    ].filter(Boolean).join(' ');
    this.ncrForm.reset({
      partId: inspection.partId,
      detectedAtStage: 'FinalInspection',
      affectedQuantity: 1,
      description,
    });
    this.showNcrForm.set(true);
  }

  protected cancelNcrForm(): void {
    this.showNcrForm.set(false);
  }

  protected raiseNcr(): void {
    const inspection = this.inspection();
    if (!inspection || !this.ncrEnabled() || this.ncrForm.invalid || this.saving()) return;
    this.saving.set(true);
    const value = this.ncrForm.getRawValue();
    this.ncrCapaService.createNcr({
      type: 'Internal',
      partId: value.partId!,
      jobId: inspection.jobId,
      productionRunId: inspection.productionRunId,
      lotNumber: inspection.lotNumber,
      qcInspectionId: inspection.id,
      detectedAtStage: value.detectedAtStage,
      description: value.description.trim(),
      affectedQuantity: value.affectedQuantity!,
    }).subscribe({
      next: ncr => {
        this.saving.set(false);
        this.changed = true;
        this.linkedNcr.set(ncr);
        this.showNcrForm.set(false);
        this.snackbar.success(this.translate.instant('qcInspections.ncrCreated', { number: ncr.ncrNumber }));
      },
      error: () => this.saving.set(false),
    });
  }

  protected openNcr(): void {
    const ncr = this.linkedNcr();
    if (!ncr) return;
    this.ref.close({ changed: this.changed, openNcrId: ncr.id });
  }

  protected close(): void {
    this.ref.close({ changed: this.changed });
  }

  private load(): void {
    this.loading.set(true);
    this.qualityService.getInspection(this.data.inspectionId).subscribe({
      next: inspection => {
        this.apply(inspection);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private apply(inspection: QcInspectionDetail): void {
    this.inspection.set(inspection);
    this.results.clear({ emitEvent: false });
    for (const result of inspection.results) {
      this.results.push(this.resultGroup(result), { emitEvent: false });
    }
    this.form.controls.notes.setValue(inspection.notes ?? '', { emitEvent: false });
    if (inspection.status === 'Passed' || inspection.status === 'Failed') {
      this.form.disable({ emitEvent: false });
    } else {
      this.form.enable({ emitEvent: false });
    }
    this.form.updateValueAndValidity();
    if (inspection.status === 'Failed' && this.ncrEnabled()) {
      this.findLinkedNcr(inspection);
    }
  }

  private findLinkedNcr(inspection: QcInspectionDetail): void {
    const filters = inspection.jobId != null
      ? { jobId: inspection.jobId }
      : inspection.partId != null ? { partId: inspection.partId } : null;
    if (!filters) return;
    this.ncrCapaService.getNcrs(filters).subscribe({
      next: ncrs => this.linkedNcr.set(ncrs.find(n => n.qcInspectionId === inspection.id) ?? null),
    });
  }

  private submit(status: 'Passed' | 'Failed' | undefined, messageKey: string): void {
    const inspection = this.inspection();
    if (!inspection || this.isComplete() || this.saving() || this.form.invalid) return;
    this.saving.set(true);
    const value = this.form.getRawValue();
    this.qualityService.updateInspection(inspection.id, {
      ...(status ? { status } : {}),
      notes: value.notes.trim(),
      results: value.results.map(r => ({
        id: r.id,
        ...(r.checklistItemId != null ? { checklistItemId: r.checklistItemId } : {}),
        description: r.description,
        passed: r.passed,
        measuredValue: r.measuredValue.trim() || undefined,
        notes: r.notes.trim() || undefined,
      })),
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.changed = true;
        this.snackbar.success(this.translate.instant(messageKey));
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  private resultGroup(result: QcInspectionResult): ResultGroup {
    return new FormGroup({
      id: new FormControl(result.id, { nonNullable: true }),
      checklistItemId: new FormControl<number | null>(result.checklistItemId),
      description: new FormControl(result.description, { nonNullable: true }),
      specification: new FormControl<string | null>(result.specification ?? null),
      isRequired: new FormControl(result.isRequired ?? false, { nonNullable: true }),
      passed: new FormControl(result.passed, { nonNullable: true }),
      measuredValue: new FormControl(result.measuredValue ?? '', { nonNullable: true, validators: [Validators.maxLength(200)] }),
      notes: new FormControl(result.notes ?? '', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    });
  }
}
