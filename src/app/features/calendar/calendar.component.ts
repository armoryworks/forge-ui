import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { CalendarService } from './services/calendar.service';
import { CalendarJob, CalendarDay } from './models/calendar.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [PageHeaderComponent],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarComponent {
  private readonly service = inject(CalendarService);

  protected readonly loading = signal(false);
  protected readonly jobs = signal<CalendarJob[]>([]);
  protected readonly currentDate = signal(new Date());

  protected readonly weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  protected readonly monthLabel = computed(() => {
    const d = this.currentDate();
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  });

  protected readonly calendarDays = computed(() => {
    return this.buildCalendar(this.currentDate(), this.jobs());
  });

  constructor() {
    this.loadJobs();
  }

  protected loadJobs(): void {
    this.loading.set(true);
    this.service.getJobs().subscribe({
      next: (jobs) => { this.jobs.set(jobs); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected prevMonth(): void {
    const d = this.currentDate();
    this.currentDate.set(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  protected nextMonth(): void {
    const d = this.currentDate();
    this.currentDate.set(new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  protected today(): void {
    this.currentDate.set(new Date());
  }

  private buildCalendar(current: Date, jobs: CalendarJob[]): CalendarDay[] {
    const year = current.getFullYear();
    const month = current.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Build job-by-date map
    const jobsByDate = new Map<string, CalendarJob[]>();
    for (const job of jobs) {
      if (!job.dueDate) continue;
      const dateKey = job.dueDate.split('T')[0];
      const list = jobsByDate.get(dateKey) ?? [];
      list.push(job);
      jobsByDate.set(dateKey, list);
    }

    const days: CalendarDay[] = [];

    // Previous month padding
    const prevMonth = new Date(year, month, 0);
    for (let i = startOffset - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonth.getDate() - i);
      const dateStr = this.toDateStr(date);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        jobs: jobsByDate.get(dateStr) ?? [],
      });
    }

    // Current month
    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month, d);
      const dateStr = this.toDateStr(date);
      days.push({
        date,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        jobs: jobsByDate.get(dateStr) ?? [],
      });
    }

    // Next month padding
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        const date = new Date(year, month + 1, d);
        const dateStr = this.toDateStr(date);
        days.push({
          date,
          isCurrentMonth: false,
          isToday: dateStr === todayStr,
          jobs: jobsByDate.get(dateStr) ?? [],
        });
      }
    }

    return days;
  }

  private toDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
