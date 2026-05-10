import { ChangeDetectionStrategy, Component } from '@angular/core';

import { StubPageComponent } from '../../../../shared/components/stub-page/stub-page.component';

@Component({
  selector: 'app-customer-import-page',
  standalone: true,
  imports: [StubPageComponent],
  template: `
    <app-stub-page
      title="customers.importPage.title"
      subtitle="customers.importPage.subtitle"
      icon="upload_file"
      emptyMessage="customers.importPage.placeholderMessage"
      emptyHelp="customers.importPage.placeholderHelp" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerImportPageComponent {}
