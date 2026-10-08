import {
  ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, OnInit, output, signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { interval } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { ShopFloorService } from '../../services/shop-floor.service';
import { KanbanService } from '../../../kanban/services/kanban.service';
import { JobStatus } from '../../../../shared/models/mobile-api.model';
import { KioskOperationTilesComponent } from '../kiosk-operation-tiles/kiosk-operation-tiles.component';
import { KioskRunningTimersComponent } from '../kiosk-running-timers/kiosk-running-timers.component';
import { KioskOperationQuantityComponent } from '../kiosk-operation-quantity/kiosk-operation-quantity.component';
import { JobOperations } from '../../models/job-operations.model';
import { JobOperationRow } from '../../models/job-operation-row.model';
import { OperationTimerEntryType } from '../../models/operation-timer-entry-type.type';
import { RunningTimer } from '../../models/running-timer.model';
import { UpdateJobOperationProgressRequest } from '../../models/update-job-operation-progress-request.model';
import { KioskAndonType } from '../../models/kiosk-andon-type.type';

type JobStep = 'actions' | 'confirm-advance' | 'log-note' | 'problem' | 'quantity' | 'processing' | 'done';
type CompletedAction = 'timer-started' | 'timer-stopped' | 'stage-advanced' | 'note-logged' | 'problem-raised';

const PROBLEM_TYPES: readonly { type: KioskAndonType; icon: string; labelKey: string }[] = [
  { type: 'Stoppage', icon: 'pan_tool', labelKey: 'shopFloor.jobFlow.problem.stoppage' },
  { type: 'Quality', icon: 'rule', labelKey: 'shopFloor.jobFlow.problem.quality' },
  { type: 'Material', icon: 'inventory_2', labelKey: 'shopFloor.jobFlow.problem.material' },
];

@Component({
  selector: 'app-scan-job-flow',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, TextareaComponent,
    KioskOperationTilesComponent, KioskRunningTimersComponent, KioskOperationQuantityComponent,
  ],
  templateUrl: './scan-job-flow.component.html',
  styleUrl: './scan-job-flow.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScanJobFlowComponent implements OnInit {
  private readonly shopFloorService = inject(ShopFloorService);
  private readonly kanbanService = inject(KanbanService);
  private readonly translate = inject(TranslateService);
  private readonly auth = inject(AuthService);
  private readonly capabilities = inject(CapabilityService);
  private readonly destroyRef = inject(DestroyRef);

  // Inputs
  readonly jobId = input.required<number>();
  readonly jobNumber = input.required<string>();
  readonly jobTitle = input.required<string>();
  readonly currentStage = input.required<string>();
  readonly assigneeName = input<string | null>(null);
  readonly hasActiveTimer = input<boolean>(false);

  // Outputs
  readonly completed = output<void>();
  readonly cancelled = output<void>();

  // State
  protected readonly step = signal<JobStep>('actions');
  protected readonly processing = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly completedAction = signal<CompletedAction | null>(null);
  protected readonly noteControl = new FormControl('');
  protected readonly jobStatus = signal<JobStatus | null>(null);
  protected readonly statusLoading = signal(true);
  protected readonly advancedTo = signal<string | null>(null);
  protected readonly hasShopFloorNextStage = computed(() => {
    const status = this.jobStatus();
    return status?.nextStageId != null && status.nextStageIsShopFloor === true;
  });
  protected readonly canAdvance = computed(() => !this.statusLoading() && this.hasShopFloorNextStage());
  protected readonly andonEnabled = computed(() => this.capabilities.isEnabled('CAP-EXT-ANDON'));
  protected readonly problemTypes = PROBLEM_TYPES;
  protected readonly problemType = signal<KioskAndonType | null>(null);
  protected readonly problemNoteControl = new FormControl('');
  protected readonly problemRaisedAt = signal<string | null>(null);

  protected readonly tracking = signal(false);
  protected readonly jobOperations = signal<JobOperations | null>(null);
  protected readonly runningTimers = signal<RunningTimer[]>([]);
  protected readonly operationBusy = signal(false);
  protected readonly operationNotice = signal<string | null>(null);
  protected readonly quantityTarget = signal<{ row: JobOperationRow; prefillAll: boolean } | null>(null);
  protected readonly now = signal(Date.now());
  protected readonly currentUserId = computed(() => this.auth.user()?.id ?? null);
  protected readonly jobTimerRunning = computed(() => this.tracking()
    ? this.runningTimers().some(timer => timer.jobId === this.jobId())
    : this.hasActiveTimer());
  private serverOffsetMs = 0;
  private ticking = false;

  ngOnInit(): void {
    this.loadStatus();
    this.loadTrackingConfig();
  }

  private loadTrackingConfig(): void {
    this.shopFloorService.getConfig().subscribe(config => {
      if (!config.operationTracking) return;
      this.tracking.set(true);
      this.loadOperations();
      this.loadRunningTimers();
      this.startTicking();
    });
  }

  private startTicking(): void {
    if (this.ticking) return;
    this.ticking = true;
    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.now.set(Date.now() + this.serverOffsetMs));
  }

  private loadOperations(): void {
    this.shopFloorService.getOperations(this.jobId()).subscribe({
      next: (result) => {
        const serverNow = Date.parse(result.serverNow);
        if (Number.isFinite(serverNow)) this.serverOffsetMs = serverNow - Date.now();
        this.now.set(Date.now() + this.serverOffsetMs);
        this.jobOperations.set(result);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(this.translate.instant('shopFloor.operations.loadFailed', { reason: this.serverReason(err) }));
      },
    });
  }

  private loadRunningTimers(): void {
    this.shopFloorService.getActiveTimers().subscribe({
      next: (timers) => this.runningTimers.set(timers),
      error: (err: HttpErrorResponse) => {
        this.error.set(this.translate.instant('shopFloor.operations.loadFailed', { reason: this.serverReason(err) }));
      },
    });
  }

  private replaceOperation(row: JobOperationRow, allOperationsComplete?: boolean, remaining?: number | null): void {
    this.jobOperations.update(current => current && {
      ...current,
      allOperationsComplete: allOperationsComplete ?? current.allOperationsComplete,
      estimatedRemainingMinutes: remaining === undefined ? current.estimatedRemainingMinutes : remaining,
      operations: current.operations.map(op => op.operationId === row.operationId ? row : op),
    });
  }

  private beginOperationCall(): boolean {
    if (this.operationBusy()) return false;
    this.operationBusy.set(true);
    this.error.set(null);
    this.operationNotice.set(null);
    return true;
  }

  private operationFailed(err: HttpErrorResponse): void {
    this.operationBusy.set(false);
    this.error.set(this.translate.instant('shopFloor.operations.actionFailed', { reason: this.serverReason(err) }));
    this.loadOperations();
    this.loadRunningTimers();
  }

  protected startOperation(row: JobOperationRow, entryType: OperationTimerEntryType = 'Run'): void {
    if (row.operationId == null || !this.beginOperationCall()) return;
    this.shopFloorService.startOperationTimer(this.jobId(), row.operationId, entryType).subscribe({
      next: (result) => {
        this.operationBusy.set(false);
        this.replaceOperation(result.operation);
        this.operationNotice.set(this.translate.instant(
          result.alreadyRunning ? 'shopFloor.operations.alreadyRunning' : 'shopFloor.operations.started',
          { step: row.stepNumber, title: row.title }));
        this.loadRunningTimers();
      },
      error: (err: HttpErrorResponse) => this.operationFailed(err),
    });
  }

  protected stopOperation(row: JobOperationRow): void {
    if (row.operationId == null || !this.beginOperationCall()) return;
    this.shopFloorService.stopOperationTimer(this.jobId(), row.operationId).subscribe({
      next: () => {
        this.operationBusy.set(false);
        this.operationNotice.set(this.translate.instant('shopFloor.operations.stopped', { step: row.stepNumber, title: row.title }));
        this.loadOperations();
        this.loadRunningTimers();
      },
      error: (err: HttpErrorResponse) => this.operationFailed(err),
    });
  }

  protected stopRunningTimer(timer: RunningTimer): void {
    if (!this.beginOperationCall()) return;
    this.shopFloorService.stopTimer({ timeEntryId: timer.id }).subscribe({
      next: () => {
        this.operationBusy.set(false);
        this.operationNotice.set(this.translate.instant('shopFloor.operations.timerStopped', { jobNumber: timer.jobNumber ?? '' }));
        this.loadOperations();
        this.loadRunningTimers();
      },
      error: (err: HttpErrorResponse) => this.operationFailed(err),
    });
  }

  protected openQuantity(row: JobOperationRow, prefillAll: boolean): void {
    this.error.set(null);
    this.operationNotice.set(null);
    this.quantityTarget.set({ row, prefillAll });
    this.step.set('quantity');
  }

  protected submitQuantity(request: UpdateJobOperationProgressRequest): void {
    const target = this.quantityTarget();
    if (!target || target.row.operationId == null || !this.beginOperationCall()) return;
    const row = target.row;
    this.shopFloorService.updateOperationProgress(this.jobId(), target.row.operationId, request).subscribe({
      next: (result) => {
        this.operationBusy.set(false);
        this.quantityTarget.set(null);
        this.replaceOperation(result.operation, result.allOperationsComplete, result.estimatedRemainingMinutes);
        this.loadRunningTimers();
        if (result.allOperationsComplete && this.canAdvance()) {
          this.step.set('confirm-advance');
          return;
        }
        this.operationNotice.set(this.translate.instant('shopFloor.operations.recorded', {
          step: row.stepNumber, count: result.operation.completedQuantity, total: this.jobOperations()?.jobQuantity ?? 0,
        }));
        this.step.set('actions');
      },
      error: (err: HttpErrorResponse) => {
        this.quantityTarget.set(null);
        this.step.set('actions');
        this.operationFailed(err);
      },
    });
  }

  protected cancelQuantity(): void {
    this.quantityTarget.set(null);
    this.step.set('actions');
  }

  private loadStatus(): void {
    this.statusLoading.set(true);
    this.shopFloorService.getJobStatus(this.jobId()).subscribe({
      next: (status) => {
        this.jobStatus.set(status);
        this.statusLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.statusLoading.set(false);
        this.error.set(this.translate.instant('shopFloor.jobFlow.statusLoadFailed', { reason: this.serverReason(err) }));
      },
    });
  }

  private serverReason(err: HttpErrorResponse): string {
    return err?.error?.detail ?? err?.error?.title ?? err?.message ?? '';
  }

  protected startTimer(): void {
    if (this.processing()) return;
    this.processing.set(true);
    this.error.set(null);
    this.step.set('processing');

    this.shopFloorService.startTimer(this.jobId()).subscribe({
      next: () => {
        this.processing.set(false);
        this.completedAction.set('timer-started');
        this.step.set('done');
        setTimeout(() => this.completed.emit(), 1500);
      },
      error: () => {
        this.processing.set(false);
        this.error.set('Failed to start timer');
        this.step.set('actions');
      },
    });
  }

  protected stopTimer(): void {
    if (this.processing()) return;
    this.processing.set(true);
    this.error.set(null);
    this.step.set('processing');

    const tracking = this.tracking();
    const stop$ = tracking ? this.shopFloorService.stopTimer({ jobId: this.jobId() }) : this.shopFloorService.stopTimer();
    stop$.subscribe({
      next: () => {
        this.processing.set(false);
        this.completedAction.set('timer-stopped');
        this.step.set('done');
        setTimeout(() => this.completed.emit(), 1500);
      },
      error: (err: HttpErrorResponse) => {
        this.processing.set(false);
        this.step.set('actions');
        if (!tracking) {
          this.error.set('Failed to stop timer');
          return;
        }
        this.error.set(this.translate.instant('shopFloor.operations.actionFailed', { reason: this.serverReason(err) }));
        this.loadRunningTimers();
      },
    });
  }

  protected showAdvanceStage(): void {
    if (!this.canAdvance()) return;
    this.error.set(null);
    this.step.set('confirm-advance');
  }

  protected confirmAdvanceStage(): void {
    if (this.processing() || !this.canAdvance()) return;
    this.processing.set(true);
    this.error.set(null);
    this.step.set('processing');

    this.shopFloorService.advanceJob(this.jobId()).subscribe({
      next: (result) => {
        this.processing.set(false);
        this.jobStatus.set(result.status);
        this.advancedTo.set(result.status.stageName);
        this.completedAction.set('stage-advanced');
        this.step.set('done');
        setTimeout(() => this.completed.emit(), 1500);
      },
      error: (err: HttpErrorResponse) => {
        this.processing.set(false);
        this.error.set(this.translate.instant('shopFloor.jobFlow.advanceFailed', { reason: this.serverReason(err) }));
        this.step.set('actions');
      },
    });
  }

  protected showLogNote(): void {
    this.noteControl.reset();
    this.step.set('log-note');
  }

  protected submitNote(): void {
    const noteText = this.noteControl.value?.trim();
    if (!noteText || this.processing()) return;

    this.processing.set(true);
    this.error.set(null);
    this.step.set('processing');

    this.kanbanService.addComment(this.jobId(), noteText).subscribe({
      next: () => {
        this.processing.set(false);
        this.completedAction.set('note-logged');
        this.step.set('done');
        setTimeout(() => this.completed.emit(), 1500);
      },
      error: () => {
        this.processing.set(false);
        this.error.set('Failed to log note');
        this.step.set('log-note');
      },
    });
  }

  protected showProblem(): void {
    if (!this.andonEnabled()) return;
    this.error.set(null);
    this.problemType.set(null);
    this.problemNoteControl.reset();
    this.step.set('problem');
  }

  protected selectProblemType(type: KioskAndonType): void {
    this.problemType.set(type);
  }

  protected submitProblem(): void {
    const type = this.problemType();
    if (!type || this.processing() || !this.andonEnabled()) return;

    this.processing.set(true);
    this.error.set(null);
    this.step.set('processing');

    const notes = this.problemNoteControl.value?.trim() || null;
    this.shopFloorService.raiseAndon({ jobId: this.jobId(), type, notes }).subscribe({
      next: (result) => {
        this.processing.set(false);
        this.problemRaisedAt.set(result.workCenterName);
        this.completedAction.set('problem-raised');
        this.step.set('done');
        setTimeout(() => this.completed.emit(), 1500);
      },
      error: (err: HttpErrorResponse) => {
        this.processing.set(false);
        this.error.set(this.translate.instant('shopFloor.jobFlow.problem.failed', { reason: this.serverReason(err) }));
        this.step.set('problem');
      },
    });
  }

  protected backToActions(): void {
    this.step.set('actions');
  }

  protected cancel(): void {
    this.cancelled.emit();
  }
}
