import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';

import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { SequencesService } from '../../services/sequences.service';
import {
  SequenceEvent, SequenceGateInstance, SequenceInstance, SequenceStepInstance,
} from '../../models/sequence.model';
import { ReasonDialogComponent, ReasonDialogData } from '../reason-dialog/reason-dialog.component';

/**
 * Operational view of one sequence instance: the steps with their live status
 * and dwell clocks, the gates with their go/no-go verdicts, and the actions
 * that move it forward (start/complete/skip a step, clear/override a gate,
 * rework, cancel, re-evaluate). Every irreversible action captures a reason.
 */
@Component({
  selector: 'app-sequence-instance-panel',
  standalone: true,
  imports: [DatePipe, TranslatePipe],
  templateUrl: './instance-detail-panel.component.html',
  styleUrl: './instance-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SequenceInstancePanelComponent {
  private readonly service = inject(SequencesService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly instanceId = input.required<number>();
  readonly changed = output<void>();

  protected readonly instance = signal<SequenceInstance | null>(null);
  protected readonly events = signal<SequenceEvent[]>([]);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly showEvents = signal(false);

  protected readonly isRunning = computed(() => this.instance()?.status === 'Running');

  constructor() {
    effect(() => {
      const id = this.instanceId();
      if (id > 0) this.load(id);
    });
  }

  private load(id: number): void {
    this.loading.set(true);
    this.service.getInstance(id).subscribe({
      next: (inst) => {
        this.instance.set(inst);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.service.getEvents(id).subscribe({ next: (e) => this.events.set(e) });
  }

  /** Gates attached to a given step. */
  protected gatesFor(stepKey: string): SequenceGateInstance[] {
    return (this.instance()?.gates ?? []).filter(g => g.stepKey === stepKey);
  }

  private apply(op: (id: number) => ReturnType<SequencesService['getInstance']>): void {
    const id = this.instanceId();
    if (this.busy()) return;
    this.busy.set(true);
    op(id).subscribe({
      next: (inst) => {
        this.instance.set(inst);
        this.busy.set(false);
        this.changed.emit();
        this.service.getEvents(id).subscribe({ next: (e) => this.events.set(e) });
      },
      error: (err) => {
        this.snackbar.error(err?.error?.detail ?? this.translate.instant('sequences.actionFailed'));
        this.busy.set(false);
      },
    });
  }

  private askReason(data: ReasonDialogData): Promise<string | undefined> {
    const ref = this.dialog.open<ReasonDialogComponent, ReasonDialogData, string>(ReasonDialogComponent, {
      data, width: '460px',
    });
    return new Promise(resolve => ref.afterClosed().subscribe(r => resolve(r)));
  }

  protected reevaluate(): void {
    this.apply(id => this.service.reevaluate(id));
  }

  protected startStep(step: SequenceStepInstance): void {
    this.apply(id => this.service.startStep(id, step.stepKey));
  }

  protected completeStep(step: SequenceStepInstance): void {
    this.apply(id => this.service.completeStep(id, step.stepKey));
  }

  protected async skipStep(step: SequenceStepInstance): Promise<void> {
    const reason = await this.askReason({
      title: this.translate.instant('sequences.skip.title', { step: step.name }),
      message: this.translate.instant('sequences.skip.message'),
      confirmLabel: this.translate.instant('sequences.skip.confirm'),
      severity: 'warn',
    });
    if (reason) this.apply(id => this.service.skipStep(id, step.stepKey, reason));
  }

  protected clearGate(gate: SequenceGateInstance): void {
    this.apply(id => this.service.clearGate(id, gate.stepKey, gate.gateKey));
  }

  protected async overrideGate(gate: SequenceGateInstance): Promise<void> {
    const reason = await this.askReason({
      title: this.translate.instant('sequences.override.title', { gate: gate.name }),
      message: this.translate.instant('sequences.override.message'),
      confirmLabel: this.translate.instant('sequences.override.confirm'),
      severity: 'danger',
    });
    if (reason) this.apply(id => this.service.overrideGate(id, gate.stepKey, gate.gateKey, reason));
  }

  protected async rework(step: SequenceStepInstance): Promise<void> {
    const reason = await this.askReason({
      title: this.translate.instant('sequences.rework.title', { step: step.name }),
      message: this.translate.instant('sequences.rework.message'),
      confirmLabel: this.translate.instant('sequences.rework.confirm'),
      severity: 'warn',
    });
    if (reason) this.apply(id => this.service.rework(id, step.stepKey, reason));
  }

  protected async cancel(): Promise<void> {
    const reason = await this.askReason({
      title: this.translate.instant('sequences.cancel.title'),
      message: this.translate.instant('sequences.cancel.message'),
      confirmLabel: this.translate.instant('sequences.cancel.confirm'),
      severity: 'danger',
    });
    if (reason) this.apply(id => this.service.cancel(id, reason));
  }

  protected toggleEvents(): void {
    this.showEvents.update(v => !v);
  }

  // Presentation helpers ---------------------------------------------------
  protected stepChipClass(status: string): string {
    return {
      Pending: 'chip--muted',
      Ready: 'chip--info',
      InProgress: 'chip--warning',
      Complete: 'chip--success',
      Skipped: 'chip--muted',
    }[status] ?? 'chip--muted';
  }

  protected verdictChipClass(verdict: string): string {
    return { Go: 'chip--success', NoGo: 'chip--danger', Unknown: 'chip--muted' }[verdict] ?? 'chip--muted';
  }
}
