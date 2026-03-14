import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';

import { EmployeeProfileService } from '../../services/employee-profile.service';
import { ComplianceFormService } from '../../services/compliance-form.service';

@Component({
  selector: 'app-account-tax-forms',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './account-tax-forms.component.html',
  styleUrl: './account-tax-forms.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountTaxFormsComponent {
  private readonly profileService = inject(EmployeeProfileService);
  private readonly complianceService = inject(ComplianceFormService);

  protected readonly templates = this.complianceService.templates;
  protected readonly completeness = this.profileService.completeness;
  protected readonly profile = this.profileService.profile;

  constructor() {
    this.complianceService.loadTemplates();
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
