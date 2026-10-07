import { Injectable, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

import { firstValueFrom } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { ConfirmDialogComponent, ConfirmDialogData } from '../components/confirm-dialog/confirm-dialog.component';
import {
  ActiveTimer, TimerStartOutcome, TimerStopOutcome, TimerToggleOutcome, isQueued,
} from '../models/mobile-api.model';
import { AuthService } from './auth.service';
import { MobileApiService } from './mobile-api.service';
import { OfflineQueueService } from './offline-queue.service';

/**
 * The signed-in person's running timer in the native shell, shared by the
 * strip above the tab bar, the scan action sheet, Lookup and Job Status.
 * Starting on another job stops the running timer first, once the person
 * agrees to switch. Undoing a start deletes the entry rather than stopping
 * it, so no zero-minute row is left behind, and puts back the timer a
 * switch stopped. Undoing a stop starts the same job and operation again.
 */
@Injectable({ providedIn: 'root' })
export class MobileTimerService {
  private readonly api = inject(MobileApiService);
  private readonly auth = inject(AuthService);
  private readonly queue = inject(OfflineQueueService);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);

  private readonly _active = signal<ActiveTimer | null>(null);
  readonly active = this._active.asReadonly();

  private loads = 0;

  async refresh(): Promise<void> {
    const load = ++this.loads;
    if (!this.auth.isAuthenticated()) {
      this._active.set(null);
      return;
    }
    const timer = await firstValueFrom(this.api.activeTimer()).catch(() => undefined);
    if (timer === undefined || load !== this.loads) return;
    this._active.set(timer ?? null);
  }

  clear(): void {
    this.loads++;
    this._active.set(null);
  }

  runningOn(jobId: number | null | undefined): boolean {
    return jobId != null && this._active()?.jobId === jobId;
  }

  labelOf(timer: ActiveTimer): string {
    return timer.jobNumber ?? this.translate.instant('timeTracking.timer');
  }

  elapsedOf(timer: ActiveTimer, now = Date.now()): string {
    const seconds = Math.max(0, Math.floor((now - new Date(timer.timerStart).getTime()) / 1000));
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${Math.floor(seconds / 3600)}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
  }

  runningMessage(timer: ActiveTimer): string {
    return this.translate.instant('mobileApp.timer.running', {
      jobNumber: this.labelOf(timer),
      elapsed: this.elapsedOf(timer),
    });
  }

  stoppedMessage(stopped: ActiveTimer | null): string {
    return stopped?.jobNumber
      ? this.translate.instant('mobileApp.timer.stopped', { jobNumber: stopped.jobNumber })
      : this.translate.instant('timeTracking.timerStopped');
  }

  /**
   * A failed stop reloads the timer before rethrowing: it may have ended
   * somewhere this device never heard about.
   */
  async stop(): Promise<TimerStopOutcome> {
    const stopped = this._active();
    let result: unknown;
    try {
      result = await firstValueFrom(this.api.stopTimer());
    } catch (err) {
      await this.refresh();
      throw err;
    }
    this.clear();
    return { stopped, queuedId: isQueued(result) ? result.entryId : null };
  }

  /**
   * Start pressed on a job. The running timer is read from the server first:
   * on a shared device the person has often only just identified, so the
   * cached one is stale. A timer already on this job is left running.
   * Null when the person declined to switch away from a timer on another job.
   */
  async toggle(jobId: number, jobLabel: string): Promise<TimerToggleOutcome | null> {
    await this.load();
    const running = this._active();
    if (running && this.runningOn(jobId)) return { alreadyRunning: running };
    const started = await this.start(jobId, jobLabel);
    return started ? { started } : null;
  }

  /**
   * Compensation for a start: delete the entry, or stop it when the delete is
   * refused, then restart the timer a switch stopped.
   */
  async undoStart(entryId: number, previous: ActiveTimer | null, token?: string): Promise<void> {
    try {
      await firstValueFrom(this.api.deleteTimeEntry(entryId, token));
    } catch {
      await firstValueFrom(this.api.stopTimer(token));
    }
    if (this._active()?.timeEntryId === entryId) this.clear();
    if (previous) await this.restart(previous, token);
  }

  /** Compensation for a stop: drop the queued stop, or start the same job and operation again. */
  async undoStop(outcome: TimerStopOutcome, token?: string): Promise<void> {
    if (outcome.queuedId !== null) {
      await this.queue.remove(outcome.queuedId);
      this.loads++;
      this._active.set(outcome.stopped);
      return;
    }
    if (outcome.stopped) await this.restart(outcome.stopped, token);
  }

  private async restart(timer: ActiveTimer, token?: string): Promise<void> {
    await firstValueFrom(this.api.startTimer(timer.jobId, token, timer.operationId));
    await this.refresh();
  }

  private async load(): Promise<void> {
    const timer = await firstValueFrom(this.api.activeTimer()).catch(() => undefined);
    if (timer === undefined) return;
    this.loads++;
    this._active.set(timer ?? null);
  }

  private async start(jobId: number, jobLabel: string): Promise<TimerStartOutcome | null> {
    const running = this._active();
    const switching = running !== null && running.jobId !== jobId;
    if (switching && !(await this.confirmSwitch(this.labelOf(running), jobLabel))) return null;
    const previous = switching ? running : null;

    const queuedIds: string[] = [];
    if (switching) {
      const stopped = await firstValueFrom(this.api.stopTimer());
      if (isQueued(stopped)) queuedIds.push(stopped.entryId);
      else this.clear();
    }

    const entry = await firstValueFrom(this.api.startTimer(jobId));
    if (isQueued(entry)) return { entryId: null, queuedIds: [...queuedIds, entry.entryId], previous };

    this.loads++;
    this._active.set({
      timeEntryId: entry.id,
      jobId,
      jobNumber: entry.jobNumber ?? jobLabel,
      operationId: null,
      timerStart: entry.timerStart ?? new Date(),
    });
    return { entryId: entry.id, queuedIds, previous };
  }

  private async confirmSwitch(current: string, next: string): Promise<boolean> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: next,
        message: this.translate.instant('mobileApp.timer.switchConfirm', { current, next }),
        confirmLabel: this.translate.instant('mobileApp.scan.actions.start'),
      } satisfies ConfirmDialogData,
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }
}
