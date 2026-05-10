import { ChangeDetectionStrategy, Component } from '@angular/core';

import { LeadsStubPageComponent } from '../leads-stub-page.component';

@Component({
  selector: 'app-leads-campaigns',
  standalone: true,
  imports: [LeadsStubPageComponent],
  template: `
    <app-leads-stub-page
      title="leads.campaigns.title"
      subtitle="leads.campaigns.subtitle"
      icon="campaign"
      emptyMessage="leads.campaigns.placeholderMessage"
      emptyHelp="leads.campaigns.placeholderHelp" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadsCampaignsComponent {}
