import {
  ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { firstValueFrom } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { JobOperationRow } from '../../../../shared/models/job-operation-row.model';
import { JobOperations } from '../../../../shared/models/job-operations.model';
import { isQueued } from '../../../../shared/models/mobile-api.model';
import { UpdateJobOperationProgressRequest } from '../../../../shared/models/update-job-operation-progress-request.model';
import { AuthService } from '../../../../shared/services/auth.service';
import { InstanceService } from '../../../../shared/services/instance.service';
import { MobileApiService } from '../../../../shared/services/mobile-api.service';
import { MobileTimerService } from '../../../../shared/services/mobile-timer.service';
import { OfflineQueueService } from '../../../../shared/services/offline-queue.service';
import { SharedIdentityService } from '../../../../shared/services/shared-identity.service';
import { UndoService } from '../../../../shared/services/undo.service';
import { IdentityPromptComponent } from '../../identity/identity-prompt.component';
import { OperationEdit } from '../../models/operation-edit.model';
import { OperationQuantityEntry } from '../../models/operation-quantity-entry.model';
import { OperationRowView } from '../../models/operation-row-view.model';
import { OperationQuantitySheetComponent } from '../operation-quantity-sheet/operation-quantity-sheet.component';

/**
 * A job's routing operations on the phone, shown only while operation
 * tracking is on. Each step starts and stops its own timer, so several can
 * run at once; Done and +Qty record absolute counts. Every change offers an
 * undo toast: a start is undone by stopping it, a stop by starting again,
 * and a count by sending the earlier values back. Compact mode, under the
 * scan sheet, leaves out finished steps and puts the current one first.
 * When the last step is done it offers the job's gated move to the next
 * column instead of moving it. Reads need a connection; writes queue offline.
 */
@Component({
  selector: 'app-job-operations',
  standalone: true,
  imports: [TranslatePipe, IdentityPromptComponent, OperationQuantitySheetComponent],
  templateUrl: './job-operations.component.html',
  styleUrl: './job-operations.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobOperationsComponent {
  readonly jobId = input.required<number>();
  readonly compact = input<boolean>(false);
  readonly moveRequested = output<void>();

  private readonly api = inject(MobileApiService);
  private readonly timer = inject(MobileTimerService);
  private readonly undo = inject(UndoService);
  private readonly queue = inject(OfflineQueueService);
  private readonly translate = inject(TranslateService);
  private readonly identity = inject(SharedIdentityService);
  private readonly instances = inject(InstanceService);
  private readonly auth = inject(AuthService);

  protected readonly data = signal<JobOperations | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly busy = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly editing = signal<OperationEdit | null>(null);
  protected readonly identifying = signal(false);
  protected readonly moveOffered = signal(false);

  private readonly now = signal(Date.now());
  private serverOffset = 0;
  private pending: (() => Promise<boolean>) | null = null;
  private loads = 0;

  protected readonly rows = computed<OperationRowView[]>(() => {
    const data = this.data();
    if (!data) return [];
    const me = this.auth.user()?.id ?? null;
    const now = this.now() + this.serverOffset;
    const views = data.operations.map((row): OperationRowView => {
      const mine = row.openTimers.find((t) => t.userId === me) ?? null;
      const done = row.status === 'Complete' || row.status === 'Skipped';
      return {
        key: `${row.stepNumber}:${row.operationId ?? row.jobOperationId}`,
        row,
        label: this.labelOf(row),
        mine,
        others: row.openTimers.filter((t) => t.userId !== me).map((t) => t.userInitials ?? t.userName),
        elapsed: mine ? this.timer.elapsedOf(mine, now) : null,
        done,
        actionable: data.trackingEnabled && row.isRoutingStep && row.operationId !== null && !done,
      };
    });
    if (!this.compact()) return views;
    const open = views.filter((v) => !v.done);
    const mineAt = open.findIndex((v) => v.mine !== null);
    const current = mineAt >= 0 ? mineAt : Math.max(0, open.findIndex((v) => v.row.status === 'InProgress'));
    return open.length ? [open[current], ...open.filter((_, i) => i !== current)] : [];
  });

  constructor() {
    effect(() => {
      const id = this.jobId();
      untracked(() => {
        this.data.set(null);
        this.moveOffered.set(false);
        this.load(id);
      });
    });

    effect((onCleanup) => {
      if (!this.data()?.operations.some((row) => row.openTimers.length > 0)) return;
      untracked(() => this.now.set(Date.now()));
      const tick = setInterval(() => this.now.set(Date.now()), 1000);
      onCleanup(() => clearInterval(tick));
    });
  }

  protected start(view: OperationRowView, entryType: 'Run' | 'Setup' = 'Run'): void {
    this.guard(() => this.doStart(view.row, entryType));
  }

  protected stop(view: OperationRowView): void {
    this.guard(() => this.doStop(view.row));
  }

  protected openQuantity(view: OperationRowView, finishing: boolean): void {
    this.notice.set(null);
    this.editing.set({ row: view.row, finishing });
  }

  protected closeQuantity(): void {
    this.editing.set(null);
  }

  protected record(entry: OperationQuantityEntry): void {
    const edit = this.editing();
    if (edit) this.guard(() => this.doRecord(edit.row, entry));
  }

  protected requestMove(): void {
    this.moveOffered.set(false);
    this.moveRequested.emit();
  }

  protected onIdentified(): void {
    this.identifying.set(false);
    const run = this.pending;
    this.pending = null;
    if (run) void this.execute(run);
  }

  protected onIdentityCancelled(): void {
    this.identifying.set(false);
    this.pending = null;
  }

  private guard(run: () => Promise<boolean>): void {
    if (this.busy()) return;
    if (this.instances.instance()?.shared && !this.identity.identified()) {
      this.pending = run;
      this.identifying.set(true);
      return;
    }
    void this.execute(run);
  }

  private async execute(run: () => Promise<boolean>): Promise<void> {
    this.busy.set(true);
    this.notice.set(null);
    let ended = false;
    try {
      ended = await run();
    } catch (err) {
      this.editing.set(null);
      this.notice.set(this.translate.instant(err instanceof HttpErrorResponse && err.status === 409
        ? 'mobileApp.operations.conflict'
        : 'mobileApp.jobs.actionFailed'));
      this.load(this.jobId());
    } finally {
      this.busy.set(false);
      if (!ended) this.identity.touch();
    }
  }

  private async doStart(row: JobOperationRow, entryType: 'Run' | 'Setup'): Promise<boolean> {
    const jobId = this.jobId();
    const operationId = row.operationId!;
    const token = this.sharedToken();
    const result = await firstValueFrom(this.api.startOperationTimer(jobId, operationId, entryType));
    if (isQueued(result)) return this.offerQueuedUndo(result.entryId, token);
    this.changed();
    if (result.alreadyRunning) {
      this.notice.set(this.translate.instant('mobileApp.operations.alreadyRunning', { name: this.labelOf(row) }));
      return false;
    }
    this.undo.offer(
      this.translate.instant('mobileApp.operations.started', { name: this.labelOf(row) }),
      async () => {
        await firstValueFrom(this.api.stopOperationTimer(jobId, operationId, token));
        this.changed();
      },
      this.endIdentity(token),
    );
    return !!token;
  }

  private async doStop(row: JobOperationRow): Promise<boolean> {
    const jobId = this.jobId();
    const operationId = row.operationId!;
    const token = this.sharedToken();
    const result = await firstValueFrom(this.api.stopOperationTimer(jobId, operationId));
    if (isQueued(result)) return this.offerQueuedUndo(result.entryId, token);
    this.changed();
    if (!result.stopped) return false;
    const entryType = result.entry?.entryType === 'Setup' ? 'Setup' : 'Run';
    this.undo.offer(
      this.translate.instant('mobileApp.operations.stopped', { name: this.labelOf(row) }),
      async () => {
        await firstValueFrom(this.api.startOperationTimer(jobId, operationId, entryType, token));
        this.changed();
      },
      this.endIdentity(token),
    );
    return !!token;
  }

  private async doRecord(row: JobOperationRow, entry: OperationQuantityEntry): Promise<boolean> {
    const jobId = this.jobId();
    const operationId = row.operationId!;
    const token = this.sharedToken();
    const request: UpdateJobOperationProgressRequest = {
      completedQuantity: entry.completed,
      scrapQuantity: entry.scrap,
    };
    if (entry.complete) request.status = 'Complete';
    if (row.version !== null) request.expectedVersion = row.version;

    const result = await firstValueFrom(this.api.updateOperationProgress(jobId, operationId, request));
    this.editing.set(null);
    if (isQueued(result)) return this.offerQueuedUndo(result.entryId, token);
    this.changed();
    if (result.allOperationsComplete) this.moveOffered.set(true);

    const previous: UpdateJobOperationProgressRequest = {
      completedQuantity: row.completedQuantity,
      scrapQuantity: row.scrapQuantity,
    };
    if (result.operation.status !== row.status) previous.status = row.status;
    if (result.operation.version !== null) previous.expectedVersion = result.operation.version;
    this.undo.offer(
      entry.complete
        ? this.translate.instant('mobileApp.operations.completed', { name: this.labelOf(row) })
        : this.translate.instant('mobileApp.operations.recorded', { count: entry.completed, name: this.labelOf(row) }),
      async () => {
        await firstValueFrom(this.api.updateOperationProgress(jobId, operationId, previous, token));
        this.moveOffered.set(false);
        this.changed();
      },
      this.endIdentity(token),
    );
    return !!token;
  }

  private changed(): void {
    this.load(this.jobId());
    void this.timer.refresh();
  }

  private load(jobId: number): void {
    const load = ++this.loads;
    if (!this.data()) this.loading.set(true);
    this.api.jobOperations(jobId).subscribe({
      next: (data) => {
        if (load !== this.loads) return;
        this.serverOffset = Date.parse(data.serverNow) - Date.now() || 0;
        this.data.set(data);
        this.failed.set(false);
        this.loading.set(false);
      },
      error: () => {
        if (load !== this.loads) return;
        if (!this.data()) this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  private offerQueuedUndo(entryId: string, token: string | undefined): boolean {
    this.undo.offer(
      this.translate.instant('mobileApp.offline.queued'),
      () => this.queue.remove(entryId),
      this.endIdentity(token),
    );
    return !!token;
  }

  private sharedToken(): string | undefined {
    if (!this.instances.instance()?.shared || !this.identity.identified()) return undefined;
    return this.auth.token() ?? undefined;
  }

  private endIdentity(token: string | undefined): (() => void) | undefined {
    return token ? () => this.identity.clear() : undefined;
  }

  private labelOf(row: JobOperationRow): string {
    return `${row.stepNumber} ${row.title}`;
  }
}
