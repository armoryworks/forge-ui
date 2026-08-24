import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { CostingTemplate, CostingTemplateLine } from '../../models/costing.model';
import { CostingService } from '../../services/costing.service';

export interface CostingTemplateEditorData {
  template: CostingTemplate | null;
}

/**
 * Whole-graph template editor: name/description plus one row per overhead
 * category (code, name, behavior, driver, how the amount is asked, default,
 * optional GL account). Saving replaces the template's entire line set.
 */
@Component({
  selector: 'app-costing-template-editor-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    CurrencyInputComponent,
    DialogComponent,
    InputComponent,
    SelectComponent,
    ValidationButtonComponent,
  ],
  templateUrl: './costing-template-editor-dialog.component.html',
  styleUrl: './costing-template-editor-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CostingTemplateEditorDialogComponent {
  private readonly ref = inject(MatDialogRef<CostingTemplateEditorDialogComponent, CostingTemplate | undefined>);
  private readonly data = inject<CostingTemplateEditorData>(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(CostingService);
  private readonly translate = inject(TranslateService);

  protected readonly saving = signal(false);
  protected readonly error = signal(false);
  protected readonly editing = this.data.template;

  protected readonly behaviorOptions: SelectOption[] = ['Fixed', 'Variable', 'Semi']
    .map((v) => ({ value: v, label: this.translate.instant(`costing.templates.behavior.${v}`) }));
  protected readonly driverOptions: SelectOption[] = ['LaborHour', 'MachineHour', 'LaborDollar', 'MaterialDollar', 'Unit']
    .map((v) => ({ value: v, label: this.translate.instant(`costing.templates.driver.${v}`) }));
  protected readonly basisOptions: SelectOption[] = ['MonthlyAmount', 'AnnualAmount', 'MonthlyPerEmployee', 'PercentOfWages']
    .map((v) => ({ value: v, label: this.translate.instant(`costing.templates.basis.${v}`) }));

  protected readonly form = this.fb.nonNullable.group({
    name: [this.editing?.name ?? '', [Validators.required, Validators.maxLength(128)]],
    description: [this.editing?.description ?? ''],
    lines: this.fb.array((this.editing?.lines ?? []).map((l) => this.lineGroup(l))),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: 'Template name',
    lines: 'Lines',
  });

  protected get lines(): FormArray<FormGroup> {
    return this.form.controls.lines as FormArray<FormGroup>;
  }

  private lineGroup(line?: CostingTemplateLine): FormGroup {
    return this.fb.nonNullable.group({
      code: [line?.code ?? '', [Validators.required, Validators.maxLength(32), Validators.pattern(/^[A-Za-z0-9][A-Za-z0-9-_]*$/)]],
      name: [line?.name ?? '', [Validators.required, Validators.maxLength(128)]],
      behavior: [line?.behavior ?? ('Fixed' as CostingTemplateLine['behavior'])],
      driver: [line?.driver ?? ('LaborHour' as CostingTemplateLine['driver'])],
      amountBasis: [line?.amountBasis ?? ('MonthlyAmount' as CostingTemplateLine['amountBasis'])],
      defaultValue: [line?.defaultValue ?? null as number | null],
      glAccountNumber: [line?.glAccountNumber ?? ''],
      glAccountName: [line?.glAccountName ?? ''],
    });
  }

  protected addLine(): void {
    this.lines.push(this.lineGroup());
  }

  protected removeLine(index: number): void {
    this.lines.removeAt(index);
  }

  protected save(): void {
    if (this.form.invalid || this.saving() || this.lines.length === 0) return;
    this.saving.set(true);
    this.error.set(false);
    const v = this.form.getRawValue();
    this.service
      .saveTemplate({
        id: this.editing?.id ?? null,
        name: v.name.trim(),
        description: v.description.trim() || null,
        lines: this.lines.getRawValue().map((l) => ({
          code: l['code'] as string,
          name: l['name'] as string,
          behavior: l['behavior'] as CostingTemplateLine['behavior'],
          driver: l['driver'] as CostingTemplateLine['driver'],
          amountBasis: l['amountBasis'] as CostingTemplateLine['amountBasis'],
          defaultValue: (l['defaultValue'] as number | null) ?? null,
          glAccountNumber: (l['glAccountNumber'] as string).trim() || null,
          glAccountName: (l['glAccountName'] as string).trim() || null,
        })),
      })
      .subscribe({
        next: (saved) => this.ref.close(saved),
        error: () => {
          this.saving.set(false);
          this.error.set(true);
        },
      });
  }

  protected cancel(): void {
    this.ref.close();
  }
}
