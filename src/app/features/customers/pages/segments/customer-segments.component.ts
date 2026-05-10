import { ChangeDetectionStrategy, Component } from '@angular/core';

import { StubPageComponent } from '../../../../shared/components/stub-page/stub-page.component';

@Component({
  selector: 'app-customer-segments-page',
  standalone: true,
  imports: [StubPageComponent],
  template: `
    <app-stub-page
      title="customers.segmentsPage.title"
      subtitle="customers.segmentsPage.subtitle"
      icon="filter_alt"
      emptyMessage="customers.segmentsPage.placeholderMessage"
      emptyHelp="customers.segmentsPage.placeholderHelp" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerSegmentsPageComponent {}
