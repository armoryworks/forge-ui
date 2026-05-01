import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

import { InputComponent } from '../../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../../shared/components/select/select.component';
import { ToggleComponent } from '../../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../../shared/services/form-validation.service';
import { BackflushPolicy } from '../../../models/backflush-policy.type';
import { PartDetail } from '../../../models/part-detail.model';
import { ReceivingInspectionFrequency } from '../../../models/receiving-inspection-frequency.type';

/**
 * Pillar 4 Phase 2 — Quality & Compliance cluster.
 *
 * Surfaces receiving-inspection settings (template, frequency, skip-after
 * count), Pillar 2 compliance (HazmatClass, ShelfLifeDays), and the
 * BackflushPolicy override. Receiving-inspection-template is rendered as
 * a numeric id input today — entity picker integration is a future
 * enhancement when the QC template service is available.
 */
@Component({
  selector: 'app-part-quality-cluster',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    InputComponent, SelectComponent, ToggleComponent, ValidationButtonComponent,
  ],
  templateUrl: './part-quality-cluster.component.html',
  styleUrl: '../part-clusters.shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartQualityClusterComponent {
  readonly part = input.required<PartDetail>();
  readonly editing = input(false);
  readonly saving = input(false);

  readonly save = output<Partial<PartDetail>>();
  readonly cancelled = output<void>();

  protected readonly inspectionFrequencyOptions: SelectOption[] = [
    { value: null, label: '-- Unset --' },
    { value: 'Every', label: 'Every Receipt' },
    { value: 'FirstArticle', label: 'First Article Only' },
    { value: 'SkipLot', label: 'Skip-Lot' },
    { value: 'Random', label: 'Random Sampling' },
  ];

  protected readonly backflushOptions: SelectOption[] = [
    { value: null, label: '-- Default --' },
    { value: 'Auto', label: 'Auto' },
    { value: 'Manual', label: 'Manual' },
    { value: 'None', label: 'None' },
  ];

  protected readonly form = new FormGroup({
    requiresReceivingInspection: new FormControl<boolean>(false, { nonNullable: true }),
    receivingInspectionTemplateId: new FormControl<number | null>(null),
    inspectionFrequency: new FormControl<ReceivingInspectionFrequency | null>(null),
    inspectionSkipAfterN: new FormControl<number | null>(null, [Validators.min(0)]),
    hazmatClass: new FormControl<string | null>(null),
    shelfLifeDays: new FormControl<number | null>(null, [Validators.min(0)]),
    backflushPolicy: new FormControl<BackflushPolicy | null>(null),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {});

  constructor() {
    effect(() => {
      const p = this.part();
      this.form.reset({
        requiresReceivingInspection: p.requiresReceivingInspection ?? false,
        receivingInspectionTemplateId: p.receivingInspectionTemplateId ?? null,
        inspectionFrequency: p.inspectionFrequency ?? null,
        inspectionSkipAfterN: p.inspectionSkipAfterN ?? null,
        hazmatClass: p.hazmatClass,
        shelfLifeDays: p.shelfLifeDays,
        backflushPolicy: p.backflushPolicy,
      });
      if (this.editing()) {
        this.form.enable();
      } else {
        this.form.disable();
      }
    });
  }

  protected onSave(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.save.emit({
      requiresReceivingInspection: v.requiresReceivingInspection,
      receivingInspectionTemplateId: v.receivingInspectionTemplateId ?? null,
      inspectionFrequency: v.inspectionFrequency ?? null,
      inspectionSkipAfterN: v.inspectionSkipAfterN ?? null,
      hazmatClass: v.hazmatClass ?? null,
      shelfLifeDays: v.shelfLifeDays ?? null,
      backflushPolicy: v.backflushPolicy ?? null,
    });
  }

  protected onCancel(): void {
    this.cancelled.emit();
  }
}
