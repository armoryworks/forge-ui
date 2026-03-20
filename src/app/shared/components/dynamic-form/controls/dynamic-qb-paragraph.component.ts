import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';

import { DynamicFormControlModel } from '@danielhokanson/ng-dynamic-forms-core';

@Component({
  selector: 'dynamic-qb-paragraph',
  standalone: true,
  template: `
    <div class="dynamic-form-paragraph">
      @for (line of paragraphs; track $index) {
        <p>{{ line }}</p>
      }
    </div>`,
  styles: [`
    .dynamic-form-paragraph {
      font-size: 10px;
      color: var(--text);
      margin: 0;
      line-height: 1.45;

      p {
        margin: 0 0 4px;
        &:last-child { margin-bottom: 0; }
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicQbParagraphComponent {
  @Input() group!: UntypedFormGroup;
  @Input() model!: DynamicFormControlModel;

  get paragraphs(): string[] {
    const label = this.model?.label ?? '';
    return label.split('\n\n').filter(Boolean);
  }
}
