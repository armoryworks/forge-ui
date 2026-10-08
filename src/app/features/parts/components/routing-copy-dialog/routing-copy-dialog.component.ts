import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

import { RoutingCopyService } from '../../services/routing-copy.service';
import { Operation } from '../../models/operation.model';

export interface RoutingCopyDialogData {
  partId: number;
}

@Component({
  selector: 'app-routing-copy-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, EntityPickerComponent, ValidationButtonComponent],
  templateUrl: './routing-copy-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoutingCopyDialogComponent {
  private readonly routingCopy = inject(RoutingCopyService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialogRef = inject(MatDialogRef<RoutingCopyDialogComponent, Operation[] | null>);
  protected readonly data = inject<RoutingCopyDialogData>(MAT_DIALOG_DATA);

  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    sourcePartId: new FormControl<number | null>(null, [Validators.required]),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    sourcePartId: this.translate.instant('routingTools.sourcePart'),
  });

  close(): void {
    this.dialogRef.close(null);
  }

  copy(): void {
    const sourcePartId = this.form.controls.sourcePartId.value;
    if (this.form.invalid || sourcePartId == null || this.saving()) return;
    this.saving.set(true);
    this.routingCopy.copyFrom(this.data.partId, sourcePartId).subscribe({
      next: (operations) => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('routingTools.copied', { count: operations.length }));
        this.dialogRef.close(operations);
      },
      error: () => this.saving.set(false),
    });
  }
}
