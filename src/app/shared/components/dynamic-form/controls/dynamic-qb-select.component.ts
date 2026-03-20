import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ReactiveFormsModule, UntypedFormGroup } from '@angular/forms';

import { DynamicSelectModel } from '@danielhokanson/ng-dynamic-forms-core';

import { SelectComponent, SelectOption } from '../../select/select.component';

@Component({
  selector: 'dynamic-qb-select',
  standalone: true,
  imports: [ReactiveFormsModule, SelectComponent],
  template: `
    <div [formGroup]="group">
      <app-select
        [label]="model.label ?? ''"
        [formControlName]="model.id"
        [options]="selectOptions"
        [multiple]="model.multiple"
        [placeholder]="model.placeholder"
        [required]="model.required" />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicQbSelectComponent {
  @Input() group!: UntypedFormGroup;
  @Input() model!: DynamicSelectModel<string>;

  get selectOptions(): SelectOption[] {
    const opts = this.model.options;
    if (!Array.isArray(opts)) return [];
    return opts.map(o => ({ value: o.value, label: o.label ?? String(o.value) }));
  }
}
