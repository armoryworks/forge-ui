import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { firstValueFrom, map } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DatePipe } from '@angular/common';

import { JobStatus, isQueued } from '../../../shared/models/mobile-api.model';
import { InstanceService } from '../../../shared/services/instance.service';
import { MobileApiService } from '../../../shared/services/mobile-api.service';
import { MobileTimerService } from '../../../shared/services/mobile-timer.service';
import { OfflineQueueService } from '../../../shared/services/offline-queue.service';
import { PlatformService } from '../../../shared/services/platform.service';
import { SharedIdentityService } from '../../../shared/services/shared-identity.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { UndoService } from '../../../shared/services/undo.service';
import { IdentityPromptComponent } from '../identity/identity-prompt.component';

type PendingAction = 'advance' | 'note' | 'photo' | 'timer';

/**
 * Job Status: reached from Scan or Lookup. Job number, customer, current
 * column, due date, next step, last three timeline entries. Advancing asks
 * nothing and shows an undo toast; notes come from voice or a preset
 * picker; photos from the camera; the timer button reads Stop while the
 * person's timer runs on this job. Never a keyboard.
 */
@Component({
  selector: 'app-app-job-status',
  standalone: true,
  imports: [DatePipe, TranslatePipe, IdentityPromptComponent],
  templateUrl: './app-job-status.component.html',
  styleUrl: './app-job-status.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppJobStatusComponent {
  private readonly api = inject(MobileApiService);
  private readonly timer = inject(MobileTimerService);
  private readonly undo = inject(UndoService);
  private readonly queue = inject(OfflineQueueService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly platform = inject(PlatformService);
  private readonly identity = inject(SharedIdentityService);
  private readonly instances = inject(InstanceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly jobId = toSignal(
    this.route.paramMap.pipe(map((p) => Number(p.get('id')))), { initialValue: 0 });

  protected readonly job = signal<JobStatus | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly busy = signal(false);
  protected readonly notePicker = signal(false);
  protected readonly notePresets = signal<string[]>([]);
  protected readonly listening = signal(false);
  protected readonly identifying = signal(false);
  protected readonly timerRunningHere = computed(() => this.timer.runningOn(this.job()?.id));

  protected readonly voiceSupported = computed(() =>
    typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window));

  private pending: PendingAction | null = null;
  private pendingNote: string | null = null;

  constructor() {
    this.load();
    this.api.notePresets().subscribe({
      next: (presets) => this.notePresets.set(presets),
      error: () => this.notePresets.set([]),
    });
  }

  protected load(): void {
    const id = this.jobId();
    if (!id) return;
    this.loading.set(true);
    this.failed.set(false);
    this.api.jobStatus(id).subscribe({
      next: (job) => { this.job.set(job); this.loading.set(false); },
      error: () => { this.failed.set(true); this.loading.set(false); },
    });
  }

  protected back(): void {
    void this.router.navigate(['/app/scan']);
  }

  protected advance(): void {
    void this.guarded('advance');
  }

  protected openNotePicker(): void {
    this.notePicker.set(true);
  }

  protected pickNote(text: string): void {
    this.notePicker.set(false);
    this.pendingNote = text;
    void this.guarded('note');
  }

  protected dictateNote(): void {
    const Recognition = (window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    });
    const ctor = Recognition.SpeechRecognition ?? Recognition.webkitSpeechRecognition;
    if (!ctor) return;
    const recognition = new ctor();
    recognition.lang = document.documentElement.lang || 'en-US';
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      this.listening.set(false);
      if (transcript) {
        this.pendingNote = transcript;
        void this.guarded('note');
      }
    };
    recognition.onerror = () => this.listening.set(false);
    recognition.onend = () => this.listening.set(false);
    this.listening.set(true);
    recognition.start();
  }

  protected attachPhoto(): void {
    void this.guarded('photo');
  }

  protected toggleTimer(): void {
    void this.guarded('timer');
  }

  protected onIdentified(): void {
    this.identifying.set(false);
    const action = this.pending;
    this.pending = null;
    if (action) void this.perform(action);
  }

  protected onIdentityCancelled(): void {
    this.identifying.set(false);
    this.pending = null;
  }

  private async guarded(action: PendingAction): Promise<void> {
    if (this.instances.instance()?.shared && !this.identity.identified()) {
      this.pending = action;
      this.identifying.set(true);
      return;
    }
    await this.perform(action);
  }

  private async perform(action: PendingAction): Promise<void> {
    const job = this.job();
    if (!job || this.busy()) return;
    this.busy.set(true);
    try {
      switch (action) {
        case 'advance': await this.doAdvance(job); break;
        case 'note': await this.doNote(job); break;
        case 'photo': await this.doPhoto(job); break;
        case 'timer': await this.doTimer(job); break;
      }
    } catch {
      this.snackbar.error(this.translate.instant('mobileApp.jobs.actionFailed'));
    } finally {
      this.busy.set(false);
      this.identity.touch();
    }
  }

  private async doAdvance(job: JobStatus): Promise<void> {
    if (job.nextStageId === null) return;
    const outcome = await firstValueFrom(this.api.advanceJob(job.id, null));
    if (isQueued(outcome)) {
      this.offerQueuedUndo(outcome.entryId);
      return;
    }
    this.job.set(outcome.status);
    if (outcome.collapsed) return;
    this.undo.offer(
      this.translate.instant('mobileApp.jobs.movedTo', { column: outcome.status.stageName }),
      async () => {
        await firstValueFrom(this.api.moveJobToStage(job.id, outcome.previousStageId));
        this.load();
      },
    );
  }

  private async doNote(job: JobStatus): Promise<void> {
    const text = this.pendingNote;
    this.pendingNote = null;
    if (!text) return;
    const note = await firstValueFrom(this.api.addNote(job.id, text));
    if (isQueued(note)) {
      this.offerQueuedUndo(note.entryId);
      return;
    }
    this.load();
    this.undo.offer(
      this.translate.instant('mobileApp.jobs.noteAdded'),
      async () => {
        await firstValueFrom(this.api.deleteNote(job.id, note.id));
        this.load();
      },
    );
  }

  private async doTimer(job: JobStatus): Promise<void> {
    const outcome = this.timer.runningOn(job.id)
      ? { stopped: await this.timer.stop() }
      : await this.timer.toggle(job.id, job.jobNumber);
    if (!outcome) return;
    if ('stopped' in outcome) {
      this.snackbar.success(this.timer.stoppedMessage(outcome.stopped));
      return;
    }
    const { entryId, queuedIds, previousJobId } = outcome.started;
    if (entryId === null) {
      this.offerQueuedUndo(...queuedIds);
      return;
    }
    this.undo.offer(
      this.translate.instant('mobileApp.jobs.timerStarted'),
      () => this.timer.undoStart(entryId, previousJobId),
    );
  }

  private offerQueuedUndo(...entryIds: string[]): void {
    this.undo.offer(
      this.translate.instant('mobileApp.offline.queued'),
      () => Promise.all(entryIds.map((id) => this.queue.remove(id))),
    );
  }

  private async doPhoto(job: JobStatus): Promise<void> {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
      quality: 70,
      width: 1600,
    });
    if (!photo.base64String) return;
    const bytes = Uint8Array.from(atob(photo.base64String), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: `image/${photo.format || 'jpeg'}` });
    const file = await firstValueFrom(this.api.attachPhoto(job.id, blob, `job-${job.jobNumber}-${Date.now()}.${photo.format || 'jpeg'}`));
    this.load();
    this.undo.offer(
      this.translate.instant('mobileApp.jobs.photoAttached'),
      async () => {
        await firstValueFrom(this.api.deleteFile(file.id));
        this.load();
      },
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
