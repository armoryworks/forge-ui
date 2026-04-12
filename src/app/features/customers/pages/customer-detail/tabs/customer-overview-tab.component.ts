import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { CustomerSummary } from '../../../models/customer-summary.model';
import { CreditStatusCardComponent } from '../../../components/credit-status-card/credit-status-card.component';

@Component({
  selector: 'app-customer-overview-tab',
  standalone: true,
  imports: [DatePipe, CreditStatusCardComponent],
  templateUrl: './customer-overview-tab.component.html',
  styleUrl: '../customer-detail-tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerOverviewTabComponent {
  readonly customer = input.required<CustomerSummary>();
}
