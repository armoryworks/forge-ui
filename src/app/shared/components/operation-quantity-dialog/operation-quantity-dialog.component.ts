import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';

import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { startWith } from 'rxjs';

import { ConfirmDialogComponent, ConfirmDialogData } from '../confirm-dialog/confirm-dialog.component';
import { DialogComponent } from '../dialog/dialog.component';
import { InputComponent } from '../input/input.component';
import { NumericKeypadComponent } from '../numeric-keypad/numeric-keypad.component';
import { SelectComponent, SelectOption } from '../select/select.component';
import { ValidationButtonComponent } from '../validation-button/validation-button.component';
import { OperationQuantityDialogData } from '../../models/operation-quantity-dialog-data.model';
import { OperationQuantityDialogResult } from '../../models/operation-quantity-dialog-result.model';

type QuantityField = 'quantity' | 'scrap' | 'rework';

@Component({
  selector: 'app-operation-quantity-dialog',
  standalone: true,
  imports: [DecimalPipe, ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, NumericKeypadComponent, SelectComponent, ValidationButtonComponent],
  templateUrl: './operation-quantity-dialog.component.html',
  styleUrl: './operation-quantity-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperationQuantityDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<OperationQuantityDialogComponent, OperationQuantityDialogResult | undefined>);
  private readonly translate = inject(TranslateService);
  private readonly matDialog = inject(MatDialog);
  protected readonly data = inject<OperationQuantityDialogData>(MAT_DIALOG_DATA);

  protected readonly remaining = Math.max(this.data.jobQuantity - this.data.completedQuantity - this.data.scrapQuantity, 0);
  protected readonly showScrap = signal(false);
  protected readonly showRework = signal(false);
  protected readonly touch = this.data.touch === true;
  protected readonly activeField = signal<QuantityField>('quantity');
  private replaceOnNextDigit = true;
  protected readonly reasonOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('jobOperations.dialog.noReason') },
    ...(this.data.reasons ?? []).map(r => ({ value: r.code, label: r.label })),
  ];

  protected readonly form = new FormGroup({
    quantity: new FormControl<number | null>(this.remaining),
    scrap: new FormControl<number | null>(0),
    rework: new FormControl<number | null>(0),
    reason: new FormControl<string | null>(null),
  });

  private readonly value = toSignal(this.form.valueChanges.pipe(startWith(this.form.value)), { initialValue: this.form.value });

  protected readonly added = computed(() => toCount(this.value().quantity));
  protected readonly addedScrap = computed(() => toCount(this.value().scrap));
  protected readonly addedRework = computed(() => toCount(this.value().rework));
  protected readonly newCompleted = computed(() => this.data.completedQuantity + this.added());
  protected readonly newScrap = computed(() => this.data.scrapQuantity + this.addedScrap());
  protected readonly isAll = computed(() => this.newCompleted() + this.newScrap() >= this.data.jobQuantity);
  protected readonly askReason = computed(() => this.reasonOptions.length > 1 && (this.addedScrap() > 0 || this.addedRework() > 0));

  protected readonly violations = computed(() => {
    const issues: string[] = [];
    const raw = this.value();
    if (isNegative(raw.quantity) || isNegative(raw.scrap) || isNegative(raw.rework)) {
      issues.push(this.translate.instant('jobOperations.dialog.negative'));
    }
    if (this.newCompleted() + this.newScrap() > this.data.jobQuantity) {
      issues.push(this.translate.instant('jobOperations.dialog.overQuantity', {
        total: this.newCompleted() + this.newScrap(),
        quantity: this.data.jobQuantity,
      }));
    }
    return issues;
  });

  protected readonly canRecord = computed(() =>
    this.violations().length === 0 && (this.added() > 0 || this.addedScrap() > 0 || this.addedRework() > 0));
  protected readonly canComplete = computed(() => this.violations().length === 0);

  protected toggleScrap(): void {
    this.showScrap.update(v => !v);
  }

  protected toggleRework(): void {
    this.showRework.update(v => !v);
  }

  protected selectField(field: QuantityField): void {
    if (this.activeField() === field) return;
    this.activeField.set(field);
    this.replaceOnNextDigit = true;
  }

  protected onTyped(): void {
    this.replaceOnNextDigit = false;
  }

  protected onDigit(digit: string): void {
    const control = this.form.controls[this.activeField()];
    const current = this.replaceOnNextDigit ? '' : String(control.value ?? '').replace(/^0$/, '');
    this.replaceOnNextDigit = false;
    if (current.length >= 7) return;
    control.setValue(Number(current + digit));
  }

  protected onBackspace(): void {
    this.replaceOnNextDigit = false;
    const control = this.form.controls[this.activeField()];
    const text = String(control.value ?? '').slice(0, -1);
    control.setValue(text ? Number(text) : null);
  }

  protected onClear(): void {
    this.replaceOnNextDigit = false;
    this.form.controls[this.activeField()].setValue(null);
  }

  protected close(): void {
    this.dialogRef.close(undefined);
  }

  protected record(): void {
    if (!this.canRecord()) return;
    this.dialogRef.close(this.result(false));
  }

  protected complete(): void {
    if (!this.canComplete()) return;
    if (this.isAll()) {
      this.dialogRef.close(this.result(true));
      return;
    }
    const result = this.result(true);
    this.matDialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('jobOperations.dialog.shortCloseTitle'),
        message: this.translate.instant('jobOperations.dialog.shortCloseMessage', {
          done: result.completedQuantity,
          scrap: result.scrapQuantity,
          quantity: this.data.jobQuantity,
        }),
        confirmLabel: this.translate.instant('jobOperations.dialog.shortCloseConfirm'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) this.dialogRef.close(result);
    });
  }

  private result(complete: boolean): OperationQuantityDialogResult {
    return {
      completedQuantity: this.newCompleted(),
      scrapQuantity: this.newScrap(),
      reworkQuantity: this.addedRework(),
      reasonCode: this.askReason() ? (this.value().reason ?? null) : null,
      complete,
    };
  }
}

function toCount(value: number | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function isNegative(value: number | null | undefined): boolean {
  return value !== null && value !== undefined && Number(value) < 0;
}
