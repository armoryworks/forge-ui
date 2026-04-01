import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent } from '../../../../shared/components/select/select.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';
import { AdminService } from '../../services/admin.service';
import { ComplianceFormSubmission } from '../../../account/models/compliance-form.model';

export interface CompleteI9DialogData {
  submission: ComplianceFormSubmission;
}

@Component({
  selector: 'app-complete-i9-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    InputComponent,
    SelectComponent,
    DatepickerComponent,
    ValidationPopoverDirective,
  ],
  templateUrl: './complete-i9-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompleteI9DialogComponent {
  private readonly dialogRef = inject(MatDialogRef<CompleteI9DialogComponent>);
  private readonly data = inject<CompleteI9DialogData>(MAT_DIALOG_DATA);
  private readonly adminService = inject(AdminService);
  private readonly snackbar = inject(SnackbarService);

  readonly submission = this.data.submission;
  protected readonly saving = signal(false);

  protected readonly documentListOptions = [
    { value: 'A', label: 'List A — Document establishes both identity and employment authorization' },
    { value: 'B+C', label: 'List B+C — One document for identity, one for employment authorization' },
  ];

  protected readonly form = new FormGroup({
    documentListType: new FormControl<string>('', [Validators.required]),
    startDate: new FormControl<string>('', [Validators.required]),
    // List A fields
    listA_doc_type: new FormControl<string>(''),
    listA_doc_number: new FormControl<string>(''),
    listA_doc_issuer: new FormControl<string>(''),
    listA_doc_expiration: new FormControl<string>(''),
    // List B fields
    listB_doc_type: new FormControl<string>(''),
    listB_doc_number: new FormControl<string>(''),
    listB_doc_issuer: new FormControl<string>(''),
    listB_doc_expiration: new FormControl<string>(''),
    // List C fields
    listC_doc_type: new FormControl<string>(''),
    listC_doc_number: new FormControl<string>(''),
    listC_doc_issuer: new FormControl<string>(''),
    listC_doc_expiration: new FormControl<string>(''),
    // Reverification
    reverificationDueAt: new FormControl<string>(''),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    documentListType: 'Document List Type',
    startDate: 'First Day of Employment',
  });

  protected save(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();

    const docData: Record<string, string> = {
      start_date: v.startDate ?? '',
    };

    if (v.documentListType === 'A') {
      docData['listA_doc_type'] = v.listA_doc_type ?? '';
      docData['listA_doc_number'] = v.listA_doc_number ?? '';
      docData['listA_doc_issuer'] = v.listA_doc_issuer ?? '';
      docData['listA_doc_expiration'] = v.listA_doc_expiration ?? '';
    } else {
      docData['listB_doc_type'] = v.listB_doc_type ?? '';
      docData['listB_doc_number'] = v.listB_doc_number ?? '';
      docData['listB_doc_issuer'] = v.listB_doc_issuer ?? '';
      docData['listB_doc_expiration'] = v.listB_doc_expiration ?? '';
      docData['listC_doc_type'] = v.listC_doc_type ?? '';
      docData['listC_doc_number'] = v.listC_doc_number ?? '';
      docData['listC_doc_issuer'] = v.listC_doc_issuer ?? '';
      docData['listC_doc_expiration'] = v.listC_doc_expiration ?? '';
    }

    this.saving.set(true);
    this.adminService.completeI9Section2(this.submission.id, {
      documentListType: v.documentListType!,
      documentDataJson: JSON.stringify(docData),
      startDate: toIsoDate(new Date(v.startDate!)) ?? v.startDate!,
      reverificationDueAt: v.reverificationDueAt ? (toIsoDate(new Date(v.reverificationDueAt)) ?? v.reverificationDueAt) : null,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success('I-9 Section 2 completed');
        this.dialogRef.close(true);
      },
      error: () => this.saving.set(false),
    });
  }

  protected close(): void {
    this.dialogRef.close(false);
  }
}
