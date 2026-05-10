import { ChangeDetectionStrategy, Component } from '@angular/core';

import { StubPageComponent } from '../../../../shared/components/stub-page/stub-page.component';

@Component({
  selector: 'app-customer-portal-access-page',
  standalone: true,
  imports: [StubPageComponent],
  template: `
    <app-stub-page
      title="customers.portalAccessPage.title"
      subtitle="customers.portalAccessPage.subtitle"
      icon="vpn_key"
      emptyMessage="customers.portalAccessPage.placeholderMessage"
      emptyHelp="customers.portalAccessPage.placeholderHelp" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerPortalAccessPageComponent {}
