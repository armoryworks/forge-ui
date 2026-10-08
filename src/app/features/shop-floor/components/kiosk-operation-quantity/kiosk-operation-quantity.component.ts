import { ChangeDetectionStrategy, Component, computed, input, OnInit, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

import { InputComponent } from '../../../../shared/components/input/input.component';
import { NumericKeypadComponent } from '../numeric-keypad/numeric-keypad.component';
import { JobOperationRow } from '../../models/job-operation-row.model';
import { UpdateJobOperationProgressRequest } from '../../models/update-job-operation-progress-request.model';

type QuantityField = 'completed' | 'scrap';

@Component({
  selector: 'app-kiosk-operation-quantity',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, InputComponent, NumericKeypadComponent],
  templateUrl: './kiosk-operation-quantity.component.html',
  styleUrl: './kiosk-operation-quantity.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KioskOperationQuantityComponent implements OnInit {
  readonly operation = input.required<JobOperationRow>();
  readonly jobQuantity = input.required<number>();
  readonly prefillAll = input(false);
  readonly busy = input(false);

  readonly submitted = output<UpdateJobOperationProgressRequest>();
  readonly cancelled = output<void>();

  protected readonly completedControl = new FormControl<number | null>(null);
  protected readonly scrapControl = new FormControl<number | null>(null);
  protected readonly activeField = signal<QuantityField>('completed');
  protected readonly scrapOpen = signal(false);

  private readonly completedValue = toSignal(this.completedControl.valueChanges, { initialValue: null });
  private readonly scrapValue = toSignal(this.scrapControl.valueChanges, { initialValue: null });
  private replaceOnNextDigit = true;

  protected readonly completed = computed(() => this.parse(this.completedValue()));
  protected readonly scrap = computed(() => this.parse(this.scrapValue()) ?? 0);
  protected readonly overLimit = computed(() => (this.completed() ?? 0) + this.scrap() > this.jobQuantity());
  protected readonly canSubmit = computed(() => this.completed() !== null && !this.overLimit() && !this.busy());

  ngOnInit(): void {
    const row = this.operation();
    const all = Math.max(row.completedQuantity, this.jobQuantity() - row.scrapQuantity);
    this.completedControl.setValue(this.prefillAll() ? all : row.completedQuantity);
    this.scrapControl.setValue(row.scrapQuantity);
    this.scrapOpen.set(row.scrapQuantity > 0);
  }

  protected selectField(field: QuantityField): void {
    if (this.activeField() === field) return;
    this.activeField.set(field);
    this.replaceOnNextDigit = true;
  }

  protected onTyped(): void {
    this.replaceOnNextDigit = false;
  }

  protected toggleScrap(): void {
    this.scrapOpen.update(open => !open);
    if (!this.scrapOpen()) this.selectField('completed');
  }

  protected onDigit(digit: string): void {
    const control = this.activeControl();
    const text = this.replaceOnNextDigit ? '' : this.digitsOf(control.value);
    this.replaceOnNextDigit = false;
    const current = text === '0' ? '' : text;
    if (current.length >= 7) return;
    control.setValue(Number(current + digit));
  }

  protected onBackspace(): void {
    this.replaceOnNextDigit = false;
    const control = this.activeControl();
    const text = this.digitsOf(control.value).slice(0, -1);
    control.setValue(text ? Number(text) : null);
  }

  protected onClear(): void {
    this.replaceOnNextDigit = false;
    this.activeControl().setValue(null);
  }

  protected finish(): void {
    if (!this.canSubmit()) return;
    this.submitted.emit({ ...this.quantities(), status: 'Complete' });
  }

  protected record(): void {
    if (!this.canSubmit()) return;
    this.submitted.emit(this.quantities());
  }

  private quantities(): UpdateJobOperationProgressRequest {
    return {
      completedQuantity: this.completed(),
      scrapQuantity: this.scrap(),
      expectedVersion: this.operation().version,
    };
  }

  private activeControl(): FormControl<number | null> {
    return this.activeField() === 'scrap' ? this.scrapControl : this.completedControl;
  }

  private digitsOf(value: number | string | null): string {
    return String(value ?? '').trim();
  }

  private parse(value: number | string | null): number | null {
    const text = this.digitsOf(value);
    if (!text) return null;
    const parsed = Number(text);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }
}
