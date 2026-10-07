import {
  AfterViewInit, ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal,
} from '@angular/core';
import { Router } from '@angular/router';

import { firstValueFrom } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ActiveTimer, ScanResolveResult, isQueued } from '../../../shared/models/mobile-api.model';
import { AuthService } from '../../../shared/services/auth.service';
import { CameraScannerService } from '../../../shared/services/camera-scanner.service';
import { InstanceService } from '../../../shared/services/instance.service';
import { MobileApiService } from '../../../shared/services/mobile-api.service';
import { MobileTimerService } from '../../../shared/services/mobile-timer.service';
import { OfflineQueueService } from '../../../shared/services/offline-queue.service';
import { ScanFeedbackService } from '../../../shared/services/scan-feedback.service';
import { SharedIdentityService } from '../../../shared/services/shared-identity.service';
import { UndoService } from '../../../shared/services/undo.service';
import { hintScanKind } from '../../../shared/utils/scan-code';
import { IdentityPromptComponent } from '../identity/identity-prompt.component';
import { ManualCodeEntryComponent } from '../components/manual-code-entry/manual-code-entry.component';
import { ScanAction, ScanActionSheetComponent } from '../components/scan-action-sheet/scan-action-sheet.component';

/**
 * Scan is home: the viewfinder opens immediately. A decode ticks, resolves
 * on the server, and offers one contextual action sheet — never a detail
 * page by itself. Unknown codes double-buzz. Torch bottom-left. On a shared
 * device a start, move or complete ends the person's identity once its undo
 * toast closes; the undo itself runs with the token captured beforehand.
 */
@Component({
  selector: 'app-app-scan',
  standalone: true,
  imports: [TranslatePipe, ScanActionSheetComponent, IdentityPromptComponent, ManualCodeEntryComponent],
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
        case 'identify':
          this.identifying.set(true);
          break;
      }
    } catch {
      this.notice.set(this.translate.instant('mobileApp.jobs.actionFailed'));
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
    const outcome = await firstValueFrom(this.api.advanceJob(jobId, code));
    if (!outcome) return false;
    if (isQueued(outcome)) {
      this.offerQueuedUndo([outcome.entryId], token);
      this.result.set(null);
      await this.startScanner();
      return !!token;
    }
    if (outcome.collapsed) {
      this.notice.set(this.translate.instant('mobileApp.scan.collapsed'));
      return false;
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
    if ('stopped' in outcome) return this.showStopped(outcome.stopped, token);
    const { entryId, queuedIds, previousJobId } = outcome.started;
    if (entryId === null) {
      this.offerQueuedUndo(queuedIds, token);
    } else {
      this.undo.offer(
        this.translate.instant('mobileApp.jobs.timerStarted'),
        () => this.timer.undoStart(entryId, previousJobId, token),
        this.endIdentity(token),
      );
    }
    this.result.set(null);
    await this.startScanner();
    return !!token;
  }

  private async stopTimer(token: string | undefined): Promise<boolean> {
    return this.showStopped(await this.timer.stop(), token);
  }

  private async showStopped(stopped: ActiveTimer | null, token: string | undefined): Promise<boolean> {
    this.result.set(null);
    await this.startScanner();
    this.notice.set(this.timer.stoppedMessage(stopped));
    if (!token) return false;
    this.identity.clear();
    return true;
  }

  private async complete(jobId: number, code: string, token: string | undefined): Promise<boolean> {
    await firstValueFrom(this.api.stopTimer()).catch(() => undefined);
    void this.timer.refresh();
    return this.advance(jobId, code, token);
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
