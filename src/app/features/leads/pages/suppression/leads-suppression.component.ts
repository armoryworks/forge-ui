import { ChangeDetectionStrategy, Component } from '@angular/core';

import { LeadsStubPageComponent } from '../leads-stub-page.component';

@Component({
  selector: 'app-leads-suppression',
  standalone: true,
  imports: [LeadsStubPageComponent],
  template: `
    <app-leads-stub-page
      title="leads.suppression.title"
      subtitle="leads.suppression.subtitle"
      icon="block"
      emptyMessage="leads.suppression.placeholderMessage"
      emptyHelp="leads.suppression.placeholderHelp" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadsSuppressionComponent {}
