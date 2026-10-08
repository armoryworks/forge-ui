import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { startWith } from 'rxjs';

import { DialogComponent } from '../dialog/dialog.component';
import { InputComponent } from '../input/input.component';
import { ValidationButtonComponent } from '../validation-button/validation-button.component';
import { OperationQuantityDialogData } from '../../models/operation-quantity-dialog-data.model';
import { OperationQuantityDialogResult } from '../../models/operation-quantity-dialog-result.model';

@Component({
  selector: 'app-operation-quantity-dialog',
  standalone: true,
  imports: [DecimalPipe, ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, ValidationButtonComponent],
  templateUrl: './operation-quantity-dialog.component.html',
  styleUrl: './operation-quantity-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperationQuantityDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<OperationQuantityDialogComponent, OperationQuantityDialogResult | undefined>);
  private readonly translate = inject(TranslateService);
  protected readonly data = inject<OperationQuantityDialogData>(MAT_DIALOG_DATA);

  protected readonly remaining = Math.max(this.data.jobQuantity - this.data.completedQuantity - this.data.scrapQuantity, 0);
  protected readonly showScrap = signal(false);

  protected readonly form = new FormGroup({
    quantity: new FormControl<number | null>(this.remaining),
    scrap: new FormControl<number | null>(0),
  });

  private readonly value = toSignal(this.form.valueChanges.pipe(startWith(this.form.value)), { initialValue: this.form.value });

  protected readonly added = computed(() => toCount(this.value().quantity));
  protected readonly addedScrap = computed(() => toCount(this.value().scrap));
  protected readonly newCompleted = computed(() => this.data.completedQuantity + this.added());
  protected readonly newScrap = computed(() => this.data.scrapQuantity + this.addedScrap());
  protected readonly isAll = computed(() => this.newCompleted() + this.newScrap() >= this.data.jobQuantity);

  protected readonly violations = computed(() => {
    const issues: string[] = [];
    const raw = this.value();
    if (isNegative(raw.quantity) || isNegative(raw.scrap)) {
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

  protected readonly canRecord = computed(() => this.violations().length === 0 && (this.added() > 0 || this.addedScrap() > 0));
  protected readonly canComplete = computed(() => this.violations().length === 0);

  protected toggleScrap(): void {
    this.showScrap.update(v => !v);
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
    this.dialogRef.close(this.result(true));
  }

  private result(complete: boolean): OperationQuantityDialogResult {
    return { completedQuantity: this.newCompleted(), scrapQuantity: this.newScrap(), complete };
  }
}

function toCount(value: number | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function isNegative(value: number | null | undefined): boolean {
  return value !== null && value !== undefined && Number(value) < 0;
}
