import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { DurationMsPipe } from '../../../../shared/pipes/duration-ms.pipe';
import { JobOperationRow } from '../../models/job-operation-row.model';

interface OperationTile {
  row: JobOperationRow;
  statusKey: string;
  closed: boolean;
  mineRunning: boolean;
  othersInitials: string;
  elapsedMs: number | null;
}

@Component({
  selector: 'app-kiosk-operation-tiles',
  standalone: true,
  imports: [TranslatePipe, DurationMsPipe],
  templateUrl: './kiosk-operation-tiles.component.html',
  styleUrl: './kiosk-operation-tiles.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KioskOperationTilesComponent {
  readonly operations = input.required<JobOperationRow[]>();
  readonly jobQuantity = input.required<number>();
  readonly currentUserId = input<number | null>(null);
  readonly now = input.required<number>();
  readonly busy = input(false);

  readonly start = output<JobOperationRow>();
  readonly startSetup = output<JobOperationRow>();
  readonly stop = output<JobOperationRow>();
  readonly done = output<JobOperationRow>();
  readonly addQuantity = output<JobOperationRow>();

  protected readonly tiles = computed<OperationTile[]>(() => {
    const me = this.currentUserId();
    const now = this.now();
    return this.operations()
      .filter(row => row.isRoutingStep && row.operationId != null)
      .map(row => {
        const mine = row.openTimers.find(t => t.userId === me);
        const others = row.openTimers.filter(t => t.userId !== me);
        const shown = mine ?? row.openTimers[0];
        return {
          row,
          statusKey: `shopFloor.operations.status.${row.status}`,
          closed: row.status === 'Complete' || row.status === 'Skipped',
          mineRunning: !!mine,
          othersInitials: others.map(t => t.userInitials ?? t.userName).join(', '),
          elapsedMs: shown ? Math.max(0, Math.round((now - Date.parse(shown.timerStart)) / 1000) * 1000) : null,
        };
      });
  });
}
