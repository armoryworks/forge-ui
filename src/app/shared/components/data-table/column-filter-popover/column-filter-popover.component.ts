import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';

import { ColumnDef } from '../../../models/column-def.model';
import { InputComponent } from '../../input/input.component';
import { DatepickerComponent } from '../../datepicker/datepicker.component';

export interface ColumnFilterState {
  field: string;
  value: unknown;
}

@Component({
  selector: 'app-column-filter-popover',
  standalone: true,
  imports: [FormsModule, MatCheckboxModule, InputComponent, DatepickerComponent],
  templateUrl: './column-filter-popover.component.html',
  styleUrl: './column-filter-popover.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColumnFilterPopoverComponent {
  readonly column = input.required<ColumnDef>();
  readonly currentValue = input<unknown>(null);

  readonly filterApplied = output<ColumnFilterState>();
  readonly filterCleared = output<string>();
  readonly closed = output<void>();

  protected readonly textValue = signal('');
  protected readonly numberMin = signal<number | null>(null);
  protected readonly numberMax = signal<number | null>(null);
  protected readonly dateFrom = signal<Date | null>(null);
  protected readonly dateTo = signal<Date | null>(null);
  protected readonly selectedEnums = signal<Set<unknown>>(new Set());

  ngOnInit(): void {
    this.loadCurrentValue();
  }

  onApply(): void {
    const col = this.column();
    let value: unknown;

    switch (col.type ?? 'text') {
      case 'text':
        value = this.textValue() || null;
        break;
      case 'number':
        value = (this.numberMin() != null || this.numberMax() != null)
          ? { min: this.numberMin(), max: this.numberMax() }
          : null;
        break;
      case 'date':
        value = (this.dateFrom() || this.dateTo())
          ? { from: this.dateFrom(), to: this.dateTo() }
          : null;
        break;
      case 'enum':
        value = this.selectedEnums().size > 0
          ? [...this.selectedEnums()]
          : null;
        break;
    }

    if (value != null) {
      this.filterApplied.emit({ field: col.field, value });
    } else {
      this.filterCleared.emit(col.field);
    }
    this.closed.emit();
  }

  onClear(): void {
    this.filterCleared.emit(this.column().field);
    this.closed.emit();
  }

  toggleEnum(val: unknown): void {
    const selected = new Set(this.selectedEnums());
    if (selected.has(val)) {
      selected.delete(val);
    } else {
      selected.add(val);
    }
    this.selectedEnums.set(selected);
  }

  isEnumSelected(val: unknown): boolean {
    return this.selectedEnums().has(val);
  }

  private loadCurrentValue(): void {
    const val = this.currentValue();
    if (val == null) return;

    switch (this.column().type ?? 'text') {
      case 'text':
        this.textValue.set(val as string);
        break;
      case 'number': {
        const range = val as { min?: number; max?: number };
        this.numberMin.set(range.min ?? null);
        this.numberMax.set(range.max ?? null);
        break;
      }
      case 'date': {
        const range = val as { from?: Date; to?: Date };
        this.dateFrom.set(range.from ?? null);
        this.dateTo.set(range.to ?? null);
        break;
      }
      case 'enum':
        this.selectedEnums.set(new Set(val as unknown[]));
        break;
    }
  }
}
