import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, OnInit, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CalendarService } from './services/calendar.service';
import { CalendarJob } from './models/calendar-job.model';
import { CalendarDay } from './models/calendar-day.model';
import { PoCalendarEvent } from './models/po-calendar-event.model';
import { CalendarSuperGroup } from './models/calendar-super-group.model';
import { CalendarEvent } from './models/calendar-event.model';
import { CalendarSavedView } from './models/calendar-saved-view.model';
import { CalendarLayersComponent } from './components/calendar-layers/calendar-layers.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { PriorityIndicatorComponent } from '../../shared/components/priority-indicator/priority-indicator.component';
import { KanbanService } from '../kanban/services/kanban.service';
import { UserPreferencesService } from '../../shared/services/user-preferences.service';

export type CalendarView = 'month' | 'week' | 'day';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [ReactiveFormsModule, MatTooltipModule, TranslatePipe, PageHeaderComponent, SelectComponent, InputComponent, PriorityIndicatorComponent, CalendarLayersComponent],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarComponent implements OnInit {
  /**
   * Saved-view / layer scope. `'master'` (default) is the standalone calendar page.
   * A module scope like `'module:compliance'` hosts the same calendar inside a
   * feature module, which changes the default-layer behaviour (see ngOnInit /
   * getSuperGroups) and namespaces saved views to that module.
   */
  readonly scope = input<string>('master');
  // Host-overridable header text so an embedding module (e.g. /compliance) shows
  // its own title in the calendar's single page-header instead of stacking a
  // second header above it (space-efficiency rule — no redundant chrome).
  readonly titleKey = input<string>('calendar.title');
  readonly subtitleKey = input<string>('calendar.subtitle');

  private readonly service = inject(CalendarService);
  private readonly kanbanService = inject(KanbanService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly userPreferences = inject(UserPreferencesService);
  private readonly destroyRef = inject(DestroyRef);

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

  // compliance-calendar A-3: overlay Super-Group layers + selection (persisted).
  protected readonly superGroups = signal<CalendarSuperGroup[]>([]);
  protected readonly selectedLayerIds = signal<number[]>(
    this.userPreferences.get<number[]>('calendar:layers') ?? []
  );
  protected readonly layersOpen = signal(false);
  protected readonly events = signal<CalendarEvent[]>([]);
  protected readonly savedViews = signal<CalendarSavedView[]>([]);
  protected readonly savedViewOptions = computed<SelectOption[]>(() => [
    { value: null, label: this.translate.instant('calendar.savedViews.custom') },
    ...this.savedViews().map(v => ({ value: v.id, label: v.name })),
  ]);
  protected readonly selectedViewControl = new FormControl<number | null>(null);
  protected readonly newViewNameControl = new FormControl<string>('', { nonNullable: true });

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

  /** compliance-calendar A-3: layer-filtered events for the day view. */
  protected readonly dayEvents = computed(() => this.eventsByDate().get(this.currentDateKey()) ?? []);

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

  /** compliance-calendar A-3: events grouped by day, filtered to selected layers, with layer colour. */
  protected readonly eventsByDate = computed(() => {
    const selected = new Set(this.selectedLayerIds());
    const colorByGroup = new Map(this.superGroups().map(g => [g.id, g.color ?? 'var(--primary)']));
    const map = new Map<string, { id: number; title: string; color: string }[]>();
    for (const e of this.events()) {
      if (e.superGroupId != null && !selected.has(e.superGroupId)) continue;
      const key = this.toDateStr(new Date(e.startTime));
      const list = map.get(key) ?? [];
      list.push({
        id: e.id,
        title: e.title,
        color: e.superGroupId != null ? (colorByGroup.get(e.superGroupId) ?? 'var(--primary)') : 'var(--text-muted)',
      });
      map.set(key, list);
    }
    return map;
  });

  constructor() {
    this.loadJobs();
    this.kanbanService.getTrackTypes().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(types => {
      this.trackTypeOptions.set([
        { value: null, label: this.translate.instant('calendar.allTrackTypes') },
        ...types.map(t => ({ value: t.id, label: t.name })),
      ]);
    });

    // compliance-calendar A-3: load the visibility-filtered layer list; default the
    // selection when the user has no saved preference. In the 'master' scope we
    // default to the default-visible groups only; in a module scope (e.g.
    // 'module:compliance') we default to ALL super-groups the user can see, so the
    // regulatory/compliance buckets (which are defaultVisible: false) surface by
    // default in the module context. The server already filters by visibility.
    this.service.getSuperGroups().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (groups) => {
        this.superGroups.set(groups);
        if (this.userPreferences.get<number[]>('calendar:layers') == null) {
          const defaults = this.scope() === 'master'
            ? groups.filter(g => g.defaultVisible)
            : groups;
          this.selectedLayerIds.set(defaults.map(g => g.id));
        }
      },
      error: () => this.superGroups.set([]),
    });

    this.selectedViewControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(id => this.applyView(id));

    this.trackTypeControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.allJobs.update(j => [...j]);
    });

    // Reload PO events whenever the current date changes (month navigation).
    // Use untracked for showPoDeliveries to avoid double-load when toggling —
    // togglePoDeliveries() already calls loadPoEvents() directly on enable.
    effect(() => {
      this.currentDate(); // track dependency only
      this.loadEvents();
      if (untracked(() => this.showPoDeliveries())) {
        this.loadPoEvents();
      }
    });
  }

  ngOnInit(): void {
    // Deferred to ngOnInit so the `scope` input binding is resolved before we
    // pass it to the scoped saved-views endpoint (input signals hold their
    // default during the constructor).
    this.loadSavedViews();
  }

  protected loadJobs(): void {
    this.loading.set(true);
    this.service.getJobs().subscribe({
      next: (jobs) => { this.allJobs.set(jobs); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected toggleLayersPanel(): void {
    this.layersOpen.update(o => !o);
  }

  protected onLayerToggled(groupId: number): void {
    const current = this.selectedLayerIds();
    const next = current.includes(groupId)
      ? current.filter(id => id !== groupId)
      : [...current, groupId];
    this.selectedLayerIds.set(next);
    this.userPreferences.set('calendar:layers', next);
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

  private loadEvents(): void {
    const d = this.currentDate();
    const year = d.getFullYear();
    const month = d.getMonth();

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
    const to = this.toDateStr(new Date(gridEnd.getFullYear(), gridEnd.getMonth(), gridEnd.getDate() + 1));

    // Fire-and-forget GET (completes naturally); degrade to empty if events are gated/unavailable.
    this.service.getEvents(from, to).subscribe({
      next: events => this.events.set(events),
      error: () => this.events.set([]),
    });
  }

  private loadSavedViews(): void {
    this.service.getSavedViews(this.scope()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (views) => {
        this.savedViews.set(views);
        // Apply a role-default view when the user has no saved layer preference.
        const def = views.find(v => v.isDefault);
        if (def && this.userPreferences.get<number[]>('calendar:layers') == null) {
          this.selectedLayerIds.set(def.selectedSuperGroupIds);
        }
      },
      error: () => this.savedViews.set([]),
    });
  }

  protected applyView(viewId: number | null): void {
    if (viewId == null) return;
    const view = this.savedViews().find(v => v.id === viewId);
    if (!view) return;
    this.selectedLayerIds.set(view.selectedSuperGroupIds);
    this.userPreferences.set('calendar:layers', view.selectedSuperGroupIds);
  }

  protected saveCurrentView(): void {
    const name = this.newViewNameControl.value.trim();
    if (!name) return;
    this.service.createSavedView({
      name,
      scope: this.scope(),
      selectedSuperGroupIds: this.selectedLayerIds(),
      selectedEventTypeIds: [],
    }).subscribe({
      next: (view) => {
        this.savedViews.update(vs => [...vs, view]);
        this.newViewNameControl.setValue('');
        this.selectedViewControl.setValue(view.id, { emitEvent: false });
      },
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

  /** Only High/Urgent jobs get a visible priority indicator in the calendar (preserves the original "flag high-priority only" intent, with correct enum keys). */
  protected isHighPriority(priority: string): boolean {
    return priority === 'High' || priority === 'Urgent';
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
