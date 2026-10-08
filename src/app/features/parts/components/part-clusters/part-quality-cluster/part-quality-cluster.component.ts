import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import { DataTableComponent } from '../../../../../shared/components/data-table/data-table.component';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { EntityLinkComponent } from '../../../../../shared/components/entity-link/entity-link.component';
import { EntityPickerComponent } from '../../../../../shared/components/entity-picker/entity-picker.component';
import { InputComponent } from '../../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../../shared/components/select/select.component';
import { ToggleComponent } from '../../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../../shared/components/validation-button/validation-button.component';
import { CapDirective } from '../../../../../shared/directives/cap.directive';
import { ColumnCellDirective } from '../../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../../shared/models/column-def.model';
import { CapabilityService } from '../../../../../shared/services/capability.service';
import { FormValidationService } from '../../../../../shared/services/form-validation.service';
import { BackflushPolicy } from '../../../models/backflush-policy.type';
import { PartDetail } from '../../../models/part-detail.model';
import { PartQualitySummary } from '../../../models/part-quality-summary.model';
import { ReceivingInspectionFrequency } from '../../../models/receiving-inspection-frequency.type';
import { PartQualityService } from '../../../services/part-quality.service';

/**
 * Pillar 4 Phase 2 — Quality & Compliance cluster.
 *
 * Surfaces receiving-inspection settings (template, frequency, skip-after
 * count), Pillar 2 compliance (HazmatClass, ShelfLifeDays), and the
 * BackflushPolicy override. Receiving-inspection-template uses
 * <c>&lt;app-entity-picker&gt;</c> against
 * <c>/api/v1/receiving-inspection-templates</c> — gated by the
 * <c>*appCap</c> structural directive on <c>CAP-MD-PART-COMPLIANCE</c>.
 * Under the fields, read-only lists of the part's recent inspections, open
 * NCRs, on-hand lots and inspection templates, gated on <c>CAP-QC-INSPECTION</c>.
 */
@Component({
  selector: 'app-part-quality-cluster',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink, TranslatePipe,
    InputComponent, SelectComponent, ToggleComponent, ValidationButtonComponent,
    EntityPickerComponent, EntityLinkComponent, DataTableComponent, EmptyStateComponent,
    CapDirective, ColumnCellDirective, LoadingBlockDirective,
  ],
  templateUrl: './part-quality-cluster.component.html',
  styleUrl: '../part-clusters.shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartQualityClusterComponent {
  private readonly capabilityService = inject(CapabilityService);
  private readonly qualityService = inject(PartQualityService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly part = input.required<PartDetail>();
  readonly editing = input(false);
  readonly saving = input(false);

  readonly save = output<Partial<PartDetail>>();
  readonly saveAndClose = output<Partial<PartDetail>>();
  readonly cancelled = output<void>();

  /**
   * Pillar 2 audit § 9 — Tier 3 part-level compliance fields (HazmatClass,
   * ShelfLifeDays, BackflushPolicy, ReceivingInspectionTemplateId) gate on
   * `CAP-MD-PART-COMPLIANCE`. Tier 0 fields (traceability + receiving-
   * inspection toggle / frequency / skip-after) stay always visible.
   */
  protected readonly showCompliance = computed(() =>
    this.capabilityService.isEnabled('CAP-MD-PART-COMPLIANCE'),
  );

  protected readonly showQualityRecords = computed(() =>
    this.capabilityService.isEnabled('CAP-QC-INSPECTION'),
  );

  private readonly partId = computed(() => this.part().id);

  protected readonly summary = signal<PartQualitySummary | null>(null);
  protected readonly summaryLoading = signal(false);
  private summarySub?: Subscription;

  protected readonly inspectionColumns: ColumnDef[] = [
    { field: 'id', header: this.translate.instant('partQuality.colInspection'), width: '100px' },
    { field: 'templateName', header: this.translate.instant('partQuality.colTemplate') },
    { field: 'lotNumber', header: this.translate.instant('partQuality.colLot'), width: '140px' },
    { field: 'status', header: this.translate.instant('common.status'), width: '110px' },
    { field: 'results', header: this.translate.instant('partQuality.colResults'), width: '150px' },
    { field: 'createdAt', header: this.translate.instant('common.date'), type: 'date', width: '110px' },
  ];

  protected readonly ncrColumns: ColumnDef[] = [
    { field: 'ncrNumber', header: this.translate.instant('partQuality.colNcr'), width: '120px' },
    { field: 'description', header: this.translate.instant('partQuality.colDescription') },
    { field: 'status', header: this.translate.instant('common.status'), width: '120px' },
    { field: 'lotNumber', header: this.translate.instant('partQuality.colLot'), width: '140px' },
    { field: 'affectedQuantity', header: this.translate.instant('partQuality.colAffected'), type: 'number', align: 'right', width: '110px' },
    { field: 'detectedAt', header: this.translate.instant('partQuality.colDetected'), type: 'date', width: '110px' },
  ];

  protected readonly lotColumns: ColumnDef[] = [
    { field: 'lotNumber', header: this.translate.instant('partQuality.colLot') },
    { field: 'onHandQuantity', header: this.translate.instant('partQuality.colOnHand'), type: 'number', align: 'right', width: '110px' },
    { field: 'hold', header: this.translate.instant('partQuality.colHold'), width: '150px' },
    { field: 'expirationDate', header: this.translate.instant('partQuality.colExpires'), type: 'date', width: '110px' },
  ];

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

    effect(() => {
      const id = this.partId();
      if (!this.showQualityRecords()) {
        this.summary.set(null);
        return;
      }
      this.loadSummary(id);
    });
  }

  private loadSummary(partId: number): void {
    this.summarySub?.unsubscribe();
    this.summaryLoading.set(true);
    this.summarySub = this.qualityService.getSummary(partId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (summary) => { this.summary.set(summary); this.summaryLoading.set(false); },
      error: () => this.summaryLoading.set(false),
    });
  }

  protected onSave(close = false): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    (close ? this.saveAndClose : this.save).emit({
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
