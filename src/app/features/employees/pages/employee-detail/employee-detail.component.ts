import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

import { EmployeeService } from '../../services/employee.service';
import { EmployeeDetail, EmployeeStats } from '../../models/employee.model';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { EmployeeOverviewTabComponent } from './tabs/employee-overview-tab.component';
import { EmployeeTimeTabComponent } from './tabs/employee-time-tab.component';
import { EmployeePayTabComponent } from './tabs/employee-pay-tab.component';
import { EmployeeTrainingTabComponent } from './tabs/employee-training-tab.component';
import { EmployeeComplianceTabComponent } from './tabs/employee-compliance-tab.component';
import { EmployeeJobsTabComponent } from './tabs/employee-jobs-tab.component';
import { EmployeeExpensesTabComponent } from './tabs/employee-expenses-tab.component';
import { EmployeeDocumentsTabComponent } from './tabs/employee-documents-tab.component';
import { EmployeeActivityTabComponent } from './tabs/employee-activity-tab.component';
import { EmployeeEventsTabComponent } from './tabs/employee-events-tab.component';

const TABS = ['overview', 'time', 'pay', 'training', 'compliance', 'jobs', 'events', 'expenses', 'documents', 'activity'] as const;
type EmployeeTab = typeof TABS[number];

@Component({
  selector: 'app-employee-detail',
  standalone: true,
  imports: [
    RouterLink, AvatarComponent,
    EmployeeOverviewTabComponent, EmployeeTimeTabComponent, EmployeePayTabComponent,
    EmployeeTrainingTabComponent, EmployeeComplianceTabComponent, EmployeeJobsTabComponent,
    EmployeeExpensesTabComponent, EmployeeDocumentsTabComponent, EmployeeActivityTabComponent,
    EmployeeEventsTabComponent,
  ],
  templateUrl: './employee-detail.component.html',
  styleUrl: './employee-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly employeeService = inject(EmployeeService);

  protected readonly employeeId = toSignal(
    this.route.paramMap.pipe(map(p => +p.get('id')!)),
    { initialValue: 0 },
  );

  protected readonly activeTab = toSignal(
    this.route.paramMap.pipe(map(p => (p.get('tab') ?? 'overview') as EmployeeTab)),
    { initialValue: 'overview' as EmployeeTab },
  );

  protected readonly employee = signal<EmployeeDetail | null>(null);
  protected readonly stats = signal<EmployeeStats | null>(null);
  protected readonly loading = signal(true);

  protected readonly displayName = computed(() => {
    const e = this.employee();
    if (!e) return '';
    return `${e.lastName}, ${e.firstName}`;
  });

  protected readonly tabs = TABS;

  constructor() {
    effect(() => {
      const id = this.employeeId();
      if (id > 0) {
        this.loadEmployee(id);
        this.loadStats(id);
      }
    });
  }

  private loadEmployee(id: number): void {
    this.loading.set(true);
    this.employeeService.getEmployee(id).subscribe({
      next: e => {
        this.employee.set(e);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.router.navigate(['/employees']);
      },
    });
  }

  private loadStats(id: number): void {
    this.employeeService.getEmployeeStats(id).subscribe({
      next: s => this.stats.set(s),
    });
  }

  protected switchTab(tab: EmployeeTab): void {
    this.router.navigate(['..', tab], { relativeTo: this.route });
  }

  protected tabLabel(tab: EmployeeTab): string {
    const labels: Record<EmployeeTab, string> = {
      overview: 'Overview',
      time: 'Time & Attendance',
      pay: 'Pay',
      training: 'Training',
      compliance: 'Compliance',
      jobs: 'Jobs',
      events: 'Events',
      expenses: 'Expenses',
      documents: 'Documents',
      activity: 'Activity',
    };
    return labels[tab];
  }
}
