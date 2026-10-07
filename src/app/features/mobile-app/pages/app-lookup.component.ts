import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { debounceTime, distinctUntilChanged, firstValueFrom, switchMap, of, catchError } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { InputComponent } from '../../../shared/components/input/input.component';
import { ScanResolveResult, isQueued } from '../../../shared/models/mobile-api.model';
import { MobileApiService } from '../../../shared/services/mobile-api.service';
import { MobileTimerService } from '../../../shared/services/mobile-timer.service';
import { OfflineQueueService } from '../../../shared/services/offline-queue.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { UndoService } from '../../../shared/services/undo.service';
import { ScanAction, ScanActionSheetComponent } from '../components/scan-action-sheet/scan-action-sheet.component';

/**
 * Lookup: the one text field in the app (besides server address). Searches
 * jobs, parts, customers, bins; voice input; big result rows that open the
 * same action sheet a scan would.
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
          const outcome = await firstValueFrom(this.api.advanceJob(result.id, null));
          if (isQueued(outcome)) {
            this.offerQueuedUndo(outcome.entryId);
          } else if (!outcome.collapsed) {
            this.undo.offer(
              this.translate.instant('mobileApp.jobs.movedTo', { column: outcome.status.stageName }),
              () => firstValueFrom(this.api.moveJobToStage(result.id!, outcome.previousStageId)),
            );
          }
          this.selected.set(null);
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
        case 'complete':
          await firstValueFrom(this.api.stopTimer()).catch(() => undefined);
          void this.timer.refresh();
          await this.onAction('move');
          break;
        case 'moveStock':
          await this.router.navigate(['/app/move'], { queryParams: { code: result.code } });
          break;
        default:
          this.selected.set(null);
      }
    } catch {
      this.snackbar.error(this.translate.instant('mobileApp.jobs.actionFailed'));
    } finally {
      this.busy.set(false);
    }
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
