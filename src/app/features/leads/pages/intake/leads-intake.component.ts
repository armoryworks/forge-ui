import { ChangeDetectionStrategy, Component } from '@angular/core';

import { LeadsStubPageComponent } from '../leads-stub-page.component';

@Component({
  selector: 'app-leads-intake',
  standalone: true,
  imports: [LeadsStubPageComponent],
  template: `
    <app-leads-stub-page
      title="leads.intake.title"
      subtitle="leads.intake.subtitle"
      icon="upload_file"
      emptyMessage="leads.intake.placeholderMessage"
      emptyHelp="leads.intake.placeholderHelp" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadsIntakeComponent {}
