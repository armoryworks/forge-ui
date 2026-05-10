import { ChangeDetectionStrategy, Component, computed, HostListener, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { TelLinkOutboundService } from '../../../../shared/services/outbound-call.service';
import { LeadsService } from '../../services/leads.service';
import { DispositionRequest, OutreachState, QueueLead } from '../../models/queue.model';
import { CallbackSchedulerDialogComponent, CallbackSchedulerResult } from '../../components/callback-scheduler-dialog/callback-scheduler-dialog.component';

interface DispositionAction {
  state: OutreachState;
  shortcut: string;
  icon: string;
  labelKey: string;
  styleClass: 'success' | 'warning' | 'error' | 'muted';
}

/**
 * Phase 1r / Batch 6 — pull-based worker queue. Operator hits "give
 * me my next 5" and the page serves leads one at a time. Each lead
 * gets keyboard-driven dispositions:
 *
 *   E  — Engaged (lead exits queue, status flips to Contacted)
 *   N  — NoAnswer (re-queues for retry)
 *   V  — VoicemailLeft (re-queues for retry)
 *   C  — CallbackScheduled (opens callback-scheduler dialog for date + time)
 *   B  — BadData (lost — wrong number / bounce / disconnected)
 *   S  — Suppressed (operator-initiated DNC; UI follow-up to set prefs)
 *   J  — next lead in current batch
 *   K  — previous lead
 *
 * The dispatch is one POST per disposition + automatic advance to the
 * next lead in the batch. When the batch is exhausted the page invites
 * the operator to pull more.
 */
@Component({
  selector: 'app-leads-queue',
  standalone: true,
  imports: [
    DatePipe, ReactiveFormsModule, TranslatePipe,
    PageHeaderComponent, TextareaComponent,
    LoadingBlockDirective, EmptyStateComponent,
  ],
  templateUrl: './leads-queue.component.html',
  styleUrl: './leads-queue.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadsQueueComponent {
  private readonly leadsService = inject(LeadsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly outboundCall = inject(TelLinkOutboundService);
  private readonly dialog = inject(MatDialog);
  protected readonly translate = inject(TranslateService);

  protected readonly batch = signal<QueueLead[]>([]);
  protected readonly cursor = signal(0);
  protected readonly working = signal(false);
  protected readonly notesControl = new FormControl<string>('', { nonNullable: true });
  protected readonly batchSizeControl = new FormControl<number>(5, { nonNullable: true });

  protected readonly currentLead = computed(() => {
    const b = this.batch();
    const i = this.cursor();
    return i >= 0 && i < b.length ? b[i] : null;
  });

  protected readonly progress = computed(() => {
    const b = this.batch();
    if (b.length === 0) return null;
    return { current: this.cursor() + 1, total: b.length };
  });

  protected readonly actions: DispositionAction[] = [
    { state: 'Engaged', shortcut: 'E', icon: 'check_circle', labelKey: 'leads.queue.actionEngaged', styleClass: 'success' },
    { state: 'NoAnswer', shortcut: 'N', icon: 'phone_missed', labelKey: 'leads.queue.actionNoAnswer', styleClass: 'warning' },
    { state: 'VoicemailLeft', shortcut: 'V', icon: 'voicemail', labelKey: 'leads.queue.actionVoicemail', styleClass: 'warning' },
    { state: 'CallbackScheduled', shortcut: 'C', icon: 'schedule', labelKey: 'leads.queue.actionCallback', styleClass: 'muted' },
    { state: 'BadData', shortcut: 'B', icon: 'block', labelKey: 'leads.queue.actionBadData', styleClass: 'error' },
    { state: 'Suppressed', shortcut: 'S', icon: 'do_not_disturb', labelKey: 'leads.queue.actionSuppress', styleClass: 'error' },
  ];

  protected pull(): void {
    this.working.set(true);
    this.leadsService.pullQueue({ count: this.batchSizeControl.value }).subscribe({
      next: (leads) => {
        this.batch.set(leads);
        this.cursor.set(0);
        this.notesControl.setValue('');
        this.working.set(false);
        if (leads.length === 0) {
          this.snackbar.info(this.translate.instant('leads.queue.empty'));
        }
      },
      error: () => this.working.set(false),
    });
  }

  protected dispose(action: DispositionAction): void {
    const lead = this.currentLead();
    if (!lead) return;

    if (action.state === 'CallbackScheduled') {
      // Open the scheduler dialog and only proceed once the operator
      // confirms a date/time. Cancelling the dialog aborts the
      // disposition entirely so the lead stays on the current rep.
      this.dialog.open<CallbackSchedulerDialogComponent, void, CallbackSchedulerResult | undefined>(
        CallbackSchedulerDialogComponent, { width: '420px' },
      ).afterClosed().subscribe(result => {
        if (!result) return;
        this.submitDisposition(lead.id, {
          nextState: action.state,
          notes: this.notesControl.value.trim() || undefined,
          callbackAt: result.callbackAt,
        }, action.labelKey);
      });
      return;
    }

    this.submitDisposition(lead.id, {
      nextState: action.state,
      notes: this.notesControl.value.trim() || undefined,
    }, action.labelKey);
  }

  private submitDisposition(leadId: number, req: DispositionRequest, labelKey: string): void {
    this.working.set(true);
    this.leadsService.dispositionLead(leadId, req).subscribe({
      next: () => {
        this.working.set(false);
        this.snackbar.success(this.translate.instant(labelKey));
        this.notesControl.setValue('');
        this.advance();
      },
      error: () => this.working.set(false),
    });
  }

  protected advance(): void {
    if (this.cursor() < this.batch().length - 1) this.cursor.update(c => c + 1);
    else this.batch.set([]); // batch exhausted
  }

  protected back(): void {
    if (this.cursor() > 0) this.cursor.update(c => c - 1);
  }

  /**
   * Click-to-dial action wired through IOutboundCallService. v1
   * implementation fires a tel: link; future Asterisk/Twilio impls
   * place the call programmatically + auto-log the ContactInteraction.
   */
  protected dial(): void {
    const lead = this.currentLead();
    if (!lead?.phone) return;
    this.outboundCall.placeCall(lead.phone, { entityType: 'Lead', entityId: lead.id }).subscribe(result => {
      if (!result.ok) {
        this.snackbar.error(this.translate.instant('leads.queue.dialFailed'));
      }
    });
  }

  /**
   * Keyboard shortcut listener. Letter keys for dispositions, J/K for
   * navigation. Skipped when an input/textarea has focus so notes
   * typing isn't intercepted.
   */
  @HostListener('window:keydown', ['$event'])
  onKey(ev: KeyboardEvent): void {
    if (this.batch().length === 0) return;
    const tag = (ev.target as HTMLElement | null)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const key = ev.key.toUpperCase();
    if (key === 'J') { ev.preventDefault(); this.advance(); return; }
    if (key === 'K') { ev.preventDefault(); this.back(); return; }
    const action = this.actions.find(a => a.shortcut === key);
    if (action) { ev.preventDefault(); this.dispose(action); }
  }
}
