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
import { ToggleComponent } from '../toggle/toggle.component';
import { ValidationButtonComponent } from '../validation-button/validation-button.component';
import { OperationQuantityDialogData } from '../../models/operation-quantity-dialog-data.model';
import { OperationQuantityDialogResult } from '../../models/operation-quantity-dialog-result.model';

type QuantityField = 'quantity' | 'scrap' | 'rework';

@Component({
  selector: 'app-operation-quantity-dialog',
  standalone: true,
  imports: [DecimalPipe, ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, NumericKeypadComponent, SelectComponent, ToggleComponent, ValidationButtonComponent],
  templateUrl: './operation-quantity-dialog.component.html',
  styleUrl: './operation-quantity-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperationQuantityDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<OperationQuantityDialogComponent, OperationQuantityDialogResult | undefined>);
  private readonly translate = inject(TranslateService);
  private readonly matDialog = inject(MatDialog);
  protected readonly data = inject<OperationQuantityDialogData>(MAT_DIALOG_DATA);

  protected readonly target = Math.min(this.data.targetQuantity ?? this.data.jobQuantity, this.data.jobQuantity);
  protected readonly startsExtra = this.target < this.data.jobQuantity;
  protected readonly remaining = Math.max(this.target - this.data.completedQuantity, 0);
  protected readonly stopMode = this.data.mode === 'stop';
  protected readonly steps = [1, 5, 10];
  protected readonly showScrap = signal(this.stopMode);
  protected readonly showRework = signal(false);
  protected readonly touch = this.data.touch === true;
  protected readonly activeField = signal<QuantityField>('quantity');
  private replaceOnNextDigit = true;
  protected readonly reasonOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('jobOperations.dialog.noReason') },
    ...(this.data.reasons ?? []).map(r => ({ value: r.code, label: r.label })),
  ];

  protected readonly form = new FormGroup({
    quantity: new FormControl<number | null>(this.data.initialQuantity ?? (this.stopMode ? null : this.defaultRecordQuantity())),
    scrap: new FormControl<number | null>(this.stopMode ? null : 0),
    rework: new FormControl<number | null>(0),
    reason: new FormControl<string | null>(null),
    gateAck: new FormControl<boolean>(false, { nonNullable: true }),
    gateReason: new FormControl<string | null>(null),
    overrunAck: new FormControl<boolean>(false, { nonNullable: true }),
  });

  private readonly value = toSignal(this.form.valueChanges.pipe(startWith(this.form.value)), { initialValue: this.form.value });

  protected readonly added = computed(() => toCount(this.value().quantity));
  protected readonly addedScrap = computed(() => toCount(this.value().scrap));
  protected readonly addedRework = computed(() => toCount(this.value().rework));
  protected readonly newCompleted = computed(() => this.data.completedQuantity + this.added());
  protected readonly newScrap = computed(() => this.data.scrapQuantity + this.addedScrap());
  protected readonly isAll = computed(() => this.newCompleted() >= this.target);
  protected readonly doneCompleted = computed(() => this.stopMode && this.value().quantity == null
    ? Math.max(this.data.completedQuantity, this.target)
    : this.newCompleted());
  protected readonly recordOverrun = computed(() => this.overrunOf(this.newCompleted()));
  protected readonly doneOverrun = computed(() => this.overrunOf(this.doneCompleted()));
  protected readonly overrun = computed(() => Math.max(this.recordOverrun(), this.doneOverrun()));
  protected readonly overrunAcked = computed(() => this.value().overrunAck === true);
  protected readonly gate = this.data.gate ?? null;
  protected readonly gateWaitingOn = (this.data.gate?.waitingOnSteps ?? []).join(', ');
  private readonly previousTotal = this.data.completedQuantity + this.data.scrapQuantity;
  protected readonly recordGated = computed(() => this.exceedsGate(this.newCompleted() + this.newScrap()));
  protected readonly doneExceedsGate = computed(() => this.exceedsGate(this.doneCompleted() + this.newScrap()));
  protected readonly gateQuantityShown = computed(() => this.recordGated() || this.doneExceedsGate());
  protected readonly doneGated = computed(() => this.doneExceedsGate() || (this.gate?.waitingOnSteps.length ?? 0) > 0);
  protected readonly gateShown = computed(() => this.recordGated() || this.doneGated());
  protected readonly gateAckOn = computed(() => this.value().gateAck === true);
  protected readonly gateCleared = computed(() => {
    const gate = this.gate;
    if (!gate || !gate.canOverride || !this.gateAckOn()) return false;
    return gate.mode === 'Warn' || !!this.value().gateReason?.trim();
  });
  protected readonly offerReworkTime = computed(() => !this.stopMode && this.data.runTimerOpen === true && this.addedRework() > 0);
  protected readonly bookRework = signal(true);
  protected readonly askReason = computed(() => this.reasonOptions.length > 1 && (this.addedScrap() > 0 || this.addedRework() > 0));

  protected readonly violations = computed(() => {
    const issues: string[] = [];
    const raw = this.value();
    if (isNegative(raw.quantity) || isNegative(raw.scrap) || isNegative(raw.rework)) {
      issues.push(this.translate.instant('jobOperations.dialog.negative'));
    }
    const places = this.data.decimalPlaces;
    if (places !== null && places !== undefined
      && [raw.quantity, raw.scrap, raw.rework].some(v => !fitsDecimals(v, places))) {
      issues.push(places === 0
        ? this.translate.instant('jobOperations.dialog.wholeNumbers')
        : this.translate.instant('jobOperations.dialog.decimals', { places }));
    }
    return issues;
  });

  protected readonly overPlanned = computed(() => {
    const planned = this.data.plannedQuantity;
    return planned != null && planned > 0 && this.newCompleted() + this.newScrap() > planned;
  });

  protected readonly doneViolations = computed(() => [
    ...this.violations(),
    ...(this.doneGated() && !this.gateCleared()
      ? [this.translate.instant(this.gate?.canOverride ? 'jobOperations.gate.confirmFirst' : 'jobOperations.gate.askSupervisor')]
      : []),
    ...(this.doneOverrun() > 0 && !this.overrunAcked() ? [this.translate.instant('jobOperations.dialog.overrunConfirmFirst')] : []),
  ]);

  protected readonly canRecord = computed(() =>
    this.violations().length === 0
    && (!this.recordGated() || this.gateCleared())
    && (this.recordOverrun() === 0 || this.overrunAcked())
    && (this.stopMode || this.added() > 0 || this.addedScrap() > 0 || this.addedRework() > 0));
  protected readonly canComplete = computed(() => this.doneViolations().length === 0);

  protected toggleScrap(): void {
    this.showScrap.update(v => !v);
  }

  protected chooseReworkTime(book: boolean): void {
    this.bookRework.set(book);
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

  protected step(amount: number): void {
    this.replaceOnNextDigit = false;
    const control = this.form.controls[this.activeField()];
    control.setValue(toCount(control.value) + amount);
  }

  protected skip(): void {
    this.dialogRef.close({ ...this.result(false), skipped: true, addedQuantity: 0, addedScrap: 0, reworkQuantity: 0 });
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
    if (this.doneCompleted() >= this.target) {
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
          quantity: this.target,
        }),
        confirmLabel: this.translate.instant('jobOperations.dialog.shortCloseConfirm'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) this.dialogRef.close(result);
    });
  }

  private defaultRecordQuantity(): number {
    const available = this.data.gate?.available;
    if (available === null || available === undefined) return this.remaining;
    return Math.min(this.remaining, Math.max(available - this.data.completedQuantity - this.data.scrapQuantity, 0));
  }

  private overrunOf(good: number): number {
    return good > this.target && good > this.data.completedQuantity ? good - this.target : 0;
  }

  private exceedsGate(total: number): boolean {
    const available = this.gate?.available;
    return available !== null && available !== undefined && total > available && total > this.previousTotal;
  }

  private result(complete: boolean): OperationQuantityDialogResult {
    const acknowledged = this.gateShown() && this.gateCleared();
    return {
      ...(acknowledged ? { acknowledgeGate: true, overrideReason: this.value().gateReason?.trim() || null } : {}),
      completedQuantity: complete ? this.doneCompleted() : this.newCompleted(),
      scrapQuantity: this.newScrap(),
      reworkQuantity: this.addedRework(),
      reasonCode: this.askReason() ? (this.value().reason ?? null) : null,
      complete,
      addedQuantity: this.added(),
      addedScrap: this.addedScrap(),
      ...(this.offerReworkTime() && this.bookRework() ? { bookReworkTime: true } : {}),
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

function fitsDecimals(value: number | null | undefined, places: number): boolean {
  if (value === null || value === undefined) return true;
  const n = Number(value);
  return !Number.isFinite(n) || Number(n.toFixed(places)) === n;
}
