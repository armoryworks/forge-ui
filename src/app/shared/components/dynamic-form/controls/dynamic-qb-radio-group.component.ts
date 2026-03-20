import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ReactiveFormsModule, UntypedFormGroup } from '@angular/forms';

import { DynamicRadioGroupModel } from '@danielhokanson/ng-dynamic-forms-core';

@Component({
  selector: 'dynamic-qb-radio-group',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div [formGroup]="group">
      <div class="compliance-form__radio-group">
        <span class="compliance-form__radio-label">{{ model.label }}</span>
        @if (model.hint) {
          <span class="compliance-form__radio-hint">{{ model.hint }}</span>
        }
        @for (option of radioOptions; track option.value) {
          <label class="compliance-form__radio-option"
            [class.compliance-form__radio-option--selected]="group.get(model.id)?.value === option.value">
            <input type="radio"
              [formControlName]="model.id"
              [value]="option.value"
              [attr.aria-label]="option.label" />
            <span class="compliance-form__radio-indicator"></span>
            <span class="compliance-form__radio-text">
              <span class="compliance-form__radio-text-label">{{ option.label }}</span>
            </span>
          </label>
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicQbRadioGroupComponent {
  @Input() group!: UntypedFormGroup;
  @Input() model!: DynamicRadioGroupModel<string>;

  get radioOptions(): { value: string; label: string }[] {
    const opts = this.model.options;
    if (!Array.isArray(opts)) return [];
    return opts.map(o => ({ value: o.value as string, label: o.label ?? String(o.value) }));
  }
}
