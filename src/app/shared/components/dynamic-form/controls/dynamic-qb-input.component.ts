import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ReactiveFormsModule, UntypedFormGroup } from '@angular/forms';

import { DynamicInputModel } from '@danielhokanson/ng-dynamic-forms-core';

import { InputComponent } from '../../input/input.component';

@Component({
  selector: 'dynamic-qb-input',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent],
  template: `
    <div [formGroup]="group">
      <app-input
        [label]="model.label ?? ''"
        [formControlName]="model.id"
        [type]="inputType"
        [placeholder]="model.placeholder ?? ''"
        [maxlength]="model.maxLength"
        [mask]="maskValue"
        [prefix]="model.prefix ?? ''"
        [suffix]="model.suffix ?? ''"
        [required]="model.required"
        [isReadonly]="model.readOnly" />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicQbInputComponent {
  @Input() group!: UntypedFormGroup;
  @Input() model!: DynamicInputModel;

  get inputType(): 'text' | 'number' | 'email' | 'password' {
    const t = this.model.inputType;
    if (t === 'number') return 'number';
    if (t === 'email') return 'email';
    if (t === 'password') return 'password';
    return 'text';
  }

  get maskValue(): 'phone' | 'zip' | 'ssn' | 'date' | null {
    const mask = this.model.getAdditional('mask');
    if (mask === 'phone' || mask === 'zip' || mask === 'ssn' || mask === 'date') return mask;
    return null;
  }
}
