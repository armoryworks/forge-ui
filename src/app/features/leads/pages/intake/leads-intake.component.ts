import { ChangeDetectionStrategy, Component } from '@angular/core';

import { StubPageComponent } from '../../../../shared/components/stub-page/stub-page.component';

@Component({
  selector: 'app-leads-intake',
  standalone: true,
  imports: [StubPageComponent],
  template: `
    <app-stub-page
      title="leads.intake.title"
      subtitle="leads.intake.subtitle"
      icon="upload_file"
      emptyMessage="leads.intake.placeholderMessage"
      emptyHelp="leads.intake.placeholderHelp" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadsIntakeComponent {}
