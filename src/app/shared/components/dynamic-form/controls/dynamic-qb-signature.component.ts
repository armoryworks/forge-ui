import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ReactiveFormsModule, UntypedFormGroup } from '@angular/forms';

import { DynamicInputModel } from '@danielhokanson/ng-dynamic-forms-core';

import { InputComponent } from '../../input/input.component';

@Component({
  selector: 'dynamic-qb-signature',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent],
  template: `
    <div [formGroup]="group" class="qb-signature">
      <div class="qb-signature__header">
        <span class="material-icons-outlined qb-signature__icon">draw</span>
        <div>
          <span class="qb-signature__label">{{ model.label }}</span>
          @if (model.hint) {
            <span class="qb-signature__hint">{{ model.hint }}</span>
          }
        </div>
      </div>
      <div class="qb-signature__body">
        <div class="qb-signature__preview"
          [class.qb-signature__preview--empty]="!group.get(model.id)?.value">
          {{ group.get(model.id)?.value || 'Your signature will appear here' }}
        </div>
        <div class="qb-signature__line">
          <span class="qb-signature__x">X</span>
        </div>
        <app-input
          label="Type your full legal name"
          [formControlName]="model.id"
          [required]="model.required"
          [isReadonly]="model.readOnly" />
        <span class="qb-signature__disclaimer">
          By typing your name above, you are signing this form electronically.
          You agree this has the same legal effect as a handwritten signature.
        </span>
      </div>
    </div>
  `,
  styleUrl: './dynamic-qb-signature.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicQbSignatureComponent {
  @Input() group!: UntypedFormGroup;
  @Input() model!: DynamicInputModel;
}
