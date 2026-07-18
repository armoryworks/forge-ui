import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { MatDialog } from '@angular/material/dialog';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { Gs1Service } from '../../../admin/services/gs1.service';
import { PartDetail } from '../../models/part-detail.model';

/**
 * Compact GTIN affordance for the Part detail Identity tab. Gated by
 * CAP-MD-GS1 at the call-site (`*appCap`). When the part already has a GTIN it
 * shows the code + a "GS1" chip and a Remove action; otherwise it offers an
 * "Assign GTIN" dialog with two paths — auto-allocate from the company prefix,
 * or paste a purchased GTIN. On any mutation it emits `changed` so the parent
 * refreshes the part and the new/cleared GTIN shows.
 */
@Component({
  selector: 'app-part-gtin-section',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, InputComponent, ValidationButtonComponent,
  ],
  templateUrl: './part-gtin-section.component.html',
  styleUrl: './part-gtin-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartGtinSectionComponent {
  private readonly gs1Service = inject(Gs1Service);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly part = input.required<PartDetail>();
  readonly changed = output<void>();

  protected readonly gtin = computed(() => this.part().gtin);
  protected readonly showAssignDialog = signal(false);
  protected readonly assigning = signal(false);

  /** Optional in the form; empty just disables the manual button. When present it must be 8–14 digits. */
  private readonly gtinValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '').trim();
    if (!value) return null;
    return /^\d{8,14}$/.test(value) ? null : { format: { message: 'GTIN must be 8–14 digits.' } };
  };

  protected readonly manualForm = new FormGroup({
    manualGtin: new FormControl<string>('', { nonNullable: true, validators: [this.gtinValidator] }),
  });

  protected readonly manualViolations = FormValidationService.getViolations(this.manualForm, {
    manualGtin: 'GTIN',
  });

  private readonly manualValue = toSignal(this.manualForm.controls.manualGtin.valueChanges, { initialValue: '' });
  protected readonly manualEmpty = computed(() => this.manualValue().trim().length === 0);

  protected openAssign(): void {
    this.manualForm.reset({ manualGtin: '' });
    this.showAssignDialog.set(true);
  }

  protected closeAssign(): void {
    this.showAssignDialog.set(false);
  }

  protected autoAllocate(): void {
    this.assigning.set(true);
    this.gs1Service.assignGtin(this.part().id).subscribe({
      next: () => this.onAssigned('parts.gtin.allocatedToast'),
      error: () => this.assigning.set(false),
    });
  }

  protected assignManual(): void {
    if (this.manualForm.invalid || this.manualEmpty()) return;
    const gtin = this.manualForm.getRawValue().manualGtin.trim();
    this.assigning.set(true);
    this.gs1Service.assignGtin(this.part().id, gtin).subscribe({
      next: () => this.onAssigned('parts.gtin.assignedToast'),
      error: () => this.assigning.set(false),
    });
  }

  protected removeGtin(): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('parts.gtin.removeTitle'),
        message: this.translate.instant('parts.gtin.removeMessage'),
        confirmLabel: this.translate.instant('parts.gtin.remove'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.gs1Service.removeGtin(this.part().id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('parts.gtin.removedToast'));
          this.changed.emit();
        },
      });
    });
  }

  private onAssigned(toastKey: string): void {
    this.assigning.set(false);
    this.closeAssign();
    this.snackbar.success(this.translate.instant(toastKey));
    this.changed.emit();
  }
}
