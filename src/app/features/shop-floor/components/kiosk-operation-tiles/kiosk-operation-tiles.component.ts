import {
  afterNextRender, ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, Injector, input, output, signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

import { StepGatingMode } from '../../../../shared/models/step-gating-mode.type';
import { DurationMsPipe } from '../../../../shared/pipes/duration-ms.pipe';
import { JobOperationRow } from '../../models/job-operation-row.model';

interface OperationTile {
  row: JobOperationRow;
  statusKey: string;
  closed: boolean;
  mineRunning: boolean;
  othersInitials: string;
  elapsedMs: number | null;
  suggested: boolean;
  focused: boolean;
  mineEntryType: string | null;
  available: number | null;
  waitingOn: string | null;
}

@Component({
  selector: 'app-kiosk-operation-tiles',
  standalone: true,
  imports: [NgTemplateOutlet, TranslatePipe, DurationMsPipe],
  templateUrl: './kiosk-operation-tiles.component.html',
  styleUrl: './kiosk-operation-tiles.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KioskOperationTilesComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);
  private focusedOnce: number | null = null;

  readonly operations = input.required<JobOperationRow[]>();
  readonly jobQuantity = input.required<number>();
  readonly currentUserId = input<number | null>(null);
  readonly now = input.required<number>();
  readonly busy = input(false);
  readonly suggestedOperationId = input<number | null>(null);
  readonly focusOperationId = input<number | null>(null);
  readonly gating = input<StepGatingMode>('Off');

  readonly start = output<JobOperationRow>();
  readonly startSetup = output<JobOperationRow>();
  readonly stop = output<JobOperationRow>();
  readonly done = output<JobOperationRow>();
  readonly addQuantity = output<JobOperationRow>();

  protected readonly showDone = signal(false);
  protected readonly blocking = computed(() => this.gating() === 'Block');

  protected readonly tiles = computed<OperationTile[]>(() => {
    const me = this.currentUserId();
    const now = this.now();
    const suggested = this.suggestedOperationId();
    const focused = this.focusOperationId();
    const gated = this.gating() !== 'Off';
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
          suggested: row.operationId === suggested,
          focused: row.operationId === focused,
          mineEntryType: mine?.entryType ?? null,
          available: gated ? row.available ?? null : null,
          waitingOn: gated && (row.waitingOnSteps?.length ?? 0) > 0 ? row.waitingOnSteps!.join(', ') : null,
        };
      });
  });

  protected readonly openTiles = computed(() => this.tiles().filter(tile => !tile.closed));
  protected readonly doneTiles = computed(() => this.tiles().filter(tile => tile.closed));

  private readonly focusEffect = effect(() => {
    const target = this.focusOperationId();
    if (target == null || target === this.focusedOnce || !this.tiles().some(tile => tile.focused)) return;
    this.focusedOnce = target;
    afterNextRender(() => {
      const tile = (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('.op-tile--focused');
      tile?.scrollIntoView?.({ block: 'center' });
      tile?.querySelector<HTMLButtonElement>('.op-tile__btn--start')?.focus();
    }, { injector: this.injector });
  });

  protected toggleDone(): void {
    this.showDone.update(open => !open);
  }
}
