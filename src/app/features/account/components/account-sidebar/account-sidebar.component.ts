import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { completenessItemStatus, EmployeeProfileService, WIZARD_FORM_KEYS } from '../../services/employee-profile.service';
import { ComplianceFormService } from '../../services/compliance-form.service';
import { OnboardingService } from '../../../onboarding/onboarding.service';
import { LayoutService } from '../../../../shared/services/layout.service';
import { ScrollCueDirective } from '../../../../shared/directives/scroll-cue.directive';

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
  imports: [ScrollCueDirective, RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './account-sidebar.component.html',
  styleUrl: './account-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountSidebarComponent {
  private readonly router = inject(Router);
  private readonly layout = inject(LayoutService);
  private readonly profileService = inject(EmployeeProfileService);
  private readonly complianceService = inject(ComplianceFormService);
  private readonly onboardingService = inject(OnboardingService);
  private readonly translate = inject(TranslateService);

  protected readonly taxFormsExpanded = signal(false);
  protected readonly completeness = this.profileService.completeness;
  protected readonly templates = this.complianceService.templates;
  protected readonly onboardingStatus = this.onboardingService.status;

  protected readonly onboardingComplete = computed(() => {
    const s = this.onboardingStatus();
    if (!s) return null;
    return s.allComplete;
  });

  protected readonly taxFormChildren = computed<AccountNavChild[]>(() => {
    const templates = this.templates();
    return templates.map(t => ({
      // Wizard-managed forms route to /onboarding; others keep their own route
      path: WIZARD_FORM_KEYS.includes(t.profileCompletionKey)
        ? '/onboarding'
        : `tax-forms/${t.profileCompletionKey}`,
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
    { path: 'customization', label: this.translate.instant('account.customization'), icon: 'palette' },
    { path: 'integrations', label: 'Integrations', icon: 'extension' },
    { path: 'communications', label: this.translate.instant('account.communications.navLabel'), icon: 'forum' },
  ];

  protected readonly taxFormsComplete = computed(() => {
    const c = this.completeness();
    if (!c) return null;
    const relevant = c.items.filter(i => WIZARD_FORM_KEYS.includes(i.key));
    if (relevant.length === 0) return c.isComplete ? true : null;
    return relevant.every(i => i.isComplete);
  });

  constructor() {
    this.complianceService.loadTemplates();
    this.onboardingService.loadStatus();
  }

  protected isItemComplete(item: AccountNavItem): boolean | null {
    if (!item.completionKeys?.length) return null;
    const c = this.completeness();
    if (!c) return null;
    const relevant = c.items.filter(i => item.completionKeys!.includes(i.key));
    if (relevant.length === 0) return c.isComplete ? true : null;
    return relevant.every(i => i.isComplete);
  }

  protected isChildComplete(child: AccountNavChild): boolean | null {
    return completenessItemStatus(this.completeness(), child.completionKey);
  }

  protected readonly onTaxFormsPage = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects.startsWith('/account/tax-forms')),
    ),
    { initialValue: this.router.url.startsWith('/account/tax-forms') },
  );

  protected toggleTaxForms(): void {
    this.taxFormsExpanded.update(v => !v);
  }

  protected goBack(): void {
    this.router.navigate([this.layout.getDefaultRoute()]);
  }
}
