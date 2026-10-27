import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';

import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';
import { AuthService } from '../../shared/services/auth.service';
import { LEAVE_APPROVER_ROLES, LEAVE_READER_ROLES, LeaveTab } from './models/leave-tab.model';
import { MyLeaveComponent } from './components/my-leave/my-leave.component';
import { LeaveApprovalsComponent } from './components/leave-approvals/leave-approvals.component';
import { LeaveBalancesComponent } from './components/leave-balances/leave-balances.component';
import { LeavePoliciesComponent } from './components/leave-policies/leave-policies.component';

interface LeaveTabItem {
  key: LeaveTab;
  icon: string;
  labelKey: string;
}

@Component({
  selector: 'app-leave',
  standalone: true,
  imports: [
    TranslatePipe,
    PageLayoutComponent,
    MyLeaveComponent,
    LeaveApprovalsComponent,
    LeaveBalancesComponent,
    LeavePoliciesComponent,
  ],
  templateUrl: './leave.component.html',
  styleUrl: './leave.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeaveComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  protected readonly activeTab = toSignal(
    this.route.paramMap.pipe(map(p => (p.get('tab') as LeaveTab | null) ?? 'mine')),
    { initialValue: 'mine' as LeaveTab },
  );

  protected readonly isReader = computed(() => this.auth.hasAnyRole([...LEAVE_READER_ROLES]));
  protected readonly canDecide = computed(() => this.auth.hasAnyRole([...LEAVE_APPROVER_ROLES]));
  protected readonly isAdmin = computed(() => this.auth.hasRole('Admin'));

  protected readonly tabs = computed<LeaveTabItem[]>(() => {
    const tabs: LeaveTabItem[] = [{ key: 'mine', icon: 'beach_access', labelKey: 'leave.tabs.mine' }];
    if (this.isReader()) {
      tabs.push(
        { key: 'team', icon: 'how_to_reg', labelKey: 'leave.tabs.team' },
        { key: 'balances', icon: 'account_balance_wallet', labelKey: 'leave.tabs.balances' },
        { key: 'policies', icon: 'policy', labelKey: 'leave.tabs.policies' },
      );
    }
    return tabs;
  });

  protected switchTab(tab: LeaveTab): void {
    this.router.navigate(['..', tab], { relativeTo: this.route });
  }
}
