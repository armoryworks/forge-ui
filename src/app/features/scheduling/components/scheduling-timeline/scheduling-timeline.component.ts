import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ScheduledOperation } from '../../models/scheduling.model';

interface TimelineBar {
  id: number;
  label: string;
  startPct: number;
  widthPct: number;
  statusClass: string;
  tooltip: string;
}

interface TimelineRow {
  workCenterName: string;
  bars: TimelineBar[];
}

interface AxisTick {
  pct: number;
  date: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_BAR_WIDTH_PCT = 1.5;
const AXIS_DIVISIONS = 4;

/**
 * Visual (timeline) presentation of the schedule — one row per work center with
 * floating bars positioned by each operation's real scheduled start/end and
 * colored by status. Dumb component; the scheduling smart component supplies the
 * operations and owns the Classic/Visual toggle.
 */
@Component({
  selector: 'app-scheduling-timeline',
  standalone: true,
  imports: [DatePipe, TranslatePipe],
  templateUrl: './scheduling-timeline.component.html',
  styleUrl: './scheduling-timeline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchedulingTimelineComponent {
  private readonly translate = inject(TranslateService);

  readonly operations = input.required<ScheduledOperation[]>();

  private readonly range = computed<{ min: number; max: number } | null>(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const o of this.operations()) {
      const s = new Date(o.scheduledStart).getTime();
      const e = new Date(o.scheduledEnd).getTime();
      if (!isNaN(s)) min = Math.min(min, s);
      if (!isNaN(e)) max = Math.max(max, e);
    }
    if (min === Infinity) return null;
    if (max <= min) return { min, max: min + DAY_MS };
    return { min, max };
  });

  protected readonly rows = computed<TimelineRow[]>(() => {
    const r = this.range();
    if (!r) return [];
    const span = r.max - r.min;
    const byWc = new Map<string, TimelineBar[]>();

    for (const o of this.operations()) {
      const s = new Date(o.scheduledStart).getTime();
      const e = new Date(o.scheduledEnd).getTime();
      if (isNaN(s) || isNaN(e)) continue;
      const wc = o.workCenterName || this.translate.instant('scheduling.timeline.noWorkCenter');
      const startPct = ((s - r.min) / span) * 100;
      const widthPct = Math.max(MIN_BAR_WIDTH_PCT, ((e - s) / span) * 100);
      const bar: TimelineBar = {
        id: o.id,
        label: o.jobNumber,
        startPct,
        widthPct: Math.min(widthPct, 100 - startPct),
        statusClass: this.statusClass(o.status),
        tooltip: `${o.jobNumber} - ${o.operationTitle} (${o.status})`,
      };
      const arr = byWc.get(wc) ?? [];
      arr.push(bar);
      byWc.set(wc, arr);
    }

    return [...byWc.entries()].map(([workCenterName, bars]) => ({ workCenterName, bars }));
  });

  protected readonly axisTicks = computed<AxisTick[]>(() => {
    const r = this.range();
    if (!r) return [];
    const ticks: AxisTick[] = [];
    for (let i = 0; i <= AXIS_DIVISIONS; i++) {
      ticks.push({ pct: (i / AXIS_DIVISIONS) * 100, date: new Date(r.min + ((r.max - r.min) * i) / AXIS_DIVISIONS) });
    }
    return ticks;
  });

  private statusClass(status: string): string {
    switch (status) {
      case 'Scheduled':
        return 'sched-timeline__bar--info';
      case 'InProgress':
        return 'sched-timeline__bar--warning';
      case 'Complete':
        return 'sched-timeline__bar--success';
      default:
        return 'sched-timeline__bar--muted';
    }
  }
}
