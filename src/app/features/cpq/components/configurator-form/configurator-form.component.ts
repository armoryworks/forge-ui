import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { FormControl, FormRecord, ReactiveFormsModule, Validators } from '@angular/forms';

import { Subject, catchError, debounceTime, of, switchMap } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';

import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ConfiguratorDetail } from '../../models/configurator-detail.model';
import { ConfiguratorOption } from '../../models/configurator-option.model';
import { CpqResult } from '../../models/cpq-result.model';
import { CpqSelection } from '../../models/cpq-selection.model';
import { CpqService } from '../../services/cpq.service';
import { optionChoices, optionIsActive } from '../../utils/option-choices';

type OptionValue = string | string[] | boolean | number | null;

/** One option rendered in the configure form. */
interface OptionField {
  option: ConfiguratorOption;
  control: FormControl<OptionValue>;
  choices: SelectOption[];
  min: number | null;
  max: number | null;
}

/**
 * Fills a configurator's options with the right control per option type and prices them live through the API's
 * CPQ engine: validation errors, unit and extended price with its breakdown, lead time and the components the
 * options add. Options whose dependency does not hold are hidden and left out.
 */
@Component({
  selector: 'app-configurator-form',
  standalone: true,
  imports: [ReactiveFormsModule, DecimalPipe, CurrencyDisplayComponent, TranslatePipe, InputComponent, SelectComponent, ToggleComponent, LoadingBlockDirective],
  templateUrl: './configurator-form.component.html',
  styleUrl: './configurator-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfiguratorFormComponent implements OnInit {
  private readonly cpq = inject(CpqService);
  private readonly destroyRef = inject(DestroyRef);

  readonly configurator = input.required<ConfiguratorDetail>();
  readonly selectionChange = output<CpqSelection>();
  readonly resultChange = output<CpqResult | null>();

  protected readonly quantity = new FormControl<number | null>(1, [Validators.required, Validators.min(0.0001)]);
  protected readonly form = new FormRecord<FormControl<OptionValue>>({});
  protected readonly fields = signal<OptionField[]>([]);
  protected readonly selections = signal<Record<string, string>>({});
  protected readonly result = signal<CpqResult | null>(null);
  protected readonly pricing = signal(false);

  protected readonly visibleFields = computed(() => {
    const all = this.fields().map(f => f.option);
    const selections = this.selections();
    return this.fields().filter(f => optionIsActive(f.option, all, selections));
  });

  private readonly changes = new Subject<CpqSelection>();

  ngOnInit(): void {
    const fields = [...this.configurator().options]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(option => {
        const { choices, min, max } = optionChoices(option);
        const control = new FormControl<OptionValue>(initialValue(option));
        this.form.addControl(option.name, control);
        return { option, control, choices: choices.map(c => ({ value: c.value, label: c.label })), min, max };
      });
    this.fields.set(fields);

    this.changes.pipe(
      debounceTime(300),
      switchMap(selection => {
        this.pricing.set(true);
        return this.cpq.configure(this.configurator().id, selection.selections, selection.quantity).pipe(catchError(() => of(null)));
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(result => {
      this.pricing.set(false);
      this.result.set(result);
      this.resultChange.emit(result);
    });

    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.emit());
    this.quantity.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.emit());
    this.emit();
  }

  private emit(): void {
    const quantity = this.quantity.value ?? 0;
    const selections: Record<string, string> = {};
    for (const field of this.fields()) {
      const text = toSelectionText(field.control.value);
      if (text !== null) selections[field.option.name] = text;
    }
    this.selections.set(selections);
    const visible = new Set(this.visibleFields().map(f => f.option.name));
    const active = Object.fromEntries(Object.entries(selections).filter(([name]) => visible.has(name)));
    const selection = { selections: active, quantity };
    this.selectionChange.emit(selection);
    if (quantity > 0) this.changes.next(selection);
  }
}

function initialValue(option: ConfiguratorOption): OptionValue {
  const value = option.defaultValue?.trim() || null;
  switch (option.optionType) {
    case 'Checkbox': return value !== null && ['true', 'yes', '1', 'on'].includes(value.toLowerCase());
    case 'MultiSelect': return value ? value.split(',').map(v => v.trim()).filter(v => v) : [];
    case 'Numeric':
    case 'Quantity': return value !== null && !isNaN(Number(value)) ? Number(value) : null;
    default: return value;
  }
}

function toSelectionText(value: OptionValue): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return value.length > 0 ? value.join(',') : null;
  const text = String(value).trim();
  return text ? text : null;
}
