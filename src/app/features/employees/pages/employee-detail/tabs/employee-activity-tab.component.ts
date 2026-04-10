import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';

import { EmployeeService } from '../../../services/employee.service';
import { ActivityTimelineComponent } from '../../../../../shared/components/activity-timeline/activity-timeline.component';

@Component({
  selector: 'app-employee-activity-tab',
  standalone: true,
  imports: [ActivityTimelineComponent],
  templateUrl: './employee-activity-tab.component.html',
  styleUrl: '../employee-detail-tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeActivityTabComponent implements OnInit {
  private readonly employeeService = inject(EmployeeService);

  readonly employeeId = input.required<number>();

  protected readonly activities = signal<unknown[]>([]);
  protected readonly loading = signal(false);

  ngOnInit(): void {
    this.loading.set(true);
    this.employeeService.getActivity(this.employeeId()).subscribe({
      next: data => { this.activities.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
