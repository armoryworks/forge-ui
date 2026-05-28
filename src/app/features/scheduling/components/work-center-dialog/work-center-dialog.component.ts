import { ChangeDetectionStrategy, Component, OnInit, ViewChild, input, output, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { DraftConfig } from '../../../../shared/models/draft-config.model';
import { WorkCenter } from '../../models/scheduling.model';

@Component({
  selector: 'app-work-center-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, TextareaComponent,
    ToggleComponent, CurrencyInputComponent, ValidationButtonComponent,
  ],
  templateUrl: './work-center-dialog.component.html',
  styleUrl: './work-center-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkCenterDialogComponent implements OnInit {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;

  readonly workCenter = input<WorkCenter | null>(null);
  readonly saving = input(false);
  readonly closed = output<void>();
  readonly saved = output<Partial<WorkCenter>>();

  protected draftConfig: DraftConfig = {
    entityType: 'work-center',
    entityId: 'new',
    route: '/scheduling/work-centers',
  };

  readonly form = new FormGroup({
    code: new FormControl('', [Validators.required, Validators.maxLength(50)]),
    name: new FormControl('', [Validators.required, Validators.maxLength(200)]),
    description: new FormControl(''),
    dailyCapacityHours: new FormControl<number | null>(8, [Validators.required, Validators.min(0.01)]),
    efficiencyPercent: new FormControl<number | null>(100, [Validators.required, Validators.min(1), Validators.max(200)]),
    numberOfMachines: new FormControl<number | null>(1, [Validators.required, Validators.min(1)]),
    laborCostPerHour: new FormControl<number | null>(0),
    burdenRatePerHour: new FormControl<number | null>(0),
    sortOrder: new FormControl<number | null>(0),
    isActive: new FormControl(true),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    code: 'Code',
    name: 'Name',
    dailyCapacityHours: 'Daily Capacity (hours)',
    efficiencyPercent: 'Efficiency %',
    numberOfMachines: 'Number of Machines',
  });

  protected readonly isEdit = signal(false);

  ngOnInit(): void {
    const wc = this.workCenter();
    if (wc) {
      this.isEdit.set(true);
      this.draftConfig = { ...this.draftConfig, entityId: wc.id.toString() };
      this.form.patchValue({
        code: wc.code,
        name: wc.name,
        description: wc.description ?? '',
        dailyCapacityHours: wc.dailyCapacityHours,
        efficiencyPercent: wc.efficiencyPercent,
        numberOfMachines: wc.numberOfMachines,
        laborCostPerHour: wc.laborCostPerHour,
        burdenRatePerHour: wc.burdenRatePerHour,
        sortOrder: wc.sortOrder,
        isActive: wc.isActive,
      });
    }
  }

  protected save(): void {
    if (this.form.invalid) return;

    const v = this.form.getRawValue();
    const existing = this.workCenter();
    this.dialogRef.clearDraft();

    // AssetId / CompanyLocationId aren't surfaced in this form yet; preserve the
    // existing linkage on edit (the PUT is a full replace) and leave null on create.
    this.saved.emit({
      code: v.code!.trim(),
      name: v.name!.trim(),
      description: v.description?.trim() || null,
      dailyCapacityHours: v.dailyCapacityHours ?? 0,
      efficiencyPercent: v.efficiencyPercent ?? 100,
      numberOfMachines: v.numberOfMachines ?? 1,
      laborCostPerHour: v.laborCostPerHour ?? 0,
      burdenRatePerHour: v.burdenRatePerHour ?? 0,
      sortOrder: v.sortOrder ?? 0,
      isActive: v.isActive ?? true,
      assetId: existing?.assetId ?? null,
      companyLocationId: existing?.companyLocationId ?? null,
    });
  }
}
