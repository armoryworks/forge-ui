import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

import { AuthService } from '../../shared/services/auth.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ApprovalInboxComponent } from './components/approval-inbox/approval-inbox.component';
import { ApprovalWorkflowEditorComponent } from './components/approval-workflow-editor/approval-workflow-editor.component';

type ApprovalsTab = 'inbox' | 'workflows';

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [PageHeaderComponent, ApprovalInboxComponent, ApprovalWorkflowEditorComponent],
  templateUrl: './approvals.component.html',
  styleUrl: './approvals.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApprovalsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  protected readonly activeTab = toSignal(
    this.route.paramMap.pipe(map(p => (p.get('tab') as ApprovalsTab) ?? 'inbox')),
    { initialValue: 'inbox' as ApprovalsTab },
  );

  protected readonly canManageWorkflows = computed(() => {
    const roles = this.auth.user()?.roles ?? [];
    return roles.includes('Admin') || roles.includes('Manager');
  });

  protected switchTab(tab: ApprovalsTab): void {
    this.router.navigate(['..', tab], { relativeTo: this.route });
  }
}
