import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { EmployeeProfileService } from '../../services/employee-profile.service';
import { ComplianceFormService } from '../../services/compliance-form.service';

interface AccountNavItem {
  path: string;
  label: string;
  icon: string;
  completionKeys?: string[];
  children?: AccountNavChild[];
}

interface AccountNavChild {
  path: string;
  label: string;
  icon: string;
  completionKey: string;
}

@Component({
  selector: 'app-account-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './account-sidebar.component.html',
  styleUrl: './account-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountSidebarComponent {
  private readonly router = inject(Router);
  private readonly profileService = inject(EmployeeProfileService);
  private readonly complianceService = inject(ComplianceFormService);
  private readonly translate = inject(TranslateService);

  protected readonly taxFormsExpanded = signal(false);
  protected readonly completeness = this.profileService.completeness;
  protected readonly templates = this.complianceService.templates;

  protected readonly taxFormChildren = computed<AccountNavChild[]>(() => {
    const templates = this.templates();
    return templates.map(t => ({
      path: `tax-forms/${t.profileCompletionKey}`,
      label: t.name,
      icon: t.icon,
      completionKey: t.profileCompletionKey,
    }));
  });

  protected readonly navItems: AccountNavItem[] = [
    { path: 'profile', label: this.translate.instant('account.profile'), icon: 'person' },
    { path: 'contact', label: this.translate.instant('account.contact'), icon: 'home', completionKeys: ['address'] },
    { path: 'emergency', label: this.translate.instant('account.emergency'), icon: 'emergency', completionKeys: ['emergency_contact'] },
    { path: 'documents', label: this.translate.instant('account.documents'), icon: 'folder' },
    { path: 'pay-stubs', label: this.translate.instant('account.payStubs'), icon: 'payments' },
    { path: 'tax-documents', label: this.translate.instant('account.taxDocuments'), icon: 'receipt_long' },
    { path: 'security', label: this.translate.instant('account.security'), icon: 'lock' },
  ];

  protected readonly taxFormsComplete = computed(() => {
    const c = this.completeness();
    if (!c) return null;
    const keys = ['w4', 'i9', 'state_withholding', 'direct_deposit', 'workers_comp', 'handbook'];
    const relevant = c.items.filter(i => keys.includes(i.key));
    if (relevant.length === 0) return null;
    return relevant.every(i => i.isComplete);
  });

  constructor() {
    this.complianceService.loadTemplates();
  }

  protected isItemComplete(item: AccountNavItem): boolean | null {
    if (!item.completionKeys?.length) return null;
    const c = this.completeness();
    if (!c) return null;
    const relevant = c.items.filter(i => item.completionKeys!.includes(i.key));
    if (relevant.length === 0) return null;
    return relevant.every(i => i.isComplete);
  }

  protected isChildComplete(child: AccountNavChild): boolean | null {
    const c = this.completeness();
    if (!c) return null;
    const item = c.items.find(i => i.key === child.completionKey);
    return item?.isComplete ?? null;
  }

  protected toggleTaxForms(): void {
    this.taxFormsExpanded.update(v => !v);
  }

  protected goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}
