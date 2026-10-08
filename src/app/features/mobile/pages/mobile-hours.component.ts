import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../../shared/services/auth.service';
import { LanguageService } from '../../../shared/services/language.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { toDateOnly } from '../../../shared/utils/date.utils';
import { elapsedMs } from '../../../shared/utils/elapsed-ms';
import { secondTicker } from '../../../shared/utils/second-ticker';
import { HoursDay } from '../models/hours-day.model';
import { HoursTimeEntry } from '../models/hours-time-entry.model';

interface ClockStatus {
  isClockedIn: boolean;
  clockedInAt: string | Date | null;
}

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

@Component({
  selector: 'app-mobile-hours',
  standalone: true,
  imports: [DatePipe, TranslatePipe, EmptyStateComponent, LoadingBlockDirective],
  templateUrl: './mobile-hours.component.html',
  styleUrl: './mobile-hours.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileHoursComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly language = inject(LanguageService);

  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly entries = signal<HoursTimeEntry[]>([]);
  protected readonly weekStart = signal(this.mondayOf(new Date(), 0));
  protected readonly expandedDay = signal<string | null>(null);
  protected readonly weekOffset = signal(0);
  protected readonly clockedInAt = signal<string | Date | null>(null);
  protected readonly now = secondTicker();

  protected readonly isCurrentWeek = computed(() => this.weekOffset() === 0);

  protected readonly weekLabel = computed(() => {
    const start = this.weekStart();
    const end = this.addDays(start, 6);
    return `${this.formatShortDate(start)} - ${this.formatShortDate(end)}`;
  });

  protected readonly days = computed<HoursDay[]>(() => {
    const start = this.weekStart();
    const entries = this.entries();
    const now = this.now();
    return Array.from({ length: 7 }, (_, i) => {
      const date = this.addDays(start, i);
      const dateStr = toDateOnly(date)!;
      const dayEntries = entries.filter((e) => this.dayOf(e) === dateStr);
      return {
        date: dateStr,
        weekday: date.getDay(),
        minutes: dayEntries.reduce((sum, e) => sum + this.minutesOf(e, now), 0),
        running: dayEntries.some((e) => this.isRunning(e)),
        entries: dayEntries,
      };
    });
  });

  protected readonly totalMinutes = computed(() => this.days().reduce((sum, d) => sum + d.minutes, 0));

  protected readonly todayInProgress = computed(() => {
    if (!this.isCurrentWeek()) return null;
    const today = toDateOnly(new Date(this.now()))!;
    const running = this.entries().filter((e) => this.isRunning(e) && this.dayOf(e) === today);
    if (running.length === 0) return null;
    const now = this.now();
    return running.reduce((sum, e) => sum + this.minutesOf(e, now), 0);
  });

  ngOnInit(): void {
    this.loadWeek();
    this.loadClockStatus();
  }

  private loadWeek(): void {
    const userId = this.authService.user()?.id;
    if (!userId) return;

    this.loading.set(true);
    const weekStart = this.mondayOf(new Date(), this.weekOffset());
    this.weekStart.set(weekStart);

    this.http.get<HoursTimeEntry[]>('/api/v1/time-tracking/entries', {
      params: {
        userId: userId.toString(),
        from: toDateOnly(this.addDays(weekStart, -1))!,
        to: toDateOnly(this.addDays(weekStart, 7))!,
      },
    }).subscribe({
      next: (entries) => {
        this.entries.set(entries ?? []);
        this.failed.set(false);
        this.loading.set(false);
      },
      error: () => {
        this.entries.set([]);
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  private loadClockStatus(): void {
    if (!this.authService.user()?.id) return;
    this.http.get<ClockStatus>('/api/v1/time-tracking/clock-status').subscribe({
      next: (status) => this.clockedInAt.set(status.isClockedIn ? status.clockedInAt : null),
      error: () => this.clockedInAt.set(null),
    });
  }

  protected previousWeek(): void {
    this.weekOffset.update((v) => v - 1);
    this.expandedDay.set(null);
    this.loadWeek();
  }

  protected nextWeek(): void {
    if (this.isCurrentWeek()) return;
    this.weekOffset.update((v) => v + 1);
    this.expandedDay.set(null);
    this.loadWeek();
  }

  protected toggleDay(date: string): void {
    this.expandedDay.update((v) => (v === date ? null : date));
  }

  protected weekdayKey(weekday: number): string {
    return `mobileLegacy.hours.weekdays.${WEEKDAY_KEYS[weekday]}`;
  }

  protected isRunning(entry: HoursTimeEntry): boolean {
    return !!entry.timerStart && !entry.timerStop;
  }

  protected minutesOf(entry: HoursTimeEntry, nowMs: number): number {
    return this.isRunning(entry)
      ? Math.floor(elapsedMs(entry.timerStart, nowMs) / 60000)
      : entry.durationMinutes ?? 0;
  }

  protected durationKey(minutes: number): string {
    return minutes % 60 === 0 ? 'mobileLegacy.hours.durationHours' : 'mobileLegacy.hours.duration';
  }

  protected durationParts(minutes: number): { hours: number; minutes: number } {
    return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
  }

  protected getDayDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString(this.language.currentLanguage(), { month: 'numeric', day: 'numeric' });
  }

  protected formatTime(value: string | Date): string {
    return new Date(value).toLocaleTimeString(this.language.currentLanguage(), { hour: 'numeric', minute: '2-digit' });
  }

  private dayOf(entry: HoursTimeEntry): string {
    return entry.timerStart ? toDateOnly(new Date(entry.timerStart))! : entry.date;
  }

  private formatShortDate(date: Date): string {
    return date.toLocaleDateString(this.language.currentLanguage(), { month: 'short', day: 'numeric' });
  }

  private mondayOf(today: Date, weekOffset: number): Date {
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset + weekOffset * 7);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(date.getDate() + days);
    return result;
  }
}
