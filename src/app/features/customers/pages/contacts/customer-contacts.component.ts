import { ChangeDetectionStrategy, Component } from '@angular/core';

import { StubPageComponent } from '../../../../shared/components/stub-page/stub-page.component';

@Component({
  selector: 'app-customer-contacts-page',
  standalone: true,
  imports: [StubPageComponent],
  template: `
    <app-stub-page
      title="customers.contactsPage.title"
      subtitle="customers.contactsPage.subtitle"
      icon="contacts"
      emptyMessage="customers.contactsPage.placeholderMessage"
      emptyHelp="customers.contactsPage.placeholderHelp" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerContactsPageComponent {}
