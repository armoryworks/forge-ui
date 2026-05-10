import { ChangeDetectionStrategy, Component } from '@angular/core';

import { StubPageComponent } from '../../../../shared/components/stub-page/stub-page.component';

@Component({
  selector: 'app-leads-campaigns',
  standalone: true,
  imports: [StubPageComponent],
  template: `
    <app-stub-page
      title="leads.campaigns.title"
      subtitle="leads.campaigns.subtitle"
      icon="campaign"
      emptyMessage="leads.campaigns.placeholderMessage"
      emptyHelp="leads.campaigns.placeholderHelp" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadsCampaignsComponent {}
