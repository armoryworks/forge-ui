import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';

import { TranslatePipe } from '@ngx-translate/core';

import { ScheduleMilestone } from '../../models/schedule-milestone.model';

export interface MilestoneItem {
  key: string;
  label: string;
  icon: string;
  date: Date | null;
  status: 'completed' | 'overdue' | 'upcoming';
}

@Component({
  selector: 'app-schedule-timeline',
  standalone: true,
  imports: [DatePipe, TranslatePipe],
  templateUrl: './schedule-timeline.component.html',
  styleUrl: './schedule-timeline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleTimelineComponent {
  readonly milestones = input.required<ScheduleMilestone[]>();

  protected readonly lineSchedules = computed(() => {
    const now = new Date();
    return this.milestones().map(m => ({
      salesOrderLineId: m.salesOrderLineId,
      partNumber: m.partNumber,
      partDescription: m.partDescription,
      isAtRisk: m.isAtRisk,
      items: this.buildMilestoneItems(m, now),
      timelineSegments: this.buildTimelineSegments(m, now),
    }));
  });

  private buildMilestoneItems(m: ScheduleMilestone, now: Date): MilestoneItem[] {
    const milestones: { key: string; label: string; icon: string; dateStr: string | null }[] = [
      { key: 'poOrderBy', label: 'salesOrders.schedule.poOrderBy', icon: 'shopping_cart', dateStr: m.poOrderBy },
      { key: 'materialsNeededBy', label: 'salesOrders.schedule.materialsNeeded', icon: 'inventory_2', dateStr: m.materialsNeededBy },
      { key: 'productionStartBy', label: 'salesOrders.schedule.productionStart', icon: 'play_arrow', dateStr: m.productionStartBy },
      { key: 'productionCompleteBy', label: 'salesOrders.schedule.productionComplete', icon: 'check_circle', dateStr: m.productionCompleteBy },
      { key: 'qcCompleteBy', label: 'salesOrders.schedule.qcComplete', icon: 'verified', dateStr: m.qcCompleteBy },
      { key: 'shipBy', label: 'salesOrders.schedule.shipBy', icon: 'local_shipping', dateStr: m.shipBy },
      { key: 'deliveryDate', label: 'salesOrders.schedule.delivery', icon: 'flag', dateStr: m.deliveryDate },
    ];

    return milestones.map(ms => {
      const date = ms.dateStr ? new Date(ms.dateStr) : null;
      let status: 'completed' | 'overdue' | 'upcoming' = 'upcoming';
      if (date) {
        if (date < now) {
          // Past milestones: assume completed unless this is a future-oriented milestone
          // For simplicity, if the delivery date itself is past, it's overdue; others are completed
          status = ms.key === 'deliveryDate' ? 'overdue' : 'completed';
        }
        // If the milestone is past but the whole line is at risk, mark past items as overdue
        if (date < now && m.isAtRisk && ms.key !== 'deliveryDate') {
          // Only mark as overdue if a downstream milestone is also past
          status = 'completed';
        }
      }
      return { key: ms.key, label: ms.label, icon: ms.icon, date, status };
    });
  }

  protected getDotPosition(line: { items: MilestoneItem[] }, index: number): number {
    const validDates = line.items.filter(i => i.date !== null).map(i => i.date!.getTime());
    if (validDates.length < 2) return 0;
    const min = Math.min(...validDates);
    const max = Math.max(...validDates);
    const range = max - min;
    if (range <= 0) return 0;
    const item = line.items[index];
    if (!item.date) return 0;
    return ((item.date.getTime() - min) / range) * 100;
  }

  private buildTimelineSegments(m: ScheduleMilestone, now: Date): { left: number; width: number; status: string }[] {
    const dates = [m.poOrderBy, m.materialsNeededBy, m.productionStartBy, m.productionCompleteBy, m.qcCompleteBy, m.shipBy, m.deliveryDate]
      .map(d => d ? new Date(d).getTime() : null)
      .filter((d): d is number => d !== null);

    if (dates.length < 2) return [];

    const min = Math.min(...dates);
    const max = Math.max(...dates);
    const range = max - min;
    if (range <= 0) return [];

    const nowTime = now.getTime();
    const segments: { left: number; width: number; status: string }[] = [];

    for (let i = 0; i < dates.length - 1; i++) {
      const start = dates[i];
      const end = dates[i + 1];
      const left = ((start - min) / range) * 100;
      const width = ((end - start) / range) * 100;

      let status = 'upcoming';
      if (end < nowTime) {
        status = 'completed';
      } else if (start < nowTime && end >= nowTime) {
        status = 'active';
      }

      segments.push({ left, width, status });
    }

    return segments;
  }
}
