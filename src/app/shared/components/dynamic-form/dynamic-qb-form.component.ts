import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';

import { DynamicFormControlModel, DynamicFormModel } from '@danielhokanson/ng-dynamic-forms-core';

import { DynamicQbFormControlComponent } from './dynamic-qb-form-control.component';

@Component({
  selector: 'dynamic-qb-form',
  standalone: true,
  imports: [DynamicQbFormControlComponent],
  template: `
    @for (controlModel of model; track controlModel.id) {
      @if (!controlModel.hidden) {
        <dynamic-qb-form-control
          [group]="group"
          [model]="controlModel" />
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicQbFormComponent {
  @Input() group!: UntypedFormGroup;
  @Input() model!: DynamicFormModel;

  trackByFn(_index: number, model: DynamicFormControlModel): string {
    return model.id;
  }
}
