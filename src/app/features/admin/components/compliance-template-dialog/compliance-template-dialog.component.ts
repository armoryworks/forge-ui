import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { FileUploadZoneComponent } from '../../../../shared/components/file-upload-zone/file-upload-zone.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AdminService } from '../../services/admin.service';
import { ComplianceFormTemplate, ComplianceFormType } from '../../../account/models/compliance-form.model';

const SYSTEM_FORM_TYPES: Set<ComplianceFormType> = new Set([
  'W4', 'I9', 'StateWithholding', 'DirectDeposit', 'WorkersComp', 'Handbook',
]);

@Component({
  selector: 'app-compliance-template-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, SelectComponent,
    ToggleComponent, TextareaComponent, FileUploadZoneComponent, ValidationPopoverDirective,
  ],
  templateUrl: './compliance-template-dialog.component.html',
  styleUrl: './compliance-template-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComplianceTemplateDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ComplianceTemplateDialogComponent>);
  private readonly data = inject<ComplianceFormTemplate | null>(MAT_DIALOG_DATA);
  private readonly adminService = inject(AdminService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly saving = signal(false);
  protected readonly uploadingBlankPdf = signal(false);
  protected readonly isEdit = !!this.data;
  protected readonly isSystem = !!this.data && SYSTEM_FORM_TYPES.has(this.data.formType);
  protected readonly template = this.data;

  // For system forms: editable acro map JSON (separate from main form)
  protected readonly acroMapJson = signal(this.data?.acroFieldMapJson ?? '');
  protected readonly savingAcroMap = signal(false);
  protected readonly hasBlankPdf = computed(() => !!this.data?.filledPdfTemplateId);

  protected readonly formTypeOptions: SelectOption[] = [
    { value: 'W4', label: this.translate.instant('complianceTemplateDialog.formTypeW4') },
    { value: 'I9', label: this.translate.instant('complianceTemplateDialog.formTypeI9') },
    { value: 'StateWithholding', label: this.translate.instant('complianceTemplateDialog.formTypeState') },
    { value: 'DirectDeposit', label: this.translate.instant('complianceTemplateDialog.formTypeDirectDeposit') },
    { value: 'WorkersComp', label: this.translate.instant('complianceTemplateDialog.formTypeWorkersComp') },
    { value: 'Handbook', label: this.translate.instant('complianceTemplateDialog.formTypeHandbook') },
  ];

  protected readonly form = new FormGroup({
    name: new FormControl(this.data?.name ?? '', [Validators.required, Validators.maxLength(200)]),
    formType: new FormControl(this.data?.formType ?? 'W4', [Validators.required]),
    description: new FormControl(this.data?.description ?? '', [Validators.maxLength(500)]),
    icon: new FormControl(this.data?.icon ?? 'description', [Validators.required, Validators.maxLength(50)]),
    sourceUrl: new FormControl(this.data?.sourceUrl ?? ''),
    isAutoSync: new FormControl(this.data?.isAutoSync ?? false),
    isActive: new FormControl(this.data?.isActive ?? true),
    sortOrder: new FormControl(this.data?.sortOrder ?? 0),
    requiresIdentityDocs: new FormControl(this.data?.requiresIdentityDocs ?? false),
    blocksJobAssignment: new FormControl(this.data?.blocksJobAssignment ?? false),
    profileCompletionKey: new FormControl(this.data?.profileCompletionKey ?? '', [Validators.required, Validators.maxLength(50)]),
    acroFieldMapJson: new FormControl(this.data?.acroFieldMapJson ?? ''),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: 'Name',
    formType: 'Form Type',
    icon: 'Icon',
    profileCompletionKey: 'Profile Key',
  });

  protected close(): void {
    this.dialogRef.close(false);
  }

  protected onFileUploaded(file: { id: string }): void {
    if (!this.data) return;
    this.saving.set(true);
    this.adminService.uploadTemplateDocument(this.data.id, parseInt(file.id, 10)).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('complianceTemplateDialog.documentUploaded'));
        this.dialogRef.close(true);
      },
      error: () => this.saving.set(false),
    });
  }

  protected onBlankPdfUploaded(file: { id: string }): void {
    if (!this.data) return;
    this.uploadingBlankPdf.set(true);
    this.adminService.setBlankPdfTemplate(this.data.id, parseInt(file.id, 10)).subscribe({
      next: () => {
        this.uploadingBlankPdf.set(false);
        this.snackbar.success(this.translate.instant('complianceTemplateDialog.blankPdfUploaded'));
      },
      error: () => this.uploadingBlankPdf.set(false),
    });
  }

  protected saveAcroMap(): void {
    if (!this.data) return;
    this.savingAcroMap.set(true);
    const existing = this.data;
    this.adminService.updateComplianceTemplate(existing.id, {
      name: existing.name,
      formType: existing.formType,
      description: existing.description ?? '',
      icon: existing.icon,
      sourceUrl: existing.sourceUrl,
      isAutoSync: existing.isAutoSync,
      isActive: existing.isActive,
      sortOrder: existing.sortOrder,
      requiresIdentityDocs: existing.requiresIdentityDocs,
      blocksJobAssignment: existing.blocksJobAssignment,
      profileCompletionKey: existing.profileCompletionKey,
      docuSealTemplateId: existing.docuSealTemplateId,
      acroFieldMapJson: this.acroMapJson() || null,
    }).subscribe({
      next: () => {
        this.savingAcroMap.set(false);
        this.snackbar.success(this.translate.instant('complianceTemplateDialog.acroMapSaved'));
      },
      error: () => this.savingAcroMap.set(false),
    });
  }

  protected save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    const value = this.form.getRawValue();

    const request = {
      name: value.name!,
      formType: value.formType!,
      description: value.description!,
      icon: value.icon!,
      sourceUrl: value.sourceUrl || null,
      isAutoSync: value.isAutoSync!,
      isActive: value.isActive!,
      sortOrder: value.sortOrder!,
      requiresIdentityDocs: value.requiresIdentityDocs!,
      blocksJobAssignment: value.blocksJobAssignment!,
      profileCompletionKey: value.profileCompletionKey!,
      acroFieldMapJson: value.acroFieldMapJson || null,
    };

    const op = this.isEdit
      ? this.adminService.updateComplianceTemplate(this.data!.id, request)
      : this.adminService.createComplianceTemplate(request);

    op.subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.isEdit ? this.translate.instant('complianceTemplateDialog.templateUpdated') : this.translate.instant('complianceTemplateDialog.templateCreated'));
        this.dialogRef.close(true);
      },
      error: () => this.saving.set(false),
    });
  }
}
