import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { EmployeeDetail } from '../../../models/employee.model';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-employee-overview-tab',
  standalone: true,
  imports: [DatePipe, TranslatePipe],
  templateUrl: './employee-overview-tab.component.html',
  styleUrl: '../employee-detail-tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeOverviewTabComponent {
  readonly employee = input.required<EmployeeDetail>();
}
