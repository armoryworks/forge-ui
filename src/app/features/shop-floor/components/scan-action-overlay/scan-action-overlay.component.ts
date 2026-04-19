import {
  ChangeDetectionStrategy, Component, computed, effect, inject, output, signal,
} from '@angular/core';

import { ScannerService } from '../../../../shared/services/scanner.service';
import { ScanActionService } from '../../../../shared/services/scan-action.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ScanContext } from '../../../../shared/models/scan-action.model';
import { QuickActionPanelComponent, QuickAction } from '../../../../shared/components/quick-action-panel/quick-action-panel.component';
import { ScanMoveFlowComponent } from '../scan-move-flow/scan-move-flow.component';
import { ScanCountFlowComponent } from '../scan-count-flow/scan-count-flow.component';
import { ScanReceiveFlowComponent } from '../scan-receive-flow/scan-receive-flow.component';
import { ScanIssueFlowComponent } from '../scan-issue-flow/scan-issue-flow.component';
import { ScanShipFlowComponent, ShipmentLineItem } from '../scan-ship-flow/scan-ship-flow.component';
import { ScanInspectFlowComponent } from '../scan-inspect-flow/scan-inspect-flow.component';
import { ScanJobFlowComponent } from '../scan-job-flow/scan-job-flow.component';
import { ScanReturnFlowComponent, RecentShipmentItem } from '../scan-return-flow/scan-return-flow.component';

type OverlayPhase = 'idle' | 'loading' | 'actions' | 'move' | 'count' | 'receive' | 'issue' | 'ship' | 'inspect' | 'job' | 'return';

interface JobActionContext {
  jobId: number;
  jobNumber: string;
  jobTitle: string;
  currentStage: string;
  assigneeName: string | null;
  hasActiveTimer: boolean;
}

const ACTION_ICONS: Record<string, string> = {
  Move: 'swap_horiz',
  Count: 'inventory',
  Receive: 'move_to_inbox',
  Ship: 'local_shipping',
  Issue: 'output',
  Inspect: 'fact_check',
  Return: 'assignment_return',
  Job: 'engineering',
};

const ACTION_COLORS: Record<string, string> = {
  Move: 'var(--primary)',
  Count: 'var(--info)',
  Receive: 'var(--success)',
  Ship: 'var(--accent)',
  Issue: 'var(--warning)',
  Inspect: 'var(--primary)',
  Return: 'var(--error)',
  Job: 'var(--info)',
};

@Component({
  selector: 'app-scan-action-overlay',
  standalone: true,
  imports: [
    QuickActionPanelComponent,
    ScanMoveFlowComponent,
    ScanCountFlowComponent,
    ScanReceiveFlowComponent,
    ScanIssueFlowComponent,
    ScanShipFlowComponent,
    ScanInspectFlowComponent,
    ScanJobFlowComponent,
    ScanReturnFlowComponent,
  ],
  templateUrl: './scan-action-overlay.component.html',
  styleUrl: './scan-action-overlay.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScanActionOverlayComponent {
  private readonly scanner = inject(ScannerService);
  private readonly scanAction = inject(ScanActionService);
  private readonly snackbar = inject(SnackbarService);

  readonly dismissed = output<void>();

  protected readonly phase = signal<OverlayPhase>('idle');
  protected readonly context = signal<ScanContext | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly multiScanMode = signal(false);

  protected readonly isVisible = computed(() => this.phase() !== 'idle');

  protected readonly quickActions = computed<QuickAction[]>(() => {
    const ctx = this.context();
    if (!ctx) return [];
    return ctx.availableActions.map(a => ({
      id: a.action,
      label: a.action,
      icon: ACTION_ICONS[a.action] ?? 'help_outline',
      color: ACTION_COLORS[a.action] ?? 'var(--primary)',
      disabled: !a.enabled,
    }));
  });

  protected readonly disabledReasons = computed<Record<string, string>>(() => {
    const ctx = this.context();
    if (!ctx) return {};
    const map: Record<string, string> = {};
    for (const a of ctx.availableActions) {
      if (!a.enabled && a.disabledReason) {
        map[a.action] = a.disabledReason;
      }
    }
    return map;
  });

  /** Extract open shipment lines from the Ship action context. */
  protected readonly openShipmentLines = computed<ShipmentLineItem[]>(() => {
    const ctx = this.context();
    if (!ctx) return [];
    const shipAction = ctx.availableActions.find(a => a.action === 'Ship');
    const actionCtx = shipAction?.context as { openShipmentLines?: ShipmentLineItem[] } | undefined;
    return actionCtx?.openShipmentLines ?? [];
  });

  /** Extract QC template ID from the Inspect action context. */
  protected readonly qcTemplateId = computed<number | null>(() => {
    const ctx = this.context();
    if (!ctx) return null;
    const inspectAction = ctx.availableActions.find(a => a.action === 'Inspect');
    const actionCtx = inspectAction?.context as { qcTemplateId?: number } | undefined;
    return actionCtx?.qcTemplateId ?? null;
  });

  /** Extract recent shipments from the Return action context. */
  protected readonly recentShipments = computed<RecentShipmentItem[]>(() => {
    const ctx = this.context();
    if (!ctx) return [];
    const returnAction = ctx.availableActions.find(a => a.action === 'Return');
    const actionCtx = returnAction?.context as { recentShipments?: RecentShipmentItem[] } | undefined;
    return actionCtx?.recentShipments ?? [];
  });

  /** Extract job details from the Job action context (when scanning a job barcode). */
  protected readonly jobContext = computed<JobActionContext | null>(() => {
    const ctx = this.context();
    if (!ctx) return null;
    const jobAction = ctx.availableActions.find(a => a.action === 'Job');
    if (!jobAction?.context) return null;
    const actionCtx = jobAction.context as JobActionContext;
    return actionCtx;
  });

  // Listen for scans in inventory context
  private readonly scanEffect = effect(() => {
    const scan = this.scanner.lastScan();
    if (!scan) return;
    if (scan.context !== 'inventory' && scan.context !== 'shop-floor') return;

    // Only handle scans when idle or in multi-scan mode after completing an action
    if (this.phase() !== 'idle' && !this.multiScanMode()) return;
    if (this.phase() !== 'idle' && this.phase() !== 'actions') return;

    this.scanner.clearLastScan();
    this.lookupPart(scan.value);
  });

  /** Trigger a scan lookup programmatically (e.g., from a parent component). */
  triggerScan(value: string): void {
    this.lookupPart(value);
  }

  private lookupPart(identifier: string): void {
    this.phase.set('loading');
    this.error.set(null);

    this.scanAction.getContext(identifier).subscribe({
      next: (ctx) => {
        this.context.set(ctx);
        this.phase.set('actions');
      },
      error: () => {
        this.error.set(`Part not found: ${identifier}`);
        this.phase.set('actions');
        setTimeout(() => this.close(), 3000);
      },
    });
  }

  protected onActionClick(actionId: string): void {
    switch (actionId) {
      case 'Move':
        this.phase.set('move');
        break;
      case 'Count':
        this.phase.set('count');
        break;
      case 'Receive':
        this.phase.set('receive');
        break;
      case 'Issue':
        this.phase.set('issue');
        break;
      case 'Ship':
        this.startShip();
        break;
      case 'Inspect':
        this.startInspect();
        break;
      case 'Job':
        this.startJob();
        break;
      case 'Return':
        this.startReturn();
        break;
      default:
        this.snackbar.info(`${actionId} is not yet implemented`);
    }
  }

  protected startShip(): void {
    const lines = this.openShipmentLines();
    if (lines.length === 0) {
      this.snackbar.info('No open shipment lines for this part');
      return;
    }
    this.phase.set('ship');
  }

  protected startInspect(): void {
    this.phase.set('inspect');
  }

  protected startJob(): void {
    const job = this.jobContext();
    if (!job) {
      this.snackbar.info('No job context available');
      return;
    }
    this.phase.set('job');
  }

  protected startReturn(): void {
    const shipments = this.recentShipments();
    if (shipments.length === 0) {
      this.snackbar.info('No recent shipments found for this part');
      return;
    }
    this.phase.set('return');
  }

  protected onFlowCompleted(): void {
    if (this.multiScanMode()) {
      // Stay open, ready for next scan
      this.phase.set('actions');
      this.snackbar.success('Ready for next scan');
    } else {
      this.close();
    }
  }

  protected onFlowCancelled(): void {
    this.phase.set('actions');
  }

  protected toggleMultiScan(): void {
    this.multiScanMode.update(v => !v);
  }

  protected close(): void {
    this.phase.set('idle');
    this.context.set(null);
    this.error.set(null);
    this.multiScanMode.set(false);
    this.dismissed.emit();
  }
}
