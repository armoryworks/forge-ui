import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CalendarService } from './services/calendar.service';
import { CalendarJob } from './models/calendar-job.model';
import { CalendarDay } from './models/calendar-day.model';
import { PoCalendarEvent } from './models/po-calendar-event.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { KanbanService } from '../kanban/services/kanban.service';
import { UserPreferencesService } from '../../shared/services/user-preferences.service';

export type CalendarView = 'month' | 'week' | 'day';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [ReactiveFormsModule, MatTooltipModule, TranslatePipe, PageHeaderComponent, SelectComponent],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarComponent {
  private readonly service = inject(CalendarService);
  private readonly kanbanService = inject(KanbanService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly userPreferences = inject(UserPreferencesService);

  protected readonly loading = signal(false);
  protected readonly allJobs = signal<CalendarJob[]>([]);
  protected readonly currentDate = signal(new Date());
  protected readonly trackTypeOptions = signal<SelectOption[]>([]);
  protected readonly trackTypeControl = new FormControl<number | null>(null);
  protected readonly view = signal<CalendarView>('month');

  protected readonly showPoDeliveries = signal(
    this.userPreferences.get<boolean>('calendar:showPo') ?? false
  );
  protected readonly poEvents = signal<PoCalendarEvent[]>([]);
  protected readonly isLoadingPo = signal(false);

  protected readonly MAX_VISIBLE_JOBS = 3;
  protected readonly HOURS = Array.from({ length: 24 }, (_, i) => i);

  protected readonly weekdayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  protected readonly weekdayLabels = computed(() => this.weekdayKeys.map(k => this.translate.instant('calendar.' + k)));

  protected readonly jobs = computed(() => {
    const ttId = this.trackTypeControl.value;
    const all = this.allJobs();
    if (!ttId) return all;
    return all.filter(j => j.trackTypeId === ttId);
  });

  protected readonly headerLabel = computed(() => {
    const d = this.currentDate();
    const v = this.view();
    if (v === 'month') return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (v === 'day') return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const week = this.getWeekDays(d);
    const start = week[0];
    const end = week[6];
    if (start.getMonth() === end.getMonth()) {
      return `${start.toLocaleDateString('en-US', { month: 'long' })} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
    }
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  });

  protected readonly calendarDays = computed(() => {
    return this.buildCalendar(this.currentDate(), this.jobs());
  });

  protected readonly weekDays = computed(() => {
    return this.buildWeek(this.currentDate(), this.jobs());
  });

  protected readonly dayJobs = computed(() => {
    const dateStr = this.toDateStr(this.currentDate());
    return this.jobs().filter(j => j.dueDate ? this.toDateStr(j.dueDate) === dateStr : false);
  });

  protected readonly currentDateKey = computed(() => this.toDateStr(this.currentDate()));

  protected readonly dayPoEvents = computed(() => {
    const dateStr = this.currentDateKey();
    return this.poEvents().filter(po => po.expectedDeliveryDate === dateStr);
  });

  /** Map of YYYY-MM-DD → PoCalendarEvent[] for O(1) template lookups */
  protected readonly poEventsByDate = computed(() => {
    const map = new Map<string, PoCalendarEvent[]>();
    for (const po of this.poEvents()) {
      const key = po.expectedDeliveryDate; // already YYYY-MM-DD from DateOnly serialization
      const list = map.get(key) ?? [];
      list.push(po);
      map.set(key, list);
    }
    return map;
  });

  constructor() {
    this.loadJobs();
    this.kanbanService.getTrackTypes().subscribe(types => {
      this.trackTypeOptions.set([
        { value: null, label: this.translate.instant('calendar.allTrackTypes') },
        ...types.map(t => ({ value: t.id, label: t.name })),
      ]);
    });

    this.trackTypeControl.valueChanges.subscribe(() => {
      this.allJobs.update(j => [...j]);
    });

    // Reload PO events whenever the current date changes (month navigation).
    // Use untracked for showPoDeliveries to avoid double-load when toggling —
    // togglePoDeliveries() already calls loadPoEvents() directly on enable.
    effect(() => {
      this.currentDate(); // track dependency only
      if (untracked(() => this.showPoDeliveries())) {
        this.loadPoEvents();
      }
    });
  }

  protected loadJobs(): void {
    this.loading.set(true);
    this.service.getJobs().subscribe({
      next: (jobs) => { this.allJobs.set(jobs); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected togglePoDeliveries(): void {
    const next = !this.showPoDeliveries();
    this.showPoDeliveries.set(next);
    this.userPreferences.set('calendar:showPo', next);
    if (next) {
      this.loadPoEvents();
    } else {
      this.poEvents.set([]);
    }
  }

  private loadPoEvents(): void {
    const d = this.currentDate();
    const year = d.getFullYear();
    const month = d.getMonth();

    // Cover full calendar grid: first day of first week through last day of last week
    const firstOfMonth = new Date(year, month, 1);
    const lastOfMonth = new Date(year, month + 1, 0);

    const startOffset = firstOfMonth.getDay();
    const gridStart = new Date(year, month - 1, new Date(year, month, 0).getDate() - startOffset + 1);
    const gridEnd = new Date(lastOfMonth);
    const remaining = 7 - ((startOffset + lastOfMonth.getDate()) % 7);
    if (remaining < 7) {
      gridEnd.setDate(gridEnd.getDate() + remaining);
    }

    const from = this.toDateStr(gridStart);
    const to = this.toDateStr(gridEnd);

    this.isLoadingPo.set(true);
    this.service.getPoEvents(from, to).subscribe({
      next: events => {
        this.poEvents.set(events);
        this.isLoadingPo.set(false);
      },
      error: () => this.isLoadingPo.set(false),
    });
  }

  protected onJobClick(job: CalendarJob): void {
    this.router.navigate(['/kanban'], { queryParams: { jobId: job.id } });
  }

  protected onDayClick(day: CalendarDay): void {
    this.currentDate.set(day.date);
    this.view.set('day');
  }

  protected overflowCount(day: CalendarDay): number {
    return Math.max(0, day.jobs.length - this.MAX_VISIBLE_JOBS);
  }

  protected visibleJobs(day: CalendarDay): CalendarJob[] {
    return day.jobs.slice(0, this.MAX_VISIBLE_JOBS);
  }

  protected setView(v: CalendarView): void {
    this.view.set(v);
  }

  protected prev(): void {
    const d = this.currentDate();
    const v = this.view();
    if (v === 'month') this.currentDate.set(new Date(d.getFullYear(), d.getMonth() - 1, 1));
    else if (v === 'week') this.currentDate.set(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7));
    else this.currentDate.set(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
  }

  protected next(): void {
    const d = this.currentDate();
    const v = this.view();
    if (v === 'month') this.currentDate.set(new Date(d.getFullYear(), d.getMonth() + 1, 1));
    else if (v === 'week') this.currentDate.set(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7));
    else this.currentDate.set(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
  }

  protected today(): void {
    this.currentDate.set(new Date());
  }

  protected formatHour(h: number): string {
    if (h === 0) return '12 AM';
    if (h < 12) return `${h} AM`;
    if (h === 12) return '12 PM';
    return `${h - 12} PM`;
  }

  protected getPriorityIcon(priority: string): string {
    switch (priority) {
      case 'Critical': return 'priority_high';
      case 'High': return 'arrow_upward';
      default: return '';
    }
  }

  protected getJobTint(job: CalendarJob): string {
    return job.trackTypeColor ?? job.stageColor;
  }

  private getWeekDays(d: Date): Date[] {
    const dayOfWeek = d.getDay();
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dayOfWeek);
    return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }

  private buildWeek(current: Date, jobs: CalendarJob[]): CalendarDay[] {
    const weekDates = this.getWeekDays(current);
    const todayStr = this.toDateStr(new Date());
    const jobsByDate = this.buildJobsByDate(jobs);

    return weekDates.map(date => {
      const dateKey = this.toDateStr(date);
      return {
        date,
        dateKey,
        isCurrentMonth: date.getMonth() === current.getMonth(),
        isToday: dateKey === todayStr,
        jobs: jobsByDate.get(dateKey) ?? [],
      };
    });
  }

  private buildCalendar(current: Date, jobs: CalendarJob[]): CalendarDay[] {
    const year = current.getFullYear();
    const month = current.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const todayStr = this.toDateStr(new Date());
    const jobsByDate = this.buildJobsByDate(jobs);

    const days: CalendarDay[] = [];

    // Previous month padding
    const prevMonth = new Date(year, month, 0);
    for (let i = startOffset - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonth.getDate() - i);
      const dateKey = this.toDateStr(date);
      days.push({
        date,
        dateKey,
        isCurrentMonth: false,
        isToday: dateKey === todayStr,
        jobs: jobsByDate.get(dateKey) ?? [],
      });
    }

    // Current month
    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month, d);
      const dateKey = this.toDateStr(date);
      days.push({
        date,
        dateKey,
        isCurrentMonth: true,
        isToday: dateKey === todayStr,
        jobs: jobsByDate.get(dateKey) ?? [],
      });
    }

    // Next month padding
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        const date = new Date(year, month + 1, d);
        const dateKey = this.toDateStr(date);
        days.push({
          date,
          dateKey,
          isCurrentMonth: false,
          isToday: dateKey === todayStr,
          jobs: jobsByDate.get(dateKey) ?? [],
        });
      }
    }

    return days;
  }

  private buildJobsByDate(jobs: CalendarJob[]): Map<string, CalendarJob[]> {
    const map = new Map<string, CalendarJob[]>();
    for (const job of jobs) {
      if (!job.dueDate) continue;
      const dateKey = this.toDateStr(job.dueDate);
      const list = map.get(dateKey) ?? [];
      list.push(job);
      map.set(dateKey, list);
    }
    return map;
  }

  private toDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
