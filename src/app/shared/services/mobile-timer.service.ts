import { Injectable, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

import { firstValueFrom } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { ConfirmDialogComponent, ConfirmDialogData } from '../components/confirm-dialog/confirm-dialog.component';
import { ActiveTimer, TimerStartOutcome, isQueued } from '../models/mobile-api.model';
import { AuthService } from './auth.service';
import { MobileApiService } from './mobile-api.service';

/**
 * The signed-in person's running timer in the native shell, shared by the
 * strip above the tab bar, the scan action sheet, Lookup and Job Status.
 * Starting on another job stops the running timer first, once the person
 * agrees to switch. Undoing a start deletes the entry rather than stopping
 * it, so no zero-minute row is left behind.
 */
@Injectable({ providedIn: 'root' })
export class MobileTimerService {
  private readonly api = inject(MobileApiService);
  private readonly auth = inject(AuthService);
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

  async stop(): Promise<ActiveTimer | null> {
    const stopped = this._active();
    await firstValueFrom(this.api.stopTimer());
    this.clear();
    return stopped;
  }

  /** Null when the person declined to switch away from a timer on another job. */
  async start(jobId: number, jobLabel: string): Promise<TimerStartOutcome | null> {
    const running = this._active();
    const switching = running !== null && running.jobId !== jobId;
    if (switching && !(await this.confirmSwitch(running.jobNumber ?? '', jobLabel))) return null;

    const queuedIds: string[] = [];
    if (switching) {
      const stopped = await firstValueFrom(this.api.stopTimer());
      if (isQueued(stopped)) queuedIds.push(stopped.entryId);
      this.clear();
    }

    const entry = await firstValueFrom(this.api.startTimer(jobId));
    if (isQueued(entry)) return { entryId: null, queuedIds: [...queuedIds, entry.entryId] };

    this.loads++;
    this._active.set({
      timeEntryId: entry.id,
      jobId,
      jobNumber: entry.jobNumber ?? jobLabel,
      operationId: null,
      timerStart: entry.timerStart ?? new Date(),
    });
    return { entryId: entry.id, queuedIds };
  }

  /** Compensation for start: delete the entry, or stop it when the delete is refused. */
  async undoStart(entryId: number, token?: string): Promise<void> {
    try {
      await firstValueFrom(this.api.deleteTimeEntry(entryId, token));
    } catch {
      await firstValueFrom(this.api.stopTimer(token));
    }
    if (this._active()?.timeEntryId === entryId) this.clear();
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
