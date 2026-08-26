import {
  AfterViewInit, ChangeDetectionStrategy, Component, OnDestroy, inject, signal,
} from '@angular/core';
import { Router } from '@angular/router';

import { firstValueFrom } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ScanResolveResult, isQueued } from '../../../shared/models/mobile-api.model';
import { CameraScannerService } from '../../../shared/services/camera-scanner.service';
import { InstanceService } from '../../../shared/services/instance.service';
import { MobileApiService } from '../../../shared/services/mobile-api.service';
import { OfflineQueueService } from '../../../shared/services/offline-queue.service';
import { ScanFeedbackService } from '../../../shared/services/scan-feedback.service';
import { SharedIdentityService } from '../../../shared/services/shared-identity.service';
import { UndoService } from '../../../shared/services/undo.service';
import { hintScanKind } from '../../../shared/utils/scan-code';
import { IdentityPromptComponent } from '../identity/identity-prompt.component';
import { ScanAction, ScanActionSheetComponent } from '../components/scan-action-sheet/scan-action-sheet.component';

/**
 * Scan is home: the viewfinder opens immediately. A decode ticks, resolves
 * on the server, and offers one contextual action sheet — never a detail
 * page by itself. Unknown codes double-buzz. Torch bottom-left.
 */
@Component({
  selector: 'app-app-scan',
  standalone: true,
  imports: [TranslatePipe, ScanActionSheetComponent, IdentityPromptComponent],
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
  protected readonly instances = inject(InstanceService);

  protected readonly result = signal<ScanResolveResult | null>(null);
  protected readonly resolving = signal(false);
  protected readonly busy = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly torchOn = signal(false);
  protected readonly cameraError = signal(false);
  protected readonly identifying = signal(false);

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

  private async perform(action: ScanAction, result: ScanResolveResult): Promise<void> {
    this.busy.set(true);
    try {
      switch (action) {
        case 'details':
          if (result.kind === 'job' && result.id) await this.router.navigate(['/app/jobs', result.id]);
          else this.notice.set(this.translate.instant('mobileApp.scan.openOnDesktopHint'));
          break;
        case 'move':
          if (result.id) await this.advance(result.id, result.code);
          break;
        case 'start':
          if (result.id) await this.startTimer(result.id);
          break;
        case 'complete':
          if (result.id) await this.complete(result.id, result.code);
          break;
        case 'moveStock':
          await this.router.navigate(['/app/move'], { queryParams: { code: result.code } });
          break;
        case 'identify':
          this.identifying.set(true);
          break;
      }
    } finally {
      this.busy.set(false);
      if (action !== 'identify') this.identity.touch();
    }
  }

  private async advance(jobId: number, code: string): Promise<void> {
    const outcome = await firstValueFrom(this.api.advanceJob(jobId, code));
    if (!outcome) return;
    if (isQueued(outcome)) {
      this.offerQueuedUndo(outcome.entryId);
      this.result.set(null);
      await this.startScanner();
      return;
    }
    if (outcome.collapsed) {
      this.notice.set(this.translate.instant('mobileApp.scan.collapsed'));
      return;
    }
    this.undo.offer(
      this.translate.instant('mobileApp.jobs.movedTo', { column: outcome.status.stageName }),
      () => firstValueFrom(this.api.moveJobToStage(jobId, outcome.previousStageId)),
    );
    this.result.set(null);
    await this.startScanner();
  }

  private async startTimer(jobId: number): Promise<void> {
    const entry = await firstValueFrom(this.api.startTimer(jobId));
    if (!entry) return;
    if (isQueued(entry)) {
      this.offerQueuedUndo(entry.entryId);
      this.result.set(null);
      await this.startScanner();
      return;
    }
    this.undo.offer(
      this.translate.instant('mobileApp.jobs.timerStarted'),
      () => firstValueFrom(this.api.stopTimer()),
    );
    this.result.set(null);
    await this.startScanner();
  }

  private async complete(jobId: number, code: string): Promise<void> {
    await firstValueFrom(this.api.stopTimer()).catch(() => undefined);
    await this.advance(jobId, code);
  }

  private offerQueuedUndo(entryId: string): void {
    this.undo.offer(this.translate.instant('mobileApp.offline.queued'), () => this.queue.remove(entryId));
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
