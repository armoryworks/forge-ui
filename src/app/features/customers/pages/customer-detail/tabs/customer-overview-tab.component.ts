import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { CustomerSummary } from '../../../models/customer-summary.model';

@Component({
  selector: 'app-customer-overview-tab',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './customer-overview-tab.component.html',
  styleUrl: '../customer-detail-tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerOverviewTabComponent {
  readonly customer = input.required<CustomerSummary>();
}
