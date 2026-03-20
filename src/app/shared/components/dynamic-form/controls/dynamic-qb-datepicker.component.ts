import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ReactiveFormsModule, UntypedFormGroup } from '@angular/forms';

import { DynamicDatePickerModel } from '@danielhokanson/ng-dynamic-forms-core';

import { DatepickerComponent } from '../../datepicker/datepicker.component';

@Component({
  selector: 'dynamic-qb-datepicker',
  standalone: true,
  imports: [ReactiveFormsModule, DatepickerComponent],
  template: `
    <div [formGroup]="group">
      <app-datepicker
        [label]="model.label ?? ''"
        [formControlName]="model.id" />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicQbDatepickerComponent {
  @Input() group!: UntypedFormGroup;
  @Input() model!: DynamicDatePickerModel;
}
