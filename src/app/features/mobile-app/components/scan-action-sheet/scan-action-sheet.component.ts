import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { ScanResolveResult } from '../../../../shared/models/mobile-api.model';

export type ScanAction = 'start' | 'stop' | 'complete' | 'move' | 'details' | 'moveStock' | 'identify' | 'receive';

interface ActionButton {
  action: ScanAction;
  labelKey: string;
  icon: string;
  primary?: boolean;
}

/**
 * The one contextual action sheet after a decode: "Job 4471 — Start /
 * Complete / Move / Details". Start becomes Stop while the person's timer
 * runs on this job; a purchase order offers Receive. Dumb: the parent resolves the scan and performs the
 * chosen action. Never navigates on its own.
 */
@Component({
  selector: 'app-scan-action-sheet',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './scan-action-sheet.component.html',
  styleUrl: './scan-action-sheet.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScanActionSheetComponent {
  readonly result = input.required<ScanResolveResult>();
  readonly busy = input<boolean>(false);
  readonly runningJobId = input<number | null>(null);
  readonly actingAs = input<string | null>(null);
  readonly chosen = output<ScanAction>();
  readonly dismissed = output<void>();
  readonly notYou = output<void>();

  protected readonly titleKey = computed(() => `mobileApp.scan.kind.${this.result().kind}`);

  protected readonly actions = computed<ActionButton[]>(() => {
    switch (this.result().kind) {
      case 'job':
        return [
          this.result().id !== null && this.runningJobId() === this.result().id
            ? { action: 'stop', labelKey: 'mobileApp.scan.actions.stop', icon: 'stop', primary: true }
            : { action: 'start', labelKey: 'mobileApp.scan.actions.start', icon: 'play_arrow', primary: true },
          { action: 'complete', labelKey: 'mobileApp.scan.actions.complete', icon: 'check' },
          { action: 'move', labelKey: 'mobileApp.scan.actions.move', icon: 'arrow_forward' },
          { action: 'details', labelKey: 'mobileApp.scan.actions.details', icon: 'info' },
        ];
      case 'part':
        return [
          { action: 'moveStock', labelKey: 'mobileApp.scan.actions.moveStock', icon: 'swap_horiz', primary: true },
          { action: 'details', labelKey: 'mobileApp.scan.actions.details', icon: 'info' },
        ];
      case 'bin':
      case 'lot':
        return [{ action: 'moveStock', labelKey: 'mobileApp.scan.actions.moveStock', icon: 'swap_horiz', primary: true }];
      case 'badge':
        return [{ action: 'identify', labelKey: 'mobileApp.scan.actions.identify', icon: 'badge', primary: true }];
      case 'purchaseOrder':
        return [
          { action: 'receive', labelKey: 'mobileAppWork.scan.receive', icon: 'move_to_inbox', primary: true },
          { action: 'details', labelKey: 'mobileApp.scan.actions.openOnDesktop', icon: 'open_in_new' },
        ];
      default:
        return [{ action: 'details', labelKey: 'mobileApp.scan.actions.openOnDesktop', icon: 'open_in_new' }];
    }
  });
}
