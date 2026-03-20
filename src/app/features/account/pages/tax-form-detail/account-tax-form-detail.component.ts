import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
  imports: [DatePipe, UpperCasePipe, RouterLink, MatTooltipModule, TranslatePipe, FileUploadZoneComponent, ComplianceFormRendererComponent, DialogComponent],
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

  /** Whether to show the form in edit mode (not complete, or user chose to resubmit) */
  protected readonly showForm = computed(() => {
    if (this.resubmitting()) return true;
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


  constructor() {
    // Load templates + submissions when form type changes
    effect(() => {
      const ft = this.formType();
      if (ft) {
        this.complianceService.loadTemplates();
        this.complianceService.loadMySubmissions();
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
      next: () => {
        this.submitting.set(false);
        this.resubmitting.set(false);
        this.snackbar.success(this.translate.instant('account.formSubmitted'));
        this.profileService.load();
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
