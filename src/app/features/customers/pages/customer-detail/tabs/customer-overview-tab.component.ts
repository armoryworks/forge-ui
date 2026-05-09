import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { CustomerSummary } from '../../../models/customer-summary.model';
import { CreditStatusCardComponent } from '../../../components/credit-status-card/credit-status-card.component';
import { CapDirective } from '../../../../../shared/directives/cap.directive';
import { RecentCommunicationsComponent } from '../../../../../shared/components/recent-communications/recent-communications.component';

@Component({
  selector: 'app-customer-overview-tab',
  standalone: true,
  imports: [DatePipe, TranslatePipe, CreditStatusCardComponent, CapDirective, RecentCommunicationsComponent],
  templateUrl: './customer-overview-tab.component.html',
  styleUrl: '../customer-detail-tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerOverviewTabComponent {
  readonly customer = input.required<CustomerSummary>();
}
