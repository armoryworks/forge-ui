import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { FileUploadZoneComponent } from '../../../../shared/components/file-upload-zone/file-upload-zone.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { EmployeeProfileService } from '../../services/employee-profile.service';
import { ComplianceFormService } from '../../services/compliance-form.service';
import { UploadedFile } from '../../../../shared/components/file-upload-zone/file-upload-zone.component';
import { ComplianceFormTemplate, ComplianceFormSubmission, ComplianceFormType, IdentityDocument, IdentityDocumentType } from '../../models/compliance-form.model';

@Component({
  selector: 'app-account-tax-form-detail',
  standalone: true,
  imports: [DatePipe, RouterLink, FileUploadZoneComponent],
  templateUrl: './account-tax-form-detail.component.html',
  styleUrl: './account-tax-form-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountTaxFormDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly complianceService = inject(ComplianceFormService);
  private readonly profileService = inject(EmployeeProfileService);
  private readonly authService = inject(AuthService);
  private readonly snackbar = inject(SnackbarService);

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

  protected readonly completedDate = computed(() => {
    const sub = this.submission();
    return sub?.signedAt ?? null;
  });

  // Identity document type options for I-9
  protected readonly identityDocTypes: { value: IdentityDocumentType; label: string }[] = [
    { value: 'BirthCertificate', label: 'Birth Certificate' },
    { value: 'DriversLicense', label: "Driver's License" },
    { value: 'SsnCard', label: 'Social Security Card' },
    { value: 'Passport', label: 'Passport' },
    { value: 'PermanentResidentCard', label: 'Permanent Resident Card' },
    { value: 'Other', label: 'Other' },
  ];

  constructor() {
    effect(() => {
      const ft = this.formType();
      if (ft) {
        this.complianceService.loadTemplates();
        this.complianceService.loadMySubmissions();
        if (this.template()?.requiresIdentityDocs) {
          this.complianceService.loadMyIdentityDocuments();
        }
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
        this.snackbar.success('Form submission started');
      },
      error: () => this.submitting.set(false),
    });
  }

  protected acknowledge(): void {
    const ft = this.formType();
    if (!ft) return;
    this.acknowledging.set(true);
    this.profileService.acknowledgeForm(ft).subscribe({
      next: () => {
        this.acknowledging.set(null as any);
        this.snackbar.success('Form acknowledged');
      },
      error: () => this.acknowledging.set(false),
    });
  }

  protected onIdentityDocUploaded(event: UploadedFile, docType: IdentityDocumentType): void {
    this.complianceService.uploadIdentityDocument(docType, null, +event.id).subscribe({
      next: () => this.snackbar.success('Identity document uploaded'),
    });
  }

  protected deleteIdentityDoc(doc: IdentityDocument): void {
    this.complianceService.deleteIdentityDocument(doc.id).subscribe({
      next: () => this.snackbar.success('Document removed'),
    });
  }

  protected goBack(): void {
    this.router.navigate(['..'], { relativeTo: this.route });
  }
}
