import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ReactiveFormsModule, UntypedFormGroup } from '@angular/forms';

import { DynamicTextAreaModel } from '@danielhokanson/ng-dynamic-forms-core';

import { TextareaComponent } from '../../textarea/textarea.component';

@Component({
  selector: 'dynamic-qb-textarea',
  standalone: true,
  imports: [ReactiveFormsModule, TextareaComponent],
  template: `
    <div [formGroup]="group">
      <app-textarea
        [label]="model.label ?? ''"
        [formControlName]="model.id"
        [rows]="model.rows"
        [maxlength]="model.maxLength" />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicQbTextareaComponent {
  @Input() group!: UntypedFormGroup;
  @Input() model!: DynamicTextAreaModel;
}
