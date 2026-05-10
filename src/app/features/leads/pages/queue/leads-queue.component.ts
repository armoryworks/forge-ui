import { ChangeDetectionStrategy, Component } from '@angular/core';

import { StubPageComponent } from '../../../../shared/components/stub-page/stub-page.component';

@Component({
  selector: 'app-leads-queue',
  standalone: true,
  imports: [StubPageComponent],
  template: `
    <app-stub-page
      title="leads.queue.title"
      subtitle="leads.queue.subtitle"
      icon="speed"
      emptyMessage="leads.queue.placeholderMessage"
      emptyHelp="leads.queue.placeholderHelp" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadsQueueComponent {}
