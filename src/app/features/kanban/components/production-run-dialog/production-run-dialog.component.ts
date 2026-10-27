import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AssetsService } from '../../../assets/services/assets.service';
import { SchedulingService } from '../../../scheduling/services/scheduling.service';
import { ProductionRunDialogData } from '../../models/production-run-dialog-data.model';
import { ProductionRun } from '../../models/production-run.model';
import { PRODUCTION_RUN_PICKER_ROLES } from '../../production-run-roles';
import { ProductionRunsService } from '../../services/production-runs.service';

@Component({
  selector: 'app-production-run-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, SelectComponent, TextareaComponent, ValidationButtonComponent],
  templateUrl: './production-run-dialog.component.html',
  styleUrl: './production-run-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductionRunDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<ProductionRunDialogComponent, ProductionRun | undefined>);
  protected readonly data = inject<ProductionRunDialogData>(MAT_DIALOG_DATA);
  private readonly runsService = inject(ProductionRunsService);
  private readonly assetsService = inject(AssetsService);
  private readonly schedulingService = inject(SchedulingService);
  private readonly auth = inject(AuthService);
  private readonly capabilities = inject(CapabilityService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isEdit = this.data.run !== null;
  protected readonly saving = signal(false);
  protected readonly workCenterOptions = signal<SelectOption[]>([]);
  protected readonly toolingOptions = signal<SelectOption[]>([]);

  private readonly canPick = this.auth.hasAnyRole([...PRODUCTION_RUN_PICKER_ROLES]);
  protected readonly showWorkCenter = !this.isEdit && this.canPick && this.capabilities.isEnabled('CAP-MD-WORKCENTERS', true);
  protected readonly showTooling = this.canPick && this.capabilities.isEnabled('CAP-MD-ASSETS', true);

  readonly form = new FormGroup({
    workCenterId: new FormControl<number | null>(null),
    toolingAssetId: new FormControl<number | null>(this.data.run?.toolingAssetId ?? null),
    targetQuantity: new FormControl<number | null>(this.data.run?.targetQuantity ?? this.data.defaultTargetQuantity,
      [Validators.required, Validators.min(1)]),
    completedQuantity: new FormControl<number | null>(this.data.run?.completedQuantity ?? 0, [Validators.min(0)]),
    scrapQuantity: new FormControl<number | null>(this.data.run?.scrapQuantity ?? 0, [Validators.min(0)]),
    setupTimeMinutes: new FormControl<number | null>(this.data.run?.setupTimeMinutes ?? null, [Validators.min(0)]),
    runTimeMinutes: new FormControl<number | null>(this.data.run?.runTimeMinutes ?? null, [Validators.min(0)]),
    notes: new FormControl<string>(this.data.run?.notes ?? '', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
  });

  readonly violations = FormValidationService.getViolations(this.form, {
    targetQuantity: this.translate.instant('productionRuns.targetQuantity'),
    completedQuantity: this.translate.instant('productionRuns.goodQuantity'),
    scrapQuantity: this.translate.instant('productionRuns.scrapQuantity'),
    setupTimeMinutes: this.translate.instant('productionRuns.setupMinutes'),
    runTimeMinutes: this.translate.instant('productionRuns.runMinutes'),
    notes: this.translate.instant('common.notes'),
  });

  ngOnInit(): void {
    if (this.isEdit) this.form.controls.targetQuantity.disable();
    if (this.showWorkCenter) {
      this.schedulingService.getWorkCenters().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: centers => this.workCenterOptions.set([
          { value: null, label: this.translate.instant('productionRuns.workCenterDefault') },
          ...centers.filter(c => c.isActive).map(c => ({ value: c.id, label: `${c.code} — ${c.name}` })),
        ]),
        error: () => this.workCenterOptions.set([]),
      });
    }
    if (this.showTooling) {
      const currentToolId = this.data.run?.toolingAssetId ?? null;
      const noneOption: SelectOption[] = currentToolId === null
        ? [{ value: null, label: this.translate.instant(this.isEdit ? 'productionRuns.toolingNone' : 'productionRuns.toolingDefault') }]
        : [];
      this.assetsService.getAssets('Tooling').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: assets => this.toolingOptions.set([
          ...noneOption,
          ...assets.filter(a => a.status !== 'Retired' || a.id === currentToolId).map(a => ({
            value: a.id,
            label: a.cavityCount ? this.translate.instant('productionRuns.toolingOption', { name: a.name, cavities: a.cavityCount }) : a.name,
          })),
        ]),
        error: () => this.toolingOptions.set([]),
      });
    }
  }

  protected close(): void {
    this.dialogRef.close();
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const raw = this.form.getRawValue();
    const run = this.data.run;
    const request$ = run
      ? this.runsService.updateRun(this.data.jobId, run.id, {
        completedQuantity: raw.completedQuantity ?? 0,
        scrapQuantity: raw.scrapQuantity ?? 0,
        status: run.status,
        notes: raw.notes.trim() || null,
        setupTimeMinutes: raw.setupTimeMinutes,
        runTimeMinutes: this.runTimeToSend(raw.runTimeMinutes),
        toolingAssetId: this.showTooling ? raw.toolingAssetId : null,
      })
      : this.runsService.createRun(this.data.jobId, {
        partId: this.data.partId,
        targetQuantity: raw.targetQuantity ?? 0,
        operatorId: null,
        notes: raw.notes.trim() || null,
        workCenterId: this.showWorkCenter ? raw.workCenterId : null,
        toolingAssetId: this.showTooling ? raw.toolingAssetId : null,
      });

    request$.subscribe({
      next: saved => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant(run ? 'productionRuns.updated' : 'productionRuns.created', { run: saved.runNumber }));
        this.dialogRef.close(saved);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'productionRuns.saveFailed');
      },
    });
  }

  private runTimeToSend(value: number | null): number | null {
    if (!this.form.controls.runTimeMinutes.dirty) return null;
    return value != null && value > 0 ? value : 0;
  }
}
