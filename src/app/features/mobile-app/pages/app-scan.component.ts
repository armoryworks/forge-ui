import {
  AfterViewInit, ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal,
} from '@angular/core';
import { Router } from '@angular/router';

import { firstValueFrom } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { JobAdvanceResult, QueuedOffline, ScanResolveResult, isQueued } from '../../../shared/models/mobile-api.model';
import { AuthService } from '../../../shared/services/auth.service';
import { CameraScannerService } from '../../../shared/services/camera-scanner.service';
import { InstanceService } from '../../../shared/services/instance.service';
import { MobileApiService } from '../../../shared/services/mobile-api.service';
import { MobileMoveConfirmService } from '../../../shared/services/mobile-move-confirm.service';
import { MobileTimerService } from '../../../shared/services/mobile-timer.service';
import { OfflineQueueService } from '../../../shared/services/offline-queue.service';
import { ScanFeedbackService } from '../../../shared/services/scan-feedback.service';
import { SharedIdentityService } from '../../../shared/services/shared-identity.service';
import { UndoService } from '../../../shared/services/undo.service';
import { hintScanKind } from '../../../shared/utils/scan-code';
import { IdentityPromptComponent } from '../identity/identity-prompt.component';
import { JobOperationsComponent } from '../components/job-operations/job-operations.component';
import { ManualCodeEntryComponent } from '../components/manual-code-entry/manual-code-entry.component';
import { ScanAction, ScanActionSheetComponent } from '../components/scan-action-sheet/scan-action-sheet.component';

/**
 * Scan is home: the viewfinder opens immediately. A decode ticks, resolves
 * on the server, and offers one contextual action sheet — never a detail
 * page by itself. Unknown codes double-buzz. Torch bottom-left. On a shared
 * device a start, stop, move or complete ends the person's identity once its
 * undo toast closes; the undo itself runs with the token captured beforehand.
 * With operation tracking on, a job's open operations sit under the sheet,
 * and Complete stops the person's timer on that job rather than whichever
 * one is newest. A move or complete is sent as it always was; when the
 * server answers that the column can't be undone or creates an accounting
 * document, the person is asked, the move is resent confirmed, offers no
 * undo, even when it was saved offline, and ends the identity at once. Any
 * other refusal of the first send shows the server's reason here. Complete
 * stops the timer unless the person declines.
 */
@Component({
  selector: 'app-app-scan',
  standalone: true,
  imports: [TranslatePipe, ScanActionSheetComponent, IdentityPromptComponent, ManualCodeEntryComponent, JobOperationsComponent],
  templateUrl: './app-scan.component.html',
  styleUrl: './app-scan.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppScanComponent implements AfterViewInit, OnDestroy {
  private readonly scanner = inject(CameraScannerService);
  private readonly api = inject(MobileApiService);
  private readonly feedback = inject(ScanFeedbackService);
  private readonly undo = inject(UndoService);
  private readonly queue = inject(OfflineQueueService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly identity = inject(SharedIdentityService);
  private readonly auth = inject(AuthService);
  private readonly timer = inject(MobileTimerService);
  private readonly confirmMove = inject(MobileMoveConfirmService);
  protected readonly instances = inject(InstanceService);

  protected readonly result = signal<ScanResolveResult | null>(null);
  protected readonly resolving = signal(false);
  protected readonly busy = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly torchOn = signal(false);
  protected readonly cameraError = signal(false);
  protected readonly identifying = signal(false);
  protected readonly typing = signal(false);

  protected readonly runningJobId = computed(() => this.timer.active()?.jobId ?? null);
  protected readonly operationTracking = computed(() => this.timer.operationTracking());
  protected readonly actingAs = computed(() => {
    if (!this.instances.instance()?.shared || !this.identity.identified()) return null;
    const person = this.identity.person();
    return person ? `${person.firstName} ${person.lastName}`.trim() : null;
  });

  private pendingAction: ScanAction | null = null;

  async ngAfterViewInit(): Promise<void> {
    await this.startScanner();
  }

  async ngOnDestroy(): Promise<void> {
    await this.scanner.stop();
  }

  protected async toggleTorch(): Promise<void> {
    this.torchOn.set(await this.scanner.toggleTorch());
  }

  protected openManual(): void {
    this.typing.set(true);
  }

  protected closeManual(): void {
    this.typing.set(false);
  }

  protected async submitManual(code: string): Promise<void> {
    this.typing.set(false);
    await this.onDecode(code);
  }

  protected dismiss(): void {
    this.result.set(null);
    void this.startScanner();
  }

  protected async onAction(action: ScanAction): Promise<void> {
    const result = this.result();
    if (!result) return;

    if (this.instances.instance()?.shared && !this.identity.identified() && action !== 'identify') {
      this.pendingAction = action;
      this.identifying.set(true);
      return;
    }

    await this.perform(action, result);
  }

  protected onIdentified(): void {
    this.identifying.set(false);
    const action = this.pendingAction;
    this.pendingAction = null;
    const result = this.result();
    if (action && result) void this.perform(action, result);
  }

  protected onIdentityCancelled(): void {
    this.identifying.set(false);
    this.pendingAction = null;
  }

  protected notYou(): void {
    this.identity.clear();
  }

  private async perform(action: ScanAction, result: ScanResolveResult): Promise<void> {
    this.busy.set(true);
    const token = this.sharedToken();
    let ended = false;
    try {
      switch (action) {
        case 'details':
          if (result.kind === 'job' && result.id) await this.router.navigate(['/app/jobs', result.id]);
          else this.notice.set(this.translate.instant('mobileApp.scan.openOnDesktopHint'));
          break;
        case 'move':
          if (result.id) ended = await this.advance(result.id, result.code, token);
          break;
        case 'start':
          if (result.id) ended = await this.startTimer(result.id, result.label, token);
          break;
        case 'stop':
          ended = await this.stopTimer(token);
          break;
        case 'complete':
          if (result.id) ended = await this.complete(result.id, result.code, token);
          break;
        case 'moveStock':
          await this.router.navigate(['/app/move'], { queryParams: { code: result.code } });
          break;
        case 'receive':
          if (result.kind === 'purchaseOrder' && result.id) await this.router.navigate(['/app/receive', result.id]);
          break;
        case 'identify':
          this.identifying.set(true);
          break;
      }
    } catch (err) {
      this.notice.set(this.confirmMove.failureMessage(err));
    } finally {
      this.busy.set(false);
      if (action !== 'identify' && !ended) this.identity.touch();
    }
  }

  private sharedToken(): string | undefined {
    if (!this.instances.instance()?.shared || !this.identity.identified()) return undefined;
    return this.auth.token() ?? undefined;
  }

  private endIdentity(token: string | undefined): (() => void) | undefined {
    return token ? () => this.identity.clear() : undefined;
  }

  private async advance(jobId: number, code: string, token: string | undefined): Promise<boolean> {
    const sent = await this.sendAdvance(jobId, code);
    return sent ? this.afterAdvance(jobId, sent, token) : false;
  }

  private async sendAdvance(jobId: number, code: string): Promise<{ outcome: JobAdvanceResult | QueuedOffline; confirmed: boolean } | null> {
    try {
      const outcome = await firstValueFrom(this.api.advanceJob(jobId, code, null, true));
      return outcome ? { outcome, confirmed: false } : null;
    } catch (err) {
      if (!this.confirmMove.isConfirmRequired(err)) throw err;
      const status = await firstValueFrom(this.api.jobStatus(jobId));
      if (!this.confirmMove.needed(status)) throw err;
      if (!(await this.confirmMove.ask(status))) return null;
      const outcome = await firstValueFrom(this.api.advanceJob(jobId, code, status.nextStageId, true));
      return outcome ? { outcome, confirmed: true } : null;
    }
  }

  private async afterAdvance(jobId: number, sent: { outcome: JobAdvanceResult | QueuedOffline; confirmed: boolean }, token: string | undefined): Promise<boolean> {
    const { outcome, confirmed } = sent;
    if (isQueued(outcome)) {
      if (!confirmed) this.offerQueuedUndo([outcome.entryId], token);
      this.result.set(null);
      await this.startScanner();
      if (confirmed) {
        this.notice.set(this.translate.instant('mobileApp.offline.queued'));
        if (token) this.identity.clear();
      }
      return !!token;
    }
    if (outcome.collapsed) {
      this.notice.set(this.translate.instant('mobileApp.scan.collapsed'));
      return false;
    }
    if (confirmed) {
      this.result.set(null);
      await this.startScanner();
      this.notice.set(this.translate.instant('mobileApp.jobs.movedTo', { column: outcome.status.stageName }));
      if (token) this.identity.clear();
      return !!token;
    }
    this.undo.offer(
      this.translate.instant('mobileApp.jobs.movedTo', { column: outcome.status.stageName }),
      () => firstValueFrom(this.api.moveJobToStage(jobId, outcome.previousStageId, token)),
      this.endIdentity(token),
    );
    this.result.set(null);
    await this.startScanner();
    return !!token;
  }

  private async startTimer(jobId: number, label: string, token: string | undefined): Promise<boolean> {
    const outcome = await this.timer.toggle(jobId, label);
    if (!outcome) return false;
    if ('alreadyRunning' in outcome) {
      this.result.set(null);
      await this.startScanner();
      this.notice.set(this.timer.runningMessage(outcome.alreadyRunning));
      return false;
    }
    const { entryId, queuedIds, previous } = outcome.started;
    if (entryId === null) {
      this.offerQueuedUndo(queuedIds, token);
    } else {
      this.undo.offer(
        this.translate.instant('mobileApp.jobs.timerStarted'),
        () => this.timer.undoStart(entryId, previous, token),
        this.endIdentity(token),
      );
    }
    this.result.set(null);
    await this.startScanner();
    return !!token;
  }

  private async stopTimer(token: string | undefined): Promise<boolean> {
    const outcome = await this.timer.stop();
    this.undo.offer(
      this.timer.stoppedMessage(outcome.stopped),
      () => this.timer.undoStop(outcome, token),
      this.endIdentity(token),
    );
    this.result.set(null);
    await this.startScanner();
    return !!token;
  }

  private async complete(jobId: number, code: string, token: string | undefined): Promise<boolean> {
    let sent: { outcome: JobAdvanceResult | QueuedOffline; confirmed: boolean } | null;
    try {
      sent = await this.sendAdvance(jobId, code);
    } catch (err) {
      await this.stopForComplete(jobId);
      throw err;
    }
    if (!sent) return false;
    await this.stopForComplete(jobId);
    return this.afterAdvance(jobId, sent, token);
  }

  private async stopForComplete(jobId: number): Promise<void> {
    const stop = this.timer.operationTracking() ? this.api.stopTimer(undefined, { jobId }) : this.api.stopTimer();
    await firstValueFrom(stop).catch(() => undefined);
    void this.timer.refresh();
  }

  private offerQueuedUndo(entryIds: string[], token?: string): void {
    this.undo.offer(
      this.translate.instant('mobileApp.offline.queued'),
      () => Promise.all(entryIds.map((id) => this.queue.remove(id))),
      this.endIdentity(token),
    );
  }

  private async startScanner(): Promise<void> {
    this.notice.set(null);
    this.cameraError.set(false);
    try {
      await this.scanner.start('app-scan-viewfinder', (value) => void this.onDecode(value));
    } catch {
      this.cameraError.set(true);
    }
  }

  private async onDecode(value: string): Promise<void> {
    if (this.resolving() || this.result()) return;

    if (hintScanKind(value) === 'enrollment') {
      await this.feedback.doubleBuzz();
      this.notice.set(this.translate.instant('mobileApp.scan.enrollmentCodeHere'));
      return;
    }

    await this.feedback.tick();
    this.resolving.set(true);
    try {
      const resolved = await firstValueFrom(this.api.resolveScan(value));
      if (!resolved || resolved.kind === 'unknown') {
        await this.feedback.doubleBuzz();
        this.notice.set(this.translate.instant('mobileApp.scan.unknownCode'));
        return;
      }
      await this.scanner.stop();
      this.result.set(resolved);
    } catch {
      await this.feedback.doubleBuzz();
      this.notice.set(this.translate.instant('mobileApp.scan.lookupFailed'));
    } finally {
      this.resolving.set(false);
    }
  }

}
