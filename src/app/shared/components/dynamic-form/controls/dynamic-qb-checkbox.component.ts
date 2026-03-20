import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ReactiveFormsModule, UntypedFormGroup } from '@angular/forms';

import { DynamicCheckboxModel } from '@danielhokanson/ng-dynamic-forms-core';

@Component({
  selector: 'dynamic-qb-checkbox',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div [formGroup]="group">
      <label class="compliance-form__checkbox"
        [class.compliance-form__checkbox--checked]="group.get(model.id)?.value">
        <input type="checkbox"
          [formControlName]="model.id"
          class="compliance-form__checkbox-input"
          [attr.aria-label]="model.label" />
        <span class="compliance-form__checkbox-box">
          @if (group.get(model.id)?.value) {
            <span class="material-icons-outlined compliance-form__checkbox-check">check</span>
          }
        </span>
        <span class="compliance-form__checkbox-label">{{ model.label }}</span>
      </label>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicQbCheckboxComponent {
  @Input() group!: UntypedFormGroup;
  @Input() model!: DynamicCheckboxModel;
}
