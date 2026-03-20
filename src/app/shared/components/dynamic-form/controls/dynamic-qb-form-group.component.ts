import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ReactiveFormsModule, UntypedFormGroup } from '@angular/forms';

import { DynamicFormGroupModel } from '@danielhokanson/ng-dynamic-forms-core';

import { DynamicQbFormControlComponent } from '../dynamic-qb-form-control.component';

@Component({
  selector: 'dynamic-qb-form-group',
  standalone: true,
  imports: [ReactiveFormsModule, DynamicQbFormControlComponent],
  template: `
    <fieldset class="dynamic-form-group" [formGroup]="nestedGroup" [attr.aria-label]="model.legend ?? model.label">
      @if (model.legend) {
        <legend class="dynamic-form-group__legend">{{ model.legend }}</legend>
      }
      @for (controlModel of model.group; track controlModel.id) {
        @if (!controlModel.hidden) {
          <dynamic-qb-form-control
            [group]="nestedGroup"
            [model]="controlModel" />
        }
      }
    </fieldset>
  `,
  styles: [`
    .dynamic-form-group {
      border: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .dynamic-form-group__legend {
      font-size: 11px;
      font-weight: 700;
      margin-bottom: 4px;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicQbFormGroupComponent {
  @Input() group!: UntypedFormGroup;
  @Input() model!: DynamicFormGroupModel;

  get nestedGroup(): UntypedFormGroup {
    return this.group.get(this.model.id) as UntypedFormGroup;
  }
}
