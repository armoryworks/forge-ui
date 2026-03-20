import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';

import { DynamicFormControlModel } from '@danielhokanson/ng-dynamic-forms-core';

@Component({
  selector: 'dynamic-qb-heading',
  standalone: true,
  template: `<h4 class="dynamic-form-heading">{{ model.label }}</h4>`,
  styles: [`
    .dynamic-form-heading {
      font-size: 10px;
      font-weight: 700;
      margin: 4px 0 0;
      color: var(--text);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicQbHeadingComponent {
  @Input() group!: UntypedFormGroup;
  @Input() model!: DynamicFormControlModel;
}
