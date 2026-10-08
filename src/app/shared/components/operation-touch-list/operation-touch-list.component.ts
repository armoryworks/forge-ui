import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { TranslatePipe } from '@ngx-translate/core';

import { DurationMsPipe } from '../../pipes/duration-ms.pipe';
import { JobOperationEntryType } from '../../models/job-operation-entry-type.type';
import { JobOperationRow } from '../../models/job-operation-row.model';
import { JOB_OPERATION_STATUS_DISPLAY } from '../../models/job-operation-status-display.const';
import { elapsedMs } from '../../utils/elapsed-ms';
import { secondTicker } from '../../utils/second-ticker';

@Component({
  selector: 'app-operation-touch-list',
  standalone: true,
  imports: [DecimalPipe, TranslatePipe, DurationMsPipe],
  templateUrl: './operation-touch-list.component.html',
  styleUrl: './operation-touch-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperationTouchListComponent {
  readonly operations = input<JobOperationRow[]>([]);
  readonly jobQuantity = input(1);
  readonly currentUserId = input<number | null>(null);
  readonly size = input<'compact' | 'large'>('compact');
  readonly clockOffsetMs = input(0);
  readonly busyOperationId = input<number | null>(null);

  readonly startRequested = output<{ operation: JobOperationRow; entryType: JobOperationEntryType }>();
  readonly stopRequested = output<JobOperationRow>();
  readonly doneRequested = output<JobOperationRow>();
  readonly quantityRequested = output<JobOperationRow>();

  private readonly now = secondTicker();

  protected readonly rows = computed(() => {
    const now = this.now() + this.clockOffsetMs();
    const me = this.currentUserId();
    return this.operations().map(operation => {
      const mine = operation.openTimers.find(t => t.userId === me) ?? null;
      const others = operation.openTimers.filter(t => t.userId !== me);
      const closed = operation.status === 'Complete' || operation.status === 'Skipped';
      return {
        operation,
        key: operation.jobOperationId ?? -operation.stepNumber,
        display: JOB_OPERATION_STATUS_DISPLAY[operation.status],
        mine,
        mineElapsedMs: mine ? elapsedMs(mine.timerStart, now) : 0,
        otherInitials: others.map(t => t.userInitials ?? t.userName.slice(0, 2).toUpperCase()),
        actionable: operation.operationId !== null && operation.isRoutingStep,
        closed,
      };
    });
  });
}
