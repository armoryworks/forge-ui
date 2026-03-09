import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

@Component({
  selector: 'app-mini-calendar-widget',
  standalone: true,
  imports: [MatCardModule, MatDatepickerModule, MatNativeDateModule],
  templateUrl: './mini-calendar-widget.component.html',
  styleUrl: './mini-calendar-widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MiniCalendarWidgetComponent {
  readonly highlightDates = input<Date[]>([]);

  readonly dateSelected = output<Date>();

  protected readonly selected = signal<Date | null>(null);

  protected onDateChange(date: Date | null): void {
    if (date) {
      this.selected.set(date);
      this.dateSelected.emit(date);
    }
  }

  protected dateClass = (date: Date): string => {
    const highlights = this.highlightDates();
    const match = highlights.some(d =>
      d.getFullYear() === date.getFullYear() &&
      d.getMonth() === date.getMonth() &&
      d.getDate() === date.getDate()
    );
    return match ? 'calendar-highlight' : '';
  };
}
