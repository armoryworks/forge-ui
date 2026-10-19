import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { EmployeeService } from '../../services/employee.service';
import { EmployeeDetail, EmployeeStats } from '../../models/employee.model';
import { EmployeeKind } from '../../models/employee-kind.model';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { DetailLoadErrorComponent } from '../../../../shared/components/detail-load-error/detail-load-error.component';
import { notFoundError } from '../../../../shared/utils/not-found-error';
import { parsePositiveId } from '../../../../shared/utils/parse-positive-id';
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
import { EMPLOYEE_TABS, EmployeeTab } from '../../models/employee-tab.model';

function toKind(value: string | null): EmployeeKind | null {
  return value === 'user' || value === 'profile' ? value : null;
}

@Component({
  selector: 'app-employee-detail',
  standalone: true,
  imports: [
    RouterLink, TranslatePipe, AvatarComponent, DetailLoadErrorComponent,
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
  private readonly translate = inject(TranslateService);

  protected readonly employeeId = toSignal(
    this.route.paramMap.pipe(map(p => parsePositiveId(p.get('id')))),
    { initialValue: null },
  );

  protected readonly employeeKind = toSignal(
    this.route.queryParamMap.pipe(map(q => toKind(q.get('kind')))),
    { initialValue: toKind(this.route.snapshot.queryParamMap.get('kind')) },
  );

  protected readonly activeTab = toSignal(
    this.route.paramMap.pipe(map(p => (p.get('tab') ?? 'overview') as EmployeeTab)),
    { initialValue: 'overview' as EmployeeTab },
  );

  protected readonly employee = signal<EmployeeDetail | null>(null);
  protected readonly stats = signal<EmployeeStats | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<unknown>(null);

  protected readonly displayName = computed(() => {
    const e = this.employee();
    if (!e) return '';
    return `${e.lastName}, ${e.firstName}`;
  });

  protected readonly hasLogin = computed(() => this.employee()?.hasLogin !== false);

  protected readonly tabs = computed<readonly EmployeeTab[]>(() => this.hasLogin() ? EMPLOYEE_TABS : ['overview']);

  constructor() {
    effect(() => {
      const id = this.employeeId();
      const kind = this.employeeKind();
      if (id) {
        this.loadEmployee(id, kind);
      } else {
        this.employee.set(null);
        this.loadError.set(notFoundError());
        this.loading.set(false);
      }
    });
  }

  private loadEmployee(id: number, kind: EmployeeKind | null): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.stats.set(null);
    this.employeeService.getEmployee(id, kind).subscribe({
      next: e => {
        this.employee.set(e);
        this.loading.set(false);
        if (e.hasLogin !== false) {
          this.loadStats(id);
        } else if (this.activeTab() !== 'overview') {
          this.switchTab('overview');
        }
      },
      error: (err: unknown) => {
        this.employee.set(null);
        this.loadError.set(err);
        this.loading.set(false);
      },
    });
  }

  protected reloadEmployee(): void {
    const id = this.employeeId();
    if (id) this.loadEmployee(id, this.employeeKind());
  }

  protected backToList(): void {
    this.router.navigate(['/employees']);
  }

  private loadStats(id: number): void {
    this.employeeService.getEmployeeStats(id).subscribe({
      next: s => this.stats.set(s),
    });
  }

  protected switchTab(tab: EmployeeTab): void {
    this.router.navigate(['..', tab], { relativeTo: this.route, queryParamsHandling: 'preserve' });
  }

  protected tabLabel(tab: EmployeeTab): string {
    return this.translate.instant(`employees.detail.tabs.${tab}`);
  }
}
