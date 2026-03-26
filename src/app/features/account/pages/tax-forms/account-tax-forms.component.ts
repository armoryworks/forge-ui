import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

import { EmployeeProfileService } from '../../services/employee-profile.service';
import { ComplianceFormService } from '../../services/compliance-form.service';
import { OnboardingService } from '../../../onboarding/onboarding.service';

/** Form types handled by the unified onboarding wizard — link to /onboarding instead. */
const WIZARD_FORM_TYPES = new Set(['W4', 'I9', 'StateWithholding', 'DirectDeposit', 'WorkersComp', 'Handbook']);

@Component({
  selector: 'app-account-tax-forms',
  standalone: true,
  imports: [DatePipe, RouterLink, TranslatePipe],
  templateUrl: './account-tax-forms.component.html',
  styleUrl: './account-tax-forms.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountTaxFormsComponent {
  private readonly profileService = inject(EmployeeProfileService);
  private readonly complianceService = inject(ComplianceFormService);
  private readonly onboardingService = inject(OnboardingService);

  protected readonly templates = this.complianceService.templates;
  protected readonly completeness = this.profileService.completeness;
  protected readonly profile = this.profileService.profile;
  protected readonly onboardingStatus = this.onboardingService.status;

  constructor() {
    this.complianceService.loadTemplates();
    this.onboardingService.loadStatus();
  }

  /** Returns true when this form type is handled by the onboarding wizard. */
  protected isWizardForm(formType: string): boolean {
    return WIZARD_FORM_TYPES.has(formType);
  }

  /** Resolves the router link for a given template. */
  protected getLinkForTemplate(formType: string, profileKey: string): string[] {
    if (WIZARD_FORM_TYPES.has(formType)) {
      return ['/onboarding'];
    }
    return [profileKey];
  }

  protected isComplete(profileKey: string): boolean {
    const items = this.completeness()?.items;
    if (!items) return false;
    return items.find(i => i.key === profileKey)?.isComplete ?? false;
  }

  protected getCompletedDate(profileKey: string): string | null {
    const p = this.profile();
    if (!p) return null;
    const map: Record<string, string | null> = {
      w4: p.w4CompletedAt,
      i9: p.i9CompletedAt,
      directDeposit: p.directDepositCompletedAt,
      handbook: p.handbookAcknowledgedAt,
      workersComp: p.workersCompAcknowledgedAt,
      stateWithholding: p.stateWithholdingCompletedAt,
    };
    return map[profileKey] ?? null;
  }
}
