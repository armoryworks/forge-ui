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

  protected readonly completedControl = new FormControl('', { nonNullable: true });
  protected readonly scrapControl = new FormControl('', { nonNullable: true });
  protected readonly activeField = signal<QuantityField>('completed');
  protected readonly scrapOpen = signal(false);

  private readonly completedText = toSignal(this.completedControl.valueChanges, { initialValue: '' });
  private readonly scrapText = toSignal(this.scrapControl.valueChanges, { initialValue: '' });

  protected readonly completed = computed(() => this.parse(this.completedText()));
  protected readonly scrap = computed(() => this.parse(this.scrapText()) ?? 0);
  protected readonly overLimit = computed(() => (this.completed() ?? 0) + this.scrap() > this.jobQuantity());
  protected readonly canSubmit = computed(() => this.completed() !== null && !this.overLimit() && !this.busy());

  ngOnInit(): void {
    const row = this.operation();
    const all = Math.max(row.completedQuantity, this.jobQuantity() - row.scrapQuantity);
    this.completedControl.setValue(String(this.prefillAll() ? all : row.completedQuantity));
    this.scrapControl.setValue(String(row.scrapQuantity));
    this.scrapOpen.set(row.scrapQuantity > 0);
  }

  protected toggleScrap(): void {
    this.scrapOpen.update(open => !open);
    if (!this.scrapOpen()) this.activeField.set('completed');
  }

  protected onDigit(digit: string): void {
    const control = this.activeControl();
    const current = control.value === '0' ? '' : control.value;
    if (current.length >= 7) return;
    control.setValue(current + digit);
  }

  protected onBackspace(): void {
    const control = this.activeControl();
    control.setValue(control.value.slice(0, -1));
  }

  protected onClear(): void {
    this.activeControl().setValue('');
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

  private activeControl(): FormControl<string> {
    return this.activeField() === 'scrap' ? this.scrapControl : this.completedControl;
  }

  private parse(text: string): number | null {
    const trimmed = text.trim();
    if (!trimmed) return null;
    const value = Number(trimmed);
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
}
