import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent } from '../../../../shared/components/select/select.component';
import { SelectOption } from '../../../../shared/components/select/select.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { CostingQuickStartResult, CostingTemplate, CostingTemplateLine } from '../../models/costing.model';
import { CostingService } from '../../services/costing.service';

/**
 * Applies a costing template: pick a package (the shipped standard one, or any
 * user-built template), answer its per-category questions plus headcount/wage,
 * and the pools, budgets, and (FULLGL on) GL budget lines populate. Closes with
 * the applied result.
 */
@Component({
  selector: 'app-costing-quick-start-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    CurrencyInputComponent,
    DialogComponent,
    InputComponent,
    SelectComponent,
    ToggleComponent,
    ValidationButtonComponent,
  ],
  templateUrl: './costing-quick-start-dialog.component.html',
  styleUrl: './costing-quick-start-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CostingQuickStartDialogComponent {
  private readonly ref = inject(MatDialogRef<CostingQuickStartDialogComponent, CostingQuickStartResult | undefined>);
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(CostingService);
  private readonly translate = inject(TranslateService);

  protected readonly saving = signal(false);
  protected readonly error = signal(false);
  protected readonly templates = signal<CostingTemplate[]>([]);

  protected readonly templateControl = new FormControl<number | null>(null);
  private readonly selectedTemplateId = toSignal(this.templateControl.valueChanges, { initialValue: null });

  protected readonly templateOptions = computed<SelectOption[]>(() =>
    this.templates().map((t) => ({ value: t.id, label: t.name })));

  protected readonly selectedTemplate = computed<CostingTemplate | null>(() =>
    this.templates().find((t) => t.id === this.selectedTemplateId()) ?? null);

  protected readonly form = this.fb.nonNullable.group({
    fiscalYear: [new Date().getFullYear(), [Validators.required, Validators.min(2000), Validators.max(2100)]],
    directHeadcount: [null as number | null, [Validators.required, Validators.min(0.5)]],
    averageHourlyWage: [null as number | null, [Validators.required, Validators.min(0.01)]],
    createGlBudgets: [true],
    setDefaultLaborRates: [false],
  });

  /** One control per selected-template line, keyed by line code. */
  protected readonly valuesForm = signal<FormGroup>(new FormGroup({}));

  protected readonly violations = FormValidationService.getViolations(this.form, {
    fiscalYear: 'Fiscal year',
    directHeadcount: 'Direct headcount',
    averageHourlyWage: 'Average hourly wage',
  });

  constructor() {
    this.service.getTemplates().subscribe({
      next: (templates) => {
        this.templates.set(templates);
        if (templates.length > 0) this.templateControl.setValue(templates[0].id);
      },
      error: () => this.error.set(true),
    });

    // Rebuild the per-line value controls whenever the template changes.
    effect(() => {
      const template = this.selectedTemplate();
      const group: Record<string, FormControl<number | null>> = {};
      for (const line of template?.lines ?? []) {
        group[line.code] = new FormControl<number | null>(
          line.defaultValue, [Validators.min(0)]);
      }
      this.valuesForm.set(new FormGroup(group));
    });
  }

  protected lineSuffix(line: CostingTemplateLine): string {
    return this.translate.instant(`costing.quickStart.basisSuffix.${line.amountBasis}`);
  }

  protected isPercent(line: CostingTemplateLine): boolean {
    return line.amountBasis === 'PercentOfWages';
  }

  protected apply(): void {
    const template = this.selectedTemplate();
    if (!template || this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.error.set(false);
    const v = this.form.getRawValue();
    const raw = this.valuesForm().getRawValue() as Record<string, number | null>;
    const values: Record<string, number> = {};
    for (const [code, value] of Object.entries(raw)) {
      if (value != null) values[code] = value;
    }
    this.service
      .applyTemplate(template.id, {
        fiscalYear: v.fiscalYear,
        directHeadcount: v.directHeadcount!,
        averageHourlyWage: v.averageHourlyWage!,
        values,
        createGlBudgets: v.createGlBudgets,
        setDefaultLaborRates: v.setDefaultLaborRates,
      })
      .subscribe({
        next: (result) => this.ref.close(result),
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
