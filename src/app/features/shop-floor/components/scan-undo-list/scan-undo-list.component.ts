import { ChangeDetectionStrategy, Component, computed, inject, OnInit, output, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { forkJoin } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ScanActionService } from '../../../../shared/services/scan-action.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ScanLogEntry } from '../../../../shared/models/scan-log.model';
import { PinPromptDialogComponent, PinPromptDialogData } from '../pin-prompt-dialog/pin-prompt-dialog.component';
import { SCAN_LOG_ACTION_LABEL_KEYS } from '../../models/scan-log-action-label-keys.const';
import { DateTimePipe } from '../../../../shared/pipes/date-time.pipe';

const DEFAULT_LOOKBACK_HOURS = 6;

@Component({
  selector: 'app-scan-undo-list',
  standalone: true,
  imports: [DateTimePipe, TranslatePipe],
  templateUrl: './scan-undo-list.component.html',
  styleUrl: './scan-undo-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScanUndoListComponent implements OnInit {
  private readonly scanActionService = inject(ScanActionService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);

  readonly closed = output<void>();

  protected readonly lookbackHours = DEFAULT_LOOKBACK_HOURS;

  readonly entries = signal<ScanLogEntry[]>([]);
  readonly loading = signal(false);
  readonly loadFailed = signal(false);
  readonly reversing = signal<number | null>(null);

  readonly recentEntries = computed(() => {
    const cutoff = Date.now() - DEFAULT_LOOKBACK_HOURS * 3_600_000;
    return this.entries().filter(e => new Date(e.createdAt).getTime() >= cutoff);
  });

  ngOnInit(): void {
    this.loadEntries();
  }

  loadEntries(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    const now = new Date();
    const lookbackStart = new Date(now.getTime() - DEFAULT_LOOKBACK_HOURS * 3_600_000);
    const days = [...new Set([lookbackStart, now].map(d => d.toISOString().slice(0, 10)))];
    forkJoin(days.map(day => this.scanActionService.getScanLog(undefined, day))).subscribe({
      next: (pages) => {
        const byId = new Map(pages.flat().map(e => [e.id, e]));
        this.entries.set([...byId.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadFailed.set(true);
      },
    });
  }

  reverseEntry(entry: ScanLogEntry): void {
    this.dialog.open(PinPromptDialogComponent, {
      width: '400px',
      data: { title: this.translate.instant('kioskFlows.pin.title') } satisfies PinPromptDialogData,
    }).afterClosed().subscribe((pin: string | null) => {
      if (!pin) return;
      this.reversing.set(entry.id);
      this.scanActionService.reverseScanAction(entry.id, pin).subscribe({
        next: () => {
          this.reversing.set(null);
          const desc = this.buildReversalDescription(entry);
          this.snackbar.success(this.translate.instant('kioskFlows.undo.reversedToast', { description: desc }));
          this.loadEntries();
        },
        error: (err: unknown) => {
          this.reversing.set(null);
          this.snackbar.errorFrom(err, 'kioskFlows.undo.reverseFailed');
        },
      });
    });
  }

  close(): void {
    this.closed.emit();
  }

  actionTypeLabel(actionType: string): string {
    const key = SCAN_LOG_ACTION_LABEL_KEYS[actionType];
    return key ? this.translate.instant(key) : actionType;
  }

  private buildReversalDescription(entry: ScanLogEntry): string {
    const parts: string[] = [];
    if (entry.quantity) parts.push(`${entry.quantity}\u00D7`);
    if (entry.partNumber) parts.push(entry.partNumber);
    if (entry.actionType === 'Move' && entry.fromLocation) {
      parts.push(this.translate.instant('kioskFlows.undo.movedBackTo', { location: entry.fromLocation }));
    }
    return parts.join(' ') || this.actionTypeLabel(entry.actionType);
  }
}
