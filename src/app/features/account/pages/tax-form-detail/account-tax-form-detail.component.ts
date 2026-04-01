import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe, UpperCasePipe } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { environment } from '../../../../../environments/environment';
import { FileUploadZoneComponent, UploadedFile } from '../../../../shared/components/file-upload-zone/file-upload-zone.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { ComplianceFormDefinition } from '../../../../shared/models/compliance-form-definition.model';
import { ComplianceFormRendererComponent } from '../../components/compliance-form-renderer/compliance-form-renderer.component';
import { EmployeeProfileService } from '../../services/employee-profile.service';
import { ComplianceFormService } from '../../services/compliance-form.service';
import { IdentityDocument, IdentityDocumentType, IDENTITY_DOC_LIST_A, IDENTITY_DOC_LIST_B, IDENTITY_DOC_LIST_C } from '../../models/compliance-form.model';

@Component({
  selector: 'app-account-tax-form-detail',
  standalone: true,
  imports: [DatePipe, UpperCasePipe, MatTooltipModule, TranslatePipe, FileUploadZoneComponent, ComplianceFormRendererComponent, DialogComponent],
  templateUrl: './account-tax-form-detail.component.html',
  styleUrl: './account-tax-form-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountTaxFormDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly complianceService = inject(ComplianceFormService);
  private readonly profileService = inject(EmployeeProfileService);
  private readonly authService = inject(AuthService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly formType = toSignal(
    this.route.paramMap.pipe(map(p => p.get('formType') as string)),
    { initialValue: '' },
  );

  protected readonly userId = computed(() => this.authService.user()?.id ?? 0);
  protected readonly templates = this.complianceService.templates;
  protected readonly submissions = this.complianceService.submissions;
  protected readonly identityDocuments = this.complianceService.identityDocuments;
  protected readonly submitting = signal(false);
  protected readonly acknowledging = signal(false);
  protected readonly savingDraft = signal(false);
  protected readonly resubmitting = signal(false);
  protected readonly downloadingPdf = signal(false);
  protected readonly showDocsDialog = signal(false);
  protected readonly stateDefinitionLoaded = signal(false);
  private readonly stateFormDef = signal<ComplianceFormDefinition | null>(null);
  protected readonly stateLabel = signal<string | null>(null);
  private readonly stateFormDefVersionId = signal<number | null>(null);

  protected readonly template = computed(() => {
    const ft = this.formType();
    const templates = this.templates();
    if (!ft || !templates.length) return null;
    return templates.find(t => t.profileCompletionKey === ft) ?? null;
  });

  protected readonly submission = computed(() => {
    const tmpl = this.template();
    const subs = this.submissions();
    if (!tmpl || !subs.length) return null;
    return subs.find(s => s.templateId === tmpl.id) ?? null;
  });

  protected readonly isComplete = computed(() => {
    const ft = this.formType();
    const c = this.profileService.completeness();
    if (!ft || !c) return false;
    const item = c.items.find(i => i.key === ft);
    return item?.isComplete ?? false;
  });

  /** Sensitive forms contain PII (SSN, etc.) — don't show data back after submission */
  protected readonly isSensitive = computed(() => {
    const ft = this.template()?.formType;
    return ft === 'W4' || ft === 'I9' || ft === 'StateWithholding';
  });

  /**
   * True when the template uses the fill-and-sign flow
   * (has AcroFieldMapJson + FilledPdfTemplateId configured).
   */
  protected readonly isFillAndSign = computed(() => {
    const tmpl = this.template();
    return !!(tmpl?.acroFieldMapJson && tmpl?.filledPdfTemplateId);
  });

  /**
   * True when the submission is awaiting employee DocuSeal signing
   * (fill-and-sign flow returned a docuSealSubmitUrl).
   */
  protected readonly pendingSigning = computed(() => {
    const sub = this.submission();
    if (!sub?.docuSealSubmitUrl) return false;
    return sub.status === 'Pending' || sub.status === 'Opened';
  });

  /** Whether to show the form in edit mode (not complete, or user chose to resubmit) */
  protected readonly showForm = computed(() => {
    if (this.resubmitting()) return true;
    if (this.pendingSigning()) return false;
    return !this.isComplete();
  });

  protected readonly completedDate = computed(() => {
    const sub = this.submission();
    return sub?.signedAt ?? null;
  });

  // Resolve the active form definition version ID (state-specific or template-based)
  protected readonly activeVersionId = computed<number | null>(() => {
    const stateVer = this.stateFormDefVersionId();
    if (stateVer) return stateVer;
    return this.template()?.currentFormDefinitionVersionId ?? null;
  });

  // Detect whether template should have an electronic form definition but doesn't yet
  protected readonly needsFormDefinition = computed(() => {
    const tmpl = this.template();
    if (!tmpl) return false;
    // Templates with sourceUrl (W-4, I-9) or auto-sync should have extracted definitions
    const extractableTypes: string[] = ['W4', 'I9', 'StateWithholding'];
    return (tmpl.sourceUrl || extractableTypes.includes(tmpl.formType))
      && !tmpl.currentFormDefinitionVersionId
      && !tmpl.docuSealTemplateId;
  });

  // Parse form definition from template JSON or state-specific definition
  protected readonly formDefinition = computed<ComplianceFormDefinition | null>(() => {
    // State withholding uses a per-state definition from the API
    const stateDef = this.stateFormDef();
    if (stateDef) return stateDef;

    const tmpl = this.template();
    if (!tmpl?.formDefinitionJson) return null;
    try {
      return JSON.parse(tmpl.formDefinitionJson) as ComplianceFormDefinition;
    } catch {
      return null;
    }
  });

  // Parse saved form data from submission JSON
  // Sensitive completed forms don't expose data back — user starts fresh on resubmit
  protected readonly savedFormData = computed<Record<string, unknown> | null>(() => {
    const sub = this.submission();
    if (!sub?.formDataJson) return null;
    // Don't pre-fill sensitive forms when resubmitting (SSN, etc.)
    if (this.isComplete() && this.resubmitting() && this.isSensitive()) return null;
    try {
      return JSON.parse(sub.formDataJson) as Record<string, unknown>;
    } catch {
      return null;
    }
  });

  /** Sanitized DocuSeal signing embed URL for the signing iframe. */
  protected readonly docuSealEmbedUrl = computed(() => {
    const url = this.submission()?.docuSealSubmitUrl;
    if (!url) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  // Embedded PDF — only for admin-uploaded files (external URLs like IRS block iframes)
  protected readonly pdfUrl = computed(() => {
    const tmpl = this.template();
    if (!tmpl?.manualOverrideFileId) return null;
    const url = `${environment.apiUrl}/files/${tmpl.manualOverrideFileId}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  // Download link — admin upload or external source URL
  protected readonly pdfDownloadUrl = computed(() => {
    const tmpl = this.template();
    if (!tmpl) return null;
    if (tmpl.manualOverrideFileId) return `${environment.apiUrl}/files/${tmpl.manualOverrideFileId}`;
    return tmpl.sourceUrl;
  });


  private static readonly WIZARD_PROFILE_KEYS = new Set([
    'w4', 'i9', 'state_withholding', 'direct_deposit', 'workers_comp', 'handbook',
  ]);

  protected readonly isWizardManaged = computed(() => {
    const ft = this.formType();
    return !!ft && AccountTaxFormDetailComponent.WIZARD_PROFILE_KEYS.has(ft);
  });

  /** I-9 must not be changed after completion per legal/regulatory requirements */
  protected readonly canResubmit = computed(() => this.formType() !== 'i9');

  /** Non-sensitive summary fields to display for completed wizard forms */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected readonly wizardFormSummary = computed<Record<string, any> | null>(() => {
    const ft = this.formType();
    const sub = this.submission();
    if (!ft || !sub?.formDataJson) return null;
    try {
      const d = JSON.parse(sub.formDataJson) as Record<string, unknown>;
      switch (ft) {
        case 'w4': return {
          filingStatus: String(d['w4FilingStatus'] ?? ''),
          multipleJobs: d['w4MultipleJobs'] ? 'Yes' : 'No',
          exempt: d['w4ExemptFromWithholding'] ? 'Yes — exempt from withholding' : 'No',
        };
        case 'i9': return {
          citizenshipStatus: this.getCitizenshipLabel(String(d['i9CitizenshipStatus'] ?? '')),
        };
        case 'state_withholding': return {
          filingStatus: String(d['stateFilingStatus'] ?? '—'),
          allowances: String(d['stateAllowances'] ?? '0'),
          additionalWithholding: String(d['stateAdditionalWithholding'] ?? '0'),
          exempt: d['stateExempt'] ? 'Yes' : 'No',
        };
        case 'direct_deposit': return {
          bankName: String(d['bankName'] ?? ''),
          accountType: String(d['accountType'] ?? ''),
          routingLast4: String(d['routingNumber'] ?? '').slice(-4).padStart(4, '•'),
          accountLast4: String(d['accountNumber'] ?? '').slice(-4).padStart(4, '•'),
        };
        default: return null;
      }
    } catch { return null; }
  });

  private getCitizenshipLabel(status: string): string {
    const labels: Record<string, string> = {
      '1': 'U.S. Citizen',
      '2': 'Noncitizen National of the United States',
      '3': 'Lawful Permanent Resident',
      '4': 'Alien Authorized to Work',
    };
    return labels[status] ?? status;
  }

  constructor() {
    // Redirect wizard-managed forms to the onboarding wizard ONLY when not yet complete.
    // Guard on completeness being loaded (null = still loading) to avoid premature redirects.
    effect(() => {
      const ft = this.formType();
      const completeness = this.profileService.completeness();
      if (!ft || !completeness || !AccountTaxFormDetailComponent.WIZARD_PROFILE_KEYS.has(ft)) return;
      const item = completeness.items.find(i => i.key === ft);
      if (!item?.isComplete) {
        this.router.navigate(['/onboarding']);
      }
    });

    // Load templates, submissions, and profile completeness when form type changes
    effect(() => {
      const ft = this.formType();
      if (ft) {
        this.complianceService.loadTemplates();
        this.complianceService.loadMySubmissions();
        this.profileService.load();
      }
    });

    // Load state-specific form definition for state withholding
    effect(() => {
      const ft = this.formType();
      if (ft === 'stateWithholding' && !this.stateDefinitionLoaded()) {
        this.stateDefinitionLoaded.set(true);
        this.complianceService.getMyStateDefinition().subscribe({
          next: (result) => {
            if (result.formDefinitionJson) {
              try {
                this.stateFormDef.set(JSON.parse(result.formDefinitionJson) as ComplianceFormDefinition);
                this.stateFormDefVersionId.set(result.formDefinitionVersionId);
              } catch { /* ignore parse errors */ }
            }
            if (result.stateName) {
              this.stateLabel.set(`${result.stateName} (${result.stateCode})`);
            }
          },
        });
      }
    });

    // Load identity docs when template requires them (separate effect to avoid loop)
    effect(() => {
      const tmpl = this.template();
      if (tmpl?.requiresIdentityDocs) {
        this.complianceService.loadMyIdentityDocuments();
      }
    });
  }

  protected startForm(): void {
    const tmpl = this.template();
    if (!tmpl) return;
    this.submitting.set(true);
    this.complianceService.createSubmission(tmpl.id).subscribe({
      next: () => {
        this.submitting.set(false);
        this.snackbar.success(this.translate.instant('account.formSubmissionStarted'));
      },
      error: () => this.submitting.set(false),
    });
  }

  protected onSaveFormData(data: Record<string, unknown>): void {
    const tmpl = this.template();
    if (!tmpl) return;
    this.savingDraft.set(true);
    this.complianceService.saveFormData(tmpl.id, JSON.stringify(data), this.activeVersionId()).subscribe({
      next: () => {
        this.savingDraft.set(false);
        this.snackbar.success(this.translate.instant('account.draftSaved'));
      },
      error: () => this.savingDraft.set(false),
    });
  }

  protected onSubmitFormData(data: Record<string, unknown>): void {
    const tmpl = this.template();
    if (!tmpl) return;
    this.submitting.set(true);
    this.complianceService.submitFormData(tmpl.id, JSON.stringify(data), this.activeVersionId()).subscribe({
      next: (updatedSubmission) => {
        this.submitting.set(false);
        this.resubmitting.set(false);
        if (updatedSubmission.docuSealSubmitUrl && updatedSubmission.status === 'Pending') {
          // Fill-and-sign: PDF filled, DocuSeal signing ceremony ready
          this.snackbar.success(this.translate.instant('account.formReadyToSign'));
        } else {
          this.snackbar.success(this.translate.instant('account.formSubmitted'));
          this.profileService.load();
        }
        // Refresh submissions so submission() signal reflects the new docuSealSubmitUrl
        this.complianceService.loadMySubmissions();
      },
      error: () => this.submitting.set(false),
    });
  }

  protected readonly extraValidation = () => {
    const tmpl = this.template();
    if (!tmpl?.requiresIdentityDocs) return [];
    const docs = this.identityDocuments();
    const hasA = docs.some(d => IDENTITY_DOC_LIST_A.includes(d.documentType));
    const hasB = docs.some(d => IDENTITY_DOC_LIST_B.includes(d.documentType));
    const hasC = docs.some(d => IDENTITY_DOC_LIST_C.includes(d.documentType));
    if (hasA || (hasB && hasC)) return [];
    if (hasB && !hasC) return [this.translate.instant('account.identityDocNeedListC')];
    if (hasC && !hasB) return [this.translate.instant('account.identityDocNeedListB')];
    return [this.translate.instant('account.identityDocRequired')];
  };

  protected downloadPdf(): void {
    const sub = this.submission();
    if (!sub) return;
    this.downloadingPdf.set(true);
    this.complianceService.downloadSubmissionPdf(sub.id).subscribe({
      next: (blob) => {
        this.downloadingPdf.set(false);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.template()?.name ?? 'form'}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.downloadingPdf.set(false),
    });
  }

  protected startResubmit(): void {
    this.resubmitting.set(true);
  }

  protected cancelResubmit(): void {
    this.resubmitting.set(false);
  }

  protected acknowledge(): void {
    const ft = this.formType();
    if (!ft) return;
    this.acknowledging.set(true);
    this.profileService.acknowledgeForm(ft).subscribe({
      next: () => {
        this.acknowledging.set(false);
        this.snackbar.success(this.translate.instant('account.formAcknowledged'));
        this.profileService.load();
      },
      error: () => this.acknowledging.set(false),
    });
  }

  protected onIdentityDocUploaded(event: UploadedFile, docType: IdentityDocumentType): void {
    this.complianceService.uploadIdentityDocument(docType, null, +event.id).subscribe({
      next: () => this.snackbar.success(this.translate.instant('account.documentUploaded')),
    });
  }

  protected deleteIdentityDoc(doc: IdentityDocument): void {
    this.complianceService.deleteIdentityDocument(doc.id).subscribe({
      next: () => this.snackbar.success(this.translate.instant('account.documentRemoved')),
    });
  }

  protected goBack(): void {
    this.router.navigate(['..'], { relativeTo: this.route });
  }
}
