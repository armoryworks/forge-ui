import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { SelectComponent, SelectOption } from '../select/select.component';
import { TextareaComponent } from '../textarea/textarea.component';
import { TaxOverrideReason } from '../../models/tax-override-reason.type';

const REASONS: readonly TaxOverrideReason[] = ['Resale', 'ExemptOrganization', 'Government', 'OutOfJurisdiction', 'Other'];

/**
 * The exemption reason and note a person gives when a document's tax rate differs from the rate
 * computed for its customer. The API refuses the override without a reason, and without a note
 * when the reason is Other.
 */
@Component({
  selector: 'app-tax-override-fields',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, SelectComponent, TextareaComponent],
  templateUrl: './tax-override-fields.component.html',
  styleUrl: './tax-override-fields.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaxOverrideFieldsComponent {
  private readonly translate = inject(TranslateService);

  readonly reasonControl = input.required<FormControl<TaxOverrideReason | null>>();
  readonly noteControl = input.required<FormControl<string | null>>();
  readonly certificateOnFile = input(false);
  readonly testIdPrefix = input('tax-override');

  protected readonly reasonOptions: SelectOption[] = REASONS.map(reason => ({
    value: reason,
    label: this.translate.instant(`taxOverride.reasons.${reason}`),
  }));
}
