import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { EmployeeDetail } from '../../../models/employee.model';

@Component({
  selector: 'app-employee-overview-tab',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './employee-overview-tab.component.html',
  styleUrl: '../employee-detail-tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeOverviewTabComponent {
  readonly employee = input.required<EmployeeDetail>();
}
