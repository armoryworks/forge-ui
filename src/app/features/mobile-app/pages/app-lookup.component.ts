import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { debounceTime, distinctUntilChanged, firstValueFrom, switchMap, of, catchError } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { InputComponent } from '../../../shared/components/input/input.component';
import { JobAdvanceResult, QueuedOffline, ScanResolveResult, isQueued } from '../../../shared/models/mobile-api.model';
import { MobileApiService } from '../../../shared/services/mobile-api.service';
import { MobileMoveConfirmService } from '../../../shared/services/mobile-move-confirm.service';
import { MobileTimerService } from '../../../shared/services/mobile-timer.service';
import { OfflineQueueService } from '../../../shared/services/offline-queue.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { UndoService } from '../../../shared/services/undo.service';
import { ScanAction, ScanActionSheetComponent } from '../components/scan-action-sheet/scan-action-sheet.component';

/**
 * Lookup: the one text field in the app (besides server address). Searches
 * jobs, parts, customers, bins; voice input; big result rows that open the
 * same action sheet a scan would. A move or complete asks first, and offers
 * no undo, when the server answers that the column can't be undone or
 * creates an accounting document; Complete then stops the timer unless the
 * person declines.
 */
@Component({
  selector: 'app-app-lookup',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, InputComponent, ScanActionSheetComponent],
  templateUrl: './app-lookup.component.html',
  styleUrl: './app-lookup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppLookupComponent {
  private readonly api = inject(MobileApiService);
  private readonly timer = inject(MobileTimerService);
  private readonly confirmMove = inject(MobileMoveConfirmService);
  private readonly undo = inject(UndoService);
  private readonly queue = inject(OfflineQueueService);
  private readonly snackbar = inject(SnackbarService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly results = signal<ScanResolveResult[]>([]);
  protected readonly searching = signal(false);
  protected readonly selected = signal<ScanResolveResult | null>(null);
  protected readonly busy = signal(false);
  protected readonly listening = signal(false);
  protected readonly runningJobId = computed(() => this.timer.active()?.jobId ?? null);

  protected readonly voiceSupported = computed(() =>
    typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window));

  constructor() {
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((term) => {
        if (term.trim().length < 2) return of([] as ScanResolveResult[]);
        this.searching.set(true);
        return this.api.lookup(term.trim()).pipe(catchError(() => of([] as ScanResolveResult[])));
      }),
      takeUntilDestroyed(),
    ).subscribe((results) => {
      this.results.set(results);
      this.searching.set(false);
    });
  }

  protected iconFor(kind: string): string {
    switch (kind) {
      case 'job': return 'work';
      case 'part': return 'inventory_2';
      case 'customer': return 'business';
      case 'bin': return 'shelves';
      case 'lot': return 'qr_code';
      default: return 'search';
    }
  }

  protected select(result: ScanResolveResult): void {
    this.selected.set(result);
  }

  protected dismiss(): void {
    this.selected.set(null);
  }

  protected dictate(): void {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!ctor) return;
    const recognition = new ctor();
    recognition.lang = document.documentElement.lang || 'en-US';
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      this.listening.set(false);
      if (transcript) this.searchControl.setValue(transcript);
    };
    recognition.onerror = () => this.listening.set(false);
    recognition.onend = () => this.listening.set(false);
    this.listening.set(true);
    recognition.start();
  }

  protected async onAction(action: ScanAction): Promise<void> {
    const result = this.selected();
    if (!result?.id) return;
    this.busy.set(true);
    try {
      switch (action) {
        case 'details':
          if (result.kind === 'job') await this.router.navigate(['/app/jobs', result.id]);
          break;
        case 'move': {
          const sent = await this.sendAdvance(result.id);
          if (sent) this.afterAdvance(result.id, sent);
          break;
        }
        case 'start': {
          const outcome = await this.timer.toggle(result.id, result.label);
          if (!outcome) break;
          if ('alreadyRunning' in outcome) {
            this.snackbar.info(this.timer.runningMessage(outcome.alreadyRunning));
          } else {
            const { entryId, queuedIds, previous } = outcome.started;
            if (entryId === null) {
              this.offerQueuedUndo(...queuedIds);
            } else {
              this.undo.offer(
                this.translate.instant('mobileApp.jobs.timerStarted'),
                () => this.timer.undoStart(entryId, previous),
              );
            }
          }
          this.selected.set(null);
          break;
        }
        case 'stop': {
          const stop = await this.timer.stop();
          this.undo.offer(this.timer.stoppedMessage(stop.stopped), () => this.timer.undoStop(stop));
          this.selected.set(null);
          break;
        }
        case 'complete': {
          let sent: { outcome: JobAdvanceResult | QueuedOffline; confirmed: boolean } | null;
          try {
            sent = await this.sendAdvance(result.id);
          } catch (err) {
            await this.stopForComplete();
            throw err;
          }
          if (!sent) break;
          await this.stopForComplete();
          this.afterAdvance(result.id, sent);
          break;
        }
        case 'moveStock':
          await this.router.navigate(['/app/move'], { queryParams: { code: result.code } });
          break;
        default:
          this.selected.set(null);
      }
    } catch (err) {
      this.snackbar.error(this.confirmMove.failureMessage(err));
    } finally {
      this.busy.set(false);
    }
  }

  private async sendAdvance(jobId: number): Promise<{ outcome: JobAdvanceResult | QueuedOffline; confirmed: boolean } | null> {
    try {
      const outcome = await firstValueFrom(this.api.advanceJob(jobId, null, null, true));
      return { outcome, confirmed: false };
    } catch (err) {
      if (!this.confirmMove.isConfirmRequired(err)) throw err;
      const status = await firstValueFrom(this.api.jobStatus(jobId));
      if (!this.confirmMove.needed(status)) throw err;
      if (!(await this.confirmMove.ask(status))) return null;
      const outcome = await firstValueFrom(this.api.advanceJob(jobId, null, status.nextStageId, true));
      return { outcome, confirmed: true };
    }
  }

  private afterAdvance(jobId: number, sent: { outcome: JobAdvanceResult | QueuedOffline; confirmed: boolean }): void {
    const { outcome, confirmed } = sent;
    this.selected.set(null);
    if (isQueued(outcome)) {
      if (confirmed) this.snackbar.info(this.translate.instant('mobileApp.offline.queued'));
      else this.offerQueuedUndo(outcome.entryId);
      return;
    }
    if (outcome.collapsed) return;
    const message = this.translate.instant('mobileApp.jobs.movedTo', { column: outcome.status.stageName });
    if (confirmed) {
      this.snackbar.success(message);
      return;
    }
    this.undo.offer(message, () => firstValueFrom(this.api.moveJobToStage(jobId, outcome.previousStageId)));
  }

  private async stopForComplete(): Promise<void> {
    await firstValueFrom(this.api.stopTimer()).catch(() => undefined);
    void this.timer.refresh();
  }

  private offerQueuedUndo(...entryIds: string[]): void {
    this.undo.offer(
      this.translate.instant('mobileApp.offline.queued'),
      () => Promise.all(entryIds.map((id) => this.queue.remove(id))),
    );
  }
}

interface SpeechRecognitionLike {
  lang: string;
  onresult: ((event: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
}
