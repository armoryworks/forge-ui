import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { Observable } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ConfiguratorDetail } from '../../models/configurator-detail.model';
import { ConfiguratorOption } from '../../models/configurator-option.model';
import { ConfiguratorOptionForm } from '../../models/configurator-option-form.model';
import { ConfiguratorOptionType } from '../../models/configurator-option-type.type';
import { ConfiguratorRequest } from '../../models/configurator-request.model';
import { CpqService } from '../../services/cpq.service';
import { jsonFieldValidator } from '../../utils/json-field.validator';
import { ConfiguratorFormComponent } from '../configurator-form/configurator-form.component';

const OPTION_TYPES: ConfiguratorOptionType[] = ['Select', 'MultiSelect', 'Checkbox', 'Quantity', 'Numeric', 'Text'];

/**
 * Creates or edits a configurator: base part and price, options (type, allowed values, default, dependency,
 * price adders, BOM and routing impact), validation rules and the pricing formula, with a test panel that prices
 * the saved configurator. Read-only for roles that may configure but not author.
 */
@Component({
  selector: 'app-configurator-editor-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, CurrencyInputComponent, DialogComponent, EntityPickerComponent, InputComponent,
    SelectComponent, TextareaComponent, ToggleComponent, ValidationButtonComponent, LoadingBlockDirective, ConfiguratorFormComponent],
  templateUrl: './configurator-editor-dialog.component.html',
  styleUrl: './configurator-editor-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfiguratorEditorDialogComponent implements OnInit {
  private readonly cpq = inject(CpqService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);

  readonly configuratorId = input<number | null>(null);
  readonly canEdit = input(false);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly detail = signal<ConfiguratorDetail | null>(null);
  protected readonly isEdit = computed(() => this.configuratorId() !== null);
  protected readonly typeOptions: SelectOption[] = OPTION_TYPES.map(t => ({ value: t, label: this.translate.instant(`cpq.optionTypes.${t}`) }));

  protected readonly options = new FormArray<ConfiguratorOptionForm>([]);
  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
    basePartId: new FormControl<number | null>(null, [Validators.required]),
    basePrice: new FormControl<number | null>(null, [Validators.min(0)]),
    isActive: new FormControl(true, { nonNullable: true }),
    validationRulesJson: new FormControl('', { nonNullable: true, validators: [jsonFieldValidator] }),
    pricingFormula: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
    options: this.options,
  });
  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: this.translate.instant('cpq.editor.name'),
    basePartId: this.translate.instant('cpq.editor.basePart'),
    basePrice: this.translate.instant('cpq.editor.basePrice'),
    validationRulesJson: this.translate.instant('cpq.editor.validationRules'),
    pricingFormula: this.translate.instant('cpq.editor.pricingFormula'),
  });

  ngOnInit(): void {
    const id = this.configuratorId();
    if (id === null) {
      this.addOption();
      return;
    }
    this.loading.set(true);
    this.cpq.getConfigurator(id).subscribe({
      next: detail => {
        this.applyDetail(detail);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private applyDetail(detail: ConfiguratorDetail): void {
    this.detail.set(detail);
    this.options.clear();
    for (const option of [...detail.options].sort((a, b) => a.sortOrder - b.sortOrder)) this.options.push(this.optionGroup(option));
    this.form.reset({
      name: detail.name,
      description: detail.description ?? '',
      basePartId: detail.basePartId,
      basePrice: detail.basePrice,
      isActive: detail.isActive,
      validationRulesJson: detail.validationRulesJson ?? '',
      pricingFormula: formulaText(detail.pricingFormulaJson),
    });
    if (!this.canEdit()) this.form.disable();
  }

  private optionGroup(option?: ConfiguratorOption): ConfiguratorOptionForm {
    return new FormGroup({
      name: new FormControl(option?.name ?? '', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
      optionType: new FormControl<ConfiguratorOptionType>(option?.optionType ?? 'Select', { nonNullable: true }),
      isRequired: new FormControl(option?.isRequired ?? false, { nonNullable: true }),
      valuesJson: new FormControl(option?.valuesJson ?? '[]', { nonNullable: true, validators: [jsonFieldValidator] }),
      defaultValue: new FormControl(option?.defaultValue ?? '', { nonNullable: true, validators: [Validators.maxLength(500)] }),
      dependsOnOptionId: new FormControl(option?.dependsOnOptionId ?? '', { nonNullable: true, validators: [Validators.maxLength(200)] }),
      helpText: new FormControl(option?.helpText ?? '', { nonNullable: true, validators: [Validators.maxLength(500)] }),
      pricingRuleJson: new FormControl(option?.pricingRuleJson ?? '', { nonNullable: true, validators: [jsonFieldValidator] }),
      bomImpactJson: new FormControl(option?.bomImpactJson ?? '', { nonNullable: true, validators: [jsonFieldValidator] }),
      routingImpactJson: new FormControl(option?.routingImpactJson ?? '', { nonNullable: true, validators: [jsonFieldValidator] }),
    });
  }

  protected addOption(): void {
    this.options.push(this.optionGroup());
    this.options.markAsDirty();
  }

  protected removeOption(index: number): void {
    this.options.removeAt(index);
    this.options.markAsDirty();
  }

  protected moveOption(index: number, delta: number): void {
    const target = index + delta;
    if (target < 0 || target >= this.options.length) return;
    const group = this.options.at(index);
    this.options.removeAt(index);
    this.options.insert(target, group);
    this.options.markAsDirty();
  }

  protected close(): void {
    this.closed.emit();
  }

  protected save(): void {
    if (this.form.invalid || this.saving() || !this.canEdit()) return;
    const v = this.form.getRawValue();
    const body: ConfiguratorRequest = {
      name: v.name.trim(),
      description: v.description.trim() || null,
      basePartId: v.basePartId!,
      basePrice: v.basePrice,
      isActive: v.isActive,
      validationRulesJson: v.validationRulesJson.trim() || null,
      pricingFormulaJson: v.pricingFormula.trim() ? JSON.stringify({ expression: v.pricingFormula.trim() }) : null,
      options: v.options.map((o, i) => ({
        name: o.name.trim(),
        optionType: o.optionType,
        valuesJson: o.valuesJson.trim() || '[]',
        pricingRuleJson: o.pricingRuleJson.trim() || null,
        bomImpactJson: o.bomImpactJson.trim() || null,
        routingImpactJson: o.routingImpactJson.trim() || null,
        dependsOnOptionId: o.dependsOnOptionId.trim() || null,
        sortOrder: (i + 1) * 10,
        isRequired: o.isRequired,
        helpText: o.helpText.trim() || null,
        defaultValue: o.defaultValue.trim() || null,
      })),
    };
    const id = this.configuratorId();
    this.saving.set(true);
    const request: Observable<unknown> = id === null ? this.cpq.createConfigurator(body) : this.cpq.updateConfigurator(id, body);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('cpq.editor.saved', { name: body.name }));
        this.form.markAsPristine();
        this.saved.emit();
        if (id !== null) this.cpq.getConfigurator(id).subscribe({ next: detail => this.detail.set(detail) });
      },
      error: () => this.saving.set(false),
    });
  }
}

function formulaText(json: string | null): string {
  const text = json?.trim();
  if (!text) return '';
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === 'string') return parsed;
    if (parsed && typeof parsed === 'object' && typeof (parsed as { expression?: unknown }).expression === 'string') {
      return (parsed as { expression: string }).expression;
    }
    return text;
  } catch {
    return text;
  }
}
