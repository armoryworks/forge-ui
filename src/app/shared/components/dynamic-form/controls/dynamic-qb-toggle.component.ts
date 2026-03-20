import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ReactiveFormsModule, UntypedFormGroup } from '@angular/forms';

import { DynamicSwitchModel } from '@danielhokanson/ng-dynamic-forms-core';

import { ToggleComponent } from '../../toggle/toggle.component';

@Component({
  selector: 'dynamic-qb-toggle',
  standalone: true,
  imports: [ReactiveFormsModule, ToggleComponent],
  template: `
    <div [formGroup]="group">
      <app-toggle
        [label]="model.label ?? ''"
        [formControlName]="model.id" />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicQbToggleComponent {
  @Input() group!: UntypedFormGroup;
  @Input() model!: DynamicSwitchModel;
}
