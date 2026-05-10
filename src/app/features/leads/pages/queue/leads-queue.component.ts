import { ChangeDetectionStrategy, Component } from '@angular/core';

import { LeadsStubPageComponent } from '../leads-stub-page.component';

@Component({
  selector: 'app-leads-queue',
  standalone: true,
  imports: [LeadsStubPageComponent],
  template: `
    <app-leads-stub-page
      title="leads.queue.title"
      subtitle="leads.queue.subtitle"
      icon="speed"
      emptyMessage="leads.queue.placeholderMessage"
      emptyHelp="leads.queue.placeholderHelp" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadsQueueComponent {}
